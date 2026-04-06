import { describe, it, expect } from "vitest";
import { parseSessionJsonlContent } from "../../src/adapters/parse-session.js";

const JSONL_SESSION = [
  '{"type":"user","message":{"role":"user","content":"hello"},"timestamp":1775420100000}',
  '{"type":"assistant","message":{"model":"claude-opus-4-6","usage":{"input_tokens":3,"cache_read_input_tokens":0,"cache_creation_input_tokens":5000,"output_tokens":10}},"timestamp":1775420110000}',
  '{"type":"user","message":{"role":"user","content":"explain"},"timestamp":1775420200000}',
  // Streaming: same context size, growing output (should dedup)
  '{"type":"assistant","message":{"model":"claude-opus-4-6","usage":{"input_tokens":50,"cache_read_input_tokens":5000,"cache_creation_input_tokens":3000,"output_tokens":20}},"timestamp":1775420210000}',
  '{"type":"assistant","message":{"model":"claude-opus-4-6","usage":{"input_tokens":50,"cache_read_input_tokens":5000,"cache_creation_input_tokens":3000,"output_tokens":200}},"timestamp":1775420215000}',
  '{"type":"user","message":{"role":"user","content":"fix"},"timestamp":1775420300000}',
  '{"type":"assistant","message":{"model":"claude-opus-4-6","usage":{"input_tokens":100,"cache_read_input_tokens":8000,"cache_creation_input_tokens":4000,"output_tokens":500}},"timestamp":1775420320000}',
].join("\n");

