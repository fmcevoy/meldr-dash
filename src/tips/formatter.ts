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
