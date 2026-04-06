import React, { useState } from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useSessionCycle } from "../../src/hooks/use-session-cycle.js";
import { SessionSummary } from "../../src/adapters/types.js";

function makeSessions(count: number): SessionSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    sessionId: `session-${i}`,
    project: `/project-${i}`,
    startedAt: Date.now() - i * 60000,
    messageCount: i * 10,
    isSelected: i === 0,
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreateTokens: 0,
    model: null, contextWindow: 200000, contextPercent: 0, contextHistory: [],
    ageMs: i * 60000, timeSinceLastMessageMs: 0,
    memoryFileCount: 0, memoryTotalBytes: 0, memoryRecentFiles: [],
    ignoreSuggestions: [], rulesLines: 0,
    mcpServerCount: 0, mcpServersEnabled: 0, hasIgnoreFile: true, recentTurns: [],
    lastCompactMs: 0, lastCostCheckMs: 0,
    mode: null, ignoreFileName: ".claudeignore", ignorePatterns: [], ignorePatternCount: 0,
  }));
}

function makeSessionsWithActivity(): SessionSummary[] {
  const now = Date.now();
  return [
    { ...makeSessions(1)[0], sessionId: "old", timeSinceLastMessageMs: 60000, startedAt: now - 120000 },
    { ...makeSessions(1)[0], sessionId: "recent", timeSinceLastMessageMs: 5000, startedAt: now - 60000 },
    { ...makeSessions(1)[0], sessionId: "idle", timeSinceLastMessageMs: 0, startedAt: now - 180000 },
  ];
}

let triggerCycle: (() => void) | null = null;
let lastSorted: SessionSummary[] = [];

function HookTester({ sessions }: { sessions: SessionSummary[] }): React.ReactElement {
  const { selectedSessionId, sortedSessions, cycleNext } = useSessionCycle(sessions);
  triggerCycle = cycleNext;
  lastSorted = sortedSessions;
  const display = selectedSessionId || "none";
  return <Text>{display}</Text>;
}

describe("useSessionCycle", () => {
  it("returns first session when index is 0", () => {
    const { lastFrame } = render(<HookTester sessions={makeSessions(3)} />);
    expect(lastFrame()).toContain("session-0");
  });

  it("returns undefined for empty list", () => {
    const { lastFrame } = render(<HookTester sessions={[]} />);
    expect(lastFrame()).toContain("none");
  });

  it("cycleNext advances and wraps around", async () => {
    const sessions = makeSessions(2);
    const { lastFrame } = render(<HookTester sessions={sessions} />);
    expect(lastFrame()).toContain("session-0");
    expect(triggerCycle).toBeInstanceOf(Function);
  });

  it("sorts sessions by most recently active first", () => {
    const sessions = makeSessionsWithActivity();
    render(<HookTester sessions={sessions} />);
    // "recent" has lowest timeSinceLastMessageMs (5s ago) → first
    // "old" has higher timeSinceLastMessageMs (60s ago) → second
    // "idle" has 0 timeSinceLastMessageMs → sorted by startedAt
    expect(lastSorted[0].sessionId).toBe("recent");
    expect(lastSorted[1].sessionId).toBe("old");
  });

  it("selects most recently active session by default", () => {
    const sessions = makeSessionsWithActivity();
    const { lastFrame } = render(<HookTester sessions={sessions} />);
    expect(lastFrame()).toContain("recent");
  });
});
