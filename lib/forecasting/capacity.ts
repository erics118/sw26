import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { CapacityDay } from "./types";
import { dateRange } from "./utils";

/**
 * Compute the supply-side capacity (available hours) for each aircraft category
 * over a date range.
 *
 * total_available_hours = sum(daily_available_hours for active aircraft in category)
 *                         - scheduled maintenance hours on that date
 */
export async function computeCapacity(
  supabase: SupabaseClient<Database>,
  startDate: Date,
  endDate: Date,
  category?: string,
): Promise<CapacityDay[]> {
  // 1. Fetch all active aircraft
  let acQuery = supabase
    .from("aircraft")
    .select("id, category, daily_available_hours, home_base_icao")
    .eq("status", "active");
  if (category) acQuery = acQuery.eq("category", category);
  const { data: aircraft, error: acErr } = await acQuery;
  if (acErr || !aircraft) return [];

  // 2. Fetch maintenance blocks that overlap the date range
  const { data: maintenance } = await supabase
    .from("aircraft_maintenance")
    .select("aircraft_id, start_time, end_time")
    .lte("start_time", endDate.toISOString())
    .gte("end_time", startDate.toISOString());

  const maintenanceBlocks = maintenance ?? [];

  // 3. Group aircraft by category
  const categoriesMap: Record<
    string,
    Array<{ id: string; daily_available_hours: number }>
  > = {};
  for (const ac of aircraft) {
    const cat = ac.category;
    if (!categoriesMap[cat]) categoriesMap[cat] = [];
    categoriesMap[cat].push({
      id: ac.id,
      daily_available_hours: ac.daily_available_hours ?? 24,
    });
  }

  // 4. For each date × category, compute available hours
  const dates = dateRange(startDate, endDate);
  const result: CapacityDay[] = [];

  for (const cat of Object.keys(categoriesMap)) {
    const acList = categoriesMap[cat] ?? [];

    for (const date of dates) {
      const dayStart = new Date(date + "T00:00:00Z");
      const dayEnd = new Date(date + "T23:59:59Z");

      let maintenanceHours = 0;
      let totalAvailableHours = 0;

      for (const ac of acList) {
        const baseHours = ac.daily_available_hours;

        // Find maintenance hours for this aircraft on this date
        const acMaintenance = maintenanceBlocks.filter(
          (m) => m.aircraft_id === ac.id,
        );
        let acMaintenanceHours = 0;
        for (const block of acMaintenance) {
          const blockStart = new Date(block.start_time);
          const blockEnd = new Date(block.end_time);
          // Overlap hours with this date
          const overlapStart = blockStart < dayStart ? dayStart : blockStart;
          const overlapEnd = blockEnd > dayEnd ? dayEnd : blockEnd;
          if (overlapEnd > overlapStart) {
            acMaintenanceHours +=
              (overlapEnd.getTime() - overlapStart.getTime()) /
              (1000 * 60 * 60);
          }
        }
        acMaintenanceHours = Math.min(acMaintenanceHours, baseHours);
        maintenanceHours += acMaintenanceHours;
        totalAvailableHours += Math.max(0, baseHours - acMaintenanceHours);
      }

      result.push({
        date,
        aircraft_category: cat,
        num_active_aircraft: (acList ?? []).length,
        total_available_hours: Math.round(totalAvailableHours * 10) / 10,
        maintenance_hours: Math.round(maintenanceHours * 10) / 10,
      });
    }
  }

  return result.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

// Re-export for convenience
export { addDays, formatDate, dateRange } from "./utils";
export {};
