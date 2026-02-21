-- ============================================================
-- Seed data: operators, aircraft, clients
-- Run in Supabase SQL Editor
-- ============================================================

-- Operators
INSERT INTO operators (id, name, cert_number, cert_expiry, insurance_expiry, reliability_score, blacklisted, notes) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Summit Air Charter',    'D-STMM-2201', '2026-03-15', '2026-01-31', 4.8, false, 'Top-tier Midwest operator, two-crew policy on all legs'),
  ('a1000000-0000-0000-0000-000000000002', 'Coastal Jet Group',     'D-CJGP-1893', '2025-09-30', '2025-11-14', 4.5, false, 'SE fleet, fast turnaround, strong FBO relationships'),
  ('a1000000-0000-0000-0000-000000000003', 'Apex Private Aviation', 'D-APXV-0741', '2025-04-10', '2026-05-22', 3.9, false, 'Cert renewal in progress — verify before booking heavy iron'),
  ('a1000000-0000-0000-0000-000000000004', 'TransAtlantic Air LLC', 'D-TATL-3320', '2026-08-01', '2026-07-15', 4.7, false, 'Specializes in transatlantic and ETOPS-certified routes');

-- Aircraft (linked to operators)
INSERT INTO aircraft (tail_number, operator_id, category, range_nm, cabin_height_in, pax_capacity, fuel_burn_gph, has_wifi, has_bathroom, home_base_icao, notes) VALUES
  ('N114PC',  'a1000000-0000-0000-0000-000000000001', 'turboprop',  1845,  59.0,  8,  74.0, false, true,  'KVNY', 'Pilatus PC-12 NGX — 2021, workhorse short-haul, no wifi'),
  ('N388CJ',  'a1000000-0000-0000-0000-000000000002', 'light',      2040,  57.5,  6,  96.0, false, false, 'KBUR', 'Citation CJ3 — 2014, no lavatory, ideal for quick hops'),
  ('N512PE',  'a1000000-0000-0000-0000-000000000002', 'light',      2267,  59.0,  7, 103.0, true,  false, 'KLAS', 'Phenom 300E — 2022, Gogo Avance wifi, enclosed lav'),
  ('N744XL',  'a1000000-0000-0000-0000-000000000001', 'midsize',    2100,  68.5,  9, 211.0, true,  true,  'KLAX', 'Citation XLS+ — 2019, full galley, ForeFlight avionics'),
  ('N291HK',  'a1000000-0000-0000-0000-000000000003', 'midsize',    2540,  72.0,  8, 230.0, false, true,  'KTEB', 'Hawker 800XP — 2007, classic interior, reliable but no wifi'),
  ('N603LA',  'a1000000-0000-0000-0000-000000000001', 'midsize',    2700,  72.0,  9, 218.0, true,  true,  'KMDW', 'Citation Latitude — 2021, flat-floor, dual-zone cabin'),
  ('N177CR',  'a1000000-0000-0000-0000-000000000001', 'super-mid',  3200,  73.8, 10, 253.0, true,  true,  'KORD', 'Challenger 350 — 2023, Ka-band wifi, lie-flat seats'),
  ('N830GV',  'a1000000-0000-0000-0000-000000000004', 'heavy',      4350,  74.5, 14, 338.0, true,  true,  'KMIA', 'Gulfstream G450 — 2016, full galley, entertainment suite'),
  ('N495CL',  'a1000000-0000-0000-0000-000000000003', 'heavy',      4000,  73.5, 12, 295.0, true,  true,  'KJFK', 'Challenger 605 — 2018, club seating + divan, dual-zone'),
  ('N741GX',  'a1000000-0000-0000-0000-000000000004', 'ultra-long', 7500,  77.0, 16, 412.0, true,  true,  'KBOS', 'Gulfstream G650ER — 2022, flagship, transatlantic range');

