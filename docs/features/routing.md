# Flight Routing

The routing module computes a **full route plan** for a given aircraft and trip legs: optimized route (including fuel stops), weather summaries, NOTAM alerts, risk score, and on-time probability. It is used when creating or viewing a quote.

## Entry point

- **`computeRoutePlan(input: RoutingInput): Promise<RoutePlanResult>`** in `lib/routing/index.ts`.
- **API:** `POST /api/routing/plan` — accepts `aircraft_id`, `legs`, `optimization_mode`; optionally `quote_id` and `trip_id` to persist the plan.

---

## Input

- **aircraft_id** — UUID; aircraft performance is loaded from DB (category, fuel_burn_gph, range_nm, cruise_speed_kts, max_fuel_capacity_gal, min_runway_ft, reserve_fuel_gal).
- **legs** — Array of `{ from_icao, to_icao, date, time }` (trip legs).
- **optimization_mode** — `cost` | `time` | `balanced` (affects fuel-stop selection and route choices).

---

## Pipeline (steps)

1. **Fetch aircraft** — Load performance from `aircraft`; throw `RoutingError` with `AIRCRAFT_NOT_FOUND` if missing.
2. **Optimize route** — `optimizeRoute(legs, aircraft, optimization_mode)` in `lib/routing/optimizer.ts`:
   - Uses **airport DB** (`lib/routing/airport-db`) to resolve ICAOs, get fuel price/FBO/runway/customs/deicing.
   - **Range check** per leg (aircraft range vs leg distance; reserve fuel).
   - **Fuel stops:** When a leg exceeds range, inject refuel stops: score candidates (distance, fuel price, FBO, ground time), pick best; recurse up to max depth. Build route legs (including "fuel stop legs").
   - **Graph/dijkstra** (`lib/routing/graph`) for multi-leg / alternate path logic if used.
   - **Performance** (`lib/routing/performance`): fuel for leg, flight time, effective fuel burn, runway checks.
   - Output: `route_legs`, `refuel_stops`, `total_distance_nm`, `total_flight_time_hr`, `total_fuel_cost_usd`, `cost_breakdown`, `alternatives`.
3. **Collect ICAOs** — All unique from/to in the resulting route legs (including fuel-stop airports).
4. **Weather** — `fetchWeatherForIcaos(icaos, aircraft)` in `lib/routing/weather`. Returns `WeatherSummary[]`: ceiling, visibility, wind, icing/convective risk, **go_nogo** (go | marginal | nogo). Fails gracefully (empty array on error).
5. **NOTAMs** — `fetchNotamsForRoute(icaos, effectiveFrom, effectiveTo)` in `lib/routing/notam`. Returns `NotamAlert[]` (notam_id, icao, type, severity, raw_text). Fails gracefully.
6. **Risk** — `computeRiskScore(...)` in `lib/routing/risk`: combines weather, NOTAMs, refuel stops, flight time, international flag → **risk_score** (0–100) and **on_time_probability** (0–1).
7. **Alternatives** — Same risk/on-time attached to precomputed alternative routes.

---

## Output (RoutePlanResult)

- **route_legs** — Each: from_icao, to_icao, distance_nm, flight_time_hr, fuel_burn_gal, fuel_cost_usd, is_fuel_stop_leg, departure_utc, arrival_utc.
- **refuel_stops** — Each: icao, airport_name, added_distance_nm, fuel_price_usd_gal, fuel_uplift_gal, fuel_cost_usd, fbo_fee_usd, ground_time_min, customs, deicing, reason.
- **total_distance_nm**, **total_flight_time_hr**, **total_fuel_cost_usd**.
- **weather_summary** — Per-ICAO go/nogo and conditions.
- **notam_alerts** — Filtered/typed NOTAMs with severity.
- **risk_score**, **on_time_probability**.
- **cost_breakdown** — Routing-specific (fuel, FBO, refuel detour, avg fuel price, total routing cost).
- **alternatives** — Optional alternate routes with same risk/on-time.

---

## Persistence

- If `quote_id` (and optionally `trip_id`) is sent in `POST /api/routing/plan`, the result is inserted into **route_plans** (quote_id, trip_id, aircraft_id, optimization_mode, route_legs, refuel_stops, weather_summary, notam_alerts, alternatives, cost_breakdown, totals, risk_score, on_time_probability, weather_fetched_at, notam_fetched_at). Used on quote detail to show saved plan and "stale" when appropriate.

---

## Errors

- **AIRCRAFT_NOT_FOUND** — 404.
- **UNKNOWN_AIRPORT** — 422 (invalid ICAO).
- **NO_ROUTE** — 422 (e.g. no valid path).
- Other → 500.

---

## Related

- [Quotes (New quote)](quotes.md#new-quote) — calls route plan and optionally saves with quote
- [Pricing](pricing.md) — quote pricing can use avg fuel price from route plan as override
- [Aircraft](aircraft.md) — performance fields used by routing
