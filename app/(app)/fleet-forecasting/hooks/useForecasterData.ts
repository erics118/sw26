import { useState, useCallback } from "react";
import type { ForecastInsight } from "@/lib/ai/forecasting";
import type {
  ForecastSummary,
  UtilizationSummary,
  RecommendationSummary,
} from "@/lib/forecasting/types";

type Tab = "forecast" | "utilization";
type Horizon = 7 | 30 | 90;

export function useForecasterData() {
  // Forecast tab state
  const [forecastData, setForecastData] = useState<ForecastSummary | null>(
    null,
  );
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastInsight, setForecastInsight] =
    useState<ForecastInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  // Utilization tab state
  const [utilData, setUtilData] = useState<UtilizationSummary | null>(null);
  const [recsData, setRecsData] = useState<RecommendationSummary | null>(null);
  const [utilLoading, setUtilLoading] = useState(false);
  const [utilInsight, setUtilInsight] = useState<ForecastInsight | null>(null);
  const [utilInsightLoading, setUtilInsightLoading] = useState(false);

  // ─── Fetch functions ────────────────────────────────────────────────────────

  const fetchForecast = useCallback(async (days: Horizon) => {
    setForecastLoading(true);
    try {
      const res = await fetch(`/api/fleet-forecasting/forecast?days=${days}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as ForecastSummary;
      setForecastData(data);
    } finally {
      setForecastLoading(false);
    }
  }, []);

  const fetchForecastInsight = useCallback(async (days: Horizon) => {
    setInsightLoading(true);
    try {
      const res = await fetch("/api/fleet-forecasting/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: "forecast", days }),
      });
      const data = (await res.json()) as ForecastInsight;
      setForecastInsight(data);
    } finally {
      setInsightLoading(false);
    }
  }, []);

  const fetchUtilization = useCallback(async () => {
    setUtilLoading(true);
    try {
      const [utilRes, recsRes] = await Promise.all([
        fetch("/api/fleet-forecasting/utilization?days=30", {
          cache: "no-store",
        }),
        fetch("/api/fleet-forecasting/recommendations?horizon=7", {
          cache: "no-store",
        }),
      ]);
      const [util, recs] = await Promise.all([
        utilRes.json() as Promise<UtilizationSummary>,
        recsRes.json() as Promise<RecommendationSummary>,
      ]);
      setUtilData(util);
      setRecsData(recs);
    } finally {
      setUtilLoading(false);
    }
  }, []);

  const fetchUtilInsight = useCallback(async () => {
    setUtilInsightLoading(true);
    try {
      const res = await fetch("/api/fleet-forecasting/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: "utilization" }),
      });
      const data = (await res.json()) as ForecastInsight;
      setUtilInsight(data);
    } finally {
      setUtilInsightLoading(false);
    }
  }, []);

  const loadTab = useCallback(
    (tab: Tab, horizon: Horizon) => {
      if (tab === "forecast") {
        fetchForecast(horizon);
        fetchForecastInsight(horizon);
      } else if (tab === "utilization") {
        if (!utilData) fetchUtilization();
        if (!utilInsight) fetchUtilInsight();
      }
    },
    [
      fetchForecast,
      fetchForecastInsight,
      fetchUtilization,
      fetchUtilInsight,
      utilData,
      utilInsight,
    ],
  );

  return {
    forecastData,
    forecastLoading,
    forecastInsight,
    insightLoading,
    utilData,
    recsData,
    utilLoading,
    utilInsight,
    utilInsightLoading,
    loadTab,
  };
}
