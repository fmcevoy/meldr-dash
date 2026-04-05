import { DashboardState } from "../adapters/types.js";

export interface Technique {
  id: string;
  title: string;
  description: string;
  category: string;
  impact: "High" | "Medium";
  platforms: string[];
  command: string | null;
  condition: ((state: DashboardState) => boolean) | null;
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
    platforms: allPlatforms,
    command: "/clear",
    condition: (s) => s.sessionAgeMs > 1800000,
  },
  {
    id: "keep-rules-lean",
    title: "Keep Your Rules File Lean",
    description:
      "A bloated rules file wastes context tokens and can confuse the model with contradictory guidance.",
    category: "context-hygiene",
    impact: "High",
    platforms: allPlatforms,
    command: null,
    condition: (s) => s.claudeMdLines > 200,
  },
  {
    id: "surgical-file-refs",
    title: "Surgical File References",
    description:
      "Point the model at exactly the files it needs instead of letting it search the whole repo.",
    category: "context-hygiene",
    impact: "High",
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
  {
    id: "exclude-files",
    title: "Exclude Irrelevant Files",
    description:
      "Use an ignore file to keep build artifacts, vendor dirs, and generated code out of context.",
    category: "context-hygiene",
    impact: "High",
    platforms: allPlatforms,
    command: null,
    condition: (s) => !s.hasIgnoreFile,
  },
  {
    id: "compact-before-limit",
    title: "Compact Before Hitting the Limit",
    description:
      "Run /compact when context usage is high rather than waiting for the auto-compact wall.",
    category: "context-hygiene",
    impact: "High",
    platforms: allPlatforms,
    command: "/compact",
    condition: (s) =>
      s.liveContextPercent !== null && s.liveContextPercent > 75,
  },
  {
    id: "tame-output",
    title: "Tame Command Output Bloat",
    description:
      "Pipe long command output through head/tail or redirect to a file so it doesn't flood context.",
    category: "context-hygiene",
    impact: "Medium",
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
  {
    id: "cache-ttl-warning",
    title: "Mind the Prompt Cache TTL",
    description:
      "Long pauses between messages evict the prompt cache, increasing cost on the next turn.",
    category: "context-hygiene",
    impact: "High",
    platforms: allPlatforms,
    command: null,
    condition: (s) => s.timeSinceLastMessageMs > 240000,
  },
  {
    id: "enable-sounds",
    title: "Enable Completion Sounds",
    description:
      "Turn on terminal bell / notification sounds so you know when the model finishes.",
    category: "context-hygiene",
    impact: "Medium",
    platforms: claudeOnly,
    command: null,
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
    platforms: allPlatforms,
    command: "/plan",
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
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
  {
    id: "dont-paste-blobs",
    title: "Don't Paste Large Blobs",
    description:
      "Avoid pasting huge logs or files directly into the prompt — use file references instead.",
    category: "prompting-strategy",
    impact: "High",
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
  {
    id: "batch-changes",
    title: "Batch Related Changes",
    description:
      "Group related edits into a single prompt so the model has full context for coherent changes.",
    category: "prompting-strategy",
    impact: "High",
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
  {
    id: "watch-dont-interrupt",
    title: "Watch, Don't Interrupt",
    description:
      "Let the model finish its chain of thought before jumping in with corrections.",
    category: "prompting-strategy",
    impact: "High",
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
  {
    id: "use-ask-mode",
    title: "Use Ask / Read-Only Mode",
    description:
      "Switch to read-only mode for exploratory questions to prevent unintended edits.",
    category: "prompting-strategy",
    impact: "Medium",
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
  {
    id: "use-btw",
    title: "Use /btw for Side Questions",
    description:
      "Fire off tangential questions with /btw so they don't derail the main task.",
    category: "prompting-strategy",
    impact: "Medium",
    platforms: claudeOnly,
    command: "/btw",
    condition: null,
  },
  {
    id: "inspect-before-commit",
    title: "Inspect Before You Commit",
    description:
      "Review diffs and run /cost before committing to catch mistakes and overspend.",
    category: "prompting-strategy",
    impact: "Medium",
    platforms: allPlatforms,
    command: "/cost",
    condition: (s) =>
      !s.recentTurns.some((t) => t.display.includes("/cost")),
  },

  // ── Model Routing (1) ───────────────────────────────────────────────
  {
    id: "right-model-for-job",
    title: "Use the Right Model for the Job",
    description:
      "Use a smaller model for simple tasks to save cost; reserve the big model for hard problems.",
    category: "model-routing",
    impact: "High",
    platforms: allPlatforms,
    command: "/model",
    condition: (s) =>
      s.liveModel !== null &&
      (s.liveModel.includes("opus") || s.liveModel.includes("5.4")),
  },

  // ── Agent Architecture (7) ──────────────────────────────────────────
  {
    id: "subagents-fresh-context",
    title: "Subagents = Fresh Context",
    description:
      "Spin up subagents for isolated subtasks so they start with a clean context window.",
    category: "agent-architecture",
    impact: "High",
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
  {
    id: "disconnect-mcps",
    title: "Disconnect Unused MCPs",
    description:
      "Each connected MCP server adds tool descriptions that consume context tokens.",
    category: "agent-architecture",
    impact: "Medium",
    platforms: allPlatforms,
    command: null,
    condition: (s) => s.mcpServerCount > 3,
  },
  {
    id: "prefer-native-cli",
    title: "Prefer Native CLIs Over MCPs",
    description:
      "Use native CLI tools (git, docker, npm) directly rather than wrapping them in MCP servers.",
    category: "agent-architecture",
    impact: "Medium",
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
  {
    id: "manage-plugins",
    title: "Manage Plugins",
    description:
      "Too many plugins add overhead; keep only the ones you actively use.",
    category: "agent-architecture",
    impact: "Medium",
    platforms: allPlatforms,
    command: null,
    condition: (s) => s.pluginCount > 5,
  },
  {
    id: "use-skills",
    title: "Use Skills",
    description:
      "Package repeatable workflows as skills for consistent, one-command execution.",
    category: "agent-architecture",
    impact: "High",
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
  {
    id: "reduce-thinking",
    title: "Reduce Thinking Effort",
    description:
      "Lower the thinking budget for straightforward tasks to save tokens and time.",
    category: "agent-architecture",
    impact: "High",
    platforms: allPlatforms,
    command: "/effort",
    condition: (s) =>
      s.liveModel !== null && s.liveModel.includes("opus"),
  },
  {
    id: "automate-hooks",
    title: "Automate With Hooks",
    description:
      "Set up hooks to automate repetitive checks (lint, test, format) on every change.",
    category: "agent-architecture",
    impact: "High",
    platforms: allPlatforms,
    command: null,
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
    platforms: allPlatforms,
    command: null,
    condition: (s) => s.sessionMessages > 15 && s.claudeMdLines < 10,
  },
  {
    id: "track-spend",
    title: "Track Spend Per Session",
    description:
      "Periodically check /cost to stay aware of how much the current session is costing.",
    category: "cost-management",
    impact: "High",
    platforms: allPlatforms,
    command: "/cost",
    condition: (s) =>
      !s.recentTurns.some((t) => t.display.includes("/cost")),
  },
  {
    id: "cap-context-window",
    title: "Cap Context Window & Thinking Budget",
    description:
      "Set environment variables to auto-compact and cap thinking so runaway sessions stay in budget.",
    category: "cost-management",
    impact: "High",
    platforms: allPlatforms,
    command: null,
    condition: (s) => !s.hasAutoCompactEnv,
  },
  {
    id: "resume-sessions",
    title: "Resume Instead of Rebuilding",
    description:
      "Use /resume to pick up where you left off instead of re-explaining everything.",
    category: "cost-management",
    impact: "High",
    platforms: allPlatforms,
    command: "/resume",
    condition: null,
  },
  {
    id: "schedule-off-peak",
    title: "Schedule Around Peak Hours",
    description:
      "Run heavy workloads during off-peak hours when rate limits are more generous.",
    category: "cost-management",
    impact: "Medium",
    platforms: allPlatforms,
    command: null,
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
    platforms: allPlatforms,
    command: null,
    condition: null,
  },
];

export function getTechniqueById(id: string): Technique | undefined {
  return techniques.find((t) => t.id === id);
}
