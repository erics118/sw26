-- ============================================================
-- COMPREHENSIVE TESTING DATA
-- Run AFTER reset.sql. Adds: extra clients, historical completed
-- flights, post-flight learning, confirmed bookings, quote
-- lifecycle (all statuses), quote_costs, maintenance, forecast
-- overrides, route_plans, audit_logs.
-- ============================================================

DO $$
DECLARE
  -- Aircraft IDs (from reset.sql)
  c_tp  uuid := '2a7f4c1e-8b3d-4f6a-9c2e-5d1b7a3f9e4c'; -- N114PC turboprop
  c_l1  uuid := '6e3b9d5f-1c4a-4b7d-8e2f-3a9c6b1d4e7f'; -- N388CJ light
  c_l2  uuid := '4c1d8f6a-7e2b-4d9c-a5f3-8b4e1c7d2f9a'; -- N512PE light
  c_m1  uuid := '8b5e2f9c-3d7a-4e1b-b6c4-2f8a5d3e7c1b'; -- N744XL midsize
  c_m2  uuid := '1f9c4a7e-6b2d-4c8f-a3e5-7d1f9c4a6b2e'; -- N291HK midsize
  c_m3  uuid := '5a2d7f1c-9e4b-4a6d-8c1f-3b7a5d2f9c4e'; -- N603LA midsize
  c_sm  uuid := '9c6f3a4d-2e8b-4d1c-b7f5-4a9c2e6f8d1b'; -- N177CR super-mid
  c_h1  uuid := '3d1b8e5f-7c2a-4f9b-a4d6-1e3f7c9b5a2d'; -- N830GV heavy
  c_h2  uuid := '7f4a2c9e-1d6b-4e3f-9a7c-5b2e8f4a1d6c'; -- N495CL heavy
  c_ul  uuid := '1b6d4e8f-5c3a-4b7d-8e2f-9c1b6d4e5f3a'; -- N741GX ultra-long

  -- Existing clients (from reset.sql)
  c_cl1 uuid := '4e8f2a7c-1b5d-4c9e-a3f6-7d4e2a8f1b5c'; -- James Whitfield
  c_cl2 uuid := '8c1f5d3a-7e4b-4d2f-b8a1-3c8f5d1a7e4b'; -- Priya Nair
  c_cl3 uuid := '2d9a6f4e-3c8b-4a1d-9f5e-6b2d9a4f3c8e'; -- Marcus Stein
  c_cl4 uuid := '6a3e1f9c-5d7b-4e4a-a2c8-9f6a3e1d5c7b'; -- Sofia Castellanos
  c_cl5 uuid := '9f7b5c2d-8a4e-4f3b-b9d1-5c7f2b8a4e3d'; -- Derek Okonkwo

  -- New clients for testing (created in Section 1)
  c_cl6 uuid := gen_random_uuid();
  c_cl7 uuid := gen_random_uuid();
  c_cl8 uuid := gen_random_uuid();
  c_cl9 uuid := gen_random_uuid();
  c_cl10 uuid := gen_random_uuid();

  v_tid uuid;
  v_qid uuid;
  r record;
BEGIN

-- ════════════════════════════════════════════════════════════
-- SECTION 1: EXTRA CLIENTS (for variety: VIP, risk, nationals)
-- ════════════════════════════════════════════════════════════

INSERT INTO clients (id, name, company, email, phone, nationality, vip, risk_flag, notes) VALUES
  (c_cl6, 'Alex Chen', 'TechVenture Inc', 'alex@techventure.com', '+1 (650) 555-0123', 'US', true, false, 'Tech CEO, West Coast, prefers light aircraft'),
  (c_cl7, 'Maria Santos', 'Oceanview Resort', 'maria@oceanview.com', '+1 (561) 555-0456', 'BR', false, false, 'Resort owner, Caribbean trips, groups 4-6'),
  (c_cl8, 'David Goldman', 'Apex Capital', 'dgoldman@apexcap.com', '+1 (212) 555-0789', 'US', true, false, 'Hedge fund, NYC, same-day flights common'),
  (c_cl9, 'Robert Knight', 'Knight Sports Group', 'rk@knightsports.com', '+1 (214) 555-0234', 'US', true, true, 'Sports team owner, 12+ pax, payment delays history'),
  (c_cl10, 'Hassan Al-Maktoum', 'Gulf Energy Co', 'hassan@gulfenergy.ae', '+971 50 555-0567', 'AE', true, false, 'Oil exec, ultra-long international, premium only');

-- ════════════════════════════════════════════════════════════
-- SECTION 0: PRE-HISTORY (Oct 15–Nov 25, 2025)
-- 6 weeks of completed flights for forecast model training.
-- Learning tab needs history in [today-132, today-90] to produce predictions.
-- ════════════════════════════════════════════════════════════

