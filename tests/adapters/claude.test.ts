import { describe, it, expect } from "vitest";
import { ClaudeAdapter } from "../../src/adapters/claude.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "..", "fixtures");

describe("ClaudeAdapter", () => {
  it("reads stats-cache.json for aggregate metrics", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.totalInputTokens).toBe(500000);
    expect(state.totalOutputTokens).toBe(120000);
    expect(state.totalCacheReadTokens).toBe(350000);
    expect(state.totalCostUsd).toBe(12.5);
    expect(typeof state.todayMessageCount).toBe("number");
  });

  it("reads sessions for active session count and age", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.activeSessions).toBe(3);
    expect(state.sessionAgeMs).toBeGreaterThan(0);
  });

  it("reads history.jsonl for recent turns", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.recentTurns).toHaveLength(3);
    expect(state.recentTurns[0].display).toBe("/plan");
  });

  it("reads settings for plugin count", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.pluginCount).toBe(3);
  });

  it("reads MCP config into session", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const session = state.sessionList[0];
    expect(session.mcpServerCount).toBe(3);
    expect(session.mcpServersEnabled).toBe(2);
  });

  it("returns watch paths for hot files", () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const paths = adapter.getWatchPaths();
    expect(paths.some((p) => p.includes("stats-cache.json"))).toBe(true);
    expect(paths.some((p) => p.includes("sessions"))).toBe(true);
  });

  it("returns poll paths for cold files", () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const paths = adapter.getPollPaths();
    expect(paths.some((p) => p.includes("settings.json"))).toBe(true);
  });

  it("reads hourCounts and computes peakHours", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.hourCounts).toHaveProperty("10");
    expect(state.peakHours).toHaveLength(3);
    expect(state.peakHours[0]).toBe(10);
  });

  it("builds sessionList from session files", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.sessionList).toHaveLength(3);
    // Most recent session (highest startedAt) should be selected
    const selected = state.sessionList.find((s) => s.isSelected);
    expect(selected).toBeDefined();
    expect(selected!.sessionId).toBe("test-session-001"); // startedAt: 1775420000000 is highest
  });

  it("each session has independent metrics from its JSONL", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const s1 = state.sessionList.find((s) => s.sessionId === "test-session-001");
    const s2 = state.sessionList.find((s) => s.sessionId === "test-session-002");
    // session-001 has 4 user messages and opus model
    expect(s1!.messageCount).toBe(4);
    expect(s1!.model).toBe("claude-opus-4-6");
    expect(s1!.contextHistory.length).toBeGreaterThan(0);
    // session-002 has 2 user messages and sonnet model
    expect(s2!.messageCount).toBe(2);
    expect(s2!.model).toBe("claude-sonnet-4-6");
  });

  it("cross-session context propagation: 1M detected on one session applies to all with same model", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    // test-session-003 has opus with 251000 tokens (exceeds 200k → 1M auto-detected)
    const s3 = state.sessionList.find((s) => s.sessionId === "test-session-003");
    expect(s3!.contextWindow).toBe(1_000_000);
    // test-session-001 also uses opus — should be propagated to 1M even though its max is 17200
    const s1 = state.sessionList.find((s) => s.sessionId === "test-session-001");
    expect(s1!.contextWindow).toBe(1_000_000);
    // test-session-001 contextPercent should be rescaled (was based on 200k, now 1M)
    expect(s1!.contextPercent).toBeLessThan(10);
    // test-session-002 uses sonnet — should NOT be propagated (different model, no sonnet session exceeded 200k)
    const s2 = state.sessionList.find((s) => s.sessionId === "test-session-002");
    expect(s2!.contextWindow).toBe(200_000);
  });

  it("session carries ignoreSuggestions", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const session = state.sessionList[0];
    expect(Array.isArray(session.ignoreSuggestions)).toBe(true);
  });

  it("session defaults memory fields when no memory dir", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const session = state.sessionList[0];
    expect(session.memoryFileCount).toBe(0);
    expect(session.memoryTotalBytes).toBe(0);
    expect(session.memoryRecentFiles).toHaveLength(0);
  });
});
