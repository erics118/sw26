-- ============================================================
-- FULL DATABASE RESET
-- Drops all tables, recreates schema, and seeds with stable UUIDs.
-- Run via: npm run db:reset
-- WARNING: destroys all existing data.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ── Drop tables (reverse FK order) ───────────────────────────────────────────

drop table if exists audit_logs cascade;
drop table if exists quote_costs cascade;
drop table if exists quotes cascade;
drop table if exists trips cascade;
drop table if exists crew cascade;
drop table if exists aircraft cascade;
drop table if exists clients cascade;
drop table if exists operators cascade;

-- ── Schema ───────────────────────────────────────────────────────────────────

create table operators (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  name text not null,
  cert_number text,
  cert_expiry date,
  insurance_expiry date,
  reliability_score numeric(3,1) default 5.0,
  blacklisted boolean default false,
  notes text
);

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
  operator_id uuid references operators(id),
  category text not null,
  range_nm integer not null,
  cabin_height_in numeric(4,1),
  pax_capacity integer not null,
  fuel_burn_gph numeric(6,1),
  has_wifi boolean default false,
  has_bathroom boolean default false,
  home_base_icao text,
  notes text
);

create table crew (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  operator_id uuid references operators(id),
  name text not null,
  role text not null,
  ratings text[],
  duty_hours_this_week numeric(4,1) default 0,
  last_duty_end timestamptz
);

create table trips (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  client_id uuid references clients(id),
  raw_input text,
  legs jsonb not null default '[]',
  trip_type text not null default 'one_way',
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
  ai_confidence jsonb
);

