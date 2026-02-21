-- ============================================================
-- COMPREHENSIVE TESTING DATA
-- Full dataset covering: clients, aircraft, trips, quotes,
-- fleet forecasting, utilization, and post-flight learning
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

  -- New clients for testing
  c_cl6 uuid := gen_random_uuid(); -- Tech CEO
  c_cl7 uuid := gen_random_uuid(); -- Beach resort owner
  c_cl8 uuid := gen_random_uuid(); -- Hedge fund manager
  c_cl9 uuid := gen_random_uuid(); -- Sports team owner
  c_cl10 uuid := gen_random_uuid(); -- Oil executive

  v_tid uuid;
  r record;
BEGIN

-- ════════════════════════════════════════════════════════════
-- SECTION 1: CREATE NEW CLIENTS FOR TESTING
-- ════════════════════════════════════════════════════════════

INSERT INTO clients (id, name, company, email, phone, nationality, vip, risk_flag, notes) VALUES
  (c_cl6, 'Alex Chen', 'TechVenture Inc', 'alex@techventure.com', '+1 (650) 555-0123', 'US', true, false, 'Tech CEO, heavy West Coast travel, prefers light aircraft'),
  (c_cl7, 'Maria Santos', 'Oceanview Resort', 'maria@oceanview.com', '+1 (561) 555-0456', 'BR', false, false, 'Resort owner, weekend trips to Caribbean, groups of 4-6'),
  (c_cl8, 'David Goldman', 'Apex Capital', 'dgoldman@apexcap.com', '+1 (212) 555-0789', 'US', true, false, 'Hedge fund, NYC-based, urgent same-day flights common'),
  (c_cl9, 'Robert Knight', 'Knight Sports Group', 'rk@knightsports.com', '+1 (214) 555-0234', 'US', true, true, 'Sports team owner, large groups (12+ pax), tight turnarounds, payment delays historical'),
  (c_cl10, 'Hassan Al-Maktoum', 'Gulf Energy Co', 'hassan@gulfenergy.ae', '+971 50 555-0567', 'AE', true, false, 'Oil executive, ultra-long international flights, premium only');

-- ════════════════════════════════════════════════════════════
-- SECTION 2: HISTORICAL COMPLETED FLIGHTS (6 weeks, Jan 10-Feb 20)
-- Heavy data for utilization calculations
-- ════════════════════════════════════════════════════════════

-- TURBOPROP N114PC: 39% utilization (underutilized, inefficient)
FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (4, 5, 6) THEN -- Thu, Fri, Sat only
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl1, '[{"from_icao":"KVNY","to_icao":"KLAS","date":"' || r.dt || '","time":"09:00"}]', 'one_way', 3);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl1, c_tp, 'completed', 'turboprop', 18,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 11:18:00+00')::timestamptz, 2.1, 1.1, 3.2,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 11:06:00+00')::timestamptz, 2.1);
  END IF;
END LOOP;

-- LIGHT N388CJ: 41% utilization (underutilized)
FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 3, 4, 5, 6) THEN -- Mon, Wed-Sat
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl2, '[{"from_icao":"KBUR","to_icao":"KLAX","date":"' || r.dt || '","time":"10:00"}]', 'one_way', 4);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl2, c_l1, 'completed', 'light', 20,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 11:42:00+00')::timestamptz, 1.7, 0.3, 2.0,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 11:48:00+00')::timestamptz, 1.8);
  END IF;
END LOOP;

-- LIGHT N512PE: 61% utilization (normal/healthy)
FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5, 6) THEN -- Mon-Sat
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl6, '[{"from_icao":"KSFO","to_icao":"KLAS","date":"' || r.dt || '","time":"08:00"}]', 'one_way', 3);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl6, c_l2, 'completed', 'light', 22,
        (r.dt || ' 08:00:00+00')::timestamptz, (r.dt || ' 10:18:00+00')::timestamptz, 2.3, 0.2, 2.5,
        (r.dt || ' 08:00:00+00')::timestamptz, (r.dt || ' 10:12:00+00')::timestamptz, 2.2);
  END IF;
END LOOP;

-- MIDSIZE N744XL: 71% utilization (healthy)
FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5) THEN -- Mon-Fri
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl1, '[{"from_icao":"KLAX","to_icao":"KORD","date":"' || r.dt || '","time":"09:00"}]', 'one_way', 6);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl1, c_m1, 'completed', 'midsize', 20,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 13:00:00+00')::timestamptz, 3.6, 0.4, 4.0,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:36:00+00')::timestamptz, 3.6);
  END IF;
END LOOP;

