import { useState, useCallback, useEffect, useMemo } from "react";
import { SessionSummary } from "../adapters/types.js";

/**
 * Returns sessions sorted by most recently active first.
 * "Last touched" = most recent message timestamp (lower timeSinceLastMessageMs = more recent).
 * Sessions with no messages sort by startedAt descending.
 */
function sortByLastActive(sessions: SessionSummary[]): SessionSummary[] {
  return [...sessions].sort((a, b) => {
    // Sessions with messages: lower timeSinceLastMessageMs = more recently active
    const aActive = a.timeSinceLastMessageMs > 0 ? Date.now() - a.timeSinceLastMessageMs : a.startedAt;
    const bActive = b.timeSinceLastMessageMs > 0 ? Date.now() - b.timeSinceLastMessageMs : b.startedAt;
    return bActive - aActive;
  });
}

export function useSessionCycle(sessionList: SessionSummary[]): {
  selectedSessionId: string | undefined;
  sortedSessions: SessionSummary[];
  cycleNext: () => void;
} {
  const sortedSessions = useMemo(() => sortByLastActive(sessionList), [sessionList]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset index if it goes out of bounds (sessions disappear)
  useEffect(() => {
    if (sortedSessions.length > 0 && selectedIndex >= sortedSessions.length) {
      setSelectedIndex(0);
    }
  }, [sortedSessions.length, selectedIndex]);

  const cycleNext = useCallback(() => {
    if (sortedSessions.length === 0) return;
    setSelectedIndex((i) => (i + 1) % sortedSessions.length);
  }, [sortedSessions.length]);

  const selectedSessionId =
    sortedSessions.length > 0
      ? sortedSessions[selectedIndex]?.sessionId
      : undefined;

  return { selectedSessionId, sortedSessions, cycleNext };
}
