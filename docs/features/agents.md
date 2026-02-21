# AI Agents

The app uses **intake** (extraction only, single LLM call) and **quote** (agent with tools). Intake uses the Messages API directly; quote uses the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) with database tools.

---

## Runner: runAgent (lib/agents/index.ts)

- **runAgent&lt;T&gt;(options)** — Runs the Claude model with:
  - **permissionMode: "bypassPermissions"** (requires `allowDangerouslySkipPermissions: true` in SDK config).
  - **serverName** — e.g. "aviation_intake", "aviation_quote".
  - **dbTools** — from `createDatabaseTools(supabase)`.
  - **prompt** — system + user prompt.
  - **model** — optional override (default: claude-sonnet-4-6). Intake uses claude-haiku-4-5-20251001 for speed.
  - **builtinTools** — e.g. `["WebFetch"]` for intake; `[]` for quote.
  - **maxTurns** — limit on agent steps.
- Parses final JSON from model output (position-based `{` / `}` extraction, not anchored regex) and returns typed result.

---

## Database tools (lib/agents/tools/database.ts)

**createDatabaseTools(supabase)** returns an array of MCP-style tools used by the agents:

| Tool                   | Purpose                                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **search_clients**     | Search clients by name, email, or phone (ilike, limit 10).                                                                                                                                                        |
| **save_trip**          | Insert trip with legs, trip_type, pax, preferences, optional client_id; accepts confidence and client_hint (name, email, phone, company) returned in result but not stored on trip.                               |
| **get_trip**           | Get full trip by trip_id.                                                                                                                                                                                         |
| **lookup_airport**     | Look up ICAO by city/name (fast DB). Use for ambiguous airports instead of WebFetch.                                                                                                                              |
| **list_aircraft**      | List aircraft with optional filters: category, min_range_nm, wifi_required, bathroom_required, min_pax.                                                                                                           |
| **list_crew**          | List all crew.                                                                                                                                                                                                    |
| **compute_route_plan** | Compute full route plan (fuel stops, weather, NOTAMs, risk, cost breakdown) for aircraft + legs. Returns avg_fuel_price_usd_gal for pricing.                                                                      |
| **save_route_plan**    | Persist route plan to route_plans with quote_id. Call after save_quote.                                                                                                                                           |
| **calculate_pricing**  | Call `calculatePricing()` from pricing engine with legs, aircraft_category, fuel_burn_gph, home_base_icao, margin_pct, catering_requested, is_international, fuel_price_override_usd. Returns full PricingResult. |
| **save_quote**         | Insert quote (trip_id, client_id, aircraft_id, margin_pct, currency, notes, status "pricing", version 1) and one quote_costs row; returns quote, costs, and line_items.                                           |

The quote agent uses get_trip, list_aircraft, compute_route_plan, calculate_pricing, save_quote, save_route_plan. Intake does not use tools — it uses extraction + server-side logic.

---

## Intake (lib/ai/intake.ts + lib/agents/intake.agent.ts)

- **runIntakeAgent(rawText, clientId?)** — Uses AI for **extraction only** (single LLM call). Server handles lookup and save.
- **Flow:** (1) `extractTripFromText()` — one Messages API call, returns structured JSON. (2) Server resolves airport codes via DB lookup. (3) Server searches clients if contact found. (4) Server inserts trip.
- **No agent loop** — extraction is a single Haiku call; no tools, no multiple turns.
- **Result:** `IntakeAgentResult`: trip_id, extracted, confidence, client_hint.

**API:** `POST /api/intake` — body `{ raw_text, client_id? }`; calls runIntakeAgent; writes audit log `trip.ai_intake`; returns 201 with result.

---

## Quote agent (lib/agents/quote.agent.ts)

- **runQuoteAgent(input)** — Builds a quote for a given trip. Input: trip_id, optional aircraft_id, client_id, margin_pct, currency, notes, fuel_price_override_usd.
- **Prompt:** Automatically selects the best aircraft (when not pre-selected) and the best route plan option (cost/balanced/time) with explanations. Load trip (get_trip), list_aircraft, compare eligible aircraft via compute_route_plan (balanced), pick best; then compare cost/balanced/time route plans for chosen aircraft, pick best; calculate_pricing (fuel_price_override from chosen route), save_quote, save_route_plan. Output JSON: quote, costs, line_items, selection_reasoning (aircraft_id, aircraft_explanation, optimization_mode, route_explanation).
- **Built-in tools:** None (builtinTools: []). The quote agent uses **only database tools** (get_trip, list_aircraft, compute_route_plan, calculate_pricing, save_quote, save_route_plan); it does not use WebFetch or other built-in tools.
- **Result:** `QuoteAgentResult`: quote, costs, line_items, selection_reasoning?.

**API:** Quote creation is triggered by `POST /api/quotes` with CreateQuoteSchema; handler runs runQuoteAgent(parsed.data), then writes audit log `quote.created` (including aircraft_explanation, route_explanation, optimization_mode in payload) and returns 201 with { quote, costs, line_items, selection_reasoning }.

---

## Audit

- **auditAICall** (`lib/ai/audit.ts`) — Writes each AI call to `audit_logs` as an immutable record. Parameters: `action`, `entityType?`, `entityId?`, `model`, `payload`, `confidence?`, `userId?`. Inserts with `ai_generated: true`, `human_verified: false`; confidence is merged into payload as `_confidence` when provided.
- **Intake:** After successful extraction, the intake API calls `auditAICall` with action `trip.ai_intake`, entity_type `trips`, entity_id trip_id, model `claude-haiku-4-5-20251001`, payload (raw_text_length, extracted), and confidence.
- **Quote:** Quote creation does not use `auditAICall`; the API route inserts directly into `audit_logs`: action `quote.created`, entity_type `quotes`, entity_id quote.id, ai_generated true, ai_model claude-sonnet-4-6, payload (subtotal, margin_amount, tax, total).

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
