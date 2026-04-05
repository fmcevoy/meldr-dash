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

  alerts.sort((a, b) => {
    if (a.impact === "High" && b.impact !== "High") return -1;
    if (a.impact !== "High" && b.impact === "High") return 1;
    return 0;
  });

  return { alerts, recommendations };
}
