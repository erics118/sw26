-- Migration 001: Add per-aircraft performance columns
-- All columns nullable so existing rows continue to work.
-- NULL values fall back to category-level defaults in lib/routing/performance.ts

ALTER TABLE aircraft
  ADD COLUMN IF NOT EXISTS cruise_speed_kts      integer,        -- knots; NULL → category default
  ADD COLUMN IF NOT EXISTS max_fuel_capacity_gal  numeric(8,1),  -- usable gallons; NULL → category default
  ADD COLUMN IF NOT EXISTS min_runway_ft           integer,       -- minimum required runway length at destination
  ADD COLUMN IF NOT EXISTS etops_certified         boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_payload_lbs         numeric(8,1), -- NULL = unconstrained
  ADD COLUMN IF NOT EXISTS reserve_fuel_gal        numeric(6,1); -- FAR 91 45-min reserve; NULL → computed from burn rate
