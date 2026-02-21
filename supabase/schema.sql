-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- Core tables
-- ─────────────────────────────────────────────────────────────────────────────

-- Clients (CRM)
create table clients (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  company text,
  email text,
  phone text,
  nationality text,
  notes text,
  risk_flag boolean default false,
  vip boolean default false
);

-- Aircraft
create table aircraft (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  tail_number text not null,
  category text not null, -- 'turboprop', 'light', 'midsize', 'super-mid', 'heavy', 'ultra-long'
  range_nm integer not null,
  cabin_height_in numeric(4,1),
  pax_capacity integer not null,
  fuel_burn_gph numeric(6,1),
  has_wifi boolean default false,
  has_bathroom boolean default false,
  home_base_icao text,
  notes text,
  -- migration 001_add_operational_fields
  status text not null default 'active',          -- 'active' | 'unavailable'
  daily_available_hours numeric(4,1) default 24,
  -- migration 001_aircraft_performance
  cruise_speed_kts integer,                       -- knots; NULL → category default
  max_fuel_capacity_gal numeric(8,1),             -- usable gallons; NULL → category default
  min_runway_ft integer,                          -- minimum required runway length
  etops_certified boolean default false,
  max_payload_lbs numeric(8,1),                   -- NULL = unconstrained
  reserve_fuel_gal numeric(6,1)                   -- FAR 91 45-min reserve; NULL → computed
);

-- Crew
create table crew (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  role text not null, -- 'captain', 'first_officer', 'flight_attendant'
  ratings text[],
  duty_hours_this_week numeric(4,1) default 0,
  last_duty_end timestamptz,
  -- migration 001_add_operational_fields
  available_hours_per_day numeric(4,1) default 10
);

-- Trips
create table trips (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  client_id uuid references clients(id),
  raw_input text,
  legs jsonb not null default '[]', -- array of {from_icao, to_icao, date, time}
  trip_type text not null default 'one_way', -- 'one_way', 'round_trip', 'multi_leg'
  pax_adults integer default 1,
  pax_children integer default 0,
  pax_pets integer default 0,
  flexibility_hours integer default 0,
  special_needs text,
  catering_notes text,
  luggage_notes text,
  preferred_category text,
  min_cabin_height_in numeric(4,1),
  wifi_required boolean default false,
  bathroom_required boolean default false,
  ai_extracted boolean default false,
  ai_confidence jsonb, -- per-field confidence scores
  -- migration 001_add_operational_fields
  request_source text,                            -- 'email' | 'phone' | 'broker' | 'portal'
  requested_departure_window_start timestamptz,
  requested_departure_window_end timestamptz,
  requested_return_window_start timestamptz,
  requested_return_window_end timestamptz,
  estimated_block_hours numeric(5,1),
  estimated_reposition_hours numeric(5,1),
  estimated_total_hours numeric(5,1)
);

-- Quotes
create table quotes (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  trip_id uuid references trips(id) not null,
  client_id uuid references clients(id),
  aircraft_id uuid references aircraft(id),
  status text not null default 'new', -- 'new','pricing','sent','negotiating','confirmed','lost','completed'
  version integer default 1,
  margin_pct numeric(5,2) default 15.0,
  currency text default 'USD',
  broker_name text,
  broker_commission_pct numeric(5,2),
  notes text,
  sent_at timestamptz,
  confirmed_at timestamptz,
  -- migration 001_add_operational_fields: quote stage
  quote_valid_until timestamptz,
  chosen_aircraft_category text,                  -- may differ from trip.preferred_category
  estimated_total_hours numeric(5,1),
  won_lost_reason text,                           -- 'price'|'availability'|'client_cancelled'|'competitor'|'other'
  -- migration 001_add_operational_fields: confirmed booking stage
  scheduled_departure_time timestamptz,
  scheduled_arrival_time timestamptz,
  scheduled_total_hours numeric(5,1),
  -- migration 001_add_operational_fields: post-flight actuals
  actual_departure_time timestamptz,
  actual_arrival_time timestamptz,
  actual_block_hours numeric(5,1),
  actual_reposition_hours numeric(5,1),
  actual_total_hours numeric(5,1),
  delay_reason_code text                          -- 'weather'|'atc'|'mechanical'|'crew'|'client'|'other'
);

