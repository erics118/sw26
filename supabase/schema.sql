-- Enable UUID extension
create extension if not exists "uuid-ossp";

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

-- Operators
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

-- Aircraft
create table aircraft (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  tail_number text not null,
  operator_id uuid references operators(id),
  category text not null, -- e.g. 'light', 'midsize', 'super-mid', 'heavy', 'ultra-long'
  range_nm integer not null,
  cabin_height_in numeric(4,1),
  pax_capacity integer not null,
  fuel_burn_gph numeric(6,1),
  has_wifi boolean default false,
  has_bathroom boolean default false,
  home_base_icao text,
  notes text
);

-- Crew
create table crew (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  operator_id uuid references operators(id),
  name text not null,
  role text not null, -- 'captain', 'first_officer', 'flight_attendant'
  ratings text[], -- e.g. ['Citation CJ3', 'Gulfstream G550']
  duty_hours_this_week numeric(4,1) default 0,
  last_duty_end timestamptz
);

-- Trips
create table trips (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  client_id uuid references clients(id),
  raw_input text, -- original email/call text
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
  ai_confidence jsonb -- per-field confidence scores
);

-- Quotes
create table quotes (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  trip_id uuid references trips(id) not null,
  client_id uuid references clients(id),
  aircraft_id uuid references aircraft(id),
  operator_id uuid references operators(id),
  status text not null default 'new', -- 'new','pricing','sent','negotiating','confirmed','lost','completed'
  version integer default 1,
  margin_pct numeric(5,2) default 15.0,
  currency text default 'USD',
  broker_name text,
  broker_commission_pct numeric(5,2),
  notes text,
  sent_at timestamptz,
  confirmed_at timestamptz
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
  per_leg_breakdown jsonb default '[]',
  operator_quoted_rate numeric(10,2)
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

-- RLS: enable on all tables (allow all for staff for MVP)
alter table clients enable row level security;
alter table operators enable row level security;
alter table aircraft enable row level security;
alter table crew enable row level security;
alter table trips enable row level security;
alter table quotes enable row level security;
alter table quote_costs enable row level security;
alter table audit_logs enable row level security;

-- MVP policy: authenticated users can do everything
create policy "staff_all" on clients for all using (auth.role() = 'authenticated');
create policy "staff_all" on operators for all using (auth.role() = 'authenticated');
create policy "staff_all" on aircraft for all using (auth.role() = 'authenticated');
create policy "staff_all" on crew for all using (auth.role() = 'authenticated');
create policy "staff_all" on trips for all using (auth.role() = 'authenticated');
create policy "staff_all" on quotes for all using (auth.role() = 'authenticated');
create policy "staff_all" on quote_costs for all using (auth.role() = 'authenticated');
create policy "staff_all" on audit_logs for all using (auth.role() = 'authenticated');
