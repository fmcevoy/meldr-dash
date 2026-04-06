import { describe, it, expect } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import { readChatStoreMeta, readTrackingStats } from "../../src/adapters/cursor-chat-db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "..", "fixtures-cursor");

describe("readChatStoreMeta", () => {
  it("reads conversation metadata from store.db", () => {
    const dbPath = path.join(fixtureDir, "chats", "workspace-1", "conv-001", "store.db");
    const meta = readChatStoreMeta(dbPath);
    expect(meta).not.toBeNull();
    expect(meta!.conversationId).toBe("conv-001-uuid");
    expect(meta!.name).toBe("Fix Auth Bug");
    expect(meta!.model).toBe("composer-2-fast");
    expect(meta!.mode).toBe("agent");
    expect(meta!.createdAt).toBe(1775420000000);
  });

  it("reads second conversation", () => {
    const dbPath = path.join(fixtureDir, "chats", "workspace-1", "conv-002", "store.db");
    const meta = readChatStoreMeta(dbPath);
    expect(meta).not.toBeNull();
    expect(meta!.name).toBe("Add Tests");
    expect(meta!.model).toBe("claude-sonnet-4-6");
  });

  it("returns null for non-existent file", () => {
    const meta = readChatStoreMeta("/tmp/does-not-exist.db");
    expect(meta).toBeNull();
  });
});

describe("readTrackingStats", () => {
  it("reads tracking database stats", () => {
    const dbPath = path.join(fixtureDir, "ai-tracking", "ai-code-tracking.db");
    const stats = readTrackingStats(dbPath);
    expect(stats.conversationCount).toBe(1);
    expect(stats.trackingStartTime).toBe(1775400000000);
  });

  it("returns defaults for non-existent file", () => {
    const stats = readTrackingStats("/tmp/does-not-exist.db");
    expect(stats.conversationCount).toBe(0);
    expect(stats.trackingStartTime).toBe(0);
  });
});
