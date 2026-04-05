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
    expect(state.activeSessions).toBe(1);
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

  it("reads MCP config for server count", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.mcpServerCount).toBe(3);
    expect(state.mcpServersEnabled).toBe(2);
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
});
