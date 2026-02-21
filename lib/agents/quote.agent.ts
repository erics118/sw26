import { createClient } from "@/lib/supabase/server";
import { createDatabaseTools } from "./tools/database";
import { runAgent } from ".";
import type { Quote, QuoteCost } from "@/lib/database.types";
import type { CostLineItem } from "@/lib/pricing/engine";

export interface SelectionReasoning {
  aircraft_id: string;
  aircraft_explanation: string;
  optimization_mode: "cost" | "time" | "balanced";
  route_explanation: string;
}

export interface QuoteAgentResult {
  quote: Quote;
  costs: QuoteCost;
  line_items: CostLineItem[];
  selection_reasoning?: SelectionReasoning;
}

export interface QuoteAgentInput {
  trip_id: string;
  aircraft_id?: string | null;
  client_id?: string | null;
  margin_pct?: number;
  currency?: string;
  notes?: string | null;
  fuel_price_override_usd?: number;
}

export async function runQuoteAgent(
  input: QuoteAgentInput,
): Promise<QuoteAgentResult> {
  const supabase = await createClient();
  const dbTools = createDatabaseTools(supabase);

  const {
    trip_id,
    aircraft_id,
    client_id,
    margin_pct = 15,
    currency = "USD",
    notes,
    fuel_price_override_usd,
  } = input;

  const prompt = `You are an aviation charter pricing specialist. Build the best possible quote for this trip. You must AUTOMATICALLY select the best aircraft and the best route plan option (cost/balanced/time) with clear reasoning — no human input.

TRIP ID: ${trip_id}
${aircraft_id ? `AIRCRAFT: Use aircraft ID ${aircraft_id} (pre-selected)` : "AIRCRAFT: Automatically select the best aircraft from eligible options — compare and explain your choice."}
MARGIN: ${margin_pct}%
CURRENCY: ${currency}
${notes ? `NOTES: ${notes}` : ""}
${fuel_price_override_usd != null ? `FUEL PRICE OVERRIDE (preferred): Use fuel_price_override_usd: ${fuel_price_override_usd} if provided; otherwise use the route plan's avg fuel price.` : ""}

STEPS:
1. Call get_trip to load the trip details (legs, pax count, wifi/bathroom requirements, preferred category, min cabin height).
2. Call list_aircraft with filters matching the trip requirements (min_range_nm ≈ 500 nm per leg, wifi_required, bathroom_required, min_pax, category from trip). You will get at most 5 aircraft.
   ${aircraft_id ? `- Use the specified aircraft ID.` : "- Pick ONE aircraft: prefer preferred_category from the trip if it matches; otherwise pick the first/best by range. Do NOT call compute_route_plan for every candidate — that is slow. Pick one, then run route plans only for that aircraft."}
3. For your chosen aircraft only, call compute_route_plan exactly THREE times — once with "cost", once with "balanced", once with "time". Pass skip_weather_notam: true for speed (quote does not need live weather/NOTAM).
   - Compare total_routing_cost_usd, total_flight_time_hr, risk_score, on_time_probability, and refuel_stops.
   - Use trip context: if notes/special_needs mention "budget" or "cost-sensitive" → prefer cost. If "urgent" or "time-sensitive" → prefer time. Otherwise use balanced unless cost or time is clearly better.
   - Select the best optimization_mode and write a brief route_explanation.
4. Call calculate_pricing for the selected aircraft using the chosen route plan's cost_breakdown.avg_fuel_price_usd_gal:
   - Set is_international = true if any leg has a non-US ICAO (not starting with 'K').
   - Set catering_requested = true if trip.catering_notes is non-null or notes mention catering.
   - Use the aircraft's fuel_burn_gph and home_base_icao if available.
   - Pass fuel_price_override_usd: cost_breakdown.avg_fuel_price_usd_gal from the chosen route plan.
5. Call save_quote with all pricing data from step 4 plus:
   - trip_id: ${trip_id}
   ${client_id ? `- client_id: ${client_id}` : "- client_id: the client_id from the trip (if set)"}
   - aircraft_id: the aircraft you selected
   - margin_pct: ${margin_pct}
   - currency: ${currency}
   ${notes ? `- notes: "${notes}"` : ""}
6. Call save_route_plan to persist the chosen route plan linked to the new quote:
   - quote_id: from save_quote
   - trip_id: ${trip_id}
   - aircraft_id: the aircraft you selected
   - Pass the full result from the chosen compute_route_plan call (the one matching your selected optimization_mode).

After saving the quote and route plan, output ONLY this minimal JSON (no markdown, no other text). Do NOT repeat the full quote or costs — only quote_id, selection_reasoning, and line_items:
{
  "quote_id": "<the id from save_quote result>",
  "selection_reasoning": {
    "aircraft_id": "<uuid of selected aircraft>",
    "aircraft_explanation": "<1-2 sentence explanation>",
    "optimization_mode": "<cost|balanced|time>",
    "route_explanation": "<1-2 sentence explanation>"
  },
  "line_items": [ "<line_items array from calculate_pricing — array of { leg?, label, amount }>" ]
}`;

  type MinimalResult = {
    quote_id: string;
    selection_reasoning?: SelectionReasoning;
    line_items?: CostLineItem[];
  };

  const minimal = await runAgent<MinimalResult>({
    serverName: "aviation_quote",
    dbTools,
    prompt,
    builtinTools: [],
    maxTurns: 20,
  });

  if (!minimal.quote_id) {
    throw new Error("Agent did not return quote_id");
  }

  const { data: quoteRow, error: quoteErr } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", minimal.quote_id)
    .single();
  if (quoteErr || !quoteRow) {
    throw new Error(
      `Quote not found after save: ${quoteErr?.message ?? "unknown"}`,
    );
  }

  const { data: costsRow, error: costsErr } = await supabase
    .from("quote_costs")
    .select("*")
    .eq("quote_id", minimal.quote_id)
    .single();
  if (costsErr || !costsRow) {
    throw new Error(`Quote costs not found: ${costsErr?.message ?? "unknown"}`);
  }

  return {
    quote: quoteRow as Quote,
    costs: costsRow as QuoteCost,
    line_items: minimal.line_items ?? [],
    selection_reasoning: minimal.selection_reasoning,
  };
}
