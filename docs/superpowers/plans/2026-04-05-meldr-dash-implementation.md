# meldr-dash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a passive TUI dashboard (Node.js/Ink) that monitors Claude Code token usage and surfaces actionable saving techniques in real-time.

**Architecture:** Widget Composition — independent React/Ink panel components subscribe to data via hooks. A CLI adapter pattern isolates Claude-specific file reading. A hybrid watcher (chokidar + polling) drives state updates.

**Tech Stack:** TypeScript, Ink 5 (React 18 for terminals), chokidar 4, Node.js

**Spec:** `docs/superpowers/specs/2026-04-05-meldr-dash-design.md`

**Deliberate spec deviations:**
- `collectState()` is `async` (spec shows sync, but file I/O requires async)
- Spec's 5 hooks consolidated to 2: `use-dashboard.ts` (replaces use-adapter, use-metrics, use-session, use-environment) and `use-tips.ts` — simpler for v1, all state flows through one central hook

---

## File Structure

```
meldr-dash/
├── src/
│   ├── index.tsx              # Entry point — parse CLI args, render <App />
│   ├── app.tsx                # Root layout — composes all panels in flexbox grid
│   ├── adapters/
│   │   ├── types.ts           # CLIAdapter, DashboardState, TurnEntry, TechniqueConfig interfaces
│   │   └── claude.ts          # Claude Code adapter — reads ~/.claude/ files
│   ├── hooks/
│   │   ├── use-dashboard.ts   # Central hook — creates watcher, holds DashboardState
│   │   └── use-tips.ts        # Evaluates techniques against current state
│   ├── panels/
│   │   ├── box.tsx            # Reusable bordered panel component with title
│   │   ├── token-metrics.tsx  # Aggregate token counts, cost display
│   │   ├── session-info.tsx   # Session age, message count, active sessions
│   │   ├── active-alerts.tsx  # Triggered techniques sorted by impact
│   │   ├── recommendations.tsx# Rotating non-triggered techniques
│   │   ├── environment.tsx    # MCP, plugins, CLAUDE.md stats
│   │   ├── history.tsx        # Recent prompts with timestamps
│   │   └── status-bar.tsx     # Clock, watch path, alert count, keybindings
│   ├── tips/
│   │   ├── database.ts        # 30 techniques with conditions
│   │   ├── evaluator.ts       # Evaluate all techniques, classify triggered vs not
│   │   └── formatter.ts       # Impact bars, category icons, technique display helpers
│   ├── watcher.ts             # Hybrid chokidar + polling, debounced state updates
│   └── theme.ts               # Color constants, category icons, impact colors
├── tests/
│   ├── adapters/
│   │   └── claude.test.ts     # Claude adapter unit tests with fixture files
│   ├── tips/
│   │   ├── database.test.ts   # Technique database integrity tests
│   │   └── evaluator.test.ts  # Condition evaluation tests
│   ├── watcher.test.ts          # Watcher unit tests with mock adapter
│   ├── panels/
│   │   └── panels.test.tsx    # Panel rendering tests via ink-testing-library
│   └── fixtures/
│       ├── stats-cache.json   # Mock stats-cache.json
│       ├── sessions/          # Mock session files
│       ├── history.jsonl      # Mock history
│       ├── settings.json      # Mock settings
│       └── mcp.json           # Mock .mcp.json
├── package.json
├── tsconfig.json
└── README.md
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `src/index.tsx`
- Create: `src/app.tsx`
- Create: `src/theme.ts`

- [ ] **Step 1: Initialize package.json**

```json
{
  "name": "meldr-dash",
  "version": "0.1.0",
  "description": "TUI dashboard for monitoring AI coding CLI token usage and surfacing saving techniques",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "meldr-dash": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js",
    "test": "node --experimental-vm-modules node_modules/.bin/vitest run",
    "test:watch": "node --experimental-vm-modules node_modules/.bin/vitest"
  },
  "keywords": ["tui", "dashboard", "token", "claude", "ai"],
  "license": "MIT",
  "dependencies": {
    "ink": "^5.1.0",
    "react": "^18.3.0",
    "chokidar": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "typescript": "^5.5.0",
    "ink-testing-library": "^4.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create src/theme.ts**

```ts
export const colors = {
  primary: "cyan",
  success: "green",
  warning: "yellow",
  danger: "red",
  muted: "gray",
  accent: "magenta",
} as const;

export const categoryIcons: Record<string, string> = {
  "context-hygiene": "⛶",
  "prompting-strategy": "✎",
  "model-routing": "⚙",
  "agent-architecture": "⚒",
  "cost-management": "$",
  meta: "*",
};

export const impactColors: Record<string, string> = {
  High: colors.danger,
  Medium: colors.warning,
};
```

- [ ] **Step 4: Create src/app.tsx (minimal shell)**

```tsx
import React from "react";
import { Box, Text } from "ink";

export function App(): React.ReactElement {
  return (
    <Box flexDirection="column" width="100%">
      <Box borderStyle="single" borderColor="cyan">
        <Text color="cyan" bold>
          meldr-dash
        </Text>
      </Box>
      <Text color="gray">Loading...</Text>
    </Box>
  );
}
```

- [ ] **Step 5: Create src/index.tsx (entry point)**

```tsx
#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { App } from "./app.js";

render(<App />);
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
```

- [ ] **Step 7: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
```

- [ ] **Step 8: Install dependencies and verify build**

Run: `npm install && npm run build`
Expected: Clean compile, `dist/` directory created

- [ ] **Step 9: Run the app to verify it renders**

Run: `node dist/index.js`
Expected: Renders "meldr-dash" header with "Loading..." text, exits cleanly with Ctrl+C

- [ ] **Step 10: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore src/index.tsx src/app.tsx src/theme.ts
git commit -m "feat: scaffold meldr-dash project with Ink, TypeScript, and theme"
```

---

### Task 2: Types & Adapter Interface

**Files:**
- Create: `src/adapters/types.ts`

- [ ] **Step 1: Create the shared adapter types**

```ts
export interface TurnEntry {
  display: string;
  timestamp: number;
  project: string;
  sessionId?: string;
}

export interface TechniqueConfig {
  command?: string;
  configPath?: string;
  thresholds?: Record<string, number>;
}

export interface DashboardState {
  // Session
  sessionAgeMs: number;
  sessionMessages: number;
  timeSinceLastMessageMs: number;
  activeSessions: number;

  // Aggregate Metrics (from stats-cache.json)
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;
  totalCostUsd: number;
  todayMessageCount: number;
  todayTokensByModel: Record<string, number>;

  // Live Session Metrics (nullable — statusline stretch goal)
  liveContextPercent: number | null;
  liveModel: string | null;
  liveSessionCost: number | null;
  liveDurationMs: number | null;

  // Environment
  claudeMdLines: number;
  mcpServerCount: number;
  mcpServersEnabled: number;
  pluginCount: number;
  hookCount: number;
  isPeakHours: boolean;
  hasIgnoreFile: boolean;
  hasNotificationsEnabled: boolean;
  hasAutoCompactEnv: boolean;
  hasContextCapEnv: boolean;

  // History
  recentTurns: TurnEntry[];
}

export interface CLIAdapter {
  readonly name: string;
  readonly displayName: string;
  readonly dataDir: string;
  readonly rulesFile: string;

  collectState(): Promise<DashboardState>;
  getWatchPaths(): string[];
  getPollPaths(): string[];
  getTechniqueOverrides(): Map<string, TechniqueConfig>;
}

export function emptyState(): DashboardState {
  return {
    sessionAgeMs: 0,
    sessionMessages: 0,
    timeSinceLastMessageMs: 0,
    activeSessions: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheCreationTokens: 0,
    totalCostUsd: 0,
    todayMessageCount: 0,
    todayTokensByModel: {},
    liveContextPercent: null,
    liveModel: null,
    liveSessionCost: null,
    liveDurationMs: null,
    claudeMdLines: 0,
    mcpServerCount: 0,
    mcpServersEnabled: 0,
    pluginCount: 0,
    hookCount: 0,
    isPeakHours: false,
    hasIgnoreFile: false,
    hasNotificationsEnabled: false,
    hasAutoCompactEnv: false,
    hasContextCapEnv: false,
    recentTurns: [],
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: Clean compile

- [ ] **Step 3: Commit**

```bash
git add src/adapters/types.ts
git commit -m "feat: add CLIAdapter interface and DashboardState types"
```

---

### Task 3: Claude Code Adapter

**Files:**
- Create: `src/adapters/claude.ts`
- Create: `tests/fixtures/stats-cache.json`
- Create: `tests/fixtures/sessions/12345.json`
- Create: `tests/fixtures/history.jsonl`
- Create: `tests/fixtures/settings.json`
- Create: `tests/fixtures/mcp.json`
- Create: `tests/adapters/claude.test.ts`

- [ ] **Step 1: Create test fixtures**

`tests/fixtures/stats-cache.json`:
```json
{
  "version": 3,
  "dailyActivity": [
    { "date": "2026-04-05", "messageCount": 42, "sessionCount": 3, "toolCallCount": 18 }
  ],
  "dailyModelTokens": [
    { "date": "2026-04-05", "tokensByModel": { "claude-opus-4-6": 150000, "claude-sonnet-4-6": 80000 } }
  ],
  "modelUsage": {
    "claude-opus-4-6": {
      "inputTokens": 500000,
      "outputTokens": 120000,
      "cacheReadInputTokens": 350000,
      "cacheCreationInputTokens": 50000,
      "costUSD": 12.50,
      "contextWindow": 200000,
      "maxOutputTokens": 16384
    }
  },
  "totalSessions": 50,
  "totalMessages": 800
}
```

`tests/fixtures/sessions/12345.json`:
```json
{
  "pid": 12345,
  "sessionId": "test-session-001",
  "cwd": "/Users/test/myproject",
  "startedAt": 1775420000000,
  "kind": "interactive",
  "entrypoint": "cli"
}
```

`tests/fixtures/history.jsonl` (one entry per line):
```
{"display":"/plan","timestamp":1775420100000,"project":"/Users/test/myproject","sessionId":"test-session-001"}
{"display":"fix the auth bug in login.ts","timestamp":1775420200000,"project":"/Users/test/myproject","sessionId":"test-session-001"}
{"display":"add tests for auth module","timestamp":1775420300000,"project":"/Users/test/myproject","sessionId":"test-session-001"}
```

`tests/fixtures/settings.json`:
```json
{
  "permissions": { "defaultMode": "auto" },
  "enabledPlugins": { "vercel": true, "slack": true, "superpowers": true },
  "statusLine": { "type": "command", "command": "~/.claude/statusline-command.sh" }
}
```

`tests/fixtures/mcp.json`:
```json
{
  "mcpServers": {
    "github": { "type": "stdio", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] },
    "context7": { "type": "stdio", "command": "npx", "args": ["-y", "@upstash/context7-mcp@latest"] },
    "docker": { "type": "stdio", "command": "npx", "args": ["-y", "docker-mcp"], "disabled": true }
  }
}
```

- [ ] **Step 2: Write the failing test for the Claude adapter**

`tests/adapters/claude.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ClaudeAdapter } from "../../src/adapters/claude.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(__dirname, "..", "fixtures");

