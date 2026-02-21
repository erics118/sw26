import { describe, it, expect } from "vitest";
import { calculatePricing } from "./engine";
import type { PricingInput } from "./engine";
import type { TripLeg } from "@/lib/database.types";

// KTEB → KLAX: known airports in geo.ts, deterministic haversine distance
const LEG_KTEB_KLAX: TripLeg = {
  from_icao: "KTEB",
  to_icao: "KLAX",
  date: "2026-03-10", // Monday — not a peak day
  time: "09:00",
};

const LEG_KLAX_KTEB: TripLeg = {
  from_icao: "KLAX",
  to_icao: "KTEB",
  date: "2026-03-12", // Wednesday — not a peak day
  time: "14:00",
};

const baseInput: PricingInput = {
  legs: [LEG_KTEB_KLAX],
  aircraftCategory: "midsize",
  marginPct: 20,
  cateringRequested: false,
  isInternational: false,
};

describe("calculatePricing", () => {
  it("returns a positive total for a basic domestic flight", () => {
    const result = calculatePricing(baseInput);
    expect(result.total).toBeGreaterThan(0);
    expect(result.subtotal).toBeGreaterThan(0);
  });

  it("total is greater than subtotal (margin + tax add to it)", () => {
    const result = calculatePricing(baseInput);
    expect(result.total).toBeGreaterThan(result.subtotal);
  });

  it("margin_amount equals subtotal * marginPct / 100", () => {
    const result = calculatePricing(baseInput);
    expect(result.margin_amount).toBeCloseTo(result.subtotal * 0.2, 2);
  });

  it("higher margin percentage produces a higher total", () => {
    const low = calculatePricing({ ...baseInput, marginPct: 10 });
    const high = calculatePricing({ ...baseInput, marginPct: 30 });
    expect(high.total).toBeGreaterThan(low.total);
  });

  it("catering_cost is 0 when cateringRequested is false", () => {
    const result = calculatePricing(baseInput);
    expect(result.catering_cost).toBe(0);
  });

  it("catering_cost is 350 per leg when cateringRequested is true", () => {
    const result = calculatePricing({ ...baseInput, cateringRequested: true });
    expect(result.catering_cost).toBe(350); // CATERING_FLAT = 350 per leg
  });

  it("catering scales with number of legs", () => {
    const twoLegs = calculatePricing({
      ...baseInput,
      legs: [LEG_KTEB_KLAX, LEG_KLAX_KTEB],
      cateringRequested: true,
    });
    expect(twoLegs.catering_cost).toBe(700); // 2 legs × $350
  });

  it("permit_fees is 0 for a domestic flight", () => {
    const result = calculatePricing(baseInput);
    expect(result.permit_fees).toBe(0);
  });

  it("permit_fees is 750 per international leg", () => {
    // KTEB (K-prefix = US) → EGLL (E-prefix = UK) is a cross-border leg
    const result = calculatePricing({
      ...baseInput,
      legs: [{ ...LEG_KTEB_KLAX, from_icao: "KTEB", to_icao: "EGLL" }],
      isInternational: true,
    });
    expect(result.permit_fees).toBe(750);
  });

  it("fuel_cost is positive", () => {
    const result = calculatePricing(baseInput);
    expect(result.fuel_cost).toBeGreaterThan(0);
  });

  it("fbo_fees are positive (departure + destination)", () => {
    const result = calculatePricing(baseInput);
    expect(result.fbo_fees).toBeGreaterThan(0);
  });

  it("repositioning_cost is 0 when homeBaseIcao matches departure", () => {
    const result = calculatePricing({
      ...baseInput,
      homeBaseIcao: "KTEB",
    });
    expect(result.repositioning_cost).toBe(0);
    expect(result.repositioning_hours).toBe(0);
  });

  it("repositioning_cost is positive when aircraft flies from different home base", () => {
    const result = calculatePricing({
      ...baseInput,
      homeBaseIcao: "KBOS",
    });
    expect(result.repositioning_cost).toBeGreaterThan(0);
    expect(result.repositioning_hours).toBeGreaterThan(0);
  });

  it("per_leg_breakdown has entries for each leg", () => {
    const result = calculatePricing(baseInput);
    expect(result.per_leg_breakdown.length).toBeGreaterThan(0);
  });

  it("line_items includes margin and tax entries", () => {
    const result = calculatePricing(baseInput);
    const labels = result.line_items.map((li) => li.label);
    expect(labels.some((l) => l.startsWith("Margin"))).toBe(true);
    expect(labels.some((l) => l.startsWith("Tax"))).toBe(true);
  });

  it("uses custom fuel price override when provided", () => {
    const defaultPrice = calculatePricing(baseInput);
    const higherFuel = calculatePricing({
      ...baseInput,
      fuelPriceOverrideUsd: 15.0, // double the default $7.50
    });
    expect(higherFuel.fuel_cost).toBeGreaterThan(defaultPrice.fuel_cost);
  });
});
