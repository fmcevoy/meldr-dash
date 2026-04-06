import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import { PanelBox } from "./box.js";
import { colors } from "../theme.js";

const CACHE_TTL_MS = 300_000; // 5 minutes

interface CacheTimerProps {
  timeSinceLastMessageMs: number;
  platform?: string;
}

export function CacheTimer({ timeSinceLastMessageMs, platform }: CacheTimerProps): React.ReactElement {
  const [tick, setTick] = useState(0);
  const prevMs = useRef(timeSinceLastMessageMs);

  // Reset tick when the source value changes (session switch or state refresh)
  useEffect(() => {
    if (timeSinceLastMessageMs !== prevMs.current) {
      prevMs.current = timeSinceLastMessageMs;
      setTick(0);
    }
  }, [timeSinceLastMessageMs]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const elapsed = timeSinceLastMessageMs + tick * 1000;
  const remaining = CACHE_TTL_MS - elapsed;

  if (platform && platform !== "claude") {
    return (
      <PanelBox title="Cache">
        <Box paddingX={1}>
          <Text color={colors.muted}>Managed internally</Text>
        </Box>
      </PanelBox>
    );
  }

  if (timeSinceLastMessageMs === 0) {
    return (
      <PanelBox title="Cache">
        <Box paddingX={1}>
          <Text color={colors.muted}>No activity</Text>
        </Box>
      </PanelBox>
    );
  }

  if (remaining > 0) {
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return (
      <PanelBox title="Cache">
        <Box paddingX={1}>
          <Text color={colors.success}>
            {mins}m {String(secs).padStart(2, "0")}s left
          </Text>
        </Box>
      </PanelBox>
    );
  }

  return (
    <PanelBox title="Cache">
      <Box paddingX={1}>
        <Text color={colors.danger}>Likely expired</Text>
      </Box>
    </PanelBox>
  );
}
