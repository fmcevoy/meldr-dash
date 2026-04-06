import { describe, it, expect } from "vitest";
import { CursorAdapter } from "../../src/adapters/cursor.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "..", "fixtures-cursor");

describe("CursorAdapter", () => {
  it("sets platform to cursor", async () => {
    const adapter = new CursorAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.platform).toBe("cursor");
  });

  it("discovers sessions from chat store.db files", async () => {
    const adapter = new CursorAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.sessionList.length).toBe(2);
    expect(state.activeSessions).toBe(2);
  });

  it("session has correct metadata from store.db", async () => {
    const adapter = new CursorAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    // Sessions sorted by startedAt descending, so conv-001 (newer) is first
    const first = state.sessionList[0];
    expect(first.project).toBe("Fix Auth Bug");
    expect(first.model).toBe("composer-2-fast");
    expect(first.startedAt).toBe(1775420000000);
    expect(first.isSelected).toBe(true);
  });

  it("second session has correct metadata", async () => {
    const adapter = new CursorAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const second = state.sessionList[1];
    expect(second.project).toBe("Add Tests");
    expect(second.model).toBe("claude-sonnet-4-6");
    expect(second.isSelected).toBe(false);
  });

  it("token fields are zero (not available locally)", async () => {
    const adapter = new CursorAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.totalInputTokens).toBe(0);
    expect(state.totalOutputTokens).toBe(0);
    expect(state.totalCostUsd).toBe(0);
    const s = state.sessionList[0];
    expect(s.inputTokens).toBe(0);
    expect(s.outputTokens).toBe(0);
    expect(s.contextPercent).toBe(0);
  });

  it("reads cli-config for live model", async () => {
    const adapter = new CursorAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.liveModel).toBe("composer-2-fast");
  });

  it("handles missing data dir gracefully", async () => {
    const adapter = new CursorAdapter({ dataDir: "/tmp/nonexistent-cursor-dir", cwd: "/tmp" });
    const state = await adapter.collectState();
    expect(state.platform).toBe("cursor");
    expect(state.sessionList).toHaveLength(0);
    expect(state.activeSessions).toBe(0);
  });

  it("returns correct watch and poll paths", () => {
    const adapter = new CursorAdapter({ dataDir: fixtureDir, cwd: "/test/project" });
    const watch = adapter.getWatchPaths();
    expect(watch.some((p) => p.includes("chats"))).toBe(true);
    const poll = adapter.getPollPaths();
    expect(poll.some((p) => p.includes("cli-config.json"))).toBe(true);
    expect(poll.some((p) => p.includes(".cursorignore"))).toBe(true);
  });
});