-- Turboprop: Thu/Fri/Sat
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2025-10-15'::date, '2025-11-25'::date, '1 day') gs
LOOP
  IF r.dow IN (4, 5, 6) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl1, ('[{"from_icao":"KVNY","to_icao":"KLAS","date":"' || r.dt || '","time":"09:00"}]')::jsonb, 'one_way', 3);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl1, c_tp, 'completed', 'turboprop', 18,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 11:18:00+00')::timestamptz, 2.1, 1.0, 3.1,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 11:06:00+00')::timestamptz, 2.1);
  END IF;
END LOOP;

-- Light N388CJ: Mon, Wed–Sat
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2025-10-15'::date, '2025-11-25'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 3, 4, 5, 6) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl2, ('[{"from_icao":"KBUR","to_icao":"KLAX","date":"' || r.dt || '","time":"10:00"}]')::jsonb, 'one_way', 4);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl2, c_l1, 'completed', 'light', 20,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 11:42:00+00')::timestamptz, 1.7, 0.3, 2.0,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 11:48:00+00')::timestamptz, 1.8);
  END IF;
END LOOP;

-- Light N512PE: Mon–Sat
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2025-10-15'::date, '2025-11-25'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5, 6) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl6, ('[{"from_icao":"KSFO","to_icao":"KLAS","date":"' || r.dt || '","time":"08:00"}]')::jsonb, 'one_way', 3);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl6, c_l2, 'completed', 'light', 22,
        (r.dt || ' 08:00:00+00')::timestamptz, (r.dt || ' 10:18:00+00')::timestamptz, 2.3, 0.2, 2.5,
        (r.dt || ' 08:00:00+00')::timestamptz, (r.dt || ' 10:12:00+00')::timestamptz, 2.2);
  END IF;
END LOOP;

-- Midsize N744XL, N291HK, N603LA: Mon–Fri (all three)
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2025-10-15'::date, '2025-11-25'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl1, ('[{"from_icao":"KLAX","to_icao":"KORD","date":"' || r.dt || '","time":"09:00"}]')::jsonb, 'one_way', 6);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl1, c_m1, 'completed', 'midsize', 20,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 13:00:00+00')::timestamptz, 3.6, 0.4, 4.0,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:36:00+00')::timestamptz, 3.6);
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl5, ('[{"from_icao":"KTEB","to_icao":"KMIA","date":"' || r.dt || '","time":"11:00"}]')::jsonb, 'one_way', 5);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl5, c_m2, 'completed', 'midsize', 18,
        (r.dt || ' 11:00:00+00')::timestamptz, (r.dt || ' 14:12:00+00')::timestamptz, 3.0, 0.3, 3.3,
        (r.dt || ' 11:00:00+00')::timestamptz, (r.dt || ' 14:00:00+00')::timestamptz, 3.0);
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl4, ('[{"from_icao":"KMDW","to_icao":"KLAX","date":"' || r.dt || '","time":"08:30"}]')::jsonb, 'one_way', 7);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl4, c_m3, 'completed', 'midsize', 22,
        (r.dt || ' 08:30:00+00')::timestamptz, (r.dt || ' 12:06:00+00')::timestamptz, 3.4, 0.3, 3.7,
        (r.dt || ' 08:30:00+00')::timestamptz, (r.dt || ' 12:06:00+00')::timestamptz, 3.4);
  END IF;
END LOOP;

-- Super-mid N177CR: Mon–Fri
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2025-10-15'::date, '2025-11-25'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl3, ('[{"from_icao":"KORD","to_icao":"KMIA","date":"' || r.dt || '","time":"10:00"}]')::jsonb, 'one_way', 8);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl3, c_sm, 'completed', 'super-mid', 21,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:18:00+00')::timestamptz, 3.1, 0.4, 3.5,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:06:00+00')::timestamptz, 3.1);
  END IF;
END LOOP;

-- Heavy N830GV: Mon, Thu; N495CL: Mon, Wed, Fri, Sat
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2025-10-15'::date, '2025-11-25'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 4) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl3, ('[{"from_icao":"KMIA","to_icao":"KTEB","date":"' || r.dt || '","time":"10:00"}]')::jsonb, 'one_way', 10);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl3, c_h1, 'completed', 'heavy', 23,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:30:00+00')::timestamptz, 3.2, 1.5, 4.7,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:12:00+00')::timestamptz, 3.2);
  END IF;
  IF r.dow IN (1, 3, 5, 6) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl1, ('[{"from_icao":"KJFK","to_icao":"KLAX","date":"' || r.dt || '","time":"09:00"}]')::jsonb, 'one_way', 9);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl1, c_h2, 'completed', 'heavy', 24,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:42:00+00')::timestamptz, 3.5, 0.5, 4.0,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:30:00+00')::timestamptz, 3.5);
  END IF;
END LOOP;

