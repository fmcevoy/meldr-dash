# Plan: Add Cursor Support

## Goal

Add Cursor Agent CLI as a second platform alongside Claude Code. Users can cycle between platforms (`c` key) and then cycle sessions within each platform (`s`/`Tab`).

## Background

### What Cursor stores locally (`~/.cursor/`)

| Data | Location | Format |
|------|----------|--------|
| Auth, model, permissions | `cli-config.json` | JSON |
| Conversation metadata | `ai-tracking/ai-code-tracking.db` | SQLite |
| Chat sessions | `chats/{workspace}/{conv-id}/store.db` | SQLite (blobs + meta) |
| Project workspaces | `projects/{cwd-key}/repo.json` | JSON |
| Rules | `.cursor/rules/*.mdc` | Markdown |
| Ignore | `.cursorignore` | gitignore syntax |
| Hooks | `.cursor/hooks.json` | JSON |
| Skills | `.cursor/skills/` | Files |
| Plugins | managed via `/plugins` | — |

### Key difference from Claude Code

**Cursor does NOT expose token usage locally.** No equivalent to `stats-cache.json`, no per-session JSONL with `input_tokens`/`output_tokens`. Token metrics live server-side only.

What IS available locally:
- Conversation count, titles, timestamps, model used
- Code attribution (AI vs human lines per commit)
- Active workspace/project info
- Configuration (model, hooks, rules file sizes)

### Implications for DashboardState

Many `DashboardState` fields will be 0/null for Cursor:
- `totalInputTokens`, `totalOutputTokens`, `totalCacheReadTokens` — unavailable
- `totalCostUsd` — unavailable
- `contextPercent`, `contextHistory` — unavailable
- `cacheReadTokens`, `cacheCreateTokens` — unavailable

What Cursor CAN populate:
- `sessionList` — from chat store.db files (conversation id, title, model, timestamps)
- `activeSessions` — from workspace presence
- `sessionAgeMs`, `timeSinceLastMessageMs` — from conversation timestamps
- `pluginCount` — from cli-config or /plugins
- `hookCount` — from `.cursor/hooks.json`
- `claudeMdLines` → generalize to `rulesLines` (count lines across `.cursor/rules/*.mdc`)
- `hasIgnoreFile` — check for `.cursorignore`
- `mcpServerCount` — from MCP config in projects/

## Architecture

### Multi-platform state model

```
App
├── PlatformCycle hook (c key cycles: claude → cursor → claude)
│   └── activePlatform: "claude" | "cursor"
├── Per-platform adapter + state
│   ├── claudeAdapter → claudeState (DashboardState)
│   └── cursorAdapter → cursorState (DashboardState)
├── activeState = states[activePlatform]
└── All panels receive activeState (no panel changes needed)
```

The key insight: since both adapters produce `DashboardState`, all panels work unchanged. The only UI change is a platform indicator and the `c` keybinding.

### New/modified files

| File | Change |
|------|--------|
| `src/adapters/cursor.ts` | **New.** `CursorAdapter` implementing `CLIAdapter` |
| `src/adapters/cursor-chat-db.ts` | **New.** SQLite reader for `chats/*/store.db` and `ai-tracking/ai-code-tracking.db` |
| `src/adapters/types.ts` | Generalize `claudeMdLines` → `rulesLines`. Add `platform: string` to `DashboardState` |
| `src/hooks/use-platform-cycle.ts` | **New.** Hook managing active platform, cycling with `c` |
| `src/hooks/use-dashboard.ts` | Accept adapter as prop (already does), no change needed |
| `src/app.tsx` | Add platform cycle, instantiate both adapters, switch active state |
| `src/panels/status-bar.tsx` | Show active platform name |
| `src/tips/database.ts` | Platform-filter tips (some are Claude-only, some Cursor-only) |
| `package.json` | Add `better-sqlite3` dependency for reading Cursor's SQLite files |

### CursorAdapter implementation

```typescript
class CursorAdapter implements CLIAdapter {
  readonly name = "cursor";
  readonly displayName = "Cursor";
  readonly dataDir = "~/.cursor";
  readonly rulesFile = ".cursor/rules/";

  async collectState(): Promise<DashboardState> {
    const state = emptyState();
    state.platform = "cursor";
    
    await Promise.all([
      this.readSessions(state),      // from chats/*/store.db
      this.readConfig(state),         // from cli-config.json
      this.readEnvironment(state),    // hooks, rules, ignore, MCP
    ]);
    
    return state;
  }
}
```

#### Session discovery

1. Scan `~/.cursor/chats/` for workspace dirs
2. For each workspace, scan for `{conv-id}/store.db`
3. Read `meta` table → decode hex JSON → extract `agentId`, `name`, `createdAt`, `lastUsedModel`
4. Build `SessionSummary` with available fields (tokens will be 0)

#### Rules counting

Instead of one `CLAUDE.md`, Cursor has multiple `.mdc` files in `.cursor/rules/`. Sum all lines across all `.mdc` files in the project's `.cursor/rules/` directory.

### Platform cycling UX

