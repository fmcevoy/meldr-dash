import { useState, useCallback } from "react";

const PLATFORMS = ["claude", "cursor", "gemini", "codex"] as const;
export type Platform = (typeof PLATFORMS)[number];

export function usePlatformCycle(): {
  activePlatform: Platform;
  platforms: readonly string[];
  cyclePlatform: () => void;
} {
  const [index, setIndex] = useState(0);

  const cyclePlatform = useCallback(() => {
    setIndex((i) => (i + 1) % PLATFORMS.length);
  }, []);

  return {
    activePlatform: PLATFORMS[index],
    platforms: PLATFORMS,
    cyclePlatform,
  };
}
