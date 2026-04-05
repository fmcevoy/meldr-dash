# meldr-dash

## What it is

meldr-dash is a passive TUI dashboard that monitors AI coding CLI token usage and surfaces saving techniques in real-time. It sits in a tmux pane alongside your coding CLI, watching `~/.claude/` for changes and evaluating 30 token-saving techniques against your current state — alerting you when context is filling up, cache is at risk, or there are cheaper ways to do what you're doing.

<!-- Screenshot coming after v1 -->

## Quick Start

```bash
# Clone and build
git clone https://github.com/fmcevoy/meldr-dash.git
cd meldr-dash
npm install
npm run build

# Run
node dist/index.js

# Or with npx (after publishing)
npx meldr-dash
```

## What You See

```
┌─ Metrics ─────────────────────────┬─ Session ──────────────┐
│ In: 500K Out: 120K Cache: 350K    │ 1h20m │ 34 msgs │ 2   │
│ $12.50 │ Today: 42 msgs          │ active sessions        │
├─ Active Alerts (3) ──────────────────────────────────────── ┤
│ ⛶ HIGH  Run /compact — context at 72%                     │
│ $ HIGH  Cache miss risk — 4m since last turn               │
│ ✎ MED   Batch edits — single-file turns in a row          │
├─ Recommendations ────────────────────────────────────────── ┤
│ ⚙ Route tests to Sonnet │ ⚒ Use subagents for parallel   │
│ ⛶ Enable .claude/ignore │ $ Set AUTO_COMPACT_WINDOW       │
├─ Environment ──────────┬─ History ───────────────────────── ┤
│ MCP: 3on/1off Plug: 4  │ 14:02 fix auth   13:51 refactor  │
│ CLAUDE.md: 142L Hooks:2│ 13:58 add test   13:47 plan mode │
├─ Status ─────────────────────────────────────────────────── ┤
│ 14:23 │ ~/.claude │ 3 alerts │ q:quit r:refresh n/p:tips   │
└──────────────────────────────────────────────────────────── ┘
```

| Panel | What it shows |
|-------|--------------|
| Metrics | Running token counts (in/out/cache) and spend for the current session and today |
| Session | Elapsed time, message count, and number of active sessions |
| Active Alerts | Techniques firing right now, ranked by severity |
| Recommendations | Techniques not currently alerting but worth applying |
| Environment | MCP server status, plugin count, CLAUDE.md line count, hook count |
| History | Recent conversation summaries with timestamps |
| Status | Clock, data directory, alert count, and keybinding hints |

## Techniques

The canonical list of techniques lives at [token-saving-techniques.vercel.app](https://token-saving-techniques.vercel.app/).

14+ of the 30 techniques evaluate in real-time against your current session state and fire as alerts when conditions are met. The rest rotate through the Recommendations panel so you see them even when they are not actively triggered.

## Supported CLIs

- Claude Code (now)
- Codex CLI, Cursor, and Gemini CLI (coming via the adapter pattern)

## Configuration

```
--cli <name>      Adapter to use (default: claude)
--poll <seconds>  Poll interval for cold files (default: 15)
--data-dir <path> Custom data directory (default: ~/.claude)
--session <id>    Monitor a specific session
```

## Keybindings

```
q / Ctrl+C    Quit
r             Force refresh
n / p         Next/previous recommendations
```

## How It Works

The adapter reads `~/.claude/` files and normalizes them into a shared state shape. A watcher layer detects changes — chokidar for hot files that update frequently, polling for cold files that change rarely. State updates flow through React hooks into panel components that re-render independently. A technique engine runs on every state change, evaluating each technique's conditions against the current snapshot and routing results to either Active Alerts or Recommendations.

## Contributing an Adapter

Implement the `CLIAdapter` interface (4 properties, 4 methods), point it at your CLI's data directory, and add technique command overrides for any techniques whose suggested commands differ from Claude Code's. See `src/adapters/types.ts`.
