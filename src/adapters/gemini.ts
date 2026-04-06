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
import { parseGeminiSession } from "./parse-gemini-session.js";

interface GeminiAdapterOptions {
  dataDir?: string;
  cwd?: string;
}

export class GeminiAdapter implements CLIAdapter {
  readonly name = "gemini";
  readonly displayName = "Gemini CLI";
  readonly dataDir: string;
  readonly rulesFile = "GEMINI.md";

  private readonly cwd: string;

  constructor(opts: GeminiAdapterOptions = {}) {
    this.dataDir = opts.dataDir ?? (process.env.GEMINI_CLI_HOME || path.join(os.homedir(), ".gemini"));
    this.cwd = opts.cwd ?? process.cwd();
  }

  async collectState(): Promise<DashboardState> {
    const state = emptyState();
    state.platform = "gemini";

    await Promise.all([
      this.readSessions(state),
      this.readEnvironment(state),
    ]);

    // Settings must run after sessions so MCP counts can be applied
    await this.readSettings(state);

    return state;
  }

  getWatchPaths(): string[] {
    return [
      path.join(this.dataDir, "tmp"),
    ];
  }

  getPollPaths(): string[] {
    return [
      path.join(this.dataDir, "settings.json"),
      path.join(this.cwd, "GEMINI.md"),
      path.join(this.dataDir, "GEMINI.md"),
      path.join(this.cwd, ".geminiignore"),
    ];
  }

  getTechniqueOverrides(): Map<string, TechniqueConfig> {
    return new Map();
  }

  // ── Project Registry ───────────────────────────────────

  private async readProjectSlugs(): Promise<Map<string, string>> {
    const slugs = new Map<string, string>();
    try {
      const raw = await fs.readFile(path.join(this.dataDir, "projects.json"), "utf-8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") {
        for (const [projectPath, slug] of Object.entries(data)) {
          if (typeof slug === "string") slugs.set(projectPath, slug);
        }
      }
    } catch {
      // No projects.json — will fall back to scanning tmp/
    }
    return slugs;
  }

  // ── Session Discovery ──────────────────────────────────

  private async readSessions(state: DashboardState): Promise<void> {
    try {
      const tmpDir = path.join(this.dataDir, "tmp");
      // Discover project directories under tmp/
      let projectDirs: string[];
      try {
        projectDirs = await fs.readdir(tmpDir);
      } catch {
        return;
      }

      const summaries: SessionSummary[] = [];
      let totalInput = 0;
      let totalOutput = 0;
      let totalCached = 0;

      for (const project of projectDirs) {
        const chatsDir = path.join(tmpDir, project, "chats");
        let sessionFiles: string[];
        try {
          sessionFiles = (await fs.readdir(chatsDir)).filter((f) => f.endsWith(".json"));
        } catch {
          continue;
        }

        for (const file of sessionFiles) {
          try {
            const raw = await fs.readFile(path.join(chatsDir, file), "utf-8");
            const data = JSON.parse(raw);
            const metrics = parseGeminiSession(data);

            const sessionId = data.sessionId ?? file.replace(/\.json$/, "");
            const startTime = data.startTime ? Date.parse(data.startTime) : 0;
            const startedAt = Number.isNaN(startTime) ? 0 : startTime;

            totalInput += metrics.inputTokens;
            totalOutput += metrics.outputTokens;
            totalCached += metrics.cacheReadTokens;

            summaries.push({
              sessionId,
              project: data.projectPath ?? project,
              startedAt,
              messageCount: metrics.userMessages,
              isSelected: false,
              inputTokens: metrics.inputTokens,
              outputTokens: metrics.outputTokens,
              cacheReadTokens: metrics.cacheReadTokens,
              cacheCreateTokens: 0,
              model: metrics.model,
              contextWindow: metrics.contextWindow,
              contextPercent: metrics.contextPercent,
              contextHistory: metrics.contextHistory,
              ageMs: startedAt > 0 ? Date.now() - startedAt : 0,
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
              mode: data.kind ?? null,
              ignoreFileName: ".geminiignore",
              ignorePatterns: [],
              ignorePatternCount: 0,
            });
          } catch {
            // Skip malformed session files
          }
        }
      }

      // Sort by most recent first, select first
      summaries.sort((a, b) => b.startedAt - a.startedAt);
      if (summaries.length > 0) summaries[0].isSelected = true;

      state.sessionList = summaries;
      state.activeSessions = summaries.length;
      state.totalInputTokens = totalInput;
      state.totalOutputTokens = totalOutput;
      state.totalCacheReadTokens = totalCached;

      if (summaries.length > 0) {
        state.sessionAgeMs = summaries[0].ageMs;
        state.sessionMessages = summaries[0].messageCount;
        state.timeSinceLastMessageMs = summaries[0].timeSinceLastMessageMs;
      }

      // Enrich sessions with cwd-dependent data
      await Promise.all([
        this.enrichSessionsWithRules(summaries),
        this.enrichSessionsWithIgnore(summaries),
        this.enrichSessionsWithMemory(summaries),
      ]);
    } catch {
      // tmp dir missing — keep defaults
    }
  }

  private async enrichSessionsWithRules(summaries: SessionSummary[]): Promise<void> {
    const rulesLines = await this.countRulesLines();
    for (const s of summaries) {
      s.rulesLines = rulesLines;
    }
  }

  private async enrichSessionsWithIgnore(summaries: SessionSummary[]): Promise<void> {
    const commonIgnorable = ["node_modules", "dist", ".next", "build", "coverage", ".git", "*.log"];
    let existingPatterns: string[] = [];
    let hasFile = false;

    try {
      const raw = await fs.readFile(path.join(this.cwd, ".geminiignore"), "utf-8");
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

    for (const s of summaries) {
      s.hasIgnoreFile = hasFile;
      s.ignorePatterns = existingPatterns;
      s.ignorePatternCount = existingPatterns.length;
      s.ignoreSuggestions = suggestions;
    }
  }

  private async enrichSessionsWithMemory(summaries: SessionSummary[]): Promise<void> {
    try {
      const memoryPath = path.join(this.dataDir, "memory.md");
      const stat = await fs.stat(memoryPath);
      for (const s of summaries) {
        s.memoryFileCount = 1;
        s.memoryTotalBytes = stat.size;
        s.memoryRecentFiles = [{ name: "memory.md", modifiedMs: stat.mtimeMs }];
      }
    } catch {
      // No memory file
    }
  }

  // ── Settings ───────────────────────────────────────────

  private async readSettings(state: DashboardState): Promise<void> {
    try {
      const raw = await fs.readFile(path.join(this.dataDir, "settings.json"), "utf-8");
      const data = JSON.parse(raw);

      if (data.mcpServers && typeof data.mcpServers === "object") {
        const entries = Object.values(data.mcpServers) as any[];
        const total = entries.length;
        const enabled = entries.filter((s) => !s.disabled).length;
        for (const s of state.sessionList) {
          s.mcpServerCount = total;
          s.mcpServersEnabled = enabled;
        }
      }

      if (data.model?.name) {
        state.liveModel = data.model.name;
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
  }

  // ── Rules Counting ─────────────────────────────────────

  private async countRulesLines(): Promise<number> {
    let totalLines = 0;
    for (const candidate of [path.join(this.cwd, "GEMINI.md"), path.join(this.dataDir, "GEMINI.md")]) {
      try {
        const raw = await fs.readFile(candidate, "utf-8");
        totalLines += raw.split("\n").length;
      } catch { /* skip */ }
    }
    return totalLines;
  }
}
