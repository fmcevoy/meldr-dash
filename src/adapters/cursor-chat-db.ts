/**
 * Readers for Cursor's local SQLite databases.
 * All reads use readonly mode to avoid lock conflicts with running Cursor.
 */
import Database from "better-sqlite3";

export interface CursorConversation {
  conversationId: string;
  name: string;
  model: string | null;
  mode: string | null;
  createdAt: number;  // epoch ms
}

/**
 * Read conversation metadata from a Cursor chat store.db file.
 * Schema: meta table with hex-encoded JSON values.
 */
export function readChatStoreMeta(dbPath: string): CursorConversation | null {
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      // Cursor uses key '0' in production, some versions used 'meta'
      const row = db.prepare("SELECT value FROM meta WHERE key IN ('0', 'meta') LIMIT 1").get() as { value: string } | undefined;
      if (!row?.value) return null;

      // Meta values are hex-encoded JSON
      const json = Buffer.from(row.value, "hex").toString("utf-8");
      const meta = JSON.parse(json);

      return {
        conversationId: meta.agentId ?? "",
        name: meta.name ?? "Untitled",
        model: meta.lastUsedModel ?? null,
        mode: meta.mode ?? null,
        createdAt: meta.createdAt ?? 0,
      };
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export interface CursorTrackingStats {
  conversationCount: number;
  trackedCommitCount: number;
  trackingStartTime: number;  // epoch ms
}

/**
 * Read aggregate stats from Cursor's ai-code-tracking.db.
 */
export interface ScoredCommitStats {
  commitCount: number;
  aiLinesAdded: number;
  humanLinesAdded: number;
  aiPercentage: number;
}

/**
 * Read AI vs human line attribution from scored_commits.
 */
export function readScoredCommitStats(dbPath: string): ScoredCommitStats {
  const defaults: ScoredCommitStats = { commitCount: 0, aiLinesAdded: 0, humanLinesAdded: 0, aiPercentage: 0 };
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const row = db.prepare(
        "SELECT COUNT(*) as cnt, COALESCE(SUM(composerLinesAdded),0) as ai, COALESCE(SUM(humanLinesAdded),0) as human FROM scored_commits",
      ).get() as { cnt: number; ai: number; human: number } | undefined;
      if (!row || row.cnt === 0) return defaults;
      const total = row.ai + row.human;
      return {
        commitCount: row.cnt,
        aiLinesAdded: row.ai,
        humanLinesAdded: row.human,
        aiPercentage: total > 0 ? Math.round((row.ai / total) * 100) : 0,
      };
    } finally {
      db.close();
    }
  } catch {
    return defaults;
  }
}

export function readTrackingStats(dbPath: string): CursorTrackingStats {
  const defaults: CursorTrackingStats = { conversationCount: 0, trackedCommitCount: 0, trackingStartTime: 0 };
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const convRow = db.prepare("SELECT COUNT(*) as count FROM conversation_summaries").get() as { count: number } | undefined;
      const commitRow = db.prepare("SELECT COUNT(*) as count FROM scored_commits").get() as { count: number } | undefined;
      const stateRow = db.prepare("SELECT value FROM tracking_state WHERE key = 'trackingStartTime'").get() as { value: string } | undefined;

      return {
        conversationCount: convRow?.count ?? 0,
        trackedCommitCount: commitRow?.count ?? 0,
        trackingStartTime: stateRow?.value ? Number(stateRow.value) : 0,
      };
    } finally {
      db.close();
    }
  } catch {
    return defaults;
  }
}
