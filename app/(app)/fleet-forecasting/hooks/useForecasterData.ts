import { useState, useCallback } from "react";
import type { ForecastInsight } from "@/lib/ai/forecasting";
import type {
  ForecastSummary,
  UtilizationSummary,
  RecommendationSummary,
  ForecastAccuracy,
  DelayReasonBreakdown,
} from "@/lib/forecasting/types";

type Tab = "forecast" | "utilization" | "learning";
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

  // Learning tab state
  const [accuracy, setAccuracy] = useState<ForecastAccuracy[]>([]);
  const [delays, setDelays] = useState<DelayReasonBreakdown[]>([]);
  const [learningInsight, setLearningInsight] =
    useState<ForecastInsight | null>(null);
  const [learningLoading, setLearningLoading] = useState(false);

  // ─── Fetch functions ────────────────────────────────────────────────────────

  const fetchForecast = useCallback(async (days: Horizon) => {
    setForecastLoading(true);
    try {
      const res = await fetch(`/api/fleet-forecasting/forecast?days=${days}`);
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
        fetch("/api/fleet-forecasting/utilization?days=30"),
        fetch("/api/fleet-forecasting/recommendations?horizon=7"),
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

  const fetchLearning = useCallback(async () => {
    setLearningLoading(true);
    try {
      const res = await fetch("/api/fleet-forecasting/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: "learning" }),
      });
      const data = (await res.json()) as {
        insight: ForecastInsight;
        accuracy: ForecastAccuracy[];
        delay_reasons: DelayReasonBreakdown[];
      };
      setLearningInsight(data.insight);
      setAccuracy(data.accuracy ?? []);
      setDelays(data.delay_reasons ?? []);
    } finally {
      setLearningLoading(false);
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
      } else if (tab === "learning") {
        if (!learningInsight) fetchLearning();
      }
    },
    [
      fetchForecast,
      fetchForecastInsight,
      fetchUtilization,
      fetchUtilInsight,
      fetchLearning,
      utilData,
      utilInsight,
      learningInsight,
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
    accuracy,
    delays,
    learningInsight,
    learningLoading,
    loadTab,
  };
}