create table quotes (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  trip_id uuid references trips(id) not null,
  client_id uuid references clients(id),
  aircraft_id uuid references aircraft(id),
  operator_id uuid references operators(id),
  status text not null default 'new',
  version integer default 1,
  margin_pct numeric(5,2) default 15.0,
  currency text default 'USD',
  broker_name text,
  broker_commission_pct numeric(5,2),
  notes text,
  sent_at timestamptz,
  confirmed_at timestamptz
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
  per_leg_breakdown jsonb default '[]',
  operator_quoted_rate numeric(10,2)
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

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table clients enable row level security;
alter table operators enable row level security;
alter table aircraft enable row level security;
alter table crew enable row level security;
alter table trips enable row level security;
alter table quotes enable row level security;
alter table quote_costs enable row level security;
alter table audit_logs enable row level security;

create policy "staff_all" on clients     for all using (auth.role() = 'authenticated');
create policy "staff_all" on operators   for all using (auth.role() = 'authenticated');
create policy "staff_all" on aircraft    for all using (auth.role() = 'authenticated');
create policy "staff_all" on crew        for all using (auth.role() = 'authenticated');
create policy "staff_all" on trips       for all using (auth.role() = 'authenticated');
create policy "staff_all" on quotes      for all using (auth.role() = 'authenticated');
create policy "staff_all" on quote_costs for all using (auth.role() = 'authenticated');
create policy "staff_all" on audit_logs  for all using (auth.role() = 'authenticated');

-- ── Operators ────────────────────────────────────────────────────────────────

insert into operators (id, name, cert_number, cert_expiry, insurance_expiry, reliability_score, blacklisted, notes) values
  ('3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b', 'Summit Air Charter',    'D-STMM-2201', '2026-03-15', '2026-01-31', 4.8, false, 'Top-tier Midwest operator, two-crew policy on all legs'),
  ('7c2d9e4f-5a1b-4c8d-a3e7-2f6b9d0e1c4a', 'Coastal Jet Group',     'D-CJGP-1893', '2025-09-30', '2025-11-14', 4.5, false, 'SE fleet, fast turnaround, strong FBO relationships'),
  ('5e1a3c7b-9f2d-4e6a-8b4c-1d7e9f2a5b3c', 'Apex Private Aviation', 'D-APXV-0741', '2025-04-10', '2026-05-22', 3.9, false, 'Cert renewal in progress — verify before booking heavy iron'),
  ('9d4f7a2e-3b6c-4d8a-b5f1-7e2c4a9d6f1b', 'TransAtlantic Air LLC', 'D-TATL-3320', '2026-08-01', '2026-07-15', 4.7, false, 'Specializes in transatlantic and ETOPS-certified routes');

-- ── Aircraft ─────────────────────────────────────────────────────────────────
-- Fixed UUIDs so quotes can reference aircraft directly after a reset.

insert into aircraft (id, tail_number, operator_id, category, range_nm, cabin_height_in, pax_capacity, fuel_burn_gph, has_wifi, has_bathroom, home_base_icao, notes) values
  ('2a7f4c1e-8b3d-4f6a-9c2e-5d1b7a3f9e4c', 'N114PC', '3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b', 'turboprop',  1845, 59.0,  8,  74.0, false, true,  'KVNY', 'Pilatus PC-12 NGX — 2021, workhorse short-haul, no wifi'),
  ('6e3b9d5f-1c4a-4b7d-8e2f-3a9c6b1d4e7f', 'N388CJ', '7c2d9e4f-5a1b-4c8d-a3e7-2f6b9d0e1c4a', 'light',      2040, 57.5,  6,  96.0, false, false, 'KBUR', 'Citation CJ3 — 2014, no lavatory, ideal for quick hops'),
  ('4c1d8f6a-7e2b-4d9c-a5f3-8b4e1c7d2f9a', 'N512PE', '7c2d9e4f-5a1b-4c8d-a3e7-2f6b9d0e1c4a', 'light',      2267, 59.0,  7, 103.0, true,  false, 'KLAS', 'Phenom 300E — 2022, Gogo Avance wifi, enclosed lav'),
  ('8b5e2f9c-3d7a-4e1b-b6c4-2f8a5d3e7c1b', 'N744XL', '3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b', 'midsize',    2100, 68.5,  9, 211.0, true,  true,  'KLAX', 'Citation XLS+ — 2019, full galley, ForeFlight avionics'),
  ('1f9c4a7e-6b2d-4c8f-a3e5-7d1f9c4a6b2e', 'N291HK', '5e1a3c7b-9f2d-4e6a-8b4c-1d7e9f2a5b3c', 'midsize',    2540, 72.0,  8, 230.0, false, true,  'KTEB', 'Hawker 800XP — 2007, classic interior, reliable but no wifi'),
  ('5a2d7f1c-9e4b-4a6d-8c1f-3b7a5d2f9c4e', 'N603LA', '3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b', 'midsize',    2700, 72.0,  9, 218.0, true,  true,  'KMDW', 'Citation Latitude — 2021, flat-floor, dual-zone cabin'),
  ('9c6f3a4d-2e8b-4d1c-b7f5-4a9c2e6f8d1b', 'N177CR', '3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b', 'super-mid',  3200, 73.8, 10, 253.0, true,  true,  'KORD', 'Challenger 350 — 2023, Ka-band wifi, lie-flat seats'),
  ('3d1b8e5f-7c2a-4f9b-a4d6-1e3f7c9b5a2d', 'N830GV', '9d4f7a2e-3b6c-4d8a-b5f1-7e2c4a9d6f1b', 'heavy',      4350, 74.5, 14, 338.0, true,  true,  'KMIA', 'Gulfstream G450 — 2016, full galley, entertainment suite'),
  ('7f4a2c9e-1d6b-4e3f-9a7c-5b2e8f4a1d6c', 'N495CL', '5e1a3c7b-9f2d-4e6a-8b4c-1d7e9f2a5b3c', 'heavy',      4000, 73.5, 12, 295.0, true,  true,  'KJFK', 'Challenger 605 — 2018, club seating + divan, dual-zone'),
  ('1b6d4e8f-5c3a-4b7d-8e2f-9c1b6d4e5f3a', 'N741GX', '9d4f7a2e-3b6c-4d8a-b5f1-7e2c4a9d6f1b', 'ultra-long', 7500, 77.0, 16, 412.0, true,  true,  'KBOS', 'Gulfstream G650ER — 2022, flagship, transatlantic range');

-- ── Clients ───────────────────────────────────────────────────────────────────

insert into clients (id, name, company, email, phone, nationality, vip, risk_flag, notes) values
  ('4e8f2a7c-1b5d-4c9e-a3f6-7d4e2a8f1b5c', 'James Whitfield',   'Acme Corp',            'james@acmecorp.com',       '+1 (310) 555-0192', 'US', true,  false, 'CEO. Prefers midsize+, always requests catering. Loyal repeat client.'),
  ('8c1f5d3a-7e4b-4d2f-b8a1-3c8f5d1a7e4b', 'Priya Nair',        'Horizon Ventures',     'priya.nair@horizonvc.com', '+1 (415) 555-0348', 'US', false, false, 'VC partner. Frequently LA→NYC. Wifi critical, light traveler.'),
  ('2d9a6f4e-3c8b-4a1d-9f5e-6b2d9a4f3c8e', 'Marcus Stein',      NULL,                   'mstein@protonmail.com',    '+49 151 5550198',   'DE', true,  false, 'European HNW. Requests G650 or equivalent for transatlantic routes.'),
  ('6a3e1f9c-5d7b-4e4a-a2c8-9f6a3e1d5c7b', 'Sofia Castellanos', 'Meridian Media Group', 'scastellanos@meridmg.com', '+1 (212) 555-0761', 'US', false, false, 'Marketing exec. Group bookings 6–10 pax, often with tight notice.'),
  ('9f7b5c2d-8a4e-4f3b-b9d1-5c7f2b8a4e3d', 'Derek Okonkwo',     'Okonkwo Capital',      'derek@okonkwocap.com',     '+1 (713) 555-0523', 'US', false, true,  'Payment issues on Q3 booking — require deposit before confirming.');

-- ── Crew (2–3 per operator) ───────────────────────────────────────────────────

insert into crew (id, operator_id, name, role, ratings, duty_hours_this_week) values
  -- Summit Air Charter
  ('2f6a3d8c-7e1b-4c5f-b9a4-8d2f6a3c7e1b', '3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b', 'Captain David Holt',     'captain',          ARRAY['Citation XLS+', 'Challenger 350', 'Citation Latitude'], 12.5),
  ('6c1f8b5a-3d7e-4a2c-9f6b-1e6c1f8a5d7e', '3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b', 'FO Sarah Kimura',        'first_officer',    ARRAY['Citation XLS+', 'Citation Latitude'], 8.0),
  -- Coastal Jet Group
  ('a3e7d2f9-1c5b-4d8a-b7f3-2e9a3d7f1c5b', '7c2d9e4f-5a1b-4c8d-a3e7-2f6b9d0e1c4a', 'Captain Luis Herrera',   'captain',          ARRAY['Citation CJ3', 'Phenom 300E'], 22.0),
  ('e7f4a8c1-9b2d-4f6e-a3c7-8b1e7f4a2d9c', '7c2d9e4f-5a1b-4c8d-a3e7-2f6b9d0e1c4a', 'FO Megan Tran',          'first_officer',    ARRAY['Citation CJ3', 'Phenom 300E'], 18.5),
  ('b4c9e1f8-5a3d-4c2b-9e7f-4a8b9c1f5d3e', '7c2d9e4f-5a1b-4c8d-a3e7-2f6b9d0e1c4a', 'FA Nicole Osei',         'flight_attendant', ARRAY[]::text[], 14.0),
  -- Apex Private Aviation
  ('d8a1f5c4-2e7b-4a9d-b3f8-5c1d8a4f2e7b', '5e1a3c7b-9f2d-4e6a-8b4c-1d7e9f2a5b3c', 'Captain Ray Morales',    'captain',          ARRAY['Hawker 800XP', 'Challenger 605'], 30.0),
  ('f5b7a2e9-4c1d-4b6f-a8d5-2c7f5b9a4e1d', '5e1a3c7b-9f2d-4e6a-8b4c-1d7e9f2a5b3c', 'FO Anita Patel',         'first_officer',    ARRAY['Hawker 800XP'], 25.5),
  -- TransAtlantic Air LLC
  ('c1d9f4a7-8b5e-4d2c-b6a1-9f4c1d7a8e5b', '9d4f7a2e-3b6c-4d8a-b5f1-7e2c4a9d6f1b', 'Captain Erik Johansson', 'captain',          ARRAY['Gulfstream G450', 'Gulfstream G650ER'], 6.0),
  ('a8e2f6d1-3c9b-4e5a-9f2c-7b8a2e6d3c9f', '9d4f7a2e-3b6c-4d8a-b5f1-7e2c4a9d6f1b', 'FO Yuki Tanaka',         'first_officer',    ARRAY['Gulfstream G450', 'Gulfstream G650ER'], 6.0),
  ('f2a6b9e4-7d1c-4f8a-b4e9-1c3f2a6d7b9e', '9d4f7a2e-3b6c-4d8a-b5f1-7e2c4a9d6f1b', 'FA Camille Dubois',      'flight_attendant', ARRAY[]::text[], 6.0);

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

insert into quotes (id, trip_id, client_id, aircraft_id, operator_id, status, version, margin_pct, currency, notes, sent_at, confirmed_at, created_at) values

  -- new: just created, not yet priced
  ('7a4e2c9f-1d8b-4b5a-9e7c-4f2a7e1c8d9b',
   '9c7f4b1e-3a6d-4b9c-a1f8-3e9c7f4b6a1d',
   '9f7b5c2d-8a4e-4f3b-b9d1-5c7f2b8a4e3d',
   '5a2d7f1c-9e4b-4a6d-8c1f-3b7a5d2f9c4e',
   '3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b',
   'new', 1, 20.0, 'USD', NULL, NULL, NULL,
   now() - interval '3 days'),

  -- pricing: cost breakdown being worked
  ('1c8f7a3e-5d2b-4c9f-b6a4-7e1c8f3a2d5b',
   '5f2a8d7b-9e1c-4d6f-b4a9-7d5f2e8a1c9b',
   '6a3e1f9c-5d7b-4e4a-a2c8-9f6a3e1d5c7b',
   '6e3b9d5f-1c4a-4b7d-8e2f-3a9c6b1d4e7f',
   '7c2d9e4f-5a1b-4c8d-a3e7-2f6b9d0e1c4a',
   'pricing', 1, 18.0, 'USD', 'Short hop, Challenger overkill — CJ3 better fit', NULL, NULL,
   now() - interval '4 days'),

  -- sent: quote emailed to client
  ('5d3b1f8c-9e4a-4d7b-a2f5-8c5d3b1f9e4a',
   '7e4c2f9a-1d8b-4a5e-b3f7-4c2e7f9a1d8c',
   '8c1f5d3a-7e4b-4d2f-b8a1-3c8f5d1a7e4b',
   '8b5e2f9c-3d7a-4e1b-b6c4-2f8a5d3e7c1b',
   '3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b',
   'sent', 1, 22.0, 'USD', 'Priya prefers XLS+ for this route', now() - interval '5 days', NULL,
   now() - interval '8 days'),

  -- negotiating: client pushing back on price
  ('9e7d5a2f-3b1c-4e8d-b9f7-2a9e5d7a3c1f',
   '3b8f5a1d-7c4e-4f2b-9a6d-1e3f8c5a7b4d',
   '4e8f2a7c-1b5d-4c9e-a3f6-7d4e2a8f1b5c',
   '9c6f3a4d-2e8b-4d1c-b7f5-4a9c2e6f8d1b',
   '3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b',
   'negotiating', 2, 19.0, 'USD', 'James requested v2 at lower margin. Hold at 19%.', now() - interval '8 days', NULL,
   now() - interval '11 days'),

  -- confirmed: booked and deposit received
  ('3f1a9e6d-7c4b-4f2a-9d3e-6b3f1a9e7c4b',
   '1a9d6f3c-5b2e-4c8a-a7d4-9f1a3c6b5e2d',
   '2d9a6f4e-3c8b-4a1d-9f5e-6b2d9a4f3c8e',
   '1b6d4e8f-5c3a-4b7d-8e2f-9c1b6d4e5f3a',
   '9d4f7a2e-3b6c-4d8a-b5f1-7e2c4a9d6f1b',
   'confirmed', 1, 25.0, 'USD', 'Marcus confirmed. Full deposit received.', now() - interval '4 days', now() - interval '2 days',
   now() - interval '6 days'),

  -- lost: client went with another broker
  ('7b5f3c1a-2e9d-4c6b-a7f3-1a7b5c3f2e9d',
   '8d5c3a7f-2b9e-4f1d-a6b3-9e8d5c3f7a2b',
   '8c1f5d3a-7e4b-4d2f-b8a1-3c8f5d1a7e4b',
   '4c1d8f6a-7e2b-4d9c-a5f3-8b4e1c7d2f9a',
   '7c2d9e4f-5a1b-4c8d-a3e7-2f6b9d0e1c4a',
   'lost', 1, 20.0, 'USD', 'Lost to competitor — Priya said pricing was $400 higher', now() - interval '55 days', NULL,
   now() - interval '58 days'),

  -- completed: flight done, invoiced
  ('2e9c7f4a-6d1b-4a3e-b8c2-4f2e9c7a6d1b',
   '4b1e9f6c-8a5d-4c2b-9e7f-6c4b1a9f8d5e',
   '4e8f2a7c-1b5d-4c9e-a3f6-7d4e2a8f1b5c',
   '8b5e2f9c-3d7a-4e1b-b6c4-2f8a5d3e7c1b',
   '3b7f8a2c-1d4e-4f6a-9b2c-8e1f3a7d5c0b',
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
