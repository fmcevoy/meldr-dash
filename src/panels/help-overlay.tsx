import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.js";

export function HelpOverlay(): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={colors.primary}
      paddingX={2}
      paddingY={1}
      width="100%"
    >
      <Text bold color={colors.primary}>Keybindings</Text>
      <Text>  <Text bold>q</Text>    Quit dashboard</Text>
      <Text>  <Text bold>r</Text>    Force refresh all data</Text>
      <Text>  <Text bold>p</Text>    Cycle platform (Claude/Cursor/Gemini/Codex)</Text>
      <Text>  <Text bold>s/Tab</Text> Cycle active session</Text>
      <Text>  <Text bold>m</Text>    Page monitors</Text>
      <Text>  <Text bold>t</Text>    Page tips</Text>
      <Text>  <Text bold>?</Text>    Toggle this help</Text>
      <Text> </Text>
      <Text bold color={colors.primary}>Panels</Text>
      <Text color={colors.muted}>  Metrics     Today's token usage, cost, and per-model breakdown</Text>
      <Text color={colors.muted}>  Sessions    Active sessions with project names and age</Text>
      <Text color={colors.muted}>  Cache       Prompt cache TTL countdown (5 min window)</Text>
      <Text color={colors.muted}>  Alerts      Triggered conditions with fix instructions</Text>
      <Text color={colors.muted}>  Activity    24-hour usage spark chart with peak hours</Text>
      <Text color={colors.muted}>  Memory      Project memory files and recent updates</Text>
      <Text color={colors.muted}>  Ignore      Suggested ignore file entries</Text>
      <Text color={colors.muted}>  Environment MCP servers, plugins, hooks, rules file size</Text>
      <Text color={colors.muted}>  History     Recent turns from history.jsonl</Text>
      <Text> </Text>
      <Text color={colors.muted}>Press ? or Esc to close</Text>
    </Box>
  );
}
