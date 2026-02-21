# AI Trip Intake

The **New Intake** flow lets staff paste raw text (e.g. email or call notes); an AI agent extracts trip details and optional client contact info, then saves a trip. The user can edit extracted fields and proceed to build a quote.

## Route

- **URL:** `/intake`
- **Access:** Authenticated only.

## User flow

1. **Paste** raw text into the "Raw Input" textarea (or use "Load sample →" to fill a sample charter request).
2. **Click** "✈ Extract with AI" → `POST /api/intake` with `{ raw_text, client_id? }`.
3. **Review** extracted fields on the right: route (legs), passengers, aircraft preferences, client (from text), notes. Each field can show a **confidence chip** (from AI).
4. **Edit** any field (legs, trip type, flexibility, pax, category, cabin height, wifi/bathroom, client name/email/phone/company, catering/luggage/special needs).
5. **Click** "Save Trip & Build Quote →" → navigates to `/quotes/new?trip_id=<id>` (trip is already saved by the API).

## Extracted data (AI output)

The intake agent returns and the UI displays:

| Section                  | Fields                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Route**                | Legs: `from_icao`, `to_icao`, `date`, `time` per leg. Trip type: `one_way` \| `round_trip` \| `multi_leg`. Flexibility (hours). |
| **Passengers**           | `pax_adults`, `pax_children`, `pax_pets` (with confidence).                                                                     |
| **Aircraft preferences** | `preferred_category`, `min_cabin_height_in`, `wifi_required`, `bathroom_required`.                                              |
| **Client (from text)**   | `client_name`, `client_email`, `client_phone`, `client_company` (returned as client_hint; not stored on trip).                  |
| **Notes**                | `catering_notes`, `luggage_notes`, `special_needs`.                                                                             |

- **Confidence:** Optional per-field scores (0–1) in `confidence`; the UI shows `ConfidenceChip` where available.
- **Sample:** The sample text includes LAX→JFK, round trip, 4 pax, midsize, wifi, luggage, catering, contact details.

## API: POST /api/intake

- **Body:** `{ raw_text: string, client_id?: string }`. Validated with `IntakeRequestSchema` (Zod).
- **Process:** Calls `runIntakeAgent(raw_text, client_id)` which:
  - Uses Claude Agent SDK with database tools: `search_clients`, `save_trip`, `get_trip`, and optionally **WebFetch** for airport code lookups.
  - Extracts trip + client_hint; saves trip with `ai_extracted: true` and `ai_confidence`.
- **Audit:** Writes to `audit_logs` with action `trip.ai_intake`, model `claude-sonnet-4-6`, and payload (raw_text_length, extracted, confidence).
- **Response:** `201` with `{ trip_id, extracted, confidence, client_hint }`. On validation or agent failure, returns `400` or `502` with `error`.

## Implementation notes

- Intake page is a Client Component; extraction and save are done via fetch to `/api/intake`.
- The trip is **created by the API** during extraction; "Save Trip & Build Quote" only navigates with the existing `trip_id`.
- If `client_id` is passed in the request, the agent uses it in `save_trip` (e.g. when intake is opened from a client context).

## Related

- [Quotes (New)](quotes.md#new-quote) — next step: select trip and aircraft, plan route, save quote
- [AI Agents](agents.md) — intake agent, tools, WebFetch
