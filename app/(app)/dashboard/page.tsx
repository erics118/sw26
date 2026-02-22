"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import OpsCenter from "@/components/ops/OpsCenter";

type QuoteRow = {
  id: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  clients: { name: string } | null;
  trips: { legs: Array<{ from_icao: string; to_icao: string }> } | null;
};

type TripRow = {
  id: string;
  requested_departure_window_start: string;
  clients: { name: string } | null;
  trips: { legs: Array<{ from_icao: string; to_icao: string }> } | null;
};

type CrewRow = {
  id: string;
  name: string;
  status: string;
};

type DashboardData = {
  openQuotes: number;
  confirmedThisWeek: number;
  todayTrips: number;
  recentQuotes: QuoteRow[];
  recommendedTrips: TripRow[];
  activeTrips: TripRow[];
  crews: CrewRow[];
};

type ForecastData = {
  planes_needed: Array<{
    aircraft_category: string;
    status: "shortage" | "balanced" | "surplus";
    capacity_gap_aircraft: number;
    capacity_gap_hours: number;
  }>;
};

type UtilizationData = {
  aircraft: Array<{
    aircraft_id: string;
    utilization_rate: number;
  }>;
  by_category: Array<{
    aircraft_category: string;
    avg_utilization_rate: number;
    underutilized_count: number;
    overconstrained_count: number;
  }>;
};

type RecommendationData = {
  recommendations?: Array<{
    one_line_reason: string;
    rec: { tail_number: string; type: string };
  }>;
  reposition?: Array<{
    aircraft_id: string;
    destination_icao: string;
  }>;
};

type RevenueSummaryData = {
  total_forecast_revenue: number;
  avg_weekly_revenue: number;
  historical_weekly: Array<{ week: string; label: string; revenue: number }>;
  forecast_weekly: Array<{
    week: string;
    label: string;
    revenue: number;
    p80_revenue: number;
  }>;
};

function KPICard({
  label,
  value,
  subLabel,
  accent = false,
  danger = false,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur">
      <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={`tabnum mt-3 text-4xl font-bold ${
          danger
            ? "text-red-400"
            : accent
              ? "text-emerald-400"
              : "text-zinc-100"
        }`}
      >
        {value}
      </p>
      {subLabel && <p className="mt-2 text-xs text-zinc-600">{subLabel}</p>}
    </div>
  );
}

