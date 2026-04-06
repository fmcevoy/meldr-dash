import { describe, it, expect } from "vitest";
import { ClaudeAdapter } from "../src/adapters/claude.js";
import { buildDumpOutput } from "../src/dump.js";
import { DashboardState, SessionSummary } from "../src/adapters/types.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "fixtures");

async function loadState(): Promise<DashboardState> {
  const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
  return adapter.collectState();
}

describe("Claude State Dump", () => {
  it("platform field is 'claude'", async () => {
    const state = await loadState();
    const output = buildDumpOutput("state", state) as DashboardState;
    expect(output.platform).toBe("claude");
  });

  it("totalInputTokens > 0 from stats-cache.json", async () => {
    const state = await loadState();
    const output = buildDumpOutput("state", state) as DashboardState;
    expect(output.totalInputTokens).toBe(500000);
  });

  it("totalCostUsd > 0", async () => {
    const state = await loadState();
    const output = buildDumpOutput("state", state) as DashboardState;
    expect(output.totalCostUsd).toBe(12.5);
  });

  it("sessionList has correct count from fixture session files", async () => {
    const state = await loadState();
    const output = buildDumpOutput("state", state) as DashboardState;
    expect(output.sessionList).toHaveLength(3);
  });

  it("hourCounts populated from stats-cache", async () => {
    const state = await loadState();
    const output = buildDumpOutput("state", state) as DashboardState;
    expect(output.hourCounts).toHaveProperty("10");
    expect(output.peakHours.length).toBeGreaterThan(0);
  });
});

describe("Claude Sessions Dump", () => {
  it("sessions sorted by most recent first", async () => {
    const state = await loadState();
    const output = buildDumpOutput("sessions", state) as SessionSummary[];
    for (let i = 1; i < output.length; i++) {
      expect(output[i - 1].startedAt).toBeGreaterThanOrEqual(output[i].startedAt);
    }
  });

  it("each session has model and contextPercent fields", async () => {
    const state = await loadState();
    const output = buildDumpOutput("sessions", state) as SessionSummary[];
    for (const session of output) {
      expect(session).toHaveProperty("model");
      expect(session).toHaveProperty("contextPercent");
      expect(session).toHaveProperty("contextHistory");
    }
  });
});

describe("Claude Monitors Dump", () => {
  it("monitor list sorted by impact (High before Medium)", async () => {
    const state = await loadState();
    const output = buildDumpOutput("monitors", state) as Array<{
      id: string;
      impact: string;
    }>;
    const firstMediumIdx = output.findIndex((m) => m.impact === "Medium");
    const lastHighIdx = output.reduce(
      (acc, m, i) => (m.impact === "High" ? i : acc),
      -1,
    );
    if (firstMediumIdx !== -1 && lastHighIdx !== -1) {
      expect(lastHighIdx).toBeLessThan(firstMediumIdx);
    }
  });
});

describe("Claude Tips Dump", () => {
  it("all tips have fix text", async () => {
    const state = await loadState();
    const output = buildDumpOutput("tips", state) as Array<{
      fix: string | null;
    }>;
    for (const tip of output) {
      expect(tip.fix).not.toBeNull();
    }
  });

  it("tips filtered to claude platform", async () => {
    const state = await loadState();
    const output = buildDumpOutput("tips", state) as Array<{
      platforms: string[];
    }>;
    for (const tip of output) {
      expect(tip.platforms).toContain("claude");
    }
  });
});

describe("Claude Metrics Dump", () => {
  it("selected session returns its own token breakdown", async () => {
    const state = await loadState();
    const output = buildDumpOutput("metrics", state) as Record<string, unknown>;
    expect(output.sessionId).toBeDefined();
    expect(typeof output.inputTokens).toBe("number");
    expect(typeof output.outputTokens).toBe("number");
    expect(typeof output.contextPercent).toBe("number");
    expect(typeof output.contextWindow).toBe("number");
  });
});

describe("Claude Environment Dump", () => {
  it("pluginCount from settings.json", async () => {
    const state = await loadState();
    const output = buildDumpOutput("environment", state) as Record<string, unknown>;
    expect(output.pluginCount).toBe(3);
  });

  it("mcpServerCount from mcp.json", async () => {
    const state = await loadState();
    const output = buildDumpOutput("environment", state) as Record<string, unknown>;
    expect(output.mcpServerCount).toBe(3);
  });
});
