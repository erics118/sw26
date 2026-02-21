-- ============================================================
-- FULL DATABASE RESET
-- Drops all tables, recreates schema, and seeds with stable UUIDs.
-- Run via: npm run db:reset
-- WARNING: destroys all existing data.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ── Drop tables (reverse FK order) ───────────────────────────────────────────

drop table if exists route_plans cascade;
drop table if exists fleet_forecast_overrides cascade;
drop table if exists aircraft_maintenance cascade;
drop table if exists airports cascade;
drop table if exists audit_logs cascade;
drop table if exists quote_costs cascade;
drop table if exists quotes cascade;
drop table if exists trips cascade;
drop table if exists crew cascade;
drop table if exists aircraft cascade;
drop table if exists clients cascade;

-- ── Drop functions ────────────────────────────────────────────────────────────

drop function if exists update_airports_updated_at() cascade;

-- ── Schema ───────────────────────────────────────────────────────────────────

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

create table aircraft (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  tail_number text not null,
  category text not null,
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
  daily_available_hours numeric(4,1) default 8,
  -- migration 001_aircraft_performance
  cruise_speed_kts integer,
  max_fuel_capacity_gal numeric(8,1),
  min_runway_ft integer,
  etops_certified boolean default false,
  max_payload_lbs numeric(8,1),
  reserve_fuel_gal numeric(6,1)
);

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

create table trips (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  client_id uuid references clients(id),
  raw_input text,
  legs jsonb not null default '[]',
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
  ai_confidence jsonb,
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
  won_lost_reason text,                           -- 'price' | 'availability' | 'client_cancelled' | 'competitor' | 'other'
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
  delay_reason_code text                          -- 'weather' | 'atc' | 'mechanical' | 'crew' | 'client' | 'other'
);

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

-- migration 002_airports_table
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
  operating_hours_utc jsonb,
  curfew_utc jsonb,
  customs_available boolean not null default false,
  deicing_available boolean not null default false,
  slot_required boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index airports_lat_lon    on airports (lat, lon);
create index airports_fuel_jet_a on airports (fuel_jet_a) where fuel_jet_a = true;
create index airports_runway     on airports (longest_runway_ft);
create index airports_country    on airports (country_code);

create or replace function update_airports_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger airports_updated_at
  before update on airports
  for each row execute function update_airports_updated_at();

-- migration 002_fleet_forecasting
create table aircraft_maintenance (
  id uuid primary key default uuid_generate_v4(),
  aircraft_id uuid references aircraft(id) on delete cascade not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  maintenance_type text not null default 'scheduled', -- 'scheduled', 'unscheduled', 'inspection', 'overhaul'
  notes text,
  created_at timestamptz default now()
);

create table fleet_forecast_overrides (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  aircraft_category text not null,
  peak_multiplier numeric(4,2) not null default 1.0,
  reason text,
  created_at timestamptz default now(),
  unique(date, aircraft_category)
);

