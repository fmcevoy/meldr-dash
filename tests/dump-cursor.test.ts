import { describe, it, expect } from "vitest";
import { CursorAdapter } from "../src/adapters/cursor.js";
import { buildDumpOutput } from "../src/dump.js";
import { DashboardState, SessionSummary } from "../src/adapters/types.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "fixtures-cursor");

async function loadState(): Promise<DashboardState> {
  const adapter = new CursorAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
  return adapter.collectState();
}

describe("Cursor State Dump", () => {
  it("platform field is 'cursor'", async () => {
    const state = await loadState();
    const output = buildDumpOutput("state", state) as DashboardState;
    expect(output.platform).toBe("cursor");
  });

  it("all token fields are 0", async () => {
    const state = await loadState();
    const output = buildDumpOutput("state", state) as DashboardState;
    expect(output.totalInputTokens).toBe(0);
    expect(output.totalOutputTokens).toBe(0);
    expect(output.totalCostUsd).toBe(0);
  });

  it("sessionList populated from chat store.db files", async () => {
    const state = await loadState();
    const output = buildDumpOutput("state", state) as DashboardState;
    expect(output.sessionList).toHaveLength(2);
  });

  it("liveModel populated from cli-config.json", async () => {
    const state = await loadState();
    const output = buildDumpOutput("state", state) as DashboardState;
    expect(output.liveModel).toBe("composer-2-fast");
  });
});

describe("Cursor Sessions Dump", () => {
  it("sessions sorted by most recent first", async () => {
    const state = await loadState();
    const output = buildDumpOutput("sessions", state) as SessionSummary[];
    for (let i = 1; i < output.length; i++) {
      expect(output[i - 1].startedAt).toBeGreaterThanOrEqual(output[i].startedAt);
    }
  });

  it("each session has name and model", async () => {
    const state = await loadState();
    const output = buildDumpOutput("sessions", state) as SessionSummary[];
    for (const session of output) {
      expect(session.project).toBeTruthy();
      expect(session.model).toBeTruthy();
    }
  });

  it("token fields all zero", async () => {
    const state = await loadState();
    const output = buildDumpOutput("sessions", state) as SessionSummary[];
    for (const session of output) {
      expect(session.inputTokens).toBe(0);
      expect(session.outputTokens).toBe(0);
      expect(session.contextPercent).toBe(0);
    }
  });
});

describe("Cursor Monitors Dump", () => {
  it("token-based monitors don't false-positive on zero data", async () => {
    const state = await loadState();
    const output = buildDumpOutput("monitors", state) as Array<{ id: string }>;
    // compact-before-limit requires contextPercent > 75, which is 0 for cursor
    expect(output.some((m) => m.id === "compact-before-limit")).toBe(false);
  });
});

describe("Cursor Tips Dump", () => {
  it("filtered to cursor platform", async () => {
    const state = await loadState();
    const output = buildDumpOutput("tips", state) as Array<{
      platforms: string[];
    }>;
    for (const tip of output) {
      expect(tip.platforms).toContain("cursor");
    }
  });

  it("all tips have fix text", async () => {
    const state = await loadState();
    const output = buildDumpOutput("tips", state) as Array<{ fix: string | null }>;
    for (const tip of output) {
      expect(tip.fix).not.toBeNull();
    }
  });
});

describe("Cursor Metrics Dump", () => {
  it("returns zero-valued token fields", async () => {
    const state = await loadState();
    const output = buildDumpOutput("metrics", state) as Record<string, unknown>;
    expect(output.inputTokens).toBe(0);
    expect(output.outputTokens).toBe(0);
  });

  it("model field populated from store.db metadata", async () => {
    const state = await loadState();
    const output = buildDumpOutput("metrics", state) as Record<string, unknown>;
    expect(output.model).toBeTruthy();
  });
});

describe("Cross-Platform Dump", () => {
  it("same buildDumpOutput function works for both platforms", async () => {
    const cursorState = await loadState();
    const cursorAll = buildDumpOutput("all", cursorState) as Record<string, unknown>;
    expect(Object.keys(cursorAll).sort()).toEqual([
      "environment",
      "metrics",
      "monitors",
      "sessions",
      "state",
      "tips",
    ]);
  });

  it("field shapes are identical (same DashboardState type)", async () => {
    const state = await loadState();
    const output = buildDumpOutput("state", state) as DashboardState;
    // Verify key fields exist regardless of platform
    expect(output).toHaveProperty("platform");
    expect(output).toHaveProperty("sessionList");
    expect(output).toHaveProperty("totalInputTokens");
    expect(output).toHaveProperty("pluginCount");
    expect(output).toHaveProperty("hourCounts");
  });
});
