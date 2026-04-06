/**
 * Reader for Codex CLI's SQLite state database (state_5.sqlite).
 * Uses readonly mode to avoid lock conflicts with running Codex.
 */
import Database from "better-sqlite3";

export interface CodexThread {
  threadId: string;
  tokensUsed: number;
  createdAt: number;
  title: string | null;
}

export interface CodexStateStats {
  threads: CodexThread[];
  totalTokensUsed: number;
}

/**
 * Read thread listing and aggregate token counts from Codex's state DB.
 */
export function readCodexState(dbPath: string): CodexStateStats {
  const defaults: CodexStateStats = { threads: [], totalTokensUsed: 0 };
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      // Check which columns exist for forward compatibility
      const columns = db.pragma("table_info(threads)") as Array<{ name: string }>;
      const colNames = new Set(columns.map((c) => c.name));

      if (!colNames.has("id")) return defaults;

      const hasTokens = colNames.has("tokens_used");
      const hasCreated = colNames.has("created_at");
      const hasTitle = colNames.has("title");

      const select = [
        "id",
        hasTokens ? "tokens_used" : "0 as tokens_used",
        hasCreated ? "created_at" : "0 as created_at",
        hasTitle ? "title" : "NULL as title",
      ].join(", ");

      const rows = db.prepare(`SELECT ${select} FROM threads ORDER BY created_at DESC`).all() as Array<{
        id: string;
        tokens_used: number;
        created_at: number;
        title: string | null;
      }>;

      let total = 0;
      const threads: CodexThread[] = rows.map((r) => {
        total += r.tokens_used;
        return {
          threadId: r.id,
          tokensUsed: r.tokens_used,
          createdAt: r.created_at,
          title: r.title,
        };
      });

      return { threads, totalTokensUsed: total };
    } finally {
      db.close();
    }
  } catch {
    return defaults;
  }
}
