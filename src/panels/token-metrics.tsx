import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { DashboardState } from "../adapters/types.js";
import { colors } from "../theme.js";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

interface TokenMetricsProps {
  state: DashboardState;
}

export function TokenMetrics({ state }: TokenMetricsProps): React.ReactElement {
  if (state.liveContextPercent !== null) {
    const pct = state.liveContextPercent;
    const barWidth = 20;
    const filled = Math.round((pct / 100) * barWidth);
    const bar = "█".repeat(filled) + "░".repeat(barWidth - filled);
    const barColor = pct > 75 ? colors.danger : pct > 50 ? colors.warning : colors.success;

    return (
      <PanelBox title="Metrics">
        <Box flexDirection="column" paddingX={1}>
          <Text>
            Context{" "}
            <Text color={barColor}>{bar}</Text>{" "}
            <Text bold>{pct}%</Text>
          </Text>
          {state.liveModel !== null && (
            <Text color={colors.muted}>Model: {state.liveModel}</Text>
          )}
          {state.liveSessionCost !== null && (
            <Text color={colors.muted}>
              Session cost: {formatCost(state.liveSessionCost)}
            </Text>
          )}
        </Box>
      </PanelBox>
    );
  }

  return (
    <PanelBox title="Metrics">
      <Box flexDirection="column" paddingX={1}>
        <Text>
          <Text color={colors.primary}>In:</Text>{" "}
          {formatTokens(state.totalInputTokens)}
          {"  "}
          <Text color={colors.success}>Out:</Text>{" "}
          {formatTokens(state.totalOutputTokens)}
        </Text>
        <Text>
          <Text color={colors.accent}>Cache:</Text>{" "}
          {formatTokens(state.totalCacheReadTokens)}
        </Text>
        <Text>
          <Text color={colors.warning}>Cost:</Text>{" "}
          {formatCost(state.totalCostUsd)}
        </Text>
      </Box>
    </PanelBox>
  );
}