describe("ClaudeAdapter", () => {
  it("reads stats-cache.json for aggregate metrics", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();

    expect(state.totalInputTokens).toBe(500000);
    expect(state.totalOutputTokens).toBe(120000);
    expect(state.totalCacheReadTokens).toBe(350000);
    expect(state.totalCostUsd).toBe(12.5);
    // todayMessageCount is date-dependent — only assert it's a number
    expect(typeof state.todayMessageCount).toBe("number");
  });

  it("reads sessions for active session count and age", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();

    expect(state.activeSessions).toBe(1);
    expect(state.sessionAgeMs).toBeGreaterThan(0);
  });

  it("reads history.jsonl for recent turns", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();

    expect(state.recentTurns).toHaveLength(3);
    expect(state.recentTurns[0].display).toBe("/plan");
  });

  it("reads settings for plugin count and hooks", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();

    expect(state.pluginCount).toBe(3);
  });

  it("reads MCP config for server count", async () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const state = await adapter.collectState();

    expect(state.mcpServerCount).toBe(3);
    expect(state.mcpServersEnabled).toBe(2);
  });

  it("returns watch paths for hot files", () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const paths = adapter.getWatchPaths();

    expect(paths.some((p) => p.includes("stats-cache.json"))).toBe(true);
    expect(paths.some((p) => p.includes("sessions"))).toBe(true);
  });

  it("returns poll paths for cold files", () => {
    const adapter = new ClaudeAdapter({ dataDir: fixtureDir, cwd: fixtureDir });
    const paths = adapter.getPollPaths();

    expect(paths.some((p) => p.includes("settings.json"))).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `ClaudeAdapter` not found

- [ ] **Step 4: Implement the Claude adapter**

Create `src/adapters/claude.ts`:
```ts
import { readFile, readdir, access, stat } from "fs/promises";
import path from "path";
import os from "os";
import {
  CLIAdapter,
  DashboardState,
  TurnEntry,
  TechniqueConfig,
  emptyState,
} from "./types.js";

interface ClaudeAdapterOptions {
  dataDir?: string;
  cwd?: string;
  sessionId?: string;
}

export class ClaudeAdapter implements CLIAdapter {
  readonly name = "claude";
  readonly displayName = "Claude Code";
  readonly dataDir: string;
  readonly rulesFile = "CLAUDE.md";
  private cwd: string;
  private sessionId?: string;

  constructor(options: ClaudeAdapterOptions = {}) {
    this.dataDir = options.dataDir ?? path.join(os.homedir(), ".claude");
    this.cwd = options.cwd ?? process.cwd();
    this.sessionId = options.sessionId;
  }

  async collectState(): Promise<DashboardState> {
    const state = emptyState();

    await Promise.all([
      this.readStatsCache(state),
      this.readSessions(state),
      this.readHistory(state),
      this.readSettings(state),
      this.readMcpConfig(state),
      this.readClaudeMd(state),
      this.readEnvironment(state),
    ]);

    return state;
  }

  private async readStatsCache(state: DashboardState): Promise<void> {
    try {
      const raw = await readFile(
        path.join(this.dataDir, "stats-cache.json"),
        "utf-8"
      );
      const data = JSON.parse(raw);

      // Aggregate model usage
      if (data.modelUsage) {
        for (const model of Object.values(data.modelUsage) as any[]) {
          state.totalInputTokens += model.inputTokens ?? 0;
          state.totalOutputTokens += model.outputTokens ?? 0;
          state.totalCacheReadTokens += model.cacheReadInputTokens ?? 0;
          state.totalCacheCreationTokens += model.cacheCreationInputTokens ?? 0;
          state.totalCostUsd += model.costUSD ?? 0;
        }
      }

      // Today's activity
      const today = new Date().toISOString().slice(0, 10);
      const todayActivity = data.dailyActivity?.find(
        (d: any) => d.date === today
      );
      state.todayMessageCount = todayActivity?.messageCount ?? 0;

      const todayTokens = data.dailyModelTokens?.find(
        (d: any) => d.date === today
      );
      state.todayTokensByModel = todayTokens?.tokensByModel ?? {};
    } catch {
      // File missing or malformed — keep defaults
    }
  }

  private async readSessions(state: DashboardState): Promise<void> {
    try {
      const sessionsDir = path.join(this.dataDir, "sessions");
      const files = await readdir(sessionsDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      state.activeSessions = jsonFiles.length;

      let mostRecent: { startedAt: number; sessionId: string } | null = null;

      for (const file of jsonFiles) {
        const raw = await readFile(path.join(sessionsDir, file), "utf-8");
        const session = JSON.parse(raw);
        if (
          this.sessionId
            ? session.sessionId === this.sessionId
            : !mostRecent || session.startedAt > mostRecent.startedAt
        ) {
          mostRecent = session;
        }
      }

      if (mostRecent) {
        state.sessionAgeMs = Date.now() - mostRecent.startedAt;
        // Read session JSONL for message count and last message time
        await this.readSessionJsonl(state, mostRecent);
      }
    } catch {
      // No sessions directory
    }
  }

  private async readSessionJsonl(
    state: DashboardState,
    session: { sessionId: string; cwd: string }
  ): Promise<void> {
    try {
      // Derive JSONL path: cwd is path-encoded (slashes → dashes)
      const encodedPath = session.cwd.replace(/\//g, "-");
      const jsonlPath = path.join(
        this.dataDir,
        "projects",
        encodedPath,
        `${session.sessionId}.jsonl`
      );

      // Tail the file: read last 64KB to avoid reading huge transcripts
      const { size } = await stat(jsonlPath);
      const fd = await import("fs").then((fs) =>
        fs.promises.open(jsonlPath, "r")
      );
      const readSize = Math.min(size, 65536);
      const buffer = Buffer.alloc(readSize);
      await fd.read(buffer, 0, readSize, Math.max(0, size - readSize));
      await fd.close();

      const tail = buffer.toString("utf-8");
      const lines = tail.split("\n").filter(Boolean);

      let userMessages = 0;
      let lastTimestamp = 0;

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.type === "user") {
            userMessages++;
          }
          if (entry.timestamp) {
            const ts =
              typeof entry.timestamp === "string"
                ? new Date(entry.timestamp).getTime()
                : entry.timestamp;
            if (ts > lastTimestamp) lastTimestamp = ts;
          }
        } catch {
          // Skip malformed lines (partial writes)
        }
      }

      state.sessionMessages = userMessages;
      if (lastTimestamp > 0) {
        state.timeSinceLastMessageMs = Date.now() - lastTimestamp;
      }
    } catch {
      // JSONL file missing or unreadable — keep defaults
    }
  }

  private async readHistory(state: DashboardState): Promise<void> {
    try {
      const raw = await readFile(
        path.join(this.dataDir, "history.jsonl"),
        "utf-8"
      );
      const lines = raw.trim().split("\n").filter(Boolean);
      const entries: TurnEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          entries.push({
            display: entry.display ?? "",
            timestamp: entry.timestamp ?? 0,
            project: entry.project ?? "",
            sessionId: entry.sessionId,
          });
        } catch {
          // Skip malformed lines
        }
      }

      // Take last 20 entries (chronological order, oldest first)
      state.recentTurns = entries.slice(-20);
    } catch {
      // No history file
    }
  }

  private async readSettings(state: DashboardState): Promise<void> {
    try {
      const raw = await readFile(
        path.join(this.dataDir, "settings.json"),
        "utf-8"
      );
      const data = JSON.parse(raw);

      // Plugin count
      if (data.enabledPlugins) {
        state.pluginCount = Object.keys(data.enabledPlugins).length;
      }

      // Hook count
      if (data.hooks) {
        state.hookCount = Object.keys(data.hooks).length;
      }

      // Notification check
      state.hasNotificationsEnabled =
        data.preferredNotifChannel === "terminal_bell" ||
        data.preferredNotifChannel === "iterm2" ||
        !!data.preferredNotifChannel;
    } catch {
      // No settings file
    }
  }

  private async readMcpConfig(state: DashboardState): Promise<void> {
    try {
      // Try CWD first, then dataDir
      let raw: string | null = null;
      for (const dir of [this.cwd, this.dataDir]) {
        try {
          raw = await readFile(path.join(dir, ".mcp.json"), "utf-8");
          break;
        } catch {
          continue;
        }
      }

      if (!raw) {
        // Also try mcp.json (fixture compatibility)
        raw = await readFile(
          path.join(this.dataDir, "mcp.json"),
          "utf-8"
        );
      }

      if (raw) {
        const data = JSON.parse(raw);
        const servers = data.mcpServers ?? {};
        const entries = Object.values(servers) as any[];
        state.mcpServerCount = entries.length;
        state.mcpServersEnabled = entries.filter(
          (s) => s.disabled !== true
        ).length;
      }
    } catch {
      // No MCP config
    }
  }

  private async readClaudeMd(state: DashboardState): Promise<void> {
    let totalLines = 0;
    for (const filePath of [
      path.join(this.cwd, "CLAUDE.md"),
      path.join(this.dataDir, "CLAUDE.md"),
    ]) {
      try {
        const raw = await readFile(filePath, "utf-8");
        totalLines += raw.split("\n").length;
      } catch {
        // File doesn't exist
      }
    }
    state.claudeMdLines = totalLines;
  }

  private async readEnvironment(state: DashboardState): Promise<void> {
    const hour = new Date().getHours();
    state.isPeakHours = hour >= 9 && hour < 18;

    state.hasAutoCompactEnv =
      !!process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
    state.hasContextCapEnv =
      !!process.env.CLAUDE_CODE_DISABLE_1M_CONTEXT;

    // Check for ignore file
    try {
      await access(path.join(this.dataDir, "ignore"));
      state.hasIgnoreFile = true;
    } catch {
      try {
        await access(path.join(this.cwd, ".claudeignore"));
        state.hasIgnoreFile = true;
      } catch {
        state.hasIgnoreFile = false;
      }
    }
  }

  getWatchPaths(): string[] {
    return [
      path.join(this.dataDir, "stats-cache.json"),
      path.join(this.dataDir, "sessions"),
      path.join(this.dataDir, "history.jsonl"),
    ];
  }

  getPollPaths(): string[] {
    return [
      path.join(this.dataDir, "settings.json"),
      path.join(this.cwd, ".mcp.json"),
      path.join(this.dataDir, ".mcp.json"),
      path.join(this.cwd, "CLAUDE.md"),
    ];
  }

  getTechniqueOverrides(): Map<string, TechniqueConfig> {
    return new Map();
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All 7 tests pass

- [ ] **Step 6: Commit**

```bash
git add src/adapters/claude.ts tests/
git commit -m "feat: implement Claude Code adapter with file readers and tests"
```

---

### Task 4: Technique Database & Evaluator

**Files:**
- Create: `src/tips/database.ts`
- Create: `src/tips/evaluator.ts`
- Create: `tests/tips/database.test.ts`
- Create: `tests/tips/evaluator.test.ts`

- [ ] **Step 1: Write failing tests for the database**

`tests/tips/database.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { techniques, getTechniqueById } from "../../src/tips/database.js";

describe("Technique Database", () => {
  it("contains 30 techniques", () => {
    expect(techniques).toHaveLength(30);
  });

  it("every technique has required fields", () => {
    for (const t of techniques) {
      expect(t.id).toBeTruthy();
      expect(t.title).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(["High", "Medium"]).toContain(t.impact);
      expect(t.platforms).toBeDefined();
      expect(Array.isArray(t.platforms)).toBe(true);
    }
  });

  it("every technique has a unique id", () => {
    const ids = techniques.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("looks up by id", () => {
    const t = getTechniqueById("clear-context");
    expect(t).toBeDefined();
    expect(t!.title).toContain("Clear");
  });
});
```

- [ ] **Step 2: Write failing tests for the evaluator**

`tests/tips/evaluator.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { evaluate } from "../../src/tips/evaluator.js";
import { emptyState } from "../../src/adapters/types.js";

describe("Evaluator", () => {
  it("triggers keep-rules-lean when claudeMdLines > 200", () => {
    const state = { ...emptyState(), claudeMdLines: 250 };
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "keep-rules-lean")).toBe(true);
  });

  it("does not trigger keep-rules-lean when claudeMdLines <= 200", () => {
    const state = { ...emptyState(), claudeMdLines: 100 };
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "keep-rules-lean")).toBe(false);
  });

  it("triggers disconnect-mcps when mcpServerCount > 3", () => {
    const state = { ...emptyState(), mcpServerCount: 5, mcpServersEnabled: 5 };
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "disconnect-mcps")).toBe(true);
  });

  it("triggers cache-ttl-warning when timeSinceLastMessageMs > 240000", () => {
    const state = { ...emptyState(), timeSinceLastMessageMs: 250000 };
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "cache-ttl-warning")).toBe(true);
  });

  it("triggers clear-context when session > 1 hour", () => {
    const state = { ...emptyState(), sessionAgeMs: 3700000 };
    const { alerts } = evaluate(state);
    expect(alerts.some((a) => a.id === "clear-context")).toBe(true);
  });

  it("sorts alerts by impact (High before Medium)", () => {
    const state = {
      ...emptyState(),
      claudeMdLines: 250,
      sessionAgeMs: 3700000,
      mcpServerCount: 5,
      mcpServersEnabled: 5,
    };
    const { alerts } = evaluate(state);
    const highIdx = alerts.findIndex((a) => a.impact === "High");
    const medIdx = alerts.findIndex((a) => a.impact === "Medium");
    if (highIdx !== -1 && medIdx !== -1) {
      expect(highIdx).toBeLessThan(medIdx);
    }
  });

  it("returns recommendations for non-triggered techniques", () => {
    const state = emptyState();
    const { recommendations } = evaluate(state);
    expect(recommendations.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — modules not found

- [ ] **Step 4: Implement the technique database**

Create `src/tips/database.ts` with all 30 techniques from the web app. Each technique has an `id`, `title`, `description`, `category`, `impact`, `platforms`, `command` (nullable), and `condition` function (nullable for non-evaluable techniques).

The 30 techniques by category:

**Context Hygiene (8):** clear-context, keep-rules-lean, surgical-file-refs, exclude-files, compact-before-limit, tame-output, cache-ttl-warning, enable-sounds
**Prompting Strategy (8):** plan-mode-first, feed-precise-context, dont-paste-blobs, batch-changes, watch-dont-interrupt, use-ask-mode, use-btw, inspect-before-commit
**Model Routing (1):** right-model-for-job
**Agent Architecture (7):** subagents-fresh-context, disconnect-mcps, prefer-native-cli, manage-plugins, use-skills, reduce-thinking, automate-hooks
**Cost & Limit Management (5):** persist-decisions, track-spend, cap-context-window, resume-sessions, schedule-off-peak
**Meta (1):** meta-rule

Each evaluable condition references `DashboardState` fields as documented in the spec's Evaluable Conditions table.

- [ ] **Step 5: Implement the formatter**

Create `src/tips/formatter.ts`:
```ts
import { categoryIcons, impactColors } from "../theme.js";
import { Technique } from "./database.js";

export function formatImpactTag(impact: string): string {
  return impact.toUpperCase().padEnd(4);
}

export function getCategoryIcon(category: string): string {
  return categoryIcons[category] ?? "?";
}

export function getImpactColor(impact: string): string {
  return impactColors[impact] ?? "white";
}

export function formatAlertLine(technique: Technique): {
  icon: string;
  impact: string;
  impactColor: string;
  text: string;
  command: string | null;
} {
  return {
    icon: getCategoryIcon(technique.category),
    impact: formatImpactTag(technique.impact),
    impactColor: getImpactColor(technique.impact),
    text: technique.title,
    command: technique.command,
  };
}
```

- [ ] **Step 6: Implement the evaluator**

Create `src/tips/evaluator.ts`:
```ts
import { DashboardState } from "../adapters/types.js";
import { techniques, Technique } from "./database.js";

export interface EvaluationResult {
  alerts: Technique[];
  recommendations: Technique[];
}

export function evaluate(state: DashboardState): EvaluationResult {
  const alerts: Technique[] = [];
  const recommendations: Technique[] = [];

  for (const technique of techniques) {
    if (technique.condition) {
      const triggered = technique.condition(state);
      if (triggered) {
        alerts.push(technique);
      } else {
        recommendations.push(technique);
      }
    } else {
      recommendations.push(technique);
    }
  }

  // Sort alerts: High impact first, then Medium
  alerts.sort((a, b) => {
    if (a.impact === "High" && b.impact !== "High") return -1;
    if (a.impact !== "High" && b.impact === "High") return 1;
    return 0;
  });

  return { alerts, recommendations };
}
```

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/tips/ tests/tips/
git commit -m "feat: add 30-technique database, evaluator, and formatter"
```

---

### Task 5: Watcher (Hybrid chokidar + Polling)

**Files:**
- Create: `src/watcher.ts`

- [ ] **Step 1: Implement the watcher**

```ts
import { watch, type FSWatcher } from "chokidar";
import { CLIAdapter, DashboardState } from "./adapters/types.js";

export interface WatcherOptions {
  adapter: CLIAdapter;
  onStateChange: (state: DashboardState) => void;
  pollIntervalMs?: number;
  debounceMs?: number;
}

export class Watcher {
  private adapter: CLIAdapter;
  private onStateChange: (state: DashboardState) => void;
  private pollIntervalMs: number;
  private debounceMs: number;
  private fsWatcher: FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshQueued = false;

  constructor(options: WatcherOptions) {
    this.adapter = options.adapter;
    this.onStateChange = options.onStateChange;
    this.pollIntervalMs = options.pollIntervalMs ?? 15000;
    this.debounceMs = options.debounceMs ?? 500;
  }

  start(): void {
    // Watch hot paths
    const watchPaths = this.adapter.getWatchPaths();
    if (watchPaths.length > 0) {
      this.fsWatcher = watch(watchPaths, {
        ignoreInitial: true,
        depth: 1,
      });
      this.fsWatcher.on("all", () => this.debouncedRefresh());
    }

    // Poll cold paths
    this.pollTimer = setInterval(() => this.forceRefresh(), this.pollIntervalMs);

    // Initial load
    this.forceRefresh();
  }

  stop(): void {
    this.fsWatcher?.close();
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  async forceRefresh(): Promise<void> {
    try {
      const state = await this.adapter.collectState();
      this.onStateChange(state);
    } catch {
      // Adapter-level errors are handled internally
    }
  }

  private debouncedRefresh(): void {
    if (this.debounceTimer) {
      this.refreshQueued = true;
      return;
    }
    this.forceRefresh();
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.refreshQueued) {
        this.refreshQueued = false;
        this.forceRefresh();
      }
    }, this.debounceMs);
  }
}
```

- [ ] **Step 2: Write watcher tests**

`tests/watcher.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { Watcher } from "../src/watcher.js";
import { emptyState, CLIAdapter, DashboardState, TechniqueConfig } from "../src/adapters/types.js";

function mockAdapter(state?: Partial<DashboardState>): CLIAdapter {
  return {
    name: "mock",
    displayName: "Mock",
    dataDir: "/tmp/mock",
    rulesFile: "MOCK.md",
    collectState: vi.fn().mockResolvedValue({ ...emptyState(), ...state }),
    getWatchPaths: () => [],
    getPollPaths: () => [],
    getTechniqueOverrides: () => new Map<string, TechniqueConfig>(),
  };
}

describe("Watcher", () => {
  it("calls onStateChange on start", async () => {
    const adapter = mockAdapter({ activeSessions: 2 });
    const onChange = vi.fn();
    const watcher = new Watcher({ adapter, onStateChange: onChange, pollIntervalMs: 60000 });

    watcher.start();
    // Wait for initial async refresh
    await new Promise((r) => setTimeout(r, 50));
    watcher.stop();

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ activeSessions: 2 }));
  });

  it("forceRefresh triggers immediate state callback", async () => {
    const adapter = mockAdapter();
    const onChange = vi.fn();
    const watcher = new Watcher({ adapter, onStateChange: onChange, pollIntervalMs: 60000 });

    await watcher.forceRefresh();

    expect(onChange).toHaveBeenCalled();
    expect(adapter.collectState).toHaveBeenCalled();
    watcher.stop();
  });

  it("stop cleans up without errors", () => {
    const adapter = mockAdapter();
    const watcher = new Watcher({ adapter, onStateChange: vi.fn(), pollIntervalMs: 60000 });
    watcher.start();
    expect(() => watcher.stop()).not.toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Watcher` not found

- [ ] **Step 4: Verify build and tests pass after implementation**

Run: `npm run build && npm test`
Expected: Clean compile, watcher tests pass

- [ ] **Step 5: Commit**

```bash
git add src/watcher.ts tests/watcher.test.ts
git commit -m "feat: add hybrid watcher with chokidar + polling and debounce"
```

---

### Task 6: Dashboard Hook

**Files:**
- Create: `src/hooks/use-dashboard.ts`
- Create: `src/hooks/use-tips.ts`

- [ ] **Step 1: Create the central dashboard hook**

`src/hooks/use-dashboard.ts`:
```ts
import { useState, useEffect, useRef, useCallback } from "react";
import { CLIAdapter, DashboardState, emptyState } from "../adapters/types.js";
import { Watcher } from "../watcher.js";

export function useDashboard(adapter: CLIAdapter): {
  state: DashboardState;
  forceRefresh: () => void;
} {
  const [state, setState] = useState<DashboardState>(emptyState());
  const watcherRef = useRef<Watcher | null>(null);

  useEffect(() => {
    const watcher = new Watcher({
      adapter,
      onStateChange: setState,
    });
    watcherRef.current = watcher;
    watcher.start();
    return () => watcher.stop();
  }, [adapter]);

  const forceRefresh = useCallback(() => {
    watcherRef.current?.forceRefresh();
  }, []);

  return { state, forceRefresh };
}
```

- [ ] **Step 2: Create the tips hook**

`src/hooks/use-tips.ts`:
```ts
import { useMemo, useState, useEffect, useCallback } from "react";
import { DashboardState } from "../adapters/types.js";
import { evaluate, EvaluationResult } from "../tips/evaluator.js";
import { Technique } from "../tips/database.js";

const RECOMMENDATIONS_PER_PAGE = 4;
const ROTATION_INTERVAL_MS = 10000;

export function useTips(state: DashboardState): {
  alerts: Technique[];
  recommendations: Technique[];
  nextRecommendations: () => void;
  prevRecommendations: () => void;
} {
  const [page, setPage] = useState(0);

  const { alerts, recommendations: allRecs } = useMemo(
    () => evaluate(state),
    [state]
  );

  // Auto-rotate recommendations
  useEffect(() => {
    const timer = setInterval(() => {
      setPage((p) => {
        const maxPage = Math.max(
          0,
          Math.ceil(allRecs.length / RECOMMENDATIONS_PER_PAGE) - 1
        );
        return (p + 1) % (maxPage + 1);
      });
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [allRecs.length]);

  const start = page * RECOMMENDATIONS_PER_PAGE;
  const recommendations = allRecs.slice(
    start,
    start + RECOMMENDATIONS_PER_PAGE
  );

  const nextRecommendations = useCallback(() => {
    setPage((p) => {
      const maxPage = Math.max(
        0,
        Math.ceil(allRecs.length / RECOMMENDATIONS_PER_PAGE) - 1
      );
      return (p + 1) % (maxPage + 1);
    });
  }, [allRecs.length]);

  const prevRecommendations = useCallback(() => {
    setPage((p) => {
      const maxPage = Math.max(
        0,
        Math.ceil(allRecs.length / RECOMMENDATIONS_PER_PAGE) - 1
      );
      return p === 0 ? maxPage : p - 1;
    });
  }, [allRecs.length]);

  return { alerts, recommendations, nextRecommendations, prevRecommendations };
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean compile

- [ ] **Step 4: Commit**

```bash
git add src/hooks/
git commit -m "feat: add useDashboard and useTips hooks"
```

---

### Task 7: Panel Components

**Files:**
- Create: `src/panels/box.tsx`
- Create: `src/panels/token-metrics.tsx`
- Create: `src/panels/session-info.tsx`
- Create: `src/panels/active-alerts.tsx`
- Create: `src/panels/recommendations.tsx`
- Create: `src/panels/environment.tsx`
- Create: `src/panels/history.tsx`
- Create: `src/panels/status-bar.tsx`
- Create: `tests/panels/panels.test.tsx`

- [ ] **Step 1: Write failing panel tests**

`tests/panels/panels.test.tsx`:
```tsx
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { TokenMetrics } from "../../src/panels/token-metrics.js";
import { SessionInfo } from "../../src/panels/session-info.js";
import { ActiveAlerts } from "../../src/panels/active-alerts.js";
import { Recommendations } from "../../src/panels/recommendations.js";
import { Environment } from "../../src/panels/environment.js";
import { History } from "../../src/panels/history.js";
import { StatusBar } from "../../src/panels/status-bar.js";
import { emptyState } from "../../src/adapters/types.js";

const mockState = {
  ...emptyState(),
  totalInputTokens: 500000,
  totalOutputTokens: 120000,
  totalCacheReadTokens: 350000,
  totalCostUsd: 12.5,
  sessionAgeMs: 4800000,
  sessionMessages: 34,
  activeSessions: 2,
  mcpServerCount: 3,
  mcpServersEnabled: 2,
  pluginCount: 4,
  claudeMdLines: 142,
};

describe("Panel Components", () => {
  it("TokenMetrics renders token counts", () => {
    const { lastFrame } = render(<TokenMetrics state={mockState} />);
    expect(lastFrame()).toContain("500");
  });

  it("SessionInfo renders session age", () => {
    const { lastFrame } = render(<SessionInfo state={mockState} />);
    expect(lastFrame()).toContain("1h 20m");
  });

  it("ActiveAlerts renders empty when no alerts", () => {
    const { lastFrame } = render(<ActiveAlerts alerts={[]} />);
    expect(lastFrame()).toContain("No active alerts");
  });

  it("Environment renders MCP count", () => {
    const { lastFrame } = render(<Environment state={mockState} />);
    expect(lastFrame()).toContain("3");
  });

  it("History renders empty state", () => {
    const { lastFrame } = render(<History turns={[]} />);
    expect(lastFrame()).toContain("No history");
  });

  it("StatusBar renders alert count", () => {
    const { lastFrame } = render(
      <StatusBar alertCount={3} watchPath="~/.claude" />
    );
    expect(lastFrame()).toContain("3 alerts");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — components not found

- [ ] **Step 3: Implement Panel<Box> (reusable bordered panel)**

`src/panels/box.tsx`:
```tsx
import React from "react";
import { Box, Text } from "ink";

interface PanelBoxProps {
  title: string;
  titleColor?: string;
  children: React.ReactNode;
  width?: string | number;
  height?: number;
}

export function PanelBox({
  title,
  titleColor = "cyan",
  children,
  width,
  height,
}: PanelBoxProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      width={width}
      height={height}
    >
      <Text color={titleColor} bold dimColor>
        {" "}
        {title}{" "}
      </Text>
      {children}
    </Box>
  );
}
```

- [ ] **Step 4: Implement all 7 panels**

Implement each panel component as a focused React/Ink component. Each receives its data as props (from DashboardState or evaluated tips). Panels use `PanelBox` for consistent borders and titles.

Key formatting helpers needed:
- `formatDuration(ms)` → "1h 20m"
- `formatTokens(n)` → "12.4K" or "1.2M"
- `formatCost(usd)` → "$0.42"

These go in each panel file or a shared `src/panels/format.ts` if reused by 3+ panels.

Each panel:
- **TokenMetrics**: shows aggregate totals (in/out/cache/cost) or live data when available
- **SessionInfo**: shows session age, message count, active sessions, peak indicator
- **ActiveAlerts**: maps triggered techniques to colored rows with category icons
- **Recommendations**: 2-column grid of non-triggered technique summaries
- **Environment**: MCP on/off, plugins, CLAUDE.md lines, hooks
- **History**: recent turns with timestamps, truncated display text
- **StatusBar**: clock, watch path, alert count, keybinding hints

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All panel tests pass

- [ ] **Step 6: Commit**

```bash
git add src/panels/ tests/panels/
git commit -m "feat: implement all dashboard panel components"
```

---

### Task 8: App Layout & Keybindings

**Files:**
- Modify: `src/app.tsx`
- Modify: `src/index.tsx`

- [ ] **Step 1: Update app.tsx to compose all panels with keybindings**

Wire up the full layout in `src/app.tsx`:
- Accept CLI options as props (dataDir, sessionId, pollInterval)
- Create `ClaudeAdapter` with options
- Use `useDashboard(adapter)` for state + forceRefresh
- Use `useTips(state)` for alerts + recommendations
- Use Ink's `useInput` for keybindings: q/Ctrl+C quit, r refresh, n/p tip nav
- Compose panels in flexbox matching the spec layout:
  - Row 1: `<TokenMetrics>` (75%) + `<SessionInfo>` (25%)
  - Row 2: `<ActiveAlerts>` (full width)
  - Row 3: `<Recommendations>` (full width)
  - Row 4: `<Environment>` (35%) + `<History>` (65%)
  - Row 5: `<StatusBar>` (full width)

- [ ] **Step 2: Update index.tsx to parse CLI args**

Parse `--cli`, `--poll`, `--data-dir`, `--session` from `process.argv` (simple manual parsing, no dependency needed). Pass to `<App />`.

- [ ] **Step 3: Build and manual test**

Run: `npm run build && node dist/index.js`
Expected: Full dashboard renders with real data from `~/.claude/`, keybindings work, Ctrl+C exits cleanly

- [ ] **Step 4: Commit**

```bash
git add src/app.tsx src/index.tsx
git commit -m "feat: wire up full dashboard layout with keybindings"
```

---

### Task 9: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the README**

Following the spec's README plan (9 sections): what it is, screenshot placeholder, quick start, what you see (layout diagram), techniques overview, supported CLIs, configuration, how it works, contributing an adapter.

Friendly tone, concise, practical. Include the ASCII layout diagram from the spec.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage guide and layout diagram"
```

---

### Task 10: Integration Test & Polish

**Files:**
- Modify: various — fix any issues found during integration testing

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Build and run against real Claude data**

Run: `npm run build && node dist/index.js`
Expected: Dashboard populates with real data from `~/.claude/`, alerts trigger based on current state, keybindings work

- [ ] **Step 3: Test graceful degradation**

Run: `node dist/index.js --data-dir /tmp/empty-claude`
Expected: Dashboard shows "Waiting for session" / "No usage data" placeholders, does not crash

- [ ] **Step 4: Test terminal resize**

Resize terminal to 80x24 minimum. Verify layout fits without overflow.

- [ ] **Step 5: Fix any issues found**

Address any rendering, data, or keybinding issues.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "fix: integration polish and edge case handling"
```
