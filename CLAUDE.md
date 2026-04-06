# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

meldr-dash is a terminal UI dashboard (built with Ink/React) that monitors AI coding CLI token usage and surfaces saving techniques. It reads Claude Code's local data files (`~/.claude/`) and displays real-time metrics, alerts, and recommendations.

## Commands

```bash
# Build
npm run build          # tsc → dist/

# Dev (watch mode)
npm run dev            # tsc --watch

# Run
npm start              # node dist/index.js
node dist/index.js --poll 5 --data-dir /path/to/.claude

# Tests
npm test               # vitest run (single run)
npm run test:watch     # vitest (watch mode)
# Single test file:
node --experimental-vm-modules node_modules/.bin/vitest run tests/tips/evaluator.test.ts
```

## Architecture

**Adapter pattern** — `CLIAdapter` interface (`src/adapters/types.ts`) defines the contract for reading CLI data. `ClaudeAdapter` is the only implementation, reading from `~/.claude/` (stats-cache.json, sessions/, history.jsonl, settings.json, mcp.json, CLAUDE.md).

**Data flow:** `ClaudeAdapter.collectState()` → `Watcher` (chokidar fs watch + poll interval) → `useDashboard` hook → React state → panel components.

**Tips engine** — `src/tips/database.ts` holds a static array of `Technique` objects, each with an optional `condition` function evaluated against `DashboardState`. The evaluator (`src/tips/evaluator.ts`) splits techniques into alerts (condition triggered) vs recommendations (condition not triggered or no condition). `useTips` hook handles pagination and auto-rotation.

**Panels** — All in `src/panels/`, each receives props from `DashboardState`. `box.tsx` is the shared bordered container. The app layout is a fixed grid defined in `src/app.tsx`.

**Keybindings** — q=quit, r=refresh, n/p=page recommendations. Handled via Ink's `useInput` in `app.tsx`.

## Key Types

- `DashboardState` — central state object passed through the entire app (`src/adapters/types.ts`)
- `Technique` — a tip/recommendation with id, category, impact, condition function (`src/tips/database.ts`)
- `CLIAdapter` — interface for CLI data sources (`src/adapters/types.ts`)

## Tech Stack

- **Ink 5** + **React 18** for terminal UI (JSX with `react-jsx` transform)
- **TypeScript** with `NodeNext` module resolution, ESM (`"type": "module"`)
- **Vitest** for testing, **ink-testing-library** for component tests
- **chokidar** for filesystem watching
- All imports use `.js` extensions (required by NodeNext resolution)
