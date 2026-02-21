import type {
  CapacityDay,
  ExpectedDemandDay,
  PipelineDemandDay,
  PlanesNeeded,
} from "./types";
import { TARGET_UTIL_HOURS } from "./types";

/**
 * Combine capacity + demand (+ optional pipeline) to produce "planes needed" and capacity gap per date per category.
 * Uses P80 demand for required_aircraft and capacityGapHours calculations.
 */
export function computePlanesNeeded(
  capacity: CapacityDay[],
  demand: ExpectedDemandDay[],
  pipeline?: PipelineDemandDay[],
): PlanesNeeded[] {
  // Build capacity lookup
  const capacityMap: Record<string, Record<string, CapacityDay>> = {};
  for (const c of capacity) {
    if (!capacityMap[c.date]) capacityMap[c.date] = {};
    (capacityMap[c.date] as Record<string, CapacityDay>)[c.aircraft_category] =
      c;
  }

  // Build pipeline lookup: date → category → pipeline_hours
  const pipelineLookup: Record<string, Record<string, number>> = {};
  for (const p of pipeline ?? []) {
    if (!pipelineLookup[p.date]) pipelineLookup[p.date] = {};
    (pipelineLookup[p.date] as Record<string, number>)[p.aircraft_category] =
      p.pipeline_hours;
  }

  const result: PlanesNeeded[] = [];

  for (const d of demand) {
    const cap = capacityMap[d.date]?.[d.aircraft_category];
    const availableHours = cap?.total_available_hours ?? 0;
    const targetUtil: number =
      TARGET_UTIL_HOURS[d.aircraft_category] ??
      TARGET_UTIL_HOURS["midsize"] ??
      3.0;

    const p80Hours = d.p80_hours;
    const pipelineHours = pipelineLookup[d.date]?.[d.aircraft_category] ?? 0;

    const requiredAircraft =
      targetUtil > 0 ? Math.ceil(p80Hours / targetUtil) : 0;
    const capacityGapHours = p80Hours - availableHours;
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
      p80_demand_hours: p80Hours,
      pipeline_hours: pipelineHours,
      available_hours: availableHours,
      required_aircraft: requiredAircraft,
      capacity_gap_hours: Math.round(capacityGapHours * 10) / 10,
      capacity_gap_aircraft: capacityGapAircraft,
      status,
    });
  }

  return result.sort((a, b) => (a.date < b.date ? -1 : 1));
}
