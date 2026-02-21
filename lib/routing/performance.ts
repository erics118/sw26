// ─── Aircraft performance helpers ─────────────────────────────────────────────
// Single source of truth for category-level defaults.
// The pricing engine (lib/pricing/engine.ts) has its own copy for now;
// when convenient, engine.ts can import CATEGORY_PERF from here.

export interface CategoryPerf {
  speedKts: number;
  defaultFuelBurnGph: number;
  defaultFuelCapacityGal: number; // usable fuel capacity
  defaultReserveGal: number; // FAR 91 VFR 45-min reserve at cruise
  defaultMinRunwayFt: number;
}

// Category-level defaults indexed by aircraft.category string
export const CATEGORY_PERF: Record<string, CategoryPerf> = {
  turboprop: {
    speedKts: 250,
    defaultFuelBurnGph: 55,
    defaultFuelCapacityGal: 402,
    defaultReserveGal: 41, // 55 gph × 0.75 hr
    defaultMinRunwayFt: 3500,
  },
  light: {
    speedKts: 420,
    defaultFuelBurnGph: 100,
    defaultFuelCapacityGal: 540,
    defaultReserveGal: 75, // 100 gph × 0.75 hr
    defaultMinRunwayFt: 4000,
  },
  midsize: {
    speedKts: 450,
    defaultFuelBurnGph: 155,
    defaultFuelCapacityGal: 900,
    defaultReserveGal: 116,
    defaultMinRunwayFt: 5000,
  },
  "super-mid": {
    speedKts: 470,
    defaultFuelBurnGph: 205,
    defaultFuelCapacityGal: 1350,
    defaultReserveGal: 154,
    defaultMinRunwayFt: 5500,
  },
  heavy: {
    speedKts: 480,
    defaultFuelBurnGph: 300,
    defaultFuelCapacityGal: 2400,
    defaultReserveGal: 225,
    defaultMinRunwayFt: 7000,
  },
  "ultra-long": {
    speedKts: 490,
    defaultFuelBurnGph: 355,
    defaultFuelCapacityGal: 4200,
    defaultReserveGal: 266,
    defaultMinRunwayFt: 7000,
  },
};

// Minimal Aircraft shape — only the fields performance.ts needs.
// Compatible with the full Aircraft row from database.types.ts.
export interface AircraftPerf {
  category: string;
  fuel_burn_gph: number | null;
  range_nm: number | null;
  cruise_speed_kts?: number | null;
  max_fuel_capacity_gal?: number | null;
  min_runway_ft?: number | null;
  reserve_fuel_gal?: number | null;
}

function categoryPerf(aircraft: AircraftPerf): CategoryPerf {
  return CATEGORY_PERF[aircraft.category] ?? CATEGORY_PERF["midsize"]!;
}

/** Cruise speed in knots. Per-aircraft value if set, else category default. */
export function effectiveSpeedKts(aircraft: AircraftPerf): number {
  return aircraft.cruise_speed_kts ?? categoryPerf(aircraft).speedKts;
}

/** Fuel burn in gallons/hour. Per-aircraft value if set, else category default. */
export function effectiveFuelBurnGph(aircraft: AircraftPerf): number {
  return aircraft.fuel_burn_gph ?? categoryPerf(aircraft).defaultFuelBurnGph;
}

/** Usable fuel capacity in gallons. Per-aircraft value if set, else category default. */
export function usableFuelGal(aircraft: AircraftPerf): number {
  return (
    aircraft.max_fuel_capacity_gal ??
    categoryPerf(aircraft).defaultFuelCapacityGal
  );
}

/** FAR 91 45-min reserve fuel in gallons. Per-aircraft value if set, else 45 min of burn. */
export function reserveFuelGal(aircraft: AircraftPerf): number {
  if (aircraft.reserve_fuel_gal) return aircraft.reserve_fuel_gal;
  return effectiveFuelBurnGph(aircraft) * 0.75; // 45 min = 0.75 hr
}

/** Minimum runway length required at destination. */
export function effectiveMinRunwayFt(aircraft: AircraftPerf): number {
  return aircraft.min_runway_ft ?? categoryPerf(aircraft).defaultMinRunwayFt;
}

/**
 * Fuel required for a leg of a given distance, in gallons (no reserve).
 * Optional windCorrectionKts: positive = headwind (slower), negative = tailwind (faster).
 */
export function fuelForLegGal(
  distNm: number,
  aircraft: AircraftPerf,
  windCorrectionKts = 0,
): number {
  const groundSpeedKts = Math.max(
    effectiveSpeedKts(aircraft) - windCorrectionKts,
    1, // prevent division by zero
  );
  const flightHr = distNm / groundSpeedKts;
  return flightHr * effectiveFuelBurnGph(aircraft);
}

/** Fuel required including reserve. */
export function fuelWithReserveGal(
  legFuelGal: number,
  aircraft: AircraftPerf,
): number {
  return legFuelGal + reserveFuelGal(aircraft);
}

/** Flight time in hours for a given distance. */
export function flightTimeHr(
  distNm: number,
  aircraft: AircraftPerf,
  windCorrectionKts = 0,
): number {
  const groundSpeedKts = Math.max(
    effectiveSpeedKts(aircraft) - windCorrectionKts,
    1,
  );
  return distNm / groundSpeedKts;
}

export interface RangeCheckResult {
  can_fly_direct: boolean;
  fuel_required_gal: number; // including reserve
  fuel_available_gal: number;
  deficit_gal: number; // 0 if can fly direct
  max_direct_nm: number; // max range at full fuel load
}

/**
 * Returns whether the aircraft can fly a leg of distNm with fuel + reserve
 * within usable capacity, and what the maximum direct range is.
 */
export function checkLegRange(
  distNm: number,
  aircraft: AircraftPerf,
  windCorrectionKts = 0,
): RangeCheckResult {
  const legFuel = fuelForLegGal(distNm, aircraft, windCorrectionKts);
  const required = fuelWithReserveGal(legFuel, aircraft);
  const available = usableFuelGal(aircraft);

  // Max range = (available - reserve) / burn_rate * speed
  const usableForFlight = available - reserveFuelGal(aircraft);
  const groundSpeedKts = Math.max(
    effectiveSpeedKts(aircraft) - windCorrectionKts,
    1,
  );
  const maxDirectNm =
    (usableForFlight / effectiveFuelBurnGph(aircraft)) * groundSpeedKts;

  const canFlyDirect = required <= available;
  return {
    can_fly_direct: canFlyDirect,
    fuel_required_gal: required,
    fuel_available_gal: available,
    deficit_gal: canFlyDirect ? 0 : required - available,
    max_direct_nm: maxDirectNm,
  };
}
