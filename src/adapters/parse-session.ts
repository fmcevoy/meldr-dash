/**
 * Exported utilities for session JSONL parsing and cwdKey derivation.
 * Extracted for testability — the adapter delegates to these.
 */

export function deriveCwdKey(cwd: string): string {
  return cwd.replace(/\/+$/, "").replace(/\//g, "-");
}

export interface SessionMetrics {
  userMessages: number;
  timeSinceLastMessageMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  model: string | null;
  contextWindow: number;
  contextPercent: number;
  contextHistory: number[];
  lastCompactMs: number;
  lastCostCheckMs: number;
}

const EMPTY_METRICS: SessionMetrics = {
  userMessages: 0,
  timeSinceLastMessageMs: 0,
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

// Known default context windows per model family.
// Used when stats-cache reports 0.
const DEFAULT_CONTEXT_WINDOWS: Record<string, number> = {
  "opus": 200_000,
  "sonnet": 200_000,
  "haiku": 200_000,
};

function defaultContextWindow(model: string): number {
  for (const [family, size] of Object.entries(DEFAULT_CONTEXT_WINDOWS)) {
    if (model.includes(family)) return size;
  }
  return 200_000;
}

/** Convert a timestamp (epoch ms number or ISO string) to epoch ms. */
function parseTimestamp(ts: unknown): number {
  if (typeof ts === "number" && ts > 0) return ts;
  if (typeof ts === "string") {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/** Build a single searchable string from a user JSONL entry for command detection. */
function buildSearchableText(entry: any): string {
  const parts: string[] = [];
  if (typeof entry.display === "string") parts.push(entry.display);
  const content = entry.message?.content;
  if (typeof content === "string") {
    parts.push(content);
  } else if (Array.isArray(content)) {
    // Tool result arrays may contain stringified content with command refs
    parts.push(JSON.stringify(content));
  }
  return parts.join(" ");
}

/**
 * Parse session JSONL content and extract per-session metrics.
 * @param content - Raw JSONL file content
 * @param modelContextWindows - Map of model name → context window size
 */
export function parseSessionJsonlContent(
  content: string,
  modelContextWindows: Record<string, number> = {},
): SessionMetrics {
  const lines = content.split("\n").filter(Boolean);
  if (lines.length === 0) return { ...EMPTY_METRICS };

  let userMessages = 0;
  let maxTimestamp = 0;
  let latestInput = 0;
  let latestCacheRead = 0;
  let latestCacheCreate = 0;
  let model: string | null = null;
  let lastCompactMs = 0;
  let lastCostCheckMs = 0;
  const contextBySize = new Map<number, number>();

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === "user") {
        userMessages++;
        const ts = parseTimestamp(entry.timestamp);
        // Track /compact and /cost — check display, message.content (string or stringified array)
        const searchable = buildSearchableText(entry);
        if (searchable.includes("/compact") && ts > 0) lastCompactMs = ts;
        if (searchable.includes("/cost") && ts > 0) lastCostCheckMs = ts;
      }
      const entryTs = parseTimestamp(entry.timestamp);
      if (entryTs > maxTimestamp) maxTimestamp = entryTs;
      if (entry.type === "assistant" && entry.message?.usage) {
        const u = entry.message.usage;
        const inp = u.input_tokens ?? 0;
        const cacheRead = u.cache_read_input_tokens ?? 0;
        const cacheCreate = u.cache_creation_input_tokens ?? 0;
        const out = u.output_tokens ?? 0;
        const contextSize = inp + cacheRead + cacheCreate;

        const prev = contextBySize.get(contextSize) ?? 0;
        if (out > prev) contextBySize.set(contextSize, out);

        latestInput = inp;
        latestCacheRead = cacheRead;
        latestCacheCreate = cacheCreate;
        if (entry.message.model) model = entry.message.model;
      }
    } catch { /* skip malformed lines */ }
  }

  let outputSum = 0;
  for (const out of contextBySize.values()) outputSum += out;

  // Determine context window: use stats-cache value if > 0, else use model default.
  // Then auto-detect: if max observed context exceeds the window, bump to 1M.
  const maxObservedContext = contextBySize.size > 0 ? Math.max(...contextBySize.keys()) : 0;
  let contextWindow: number;
  if (model) {
    const fromCache = modelContextWindows[model];
    contextWindow = (fromCache && fromCache > 0) ? fromCache : defaultContextWindow(model);
  } else {
    contextWindow = 200_000;
  }
  // Auto-detect extended context: if usage exceeds default, they must have 1M enabled
  if (maxObservedContext > contextWindow) {
    contextWindow = 1_000_000;
  }

  const sortedSizes = [...contextBySize.keys()].sort((a, b) => a - b);
  const contextHistory = sortedSizes.map(
    (size) => Math.min(100, Math.round((size / contextWindow) * 100)),
  );
  const contextPercent = contextHistory.length > 0
    ? contextHistory[contextHistory.length - 1]
    : 0;

  return {
    userMessages,
    timeSinceLastMessageMs: maxTimestamp > 0 ? Date.now() - maxTimestamp : 0,
    inputTokens: latestInput,
    outputTokens: outputSum,
    cacheReadTokens: latestCacheRead,
    cacheCreateTokens: latestCacheCreate,
    model,
    contextWindow,
    contextPercent,
    contextHistory,
    lastCompactMs,
    lastCostCheckMs,
  };
}
