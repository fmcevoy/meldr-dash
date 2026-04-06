import { describe, it, expect } from "vitest";
import { parseCodexRollout } from "../../src/adapters/parse-codex-rollout.js";

describe("parseCodexRollout", () => {
  it("counts user messages from turn_context entries", () => {
    const content = [
      '{"timestamp":1000,"item":{"type":"turn_context","text":"hello"}}',
      '{"timestamp":2000,"item":{"type":"response_item","usage":{"inputTokens":10,"outputTokens":5}}}',
      '{"timestamp":3000,"item":{"type":"turn_context","text":"bye"}}',
      '{"timestamp":4000,"item":{"type":"response_item","usage":{"inputTokens":20,"outputTokens":10}}}',
    ].join("\n");
    const metrics = parseCodexRollout(content);
    expect(metrics.userMessages).toBe(2);
  });

  it("sums token counts from response_items", () => {
    const content = [
      '{"timestamp":1000,"item":{"type":"response_item","usage":{"inputTokens":5000,"outputTokens":3000,"cachedInputTokens":2000,"reasoningOutputTokens":1000,"modelContextWindow":200000}}}',
      '{"timestamp":2000,"item":{"type":"response_item","usage":{"inputTokens":8000,"outputTokens":4000,"cachedInputTokens":3000,"reasoningOutputTokens":1500,"modelContextWindow":200000}}}',
    ].join("\n");
    const metrics = parseCodexRollout(content);
    expect(metrics.inputTokens).toBe(13000);
    expect(metrics.outputTokens).toBe(7000);
    expect(metrics.cachedInputTokens).toBe(5000);
    expect(metrics.reasoningTokens).toBe(2500);
  });

  it("extracts model and project from session_meta", () => {
    const content = '{"timestamp":1000,"item":{"type":"session_meta","model":"o3","project":"my-project","cwd":"/home/user/my-project"}}';
    const metrics = parseCodexRollout(content);
    expect(metrics.model).toBe("o3");
    expect(metrics.project).toBe("my-project");
    expect(metrics.cwd).toBe("/home/user/my-project");
    expect(metrics.startedAt).toBe(1000);
  });

  it("detects compact events", () => {
    const content = [
      '{"timestamp":1000,"item":{"type":"session_meta","model":"o3"}}',
      '{"timestamp":5000,"item":{"type":"compacted"}}',
    ].join("\n");
    const metrics = parseCodexRollout(content);
    expect(metrics.lastCompactMs).toBe(5000);
  });

  it("uses modelContextWindow from response_item usage", () => {
    const content = '{"timestamp":1000,"item":{"type":"response_item","model":"o3","usage":{"inputTokens":100,"outputTokens":50,"modelContextWindow":200000}}}';
    const metrics = parseCodexRollout(content);
    expect(metrics.contextWindow).toBe(200000);
  });

  it("falls back to default context window for known models", () => {
    const content = [
      '{"timestamp":1000,"item":{"type":"session_meta","model":"gpt-4.1"}}',
      '{"timestamp":2000,"item":{"type":"response_item","usage":{"inputTokens":100,"outputTokens":50}}}',
    ].join("\n");
    const metrics = parseCodexRollout(content);
    expect(metrics.contextWindow).toBe(1_000_000);
  });

  it("builds context history", () => {
    const content = [
      '{"timestamp":1000,"item":{"type":"response_item","model":"o3","usage":{"inputTokens":10000,"outputTokens":500,"cachedInputTokens":0,"modelContextWindow":200000}}}',
      '{"timestamp":2000,"item":{"type":"response_item","model":"o3","usage":{"inputTokens":50000,"outputTokens":1000,"cachedInputTokens":10000,"modelContextWindow":200000}}}',
    ].join("\n");
    const metrics = parseCodexRollout(content);
    expect(metrics.contextHistory).toHaveLength(2);
    // 10000 / 200000 = 5%
    expect(metrics.contextHistory[0]).toBe(5);
    // (50000 + 10000) / 200000 = 30%
    expect(metrics.contextHistory[1]).toBe(30);
    expect(metrics.contextPercent).toBe(30);
  });

  it("returns empty metrics for empty input", () => {
    const metrics = parseCodexRollout("");
    expect(metrics.userMessages).toBe(0);
    expect(metrics.inputTokens).toBe(0);
    expect(metrics.model).toBeNull();
  });

  it("skips malformed lines", () => {
    const content = [
      "not json",
      '{"timestamp":1000,"item":{"type":"turn_context","text":"hello"}}',
    ].join("\n");
    const metrics = parseCodexRollout(content);
    expect(metrics.userMessages).toBe(1);
  });
});
