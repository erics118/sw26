// ─── Public routing facade ────────────────────────────────────────────────────
// computeRoutePlan() is the single entry point for all routing calculations.
// It orchestrates: aircraft lookup → route optimization → weather → NOTAMs → risk.

import { createClient } from "@/lib/supabase/server";
import { RoutingError } from "./types";
import type { RoutingInput, RoutePlanResult, AlternativeRoute } from "./types";
import { optimizeRoute } from "./optimizer";
import { fetchWeatherForIcaos } from "./weather";
import { fetchNotamsForRoute } from "./notam";
import { computeRiskScore, isInternationalRoute } from "./risk";
import type { AircraftPerf } from "./performance";

// ─── Aircraft fetch ───────────────────────────────────────────────────────────

async function fetchAircraft(aircraftId: string): Promise<AircraftPerf> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("aircraft")
    .select(
      "category,fuel_burn_gph,range_nm,cruise_speed_kts,max_fuel_capacity_gal,min_runway_ft,reserve_fuel_gal",
    )
    .eq("id", aircraftId)
    .single();

  if (error || !data) {
    throw new RoutingError(
      `Aircraft not found: ${aircraftId}`,
      "AIRCRAFT_NOT_FOUND",
    );
  }

  return data as AircraftPerf;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Computes a complete route plan for the given aircraft and legs.
 *
 * Steps:
 *  1. Fetch aircraft performance data
 *  2. Run route optimizer (finds fuel stops, builds legs)
 *  3. Collect all unique ICAOs
 *  4. Fetch weather + NOTAMs in parallel (graceful on failure)
 *  5. Compute risk score
 *  6. Return assembled RoutePlanResult
 */
export async function computeRoutePlan(
  input: RoutingInput,
): Promise<RoutePlanResult> {
  const aircraft = await fetchAircraft(input.aircraft_id);

  // Optimize primary route
  const optimized = await optimizeRoute(
    input.legs,
    aircraft,
    input.optimization_mode,
  );

  // Collect all unique ICAOs from the resulting legs (includes fuel stop airports)
  const icaos = [
    ...new Set(optimized.route_legs.flatMap((l) => [l.from_icao, l.to_icao])),
  ];

  let weatherSummary: Awaited<ReturnType<typeof fetchWeatherForIcaos>> = [];
  let notamAlerts: Awaited<ReturnType<typeof fetchNotamsForRoute>> = [];

  if (!input.skip_weather_notam) {
    const firstLeg = input.legs[0];
    const lastLeg = input.legs[input.legs.length - 1];
    const effectiveFrom = firstLeg?.date
      ? new Date(`${firstLeg.date}T${firstLeg.time ?? "00:00"}:00Z`)
      : new Date();
    const effectiveTo = lastLeg?.date
      ? new Date(new Date(`${lastLeg.date}T00:00:00Z`).getTime() + 86400000) // +1 day
      : new Date(effectiveFrom.getTime() + 86400000);

    [weatherSummary, notamAlerts] = await Promise.all([
      fetchWeatherForIcaos(icaos, aircraft).catch(() => []),
      fetchNotamsForRoute(icaos, effectiveFrom, effectiveTo).catch(() => []),
    ]);
  }

  // Risk scoring
  const isIntl = isInternationalRoute(icaos);
  const { risk_score, on_time_probability } = computeRiskScore({
    weather_summary: weatherSummary,
    notam_alerts: notamAlerts,
    refuel_stops: optimized.refuel_stops,
    total_flight_time_hr: optimized.total_flight_time_hr,
    is_international: isIntl,
    route_legs: optimized.route_legs,
    aircraft_category: aircraft.category,
  });

  // Attach risk/on-time to alternatives (reuse weather/NOTAM from primary)
  const alternatives: AlternativeRoute[] = optimized.alternatives.map(
    (alt) => ({
      ...alt,
      risk_score,
      on_time_probability,
    }),
  );

  return {
    route_legs: optimized.route_legs,
    refuel_stops: optimized.refuel_stops,
    total_distance_nm: optimized.total_distance_nm,
    total_flight_time_hr: optimized.total_flight_time_hr,
    total_fuel_cost_usd: optimized.total_fuel_cost_usd,
    weather_summary: weatherSummary,
    notam_alerts: notamAlerts,
    risk_score,
    on_time_probability,
    cost_breakdown: optimized.cost_breakdown,
    alternatives,
  };
}

// Re-export key types for convenience
export type { RoutingInput, RoutePlanResult } from "./types";
export { RoutingError } from "./types";
