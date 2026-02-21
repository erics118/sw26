import { createClient } from "@/lib/supabase/server";
import { haversineNm } from "@/lib/geo";
import type { Aircraft, Crew, Operator, TripLeg } from "@/lib/database.types";

export interface ComplianceCheckInput {
  aircraft_id: string;
  operator_id: string;
  crew_ids?: string[];
  legs?: TripLeg[];
  min_cabin_height_in?: number | null;
  estimated_flight_hours?: number;
  route_plan_id?: string; // when provided, skip naive range check and verify each route leg individually
}

export interface ComplianceResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
}

export async function runComplianceCheck(
  input: ComplianceCheckInput,
): Promise<ComplianceResult> {
  const supabase = await createClient();
  const failures: string[] = [];
  const warnings: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // ── Operator checks ────────────────────────────────────────────────────────
  const { data: operatorData } = await supabase
    .from("operators")
    .select("*")
    .eq("id", input.operator_id)
    .single();
  const operator = operatorData as Operator | null;

  if (!operator) {
    failures.push("Operator not found");
  } else {
    if (operator.blacklisted) {
      failures.push("Operator is blacklisted");
    }
    if (!operator.cert_number) {
      failures.push("Operator has no Part 135 certificate on file");
    }
    if (!operator.cert_expiry) {
      warnings.push("Operator Part 135 cert expiry date not set");
    } else if (operator.cert_expiry < today) {
      failures.push(
        `Operator Part 135 cert expired on ${operator.cert_expiry}`,
      );
    }
    if (!operator.insurance_expiry) {
      warnings.push("Operator insurance expiry date not set");
    } else if (operator.insurance_expiry < today) {
      failures.push(
        `Operator insurance expired on ${operator.insurance_expiry}`,
      );
    }
  }

  // ── Aircraft checks ────────────────────────────────────────────────────────
  const { data: aircraftData } = await supabase
    .from("aircraft")
    .select("*")
    .eq("id", input.aircraft_id)
    .single();
  const aircraft = aircraftData as Aircraft | null;

  if (!aircraft) {
    failures.push("Aircraft not found");
  } else {
    // Range check — use route plan legs if available, else naive total distance
    if (input.route_plan_id) {
      // Fetch the persisted route plan and verify each leg individually
      const { data: routePlanData } = await supabase
        .from("route_plans")
        .select("route_legs, refuel_stops")
        .eq("id", input.route_plan_id)
        .single();

      if (!routePlanData) {
        warnings.push(
          `Route plan ${input.route_plan_id} not found — skipping routing-aware range check`,
        );
      } else {
        type RouteLegRow = {
          from_icao: string;
          to_icao: string;
          distance_nm: number;
          is_fuel_stop_leg: boolean;
        };
        type RefuelStopRow = {
          icao: string;
          airport_name: string;
          fuel_price_usd_gal: number | null;
          fuel_uplift_gal: number;
        };

        const routeLegs = (routePlanData.route_legs ?? []) as RouteLegRow[];
        const refuelStops = (routePlanData.refuel_stops ??
          []) as RefuelStopRow[];

        // Verify all refuel stops have Jet-A fuel and adequate runway
        for (const stop of refuelStops) {
          const { data: stopAirport } = await supabase
            .from("airports")
            .select("fuel_jet_a, longest_runway_ft, name")
            .eq("icao", stop.icao)
            .single();
          if (stopAirport) {
            if (!stopAirport.fuel_jet_a) {
              failures.push(
                `Refuel stop ${stop.icao} (${stop.airport_name}) does not have Jet-A fuel`,
              );
            }
            if (
              aircraft.min_runway_ft &&
              stopAirport.longest_runway_ft &&
              stopAirport.longest_runway_ft < aircraft.min_runway_ft
            ) {
              failures.push(
                `Refuel stop ${stop.icao} runway (${stopAirport.longest_runway_ft} ft) is below aircraft minimum (${aircraft.min_runway_ft} ft)`,
              );
            }
          }
        }

        // Warn if any leg exceeds declared aircraft range (should not happen if router worked)
        for (const leg of routeLegs) {
          if (leg.distance_nm > aircraft.range_nm) {
            warnings.push(
              `Route leg ${leg.from_icao}→${leg.to_icao} (${leg.distance_nm} nm) exceeds aircraft declared range (${aircraft.range_nm} nm)`,
            );
          }
        }
      }
    } else if (input.legs && input.legs.length > 0) {
      // Naive fallback: sum all leg distances
      let totalNm = 0;
      let hasUnknownAirports = false;

      for (const leg of input.legs) {
        const dist = haversineNm(leg.from_icao, leg.to_icao);
        if (dist === null) {
          hasUnknownAirports = true;
        } else {
          totalNm += dist;
        }
      }

      if (hasUnknownAirports) {
        warnings.push(
          "Some airport codes are unknown — range check may be incomplete",
        );
      }
      if (totalNm > 0 && totalNm > aircraft.range_nm) {
        failures.push(
          `Trip distance (${Math.round(totalNm)} nm) exceeds aircraft range (${aircraft.range_nm} nm)`,
        );
      }
    }

    // Cabin height check
    if (
      input.min_cabin_height_in != null &&
      aircraft.cabin_height_in != null &&
      aircraft.cabin_height_in < input.min_cabin_height_in
    ) {
      failures.push(
        `Aircraft cabin height (${aircraft.cabin_height_in}") is below required minimum (${input.min_cabin_height_in}")`,
      );
    }
  }

  // ── Crew duty hours check ──────────────────────────────────────────────────
  if (input.crew_ids && input.crew_ids.length > 0) {
    const { data: crewData } = await supabase
      .from("crew")
      .select("*")
      .in("id", input.crew_ids);
    const crewMembers = crewData as Crew[] | null;

    if (crewMembers) {
      const estHours = input.estimated_flight_hours ?? 0;
      for (const member of crewMembers) {
        const projected = member.duty_hours_this_week + estHours;
        if (projected > 60) {
          failures.push(
            `Crew member ${member.name} would exceed 60 hr/week duty limit ` +
              `(${member.duty_hours_this_week} used + ${estHours} est = ${projected} hr)`,
          );
        } else if (projected > 50) {
          warnings.push(
            `Crew member ${member.name} is approaching duty limit (${projected}/60 hr)`,
          );
        }
      }
    }
  }

  return { passed: failures.length === 0, failures, warnings };
}
