import Link from "next/link";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { computeExpectedDemand } from "@/lib/forecasting/demand";
import { CATEGORY_HOURLY_RATE } from "@/lib/forecasting/types";
import { addDays } from "@/lib/forecasting/utils";

// ── Helpers (mirrored from the revenue-forecasting API route) ─────────────────

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + offset);
  return monday.toISOString().slice(0, 10);
}

function sumCosts(costs: unknown): number {
  if (!costs) return 0;
  const arr = Array.isArray(costs) ? costs : [costs];
  return arr.reduce(
    (s: number, c: unknown) =>
      s +
      (typeof c === "object" && c !== null && "total" in c
        ? Number((c as { total?: number }).total ?? 0)
        : 0),
    0,
  );
}

// ── Mini SVG chart (pure render, no hooks needed) ─────────────────────────────

function MiniRevenueChart({
  historical,
  forecast,
}: {
  historical: Array<{ revenue: number }>;
  forecast: Array<{ revenue: number }>;
}) {
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
      <polygon points={foreZone} fill="#10b98120" />
      {histCount > 1 && (
        <polyline
          points={histLine}
          fill="none"
          stroke="#52525b"
          strokeWidth="1.5"
        />
      )}
      <polyline
        points={foreLine}
        fill="none"
        stroke="#10b981"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// ── Server component ──────────────────────────────────────────────────────────

export async function RevenueCard() {
  const supabase = await createClient();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const histStart = addDays(today, -90);
  const foreEnd = addDays(today, 6);

  const MIN_FLIGHTS_FOR_DERIVED_RATE = 3;

  const { data: histQuotes } = await supabase
    .from("quotes")
    .select(
      "chosen_aircraft_category, actual_departure_time, actual_total_hours, quote_costs(total)",
    )
    .eq("status", "completed")
    .not("actual_departure_time", "is", null)
    .gte("actual_departure_time", histStart.toISOString())
    .lt("actual_departure_time", today.toISOString());

  const histWeekMap: Record<string, number> = {};
  const catRateAccum: Record<
    string,
    { totalRevenue: number; totalHours: number; flightCount: number }
  > = {};

  for (const q of histQuotes ?? []) {
    if (!q.actual_departure_time) continue;
    const wk = weekStart(q.actual_departure_time.slice(0, 10));
    const rev = sumCosts(q.quote_costs);
    const hours = Number(q.actual_total_hours ?? 0);
    const cat = q.chosen_aircraft_category ?? "unknown";
    histWeekMap[wk] = (histWeekMap[wk] ?? 0) + rev;
    if (rev > 0 && hours > 0) {
      if (!catRateAccum[cat])
        catRateAccum[cat] = { totalRevenue: 0, totalHours: 0, flightCount: 0 };
      catRateAccum[cat].totalRevenue += rev;
      catRateAccum[cat].totalHours += hours;
      catRateAccum[cat].flightCount += 1;
    }
  }

  const categoryRates: Record<string, number> = {};
  for (const [cat, accum] of Object.entries(catRateAccum)) {
    if (
      accum.flightCount >= MIN_FLIGHTS_FOR_DERIVED_RATE &&
      accum.totalHours > 0
    ) {
      categoryRates[cat] = accum.totalRevenue / accum.totalHours;
    }
  }
  function rateFor(cat: string): number {
    return categoryRates[cat] ?? CATEGORY_HOURLY_RATE[cat] ?? 4000;
  }

  const historical_weekly = Object.entries(histWeekMap)
    .filter(([, rev]) => rev > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, revenue]) => ({ revenue: Math.round(revenue) }));

  const avgWeeklyRevenue =
    historical_weekly.length > 0
      ? Math.round(
          historical_weekly.reduce((s, w) => s + w.revenue, 0) /
            historical_weekly.length,
        )
      : 0;

  const forecastDemand = await computeExpectedDemand(supabase, today, foreEnd);

  const foreWeekMap: Record<string, number> = {};
  for (const d of forecastDemand) {
    const wk = weekStart(d.date);
    if (!foreWeekMap[wk]) foreWeekMap[wk] = 0;
    foreWeekMap[wk] += d.expected_total_hours * rateFor(d.aircraft_category);
  }

  const forecast_weekly = Object.entries(foreWeekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, revenue]) => ({ revenue: Math.round(revenue) }));

  const total_forecast_revenue = Math.round(
    forecast_weekly.reduce((s, w) => s + w.revenue, 0),
  );

  const fmtRev = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1000
        ? `$${Math.round(n / 1000)}k`
        : `$${n}`;

  const delta =
    avgWeeklyRevenue > 0
      ? ((total_forecast_revenue - avgWeeklyRevenue) / avgWeeklyRevenue) * 100
      : null;

  return (
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
      <MiniRevenueChart
        historical={historical_weekly}
        forecast={forecast_weekly}
      />
      <div className="mt-3 flex justify-between text-xs text-zinc-500">
        <span className="tabnum font-semibold text-zinc-200">
          {fmtRev(total_forecast_revenue)}
        </span>
        {delta !== null && (
          <span
            className={`font-semibold ${delta >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(0)}% vs avg
          </span>
        )}
      </div>
    </Card>
  );
}
