# meldr-dash: TUI Token Savings Dashboard

## Context

AI coding CLIs (Claude Code, Codex CLI, Cursor, Gemini CLI) burn tokens every turn — context is re-read, rules files are re-ingested, MCP schemas are re-injected. There are 30 documented techniques for reducing token waste (see [token-saving-techniques.vercel.app](https://token-saving-techniques.vercel.app/)), but remembering to apply them mid-flow is hard.

meldr-dash is a passive TUI dashboard that sits in a tmux pane alongside your coding CLI. It monitors token usage in real-time, evaluates which saving techniques are relevant to your current state, and surfaces actionable alerts. Claude Code is the first target; the adapter pattern supports extending to other CLIs.

An earlier POC exists in `../playarea` using blessed/blessed-contrib. This spec supersedes it, adopting Ink (React for terminals) as the TUI framework — the same library Claude Code itself uses.

---

## Architecture: Widget Composition

Each panel is a self-contained Ink/React component that subscribes to its own data slice via hooks. The root `app.tsx` handles layout composition only. Panels don't know about each other.

### Project Structure

```
meldr-dash/
├── src/
│   ├── app.tsx                # Root layout, composes panels
│   ├── index.tsx              # Entry point, CLI args, screen setup
│   ├── adapters/              # CLI-specific data readers
│   │   ├── types.ts           # Shared CLIAdapter interface
│   │   └── claude.ts          # Claude Code adapter (~/.claude/)
│   ├── hooks/                 # React hooks for data subscriptions
│   │   ├── use-adapter.ts     # Binds active adapter, exposes data
│   │   ├── use-metrics.ts     # Token/cost metrics from adapter
│   │   ├── use-session.ts     # Active session state
│   │   ├── use-environment.ts # Settings, MCP, CLAUDE.md
│   │   └── use-tips.ts        # Evaluated tips for current state
│   ├── panels/                # Independent Ink components
│   │   ├── token-metrics.tsx  # Token counts, cost, context bar
│   │   ├── session-info.tsx   # Session age, turns, model
│   │   ├── active-alerts.tsx  # Triggered techniques (urgent)
│   │   ├── recommendations.tsx# Non-triggered techniques (rotating)
│   │   ├── environment.tsx    # MCP, plugins, rules file stats
│   │   ├── history.tsx        # Recent prompts with timestamps
│   │   └── status-bar.tsx     # Clock, watch path, keybindings
│   ├── tips/                  # Technique engine
│   │   ├── database.ts        # 30 techniques from web app
│   │   ├── evaluator.ts       # Conditional activation logic
│   │   └── formatter.ts       # Impact bars, category icons
│   ├── watcher.ts             # Hybrid chokidar + polling
│   └── theme.ts               # Colors, spacing constants
├── package.json
├── tsconfig.json
└── README.md
```

### Data Flow

```
CLIAdapter (claude.ts)
    |
Watcher (chokidar for hot files + 15s poll for cold files)
    |
    v
Hooks (use-metrics, use-session, use-environment, use-tips)
    |
    v
Panels (each subscribes to the hooks it needs)
    |
    v
Ink render
```

---

## Adapter Interface

Every CLI implements this contract. The dashboard core is CLI-agnostic.

```ts
interface CLIAdapter {
  readonly name: string           // "claude" | "codex" | "cursor" | "gemini"
  readonly displayName: string    // "Claude Code"
  readonly dataDir: string        // ~/.claude
  readonly rulesFile: string      // CLAUDE.md | AGENTS.md | GEMINI.md

  collectState(): DashboardState
  getWatchPaths(): string[]       // hot files -> chokidar
  getPollPaths(): string[]        // cold files -> interval
  getTechniqueOverrides(): Map<string, TechniqueConfig>
}
```

### Claude Code Adapter — Data Sources

**Two tiers of data** based on what Claude Code actually writes to disk:

**Tier 1: Aggregate metrics** (`stats-cache.json`) — cumulative totals, not per-session live data:
- `dailyModelTokens[]`: per-model token counts by date (input, output, cacheRead, cacheCreation)
- `modelUsage`: cumulative per-model stats (inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens, costUSD, contextWindow, maxOutputTokens)
- `dailyActivity[]`: messageCount, sessionCount, toolCallCount per day
- `totalSessions`, `totalMessages`, `hourCounts`

**Tier 2: Session & environment data** — per-session and config state:

| Data | Source Path | Hot/Cold | Notes |
|------|-------------|----------|-------|
| Aggregate tokens/cost | `~/.claude/stats-cache.json` | Hot | Cumulative, not per-session |
| Active sessions | `~/.claude/sessions/*.json` | Hot | pid, sessionId, cwd, startedAt, kind |
| Session transcript | `~/.claude/projects/<path>/<sessionId>.jsonl` | Hot | Full messages, no token counts per turn |
| Command history | `~/.claude/history.jsonl` | Hot | display, timestamp, project, sessionId |
| Tasks | `~/.claude/tasks/<sessionId>/*.json` | Hot | id, subject, status, blocks/blockedBy |
| Settings | `~/.claude/settings.json` | Cold | permissions, statusLine, enabledPlugins |
| CLAUDE.md | `./CLAUDE.md` + `~/.claude/CLAUDE.md` | Cold | Line count for rules-lean check |
| MCP config | `./.mcp.json` + `~/.claude/.mcp.json` | Cold | Server names, types, enabled state |
| Environment vars | `process.env` | Cold (poll) | AUTO_COMPACT, DISABLE_1M_CONTEXT, etc. |

**What is NOT available on disk:**
- Per-session live token counts (input/output/cache per turn)
- Real-time context window usage percentage
- Per-session cost (only cumulative in stats-cache)
- Current model for active session
- Cache hit rate per session

**Bridging the gap — statusline integration:** Claude Code's `statusLine` config (`settings.json`) pipes live session state to a command via stdin JSON containing `model.display_name`, `context_window.used_percentage`, `cost.total_cost_usd`, and `cost.total_duration_ms`. The dashboard can register itself as a statusline consumer or read from a shared state file that the statusline command writes. This is the path to live per-session metrics. For v1, aggregate metrics from `stats-cache.json` are the baseline, with statusline integration as a stretch goal.

**Session selection:** When multiple `sessions/*.json` files exist, the adapter selects by most recent `startedAt` timestamp. A `--session` CLI flag can override this.

**Session JSONL resolution:** The adapter derives the JSONL path from the session's `cwd` field in `sessions/*.json`. The `cwd` is path-encoded (slashes replaced) to form the directory name under `~/.claude/projects/`, and the `sessionId` is the filename. For example: session with `cwd: /Users/foo/myproject` and `sessionId: abc123` maps to `~/.claude/projects/-Users-foo-myproject/abc123.jsonl`.

**JSONL reading strategy:** The adapter tails the session JSONL (reads last N bytes, not the entire file) to count recent user messages and find the last timestamp. Malformed trailing lines (partial writes) are silently skipped. This keeps reads fast even for long sessions with large transcript files.

### Technique Overrides

Each technique has a base definition (id, title, condition, impact). The adapter provides CLI-specific commands and labels:

```ts
// Base technique
{ id: "compact-before-limit", title: "Compact Before Hitting the Limit", command: "/compact" }

// Cursor adapter would override:
cursorAdapter.getTechniqueOverrides().set("compact-before-limit", { command: "/compress" })
```

The technique database stays shared — only commands and config paths differ per CLI.

---

## Dashboard State Model

The adapter produces this state each refresh cycle:

```ts
interface DashboardState {
  // Session (from sessions/*.json + projects/<path>/<id>.jsonl)
  sessionAgeMs: number
  sessionMessages: number            // count of type:"user" entries in session JSONL
  timeSinceLastMessageMs: number     // timestamp of last JSONL entry vs now
  activeSessions: number             // count of sessions/*.json files

  // Aggregate Metrics (from stats-cache.json — cumulative, not per-session)
  totalInputTokens: number           // modelUsage cumulative
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreationTokens: number
  totalCostUsd: number
  todayMessageCount: number          // dailyActivity for today
  todayTokensByModel: Record<string, number>

  // Live Session Metrics (from statusline integration — stretch goal for v1)
  // These fields are nullable; panels degrade gracefully when unavailable
  liveContextPercent: number | null
  liveModel: string | null
  liveSessionCost: number | null
  liveDurationMs: number | null

  // Environment (from settings.json, .mcp.json, CLAUDE.md, process.env)
  claudeMdLines: number
  mcpServerCount: number
  mcpServersEnabled: number
  pluginCount: number
  hookCount: number
  isPeakHours: boolean
  hasIgnoreFile: boolean
  hasNotificationsEnabled: boolean
  hasAutoCompactEnv: boolean
  hasContextCapEnv: boolean

  // History (from history.jsonl)
  recentTurns: TurnEntry[]
}

interface TurnEntry {
  display: string       // user prompt text (truncated for display)
  timestamp: number     // unix ms
  project: string       // project path
  sessionId?: string
}

interface TechniqueConfig {
  command?: string      // CLI-specific command override (e.g., "/compress" for Cursor)
  configPath?: string   // CLI-specific config file path
  thresholds?: Record<string, number>  // CLI-specific threshold overrides
}
```

**Graceful degradation:** When `live*` fields are null (statusline not configured), panels show aggregate data from stats-cache.json instead. The Metrics panel displays "today's totals" rather than "this session" and the context bar is hidden. Technique conditions that depend on live data (e.g., `contextPercent > 75`) are skipped — those techniques appear in Recommendations instead of Active Alerts.

**Startup states:**
- No active session: show "Waiting for Claude Code session..." with environment and aggregate panels still populated
- No stats-cache.json (fresh install): show "No usage data yet" placeholders
- Missing files: individual panels show "N/A", dashboard continues running

---

## Technique Engine

### Technique Database

30 techniques sourced from [token-saving-techniques.vercel.app](https://token-saving-techniques.vercel.app/), organized into 6 categories:

| Category | Count | Examples |
|----------|-------|---------|
| Context Hygiene | 8 | Clear context, keep rules lean, compact, exclude files, cache TTL |
| Prompting Strategy | 8 | Plan mode first, feed precise context, batch changes, don't interrupt |
| Model Routing | 1 | Use the right model tier (flagship/balanced/fast) |
| Agent Architecture | 7 | Subagents, disconnect MCPs, use skills, reduce thinking effort, hooks |
| Cost & Limit Management | 5 | Track spend, cap context window, resume sessions, schedule off-peak |
| Meta | 1 | Every token is re-read every turn |

Each technique has:
- `id`, `title`, `description`
- `category` and `impact` (High/Medium)
- `platforms`: which CLIs it applies to
- `command`: CLI-specific action (e.g., `/compact`, `/compress`)
- `condition(state: DashboardState) => boolean | null` — null means not programmatically evaluable

### Evaluation & Classification

```
All 30 techniques
    | evaluate condition(state)
    v
+------------------+----------------------+
| TRIGGERED        | NOT TRIGGERED        |
| (condition true) | (condition false     |
|                  |  or null/static)     |
+------------------+----------------------+
| -> Active Alerts | -> Recommendations   |
|    panel         |    panel             |
|    sorted by     |    rotate subset     |
|    impact, then  |    every 10s or      |
|    recency       |    n/p keys          |
+------------------+----------------------+
```

### Evaluable Conditions

**Always available (from disk files):**

| Technique | Condition | Source |
|-----------|-----------|--------|
| Keep rules lean | `claudeMdLines > 200` | CLAUDE.md line count |
| Disconnect unused MCPs | `mcpServerCount > 3` | .mcp.json |
| Enable completion sounds | `!hasNotificationsEnabled` | settings.json |
| Cap context window | `!hasAutoCompactEnv` | process.env |
| Manage plugins | `pluginCount > 5` | settings.json |
| Exclude files | `!hasIgnoreFile` | check .claude/ignore existence |
| Track spend | no `/cost` in recent history | history.jsonl |
| Use plan mode | high message count, no `/plan` in history | history.jsonl + session JSONL |
| Automate with hooks | `hookCount === 0` | settings.json |
| Prefer native CLIs | MCP names in hardcoded list: `["git", "docker", "kubectl", "npm", "aws"]` | .mcp.json |
| Clear context | `sessionAgeMs > 3600000` (1hr+) | sessions/*.json startedAt |
| Cache TTL warning | `timeSinceLastMessageMs > 240000` (4m) | last entry in session JSONL |
| Schedule off-peak | `isPeakHours` (9am-6pm local) | time-based |
| Resume sessions | project path matches recent history entries | history.jsonl |

**Available with statusline integration (stretch goal):**

| Technique | Condition | Source |
|-----------|-----------|--------|
| Compact before limit | `liveContextPercent > 75` | statusline JSON |
| Reduce thinking effort | `liveModel` is flagship tier | statusline JSON |
| Use subagents | `liveContextPercent > 60` | statusline JSON |
| Use ask/read-only mode | live cost rising fast | statusline JSON |

**Not programmatically evaluable** (always in Recommendations, sorted by impact):
- Feed Precise Context, Don't Paste Large Blobs, Watch Don't Interrupt, Batch Related Changes, Surgical File References, Use /btw, Inspect Before Commit, Subagents = Fresh Context, Persist Decisions, Use Skills, Enable Completion Sounds (beyond config check)

---

## Panel Layout

Target: 80x24 minimum terminal (standard tmux pane). All panels compact.

```
+-- Metrics ----------------------------+-- Session ---------------+
| In: 12.4K Out: 3.1K Cache: 8.2K      | 1h20m | 34 turns | 2/m  |
| $0.42 | Cache: 66% | ████░░ 72%      | opus-4 | Peak: No       |
+-- Active Alerts (3) -------------------------------------------+
| ⛶ HIGH  Run /compact — context at 72%, rising fast            |
| $ HIGH  Cache miss risk — 4m since last turn (TTL: 5m)        |
| ✎ MED   Batch edits — 6 single-file turns in a row           |
+-- Recommendations -------------------------------------------------+
| ⚙ Route tests to Sonnet  | ⚒ Use subagents for grep tasks   |
| ⛶ Enable .claude/ignore  | $ Set AUTO_COMPACT_WINDOW env    |
+-- Environment ----------+-- History ----------------------------+
| MCP: 3on/1off  Plug: 4  | 14:02 fix auth   13:51 refactor    |
| CLAUDE.md: 142L Skills:2 | 13:58 add test   13:47 plan mode   |
+-- Status -------------------------------------------------------+
| 14:23 | ~/.claude | 3 alerts | q:quit r:refresh n/p:tips       |
+-----------------------------------------------------------------+
```

### Panel Details

- **Metrics** (2 rows): Two modes depending on data availability:
  - *With statusline*: live context %, model, session cost, duration + context usage bar
  - *Without statusline*: today's aggregate tokens (in/out/cache by model), cumulative cost from stats-cache.json
- **Session** (2 rows): session age (from startedAt), message count (from JSONL line count), active session count, peak hours indicator
- **Active Alerts** (3-4 rows, full width): triggered techniques sorted by impact then recency. Category icon + impact tag + action text. Scrollable if more than visible.
- **Recommendations** (2 rows, full width, 2-column): non-triggered techniques rotating every 10s. Compact: icon + short title. Navigate with n/p keys.
- **Environment** (2 rows): MCP server count (on/off), plugin count, CLAUDE.md line count, skill count
- **History** (2 rows): recent prompts with timestamps, 2-column layout, truncated
- **Status Bar** (1 row): clock, watched path, active alert count, keybinding hints

### Category Icons

| Category | Icon |
|----------|------|
| Context Hygiene | ⛶ |
| Prompting Strategy | ✎ |
| Model Routing | ⚙ |
| Agent Architecture | ⚒ |
| Cost & Limit Mgmt | $ |
| Meta | * |

### Impact Display

- **HIGH** — red text
- **MEDIUM** — yellow text

---

## Keybindings

| Key | Action |
|-----|--------|
| `q` / `Ctrl+C` | Quit |
| `r` | Force refresh |
| `n` / `p` | Next/previous recommendation set |
| `↑` / `↓` | Scroll active alerts (when >3) |

---

## CLI Interface

```bash
# Default — monitor Claude Code
meldr-dash

# Specify adapter (future)
meldr-dash --cli claude
meldr-dash --cli codex

# Custom poll interval (seconds, default: 15)
meldr-dash --poll 10

# Custom data directory
meldr-dash --data-dir ~/.claude

# Monitor a specific session (by session ID)
meldr-dash --session f5a58fb1-9ab3-49aa-8a70-ffcea92df44b
```

---

## Dependencies

```json
{
  "dependencies": {
    "ink": "^5.1.0",
    "react": "^18.3.0",
    "chokidar": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/react": "^18.3.0",
    "ink-testing-library": "^4.0.0"
  }
}
```

Three runtime dependencies. TypeScript source. ink-testing-library for component tests.

---

## Watcher Contract

The watcher is the central data pipeline. It must integrate cleanly with React's rendering model.

```ts
interface WatcherOptions {
  adapter: CLIAdapter
  onStateChange: (state: DashboardState) => void
  pollIntervalMs: number  // default 15000
  debounceMs: number      // default 500 — max re-render rate
}

interface Watcher {
  start(): void
  stop(): void
  forceRefresh(): void
}
```

**Behavior:**
- Chokidar watches hot paths (stats-cache.json, sessions/, active session JSONL)
- Chokidar events are debounced at 500ms to prevent terminal flicker from rapid file writes
- Cold paths are polled every `pollIntervalMs`
- Both paths call `adapter.collectState()` then `onStateChange(state)`
- `forceRefresh()` bypasses debounce (bound to `r` key)

**Integration with React:** The `use-adapter` hook creates the watcher on mount, passes `setState` as `onStateChange`, and calls `stop()` on unmount. Panels subscribe to state slices via individual hooks that select from the adapter state.

**Error resilience:** File read errors (missing file, parse error, permission denied) are caught per-file. The adapter returns the last known good value for that field and logs the error to an internal ring buffer (visible in a future debug panel). The dashboard never crashes from a bad file read.

---

## Verification Plan

### Manual Testing
- Run `meldr-dash` in a tmux pane alongside an active Claude Code session
- Verify all panels populate with real data from `~/.claude/`
- Trigger techniques by creating conditions (e.g., let cache TTL approach, grow CLAUDE.md past 200 lines)
- Test keybindings (quit, refresh, tip navigation)

### Unit Tests
- **Panel components**: render each with mock `DashboardState` via ink-testing-library
- **Evaluator**: technique conditions return correct triggered/not-triggered for known state fixtures
- **Claude adapter**: reads fixture files matching `~/.claude/` structure, produces correct `DashboardState`
- **Formatter**: impact bars, icons, and truncation produce expected terminal output

---

## README Plan

Friendly, concise, practical:

1. **What it is** — one paragraph: passive TUI dashboard for monitoring token usage and surfacing savings tips
2. **Screenshot** — dashboard in action (after v1)
3. **Quick start** — `npx meldr-dash` or install globally
4. **What you see** — panel descriptions with layout diagram
5. **Techniques** — link to web app as canonical source, note that 20+ evaluate in real-time
6. **Supported CLIs** — Claude Code (now), others coming
7. **Configuration** — CLI flags
8. **How it works** — one paragraph on adapter -> hooks -> panels
9. **Contributing an adapter** — brief guide on implementing CLIAdapter

---

## Future Considerations (Not in v1)

- Adapters for Codex CLI, Cursor, Gemini CLI
- Configurable technique thresholds (e.g., custom context % alert level)
- Historical trending (token usage over time)
- Action execution (run `/compact` directly from dashboard)
- Panel toggle/reorder via config file