-- Ultra-long N741GX: Fri only
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2025-10-15'::date, '2025-11-25'::date, '1 day') gs
LOOP
  IF r.dow = 5 THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl3, ('[{"from_icao":"KBOS","to_icao":"EGLL","date":"' || r.dt || '","time":"21:00"}]')::jsonb, 'one_way', 12);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl3, c_ul, 'completed', 'ultra-long', 25,
        (r.dt || ' 21:00:00+00')::timestamptz, ((r.dt + 1) || ' 04:42:00+00')::timestamptz, 7.7, 0.5, 8.2,
        (r.dt || ' 21:00:00+00')::timestamptz, ((r.dt + 1) || ' 04:42:00+00')::timestamptz, 7.7);
  END IF;
END LOOP;

-- ════════════════════════════════════════════════════════════
-- SECTION 2: HISTORICAL COMPLETED FLIGHTS (Jan 10–Feb 20, 2026)
-- Utilization mix: some underutilized, most healthy, one overconstrained
-- ════════════════════════════════════════════════════════════

-- Turboprop N114PC: Thu/Fri/Sat only, ~45% util (underutilized)
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (4, 5, 6) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl1, ('[{"from_icao":"KVNY","to_icao":"KLAS","date":"' || r.dt || '","time":"09:00"}]')::jsonb, 'one_way', 3);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl1, c_tp, 'completed', 'turboprop', 18,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 11:18:00+00')::timestamptz, 2.1, 1.0, 3.1,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 11:06:00+00')::timestamptz, 2.1);
  END IF;
END LOOP;

-- Light N388CJ: Mon, Wed–Sat, ~55% util (underutilized)
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 3, 4, 5, 6) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl2, ('[{"from_icao":"KBUR","to_icao":"KLAX","date":"' || r.dt || '","time":"10:00"}]')::jsonb, 'one_way', 4);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl2, c_l1, 'completed', 'light', 20,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 11:42:00+00')::timestamptz, 1.7, 0.3, 2.0,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 11:48:00+00')::timestamptz, 1.8);
  END IF;
END LOOP;

-- Light N512PE: Mon–Sat, ~68% util (healthy)
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5, 6) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl6, ('[{"from_icao":"KSFO","to_icao":"KLAS","date":"' || r.dt || '","time":"08:00"}]')::jsonb, 'one_way', 3);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl6, c_l2, 'completed', 'light', 22,
        (r.dt || ' 08:00:00+00')::timestamptz, (r.dt || ' 10:18:00+00')::timestamptz, 2.3, 0.2, 2.5,
        (r.dt || ' 08:00:00+00')::timestamptz, (r.dt || ' 10:12:00+00')::timestamptz, 2.2);
  END IF;
END LOOP;

-- Midsize N744XL: Mon–Fri, ~72% util (healthy)
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl1, ('[{"from_icao":"KLAX","to_icao":"KORD","date":"' || r.dt || '","time":"09:00"}]')::jsonb, 'one_way', 6);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl1, c_m1, 'completed', 'midsize', 20,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 13:00:00+00')::timestamptz, 3.6, 0.4, 4.0,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:36:00+00')::timestamptz, 3.6);
  END IF;
END LOOP;

-- Midsize N291HK: Mon–Fri, ~65% util (healthy)
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl5, ('[{"from_icao":"KTEB","to_icao":"KMIA","date":"' || r.dt || '","time":"11:00"}]')::jsonb, 'one_way', 5);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl5, c_m2, 'completed', 'midsize', 18,
        (r.dt || ' 11:00:00+00')::timestamptz, (r.dt || ' 14:12:00+00')::timestamptz, 3.0, 0.3, 3.3,
        (r.dt || ' 11:00:00+00')::timestamptz, (r.dt || ' 14:00:00+00')::timestamptz, 3.0);
  END IF;
END LOOP;

-- Midsize N603LA: every day, ~92% util (overconstrained)
FOR r IN SELECT (gs::date) AS dt FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  v_tid := gen_random_uuid();
  INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
    (v_tid, c_cl4, ('[{"from_icao":"KMDW","to_icao":"KLAX","date":"' || r.dt || '","time":"08:30"}]')::jsonb, 'one_way', 7);
  INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
    actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
    scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
    (v_tid, c_cl4, c_m3, 'completed', 'midsize', 22,
      (r.dt || ' 08:30:00+00')::timestamptz, (r.dt || ' 12:06:00+00')::timestamptz, 3.4, 0.3, 3.7,
      (r.dt || ' 08:30:00+00')::timestamptz, (r.dt || ' 12:06:00+00')::timestamptz, 3.4);
END LOOP;

-- Super-mid N177CR: Mon–Fri, ~75% util (healthy)
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl3, ('[{"from_icao":"KORD","to_icao":"KMIA","date":"' || r.dt || '","time":"10:00"}]')::jsonb, 'one_way', 8);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl3, c_sm, 'completed', 'super-mid', 21,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:18:00+00')::timestamptz, 3.1, 0.4, 3.5,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:06:00+00')::timestamptz, 3.1);
  END IF;
