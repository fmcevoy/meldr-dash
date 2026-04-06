import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { DashboardState, SessionSummary } from "../adapters/types.js";
import { colors } from "../theme.js";

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "\u2026";
}

function getSession(state: DashboardState, id?: string): SessionSummary | undefined {
  if (id) return state.sessionList.find((s) => s.sessionId === id);
  return state.sessionList.find((s) => s.isSelected);
}

interface HistoryProps {
  state: DashboardState;
  selectedSessionId?: string;
}

export function History({ state, selectedSessionId }: HistoryProps): React.ReactElement {
  const session = getSession(state, selectedSessionId);
  const turns = session?.recentTurns ?? [];

  if (turns.length === 0) {
    return (
      <PanelBox title="History">
        <Box paddingX={1}>
          <Text color="gray">No history</Text>
        </Box>
      </PanelBox>
    );
  }

  const recent = turns.slice(-8);

  return (
    <PanelBox title="History">
      <Box flexDirection="column" paddingX={1}>
        {recent.map((turn, i) => (
          <Text key={i}>
            <Text color={colors.muted}>{formatTime(turn.timestamp)}</Text>{" "}
            {truncate(turn.display, 60)}
          </Text>
        ))}
      </Box>
    </PanelBox>
  );
}