-- MIDSIZE N291HK: 62% utilization (normal)
FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5) THEN -- Mon-Fri
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl5, '[{"from_icao":"KTEB","to_icao":"KMIA","date":"' || r.dt || '","time":"11:00"}]', 'one_way', 5);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl5, c_m2, 'completed', 'midsize', 18,
        (r.dt || ' 11:00:00+00')::timestamptz, (r.dt || ' 14:12:00+00')::timestamptz, 3.0, 0.3, 3.3,
        (r.dt || ' 11:00:00+00')::timestamptz, (r.dt || ' 14:00:00+00')::timestamptz, 3.0);
  END IF;
END LOOP;

-- MIDSIZE N603LA: 93% utilization (OVERCONSTRAINED - bottleneck!)
FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  v_tid := gen_random_uuid();
  INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
    (v_tid, c_cl4, '[{"from_icao":"KMDW","to_icao":"KLAX","date":"' || r.dt || '","time":"08:30"}]', 'one_way', 7);
  INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
    actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
    scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
    (v_tid, c_cl4, c_m3, 'completed', 'midsize', 22,
      (r.dt || ' 08:30:00+00')::timestamptz, (r.dt || ' 12:06:00+00')::timestamptz, 3.4, 0.3, 3.7,
      (r.dt || ' 08:30:00+00')::timestamptz, (r.dt || ' 12:06:00+00')::timestamptz, 3.4);
END LOOP;

-- SUPER-MID N177CR: 76% utilization (healthy)
FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 2, 3, 4, 5) THEN -- Mon-Fri
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl3, '[{"from_icao":"KORD","to_icao":"KMIA","date":"' || r.dt || '","time":"10:00"}]', 'one_way', 8);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl3, c_sm, 'completed', 'super-mid', 21,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:18:00+00')::timestamptz, 3.1, 0.4, 3.5,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:06:00+00')::timestamptz, 3.1);
  END IF;
END LOOP;

-- HEAVY N830GV: 50% utilization (underutilized + inefficient repos)
FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 4) THEN -- Mon, Thu only
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl3, '[{"from_icao":"KMIA","to_icao":"KTEB","date":"' || r.dt || '","time":"10:00"}]', 'one_way', 10);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl3, c_h1, 'completed', 'heavy', 23,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:30:00+00')::timestamptz, 3.2, 1.8, 5.0,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:12:00+00')::timestamptz, 3.2);
  END IF;
END LOOP;

-- HEAVY N495CL: 78% utilization (healthy)
FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow IN (1, 3, 5, 6) THEN -- Mon, Wed, Fri, Sat
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl1, '[{"from_icao":"KJFK","to_icao":"KLAX","date":"' || r.dt || '","time":"09:00"}]', 'one_way', 9);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl1, c_h2, 'completed', 'heavy', 24,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:42:00+00')::timestamptz, 3.5, 0.5, 4.0,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:30:00+00')::timestamptz, 3.5);
  END IF;
END LOOP;

-- ULTRA-LONG N741GX: 30% utilization (severely underutilized, expensive)
FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-01-10'::date, '2026-02-20'::date, '1 day') gs
LOOP
  IF r.dow = 5 THEN -- Fri only
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl3, '[{"from_icao":"KBOS","to_icao":"EGLL","date":"' || r.dt || '","time":"21:00"}]', 'one_way', 12);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours) VALUES
      (v_tid, c_cl3, c_ul, 'completed', 'ultra-long', 25,
        (r.dt || ' 21:00:00+00')::timestamptz, ((r.dt + 1) || ' 04:42:00+00')::timestamptz, 7.7, 0.5, 8.2,
        (r.dt || ' 21:00:00+00')::timestamptz, ((r.dt + 1) || ' 04:42:00+00')::timestamptz, 7.7);
  END IF;
END LOOP;

-- ════════════════════════════════════════════════════════════
-- SECTION 3: POST-FLIGHT LEARNING DATA (delayed/difficult flights)
-- ════════════════════════════════════════════════════════════

-- Create trips for learning scenarios
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (gen_random_uuid(), c_cl8, '[{"from_icao":"KJFK","to_icao":"KMIA","date":"2026-02-15","time":"08:00"}]', 'one_way', 4);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
  actual_departure_time, actual_arrival_time, actual_block_hours, actual_reposition_hours, actual_total_hours, delay_reason_code,
  scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours)
SELECT id, c_cl8, c_m1, 'completed', 'midsize', 20,
  '2026-02-15 09:30:00+00'::timestamptz, '2026-02-15 13:20:00+00'::timestamptz, 3.7, 0.2, 3.9, 'weather',
  '2026-02-15 08:00:00+00'::timestamptz, '2026-02-15 11:36:00+00'::timestamptz, 3.6