describe("parseSessionJsonlContent", () => {
  it("counts user messages", () => {
    const result = parseSessionJsonlContent(JSONL_SESSION);
    expect(result.userMessages).toBe(3);
  });

  it("detects model name", () => {
    const result = parseSessionJsonlContent(JSONL_SESSION);
    expect(result.model).toBe("claude-opus-4-6");
  });

  it("extracts latest input/cache tokens", () => {
    const result = parseSessionJsonlContent(JSONL_SESSION);
    // Last assistant turn: input=100, cacheRead=8000, cacheCreate=4000
    expect(result.inputTokens).toBe(100);
    expect(result.cacheReadTokens).toBe(8000);
    expect(result.cacheCreateTokens).toBe(4000);
  });

  it("sums output tokens across deduplicated turns", () => {
    const result = parseSessionJsonlContent(JSONL_SESSION);
    // Turn 1 (contextSize=5003): max output=10
    // Turn 2 (contextSize=8050): max output=200 (deduped from 20)
    // Turn 3 (contextSize=12100): max output=500
    expect(result.outputTokens).toBe(10 + 200 + 500);
  });

  it("computes contextHistory as growing percentages", () => {
    const result = parseSessionJsonlContent(JSONL_SESSION, { "claude-opus-4-6": 200000 });
    expect(result.contextHistory.length).toBe(3); // 3 unique context sizes
    // Context sizes: 5003, 8050, 12100 → percentages of 200000
    expect(result.contextHistory[0]).toBe(Math.round((5003 / 200000) * 100));
    expect(result.contextHistory[1]).toBe(Math.round((8050 / 200000) * 100));
    expect(result.contextHistory[2]).toBe(Math.round((12100 / 200000) * 100));
  });

  it("contextPercent is the last entry in contextHistory", () => {
    const result = parseSessionJsonlContent(JSONL_SESSION, { "claude-opus-4-6": 200000 });
    expect(result.contextPercent).toBe(result.contextHistory[result.contextHistory.length - 1]);
  });

  it("uses model contextWindow from provided map", () => {
    const result = parseSessionJsonlContent(JSONL_SESSION, { "claude-opus-4-6": 100000 });
    // With smaller window, percentages should be larger
    expect(result.contextWindow).toBe(100000);
    expect(result.contextPercent).toBe(Math.round((12100 / 100000) * 100));
  });

  it("defaults to 200K context window when model not in map", () => {
    const result = parseSessionJsonlContent(JSONL_SESSION, {});
    expect(result.contextWindow).toBe(200000);
  });

  it("handles empty content", () => {
    const result = parseSessionJsonlContent("");
    expect(result.userMessages).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.contextHistory).toHaveLength(0);
    expect(result.model).toBeNull();
  });

  it("skips malformed JSON lines gracefully", () => {
    const content = [
      '{"type":"user","timestamp":1000}',
      "this is not json",
      '{"type":"assistant","message":{"model":"claude-opus-4-6","usage":{"input_tokens":1,"cache_read_input_tokens":0,"cache_creation_input_tokens":100,"output_tokens":5}},"timestamp":2000}',
    ].join("\n");
    const result = parseSessionJsonlContent(content);
    expect(result.userMessages).toBe(1);
    expect(result.outputTokens).toBe(5);
  });

  it("treats contextWindow 0 from stats-cache as unknown and uses model default", () => {
    // Simulates stats-cache reporting contextWindow: 0
    const result = parseSessionJsonlContent(JSONL_SESSION, { "claude-opus-4-6": 0 });
    // Should fall back to model default (200k for opus), not use 0
    expect(result.contextWindow).toBe(200000);
    expect(result.contextPercent).toBeLessThan(100);
  });

  it("auto-detects 1M context when usage exceeds 200k", () => {
    const bigSession = [
      '{"type":"user","message":{"role":"user","content":"hello"},"timestamp":1000}',
      '{"type":"assistant","message":{"model":"claude-opus-4-6","usage":{"input_tokens":100,"cache_read_input_tokens":250000,"cache_creation_input_tokens":50000,"output_tokens":500}},"timestamp":2000}',
    ].join("\n");
    const result = parseSessionJsonlContent(bigSession, {});
    // 300100 exceeds 200k → should auto-detect 1M
    expect(result.contextWindow).toBe(1_000_000);
    expect(result.contextPercent).toBe(Math.round((300100 / 1_000_000) * 100));
  });

  it("tracks lastCompactMs from /compact commands", () => {
    const content = [
      '{"type":"user","message":{"role":"user","content":"hello"},"display":"hello","timestamp":1000}',
      '{"type":"user","message":{"role":"user","content":"/compact"},"display":"/compact","timestamp":2000}',
      '{"type":"user","message":{"role":"user","content":"continue"},"display":"continue","timestamp":3000}',
    ].join("\n");
    const result = parseSessionJsonlContent(content);
    expect(result.lastCompactMs).toBe(2000);
  });

  it("tracks lastCostCheckMs from /cost commands", () => {
    const content = [
      '{"type":"user","message":{"role":"user","content":"/cost"},"display":"/cost","timestamp":5000}',
    ].join("\n");
    const result = parseSessionJsonlContent(content);
    expect(result.lastCostCheckMs).toBe(5000);
  });

  it("returns 0 for command timestamps when never used", () => {
    const result = parseSessionJsonlContent(JSONL_SESSION);
    expect(result.lastCompactMs).toBe(0);
    expect(result.lastCostCheckMs).toBe(0);
  });

  it("detects /cost from XML command-name tags (Claude Code slash commands)", () => {
    const content = [
      '{"type":"user","message":{"content":"<command-name>/cost</command-name>"},"timestamp":"2026-04-06T11:30:00.000Z"}',
    ].join("\n");
    const result = parseSessionJsonlContent(content);
    expect(result.lastCostCheckMs).toBe(Date.parse("2026-04-06T11:30:00.000Z"));
  });

  it("detects /compact from XML command-name tags", () => {
    const content = [
      '{"type":"user","message":{"content":"<command-name>/compact</command-name>"},"timestamp":"2026-04-06T10:00:00.000Z"}',
    ].join("\n");
    const result = parseSessionJsonlContent(content);
    expect(result.lastCompactMs).toBe(Date.parse("2026-04-06T10:00:00.000Z"));
  });

  it("handles ISO string timestamps correctly", () => {
    const content = [
      '{"type":"user","message":{"role":"user","content":"hello"},"timestamp":"2026-04-06T10:00:00.000Z"}',
      '{"type":"assistant","message":{"model":"claude-opus-4-6","usage":{"input_tokens":10,"cache_read_input_tokens":0,"cache_creation_input_tokens":100,"output_tokens":5}},"timestamp":"2026-04-06T10:01:00.000Z"}',
    ].join("\n");
    const result = parseSessionJsonlContent(content);
    expect(result.userMessages).toBe(1);
    expect(result.timeSinceLastMessageMs).toBeGreaterThan(0);
    expect(result.model).toBe("claude-opus-4-6");
  });

  it("detects commands from tool_result content arrays", () => {
    const content = [
      '{"type":"user","message":{"content":[{"tool_use_id":"x","type":"tool_result","content":"/cost output here"}]},"timestamp":9000}',
    ].join("\n");
    const result = parseSessionJsonlContent(content);
    expect(result.lastCostCheckMs).toBe(9000);
  });

  it("deduplicates streaming events (same context size)", () => {
    const content = [
      '{"type":"assistant","message":{"model":"claude-opus-4-6","usage":{"input_tokens":10,"cache_read_input_tokens":100,"cache_creation_input_tokens":50,"output_tokens":5}},"timestamp":1000}',
      '{"type":"assistant","message":{"model":"claude-opus-4-6","usage":{"input_tokens":10,"cache_read_input_tokens":100,"cache_creation_input_tokens":50,"output_tokens":50}},"timestamp":1001}',
      '{"type":"assistant","message":{"model":"claude-opus-4-6","usage":{"input_tokens":10,"cache_read_input_tokens":100,"cache_creation_input_tokens":50,"output_tokens":200}},"timestamp":1002}',
    ].join("\n");
    const result = parseSessionJsonlContent(content);
    // All have same context size (160), so only max output (200) counts
    expect(result.outputTokens).toBe(200);
    expect(result.contextHistory).toHaveLength(1);
  });
});
