// ─── Route optimizer ──────────────────────────────────────────────────────────
// Core routing logic: range validation, refueling stop selection, and route assembly.

import {
  requireAirport,
  getFuelStopCandidates,
  haversineNm,
  midpointLatLon,
  buildBoundingBox,
  type AirportRecord,
} from "./airport-db";
import {
  checkLegRange,
  fuelForLegGal,
  flightTimeHr,
  effectiveFuelBurnGph,
  effectiveMinRunwayFt,
  usableFuelGal,
} from "./performance";
import { buildGraph, dijkstra } from "./graph";
import type { AircraftPerf } from "./performance";
import type {
  OptimizationMode,
  RouteLeg,
  RefuelStop,
  AlternativeRoute,
  RouteCostBreakdown,
} from "./types";
import { RoutingError } from "./types";

const DEFAULT_FUEL_PRICE_USD = 7.5;
const DEFAULT_FBO_FEE_USD = 600;
const GROUND_TIME_STANDARD_MIN = 30;
const GROUND_TIME_DEICING_MIN = 45;
const MAX_STOP_DEPTH = 4; // max recursive fuel stops per leg

// ─── Build a single RouteLeg from two AirportRecords ─────────────────────────

function buildRouteLeg(
  from: AirportRecord,
  to: AirportRecord,
  aircraft: AircraftPerf,
  isFuelStopLeg: boolean,
  departureUtc?: Date,
): RouteLeg {
  const distNm = haversineNm(from, to);
  const fuelBurnGal = fuelForLegGal(distNm, aircraft);
  const fuelPrice = to.fuel_price_usd_gal ?? DEFAULT_FUEL_PRICE_USD;
  const timeHr = flightTimeHr(distNm, aircraft);

  let arrivalUtc: string | null = null;
  if (departureUtc) {
    const arrival = new Date(departureUtc.getTime() + timeHr * 3600 * 1000);
    arrivalUtc = arrival.toISOString();
  }

  return {
    from_icao: from.icao,
    to_icao: to.icao,
    distance_nm: Math.round(distNm),
    flight_time_hr: Math.round(timeHr * 100) / 100,
    fuel_burn_gal: Math.round(fuelBurnGal),
    fuel_cost_usd: Math.round(fuelBurnGal * fuelPrice * 100) / 100,
    is_fuel_stop_leg: isFuelStopLeg,
    departure_utc: departureUtc?.toISOString() ?? null,
    arrival_utc: arrivalUtc,
  };
}

// ─── Score a candidate fuel stop ──────────────────────────────────────────────

function scoreFuelStop(
  from: AirportRecord,
  stop: AirportRecord,
  to: AirportRecord,
  aircraft: AircraftPerf,
  mode: OptimizationMode,
): number {
  const directNm = haversineNm(from, to);
  const leg1Nm = haversineNm(from, stop);
  const leg2Nm = haversineNm(stop, to);
  const addedNm = leg1Nm + leg2Nm - directNm;

  const fuelPrice = stop.fuel_price_usd_gal ?? DEFAULT_FUEL_PRICE_USD;
  const fboFee = stop.fbo_fee_usd ?? DEFAULT_FBO_FEE_USD;
  const fuelNeededGal = fuelForLegGal(leg1Nm, aircraft);
  const fuelCost = fuelNeededGal * fuelPrice + fboFee;

  switch (mode) {
    case "cost":
      // Penalize detour distance heavily (cost per added nm ≈ $8)
      return fuelCost + addedNm * 8;
    case "time":
      // Added time in seconds dominates
      return (addedNm / Math.max(100, aircraft.cruise_speed_kts ?? 450)) * 3600;
    case "balanced":
      return fuelCost * 0.5 + addedNm * 4;
  }
}

// ─── Core: find fuel stops for a single leg ───────────────────────────────────

interface LegResult {
  legs: RouteLeg[];
  stops: RefuelStop[];
}

