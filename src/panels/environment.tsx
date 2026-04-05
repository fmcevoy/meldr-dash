import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { DashboardState } from "../adapters/types.js";
import { colors } from "../theme.js";

interface EnvironmentProps {
  state: DashboardState;
}

export function Environment({ state }: EnvironmentProps): React.ReactElement {
  return (
    <PanelBox title="Environment">
      <Box flexDirection="column" paddingX={1}>
        <Text>
          <Text color={colors.muted}>MCP:</Text> {state.mcpServerCount} server
          {state.mcpServerCount !== 1 ? "s" : ""}{" "}
          <Text color={colors.success}>({state.mcpServersEnabled} on)</Text>
        </Text>
        <Text>
          <Text color={colors.muted}>Plugins:</Text> {state.pluginCount}
        </Text>
        <Text>
          <Text color={colors.muted}>CLAUDE.md:</Text> {state.claudeMdLines} lines
        </Text>
        <Text>
          <Text color={colors.muted}>Hooks:</Text> {state.hookCount}
        </Text>
      </Box>
    </PanelBox>
  );
}
