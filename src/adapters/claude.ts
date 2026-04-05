import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  type CLIAdapter,
  type DashboardState,
  type TechniqueConfig,
  type TurnEntry,
  emptyState,
} from "./types.js";

interface ClaudeAdapterOptions {
  dataDir?: string;
  cwd?: string;
  sessionId?: string;
}

export class ClaudeAdapter implements CLIAdapter {
  readonly name = "claude";
  readonly displayName = "Claude Code";
  readonly dataDir: string;
  readonly rulesFile = "CLAUDE.md";

  private readonly cwd: string;
  private readonly sessionId?: string;

  constructor(opts: ClaudeAdapterOptions = {}) {
    this.dataDir = opts.dataDir ?? path.join(os.homedir(), ".claude");
    this.cwd = opts.cwd ?? process.cwd();
    this.sessionId = opts.sessionId;
  }

  async collectState(): Promise<DashboardState> {
    const state = emptyState();

    await Promise.all([
      this.readStatsCache(state),
      this.readSessions(state),
      this.readHistory(state),
      this.readSettings(state),
      this.readMcpConfig(state),
      this.readClaudeMd(state),
      this.readEnvironment(state),
    ]);

    return state;
  }

  getWatchPaths(): string[] {
    return [
      path.join(this.dataDir, "stats-cache.json"),
      path.join(this.dataDir, "sessions"),
      path.join(this.dataDir, "history.jsonl"),
    ];
  }

  getPollPaths(): string[] {
    return [
      path.join(this.dataDir, "settings.json"),
      path.join(this.dataDir, "mcp.json"),
      path.join(this.cwd, ".mcp.json"),
      path.join(this.cwd, "CLAUDE.md"),
      path.join(this.dataDir, "CLAUDE.md"),
    ];
  }

  getTechniqueOverrides(): Map<string, TechniqueConfig> {
    return new Map();
  }

  // ── Readers ──────────────────────────────────────────────

  private async readStatsCache(state: DashboardState): Promise<void> {
    try {
      const raw = await fs.readFile(
        path.join(this.dataDir, "stats-cache.json"),
        "utf-8",
      );
      const data = JSON.parse(raw);

      // Aggregate model usage
      if (data.modelUsage) {
        for (const model of Object.values(data.modelUsage) as any[]) {
          state.totalInputTokens += model.inputTokens ?? 0;
          state.totalOutputTokens += model.outputTokens ?? 0;
          state.totalCacheReadTokens += model.cacheReadInputTokens ?? 0;
          state.totalCacheCreationTokens += model.cacheCreationInputTokens ?? 0;
          state.totalCostUsd += model.costUSD ?? 0;
        }
      }

      // Today's activity
      const today = new Date().toISOString().slice(0, 10);
      if (Array.isArray(data.dailyActivity)) {
        const todayActivity = data.dailyActivity.find(
          (d: any) => d.date === today,
        );
        if (todayActivity) {
          state.todayMessageCount = todayActivity.messageCount ?? 0;
        }
      }

      // Today's tokens by model
      if (Array.isArray(data.dailyModelTokens)) {
        const todayTokens = data.dailyModelTokens.find(
          (d: any) => d.date === today,
        );
        if (todayTokens?.tokensByModel) {
          state.todayTokensByModel = todayTokens.tokensByModel;
        }
      }
    } catch {
      // File missing or malformed — keep defaults
    }
  }

  private async readSessions(state: DashboardState): Promise<void> {
    try {
      const sessionsDir = path.join(this.dataDir, "sessions");
      const files = await fs.readdir(sessionsDir);
      const jsonFiles = files.filter((f: string) => f.endsWith(".json"));

      if (jsonFiles.length === 0) return;

      state.activeSessions = jsonFiles.length;

      // Read all session files to find the most recent or specified session
      const sessions: Array<{ file: string; data: any }> = [];
      await Promise.all(
        jsonFiles.map(async (file: string) => {
          try {
            const raw = await fs.readFile(
              path.join(sessionsDir, file),
              "utf-8",
            );
            sessions.push({ file, data: JSON.parse(raw) });
          } catch {
            // Skip malformed session files
          }
        }),
      );

      let selected: any;
      if (this.sessionId) {
        selected = sessions.find(
          (s) => s.data.sessionId === this.sessionId,
        )?.data;
      }
      if (!selected && sessions.length > 0) {
        // Most recent by startedAt
        selected = sessions.reduce((best, s) =>
          (s.data.startedAt ?? 0) > (best.data.startedAt ?? 0) ? s : best,
        ).data;
      }

      if (selected?.startedAt) {
        state.sessionAgeMs = Date.now() - selected.startedAt;
      }

      // Read session JSONL if we have enough info
      if (selected?.sessionId) {
        await this.readSessionJsonl(state, selected.sessionId);
      }
    } catch {
      // sessions dir missing — keep defaults
    }
  }

