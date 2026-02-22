/**
 * POST /api/dev/backfill-costs
 *
 * For every completed quote that has no quote_costs row, runs the pricing
 * engine using the trip legs + aircraft data and inserts the result.
 * Safe to run multiple times — only processes quotes that are still missing costs.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { calculatePricing } from "@/lib/pricing/engine";
import type { TripLeg } from "@/lib/database.types";

export async function POST() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Fetch all completed quotes with trip legs + aircraft details
  const { data: quotes, error: quoteErr } = await supabase
    .from("quotes")
    .select(
      "id, margin_pct, chosen_aircraft_category, actual_total_hours, " +
        "trips(legs, catering_notes), " +
        "aircraft(category, fuel_burn_gph, home_base_icao)",
    )
    .eq("status", "completed")
    .not("trips", "is", null);

  if (quoteErr) {
    return NextResponse.json({ error: quoteErr.message }, { status: 500 });
  }
  if (!quotes?.length) {
    return NextResponse.json({
      success: true,
      processed: 0,
      message: "No completed quotes found.",
    });
  }

  // 2. Fetch quote IDs that already have costs
  const { data: existingCosts } = await supabase
    .from("quote_costs")
    .select("quote_id");

  const existingSet = new Set((existingCosts ?? []).map((c) => c.quote_id));

  // 3. Filter to only quotes missing costs
  const toPrice = quotes.filter((q) => !existingSet.has(q.id));
  if (!toPrice.length) {
    return NextResponse.json({
      success: true,
      processed: 0,
      message: "All completed quotes already have costs.",
    });
  }

  // 4. Compute costs for each and build insert batch
  const costRows: {
    quote_id: string;
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
    per_leg_breakdown: unknown;
  }[] = [];

  for (const q of toPrice) {
    const trip = Array.isArray(q.trips) ? q.trips[0] : q.trips;
    const aircraft = Array.isArray(q.aircraft) ? q.aircraft[0] : q.aircraft;

    if (!trip || !aircraft) continue;

    const legs = (trip.legs ?? []) as TripLeg[];
    if (!legs.length) continue;

    const category =
      q.chosen_aircraft_category ?? aircraft.category ?? "midsize";

    // margin_pct in seed was stored as 0.15 (fractional); real quotes use 0-100.
    // Normalise: if value ≤ 1, treat as fractional and multiply × 100.
    const rawMargin = q.margin_pct ?? 15;
    const marginPct = rawMargin <= 1 ? rawMargin * 100 : rawMargin;

    const cateringRequested =
      typeof trip.catering_notes === "string" &&
      trip.catering_notes.trim().length > 0;

    let result;
    try {
      result = calculatePricing({
        legs,
        aircraftCategory: category,
        fuelBurnGph: aircraft.fuel_burn_gph,
        homeBaseIcao: aircraft.home_base_icao,
        marginPct,
        cateringRequested,
      });
    } catch {
      // Skip quotes where pricing fails (e.g. unrecognised airport codes)
      continue;
    }

    costRows.push({
      quote_id: q.id,
      fuel_cost: result.fuel_cost,
      fbo_fees: result.fbo_fees,
      repositioning_cost: result.repositioning_cost,
      repositioning_hours: result.repositioning_hours,
      permit_fees: result.permit_fees,
      crew_overnight_cost: result.crew_overnight_cost,
      catering_cost: result.catering_cost,
      peak_day_surcharge: result.peak_day_surcharge,
      subtotal: result.subtotal,
      margin_amount: result.margin_amount,
      tax: result.tax,
      total: result.total,
      per_leg_breakdown: result.per_leg_breakdown,
    });
  }

  if (!costRows.length) {
    return NextResponse.json({
      success: true,
      processed: 0,
      message: "No priceable quotes found (missing legs or aircraft data).",
    });
  }

  // 5. Insert in batches of 200
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < costRows.length; i += BATCH) {
    const batch = costRows.slice(i, i + BATCH);
    const { error: insertErr } = await supabase
      .from("quote_costs")
      .insert(batch);
    if (insertErr) {
      return NextResponse.json(
        { error: insertErr.message, inserted_so_far: inserted },
        { status: 500 },
      );
    }
    inserted += batch.length;
  }

  return NextResponse.json({
    success: true,
    total_completed_quotes: quotes.length,
    already_had_costs: existingSet.size,
    processed: inserted,
  });
}
