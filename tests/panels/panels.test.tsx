import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { TokenMetrics } from "../../src/panels/token-metrics.js";
import { SessionInfo } from "../../src/panels/session-info.js";
import { ActiveAlerts } from "../../src/panels/active-alerts.js";
import { Recommendations } from "../../src/panels/recommendations.js";
import { Environment } from "../../src/panels/environment.js";
import { History } from "../../src/panels/history.js";
import { StatusBar } from "../../src/panels/status-bar.js";
import { emptyState } from "../../src/adapters/types.js";

const mockState = {
  ...emptyState(),
  totalInputTokens: 500000,
  totalOutputTokens: 120000,
  totalCacheReadTokens: 350000,
  totalCostUsd: 12.5,
  sessionAgeMs: 4800000, // 1h 20m
  sessionMessages: 34,
  activeSessions: 2,
  mcpServerCount: 3,
  mcpServersEnabled: 2,
  pluginCount: 4,
  claudeMdLines: 142,
};

describe("Panel Components", () => {
  it("TokenMetrics renders token counts", () => {
    const { lastFrame } = render(<TokenMetrics state={mockState} />);
    expect(lastFrame()).toContain("500");
  });

  it("SessionInfo renders session age", () => {
    const { lastFrame } = render(<SessionInfo state={mockState} />);
    expect(lastFrame()).toContain("1h 20m");
  });

  it("ActiveAlerts renders empty when no alerts", () => {
    const { lastFrame } = render(<ActiveAlerts alerts={[]} />);
    expect(lastFrame()).toContain("No active alerts");
  });

  it("Environment renders MCP count", () => {
    const { lastFrame } = render(<Environment state={mockState} />);
    expect(lastFrame()).toContain("3");
  });

  it("History renders empty state", () => {
    const { lastFrame } = render(<History turns={[]} />);
    expect(lastFrame()).toContain("No history");
  });

  it("StatusBar renders alert count", () => {
    const { lastFrame } = render(
      <StatusBar alertCount={3} watchPath="~/.claude" />
    );
    expect(lastFrame()).toContain("3 alerts");
  });
});
