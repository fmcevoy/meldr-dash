export interface TurnEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId?: string;
}

export interface TechniqueConfig {
  command?: string;
  configPath?: string;
  thresholds?: Record<string, number>;
}

export interface SessionSummary {
  sessionId: string;
  project: string;
  startedAt: number;
  messageCount: number;
  isSelected: boolean;
  // Per-session metrics (from session JSONL)
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  model: string | null;
  contextWindow: number;
  contextPercent: number;
  contextHistory: number[];
  ageMs: number;
  timeSinceLastMessageMs: number;
  // Per-session cwd-dependent data
  memoryFileCount: number;
  memoryTotalBytes: number;
  memoryRecentFiles: Array<{ name: string; modifiedMs: number }>;
  ignoreSuggestions: string[];
  rulesLines: number;
  mcpServerCount: number;
  mcpServersEnabled: number;
  hasIgnoreFile: boolean;
  recentTurns: TurnEntry[];
  // Command tracking (timestamps in ms, 0 = never run)
  lastCompactMs: number;
  lastCostCheckMs: number;
  // Session mode (cursor: "auto-run"|"plan"|etc, claude: "interactive"|etc)
  mode: string | null;
  // Ignore file details
  ignoreFileName: string;
  ignorePatterns: string[];
  ignorePatternCount: number;
}

export interface DashboardState {
  // Platform
  platform: string;

  // Session
  sessionAgeMs: number;
  sessionMessages: number;
  timeSinceLastMessageMs: number;
  activeSessions: number;

  // Aggregate Metrics (from stats-cache.json)
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalCostUsd: number;
  todayMessageCount: number;
  todayTokensByModel: Record<string, number>;

  // Today's metrics
  todayInputTokens: number;
  todayOutputTokens: number;
  todayCacheReadTokens: number;
  todayCostUsd: number;

  // Per-session list (each entry has its own metrics + cwd-dependent data)
  sessionList: SessionSummary[];

  // Peak hour analysis (from stats-cache.json hourCounts — global)
  hourCounts: Record<string, number>;
  peakHours: number[];

  // Live Session Metrics (nullable — statusline stretch goal)
  liveContextPercent: number | null;
  liveModel: string | null;
  liveSessionCost: number | null;
  liveDurationMs: number | null;

  // Global environment (settings.json — shared across sessions)
  pluginCount: number;
  hookCount: number;
  isPeakHours: boolean;
  hasNotificationsEnabled: boolean;
  hasAutoCompactEnv: boolean;
  hasContextCapEnv: boolean;

  // All history turns (unfiltered — sessions filter from this)
  recentTurns: TurnEntry[];

  // AI code attribution (Cursor only, null for Claude)
  aiLinesAdded: number | null;
  humanLinesAdded: number | null;
  aiPercentage: number | null;
  trackedCommitCount: number | null;
}

export interface CLIAdapter {
  readonly name: string;
  readonly displayName: string;
  readonly dataDir: string;
  readonly rulesFile: string;

  collectState(): Promise<DashboardState>;
  getWatchPaths(): string[];
  getPollPaths(): string[];
  getTechniqueOverrides(): Map<string, TechniqueConfig>;
}

export function emptyState(): DashboardState {
  return {
    platform: "claude",
    sessionAgeMs: 0,
    sessionMessages: 0,
    timeSinceLastMessageMs: 0,
    activeSessions: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheCreationTokens: 0,
    totalCostUsd: 0,
    todayMessageCount: 0,
    todayTokensByModel: {},
    todayInputTokens: 0,
    todayOutputTokens: 0,
    todayCacheReadTokens: 0,
    todayCostUsd: 0,
    sessionList: [],
    hourCounts: {},
    peakHours: [],
    liveContextPercent: null,
    liveModel: null,
    liveSessionCost: null,
    liveDurationMs: null,
    pluginCount: 0,
    hookCount: 0,
    isPeakHours: false,
    hasNotificationsEnabled: false,
    hasAutoCompactEnv: false,
    hasContextCapEnv: false,
    recentTurns: [],
    aiLinesAdded: null,
    humanLinesAdded: null,
    aiPercentage: null,
    trackedCommitCount: null,
  };
}