END LOOP;

-- Heavy N830GV: Mon, Thu, high reposition (~52% util, inefficient)
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 4) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl3, ('[{"from_icao":"KMIA","to_icao":"KTEB","date":"' || r.dt || '","time":"10:00"}]')::jsonb, 'one_way', 10);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl3, c_h1, 'completed', 'heavy', 23,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:30:00+00')::timestamptz, 3.2, 1.8, 5.0,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:12:00+00')::timestamptz, 3.2);
  END IF;
END LOOP;

-- Heavy N495CL: Mon, Wed, Fri, Sat, ~78% util (healthy)
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 3, 5, 6) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl1, ('[{"from_icao":"KJFK","to_icao":"KLAX","date":"' || r.dt || '","time":"09:00"}]')::jsonb, 'one_way', 9);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl1, c_h2, 'completed', 'heavy', 24,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:42:00+00')::timestamptz, 3.5, 0.5, 4.0,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:30:00+00')::timestamptz, 3.5);
  END IF;
END LOOP;

-- Ultra-long N741GX: Fri only, ~35% util (underutilized)
FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow = 5 THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl3, ('[{"from_icao":"KBOS","to_icao":"EGLL","date":"' || r.dt || '","time":"21:00"}]')::jsonb, 'one_way', 12);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl3, c_ul, 'completed', 'ultra-long', 25,
        (r.dt || ' 21:00:00+00')::timestamptz, ((r.dt + 1) || ' 04:42:00+00')::timestamptz, 7.7, 0.5, 8.2,
        (r.dt || ' 21:00:00+00')::timestamptz, ((r.dt + 1) || ' 04:42:00+00')::timestamptz, 7.7);
  END IF;
END LOOP;

-- ════════════════════════════════════════════════════════════
-- SECTION 3: POST-FLIGHT LEARNING (15–25 delay events, all 6 codes)
-- weather 5–6, atc 3–4, mechanical 2–3, crew 2–3, client 1–2, other 1–2
-- Spread Jan–Feb 2026, mix of categories, 0.5–4 hrs lost per flight
-- ════════════════════════════════════════════════════════════

-- weather (6 events, 15–25 hrs total)
v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl8, '[{"from_icao":"KJFK","to_icao":"KMIA","date":"2026-01-15","time":"08:00"}]'::jsonb, 'one_way', 4);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl8, c_m1, 'completed', 'midsize', 20,
    '2026-01-15 09:00:00+00'::timestamptz, '2026-01-15 13:24:00+00'::timestamptz, 4.0, 0.2, 4.2, 'weather',
    '2026-01-15 08:00:00+00'::timestamptz, '2026-01-15 11:36:00+00'::timestamptz, 3.6);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl6, '[{"from_icao":"KSFO","to_icao":"KLAS","date":"2026-01-22","time":"08:00"}]'::jsonb, 'one_way', 3);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl6, c_l2, 'completed', 'light', 22,
    '2026-01-22 09:30:00+00'::timestamptz, '2026-01-22 12:18:00+00'::timestamptz, 2.8, 0.2, 3.0, 'weather',
    '2026-01-22 08:00:00+00'::timestamptz, '2026-01-22 10:12:00+00'::timestamptz, 2.2);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl1, '[{"from_icao":"KJFK","to_icao":"KLAX","date":"2026-02-01","time":"09:00"}]'::jsonb, 'one_way', 9);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl1, c_h2, 'completed', 'heavy', 24,
    '2026-02-01 10:30:00+00'::timestamptz, '2026-02-01 14:18:00+00'::timestamptz, 3.8, 0.5, 4.3, 'weather',
    '2026-02-01 09:00:00+00'::timestamptz, '2026-02-01 12:30:00+00'::timestamptz, 3.5);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl5, '[{"from_icao":"KTEB","to_icao":"KMIA","date":"2026-02-08","time":"11:00"}]'::jsonb, 'one_way', 5);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl5, c_m2, 'completed', 'midsize', 18,
    '2026-02-08 12:00:00+00'::timestamptz, '2026-02-08 15:36:00+00'::timestamptz, 3.6, 0.3, 3.9, 'weather',
    '2026-02-08 11:00:00+00'::timestamptz, '2026-02-08 14:00:00+00'::timestamptz, 3.0);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl8, '[{"from_icao":"KJFK","to_icao":"KMIA","date":"2026-02-15","time":"08:00"}]'::jsonb, 'one_way', 4);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl8, c_m1, 'completed', 'midsize', 20,
    '2026-02-15 09:30:00+00'::timestamptz, '2026-02-15 13:20:00+00'::timestamptz, 3.7, 0.2, 3.9, 'weather',
    '2026-02-15 08:00:00+00'::timestamptz, '2026-02-15 11:36:00+00'::timestamptz, 3.6);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl2, '[{"from_icao":"KBUR","to_icao":"KLAX","date":"2026-02-18","time":"10:00"}]'::jsonb, 'one_way', 4);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl2, c_l1, 'completed', 'light', 20,
    '2026-02-18 11:15:00+00'::timestamptz, '2026-02-18 13:00:00+00'::timestamptz, 1.75, 0.3, 2.05, 'weather',
    '2026-02-18 10:00:00+00'::timestamptz, '2026-02-18 11:48:00+00'::timestamptz, 1.8);

