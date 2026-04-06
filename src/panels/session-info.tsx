import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { colors } from "../theme.js";

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "< 1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function truncateProject(project: string, max: number): string {
  const parts = project.split("/");
  const name = parts[parts.length - 1] || project;
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + "\u2026";
}

interface SessionInfoProps {
  sessions: import("../adapters/types.js").SessionSummary[];
  selectedSessionId?: string;
  isPeakHours?: boolean;
  height?: number;
}

/**
 * Window the session list so the selected session is always visible.
 * Returns a slice of `sessions` centered on the selected index.
 */
function windowSessions(
  sessions: import("../adapters/types.js").SessionSummary[],
  selectedSessionId: string | undefined,
  maxVisible: number,
): import("../adapters/types.js").SessionSummary[] {
  if (sessions.length <= maxVisible) return sessions;

  const selectedIdx = sessions.findIndex((s) =>
    selectedSessionId ? s.sessionId === selectedSessionId : s.isSelected,
  );
  const idx = selectedIdx === -1 ? 0 : selectedIdx;

  // Center the window on the selected index
  let start = Math.max(0, idx - Math.floor(maxVisible / 2));
  if (start + maxVisible > sessions.length) {
    start = sessions.length - maxVisible;
  }
  return sessions.slice(start, start + maxVisible);
}

export function SessionInfo({ sessions, selectedSessionId, isPeakHours, height }: SessionInfoProps): React.ReactElement {
  // Available lines: height minus border (2) and title (1), minus 1 if peak hours shown
  const overhead = 3 + (isPeakHours ? 1 : 0);
  const maxVisible = height ? Math.max(1, height - overhead) : 4;
  const visible = windowSessions(sessions, selectedSessionId, maxVisible);

  return (
    <PanelBox title={`Sessions (${sessions.length})`} height={height}>
      <Box flexDirection="column" paddingX={1}>
        {visible.length > 0 ? (
          visible.map((s) => {
            const isActive = selectedSessionId
              ? s.sessionId === selectedSessionId
              : s.isSelected;
            const marker = isActive ? "\u25b6" : " ";
            const age = formatDuration(s.ageMs);
            return (
              <Text key={s.sessionId}>
                <Text color={isActive ? colors.primary : colors.muted}>{marker}</Text>{" "}
                {truncateProject(s.project, 20)}{" "}
                <Text color={colors.muted}>{age}</Text>
              </Text>
            );
          })
        ) : (
          <Text color={colors.muted}>No sessions</Text>
        )}
        {isPeakHours && (
          <Text color={colors.warning}>Peak hours</Text>
        )}
      </Box>
    </PanelBox>
  );
}
