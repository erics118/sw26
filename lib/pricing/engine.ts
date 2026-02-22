import { distanceNm } from "@/lib/geo";
import { CATEGORY_PERF } from "@/lib/routing/performance";
import type { TripLeg } from "@/lib/database.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const FUEL_PRICE_PER_GAL = 7.5; // Jet-A USD/gallon

// Flat FBO fees per landing (USD). Unknown airports get the default.
const FBO_FEES: Record<string, number> = {
  KTEB: 1200,
  KHPN: 900,
  KPWK: 700,
  KDCA: 1100,
  KSFO: 1000,
  KLAX: 1000,
  KBUR: 600,
  KVNY: 600,
  KJFK: 1500,
  KEWR: 1100,
  KORD: 900,
  KMDW: 650,
  KBOS: 900,
  KMIA: 850,
  KFXE: 600,
  KOPF: 500,
  KPBI: 700,
  KRSW: 500,
  KLAS: 750,
  KDEN: 750,
  KATL: 800,
  KSEA: 800,
  KDFW: 750,
  EGLL: 2000,
  LFPG: 1800,
  OMDB: 1600,
};
const DEFAULT_FBO_FEE = 600;

// Repositioning cost per hour (USD) by category
const REPO_HOURLY: Record<string, number> = {
  turboprop: 1500,
  light: 2200,
  midsize: 3000,
  "super-mid": 4000,
  heavy: 5500,
  "ultra-long": 7000,
};

const PERMIT_FEE = 750; // per international leg
const CREW_OVERNIGHT_RATE = 350; // per crew per night
const DEFAULT_CREW_COUNT = 2; // captain + FO
const CATERING_FLAT = 350; // per leg when catering requested
const PEAK_DAY_SURCHARGE_RATE = 0.05; // 5% of subtotal
const TAX_RATE = 0.075; // 7.5% US federal excise

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CostLineItem {
  leg?: number;
  label: string;
  amount: number;
}

export interface PricingInput {
  legs: TripLeg[];
  aircraftCategory: string;
  fuelBurnGph?: number | null;
  homeBaseIcao?: string | null;
  marginPct: number;
  cateringRequested: boolean;
  isInternational?: boolean;
  taxRate?: number;
  fuelPriceOverrideUsd?: number; // overrides the hardcoded $7.50/gal default
}

