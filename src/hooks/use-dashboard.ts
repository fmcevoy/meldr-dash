import { useState, useEffect, useRef, useCallback } from "react";
import { CLIAdapter, DashboardState, emptyState } from "../adapters/types.js";
import { Watcher } from "../watcher.js";

export function useDashboard(adapter: CLIAdapter): {
  state: DashboardState;
  forceRefresh: () => void;
} {
  const [state, setState] = useState<DashboardState>(emptyState());
  const watcherRef = useRef<Watcher | null>(null);

  useEffect(() => {
    const watcher = new Watcher({
      adapter,
      onStateChange: setState,
    });
    watcherRef.current = watcher;
    watcher.start();
    return () => watcher.stop();
  }, [adapter]);

  const forceRefresh = useCallback(() => {
    watcherRef.current?.forceRefresh();
  }, []);

  return { state, forceRefresh };
}
