// ─── Risk scoring ─────────────────────────────────────────────────────────────
// Computes a 0-100 risk score and 0.0-1.0 on-time probability
// from routing outputs (weather, NOTAMs, complexity, time of day, aircraft).
// Cost is intentionally not a factor: risk drives cost (contingency, delays), not the other way around.

import type { WeatherSummary, NotamAlert, RefuelStop, RouteLeg } from "./types";

export interface RiskInput {
  weather_summary: WeatherSummary[];
  notam_alerts: NotamAlert[];
  refuel_stops: RefuelStop[];
  total_flight_time_hr: number;
  is_international: boolean;
  /** Optional: leg times for night-flying risk (UTC). */
  route_legs?: RouteLeg[];
  /** Optional: aircraft category for capability-based risk (turboprop/light vs heavy). */
  aircraft_category?: string;
}

export interface RiskResult {
  risk_score: number; // 0-100 (higher = riskier)
  on_time_probability: number; // 0.0-1.0
}

const refuelStopIcaos = (stops: RefuelStop[]): Set<string> =>
  new Set(stops.map((s) => s.icao));

/** Night window in UTC hours (22–06): higher fatigue, fewer alternates, approach risk. */
const NIGHT_UTC_HOURS = new Set([0, 1, 2, 3, 4, 5, 6, 22, 23]);

function hasNightFlying(legs: RouteLeg[]): boolean {
  for (const leg of legs) {
    for (const iso of [leg.departure_utc, leg.arrival_utc]) {
      if (!iso) continue;
      const hour = new Date(iso).getUTCHours();
      if (NIGHT_UTC_HOURS.has(hour)) return true;
    }
  }
  return false;
}

/** Category-based risk: smaller/slower aircraft more susceptible to weather and ops. */
function aircraftCategoryContrib(category: string | undefined): number {
  if (!category) return 0;
  switch (category) {
    case "turboprop":
      return 5;
    case "light":
      return 3;
    case "midsize":
    case "super-mid":
    case "heavy":
    case "ultra-long":
    default:
      return 0;
  }
}

/**
 * Computes a transparent additive risk score.
 * Factors: weather (go/nogo, icing, convective, crosswind, wind), NOTAMs, route complexity,
 * time of day (night), and aircraft category.
 */
export function computeRiskScore(input: RiskInput): RiskResult {
  let score = 10; // base: every flight has inherent risk
  const fuelStopIcaos = refuelStopIcaos(input.refuel_stops);

  // ── Weather contribution (cap at 65) ─────────────────────────────────────────
  let weatherContrib = 0;
  for (const w of input.weather_summary) {
    if (w.go_nogo === "nogo") weatherContrib += 30;
    else if (w.go_nogo === "marginal") weatherContrib += 15;

    if (w.icing_risk === "severe") weatherContrib += 10;
    else if (w.icing_risk === "moderate") weatherContrib += 5;

    if (w.convective_risk === "high") weatherContrib += 10;
    else if (w.convective_risk === "moderate") weatherContrib += 5;

    // Crosswind: major factor for landing risk (jets typically 25–35 kt limit)
    const xw = w.crosswind_kts ?? 0;
    if (xw >= 25) weatherContrib += 12;
    else if (xw >= 15) weatherContrib += 6;

    // Strong wind: gusty/turbulent conditions
    const wspd = w.wind_speed_kts ?? 0;
    if (wspd >= 35) weatherContrib += 5;
    else if (wspd >= 25) weatherContrib += 2;
  }
  score += Math.min(weatherContrib, 65);

  // ── NOTAM contribution (cap at 45) ──────────────────────────────────────────
  let notamContrib = 0;
  for (const n of input.notam_alerts) {
    if (n.severity === "critical") {
      // Fuel outage at a planned refuel stop is severe — may invalidate route
      if (n.type === "fuel_outage" && fuelStopIcaos.has(n.icao)) {
        notamContrib += 25;
      } else if (n.type === "tfr" || n.type === "runway_closure") {
        notamContrib += 18;
      } else {
        notamContrib += 15;
      }
    } else if (n.severity === "caution") {
      notamContrib +=
        n.type === "fuel_outage" && fuelStopIcaos.has(n.icao) ? 12 : 6;
    }
  }
  score += Math.min(notamContrib, 45);

  // ── Route complexity ─────────────────────────────────────────────────────────
  score += input.refuel_stops.length * 5; // each stop adds complexity
  if (input.total_flight_time_hr > 14)
    score += 8; // ultra-long haul
  else if (input.total_flight_time_hr > 8) score += 5;
  if (input.is_international) score += 6; // customs, slots, more variables

  // ── Time of day (night flying) ───────────────────────────────────────────────
  if (input.route_legs?.length && hasNightFlying(input.route_legs)) score += 4;

  // ── Aircraft category ────────────────────────────────────────────────────────
  score += aircraftCategoryContrib(input.aircraft_category);

  // Clamp to 0-100
  const risk_score = Math.min(100, Math.max(0, Math.round(score)));

  // On-time probability: steeper degradation at high risk (realistic delay curve)
  const r = risk_score / 100;
  const on_time_probability = Math.max(
    0,
    Math.round((1 - 0.55 * Math.pow(r, 1.15)) * 1000) / 1000,
  );

  return { risk_score, on_time_probability };
}

/** Whether any leg crosses a different ICAO country prefix (rough proxy for international). */
export function isInternationalRoute(icaos: string[]): boolean {
  if (icaos.length < 2) return false;
  const firstPrefix = icaos[0]?.[0] ?? "";
  return icaos.some((icao) => icao[0] !== firstPrefix);
}
