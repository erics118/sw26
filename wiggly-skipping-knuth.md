# Flight Routing Module — Implementation Plan

## Context

The existing aviation charter platform (`sw26`) has a pricing engine, aircraft/airport data, and quote management. However, it has **no routing logic**: no range validation per leg, no fuel stop planning, no weather or NOTAM awareness, and the airport database is hardcoded in-memory. This module adds a first-class routing layer that determines the optimal flight path (including refueling stops), estimates cost/time trade-offs, and surfaces weather/NOTAM hazards — all integrated into the existing quote creation flow.

---

## What Already Exists (reuse / extend, don't replace)

| File                     | What it has                                                  | Plan action                                                             |
| ------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `lib/pricing/engine.ts`  | `CATEGORY_PERF`, `FBO_FEES`, `calculatePricing()`            | Add `fuelPriceOverrideUsd?` param to `PricingInput`; keep engine intact |
| `lib/pricing/geo.ts`     | ~100 airports with lat/lon, `distanceNm()`, `knownAirport()` | Keep working; routing module will use the new Supabase `airports` table |
| `lib/schemas/index.ts`   | All Zod schemas                                              | Append new routing schemas                                              |
| `lib/database.types.ts`  | Auto-gen Supabase types                                      | Append `Airport`, `RoutePlan` types + extend `Aircraft`                 |
| `supabase/schema.sql`    | Existing 7-table schema                                      | Append new table definitions                                            |
| `lib/supabase/server.ts` | Supabase server client                                       | Reuse as-is                                                             |
| `lib/ai/audit.ts`        | Audit log helpers                                            | Reuse for routing audit events                                          |

---

## Phase 1 — Database Migrations

### 1a. Extend `aircraft` table (`supabase/migrations/001_aircraft_performance.sql`)

```sql
ALTER TABLE aircraft
  ADD COLUMN IF NOT EXISTS cruise_speed_kts       integer,         -- NULL → category default
  ADD COLUMN IF NOT EXISTS max_fuel_capacity_gal   numeric(8,1),   -- NULL → category default
  ADD COLUMN IF NOT EXISTS min_runway_ft            integer,        -- required at destination
  ADD COLUMN IF NOT EXISTS etops_certified          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_payload_lbs          numeric(8,1),
  ADD COLUMN IF NOT EXISTS reserve_fuel_gal         numeric(6,1);  -- FAR 91 45-min reserve
```

All columns nullable — existing rows continue working; category-level defaults apply as fallback.

### 1b. New `airports` table (`supabase/migrations/002_airports_table.sql`)

