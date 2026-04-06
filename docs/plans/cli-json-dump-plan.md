# Plan: CLI JSON Dump Mode

## Goal

Add `--dump <category>` flag to output each dashboard data category as JSON to stdout, then exit. No TUI rendering — pure data for scripting, testing, and debugging.

## Categories

| Category | What it dumps | Source |
|----------|--------------|--------|
| `state` | Full `DashboardState` object | adapter.collectState() |
| `sessions` | `sessionList` array (sorted by last active) | adapter → sessionList |
| `monitors` | Triggered monitor alerts for active session | evaluator → monitors |
| `tips` | All tips for active platform | evaluator → allTips |
| `metrics` | Token metrics for selected session | sessionList[selected] token fields |
| `environment` | Plugins, hooks, MCP, rules, ignore | state global + session cwd-dependent |
| `all` | Every category above in one object | all of the above |

## CLI Interface

```bash
# Dump full state
meldr-dash --dump state

# Dump monitors for a specific session
meldr-dash --dump monitors --session <id>

# Dump all categories as one object
meldr-dash --dump all

# Dump for Cursor platform
meldr-dash --dump state --platform cursor

# Pipe to jq for filtering
meldr-dash --dump sessions | jq '.[0].contextPercent'

# Save as test fixture
meldr-dash --dump state > tests/fixtures/live-snapshot.json
```

Output is always valid JSON to stdout. Errors go to stderr. Exit code 0 on success, 1 on error.

## Implementation

### Changes to `src/index.tsx`

Add `--dump` and `--platform` args to `parseArgs`. When `--dump` is present, skip `render()` entirely — just run the adapter, evaluate, and `console.log(JSON.stringify(...))`.

```typescript
if (opts.dump) {
  const adapter = opts.platform === "cursor" 
    ? new CursorAdapter({ dataDir: opts.dataDir })
    : new ClaudeAdapter({ dataDir: opts.dataDir, sessionId: opts.sessionId });
  const state = await adapter.collectState();
  const output = buildDumpOutput(opts.dump, state, opts.sessionId);
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}
```

### New file: `src/dump.ts`

Pure function that takes a category name and DashboardState, returns the JSON-serializable object. No React, no Ink — just data transformation.

```typescript
export function buildDumpOutput(
  category: string,
  state: DashboardState,
  selectedSessionId?: string,
): unknown { ... }
```

Categories:
- `state` → return state as-is (strip function fields)
- `sessions` → return state.sessionList sorted by last active
- `monitors` → run evaluate(), return monitors array
- `tips` → run evaluate(), return allTips array
- `metrics` → find selected session, return its token fields
- `environment` → extract global + per-session environment fields
- `all` → `{ state, sessions, monitors, tips, metrics, environment }`

### Testing value

**Snapshot tests**: Run `buildDumpOutput("state", fixtureState)` and compare against saved JSON. Catches any field changes, renamed properties, or missing data.

**Integration tests**: Use `buildDumpOutput` in test files to validate the full adapter → evaluator pipeline without Ink rendering:

```typescript
it("monitors include compact-before-limit at 80% context", () => {
  const state = buildStateFromFixtures();
  const output = buildDumpOutput("monitors", state) as Technique[];
  expect(output.some(m => m.id === "compact-before-limit")).toBe(true);
});
```

**CI pipeline**: Run `node dist/index.js --dump monitors` in CI to validate the data pipeline produces expected output against live-ish data.

## Test Suite Using Dump Outputs

The dump system enables a comprehensive test suite that validates the full data pipeline for both platforms. These tests use `buildDumpOutput()` against fixture data — no Ink, no terminal, pure data assertions.

### File: `tests/dump.test.ts` — Unit tests for buildDumpOutput

```
- each category returns valid JSON-serializable object
- "state" includes all DashboardState fields
- "sessions" returns sorted array
- "monitors" returns only triggered monitors
- "tips" returns platform-filtered tips
- "metrics" returns token fields for selected session
- "environment" returns global + session env data
- "all" contains every category key
- unknown category throws descriptive error
```

### File: `tests/dump-claude.test.ts` — Claude pipeline integration tests

Uses the existing `tests/fixtures/` data (stats-cache.json, sessions, JONLs) to run the full Claude adapter → dump pipeline. Validates real data flow, not mocks.

