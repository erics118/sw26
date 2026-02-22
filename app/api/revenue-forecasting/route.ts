import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  computeExpectedDemand,
  computePipelineDemand,
} from "@/lib/forecasting/demand";
import { CATEGORY_HOURLY_RATE } from "@/lib/forecasting/types";
import { addDays } from "@/lib/forecasting/utils";

// Minimum flights required to trust the derived rate over the fallback constant
const MIN_FLIGHTS_FOR_DERIVED_RATE = 3;

// Returns the ISO date of the Monday that starts the week containing dateStr
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + offset);
  return monday.toISOString().slice(0, 10);
}

function weekLabel(mondayDateStr: string): string {
  const d = new Date(mondayDateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(
    90,
    Math.max(7, Number(searchParams.get("days") ?? "30")),
  );

  const supabase = await createClient();

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const futureEnd = addDays(today, days - 1);
  const histStart = addDays(today, -90);

  // ── Historical revenue: past 90 days ──────────────────────────────────────
  // Fetch actual_total_hours alongside costs so we can derive revenue/hr rates.
  const { data: histQuotes } = await supabase
    .from("quotes")
    .select(
      "chosen_aircraft_category, actual_departure_time, actual_total_hours, quote_costs(total)",
    )
    .eq("status", "completed")
    .not("actual_departure_time", "is", null)
    .gte("actual_departure_time", histStart.toISOString())
    .lt("actual_departure_time", today.toISOString());

  // Bucket by week and accumulate per-category rate data
  const histWeekMap: Record<string, number> = {};
  const catHistWeekMap: Record<string, Record<string, number>> = {};

  // For derived rate: sum total revenue and total hours per category
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
    if (!catHistWeekMap[cat]) catHistWeekMap[cat] = {};
    catHistWeekMap[cat][wk] = (catHistWeekMap[cat][wk] ?? 0) + rev;

    // Only count flights that have both cost and hours data
    if (rev > 0 && hours > 0) {
      if (!catRateAccum[cat])
        catRateAccum[cat] = { totalRevenue: 0, totalHours: 0, flightCount: 0 };
      catRateAccum[cat].totalRevenue += rev;
      catRateAccum[cat].totalHours += hours;
      catRateAccum[cat].flightCount += 1;
    }
  }

  // Build per-category revenue/hr rate: derived from actuals where possible,
  // fallback to CATEGORY_HOURLY_RATE constants when data is thin.
  const categoryRates: Record<
    string,
    { rate: number; source: "actual" | "estimate" }
  > = {};
  for (const [cat, accum] of Object.entries(catRateAccum)) {
    if (
      accum.flightCount >= MIN_FLIGHTS_FOR_DERIVED_RATE &&
      accum.totalHours > 0
    ) {
      categoryRates[cat] = {
        rate: accum.totalRevenue / accum.totalHours,
        source: "actual",
      };
    }
  }

  function getRateForCategory(cat: string): {
    rate: number;
    source: "actual" | "estimate";
  } {
    return (
      categoryRates[cat] ?? {
        rate: CATEGORY_HOURLY_RATE[cat] ?? 4000,
        source: "estimate",
      }
    );
  }

  const historical_weekly = Object.entries(histWeekMap)
    .filter(([, revenue]) => revenue > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, revenue]) => ({
      week,
      label: weekLabel(week),
      revenue: Math.round(revenue),
    }));

  const avgWeeklyRevenue =
    historical_weekly.length > 0
      ? Math.round(
          historical_weekly.reduce((s, w) => s + w.revenue, 0) /
            historical_weekly.length,
        )
      : 0;

  // ── Forecasted revenue ────────────────────────────────────────────────────
  const [forecastDemand, pipelineDemand] = await Promise.all([
    computeExpectedDemand(supabase, today, futureEnd),
    computePipelineDemand(supabase, today, futureEnd),
  ]);

  const forecastWeekMap: Record<
    string,
    { revenue: number; p80_revenue: number }
  > = {};
  const catForecastMap: Record<
    string,
    {
      forecast_hours: number;
      forecast_revenue: number;
      rate: number;
      rate_source: "actual" | "estimate";
    }
  > = {};

  for (const d of forecastDemand) {
    const { rate, source } = getRateForCategory(d.aircraft_category);
    const wk = weekStart(d.date);
    if (!forecastWeekMap[wk])
      forecastWeekMap[wk] = { revenue: 0, p80_revenue: 0 };
    forecastWeekMap[wk].revenue += d.expected_total_hours * rate;
    forecastWeekMap[wk].p80_revenue += d.p80_hours * rate;

    const cat = d.aircraft_category;
    if (!catForecastMap[cat])
      catForecastMap[cat] = {
        forecast_hours: 0,
        forecast_revenue: 0,
        rate,
        rate_source: source,
      };
    catForecastMap[cat].forecast_hours += d.expected_total_hours;
    catForecastMap[cat].forecast_revenue += d.expected_total_hours * rate;
  }

  const forecast_weekly = Object.entries(forecastWeekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, v]) => ({
      week,
      label: weekLabel(week),
      revenue: Math.round(v.revenue),
      p80_revenue: Math.round(v.p80_revenue),
    }));

  const total_forecast_revenue = Math.round(
    forecast_weekly.reduce((s, w) => s + w.revenue, 0),
  );

  // ── Pipeline revenue (probability-weighted open quotes) ───────────────────
  const pipeline_revenue = Math.round(
    pipelineDemand.reduce((sum, d) => {
      const { rate } = getRateForCategory(d.aircraft_category);
      return sum + d.pipeline_hours * rate;
    }, 0),
  );

  // ── Confirmed revenue (booked, not yet flown) ─────────────────────────────
  const { data: confirmedQuotes } = await supabase
    .from("quotes")
    .select("quote_costs(total)")
    .eq("status", "confirmed")
    .not("scheduled_departure_time", "is", null)
    .gte("scheduled_departure_time", today.toISOString())
    .lte("scheduled_departure_time", futureEnd.toISOString());

  const confirmed_revenue = Math.round(
    (confirmedQuotes ?? []).reduce((s, q) => s + sumCosts(q.quote_costs), 0),
  );

  // ── By-category breakdown ─────────────────────────────────────────────────
  const by_category = Object.entries(catForecastMap)
    .map(([cat, v]) => {
      const weekRevs = Object.values(catHistWeekMap[cat] ?? {});
      const historical_avg_weekly =
        weekRevs.length > 0
          ? Math.round(weekRevs.reduce((s, r) => s + r, 0) / weekRevs.length)
          : 0;
      return {
        category: cat,
        forecast_hours: Math.round(v.forecast_hours * 10) / 10,
        forecast_revenue: Math.round(v.forecast_revenue),
        historical_avg_weekly,
        rate_per_hour: Math.round(v.rate),
        rate_source: v.rate_source,
      };
    })
    .sort((a, b) => b.forecast_revenue - a.forecast_revenue);

  return NextResponse.json({
    horizon_days: days,
    historical_weekly,
    forecast_weekly,
    confirmed_revenue,
    pipeline_revenue,
    by_category,
    total_forecast_revenue,
    avg_weekly_revenue: avgWeeklyRevenue,
  });
}