async function findFuelStopsForLeg(
  fromAirport: AirportRecord,
  toAirport: AirportRecord,
  aircraft: AircraftPerf,
  mode: OptimizationMode,
  depth: number,
): Promise<LegResult> {
  if (depth > MAX_STOP_DEPTH) {
    throw new RoutingError(
      `Maximum fuel stop depth (${MAX_STOP_DEPTH}) exceeded for leg ${fromAirport.icao}→${toAirport.icao}. Route may require a different aircraft.`,
      "MAX_DEPTH_EXCEEDED",
    );
  }

  const directNm = haversineNm(fromAirport, toAirport);
  const rangeCheck = checkLegRange(directNm, aircraft);

  if (rangeCheck.can_fly_direct) {
    return {
      legs: [buildRouteLeg(fromAirport, toAirport, aircraft, depth > 0)],
      stops: [],
    };
  }

  // Need a fuel stop — search around the midpoint
  const mid = midpointLatLon(fromAirport, toAirport);
  const minRunway = effectiveMinRunwayFt(aircraft);

  // Search radius: 60% of the leg distance on first attempt
  const radius60 = directNm * 0.6;
  let candidates = await getFuelStopCandidates(
    minRunway,
    buildBoundingBox(mid.lat, mid.lon, radius60),
  );

  // Filter: stop must be reachable from origin AND destination reachable from stop
  let validCandidates = candidates.filter((c) => {
    if (c.icao === fromAirport.icao || c.icao === toAirport.icao) return false;
    const leg1Nm = haversineNm(fromAirport, c);
    const leg2Nm = haversineNm(c, toAirport);
    return (
      checkLegRange(leg1Nm, aircraft).can_fly_direct &&
      checkLegRange(leg2Nm, aircraft).can_fly_direct
    );
  });

  // Expand to 80% if no candidates found
  if (validCandidates.length === 0) {
    const radius80 = directNm * 0.8;
    candidates = await getFuelStopCandidates(
      minRunway,
      buildBoundingBox(mid.lat, mid.lon, radius80),
    );
    validCandidates = candidates.filter((c) => {
      if (c.icao === fromAirport.icao || c.icao === toAirport.icao)
        return false;
      const leg1Nm = haversineNm(fromAirport, c);
      const leg2Nm = haversineNm(c, toAirport);
      return (
        checkLegRange(leg1Nm, aircraft).can_fly_direct &&
        checkLegRange(leg2Nm, aircraft).can_fly_direct
      );
    });
  }

  if (validCandidates.length === 0) {
    // Last resort: try Dijkstra through all known airports
    const allNodes = candidates; // broader bbox already loaded
    if (allNodes.length > 0) {
      const allWithEndpoints = [fromAirport, ...allNodes, toAirport];
      const edges = buildGraph(allWithEndpoints, aircraft);
      const path = dijkstra(
        allWithEndpoints,
        edges,
        fromAirport.icao,
        toAirport.icao,
        mode,
      );
      if (path && path.length > 2) {
        // Resolve path to airport records and build legs
        return buildLegResultFromPath(path, aircraft, depth);
      }
    }

    throw new RoutingError(
      `No viable fuel stop found for leg ${fromAirport.icao}→${toAirport.icao} (direct ${Math.round(directNm)} nm, max range ${Math.round(rangeCheck.max_direct_nm)} nm). Add intermediate airports to the airport database or use a longer-range aircraft.`,
      "NO_ROUTE",
    );
  }

  // Score candidates and pick the best
  const scored = validCandidates
    .map((c) => ({
      airport: c,
      score: scoreFuelStop(fromAirport, c, toAirport, aircraft, mode),
    }))
    .sort((a, b) => a.score - b.score);

  const best = scored[0]!.airport;

  // Build stop record
  const leg1Nm = haversineNm(fromAirport, best);
  const upliftGal =
    usableFuelGal(aircraft) - reserveFuelRemaining(leg1Nm, aircraft);
  const fuelPrice = best.fuel_price_usd_gal ?? DEFAULT_FUEL_PRICE_USD;
  const fboFee = best.fbo_fee_usd ?? DEFAULT_FBO_FEE_USD;
  const addedNm = leg1Nm + haversineNm(best, toAirport) - directNm;

  const stop: RefuelStop = {
    icao: best.icao,
    airport_name: best.name,
    added_distance_nm: Math.round(addedNm),
    fuel_price_usd_gal: fuelPrice,
    fuel_uplift_gal: Math.round(Math.max(0, upliftGal)),
    fuel_cost_usd: Math.round(Math.max(0, upliftGal) * fuelPrice * 100) / 100,
    fbo_fee_usd: fboFee,
    ground_time_min: best.deicing_available
      ? GROUND_TIME_DEICING_MIN
      : GROUND_TIME_STANDARD_MIN,
    customs: best.customs_available,
    deicing: best.deicing_available,
    reason: `Aircraft cannot fly ${fromAirport.icao}→${toAirport.icao} direct (${Math.round(directNm)} nm vs max range ${Math.round(rangeCheck.max_direct_nm)} nm)`,
  };

  // Recursively check sub-legs
  const leg1Result = await findFuelStopsForLeg(
    fromAirport,
    best,
    aircraft,
    mode,
    depth + 1,
  );
  const leg2Result = await findFuelStopsForLeg(
    best,
    toAirport,
    aircraft,
    mode,
    depth + 1,
  );

  return {
    legs: [...leg1Result.legs, ...leg2Result.legs],
    stops: [...leg1Result.stops, stop, ...leg2Result.stops],
  };
}

