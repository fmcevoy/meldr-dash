/**
 * Script to create SQLite fixture databases for Cursor adapter tests.
 * Run once: node tests/fixtures-cursor/create-fixtures.mjs
 */
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Chat store.db for conv-001 ───────────────────────────
{
  const dbPath = path.join(__dirname, "chats", "workspace-1", "conv-001", "store.db");
  const db = new Database(dbPath);
  db.prepare("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)").run();
  db.prepare("CREATE TABLE IF NOT EXISTS blobs (id TEXT PRIMARY KEY, data BLOB)").run();

  const meta = {
    agentId: "conv-001-uuid",
    name: "Fix Auth Bug",
    mode: "agent",
    createdAt: 1775420000000,
    lastUsedModel: "composer-2-fast",
    latestRootBlobId: "blob-1",
  };
  const hex = Buffer.from(JSON.stringify(meta), "utf-8").toString("hex");
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("meta", hex);
  db.close();
  console.log("Created conv-001/store.db");
}

// ── Chat store.db for conv-002 ───────────────────────────
{
  const dbPath = path.join(__dirname, "chats", "workspace-1", "conv-002", "store.db");
  const db = new Database(dbPath);
  db.prepare("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)").run();
  db.prepare("CREATE TABLE IF NOT EXISTS blobs (id TEXT PRIMARY KEY, data BLOB)").run();

  const meta = {
    agentId: "conv-002-uuid",
    name: "Add Tests",
    mode: "plan",
    createdAt: 1775410000000,
    lastUsedModel: "claude-sonnet-4-6",
    latestRootBlobId: "blob-2",
  };
  const hex = Buffer.from(JSON.stringify(meta), "utf-8").toString("hex");
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run("meta", hex);
  db.close();
  console.log("Created conv-002/store.db");
}

// ── ai-code-tracking.db ──────────────────────────────────
{
  const dbPath = path.join(__dirname, "ai-tracking", "ai-code-tracking.db");
  const db = new Database(dbPath);
  db.prepare("CREATE TABLE IF NOT EXISTS conversation_summaries (conversationId TEXT PRIMARY KEY, title TEXT, tldr TEXT, overview TEXT, summaryBullets TEXT, model TEXT, mode TEXT, updatedAt TEXT)").run();
  db.prepare("CREATE TABLE IF NOT EXISTS scored_commits (commitHash TEXT NOT NULL, branchName TEXT NOT NULL, linesAdded INTEGER, linesDeleted INTEGER, composerLinesAdded INTEGER, composerLinesDeleted INTEGER, humanLinesAdded INTEGER, humanLinesDeleted INTEGER, PRIMARY KEY (commitHash, branchName))").run();
  db.prepare("CREATE TABLE IF NOT EXISTS tracking_state (key TEXT PRIMARY KEY, value TEXT)").run();

  db.prepare("INSERT OR REPLACE INTO conversation_summaries (conversationId, title, model, mode) VALUES (?, ?, ?, ?)").run("conv-001", "Fix Auth Bug", "composer-2-fast", "agent");
  db.prepare("INSERT OR REPLACE INTO scored_commits (commitHash, branchName, linesAdded, linesDeleted, composerLinesAdded, composerLinesDeleted, humanLinesAdded, humanLinesDeleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("abc123", "main", 100, 20, 70, 10, 30, 10);
  db.prepare("INSERT OR REPLACE INTO scored_commits (commitHash, branchName, linesAdded, linesDeleted, composerLinesAdded, composerLinesDeleted, humanLinesAdded, humanLinesDeleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run("def456", "main", 50, 5, 30, 3, 20, 2);
  db.prepare("INSERT OR REPLACE INTO tracking_state (key, value) VALUES (?, ?)").run("trackingStartTime", "1775400000000");
  db.close();
  console.log("Created ai-code-tracking.db");
}

console.log("All fixtures created.");
