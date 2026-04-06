import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  type CLIAdapter,
  type DashboardState,
  type SessionSummary,
  type TechniqueConfig,
  type TurnEntry,
  emptyState,
} from "./types.js";
import { deriveCwdKey, parseSessionJsonlContent } from "./parse-session.js";

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
  private modelContextWindows: Record<string, number> = {};

  constructor(opts: ClaudeAdapterOptions = {}) {
    this.dataDir = opts.dataDir ?? path.join(os.homedir(), ".claude");
    this.cwd = opts.cwd ?? process.cwd();
    this.sessionId = opts.sessionId;
  }

  async collectState(): Promise<DashboardState> {
    const state = emptyState();
    state.platform = "claude";

    // readStatsCache must run first — populates modelContextWindows
    await this.readStatsCache(state);

    await Promise.all([
      this.readSessions(state),
      this.readHistory(state),
      this.readSettings(state),
      this.readGlobalEnvironment(state),
    ]);

    return state;
  }

  getWatchPaths(): string[] {
    return [
      path.join(this.dataDir, "stats-cache.json"),
      path.join(this.dataDir, "sessions"),
      path.join(this.dataDir, "history.jsonl"),
      path.join(this.dataDir, "projects", this.getCwdKey(), "memory"),
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

  // ── Helpers ─────────────────────────────────────────────

  private getCwdKey(cwd?: string): string {
    return deriveCwdKey(cwd ?? this.cwd);
  }

  // ── Global Readers ──────────────────────────────────────

  private async readStatsCache(state: DashboardState): Promise<void> {
    try {
      const raw = await fs.readFile(
        path.join(this.dataDir, "stats-cache.json"),
        "utf-8",
      );
      const data = JSON.parse(raw);

      const modelTotals: Record<string, { input: number; output: number; cacheRead: number; cost: number }> = {};
      if (data.modelUsage) {
        for (const [modelName, model] of Object.entries(data.modelUsage) as [string, any][]) {
          const input = model.inputTokens ?? 0;
          const output = model.outputTokens ?? 0;
          const cacheRead = model.cacheReadInputTokens ?? 0;
          const cost = model.costUSD ?? 0;
          state.totalInputTokens += input;
          state.totalOutputTokens += output;
          state.totalCacheReadTokens += cacheRead;
          state.totalCacheCreationTokens += model.cacheCreationInputTokens ?? 0;
          state.totalCostUsd += cost;
          modelTotals[modelName] = { input, output, cacheRead, cost };
          if (model.contextWindow) {
            this.modelContextWindows[modelName] = model.contextWindow;
          }
        }
      }

      const today = new Date().toISOString().slice(0, 10);
      if (Array.isArray(data.dailyActivity)) {
        const todayActivity = data.dailyActivity.find((d: any) => d.date === today);
        if (todayActivity) {
          state.todayMessageCount = todayActivity.messageCount ?? 0;
        }
      }

      if (Array.isArray(data.dailyModelTokens)) {
        const todayTokens = data.dailyModelTokens.find((d: any) => d.date === today);
        if (todayTokens?.tokensByModel) {
          state.todayTokensByModel = todayTokens.tokensByModel;
          for (const [modelName, todayTotal] of Object.entries(todayTokens.tokensByModel) as [string, number][]) {
            const lifetime = modelTotals[modelName];
            if (!lifetime) continue;
            const lifetimeTotal = lifetime.input + lifetime.output;
            if (lifetimeTotal === 0) continue;
            const ratio = todayTotal / lifetimeTotal;
            state.todayInputTokens += Math.round(lifetime.input * ratio);
            state.todayOutputTokens += Math.round(lifetime.output * ratio);
            state.todayCacheReadTokens += Math.round(lifetime.cacheRead * ratio);
            state.todayCostUsd += lifetime.cost * ratio;
          }
        }
      }

      if (data.hourCounts && typeof data.hourCounts === "object") {
        state.hourCounts = data.hourCounts;
        const entries = Object.entries(data.hourCounts)
          .map(([h, c]) => ({ hour: Number(h), count: c as number }))
          .sort((a, b) => b.count - a.count);
        state.peakHours = entries.slice(0, 3).map((e) => e.hour);
      }
    } catch {
      // File missing or malformed — keep defaults
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

  private async readGlobalEnvironment(state: DashboardState): Promise<void> {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    state.isPeakHours = day >= 1 && day <= 5 && hour >= 9 && hour < 17;
    state.hasAutoCompactEnv = !!process.env.CLAUDE_AUTO_COMPACT;
    state.hasContextCapEnv = !!process.env.CLAUDE_CONTEXT_CAP;
  }

  // ── Session Builder ─────────────────────────────────────

  private async readSessions(state: DashboardState): Promise<void> {
    try {
      const sessionsDir = path.join(this.dataDir, "sessions");
      const files = await fs.readdir(sessionsDir);
      const jsonFiles = files.filter((f: string) => f.endsWith(".json"));

      if (jsonFiles.length === 0) return;

      state.activeSessions = jsonFiles.length;

      const sessions: Array<{ file: string; data: any }> = [];
      await Promise.all(
        jsonFiles.map(async (file: string) => {
          try {
            const raw = await fs.readFile(path.join(sessionsDir, file), "utf-8");
            sessions.push({ file, data: JSON.parse(raw) });
          } catch {
            // Skip malformed session files
          }
        }),
      );

      let selected: any;
      if (this.sessionId) {
        selected = sessions.find((s) => s.data.sessionId === this.sessionId)?.data;
      }
      if (!selected && sessions.length > 0) {
        selected = sessions.reduce((best, s) =>
          (s.data.startedAt ?? 0) > (best.data.startedAt ?? 0) ? s : best,
        ).data;
      }

      if (selected?.startedAt) {
        state.sessionAgeMs = Date.now() - selected.startedAt;
      }

      // Build session list with per-session metrics AND cwd-dependent data
      const summaries = await Promise.all(
        sessions.map(async (s): Promise<SessionSummary> => {
          const sid = s.data.sessionId ?? "";
          const sessionCwd = s.data.cwd ?? this.cwd;

          // Run JSONL parsing + cwd-dependent reads in parallel per session
          const [metrics, memory, ignore, claudeMd, mcp, sessionTurns] =
            await Promise.all([
              this.parseSessionJsonl(sid, sessionCwd),
              this.readMemoryForCwd(sessionCwd),
              this.readIgnoreSuggestionsForCwd(sessionCwd),
              this.readClaudeMdForCwd(sessionCwd),
              this.readMcpConfigForCwd(sessionCwd),
              Promise.resolve(
                state.recentTurns.filter((t) => t.sessionId === sid),
              ),
            ]);

          return {
            sessionId: sid,
            project: sessionCwd,
            startedAt: s.data.startedAt ?? 0,
            messageCount: metrics.userMessages,
            isSelected: sid === selected?.sessionId,
            inputTokens: metrics.inputTokens,
            outputTokens: metrics.outputTokens,
            cacheReadTokens: metrics.cacheReadTokens,
            cacheCreateTokens: metrics.cacheCreateTokens,
            model: metrics.model,
            contextWindow: metrics.contextWindow,
            contextPercent: metrics.contextPercent,
            contextHistory: metrics.contextHistory,
            ageMs: s.data.startedAt ? Date.now() - s.data.startedAt : 0,
            timeSinceLastMessageMs: metrics.timeSinceLastMessageMs,
            memoryFileCount: memory.fileCount,
            memoryTotalBytes: memory.totalBytes,
            memoryRecentFiles: memory.recentFiles,
            ignoreSuggestions: ignore.suggestions,
            rulesLines: claudeMd,
            mcpServerCount: mcp.total,
            mcpServersEnabled: mcp.enabled,
            hasIgnoreFile: ignore.hasFile,
            recentTurns: sessionTurns,
            lastCompactMs: metrics.lastCompactMs,
            lastCostCheckMs: metrics.lastCostCheckMs,
            mode: s.data.kind ?? null,
            ignoreFileName: ".claudeignore",
            ignorePatterns: ignore.patterns,
            ignorePatternCount: ignore.patternCount,
          };
        }),
      );

      // Cross-session context window propagation: if ANY session for a model
      // detected extended context (>200k), all sessions with that model get 1M.
      const extendedModels = new Set<string>();
      for (const s of summaries) {
        if (s.model && s.contextWindow > 200_000) {
          extendedModels.add(s.model);
        }
      }
      for (const s of summaries) {
        if (s.model && extendedModels.has(s.model) && s.contextWindow <= 200_000) {
          s.contextWindow = 1_000_000;
          // Recompute contextPercent and contextHistory with the corrected window
          if (s.contextHistory.length > 0) {
            // We need to rescale: old values were based on 200k, new is 1M
            const ratio = 200_000 / 1_000_000;
            s.contextHistory = s.contextHistory.map((pct) =>
              Math.min(100, Math.round(pct * ratio)),
            );
            s.contextPercent = s.contextHistory[s.contextHistory.length - 1];
          }
        }
      }

      state.sessionList = summaries;

      const sel = summaries.find((s) => s.isSelected);
      if (sel) {
        state.sessionMessages = sel.messageCount;
        state.timeSinceLastMessageMs = sel.timeSinceLastMessageMs;
      }
    } catch {
      // sessions dir missing — keep defaults
    }
  }

  // ── Per-Session JSONL Parser ────────────────────────────

  private async parseSessionJsonl(
    sessionId: string,
    sessionCwd?: string,
  ) {
    try {
      const cwd = sessionCwd || this.cwd;
      const jsonlPath = path.join(
        this.dataDir, "projects", this.getCwdKey(cwd), `${sessionId}.jsonl`,
      );
      const raw = await fs.readFile(jsonlPath, "utf-8");
      return parseSessionJsonlContent(raw, this.modelContextWindows);
    } catch {
      return parseSessionJsonlContent("", {});
    }
  }

  // ── Per-Session CWD-Dependent Readers ───────────────────

  private async readMemoryForCwd(cwd: string): Promise<{
    fileCount: number;
    totalBytes: number;
    recentFiles: Array<{ name: string; modifiedMs: number }>;
  }> {
    try {
      const memoryDir = path.join(this.dataDir, "projects", this.getCwdKey(cwd), "memory");
      const files = await fs.readdir(memoryDir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));
      if (mdFiles.length === 0) return { fileCount: 0, totalBytes: 0, recentFiles: [] };

      const stats = await Promise.all(
        mdFiles.map(async (f) => {
          const s = await fs.stat(path.join(memoryDir, f));
          return { name: f, size: s.size, modifiedMs: s.mtimeMs };
        }),
      );

      return {
        fileCount: mdFiles.length,
        totalBytes: stats.reduce((sum, s) => sum + s.size, 0),
        recentFiles: stats.sort((a, b) => b.modifiedMs - a.modifiedMs).slice(0, 3)
          .map((s) => ({ name: s.name, modifiedMs: s.modifiedMs })),
      };
    } catch {
      return { fileCount: 0, totalBytes: 0, recentFiles: [] };
    }
  }

  private async readIgnoreSuggestionsForCwd(cwd: string): Promise<{ suggestions: string[]; hasFile: boolean; patterns: string[]; patternCount: number }> {
    const commonIgnorable = ["node_modules", "dist", ".next", "build", "coverage", ".git", "*.log"];
    let existingPatterns: string[] = [];
    let hasFile = false;
    try {
      const raw = await fs.readFile(path.join(cwd, ".claudeignore"), "utf-8");
      existingPatterns = raw.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
      hasFile = true;
    } catch { /* no ignore file */ }

    const suggestions: string[] = [];
    for (const pattern of commonIgnorable) {
      if (existingPatterns.includes(pattern)) continue;
      try {
        if (pattern.includes("*")) {
          if (existingPatterns.length === 0) suggestions.push(pattern);
        } else {
          await fs.access(path.join(cwd, pattern));
          suggestions.push(pattern);
        }
      } catch { /* doesn't exist */ }
    }
    return { suggestions, hasFile, patterns: existingPatterns, patternCount: existingPatterns.length };
  }

  private async readClaudeMdForCwd(cwd: string): Promise<number> {
    let totalLines = 0;
    for (const candidate of [path.join(cwd, "CLAUDE.md"), path.join(this.dataDir, "CLAUDE.md")]) {
      try {
        const raw = await fs.readFile(candidate, "utf-8");
        totalLines += raw.split("\n").length;
      } catch { /* skip */ }
    }
    return totalLines;
  }

  private async readMcpConfigForCwd(cwd: string): Promise<{ total: number; enabled: number }> {
    const candidates = [
      path.join(cwd, ".mcp.json"),
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
          return { total: entries.length, enabled: entries.filter((s) => !s.disabled).length };
        }
      } catch { /* try next */ }
    }
    return { total: 0, enabled: 0 };
  }
}
