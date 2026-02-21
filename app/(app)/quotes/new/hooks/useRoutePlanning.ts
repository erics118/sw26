import { useState, useCallback } from "react";

type OptimizationMode = "cost" | "time" | "balanced";

interface TripLeg {
  from_icao: string;
  to_icao: string;
  date: string;
  time: string;
}

interface Trip {
  id: string;
  legs: TripLeg[];
}

interface RoutePlanResult {
  plan_id?: string;
  route_legs: Array<{
    from_icao: string;
    to_icao: string;
    distance_nm: number;
    flight_time_hr: number;
    fuel_burn_gal: number;
    fuel_cost_usd: number;
    is_fuel_stop_leg: boolean;
  }>;
  refuel_stops: Array<{
    icao: string;
    airport_name: string;
    added_distance_nm: number;
    fuel_price_usd_gal: number;
    fuel_uplift_gal: number;
    fuel_cost_usd: number;
    fbo_fee_usd: number;
    ground_time_min: number;
    customs: boolean;
    deicing: boolean;
    reason: string;
  }>;
  weather_summary: Array<{
    icao: string;
    go_nogo: "go" | "marginal" | "nogo";
    ceiling_ft: number | null;
    visibility_sm: number | null;
    wind_speed_kts: number | null;
    icing_risk: string;
    convective_risk: string;
  }>;
  notam_alerts: Array<{
    notam_id: string;
    icao: string;
    type: string;
    severity: "info" | "caution" | "critical";
    raw_text: string;
  }>;
  total_distance_nm: number;
  total_flight_time_hr: number;
  total_fuel_cost_usd: number;
  risk_score: number;
  on_time_probability: number;
  cost_breakdown: {
    fuel_cost_usd: number;
    fbo_fees_usd: number;
    refuel_stop_detour_cost_usd: number;
    avg_fuel_price_usd_gal: number;
    total_routing_cost_usd: number;
  };
}

export type { RoutePlanResult };

export function useRoutePlanning({
  selectedTripId,
  selectedAircraftId,
  optimizationMode,
  trips,
}: {
  selectedTripId: string;
  selectedAircraftId: string;
  optimizationMode: OptimizationMode;
  trips: Trip[];
}) {
  const [routePlan, setRoutePlan] = useState<RoutePlanResult | null>(null);
  const [planningRoute, setPlanningRoute] = useState(false);
  const [routeError, setRouteError] = useState("");

  const runRoutePlan = useCallback(async () => {
    if (!selectedTripId || !selectedAircraftId) return;
    const trip = trips.find((t) => t.id === selectedTripId);
    if (!trip || trip.legs.length === 0) return;
    setPlanningRoute(true);
    setRouteError("");
    setRoutePlan(null);
    try {
      const res = await fetch("/api/routing/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aircraft_id: selectedAircraftId,
          legs: trip.legs,
          optimization_mode: optimizationMode,
        }),
      });
      const data = (await res.json()) as
        | { result: RoutePlanResult }
        | { error: string };
      if (!res.ok || "error" in data) {
        setRouteError(
          ("error" in data ? data.error : null) ?? "Route planning failed",
        );
      } else {
        setRoutePlan(data.result);
      }
    } catch {
      setRouteError("Network error");
    } finally {
      setPlanningRoute(false);
    }
  }, [selectedTripId, selectedAircraftId, optimizationMode, trips]);

  return { routePlan, planningRoute, routeError, runRoutePlan };
}
