import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  type CLIAdapter,
  type DashboardState,
  type SessionSummary,
  type TechniqueConfig,
  emptyState,
} from "./types.js";
import { readChatStoreMeta, readTrackingStats, readScoredCommitStats } from "./cursor-chat-db.js";

interface CursorAdapterOptions {
  dataDir?: string;
  cwd?: string;
}

export class CursorAdapter implements CLIAdapter {
  readonly name = "cursor";
  readonly displayName = "Cursor";
  readonly dataDir: string;
  readonly rulesFile = ".cursor/rules/";

  private readonly cwd: string;

  constructor(opts: CursorAdapterOptions = {}) {
    this.dataDir = opts.dataDir ?? path.join(os.homedir(), ".cursor");
    this.cwd = opts.cwd ?? process.cwd();
  }

  async collectState(): Promise<DashboardState> {
    const state = emptyState();
    state.platform = "cursor";

    await Promise.all([
      this.readSessions(state),
      this.readConfig(state),
      this.readEnvironment(state),
    ]);

    return state;
  }

  getWatchPaths(): string[] {
    return [
      path.join(this.dataDir, "chats"),
    ];
  }

  getPollPaths(): string[] {
    return [
      path.join(this.dataDir, "cli-config.json"),
      path.join(this.cwd, ".cursor", "hooks.json"),
      path.join(this.cwd, ".cursorignore"),
    ];
  }

  getTechniqueOverrides(): Map<string, TechniqueConfig> {
    return new Map();
  }

  // ── Session Discovery ──────────────────────────────────

  private async readSessions(state: DashboardState): Promise<void> {
    try {
      const chatsDir = path.join(this.dataDir, "chats");
      const workspaces = await fs.readdir(chatsDir);

      const summaries: SessionSummary[] = [];

      for (const ws of workspaces) {
        const wsDir = path.join(chatsDir, ws);
        let convDirs: string[];
        try {
          convDirs = await fs.readdir(wsDir);
        } catch { continue; }

        for (const conv of convDirs) {
          const dbPath = path.join(wsDir, conv, "store.db");
          try {
            await fs.access(dbPath);
          } catch { continue; }

          const meta = readChatStoreMeta(dbPath);
          if (!meta) continue;

          summaries.push({
            sessionId: meta.conversationId || conv,
            project: meta.name || conv,
            startedAt: meta.createdAt,
            messageCount: 0,  // not available locally
            isSelected: false,
            inputTokens: 0,
            outputTokens: 0,
            cacheReadTokens: 0,
            cacheCreateTokens: 0,
            model: meta.model,
            contextWindow: 0,
            contextPercent: 0,
            contextHistory: [],
            ageMs: meta.createdAt > 0 ? Date.now() - meta.createdAt : 0,
            timeSinceLastMessageMs: meta.createdAt > 0 ? Date.now() - meta.createdAt : 0,
            memoryFileCount: 0,
            memoryTotalBytes: 0,
            memoryRecentFiles: [],
            ignoreSuggestions: [],
            rulesLines: 0,
            mcpServerCount: 0,
            mcpServersEnabled: 0,
            hasIgnoreFile: false,
            recentTurns: [],
            lastCompactMs: 0,
            lastCostCheckMs: 0,
            mode: meta.mode,
            ignoreFileName: ".cursorignore",
            ignorePatterns: [],
            ignorePatternCount: 0,
          });
        }
      }

      // Sort by most recent first, select first
      summaries.sort((a, b) => b.startedAt - a.startedAt);
      if (summaries.length > 0) summaries[0].isSelected = true;

      state.sessionList = summaries;
      state.activeSessions = summaries.length;

      if (summaries.length > 0) {
        state.sessionAgeMs = summaries[0].ageMs;
      }

      // Read rules for each session's project
      await this.enrichSessionsWithRules(summaries);
    } catch {
      // chats dir missing — keep defaults
    }
  }

  private async enrichSessionsWithRules(summaries: SessionSummary[]): Promise<void> {
    // For now, read rules from cwd's .cursor/rules/
    const rulesLines = await this.countRulesLines(this.cwd);
    for (const s of summaries) {
      s.rulesLines = rulesLines;
    }
  }

  // ── Config ─────────────────────────────────────────────

  private async readConfig(state: DashboardState): Promise<void> {
    try {
      const raw = await fs.readFile(
        path.join(this.dataDir, "cli-config.json"),
        "utf-8",
      );
      const data = JSON.parse(raw);

      if (data.model?.modelId) {
        state.liveModel = data.model.modelId;
      }
    } catch {
      // File missing — keep defaults
    }
  }

  // ── Environment ────────────────────────────────────────

  private async readEnvironment(state: DashboardState): Promise<void> {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    state.isPeakHours = day >= 1 && day <= 5 && hour >= 9 && hour < 17;

    await Promise.all([
      this.readHooks(state),
      this.readIgnore(state),
      this.readTracking(state),
    ]);
  }

  private async readHooks(state: DashboardState): Promise<void> {
    try {
      const raw = await fs.readFile(
        path.join(this.cwd, ".cursor", "hooks.json"),
        "utf-8",
      );
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        state.hookCount = data.length;
      } else if (data && typeof data === "object") {
        state.hookCount = Object.keys(data).length;
      }
    } catch {
      // No hooks file
    }
  }

  private async readIgnore(state: DashboardState): Promise<void> {
    const commonIgnorable = ["node_modules", "dist", ".next", "build", "coverage", ".git", "*.log"];
    let existingPatterns: string[] = [];
    let hasFile = false;

    try {
      const raw = await fs.readFile(path.join(this.cwd, ".cursorignore"), "utf-8");
      existingPatterns = raw.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
      hasFile = true;
    } catch { /* no ignore file */ }

    const suggestions: string[] = [];
    if (!hasFile) {
      for (const pattern of commonIgnorable) {
        try {
          if (!pattern.includes("*")) {
            await fs.access(path.join(this.cwd, pattern));
            suggestions.push(pattern);
          }
        } catch { /* doesn't exist */ }
      }
    }

    for (const s of state.sessionList) {
      s.hasIgnoreFile = hasFile;
      s.ignorePatterns = existingPatterns;
      s.ignorePatternCount = existingPatterns.length;
      s.ignoreSuggestions = suggestions;
    }
  }

  private async readTracking(state: DashboardState): Promise<void> {
    const dbPath = path.join(this.dataDir, "ai-tracking", "ai-code-tracking.db");
    const stats = readTrackingStats(dbPath);
    if (stats.trackingStartTime > 0) {
      state.sessionAgeMs = Math.max(state.sessionAgeMs, Date.now() - stats.trackingStartTime);
    }

    const commitStats = readScoredCommitStats(dbPath);
    state.aiLinesAdded = commitStats.aiLinesAdded;
    state.humanLinesAdded = commitStats.humanLinesAdded;
    state.aiPercentage = commitStats.aiPercentage;
    state.trackedCommitCount = commitStats.commitCount;
  }

  // ── Rules Counting ─────────────────────────────────────

  private async countRulesLines(cwd: string): Promise<number> {
    let total = 0;
    const rulesDir = path.join(cwd, ".cursor", "rules");
    try {
      const files = await fs.readdir(rulesDir);
      for (const f of files) {
        if (f.endsWith(".mdc") || f.endsWith(".md")) {
          try {
            const raw = await fs.readFile(path.join(rulesDir, f), "utf-8");
            total += raw.split("\n").length;
          } catch { /* skip */ }
        }
      }
    } catch {
      // No rules dir
    }
    return total;
  }
}