FROM trips WHERE client_id = c_cl8 AND created_at > now() - interval '1 day' LIMIT 1;

-- ════════════════════════════════════════════════════════════
-- SECTION 4: CONFIRMED BOOKINGS (next 14 days, 2026-02-21 → 03-06)
-- ════════════════════════════════════════════════════════════

FOR r IN SELECT (gs::date) as dt, EXTRACT(DOW FROM gs)::int as dow
FROM generate_series('2026-02-21'::date, '2026-03-06'::date, '1 day') gs
LOOP
  -- Turboprop confirmed: Thu, Fri
  IF r.dow IN (4, 5) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl4, '[{"from_icao":"KVNY","to_icao":"KLAS","date":"' || r.dt || '","time":"09:00"}]', 'one_way', 2);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours, confirmed_at) VALUES
      (v_tid, c_cl4, c_tp, 'confirmed', 'turboprop', 18,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 11:06:00+00')::timestamptz, 2.1, now());
  END IF;

  -- Light confirmed: Mon, Wed, Fri, Sat (high demand)
  IF r.dow IN (1, 3, 5, 6) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl7, '[{"from_icao":"KLAS","to_icao":"KMIA","date":"' || r.dt || '","time":"10:00"}]', 'one_way', 4);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours, confirmed_at) VALUES
      (v_tid, c_cl7, c_l2, 'confirmed', 'light', 20,
        (r.dt || ' 10:00:00+00')::timestamptz, (r.dt || ' 13:18:00+00')::timestamptz, 3.0, now());
  END IF;

  -- Midsize confirmed: Mon-Fri (business)
  IF r.dow IN (1, 2, 3, 4, 5) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl8, '[{"from_icao":"KJFK","to_icao":"KLAX","date":"' || r.dt || '","time":"08:00"}]', 'one_way', 5);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours, confirmed_at) VALUES
      (v_tid, c_cl8, c_m1, 'confirmed', 'midsize', 20,
        (r.dt || ' 08:00:00+00')::timestamptz, (r.dt || ' 12:00:00+00')::timestamptz, 4.0, now());
  END IF;

  -- Super-mid confirmed: Tue, Thu
  IF r.dow IN (2, 4) THEN
    v_tid := gen_random_uuid();
    INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
      (v_tid, c_cl9, '[{"from_icao":"KMIA","to_icao":"KORD","date":"' || r.dt || '","time":"09:00"}]', 'one_way', 10);
    INSERT INTO quotes (trip_id, client_id, aircraft_id, status, chosen_aircraft_category, margin_pct,
      scheduled_departure_time, scheduled_arrival_time, scheduled_total_hours, confirmed_at) VALUES
      (v_tid, c_cl9, c_sm, 'confirmed', 'super-mid', 22,
        (r.dt || ' 09:00:00+00')::timestamptz, (r.dt || ' 12:18:00+00')::timestamptz, 3.1, now());
  END IF;
END LOOP;

-- ════════════════════════════════════════════════════════════
-- SECTION 5: QUOTE LIFECYCLE (various statuses for testing)
-- ════════════════════════════════════════════════════════════

-- NEW quotes (just created)
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (gen_random_uuid(), c_cl10, '[{"from_icao":"OMDB","to_icao":"EGLL","date":"2026-03-10","time":"20:00"}]', 'one_way', 8);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, margin_pct)
SELECT id, c_cl10, c_ul, 'new', 25 FROM trips WHERE client_id = c_cl10 AND created_at > now() - interval '1 day' LIMIT 1;

-- PRICING quotes (being calculated)
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (gen_random_uuid(), c_cl6, '[{"from_icao":"KSFO","to_icao":"KTEB","date":"2026-03-05","time":"06:00"}]', 'one_way', 3);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, margin_pct, notes)
SELECT id, c_cl6, c_l2, 'pricing', 20, 'Calculating fuel/crew costs' FROM trips WHERE client_id = c_cl6 AND created_at > now() - interval '1 day' AND legs::text LIKE '%KSFO%' LIMIT 1;

-- SENT quotes (waiting for response)
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (gen_random_uuid(), c_cl7, '[{"from_icao":"KMIA","to_icao":"KTEB","date":"2026-03-02","time":"14:00"}]', 'one_way', 6);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, margin_pct, sent_at)
SELECT id, c_cl7, c_m2, 'sent', 19, now() - interval '2 days' FROM trips WHERE client_id = c_cl7 AND created_at > now() - interval '1 day' AND legs::text LIKE '%KTEB%' LIMIT 1;

