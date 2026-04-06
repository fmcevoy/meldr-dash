import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { DashboardState, SessionSummary } from "../adapters/types.js";
import { colors } from "../theme.js";

function getSession(state: DashboardState, id?: string): SessionSummary | undefined {
  if (id) return state.sessionList.find((s) => s.sessionId === id);
  return state.sessionList.find((s) => s.isSelected);
}

interface EnvironmentProps {
  state: DashboardState;
  selectedSessionId?: string;
}

export function Environment({ state, selectedSessionId }: EnvironmentProps): React.ReactElement {
  const session = getSession(state, selectedSessionId);

  return (
    <PanelBox title="Environment">
      <Box flexDirection="column" paddingX={1}>
        <Text>
          <Text color={colors.muted}>MCP:</Text> {session?.mcpServerCount ?? 0} server
          {(session?.mcpServerCount ?? 0) !== 1 ? "s" : ""}{" "}
          <Text color={colors.success}>({session?.mcpServersEnabled ?? 0} on)</Text>
        </Text>
        <Text>
          <Text color={colors.muted}>Plugins:</Text> {state.pluginCount}
        </Text>
        <Text>
          <Text color={colors.muted}>Rules:</Text> {session?.rulesLines ?? 0} lines
        </Text>
        <Text>
          <Text color={colors.muted}>Hooks:</Text> {state.hookCount}
        </Text>
      </Box>
    </PanelBox>
  );
}