-- atc (4 events)
v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl4, '[{"from_icao":"KORD","to_icao":"KTEB","date":"2026-02-10","time":"07:00"}]'::jsonb, 'one_way', 6);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl4, c_sm, 'completed', 'super-mid', 21,
    '2026-02-10 08:15:00+00'::timestamptz, '2026-02-10 11:50:00+00'::timestamptz, 3.2, 0.3, 3.5, 'atc',
    '2026-02-10 07:00:00+00'::timestamptz, '2026-02-10 10:24:00+00'::timestamptz, 3.2);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl3, '[{"from_icao":"KORD","to_icao":"KMIA","date":"2026-01-20","time":"10:00"}]'::jsonb, 'one_way', 8);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl3, c_sm, 'completed', 'super-mid', 21,
    '2026-01-20 11:00:00+00'::timestamptz, '2026-01-20 14:24:00+00'::timestamptz, 3.4, 0.4, 3.8, 'atc',
    '2026-01-20 10:00:00+00'::timestamptz, '2026-01-20 13:06:00+00'::timestamptz, 3.1);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl1, '[{"from_icao":"KLAX","to_icao":"KORD","date":"2026-01-28","time":"09:00"}]'::jsonb, 'one_way', 6);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl1, c_m1, 'completed', 'midsize', 20,
    '2026-01-28 10:15:00+00'::timestamptz, '2026-01-28 14:21:00+00'::timestamptz, 4.1, 0.4, 4.5, 'atc',
    '2026-01-28 09:00:00+00'::timestamptz, '2026-01-28 12:36:00+00'::timestamptz, 3.6);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl7, '[{"from_icao":"KLAS","to_icao":"KMIA","date":"2026-02-14","time":"10:00"}]'::jsonb, 'one_way', 4);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl7, c_l2, 'completed', 'light', 20,
    '2026-02-14 11:30:00+00'::timestamptz, '2026-02-14 14:48:00+00'::timestamptz, 3.3, 0.2, 3.5, 'atc',
    '2026-02-14 10:00:00+00'::timestamptz, '2026-02-14 13:18:00+00'::timestamptz, 3.0);

-- mechanical (3 events)
v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl5, '[{"from_icao":"KMIA","to_icao":"KJFK","date":"2026-02-12","time":"14:00"}]'::jsonb, 'one_way', 5);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl5, c_h2, 'completed', 'heavy', 22,
    '2026-02-12 15:45:00+00'::timestamptz, '2026-02-12 19:30:00+00'::timestamptz, 3.5, 0.2, 3.7, 'mechanical',
    '2026-02-12 14:00:00+00'::timestamptz, '2026-02-12 17:30:00+00'::timestamptz, 3.5);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl4, '[{"from_icao":"KMDW","to_icao":"KLAX","date":"2026-01-18","time":"08:30"}]'::jsonb, 'one_way', 7);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl4, c_m3, 'completed', 'midsize', 22,
    '2026-01-18 10:00:00+00'::timestamptz, '2026-01-18 13:48:00+00'::timestamptz, 3.8, 0.3, 4.1, 'mechanical',
    '2026-01-18 08:30:00+00'::timestamptz, '2026-01-18 12:06:00+00'::timestamptz, 3.4);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl3, '[{"from_icao":"KMIA","to_icao":"KTEB","date":"2026-02-05","time":"10:00"}]'::jsonb, 'one_way', 10);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl3, c_h1, 'completed', 'heavy', 23,
    '2026-02-05 12:30:00+00'::timestamptz, '2026-02-05 16:06:00+00'::timestamptz, 3.6, 1.5, 5.1, 'mechanical',
    '2026-02-05 10:00:00+00'::timestamptz, '2026-02-05 13:12:00+00'::timestamptz, 3.2);

