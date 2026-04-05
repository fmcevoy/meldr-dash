import { describe, it, expect } from "vitest";
import { evaluate } from "../../src/tips/evaluator.js";
import { emptyState } from "../../src/adapters/types.js";

describe("Evaluator", () => {
  it("triggers keep-rules-lean when claudeMdLines > 200", () => {
    const state = { ...emptyState(), claudeMdLines: 250 };
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "keep-rules-lean")).toBe(true);
  });

  it("does not trigger keep-rules-lean when claudeMdLines <= 200", () => {
    const state = { ...emptyState(), claudeMdLines: 100 };
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "keep-rules-lean")).toBe(false);
  });

  it("triggers disconnect-mcps when mcpServerCount > 3", () => {
    const state = { ...emptyState(), mcpServerCount: 5, mcpServersEnabled: 5 };
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "disconnect-mcps")).toBe(true);
  });

  it("triggers cache-ttl-warning when timeSinceLastMessageMs > 240000", () => {
    const state = { ...emptyState(), timeSinceLastMessageMs: 250000 };
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "cache-ttl-warning")).toBe(true);
  });

  it("triggers clear-context when session > 1 hour", () => {
    const state = { ...emptyState(), sessionAgeMs: 3700000 };
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "clear-context")).toBe(true);
  });

  it("sorts alerts by impact (High before Medium)", () => {
    const state = {
      ...emptyState(),
      claudeMdLines: 250,
      sessionAgeMs: 3700000,
      mcpServerCount: 5,
      mcpServersEnabled: 5,
    };
    const { alerts } = evaluate(state);
    const highIdx = alerts.findIndex((a) => a.impact === "High");
    const medIdx = alerts.findIndex((a) => a.impact === "Medium");
    if (highIdx !== -1 && medIdx !== -1) {
      expect(highIdx).toBeLessThan(medIdx);
    }
  });

  it("returns recommendations for non-triggered techniques", () => {
    const state = emptyState();
    const { recommendations } = evaluate(state);
    expect(recommendations.length).toBeGreaterThan(0);
  });
});
