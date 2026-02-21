# Aircraft (Fleet)

Aircraft are the operator’s fleet: each record has identification, category, performance, capacity, amenities, and operational fields. The app provides a single fleet list page with a grid of aircraft cards.

## Route

- **URL:** `/aircraft`
- **Access:** Authenticated only.

---

## Fleet page (`/aircraft`)

### Features

- **Header:** "Fleet" and total aircraft count.
- **Grid:** `AircraftGrid` displays aircraft sorted by **category order**: turboprop → light → midsize → super-mid → heavy → ultra-long, then by tail number within category.
- **Per-aircraft card:** Shows tail number, category, range (nm), pax capacity, cabin height, wifi/bathroom, home base (ICAO), status, daily available hours, fuel burn, cruise speed, max fuel, min runway, ETOPS, max payload, reserve fuel, and notes as exposed by the grid component.
- **Empty state:** "No aircraft in fleet." when there are no aircraft.

### Data

- All aircraft with full operational fields: `id`, `tail_number`, `category`, `range_nm`, `pax_capacity`, `cabin_height_in`, `has_wifi`, `has_bathroom`, `home_base_icao`, `status`, `daily_available_hours`, `fuel_burn_gph`, `cruise_speed_kts`, `max_fuel_capacity_gal`, `min_runway_ft`, `etops_certified`, `max_payload_lbs`, `reserve_fuel_gal`, `notes`. Ordered by `tail_number`.

---

## Aircraft categories

Used in schema, pricing, and routing:

- `turboprop`
- `light`
- `midsize`
- `super-mid`
- `heavy`
- `ultra-long`

---

## Database schema (aircraft)

| Field                 | Type         | Notes                                                  |
| --------------------- | ------------ | ------------------------------------------------------ |
| id                    | uuid         | PK                                                     |
| created_at            | timestamptz  |                                                        |
| tail_number           | text         | Required                                               |
| category              | text         | One of categories above                                |
| range_nm              | integer      | Required                                               |
| cabin_height_in       | numeric(4,1) | Optional                                               |
| pax_capacity          | integer      | Required                                               |
| fuel_burn_gph         | numeric(6,1) | Optional; pricing/routing use category default if null |
| has_wifi              | boolean      | Default false                                          |
| has_bathroom          | boolean      | Default false                                          |
| home_base_icao        | text         | Optional; used for repositioning cost                  |
| notes                 | text         | Optional                                               |
| status                | text         | 'active' \| 'unavailable', default 'active'            |
| daily_available_hours | numeric(4,1) | Default 8 (realistic charter ops)                      |
| cruise_speed_kts      | integer      | Optional; category default if null                     |
| max_fuel_capacity_gal | numeric(8,1) | Optional                                               |
| min_runway_ft         | integer      | Optional                                               |
| etops_certified       | boolean      | Default false                                          |
| max_payload_lbs       | numeric(8,1) | Optional                                               |
| reserve_fuel_gal      | numeric(6,1) | Optional; can be computed                              |

---

## API: Aircraft

- **GET /api/aircraft** — List all aircraft, ordered by `created_at` desc. Returns array of aircraft rows.
- **POST /api/aircraft** — Create aircraft. Body: `CreateAircraftSchema` (Zod). Returns `201` with created row.
- **GET /api/aircraft/[id]** — Get one aircraft by id.
- **PATCH/PUT /api/aircraft/[id]** — Update aircraft (if implemented).

---

## Usage elsewhere

- **New quote:** User selects an aircraft for the quote; routing and pricing use its category, fuel burn, home base, etc.
- **Routing:** `computeRoutePlan` loads aircraft performance (category, fuel_burn_gph, range_nm, cruise_speed_kts, max_fuel_capacity_gal, min_runway_ft, reserve_fuel_gal) for optimization and fuel stops.
- **Pricing:** Engine uses aircraft category, fuel burn, home base for cost breakdown.
- **Fleet forecasting:** Capacity and utilization are computed per aircraft/category using status and available hours.

## Related

- [Quotes](quotes.md) — assign aircraft to a quote
- [Routing](routing.md) — aircraft performance for route planning
- [Pricing](pricing.md) — category and fuel for cost calculation
- [Fleet Forecasting](fleet-forecasting.md) — capacity and utilization by aircraft/category
