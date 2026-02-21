// ─── Trip extraction (single LLM call, no agent loop) ─────────────────────────
// Agent used only for extraction. Server handles lookup_airport, search_clients, save_trip.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ExtractedLeg {
  from_icao: string;
  to_icao: string;
  date: string;
  time: string;
}

export interface ExtractedTrip {
  legs: ExtractedLeg[];
  trip_type: "one_way" | "round_trip" | "multi_leg";
  pax_adults: number;
  pax_children: number;
  pax_pets: number;
  flexibility_hours: number; // departure/outbound ±hours
  flexibility_hours_return: number; // return leg ±hours (round_trip)
  special_needs: string | null;
  catering_notes: string | null;
  luggage_notes: string | null;
  preferred_category: string | null;
  min_cabin_height_in: number | null;
  wifi_required: boolean;
  bathroom_required: boolean;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_company: string | null;
  confidence: Record<string, number>;
}

const EXTRACTION_PROMPT = `Extract charter trip details from the raw text. Output ONLY valid JSON, no markdown.

RULES:
- Airport codes: 4-letter ICAO. US airports add K prefix (LAX→KLAX, JFK→KJFK).
- Dates: YYYY-MM-DD. Times: HH:MM 24h.
- trip_type: "round_trip" if return mentioned, "multi_leg" if 3+ airports, else "one_way".
- pax_adults min 1. confidence: per-field 0-1 (1=explicit, 0.5-0.8=inferred).
- flexibility_hours: departure/outbound ±hours (e.g. "flexible by 2 hours" → 2).
- flexibility_hours_return: return leg ±hours if different (e.g. "return flexible by 4 hours" → 4). Use 0 if not mentioned or one_way.

Output JSON:
{
  "legs": [{"from_icao":"","to_icao":"","date":"","time":""}],
  "trip_type": "one_way",
  "pax_adults": 1,
  "pax_children": 0,
  "pax_pets": 0,
  "flexibility_hours": 0,
  "flexibility_hours_return": 0,
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
  "client_company": null,
  "confidence": {}
}`;

function parseJsonFromResponse(raw: string): ExtractedTrip {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const start = cleaned.search(/[{[]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  const jsonText =
    start !== -1 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(jsonText) as ExtractedTrip;
  if (parsed.flexibility_hours_return == null) {
    parsed.flexibility_hours_return = 0;
  }
  return parsed;
}

export async function extractTripFromText(
  rawText: string,
): Promise<ExtractedTrip> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: EXTRACTION_PROMPT,
    messages: [{ role: "user", content: `RAW TEXT:\n${rawText}` }],
  });

  const raw =
    message.content[0]?.type === "text" ? message.content[0].text : "{}";
  return parseJsonFromResponse(raw);
}
