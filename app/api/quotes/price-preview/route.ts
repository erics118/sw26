import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { calculatePricing } from "@/lib/pricing/engine";

// ─── POST /api/quotes/price-preview ───────────────────────────────────────────
// Computes pricing for a quote without persisting anything.
// Used by the quote new page to show a preview before the user confirms.

const PricePreviewSchema = z.object({
  trip_id: z.string().uuid(),
  aircraft_id: z.string().uuid(),
  route_plan_id: z.string().uuid().optional(),
  fuel_price_override_usd: z.number().positive().optional(),
  margin_pct: z.number().min(5).max(40).default(20),
});

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PricePreviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const { trip_id, aircraft_id, route_plan_id, fuel_price_override_usd, margin_pct } =
    parsed.data;

  const [{ data: aircraft }, { data: trip }] = await Promise.all([
    supabase
      .from("aircraft")
      .select(
        "tail_number, category, fuel_burn_gph, home_base_icao, range_nm, pax_capacity",
      )
      .eq("id", aircraft_id)
      .single(),
    supabase
      .from("trips")
      .select("legs, catering_notes, trip_type, pax_adults")
      .eq("id", trip_id)
      .single(),
  ]);

  if (!aircraft || !trip || !Array.isArray(trip.legs) || trip.legs.length === 0) {
    return NextResponse.json({ error: "Trip or aircraft not found" }, { status: 404 });
  }

  // Resolve fuel price: route_plan_id > fuel_price_override_usd > default
  let fuelPriceOverride: number | undefined = fuel_price_override_usd;
  let optimizationMode = "balanced";

  if (route_plan_id) {
    const { data: plan } = await supabase
      .from("route_plans")
      .select("cost_breakdown, optimization_mode")
      .eq("id", route_plan_id)
      .single();

    if (plan) {
      const pb = plan.cost_breakdown as { avg_fuel_price_usd_gal?: number } | null;
      if (pb?.avg_fuel_price_usd_gal) {
        fuelPriceOverride = pb.avg_fuel_price_usd_gal;
      }
      optimizationMode = (plan.optimization_mode as string) ?? "balanced";
    }
  }

  type TripLeg = { from_icao: string; to_icao: string; date: string; time: string };
  const legs = trip.legs as TripLeg[];
  const isInternational = legs.some(
    (l) => l.from_icao[0] !== "K" || l.to_icao[0] !== "K",
  );
  const cateringRequested = !!trip.catering_notes;

  type AircraftRow = {
    tail_number: string;
    category: string;
    fuel_burn_gph: number | null;
    home_base_icao: string | null;
    range_nm: number;
    pax_capacity: number;
  };
  const ac = aircraft as unknown as AircraftRow;

  const pricing = calculatePricing({
    legs,
    aircraftCategory: ac.category,
    fuelBurnGph: ac.fuel_burn_gph ?? null,
    homeBaseIcao: ac.home_base_icao ?? null,
    marginPct: margin_pct,
    cateringRequested,
    isInternational,
    fuelPriceOverrideUsd: fuelPriceOverride,
  });

  return NextResponse.json({
    costs: {
      fuel_cost: pricing.fuel_cost,
      fbo_fees: pricing.fbo_fees,
      repositioning_cost: pricing.repositioning_cost,
      repositioning_hours: pricing.repositioning_hours,
      permit_fees: pricing.permit_fees,
      crew_overnight_cost: pricing.crew_overnight_cost,
      catering_cost: pricing.catering_cost,
      peak_day_surcharge: pricing.peak_day_surcharge,
      subtotal: pricing.subtotal,
      margin_amount: pricing.margin_amount,
      tax: pricing.tax,
      total: pricing.total,
    },
    aircraft: {
      tail_number: ac.tail_number,
      category: ac.category,
      range_nm: ac.range_nm,
      pax_capacity: ac.pax_capacity,
    },
    trip: {
      legs,
      trip_type: trip.trip_type as string,
      pax_adults: trip.pax_adults as number,
    },
    optimization_mode: optimizationMode,
  });
}