```
[Claude ●] [Cursor ○]   ← platform indicator in status bar
                           c key toggles
```

When switching platforms:
- Session list updates to show that platform's sessions
- All panels refresh with that platform's DashboardState
- Session cycle (s/Tab) operates within the active platform
- Monitor conditions evaluate against the active platform's state

### Tips platform filtering

Tips already have a `platforms` field (`["claude", "codex", "cursor", "gemini"]`). The evaluator should filter:
- Only show tips whose `platforms` array includes the active platform
- Monitors that check Claude-specific data (e.g., `contextPercent > 75`) naturally return false for Cursor since those fields are 0

The evaluator needs the platform name passed in.

### What Cursor panels will look like

Since token data is unavailable, several panels will show different content:

- **Token Metrics**: Show "Token data not available locally" + model name + conversation count
- **Cache Timer**: Show "N/A — cache managed internally" 
- **Monitors**: Fewer will fire (no context %, no cache TTL), but rules-lean, hooks, ignore, plugins still work
- **Environment**: Hooks from `.cursor/hooks.json`, rules from `.mdc` files, MCP servers
- **Sessions**: Conversation titles + model + age (no message count)

## Implementation Steps

### Step 1: Generalize types (small, safe)
- Rename `claudeMdLines` → `rulesLines` in `SessionSummary`
- Add `platform: string` to `DashboardState`
- Update Claude adapter and all references

### Step 2: Add SQLite dependency
- `npm install better-sqlite3 @types/better-sqlite3`
- Create `src/adapters/cursor-chat-db.ts` with typed readers for Cursor's SQLite schema

### Step 3: Implement CursorAdapter
- `src/adapters/cursor.ts`
- Read sessions from chat store.db files
- Read config from cli-config.json
- Read environment (hooks, rules, ignore, MCP)
- Populate DashboardState with available data, leave token fields at 0

### Step 4: Platform cycling hook + UI
- `src/hooks/use-platform-cycle.ts`
- Update `app.tsx` to manage multiple adapters
- Add `c` key binding
- Show platform indicator in status bar

### Step 5: Tips platform filtering
- Update evaluator to accept platform name
- Filter `allTips` and monitor conditions by platform
- Cursor-specific commands: `/compress` instead of `/compact`, `/usage` instead of `/cost`

### Step 6: Graceful degradation for unavailable data
- TokenMetrics: detect when token data is all zeros, show alternative view
- CacheTimer: detect platform, show appropriate message
- Any panel that would be empty: show helpful "not available on [platform]" message

## Testing Strategy

### Unit tests

| Test file | Coverage |
|-----------|----------|
| `tests/adapters/cursor-chat-db.test.ts` | SQLite parsing with fixture .db files |
| `tests/adapters/cursor.test.ts` | CursorAdapter.collectState() with fixture data dir |
| `tests/hooks/use-platform-cycle.test.tsx` | Platform cycling, active platform state |
| `tests/tips/evaluator.test.ts` | Platform filtering (existing + new tests) |
| `tests/panels/panels.test.tsx` | Panel rendering with Cursor state (zero tokens) |

### Fixture data

Create `tests/fixtures-cursor/` mirroring `~/.cursor/` structure:
- `cli-config.json` — sample config
- `chats/{workspace}/{conv-id}/store.db` — SQLite with test data
- `ai-tracking/ai-code-tracking.db` — SQLite with test data  
- `.cursor/rules/general.mdc` — sample rules file
- `.cursor/hooks.json` — sample hooks

### Integration tests

| Test | What it verifies |
|------|-----------------|
| Platform switch preserves session selection | Switching from Claude→Cursor resets session index to 0 |
| Tips filter by platform | Claude-only tips don't appear when Cursor is active |
| Monitors evaluate correctly per platform | Cursor state with 0 tokens doesn't trigger token-based monitors |
| Panels render gracefully with missing data | TokenMetrics shows alternative view, CacheTimer shows N/A |
| Both adapters can run simultaneously | No shared mutable state between adapters |

### Edge cases to test

- Cursor not installed (`~/.cursor/` doesn't exist) → adapter returns empty state, no crash
- Cursor installed but no chats → empty session list
- SQLite files locked by running Cursor → graceful error handling
- Corrupt/empty store.db → skip, don't crash
- Mixed platform sessions (user has both Claude and Cursor running)

## Dependencies

- `better-sqlite3` — synchronous SQLite reader (needed for Cursor's .db files)
- No other new deps

## Risks

1. **SQLite schema may change** — Cursor is actively developed. Wrap all SQLite reads in try/catch, document expected schema.
2. **Token data truly unavailable** — Some users may find the Cursor dashboard less useful. Mitigate with clear messaging.
3. **Performance** — Reading multiple SQLite files on every poll. Mitigate by only reading metadata tables (small), not blob data.
4. **File locking** — Cursor may hold locks on its .db files. `better-sqlite3` with `readonly: true` flag avoids this.

## Out of scope

- Codex CLI support (separate plan)
- Gemini CLI support (separate plan)
- Server-side token fetching for Cursor (would need API auth)
- Cursor's VS Code extension data (only Agent CLI mode)
