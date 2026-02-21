import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateQuoteSchema } from "@/lib/schemas";
import { runQuoteAgent } from "@/lib/agents/quote.agent";
import { calculatePricing } from "@/lib/pricing/engine";
import type { Json } from "@/lib/database.types";

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
    .select("*, trips(*), clients(*), aircraft(*), quote_costs(*)")
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
// Body: { trip_id, aircraft_id?, client_id?, margin_pct?, notes? }

export async function POST(request: Request) {
  const supabase = await createClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Simplified save when route_plan_id provided (from preview flow)
  if (data.route_plan_id && data.aircraft_id && data.trip_id) {
    const { data: plan, error: planErr } = await supabase
      .from("route_plans")
      .select("*")
      .eq("id", data.route_plan_id)
      .is("quote_id", null)
      .single();

    if (planErr || !plan) {
      return NextResponse.json(
        { error: "Route plan not found or already linked" },
        { status: 404 },
      );
    }

    const planRow = plan as {
      aircraft_id: string | null;
      trip_id: string | null;
      optimization_mode: string;
      cost_breakdown: { avg_fuel_price_usd_gal?: number } | null;
    };
    if (
      planRow.aircraft_id !== data.aircraft_id ||
      planRow.trip_id !== data.trip_id
    ) {
      return NextResponse.json(
        { error: "Route plan does not match trip/aircraft" },
        { status: 400 },
      );
    }

    const { data: aircraft } = await supabase
      .from("aircraft")
      .select("category, fuel_burn_gph, home_base_icao")
      .eq("id", data.aircraft_id)
      .single();

    const { data: trip } = await supabase
      .from("trips")
      .select("legs, catering_notes")
      .eq("id", data.trip_id)
      .single();

    if (!trip || !Array.isArray(trip.legs) || trip.legs.length === 0) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const costBreakdown = planRow.cost_breakdown;
    const fuelPriceOverride =
      costBreakdown?.avg_fuel_price_usd_gal ?? undefined;

    const legs = trip.legs as {
      from_icao: string;
      to_icao: string;
      date: string;
      time: string;
    }[];
    const isInternational = legs.some(
      (l) => l.from_icao[0] !== "K" || l.to_icao[0] !== "K",
    );
    const cateringRequested = !!trip.catering_notes;

    const pricing = calculatePricing({
      legs,
      aircraftCategory: aircraft?.category ?? "midsize",
      fuelBurnGph: aircraft?.fuel_burn_gph ?? null,
      homeBaseIcao: aircraft?.home_base_icao ?? null,
      marginPct: data.margin_pct ?? 15,
      cateringRequested,
      isInternational,
      fuelPriceOverrideUsd: fuelPriceOverride,
    });

    const { data: quoteRow, error: quoteErr } = await supabase
      .from("quotes")
      .insert({
        trip_id: data.trip_id,
        client_id: data.client_id ?? null,
        aircraft_id: data.aircraft_id,
        status: data.status ?? "new",
        version: 1,
        margin_pct: data.margin_pct ?? 15,
        currency: data.currency ?? "USD",
        notes: data.notes ?? null,
      })
      .select()
      .single();

    const quote = quoteRow as { id: string; status: string } | null;
    if (quoteErr || !quote) {
      return NextResponse.json(
        { error: quoteErr?.message ?? "Quote insert failed" },
        { status: 500 },
      );
    }

    const { error: costsErr } = await supabase.from("quote_costs").insert({
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
    });

    if (costsErr) {
      await supabase.from("quotes").delete().eq("id", quote.id);
      return NextResponse.json({ error: costsErr.message }, { status: 500 });
    }

    // Auto-update status to "pricing" now that quote has costs
    if (quote.status === "new") {
      await supabase
        .from("quotes")
        .update({ status: "pricing" })
        .eq("id", quote.id);
    }

    await supabase
      .from("route_plans")
      .update({ quote_id: quote.id })
      .eq("id", data.route_plan_id);

    if (data.status && data.status !== "new" && data.status !== "pricing") {
      await supabase
        .from("quotes")
        .update({ status: data.status })
        .eq("id", quote.id);
    }

    const costs = {
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
    };

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
        optimization_mode: planRow.optimization_mode,
        route_plan_id: data.route_plan_id,
      },
    });

    return NextResponse.json(
      {
        quote: {
          ...quote,
          status:
            data.status ?? (quote.status === "new" ? "pricing" : quote.status),
        },
        costs,
        line_items: pricing.line_items,
      },
      { status: 201 },
    );
  }

  // Default: run quote agent
  let result;
  try {
    result = await runQuoteAgent(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent quote failed" },
      { status: 502 },
    );
  }

  if (data.status && data.status !== "new") {
    await supabase
      .from("quotes")
      .update({ status: data.status })
      .eq("id", result.quote.id);
    result = {
      ...result,
      quote: { ...result.quote, status: data.status },
    };
  }

  await supabase.from("audit_logs").insert({
    action: "quote.created",
    entity_type: "quotes",
    entity_id: result.quote.id,
    ai_generated: true,
    ai_model: "claude-sonnet-4-6",
    human_verified: false,
    payload: {
      subtotal: result.costs.subtotal,
      margin_amount: result.costs.margin_amount,
      tax: result.costs.tax,
      total: result.costs.total,
      ...(result.selection_reasoning && {
        aircraft_explanation: result.selection_reasoning.aircraft_explanation,
        route_explanation: result.selection_reasoning.route_explanation,
        optimization_mode: result.selection_reasoning.optimization_mode,
      }),
    },
  });

  return NextResponse.json(result, { status: 201 });
}
