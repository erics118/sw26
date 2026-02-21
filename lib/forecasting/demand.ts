import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type {
  ConfirmedDemandDay,
  ExpectedDemandDay,
  PipelineDemandDay,
} from "./types";
import { dateRange, getDayOfWeek } from "./utils";

// Near-term horizon: use confirmed flights for this many days out
const CONFIRMED_HORIZON_DAYS = 14;

/**
 * Compute confirmed demand (hard actuals) for 0–14 day horizon.
 * Sums scheduled_total_hours from confirmed/completed quotes per date per category.
 */
export async function computeConfirmedDemand(
  supabase: SupabaseClient<Database>,
  startDate: Date,
  endDate: Date,
  category?: string,
): Promise<ConfirmedDemandDay[]> {
  let query = supabase
    .from("quotes")
    .select(
      "chosen_aircraft_category, scheduled_departure_time, scheduled_total_hours",
    )
    .in("status", ["confirmed", "completed"])
    .not("scheduled_departure_time", "is", null)
    .gte("scheduled_departure_time", startDate.toISOString())
    .lte("scheduled_departure_time", endDate.toISOString());

  if (category) query = query.eq("chosen_aircraft_category", category);
  const { data: quotes } = await query;
  if (!quotes) return [];

  // Group by date + category
  const map: Record<
    string,
    Record<string, { hours: number; count: number }>
  > = {};
  for (const q of quotes) {
    const date = q.scheduled_departure_time!.slice(0, 10);
    const cat = q.chosen_aircraft_category ?? "unknown";
    if (!map[date]) map[date] = {};
    if (!map[date][cat]) map[date][cat] = { hours: 0, count: 0 };
    map[date][cat].hours += q.scheduled_total_hours ?? 0;
    map[date][cat].count += 1;
  }

  const result: ConfirmedDemandDay[] = [];
  for (const date of Object.keys(map)) {
    const dayMap = map[date];
    if (!dayMap) continue;
    for (const cat of Object.keys(dayMap)) {
      const entry = dayMap[cat];
      if (!entry) continue;
      result.push({
        date,
        aircraft_category: cat,
        confirmed_total_hours: Math.round(entry.hours * 10) / 10,
        num_confirmed_flights: entry.count,
      });
    }
  }
  return result.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/**
 * MVP forecasting model:
 * ForecastHours(date, category) = baseline × dow_multiplier × peak_multiplier
 *
 * baseline = rolling 6-week mean of actual_total_hours from completed flights
 * dow_multiplier = avg hours on that weekday / overall daily avg
 * peak_multiplier = from fleet_forecast_overrides (default 1.0)
 */
export async function computeExpectedDemand(
  supabase: SupabaseClient<Database>,
  startDate: Date,
  endDate: Date,
  category?: string,
): Promise<ExpectedDemandDay[]> {
  // 1. Fetch 6 weeks of historical actual_total_hours (completed flights)
  const historyStart = new Date(startDate);
  historyStart.setUTCDate(historyStart.getUTCDate() - 42); // 6 weeks back

  let histQuery = supabase
    .from("quotes")
    .select(
      "chosen_aircraft_category, actual_departure_time, actual_total_hours",
    )
    .eq("status", "completed")
    .not("actual_departure_time", "is", null)
    .not("actual_total_hours", "is", null)
    .gte("actual_departure_time", historyStart.toISOString())
    .lt("actual_departure_time", startDate.toISOString());

  if (category) histQuery = histQuery.eq("chosen_aircraft_category", category);
  const { data: history } = await histQuery;

  // 2. Fetch peak-day overrides for the forecast period
  const overrideQuery = supabase
    .from("fleet_forecast_overrides")
    .select("date, aircraft_category, peak_multiplier")
    .gte("date", startDate.toISOString().slice(0, 10))
    .lte("date", endDate.toISOString().slice(0, 10));
  const { data: overrides } = await overrideQuery;

  // Build override lookup: date → category → multiplier
  const overrideMap: Record<string, Record<string, number>> = {};
  for (const o of overrides ?? []) {
    if (!overrideMap[o.date]) overrideMap[o.date] = {};
    (overrideMap[o.date] as Record<string, number>)[o.aircraft_category] =
      Number(o.peak_multiplier);
  }

  // 3. Compute baseline & DOW multipliers per category
  // Group historical hours by category and day-of-week
  const catData: Record<
    string,
    { total: number; days: number; byDow: number[]; byDowCount: number[] }
  > = {};

  for (const q of history ?? []) {
    const cat = q.chosen_aircraft_category ?? "unknown";
    const hours = Number(q.actual_total_hours ?? 0);
    const dow = getDayOfWeek(q.actual_departure_time!.slice(0, 10));

    if (!catData[cat]) {
      catData[cat] = {
        total: 0,
        days: 0,
        byDow: Array(7).fill(0),
        byDowCount: Array(7).fill(0),
      };
    }
    const entry = catData[cat];
    if (!entry) continue;
    entry.total += hours;
    entry.days += 1;
    if (entry.byDow[dow] !== undefined) entry.byDow[dow] += hours;
    if (entry.byDowCount[dow] !== undefined) entry.byDowCount[dow] += 1;
  }

  // 4. Generate forecast for each date × category
  const dates = dateRange(startDate, endDate);
  const cutoffDate = new Date(startDate);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() + CONFIRMED_HORIZON_DAYS);

  // Get confirmed demand for near-term blending
  const confirmedMap: Record<string, Record<string, number>> = {};
  if (startDate < cutoffDate) {
    const confirmed = await computeConfirmedDemand(
      supabase,
      startDate,
      cutoffDate,
      category,
    );
    for (const c of confirmed) {
      if (!confirmedMap[c.date]) confirmedMap[c.date] = {};
      (confirmedMap[c.date] as Record<string, number>)[c.aircraft_category] =
        c.confirmed_total_hours;
    }
  }

  const result: ExpectedDemandDay[] = [];

  // Determine which categories to forecast
  const categoriesToForecast = category
    ? [category]
    : [...new Set(Object.keys(catData))];

  for (const cat of categoriesToForecast) {
    const data = catData[cat];
    const baseline = data && data.days > 0 ? data.total / data.days : 2.5; // default fallback

    for (const date of dates) {
      const dow = getDayOfWeek(date);
      const isNearTerm = date < cutoffDate.toISOString().slice(0, 10);

      // DOW multiplier
      let dowMultiplier = 1.0;
      if (data && (data.byDowCount[dow] ?? 0) > 0) {
        const dowAvg = (data.byDow[dow] ?? 0) / (data.byDowCount[dow] ?? 1);
        const overallAvg = data.days > 0 ? data.total / data.days : 1;
        dowMultiplier = overallAvg > 0 ? dowAvg / overallAvg : 1.0;
      }
      dowMultiplier = Math.max(0.5, Math.min(2.0, dowMultiplier));

      // Peak multiplier from overrides
      const peakMultiplier =
        overrideMap[date]?.[cat] ?? overrideMap[date]?.["all"] ?? 1.0;

      let expectedHours: number;
      let isConfirmed = false;

      if (isNearTerm && confirmedMap[date]?.[cat] !== undefined) {
        // Use confirmed demand for near-term
        expectedHours = confirmedMap[date]?.[cat] ?? 0;
        isConfirmed = true;
      } else {
        expectedHours = baseline * dowMultiplier * peakMultiplier;
      }

      const p80Hours = isConfirmed
        ? Math.round(expectedHours * 10) / 10
        : Math.round(expectedHours * 1.25 * 10) / 10;

      result.push({
        date,
        aircraft_category: cat,
        expected_total_hours: Math.round(expectedHours * 10) / 10,
        p80_hours: p80Hours,
        baseline_hours: Math.round(baseline * 10) / 10,
        dow_multiplier: Math.round(dowMultiplier * 100) / 100,
        peak_multiplier: peakMultiplier,
        is_confirmed: isConfirmed,
      });
    }
  }

  return result.sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Stage win probabilities
const STAGE_WIN_PROB: Record<string, number> = {
  pending: 0.2,
  quoted: 0.4,
  negotiating: 0.65,
  verbally_confirmed: 0.85,
};

/**
 * Compute probability-weighted pipeline demand from open quotes.
 * Groups by date (from scheduled_departure_time) and category.
 * Applies pricing sensitivity: if quoted_price > category median, multiply p_win by 0.90.
 */
export async function computePipelineDemand(
  supabase: SupabaseClient<Database>,
  startDate: Date,
  endDate: Date,
  category?: string,
): Promise<PipelineDemandDay[]> {
  // Fetch pipeline quotes
  let pipelineQuery = supabase
    .from("quotes")
    .select(
      "chosen_aircraft_category, scheduled_departure_time, scheduled_total_hours, status",
    )
    .in("status", ["quoted", "negotiating", "verbally_confirmed", "pending"])
    .not("scheduled_departure_time", "is", null)
    .gte("scheduled_departure_time", startDate.toISOString())
    .lte("scheduled_departure_time", endDate.toISOString());

  if (category)
    pipelineQuery = pipelineQuery.eq("chosen_aircraft_category", category);

  const { data: pipelineQuotes } = await pipelineQuery;
  if (!pipelineQuotes) return [];

  // quoted_price column does not exist in the current schema — skip pricing sensitivity
  // and use stage priors only.

  // Group by date + category
  const map: Record<
    string,
    Record<string, { weightedHours: number; count: number }>
  > = {};

  for (const q of pipelineQuotes) {
    const date = q.scheduled_departure_time!.slice(0, 10);
    const cat = q.chosen_aircraft_category ?? "unknown";
    const status = q.status ?? "quoted";
    const pWin = STAGE_WIN_PROB[status] ?? 0.4;

    const weightedHours = pWin * (q.scheduled_total_hours ?? 0);

    if (!map[date]) map[date] = {};
    if (!map[date][cat]) map[date][cat] = { weightedHours: 0, count: 0 };
    const entry = map[date][cat];
    if (entry) {
      entry.weightedHours += weightedHours;
      entry.count += 1;
    }
  }

  const result: PipelineDemandDay[] = [];
  for (const date of Object.keys(map)) {
    const dayMap = map[date];
    if (!dayMap) continue;
    for (const cat of Object.keys(dayMap)) {
      const entry = dayMap[cat];
      if (!entry) continue;
      result.push({
        date,
        aircraft_category: cat,
        pipeline_hours: Math.round(entry.weightedHours * 10) / 10,
        quote_count: entry.count,
      });
    }
  }

  return result.sort((a, b) => (a.date < b.date ? -1 : 1));
}
