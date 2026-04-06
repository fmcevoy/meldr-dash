import { describe, it, expect } from "vitest";
import { GeminiAdapter } from "../../src/adapters/gemini.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "..", "fixtures-gemini");

describe("GeminiAdapter", () => {
  it("sets platform to gemini", async () => {
    const adapter = new GeminiAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.platform).toBe("gemini");
  });

  it("discovers sessions from session JSON files", async () => {
    const adapter = new GeminiAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.sessionList).toHaveLength(2);
    expect(state.activeSessions).toBe(2);
  });

  it("most recent session is selected", async () => {
    const adapter = new GeminiAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const selected = state.sessionList.find((s) => s.isSelected);
    expect(selected).toBeDefined();
    expect(selected!.sessionId).toBe("session-001");
  });

  it("aggregates token metrics across all sessions", async () => {
    const adapter = new GeminiAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    // session-001: 25000 input, 12000 output, 9000 cached
    // session-002: 3000 input, 2000 output, 1000 cached
    expect(state.totalInputTokens).toBe(28000);
    expect(state.totalOutputTokens).toBe(14000);
    expect(state.totalCacheReadTokens).toBe(10000);
  });

  it("session has correct per-session metrics", async () => {
    const adapter = new GeminiAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const s1 = state.sessionList.find((s) => s.sessionId === "session-001");
    expect(s1!.messageCount).toBe(3);
    expect(s1!.model).toBe("gemini-2.5-pro");
    expect(s1!.inputTokens).toBe(25000);
    expect(s1!.contextHistory.length).toBeGreaterThan(0);

    const s2 = state.sessionList.find((s) => s.sessionId === "session-002");
    expect(s2!.messageCount).toBe(1);
    expect(s2!.model).toBe("gemini-2.5-flash");
  });

  it("reads settings for MCP server count", async () => {
    const adapter = new GeminiAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const session = state.sessionList[0];
    expect(session.mcpServerCount).toBe(3);
    expect(session.mcpServersEnabled).toBe(2);
  });

  it("reads GEMINI.md for rules lines", async () => {
    const adapter = new GeminiAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const session = state.sessionList[0];
    expect(session.rulesLines).toBeGreaterThan(0);
  });

  it("reads live model from settings", async () => {
    const adapter = new GeminiAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    expect(state.liveModel).toBe("gemini-2.5-pro");
  });

  it("handles missing data dir gracefully", async () => {
    const adapter = new GeminiAdapter({ dataDir: "/tmp/nonexistent-gemini-dir", cwd: "/tmp" });
    const state = await adapter.collectState();
    expect(state.platform).toBe("gemini");
    expect(state.sessionList).toHaveLength(0);
    expect(state.activeSessions).toBe(0);
  });

  it("returns correct watch and poll paths", () => {
    const adapter = new GeminiAdapter({ dataDir: fixtureDir, cwd: "/test/project" });
    const watch = adapter.getWatchPaths();
    expect(watch.some((p) => p.includes("tmp"))).toBe(true);
    const poll = adapter.getPollPaths();
    expect(poll.some((p) => p.includes("settings.json"))).toBe(true);
    expect(poll.some((p) => p.includes("GEMINI.md"))).toBe(true);
    expect(poll.some((p) => p.includes(".geminiignore"))).toBe(true);
  });

  it("session uses .geminiignore as ignore file name", async () => {
    const adapter = new GeminiAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();
    const session = state.sessionList[0];
    expect(session.ignoreFileName).toBe(".geminiignore");
  });
});
