import { describe, it, expect, vi } from "vitest";
import { Watcher } from "../src/watcher.js";
import { emptyState, CLIAdapter, DashboardState, TechniqueConfig } from "../src/adapters/types.js";

function mockAdapter(state?: Partial<DashboardState>): CLIAdapter {
  return {
    name: "mock",
    displayName: "Mock",
    dataDir: "/tmp/mock",
    rulesFile: "MOCK.md",
    collectState: vi.fn().mockResolvedValue({ ...emptyState(), ...state }),
    getWatchPaths: () => [],
    getPollPaths: () => [],
    getTechniqueOverrides: () => new Map<string, TechniqueConfig>(),
  };
}

describe("Watcher", () => {
  it("calls onStateChange on start", async () => {
    const adapter = mockAdapter({ activeSessions: 2 });
    const onChange = vi.fn();
    const watcher = new Watcher({ adapter, onStateChange: onChange, pollIntervalMs: 60000 });
    watcher.start();
    await new Promise((r) => setTimeout(r, 50));
    watcher.stop();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ activeSessions: 2 }));
  });

  it("forceRefresh triggers immediate state callback", async () => {
    const adapter = mockAdapter();
    const onChange = vi.fn();
    const watcher = new Watcher({ adapter, onStateChange: onChange, pollIntervalMs: 60000 });
    await watcher.forceRefresh();
    expect(onChange).toHaveBeenCalled();
    expect(adapter.collectState).toHaveBeenCalled();
    watcher.stop();
  });

  it("stop cleans up without errors", () => {
    const adapter = mockAdapter();
    const watcher = new Watcher({ adapter, onStateChange: vi.fn(), pollIntervalMs: 60000 });
    watcher.start();
    expect(() => watcher.stop()).not.toThrow();
  });
});
