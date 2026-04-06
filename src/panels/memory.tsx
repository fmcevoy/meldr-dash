import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { DashboardState, SessionSummary } from "../adapters/types.js";
import { colors } from "../theme.js";

function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)}MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)}KB`;
  return `${bytes}B`;
}

function relativeTime(ms: number): string {
  const ago = Date.now() - ms;
  const mins = Math.floor(ago / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getSession(state: DashboardState, id?: string): SessionSummary | undefined {
  if (id) return state.sessionList.find((s) => s.sessionId === id);
  return state.sessionList.find((s) => s.isSelected);
}

interface MemoryProps {
  state: DashboardState;
  selectedSessionId?: string;
}

export function Memory({ state, selectedSessionId }: MemoryProps): React.ReactElement {
  const session = getSession(state, selectedSessionId);

  if (!session || session.memoryFileCount === 0) {
    return (
      <PanelBox title="Memory">
        <Box paddingX={1}>
          <Text color={colors.muted}>No memories</Text>
        </Box>
      </PanelBox>
    );
  }

  return (
    <PanelBox title="Memory">
      <Box flexDirection="column" paddingX={1}>
        <Text>
          <Text color={colors.muted}>Files:</Text> {session.memoryFileCount}{" "}
          <Text color={colors.muted}>({formatBytes(session.memoryTotalBytes)})</Text>
        </Text>
        {session.memoryRecentFiles.map((f) => (
          <Text key={f.name} color={colors.muted}>
            {f.name.replace(/\.md$/, "")} — {relativeTime(f.modifiedMs)}
          </Text>
        ))}
      </Box>
    </PanelBox>
  );
}
