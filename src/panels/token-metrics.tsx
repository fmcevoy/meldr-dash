import React from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { DashboardState, SessionSummary } from "../adapters/types.js";
import { colors } from "../theme.js";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return "< 1m";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

const SPARK = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];

function sparkLine(values: number[], width: number): string {
  if (values.length === 0) return "";
  const sampled: number[] = [];
  for (let i = 0; i < width; i++) {
    const idx = Math.round((i / (width - 1)) * (values.length - 1));
    sampled.push(values[idx]);
  }
  const max = Math.max(...sampled, 1);
  return sampled
    .map((v) => {
      const level = Math.round((v / max) * (SPARK.length - 1));
      return SPARK[Math.min(level, SPARK.length - 1)];
    })
    .join("");
}

interface TokenMetricsProps {
  state: DashboardState;
  selectedSessionId?: string;
}

function getSession(state: DashboardState, selectedSessionId?: string): SessionSummary | undefined {
  if (selectedSessionId) {
    return state.sessionList.find((s) => s.sessionId === selectedSessionId);
  }
  return state.sessionList.find((s) => s.isSelected);
}

export function TokenMetrics({ state, selectedSessionId }: TokenMetricsProps): React.ReactElement {
  const session = getSession(state, selectedSessionId);

  if (!session) {
    return (
      <PanelBox title="Session Metrics">
        <Box flexDirection="column" paddingX={1}>
          <Text color={colors.muted}>No session data</Text>
          <Text color={colors.muted}>
            All time: {formatCost(state.totalCostUsd)} | {formatTokens(state.totalInputTokens + state.totalOutputTokens)} tokens
          </Text>
        </Box>
      </PanelBox>
    );
  }

  // Platform without local token data (e.g. Cursor)
  const hasTokenData = session.inputTokens > 0 || session.outputTokens > 0 || session.cacheReadTokens > 0;
  if (!hasTokenData && state.platform !== "claude") {
    const projectName = session.project.split("/").pop() || session.project;
    const age = formatDuration(session.ageMs);
    return (
      <PanelBox title="Session Metrics">
        <Box flexDirection="column" paddingX={1}>
          <Text>
            <Text color={colors.primary}>{projectName}</Text>
            <Text color={colors.muted}> — {age}</Text>
          </Text>
          {session.model && (
            <Text>
              <Text color={colors.muted}>Model:</Text> {session.model}
            </Text>
          )}
          <Text color={colors.muted}>Token data not available locally</Text>
          <Text color={colors.muted}>Sessions: {state.activeSessions}</Text>
        </Box>
      </PanelBox>
    );
  }

  if (session.contextHistory.length === 0) {
    const projectName = session.project.split("/").pop() || session.project;
    const age = formatDuration(session.ageMs);
    return (
      <PanelBox title="Session Metrics">
        <Box flexDirection="column" paddingX={1}>
          <Text>
            <Text color={colors.primary}>{projectName}</Text>
            <Text color={colors.muted}> — {age}</Text>
          </Text>
          <Text color={colors.warning}>Idle session (no messages)</Text>
          <Text color={colors.muted}>
            All time: {formatCost(state.totalCostUsd)} | {formatTokens(state.totalInputTokens + state.totalOutputTokens)} tokens
          </Text>
        </Box>
      </PanelBox>
    );
  }

  const pct = session.contextPercent;
  const barWidth = 24;
  const filled = Math.round((pct / 100) * barWidth);
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(barWidth - filled);
  const barColor = pct > 75 ? colors.danger : pct > 50 ? colors.warning : colors.success;

  return (
    <PanelBox title="Session Metrics">
      <Box flexDirection="column" paddingX={1}>
        {/* Context graph */}
        <Text>
          Context{" "}
          <Text color={barColor}>{bar}</Text>{" "}
          <Text bold>{pct}%</Text>
          {session.model && (
            <Text color={colors.muted}> {session.model.replace("claude-", "")}</Text>
          )}
        </Text>
        <Text color={colors.muted}>
          {sparkLine(session.contextHistory, 30)}
        </Text>

        {/* Per-session token breakdown */}
        <Text>
          <Text color={colors.primary}>In:</Text>{" "}
          {formatTokens(session.inputTokens + session.cacheReadTokens + session.cacheCreateTokens)}
          {"  "}
          <Text color={colors.success}>Out:</Text>{" "}
          {formatTokens(session.outputTokens)}
          {"  "}
          <Text color={colors.accent}>Cache:</Text>{" "}
          {formatTokens(session.cacheReadTokens)}
          {"  "}
          <Text color={colors.muted}>Msgs:</Text>{" "}
          {session.messageCount}
        </Text>

        {/* All-time summary */}
        <Text color={colors.muted}>
          All time: {formatCost(state.totalCostUsd)} | {formatTokens(state.totalInputTokens + state.totalOutputTokens)} tokens | {state.todayMessageCount} today
        </Text>
      </Box>
    </PanelBox>
  );
}
