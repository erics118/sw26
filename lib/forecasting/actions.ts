import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type {
  UtilizationMetrics,
  ExpectedDemandDay,
  RepositionRecommendation,
  MaintenanceWindowRecommendation,
  ActionRecommendation,
  ScoredRecommendation,
} from "./types";
import { CATEGORY_HOURLY_RATE } from "./types";
import { addDays, formatDate } from "./utils";

// Cost estimate: $500/hour for reposition (rough default)
const REPOSITION_COST_PER_HOUR = 500;

type MaintenanceBlock = {
  aircraft_id: string;
  start_time: string;
  end_time: string;
};

type ConfirmedBooking = {
  aircraft_id: string;
  scheduled_departure_time: string;
};

function checkFeasibility(
  aircraftId: string,
  windowStart: Date,
  windowEnd: Date,
  maintenanceByAircraft: Map<string, MaintenanceBlock[]>,
  bookingsByAircraft: Map<string, ConfirmedBooking[]>,
): boolean {
  for (const b of maintenanceByAircraft.get(aircraftId) ?? []) {
    if (
      new Date(b.start_time) <= windowEnd &&
      new Date(b.end_time) >= windowStart
    )
      return false;
  }
  for (const b of bookingsByAircraft.get(aircraftId) ?? []) {
    const dep = new Date(b.scheduled_departure_time);
    if (dep >= windowStart && dep <= windowEnd) return false;
  }
  return true;
}

/**
 * Action Engine: generates recommendations for underutilized aircraft.
 *
 * 1. Reposition (best ROI)
 * 2. Maintenance window (use planned downtime)
 *
 * Returns a unified ScoredRecommendation[] list plus backward-compat arrays.
 */
