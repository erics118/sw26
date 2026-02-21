# API Reference

All API routes live under `/api/`. Authenticated routes use the Supabase server client; some routes require a valid session (e.g. routing plan). Request/response bodies are JSON unless noted.

---

## Authentication

- **Session:** Supabase auth cookies. Use `createClient()` from `@/lib/supabase/server` in API routes to get the server client; call `getUser()` where auth is required.
- **Routing plan** (`POST /api/routing/plan`) explicitly checks for user and returns 401 if missing.

---

## Clients

| Method    | Path              | Description                                                                                                                                           |
| --------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET       | /api/clients      | List all clients. Order: created_at desc.                                                                                                             |
| POST      | /api/clients      | Create client. Body: CreateClientSchema (name required; company, email, phone, nationality, notes, risk_flag, vip optional). Returns 201 with client. |
| GET       | /api/clients/[id] | Get client by id. 404 if not found.                                                                                                                   |
| PATCH/PUT | /api/clients/[id] | Update client (if implemented).                                                                                                                       |

---

## Aircraft

| Method    | Path               | Description                                                                                                                                                                                                |
| --------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET       | /api/aircraft      | List all aircraft. Order: created_at desc.                                                                                                                                                                 |
| POST      | /api/aircraft      | Create aircraft. Body: CreateAircraftSchema (tail_number, category, range_nm, pax_capacity required; cabin_height_in, fuel_burn_gph, has_wifi, has_bathroom, home_base_icao, notes optional). Returns 201. |
| GET       | /api/aircraft/[id] | Get aircraft by id.                                                                                                                                                                                        |
| PATCH/PUT | /api/aircraft/[id] | Update aircraft (if implemented).                                                                                                                                                                          |

---

## Crew

| Method    | Path           | Description                                                                                                                    |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| GET       | /api/crew      | List all crew.                                                                                                                 |
| POST      | /api/crew      | Create crew. Body: CreateCrewSchema (name, role required; ratings, duty_hours_this_week, last_duty_end optional). Returns 201. |
| GET       | /api/crew/[id] | Get crew by id.                                                                                                                |
| PATCH/PUT | /api/crew/[id] | Update crew (if implemented).                                                                                                  |

---

## Intake (AI trip extraction)

| Method | Path        | Description                                                                                                                                                                                                                 |
| ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | /api/intake | Extract trip from raw text. Body: `{ raw_text: string, client_id?: string }`. Runs intake agent; saves trip; writes audit. Returns 201: `{ trip_id, extracted, confidence, client_hint }`. 400 validation; 502 agent error. |

---

## Quotes

| Method    | Path                      | Description                                                                                                                                                                                                                                                                         |
| --------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET       | /api/quotes               | List quotes. Query: status, client*id, date_from, date_to. Select: *, trips(_), clients(_), aircraft(\_), quote_costs(\*). Order: created_at desc.                                                                                                                                  |
| POST      | /api/quotes               | Create quote. Body: CreateQuoteSchema (trip_id required; aircraft_id, client_id, margin_pct, currency, notes, fuel_price_override_usd, status optional). Runs quote agent; inserts quote + quote_costs; audit log. Returns 201: `{ quote, costs, line_items }`. 502 on agent error. |
| GET       | /api/quotes/[id]          | Get quote by id with relations (clients, aircraft, trips, quote_costs).                                                                                                                                                                                                             |
| PATCH/PUT | /api/quotes/[id]          | Update quote (if implemented).                                                                                                                                                                                                                                                      |
| GET/POST  | /api/quotes/[id]/versions | Quote versions (if implemented).                                                                                                                                                                                                                                                    |

---

## Routing

| Method | Path                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | /api/routing/plan            | Compute route plan. **Auth required.** Body: RoutingPlanRequestSchema — aircraft_id, legs (array of { from_icao, to_icao, date, time }), optimization_mode (cost \| time \| balanced); optional quote_id, trip_id to persist. Returns 200/201: `{ plan_id?, result }` (result: route_legs, refuel_stops, totals, weather_summary, notam_alerts, risk_score, on_time_probability, cost_breakdown, alternatives). 400 validation; 401 unauthorized; 404 aircraft; 422 unknown airport / no route; 500 server error. |
| GET    | /api/routing/plan/[id]       | Get saved route plan by id (if implemented).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| GET    | /api/routing/airports        | List or search airports (if implemented).                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| GET    | /api/routing/airports/[icao] | Get airport by ICAO (if implemented).                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## Fleet forecasting

| Method   | Path                                   | Description                                                                                                                                      |
| -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------- |
| GET      | /api/fleet-forecasting/forecast        | Forecast summary. Query: days (7–90), category (optional). Returns ForecastSummary: capacity, demand, planes_needed, horizon_days, generated_at. |
| GET      | /api/fleet-forecasting/utilization     | Utilization summary. Query: days (e.g. 30). Returns UtilizationSummary: by_category, aircraft.                                                   |
| GET      | /api/fleet-forecasting/recommendations | Recommendations. Query: horizon (e.g. 7). Returns RecommendationSummary: reposition, idle-aircraft recommendations, maintenance_windows.         |
| POST     | /api/fleet-forecasting/insights        | AI insights. Body: `{ tab: "forecast"                                                                                                            | "utilization" | "learning", days?: number }`. Returns ForecastInsight and optionally accuracy/delay_reasons for learning tab. |
| GET/POST | /api/fleet-forecasting/overrides       | Forecast overrides (list/create/update) — fleet_forecast_overrides table.                                                                        |
| GET/POST | /api/fleet-forecasting/maintenance     | Aircraft maintenance (if implemented).                                                                                                           |

---

## Validation

- Request bodies are validated with **Zod** schemas from `lib/schemas/index.ts` (e.g. CreateClientSchema, CreateAircraftSchema, IntakeRequestSchema, CreateQuoteSchema, RoutingPlanRequestSchema). On failure, APIs return 400 with error message or issues array.

---

## Related docs

- [Features index](../README.md) — links to feature docs (routing, pricing, agents, etc.)
