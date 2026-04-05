import React, { useMemo } from "react";
import { Box, useApp, useInput } from "ink";
import { ClaudeAdapter } from "./adapters/claude.js";
import { useDashboard } from "./hooks/use-dashboard.js";
import { useTips } from "./hooks/use-tips.js";
import { TokenMetrics } from "./panels/token-metrics.js";
import { SessionInfo } from "./panels/session-info.js";
import { ActiveAlerts } from "./panels/active-alerts.js";
import { Recommendations } from "./panels/recommendations.js";
import { Environment } from "./panels/environment.js";
import { History } from "./panels/history.js";
import { StatusBar } from "./panels/status-bar.js";

interface AppProps {
  dataDir?: string;
  sessionId?: string;
  pollInterval?: number;
}

export function App({
  dataDir,
  sessionId,
  pollInterval,
}: AppProps): React.ReactElement {
  const { exit } = useApp();

  const adapter = useMemo(
    () => new ClaudeAdapter({ dataDir, sessionId }),
    [dataDir, sessionId],
  );

  const { state, forceRefresh } = useDashboard(adapter);
  const { alerts, recommendations, nextRecommendations, prevRecommendations } =
    useTips(state);

  useInput((input, _key) => {
    if (input === "q") {
      exit();
    } else if (input === "r") {
      forceRefresh();
    } else if (input === "n") {
      nextRecommendations();
    } else if (input === "p") {
      prevRecommendations();
    }
  });

  return (
    <Box flexDirection="column" width="100%">
      {/* Row 1: Token Metrics + Session Info */}
      <Box width="100%">
        <Box width="75%">
          <TokenMetrics state={state} />
        </Box>
        <Box width="25%">
          <SessionInfo state={state} />
        </Box>
      </Box>

      {/* Row 2: Active Alerts */}
      <Box width="100%">
        <ActiveAlerts alerts={alerts} />
      </Box>

      {/* Row 3: Recommendations */}
      <Box width="100%">
        <Recommendations recommendations={recommendations} />
      </Box>

      {/* Row 4: Environment + History */}
      <Box width="100%">
        <Box width="35%">
          <Environment state={state} />
        </Box>
        <Box width="65%">
          <History turns={state.recentTurns} />
        </Box>
      </Box>

      {/* Row 5: Status Bar */}
      <Box width="100%">
        <StatusBar alertCount={alerts.length} watchPath={adapter.dataDir} />
      </Box>
    </Box>
  );
}
