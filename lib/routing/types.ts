// ─── Routing Module Types ─────────────────────────────────────────────────────

export type OptimizationMode = "cost" | "time" | "balanced";

export interface RoutingInput {
  aircraft_id: string;
  legs: { from_icao: string; to_icao: string; date: string; time: string }[];
  optimization_mode: OptimizationMode;
  /** When true, skip weather/NOTAM fetches (faster; use for quote generation) */
  skip_weather_notam?: boolean;
}

// A single flight segment — may be an original leg or an injected fuel-stop leg
export interface RouteLeg {
  from_icao: string;
  to_icao: string;
  distance_nm: number;
  flight_time_hr: number;
  fuel_burn_gal: number;
  fuel_cost_usd: number;
  is_fuel_stop_leg: boolean; // true when injected by optimizer to reach a refuel stop
  departure_utc: string | null;
  arrival_utc: string | null;
}

// A recommended intermediate fuel stop
export interface RefuelStop {
  icao: string;
  airport_name: string;
  added_distance_nm: number; // detour cost vs flying direct
  fuel_price_usd_gal: number;
  fuel_uplift_gal: number;
  fuel_cost_usd: number;
  fbo_fee_usd: number;
  ground_time_min: number; // estimated: 30 min standard, 45 if deicing
  customs: boolean;
  deicing: boolean;
  reason: string; // e.g. "Midpoint refuel — aircraft cannot reach OMDB direct"
}

export type IcingRisk = "none" | "light" | "moderate" | "severe";
export type ConvectiveRisk = "none" | "low" | "moderate" | "high";
export type GoNogo = "go" | "marginal" | "nogo";

// Weather summary for a single airport
export interface WeatherSummary {
  icao: string;
  metar_raw: string | null;
  taf_raw: string | null;
  ceiling_ft: number | null;
  visibility_sm: number | null;
  wind_dir_deg: number | null;
  wind_speed_kts: number | null;
  crosswind_kts: number | null;
  icing_risk: IcingRisk;
  convective_risk: ConvectiveRisk;
  go_nogo: GoNogo;
  fetched_at: string;
}

export type NotamType =
  | "runway_closure"
  | "fuel_outage"
  | "tfr"
  | "nav_aid"
  | "other";

export type NotamSeverity = "info" | "caution" | "critical";

// A NOTAM alert relevant to the route
export interface NotamAlert {
  notam_id: string;
  icao: string;
  type: NotamType;
  raw_text: string;
  effective_from: string | null;
  effective_to: string | null;
  severity: NotamSeverity;
}

// Routing-specific cost breakdown (separate from quote_costs)
export interface RouteCostBreakdown {
  fuel_cost_usd: number;
  fbo_fees_usd: number;
  refuel_stop_detour_cost_usd: number; // incremental cost of detour distance
  avg_fuel_price_usd_gal: number; // weighted average across all fuel stops
  total_routing_cost_usd: number; // excludes margin/tax (those stay in engine.ts)
}

// An alternative route for comparison (e.g. time-optimized vs cost-optimized)
export interface AlternativeRoute {
  label: string; // "Time-optimized" | "Cost-optimized"
  optimization_mode: OptimizationMode;
  route_legs: RouteLeg[];
  refuel_stops: RefuelStop[];
  total_distance_nm: number;
  total_flight_time_hr: number;
  total_fuel_cost_usd: number;
  risk_score: number;
  on_time_probability: number;
  trade_off_note: string; // e.g. "+$1,200 cost vs primary, −45 min flight time"
}

// Full result returned by computeRoutePlan()
export interface RoutePlanResult {
  route_legs: RouteLeg[];
  refuel_stops: RefuelStop[];
  total_distance_nm: number;
  total_flight_time_hr: number;
  total_fuel_cost_usd: number;
  weather_summary: WeatherSummary[];
  notam_alerts: NotamAlert[];
  risk_score: number; // 0-100
  on_time_probability: number; // 0.0-1.0
  cost_breakdown: RouteCostBreakdown;
  alternatives: AlternativeRoute[];
}

// Error thrown when no viable route can be found
export class RoutingError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NO_ROUTE"
      | "UNKNOWN_AIRPORT"
      | "AIRCRAFT_NOT_FOUND"
      | "MAX_DEPTH_EXCEEDED",
  ) {
    super(message);
    this.name = "RoutingError";
  }
}
