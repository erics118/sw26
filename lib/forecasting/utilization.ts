import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type {
  UtilizationMetrics,
  UtilizationFlag,
  CategoryUtilizationSummary,
} from "./types";
import { dateRange, addDays } from "./utils";

const UNDERUTILIZED_THRESHOLD = 0.6;
const OVERCONSTRAINED_THRESHOLD = 0.85;
const INEFFICIENT_THRESHOLD = 0.3;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute utilization metrics per aircraft over a given period.
 *
 * utilization_rate    = (paid_hours + reposition_hours) / available_hours
 * idle_days           = days with zero scheduled hours
 * idle_risk_score     = 0.5*(1-util_48h) + 0.3*(1-util_7d) + 0.2*(idle_days/period_days), clamped 0..1
 * deadhead_waste_score = repoHours / (paidHours + repoHours), 0 if total = 0
 * inefficient         = flag when reposition share of used hours is high
 */
export async function computeUtilization(
  supabase: SupabaseClient<Database>,
  startDate: Date,
  endDate: Date,
): Promise<{
  aircraft: UtilizationMetrics[];
  by_category: CategoryUtilizationSummary[];
}> {
  // 1. Fetch all active aircraft
  const { data: aircraft } = await supabase
    .from("aircraft")
    .select("id, tail_number, category, home_base_icao, daily_available_hours")
    .eq("status", "active");

  if (!aircraft || aircraft.length === 0)
    return { aircraft: [], by_category: [] };

  // 2. Fetch completed/confirmed quotes with actuals in period
  const { data: quotes } = await supabase
    .from("quotes")
    .select(
      "aircraft_id, actual_total_hours, actual_block_hours, actual_reposition_hours, actual_departure_time, scheduled_departure_time, scheduled_total_hours, status",
    )
    .in("status", ["confirmed", "completed"])
    .gte("actual_departure_time", startDate.toISOString())
    .lte("actual_departure_time", endDate.toISOString());

  // Also grab confirmed (not yet flown) for scheduling purposes
  const { data: confirmedQuotes } = await supabase
    .from("quotes")
    .select("aircraft_id, scheduled_departure_time, scheduled_total_hours")
    .eq("status", "confirmed")
    .gte("scheduled_departure_time", startDate.toISOString())
    .lte("scheduled_departure_time", endDate.toISOString());

  const totalDays = dateRange(startDate, endDate).length;

  // Compute the 7-day sub-window: last 7 days of startDate..endDate
  const sevenDayWindowStart = addDays(endDate, -6);
  const sevenDayWindowStartISO = sevenDayWindowStart.toISOString();

  // 3. Aggregate per aircraft (full period + 7-day sub-window)
  const acStats: Record<
    string,
    { paidHours: number; repoHours: number; scheduledDates: Set<string> }
  > = {};

  // sevenDayStats: counts hours only from quotes with actual_departure_time >= (endDate - 7d)
  const sevenDayStats: Record<
    string,
    { paidHours: number; repoHours: number }
  > = {};

  for (const q of quotes ?? []) {
    if (!q.aircraft_id) continue;
    if (!acStats[q.aircraft_id]) {
      acStats[q.aircraft_id] = {
        paidHours: 0,
        repoHours: 0,
        scheduledDates: new Set(),
      };
    }
    // actual_total_hours = block + reposition; avoid double-counting when block is null
    const blockHours = q.actual_block_hours ?? 0;
    const repoHours = q.actual_reposition_hours ?? 0;
    const totalHours =
      blockHours > 0 || repoHours > 0
        ? blockHours + repoHours
        : (q.actual_total_hours ?? 0);
    const stat = acStats[q.aircraft_id];
    if (stat) {
      const paidForQuote =
        blockHours > 0 ? blockHours : Math.max(0, totalHours - repoHours);
      stat.paidHours += paidForQuote;
      stat.repoHours += repoHours;
      if (q.actual_departure_time) {
        stat.scheduledDates.add(q.actual_departure_time.slice(0, 10));
      }

      // Accumulate 7-day sub-window stats
      if (
        q.actual_departure_time &&
        q.actual_departure_time >= sevenDayWindowStartISO
      ) {
        if (!sevenDayStats[q.aircraft_id]) {
          sevenDayStats[q.aircraft_id] = { paidHours: 0, repoHours: 0 };
        }
        const s7 = sevenDayStats[q.aircraft_id];
        if (s7) {
          s7.paidHours += paidForQuote;
          s7.repoHours += repoHours;
        }
      }
    }
  }

  for (const q of confirmedQuotes ?? []) {
    if (!q.aircraft_id) continue;
    if (!acStats[q.aircraft_id]) {
      acStats[q.aircraft_id] = {
        paidHours: 0,
        repoHours: 0,
        scheduledDates: new Set(),
      };
    }
    if (q.scheduled_departure_time) {
      acStats[q.aircraft_id]?.scheduledDates.add(
        q.scheduled_departure_time.slice(0, 10),
      );
    }
  }

  // Build a Set of aircraft_ids that have a confirmed quote in the next 48 hours
  const now = new Date();
  const fortyEightHoursLater = addDays(now, 2);
  const nowISO = now.toISOString();
  const fortyEightISO = fortyEightHoursLater.toISOString();

  const aircraftWith48hBooking = new Set<string>();
  for (const q of confirmedQuotes ?? []) {
    if (
      q.aircraft_id &&
      q.scheduled_departure_time &&
      q.scheduled_departure_time >= nowISO &&
      q.scheduled_departure_time <= fortyEightISO
    ) {
      aircraftWith48hBooking.add(q.aircraft_id);
    }
  }

  // 4. Build metrics per aircraft
  const metrics: UtilizationMetrics[] = [];

  for (const ac of aircraft) {
    const stats = acStats[ac.id] ?? {
      paidHours: 0,
      repoHours: 0,
      scheduledDates: new Set<string>(),
    };
    const dailyHours = Number(ac.daily_available_hours ?? 8);
    const availableHours = dailyHours * totalDays;
    const totalUsed = stats.paidHours + stats.repoHours;
    const utilizationRate = availableHours > 0 ? totalUsed / availableHours : 0;
    const repositionRatio = totalUsed > 0 ? stats.repoHours / totalUsed : 0;
    const idleDays = totalDays - stats.scheduledDates.size;

    // util_48h: 1.0 if aircraft has any confirmed quote in next 48h, else 0.0
    const util48h = aircraftWith48hBooking.has(ac.id) ? 1.0 : 0.0;

    // util_7d: utilization rate using only last 7 days of the period
    const s7 = sevenDayStats[ac.id] ?? { paidHours: 0, repoHours: 0 };
    const sevenDayAvailableHours = dailyHours * 7;
    const sevenDayUsed = s7.paidHours + s7.repoHours;
    const util7d =
      sevenDayAvailableHours > 0 ? sevenDayUsed / sevenDayAvailableHours : 0;

    // idle_risk_score = clamp(0.5*(1-util_48h) + 0.3*(1-util_7d) + 0.2*(idleDays/totalDays), 0, 1)
    const idleRiskScore = clamp(
      0.5 * (1 - util48h) +
        0.3 * (1 - util7d) +
        0.2 * (totalDays > 0 ? idleDays / totalDays : 0),
      0,
      1,
    );

    // deadhead_waste_score = repoHours / (paidHours + repoHours), 0 if total = 0
    const deadheadWasteScore =
      totalUsed > 0
        ? Math.round((stats.repoHours / totalUsed) * 1000) / 1000
        : 0;

    const flags: UtilizationFlag[] = [];
    if (utilizationRate < UNDERUTILIZED_THRESHOLD) flags.push("underutilized");
    if (utilizationRate > OVERCONSTRAINED_THRESHOLD)
      flags.push("overconstrained");
    if (repositionRatio > INEFFICIENT_THRESHOLD) flags.push("inefficient");

    metrics.push({
      aircraft_id: ac.id,
      tail_number: ac.tail_number,
      category: ac.category,
      home_base_icao: ac.home_base_icao,
      utilization_rate: Math.round(utilizationRate * 1000) / 1000,
      idle_risk_score: Math.round(idleRiskScore * 1000) / 1000,
      deadhead_waste_score: deadheadWasteScore,
      idle_days: idleDays,
      paid_hours: Math.round(stats.paidHours * 10) / 10,
      reposition_hours: Math.round(stats.repoHours * 10) / 10,
      available_hours: Math.round(availableHours * 10) / 10,
      flags,
    });
  }

  // Sort by idle_risk_score descending (highest risk first)
  metrics.sort((a, b) => b.idle_risk_score - a.idle_risk_score);

  // 5. Category summaries
  const catMap: Record<
    string,
    {
      total: number;
      count: number;
      idleDays: number;
      underutilized: number;
      overconstrained: number;
      totalIdleRisk: number;
    }
  > = {};
  for (const m of metrics) {
    if (!catMap[m.category]) {
      catMap[m.category] = {
        total: 0,
        count: 0,
        idleDays: 0,
        underutilized: 0,
        overconstrained: 0,
        totalIdleRisk: 0,
      };
    }
    const catEntry = catMap[m.category];
    if (catEntry) {
      catEntry.total += m.utilization_rate;
      catEntry.count += 1;
      catEntry.idleDays += m.idle_days;
      catEntry.totalIdleRisk += m.idle_risk_score;
      if (m.flags.includes("underutilized")) catEntry.underutilized += 1;
      if (m.flags.includes("overconstrained")) catEntry.overconstrained += 1;
    }
  }

  const by_category: CategoryUtilizationSummary[] = Object.entries(catMap).map(
    ([cat, v]) => ({
      aircraft_category: cat,
      avg_utilization_rate:
        v.count > 0 ? Math.round((v.total / v.count) * 1000) / 1000 : 0,
      avg_idle_risk_score:
        v.count > 0 ? Math.round((v.totalIdleRisk / v.count) * 1000) / 1000 : 0,
      total_idle_days: v.idleDays,
      total_aircraft: v.count,
      underutilized_count: v.underutilized,
      overconstrained_count: v.overconstrained,
    }),
  );

  return { aircraft: metrics, by_category };
}