-- migration 003_route_plans
create table route_plans (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  quote_id uuid references quotes(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  aircraft_id uuid references aircraft(id),
  optimization_mode text not null default 'balanced', -- 'cost' | 'time' | 'balanced'
  route_legs jsonb not null default '[]',
  refuel_stops jsonb not null default '[]',
  weather_summary jsonb not null default '[]',
  notam_alerts jsonb not null default '[]',
  alternatives jsonb not null default '[]',
  cost_breakdown jsonb,
  total_distance_nm numeric(8,1),
  total_flight_time_hr numeric(6,2),
  total_fuel_cost numeric(10,2),
  risk_score integer,
  on_time_probability numeric(4,3),
  computed_at timestamptz not null default now(),
  weather_fetched_at timestamptz,
  notam_fetched_at timestamptz,
  is_stale boolean not null default false
);

create index route_plans_quote_id on route_plans (quote_id);
create index route_plans_trip_id  on route_plans (trip_id);
create index route_plans_computed on route_plans (computed_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

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

-- ── Seed data: fixed UUIDs (must stay in sync) ─────────────────────────────────
-- CLIENTS:  4e8f2a7c (James), 8c1f5d3a (Priya), 2d9a6f4e (Marcus), 6a3e1f9c (Sofia), 9f7b5c2d (Derek)
-- AIRCRAFT: 2a7f4c1e (N114PC), 6e3b9d5f (N388CJ), 4c1d8f6a (N512PE), 8b5e2f9c (N744XL), 1f9c4a7e (N291HK),
--           5a2d7f1c (N603LA), 9c6f3a4d (N177CR), 3d1b8e5f (N830GV), 7f4a2c9e (N495CL), 1b6d4e8f (N741GX)
-- TRIPS:   3b8f5a1d, 7e4c2f9a, 1a9d6f3c, 5f2a8d7b, 9c7f4b1e, 4b1e9f6c, 8d5c3a7f  (client_id → clients.id)
-- QUOTES:  7a4e2c9f, 1c8f7a3e, 5d3b1f8c, 9e7d5a2f, 3f1a9e6d, 7b5f3c1a, 2e9c7f4a  (trip_id, client_id, aircraft_id → above)
-- QUOTE_COSTS: quote_id must be one of the 7 quote IDs above (5 rows: sent, negotiating, confirmed, lost, completed)
-- ───────────────────────────────────────────────────────────────────────────────

-- ── Aircraft ─────────────────────────────────────────────────────────────────

insert into aircraft (id, tail_number, category, range_nm, cabin_height_in, pax_capacity, fuel_burn_gph, has_wifi, has_bathroom, home_base_icao, notes, status, daily_available_hours) values
  ('2a7f4c1e-8b3d-4f6a-9c2e-5d1b7a3f9e4c', 'N114PC', 'turboprop',  1845, 59.0,  8,  74.0, false, true,  'KVNY', 'Pilatus PC-12 NGX — 2021, workhorse short-haul, no wifi',  'active', 8),
  ('6e3b9d5f-1c4a-4b7d-8e2f-3a9c6b1d4e7f', 'N388CJ', 'light',      2040, 57.5,  6,  96.0, false, false, 'KBUR', 'Citation CJ3 — 2014, no lavatory, ideal for quick hops',   'active', 8),
  ('4c1d8f6a-7e2b-4d9c-a5f3-8b4e1c7d2f9a', 'N512PE', 'light',      2267, 59.0,  7, 103.0, true,  false, 'KLAS', 'Phenom 300E — 2022, Gogo Avance wifi, enclosed lav',       'active', 8),
  ('8b5e2f9c-3d7a-4e1b-b6c4-2f8a5d3e7c1b', 'N744XL', 'midsize',    2100, 68.5,  9, 211.0, true,  true,  'KLAX', 'Citation XLS+ — 2019, full galley, ForeFlight avionics',   'active', 8),
  ('1f9c4a7e-6b2d-4c8f-a3e5-7d1f9c4a6b2e', 'N291HK', 'midsize',    2540, 72.0,  8, 230.0, false, true,  'KTEB', 'Hawker 800XP — 2007, classic interior, reliable but no wifi', 'active', 8),
  ('5a2d7f1c-9e4b-4a6d-8c1f-3b7a5d2f9c4e', 'N603LA', 'midsize',    2700, 72.0,  9, 218.0, true,  true,  'KMDW', 'Citation Latitude — 2021, flat-floor, dual-zone cabin',    'active', 8),
  ('9c6f3a4d-2e8b-4d1c-b7f5-4a9c2e6f8d1b', 'N177CR', 'super-mid',  3200, 73.8, 10, 253.0, true,  true,  'KORD', 'Challenger 350 — 2023, Ka-band wifi, lie-flat seats',      'active', 8),
  ('3d1b8e5f-7c2a-4f9b-a4d6-1e3f7c9b5a2d', 'N830GV', 'heavy',      4350, 74.5, 14, 338.0, true,  true,  'KMIA', 'Gulfstream G450 — 2016, full galley, entertainment suite', 'active', 8),
  ('7f4a2c9e-1d6b-4e3f-9a7c-5b2e8f4a1d6c', 'N495CL', 'heavy',      4000, 73.5, 12, 295.0, true,  true,  'KJFK', 'Challenger 605 — 2018, club seating + divan, dual-zone',   'active', 8),
  ('1b6d4e8f-5c3a-4b7d-8e2f-9c1b6d4e5f3a', 'N741GX', 'ultra-long', 7500, 77.0, 16, 412.0, true,  true,  'KBOS', 'Gulfstream G650ER — 2022, flagship, transatlantic range',  'active', 8);

-- ── Clients ───────────────────────────────────────────────────────────────────

insert into clients (id, name, company, email, phone, nationality, vip, risk_flag, notes) values
  ('4e8f2a7c-1b5d-4c9e-a3f6-7d4e2a8f1b5c', 'James Whitfield',   'Acme Corp',            'james@acmecorp.com',       '+1 (310) 555-0192', 'US', true,  false, 'CEO. Prefers midsize+, always requests catering. Loyal repeat client.'),
  ('8c1f5d3a-7e4b-4d2f-b8a1-3c8f5d1a7e4b', 'Priya Nair',        'Horizon Ventures',     'priya.nair@horizonvc.com', '+1 (415) 555-0348', 'US', false, false, 'VC partner. Frequently LA→NYC. Wifi critical, light traveler.'),
  ('2d9a6f4e-3c8b-4a1d-9f5e-6b2d9a4f3c8e', 'Marcus Stein',      NULL,                   'mstein@protonmail.com',    '+49 151 5550198',   'DE', true,  false, 'European HNW. Requests G650 or equivalent for transatlantic routes.'),
  ('6a3e1f9c-5d7b-4e4a-a2c8-9f6a3e1d5c7b', 'Sofia Castellanos', 'Meridian Media Group', 'scastellanos@meridmg.com', '+1 (212) 555-0761', 'US', false, false, 'Marketing exec. Group bookings 6–10 pax, often with tight notice.'),
  ('9f7b5c2d-8a4e-4f3b-b9d1-5c7f2b8a4e3d', 'Derek Okonkwo',     'Okonkwo Capital',      'derek@okonkwocap.com',     '+1 (713) 555-0523', 'US', false, true,  'Payment issues on Q3 booking — require deposit before confirming.');

-- ── Crew ─────────────────────────────────────────────────────────────────────

insert into crew (id, name, role, ratings, duty_hours_this_week) values
  ('2f6a3d8c-7e1b-4c5f-b9a4-8d2f6a3c7e1b', 'Captain David Holt',     'captain',          ARRAY['Citation XLS+', 'Challenger 350', 'Citation Latitude'], 12.5),
  ('6c1f8b5a-3d7e-4a2c-9f6b-1e6c1f8a5d7e', 'FO Sarah Kimura',        'first_officer',    ARRAY['Citation XLS+', 'Citation Latitude'], 8.0),
  ('a3e7d2f9-1c5b-4d8a-b7f3-2e9a3d7f1c5b', 'Captain Luis Herrera',   'captain',          ARRAY['Citation CJ3', 'Phenom 300E'], 22.0),
  ('e7f4a8c1-9b2d-4f6e-a3c7-8b1e7f4a2d9c', 'FO Megan Tran',          'first_officer',    ARRAY['Citation CJ3', 'Phenom 300E'], 18.5),
  ('b4c9e1f8-5a3d-4c2b-9e7f-4a8b9c1f5d3e', 'FA Nicole Osei',         'flight_attendant', ARRAY[]::text[], 14.0),
  ('d8a1f5c4-2e7b-4a9d-b3f8-5c1d8a4f2e7b', 'Captain Ray Morales',    'captain',          ARRAY['Hawker 800XP', 'Challenger 605'], 30.0),
  ('f5b7a2e9-4c1d-4b6f-a8d5-2c7f5b9a4e1d', 'FO Anita Patel',         'first_officer',    ARRAY['Hawker 800XP'], 25.5),
  ('c1d9f4a7-8b5e-4d2c-b6a1-9f4c1d7a8e5b', 'Captain Erik Johansson', 'captain',          ARRAY['Gulfstream G450', 'Gulfstream G650ER'], 6.0),
  ('a8e2f6d1-3c9b-4e5a-9f2c-7b8a2e6d3c9f', 'FO Yuki Tanaka',         'first_officer',    ARRAY['Gulfstream G450', 'Gulfstream G650ER'], 6.0),
  ('f2a6b9e4-7d1c-4f8a-b4e9-1c3f2a6d7b9e', 'FA Camille Dubois',      'flight_attendant', ARRAY[]::text[], 6.0);

-- ── Trips ─────────────────────────────────────────────────────────────────────

insert into trips (id, client_id, legs, trip_type, pax_adults, pax_children, flexibility_hours, catering_notes, luggage_notes, wifi_required, ai_extracted, created_at) values

  ('3b8f5a1d-7c4e-4f2b-9a6d-1e3f8c5a7b4d',
   '4e8f2a7c-1b5d-4c9e-a3f6-7d4e2a8f1b5c',
   '[{"from_icao":"KLAX","to_icao":"KTEB","date":"2025-06-15","time":"14:00"},{"from_icao":"KTEB","to_icao":"KLAX","date":"2025-06-17","time":"19:00"}]',
   'round_trip', 4, 0, 2, 'Light snacks and beverages', '6 checked bags', true, true,
   now() - interval '12 days'),

  ('7e4c2f9a-1d8b-4a5e-b3f7-4c2e7f9a1d8c',
   '8c1f5d3a-7e4b-4d2f-b8a1-3c8f5d1a7e4b',
   '[{"from_icao":"KSFO","to_icao":"KTEB","date":"2025-07-02","time":"08:00"}]',
   'one_way', 2, 0, 0, NULL, NULL, true, true,
   now() - interval '9 days'),

  ('1a9d6f3c-5b2e-4c8a-a7d4-9f1a3c6b5e2d',
   '2d9a6f4e-3c8b-4a1d-9f5e-6b2d9a4f3c8e',
   '[{"from_icao":"KTEB","to_icao":"EGLL","date":"2025-07-10","time":"21:00"},{"from_icao":"EGLL","to_icao":"LFPB","date":"2025-07-14","time":"10:00"},{"from_icao":"LFPB","to_icao":"KTEB","date":"2025-07-18","time":"14:00"}]',
   'multi_leg', 3, 0, 0, 'Full catering each leg', 'Light luggage only', true, true,
   now() - interval '7 days'),

  ('5f2a8d7b-9e1c-4d6f-b4a9-7d5f2e8a1c9b',
   '6a3e1f9c-5d7b-4e4a-a2c8-9f6a3e1d5c7b',
   '[{"from_icao":"KLAX","to_icao":"KLAS","date":"2025-08-01","time":"11:00"}]',
   'one_way', 9, 0, 3, NULL, NULL, false, false,
   now() - interval '5 days'),

  ('9c7f4b1e-3a6d-4b9c-a1f8-3e9c7f4b6a1d',
   '9f7b5c2d-8a4e-4f3b-b9d1-5c7f2b8a4e3d',
   '[{"from_icao":"KHOU","to_icao":"KMIA","date":"2025-08-15","time":"09:30"}]',
   'one_way', 5, 0, 1, NULL, NULL, true, false,
   now() - interval '3 days'),

  ('4b1e9f6c-8a5d-4c2b-9e7f-6c4b1a9f8d5e',
   '4e8f2a7c-1b5d-4c9e-a3f6-7d4e2a8f1b5c',
   '[{"from_icao":"KTEB","to_icao":"KORD","date":"2025-05-20","time":"07:00"},{"from_icao":"KORD","to_icao":"KTEB","date":"2025-05-20","time":"18:30"}]',
   'round_trip', 4, 0, 0, 'Continental breakfast outbound', NULL, true, false,
   now() - interval '30 days'),

  ('8d5c3a7f-2b9e-4f1d-a6b3-9e8d5c3f7a2b',
   '8c1f5d3a-7e4b-4d2f-b8a1-3c8f5d1a7e4b',
   '[{"from_icao":"KSFO","to_icao":"KLAX","date":"2025-04-10","time":"16:00"}]',
   'one_way', 1, 0, 0, NULL, NULL, true, false,
   now() - interval '60 days');

-- ── Quotes ────────────────────────────────────────────────────────────────────

insert into quotes (id, trip_id, client_id, aircraft_id, status, version, margin_pct, currency, notes, sent_at, confirmed_at, created_at) values

  -- new: just created, not yet priced
  ('7a4e2c9f-1d8b-4b5a-9e7c-4f2a7e1c8d9b',
   '9c7f4b1e-3a6d-4b9c-a1f8-3e9c7f4b6a1d',
   '9f7b5c2d-8a4e-4f3b-b9d1-5c7f2b8a4e3d',
   '5a2d7f1c-9e4b-4a6d-8c1f-3b7a5d2f9c4e',
   'new', 1, 20.0, 'USD', NULL, NULL, NULL,
   now() - interval '3 days'),

  -- pricing: cost breakdown being worked
  ('1c8f7a3e-5d2b-4c9f-b6a4-7e1c8f3a2d5b',
   '5f2a8d7b-9e1c-4d6f-b4a9-7d5f2e8a1c9b',
   '6a3e1f9c-5d7b-4e4a-a2c8-9f6a3e1d5c7b',
   '6e3b9d5f-1c4a-4b7d-8e2f-3a9c6b1d4e7f',
   'pricing', 1, 18.0, 'USD', 'Short hop, Challenger overkill — CJ3 better fit', NULL, NULL,
   now() - interval '4 days'),

  -- sent: quote emailed to client
  ('5d3b1f8c-9e4a-4d7b-a2f5-8c5d3b1f9e4a',
   '7e4c2f9a-1d8b-4a5e-b3f7-4c2e7f9a1d8c',
   '8c1f5d3a-7e4b-4d2f-b8a1-3c8f5d1a7e4b',
   '8b5e2f9c-3d7a-4e1b-b6c4-2f8a5d3e7c1b',
   'sent', 1, 22.0, 'USD', 'Priya prefers XLS+ for this route', now() - interval '5 days', NULL,
   now() - interval '8 days'),

  -- negotiating: client pushing back on price
  ('9e7d5a2f-3b1c-4e8d-b9f7-2a9e5d7a3c1f',
   '3b8f5a1d-7c4e-4f2b-9a6d-1e3f8c5a7b4d',
   '4e8f2a7c-1b5d-4c9e-a3f6-7d4e2a8f1b5c',
   '9c6f3a4d-2e8b-4d1c-b7f5-4a9c2e6f8d1b',
   'negotiating', 2, 19.0, 'USD', 'James requested v2 at lower margin. Hold at 19%.', now() - interval '8 days', NULL,
   now() - interval '11 days'),

  -- confirmed: booked and deposit received
  ('3f1a9e6d-7c4b-4f2a-9d3e-6b3f1a9e7c4b',
   '1a9d6f3c-5b2e-4c8a-a7d4-9f1a3c6b5e2d',
   '2d9a6f4e-3c8b-4a1d-9f5e-6b2d9a4f3c8e',
   '1b6d4e8f-5c3a-4b7d-8e2f-9c1b6d4e5f3a',
   'confirmed', 1, 25.0, 'USD', 'Marcus confirmed. Full deposit received.', now() - interval '4 days', now() - interval '2 days',
   now() - interval '6 days'),

  -- lost: client went with another broker
  ('7b5f3c1a-2e9d-4c6b-a7f3-1a7b5c3f2e9d',
   '8d5c3a7f-2b9e-4f1d-a6b3-9e8d5c3f7a2b',
   '8c1f5d3a-7e4b-4d2f-b8a1-3c8f5d1a7e4b',
   '4c1d8f6a-7e2b-4d9c-a5f3-8b4e1c7d2f9a',
   'lost', 1, 20.0, 'USD', 'Lost to competitor — Priya said pricing was $400 higher', now() - interval '55 days', NULL,
   now() - interval '58 days'),

  -- completed: flight done, invoiced
  ('2e9c7f4a-6d1b-4a3e-b8c2-4f2e9c7a6d1b',
   '4b1e9f6c-8a5d-4c2b-9e7f-6c4b1a9f8d5e',
   '4e8f2a7c-1b5d-4c9e-a3f6-7d4e2a8f1b5c',
   '8b5e2f9c-3d7a-4e1b-b6c4-2f8a5d3e7c1b',
   'completed', 1, 22.0, 'USD', 'Completed. James very happy — sent referral.', now() - interval '25 days', now() - interval '28 days',
   now() - interval '29 days');

-- ── Quote costs ───────────────────────────────────────────────────────────────
-- Covers all quotes with status: pricing, sent, negotiating, confirmed, lost, completed.

insert into quote_costs (quote_id, fuel_cost, fbo_fees, repositioning_cost, repositioning_hours, permit_fees, crew_overnight_cost, catering_cost, peak_day_surcharge, subtotal, margin_amount, tax, total, per_leg_breakdown) values

  -- sent — KSFO→KTEB on Citation XLS+
  ('5d3b1f8c-9e4a-4d7b-a2f5-8c5d3b1f9e4a',
   8400, 1200, 2100, 2.5, 0, 0, 450, 0,
   12150, 2673, 0, 14823,
   '[{"leg":"KSFO→KTEB","flight_hours":5.1,"fuel_cost":8400,"fbo_fees":600,"subtotal":9000}]'),

  -- negotiating — KLAX→KTEB round trip on Challenger 350 (v2, lower margin)
  ('9e7d5a2f-3b1c-4e8d-b9f7-2a9e5d7a3c1f',
   14600, 2400, 3200, 3.0, 0, 1200, 800, 600,
   22800, 4332, 0, 27132,
   '[{"leg":"KLAX→KTEB","flight_hours":5.2,"fuel_cost":7800,"fbo_fees":1200,"subtotal":9000},{"leg":"KTEB→KLAX","flight_hours":5.2,"fuel_cost":6800,"fbo_fees":1200,"subtotal":8000}]'),

  -- confirmed — transatlantic multi-leg on G650ER
  ('3f1a9e6d-7c4b-4f2a-9d3e-6b3f1a9e7c4b',
   48000, 6500, 8000, 5.0, 2200, 3600, 3200, 1200,
   72700, 18175, 0, 90875,
   '[{"leg":"KTEB→EGLL","flight_hours":7.5,"fuel_cost":24000,"fbo_fees":2500,"subtotal":26500},{"leg":"EGLL→LFPB","flight_hours":1.2,"fuel_cost":4000,"fbo_fees":1000,"subtotal":5000},{"leg":"LFPB→KTEB","flight_hours":7.5,"fuel_cost":20000,"fbo_fees":3000,"subtotal":23000}]'),

  -- lost — KSFO→KLAX on Phenom 300E
  ('7b5f3c1a-2e9d-4c6b-a7f3-1a7b5c3f2e9d',
   1800, 600, 0, 0, 0, 0, 0, 0,
   2400, 480, 0, 2880,
   '[{"leg":"KSFO→KLAX","flight_hours":1.1,"fuel_cost":1800,"fbo_fees":600,"subtotal":2400}]'),

  -- completed — KTEB→KORD round trip on Citation XLS+
  ('2e9c7f4a-6d1b-4a3e-b8c2-4f2e9c7a6d1b',
   6200, 1800, 1400, 1.5, 0, 0, 550, 0,
   9950, 2189, 0, 12139,
   '[{"leg":"KTEB→KORD","flight_hours":2.1,"fuel_cost":3200,"fbo_fees":900,"subtotal":4100},{"leg":"KORD→KTEB","flight_hours":2.1,"fuel_cost":3000,"fbo_fees":900,"subtotal":3900}]');

-- ── Airports (from migration 002b_airports_seed) ──────────────────────────────

insert into airports (icao, name, city, country_code, lat, lon, elevation_ft, longest_runway_ft, fuel_jet_a, fbo_fee_usd, customs_available) values
-- ── USA ──────────────────────────────────────────────────────────────────────
  ('KATL', 'Hartsfield–Jackson Atlanta International', 'Atlanta', 'US', 33.6407, -84.4277, 1026, 12390, true, 800, true),
  ('KBOS', 'Boston Logan International', 'Boston', 'US', 42.3656, -71.0096, 19, 10083, true, 900, true),
  ('KBUR', 'Hollywood Burbank Airport', 'Burbank', 'US', 34.2007, -118.3585, 778, 6886, true, 600, false),
  ('KBWI', 'Baltimore/Washington International', 'Baltimore', 'US', 39.1754, -76.6683, 146, 10502, true, 700, true),
  ('KCLT', 'Charlotte Douglas International', 'Charlotte', 'US', 35.214, -80.9431, 748, 10000, true, 700, true),
  ('KDAL', 'Dallas Love Field', 'Dallas', 'US', 32.8471, -96.8518, 487, 8800, true, 600, false),
  ('KDCA', 'Ronald Reagan Washington National', 'Washington DC', 'US', 38.8521, -77.0377, 16, 7169, true, 1100, true),
  ('KDEN', 'Denver International', 'Denver', 'US', 39.8561, -104.6737, 5431, 16000, true, 750, true),
  ('KDFW', 'Dallas/Fort Worth International', 'Dallas', 'US', 32.8998, -97.0403, 607, 13400, true, 750, true),
  ('KDTW', 'Detroit Metropolitan Wayne County', 'Detroit', 'US', 42.2124, -83.3534, 645, 12003, true, 700, true),
  ('KEWR', 'Newark Liberty International', 'Newark', 'US', 40.6895, -74.1745, 18, 11000, true, 1100, true),
  ('KFLL', 'Fort Lauderdale–Hollywood International', 'Fort Lauderdale', 'US', 26.0726, -80.1527, 9, 9000, true, 700, true),
  ('KHOU', 'William P. Hobby Airport', 'Houston', 'US', 29.6454, -95.2789, 46, 7602, true, 600, false),
  ('KIND', 'Indianapolis International', 'Indianapolis', 'US', 39.7173, -86.294, 797, 11200, true, 600, true),
  ('KJFK', 'John F. Kennedy International', 'New York', 'US', 40.6398, -73.7789, 13, 14572, true, 1500, true),
  ('KLAS', 'Harry Reid International', 'Las Vegas', 'US', 36.08, -115.1522, 2181, 14512, true, 750, true),
  ('KLAX', 'Los Angeles International', 'Los Angeles', 'US', 33.9425, -118.408, 128, 12923, true, 1000, true),
  ('KMCO', 'Orlando International', 'Orlando', 'US', 28.4294, -81.309, 96, 12005, true, 700, true),
  ('KMDW', 'Chicago Midway International', 'Chicago', 'US', 41.786, -87.7524, 620, 6522, true, 650, true),
  ('KMEM', 'Memphis International', 'Memphis', 'US', 35.0424, -89.9767, 341, 11120, true, 600, true),
  ('KMIA', 'Miami International', 'Miami', 'US', 25.7959, -80.287, 8, 13000, true, 850, true),
  ('KMSP', 'Minneapolis–Saint Paul International', 'Minneapolis', 'US', 44.8848, -93.2223, 841, 11006, true, 700, true),
  ('KOAK', 'Oakland Metropolitan International', 'Oakland', 'US', 37.7213, -122.2208, 9, 10000, true, 600, false),
  ('KORD', 'O''Hare International', 'Chicago', 'US', 41.9742, -87.9073, 672, 13000, true, 900, true),
  ('KPBI', 'Palm Beach International', 'West Palm Beach', 'US', 26.6832, -80.0956, 19, 10000, true, 700, true),
  ('KPDX', 'Portland International', 'Portland', 'US', 45.5888, -122.5975, 26, 11000, true, 700, true),
  ('KPHL', 'Philadelphia International', 'Philadelphia', 'US', 39.8719, -75.2411, 36, 12000, true, 800, true),
  ('KPHX', 'Phoenix Sky Harbor International', 'Phoenix', 'US', 33.4373, -112.0078, 1135, 11489, true, 700, true),
  ('KPIT', 'Pittsburgh International', 'Pittsburgh', 'US', 40.4915, -80.2329, 1203, 11500, true, 600, true),
  ('KRDU', 'Raleigh–Durham International', 'Raleigh', 'US', 35.8776, -78.7875, 435, 10000, true, 600, true),
  ('KRSW', 'Southwest Florida International', 'Fort Myers', 'US', 26.5362, -81.7552, 30, 12000, true, 500, true),
  ('KSAN', 'San Diego International', 'San Diego', 'US', 32.7336, -117.1897, 17, 9401, true, 700, true),
  ('KSEA', 'Seattle–Tacoma International', 'Seattle', 'US', 47.4502, -122.3088, 432, 11901, true, 800, true),
  ('KSFO', 'San Francisco International', 'San Francisco', 'US', 37.6213, -122.379, 13, 11870, true, 1000, true),
  ('KSLC', 'Salt Lake City International', 'Salt Lake City', 'US', 40.7884, -111.9778, 4227, 12003, true, 650, true),
  ('KSMF', 'Sacramento International', 'Sacramento', 'US', 38.6954, -121.5908, 27, 8600, true, 600, true),
  ('KSTL', 'St. Louis Lambert International', 'St. Louis', 'US', 38.7487, -90.37, 618, 11019, true, 600, true),
  ('KTEB', 'Teterboro Airport', 'Teterboro', 'US', 40.8501, -74.0608, 9, 7000, true, 1200, false),
  ('KTPA', 'Tampa International', 'Tampa', 'US', 27.9755, -82.5332, 26, 11002, true, 650, true),
  ('KVNY', 'Van Nuys Airport', 'Los Angeles', 'US', 34.2098, -118.4899, 802, 8001, true, 600, false),
  ('KBED', 'Boston Executive Airport (Hanscom)', 'Bedford', 'US', 42.4699, -71.2896, 133, 7001, true, 600, false),
  ('KPWK', 'Chicago Executive Airport', 'Wheeling', 'US', 42.1142, -87.9015, 647, 5001, true, 700, false),
  ('KHPN', 'Westchester County Airport', 'White Plains', 'US', 41.0671, -73.7076, 439, 6549, true, 900, false),
  ('KMVY', 'Martha''s Vineyard Airport', 'Martha''s Vineyard', 'US', 41.3931, -70.6154, 67, 5504, true, 600, false),
  ('KACK', 'Nantucket Memorial Airport', 'Nantucket', 'US', 41.2531, -70.0603, 47, 6303, true, 600, false),
  ('KASE', 'Aspen/Pitkin County Airport', 'Aspen', 'US', 39.2232, -106.8688, 7820, 7006, true, 800, false),
  ('KHST', 'Homestead ARB', 'Homestead', 'US', 25.4888, -80.3836, 7, 14000, true, null, false),
  ('KOPF', 'Opa-locka Executive Airport', 'Opa-locka', 'US', 25.9074, -80.2784, 8, 8002, true, 500, false),
  ('KFXE', 'Fort Lauderdale Executive Airport', 'Fort Lauderdale', 'US', 26.1973, -80.1707, 13, 6001, true, 600, false),
-- ── Canada ────────────────────────────────────────────────────────────────────
  ('CYYZ', 'Toronto Pearson International', 'Toronto', 'CA', 43.6772, -79.6306, 569, 11120, true, 800, true),
  ('CYVR', 'Vancouver International', 'Vancouver', 'CA', 49.1967, -123.1815, 14, 11500, true, 750, true),
  ('CYUL', 'Montréal–Trudeau International', 'Montreal', 'CA', 45.4706, -73.7408, 118, 11000, true, 750, true),
  ('CYYC', 'Calgary International', 'Calgary', 'CA', 51.1131, -114.0199, 3557, 14000, true, 700, true),
  ('CYOW', 'Ottawa Macdonald–Cartier International', 'Ottawa', 'CA', 45.3225, -75.6692, 374, 10000, true, 700, true),
-- ── UK / Europe ───────────────────────────────────────────────────────────────
  ('EGLL', 'London Heathrow Airport', 'London', 'GB', 51.477, -0.4613, 83, 12799, true, 2000, true),
  ('EGKK', 'London Gatwick Airport', 'London', 'GB', 51.1481, -0.1903, 202, 10879, true, 1200, true),
  ('EGLC', 'London City Airport', 'London', 'GB', 51.5053, 0.0553, 19, 4948, true, 1000, true),
  ('LFPG', 'Paris Charles de Gaulle Airport', 'Paris', 'FR', 49.0097, 2.5478, 392, 13829, true, 1800, true),
  ('LFPB', 'Paris Le Bourget Airport', 'Paris', 'FR', 48.9694, 2.4414, 218, 9843, true, 1000, false),
  ('EHAM', 'Amsterdam Airport Schiphol', 'Amsterdam', 'NL', 52.3086, 4.7639, -11, 12467, true, 1200, true),
  ('EDDB', 'Berlin Brandenburg Airport', 'Berlin', 'DE', 52.3667, 13.5033, 157, 13123, true, 1000, true),
  ('EDDM', 'Munich Airport', 'Munich', 'DE', 48.3537, 11.7751, 1487, 13123, true, 1000, true),
  ('LSZH', 'Zurich Airport', 'Zurich', 'CH', 47.4647, 8.5492, 1416, 12139, true, 1200, true),
  ('LIRF', 'Rome Fiumicino Airport', 'Rome', 'IT', 41.8003, 12.2389, 14, 12795, true, 1000, true),
  ('LEMD', 'Adolfo Suárez Madrid–Barajas Airport', 'Madrid', 'ES', 40.4936, -3.5668, 1998, 14272, true, 900, true),
  ('LPPT', 'Lisbon Humberto Delgado Airport', 'Lisbon', 'PT', 38.7813, -9.1359, 374, 12467, true, 900, true),
  ('LSGG', 'Geneva Airport', 'Geneva', 'CH', 46.238, 6.1089, 1411, 12795, true, 1000, true),
  ('EBCI', 'Brussels South Charleroi Airport', 'Charleroi', 'BE', 50.4722, 4.4528, 614, 9514, true, 800, false),
  ('LFMN', 'Nice Côte d''Azur Airport', 'Nice', 'FR', 43.6584, 7.2159, 12, 9711, true, 1000, true),
  ('LOWI', 'Innsbruck Airport', 'Innsbruck', 'AT', 47.26, 11.344, 1906, 6562, true, 800, true),
  ('LOWW', 'Vienna International Airport', 'Vienna', 'AT', 48.1103, 16.5697, 600, 11811, true, 900, true),
  -- North Atlantic fuel stops
  ('BIRK', 'Reykjavik Airport', 'Reykjavik', 'IS', 64.1300, -21.9406, 48, 5039, true, 800, true),
  ('BIKF', 'Keflavik International Airport', 'Keflavik', 'IS', 63.9850, -22.6056, 171, 10056, true, 800, true),
  ('EINN', 'Shannon Airport', 'Shannon', 'IE', 52.7020, -8.9248, 46, 10499, true, 900, true),
  ('EGPD', 'Aberdeen Dyce Airport', 'Aberdeen', 'GB', 57.2019, -2.1978, 215, 6004, true, 700, true),
  ('GCFV', 'Fuerteventura Airport', 'Fuerteventura', 'ES', 28.4527, -13.8638, 85, 11483, true, 700, true),
  ('GCLP', 'Gran Canaria Airport', 'Las Palmas', 'ES', 27.9319, -15.3866, 78, 11316, true, 700, true),
  -- Azores (mid-Atlantic stop)
  ('LPLA', 'Lajes Field / Terceira Island', 'Terceira', 'PT', 38.7618, -27.0908, 180, 10865, true, 700, true),
-- ── Middle East ───────────────────────────────────────────────────────────────
  ('OMDB', 'Dubai International Airport', 'Dubai', 'AE', 25.2532, 55.3657, 62, 13999, true, 1600, true),
  ('OMDW', 'Al Maktoum International Airport', 'Dubai', 'AE', 24.8961, 55.1614, 114, 14763, true, 1400, true),
  ('OMAA', 'Abu Dhabi International Airport', 'Abu Dhabi', 'AE', 24.4328, 54.6511, 88, 14763, true, 1400, true),
  ('OERK', 'King Khaled International Airport', 'Riyadh', 'SA', 24.9576, 46.6988, 2049, 13779, true, 1000, true),
-- ── Asia-Pacific ──────────────────────────────────────────────────────────────
  ('VHHH', 'Hong Kong International Airport', 'Hong Kong', 'HK', 22.308, 113.9185, 28, 12467, true, 1400, true),
  ('RJTT', 'Tokyo Haneda Airport', 'Tokyo', 'JP', 35.5494, 139.7798, 35, 11024, true, 1200, true),
  ('WSSS', 'Singapore Changi Airport', 'Singapore', 'SG', 1.3644, 103.9915, 22, 13123, true, 1200, true),
  ('YSSY', 'Sydney Kingsford Smith Airport', 'Sydney', 'AU', -33.9461, 151.1772, 21, 13000, true, 1000, true),
  ('YMML', 'Melbourne Airport', 'Melbourne', 'AU', -37.6733, 144.8433, 434, 12008, true, 900, true),
-- ── Caribbean ─────────────────────────────────────────────────────────────────
  ('TNCM', 'Princess Juliana International Airport', 'St. Maarten', 'SX', 18.041, -63.1089, 13, 7546, true, 700, true),
  ('MBPV', 'Providenciales International Airport', 'Turks and Caicos', 'TC', 21.7737, -72.2655, 15, 7999, true, 700, true),
  ('MYGF', 'Grand Bahama International Airport', 'Freeport', 'BS', 26.5587, -78.6956, 7, 11020, true, 700, true),
  ('MDPP', 'Gregorio Luperón International Airport', 'Puerto Plata', 'DO', 19.758, -70.5701, 15, 9843, true, 600, true),
  ('TJSJ', 'Luis Muñoz Marín International Airport', 'San Juan', 'PR', 18.4394, -66.0018, 9, 10002, true, 700, true)
on conflict (icao) do nothing;
