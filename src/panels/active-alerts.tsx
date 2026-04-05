import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { Technique } from "../tips/database.js";
import { formatAlertLine } from "../tips/formatter.js";

interface ActiveAlertsProps {
  alerts: Technique[];
}

const MAX_VISIBLE = 4;

export function ActiveAlerts({ alerts }: ActiveAlertsProps): React.ReactElement {
  const title = `Active Alerts (${alerts.length})`;

  if (alerts.length === 0) {
    return (
      <PanelBox title={title}>
        <Box paddingX={1}>
          <Text color="gray">No active alerts</Text>
        </Box>
      </PanelBox>
    );
  }

  const visible = alerts.slice(0, MAX_VISIBLE);
  const remaining = alerts.length - MAX_VISIBLE;

  return (
    <PanelBox title={title}>
      <Box flexDirection="column" paddingX={1}>
        {visible.map((alert) => {
          const line = formatAlertLine(alert);
          return (
            <Text key={alert.id}>
              {line.icon}{" "}
              <Text color={line.impactColor}>{line.impact}</Text>{" "}
              {line.text}
              {line.command !== null ? (
                <Text color="gray"> — {line.command}</Text>
              ) : null}
            </Text>
          );
        })}
        {remaining > 0 && (
          <Text color="gray">+{remaining} more</Text>
        )}
      </Box>
    </PanelBox>
  );
}
