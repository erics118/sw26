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

**Auto-generate (when `?trip_id=` is present):** Visiting `/quotes/new?trip_id=<id>` (e.g. from intake) automatically triggers the quote agent. The AI selects the best aircraft and route plan, creates the quote, and redirects to the quote detail page. The user sees a loading state ("Generating quote…") during generation. If it fails, the manual form is shown.

**Manual flow (no trip_id in URL):**

1. **Trip:** Choose one of the last 20 trips (by created_at). Display: route (legs as ICAO chain), pax, date.
2. **Aircraft:** Optional. Choose from fleet list (tail, category, range, pax, wifi). If omitted, AI selects the best.
3. **Margin:** Slider 5–40% (default 20%); applied on top of cost breakdown.
4. **Notes:** Optional text for the quote.
5. **Route planning (preview):** When trip + aircraft are selected, route plan auto-runs. Mode: **cost** | **balanced** | **time**. AI chooses the best mode when saving.
6. **Save:** "Save & Send Quote →" → `POST /api/quotes` with `trip_id`, optional `aircraft_id`, `margin_pct`, `notes`, `status: "sent"`. The quote agent computes route, pricing, and persists the quote + route plan.

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
