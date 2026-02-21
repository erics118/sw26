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
  emptyLegRatio: string;
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
  reposition?: Array<{
    aircraft_id: string;
    destination_icao: string;
  }>;
  empty_leg?: Array<{
    aircraft_id: string;
    discount_pct: number;
  }>;
};

function KPICard({
  label,
  value,
  subLabel,
  accent = false,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur">
      <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={`tabnum mt-3 text-4xl font-bold ${
          accent ? "text-emerald-400" : "text-zinc-100"
        }`}
      >
        {value}
      </p>
      {subLabel && <p className="mt-2 text-xs text-zinc-600">{subLabel}</p>}
    </div>
  );
}

function SparkChart({ color = "#00e696" }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 100 40"
      className="h-12 w-full"
      preserveAspectRatio="none"
    >
      <polyline
        points="0,30 15,22 30,25 45,15 60,18 75,8 100,5"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      <polyline
        points="0,32 15,28 30,26 45,20 60,22 75,12 100,8"
        fill="none"
        stroke={`${color}33`}
        strokeWidth="1"
        strokeDasharray="2,2"
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashboard, forecast, util, recs] = await Promise.all([
          fetch("/api/dashboard-data").then((r) => r.json()),
          fetch("/api/fleet-forecasting/forecast?days=7").then((r) => r.json()),
          fetch("/api/fleet-forecasting/utilization?days=30").then((r) =>
            r.json(),
          ),
          fetch("/api/fleet-forecasting/recommendations?horizon=7").then((r) =>
            r.json(),
          ),
        ]);

        setDashboardData(dashboard);
        setForecastData(forecast);
        setUtilizationData(util);
        setRecsData(recs);
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
          value={shortageCount > 0 ? shortageCount : "—"}
          subLabel={
            shortageCount > 0
              ? `${shortageHours.toFixed(1)} hours gap`
              : "next 7 days"
          }
          accent={shortageCount > 0}
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
            <div className="mb-4">
              <p className="text-sm font-semibold text-zinc-100">
                Revenue Forecast
              </p>
              <p className="text-xs text-zinc-600">Next 7 days</p>
            </div>
            <SparkChart />
            <div className="mt-3 flex justify-between text-xs text-zinc-500">
              <span>This week</span>
              <span className="font-semibold text-emerald-400">↑ 12%</span>
            </div>
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
                  <span className="text-xs text-zinc-600">
                    {plan.aircraft_category}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      plan.status === "shortage"
                        ? "text-red-400"
                        : plan.status === "surplus"
                          ? "text-emerald-400"
                          : "text-zinc-400"
                    }`}
                  >
                    {plan.status === "shortage" ? "⚠️" : "✓"}{" "}
                    {plan.capacity_gap_aircraft > 0
                      ? `+${plan.capacity_gap_aircraft}`
                      : plan.capacity_gap_aircraft}
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
              href="/fleet-forecasting"
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View All →
            </Link>
          </CardHeader>
          <div className="space-y-2.5 px-5 pb-5">
            {recsData?.reposition?.slice(0, 2).map((rec, idx) => (
              <div
                key={idx}
                className="rounded-md border border-emerald-900/30 bg-emerald-900/10 p-2.5"
              >
                <p className="text-xs font-semibold text-emerald-400">
                  {rec.aircraft_id}
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  → {rec.destination_icao}
                </p>
              </div>
            ))}
            {recsData?.empty_leg?.slice(0, 1).map((leg, idx) => (
              <div
                key={`el-${idx}`}
                className="rounded-md border border-amber-900/30 bg-amber-900/10 p-2.5"
              >
                <p className="text-xs font-semibold text-amber-400">
                  {leg.aircraft_id} - Empty Leg
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  {Math.round(leg.discount_pct)}% discount
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
