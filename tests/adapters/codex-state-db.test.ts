import { describe, it, expect } from "vitest";
import { readCodexState } from "../../src/adapters/codex-state-db.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "..", "fixtures-codex");

describe("readCodexState", () => {
  it("reads threads from state DB", () => {
    const dbPath = path.join(fixtureDir, "state_5.sqlite");
    const stats = readCodexState(dbPath);
    expect(stats.threads).toHaveLength(2);
    expect(stats.totalTokensUsed).toBe(70000);
  });

  it("threads are ordered by created_at descending", () => {
    const dbPath = path.join(fixtureDir, "state_5.sqlite");
    const stats = readCodexState(dbPath);
    expect(stats.threads[0].threadId).toBe("thread-001");
    expect(stats.threads[0].tokensUsed).toBe(50000);
    expect(stats.threads[0].title).toBe("Fix login bug");
    expect(stats.threads[1].threadId).toBe("thread-002");
  });

  it("returns empty for missing DB", () => {
    const stats = readCodexState("/tmp/nonexistent.sqlite");
    expect(stats.threads).toHaveLength(0);
    expect(stats.totalTokensUsed).toBe(0);
  });
});
