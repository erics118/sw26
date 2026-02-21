"use client";

import { useState, useEffect } from "react";
import { ForecastChart } from "@/components/FleetForecasting/ForecastChart";
import { CapacityGapCard } from "@/components/FleetForecasting/CapacityGapCard";
import { UtilizationBar } from "@/components/FleetForecasting/UtilizationBar";
import { RecommendationCard } from "@/components/FleetForecasting/RecommendationCard";
import { InsightBlock } from "@/components/FleetForecasting/InsightBlock";
import { ScenarioPanel } from "@/components/FleetForecasting/ScenarioPanel";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { useForecasterData } from "./hooks/useForecasterData";

type Tab = "forecast" | "utilization";
type Horizon = 7 | 30 | 90;
type Aggregation = "daily" | "weekly";
type UtilView = "aircraft" | "base";

const TABS: { id: Tab; label: string }[] = [
  { id: "forecast", label: "Fleet Forecast" },
  { id: "utilization", label: "Underutilization" },
];

const FLAG_VARIANT: Record<string, "red" | "amber" | "yellow"> = {
  underutilized: "red",
  overconstrained: "amber",
  inefficient: "yellow",
};

export default function FleetForecastingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("forecast");
  const [horizon, setHorizon] = useState<Horizon>(7);
  const [aggregation, setAggregation] = useState<Aggregation>("daily");
  const [truthMode, setTruthMode] = useState(false);
  const [utilView, setUtilView] = useState<UtilView>("aircraft");

  const {
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
  } = useForecasterData();

  useEffect(() => {
    loadTab(activeTab, horizon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, horizon]);

  const categories = forecastData
    ? [...new Set(forecastData.planes_needed.map((d) => d.aircraft_category))]
    : [];

  const totalShortages = forecastData
    ? forecastData.planes_needed.filter((d) => d.status === "shortage").length
    : 0;
  const totalSurpluses = forecastData
    ? forecastData.planes_needed.filter((d) => d.status === "surplus").length
    : 0;

  const byBaseData = (() => {
    if (!utilData?.aircraft) return [];
    const baseMap: Record<
      string,
      {
        base: string;
        aircraft: typeof utilData.aircraft;
        totalIdleRisk: number;
        count: number;
      }
    > = {};
    for (const ac of utilData.aircraft) {
      const base = ac.home_base_icao ?? "—";
      if (!baseMap[base]) {
        baseMap[base] = { base, aircraft: [], totalIdleRisk: 0, count: 0 };
      }
      const entry = baseMap[base];
      if (entry) {
        entry.aircraft.push(ac);
        entry.totalIdleRisk += ac.idle_risk_score;
        entry.count += 1;
      }
    }
    return Object.values(baseMap).sort(
      (a, b) => b.totalIdleRisk / b.count - a.totalIdleRisk / a.count,
    );
  })();

  return (
    <div className="p-8">
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
            {tab.id === "utilization" && recsData?.recommendations?.length
              ? ` (${recsData.recommendations.length})`
              : ""}
          </button>
        ))}
      </div>

      {/* ─── Fleet Forecast ────────────────────────────────────────────── */}
      {activeTab === "forecast" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">Horizon:</span>
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
              <div className="flex gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-1">
                {(["daily", "weekly"] as const).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAggregation(a)}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                      aggregation === a
                        ? "bg-amber-400 text-zinc-950"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {a === "daily" ? "Daily" : "Weekly"}
                  </button>
                ))}
              </div>
              {horizon === 7 && (
                <div
                  className="flex gap-1 rounded-md border border-zinc-800 bg-zinc-900 p-1"
                  title="Forecast = probability-weighted demand · Pipeline = raw bookings & quotes"
                >
                  <button
                    onClick={() => setTruthMode(false)}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                      !truthMode
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Forecast
                  </button>
                  <button
                    onClick={() => setTruthMode(true)}
                    className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                      truthMode
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Pipeline
                  </button>
                </div>
              )}
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

          <InsightBlock insight={forecastInsight} loading={insightLoading} />

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
                    demand={forecastData?.demand ?? []}
                    pipeline={forecastData?.pipeline ?? []}
                    category={cat}
                    aggregation={aggregation}
                    onBarClick={(date) => {
                      void date;
                    }}
                    truthMode={truthMode}
                  />
                </Card>
              ))}
            </div>
          )}

          <ScenarioPanel forecastData={forecastData} />
        </div>
      )}

      {/* ─── Underutilization ──────────────────────────────────────────── */}
      {activeTab === "utilization" && (
        <div className="space-y-6">
          <InsightBlock insight={utilInsight} loading={utilInsightLoading} />

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
                      flight time usage
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

          <Card>
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-300">
                  Aircraft — Ranked by Idle Risk
                </h2>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Last 30 days · {utilData?.aircraft.length ?? 0} aircraft
                </p>
              </div>
              <div className="flex gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-0.5">
                <button
                  onClick={() => setUtilView("aircraft")}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    utilView === "aircraft"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  By Aircraft
                </button>
                <button
                  onClick={() => setUtilView("base")}
                  className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                    utilView === "base"
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  By Base
                </button>
              </div>
            </div>
            {utilLoading ? (
              <div className="p-8 text-center text-sm text-zinc-600">
                Loading utilization data...
              </div>
            ) : !utilData || utilData.aircraft.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-600">
                No aircraft data. Complete flights to see utilization.
              </div>
            ) : utilView === "aircraft" ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Aircraft
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Risk Score
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Days idle
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
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <UtilizationBar value={ac.idle_risk_score} />
                          </div>
                          <span className="tabnum text-xs text-zinc-500">
                            {(ac.utilization_rate * 100).toFixed(0)}% util
                          </span>
                        </div>
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
                          {ac.deadhead_waste_score > 0.15 && (
                            <Badge variant="yellow">
                              {(ac.deadhead_waste_score * 100).toFixed(0)}%
                              empty repositions
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Base
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Aircraft
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Avg Idle Risk
                    </th>
                    <th className="px-5 py-3 text-left text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                      Highest Risk Tail
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byBaseData.map((entry) => {
                    const avgIdleRisk =
                      entry.count > 0 ? entry.totalIdleRisk / entry.count : 0;
                    const highestRisk = entry.aircraft.reduce((best, ac) =>
                      ac.idle_risk_score > best.idle_risk_score ? ac : best,
                    );
                    return (
                      <tr
                        key={entry.base}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/20"
                      >
                        <td className="px-5 py-3">
                          <p className="font-medium text-zinc-100">
                            {entry.base}
                          </p>
                        </td>
                        <td className="tabnum px-5 py-3 text-zinc-400">
                          {entry.count}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20">
                              <UtilizationBar value={avgIdleRisk} />
                            </div>
                            <span className="tabnum text-xs text-zinc-500">
                              {(avgIdleRisk * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="font-medium text-zinc-100">
                            {highestRisk?.tail_number ?? "—"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {highestRisk
                              ? `${(highestRisk.idle_risk_score * 100).toFixed(0)}% risk`
                              : ""}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          {recsData?.recommendations && recsData.recommendations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-widest text-zinc-600 uppercase">
                Recommended Actions ({recsData.recommendations.length})
              </h3>
              {recsData.recommendations.map((s, i) => (
                <RecommendationCard key={i} rec={s.rec} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
