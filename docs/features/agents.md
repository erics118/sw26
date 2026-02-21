# AI Agents

The app uses the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) to run two agents: **intake** (trip extraction from raw text) and **quote** (build and save a quote from a trip). Both use shared **database tools** and a common **runAgent** runner.

---

## Runner: runAgent (lib/agents/index.ts)

- **runAgent&lt;T&gt;(options)** — Runs the Claude model with:
  - **permissionMode: "bypassPermissions"** (requires `allowDangerouslySkipPermissions: true` in SDK config).
  - **serverName** — e.g. "aviation_intake", "aviation_quote".
  - **dbTools** — from `createDatabaseTools(supabase)`.
  - **prompt** — system + user prompt.
  - **builtinTools** — e.g. `["WebFetch"]` for intake; `[]` for quote.
  - **maxTurns** — limit on agent steps.
- Parses final JSON from model output (position-based `{` / `}` extraction, not anchored regex) and returns typed result.

---

## Database tools (lib/agents/tools/database.ts)

**createDatabaseTools(supabase)** returns an array of MCP-style tools used by the agents:

| Tool                  | Purpose                                                                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **search_clients**    | Search clients by name, email, or phone (ilike, limit 10).                                                                                                                                                        |
| **save_trip**         | Insert trip with legs, trip_type, pax, preferences, optional client_id; accepts confidence and client_hint (name, email, phone, company) returned in result but not stored on trip.                               |
| **get_trip**          | Get full trip by trip_id.                                                                                                                                                                                         |
| **list_aircraft**     | List aircraft with optional filters: category, min_range_nm, wifi_required, bathroom_required, min_pax.                                                                                                           |
| **list_crew**         | List all crew.                                                                                                                                                                                                    |
| **calculate_pricing** | Call `calculatePricing()` from pricing engine with legs, aircraft_category, fuel_burn_gph, home_base_icao, margin_pct, catering_requested, is_international, fuel_price_override_usd. Returns full PricingResult. |
| **save_quote**        | Insert quote (trip_id, client_id, aircraft_id, margin_pct, currency, notes, status "pricing", version 1) and one quote_costs row; returns quote, costs, and line_items.                                           |

Agents only receive the tools they need (intake uses search_clients + save_trip + get_trip; quote uses get_trip + list_aircraft + calculate_pricing + save_quote).

---

## Intake agent (lib/agents/intake.agent.ts)

- **runIntakeAgent(rawText, clientId?)** — Extracts trip and optional client hint from raw text.
- **Prompt:** Instructs the model to: (1) extract trip details (legs, pax, requirements, preferences), (2) optionally call **search_clients** if contact info is found, (3) call **save_trip** with all fields and confidence, (4) use **WebFetch** for unclear airport codes (ICAO). Output must be a single JSON: trip_id, extracted, confidence, client_hint.
- **Built-in tools:** WebFetch enabled (for airport lookups). Database tools: search_clients, save_trip, get_trip.
- **Result:** `IntakeAgentResult`: trip_id, extracted (legs, trip_type, pax, preferences, client_name/email/phone/company), confidence (per-field), client_hint. Trip is already saved; client_hint is for UI or future client matching.

**API:** `POST /api/intake` — body `{ raw_text, client_id? }`; calls runIntakeAgent; writes audit log `trip.ai_intake`; returns 201 with result.

---

## Quote agent (lib/agents/quote.agent.ts)

- **runQuoteAgent(input)** — Builds a quote for a given trip. Input: trip_id, optional aircraft_id, client_id, margin_pct, currency, notes, fuel_price_override_usd.
- **Prompt:** Load trip (get_trip), list_aircraft (with filters from trip: range, wifi, bathroom, pax, category; or use pre-selected aircraft_id), calculate_pricing (with international/catering/fuel override as needed), save_quote with all cost fields and line_items. Output JSON: quote, costs, line_items.
- **Built-in tools:** None (builtinTools: []). Only database tools.
- **Result:** `QuoteAgentResult`: quote, costs, line_items.

**API:** Quote creation is triggered by `POST /api/quotes` with CreateQuoteSchema; handler runs runQuoteAgent(parsed.data), then writes audit log `quote.created` and returns 201 with { quote, costs, line_items }.

---

## Audit

- **Intake:** `auditAICall(...)` in `lib/ai/audit` — action `trip.ai_intake`, entity_type trips, entity_id trip_id, model claude-sonnet-4-6, payload (raw_text_length, extracted), confidence.
- **Quote:** Insert into `audit_logs`: action `quote.created`, entity_type quotes, entity_id quote.id, ai_generated true, ai_model claude-sonnet-4-6, payload (subtotal, margin_amount, tax, total).

---

## Implementation notes

- JSON extraction from agent output uses first `{` to matching `}` (position-based), not a strict regex.
- permissionMode "bypassPermissions" is required for tools; allowDangerouslySkipPermissions must be true in SDK config.
- Intake agent can receive optional client_id to link the new trip to an existing client in save_trip.

---

## Related

- [Intake](intake.md) — UI and API for trip extraction
- [Quotes](quotes.md) — quote creation flow and API
- [Pricing](pricing.md) — engine used by calculate_pricing tool
