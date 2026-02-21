-- Migration 003: Create route_plans table
-- Stores the output of the routing engine, linked to a quote.
-- Separate from quote_costs so routing can be re-run independently.

CREATE TABLE IF NOT EXISTS route_plans (
  id                    uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at            timestamptz   NOT NULL DEFAULT now(),
  quote_id              uuid          REFERENCES quotes(id) ON DELETE CASCADE,
  trip_id               uuid          REFERENCES trips(id) ON DELETE CASCADE,
  aircraft_id           uuid          REFERENCES aircraft(id),
  optimization_mode     text          NOT NULL DEFAULT 'balanced', -- 'cost' | 'time' | 'balanced'
  route_legs            jsonb         NOT NULL DEFAULT '[]',
  refuel_stops          jsonb         NOT NULL DEFAULT '[]',
  weather_summary       jsonb         NOT NULL DEFAULT '[]',
  notam_alerts          jsonb         NOT NULL DEFAULT '[]',
  alternatives          jsonb         NOT NULL DEFAULT '[]',
  cost_breakdown        jsonb,
  total_distance_nm     numeric(8,1),
  total_flight_time_hr  numeric(6,2),
  total_fuel_cost       numeric(10,2),
  risk_score            integer,                                   -- 0-100
  on_time_probability   numeric(4,3),                              -- 0.000-1.000
  computed_at           timestamptz   NOT NULL DEFAULT now(),
  weather_fetched_at    timestamptz,
  notam_fetched_at      timestamptz,
  is_stale              boolean       NOT NULL DEFAULT false        -- set true after 4hr by cron
);

CREATE INDEX IF NOT EXISTS route_plans_quote_id ON route_plans (quote_id);
CREATE INDEX IF NOT EXISTS route_plans_trip_id  ON route_plans (trip_id);
CREATE INDEX IF NOT EXISTS route_plans_computed ON route_plans (computed_at DESC);

ALTER TABLE route_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON route_plans FOR ALL USING (auth.role() = 'authenticated');
