import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateQuoteSchema } from "@/lib/schemas";
import { runQuoteAgent } from "@/lib/agents/quote.agent";

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

  let result;
  try {
    result = await runQuoteAgent(parsed.data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent quote failed" },
      { status: 502 },
    );
  }

  // If client requested a specific status (e.g. "sent"), apply it after creation
  if (parsed.data.status && parsed.data.status !== "new") {
    await supabase
      .from("quotes")
      .update({ status: parsed.data.status })
      .eq("id", result.quote.id);
    result = {
      ...result,
      quote: { ...result.quote, status: parsed.data.status },
    };
  }

  // Audit log
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
