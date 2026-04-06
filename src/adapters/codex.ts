import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parse as parseTOML } from "smol-toml";
import {
  type CLIAdapter,
  type DashboardState,
  type SessionSummary,
  type TechniqueConfig,
  type TurnEntry,
  emptyState,
} from "./types.js";
import { parseCodexRollout } from "./parse-codex-rollout.js";
import { readCodexState } from "./codex-state-db.js";

interface CodexAdapterOptions {
  dataDir?: string;
  cwd?: string;
}

export class CodexAdapter implements CLIAdapter {
  readonly name = "codex";
  readonly displayName = "Codex CLI";
  readonly dataDir: string;
  readonly rulesFile = "AGENTS.md";

  private readonly cwd: string;

  constructor(opts: CodexAdapterOptions = {}) {
    this.dataDir = opts.dataDir ?? (process.env.CODEX_HOME || path.join(os.homedir(), ".codex"));
    this.cwd = opts.cwd ?? process.cwd();
  }

  async collectState(): Promise<DashboardState> {
    const state = emptyState();
    state.platform = "codex";

    await Promise.all([
      this.readSessions(state),
      this.readHistory(state),
      this.readEnvironment(state),
    ]);

    // Config must run after sessions so MCP counts can be applied
    await this.readConfig(state);

    return state;
  }

  getWatchPaths(): string[] {
    return [
      path.join(this.dataDir, "sessions"),
    ];
  }

  getPollPaths(): string[] {
    return [
      path.join(this.dataDir, "config.toml"),
      path.join(this.cwd, "AGENTS.md"),
    ];
  }

  getTechniqueOverrides(): Map<string, TechniqueConfig> {
    return new Map();
  }

  // ── Session Discovery ──────────────────────────────────

  private async readSessions(state: DashboardState): Promise<void> {
    try {
      const sessionsDir = path.join(this.dataDir, "sessions");
      let files: string[];
      try {
        files = (await fs.readdir(sessionsDir)).filter((f) => f.endsWith(".jsonl"));
      } catch {
        return;
      }

      if (files.length === 0) return;

      const summaries: SessionSummary[] = [];

      for (const file of files) {
        try {
          const raw = await fs.readFile(path.join(sessionsDir, file), "utf-8");
          const metrics = parseCodexRollout(raw);

          // Extract session ID from filename: rollout-{timestamp}-{uuid}.jsonl
          const sessionId = file.replace(/\.jsonl$/, "");

          summaries.push({
            sessionId,
            project: metrics.cwd ?? metrics.project ?? sessionId,
            startedAt: metrics.startedAt,
            messageCount: metrics.userMessages,
            isSelected: false,
            inputTokens: metrics.inputTokens,
            outputTokens: metrics.outputTokens,
            cacheReadTokens: metrics.cachedInputTokens,
            cacheCreateTokens: 0,
            model: metrics.model,
            contextWindow: metrics.contextWindow,
            contextPercent: metrics.contextPercent,
            contextHistory: metrics.contextHistory,
            ageMs: metrics.startedAt > 0 ? Date.now() - metrics.startedAt : 0,
            timeSinceLastMessageMs: metrics.timeSinceLastMessageMs,
            memoryFileCount: 0,
            memoryTotalBytes: 0,
            memoryRecentFiles: [],
            ignoreSuggestions: [],
            rulesLines: 0,
            mcpServerCount: 0,
            mcpServersEnabled: 0,
            hasIgnoreFile: false,
            recentTurns: [],
            lastCompactMs: metrics.lastCompactMs,
            lastCostCheckMs: 0,
            mode: null,
            ignoreFileName: "",
            ignorePatterns: [],
            ignorePatternCount: 0,
          });
        } catch {
          // Skip malformed session files
        }
      }

      // Sort by most recent first, select first
      summaries.sort((a, b) => b.startedAt - a.startedAt);
      if (summaries.length > 0) summaries[0].isSelected = true;

      state.sessionList = summaries;
      state.activeSessions = summaries.length;

      // Aggregate tokens from state DB if available
      const dbPath = path.join(this.dataDir, "state_5.sqlite");
      const dbStats = readCodexState(dbPath);
      if (dbStats.totalTokensUsed > 0) {
        // Use DB for aggregate totals (more reliable than summing rollouts)
        state.totalInputTokens = dbStats.totalTokensUsed;
      } else {
        // Fall back to summing from rollout files
        for (const s of summaries) {
          state.totalInputTokens += s.inputTokens;
          state.totalOutputTokens += s.outputTokens;
          state.totalCacheReadTokens += s.cacheReadTokens;
        }
      }

      if (summaries.length > 0) {
        state.sessionAgeMs = summaries[0].ageMs;
        state.sessionMessages = summaries[0].messageCount;
        state.timeSinceLastMessageMs = summaries[0].timeSinceLastMessageMs;
      }

      // Enrich with cwd-dependent data
      await this.enrichSessionsWithRules(summaries);
    } catch {
      // sessions dir missing — keep defaults
    }
  }

  private async enrichSessionsWithRules(summaries: SessionSummary[]): Promise<void> {
    const rulesLines = await this.countRulesLines();
    for (const s of summaries) {
      s.rulesLines = rulesLines;
    }
  }

  // ── Config ─────────────────────────────────────────────

  private async readConfig(state: DashboardState): Promise<void> {
    try {
      const raw = await fs.readFile(path.join(this.dataDir, "config.toml"), "utf-8");
      const data = parseTOML(raw) as Record<string, unknown>;

      // Model
      if (data.model && typeof data.model === "string") {
        state.liveModel = data.model;
      }

      // MCP servers
      const mcpServers = data.mcp_servers;
      if (mcpServers && typeof mcpServers === "object" && !Array.isArray(mcpServers)) {
        const entries = Object.values(mcpServers) as any[];
        const total = entries.length;
        const enabled = entries.filter((s) => !s.disabled).length;
        for (const s of state.sessionList) {
          s.mcpServerCount = total;
          s.mcpServersEnabled = enabled;
        }
      }

      // Hooks (if present)
      if (data.hooks && typeof data.hooks === "object") {
        state.hookCount = Object.keys(data.hooks).length;
      }
    } catch {
      // File missing or malformed — keep defaults
    }
  }

  // ── History ────────────────────────────────────────────

  private async readHistory(state: DashboardState): Promise<void> {
    try {
      const raw = await fs.readFile(path.join(this.dataDir, "history.jsonl"), "utf-8");
      const lines = raw.trim().split("\n").filter(Boolean);
      const turns: TurnEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          turns.push({
            display: entry.display ?? entry.command ?? "",
            timestamp: entry.timestamp ?? 0,
            project: entry.project ?? "",
            sessionId: entry.sessionId ?? entry.threadId,
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

  // ── Environment ────────────────────────────────────────

  private async readEnvironment(state: DashboardState): Promise<void> {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    state.isPeakHours = day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  }

  // ── Rules Counting ─────────────────────────────────────

  private async countRulesLines(): Promise<number> {
    let totalLines = 0;
    for (const candidate of [path.join(this.cwd, "AGENTS.md")]) {
      try {
        const raw = await fs.readFile(candidate, "utf-8");
        totalLines += raw.split("\n").length;
      } catch { /* skip */ }
    }
    return totalLines;
  }
}
