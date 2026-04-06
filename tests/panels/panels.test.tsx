import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { TokenMetrics } from "../../src/panels/token-metrics.js";
import { SessionInfo } from "../../src/panels/session-info.js";
import { ActiveAlerts, MonitorAlerts, TipsAlerts } from "../../src/panels/active-alerts.js";
import { Environment } from "../../src/panels/environment.js";
import { History } from "../../src/panels/history.js";
import { StatusBar } from "../../src/panels/status-bar.js";
import { emptyState, SessionSummary } from "../../src/adapters/types.js";

function mockSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    sessionId: "sess-1", project: "/project-a", startedAt: Date.now() - 60000,
    messageCount: 10, isSelected: true,
    inputTokens: 100, outputTokens: 500, cacheReadTokens: 8000, cacheCreateTokens: 4000,
    model: "claude-opus-4-6", contextWindow: 200000, contextPercent: 45,
    contextHistory: [5, 15, 30, 45], ageMs: 60000, timeSinceLastMessageMs: 5000,
    memoryFileCount: 2, memoryTotalBytes: 1024, memoryRecentFiles: [],
    ignoreSuggestions: [], rulesLines: 100, mcpServerCount: 3, mcpServersEnabled: 2,
    hasIgnoreFile: true, recentTurns: [{ display: "hello", timestamp: Date.now(), project: "/project-a" }],
    lastCompactMs: 0, lastCostCheckMs: 0,
    mode: null, ignoreFileName: ".claudeignore", ignorePatterns: [], ignorePatternCount: 0,
    ...overrides,
  };
}

const mockState = {
  ...emptyState(),
  totalInputTokens: 500000,
  totalOutputTokens: 120000,
  totalCacheReadTokens: 350000,
  totalCostUsd: 12.5,
  sessionAgeMs: 4800000,
  sessionMessages: 34,
  activeSessions: 2,
  pluginCount: 4,
};

