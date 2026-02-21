-- Migration 001: Add operational fields
-- Run in Supabase SQL Editor

-- ============================================================
-- TRIPS — request lifecycle fields
-- ============================================================
alter table trips
  add column if not exists request_source          text,           -- 'email' | 'phone' | 'broker' | 'portal'
  add column if not exists requested_departure_window_start timestamptz,
  add column if not exists requested_departure_window_end   timestamptz,
  add column if not exists requested_return_window_start    timestamptz, -- null if one-way
  add column if not exists requested_return_window_end      timestamptz,
  add column if not exists estimated_block_hours       numeric(5,1),  -- system-calculated flight time
  add column if not exists estimated_reposition_hours  numeric(5,1),  -- ferry/reposition time
  add column if not exists estimated_total_hours       numeric(5,1);  -- block + reposition

comment on column trips.request_source                      is 'How the request came in: email, phone, broker, portal';
comment on column trips.estimated_block_hours               is 'Flight time for all legs combined (hours)';
comment on column trips.estimated_reposition_hours          is 'Ferry/repositioning hours (hours)';
comment on column trips.estimated_total_hours               is 'Block + reposition hours';

-- ============================================================
-- QUOTES — full quote/booking/post-flight lifecycle
-- ============================================================
alter table quotes
  -- Quote stage
  add column if not exists quote_valid_until          timestamptz,
  add column if not exists chosen_aircraft_category   text,          -- may differ from trip.preferred_category
  add column if not exists estimated_total_hours      numeric(5,1),  -- copied from trip at quote time
  add column if not exists won_lost_reason            text,          -- 'price' | 'availability' | 'client_cancelled' | 'competitor' | 'other'

  -- Confirmed booking stage
  add column if not exists scheduled_departure_time   timestamptz,
  add column if not exists scheduled_arrival_time     timestamptz,
  add column if not exists scheduled_total_hours      numeric(5,1),

  -- Post-flight actuals
  add column if not exists actual_departure_time      timestamptz,
  add column if not exists actual_arrival_time        timestamptz,
  add column if not exists actual_block_hours         numeric(5,1),
  add column if not exists actual_reposition_hours    numeric(5,1),
  add column if not exists actual_total_hours         numeric(5,1),
  add column if not exists delay_reason_code          text;          -- 'weather' | 'atc' | 'mechanical' | 'crew' | 'client' | 'other'

comment on column quotes.chosen_aircraft_category  is 'Category actually quoted (may differ from client preference)';
comment on column quotes.won_lost_reason           is 'Why the deal was won or lost';
comment on column quotes.delay_reason_code         is 'Post-flight: reason for departure delay if any';

-- ============================================================
-- AIRCRAFT — availability status
-- ============================================================
alter table aircraft
  add column if not exists status               text default 'active',  -- 'active' | 'unavailable'
  add column if not exists daily_available_hours numeric(4,1) default 24;

comment on column aircraft.status                is 'Operational status: active or unavailable';
comment on column aircraft.daily_available_hours is 'Hours per day aircraft is bookable (default 24)';

-- ============================================================
-- CREW — available hours per day
-- ============================================================
alter table crew
  add column if not exists available_hours_per_day numeric(4,1) default 10;

comment on column crew.available_hours_per_day is 'Schedulable hours per day for this crew member';