// Helper: fuel remaining after leg (to determine uplift needed)
function reserveFuelRemaining(legNm: number, aircraft: AircraftPerf): number {
  return (
    fuelForLegGal(legNm, aircraft) +
    (aircraft.reserve_fuel_gal ?? effectiveFuelBurnGph(aircraft) * 0.75)
  );
}

// Build leg result from a Dijkstra path (array of ICAOs)
async function buildLegResultFromPath(
  path: string[],
  aircraft: AircraftPerf,
  depth: number,
): Promise<LegResult> {
  const legs: RouteLeg[] = [];
  const stops: RefuelStop[] = [];

  for (let i = 0; i < path.length - 1; i++) {
    const fromIcao = path[i]!;
    const toIcao = path[i + 1]!;
    const [fromAirport, toAirport] = await Promise.all([
      requireAirport(fromIcao),
      requireAirport(toIcao),
    ]);
    legs.push(buildRouteLeg(fromAirport, toAirport, aircraft, depth > 0));

    // All intermediate nodes are fuel stops
    if (i < path.length - 2) {
      const stopNm = haversineNm(fromAirport, toAirport);
      const upliftGal =
        usableFuelGal(aircraft) - reserveFuelRemaining(stopNm, aircraft);
      const fuelPrice = toAirport.fuel_price_usd_gal ?? DEFAULT_FUEL_PRICE_USD;
      stops.push({
        icao: toAirport.icao,
        airport_name: toAirport.name,
        added_distance_nm: 0, // Dijkstra path; detour already accounted for
        fuel_price_usd_gal: fuelPrice,
        fuel_uplift_gal: Math.round(Math.max(0, upliftGal)),
        fuel_cost_usd:
          Math.round(Math.max(0, upliftGal) * fuelPrice * 100) / 100,
        fbo_fee_usd: toAirport.fbo_fee_usd ?? DEFAULT_FBO_FEE_USD,
        ground_time_min: toAirport.deicing_available
          ? GROUND_TIME_DEICING_MIN
          : GROUND_TIME_STANDARD_MIN,
        customs: toAirport.customs_available,
        deicing: toAirport.deicing_available,
        reason: "Intermediate fuel stop (graph routing)",
      });
    }
  }

  return { legs, stops };
}

// ─── Build cost breakdown ─────────────────────────────────────────────────────

function buildCostBreakdown(
  legs: RouteLeg[],
  stops: RefuelStop[],
): RouteCostBreakdown {
  const fuelCostUsd = legs.reduce((sum, l) => sum + l.fuel_cost_usd, 0);
  const fboFeesUsd = stops.reduce((sum, s) => sum + s.fbo_fee_usd, 0);
  const detourCostUsd = stops.reduce(
    (sum, s) => sum + s.added_distance_nm * 8,
    0,
  );

  const totalFuelGal = stops.reduce((sum, s) => sum + s.fuel_uplift_gal, 0);
  const totalFuelCostAtStops = stops.reduce(
    (sum, s) => sum + s.fuel_cost_usd,
    0,
  );
  const avgFuelPriceUsdGal =
    totalFuelGal > 0
      ? totalFuelCostAtStops / totalFuelGal
      : DEFAULT_FUEL_PRICE_USD;

  return {
    fuel_cost_usd: Math.round(fuelCostUsd * 100) / 100,
    fbo_fees_usd: Math.round(fboFeesUsd * 100) / 100,
    refuel_stop_detour_cost_usd: Math.round(detourCostUsd * 100) / 100,
    avg_fuel_price_usd_gal: Math.round(avgFuelPriceUsdGal * 100) / 100,
    total_routing_cost_usd:
      Math.round((fuelCostUsd + fboFeesUsd + detourCostUsd) * 100) / 100,
  };
}

// ─── Trade-off note for alternatives ─────────────────────────────────────────

