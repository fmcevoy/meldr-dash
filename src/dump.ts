import { DashboardState, SessionSummary } from "./adapters/types.js";
import { evaluate } from "./tips/evaluator.js";
import { Technique, getFix } from "./tips/database.js";

export type DumpCategory =
  | "state"
  | "sessions"
  | "monitors"
  | "tips"
  | "metrics"
  | "environment"
  | "all";

const validCategories: ReadonlySet<string> = new Set<DumpCategory>([
  "state",
  "sessions",
  "monitors",
  "tips",
  "metrics",
  "environment",
  "all",
]);

function dumpSessions(state: DashboardState): SessionSummary[] {
  return [...state.sessionList].sort((a, b) => b.startedAt - a.startedAt);
}

function resolveFix(t: Technique, platform: string) {
  const { condition, fixByPlatform, ...rest } = t;
  return { ...rest, fix: getFix(t, platform) };
}

function dumpMonitors(state: DashboardState, selectedSessionId?: string) {
  const { monitors } = evaluate(state, selectedSessionId);
  return monitors.map((m) => resolveFix(m, state.platform));
}

function dumpTips(state: DashboardState, selectedSessionId?: string) {
  const { allTips } = evaluate(state, selectedSessionId);
  return allTips.map((t) => resolveFix(t, state.platform));
}

function dumpMetrics(state: DashboardState, selectedSessionId?: string) {
  let session: SessionSummary | undefined;
  if (selectedSessionId) {
    session = state.sessionList.find((s) => s.sessionId === selectedSessionId);
  } else {
    session = state.sessionList.find((s) => s.isSelected);
  }
  if (!session) {
    session = state.sessionList[0];
  }
  if (!session) {
    return {
      sessionId: null,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreateTokens: 0,
      model: null,
      contextWindow: 0,
      contextPercent: 0,
      contextHistory: [],
      lastCompactMs: 0,
      lastCostCheckMs: 0,
    };
  }
  return {
    sessionId: session.sessionId,
    inputTokens: session.inputTokens,
    outputTokens: session.outputTokens,
    cacheReadTokens: session.cacheReadTokens,
    cacheCreateTokens: session.cacheCreateTokens,
    model: session.model,
    contextWindow: session.contextWindow,
    contextPercent: session.contextPercent,
    contextHistory: session.contextHistory,
    lastCompactMs: session.lastCompactMs,
    lastCostCheckMs: session.lastCostCheckMs,
  };
}

function dumpEnvironment(state: DashboardState, selectedSessionId?: string) {
  let session: SessionSummary | undefined;
  if (selectedSessionId) {
    session = state.sessionList.find((s) => s.sessionId === selectedSessionId);
  } else {
    session = state.sessionList.find((s) => s.isSelected);
  }

  return {
    // Global
    pluginCount: state.pluginCount,
    hookCount: state.hookCount,
    hasNotificationsEnabled: state.hasNotificationsEnabled,
    hasAutoCompactEnv: state.hasAutoCompactEnv,
    hasContextCapEnv: state.hasContextCapEnv,
    isPeakHours: state.isPeakHours,
    // Per-session (if available)
    rulesLines: session?.rulesLines ?? 0,
    mcpServerCount: session?.mcpServerCount ?? 0,
    mcpServersEnabled: session?.mcpServersEnabled ?? 0,
    hasIgnoreFile: session?.hasIgnoreFile ?? false,
    ignoreFileName: session?.ignoreFileName ?? "",
    ignorePatterns: session?.ignorePatterns ?? [],
    ignorePatternCount: session?.ignorePatternCount ?? 0,
    ignoreSuggestions: session?.ignoreSuggestions ?? [],
    memoryFileCount: session?.memoryFileCount ?? 0,
    memoryTotalBytes: session?.memoryTotalBytes ?? 0,
    // AI code attribution (Cursor only)
    aiLinesAdded: state.aiLinesAdded,
    humanLinesAdded: state.humanLinesAdded,
    aiPercentage: state.aiPercentage,
    trackedCommitCount: state.trackedCommitCount,
  };
}

export function buildDumpOutput(
  category: string,
  state: DashboardState,
  selectedSessionId?: string,
): unknown {
  if (!validCategories.has(category)) {
    throw new Error(
      `Unknown dump category: "${category}". Valid categories: ${[...validCategories].join(", ")}`,
    );
  }

  switch (category as DumpCategory) {
    case "state":
      return state;
    case "sessions":
      return dumpSessions(state);
    case "monitors":
      return dumpMonitors(state, selectedSessionId);
    case "tips":
      return dumpTips(state, selectedSessionId);
    case "metrics":
      return dumpMetrics(state, selectedSessionId);
    case "environment":
      return dumpEnvironment(state, selectedSessionId);
    case "all":
      return {
        state,
        sessions: dumpSessions(state),
        monitors: dumpMonitors(state, selectedSessionId),
        tips: dumpTips(state, selectedSessionId),
        metrics: dumpMetrics(state, selectedSessionId),
        environment: dumpEnvironment(state, selectedSessionId),
      };
  }
}