describe("Panel Components", () => {
  it("TokenMetrics renders all-time totals when no session data", () => {
    const { lastFrame } = render(<TokenMetrics state={mockState} />);
    expect(lastFrame()).toContain("All time");
    expect(lastFrame()).toContain("$12.50");
  });

  it("SessionInfo renders session count", () => {
    const sessions = [
      mockSession({ sessionId: "sess-1", project: "/project-a" }),
      mockSession({ sessionId: "sess-2", project: "/project-b", isSelected: false }),
    ];
    const { lastFrame } = render(<SessionInfo sessions={sessions} />);
    expect(lastFrame()).toContain("Sessions (2)");
  });

  it("ActiveAlerts renders empty when no alerts", () => {
    const { lastFrame } = render(<ActiveAlerts alerts={[]} />);
    expect(lastFrame()).toContain("No active alerts");
  });

  it("Environment renders plugin count", () => {
    const { lastFrame } = render(<Environment state={mockState} />);
    expect(lastFrame()).toContain("4");
  });

  it("History renders empty state", () => {
    const { lastFrame } = render(<History state={mockState} />);
    expect(lastFrame()).toContain("No history");
  });

  it("StatusBar renders alert count", () => {
    const { lastFrame } = render(
      <StatusBar alertCount={3} watchPath="~/.claude" />
    );
    expect(lastFrame()).toContain("3 alerts");
  });

  it("TokenMetrics shows context bar when session has contextHistory", () => {
    const stateWithSession = {
      ...mockState,
      sessionList: [mockSession()],
    };
    const { lastFrame } = render(<TokenMetrics state={stateWithSession} selectedSessionId="sess-1" />);
    expect(lastFrame()).toContain("Context");
    expect(lastFrame()).toContain("45%");
  });

  it("TokenMetrics shows different data for different selectedSessionId", () => {
    const stateWithSessions = {
      ...mockState,
      sessionList: [
        mockSession({ sessionId: "sess-1", contextPercent: 45 }),
        mockSession({ sessionId: "sess-2", contextPercent: 80, isSelected: false }),
      ],
    };
    const { lastFrame: frame1 } = render(<TokenMetrics state={stateWithSessions} selectedSessionId="sess-1" />);
    const { lastFrame: frame2 } = render(<TokenMetrics state={stateWithSessions} selectedSessionId="sess-2" />);
    expect(frame1()).toContain("45%");
    expect(frame2()).toContain("80%");
  });

  it("TokenMetrics shows 'No session data' when session has no JSONL", () => {
    const { lastFrame } = render(<TokenMetrics state={mockState} />);
    expect(lastFrame()).toContain("No session data");
  });

  it("SessionInfo highlights correct session based on selectedSessionId", () => {
    const sessions = [
      mockSession({ sessionId: "sess-1", project: "/project-a" }),
      mockSession({ sessionId: "sess-2", project: "/project-b", isSelected: false }),
    ];
    const { lastFrame } = render(<SessionInfo sessions={sessions} selectedSessionId="sess-2" />);
    // The selected session should have the marker
    expect(lastFrame()).toContain("project-b");
  });

  it("MonitorAlerts shows 'All clear' when empty", () => {
    const { lastFrame } = render(<MonitorAlerts monitors={[]} />);
    expect(lastFrame()).toContain("All clear");
    expect(lastFrame()).toContain("Monitors (0)");
  });

  it("TipsAlerts shows 'No tips right now' when empty", () => {
    const { lastFrame } = render(<TipsAlerts tips={[]} />);
    expect(lastFrame()).toContain("No tips right now");
    expect(lastFrame()).toContain("Tips");
  });

  it("MonitorAlerts renders monitor items with fix text", () => {
    const monitors = [{
      id: "keep-rules-lean", title: "Keep Your Rules File Lean",
      description: "", category: "context-hygiene", impact: "High" as const,
      kind: "monitor" as const, platforms: [], command: null,
      fix: "Trim CLAUDE.md to <200 lines", condition: null,
    }];
    const { lastFrame } = render(<MonitorAlerts monitors={monitors} total={1} />);
    expect(lastFrame()).toContain("Monitors (1)");
    expect(lastFrame()).toContain("Keep Your Rules File Lean");
    expect(lastFrame()).toContain("Trim CLAUDE.md");
  });

  it("MonitorAlerts shows items even with small height", () => {
    const monitors = [{
      id: "test", title: "Test Alert",
      description: "", category: "context-hygiene", impact: "High" as const,
      kind: "monitor" as const, platforms: [], command: null,
      fix: "Some fix text", condition: null,
    }];
    // height=5: border(2) + title(1) = 3 overhead, leaving 2 lines for content
    const { lastFrame } = render(<MonitorAlerts monitors={monitors} total={1} height={5} />);
    expect(lastFrame()).toContain("Test Alert");
  });

  it("MonitorAlerts omits fix text when height is very constrained", () => {
    const monitors = [{
      id: "test", title: "Test Alert",
      description: "", category: "context-hygiene", impact: "High" as const,
      kind: "monitor" as const, platforms: [], command: null,
      fix: "Some fix text here", condition: null,
    }];
    // height=4: border(2) + title(1) = 3 overhead, leaving 1 line — title fits, fix doesn't
    const { lastFrame } = render(<MonitorAlerts monitors={monitors} total={1} height={4} />);
    expect(lastFrame()).toContain("Test Alert");
    expect(lastFrame()).not.toContain("Some fix text here");
  });

  it("MonitorAlerts shows page indicator when paginated", () => {
    const monitors = [{
      id: "test", title: "Test Alert",
      description: "", category: "context-hygiene", impact: "High" as const,
      kind: "monitor" as const, platforms: [], command: null,
      fix: null, condition: null,
    }];
    const { lastFrame } = render(<MonitorAlerts monitors={monitors} total={5} page={1} totalPages={2} />);
    expect(lastFrame()).toContain("Monitors (5) 2/2");
  });

  it("TipsAlerts renders tip items", () => {
    const tips = [{
      id: "plan-mode-first", title: "Use Plan Mode First",
      description: "", category: "prompting-strategy", impact: "High" as const,
      kind: "tip" as const, platforms: [], command: "/plan",
      fix: "Run /plan to outline approach", condition: null,
    }];
    const { lastFrame } = render(<TipsAlerts tips={tips} />);
    expect(lastFrame()).toContain("Tips");
    expect(lastFrame()).toContain("Use Plan Mode First");
  });

  it("SessionInfo windows list to keep selected session visible", () => {
    // Create 6 sessions, select the 6th — should still appear
    const sessions = Array.from({ length: 6 }, (_, i) =>
      mockSession({ sessionId: `sess-${i}`, project: `/project-${i}`, isSelected: false, ageMs: i * 60000, timeSinceLastMessageMs: i * 1000 }),
    );
    // height=7: overhead 3 → maxVisible=4. Selected is sess-5 (index 5), window should include it.
    const { lastFrame } = render(<SessionInfo sessions={sessions} selectedSessionId="sess-5" height={7} />);
    expect(lastFrame()).toContain("project-5");
  });

  it("SessionInfo shows all sessions when height allows", () => {
    const sessions = Array.from({ length: 3 }, (_, i) =>
      mockSession({ sessionId: `sess-${i}`, project: `/project-${i}`, isSelected: i === 0, ageMs: i * 60000, timeSinceLastMessageMs: i * 1000 }),
    );
    // height=8: overhead 3 → maxVisible=5, all 3 fit
    const { lastFrame } = render(<SessionInfo sessions={sessions} height={8} />);
    expect(lastFrame()).toContain("project-0");
    expect(lastFrame()).toContain("project-1");
    expect(lastFrame()).toContain("project-2");
  });

  it("TokenMetrics shows 'not available' for Cursor platform with zero tokens", () => {
    const cursorState = {
      ...mockState,
      platform: "cursor",
      sessionList: [mockSession({
        sessionId: "cursor-1", project: "/cursor-project",
        inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
        model: "composer-2-fast", contextHistory: [],
      })],
    };
    const { lastFrame } = render(<TokenMetrics state={cursorState} selectedSessionId="cursor-1" />);
    expect(lastFrame()).toContain("not available locally");
    expect(lastFrame()).toContain("composer-2-fast");
  });

  it("StatusBar shows platform indicator", () => {
    const { lastFrame } = render(
      <StatusBar alertCount={2} watchPath="~/.cursor" platform="cursor" />
    );
    expect(lastFrame()).toContain("[Cursor]");
    expect(lastFrame()).toContain("2 alerts");
  });
});
