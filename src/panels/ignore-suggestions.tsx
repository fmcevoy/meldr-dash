import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { DashboardState, SessionSummary } from "../adapters/types.js";
import { colors } from "../theme.js";

function getSession(state: DashboardState, id?: string): SessionSummary | undefined {
  if (id) return state.sessionList.find((s) => s.sessionId === id);
  return state.sessionList.find((s) => s.isSelected);
}

interface IgnoreSuggestionsProps {
  state: DashboardState;
  selectedSessionId?: string;
}

export function IgnoreSuggestions({ state, selectedSessionId }: IgnoreSuggestionsProps): React.ReactElement {
  const session = getSession(state, selectedSessionId);
  const suggestions = session?.ignoreSuggestions ?? [];
  const hasFile = session?.hasIgnoreFile ?? false;
  const fileName = session?.ignoreFileName || "ignore file";
  const patterns = session?.ignorePatterns ?? [];
  const patternCount = session?.ignorePatternCount ?? 0;

  if (hasFile) {
    const maxVisible = 4;
    const visible = patterns.slice(0, maxVisible);
    const remaining = patternCount - maxVisible;

    return (
      <PanelBox title="Ignore">
        <Box flexDirection="column" paddingX={1}>
          <Text color={colors.success}>{fileName} ({patternCount} patterns)</Text>
          {visible.map((p) => (
            <Text key={p} color={colors.muted}>  {p}</Text>
          ))}
          {remaining > 0 && (
            <Text color={colors.muted}>  ...+{remaining} more</Text>
          )}
        </Box>
      </PanelBox>
    );
  }

  if (suggestions.length > 0) {
    const visible = suggestions.slice(0, 4);
    return (
      <PanelBox title="Ignore">
        <Box flexDirection="column" paddingX={1}>
          <Text color={colors.warning}>No {fileName} found</Text>
          <Text color={colors.muted}>Suggested patterns:</Text>
          {visible.map((s) => (
            <Text key={s} color={colors.muted}>  {s}</Text>
          ))}
        </Box>
      </PanelBox>
    );
  }

  return (
    <PanelBox title="Ignore">
      <Box paddingX={1}>
        <Text color={colors.warning}>No {fileName} found</Text>
      </Box>
    </PanelBox>
  );
}
