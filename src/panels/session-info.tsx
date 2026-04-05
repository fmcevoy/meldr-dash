import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { DashboardState } from "../adapters/types.js";
import { colors } from "../theme.js";

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "< 1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

interface SessionInfoProps {
  state: DashboardState;
}

export function SessionInfo({ state }: SessionInfoProps): React.ReactElement {
  return (
    <PanelBox title="Session">
      <Box flexDirection="column" paddingX={1}>
        <Text>
          <Text color={colors.muted}>Age:</Text> {formatDuration(state.sessionAgeMs)}
        </Text>
        <Text>
          <Text color={colors.muted}>Messages:</Text> {state.sessionMessages}
        </Text>
        <Text>
          <Text color={colors.muted}>Active:</Text> {state.activeSessions} session
          {state.activeSessions !== 1 ? "s" : ""}
        </Text>
        {state.isPeakHours && (
          <Text color={colors.warning}>Peak hours</Text>
        )}
      </Box>
    </PanelBox>
  );
}
