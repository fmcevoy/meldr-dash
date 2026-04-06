import { DashboardState } from "../adapters/types.js";
import { techniques, Technique, setSelectedSessionForEval } from "./database.js";

export interface EvaluationResult {
  alerts: Technique[];
  monitors: Technique[];
  allTips: Technique[];
}

function sortByImpact(arr: Technique[]): Technique[] {
  return arr.sort((a, b) => {
    if (a.impact === "High" && b.impact !== "High") return -1;
    if (a.impact !== "High" && b.impact === "High") return 1;
    return 0;
  });
}

export function evaluate(
  state: DashboardState,
  selectedSessionId?: string,
): EvaluationResult {
  setSelectedSessionForEval(selectedSessionId);

  const platform = state.platform || "claude";
  const platformTechniques = techniques.filter((t) => t.platforms.includes(platform));

  const monitors: Technique[] = [];

  for (const technique of platformTechniques) {
    if (technique.condition && technique.condition(state) && technique.kind === "monitor") {
      monitors.push(technique);
    }
  }

  sortByImpact(monitors);

  // Tips: all kind="tip" techniques for this platform
  const allTips = platformTechniques.filter((t) => t.kind === "tip");

  return { alerts: monitors, monitors, allTips };
}