```
Claude State Dump:
- platform field is "claude"
- totalInputTokens > 0 (from stats-cache.json fixtures)
- totalCostUsd > 0
- sessionList has correct count (matches fixture session files)
- hourCounts populated from stats-cache

Claude Sessions Dump:
- sessions sorted by most recent first
- each session has model, contextPercent, contextHistory
- session with JSONL has non-zero token counts
- session without JSONL has zero tokens
- cross-session context propagation reflected (1M detection)

Claude Monitors Dump:
- keep-rules-lean fires when rulesLines > 200
- compact-before-limit fires at contextPercent > 75
- compact-before-limit suppressed after recent /compact
- right-model-for-job fires for opus
- enable-sounds fires (claude-only monitor)
- monitor list sorted by impact (High before Medium)

Claude Tips Dump:
- all tips have fix text (no null fixes)
- tips filtered to claude platform (includes claude-only like use-btw)
- tip count matches expected for claude platform

Claude Metrics Dump (per session):
- selected session returns its own token breakdown
- inputTokens, outputTokens, cacheReadTokens populated
- contextPercent and contextWindow reflect auto-detection
- lastCompactMs and lastCostCheckMs from JSONL parsing

Claude Environment Dump:
- pluginCount from settings.json
- hookCount from settings.json
- rulesLines from CLAUDE.md line count
- mcpServerCount from mcp.json
- hasIgnoreFile reflects .claudeignore presence
```

### File: `tests/dump-cursor.test.ts` — Cursor pipeline integration tests

Uses `tests/fixtures-cursor/` (SQLite DBs, cli-config.json) for the full Cursor adapter → dump pipeline.

```
Cursor State Dump:
- platform field is "cursor"
- all token fields are 0 (not available locally)
- totalCostUsd is 0
- liveModel populated from cli-config.json
- sessionList populated from chat store.db files

Cursor Sessions Dump:
- sessions from SQLite chat metadata
- each session has name (conversation title), model, createdAt
- sorted by most recent first
- token fields all zero
- contextPercent and contextHistory empty

Cursor Monitors Dump:
- claude-only monitors excluded (enable-sounds absent)
- automate-hooks fires when hookCount is 0
- manage-plugins fires when pluginCount > 5
- token-based monitors (compact-before-limit, cache-ttl) don't false-positive
  (their conditions check token data which is 0 for Cursor)

Cursor Tips Dump:
- filtered to cursor platform
- excludes claude-only tips (use-btw absent)
- includes allPlatforms tips (surgical-file-refs present)
- all tips have fix text

Cursor Metrics Dump:
- returns zero-valued token fields
- model field populated from store.db metadata
- contextWindow is 0 (unknown for Cursor)

Cursor Environment Dump:
- hookCount from .cursor/hooks.json
- rulesLines from .cursor/rules/*.mdc files
- hasIgnoreFile from .cursorignore presence
- mcpServerCount from project MCP config

Cross-Platform Dump:
- same buildDumpOutput function works for both platforms
- switching platform changes which tips/monitors appear
- "all" dump for Claude has token data, "all" for Cursor doesn't
- field shapes are identical (same DashboardState type)
```

### Why per-platform test files

Separate files (`dump-claude.test.ts`, `dump-cursor.test.ts`) rather than one big file because:
1. Each uses different fixtures (JSON/JSONL vs SQLite)
2. Failures are immediately attributable to a platform
3. Can run one platform's tests in isolation: `vitest run tests/dump-claude.test.ts`
4. Easy to add more platforms later (dump-codex.test.ts, dump-gemini.test.ts)

## File Changes

| File | Change |
|------|--------|
| `src/dump.ts` | **New.** `buildDumpOutput()` — pure data extraction per category |
| `src/index.tsx` | Add `--dump` and `--platform` args, skip render when dump mode |
| `tests/dump.test.ts` | **New.** Unit tests for each category dump |
| `tests/dump-claude.test.ts` | **New.** Claude full-pipeline integration tests using fixtures |
| `tests/dump-cursor.test.ts` | **New.** Cursor full-pipeline integration tests using fixtures |

## Steps

1. Create `src/dump.ts` with `buildDumpOutput()`
2. Update `src/index.tsx` to handle `--dump` and `--platform` flags
3. Write `tests/dump.test.ts` — unit tests for all categories
4. Write `tests/dump-claude.test.ts` — Claude pipeline integration tests
5. Write `tests/dump-cursor.test.ts` — Cursor pipeline integration tests
6. Update `--help` output with dump documentation

## Not in scope

- Streaming/watch mode for dumps (could add `--dump state --watch` later)
- Custom JSON formatting options
- Output formats other than JSON (CSV, YAML)