Replaces the in-memory dictionaries in `lib/pricing/geo.ts` (but doesn't break them — the old code stays as a fallback during migration).

Key columns: `icao CHAR(4) PK`, `lat`, `lon`, `elevation_ft`, `longest_runway_ft`, `fuel_jet_a BOOL`, `fuel_price_usd_gal`, `fbo_fee_usd`, `operating_hours_utc JSONB`, `curfew_utc JSONB`, `customs_available`, `deicing_available`, `slot_required`, `country_code CHAR(2)`, `updated_at`.

Seed with all ~100 ICAOs from `lib/pricing/geo.ts` (coordinates) and `lib/pricing/engine.ts` `FBO_FEES` (fee data).

Indexes: `(lat, lon)` for bounding-box queries; `(fuel_jet_a) WHERE fuel_jet_a = true` for stop candidate filtering; `(longest_runway_ft)`.

### 1c. New `route_plans` table (`supabase/migrations/003_route_plans.sql`)

Links to `quotes(id)` and `trips(id)`. Stores the full routing result as JSONB columns:
`route_legs JSONB`, `refuel_stops JSONB`, `weather_summary JSONB`, `notam_alerts JSONB`, `alternatives JSONB`, `cost_breakdown JSONB`.

Scalar columns: `total_distance_nm`, `total_flight_time_hr`, `total_fuel_cost`, `risk_score INT`, `on_time_probability NUMERIC(4,3)`, `optimization_mode TEXT`, `is_stale BOOL DEFAULT false`, `weather_fetched_at`, `notam_fetched_at`.

RLS: same `"staff_all" FOR ALL USING (auth.role() = 'authenticated')` pattern as every other table.

---

## Phase 2 — `lib/routing/` Module

### File structure

```
lib/routing/
  types.ts          TypeScript interfaces (no logic)
  airport-db.ts     Supabase-backed airport queries + Haversine
  performance.ts    Aircraft performance helpers (pure functions)
  graph.ts          Dijkstra implementation (pure functions)
  optimizer.ts      findFuelStops() + optimizeRoute() — core routing
  weather.ts        aviationweather.gov METAR/TAF/winds fetcher
  notam.ts          FAA NOTAM API fetcher
  risk.ts           Risk score + on-time probability calculator
  index.ts          Public facade: computeRoutePlan()
```

### Key types (`types.ts`)

```typescript
type OptimizationMode = "cost" | "time" | "balanced";

interface RouteLeg {
  from_icao;
  to_icao;
  distance_nm;
  flight_time_hr;
  fuel_burn_gal;
  fuel_cost_usd;
  is_fuel_stop_leg;
  departure_utc;
  arrival_utc;
}

interface RefuelStop {
  icao;
  airport_name;
  added_distance_nm;
  fuel_price_usd_gal;
  fuel_uplift_gal;
  fuel_cost_usd;
  fbo_fee_usd;
  ground_time_min;
  customs;
  deicing;
  reason;
}

interface WeatherSummary {
  icao;
  metar_raw;
  taf_raw;
  ceiling_ft;
  visibility_sm;
  wind_dir_deg;
  wind_speed_kts;
  crosswind_kts;
  icing_risk: "none" | "light" | "moderate" | "severe";
  convective_risk: "none" | "low" | "moderate" | "high";
  go_nogo: "go" | "marginal" | "nogo";
  fetched_at;
}

interface NotamAlert {
  notam_id;
  icao;
  type: "runway_closure" | "fuel_outage" | "tfr" | "nav_aid" | "other";
  raw_text;
  effective_from;
  effective_to;
  severity: "info" | "caution" | "critical";
}

interface RoutePlanResult {
  route_legs: RouteLeg[];
  refuel_stops: RefuelStop[];
  total_distance_nm;
  total_flight_time_hr;
  total_fuel_cost;
  weather_summary: WeatherSummary[];
  notam_alerts: NotamAlert[];
  risk_score;
  on_time_probability;
  cost_breakdown;
  alternatives;
}
```

### `airport-db.ts`

- `getAirport(icao)` — single airport lookup from Supabase
- `getFuelStopCandidates(minRunwayFt, boundingBox)` — SQL bounding box pre-filter (`WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? AND fuel_jet_a = true AND longest_runway_ft >= ?`)
- `haversineNm(a, b)` — same formula as `lib/pricing/geo.ts:distanceNm` but uses `AirportRecord` objects
- `midpointLatLon(a, b)` — great-circle midpoint for search centering

### `performance.ts`

Pure functions, no I/O. Single source of truth for category defaults (instead of duplicating in `engine.ts`):

- `effectiveSpeedKts(aircraft)` — per-aircraft `cruise_speed_kts` ?? category default
- `effectiveFuelBurnGph(aircraft)` — per-aircraft `fuel_burn_gph` ?? category default
- `usableFuelGal(aircraft)` — per-aircraft `max_fuel_capacity_gal` ?? category default
- `reserveFuelGal(aircraft)` — per-aircraft `reserve_fuel_gal` ?? 45-min at cruise
- `effectiveRangeNm(aircraft)` — derived from fuel capacity and burn rate
- `fuelForLegGal(distNm, aircraft, windKts?)` — fuel needed (no reserve)
- `checkLegRange(distNm, aircraft)` → `{ can_fly_direct, fuel_required_gal, fuel_available_gal, deficit_gal, max_direct_nm }`

### `graph.ts` (Dijkstra)

Builds a small graph per-leg (~10–40 nodes from bounding box). Edge viability checks:

- `to.longest_runway_ft >= aircraft.min_runway_ft` (skip unsuitable airports)
- `to.fuel_jet_a == true` (for fuel stop edges)
- Arrival UTC not within `curfew_utc` window

Edge weight function:

- `'cost'` → `fuel_cost_usd + fbo_fee_usd`
- `'time'` → `flight_time_hr * 60`
- `'balanced'` → `(fuel_cost_usd + fbo_fee_usd) * 0.5 + flight_time_hr * 30`

Standard min-heap Dijkstra returns ordered ICAO path or `null` if no viable route.

### `optimizer.ts` — Refueling algorithm

`findFuelStops(from, to, aircraft, mode)`:

1. `checkLegRange(haversineNm(from, to), aircraft)` — if direct viable, return immediately
2. Compute midpoint; query `getFuelStopCandidates` within `±60%` of leg distance
3. Filter: stops reachable from origin AND destination reachable from stop
4. Score each valid candidate (lower = better):
   - **cost mode**: `fuelPrice × fuelNeeded + fboFee + addedNm × 8`
   - **time mode**: `addedNm / speedKts × 3600` (added seconds)
   - **balanced**: weighted average of both
5. Select lowest score. If none found, expand to `±80%` and retry. Fail with `RoutingError` if still empty.
6. Recurse on sub-legs if they still exceed range (max depth = 4)

The **midpoint weighting** is implicit in the scoring: detour distance (`addedNm`) is penalized, so a stop at exactly the midpoint (zero added distance) scores best on distance-related cost.

### `weather.ts`

Calls `https://aviationweather.gov/api/data` — no API key required (FAA public).

- `fetchMetars(icaos[])` — `GET /metar?ids=KJFK,EGLL&format=json&hours=2`
- `fetchTafs(icaos[])` — `GET /taf?ids=...&format=json`
- `fetchWindsAloft(lat, lon, altFt)` — `GET /windtemp?region=all&level=lo&fcst=06&format=json`

All calls wrapped in `fetchWithTimeout(url, 5000ms)` — returns `null` on timeout/error. Weather is **advisory only**, never blocks route generation. On failure, `go_nogo` defaults to `'marginal'` (not `'nogo'`).

### `notam.ts`

Three public sources combined, **no API key required for any**:

| Source             | Coverage                           | Endpoint                                                 |
| ------------------ | ---------------------------------- | -------------------------------------------------------- |
| NASA DIP NOTAM API | US NOTAMs (redistributes FAA SWIM) | `https://dip.amesaero.nasa.gov/`                         |
| Autorouter API     | European NOTAMs (Eurocontrol)      | `https://api.autorouter.aero/v1.0/notam?itemas=["EGLL"]` |
| FAA ADDS ArcGIS    | US TFRs (geospatial)               | `https://adds-faa.opendata.arcgis.com/`                  |

Strategy:

- `fetchUsNotams(icaos[], from, to)` — NASA DIP API; classify into `NotamAlert[]`
- `fetchEuropeanNotams(icaos[])` — Autorouter API for non-K prefix airports (ICAO region not starting with K)
- `fetchTfrs()` — FAA ADDS ArcGIS query for active TFRs; filter to route bounding box
- All three called in parallel; each returns `[]` on any error (same graceful-failure pattern as weather)
- `classifyNotam(raw)` — parses raw NOTAM text into `type: 'runway_closure'|'fuel_outage'|'tfr'|'nav_aid'|'other'` and `severity`
- Results merged and deduplicated by `notam_id`

### `risk.ts`

```
risk_score = 10 (base)
  + 30 per nogo weather (max 90 from weather)
  + 15 per marginal weather
  + 20 per critical NOTAM, +8 per caution NOTAM
  + 5 per refuel stop
  + 5 if international
  + 5 if total flight time > 8hr

on_time_probability = 1 - (risk_score / 100) * 0.4
```

### `index.ts` (public facade)

`computeRoutePlan(input: RoutingInput): Promise<RoutePlanResult>`:

1. Fetch `aircraft` from Supabase
2. Run `optimizeRoute()` for primary mode → `route_legs`, `refuel_stops`
3. Run `optimizeRoute()` for alternative mode (cost↔time) → `alternatives[0]`
4. Collect all unique ICAOs from result
5. `Promise.allSettled([fetchMetars(...), fetchTafs(...), fetchNotams(...)])` — parallel, all gracefully ignored on failure
6. `computeRiskScore({...})`
7. Return assembled `RoutePlanResult`

---

## Phase 3 — API Endpoints

### `POST /api/routing/plan` (`app/api/routing/plan/route.ts`)

**Request** (Zod-validated `RoutingPlanRequestSchema`):

```typescript
{ aircraft_id: uuid, legs: TripLeg[], optimization_mode: 'cost'|'time'|'balanced',
  quote_id?: uuid, trip_id?: uuid }
```

**Response** `200`/`201`:

```typescript
{ plan_id?: uuid, result: RoutePlanResult }
```

If `quote_id` provided: inserts into `route_plans` (returns `201` + `plan_id`). Otherwise dry-run (`200`).

Errors: `400` Zod failure, `404` unknown aircraft, `422` no viable route.

### `GET /api/routing/plan/[id]` — fetch persisted plan

### `GET /api/routing/airports` — airport lookup/search (for admin + UI)

Query params: `?icao=KJFK` (single lookup), `?has_fuel=true&min_runway=4000` (candidate query)

### `POST /api/routing/airports` + `PATCH /api/routing/airports/[icao]` — admin CRUD for airport data (fuel prices, hours, curfews)

---

## Phase 4 — Integration with Existing System

### Quote creation (`app/api/quotes/route.ts`)

After routing runs, pass actual per-airport fuel costs to the pricing engine:

```typescript
// Add to PricingInput in engine.ts:
fuelPriceOverrideUsd?: number  // uses this instead of hardcoded $7.50/gal

// In POST /api/quotes, after computeRoutePlan():
const pricing = calculatePricing({
  ...existingInputs,
  fuelPriceOverrideUsd: routeResult.cost_breakdown.avg_fuel_price_usd_gal
})
```

The routing result is stored separately in `route_plans`; `quote_costs` is unchanged for backward compatibility.

### Compliance checker (`lib/compliance/checker.ts`)

- Add optional `route_plan_id` to compliance check input
- When present: skip naive `range_nm` check, instead verify each `route_leg` individually using routing data
- Add new check: "All refuel stops have Jet-A fuel and adequate runway"

### Quote UI (`app/(app)/quotes/new/page.tsx` + `[id]/page.tsx`)

- "Plan Route" button → calls `POST /api/routing/plan` (dry-run) → shows results panel
- Results panel: refuel stops, weather go/nogo badges, NOTAM alerts, risk score, cost breakdown, alternative route option
- "Save Quote" → calls `POST /api/quotes` then `POST /api/routing/plan` with `quote_id` to persist
- Quote detail page: show existing `route_plans` row if present, with "Refresh" button if `is_stale = true`

---

## Phase 5 — Digital Trip Sheet (Low Priority)

`app/(app)/trip-sheet/[tripId]/page.tsx` — crew-facing view:

- Route map (static, using airport coordinates)
- Fuel stop details with FBO info and ground time
- Weather summary per airport with go/nogo indicators
- Active NOTAMs
- ETAs per leg
- "Send to Crew" button on quote detail → navigates here

---

## New Files Summary

```
supabase/migrations/
  001_aircraft_performance.sql
  002_airports_table.sql
  003_route_plans.sql

lib/routing/
  types.ts, airport-db.ts, performance.ts, graph.ts,
  optimizer.ts, weather.ts, notam.ts, risk.ts, index.ts

app/api/routing/
  plan/route.ts
  plan/[id]/route.ts
  airports/route.ts
  airports/[icao]/route.ts

app/(app)/trip-sheet/[tripId]/page.tsx   ← Phase 5 only
```

## Modified Files

| File                             | Change                                                                   |
| -------------------------------- | ------------------------------------------------------------------------ |
| `lib/pricing/engine.ts`          | Add `fuelPriceOverrideUsd?` to `PricingInput`                            |
| `lib/schemas/index.ts`           | Append `RoutingPlanRequestSchema`, `AirportUpsertSchema`                 |
| `lib/database.types.ts`          | Add `Airport`, `RoutePlan` types; extend `Aircraft` row with new columns |
| `supabase/schema.sql`            | Append the 3 new table definitions                                       |
| `lib/compliance/checker.ts`      | Accept optional `route_plan_id` to skip naive range check                |
| `app/(app)/quotes/new/page.tsx`  | Add "Plan Route" button + result panel                                   |
| `app/(app)/quotes/[id]/page.tsx` | Add route plan display section                                           |

---

## Environment Variables Required

```env
# No API keys required — all data sources are publicly accessible:
# - aviationweather.gov (METAR/TAF/SIGMETs) — no key
# - NASA DIP NOTAM API (US NOTAMs) — no key
# - Autorouter API (European NOTAMs) — no key
# - FAA ADDS ArcGIS (US TFRs) — no key
```

---

## Build Order (Phase Priorities)

1. **Phase 1 (Core)**: DB migrations → seed airports → `lib/routing/` (stub out weather/NOTAM) → `POST /api/routing/plan` — fully testable with KJFK→OMDB on a midsize (should find 1–2 Atlantic stops)
2. **Phase 2 (Weather)**: Wire `weather.ts` + `risk.ts` into `index.ts`
3. **Phase 3 (NOTAM + UI)**: Wire `notam.ts`, add "Plan Route" UI button, quote detail panel
4. **Phase 4 (Full Integration)**: Compliance checker update, pricing engine fuel price override
5. **Phase 5 (Trip Sheet)**: Crew-facing page (low priority)

---

## Verification

- **Unit test**: `checkLegRange(6800, midsize_aircraft)` → `can_fly_direct: false`
- **Unit test**: `findFuelStops('KJFK', 'OMDB', midsize, 'balanced')` → 1–2 stops near Shannon (EINN) or Reykjavik (BIRK)
- **Integration test**: `POST /api/routing/plan` with `{ aircraft_id, legs: [{from: 'KJFK', to: 'OMDB', ...}] }` → `200` with `refuel_stops.length >= 1`
- **Regression**: Existing `POST /api/quotes` still works and returns same `quote_costs` shape (routing is additive, not replacing)
- **Weather graceful failure**: Mock `aviationweather.gov` to return 503 → route plan still returns, `weather_summary` empty, `risk_score` elevated slightly
