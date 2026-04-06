/**
 * Parser for Codex CLI session rollout JSONL files.
 * Each line is { timestamp, item: { type, ...data } } with tagged variants:
 *   session_meta, response_item, compacted, turn_context, event_msg
 */

export interface CodexRolloutMetrics {
  userMessages: number;
  timeSinceLastMessageMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  model: string | null;
  contextWindow: number;
  contextPercent: number;
  contextHistory: number[];
  lastCompactMs: number;
  project: string | null;
  cwd: string | null;
  startedAt: number;
}

const EMPTY_METRICS: CodexRolloutMetrics = {
  userMessages: 0,
  timeSinceLastMessageMs: 0,
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
  reasoningTokens: 0,
  model: null,
  contextWindow: 0,
  contextPercent: 0,
  contextHistory: [],
  lastCompactMs: 0,
  project: null,
  cwd: null,
  startedAt: 0,
};

const DEFAULT_CONTEXT_WINDOWS: Record<string, number> = {
  "o3": 200_000,
  "o4-mini": 200_000,
  "gpt-4.1": 1_000_000,
  "codex-mini": 200_000,
};

function defaultContextWindow(model: string): number {
  for (const [family, size] of Object.entries(DEFAULT_CONTEXT_WINDOWS)) {
    if (model.includes(family)) return size;
  }
  return 200_000;
}

function parseTimestamp(ts: unknown): number {
  if (typeof ts === "number" && ts > 0) return ts;
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Parse a Codex rollout JSONL file content and extract metrics.
 */
export function parseCodexRollout(content: string): CodexRolloutMetrics {
  const lines = content.split("\n").filter(Boolean);
  if (lines.length === 0) return { ...EMPTY_METRICS };

  let userMessages = 0;
  let maxTimestamp = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;
  let totalReasoning = 0;
  let model: string | null = null;
  let contextWindow = 0;
  let lastCompactMs = 0;
  let project: string | null = null;
  let cwd: string | null = null;
  let startedAt = 0;
  const contextSnapshots: number[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const ts = parseTimestamp(entry.timestamp);
      if (ts > maxTimestamp) maxTimestamp = ts;

      const item = entry.item;
      if (!item || typeof item !== "object") continue;

      switch (item.type) {
        case "session_meta": {
          if (item.model && typeof item.model === "string") model = item.model;
          if (item.project && typeof item.project === "string") project = item.project;
          if (item.cwd && typeof item.cwd === "string") cwd = item.cwd;
          if (ts > 0 && startedAt === 0) startedAt = ts;
          break;
        }
        case "response_item": {
          const usage = item.usage;
          if (usage && typeof usage === "object") {
            const inp = usage.inputTokens ?? 0;
            const out = usage.outputTokens ?? 0;
            const cached = usage.cachedInputTokens ?? 0;
            const reasoning = usage.reasoningOutputTokens ?? 0;
            totalInput += inp;
            totalOutput += out;
            totalCached += cached;
            totalReasoning += reasoning;
            if (usage.modelContextWindow && typeof usage.modelContextWindow === "number") {
              contextWindow = usage.modelContextWindow;
            }
            contextSnapshots.push(inp + cached);
          }
          if (item.model && typeof item.model === "string") model = item.model;
          break;
        }
        case "compacted": {
          if (ts > 0) lastCompactMs = ts;
          break;
        }
        case "turn_context": {
          userMessages++;
          break;
        }
        // event_msg — ignored for metrics
      }
    } catch {
      // Skip malformed lines
    }
  }

  if (contextWindow === 0 && model) {
    contextWindow = defaultContextWindow(model);
  }

  const contextHistory = contextWindow > 0
    ? contextSnapshots.map((size) => Math.min(100, Math.round((size / contextWindow) * 100)))
    : [];
  const contextPercent = contextHistory.length > 0
    ? contextHistory[contextHistory.length - 1]
    : 0;

  return {
    userMessages,
    timeSinceLastMessageMs: maxTimestamp > 0 ? Date.now() - maxTimestamp : 0,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cachedInputTokens: totalCached,
    reasoningTokens: totalReasoning,
    model,
    contextWindow,
    contextPercent,
    contextHistory,
    lastCompactMs,
    project,
    cwd,
    startedAt,
  };
}
