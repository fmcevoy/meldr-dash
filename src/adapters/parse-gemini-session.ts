/**
 * Parser for Gemini CLI session JSON files (ConversationRecord format).
 * Each session is a single JSON object with a messages[] array.
 */

export interface GeminiSessionMetrics {
  userMessages: number;
  timeSinceLastMessageMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  model: string | null;
  contextWindow: number;
  contextPercent: number;
  contextHistory: number[];
  lastCompactMs: number;
}

const EMPTY_METRICS: GeminiSessionMetrics = {
  userMessages: 0,
  timeSinceLastMessageMs: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  model: null,
  contextWindow: 0,
  contextPercent: 0,
  contextHistory: [],
  lastCompactMs: 0,
};

// Gemini models generally have 1M context windows.
const DEFAULT_CONTEXT_WINDOWS: Record<string, number> = {
  "gemini-2.5-pro": 1_000_000,
  "gemini-2.5-flash": 1_000_000,
  "gemini-2.0-flash": 1_000_000,
};

function defaultContextWindow(model: string): number {
  for (const [family, size] of Object.entries(DEFAULT_CONTEXT_WINDOWS)) {
    if (model.includes(family)) return size;
  }
  return 1_000_000;
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
 * Parse a Gemini session JSON object and extract metrics.
 * Expected shape: { sessionId, messages: [{ type, tokens?, model?, timestamp? }] }
 */
export function parseGeminiSession(data: unknown): GeminiSessionMetrics {
  if (!data || typeof data !== "object") return { ...EMPTY_METRICS };

  const record = data as Record<string, unknown>;
  const messages = record.messages;
  if (!Array.isArray(messages) || messages.length === 0) return { ...EMPTY_METRICS };

  let userMessages = 0;
  let maxTimestamp = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;
  let model: string | null = null;
  let lastCompactMs = 0;
  const contextSnapshots: number[] = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;

    const ts = parseTimestamp(msg.timestamp);
    if (ts > maxTimestamp) maxTimestamp = ts;

    if (msg.type === "user") {
      userMessages++;
      if (typeof msg.text === "string" && msg.text.includes("/compact") && ts > 0) {
        lastCompactMs = ts;
      }
    }

    if (msg.type === "gemini" && msg.tokens && typeof msg.tokens === "object") {
      const tokens = msg.tokens as Record<string, number>;
      const inp = tokens.input ?? 0;
      const out = tokens.output ?? 0;
      const cached = tokens.cached ?? 0;
      totalInput += inp;
      totalOutput += out;
      totalCached += cached;
      // Track context size at each response
      contextSnapshots.push(inp + cached + (tokens.thoughts ?? 0) + (tokens.tool ?? 0));
      if (msg.model && typeof msg.model === "string") model = msg.model;
    }
  }

  const contextWindow = model ? defaultContextWindow(model) : 1_000_000;
  const contextHistory = contextSnapshots.map(
    (size) => Math.min(100, Math.round((size / contextWindow) * 100)),
  );
  const contextPercent = contextHistory.length > 0
    ? contextHistory[contextHistory.length - 1]
    : 0;

  return {
    userMessages,
    timeSinceLastMessageMs: maxTimestamp > 0 ? Date.now() - maxTimestamp : 0,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheReadTokens: totalCached,
    model,
    contextWindow,
    contextPercent,
    contextHistory,
    lastCompactMs,
  };
}
