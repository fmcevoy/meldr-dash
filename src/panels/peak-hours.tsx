import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { colors } from "../theme.js";

const BARS = [" ", "\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

interface PeakHoursProps {
  hourCounts: Record<string, number>;
  peakHours: number[];
}

export function PeakHours({ hourCounts, peakHours }: PeakHoursProps): React.ReactElement {
  const entries = Object.entries(hourCounts);

  if (entries.length === 0) {
    return (
      <PanelBox title="Activity">
        <Box paddingX={1}>
          <Text color={colors.muted}>No usage data</Text>
        </Box>
      </PanelBox>
    );
  }

  const counts = Array.from({ length: 24 }, (_, i) =>
    Number(hourCounts[String(i)] ?? 0),
  );
  const max = Math.max(...counts, 1);
  const currentHour = new Date().getHours();

  const chart = counts
    .map((c, i) => {
      const level = Math.round((c / max) * (BARS.length - 1));
      const bar = BARS[level];
      return i === currentHour ? `\x1b[36m${bar}\x1b[0m` : bar;
    })
    .join("");

  const peakLabel = peakHours.length > 0
    ? peakHours.map(formatHour).join(", ")
    : "N/A";

  return (
    <PanelBox title="Activity">
      <Box flexDirection="column" paddingX={1}>
        <Text>{chart}</Text>
        <Text color={colors.muted}>
          Peak: {peakLabel}
        </Text>
      </Box>
    </PanelBox>
  );
}
