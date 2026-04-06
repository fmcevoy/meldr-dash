import { describe, it, expect } from "vitest";
import { parseGeminiSession } from "../../src/adapters/parse-gemini-session.js";

describe("parseGeminiSession", () => {
  it("counts user messages", () => {
    const data = {
      messages: [
        { type: "user", text: "hello", timestamp: 1000 },
        { type: "gemini", text: "hi", timestamp: 2000, tokens: { input: 10, output: 5, cached: 0, total: 15 } },
        { type: "user", text: "bye", timestamp: 3000 },
        { type: "gemini", text: "bye", timestamp: 4000, tokens: { input: 20, output: 10, cached: 0, total: 30 } },
      ],
    };
    const metrics = parseGeminiSession(data);
    expect(metrics.userMessages).toBe(2);
  });

  it("sums token counts from gemini messages", () => {
    const data = {
      messages: [
        { type: "gemini", timestamp: 1000, tokens: { input: 5000, output: 3000, cached: 2000, total: 10000 } },
        { type: "gemini", timestamp: 2000, tokens: { input: 8000, output: 4000, cached: 3000, total: 15000 } },
      ],
    };
    const metrics = parseGeminiSession(data);
    expect(metrics.inputTokens).toBe(13000);
    expect(metrics.outputTokens).toBe(7000);
    expect(metrics.cacheReadTokens).toBe(5000);
  });

  it("extracts latest model", () => {
    const data = {
      messages: [
        { type: "gemini", timestamp: 1000, model: "gemini-2.5-flash", tokens: { input: 10, output: 5, total: 15 } },
        { type: "gemini", timestamp: 2000, model: "gemini-2.5-pro", tokens: { input: 10, output: 5, total: 15 } },
      ],
    };
    const metrics = parseGeminiSession(data);
    expect(metrics.model).toBe("gemini-2.5-pro");
  });

  it("builds context history from gemini messages", () => {
    const data = {
      messages: [
        { type: "gemini", timestamp: 1000, model: "gemini-2.5-pro", tokens: { input: 10000, output: 500, cached: 0, total: 10500 } },
        { type: "gemini", timestamp: 2000, model: "gemini-2.5-pro", tokens: { input: 50000, output: 1000, cached: 10000, total: 61000 } },
      ],
    };
    const metrics = parseGeminiSession(data);
    expect(metrics.contextHistory).toHaveLength(2);
    // 10000 / 1M = 1%
    expect(metrics.contextHistory[0]).toBe(1);
    // (50000 + 10000) / 1M = 6%
    expect(metrics.contextHistory[1]).toBe(6);
    expect(metrics.contextPercent).toBe(6);
  });

  it("returns empty metrics for null input", () => {
    const metrics = parseGeminiSession(null);
    expect(metrics.userMessages).toBe(0);
    expect(metrics.inputTokens).toBe(0);
    expect(metrics.model).toBeNull();
  });

  it("returns empty metrics for empty messages array", () => {
    const metrics = parseGeminiSession({ messages: [] });
    expect(metrics.userMessages).toBe(0);
  });

  it("handles messages without tokens gracefully", () => {
    const data = {
      messages: [
        { type: "user", text: "hello", timestamp: 1000 },
        { type: "gemini", text: "hi", timestamp: 2000 },
      ],
    };
    const metrics = parseGeminiSession(data);
    expect(metrics.userMessages).toBe(1);
    expect(metrics.inputTokens).toBe(0);
  });

  it("defaults context window to 1M for gemini models", () => {
    const data = {
      messages: [
        { type: "gemini", timestamp: 1000, model: "gemini-2.5-pro", tokens: { input: 100, output: 50, total: 150 } },
      ],
    };
    const metrics = parseGeminiSession(data);
    expect(metrics.contextWindow).toBe(1_000_000);
  });

  it("computes timeSinceLastMessageMs from max timestamp", () => {
    const now = Date.now();
    const data = {
      messages: [
        { type: "user", text: "hello", timestamp: now - 5000 },
        { type: "gemini", text: "hi", timestamp: now - 3000, tokens: { input: 10, output: 5, total: 15 } },
      ],
    };
    const metrics = parseGeminiSession(data);
    expect(metrics.timeSinceLastMessageMs).toBeGreaterThanOrEqual(2900);
    expect(metrics.timeSinceLastMessageMs).toBeLessThan(5000);
  });
});
