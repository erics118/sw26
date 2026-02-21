import { describe, it, expect } from "vitest";
import { computeRiskScore, isInternationalRoute } from "./risk";
import type { RiskInput } from "./risk";
import type { WeatherSummary, NotamAlert, RefuelStop, RouteLeg } from "./types";

const makeWeather = (
  overrides: Partial<WeatherSummary> & { icao: string },
): WeatherSummary => ({
  metar_raw: null,
  taf_raw: null,
  ceiling_ft: null,
  visibility_sm: null,
  wind_dir_deg: null,
  wind_speed_kts: null,
  crosswind_kts: null,
  icing_risk: "none",
  convective_risk: "none",
  go_nogo: "go",
  fetched_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

const makeNotam = (
  overrides: Partial<NotamAlert> & {
    icao: string;
    severity: NotamAlert["severity"];
    type: NotamAlert["type"];
  },
): NotamAlert => ({
  notam_id: "N0001",
  raw_text: "Test NOTAM",
  effective_from: null,
  effective_to: null,
  ...overrides,
});

const makeStop = (icao: string): RefuelStop => ({
  icao,
  airport_name: "Test Airport",
  added_distance_nm: 50,
  fuel_price_usd_gal: 7.5,
  fuel_uplift_gal: 500,
  fuel_cost_usd: 3750,
  fbo_fee_usd: 600,
  ground_time_min: 30,
  customs: false,
  deicing: false,
  reason: "Midpoint refuel",
});

const baseInput: RiskInput = {
  weather_summary: [],
  notam_alerts: [],
  refuel_stops: [],
  total_flight_time_hr: 3,
  is_international: false,
};

describe("computeRiskScore", () => {
  it("returns base risk of 10 for a clean, short domestic flight", () => {
    const result = computeRiskScore(baseInput);
    expect(result.risk_score).toBe(10);
    expect(result.on_time_probability).toBeGreaterThan(0.93);
  });

  it("adds 30 points for a nogo weather condition", () => {
    const result = computeRiskScore({
      ...baseInput,
      weather_summary: [makeWeather({ icao: "KLAX", go_nogo: "nogo" })],
    });
    expect(result.risk_score).toBe(10 + 30);
  });

  it("adds 15 points for a marginal weather condition", () => {
    const result = computeRiskScore({
      ...baseInput,
      weather_summary: [makeWeather({ icao: "KTEB", go_nogo: "marginal" })],
    });
    expect(result.risk_score).toBe(10 + 15);
  });

  it("adds 25 points for a critical fuel_outage NOTAM at a planned refuel stop", () => {
    const result = computeRiskScore({
      ...baseInput,
      refuel_stops: [makeStop("KDEN")],
      notam_alerts: [
        makeNotam({ icao: "KDEN", type: "fuel_outage", severity: "critical" }),
      ],
    });
    expect(result.risk_score).toBe(10 + 5 + 25); // base + stop complexity + notam
  });

  it("adds 5 points per refuel stop for route complexity", () => {
    const result = computeRiskScore({
      ...baseInput,
      refuel_stops: [makeStop("KDEN")],
    });
    expect(result.risk_score).toBe(10 + 5);
  });

  it("adds 6 points for international flag", () => {
    const result = computeRiskScore({ ...baseInput, is_international: true });
    expect(result.risk_score).toBe(10 + 6);
  });

  it("adds 8 points for ultra-long haul (>14 hr)", () => {
    const result = computeRiskScore({
      ...baseInput,
      total_flight_time_hr: 15,
    });
    expect(result.risk_score).toBe(10 + 8);
  });

  it("adds 5 points for long haul (>8 hr)", () => {
    const result = computeRiskScore({
      ...baseInput,
      total_flight_time_hr: 10,
    });
    expect(result.risk_score).toBe(10 + 5);
  });

  it("adds 4 points when any leg has night departure or arrival (22–06 UTC)", () => {
    const nightLeg: RouteLeg = {
      from_icao: "KTEB",
      to_icao: "KLAX",
      distance_nm: 2400,
      flight_time_hr: 5,
      fuel_burn_gal: 500,
      fuel_cost_usd: 3750,
      is_fuel_stop_leg: false,
      departure_utc: "2026-01-01T23:00:00.000Z",
      arrival_utc: "2026-01-02T04:00:00.000Z",
    };
    const result = computeRiskScore({
      ...baseInput,
      route_legs: [nightLeg],
    });
    expect(result.risk_score).toBe(10 + 4);
  });

  it("adds 5 points for turboprop, 3 for light; 0 for midsize/heavy", () => {
    expect(
      computeRiskScore({ ...baseInput, aircraft_category: "turboprop" })
        .risk_score,
    ).toBe(10 + 5);
    expect(
      computeRiskScore({ ...baseInput, aircraft_category: "light" }).risk_score,
    ).toBe(10 + 3);
    expect(
      computeRiskScore({ ...baseInput, aircraft_category: "midsize" })
        .risk_score,
    ).toBe(10);
    expect(
      computeRiskScore({ ...baseInput, aircraft_category: "heavy" }).risk_score,
    ).toBe(10);
  });

  it("clamps risk_score to 100", () => {
    const worst = computeRiskScore({
      weather_summary: [
        makeWeather({
          icao: "KTEB",
          go_nogo: "nogo",
          icing_risk: "severe",
          convective_risk: "high",
          crosswind_kts: 30,
          wind_speed_kts: 40,
        }),
        makeWeather({
          icao: "KLAX",
          go_nogo: "nogo",
          icing_risk: "severe",
          convective_risk: "high",
          crosswind_kts: 30,
          wind_speed_kts: 40,
        }),
      ],
      notam_alerts: [
        makeNotam({ icao: "KDEN", type: "tfr", severity: "critical" }),
        makeNotam({
          notam_id: "N0002",
          icao: "KATL",
          type: "runway_closure",
          severity: "critical",
        }),
      ],
      refuel_stops: [makeStop("KDEN"), makeStop("KATL")],
      total_flight_time_hr: 20,
      is_international: true,
    });
    expect(worst.risk_score).toBe(100);
  });

  it("higher risk yields lower on_time_probability", () => {
    const low = computeRiskScore(baseInput);
    const high = computeRiskScore({
      ...baseInput,
      is_international: true,
      total_flight_time_hr: 15,
    });
    expect(high.on_time_probability).toBeLessThan(low.on_time_probability);
  });

  it("on_time_probability is always between 0 and 1", () => {
    const result = computeRiskScore(baseInput);
    expect(result.on_time_probability).toBeGreaterThanOrEqual(0);
    expect(result.on_time_probability).toBeLessThanOrEqual(1);
  });
});

describe("isInternationalRoute", () => {
  it("returns false for a single airport", () => {
    expect(isInternationalRoute(["KTEB"])).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(isInternationalRoute([])).toBe(false);
  });

  it("returns false for same-prefix airports (all K...)", () => {
    expect(isInternationalRoute(["KTEB", "KLAX", "KORD"])).toBe(false);
  });

  it("returns true when airports span different country prefixes", () => {
    expect(isInternationalRoute(["KTEB", "EGLL"])).toBe(true);
  });

  it("returns true for US to Canada (K → C)", () => {
    expect(isInternationalRoute(["KTEB", "CYYZ"])).toBe(true);
  });
});
