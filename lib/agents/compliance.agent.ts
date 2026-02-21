import { createClient } from "@/lib/supabase/server";
import { createDatabaseTools } from "./tools/database";
import { runAgent } from ".";
import type { Quote, Trip, TripLeg } from "@/lib/database.types";

export interface ComplianceAgentResult {
  passed: boolean;
  failures: string[];
  warnings: string[];
}

export interface ComplianceAgentInput {
  quote_id?: string;
  aircraft_id?: string;
  operator_id?: string;
  crew_ids?: string[];
  trip_id?: string;
  estimated_flight_hours?: number;
}

export async function runComplianceAgent(
  input: ComplianceAgentInput,
): Promise<ComplianceAgentResult> {
  const supabase = await createClient();

  // Resolve quote_id → aircraft_id, operator_id, trip_id upfront so the
  // agent prompt can be concrete. The agent still does the actual check.
  let { aircraft_id, operator_id, trip_id } = input;
  const { crew_ids } = input;

  if (input.quote_id) {
    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("aircraft_id, operator_id, trip_id")
      .eq("id", input.quote_id)
      .single();
    if (quoteErr || !quote)
      throw new Error(quoteErr?.message ?? "Quote not found");
    const q = quote as Pick<Quote, "aircraft_id" | "operator_id" | "trip_id">;
    if (!q.aircraft_id || !q.operator_id)
      throw new Error("Quote is missing aircraft or operator");
    aircraft_id = q.aircraft_id;
    operator_id = q.operator_id;
    // Only use quote's trip_id when caller didn't supply one explicitly
    trip_id ??= q.trip_id;
  }

  if (!aircraft_id || !operator_id) {
    throw new Error("Missing aircraft_id or operator_id");
  }

  // Fetch trip legs and cabin height for the prompt context
  let legs: TripLeg[] | undefined;
  let min_cabin_height_in: number | null | undefined;
  if (trip_id) {
    const { data: tripData } = await supabase
      .from("trips")
      .select("legs, min_cabin_height_in")
      .eq("id", trip_id)
      .single();
    const t = tripData as Pick<Trip, "legs" | "min_cabin_height_in"> | null;
    if (t) {
      legs = t.legs as unknown as TripLeg[];
      min_cabin_height_in = t.min_cabin_height_in;
    }
  }

  const dbTools = createDatabaseTools(supabase);

  const prompt = `You are an aviation safety and compliance officer. Perform a thorough compliance check.

AIRCRAFT ID: ${aircraft_id}
OPERATOR ID: ${operator_id}
${crew_ids?.length ? `CREW IDS: ${crew_ids.join(", ")}` : ""}
${trip_id ? `TRIP ID: ${trip_id}` : ""}
${input.estimated_flight_hours != null ? `ESTIMATED FLIGHT HOURS: ${input.estimated_flight_hours}` : ""}

STEPS:
1. Call run_compliance_check with:
   - aircraft_id: ${aircraft_id}
   - operator_id: ${operator_id}
   ${crew_ids?.length ? `- crew_ids: [${crew_ids.map((id) => `"${id}"`).join(", ")}]` : ""}
   ${legs ? `- legs: ${JSON.stringify(legs)}` : ""}
   ${min_cabin_height_in != null ? `- min_cabin_height_in: ${min_cabin_height_in}` : ""}
   ${input.estimated_flight_hours != null ? `- estimated_flight_hours: ${input.estimated_flight_hours}` : ""}
2. Optionally use WebSearch to check for recent FAA safety bulletins or airworthiness directives relevant to this aircraft type or route.
3. Incorporate any critical findings from the web search into the failures or warnings arrays.

After completing all checks, output ONLY this JSON (no markdown, no other text):
{
  "passed": true,
  "failures": [],
  "warnings": []
}`;

  return runAgent<ComplianceAgentResult>({
    serverName: "aviation_compliance",
    dbTools,
    prompt,
    builtinTools: ["WebSearch"],
    maxTurns: 10,
  });
}
