import React, { useMemo, useState, useEffect } from "react";
import { Box, useApp, useInput, useStdout } from "ink";
import { ClaudeAdapter } from "./adapters/claude.js";
import { CursorAdapter } from "./adapters/cursor.js";
import { GeminiAdapter } from "./adapters/gemini.js";
import { CodexAdapter } from "./adapters/codex.js";
import { useDashboard } from "./hooks/use-dashboard.js";
import { useTips, itemsPerPage } from "./hooks/use-tips.js";
import { useSessionCycle } from "./hooks/use-session-cycle.js";
import { usePlatformCycle } from "./hooks/use-platform-cycle.js";
import { TokenMetrics } from "./panels/token-metrics.js";
import { SessionInfo } from "./panels/session-info.js";
import { CacheTimer } from "./panels/cache-timer.js";
import { MonitorAlerts, TipsAlerts } from "./panels/active-alerts.js";
import { PeakHours } from "./panels/peak-hours.js";
import { Memory } from "./panels/memory.js";
import { IgnoreSuggestions } from "./panels/ignore-suggestions.js";
import { Environment } from "./panels/environment.js";
import { History } from "./panels/history.js";
import { StatusBar } from "./panels/status-bar.js";
import { HelpOverlay } from "./panels/help-overlay.js";

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
  const { stdout } = useStdout();
  const [showHelp, setShowHelp] = useState(false);
  const [termSize, setTermSize] = useState({ columns: stdout.columns, rows: stdout.rows });

  useEffect(() => {
    const onResize = () => setTermSize({ columns: stdout.columns, rows: stdout.rows });
    stdout.on("resize", onResize);
    return () => { stdout.off("resize", onResize); };
  }, [stdout]);

  // Platform cycling
  const { activePlatform, cyclePlatform } = usePlatformCycle();

  // Create all adapters (cheap — no I/O in constructors)
  const adapters = useMemo(
    () => ({
      claude: new ClaudeAdapter({ dataDir, sessionId }),
      cursor: new CursorAdapter(),
      gemini: new GeminiAdapter(),
      codex: new CodexAdapter(),
    }),
    [dataDir, sessionId],
  );

  // Single dashboard — watcher restarts when adapter ref changes
  const activeAdapter = adapters[activePlatform];
  const { state, forceRefresh } = useDashboard(activeAdapter);

  const { selectedSessionId, sortedSessions, cycleNext } = useSessionCycle(state.sessionList);

  // Compute layout heights
  const row1Height = Math.min(8, Math.max(5, state.sessionList.length + 3));
  const ROW5_HEIGHT = 1;
  const available = Math.max(0, termSize.rows - row1Height - ROW5_HEIGHT);
  const row2Height = Math.max(5, Math.floor(available * 0.4));
  const row3Height = Math.max(5, Math.floor(available * 0.3));
  const row4Height = Math.max(5, available - row2Height - row3Height);

  const monitorCapacity = itemsPerPage(row2Height);
  const tipCapacity = itemsPerPage(row2Height);

  const {
    visibleMonitors, monitorPage, totalMonitorPages, totalMonitors,
    visibleTips, tipPage, totalTips, totalTipPages,
    nextMonitorPage, nextTipPage,
  } = useTips(state, selectedSessionId, monitorCapacity, tipCapacity);

  const selectedSession = selectedSessionId
    ? state.sessionList.find((s) => s.sessionId === selectedSessionId)
    : state.sessionList.find((s) => s.isSelected);
  const cacheTimerMs = selectedSession?.timeSinceLastMessageMs ?? state.timeSinceLastMessageMs;

  useInput((input, key) => {
    if (input === "q") {
      exit();
    } else if (input === "r") {
      forceRefresh();
    } else if (input === "p") {
      cyclePlatform();
    } else if (input === "s" || key.tab) {
      cycleNext();
    } else if (input === "m") {
      nextMonitorPage();
    } else if (input === "t") {
      nextTipPage();
    } else if (input === "?") {
      setShowHelp((h) => !h);
    } else if (key.escape && showHelp) {
      setShowHelp(false);
    }
  });

  if (showHelp) {
    return (
      <Box width={termSize.columns} height={termSize.rows}>
        <HelpOverlay />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={termSize.columns} height={termSize.rows}>
      {/* Row 1: Sessions + Cache Timer + Token Metrics */}
      <Box width="100%" height={row1Height}>
        <Box width="30%" height={row1Height}>
          <SessionInfo sessions={sortedSessions} selectedSessionId={selectedSessionId} isPeakHours={state.isPeakHours} height={row1Height} />
        </Box>
        <Box width="15%" height={row1Height}>
          <CacheTimer timeSinceLastMessageMs={cacheTimerMs} platform={activePlatform} />
        </Box>
        <Box width="55%" height={row1Height}>
          <TokenMetrics state={state} selectedSessionId={selectedSessionId} />
        </Box>
      </Box>

      {/* Row 2: Monitors + Tips */}
      <Box width="100%" height={row2Height}>
        <Box width="50%" height={row2Height}>
          <MonitorAlerts monitors={visibleMonitors} total={totalMonitors} page={monitorPage} totalPages={totalMonitorPages} height={row2Height} platform={activePlatform} />
        </Box>
        <Box width="50%" height={row2Height}>
          <TipsAlerts tips={visibleTips} total={totalTips} page={tipPage} totalPages={totalTipPages} height={row2Height} platform={activePlatform} />
        </Box>
      </Box>

      {/* Row 3: Peak Hours + Memory + Ignore Suggestions */}
      <Box width="100%" height={row3Height}>
        <Box width="35%" height={row3Height}>
          <PeakHours hourCounts={state.hourCounts} peakHours={state.peakHours} />
        </Box>
        <Box width="30%" height={row3Height}>
          <Memory state={state} selectedSessionId={selectedSessionId} />
        </Box>
        <Box width="35%" height={row3Height}>
          <IgnoreSuggestions state={state} selectedSessionId={selectedSessionId} />
        </Box>
      </Box>

      {/* Row 4: Environment + History */}
      <Box width="100%" height={row4Height}>
        <Box width="35%" height={row4Height}>
          <Environment state={state} selectedSessionId={selectedSessionId} />
        </Box>
        <Box width="65%" height={row4Height}>
          <History state={state} selectedSessionId={selectedSessionId} />
        </Box>
      </Box>

      {/* Row 5: Status Bar */}
      <Box width="100%">
        <StatusBar alertCount={totalMonitors} watchPath={activeAdapter.dataDir} platform={activePlatform} />
      </Box>
    </Box>
  );
}
