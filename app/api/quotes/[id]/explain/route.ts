import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQuoteExplanation } from "@/lib/ai/quote-explanation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .select(
      `
      margin_pct,
      aircraft(category),
      trips(legs),
      quote_costs(fuel_cost, subtotal, total, fbo_fees, repositioning_cost, crew_overnight_cost)
    `,
    )
    .eq("id", id)
    .single();

  if (quoteErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const q = quote as {
    margin_pct: number;
    aircraft: { category: string } | null;
    trips: {
      legs: Array<{ from_icao: string; to_icao: string }>;
    } | null;
    quote_costs: Array<{
      fuel_cost: number;
      subtotal: number;
      total: number;
      fbo_fees: number;
      repositioning_cost: number;
      crew_overnight_cost: number;
    }> | null;
  };

  const costs = (q.quote_costs ?? [])[0] ?? null;
  const legs = q.trips?.legs ?? [];
  const route =
    legs.length > 0
      ? legs
          .map((l) => l.from_icao)
          .concat([legs[legs.length - 1]?.to_icao ?? ""])
          .join(" → ")
      : "Unknown route";

  let top_cost_driver = "fuel";
  if (costs) {
    const drivers: Record<string, number> = {
      fuel: costs.fuel_cost,
      fbo_fees: costs.fbo_fees,
      repositioning: costs.repositioning_cost,
      crew_overnight: costs.crew_overnight_cost,
    };
    const top = Object.entries(drivers).sort((a, b) => b[1] - a[1])[0];
    if (top) top_cost_driver = top[0];
  }

  const result = await generateQuoteExplanation({
    route,
    aircraft_category: q.aircraft?.category ?? "unknown",
    total: costs?.total ?? 0,
    subtotal: costs?.subtotal ?? 0,
    margin_pct: q.margin_pct,
    fuel_cost: costs?.fuel_cost ?? 0,
    top_cost_driver,
  });

  return NextResponse.json(result);
}