  private async readSessionJsonl(
    state: DashboardState,
    sessionId: string,
  ): Promise<void> {
    try {
      // Derive project path: replace / with -
      const cwdKey = this.cwd.replace(/\//g, "-").replace(/^-/, "");
      const jsonlPath = path.join(
        this.dataDir,
        "projects",
        cwdKey,
        `${sessionId}.jsonl`,
      );

      const handle = await fs.open(jsonlPath, "r");
      try {
        const stat = await handle.stat();
        const tailSize = Math.min(stat.size, 64 * 1024);
        const buffer = Buffer.alloc(tailSize);
        await handle.read(buffer, 0, tailSize, stat.size - tailSize);
        const tail = buffer.toString("utf-8");

        const lines = tail.split("\n").filter(Boolean);
        // If we read from the middle, the first line may be partial — skip it
        const startIdx = stat.size > tailSize ? 1 : 0;

        let userMessages = 0;
        let maxTimestamp = 0;

        for (let i = startIdx; i < lines.length; i++) {
          try {
            const entry = JSON.parse(lines[i]);
            if (entry.type === "user") {
              userMessages++;
            }
            if (entry.timestamp && entry.timestamp > maxTimestamp) {
              maxTimestamp = entry.timestamp;
            }
          } catch {
            // Skip malformed lines
          }
        }

        state.sessionMessages = userMessages;
        if (maxTimestamp > 0) {
          state.timeSinceLastMessageMs = Date.now() - maxTimestamp;
        }
      } finally {
        await handle.close();
      }
    } catch {
      // Session JSONL missing — keep defaults
    }
  }

  private async readHistory(state: DashboardState): Promise<void> {
    try {
      const raw = await fs.readFile(
        path.join(this.dataDir, "history.jsonl"),
        "utf-8",
      );
      const lines = raw.trim().split("\n").filter(Boolean);
      const turns: TurnEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          turns.push({
            display: entry.display ?? "",
            timestamp: entry.timestamp ?? 0,
            project: entry.project ?? "",
            sessionId: entry.sessionId,
          });
        } catch {
          // Skip malformed lines
        }
      }

      state.recentTurns = turns;
    } catch {
      // File missing — keep defaults
    }
  }

  private async readSettings(state: DashboardState): Promise<void> {
    try {
      const raw = await fs.readFile(
        path.join(this.dataDir, "settings.json"),
        "utf-8",
      );
      const data = JSON.parse(raw);

      if (data.enabledPlugins && typeof data.enabledPlugins === "object") {
        state.pluginCount = Object.keys(data.enabledPlugins).length;
      }

      if (data.hooks && typeof data.hooks === "object") {
        state.hookCount = Object.keys(data.hooks).length;
      }

      if (data.notifications?.enabled) {
        state.hasNotificationsEnabled = true;
      }
    } catch {
      // File missing — keep defaults
    }
  }

  private async readMcpConfig(state: DashboardState): Promise<void> {
    // Try .mcp.json from cwd first, then dataDir, then mcp.json in dataDir
    const candidates = [
      path.join(this.cwd, ".mcp.json"),
      path.join(this.dataDir, ".mcp.json"),
      path.join(this.dataDir, "mcp.json"),
    ];

    for (const candidate of candidates) {
      try {
        const raw = await fs.readFile(candidate, "utf-8");
        const data = JSON.parse(raw);
        const servers = data.mcpServers;
        if (servers && typeof servers === "object") {
          const entries = Object.values(servers) as any[];
          state.mcpServerCount = entries.length;
          state.mcpServersEnabled = entries.filter(
            (s) => !s.disabled,
          ).length;
        }
        return; // Use first found
      } catch {
        // Try next candidate
      }
    }
  }

  private async readClaudeMd(state: DashboardState): Promise<void> {
    let totalLines = 0;

    const candidates = [
      path.join(this.cwd, "CLAUDE.md"),
      path.join(this.dataDir, "CLAUDE.md"),
    ];

    for (const candidate of candidates) {
      try {
        const raw = await fs.readFile(candidate, "utf-8");
        totalLines += raw.split("\n").length;
      } catch {
        // File missing — skip
      }
    }

    state.claudeMdLines = totalLines;
  }

  private async readEnvironment(state: DashboardState): Promise<void> {
    // Check for .claudeignore
    try {
      await fs.access(path.join(this.cwd, ".claudeignore"));
      state.hasIgnoreFile = true;
    } catch {
      state.hasIgnoreFile = false;
    }

    // Peak hours: 9am-5pm local time on weekdays
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    state.isPeakHours = day >= 1 && day <= 5 && hour >= 9 && hour < 17;

    // Environment variable checks
    state.hasAutoCompactEnv = !!process.env.CLAUDE_AUTO_COMPACT;
    state.hasContextCapEnv = !!process.env.CLAUDE_CONTEXT_CAP;
  }
}
