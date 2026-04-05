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
