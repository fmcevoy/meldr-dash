#!/usr/bin/env node
/**
 * Creates a test state_5.sqlite for Codex adapter tests.
 * Run once: node tests/fixtures-codex/create-state-db.mjs
 */
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "state_5.sqlite");

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS threads (
    id TEXT PRIMARY KEY,
    tokens_used INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT 0,
    title TEXT
  )
`);

const insert = db.prepare("INSERT INTO threads (id, tokens_used, created_at, title) VALUES (?, ?, ?, ?)");
insert.run("thread-001", 50000, 1775420000000, "Fix login bug");
insert.run("thread-002", 20000, 1775410000000, "Refactor auth");

db.close();
console.log("Created", dbPath);
