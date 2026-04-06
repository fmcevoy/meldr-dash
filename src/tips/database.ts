import { DashboardState, SessionSummary } from "../adapters/types.js";

// Module-level variable set by the evaluator before running conditions.
// This avoids changing every condition function signature.
let _selectedSessionId: string | undefined;

function selectedSession(s: DashboardState): SessionSummary | undefined {
  if (_selectedSessionId) {
    return s.sessionList.find((sess) => sess.sessionId === _selectedSessionId);
  }
  return s.sessionList.find((sess) => sess.isSelected);
}

export function setSelectedSessionForEval(id: string | undefined): void {
  _selectedSessionId = id;
}

export interface Technique {
  id: string;
  title: string;
  description: string;
  category: string;
  impact: "High" | "Medium";
  kind: "monitor" | "tip";
  platforms: string[];
  command: string | null;
  fix: string | null;
  fixByPlatform?: Record<string, string>;
  condition: ((state: DashboardState) => boolean) | null;
}

/** Return the platform-specific fix text, falling back to the default fix. */
export function getFix(t: Technique, platform: string): string | null {
  return t.fixByPlatform?.[platform] ?? t.fix;
}

const allPlatforms = ["claude", "codex", "cursor", "gemini"];
const claudeOnly = ["claude"];

export const techniques: Technique[] = [
  // ── Context Hygiene (8) ──────────────────────────────────────────────
  {
    id: "clear-context",
    title: "Clear Context Between Tasks",
    description:
      "Start fresh between unrelated tasks so the model isn't confused by stale context.",
    category: "context-hygiene",
    impact: "High",
    kind: "monitor",
    platforms: allPlatforms,
    command: "/clear",
    fix: "Run /clear or start a new session with 'claude'",
    fixByPlatform: {
      cursor: "Start a new Composer session",
      codex: "Run /clear or start a new session with 'codex'",
      gemini: "Start a new session with 'gemini'",
    },
    condition: (s) => s.sessionAgeMs > 1800000,
  },
  {
    id: "keep-rules-lean",
    title: "Keep Your Rules File Lean",
    description:
      "A bloated rules file wastes context tokens and can confuse the model with contradictory guidance.",
    category: "context-hygiene",
    impact: "High",
    kind: "monitor",
    platforms: allPlatforms,
    command: null,
    fix: "Trim CLAUDE.md to <200 lines; move verbose docs to separate files",
    fixByPlatform: {
      cursor: "Trim .cursor/rules/ files to <200 total lines; split verbose rules into separate .mdc files",
      gemini: "Trim GEMINI.md to <200 lines; move verbose docs to separate files",
      codex: "Trim AGENTS.md to <200 lines; move verbose docs to separate files",
    },
    condition: (s) => (selectedSession(s)?.rulesLines ?? 0) > 200,
  },
  {
    id: "surgical-file-refs",
    title: "Surgical File References",
    description:
      "Point the model at exactly the files it needs instead of letting it search the whole repo.",
    category: "context-hygiene",
    impact: "High",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Use @file or paste paths instead of 'find the file that does X'",
    condition: null,
  },
  {
    id: "exclude-files",
    title: "Exclude Irrelevant Files",
    description:
      "Use an ignore file to keep build artifacts, vendor dirs, and generated code out of context.",
    category: "context-hygiene",
    impact: "High",
    kind: "monitor",
    platforms: ["claude", "cursor", "gemini"],
    command: null,
    fix: "Create .claudeignore in project root with: node_modules/, dist/, .git/",
    fixByPlatform: {
      cursor: "Create .cursorignore in project root with: node_modules/, dist/, .git/",
      gemini: "Create .geminiignore in project root with: node_modules/, dist/, .git/",
      codex: "Codex has no ignore file; use config.toml options like ignore_large_untracked_files",
    },
    condition: (s) => !(selectedSession(s)?.hasIgnoreFile ?? false),
  },
  {
    id: "compact-before-limit",
    title: "Compact Before Hitting the Limit",
    description:
      "Run /compact when context usage is high rather than waiting for the auto-compact wall.",
    category: "context-hygiene",
    impact: "High",
    kind: "monitor",
    platforms: allPlatforms,
    command: "/compact",
    fix: "Run /compact now before auto-compact triggers",
    condition: (s) => {
      const sess = selectedSession(s);
      if (!sess || sess.contextPercent <= 75) return false;
      // Don't alert if they ran /compact recently (within last 2 min)
      if (sess.lastCompactMs > 0 && (Date.now() - sess.lastCompactMs) < 120000) return false;
      return true;
    },
  },
  {
    id: "tame-output",
    title: "Tame Command Output Bloat",
    description:
      "Pipe long command output through head/tail or redirect to a file so it doesn't flood context.",
    category: "context-hygiene",
    impact: "Medium",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Pipe verbose commands through | head -50 or redirect to a file",
    condition: null,
  },
  {
    id: "cache-ttl-warning",
    title: "Mind the Prompt Cache TTL",
    description:
      "Long pauses between messages evict the prompt cache, increasing cost on the next turn.",
    category: "context-hygiene",
    impact: "High",
    kind: "monitor",
    platforms: allPlatforms,
    command: null,
    fix: "Send a message within 5min to keep cache warm",
    condition: (s) => s.timeSinceLastMessageMs > 240000,
  },
  {
    id: "enable-sounds",
    title: "Enable Completion Sounds",
    description:
      "Turn on terminal bell / notification sounds so you know when the model finishes.",
    category: "context-hygiene",
    impact: "Medium",
    kind: "monitor",
    platforms: claudeOnly,
    command: null,
    fix: "Set notifications.enabled: true in ~/.claude/settings.json",
    condition: (s) => !s.hasNotificationsEnabled,
  },

  // ── Prompting Strategy (8) ───────────────────────────────────────────
  {
    id: "plan-mode-first",
    title: "Use Plan Mode First",
    description:
      "Ask the model to plan before coding so you can catch design issues early.",
    category: "prompting-strategy",
    impact: "High",
    kind: "tip",
    platforms: allPlatforms,
    command: "/plan",
    fix: "Run /plan to outline approach before coding",
    condition: (s) =>
      s.sessionMessages > 10 &&
      !s.recentTurns.some((t) => t.display.includes("/plan")),
  },
  {
    id: "feed-precise-context",
    title: "Feed Precise Context",
    description:
      "Give the model exactly the information it needs — not too much, not too little.",
    category: "prompting-strategy",
    impact: "High",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Include relevant error messages, file paths, and constraints in your prompt",
    condition: null,
  },
  {
    id: "dont-paste-blobs",
    title: "Don't Paste Large Blobs",
    description:
      "Avoid pasting huge logs or files directly into the prompt — use file references instead.",
    category: "prompting-strategy",
    impact: "High",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Reference files by path; paste only the relevant snippet, not the whole file",
    condition: null,
  },
  {
    id: "batch-changes",
    title: "Batch Related Changes",
    description:
      "Group related edits into a single prompt so the model has full context for coherent changes.",
    category: "prompting-strategy",
    impact: "High",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Ask for all related edits in one message instead of one file at a time",
    condition: null,
  },
  {
    id: "watch-dont-interrupt",
    title: "Watch, Don't Interrupt",
    description:
      "Let the model finish its chain of thought before jumping in with corrections.",
    category: "prompting-strategy",
    impact: "High",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Wait for the model to finish before sending corrections or follow-ups",
    condition: null,
  },
  {
    id: "use-ask-mode",
    title: "Use Ask / Read-Only Mode",
    description:
      "Switch to read-only mode for exploratory questions to prevent unintended edits.",
    category: "prompting-strategy",
    impact: "Medium",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Start with 'claude --chat' or use /chat for questions that don't need edits",
    fixByPlatform: {
      cursor: "Use Cursor's Chat panel instead of Composer for read-only questions",
      gemini: "Use a read-only prompt or ask-only session for exploratory questions",
      codex: "Start with 'codex --read-only' for questions that don't need edits",
    },
    condition: null,
  },
  {
    id: "use-btw",
    title: "Use /btw for Side Questions",
    description:
      "Fire off tangential questions with /btw so they don't derail the main task.",
    category: "prompting-strategy",
    impact: "Medium",
    kind: "tip",
    platforms: claudeOnly,
    command: "/btw",
    fix: "Run /btw 'quick question' to ask without interrupting the main task",
    condition: null,
  },
  {
    id: "inspect-before-commit",
    title: "Inspect Before You Commit",
    description:
      "Review diffs and run /cost before committing to catch mistakes and overspend.",
    category: "prompting-strategy",
    impact: "Medium",
    kind: "monitor",
    platforms: allPlatforms,
    command: "/cost",
    fix: "Run /cost to check session spend before committing",
    condition: (s) => {
      const sess = selectedSession(s);
      if (!sess || sess.messageCount < 5) return false;
      // Never run /cost in this session
      return sess.lastCostCheckMs === 0;
    },
  },

  // ── Model Routing (1) ───────────────────────────────────────────────
  {
    id: "right-model-for-job",
    title: "Use the Right Model for the Job",
    description:
      "Use a smaller model for simple tasks to save cost; reserve the big model for hard problems.",
    category: "model-routing",
    impact: "High",
    kind: "monitor",
    platforms: allPlatforms,
    command: "/model",
    fix: "Run /model to switch to Sonnet for simple tasks",
    fixByPlatform: {
      gemini: "Switch to Gemini Flash for simple tasks",
      codex: "Switch to a smaller model (codex-mini or gpt-4.1-mini) for simple tasks",
      cursor: "Switch to a faster model in Cursor settings for simple tasks",
    },
    condition: (s) => {
      const model = selectedSession(s)?.model ?? s.liveModel;
      if (!model) return false;
      return model.includes("opus") || model.includes("5.4") || model.includes("o3") || model.includes("2.5-pro");
    },
  },

  // ── Agent Architecture (7) ──────────────────────────────────────────
  {
    id: "subagents-fresh-context",
    title: "Subagents = Fresh Context",
    description:
      "Spin up subagents for isolated subtasks so they start with a clean context window.",
    category: "agent-architecture",
    impact: "High",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Use Task tool or Agent tool to spin off isolated subtasks",
    condition: null,
  },
  {
    id: "disconnect-mcps",
    title: "Disconnect Unused MCPs",
    description:
      "Each connected MCP server adds tool descriptions that consume context tokens.",
    category: "agent-architecture",
    impact: "Medium",
    kind: "monitor",
    platforms: allPlatforms,
    command: null,
    fix: "Disable unused MCP servers in .mcp.json (set disabled: true)",
    fixByPlatform: {
      cursor: "Disable unused MCP servers in Cursor Settings > MCP",
      gemini: "Disable unused MCP servers in ~/.gemini/settings.json mcpServers",
      codex: "Disable unused MCP servers in ~/.codex/config.toml [mcp_servers]",
    },
    condition: (s) => (selectedSession(s)?.mcpServerCount ?? 0) > 3,
  },
  {
    id: "prefer-native-cli",
    title: "Prefer Native CLIs Over MCPs",
    description:
      "Use native CLI tools (git, docker, npm) directly rather than wrapping them in MCP servers.",
    category: "agent-architecture",
    impact: "Medium",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Use Bash tool for git/npm/docker instead of adding MCP wrappers",
    condition: null,
  },
  {
    id: "manage-plugins",
    title: "Manage Plugins",
    description:
      "Too many plugins add overhead; keep only the ones you actively use.",
    category: "agent-architecture",
    impact: "Medium",
    kind: "monitor",
    platforms: allPlatforms,
    command: null,
    fix: "Remove unused plugins from ~/.claude/settings.json enabledPlugins",
    fixByPlatform: {
      cursor: "Remove unused extensions from Cursor's Extensions panel",
      gemini: "Remove unused extensions from ~/.gemini/settings.json",
      codex: "Remove unused plugins from ~/.codex/config.toml",
    },
    condition: (s) => s.pluginCount > 5,
  },
  {
    id: "use-skills",
    title: "Use Skills",
    description:
      "Package repeatable workflows as skills for consistent, one-command execution.",
    category: "agent-architecture",
    impact: "High",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Create skills in .claude/skills/ for repeatable multi-step workflows",
    fixByPlatform: {
      cursor: "Create reusable rule files in .cursor/rules/ for repeatable workflows",
      codex: "Create skills in ~/.codex/config.toml [skills] for repeatable workflows",
    },
    condition: null,
  },
  {
    id: "reduce-thinking",
    title: "Reduce Thinking Effort",
    description:
      "Lower the thinking budget for straightforward tasks to save tokens and time.",
    category: "agent-architecture",
    impact: "High",
    kind: "monitor",
    platforms: allPlatforms,
    command: "/effort",
    fix: "Run /effort to lower thinking budget for simple tasks",
    fixByPlatform: {
      gemini: "Use a lighter model (Flash) for straightforward tasks",
      codex: "Use a smaller model for straightforward tasks to reduce reasoning tokens",
      cursor: "Switch to a faster model for straightforward tasks",
    },
    condition: (s) => {
      const model = selectedSession(s)?.model ?? s.liveModel;
      if (!model) return false;
      return model.includes("opus") || model.includes("o3") || model.includes("2.5-pro");
    },
  },
  {
    id: "automate-hooks",
    title: "Automate With Hooks",
    description:
      "Set up hooks to automate repetitive checks (lint, test, format) on every change.",
    category: "agent-architecture",
    impact: "High",
    kind: "monitor",
    platforms: allPlatforms,
    command: null,
    fix: "Add hooks in ~/.claude/settings.json for lint/test on changes",
    fixByPlatform: {
      cursor: "Add hooks in .cursor/hooks.json for lint/test on changes",
      codex: "Add hooks in ~/.codex/config.toml for lint/test on changes",
    },
    condition: (s) => s.hookCount === 0,
  },

  // ── Cost & Limit Management (5) ─────────────────────────────────────
  {
    id: "persist-decisions",
    title: "Persist Decisions & Learnings",
    description:
      "Write key decisions to your rules file so the model remembers them across sessions.",
    category: "cost-management",
    impact: "High",
    kind: "monitor",
    platforms: allPlatforms,
    command: null,
    fix: "Add key decisions to CLAUDE.md so they persist across sessions",
    fixByPlatform: {
      cursor: "Add key decisions to .cursor/rules/ files so they persist across sessions",
      gemini: "Add key decisions to GEMINI.md so they persist across sessions",
      codex: "Add key decisions to AGENTS.md so they persist across sessions",
    },
    condition: (s) => s.sessionMessages > 15 && (selectedSession(s)?.rulesLines ?? 0) < 10,
  },
  {
    id: "track-spend",
    title: "Track Spend Per Session",
    description:
      "Periodically check /cost to stay aware of how much the current session is costing.",
    category: "cost-management",
    impact: "High",
    kind: "monitor",
    platforms: allPlatforms,
    command: "/cost",
    fix: "Run /cost to see current session spend",
    condition: (s) => {
      const sess = selectedSession(s);
      if (!sess || sess.messageCount < 10) return false;
      // Never checked cost, or last check was >30min ago
      if (sess.lastCostCheckMs === 0) return true;
      return (Date.now() - sess.lastCostCheckMs) > 1800000;
    },
  },
  {
    id: "cap-context-window",
    title: "Cap Context Window & Thinking Budget",
    description:
      "Set environment variables to auto-compact and cap thinking so runaway sessions stay in budget.",
    category: "cost-management",
    impact: "High",
    kind: "monitor",
    platforms: allPlatforms,
    command: null,
    fix: "Set CLAUDE_AUTO_COMPACT=true in your shell profile",
    fixByPlatform: {
      cursor: "Cursor manages context automatically; consider starting new Composer sessions for large tasks",
      gemini: "Gemini CLI manages context automatically; start new sessions for large tasks",
      codex: "Codex manages context automatically; start new sessions for large tasks",
    },
    condition: (s) => !s.hasAutoCompactEnv,
  },
  {
    id: "resume-sessions",
    title: "Resume Instead of Rebuilding",
    description:
      "Use /resume to pick up where you left off instead of re-explaining everything.",
    category: "cost-management",
    impact: "High",
    kind: "tip",
    platforms: allPlatforms,
    command: "/resume",
    fix: "Run /resume to continue a previous session instead of re-explaining context",
    condition: null,
  },
  {
    id: "schedule-off-peak",
    title: "Schedule Around Peak Hours",
    description:
      "Run heavy workloads during off-peak hours when rate limits are more generous.",
    category: "cost-management",
    impact: "Medium",
    kind: "monitor",
    platforms: allPlatforms,
    command: null,
    fix: "Schedule heavy tasks for off-peak hours (before 9am or after 5pm)",
    condition: (s) => s.isPeakHours,
  },

  // ── Meta (1) ─────────────────────────────────────────────────────────
  {
    id: "meta-rule",
    title: "The Meta-Rule",
    description:
      "Continuously refine your workflow — the best practices today will evolve tomorrow.",
    category: "meta",
    impact: "High",
    kind: "tip",
    platforms: allPlatforms,
    command: null,
    fix: "Review your CLAUDE.md and workflow weekly; remove what's stale, add what works",
    fixByPlatform: {
      cursor: "Review your .cursor/rules/ and workflow weekly; remove what's stale, add what works",
      gemini: "Review your GEMINI.md and workflow weekly; remove what's stale, add what works",
      codex: "Review your AGENTS.md and workflow weekly; remove what's stale, add what works",
    },
    condition: null,
  },
];

export function getTechniqueById(id: string): Technique | undefined {
  return techniques.find((t) => t.id === id);
}
