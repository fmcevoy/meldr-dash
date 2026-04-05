import { watch, type FSWatcher } from "chokidar";
import { CLIAdapter, DashboardState } from "./adapters/types.js";

export interface WatcherOptions {
  adapter: CLIAdapter;
  onStateChange: (state: DashboardState) => void;
  pollIntervalMs?: number;
  debounceMs?: number;
}

export class Watcher {
  private adapter: CLIAdapter;
  private onStateChange: (state: DashboardState) => void;
  private pollIntervalMs: number;
  private debounceMs: number;
  private fsWatcher: FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshQueued = false;

  constructor(options: WatcherOptions) {
    this.adapter = options.adapter;
    this.onStateChange = options.onStateChange;
    this.pollIntervalMs = options.pollIntervalMs ?? 15000;
    this.debounceMs = options.debounceMs ?? 500;
  }

  start(): void {
    const watchPaths = this.adapter.getWatchPaths();
    if (watchPaths.length > 0) {
      this.fsWatcher = watch(watchPaths, {
        ignoreInitial: true,
        depth: 1,
      });
      this.fsWatcher.on("all", () => this.debouncedRefresh());
    }
    this.pollTimer = setInterval(() => this.forceRefresh(), this.pollIntervalMs);
    this.forceRefresh();
  }

  stop(): void {
    this.fsWatcher?.close();
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  async forceRefresh(): Promise<void> {
    try {
      const state = await this.adapter.collectState();
      this.onStateChange(state);
    } catch {
      // Adapter-level errors handled internally
    }
  }

  private debouncedRefresh(): void {
    if (this.debounceTimer) {
      this.refreshQueued = true;
      return;
    }
    this.forceRefresh();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.refreshQueued) {
        this.refreshQueued = false;
        this.forceRefresh();
      }
    }, this.debounceMs);
  }
}