-- crew (3 events)
v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl8, '[{"from_icao":"KJFK","to_icao":"KLAX","date":"2026-01-25","time":"08:00"}]'::jsonb, 'one_way', 5);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl8, c_m1, 'completed', 'midsize', 20,
    '2026-01-25 09:45:00+00'::timestamptz, '2026-01-25 13:45:00+00'::timestamptz, 4.0, 0.2, 4.2, 'crew',
    '2026-01-25 08:00:00+00'::timestamptz, '2026-01-25 12:00:00+00'::timestamptz, 4.0);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl6, '[{"from_icao":"KSFO","to_icao":"KTEB","date":"2026-02-03","time":"06:00"}]'::jsonb, 'one_way', 3);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl6, c_l2, 'completed', 'light', 20,
    '2026-02-03 07:30:00+00'::timestamptz, '2026-02-03 11:12:00+00'::timestamptz, 3.7, 0.3, 4.0, 'crew',
    '2026-02-03 06:00:00+00'::timestamptz, '2026-02-03 09:42:00+00'::timestamptz, 3.7);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl9, '[{"from_icao":"KMIA","to_icao":"KORD","date":"2026-02-17","time":"09:00"}]'::jsonb, 'one_way', 10);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl9, c_sm, 'completed', 'super-mid', 22,
    '2026-02-17 10:15:00+00'::timestamptz, '2026-02-17 13:33:00+00'::timestamptz, 3.3, 0.4, 3.7, 'crew',
    '2026-02-17 09:00:00+00'::timestamptz, '2026-02-17 12:18:00+00'::timestamptz, 3.1);

-- client (2 events)
v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl2, '[{"from_icao":"KSFO","to_icao":"KLAX","date":"2026-01-12","time":"12:00"}]'::jsonb, 'one_way', 2);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl2, c_l1, 'completed', 'light', 22,
    '2026-01-12 13:00:00+00'::timestamptz, '2026-01-12 14:00:00+00'::timestamptz, 1.0, 0.2, 1.2, 'client',
    '2026-01-12 12:00:00+00'::timestamptz, '2026-01-12 12:48:00+00'::timestamptz, 0.8);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl10, '[{"from_icao":"OMDB","to_icao":"EGLL","date":"2026-02-07","time":"20:00"}]'::jsonb, 'one_way', 8);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl10, c_ul, 'completed', 'ultra-long', 25,
    '2026-02-07 21:30:00+00'::timestamptz, '2026-02-08 05:18:00+00'::timestamptz, 7.8, 0.5, 8.3, 'client',
    '2026-02-07 20:00:00+00'::timestamptz, '2026-02-08 04:42:00+00'::timestamptz, 7.7);

-- other (2 events)
v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl7, '[{"from_icao":"KMIA","to_icao":"KTEB","date":"2026-01-30","time":"14:00"}]'::jsonb, 'one_way', 6);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl7, c_m2, 'completed', 'midsize', 19,
    '2026-01-30 15:00:00+00'::timestamptz, '2026-01-30 18:24:00+00'::timestamptz, 3.4, 0.3, 3.7, 'other',
    '2026-01-30 14:00:00+00'::timestamptz, '2026-01-30 17:00:00+00'::timestamptz, 3.0);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl1, '[{"from_icao":"KLAX","to_icao":"KORD","date":"2026-02-19","time":"09:00"}]'::jsonb, 'one_way', 6);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
  (v_tid, c_cl1, c_m1, 'completed', 'midsize', 20,
    '2026-02-19 10:00:00+00'::timestamptz, '2026-02-19 14:06:00+00'::timestamptz, 4.1, 0.4, 4.5, 'other',
    '2026-02-19 09:00:00+00'::timestamptz, '2026-02-19 12:36:00+00'::timestamptz, 3.6);

-- ════════════════════════════════════════════════════════════
-- SECTION 4: CONFIRMED BOOKINGS (next 14 days)
-- ════════════════════════════════════════════════════════════

FOR r IN SELECT (gs::date) AS dt, EXTRACT(DOW FROM gs)::int AS dow
FROM generate_series('2026-02-21'::date, '2026-03-06'::date, '1 day') gs
LOOP
  IF r.dow IN (4, 5) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl4, ('[{"from_icao":"KVNY","to_icao":"KLAS","date":"' || r.dt || '","time":"09:00"}]')::jsonb, 'one_way', 2);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours, confirmed_at) VALUES
      (v_tid, c_cl4, c_tp, 'confirmed', 'turboprop', 18,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 11:06:00+00')::timestamptz, 2.1, now());
  END IF;
  IF r.dow IN (1, 3, 5, 6) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl7, ('[{"from_icao":"KLAS","to_icao":"KMIA","date":"' || r.dt || '","time":"10:00"}]')::jsonb, 'one_way', 4);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours, confirmed_at) VALUES
      (v_tid, c_cl7, c_l2, 'confirmed', 'light', 20,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:18:00+00')::timestamptz, 3.0, now());
  END IF;
  IF r.dow IN (1, 2, 3, 4, 5) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl8, ('[{"from_icao":"KJFK","to_icao":"KLAX","date":"' || r.dt || '","time":"08:00"}]')::jsonb, 'one_way', 5);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours, confirmed_at) VALUES
      (v_tid, c_cl8, c_m1, 'confirmed', 'midsize', 20,
        (r.dt || ' 08:00:00+00')::timestamptz, (r.dt || ' 12:00:00+00')::timestamptz, 4.0, now());
  END IF;
  IF r.dow IN (2, 4) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl9, ('[{"from_icao":"KMIA","to_icao":"KORD","date":"' || r.dt || '","time":"09:00"}]')::jsonb, 'one_way', 10);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours, confirmed_at) VALUES
      (v_tid, c_cl9, c_sm, 'confirmed', 'super-mid', 22,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:18:00+00')::timestamptz, 3.1, now());
  END IF;
END LOOP;

-- ════════════════════════════════════════════════════════════
-- SECTION 5: QUOTE LIFECYCLE (new, pricing, sent, negotiating, lost)
-- ════════════════════════════════════════════════════════════

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl10, '[{"from_icao":"OMDB","to_icao":"EGLL","date":"2026-03-10","time":"20:00"}]'::jsonb, 'one_way', 8);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, margin_pct) VALUES
  (v_tid, c_cl10, c_ul, 'new', 25);

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl6, '[{"from_icao":"KSFO","to_icao":"KTEB","date":"2026-03-05","time":"06:00"}]'::jsonb, 'one_way', 3);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, margin_pct, notes) VALUES
  (v_tid, c_cl6, c_l2, 'pricing', 20, 'Calculating fuel/crew costs');

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl7, '[{"from_icao":"KMIA","to_icao":"KTEB","date":"2026-03-02","time":"14:00"}]'::jsonb, 'one_way', 6);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, margin_pct, sent_at) VALUES
  (v_tid, c_cl7, c_m2, 'sent', 19, now() - interval '2 days');

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl9, '[{"from_icao":"KORD","to_icao":"KLAX","date":"2026-03-08","time":"07:00"}]'::jsonb, 'one_way', 12);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, version, margin_pct, sent_at, notes) VALUES
  (v_tid, c_cl9, c_sm, 'negotiating', 2, 17, now() - interval '3 days', 'Client wants discount');