function buildTradeOffNote(
  primary: { totalCost: number; totalTimeHr: number },
  alt: { totalCost: number; totalTimeHr: number },
): string {
  const costDiff = alt.totalCost - primary.totalCost;
  const timeDiffMin = Math.round((alt.totalTimeHr - primary.totalTimeHr) * 60);
  const costStr =
    costDiff >= 0
      ? `+$${Math.round(costDiff).toLocaleString()} cost`
      : `-$${Math.round(Math.abs(costDiff)).toLocaleString()} cost`;
  const timeStr =
    timeDiffMin >= 0
      ? `+${timeDiffMin} min flight time`
      : `-${Math.abs(timeDiffMin)} min flight time`;
  return `${costStr}, ${timeStr} vs primary route`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface OptimizeRouteResult {
  route_legs: RouteLeg[];
  refuel_stops: RefuelStop[];
  total_distance_nm: number;
  total_flight_time_hr: number;
  total_fuel_cost_usd: number;
  cost_breakdown: RouteCostBreakdown;
  alternatives: AlternativeRoute[];
}

/**
 * Main entry point. Optimizes the complete multi-leg route for a given aircraft
 * and optimization mode. Generates one alternative route in the complementary mode.
 */
export async function optimizeRoute(
  inputLegs: {
    from_icao: string;
    to_icao: string;
    date: string;
    time: string;
  }[],
  aircraft: AircraftPerf,
  mode: OptimizationMode,
): Promise<OptimizeRouteResult> {
  const allLegs: RouteLeg[] = [];
  const allStops: RefuelStop[] = [];

  for (const leg of inputLegs) {
    const fromAirport = await requireAirport(leg.from_icao);
    const toAirport = await requireAirport(leg.to_icao);

    const result = await findFuelStopsForLeg(
      fromAirport,
      toAirport,
      aircraft,
      mode,
      0,
    );

    allLegs.push(...result.legs);
    allStops.push(...result.stops);
  }

  const totalDistNm = allLegs.reduce((s, l) => s + l.distance_nm, 0);
  const totalTimeHr = allLegs.reduce((s, l) => s + l.flight_time_hr, 0);
  const totalFuelCost = allLegs.reduce((s, l) => s + l.fuel_cost_usd, 0);
  const costBreakdown = buildCostBreakdown(allLegs, allStops);

  // Generate one alternative with the opposite mode
  const altMode: OptimizationMode =
    mode === "cost" ? "time" : mode === "time" ? "cost" : "time";

  let alternatives: AlternativeRoute[] = [];
  try {
    const altLegs: RouteLeg[] = [];
    const altStops: RefuelStop[] = [];

    for (const leg of inputLegs) {
      const fromAirport = await requireAirport(leg.from_icao);
      const toAirport = await requireAirport(leg.to_icao);
      const altResult = await findFuelStopsForLeg(
        fromAirport,
        toAirport,
        aircraft,
        altMode,
        0,
      );
      altLegs.push(...altResult.legs);
      altStops.push(...altResult.stops);
    }

    const altTotalCost = altLegs.reduce((s, l) => s + l.fuel_cost_usd, 0);
    const altTotalTimeHr = altLegs.reduce((s, l) => s + l.flight_time_hr, 0);

    alternatives = [
      {
        label: altMode === "time" ? "Time-optimized" : "Cost-optimized",
        optimization_mode: altMode,
        route_legs: altLegs,
        refuel_stops: altStops,
        total_distance_nm: altLegs.reduce((s, l) => s + l.distance_nm, 0),
        total_flight_time_hr: altTotalTimeHr,
        total_fuel_cost_usd: altTotalCost,
        risk_score: 0, // filled in by index.ts after risk computation
        on_time_probability: 1,
        trade_off_note: buildTradeOffNote(
          { totalCost: totalFuelCost, totalTimeHr: totalTimeHr },
          { totalCost: altTotalCost, totalTimeHr: altTotalTimeHr },
        ),
      },
    ];
  } catch {
    // Alternative mode failed (e.g. no route found with different mode constraints)
    // Proceed with empty alternatives array
  }

  return {
    route_legs: allLegs,
    refuel_stops: allStops,
    total_distance_nm: Math.round(totalDistNm),
    total_flight_time_hr: Math.round(totalTimeHr * 100) / 100,
    total_fuel_cost_usd: Math.round(totalFuelCost * 100) / 100,
    cost_breakdown: costBreakdown,
    alternatives,
  };
}
