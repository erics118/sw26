"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type WeekPoint = { week: string; label: string; revenue: number };
type ForecastWeekPoint = WeekPoint & { p80_revenue: number };
type CategoryRow = {
  category: string;
  forecast_hours: number;
  forecast_revenue: number;
  historical_avg_weekly: number;
  rate_per_hour: number;
  rate_source: "actual" | "estimate";
};

type RevenueForecastData = {
  horizon_days: number;
  historical_weekly: WeekPoint[];
  forecast_weekly: ForecastWeekPoint[];
  confirmed_revenue: number;
  pipeline_revenue: number;
  by_category: CategoryRow[];
  total_forecast_revenue: number;
  avg_weekly_revenue: number;
};

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function KPI({
  label,
  value,
  sub,
  color = "zinc",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "emerald" | "amber" | "zinc" | "green";
}) {
  const valueClass =
    color === "emerald"
      ? "text-emerald-400"
      : color === "amber"
        ? "text-amber-400"
        : color === "green"
          ? "text-green-400"
          : "text-zinc-100";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur">
      <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        {label}
      </p>
      <p className={`tabnum mt-3 text-3xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-2 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

function RevenueChart({
  historical,
  forecast,
}: {
  historical: WeekPoint[];
  forecast: ForecastWeekPoint[];
}) {
  const WIDTH = 600;
  const HEIGHT = 120;
  const PAD = { top: 10, right: 12, bottom: 28, left: 0 };

  // Combine all weeks into one timeline
  const allWeeks = [
    ...historical.map((w) => ({ ...w, type: "hist" as const })),
    ...forecast.map((w) => ({
      ...w,
      type: "fore" as const,
      p80_revenue: (w as ForecastWeekPoint).p80_revenue,
    })),
  ];

  if (allWeeks.length < 2) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-zinc-600">
        Not enough data to chart
      </div>
    );
  }

  const allRevenues = [
    ...historical.map((w) => w.revenue),
    ...forecast.map((w) => w.revenue),
    ...forecast.map((w) => w.p80_revenue),
  ];
  const maxRev = Math.max(...allRevenues, 1);

  const chartW = WIDTH - PAD.left - PAD.right;
  const chartH = HEIGHT - PAD.top - PAD.bottom;
  const n = allWeeks.length;
  const histCount = historical.length;

  // BRIDGE is the narrow gap that makes the connecting segment steep.
  const BRIDGE = 8;
  const innerSteps = histCount + forecast.length - 2;
  const step =
    innerSteps > 0 ? (chartW - BRIDGE) / innerSteps : chartW - BRIDGE;
  const histEndX = PAD.left + (histCount - 1) * step;
  const firstForeX = histEndX + BRIDGE;

  function posX(i: number) {
    return i < histCount
      ? PAD.left + i * step
      : firstForeX + (i - histCount) * step;
  }
  function y(rev: number) {
    return PAD.top + chartH - (rev / maxRev) * chartH;
  }

  const lastHistRevenue = historical[histCount - 1]?.revenue ?? 0;

  const histPoints = historical
    .map((w, i) => `${posX(i)},${y(w.revenue)}`)
    .join(" ");
  // Forecast P50 line: bridge anchor + forecast points
  const forePoints = [
    `${histEndX},${y(lastHistRevenue)}`,
    ...forecast.map((w, i) => `${posX(histCount + i)},${y(w.revenue)}`),
  ].join(" ");
  // P80 starts directly at the first forecast point (no bridge needed)
  const p80Points = forecast
    .map((w, i) => `${posX(histCount + i)},${y(w.p80_revenue)}`)
    .join(" ");

  // X-axis labels: show every other week to avoid overlap
  const labelIndices = allWeeks
    .map((_, i) => i)
    .filter((i) => i % Math.ceil(n / 6) === 0 || i === n - 1);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      style={{ height: 140 }}
      preserveAspectRatio="none"
    >
      {/* Zero line */}
      <line
        x1={PAD.left}
        y1={PAD.top + chartH}
        x2={PAD.left + chartW}
        y2={PAD.top + chartH}
        stroke="#27272a"
        strokeWidth="1"
      />

      {/* Forecast zone fill */}
      {forecast.length > 0 && (
        <polygon
          points={[
            `${histEndX},${PAD.top + chartH}`,
            `${histEndX},${y(lastHistRevenue)}`,
            ...forecast.map((w, i) => `${posX(histCount + i)},${y(w.revenue)}`),
            `${posX(histCount + forecast.length - 1)},${PAD.top + chartH}`,
          ].join(" ")}
          fill="#10b98120"
        />
      )}

      {/* Historical line */}
      {historical.length > 1 && (
        <polyline
          points={histPoints}
          fill="none"
          stroke="#52525b"
          strokeWidth="1.5"
        />
      )}

      {/* Forecast P80 dashed */}
      {forecast.length > 1 && (
        <polyline
          points={p80Points}
          fill="none"
          stroke="#10b981"
          strokeWidth="1"
          strokeDasharray="4,3"
          opacity="0.4"
        />
      )}

      {/* Forecast P50 line */}
      {forecast.length > 1 && (
        <polyline
          points={forePoints}
          fill="none"
          stroke="#10b981"
          strokeWidth="1.5"
        />
      )}

      {/* X-axis labels */}
      {labelIndices.map((i) => {
        const w = allWeeks[i];
        if (!w) return null;
        return (
          <text
            key={i}
            x={posX(i)}
            y={HEIGHT - 4}
            fontSize="8"
            fill="#52525b"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {w.label}
          </text>
        );
      })}
    </svg>
  );
}

const CATEGORY_ORDER = [
  "turboprop",
  "light",
  "midsize",
  "super-mid",
  "heavy",
  "ultra-long",
];

export default function RevenueForecastingPage() {
  const [horizon, setHorizon] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<RevenueForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/revenue-forecasting?days=${horizon}`)
      .then((r) => r.json())
      .then((d: RevenueForecastData) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [horizon]);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Revenue Forecast</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Demand-driven revenue projections from fleet forecasting model
          </p>
        </div>

        {/* Horizon selector */}
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => {
                setLoading(true);
                setHorizon(d);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                horizon === d
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="shimmer h-24 rounded-lg border border-zinc-800"
              />
            ))}
          </div>
          <div className="shimmer h-48 rounded-lg border border-zinc-800" />
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="mb-6 grid grid-cols-4 gap-4">
            {(() => {
              const weeksInHorizon = horizon / 7;
              const forecastWeeklyAvg =
                data.total_forecast_revenue / weeksInHorizon;
              const delta =
                data.avg_weekly_revenue > 0
                  ? ((forecastWeeklyAvg - data.avg_weekly_revenue) /
                      data.avg_weekly_revenue) *
                    100
                  : null;
              const deltaStr =
                delta === null
                  ? "vs 90d avg"
                  : `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(0)}% vs 90d avg`;
              return (
                <KPI
                  label={`${horizon}d Forecast`}
                  value={fmt(data.total_forecast_revenue)}
                  sub={deltaStr}
                  color={
                    delta === null ? "emerald" : delta >= 0 ? "emerald" : "zinc"
                  }
                />
              );
            })()}
            <KPI
              label="Confirmed"
              value={fmt(data.confirmed_revenue)}
              sub="booked, not yet flown"
              color="green"
            />
            <KPI
              label="Pipeline"
              value={fmt(data.pipeline_revenue)}
              sub="probability-weighted"
              color="amber"
            />
            <KPI
              label="Avg Weekly (90d)"
              value={fmt(data.avg_weekly_revenue)}
              sub="historical baseline"
            />
          </div>

          {/* Chart */}
          <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-5 backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  Revenue Timeline
                </p>
                <p className="text-xs text-zinc-600">
                  Past 90 days (actual) · Next {horizon} days (forecast)
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-px w-4 bg-zinc-500" />
                  Historical
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-px w-4 bg-emerald-500" />
                  Forecast (P50)
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-px w-4 border-t border-dashed border-emerald-500/50"
                    style={{ borderWidth: 1 }}
                  />
                  P80
                </span>
              </div>
            </div>
            <RevenueChart
              historical={data.historical_weekly}
              forecast={data.forecast_weekly}
            />
          </div>

          {/* By-Category Table */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 backdrop-blur">
            <div className="border-b border-zinc-800 px-5 py-4">
              <p className="text-sm font-semibold text-zinc-100">
                By Aircraft Category
              </p>
              <p className="text-xs text-zinc-600">
                Forecast revenue vs historical weekly average
              </p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="px-5 py-3 font-semibold tracking-widest text-zinc-600 uppercase">
                    Category
                  </th>
                  <th className="px-5 py-3 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                    Forecast Hrs
                  </th>
                  <th className="px-5 py-3 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                    Forecast Rev
                  </th>
                  <th className="px-5 py-3 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                    Hist Avg / Wk
                  </th>
                  <th className="px-5 py-3 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                    Rate / Hr
                  </th>
                  <th className="px-5 py-3 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                    vs Baseline
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.by_category
                  .sort(
                    (a, b) =>
                      CATEGORY_ORDER.indexOf(a.category) -
                      CATEGORY_ORDER.indexOf(b.category),
                  )
                  .map((row) => {
                    const weeksInHorizon = horizon / 7;
                    const forecastWeeklyAvg =
                      row.forecast_revenue / weeksInHorizon;
                    const delta =
                      row.historical_avg_weekly > 0
                        ? ((forecastWeeklyAvg - row.historical_avg_weekly) /
                            row.historical_avg_weekly) *
                          100
                        : null;
                    const deltaColor =
                      delta === null
                        ? "text-zinc-600"
                        : delta >= 5
                          ? "text-emerald-400"
                          : delta <= -5
                            ? "text-red-400"
                            : "text-zinc-400";
                    return (
                      <tr
                        key={row.category}
                        className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                      >
                        <td className="px-5 py-3 font-medium text-zinc-200 capitalize">
                          {row.category}
                        </td>
                        <td className="tabnum px-5 py-3 text-right text-zinc-400">
                          {row.forecast_hours.toFixed(1)}h
                        </td>
                        <td className="tabnum px-5 py-3 text-right font-semibold text-zinc-100">
                          {fmt(row.forecast_revenue)}
                        </td>
                        <td className="tabnum px-5 py-3 text-right text-zinc-500">
                          {row.historical_avg_weekly > 0
                            ? fmt(row.historical_avg_weekly)
                            : "—"}
                        </td>
                        <td className="tabnum px-5 py-3 text-right text-zinc-500">
                          <span>{fmt(row.rate_per_hour)}</span>
                          <span
                            className={`ml-1.5 text-[10px] font-medium ${
                              row.rate_source === "actual"
                                ? "text-emerald-500"
                                : "text-zinc-600"
                            }`}
                          >
                            {row.rate_source === "actual" ? "actual" : "est"}
                          </span>
                        </td>
                        <td
                          className={`tabnum px-5 py-3 text-right font-semibold ${deltaColor}`}
                        >
                          {delta === null
                            ? "—"
                            : `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
            {data.by_category.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-zinc-600">
                No forecast data available. Add aircraft and flight history to
                generate projections.
              </div>
            )}
          </div>

          {/* Footer note */}
          <p className="mt-4 text-xs text-zinc-700">
            Forecast = demand model (
            <code className="text-zinc-600">baseline × DOW × peak</code>) ×
            per-category rate. Rates marked{" "}
            <span className="text-emerald-600">actual</span> are derived from
            real quote costs; <span className="text-zinc-500">est</span> uses
            category averages until enough flight data is available.{" "}
            <Link
              href="/fleet-forecasting"
              className="text-zinc-600 underline hover:text-zinc-400"
            >
              Adjust demand overrides →
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
