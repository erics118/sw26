import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { UpdateQuoteSchema } from "@/lib/schemas";
import { calculatePricing } from "@/lib/pricing/engine";
import type {
  Quote,
  Trip,
  Aircraft,
  TripLeg,
  Json,
} from "@/lib/database.types";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/quotes/[id] ─────────────────────────────────────────────────────

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotes")
    .select("*, trips(*), clients(*), aircraft(*), quote_costs(*)")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Quote not found" },
      { status: 404 },
    );
  }
  return NextResponse.json(data);
}

// ─── PATCH /api/quotes/[id] ───────────────────────────────────────────────────
// Supports updating: status, margin_pct, notes, broker_name, broker_commission_pct
// When margin_pct changes, reprices and updates quote_costs.

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const body: unknown = await request.json();

  const parsed = UpdateQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const updates = parsed.data;

  // Fetch current quote
  const { data: rawQuote, error: fetchErr } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !rawQuote) {
    return NextResponse.json(
      { error: fetchErr?.message ?? "Quote not found" },
      { status: 404 },
    );
  }
  const currentQuote = rawQuote as unknown as Quote;

  // Validate status transition
  if (updates.status) {
    const valid = isValidTransition(currentQuote.status, updates.status);
    if (!valid) {
      return NextResponse.json(
        {
          error: `Invalid status transition: ${currentQuote.status} → ${updates.status}`,
        },
        { status: 422 },
      );
    }
  }

  // Build update payload
  const quoteUpdate: Record<string, unknown> = {};
  if (updates.status !== undefined) {
    quoteUpdate.status = updates.status;
    if (updates.status === "sent")
      quoteUpdate.sent_at = new Date().toISOString();
    if (updates.status === "confirmed")
      quoteUpdate.confirmed_at = new Date().toISOString();
  }
  if (updates.margin_pct !== undefined)
    quoteUpdate.margin_pct = updates.margin_pct;
  if (updates.notes !== undefined) quoteUpdate.notes = updates.notes;
  if (updates.broker_name !== undefined)
    quoteUpdate.broker_name = updates.broker_name;
  if (updates.broker_commission_pct !== undefined)
    quoteUpdate.broker_commission_pct = updates.broker_commission_pct;

  // Reprice if margin changed
  if (
    updates.margin_pct !== undefined &&
    updates.margin_pct !== currentQuote.margin_pct
  ) {
    await repriceQuote(supabase, id, currentQuote, updates.margin_pct);
    // Auto-update status to "pricing" after repricing if still "new"
    if (currentQuote.status === "new") {
      quoteUpdate.status = "pricing";
    }
  }

  // Apply update
  const { data: updatedRaw, error: updateErr } = await supabase
    .from("quotes")
    .update(quoteUpdate)
    .eq("id", id)
    .select()
    .single();

  if (updateErr || !updatedRaw) {
    return NextResponse.json(
      { error: updateErr?.message ?? "Update failed" },
      { status: 500 },
    );
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    action: "quote.updated",
    entity_type: "quotes",
    entity_id: id,
    ai_generated: false,
    human_verified: true,
    payload: { changes: quoteUpdate } as unknown as Json,
  });

  return NextResponse.json(updatedRaw);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_ORDER = [
  "new",
  "pricing",
  "sent",
  "negotiating",
  "confirmed",
  "lost",
  "completed",
] as const;

function isValidTransition(from: string, to: string): boolean {
  // Allow: forward through the funnel, sent <-> negotiating, or lost/completed from any active state
  if (to === "lost" || to === "completed") return from !== "lost";
  if (from === "sent" && to === "negotiating") return true;
  if (from === "negotiating" && to === "sent") return true;
  const fromIdx = STATUS_ORDER.indexOf(from as (typeof STATUS_ORDER)[number]);
  const toIdx = STATUS_ORDER.indexOf(to as (typeof STATUS_ORDER)[number]);
  return fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx;
}

async function repriceQuote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
  quote: Quote,
  newMarginPct: number,
) {
  // Fetch trip + aircraft to reprice
  const { data: rawTrip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", quote.trip_id)
    .single();
  if (!rawTrip) return;
  const trip = rawTrip as unknown as Trip;

  let aircraft: Aircraft | null = null;
  if (quote.aircraft_id) {
    const { data: rawAc } = await supabase
      .from("aircraft")
      .select("*")
      .eq("id", quote.aircraft_id)
      .single();
    if (rawAc) aircraft = rawAc as unknown as Aircraft;
  }

  const legs = trip.legs as TripLeg[];
  const isInternational = legs.some(
    (l) => l.from_icao.charAt(0) !== "K" || l.to_icao.charAt(0) !== "K",
  );

  const pricing = calculatePricing({
    legs,
    aircraftCategory: aircraft?.category ?? "midsize",
    fuelBurnGph: aircraft?.fuel_burn_gph ?? null,
    homeBaseIcao: aircraft?.home_base_icao ?? null,
    marginPct: newMarginPct,
    cateringRequested: Boolean(trip.catering_notes),
    isInternational,
  });

  await supabase
    .from("quote_costs")
    .update({
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
    .eq("quote_id", quoteId);
}
