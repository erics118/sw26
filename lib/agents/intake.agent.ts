import { createClient } from "@/lib/supabase/server";
import { createDatabaseTools } from "./tools/database";
import { runAgent } from ".";

export interface IntakeAgentResult {
  trip_id: string;
  extracted: Record<string, unknown>;
  confidence: Record<string, number>;
  client_hint: {
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
  };
}

export async function runIntakeAgent(
  rawText: string,
  clientId?: string,
): Promise<IntakeAgentResult> {
  const supabase = await createClient();
  const dbTools = createDatabaseTools(supabase);

  const prompt = `You are an expert aviation charter coordinator. Process this incoming charter request.

STEPS:
1. Extract all trip details from the raw text (legs, passengers, requirements, preferences).
2. If client contact info is found (name, email, phone, company), call search_clients to find a matching existing client.
3. Call save_trip with ALL extracted fields including confidence scores and any client contact info.
   - confidence: per-field scores (1.0 = explicit in text, 0.5–0.8 = inferred, omit if defaulted)
   - client_name/email/phone/company: include if found in the text
4. If an airport code is unclear, use WebFetch to look up the correct ICAO code.

EXTRACTION RULES:
- Airport codes: always 4-letter ICAO (e.g. KLAX, EGLL). Infer from city name if needed.
- Dates: ISO YYYY-MM-DD. Times: HH:MM in 24h local time.
- trip_type: "round_trip" if a return is mentioned, "multi_leg" if 3+ airports, else "one_way".
- pax_adults: minimum 1. pax_children and pax_pets default to 0.
- wifi_required / bathroom_required: boolean, default false.
- flexibility_hours: 0 if not mentioned.
${clientId ? `\nCLIENT ALREADY KNOWN: Use client_id = ${clientId} in save_trip.` : ""}

After calling save_trip, output ONLY this JSON (no markdown, no other text):
{
  "trip_id": "<id from save_trip result>",
  "extracted": {
    "legs": [...],
    "trip_type": "...",
    "pax_adults": 0,
    "pax_children": 0,
    "pax_pets": 0,
    "flexibility_hours": 0,
    "special_needs": null,
    "catering_notes": null,
    "luggage_notes": null,
    "preferred_category": null,
    "min_cabin_height_in": null,
    "wifi_required": false,
    "bathroom_required": false,
    "client_name": null,
    "client_email": null,
    "client_phone": null,
    "client_company": null
  },
  "confidence": { "<field>": 0.0 },
  "client_hint": {
    "name": null,
    "email": null,
    "phone": null,
    "company": null
  }
}

RAW TEXT:
${rawText}`;

  return runAgent<IntakeAgentResult>({
    serverName: "aviation_intake",
    dbTools,
    prompt,
    builtinTools: ["WebFetch"],
    maxTurns: 10,
  });
}
