import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { Technique } from "../tips/database.js";
import { formatAlertLine } from "../tips/formatter.js";

interface AlertListProps {
  items: Technique[];
  title: string;
  emptyText: string;
  height?: number;
  platform?: string;
}

function AlertList({ items, title, emptyText, height, platform }: AlertListProps): React.ReactElement {
  if (items.length === 0) {
    return (
      <PanelBox title={title} height={height}>
        <Box paddingX={1}>
          <Text color="gray">{emptyText}</Text>
        </Box>
      </PanelBox>
    );
  }

  // Available lines inside the box: height minus border (2) and title (1)
  const availableLines = height ? height - 3 : Infinity;

  return (
    <PanelBox title={title} height={height}>
      <Box flexDirection="column" paddingX={1}>
        {items.map((alert, i) => {
          const line = formatAlertLine(alert, platform);
          // Each item: 1 line for title, optionally 1 for fix
          const linesBefore = items.slice(0, i).reduce(
            (sum, a) => sum + 1 + (a.fix ? 1 : 0), 0,
          );
          if (linesBefore >= availableLines) return null;
          const showFix = line.fix !== null && linesBefore + 1 < availableLines;
          return (
            <Box key={alert.id} flexDirection="column">
              <Text>
                {line.icon}{" "}
                <Text color={line.impactColor}>{line.impact}</Text>{" "}
                {line.text}
                {line.command !== null ? (
                  <Text color="gray"> — {line.command}</Text>
                ) : null}
              </Text>
              {showFix && (
                <Text color="gray">    {line.fix}</Text>
              )}
            </Box>
          );
        })}
      </Box>
    </PanelBox>
  );
}

interface ActiveAlertsProps {
  alerts: Technique[];
}

export function ActiveAlerts({ alerts }: ActiveAlertsProps): React.ReactElement {
  return <AlertList items={alerts} title="Active Alerts" emptyText="No active alerts" />;
}

interface MonitorAlertsProps {
  monitors: Technique[];
  total?: number;
  page?: number;
  totalPages?: number;
  height?: number;
  platform?: string;
}

export function MonitorAlerts({ monitors, total, page, totalPages, height, platform }: MonitorAlertsProps): React.ReactElement {
  const count = total ?? monitors.length;
  const pageLabel = totalPages && totalPages > 1 ? ` ${(page ?? 0) + 1}/${totalPages}` : "";
  return <AlertList items={monitors} title={`Monitors (${count})${pageLabel}`} emptyText="All clear" height={height} platform={platform} />;
}

interface TipsAlertsProps {
  tips: Technique[];
  total?: number;
  page?: number;
  totalPages?: number;
  height?: number;
  platform?: string;
}

export function TipsAlerts({ tips, total, page, totalPages, height, platform }: TipsAlertsProps): React.ReactElement {
  const count = total ?? tips.length;
  const pageLabel = totalPages && totalPages > 1 ? ` ${(page ?? 0) + 1}/${totalPages}` : "";
  return <AlertList items={tips} title={`Tips (${count})${pageLabel}`} emptyText="No tips right now" height={height} platform={platform} />;
}