v_tid := gen_random_uuid();
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (v_tid, c_cl2, '[{"from_icao":"KSFO","to_icao":"KLAX","date":"2026-02-28","time":"12:00"}]'::jsonb, 'one_way', 2);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, margin_pct, sent_at, notes, won_lost_reason) VALUES
  (v_tid, c_cl2, c_l1, 'lost', 22, now() - interval '5 days', 'Lost to competitor', 'competitor');

-- ════════════════════════════════════════════════════════════
-- SECTION 6: QUOTE COSTS (for sent/negotiating from Section 5)
-- ════════════════════════════════════════════════════════════

INSERT INTO quote_costs (quote_id, fuel_cost, fbo_fees, repositioning_cost, repositioning_hours, subtotal, margin_amount, tax, total, per_leg_breakdown)
SELECT q.id, 4200, 800, 600, 0.5, 5600, 1064, 0, 6664,
  '[{"leg":"KMIA→KTEB","flight_hours":2.8,"fuel_cost":4200,"fbo_fees":800,"subtotal":5000}]'
FROM quotes q
JOIN trips t ON t.id = q.trip_id
WHERE q.client_id = c_cl7 AND q.status = 'sent' AND t.legs::text LIKE '%KMIA%' AND t.legs::text LIKE '%KTEB%'
ORDER BY q.created_at DESC LIMIT 1;

INSERT INTO quote_costs (quote_id, fuel_cost, fbo_fees, repositioning_cost, repositioning_hours, subtotal, margin_amount, tax, total, per_leg_breakdown)
SELECT q.id, 18500, 2400, 1800, 1.2, 22700, 3859, 0, 26559,
  '[{"leg":"KORD→KLAX","flight_hours":4.2,"fuel_cost":18500,"fbo_fees":2400,"subtotal":20900}]'
FROM quotes q
JOIN trips t ON t.id = q.trip_id
WHERE q.client_id = c_cl9 AND q.status = 'negotiating' AND t.legs::text LIKE '%KLAX%'
ORDER BY q.created_at DESC LIMIT 1;

-- ════════════════════════════════════════════════════════════
-- SECTION 7: AIRCRAFT MAINTENANCE
-- ════════════════════════════════════════════════════════════

-- 1–2 midsize (c_m2, c_m3) overlap Mar 2–3 Spring Break peak to create minor shortages
INSERT INTO aircraft_maintenance (aircraft_id, start_time, end_time, maintenance_type, notes) VALUES
  (c_l2, '2026-03-03 06:00:00+00', '2026-03-05 18:00:00+00', 'inspection', '500-hour inspection'),
  (c_m1, '2026-03-08 08:00:00+00', '2026-03-10 17:00:00+00', 'inspection', '1200-hour phase'),
  (c_m2, '2026-03-02 06:00:00+00', '2026-03-04 18:00:00+00', 'inspection', 'Annual (overlaps Spring Break peak)'),
  (c_m3, '2026-03-02 18:00:00+00', '2026-03-03 06:00:00+00', 'scheduled', 'Turbo seal replacement (Mar 2–3 peak)'),
  (c_sm, '2026-03-01 08:00:00+00', '2026-03-02 17:00:00+00', 'inspection', '1000-hour + avionics'),
  (c_h1, '2026-02-22 00:00:00+00', '2026-02-25 23:59:00+00', 'overhaul', 'Engine hot-section'),
  (c_ul, '2026-03-09 06:00:00+00', '2026-03-15 22:00:00+00', 'overhaul', '2000-hour inspection');

