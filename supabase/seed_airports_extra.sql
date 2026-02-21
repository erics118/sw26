-- ============================================================
-- ADD EXTRA AIRPORTS (KLGA and other common US charter fields)
-- Run against existing DB to add missing airports without full reset.
-- Usage: psql $DATABASE_URL -f supabase/seed_airports_extra.sql
--        or run via Supabase SQL editor.
-- ============================================================

INSERT INTO airports (icao, iata, name, city, country_code, lat, lon, elevation_ft, longest_runway_ft, fuel_jet_a, fuel_price_usd_gal, fbo_fee_usd, customs_available) VALUES
  ('KLGA', 'LGA', 'LaGuardia Airport', 'New York', 'US', 40.7769, -73.8740, 21, 7003, true, null, 1100, true),
  ('KIAH', 'IAH', 'George Bush Intercontinental Airport', 'Houston', 'US', 29.9844, -95.3414, 97, 12001, true, null, 750, true),
  ('KSNA', 'SNA', 'John Wayne Airport-Orange County', 'Santa Ana', 'US', 33.6757, -117.8682, 56, 5701, true, null, 800, false),
  ('KISP', 'ISP', 'Long Island MacArthur Airport', 'Islip', 'US', 40.7952, -73.1002, 99, 7002, true, null, 650, false),
  ('KORF', 'ORF', 'Norfolk International Airport', 'Norfolk', 'US', 36.8946, -76.2012, 26, 9003, true, null, 600, true),
  ('KDAB', 'DAB', 'Daytona Beach International Airport', 'Daytona Beach', 'US', 29.1799, -81.0580, 34, 10000, true, null, 550, false),
  ('KSRQ', 'SRQ', 'Sarasota Bradenton International Airport', 'Sarasota', 'US', 27.3954, -82.5544, 30, 9234, true, null, 600, false),
  ('KLEX', 'LEX', 'Lexington Blue Grass Airport', 'Lexington', 'US', 38.0365, -84.6059, 979, 7003, true, null, 550, false),
  ('KSDF', 'SDF', 'Louisville Muhammad Ali International Airport', 'Louisville', 'US', 38.1741, -85.7365, 501, 10200, true, null, 600, true),
  ('KMSY', 'MSY', 'Louis Armstrong New Orleans International', 'New Orleans', 'US', 29.9934, -90.2580, 4, 11019, true, null, 700, true),
  ('KAUS', 'AUS', 'Austin-Bergstrom International Airport', 'Austin', 'US', 30.1944, -97.6700, 542, 12250, true, null, 700, true),
  ('KSAT', 'SAT', 'San Antonio International Airport', 'San Antonio', 'US', 29.5337, -98.4691, 809, 8505, true, null, 600, true),
  ('KPHF', 'PHF', 'Newport News/Williamsburg International', 'Newport News', 'US', 37.1319, -76.4930, 42, 8003, true, null, 550, false),
  ('KGSO', 'GSO', 'Piedmont Triad International Airport', 'Greensboro', 'US', 36.0978, -79.9373, 925, 10001, true, null, 550, true),
  ('KAVL', 'AVL', 'Asheville Regional Airport', 'Asheville', 'US', 35.4362, -82.5418, 2165, 8001, true, null, 600, false),
  ('KCHA', 'CHA', 'Chattanooga Metropolitan Airport', 'Chattanooga', 'US', 35.0353, -85.2038, 683, 7200, true, null, 500, false),
  ('KCMH', 'CMH', 'John Glenn Columbus International Airport', 'Columbus', 'US', 39.9980, -82.8919, 815, 10119, true, null, 650, true),
  ('KCLE', 'CLE', 'Cleveland Hopkins International Airport', 'Cleveland', 'US', 41.4117, -81.8498, 791, 10006, true, null, 700, true),
  ('KMKE', 'MKE', 'Milwaukee Mitchell International Airport', 'Milwaukee', 'US', 42.9472, -87.8966, 723, 9696, true, null, 650, true),
  ('KMSN', 'MSN', 'Dane County Regional Airport', 'Madison', 'US', 43.1399, -89.3375, 887, 9003, true, null, 550, false),
  ('KDSM', 'DSM', 'Des Moines International Airport', 'Des Moines', 'US', 41.5340, -93.6631, 958, 9001, true, null, 550, true),
  ('KMCI', 'MCI', 'Kansas City International Airport', 'Kansas City', 'US', 39.2976, -94.7139, 1026, 10801, true, null, 650, true),
  ('KOKC', 'OKC', 'Will Rogers World Airport', 'Oklahoma City', 'US', 35.3931, -97.6007, 1295, 9802, true, null, 600, true),
  ('KABQ', 'ABQ', 'Albuquerque International Sunport', 'Albuquerque', 'US', 35.0402, -106.6092, 5355, 13001, true, null, 650, true)
ON CONFLICT (icao) DO NOTHING;
