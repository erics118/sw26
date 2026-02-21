// ─── Forecasting Engine Types ─────────────────────────────────────────────────

export type AircraftCategory =
  | "turboprop"
  | "light"
  | "midsize"
  | "super-mid"
  | "heavy"
  | "ultra-long";

// Target utilization hours per aircraft per day (tunable)
export const TARGET_UTIL_HOURS: Record<string, number> = {
  turboprop: 3.0,
  light: 3.0,
  midsize: 3.5,
  "super-mid": 3.0,
  heavy: 2.5,
  "ultra-long": 2.0,
};

// ─── Supply side ──────────────────────────────────────────────────────────────

export interface CapacityDay {
  date: string; // ISO date YYYY-MM-DD
  aircraft_category: string;
  num_active_aircraft: number;
  total_available_hours: number;
  maintenance_hours: number;
}

// ─── Demand side ─────────────────────────────────────────────────────────────

export interface ConfirmedDemandDay {
  date: string;
  aircraft_category: string;
  confirmed_total_hours: number;
  num_confirmed_flights: number;
}

export interface ExpectedDemandDay {
  date: string;
  aircraft_category: string;
  expected_total_hours: number;
  baseline_hours: number;
  dow_multiplier: number;
  peak_multiplier: number;
  is_confirmed: boolean; // true = use confirmed demand (0-14d), false = forecast
}

// ─── Capacity gap / planes needed ────────────────────────────────────────────

export interface PlanesNeeded {
  date: string;
  aircraft_category: string;
  expected_demand_hours: number;
  available_hours: number;
  required_aircraft: number;
  capacity_gap_hours: number;
  capacity_gap_aircraft: number;
  status: "surplus" | "balanced" | "shortage";
}

// ─── Utilization metrics ──────────────────────────────────────────────────────

export type UtilizationFlag =
  | "underutilized"
  | "overconstrained"
  | "inefficient";

export interface UtilizationMetrics {
  aircraft_id: string;
  tail_number: string;
  category: string;
  home_base_icao: string | null;
  utilization_rate: number; // 0–1
  empty_leg_ratio: number; // 0–1
  idle_days: number;
  paid_hours: number;
  reposition_hours: number;
  available_hours: number;
  flags: UtilizationFlag[];
}

export interface CategoryUtilizationSummary {
  aircraft_category: string;
  avg_utilization_rate: number;
  total_idle_days: number;
  total_aircraft: number;
  underutilized_count: number;
  overconstrained_count: number;
}

// ─── Recommendations / Action Engine ─────────────────────────────────────────

export interface RepositionRecommendation {
  type: "reposition";
  aircraft_id: string;
  tail_number: string;
  move_from_airport: string;
  move_to_airport: string;
  recommended_departure_time: string; // ISO timestamp
  estimated_reposition_hours: number;
  estimated_reposition_cost: number;
  expected_utilization_gain: number; // hours gained
  reason: string;
}

export interface EmptyLegRecommendation {
  type: "empty_leg";
  aircraft_id: string;
  tail_number: string;
  offer_date: string; // ISO date
  from_icao: string;
  to_icao: string;
  recommended_discount_pct: number;
  reason: string;
}

export interface MaintenanceWindowRecommendation {
  type: "maintenance_window";
  aircraft_id: string;
  tail_number: string;
  suggested_start: string; // ISO timestamp
  suggested_end: string;
  reason: string;
  low_demand_hours: number; // available hours during window
}

export type ActionRecommendation =
  | RepositionRecommendation
  | EmptyLegRecommendation
  | MaintenanceWindowRecommendation;

// ─── Forecast accuracy / learning ────────────────────────────────────────────

export interface ForecastAccuracy {
  aircraft_category: string;
  period_start: string;
  period_end: string;
  predicted_hours: number;
  actual_hours: number;
  error_pct: number; // (actual - predicted) / predicted * 100
  num_flights: number;
}

export interface DelayReasonBreakdown {
  reason_code: string;
  count: number;
  total_hours_lost: number;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ForecastSummary {
  capacity: CapacityDay[];
  demand: ExpectedDemandDay[];
  planes_needed: PlanesNeeded[];
  horizon_days: number;
  generated_at: string;
}

export interface UtilizationSummary {
  aircraft: UtilizationMetrics[];
  by_category: CategoryUtilizationSummary[];
  period_start: string;
  period_end: string;
}

export interface RecommendationSummary {
  reposition: RepositionRecommendation[];
  empty_legs: EmptyLegRecommendation[];
  maintenance_windows: MaintenanceWindowRecommendation[];
  generated_at: string;
}
