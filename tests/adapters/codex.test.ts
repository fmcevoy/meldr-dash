import { describe, it, expect } from "vitest";
import { CodexAdapter } from "../../src/adapters/codex.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "..", "fixtures-codex");

describe("CodexAdapter", () => {
  it("sets platform to codex", async () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.platform).toBe("codex");
  });

  it("discovers sessions from rollout JSONL files", async () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.sessionList).toHaveLength(2);
    expect(state.activeSessions).toBe(2);
  });

  it("most recent session is selected", async () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const selected = state.sessionList.find((s) => s.isSelected);
    expect(selected).toBeDefined();
    // rollout-1775420000000 is more recent
    expect(selected!.sessionId).toContain("1775420000000");
  });

  it("session has correct per-session metrics from rollout", async () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const s1 = state.sessionList.find((s) => s.sessionId.includes("test-001"));
    expect(s1!.messageCount).toBe(3);
    expect(s1!.model).toBe("o3");
    expect(s1!.inputTokens).toBe(25000);
    expect(s1!.outputTokens).toBe(12000);
    expect(s1!.cacheReadTokens).toBe(9000);
    expect(s1!.contextHistory.length).toBeGreaterThan(0);

    const s2 = state.sessionList.find((s) => s.sessionId.includes("test-002"));
    expect(s2!.messageCount).toBe(1);
    expect(s2!.model).toBe("gpt-4.1");
    expect(s2!.lastCompactMs).toBe(1775410030000);
  });

  it("uses state DB for aggregate token total", async () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    // state_5.sqlite has 70000 total tokens
    expect(state.totalInputTokens).toBe(70000);
  });

  it("reads config.toml for MCP servers", async () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const session = state.sessionList[0];
    expect(session.mcpServerCount).toBe(3);
    expect(session.mcpServersEnabled).toBe(2);
  });

  it("reads config.toml for live model", async () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.liveModel).toBe("o3");
  });

  it("reads AGENTS.md for rules lines", async () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const session = state.sessionList[0];
    expect(session.rulesLines).toBeGreaterThan(0);
  });

  it("reads history.jsonl for recent turns", async () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.recentTurns).toHaveLength(3);
    expect(state.recentTurns[0].display).toBe("fix login bug");
  });

  it("has no ignore file support", async () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const session = state.sessionList[0];
    expect(session.hasIgnoreFile).toBe(false);
    expect(session.ignoreFileName).toBe("");
  });

  it("handles missing data dir gracefully", async () => {
    const adapter = new CodexAdapter({ dataDir: "/tmp/nonexistent-codex-dir", cwd: "/tmp" });
    const state = await adapter.collectState();
    expect(state.platform).toBe("codex");
    expect(state.sessionList).toHaveLength(0);
    expect(state.activeSessions).toBe(0);
  });

  it("returns correct watch and poll paths", () => {
    const adapter = new CodexAdapter({ dataDir: fixtureDir, cwd: "/test/project" });
    const watch = adapter.getWatchPaths();
    expect(watch.some((p) => p.includes("sessions"))).toBe(true);
    const poll = adapter.getPollPaths();
    expect(poll.some((p) => p.includes("config.toml"))).toBe(true);
    expect(poll.some((p) => p.includes("AGENTS.md"))).toBe(true);
  });
});
