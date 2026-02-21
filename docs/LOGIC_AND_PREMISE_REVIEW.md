# Logic and Premise Review

This document summarizes how the repo aligns with the intended product: **a single charter company** that stores its data, manages flight-related operations, and uses **AI-enhanced suggestions for plane selection**.

---

## 1. Single charter company (single-operator)

- **Data model:** All core tables (clients, aircraft, crew, trips, quotes, quote_costs, route_plans, aircraft_maintenance, fleet_forecast_overrides, audit_logs) are **global** — no `operator_id` or tenant column. The app assumes one company; RLS is “authenticated users can do everything” and does not scope by operator.
- **Removed concepts:** Operators table and `operator_id` FKs were removed (migration 004). Documentation and agent tools no longer reference `list_operators` or operator-scoped routes.
- **Wording:** Docs and UI describe “single operator” where relevant. The `calculate_pricing` tool describes margin as “Margin % on cost breakdown” (not “Broker margin %”) to match a single-operator charter company.

**Verdict:** Data and auth are consistent with a single charter company.

---

## 2. Storing data for that company

- **Clients:** CRM (name, company, email, phone, nationality, notes, risk_flag, vip).
- **Aircraft:** Fleet (tail, category, range, pax, performance, amenities, home_base_icao, status, daily_available_hours, etc.).
- **Crew:** Name, role, ratings, duty hours, availability.
- **Trips:** Charter requests (legs, pax, preferences, optional client_id, AI-extracted fields).
- **Quotes & quote_costs:** Offers and full cost breakdowns (fuel, FBO, repositioning, permits, catering, margin, tax, total).
- **Route plans:** Saved routing (legs, refuel stops, weather, NOTAMs, risk, cost breakdown) linked to quote/trip/aircraft.
- **Fleet forecasting:** Capacity, demand, utilization, recommendations, overrides, maintenance windows; all feed from the same aircraft/quotes/trips data.

**Verdict:** All data needed to run a single charter company is stored in one place, with clear relationships (trips → quotes → quote_costs, route_plans; aircraft_maintenance; fleet_forecast_overrides).

---

## 3. Managing “flight stuff”

- **Trip intake:** Raw text → AI extracts trip (legs, pax, requirements) and optionally matches client; trip is saved.
- **Quotes:** Create quote from trip + aircraft (manual pick on New Quote page, or API with optional pre-selected aircraft). Quote agent can also **select** aircraft from trip requirements (range, wifi, bathroom, pax, category).
- **Routing:** Plan route for a trip + aircraft (cost/time/balanced), refuel stops, weather, NOTAMs, risk; can persist plan to quote/trip.
- **Fleet forecasting:** Capacity vs demand, underutilization, idle-aircraft and reposition/maintenance recommendations; post-flight learning (accuracy, delay reasons).
- **Dashboard:** KPIs (open quotes, confirmed this week, trips departing today, sent awaiting), live ops, recent quotes.

**Verdict:** Flight management is end-to-end: intake → trip → quote (with optional route plan) → status lifecycle; fleet forecasting and routing support operations and planning.

---

## 4. AI-enhanced plane selection

- **Where it happens:**
  - **Quote agent** (`runQuoteAgent`): Loads trip (`get_trip`), then **lists aircraft** with filters from the trip (category, min_range_nm, wifi_required, bathroom_required, min_pax). The model is instructed to “Select the best matching option” when no aircraft is pre-selected. So **AI chooses among eligible aircraft** for that trip.
  - **list_aircraft** (agent tool): Now filters by **status = 'active'** so only available aircraft are suggested. The New Quote page also loads only **active** aircraft for manual selection.
- **Intake agent:** Does not select planes; it extracts trip and client hint so that a quote (and thus plane selection) can be created later.
- **Fleet forecasting:** Surfaces underutilization, idle-aircraft opportunities, reposition and maintenance recommendations. This informs **ops and planning** (which planes to use where, when to maintain). It is not wired into the quote UI as a direct “suggest plane” feed; the quote agent’s plane selection is trip-requirement–based. Optionally, fleet recommendations could later be passed into the quote flow (e.g. “prefer aircraft that are underutilized”) as an enhancement.

**Verdict:** AI plane selection is implemented in the quote agent via trip-based filters and “best matching” instruction; only active aircraft are considered. Fleet forecasting provides complementary, ops-focused suggestions.

---

## 5. Fixes applied during this review

- **list_aircraft (agent tool):** Filter by `status = 'active'` so AI and any caller only see available aircraft.
- **New Quote page:** Aircraft list restricted to `status = 'active'`.
- **calculate_pricing tool:** Description changed from “Broker margin %” to “Margin % on cost breakdown” for single-operator wording.
- **Quote creation with status:** When the client sends `status: "sent"` (e.g. “Save & Send Quote”), the API now updates the created quote to that status so the UI and backend stay in sync.

---

## 6. Optional follow-ups

- **Fleet forecasting ↔ quote flow:** Consider using utilization or recommendations (e.g. “idle aircraft”) when suggesting aircraft for a new quote (e.g. link from Fleet Forecast to New Quote with a suggested aircraft or category).
- **Quote status in save_quote:** The agent’s `save_quote` still inserts with `status: "pricing"`; the API then applies the client-requested status if provided. This keeps the tool simple and centralizes status override in the API.
- **Dashboard “Current Trips”:** Uses `requested_departure_window_start` for “departing today”; ensure this column is populated by intake or UI so the count is meaningful.

---

## Related

- [Database and schema](features/database-and-schema.md)
- [AI agents](features/agents.md)
- [Fleet forecasting](features/fleet-forecasting.md)
- [Quotes](features/quotes.md)