-- Clients
INSERT INTO clients (id, name, company, email, phone, nationality, vip, risk_flag, notes) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'James Whitfield',   'Acme Corp',            'james@acmecorp.com',      '+1 (310) 555-0192', 'US', true,  false, 'CEO. Prefers midsize+, always requests catering. Loyal repeat client.'),
  ('b1000000-0000-0000-0000-000000000002', 'Priya Nair',        'Horizon Ventures',     'priya.nair@horizonvc.com','+1 (415) 555-0348', 'US', false, false, 'VC partner. Frequently LA→NYC. Wifi critical, light traveler.'),
  ('b1000000-0000-0000-0000-000000000003', 'Marcus Stein',      NULL,                   'mstein@protonmail.com',   '+49 151 5550198',   'DE', true,  false, 'European HNW. Requests G650 or equivalent for transatlantic routes.'),
  ('b1000000-0000-0000-0000-000000000004', 'Sofia Castellanos', 'Meridian Media Group', 'scastellanos@meridmg.com','+1 (212) 555-0761', 'US', false, false, 'Marketing exec. Group bookings 6–10 pax, often with tight notice.'),
  ('b1000000-0000-0000-0000-000000000005', 'Derek Okonkwo',     'Okonkwo Capital',      'derek@okonkwocap.com',    '+1 (713) 555-0523', 'US', false, true,  'Payment issues on Q3 booking — require deposit before confirming.');

-- ============================================================
-- Trips
-- ============================================================
INSERT INTO trips (id, client_id, legs, trip_type, pax_adults, pax_children, flexibility_hours, catering_notes, luggage_notes, wifi_required, ai_extracted, created_at) VALUES
  ('c1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000001',
   '[{"from_icao":"KLAX","to_icao":"KTEB","date":"2025-06-15","time":"14:00"},{"from_icao":"KTEB","to_icao":"KLAX","date":"2025-06-17","time":"19:00"}]',
   'round_trip', 4, 0, 2, 'Light snacks and beverages', '6 checked bags', true, true,
   now() - interval '12 days'),

  ('c1000000-0000-0000-0000-000000000002',
   'b1000000-0000-0000-0000-000000000002',
   '[{"from_icao":"KSFO","to_icao":"KTEB","date":"2025-07-02","time":"08:00"}]',
   'one_way', 2, 0, 0, NULL, NULL, true, true,
   now() - interval '9 days'),

  ('c1000000-0000-0000-0000-000000000003',
   'b1000000-0000-0000-0000-000000000003',
   '[{"from_icao":"KTEB","to_icao":"EGLL","date":"2025-07-10","time":"21:00"},{"from_icao":"EGLL","to_icao":"LFPB","date":"2025-07-14","time":"10:00"},{"from_icao":"LFPB","to_icao":"KTEB","date":"2025-07-18","time":"14:00"}]',
   'multi_leg', 3, 0, 0, 'Full catering each leg', 'Light luggage only', true, true,
   now() - interval '7 days'),

  ('c1000000-0000-0000-0000-000000000004',
   'b1000000-0000-0000-0000-000000000004',
   '[{"from_icao":"KLAX","to_icao":"KLAS","date":"2025-08-01","time":"11:00"}]',
   'one_way', 9, 0, 3, NULL, NULL, false, false,
   now() - interval '5 days'),

  ('c1000000-0000-0000-0000-000000000005',
   'b1000000-0000-0000-0000-000000000005',
   '[{"from_icao":"KHOU","to_icao":"KMIA","date":"2025-08-15","time":"09:30"}]',
   'one_way', 5, 0, 1, NULL, NULL, true, false,
   now() - interval '3 days'),

  ('c1000000-0000-0000-0000-000000000006',
   'b1000000-0000-0000-0000-000000000001',
   '[{"from_icao":"KTEB","to_icao":"KORD","date":"2025-05-20","time":"07:00"},{"from_icao":"KORD","to_icao":"KTEB","date":"2025-05-20","time":"18:30"}]',
   'round_trip', 4, 0, 0, 'Continental breakfast outbound', NULL, true, false,
   now() - interval '30 days'),

  ('c1000000-0000-0000-0000-000000000007',
   'b1000000-0000-0000-0000-000000000002',
   '[{"from_icao":"KSFO","to_icao":"KLAX","date":"2025-04-10","time":"16:00"}]',
   'one_way', 1, 0, 0, NULL, NULL, true, false,
   now() - interval '60 days');