export async function generateRecommendations(
  supabase: SupabaseClient<Database>,
  underutilizedAircraft: UtilizationMetrics[],
  forecastDemand: ExpectedDemandDay[],
  horizonDays: number = 7,
): Promise<{
  recommendations: ScoredRecommendation[];
  reposition: RepositionRecommendation[];
  maintenance_windows: MaintenanceWindowRecommendation[];
}> {
  const today = new Date();
  const futureEnd = addDays(today, horizonDays);

  const candidateIds = underutilizedAircraft
    .filter((ac) => ac.flags.includes("underutilized"))
    .map((ac) => ac.aircraft_id);

  // Build demand lookup: category → date → expected_hours
  const demandMap: Record<string, Record<string, number>> = {};
  for (const d of forecastDemand) {
    if (!demandMap[d.aircraft_category]) demandMap[d.aircraft_category] = {};
    (demandMap[d.aircraft_category] as Record<string, number>)[d.date] =
      d.expected_total_hours;
  }

  // Bulk-fetch feasibility data + historical quotes in parallel (2 queries instead of N×2)
  const horizonWindowEnd = addDays(futureEnd, 1);

  const [
    { data: historicalQuotes },
    { data: maintenanceRows },
    { data: bookingRows },
  ] = await Promise.all([
    supabase
      .from("quotes")
      .select("chosen_aircraft_category, aircraft_id, trips(legs)")
      .in("status", ["confirmed", "completed"])
      .gte("created_at", addDays(today, -90).toISOString()),
    candidateIds.length > 0
      ? supabase
          .from("aircraft_maintenance")
          .select("aircraft_id, start_time, end_time")
          .in("aircraft_id", candidateIds)
          .lte("start_time", horizonWindowEnd.toISOString())
          .gte("end_time", today.toISOString())
      : Promise.resolve({ data: [] as MaintenanceBlock[] }),
    candidateIds.length > 0
      ? supabase
          .from("quotes")
          .select("aircraft_id, scheduled_departure_time")
          .in("aircraft_id", candidateIds)
          .in("status", ["confirmed"])
          .not("scheduled_departure_time", "is", null)
          .lte("scheduled_departure_time", horizonWindowEnd.toISOString())
          .gte("scheduled_departure_time", today.toISOString())
      : Promise.resolve({ data: [] as ConfirmedBooking[] }),
  ]);

  const maintenanceByAircraft = new Map<string, MaintenanceBlock[]>();
  for (const row of (maintenanceRows ?? []) as MaintenanceBlock[]) {
    const list = maintenanceByAircraft.get(row.aircraft_id) ?? [];
    list.push(row);
    maintenanceByAircraft.set(row.aircraft_id, list);
  }

  const bookingsByAircraft = new Map<string, ConfirmedBooking[]>();
  for (const row of (bookingRows ?? []) as ConfirmedBooking[]) {
    const list = bookingsByAircraft.get(row.aircraft_id) ?? [];
    list.push(row);
    bookingsByAircraft.set(row.aircraft_id, list);
  }

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

      // ROI calculation
      const hourlyRate = CATEGORY_HOURLY_RATE[ac.category] ?? 4500;
      const expectedRevenueGain = peakHours * hourlyRate;
      const roiScore =
        estimatedRepoCost > 0
          ? (expectedRevenueGain - estimatedRepoCost) / estimatedRepoCost
          : 0;

      // Block recommendation if ROI is too low
      if (roiScore < 0.15) continue;

      const recommendedDepartureTime = new Date(peakDate + "T08:00:00Z");
      const windowEnd = addDays(recommendedDepartureTime, 1);

      const feasibilityPassed = checkFeasibility(
        ac.aircraft_id,
        recommendedDepartureTime,
        windowEnd,
        maintenanceByAircraft,
        bookingsByAircraft,
      );

      if (!feasibilityPassed) continue;

      const oneLineReason = `Reposition to ${bestDest} — ${ac.category} demand peaks ${peakDate}, aircraft idle ${ac.idle_days} days`;

      repositionRecs.push({
        type: "reposition",
        aircraft_id: ac.aircraft_id,
        tail_number: ac.tail_number,
        move_from_airport: fromAirport,
        move_to_airport: bestDest,
        recommended_departure_time: recommendedDepartureTime.toISOString(),
        estimated_reposition_hours: estimatedRepoHours,
        estimated_reposition_cost: estimatedRepoCost,
        expected_utilization_gain: peakHours,
        roi_score: Math.round(roiScore * 1000) / 1000,
        feasibility_passed: feasibilityPassed,
        one_line_reason: oneLineReason,
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

      const feasibilityPassed = checkFeasibility(
        ac.aircraft_id,
        suggestedStart,
        suggestedEnd,
        maintenanceByAircraft,
        bookingsByAircraft,
      );

      if (!feasibilityPassed) continue;

      const oneLineReason = `Schedule maintenance on ${lowDate} — lowest demand window for ${ac.category} this week`;

      maintenanceRecs.push({
        type: "maintenance_window",
        aircraft_id: ac.aircraft_id,
        tail_number: ac.tail_number,
        suggested_start: suggestedStart.toISOString(),
        suggested_end: suggestedEnd.toISOString(),
        reason: `Lowest demand period for ${ac.category} (${lowHours.toFixed(1)} hrs forecast)`,
        one_line_reason: oneLineReason,
        low_demand_hours: lowHours,
        feasibility_passed: feasibilityPassed,
      });
    }
  }

  const repoSlice = repositionRecs.slice(0, 10);
  const maintSlice = maintenanceRecs.slice(0, 10);

  // Produce ScoredRecommendation[]
  const scored: ScoredRecommendation[] = [
    ...repoSlice.map((r, i) => ({
      rec: r as ActionRecommendation,
      aircraft_idle_risk_score:
        underutilizedAircraft.find((a) => a.aircraft_id === r.aircraft_id)
          ?.idle_risk_score ?? 0,
      roi_score: r.roi_score,
      one_line_reason: r.one_line_reason,
      priority: i + 1,
    })),
    ...maintSlice.map((r, i) => ({
      rec: r as ActionRecommendation,
      aircraft_idle_risk_score:
        underutilizedAircraft.find((a) => a.aircraft_id === r.aircraft_id)
          ?.idle_risk_score ?? 0,
      one_line_reason: r.one_line_reason,
      priority: repoSlice.length + i + 1,
    })),
  ];

  // Sort by aircraft_idle_risk_score DESC, then by roi_score DESC
  scored.sort(
    (a, b) =>
      b.aircraft_idle_risk_score - a.aircraft_idle_risk_score ||
      (b.roi_score ?? 0) - (a.roi_score ?? 0),
  );
  scored.forEach((s, i) => {
    s.priority = i + 1;
  });

  return {
    recommendations: scored,
    reposition: repoSlice,
    maintenance_windows: maintSlice,
  };
}
