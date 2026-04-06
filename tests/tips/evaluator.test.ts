import { describe, it, expect } from "vitest";
import { evaluate } from "../../src/tips/evaluator.js";
import { emptyState, SessionSummary } from "../../src/adapters/types.js";

function mockSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    sessionId: "test-session",
    project: "/test",
    startedAt: Date.now() - 60000,
    messageCount: 0,
    isSelected: true,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreateTokens: 0,
    model: null,
    contextWindow: 200000,
    contextPercent: 0,
    contextHistory: [],
    ageMs: 60000,
    timeSinceLastMessageMs: 0,
    memoryFileCount: 0,
    memoryTotalBytes: 0,
    memoryRecentFiles: [],
    ignoreSuggestions: [],
    rulesLines: 0,
    mcpServerCount: 0,
    mcpServersEnabled: 0,
    hasIgnoreFile: true,
    recentTurns: [],
    lastCompactMs: 0,
    lastCostCheckMs: 0,
    mode: null,
    ignoreFileName: ".claudeignore",
    ignorePatterns: [],
    ignorePatternCount: 0,
    ...overrides,
  };
}

function stateWith(sessionOverrides: Partial<SessionSummary> = {}, stateOverrides: Partial<ReturnType<typeof emptyState>> = {}) {
  return {
    ...emptyState(),
    sessionList: [mockSession(sessionOverrides)],
    ...stateOverrides,
  };
}

describe("Evaluator", () => {
  it("triggers keep-rules-lean when rulesLines > 200", () => {
    const state = stateWith({ rulesLines: 250 });
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "keep-rules-lean")).toBe(true);
  });

  it("does not trigger keep-rules-lean when rulesLines <= 200", () => {
    const state = stateWith({ rulesLines: 100 });
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "keep-rules-lean")).toBe(false);
  });

  it("triggers disconnect-mcps when mcpServerCount > 3", () => {
    const state = stateWith({ mcpServerCount: 5, mcpServersEnabled: 5 });
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "disconnect-mcps")).toBe(true);
  });

  it("triggers cache-ttl-warning when timeSinceLastMessageMs > 240000", () => {
    const state = stateWith({}, { timeSinceLastMessageMs: 250000 });
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "cache-ttl-warning")).toBe(true);
  });

  it("triggers clear-context when session > 1 hour", () => {
    const state = stateWith({}, { sessionAgeMs: 3700000 });
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "clear-context")).toBe(true);
  });

  it("sorts alerts by impact (High before Medium)", () => {
    const state = stateWith(
      { rulesLines: 250, mcpServerCount: 5, mcpServersEnabled: 5 },
      { sessionAgeMs: 3700000 },
    );
    const { alerts } = evaluate(state);
    const highIdx = alerts.findIndex((a) => a.impact === "High");
    const medIdx = alerts.findIndex((a) => a.impact === "Medium");
    if (highIdx !== -1 && medIdx !== -1) {
      expect(highIdx).toBeLessThan(medIdx);
    }
  });

  it("alerts include fix text when available", () => {
    const state = stateWith({ rulesLines: 250 });
    const { alerts } = evaluate(state);
    const alert = alerts.find((a) => a.id === "keep-rules-lean");
    expect(alert?.fix).toContain("Trim CLAUDE.md");
  });

  it("alerts use selectedSessionId when provided", () => {
    const state = {
      ...emptyState(),
      sessionList: [
        mockSession({ sessionId: "sess-a", rulesLines: 50, isSelected: true }),
        mockSession({ sessionId: "sess-b", rulesLines: 250, isSelected: false }),
      ],
    };
    // Without selectedSessionId — uses isSelected (sess-a, lines=50, no alert)
    const { alerts: alertsDefault } = evaluate(state);
    expect(alertsDefault.some((a) => a.id === "keep-rules-lean")).toBe(false);

    // With selectedSessionId=sess-b — uses sess-b (lines=250, triggers alert)
    const { alerts: alertsB } = evaluate(state, "sess-b");
    expect(alertsB.some((a) => a.id === "keep-rules-lean")).toBe(true);
  });

  it("compact-before-limit triggers at contextPercent > 75", () => {
    const state = stateWith({ contextPercent: 80 });
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "compact-before-limit")).toBe(true);
  });

  it("compact-before-limit does not trigger at contextPercent <= 75", () => {
    const state = stateWith({ contextPercent: 50 });
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "compact-before-limit")).toBe(false);
  });

  it("compact-before-limit suppressed after recent /compact", () => {
    const state = stateWith({ contextPercent: 80, lastCompactMs: Date.now() - 60000 });
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "compact-before-limit")).toBe(false);
  });

  it("right-model-for-job triggers for opus model", () => {
    const state = stateWith({ model: "claude-opus-4-6" });
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "right-model-for-job")).toBe(true);
  });

  it("alerts don't include techniques with no condition", () => {
    const state = stateWith({});
    const { alerts } = evaluate(state);
    // "surgical-file-refs" has no condition — should never appear in alerts
    expect(alerts.some((a) => a.id === "surgical-file-refs")).toBe(false);
  });

  it("separates monitors from tips", () => {
    const state = stateWith(
      { rulesLines: 250, mcpServerCount: 5, mcpServersEnabled: 5 },
    );
    const { monitors, allTips } = evaluate(state);
    // keep-rules-lean and disconnect-mcps are kind="monitor"
    expect(monitors.some((a) => a.id === "keep-rules-lean")).toBe(true);
    expect(monitors.some((a) => a.id === "disconnect-mcps")).toBe(true);
    // allTips contains ALL tip-kind techniques, not just triggered ones
    expect(allTips.every((t) => t.kind === "tip")).toBe(true);
    // Monitor items should not appear in tips
    expect(allTips.some((a) => a.id === "keep-rules-lean")).toBe(false);
  });

  it("monitors array only contains kind=monitor items", () => {
    const state = stateWith(
      { rulesLines: 250, model: "claude-opus-4-6" },
      { sessionAgeMs: 3700000 },
    );
    const { monitors, allTips } = evaluate(state);
    for (const m of monitors) {
      expect(m.kind).toBe("monitor");
    }
    for (const t of allTips) {
      expect(t.kind).toBe("tip");
    }
  });

  it("track-spend triggers when /cost never run and messages > 10", () => {
    const state = stateWith({ messageCount: 15, lastCostCheckMs: 0 });
    state.sessionMessages = 15;
    const { monitors } = evaluate(state);
    expect(monitors.some((a) => a.id === "track-spend")).toBe(true);
  });

  it("track-spend does not trigger when session has few messages", () => {
    const state = stateWith({ messageCount: 3, lastCostCheckMs: 0 });
    state.sessionMessages = 3;
    const { monitors } = evaluate(state);
    expect(monitors.some((a) => a.id === "track-spend")).toBe(false);
  });

  it("filters tips by platform — cursor excludes claude-only tips", () => {
    const state = stateWith({});
    state.platform = "cursor";
    const { allTips } = evaluate(state);
    // "use-btw" is claudeOnly — should not appear for cursor
    expect(allTips.some((t) => t.id === "use-btw")).toBe(false);
    // "surgical-file-refs" is allPlatforms — should appear
    expect(allTips.some((t) => t.id === "surgical-file-refs")).toBe(true);
  });

  it("filters monitors by platform — claude-only monitors excluded for cursor", () => {
    const state = stateWith({});
    state.platform = "cursor";
    state.hasNotificationsEnabled = false;
    const { monitors } = evaluate(state);
    // "enable-sounds" is claudeOnly — should not appear for cursor
    expect(monitors.some((m) => m.id === "enable-sounds")).toBe(false);
  });
});
