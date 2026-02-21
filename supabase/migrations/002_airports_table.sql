-- Migration 002: Create airports table
-- Replaces the in-memory airport dictionaries in lib/pricing/geo.ts and lib/pricing/engine.ts
-- The old hardcoded data is seeded below; the old code stays as a fallback during migration.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS airports (
  icao                  char(4)       PRIMARY KEY,
  iata                  char(3),
  name                  text          NOT NULL,
  city                  text,
  country_code          char(2)       NOT NULL,   -- ISO 3166-1 alpha-2
  lat                   numeric(9,6)  NOT NULL,
  lon                   numeric(10,6) NOT NULL,
  elevation_ft          integer,                  -- MSL elevation
  longest_runway_ft     integer,                  -- longest hard-surface runway
  fuel_jet_a            boolean       NOT NULL DEFAULT true,
  fuel_price_usd_gal    numeric(6,2),             -- NULL = use global default ($7.50)
  fuel_price_updated_at timestamptz,
  fbo_fee_usd           numeric(8,2),             -- NULL = use DEFAULT_FBO_FEE ($600)
  operating_hours_utc   jsonb,                    -- {"from":"06:00","to":"22:00"} or null = 24h
  curfew_utc            jsonb,                    -- {"from":"23:00","to":"06:00"} or null
  customs_available     boolean       NOT NULL DEFAULT false,
  deicing_available     boolean       NOT NULL DEFAULT false,
  slot_required         boolean       NOT NULL DEFAULT false,
  notes                 text,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

-- Indexes for routing engine queries
CREATE INDEX IF NOT EXISTS airports_lat_lon         ON airports (lat, lon);
CREATE INDEX IF NOT EXISTS airports_fuel_jet_a      ON airports (fuel_jet_a) WHERE fuel_jet_a = true;
CREATE INDEX IF NOT EXISTS airports_runway          ON airports (longest_runway_ft);
CREATE INDEX IF NOT EXISTS airports_country         ON airports (country_code);

-- Row-level security (same pattern as all other tables)
ALTER TABLE airports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_all" ON airports FOR ALL USING (auth.role() = 'authenticated');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_airports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER airports_updated_at
  BEFORE UPDATE ON airports
  FOR EACH ROW EXECUTE FUNCTION update_airports_updated_at();
