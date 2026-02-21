import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  TripLegSchema,
  TripTypeSchema,
  AircraftCategorySchema,
} from "@/lib/schemas";

const MODEL = "claude-sonnet-4-6";

// ─── Extracted trip schema (what Claude returns) ──────────────────────────────

export const ExtractedTripSchema = z.object({
  legs: z.array(TripLegSchema),
  trip_type: TripTypeSchema,
  pax_adults: z.number().int().min(1),
  pax_children: z.number().int().min(0),
  pax_pets: z.number().int().min(0),
  flexibility_hours: z.number().int().min(0),
  special_needs: z.string().nullable(),
  catering_notes: z.string().nullable(),
  luggage_notes: z.string().nullable(),
  preferred_category: AircraftCategorySchema.nullable(),
  min_cabin_height_in: z.number().nullable(),
  wifi_required: z.boolean(),
  bathroom_required: z.boolean(),
  client_name: z.string().nullable(),
  client_email: z.string().nullable(),
  client_phone: z.string().nullable(),
  client_company: z.string().nullable(),
});

export type ExtractedTrip = z.infer<typeof ExtractedTripSchema>;

// Per-field confidence scores (0–1). Fields Claude is uncertain about get < 0.7.
export type ConfidenceMap = Partial<Record<keyof ExtractedTrip, number>>;

export interface IntakeResult {
  extracted: ExtractedTrip;
  confidence: ConfidenceMap;
  rawResponse: string;
}

// ─── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert aviation charter coordinator. Extract structured trip information from raw email or call notes and return ONLY valid JSON matching this schema:

{
  "legs": [{ "from_icao": "KLAX", "to_icao": "KJFK", "date": "2024-06-15", "time": "14:00" }],
  "trip_type": "one_way" | "round_trip" | "multi_leg",
  "pax_adults": 2,
  "pax_children": 0,
  "pax_pets": 0,
  "flexibility_hours": 0,
  "special_needs": null,
  "catering_notes": null,
  "luggage_notes": null,
  "preferred_category": null | "turboprop" | "light" | "midsize" | "super-mid" | "heavy" | "ultra-long",
  "min_cabin_height_in": null,
  "wifi_required": false,
  "bathroom_required": false,
  "client_name": null,
  "client_email": null,
  "client_phone": null,
  "client_company": null,
  "_confidence": {
    "legs": 0.95,
    "trip_type": 0.9,
    "pax_adults": 0.85
    // ... include only fields you extracted, omit fields that defaulted
  }
}

Rules:
- Airport codes: always use 4-letter ICAO (e.g. KLAX, EGLL). If you only see a city/airport name, infer the primary ICAO.
- Dates: ISO format YYYY-MM-DD. Times: HH:MM in 24h local time.
- trip_type: "round_trip" if return date/leg mentioned, "multi_leg" if 3+ airports, else "one_way".
- If a field is not mentioned, use null or 0 as appropriate.
- _confidence: a score 0–1 per extracted field. Use 1.0 for explicit values, 0.5–0.8 for inferred, omit if defaulted.
- Return ONLY the JSON object. No markdown, no explanation.`;

// ─── Main extraction function ─────────────────────────────────────────────────

export async function extractTripFromText(
  rawText: string,
): Promise<IntakeResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Extract the charter trip details from the following:\n\n${rawText}`,
      },
    ],
  });

  const rawResponse =
    message.content[0]?.type === "text" ? message.content[0].text : "";

  // Strip markdown code fences if present
  const jsonText = rawResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(
      `Claude returned non-JSON response: ${rawResponse.slice(0, 200)}`,
    );
  }

  // Pull confidence out before validation
  const rawObj = parsed as Record<string, unknown>;
  const confidence: ConfidenceMap =
    (rawObj["_confidence"] as ConfidenceMap) ?? {};
  delete rawObj["_confidence"];

  const result = ExtractedTripSchema.safeParse(rawObj);
  if (!result.success) {
    throw new Error(`Extraction validation failed: ${result.error.message}`);
  }

  return {
    extracted: result.data,
    confidence,
    rawResponse,
  };
}
