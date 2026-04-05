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

export interface DashboardState {
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

  // Live Session Metrics (nullable — statusline stretch goal)
  liveContextPercent: number | null;
  liveModel: string | null;
  liveSessionCost: number | null;
  liveDurationMs: number | null;

  // Environment
  claudeMdLines: number;
  mcpServerCount: number;
  mcpServersEnabled: number;
  pluginCount: number;
  hookCount: number;
  isPeakHours: boolean;
  hasIgnoreFile: boolean;
  hasNotificationsEnabled: boolean;
  hasAutoCompactEnv: boolean;
  hasContextCapEnv: boolean;

  // History
  recentTurns: TurnEntry[];
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
    liveContextPercent: null,
    liveModel: null,
    liveSessionCost: null,
    liveDurationMs: null,
    claudeMdLines: 0,
    mcpServerCount: 0,
    mcpServersEnabled: 0,
    pluginCount: 0,
    hookCount: 0,
    isPeakHours: false,
    hasIgnoreFile: false,
    hasNotificationsEnabled: false,
    hasAutoCompactEnv: false,
    hasContextCapEnv: false,
    recentTurns: [],
  };
}