function MiniRevenueChart({
  historical,
  forecast,
}: {
  historical: Array<{ revenue: number }>;
  forecast: Array<{ revenue: number }>;
}) {
  // Show last 5 historical weeks + up to 2 forecast weeks.
  // Each segment gets its own x-slots so they never share an x-coordinate —
  // that prevents the vertical jump at the junction.
  // Historical: indices 0…histCount-1, Forecast: indices histCount…n-1
  const histPoints = historical.slice(-5);
  const forePoints = forecast.slice(0, 2);
  const histCount = histPoints.length;
  const foreCount = forePoints.length;
  const n = histCount + foreCount;

  if (histCount < 1 || foreCount < 1 || n < 2) {
    return <div className="h-12 w-full rounded bg-zinc-800/50" />;
  }

  const maxRev = Math.max(
    ...histPoints.map((p) => p.revenue),
    ...forePoints.map((p) => p.revenue),
    1,
  );
  const W = 100;
  const H = 40;
  // BRIDGE is the narrow gap between history end and forecast start — keeping
  // it tiny makes the connecting segment nearly vertical (steep).
  const BRIDGE = 2;
  const innerSteps = histCount + foreCount - 2;
  const step = innerSteps > 0 ? (W - BRIDGE) / innerSteps : W - BRIDGE;
  const histEndX = (histCount - 1) * step;
  const firstForeX = histEndX + BRIDGE;

  function posX(i: number) {
    return i < histCount ? i * step : firstForeX + (i - histCount) * step;
  }
  function py(rev: number) {
    return H - (rev / maxRev) * (H - 4) - 2;
  }

  const lastHistRev = histPoints[histCount - 1]?.revenue ?? 0;

  const histLine = histPoints
    .map((p, i) => `${posX(i)},${py(p.revenue)}`)
    .join(" ");

  // Bridge anchor at last historical point → first forecast point (steep diagonal)
  const foreLine = [
    `${histEndX},${py(lastHistRev)}`,
    ...forePoints.map((p, i) => `${posX(histCount + i)},${py(p.revenue)}`),
  ].join(" ");

  const foreZone = [
    `${histEndX},${H}`,
    `${histEndX},${py(lastHistRev)}`,
    ...forePoints.map((p, i) => `${posX(histCount + i)},${py(p.revenue)}`),
    `${posX(histCount + foreCount - 1)},${H}`,
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-12 w-full"
      preserveAspectRatio="none"
    >
      {/* Forecast zone fill */}
      <polygon points={foreZone} fill="#10b98120" />
      {/* Historical line */}
      {histCount > 1 && (
        <polyline
          points={histLine}
          fill="none"
          stroke="#52525b"
          strokeWidth="1.5"
        />
      )}
      {/* Forecast line (starts at last historical point = seamless join) */}
      <polyline
        points={foreLine}
        fill="none"
        stroke="#10b981"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [forecastData, setForecastData] = useState<ForecastData | null>(null);
  const [utilizationData, setUtilizationData] =
    useState<UtilizationData | null>(null);
  const [recsData, setRecsData] = useState<RecommendationData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueSummaryData | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashboard, forecast, util, recs, revenue] = await Promise.all([
          fetch("/api/dashboard-data").then((r) => r.json()),
          fetch("/api/fleet-forecasting/forecast?days=7").then((r) => r.json()),
          fetch("/api/fleet-forecasting/utilization?days=30").then((r) =>
            r.json(),
          ),
          fetch("/api/fleet-forecasting/recommendations?horizon=7").then((r) =>
            r.json(),
          ),
          fetch("/api/revenue-forecasting?days=7").then((r) => r.json()),
        ]);

        setDashboardData(dashboard);
        setForecastData(forecast);
        setUtilizationData(util);
        setRecsData(recs);
        setRevenueData(revenue);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading || !dashboardData) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-zinc-100">
          Operations Overview
        </h1>
        <p className="mt-1 text-sm text-zinc-600">Loading...</p>
      </div>
    );
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Calculate quote funnel percentages
  const sentQuotes =
    dashboardData.recentQuotes?.filter((q: QuoteRow) => q.status === "sent")
      .length || 0;
  const confirmedQuotes =
    dashboardData.recentQuotes?.filter(
      (q: QuoteRow) => q.status === "confirmed",
    ).length || 0;
  const conversionRate =
    sentQuotes > 0 ? Math.round((confirmedQuotes / sentQuotes) * 100) : 0;

  // Fleet health metrics from utilization API
  const underutilizedCount =
    utilizationData?.by_category?.reduce(
      (sum, cat) => sum + (cat.underutilized_count ?? 0),
      0,
    ) || 0;
  const overconstrained =
    utilizationData?.by_category?.reduce(
      (sum, cat) => sum + (cat.overconstrained_count ?? 0),
      0,
    ) || 0;
  const totalAircraft = utilizationData?.aircraft?.length ?? 0;
  const properlyUtilized = Math.max(
    0,
    totalAircraft - underutilizedCount - overconstrained,
  );
  const avgUtil = utilizationData?.by_category?.length
    ? Math.round(
        (utilizationData.by_category.reduce(
          (sum, cat) => sum + (cat.avg_utilization_rate ?? 0),
          0,
        ) /
          utilizationData.by_category.length) *
          100,
      )
    : 0;

  // Shortage check - count categories with shortage status
  const shortageCount =
    forecastData?.planes_needed?.filter((p) => p.status === "shortage")
      .length || 0;
  const shortageHours =
    forecastData?.planes_needed
      ?.filter((p) => p.status === "shortage")
      .reduce((sum, p) => sum + (p.capacity_gap_hours || 0), 0) || 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">
            Operations Overview
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{dateStr}</p>
        </div>
      </div>

      {/* Top KPI Row - Pipeline & Fleet Health */}
      <div className="mb-6 grid grid-cols-5 gap-4">
        <KPICard
          label="Open Quotes"
          value={dashboardData.openQuotes}
          subLabel="in pipeline"
          accent={dashboardData.openQuotes > 0}
        />
        <KPICard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          subLabel={`${sentQuotes} sent, ${confirmedQuotes} confirmed`}
          accent={conversionRate > 50}
        />
        <KPICard
          label="Fleet Utilization"
          value={`${avgUtil}%`}
          subLabel="average health"
          accent={avgUtil > 70}
        />
        <KPICard
          label="Underutilized"
          value={underutilizedCount}
          subLabel="need repositioning"
          accent={underutilizedCount > 0}
        />
        <KPICard
          label="Shortage Risk"
          value={shortageCount}
          subLabel={
            shortageCount > 0
              ? `${shortageHours.toFixed(1)} hours gap`
              : "no shortages next 7 days"
          }
          danger={shortageCount > 0}
        />
      </div>

      {/* Main Grid */}
      <div className="mb-6 grid grid-cols-3 gap-6">
        {/* Left: Live Operations */}
        <div className="col-span-2">
          <p className="mb-3 text-xs font-semibold tracking-widest text-zinc-600 uppercase">
            Live Operations
          </p>
          <OpsCenter />
        </div>

        {/* Right Column: Revenue & Forecasting */}
        <div className="space-y-6">
          {/* Revenue Forecast */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  Revenue Forecast
                </p>
                <p className="text-xs text-zinc-600">Next 7 days</p>
              </div>
              <Link
                href="/revenue-forecasting"
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Details →
              </Link>
            </div>
            {revenueData ? (
              <>
                <MiniRevenueChart
                  historical={revenueData.historical_weekly}
                  forecast={revenueData.forecast_weekly}
                />
                {(() => {
                  const forecastRev = revenueData.total_forecast_revenue;
                  const avgWkly = revenueData.avg_weekly_revenue;
                  const delta =
                    avgWkly > 0
                      ? ((forecastRev - avgWkly) / avgWkly) * 100
                      : null;
                  const fmtRev = (n: number) =>
                    n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
                  return (
                    <div className="mt-3 flex justify-between text-xs text-zinc-500">
                      <span className="tabnum font-semibold text-zinc-200">
                        {fmtRev(forecastRev)}
                      </span>
                      {delta !== null && (
                        <span
                          className={`font-semibold ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        >
                          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(0)}%
                          vs avg
                        </span>
                      )}
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="h-12 w-full rounded bg-zinc-800/50" />
            )}
          </Card>

          {/* Capacity Status */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-100">
                Capacity Status
              </p>
              <Link
                href="/fleet-forecasting"
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Details →
              </Link>
            </div>
            <div className="space-y-2">
              {forecastData?.planes_needed?.slice(0, 3).map((plan, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">
                    {plan.aircraft_category}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      plan.status === "shortage"
                        ? "bg-red-900/40 text-red-400"
                        : plan.status === "surplus"
                          ? "bg-emerald-900/30 text-emerald-400"
                          : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {plan.status === "shortage"
                      ? `Need +${plan.capacity_gap_aircraft} ac`
                      : plan.status === "surplus"
                        ? "Surplus"
                        : "OK"}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Fleet Health */}
          <Card>
            <div className="mb-4">
              <p className="text-sm font-semibold text-zinc-100">
                Fleet Health
              </p>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-600">Optimal</span>
                <span className="text-xs font-semibold text-emerald-400">
                  {properlyUtilized} aircraft
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{
                    width: `${totalAircraft > 0 ? Math.min((properlyUtilized / totalAircraft) * 100, 100) : 0}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-zinc-600">Underutilized</span>
                <span className="text-xs font-semibold text-amber-400">
                  {underutilizedCount} aircraft
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{
                    width: `${Math.min((underutilizedCount / 10) * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-zinc-600">Overconstrained</span>
                <span className="text-xs font-semibold text-red-400">
                  {overconstrained} aircraft
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-red-400"
                  style={{
                    width: `${Math.min((overconstrained / 10) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Bottom Row: Quotes, Recommendations, Aircraft Insights */}
      <div className="grid grid-cols-3 gap-6">
        {/* Quote Pipeline */}
        <Card padding={false}>
          <CardHeader className="px-5 pt-5 pb-4">
            <CardTitle>Quote Pipeline</CardTitle>
            <Link
              href="/quotes"
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View All →
            </Link>
          </CardHeader>
          <div className="space-y-3 px-5 pb-5">
            {[
              { status: "sent", count: sentQuotes, color: "emerald" },
              {
                status: "negotiating",
                count:
                  dashboardData.recentQuotes?.filter(
                    (q: QuoteRow) => q.status === "negotiating",
                  ).length || 0,
                color: "amber",
              },
              {
                status: "confirmed",
                count: confirmedQuotes,
                color: "green",
              },
            ].map((stage) => {
              const colorClass =
                stage.color === "emerald"
                  ? "bg-emerald-400"
                  : stage.color === "amber"
                    ? "bg-amber-400"
                    : "bg-green-400";
              return (
                <div key={stage.status} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-zinc-400 capitalize">
                      {stage.status}
                    </p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${colorClass}`}
                        style={{
                          width: `${Math.min((stage.count / 5) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-6 text-right text-xs font-bold text-zinc-300">
                    {stage.count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top Recommendations */}
        <Card padding={false}>
          <CardHeader className="px-5 pt-5 pb-4">
            <CardTitle>Top Actions</CardTitle>
            <Link
              href="/fleet-forecasting?tab=actions"
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View All →
            </Link>
          </CardHeader>
          <div className="space-y-2.5 px-5 pb-5">
            {recsData?.recommendations?.slice(0, 2).map((s, idx) => (
              <div
                key={idx}
                className="rounded-md border border-emerald-900/30 bg-emerald-900/10 p-2.5"
              >
                <p className="text-xs font-semibold text-emerald-400">
                  {s.rec.tail_number}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {s.one_line_reason}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent High-Value Quotes */}
        <Card padding={false}>
          <CardHeader className="px-5 pt-5 pb-4">
            <CardTitle>High-Value Quotes</CardTitle>
            <Link
              href="/quotes"
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View All →
            </Link>
          </CardHeader>
          <div className="space-y-2.5 px-5 pb-5">
            {dashboardData.recentQuotes
              ?.filter(
                (q: QuoteRow) =>
                  q.status === "sent" || q.status === "confirmed",
              )
              .slice(0, 3)
              .map((q: QuoteRow) => {
                const client = !Array.isArray(q.clients)
                  ? (q.clients as { name?: string } | null)
                  : null;
                return (
                  <div
                    key={q.id}
                    className="flex items-start justify-between rounded-md border border-zinc-800 p-2.5 hover:border-emerald-500/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-zinc-100">
                        {client?.name || "Unknown"}
                      </p>
                      <p
                        className={`mt-0.5 text-xs ${
                          q.status === "confirmed"
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {q.status}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-zinc-400">$28k</p>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </div>
  );
}
