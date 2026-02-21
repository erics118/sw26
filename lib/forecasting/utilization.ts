import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type {
  UtilizationMetrics,
  UtilizationFlag,
  CategoryUtilizationSummary,
} from "./types";
import { dateRange } from "./utils";

const UNDERUTILIZED_THRESHOLD = 0.6;
const OVERCONSTRAINED_THRESHOLD = 0.85;
const INEFFICIENT_THRESHOLD = 0.3;

/**
 * Compute utilization metrics per aircraft over a given period.
 *
 * utilization_rate = (paid_hours + reposition_hours) / available_hours
 * idle_days        = days with zero scheduled hours
 * inefficient     = flag when reposition share of used hours is high
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

  // 3. Aggregate per aircraft
  const acStats: Record<
    string,
    { paidHours: number; repoHours: number; scheduledDates: Set<string> }
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
    const blockHours = q.actual_block_hours ?? q.actual_total_hours ?? 0;
    const repoHours = q.actual_reposition_hours ?? 0;
    const stat = acStats[q.aircraft_id];
    if (stat) {
      stat.paidHours += Number(blockHours);
      stat.repoHours += Number(repoHours);
      if (q.actual_departure_time) {
        stat.scheduledDates.add(q.actual_departure_time.slice(0, 10));
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

  // 4. Build metrics per aircraft
  const metrics: UtilizationMetrics[] = [];

  for (const ac of aircraft) {
    const stats = acStats[ac.id] ?? {
      paidHours: 0,
      repoHours: 0,
      scheduledDates: new Set<string>(),
    };
    const dailyHours = Number(ac.daily_available_hours ?? 24);
    const availableHours = dailyHours * totalDays;
    const totalUsed = stats.paidHours + stats.repoHours;
    const utilizationRate = availableHours > 0 ? totalUsed / availableHours : 0;
    const repositionRatio = totalUsed > 0 ? stats.repoHours / totalUsed : 0;
    const idleDays = totalDays - stats.scheduledDates.size;

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
      idle_days: idleDays,
      paid_hours: Math.round(stats.paidHours * 10) / 10,
      reposition_hours: Math.round(stats.repoHours * 10) / 10,
      available_hours: Math.round(availableHours * 10) / 10,
      flags,
    });
  }

  // Sort by utilization ascending (most idle first)
  metrics.sort((a, b) => a.utilization_rate - b.utilization_rate);

  // 5. Category summaries
  const catMap: Record<
    string,
    {
      total: number;
      count: number;
      idleDays: number;
      underutilized: number;
      overconstrained: number;
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
      };
    }
    const catEntry = catMap[m.category];
    if (catEntry) {
      catEntry.total += m.utilization_rate;
      catEntry.count += 1;
      catEntry.idleDays += m.idle_days;
      if (m.flags.includes("underutilized")) catEntry.underutilized += 1;
      if (m.flags.includes("overconstrained")) catEntry.overconstrained += 1;
    }
  }

  const by_category: CategoryUtilizationSummary[] = Object.entries(catMap).map(
    ([cat, v]) => ({
      aircraft_category: cat,
      avg_utilization_rate:
        v.count > 0 ? Math.round((v.total / v.count) * 1000) / 1000 : 0,
      total_idle_days: v.idleDays,
      total_aircraft: v.count,
      underutilized_count: v.underutilized,
      overconstrained_count: v.overconstrained,
    }),
  );

  return { aircraft: metrics, by_category };
}