export interface PricingResult {
  line_items: CostLineItem[];
  fuel_cost: number;
  fbo_fees: number;
  repositioning_cost: number;
  repositioning_hours: number;
  permit_fees: number;
  crew_overnight_cost: number;
  catering_cost: number;
  peak_day_surcharge: number;
  subtotal: number;
  margin_amount: number;
  tax: number;
  total: number;
  per_leg_breakdown: CostLineItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isPeakDay(isoDate: string): boolean {
  const d = new Date(isoDate + "T12:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun, 5=Fri
  return dow === 0 || dow === 5;
}

function layoverExceedsThreshold(
  departureDate: string,
  departureTime: string,
  arrivalDate: string,
  arrivalTime: string,
  thresholdHours = 4,
): boolean {
  const dep = new Date(`${departureDate}T${departureTime}:00Z`).getTime();
  const arr = new Date(`${arrivalDate}T${arrivalTime}:00Z`).getTime();
  return (arr - dep) / 36e5 > thresholdHours;
}

function feeForAirport(icao: string): number {
  return FBO_FEES[icao.toUpperCase()] ?? DEFAULT_FBO_FEE;
}

// ─── Main engine ─────────────────────────────────────────────────────────────

export function calculatePricing(input: PricingInput): PricingResult {
  const {
    legs,
    aircraftCategory,
    fuelBurnGph,
    homeBaseIcao,
    marginPct,
    cateringRequested,
    isInternational = false,
    taxRate = TAX_RATE,
    fuelPriceOverrideUsd,
  } = input;

  const fuelPricePerGal = Math.max(
    0,
    fuelPriceOverrideUsd ?? FUEL_PRICE_PER_GAL,
  );

  const perf = CATEGORY_PERF[aircraftCategory] ?? CATEGORY_PERF["midsize"]!;
  const burnRate = Math.max(0, fuelBurnGph ?? perf!.defaultFuelBurnGph);
  const lineItems: CostLineItem[] = [];
  const perLegBreakdown: CostLineItem[] = [];

  let totalFuelCost = 0;
  let totalFboFees = 0;
  let totalPermitFees = 0;
  let totalCateringCost = 0;
  let totalCrewOvernight = 0;
  let hasPeakDep = false;

  const legArray = [...legs]; // spread to get non-undefined elements for noUncheckedIndexedAccess

  for (let i = 0; i < legArray.length; i++) {
    const leg = legArray[i]!;
    const legNum = i + 1;
    const nextLeg = i < legArray.length - 1 ? legArray[i + 1]! : null;
    const distNm = distanceNm(leg.from_icao, leg.to_icao);
    const flightHours = distNm / perf!.speedKts;

    // Fuel
    const legFuel = flightHours * burnRate * fuelPricePerGal;
    totalFuelCost += legFuel;
    lineItems.push({
      leg: legNum,
      label: `Fuel – leg ${legNum}`,
      amount: legFuel,
    });
    perLegBreakdown.push({ leg: legNum, label: "Fuel", amount: legFuel });

    // FBO at destination
    const fbo = feeForAirport(leg.to_icao);
    totalFboFees += fbo;
    lineItems.push({
      leg: legNum,
      label: `FBO fee – ${leg.to_icao}`,
      amount: fbo,
    });
    perLegBreakdown.push({ leg: legNum, label: "FBO", amount: fbo });

    // International permit
    const intlLeg =
      isInternational && (leg.from_icao[0] !== "K" || leg.to_icao[0] !== "K"); // rough: non-KXXX
    if (intlLeg) {
      totalPermitFees += PERMIT_FEE;
      lineItems.push({
        leg: legNum,
        label: `International permit – leg ${legNum}`,
        amount: PERMIT_FEE,
      });
      perLegBreakdown.push({
        leg: legNum,
        label: "Permit",
        amount: PERMIT_FEE,
      });
    }

    // Catering
    if (cateringRequested) {
      totalCateringCost += CATERING_FLAT;
      lineItems.push({
        leg: legNum,
        label: `Catering – leg ${legNum}`,
        amount: CATERING_FLAT,
      });
      perLegBreakdown.push({
        leg: legNum,
        label: "Catering",
        amount: CATERING_FLAT,
      });
    }

    // Peak day
    if (isPeakDay(leg.date)) hasPeakDep = true;

    // Crew overnight: check layover to next leg
    if (
      nextLeg &&
      layoverExceedsThreshold(leg.date, leg.time, nextLeg.date, nextLeg.time)
    ) {
      const overnightCost = CREW_OVERNIGHT_RATE * DEFAULT_CREW_COUNT;
      totalCrewOvernight += overnightCost;
      lineItems.push({
        leg: legNum,
        label: `Crew overnight – after leg ${legNum}`,
        amount: overnightCost,
      });
    }
  }

  const firstLeg = legArray[0]!;

  // FBO at departure of first leg
  const departureFbo = feeForAirport(firstLeg.from_icao);
  totalFboFees += departureFbo;
  lineItems.unshift({
    leg: 1,
    label: `FBO fee – ${firstLeg.from_icao} (departure)`,
    amount: departureFbo,
  });
  perLegBreakdown.unshift({
    leg: 1,
    label: "Departure FBO",
    amount: departureFbo,
  });

  // Repositioning (home base → departure airport)
  let repoHours = 0;
  let repoCost = 0;
  if (homeBaseIcao && homeBaseIcao !== firstLeg.from_icao) {
    const repoNm = distanceNm(homeBaseIcao, firstLeg.from_icao);
    repoHours = repoNm / perf!.speedKts;
    repoCost =
      repoHours * (REPO_HOURLY[aircraftCategory] ?? REPO_HOURLY["midsize"]!);
    lineItems.push({ label: "Repositioning", amount: repoCost });
  }

  const baseSubtotal =
    totalFuelCost +
    totalFboFees +
    repoCost +
    totalPermitFees +
    totalCrewOvernight +
    totalCateringCost;

  // Peak-day surcharge on base subtotal
  const peakSurcharge = hasPeakDep ? baseSubtotal * PEAK_DAY_SURCHARGE_RATE : 0;
  if (peakSurcharge > 0) {
    lineItems.push({ label: "Peak-day surcharge (5%)", amount: peakSurcharge });
  }

  const subtotal = baseSubtotal + peakSurcharge;
  const marginAmount = subtotal * (marginPct / 100);
  const tax = (subtotal + marginAmount) * taxRate;
  const total = subtotal + marginAmount + tax;

  lineItems.push({ label: `Margin (${marginPct}%)`, amount: marginAmount });
  lineItems.push({
    label: `Tax (${(taxRate * 100).toFixed(1)}%)`,
    amount: tax,
  });

  return {
    line_items: lineItems,
    fuel_cost: Math.max(0, totalFuelCost),
    fbo_fees: totalFboFees,
    repositioning_cost: repoCost,
    repositioning_hours: repoHours,
    permit_fees: totalPermitFees,
    crew_overnight_cost: totalCrewOvernight,
    catering_cost: totalCateringCost,
    peak_day_surcharge: peakSurcharge,
    subtotal,
    margin_amount: marginAmount,
    tax,
    total,
    per_leg_breakdown: perLegBreakdown,
  };
}
