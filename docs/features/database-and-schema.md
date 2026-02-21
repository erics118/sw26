# Database and Schema

Supabase (PostgreSQL) stores all application data. Row Level Security (RLS) is enabled on all tables with a single MVP policy: **authenticated** users can do everything.

---

## Core tables

| Table           | Purpose                                                                                                                                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **clients**     | CRM: name, company, email, phone, nationality, notes, risk_flag, vip                                                                                                                                                                                                                                           |
| **aircraft**    | Fleet: tail_number, category, range_nm, pax_capacity, performance (cruise_speed_kts, fuel_burn_gph, max_fuel_capacity_gal, min_runway_ft, reserve_fuel_gal), amenities (has_wifi, has_bathroom), home_base_icao, status, daily_available_hours, etc.                                                           |
| **crew**        | Crew: name, role (captain, first_officer, flight_attendant), ratings, duty_hours_this_week, last_duty_end, available_hours_per_day                                                                                                                                                                             |
| **trips**       | Charter requests: client*id, raw_input, legs (jsonb), trip_type, pax*\_, flexibility\*hours, special_needs, catering_notes, luggage_notes, preferred_category, min_cabin_height_in, wifi_required, bathroom_required, ai_extracted, ai_confidence, request_source, requested**\*window**, estimated\_\_\_hours |
| **quotes**      | Offers: trip*id, client_id, aircraft_id, status, version, margin_pct, currency, broker*_, notes, sent*at, confirmed_at, quote_valid_until, chosen_aircraft_category, estimated_total_hours, won_lost_reason, scheduled*\_\_time, actual_\*\_time, delay_reason_code                                            |
| **quote_costs** | One row per quote: fuel_cost, fbo_fees, repositioning_cost/hours, permit_fees, crew_overnight_cost, catering_cost, peak_day_surcharge, subtotal, margin_amount, tax, total, per_leg_breakdown (jsonb)                                                                                                          |
| **audit_logs**  | Immutable log: user_id, action, entity_type, entity_id, payload, ai_generated, ai_model, human_verified                                                                                                                                                                                                        |

---

## Supporting tables

| Table                        | Purpose                                                                                                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **airports**                 | ICAO, IATA, name, city, country_code, lat/lon, elevation_ft, longest_runway_ft, fuel_jet_a, fuel_price_usd_gal, fbo_fee_usd, operating_hours_utc, curfew_utc, customs_available, deicing_available, slot_required, notes                                                 |
| **aircraft_maintenance**     | aircraft_id, start_time, end_time, maintenance_type (scheduled, unscheduled, inspection, overhaul), notes                                                                                                                                                                |
| **fleet_forecast_overrides** | date, aircraft_category (or 'all'), peak_multiplier, reason — overrides demand multipliers for forecasting                                                                                                                                                               |
| **route_plans**              | quote*id, trip_id, aircraft_id, optimization_mode, route_legs, refuel_stops, weather_summary, notam_alerts, alternatives, cost_breakdown, total*\*\_nm/hr, total_fuel_cost, risk_score, on_time_probability, computed_at, weather_fetched_at, notam_fetched_at, is_stale |

---

## Key relationships

- **trips** → clients (client_id)
- **quotes** → trips (trip_id), clients (client_id), aircraft (aircraft_id)
- **quote_costs** → quotes (quote_id)
- **route_plans** → quotes (quote_id), trips (trip_id), aircraft (aircraft_id)
- **aircraft_maintenance** → aircraft (aircraft_id)

---

## Validation (Zod)

Application-side validation uses schemas in `lib/schemas/index.ts`: ClientSchema, AircraftSchema, CrewSchema, TripLegSchema/TripSchema, CreateQuoteSchema, IntakeRequestSchema, RoutingPlanRequestSchema, etc. Types are exported for use in API routes and agents. See also `lib/database.types.ts` for generated Supabase types.

---

## Database reset and seed

- **Reset script:** `npm run db:reset` runs `scripts/reset-db.ts`, which executes `supabase/reset.sql` (schema + RLS) then `supabase/seed_comprehensive_testing.sql` (test data).
- **Requires:** `DATABASE_URL` set to the Supabase **direct** Postgres connection (port 5432, not 6543), e.g. `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`. Can be set in `.env.local` or inline when running the command.
