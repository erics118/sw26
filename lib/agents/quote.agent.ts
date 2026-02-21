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
2. Call list_aircraft with filters matching the trip requirements.
   - Set min_range_nm to the estimated total trip distance (use 500 nm per leg as a conservative estimate).
   - Apply wifi_required, bathroom_required, min_pax, and category filters from the trip.
   ${aircraft_id ? `- Use the specified aircraft ID.` : "- Compare eligible aircraft: for each candidate, call compute_route_plan with optimization_mode 'balanced'. Compare total_routing_cost_usd, total_flight_time_hr, risk_score, on_time_probability, refuel_stops count. Select the best aircraft and write a brief aircraft_explanation (e.g. 'Chose N123AB: lowest total cost, fewer fuel stops, acceptable risk score')."}
3. For the chosen aircraft, compare route plan options: call compute_route_plan THREE times — once with "cost", once with "balanced", once with "time".
   - Compare total_routing_cost_usd, total_flight_time_hr, risk_score, on_time_probability, and refuel_stops.
   - Use trip context: if notes/special_needs mention "budget", "cost-sensitive", or "lowest price" → prefer cost. If "urgent", "time-sensitive", or "same day" → prefer time. Otherwise use balanced unless cost or time is clearly better.
   - Select the best optimization_mode and write a brief route_explanation (e.g. 'Chose balanced: best trade-off between cost and time; cost mode saved $200 but added 45 min; time mode saved 30 min but added $800.').
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

After saving the quote and route plan, output ONLY this JSON (no markdown, no other text):
{
  "quote": { "<full quote object from save_quote>" },
  "costs": { "<full costs object from save_quote>" },
  "line_items": [ "<line_items array from calculate_pricing>" ],
  "selection_reasoning": {
    "aircraft_id": "<uuid of selected aircraft>",
    "aircraft_explanation": "<1-2 sentence explanation of why this aircraft was chosen>",
    "optimization_mode": "<cost|balanced|time>",
    "route_explanation": "<1-2 sentence explanation of why this route option was chosen vs the alternatives>"
  }
}`;

  return runAgent<QuoteAgentResult>({
    serverName: "aviation_quote",
    dbTools,
    prompt,
    builtinTools: [],
    maxTurns: 20,
  });
}
