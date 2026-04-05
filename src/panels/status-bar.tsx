import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.js";

interface StatusBarProps {
  alertCount: number;
  watchPath: string;
}

function currentTime(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function StatusBar({
  alertCount,
  watchPath,
}: StatusBarProps): React.ReactElement {
  return (
    <Box gap={2}>
      <Text color={colors.muted}>{currentTime()}</Text>
      <Text color={colors.muted}>watching: {watchPath}</Text>
      <Text color={alertCount > 0 ? colors.warning : colors.muted}>
        {alertCount} alert{alertCount !== 1 ? "s" : ""}
      </Text>
      <Text color={colors.muted}>q:quit r:refresh</Text>
    </Box>
  );
}
