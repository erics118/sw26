"use client";

import { useState, useEffect, useCallback } from "react";
import { ForecastChart } from "@/components/FleetForecasting/ForecastChart";
import { CapacityGapCard } from "@/components/FleetForecasting/CapacityGapCard";
import { UtilizationBar } from "@/components/FleetForecasting/UtilizationBar";
import { RecommendationCard } from "@/components/FleetForecasting/RecommendationCard";
import { InsightBlock } from "@/components/FleetForecasting/InsightBlock";
import {
  AccuracyChart,
  DelayReasonChart,
} from "@/components/FleetForecasting/LearningChart";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
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

const TABS: { id: Tab; label: string }[] = [
  { id: "forecast", label: "Fleet Forecast" },
  { id: "utilization", label: "Underutilization" },
  { id: "learning", label: "Post-Flight Learning" },
];

const FLAG_VARIANT: Record<string, "red" | "amber" | "yellow"> = {
  underutilized: "red",
  overconstrained: "amber",
  inefficient: "yellow",
};

export default function FleetForecastingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("forecast");
  const [horizon, setHorizon] = useState<Horizon>(7);

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

  // ─── Fetch functions ──────────────────────────────────────────────────────

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

  // ─── Tab switching & horizon changes ─────────────────────────────────────

  useEffect(() => {
    if (activeTab === "forecast") {
      fetchForecast(horizon);
      fetchForecastInsight(horizon);
    } else if (activeTab === "utilization") {
      if (!utilData) fetchUtilization();
      if (!utilInsight) fetchUtilInsight();
    } else if (activeTab === "learning") {
      if (!learningInsight) fetchLearning();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, horizon]);

  // ─── Derived data ─────────────────────────────────────────────────────────

  const categories = forecastData
    ? [...new Set(forecastData.planes_needed.map((d) => d.aircraft_category))]
    : [];

  const totalShortages = forecastData
    ? forecastData.planes_needed.filter((d) => d.status === "shortage").length
    : 0;
  const totalSurpluses = forecastData
    ? forecastData.planes_needed.filter((d) => d.status === "surplus").length
    : 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">
          Fleet Forecasting
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Capacity planning, underutilization detection, and demand forecasting
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Tab 1: Fleet Forecast ─────────────────────────────────────── */}
      {activeTab === "forecast" && (
        <div className="space-y-6">
          {/* Horizon selector + summary KPIs */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 p-1">
              {([7, 30, 90] as Horizon[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setHorizon(d)}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    horizon === d
                      ? "bg-amber-400 text-zinc-950"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
            <div className="flex gap-3 text-xs text-zinc-600">
              {totalShortages > 0 && (
                <span className="text-red-400">
                  {totalShortages} shortage days
                </span>
              )}
              {totalSurpluses > 0 && (
                <span className="text-amber-400">
                  {totalSurpluses} surplus days
                </span>
              )}
              {totalShortages === 0 &&
                totalSurpluses === 0 &&
                !forecastLoading && (
                  <span className="text-emerald-400">Balanced</span>
                )}
            </div>
          </div>

          {/* AI Insight */}
          <InsightBlock insight={forecastInsight} loading={insightLoading} />

          {/* Per-category charts + gap cards */}
          {forecastLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-72 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900"
                />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <Card>
              <p className="py-12 text-center text-sm text-zinc-600">
                No aircraft data found. Add aircraft to the fleet to see
                forecasts.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {categories.map((cat) => (
                <Card key={cat} className="space-y-4 p-4">
                  <CapacityGapCard
                    category={cat}
                    data={forecastData?.planes_needed ?? []}
                  />
                  <ForecastChart
                    data={forecastData?.planes_needed ?? []}
                    category={cat}
                  />
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 2: Underutilization ───────────────────────────────────── */}
      {activeTab === "utilization" && (
        <div className="space-y-6">
          {/* AI Insight */}
          <InsightBlock insight={utilInsight} loading={utilInsightLoading} />

          {/* Category summary KPIs */}
          {utilLoading ? (
            <div className="grid grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900"
                />
              ))}
            </div>
          ) : (
            utilData &&
            utilData.by_category.length > 0 && (
              <div className="grid grid-cols-4 gap-4">
                {utilData.by_category.map((cat) => (
                  <Card key={cat.aircraft_category} className="p-4">
                    <p className="text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      {cat.aircraft_category}
                    </p>
                    <p className="tabnum mt-1.5 text-2xl font-bold text-zinc-100">
                      {(cat.avg_utilization_rate * 100).toFixed(0)}%
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-600">
                      avg utilization
                    </p>
                    <UtilizationBar
                      value={cat.avg_utilization_rate}
                      showLabel={false}
                    />
                    {cat.underutilized_count > 0 && (
                      <p className="mt-2 text-xs text-red-400">
                        {cat.underutilized_count}/{cat.total_aircraft}{" "}
                        underutilized
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )
          )}

          {/* Aircraft table */}
          <Card>
            <div className="border-b border-zinc-800 px-5 py-4">
              <h2 className="text-sm font-semibold text-zinc-300">
                Aircraft — Ranked by Idle Risk
              </h2>
              <p className="mt-0.5 text-xs text-zinc-600">
                Last 30 days · {utilData?.aircraft.length ?? 0} aircraft
              </p>
            </div>
            {utilLoading ? (
              <div className="p-8 text-center text-sm text-zinc-600">
                Loading utilization data...
              </div>
            ) : !utilData || utilData.aircraft.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-600">
                No aircraft data. Complete flights to see utilization.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Aircraft
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Utilization
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Empty leg %
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Idle days
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Flags
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {utilData.aircraft.map((ac) => (
                    <tr
                      key={ac.aircraft_id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/20"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-zinc-100">
                          {ac.tail_number}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {ac.category} · {ac.home_base_icao ?? "—"}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="w-32">
                          <UtilizationBar value={ac.utilization_rate} />
                        </div>
                      </td>
                      <td className="tabnum px-5 py-3 text-zinc-400">
                        {(ac.empty_leg_ratio * 100).toFixed(0)}%
                      </td>
                      <td className="tabnum px-5 py-3 text-zinc-400">
                        {ac.idle_days}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {ac.flags.length === 0 ? (
                            <Badge variant="green">ok</Badge>
                          ) : (
                            ac.flags.map((f) => (
                              <Badge
                                key={f}
                                variant={FLAG_VARIANT[f] ?? "zinc"}
                              >
                                {f}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          {/* Recommendations */}
          {recsData && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                  Reposition ({recsData.reposition.length})
                </h3>
                {recsData.reposition.length === 0 ? (
                  <p className="text-xs text-zinc-600">
                    No reposition opportunities
                  </p>
                ) : (
                  recsData.reposition.map((r, i) => (
                    <RecommendationCard key={i} rec={r} />
                  ))
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                  Empty legs ({recsData.empty_legs.length})
                </h3>
                {recsData.empty_legs.length === 0 ? (
                  <p className="text-xs text-zinc-600">
                    No idle aircraft next 48h
                  </p>
                ) : (
                  recsData.empty_legs.map((r, i) => (
                    <RecommendationCard key={i} rec={r} />
                  ))
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                  Maintenance windows ({recsData.maintenance_windows.length})
                </h3>
                {recsData.maintenance_windows.length === 0 ? (
                  <p className="text-xs text-zinc-600">
                    No low-demand windows detected
                  </p>
                ) : (
                  recsData.maintenance_windows.map((r, i) => (
                    <RecommendationCard key={i} rec={r} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 3: Post-Flight Learning ──────────────────────────────── */}
      {activeTab === "learning" && (
        <div className="space-y-6">
          {/* AI Insight */}
          <InsightBlock insight={learningInsight} loading={learningLoading} />

          <div className="grid grid-cols-2 gap-4">
            {/* Forecast accuracy */}
            <Card>
              <div className="border-b border-zinc-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-zinc-300">
                  Forecast Accuracy by Category
                </h2>
                <p className="mt-0.5 text-xs text-zinc-600">
                  % error vs actuals · last 90 days
                </p>
              </div>
              <div className="p-4">
                {learningLoading ? (
                  <div className="h-40 animate-pulse rounded bg-zinc-800" />
                ) : (
                  <AccuracyChart accuracy={accuracy} />
                )}
                {accuracy.length > 0 && (
                  <table className="mt-4 w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="py-2 text-left font-semibold tracking-widest text-zinc-600 uppercase">
                          Category
                        </th>
                        <th className="py-2 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                          Predicted
                        </th>
                        <th className="py-2 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                          Actual
                        </th>
                        <th className="py-2 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                          Error
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {accuracy.map((a) => (
                        <tr
                          key={a.aircraft_category}
                          className="border-b border-zinc-800/50"
                        >
                          <td className="py-2 text-zinc-300">
                            {a.aircraft_category}
                          </td>
                          <td className="tabnum py-2 text-right text-zinc-400">
                            {a.predicted_hours.toFixed(1)} hrs
                          </td>
                          <td className="tabnum py-2 text-right text-zinc-400">
                            {a.actual_hours.toFixed(1)} hrs
                          </td>
                          <td
                            className={`tabnum py-2 text-right font-medium ${
                              Math.abs(a.error_pct) < 10
                                ? "text-emerald-400"
                                : Math.abs(a.error_pct) < 25
                                  ? "text-amber-400"
                                  : "text-red-400"
                            }`}
                          >
                            {a.error_pct > 0 ? "+" : ""}
                            {a.error_pct.toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </Card>

            {/* Delay reasons */}
            <Card>
              <div className="border-b border-zinc-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-zinc-300">
                  Top Delay Reasons
                </h2>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Count of delay events · last 90 days
                </p>
              </div>
              <div className="p-4">
                {learningLoading ? (
                  <div className="h-40 animate-pulse rounded bg-zinc-800" />
                ) : (
                  <DelayReasonChart delays={delays} />
                )}
                {delays.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {delays.slice(0, 5).map((d) => (
                      <div
                        key={d.reason_code}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-zinc-400 capitalize">
                          {d.reason_code}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="tabnum text-zinc-600">
                            {d.total_hours_lost.toFixed(1)} hrs lost
                          </span>
                          <Badge variant="zinc">{d.count}×</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