-- NEGOTIATING quotes (client pushing back)
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (gen_random_uuid(), c_cl9, '[{"from_icao":"KORD","to_icao":"KLAX","date":"2026-03-08","time":"07:00"}]', 'one_way', 12);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, version, margin_pct, sent_at, notes)
SELECT id, c_cl9, c_sm, 'negotiating', 2, 17, now() - interval '3 days', 'Client wants discount, negotiating margin' FROM trips WHERE client_id = c_cl9 AND created_at > now() - interval '1 day' AND legs::text LIKE '%KLAX%' LIMIT 1;

-- LOST quotes
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults) VALUES
  (gen_random_uuid(), c_cl2, '[{"from_icao":"KSFO","to_icao":"KLAX","date":"2026-02-28","time":"noon"}]', 'one_way', 2);
INSERT INTO quotes (trip_id, client_id, aircraft_id, status, margin_pct, sent_at, notes, won_lost_reason)
SELECT id, c_cl2, c_l1, 'lost', 22, now() - interval '5 days', 'Lost to competitor', 'competitor' FROM trips WHERE client_id = c_cl2 AND created_at > now() - interval '1 day' AND legs::text LIKE '%KLAX%' LIMIT 1;

-- ════════════════════════════════════════════════════════════
-- SECTION 6: MAINTENANCE BLOCKS (capacity constraints)
-- ════════════════════════════════════════════════════════════

INSERT INTO aircraft_maintenance (aircraft_id, start_time, end_time, maintenance_type, notes) VALUES
  -- N512PE: during high season (bad timing)
  (c_l2, '2026-03-03 06:00:00+00', '2026-03-05 18:00:00+00', 'inspection', '500-hour inspection (HIGH SEASON!)'),
  -- N744XL: mid-May inspection
  (c_m1, '2026-03-08 08:00:00+00', '2026-03-10 17:00:00+00', 'inspection', '1200-hour phase inspection'),
  -- N291HK: annual (low season)
  (c_m2, '2026-02-28 06:00:00+00', '2026-03-01 18:00:00+00', 'inspection', 'Annual inspection (LOW SEASON, good timing)'),
  -- N603LA: quick work
  (c_m3, '2026-03-04 18:00:00+00', '2026-03-05 06:00:00+00', 'scheduled', 'Turbo seal replacement (36-hour quick turnaround)'),
  -- N177CR: major work
  (c_sm, '2026-03-01 08:00:00+00', '2026-03-02 17:00:00+00', 'inspection', '1000-hour inspection + avionics update'),
  -- N830GV: extended
  (c_h1, '2026-02-22 00:00:00+00', '2026-02-25 23:59:00+00', 'overhaul', 'Engine hot-section overhaul'),
  -- N741GX: major refresh
  (c_ul, '2026-03-09 06:00:00+00', '2026-03-15 22:00:00+00', 'overhaul', '2000-hour inspection');

-- ════════════════════════════════════════════════════════════
-- SECTION 7: FLEET FORECAST PEAK DEMAND OVERRIDES
-- ════════════════════════════════════════════════════════════

INSERT INTO fleet_forecast_overrides (date, aircraft_category, peak_multiplier, reason) VALUES
  -- Spring Break peaks
  ('2026-03-01', 'light', 1.45, 'Spring break begins'),
  ('2026-03-02', 'all', 1.55, 'Spring break peak – families traveling'),
  ('2026-03-03', 'midsize', 1.50, 'Spring break peak – extended families'),

  -- Business surge (post-holiday)
  ('2026-02-24', 'midsize', 1.32, 'Post-weekend business travel'),
  ('2026-02-25', 'midsize', 1.28, 'Mid-week business demand'),

  -- Easter approach
  ('2026-03-04', 'all', 1.25, 'Easter prep travel begins'),
  ('2026-03-05', 'light', 1.35, 'Easter long-weekend exodus'),

  -- Weekday lulls
  ('2026-02-23', 'turboprop', 0.75, 'Sunday evening – low demand'),
  ('2026-02-26', 'heavy', 0.80, 'Wednesday mid-day slump'),

  -- Recurring Friday
  ('2026-03-06', 'light', 1.28, 'Friday – TGIF leisure'),
  ('2026-02-27', 'midsize', 1.24, 'Friday – TGIF departures')

ON CONFLICT (date, aircraft_category) DO UPDATE
  SET peak_multiplier = EXCLUDED.peak_multiplier, reason = EXCLUDED.reason;

END $$;
