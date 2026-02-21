// ─── Risk scoring ─────────────────────────────────────────────────────────────
// Computes a 0-100 risk score and 0.0-1.0 on-time probability
// from routing outputs (weather, NOTAMs, complexity).

import type { WeatherSummary, NotamAlert, RefuelStop } from "./types";

export interface RiskInput {
  weather_summary: WeatherSummary[];
  notam_alerts: NotamAlert[];
  refuel_stops: RefuelStop[];
  total_flight_time_hr: number;
  is_international: boolean;
}

export interface RiskResult {
  risk_score: number; // 0-100 (higher = riskier)
  on_time_probability: number; // 0.0-1.0
}

/**
 * Computes a simple additive risk score.
 * Designed to be transparent and easy to audit/adjust.
 */
export function computeRiskScore(input: RiskInput): RiskResult {
  let score = 10; // base: every flight has inherent risk

  // ── Weather contribution (cap at 70 to leave room for other factors) ────────
  let weatherContrib = 0;
  for (const w of input.weather_summary) {
    if (w.go_nogo === "nogo") weatherContrib += 30;
    else if (w.go_nogo === "marginal") weatherContrib += 15;

    if (w.icing_risk === "severe") weatherContrib += 10;
    else if (w.icing_risk === "moderate") weatherContrib += 5;

    if (w.convective_risk === "high") weatherContrib += 10;
    else if (w.convective_risk === "moderate") weatherContrib += 5;
  }
  score += Math.min(weatherContrib, 70);

  // ── NOTAM contribution ───────────────────────────────────────────────────────
  for (const n of input.notam_alerts) {
    if (n.severity === "critical") score += 20;
    else if (n.severity === "caution") score += 8;
    // "info" NOTAMs do not affect risk score
  }

  // ── Route complexity ─────────────────────────────────────────────────────────
  score += input.refuel_stops.length * 5; // each stop adds complexity
  if (input.total_flight_time_hr > 8) score += 5;
  if (input.total_flight_time_hr > 14) score += 5; // ultra-long haul
  if (input.is_international) score += 5;

  // Clamp to 0-100
  const risk_score = Math.min(100, Math.max(0, Math.round(score)));

  // On-time probability degrades with risk (max degradation: 40%)
  const on_time_probability =
    Math.round((1 - (risk_score / 100) * 0.4) * 1000) / 1000;

  return { risk_score, on_time_probability };
}

/** Whether any leg crosses a different ICAO country prefix (rough proxy for international). */
export function isInternationalRoute(icaos: string[]): boolean {
  if (icaos.length < 2) return false;
  const firstPrefix = icaos[0]?.[0] ?? "";
  return icaos.some((icao) => icao[0] !== firstPrefix);
}
