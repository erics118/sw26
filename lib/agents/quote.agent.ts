import { createClient } from "@/lib/supabase/server";
import { createDatabaseTools } from "./tools/database";
import { runAgent } from ".";
import type { Quote, QuoteCost } from "@/lib/database.types";
import type { CostLineItem } from "@/lib/pricing/engine";

export interface QuoteAgentResult {
  quote: Quote;
  costs: QuoteCost;
  line_items: CostLineItem[];
}

export interface QuoteAgentInput {
  trip_id: string;
  aircraft_id?: string | null;
  operator_id?: string | null;
  client_id?: string | null;
  margin_pct?: number;
  currency?: string;
  notes?: string | null;
}

export async function runQuoteAgent(
  input: QuoteAgentInput,
): Promise<QuoteAgentResult> {
  const supabase = await createClient();
  const dbTools = createDatabaseTools(supabase);

  const {
    trip_id,
    aircraft_id,
    operator_id,
    client_id,
    margin_pct = 15,
    currency = "USD",
    notes,
  } = input;

  const prompt = `You are an aviation charter pricing specialist. Build the best possible quote for this trip.

TRIP ID: ${trip_id}
${aircraft_id ? `AIRCRAFT: Use aircraft ID ${aircraft_id} (pre-selected)` : "AIRCRAFT: Find the most suitable available aircraft"}
${operator_id ? `OPERATOR: Use operator ID ${operator_id} (pre-selected)` : "OPERATOR: Find the most suitable operator"}
MARGIN: ${margin_pct}%
CURRENCY: ${currency}
${notes ? `NOTES: ${notes}` : ""}

STEPS:
1. Call get_trip to load the trip details (legs, pax count, wifi/bathroom requirements, preferred category, min cabin height).
2. Call list_aircraft with filters matching the trip requirements.
   - Set min_range_nm to the estimated total trip distance (use 500 nm per leg as a conservative estimate).
   - Apply wifi_required, bathroom_required, min_pax, and category filters from the trip.
   ${aircraft_id ? `- Only consider the specified aircraft ID.` : "- Select the best matching option."}
3. Call calculate_pricing for the selected aircraft:
   - Set is_international = true if any leg has a non-US ICAO (not starting with 'K').
   - Set catering_requested = true if trip.catering_notes is non-null or notes mention catering.
   - Use the aircraft's fuel_burn_gph and home_base_icao if available.
4. ${operator_id ? "Use the pre-selected operator." : "Call list_operators(active_only=true) and choose the operator with the highest reliability_score that is not blacklisted."}
5. Call save_quote with all pricing data from step 3 plus:
   - trip_id: ${trip_id}
   ${client_id ? `- client_id: ${client_id}` : "- client_id: the client_id from the trip (if set)"}
   - margin_pct: ${margin_pct}
   - currency: ${currency}
   ${notes ? `- notes: "${notes}"` : ""}

After saving the quote, output ONLY this JSON (no markdown, no other text):
{
  "quote": { "<full quote object from save_quote>" },
  "costs": { "<full costs object from save_quote>" },
  "line_items": [ "<line_items array from calculate_pricing>" ]
}`;

  return runAgent<QuoteAgentResult>({
    serverName: "aviation_quote",
    dbTools,
    prompt,
    builtinTools: [],
    maxTurns: 20,
  });
}
