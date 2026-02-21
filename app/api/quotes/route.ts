import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculatePricing } from "@/lib/pricing/engine";
import { CreateQuoteSchema } from "@/lib/schemas";
import type {
  Trip,
  Aircraft,
  Quote,
  TripLeg,
  Json,
} from "@/lib/database.types";

// ─── GET /api/quotes ──────────────────────────────────────────────────────────
// Query params: status, client_id, date_from, date_to

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const clientId = searchParams.get("client_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  let query = supabase
    .from("quotes")
    .select(
      "*, trips(*), clients(*), aircraft(*), operators(*), quote_costs(*)",
    )
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);
  if (clientId) query = query.eq("client_id", clientId);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── POST /api/quotes ─────────────────────────────────────────────────────────
// Body: { trip_id, aircraft_id, operator_id, margin_pct?, catering?, notes? }

export async function POST(request: Request) {
  const supabase = await createClient();
  const body: unknown = await request.json();

  const parsed = CreateQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  // 1. Fetch trip
  const { data: rawTrip, error: tripErr } = await supabase
    .from("trips")
    .select("*")
    .eq("id", input.trip_id)
    .single();
  if (tripErr || !rawTrip) {
    return NextResponse.json(
      { error: tripErr?.message ?? "Trip not found" },
      { status: 404 },
    );
  }
  const trip = rawTrip as unknown as Trip;

  // 2. Fetch aircraft (if provided)
  let aircraft: Aircraft | null = null;
  if (input.aircraft_id) {
    const { data: rawAircraft, error: acErr } = await supabase
      .from("aircraft")
      .select("*")
      .eq("id", input.aircraft_id)
      .single();
    if (acErr || !rawAircraft) {
      return NextResponse.json(
        { error: acErr?.message ?? "Aircraft not found" },
        { status: 404 },
      );
    }
    aircraft = rawAircraft as unknown as Aircraft;
  }

  // 3. Fetch operator existence check (if provided)
  if (input.operator_id) {
    const { data: rawOp, error: opErr } = await supabase
      .from("operators")
      .select("id")
      .eq("id", input.operator_id)
      .single();
    if (opErr || !rawOp) {
      return NextResponse.json(
        { error: opErr?.message ?? "Operator not found" },
        { status: 404 },
      );
    }
  }

  // 4. Run pricing engine
  const legs = trip.legs as TripLeg[];
  const marginPct = input.margin_pct ?? 15;
  const cateringRequested =
    Boolean(input.notes?.toLowerCase().includes("catering")) ||
    Boolean(trip.catering_notes);
  const isInternational = legs.some(
    (l) => l.from_icao.charAt(0) !== "K" || l.to_icao.charAt(0) !== "K",
  );

  const pricing = calculatePricing({
    legs,
    aircraftCategory: aircraft?.category ?? "midsize",
    fuelBurnGph: aircraft?.fuel_burn_gph ?? null,
    homeBaseIcao: aircraft?.home_base_icao ?? null,
    marginPct,
    cateringRequested,
    isInternational,
  });

  // 5. Insert quote row
  const { data: rawQuote, error: quoteErr } = await supabase
    .from("quotes")
    .insert({
      trip_id: input.trip_id,
      client_id: input.client_id ?? trip.client_id,
      aircraft_id: input.aircraft_id ?? null,
      operator_id: input.operator_id ?? null,
      status: "pricing",
      version: 1,
      margin_pct: marginPct,
      currency: input.currency ?? "USD",
      broker_name: input.broker_name ?? null,
      broker_commission_pct: input.broker_commission_pct ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (quoteErr || !rawQuote) {
    return NextResponse.json(
      { error: quoteErr?.message ?? "Failed to create quote" },
      { status: 500 },
    );
  }
  const quote = rawQuote as unknown as Quote;

  // 6. Insert quote_costs row
  const { data: costs, error: costsErr } = await supabase
    .from("quote_costs")
    .insert({
      quote_id: quote.id,
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
      per_leg_breakdown: pricing.per_leg_breakdown as unknown as Json,
    })
    .select()
    .single();

  if (costsErr) {
    return NextResponse.json({ error: costsErr.message }, { status: 500 });
  }

  // 7. Audit log
  await supabase.from("audit_logs").insert({
    action: "quote.created",
    entity_type: "quotes",
    entity_id: quote.id,
    ai_generated: false,
    human_verified: true,
    payload: {
      subtotal: pricing.subtotal,
      margin_amount: pricing.margin_amount,
      tax: pricing.tax,
      total: pricing.total,
    },
  });

  return NextResponse.json(
    { quote, costs, line_items: pricing.line_items },
    { status: 201 },
  );
}