-- ════════════════════════════════════════════════════════════
-- SECTION 8: FLEET FORECAST OVERRIDES
-- ════════════════════════════════════════════════════════════

INSERT INTO fleet_forecast_overrides (date, aircraft_category, peak_multiplier, reason) VALUES
  ('2026-03-01', 'light', 1.45, 'Spring break begins'),
  ('2026-03-02', 'all', 1.55, 'Spring break peak'),
  ('2026-03-03', 'midsize', 1.50, 'Spring break extended families'),
  ('2026-02-24', 'midsize', 1.32, 'Post-weekend business'),
  ('2026-02-25', 'midsize', 1.28, 'Mid-week business demand'),
  ('2026-03-04', 'all', 1.25, 'Easter prep travel'),
  ('2026-03-05', 'light', 1.35, 'Easter long-weekend'),
  ('2026-02-23', 'turboprop', 0.75, 'Sunday low demand'),
  ('2026-02-26', 'heavy', 0.80, 'Wednesday slump'),
  ('2026-03-06', 'light', 1.28, 'Friday TGIF leisure'),
  ('2026-02-27', 'midsize', 1.24, 'Friday departures')
ON CONFLICT (date, aircraft_category) DO UPDATE
  SET peak_multiplier = EXCLUDED.peak_multiplier, reason = EXCLUDED.reason;

-- ════════════════════════════════════════════════════════════
-- SECTION 9: ROUTE PLANS (for a sent and a confirmed quote)
-- ════════════════════════════════════════════════════════════

INSERT INTO route_plans (quote_id, trip_id, aircraft_id, optimization_mode, route_legs, refuel_stops, weather_summary, notam_alerts, alternatives,
  total_distance_nm, total_flight_time_hr, total_fuel_cost, risk_score, on_time_probability, is_stale)
SELECT q.id, q.trip_id, q.aircraft_id, 'balanced',
  '[{"from_icao":"KMIA","to_icao":"KTEB","distance_nm":1050,"flight_time_hr":2.8}]'::jsonb,
  '[]'::jsonb,
  '[{"icao":"KMIA","go_nogo":"go","ceiling_ft":5000,"visibility_mi":10},{"icao":"KTEB","go_nogo":"go","ceiling_ft":4500,"visibility_mi":8}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb,
  1050, 2.8, 4200, 12, 0.94, false
FROM quotes q
JOIN trips t ON t.id = q.trip_id
WHERE q.client_id = c_cl7 AND q.status = 'sent' AND t.legs::text LIKE '%KTEB%'
ORDER BY q.created_at DESC LIMIT 1;

INSERT INTO route_plans (quote_id, trip_id, aircraft_id, optimization_mode, route_legs, refuel_stops, weather_summary, notam_alerts, alternatives,
  total_distance_nm, total_flight_time_hr, total_fuel_cost, risk_score, on_time_probability, is_stale)
SELECT q.id, q.trip_id, q.aircraft_id, 'time',
  '[{"from_icao":"KVNY","to_icao":"KLAS","distance_nm":228,"flight_time_hr":2.1}]'::jsonb,
  '[]'::jsonb,
  '[{"icao":"KVNY","go_nogo":"go"},{"icao":"KLAS","go_nogo":"go"}]'::jsonb,
  '[]'::jsonb, '[]'::jsonb,
  228, 2.1, 1550, 5, 0.98, false
FROM quotes q
JOIN trips t ON t.id = q.trip_id
WHERE q.client_id = c_cl4 AND q.status = 'confirmed' AND t.legs::text LIKE '%KVNY%' AND t.legs::text LIKE '%KLAS%'
ORDER BY q.created_at DESC LIMIT 1;

-- ════════════════════════════════════════════════════════════
-- SECTION 10: AUDIT LOGS (sample actions for testing)
-- ════════════════════════════════════════════════════════════

INSERT INTO audit_logs (action, entity_type, entity_id, payload, ai_generated, human_verified) VALUES
  ('client.created', 'clients', c_cl6, '{"name":"Alex Chen","company":"TechVenture Inc"}'::jsonb, false, true),
  ('trip.created', 'trips', NULL, '{"source":"intake","legs":1}'::jsonb, true, false),
  ('quote.sent', 'quotes', NULL, '{"status":"sent","margin_pct":19}'::jsonb, false, true),
  ('quote.completed', 'quotes', NULL, '{"delay_reason_code":"weather"}'::jsonb, false, true),
  ('forecast.override_applied', 'fleet_forecast_overrides', NULL, '{"date":"2026-03-02","category":"all","multiplier":1.55}'::jsonb, false, true);

END $$;