-- ============================================================
-- Quotes (various statuses)
-- ============================================================
INSERT INTO quotes (id, trip_id, client_id, aircraft_id, operator_id, status, version, margin_pct, currency, notes, sent_at, confirmed_at, created_at) VALUES

  -- new: just created, not yet priced
  ('d1000000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000005',
   'b1000000-0000-0000-0000-000000000005',
   (SELECT id FROM aircraft WHERE tail_number = 'N603LA'),
   'a1000000-0000-0000-0000-000000000001',
   'new', 1, 20.0, 'USD', NULL, NULL, NULL,
   now() - interval '3 days'),

  -- pricing: cost breakdown being worked
  ('d1000000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000004',
   'b1000000-0000-0000-0000-000000000004',
   (SELECT id FROM aircraft WHERE tail_number = 'N388CJ'),
   'a1000000-0000-0000-0000-000000000002',
   'pricing', 1, 18.0, 'USD', 'Short hop, Challenger overkill — CJ3 better fit', NULL, NULL,
   now() - interval '4 days'),

  -- sent: quote emailed to client
  ('d1000000-0000-0000-0000-000000000003',
   'c1000000-0000-0000-0000-000000000002',
   'b1000000-0000-0000-0000-000000000002',
   (SELECT id FROM aircraft WHERE tail_number = 'N744XL'),
   'a1000000-0000-0000-0000-000000000001',
   'sent', 1, 22.0, 'USD', 'Priya prefers XLS+ for this route', now() - interval '5 days', NULL,
   now() - interval '8 days'),

  -- negotiating: client pushing back on price
  ('d1000000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000001',
   'b1000000-0000-0000-0000-000000000001',
   (SELECT id FROM aircraft WHERE tail_number = 'N177CR'),
   'a1000000-0000-0000-0000-000000000001',
   'negotiating', 2, 19.0, 'USD', 'James requested v2 at lower margin. Hold at 19%.', now() - interval '8 days', NULL,
   now() - interval '11 days'),

  -- confirmed: booked and deposit received
  ('d1000000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000003',
   'b1000000-0000-0000-0000-000000000003',
   (SELECT id FROM aircraft WHERE tail_number = 'N741GX'),
   'a1000000-0000-0000-0000-000000000004',
   'confirmed', 1, 25.0, 'USD', 'Marcus confirmed. Full deposit received.', now() - interval '4 days', now() - interval '2 days',
   now() - interval '6 days'),

  -- lost: client went with another broker
  ('d1000000-0000-0000-0000-000000000006',
   'c1000000-0000-0000-0000-000000000007',
   'b1000000-0000-0000-0000-000000000002',
   (SELECT id FROM aircraft WHERE tail_number = 'N512PE'),
   'a1000000-0000-0000-0000-000000000002',
   'lost', 1, 20.0, 'USD', 'Lost to competitor — Priya said pricing was $400 higher', now() - interval '55 days', NULL,
   now() - interval '58 days'),

  -- completed: flight done, invoiced
  ('d1000000-0000-0000-0000-000000000007',
   'c1000000-0000-0000-0000-000000000006',
   'b1000000-0000-0000-0000-000000000001',
   (SELECT id FROM aircraft WHERE tail_number = 'N744XL'),
   'a1000000-0000-0000-0000-000000000001',
   'completed', 1, 22.0, 'USD', 'Completed. James very happy — sent referral.', now() - interval '25 days', now() - interval '28 days',
   now() - interval '29 days');

-- ============================================================
-- Quote costs (for priced/sent/negotiating/confirmed/completed)
-- ============================================================
INSERT INTO quote_costs (quote_id, fuel_cost, fbo_fees, repositioning_cost, repositioning_hours, permit_fees, crew_overnight_cost, catering_cost, peak_day_surcharge, subtotal, margin_amount, tax, total) VALUES

  -- d003: sent — KSFO→KTEB on XLS+
  ('d1000000-0000-0000-0000-000000000003',
   8400, 1200, 2100, 2.5, 0, 0, 450, 0,
   12150, 2673, 0, 14823),

  -- d004: negotiating — KLAX→KTEB+back on Challenger 350 (v2, lower margin)
  ('d1000000-0000-0000-0000-000000000004',
   14600, 2400, 3200, 3.0, 0, 1200, 800, 600,
   22800, 4332, 0, 27132),

  -- d005: confirmed — transatlantic multi-leg on G650ER
  ('d1000000-0000-0000-0000-000000000005',
   48000, 6500, 8000, 5.0, 2200, 3600, 3200, 1200,
   72700, 18175, 0, 90875),

  -- d006: lost — KSFO→KLAX on Phenom 300E
  ('d1000000-0000-0000-0000-000000000006',
   1800, 600, 0, 0, 0, 0, 0, 0,
   2400, 480, 0, 2880),

  -- d007: completed — KTEB→KORD+back on XLS+
  ('d1000000-0000-0000-0000-000000000007',
   6200, 1800, 1400, 1.5, 0, 0, 550, 0,
   9950, 2189, 0, 12139);