-- Quote Costs (line items)
create table quote_costs (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid references quotes(id) not null,
  fuel_cost numeric(10,2) default 0,
  fbo_fees numeric(10,2) default 0,
  repositioning_cost numeric(10,2) default 0,
  repositioning_hours numeric(5,1) default 0,
  permit_fees numeric(10,2) default 0,
  crew_overnight_cost numeric(10,2) default 0,
  catering_cost numeric(10,2) default 0,
  peak_day_surcharge numeric(10,2) default 0,
  subtotal numeric(10,2) default 0,
  margin_amount numeric(10,2) default 0,
  tax numeric(10,2) default 0,
  total numeric(10,2) default 0,
  per_leg_breakdown jsonb default '[]'
);

-- Audit Logs (immutable)
create table audit_logs (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  user_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb,
  ai_generated boolean default false,
  ai_model text,
  human_verified boolean default false
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Airports
-- ─────────────────────────────────────────────────────────────────────────────

create table airports (
  icao char(4) primary key,
  iata char(3),
  name text not null,
  city text,
  country_code char(2) not null,
  lat numeric(9,6) not null,
  lon numeric(10,6) not null,
  elevation_ft integer,
  longest_runway_ft integer,
  fuel_jet_a boolean not null default true,
  fuel_price_usd_gal numeric(6,2),
  fuel_price_updated_at timestamptz,
  fbo_fee_usd numeric(8,2),
  operating_hours_utc jsonb,  -- {"from":"06:00","to":"22:00"} or null = 24h
  curfew_utc jsonb,           -- {"from":"23:00","to":"06:00"} or null
  customs_available boolean not null default false,
  deicing_available boolean not null default false,
  slot_required boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002: Fleet Forecasting
-- ─────────────────────────────────────────────────────────────────────────────

create table aircraft_maintenance (
  id uuid primary key default uuid_generate_v4(),
  aircraft_id uuid references aircraft(id) on delete cascade not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  maintenance_type text not null default 'scheduled', -- 'scheduled','unscheduled','inspection','overhaul'
  notes text,
  created_at timestamptz default now()
);

create table fleet_forecast_overrides (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  aircraft_category text not null, -- 'light','midsize','super-mid','heavy','ultra-long','turboprop','all'
  peak_multiplier numeric(4,2) not null default 1.0,
  reason text,
  created_at timestamptz default now(),
  unique(date, aircraft_category)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: Route Plans
-- ─────────────────────────────────────────────────────────────────────────────

create table route_plans (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  quote_id uuid references quotes(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  aircraft_id uuid references aircraft(id),
  optimization_mode text not null default 'balanced', -- 'cost'|'time'|'balanced'
  route_legs jsonb not null default '[]',
  refuel_stops jsonb not null default '[]',
  weather_summary jsonb not null default '[]',
  notam_alerts jsonb not null default '[]',
  alternatives jsonb not null default '[]',
  cost_breakdown jsonb,
  total_distance_nm numeric(8,1),
  total_flight_time_hr numeric(6,2),
  total_fuel_cost numeric(10,2),
  risk_score integer,         -- 0-100
  on_time_probability numeric(4,3), -- 0.000-1.000
  computed_at timestamptz not null default now(),
  weather_fetched_at timestamptz,
  notam_fetched_at timestamptz,
  is_stale boolean not null default false
);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: authenticated staff can do everything (MVP policy)
-- ─────────────────────────────────────────────────────────────────────────────

alter table clients enable row level security;
alter table aircraft enable row level security;
alter table crew enable row level security;
alter table trips enable row level security;
alter table quotes enable row level security;
alter table quote_costs enable row level security;
alter table audit_logs enable row level security;
alter table airports enable row level security;
alter table aircraft_maintenance enable row level security;
alter table fleet_forecast_overrides enable row level security;
alter table route_plans enable row level security;

create policy "staff_all" on clients                  for all using (auth.role() = 'authenticated');
create policy "staff_all" on aircraft                 for all using (auth.role() = 'authenticated');
create policy "staff_all" on crew                     for all using (auth.role() = 'authenticated');
create policy "staff_all" on trips                    for all using (auth.role() = 'authenticated');
create policy "staff_all" on quotes                   for all using (auth.role() = 'authenticated');
create policy "staff_all" on quote_costs              for all using (auth.role() = 'authenticated');
create policy "staff_all" on audit_logs               for all using (auth.role() = 'authenticated');
create policy "staff_all" on airports                 for all using (auth.role() = 'authenticated');
create policy "staff_all" on aircraft_maintenance     for all using (auth.role() = 'authenticated');
create policy "staff_all" on fleet_forecast_overrides for all using (auth.role() = 'authenticated');
create policy "staff_all" on route_plans              for all using (auth.role() = 'authenticated');
