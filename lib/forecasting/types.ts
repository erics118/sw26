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

// Estimated hourly revenue by category (used for reposition ROI calculation)
export const CATEGORY_HOURLY_RATE: Record<string, number> = {
  turboprop: 2500,
  light: 3500,
  midsize: 4500,
  "super-mid": 5500,
  heavy: 7000,
  "ultra-long": 9000,
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
  expected_total_hours: number; // P50 — baseline × dow × peak
  p80_hours: number; // ops-planning ceiling: P50 × 1.25
  baseline_hours: number;
  dow_multiplier: number;
  peak_multiplier: number;
  is_confirmed: boolean; // true = use confirmed demand (0-14d), false = forecast
}

// Pipeline demand: probability-weighted hours from open quotes
export interface PipelineDemandDay {
  date: string;
  aircraft_category: string;
  pipeline_hours: number; // Σ p_win × scheduled_total_hours
  quote_count: number;
}

// ─── Capacity gap / planes needed ────────────────────────────────────────────

export interface PlanesNeeded {
  date: string;
  aircraft_category: string;
  expected_demand_hours: number; // P50
  p80_demand_hours: number; // P80 — used for required_aircraft / gap calc
  pipeline_hours: number; // weighted pipeline for that date
  available_hours: number;
  required_aircraft: number;
  capacity_gap_hours: number; // based on P80
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
  utilization_rate: number; // 0–1, trailing period
  idle_risk_score: number; // 0–1 composite: 0.5×(1-util_48h) + 0.3×(1-util_7d) + 0.2×(idle_days/period_days)
  deadhead_waste_score: number; // reposition_hours / (paid_hours + reposition_hours)
  idle_days: number;
  paid_hours: number;
  reposition_hours: number;
  available_hours: number;
  flags: UtilizationFlag[];
}

export interface CategoryUtilizationSummary {
  aircraft_category: string;
  avg_utilization_rate: number;
  avg_idle_risk_score: number;
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
  roi_score: number; // (expected_revenue - cost) / cost
  feasibility_passed: boolean;
  one_line_reason: string;
  reason: string;
}

export interface MaintenanceWindowRecommendation {
  type: "maintenance_window";
  aircraft_id: string;
  tail_number: string;
  suggested_start: string; // ISO timestamp
  suggested_end: string;
  reason: string;
  one_line_reason: string;
  low_demand_hours: number;
  feasibility_passed: boolean;
}

export type ActionRecommendation =
  | RepositionRecommendation
  | MaintenanceWindowRecommendation;

// Unified scored recommendation (single ranked list)
export interface ScoredRecommendation {
  rec: ActionRecommendation;
  aircraft_idle_risk_score: number;
  roi_score?: number;
  one_line_reason: string;
  priority: number; // 1 = highest
}

// ─── Forecast accuracy / learning ────────────────────────────────────────────

export interface ForecastAccuracy {
  aircraft_category: string;
  period_start: string;
  period_end: string;
  predicted_hours: number;
  actual_hours: number;
  error_pct: number; // |signed_error_pct| — absolute magnitude
  signed_error_pct: number; // positive = over-forecast, negative = under-forecast
  horizon_days: 7 | 30 | 90;
  error_driver?:
    | "weather"
    | "maintenance"
    | "win_rate_shift"
    | "demand_shift"
    | "other";
  num_flights: number;
}

export interface DelayReasonBreakdown {
  reason_code: string;
  count: number;
  total_hours_lost: number;
}

export interface WinRateCalibration {
  stage: string;
  predicted_rate: number;
  actual_rate: number | null; // null when sample too small
  sample_size: number;
  drift: number | null; // actual - predicted; null when no data
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ForecastSummary {
  capacity: CapacityDay[];
  demand: ExpectedDemandDay[];
  pipeline: PipelineDemandDay[];
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
  recommendations: ScoredRecommendation[]; // unified ranked list
  reposition: RepositionRecommendation[]; // backward-compat
  maintenance_windows: MaintenanceWindowRecommendation[]; // backward-compat
  generated_at: string;
}
