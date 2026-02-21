import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type {
  UtilizationMetrics,
  ExpectedDemandDay,
  RepositionRecommendation,
  MaintenanceWindowRecommendation,
} from "./types";
import { addDays, formatDate } from "./utils";

// Cost estimate: $500/hour for reposition (rough default)
const REPOSITION_COST_PER_HOUR = 500;

/**
 * Action Engine: generates recommendations for underutilized aircraft.
 *
 * 1. Reposition (best ROI)
 * 2. Maintenance window (use planned downtime)
 */
export async function generateRecommendations(
  supabase: SupabaseClient<Database>,
  underutilizedAircraft: UtilizationMetrics[],
  forecastDemand: ExpectedDemandDay[],
  horizonDays: number = 7,
): Promise<{
  reposition: RepositionRecommendation[];
  maintenance_windows: MaintenanceWindowRecommendation[];
}> {
  const today = new Date();
  const futureEnd = addDays(today, horizonDays);

  // Build demand lookup: category → date → expected_hours
  const demandMap: Record<string, Record<string, number>> = {};
  for (const d of forecastDemand) {
    if (!demandMap[d.aircraft_category]) demandMap[d.aircraft_category] = {};
    (demandMap[d.aircraft_category] as Record<string, number>)[d.date] =
      d.expected_total_hours;
  }

  // Find top-demand destinations from historical confirmed quotes
  const { data: historicalQuotes } = await supabase
    .from("quotes")
    .select("chosen_aircraft_category, aircraft_id, trips(legs)")
    .in("status", ["confirmed", "completed"])
    .gte("created_at", addDays(today, -90).toISOString());

  // Build airport demand score: airport → count of confirmed flights arriving there
  const airportScore: Record<string, number> = {};
  for (const q of historicalQuotes ?? []) {
    const tripsData = q as unknown as {
      trips?: { legs?: Array<{ to_icao: string }> } | null;
    };
    const legs = tripsData.trips?.legs ?? [];
    for (const leg of legs) {
      if (leg.to_icao) {
        airportScore[leg.to_icao] = (airportScore[leg.to_icao] ?? 0) + 1;
      }
    }
  }

  const topAirports = Object.entries(airportScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([icao]) => icao);

  const repositionRecs: RepositionRecommendation[] = [];
  const maintenanceRecs: MaintenanceWindowRecommendation[] = [];

  for (const ac of underutilizedAircraft) {
    if (!ac.flags.includes("underutilized")) continue;

    const fromAirport = ac.home_base_icao ?? "KXXX";

    // ─── A. Reposition Recommendation ────────────────────────────────────
    // Find the airport with highest future demand for this category
    const categoryDemand = demandMap[ac.category] ?? {};
    const nextWeekHighDemandDates = Object.entries(categoryDemand)
      .filter(
        ([date]) => date >= formatDate(today) && date <= formatDate(futureEnd),
      )
      .sort((a, b) => b[1] - a[1]);

    if (nextWeekHighDemandDates.length > 0) {
      const topEntry = nextWeekHighDemandDates[0];
      if (!topEntry) continue;
      const [peakDate, peakHours] = topEntry;

      // Pick best destination (most historically demanded airport)
      const bestDest = topAirports.find((a) => a !== fromAirport) ?? "KMIA";

      // Estimate 1.5 hour reposition (rough average)
      const estimatedRepoHours = 1.5;
      const estimatedRepoCost = Math.round(
        estimatedRepoHours * REPOSITION_COST_PER_HOUR,
      );

      repositionRecs.push({
        type: "reposition",
        aircraft_id: ac.aircraft_id,
        tail_number: ac.tail_number,
        move_from_airport: fromAirport,
        move_to_airport: bestDest,
        recommended_departure_time: new Date(
          peakDate + "T08:00:00Z",
        ).toISOString(),
        estimated_reposition_hours: estimatedRepoHours,
        estimated_reposition_cost: estimatedRepoCost,
        expected_utilization_gain: peakHours,
        reason: `${ac.category} demand peak on ${peakDate} (${peakHours.toFixed(1)} hrs forecast)`,
      });
    }

    // ─── B. Maintenance Window ────────────────────────────────────────────
    // Suggest scheduling maintenance during lowest-demand window
    const categoryDates = Object.entries(categoryDemand)
      .filter(
        ([date]) => date >= formatDate(today) && date <= formatDate(futureEnd),
      )
      .sort((a, b) => a[1] - b[1]); // ascending = lowest demand first

    if (categoryDates.length > 0) {
      const lowEntry = categoryDates[0];
      if (!lowEntry) continue;
      const [lowDate, lowHours] = lowEntry;
      const suggestedStart = new Date(lowDate + "T06:00:00Z");
      const suggestedEnd = new Date(lowDate + "T18:00:00Z");

      maintenanceRecs.push({
        type: "maintenance_window",
        aircraft_id: ac.aircraft_id,
        tail_number: ac.tail_number,
        suggested_start: suggestedStart.toISOString(),
        suggested_end: suggestedEnd.toISOString(),
        reason: `Lowest demand period for ${ac.category} (${lowHours.toFixed(1)} hrs forecast)`,
        low_demand_hours: lowHours,
      });
    }
  }

  return {
    reposition: repositionRecs.slice(0, 10),
    maintenance_windows: maintenanceRecs.slice(0, 10),
  };
}
