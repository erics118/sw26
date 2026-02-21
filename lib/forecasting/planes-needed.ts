import type { CapacityDay, ExpectedDemandDay, PlanesNeeded } from "./types";
import { TARGET_UTIL_HOURS } from "./types";

/**
 * Combine capacity + demand to produce "planes needed" and capacity gap per date per category.
 */
export function computePlanesNeeded(
  capacity: CapacityDay[],
  demand: ExpectedDemandDay[],
): PlanesNeeded[] {
  // Build lookup maps
  const capacityMap: Record<string, Record<string, CapacityDay>> = {};
  for (const c of capacity) {
    if (!capacityMap[c.date]) capacityMap[c.date] = {};
    (capacityMap[c.date] as Record<string, CapacityDay>)[c.aircraft_category] =
      c;
  }

  const result: PlanesNeeded[] = [];

  for (const d of demand) {
    const cap = capacityMap[d.date]?.[d.aircraft_category];
    const availableHours = cap?.total_available_hours ?? 0;
    const targetUtil: number =
      TARGET_UTIL_HOURS[d.aircraft_category] ??
      TARGET_UTIL_HOURS["midsize"] ??
      3.0;

    const requiredAircraft =
      targetUtil > 0 ? Math.ceil(d.expected_total_hours / targetUtil) : 0;
    const capacityGapHours = d.expected_total_hours - availableHours;
    const capacityGapAircraft =
      capacityGapHours > 0 && targetUtil > 0
        ? Math.ceil(capacityGapHours / targetUtil)
        : 0;

    let status: "surplus" | "balanced" | "shortage";
    if (capacityGapHours > targetUtil) {
      status = "shortage";
    } else if (capacityGapHours < -targetUtil) {
      status = "surplus";
    } else {
      status = "balanced";
    }

    result.push({
      date: d.date,
      aircraft_category: d.aircraft_category,
      expected_demand_hours: d.expected_total_hours,
      available_hours: availableHours,
      required_aircraft: requiredAircraft,
      capacity_gap_hours: Math.round(capacityGapHours * 10) / 10,
      capacity_gap_aircraft: capacityGapAircraft,
      status,
    });
  }

  return result.sort((a, b) => (a.date < b.date ? -1 : 1));
}
