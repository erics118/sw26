# Quotes

Quotes represent a priced charter offer for a trip: trip + optional client + aircraft + cost breakdown and optional route plan. The app supports listing (with status filter), creating a new quote (trip + aircraft + route planning), and viewing a quote detail with cost breakdown and route plan.

## Routes

| URL            | Description                                                                |
| -------------- | -------------------------------------------------------------------------- |
| `/quotes`      | List all quotes with optional status filter                                |
| `/quotes/new`  | New quote: select trip, aircraft, margin, optional route plan, save        |
| `/quotes/[id]` | Quote detail: status stepper, cost breakdown, route plan, client, aircraft |

All require authentication.

---

## Quotes list (`/quotes`)

### Features

- **Header:** "Quotes" and total count; **"New Quote"** button → `/quotes/new`.
- **Status filter:** Pills for All, `new`, `pricing`, `sent`, `negotiating`, `confirmed`, `lost`, `completed`. Filter applied via query: `?status=<status>`.
- **Table:** Rendered by `QuoteTable`; columns include ID, client, aircraft, trip route, status, costs (subtotal, margin, tax, total), dates (created, sent, confirmed), and other quote fields as defined in the component.
- **Empty state:** "No quotes found" and link to "Create the first quote →".

### Data

- Fetches `quotes` with `clients(name)`, `aircraft(tail_number, category)`, `trips(legs)`, `quote_costs(...)`.
- Ordered by `created_at` desc. Optional filter: `status` when provided and valid.

---

## New quote (`/quotes/new`)

### Flow

1. **Trip:** Choose one of the last 20 trips (by created_at). Display: route (legs as ICAO chain), pax, date. Optional pre-select via `?trip_id=`.
2. **Aircraft:** Choose from fleet list (tail, category, range, pax, wifi). Must select both trip and aircraft to enable "Plan Route" and "Save & Send Quote".
3. **Margin:** Slider 5–40% (default 20%); applied on top of cost breakdown.
4. **Notes:** Optional text for the quote.
5. **Route planning (optional):**
   - Mode: **cost** | **balanced** | **time**.
   - "Plan Route" → `POST /api/routing/plan` with `aircraft_id`, `legs`, `optimization_mode`.
   - Result: route legs, refuel stops, weather go/nogo per ICAO, NOTAM alerts (caution/critical), distance, flight time, risk score, on-time probability, avg fuel price. If a route plan is computed and quote is saved, the plan is persisted with `quote_id` and the **average fuel price** from the plan is sent as `fuel_price_override_usd` to the quote API so pricing uses it.
6. **Save:** "Save & Send Quote →" → `POST /api/quotes` with `trip_id`, `aircraft_id`, `margin_pct`, `notes`, `status: "sent"`, and optionally `fuel_price_override_usd` from the route plan. Then `POST /api/routing/plan` again with `quote_id` and `trip_id` to store the plan. Redirect to `/quotes/[id]`.

### API (create quote)

- **POST /api/quotes**
  Body: `CreateQuoteSchema` — at least `trip_id`; optional `aircraft_id`, `client_id`, `margin_pct`, `currency`, `notes`, `fuel_price_override_usd`, etc.
  The handler runs **quote agent** (`runQuoteAgent`), which uses tools: `get_trip`, `list_aircraft`, `calculate_pricing`, `save_quote`. Result: quote + costs; audit log `quote.created`. Response `201` with `{ quote, costs, line_items }`.

---

## Quote detail (`/quotes/[id]`)

### Features

- **Header:** Breadcrumb (Quotes / truncated ID), route (first → last ICAO), client name, version, currency; **status badge**.
- **Status stepper:** Visual pipeline (e.g. new → pricing → sent → negotiating → confirmed / lost / completed) via `StatusStepper`.
- **Cost breakdown:** Card with total (currency) and `CostBreakdown` component: fuel, FBO, repositioning (cost + hours), permit fees, crew overnight, catering, peak-day surcharge, subtotal, margin %, margin amount, tax, total.
- **Route plan (if present):** Optimization mode, stale indicator, summary (distance, flight time, risk score, on-time %), route legs (with fuel-stop markers), refuel stops (ICAO, fuel price, uplift, FBO, ground time, customs/deicing), weather (go/marginal/nogo per ICAO), NOTAMs (non-info). Link "Re-plan →" to `/quotes/new?trip_id=...` when stale.
- **Legs:** Trip legs with from_icao → to_icao and date/time.
- **Sidebar:** Client (name, email, phone, link to profile), Aircraft (tail, category, range), Quote details (margin, version, broker, created), Notes.

### Data

- Quote with `clients`, `aircraft`, `trips`, `quote_costs`.
- Latest `route_plans` row for this `quote_id` (by `created_at` desc, limit 1).

### Quote statuses

Used across list, detail, and filters: `new`, `pricing`, `sent`, `negotiating`, `confirmed`, `lost`, `completed`.

---

## Quote versions

- **API:** `quotes/[id]/versions` — supports versioning of quotes (see [API reference](../api/README.md)).
- **Schema:** `quotes.version` (integer, default 1); cost and operational fields (e.g. scheduled/actual times, delay reason) support lifecycle from quote to post-flight.

## Related

- [Routing](routing.md) — route plan computation (fuel stops, weather, NOTAMs, risk)
- [Pricing engine](pricing.md) — how costs are calculated
- [AI Agents](agents.md) — quote agent and tools
