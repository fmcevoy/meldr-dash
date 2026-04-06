import { useMemo, useState, useCallback } from "react";
import { DashboardState } from "../adapters/types.js";
import { evaluate } from "../tips/evaluator.js";
import { Technique } from "../tips/database.js";

const DEFAULT_PER_PAGE = 3;

function paginate(items: Technique[], page: number, perPage: number): { visible: Technique[]; total: number } {
  const pp = Math.max(1, perPage);
  const total = Math.max(1, Math.ceil(items.length / pp));
  const safePage = page % total;
  const start = safePage * pp;
  return { visible: items.slice(start, start + pp), total };
}

/**
 * Compute how many alert items fit in a panel of the given height.
 * Overhead: border (2) + title row (1) = 3 lines.
 * Small panels (<=10): 1 line per item (fix text omitted by panel).
 * Larger panels: 2 lines per item (title + fix).
 */
export function itemsPerPage(panelHeight: number | undefined): number {
  if (!panelHeight || panelHeight <= 3) return DEFAULT_PER_PAGE;
  const contentLines = panelHeight - 3;
  if (panelHeight <= 10) return Math.max(1, contentLines);
  return Math.max(1, Math.floor(contentLines / 2));
}

export function useTips(
  state: DashboardState,
  selectedSessionId?: string,
  monitorCapacity: number = DEFAULT_PER_PAGE,
  tipCapacity: number = DEFAULT_PER_PAGE,
): {
  visibleMonitors: Technique[];
  monitorPage: number;
  totalMonitorPages: number;
  totalMonitors: number;
  visibleTips: Technique[];
  tipPage: number;
  totalTips: number;
  totalTipPages: number;
  nextMonitorPage: () => void;
  nextTipPage: () => void;
} {
  const { monitors, allTips } = useMemo(
    () => evaluate(state, selectedSessionId),
    [state, selectedSessionId],
  );

  const [monitorPage, setMonitorPage] = useState(0);
  const [tipPage, setTipPage] = useState(0);

  const monPag = paginate(monitors, monitorPage, monitorCapacity);
  const tipPag = paginate(allTips, tipPage, tipCapacity);

  const nextMonitorPage = useCallback(() => {
    setMonitorPage((p) => (p + 1) % monPag.total);
  }, [monPag.total]);

  const nextTipPage = useCallback(() => {
    setTipPage((p) => (p + 1) % tipPag.total);
  }, [tipPag.total]);

  return {
    visibleMonitors: monPag.visible,
    monitorPage,
    totalMonitorPages: monPag.total,
    totalMonitors: monitors.length,
    visibleTips: tipPag.visible,
    tipPage,
    totalTips: allTips.length,
    totalTipPages: tipPag.total,
    nextMonitorPage,
    nextTipPage,
  };
}
