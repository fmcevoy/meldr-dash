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
    const maxPage = Math.max(
      0,
      Math.ceil(allRecs.length / RECOMMENDATIONS_PER_PAGE) - 1
    );
    const timer = setInterval(() => {
      setPage((p) => (p + 1) % (maxPage + 1));
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [allRecs.length]);

  const start = page * RECOMMENDATIONS_PER_PAGE;
  const recommendations = allRecs.slice(start, start + RECOMMENDATIONS_PER_PAGE);

  const nextRecommendations = useCallback(() => {
    const maxPage = Math.max(
      0,
      Math.ceil(allRecs.length / RECOMMENDATIONS_PER_PAGE) - 1
    );
    setPage((p) => (p + 1) % (maxPage + 1));
  }, [allRecs.length]);

  const prevRecommendations = useCallback(() => {
    const maxPage = Math.max(
      0,
      Math.ceil(allRecs.length / RECOMMENDATIONS_PER_PAGE) - 1
    );
    setPage((p) => (p === 0 ? maxPage : p - 1));
  }, [allRecs.length]);

  return { alerts, recommendations, nextRecommendations, prevRecommendations };
}
