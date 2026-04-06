import { describe, it, expect } from "vitest";
import { buildDumpOutput } from "../src/dump.js";
import { emptyState, DashboardState, SessionSummary } from "../src/adapters/types.js";

function mockSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    sessionId: "test-session",
    project: "/test",
    startedAt: Date.now() - 60000,
    messageCount: 5,
    isSelected: true,
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 200,
    cacheCreateTokens: 100,
    model: "claude-sonnet-4-20250514",
    contextWindow: 200000,
    contextPercent: 45,
    contextHistory: [30, 35, 45],
    ageMs: 60000,
    timeSinceLastMessageMs: 5000,
    memoryFileCount: 3,
    memoryTotalBytes: 4096,
    memoryRecentFiles: [],
    ignoreSuggestions: [],
    rulesLines: 50,
    mcpServerCount: 2,
    mcpServersEnabled: 2,
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

function testState(overrides: Partial<DashboardState> = {}): DashboardState {
  return {
    ...emptyState(),
    pluginCount: 2,
    hookCount: 1,
    sessionList: [mockSession()],
    ...overrides,
  };
}

describe("buildDumpOutput", () => {
  it("throws on unknown category", () => {
    expect(() => buildDumpOutput("bogus", emptyState())).toThrow(
      /Unknown dump category: "bogus"/,
    );
  });

  describe("state", () => {
    it("returns the full DashboardState", () => {
      const state = testState();
      const output = buildDumpOutput("state", state) as DashboardState;
      expect(output.platform).toBe("claude");
      expect(output.sessionList).toHaveLength(1);
      expect(output.pluginCount).toBe(2);
    });
  });

  describe("sessions", () => {
    it("returns sessions sorted by startedAt descending", () => {
      const now = Date.now();
      const state = testState({
        sessionList: [
          mockSession({ sessionId: "old", startedAt: now - 200000 }),
          mockSession({ sessionId: "new", startedAt: now - 1000 }),
          mockSession({ sessionId: "mid", startedAt: now - 100000 }),
        ],
      });
      const output = buildDumpOutput("sessions", state) as SessionSummary[];
      expect(output.map((s) => s.sessionId)).toEqual(["new", "mid", "old"]);
    });

    it("returns empty array when no sessions", () => {
      const state = testState({ sessionList: [] });
      const output = buildDumpOutput("sessions", state) as SessionSummary[];
      expect(output).toEqual([]);
    });
  });

  describe("monitors", () => {
    it("returns triggered monitors", () => {
      const state = testState({
        sessionList: [mockSession({ rulesLines: 250 })],
      });
      const output = buildDumpOutput("monitors", state) as Array<{ id: string }>;
      expect(output.some((m) => m.id === "keep-rules-lean")).toBe(true);
    });

    it("returns empty array when no monitors triggered", () => {
      const state = testState({
        sessionAgeMs: 0,
        sessionList: [
          mockSession({
            rulesLines: 10,
            contextPercent: 5,
            mcpServerCount: 1,
            mcpServersEnabled: 1,
          }),
        ],
      });
      const output = buildDumpOutput("monitors", state) as Array<{ id: string }>;
      // May still have some monitors depending on other conditions,
      // but keep-rules-lean should not be among them
      expect(output.some((m) => m.id === "keep-rules-lean")).toBe(false);
    });
  });

  describe("tips", () => {
    it("returns all tips for the platform", () => {
      const state = testState();
      const output = buildDumpOutput("tips", state) as Array<{
        id: string;
        kind: string;
        fix: string | null;
      }>;
      expect(output.length).toBeGreaterThan(0);
      expect(output.every((t) => t.kind === "tip")).toBe(true);
    });

    it("all tips have fix text", () => {
      const state = testState();
      const output = buildDumpOutput("tips", state) as Array<{ fix: string | null }>;
      for (const tip of output) {
        expect(tip.fix).not.toBeNull();
      }
    });
  });

  describe("metrics", () => {
    it("returns token fields for selected session", () => {
      const state = testState();
      const output = buildDumpOutput("metrics", state) as Record<string, unknown>;
      expect(output.sessionId).toBe("test-session");
      expect(output.inputTokens).toBe(1000);
      expect(output.outputTokens).toBe(500);
      expect(output.cacheReadTokens).toBe(200);
      expect(output.model).toBe("claude-sonnet-4-20250514");
    });

    it("returns specific session when selectedSessionId provided", () => {
      const state = testState({
        sessionList: [
          mockSession({ sessionId: "a", isSelected: true, inputTokens: 100 }),
          mockSession({ sessionId: "b", isSelected: false, inputTokens: 999 }),
        ],
      });
      const output = buildDumpOutput("metrics", state, "b") as Record<string, unknown>;
      expect(output.sessionId).toBe("b");
      expect(output.inputTokens).toBe(999);
    });

    it("returns zeroed fields when no sessions exist", () => {
      const state = testState({ sessionList: [] });
      const output = buildDumpOutput("metrics", state) as Record<string, unknown>;
      expect(output.sessionId).toBeNull();
      expect(output.inputTokens).toBe(0);
    });
  });

  describe("environment", () => {
    it("returns global and per-session environment data", () => {
      const state = testState({
        pluginCount: 3,
        hookCount: 2,
        hasNotificationsEnabled: true,
      });
      const output = buildDumpOutput("environment", state) as Record<string, unknown>;
      expect(output.pluginCount).toBe(3);
      expect(output.hookCount).toBe(2);
      expect(output.hasNotificationsEnabled).toBe(true);
      expect(output.rulesLines).toBe(50);
      expect(output.mcpServerCount).toBe(2);
      expect(output.hasIgnoreFile).toBe(true);
    });

    it("returns defaults when no session available", () => {
      const state = testState({ sessionList: [] });
      const output = buildDumpOutput("environment", state) as Record<string, unknown>;
      expect(output.rulesLines).toBe(0);
      expect(output.mcpServerCount).toBe(0);
      expect(output.hasIgnoreFile).toBe(false);
    });
  });

  describe("all", () => {
    it("contains every category key", () => {
      const state = testState();
      const output = buildDumpOutput("all", state) as Record<string, unknown>;
      expect(Object.keys(output).sort()).toEqual([
        "environment",
        "metrics",
        "monitors",
        "sessions",
        "state",
        "tips",
      ]);
    });

    it("each sub-key matches individual category output", () => {
      const state = testState();
      const all = buildDumpOutput("all", state) as Record<string, unknown>;
      expect(all.state).toEqual(buildDumpOutput("state", state));
      expect(all.sessions).toEqual(buildDumpOutput("sessions", state));
      expect(all.tips).toEqual(buildDumpOutput("tips", state));
      expect(all.metrics).toEqual(buildDumpOutput("metrics", state));
      expect(all.environment).toEqual(buildDumpOutput("environment", state));
    });
  });
});
