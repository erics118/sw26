/**
 * POST /api/dev/seed-data
 *
 * Inserts a realistic base dataset: clients, aircraft, and a curated set of
 * quotes/trips covering every interesting state:
 *
 *  • "currently flying"  – confirmed quotes with departure in the past and
 *                          arrival in the future (aircraft are airborne right now)
 *  • "recently landed"   – completed quotes from earlier today / yesterday
 *  • pipeline            – mix of new / sent / negotiating quotes for upcoming legs
 *
 * Safe to call once per environment.  Call DELETE to remove all data created
 * by this endpoint (identified by the "seed_batch" note prefix).
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const SEED_TAG = "[seed-data]";

// ─── Static IDs so we can cross-reference without round-trips ───────────────

const CLIENT_IDS = {
  thornton: crypto.randomUUID(),
  chen: crypto.randomUUID(),
  rivera: crypto.randomUUID(),
  platinum: crypto.randomUUID(),
};

const AIRCRAFT_IDS = {
  citation: crypto.randomUUID(), // midsize  – currently flying
  gulfstream: crypto.randomUUID(), // heavy    – currently flying
  kingAir: crypto.randomUUID(), // turboprop– recently landed
  phenom: crypto.randomUUID(), // light    – recently landed
  challenger: crypto.randomUUID(), // super-mid– idle / pipeline
  global: crypto.randomUUID(), // ultra-long – pipeline (future trip)
};

function hrsAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000);
}
function hrsFromNow(h: number): Date {
  return new Date(Date.now() + h * 3_600_000);
}
function daysAgo(d: number, hour = 10): Date {
  const dt = new Date();
  dt.setUTCDate(dt.getUTCDate() - d);
  dt.setUTCHours(hour, 0, 0, 0);
  return dt;
}
function daysFromNow(d: number, hour = 10): Date {
  const dt = new Date();
  dt.setUTCDate(dt.getUTCDate() + d);
  dt.setUTCHours(hour, 0, 0, 0);
  return dt;
}

export async function POST() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── 1. Clients ─────────────────────────────────────────────────────────────
  const clients: Database["public"]["Tables"]["clients"]["Insert"][] = [
    {
      id: CLIENT_IDS.thornton,
      name: "James Thornton",
      company: "Thornton Capital Group",
      email: "j.thornton@thorntoncapital.com",
      phone: "+1-212-555-0142",
      nationality: "US",
      notes: `${SEED_TAG} Long-standing VIP client. Prefers Gulfstream or Challenger. Always books round-trips with 24h notice.`,
      vip: true,
      risk_flag: false,
    },
    {
      id: CLIENT_IDS.chen,
      name: "Sarah Chen",
      company: "Nexus Ventures",
      email: "sarah.chen@nexusvc.com",
      phone: "+1-415-555-0198",
      nationality: "US",
      notes: `${SEED_TAG} SF-based VC partner. Frequently flies SFO↔JFK and SFO↔LAX. WiFi mandatory.`,
      vip: true,
      risk_flag: false,
    },
    {
      id: CLIENT_IDS.rivera,
      name: "Marcus Rivera",
      company: null,
      email: "mrivera@gmail.com",
      phone: "+1-305-555-0177",
      nationality: "US",
      notes: `${SEED_TAG} Leisure traveler. Miami-based. Books light jets for Florida hops.`,
      vip: false,
      risk_flag: false,
    },
    {
      id: CLIENT_IDS.platinum,
      name: "Platinum Equity Partners",
      company: "Platinum Equity Partners LLC",
      email: "travel@platinumequity.com",
      phone: "+1-310-555-0211",
      nationality: "US",
      notes: `${SEED_TAG} Corporate account. Multiple travelers per month. Requires flight attendant on heavy jets.`,
      vip: true,
      risk_flag: false,
    },
  ];

  const { error: clientErr } = await supabase.from("clients").insert(clients);
  if (clientErr) {
    return NextResponse.json(
      { error: `clients: ${clientErr.message}` },
      { status: 500 },
    );
  }

  // ── 2. Aircraft ────────────────────────────────────────────────────────────
  const aircraft: Database["public"]["Tables"]["aircraft"]["Insert"][] = [
    {
      id: AIRCRAFT_IDS.citation,
      tail_number: "N123CX",
      category: "midsize",
      range_nm: 1858,
      pax_capacity: 8,
      fuel_burn_gph: 185,
      has_wifi: true,
      has_bathroom: true,
      home_base_icao: "KTEB",
      cruise_speed_kts: 441,
      max_fuel_capacity_gal: 1119,
      min_runway_ft: 3560,
      etops_certified: false,
      max_payload_lbs: 1850,
      reserve_fuel_gal: 120,
      daily_available_hours: 10,
      status: "active",
      notes: `${SEED_TAG} Citation XLS+. Primary East Coast midsize.`,
    },
    {
      id: AIRCRAFT_IDS.gulfstream,
      tail_number: "N456GV",
      category: "heavy",
      range_nm: 4350,
      pax_capacity: 14,
      fuel_burn_gph: 320,
      has_wifi: true,
      has_bathroom: true,
      home_base_icao: "KLAX",
      cruise_speed_kts: 476,
      max_fuel_capacity_gal: 4341,
      min_runway_ft: 5300,
      etops_certified: true,
      max_payload_lbs: 6500,
      reserve_fuel_gal: 400,
      daily_available_hours: 12,
      status: "active",
      notes: `${SEED_TAG} Gulfstream G450. West Coast flagship.`,
    },
    {
      id: AIRCRAFT_IDS.kingAir,
      tail_number: "N789KA",
      category: "turboprop",
      range_nm: 1580,
      pax_capacity: 9,
      fuel_burn_gph: 95,
      has_wifi: false,
      has_bathroom: false,
      home_base_icao: "KMDW",
      cruise_speed_kts: 312,
      max_fuel_capacity_gal: 544,
      min_runway_ft: 3200,
      etops_certified: false,
      max_payload_lbs: 2700,
      reserve_fuel_gal: 60,
      daily_available_hours: 8,
      status: "active",
      notes: `${SEED_TAG} Beechcraft King Air 350. Midwest short-hops and small field ops.`,
    },
    {
      id: AIRCRAFT_IDS.phenom,
      tail_number: "N234PE",
      category: "light",
      range_nm: 1971,
      pax_capacity: 6,
      fuel_burn_gph: 105,
      has_wifi: true,
      has_bathroom: false,
      home_base_icao: "KBOS",
      cruise_speed_kts: 400,
      max_fuel_capacity_gal: 657,
      min_runway_ft: 3360,
      etops_certified: false,
      max_payload_lbs: 1190,
      reserve_fuel_gal: 70,
      daily_available_hours: 8,
      status: "active",
      notes: `${SEED_TAG} Embraer Phenom 300E. Northeast shuttle ops.`,
    },
    {
      id: AIRCRAFT_IDS.challenger,
      tail_number: "N567CR",
      category: "super-mid",
      range_nm: 3200,
      pax_capacity: 10,
      fuel_burn_gph: 225,
      has_wifi: true,
      has_bathroom: true,
      home_base_icao: "KORD",
      cruise_speed_kts: 470,
      max_fuel_capacity_gal: 2375,
      min_runway_ft: 5020,
      etops_certified: false,
      max_payload_lbs: 2850,
      reserve_fuel_gal: 200,
      daily_available_hours: 10,
      status: "active",
      notes: `${SEED_TAG} Bombardier Challenger 350. Cross-country super-mid.`,
    },
    {
      id: AIRCRAFT_IDS.global,
      tail_number: "N890GL",
      category: "ultra-long",
      range_nm: 7700,
      pax_capacity: 13,
      fuel_burn_gph: 412,
      has_wifi: true,
      has_bathroom: true,
      home_base_icao: "KTEB",
      cruise_speed_kts: 488,
      max_fuel_capacity_gal: 6700,
      min_runway_ft: 5800,
      etops_certified: true,
      max_payload_lbs: 8200,
      reserve_fuel_gal: 600,
      daily_available_hours: 14,
      status: "active",
      notes: `${SEED_TAG} Bombardier Global 6000. Transatlantic capable.`,
    },
  ];

  const { error: aircraftErr } = await supabase
    .from("aircraft")
    .insert(aircraft);
  if (aircraftErr) {
    return NextResponse.json(
      { error: `aircraft: ${aircraftErr.message}` },
      { status: 500 },
    );
  }

  // ── 3. Trips + Quotes ──────────────────────────────────────────────────────
  //
  // We build (trip, quote) pairs together, insert trips first, then quotes.

  type TripInsert = Database["public"]["Tables"]["trips"]["Insert"];
  type QuoteInsert = Database["public"]["Tables"]["quotes"]["Insert"];

  const pairs: { trip: TripInsert; quote: QuoteInsert }[] = [];

  // ── A) N123CX (Citation XLS+) – CURRENTLY FLYING: KTEB → KMIA ────────────
  // Departed 1h 20m ago, arrives in 1h 10m
  {
    const dep = hrsAgo(1.33);
    const arr = hrsFromNow(1.17);
    const blockHrs = 2.5;
    const tripId = crypto.randomUUID();
    pairs.push({
      trip: {
        id: tripId,
        client_id: CLIENT_IDS.thornton,
        legs: [
          {
            from_icao: "KTEB",
            to_icao: "KMIA",
            date: dep.toISOString().slice(0, 10),
            time: `${String(dep.getUTCHours()).padStart(2, "0")}:00`,
          },
        ],
        trip_type: "one_way",
        pax_adults: 4,
        pax_children: 0,
        pax_pets: 0,
        wifi_required: true,
        bathroom_required: true,
        ai_extracted: false,
        flexibility_hours: 0,
        flexibility_hours_return: 0,
      },
      quote: {
        trip_id: tripId,
        client_id: CLIENT_IDS.thornton,
        aircraft_id: AIRCRAFT_IDS.citation,
        status: "confirmed",
        chosen_aircraft_category: "midsize",
        scheduled_departure_time: dep.toISOString(),
        scheduled_arrival_time: arr.toISOString(),
        scheduled_total_hours: blockHrs,
        estimated_total_hours: blockHrs,
        confirmed_at: daysAgo(2).toISOString(),
        sent_at: daysAgo(3).toISOString(),
        margin_pct: 18,
        currency: "USD",
        version: 1,
        notes: `${SEED_TAG} KTEB→KMIA confirmed. Client attending Art Basel satellite event.`,
      },
    });
  }

  // ── B) N456GV (Gulfstream G450) – CURRENTLY FLYING: KLAX → KDEN ──────────
  // Departed 55m ago, arrives in 35m
  {
    const dep = hrsAgo(0.92);
    const arr = hrsFromNow(0.58);
    const blockHrs = 1.5;
    const tripId = crypto.randomUUID();
    pairs.push({
      trip: {
        id: tripId,
        client_id: CLIENT_IDS.platinum,
        legs: [
          {
            from_icao: "KLAX",
            to_icao: "KDEN",
            date: dep.toISOString().slice(0, 10),
            time: `${String(dep.getUTCHours()).padStart(2, "0")}:00`,
          },
        ],
        trip_type: "one_way",
        pax_adults: 6,
        pax_children: 1,
        pax_pets: 0,
        wifi_required: true,
        bathroom_required: true,
        ai_extracted: false,
        flexibility_hours: 0,
        flexibility_hours_return: 0,
      },
      quote: {
        trip_id: tripId,
        client_id: CLIENT_IDS.platinum,
        aircraft_id: AIRCRAFT_IDS.gulfstream,
        status: "confirmed",
        chosen_aircraft_category: "heavy",
        scheduled_departure_time: dep.toISOString(),
        scheduled_arrival_time: arr.toISOString(),
        scheduled_total_hours: blockHrs,
        estimated_total_hours: blockHrs,
        confirmed_at: daysAgo(1).toISOString(),
        sent_at: daysAgo(2).toISOString(),
        margin_pct: 20,
        currency: "USD",
        version: 1,
        notes: `${SEED_TAG} KLAX→KDEN. Platinum Equity board offsite in Aspen area.`,
      },
    });
  }

  // ── C) N789KA (King Air 350) – RECENTLY LANDED: KMDW → KDTW ─────────────
  // Departed 4h ago, landed 2h 45m ago (1h 15m flight)
  {
    const dep = hrsAgo(4);
    const arr = hrsAgo(2.75);
    const blockHrs = 1.25;
    const tripId = crypto.randomUUID();
    pairs.push({
      trip: {
        id: tripId,
        client_id: CLIENT_IDS.rivera,
        legs: [
          {
            from_icao: "KMDW",
            to_icao: "KDTW",
            date: dep.toISOString().slice(0, 10),
            time: `${String(dep.getUTCHours()).padStart(2, "0")}:00`,
          },
        ],
        trip_type: "one_way",
        pax_adults: 3,
        pax_children: 0,
        pax_pets: 1,
        wifi_required: false,
        bathroom_required: false,
        ai_extracted: false,
        flexibility_hours: 0,
        flexibility_hours_return: 0,
      },
      quote: {
        trip_id: tripId,
        client_id: CLIENT_IDS.rivera,
        aircraft_id: AIRCRAFT_IDS.kingAir,
        status: "completed",
        chosen_aircraft_category: "turboprop",
        scheduled_departure_time: dep.toISOString(),
        scheduled_arrival_time: arr.toISOString(),
        scheduled_total_hours: blockHrs,
        estimated_total_hours: blockHrs,
        actual_departure_time: dep.toISOString(),
        actual_arrival_time: arr.toISOString(),
        actual_block_hours: blockHrs,
        actual_total_hours: blockHrs,
        confirmed_at: daysAgo(1).toISOString(),
        sent_at: daysAgo(2).toISOString(),
        margin_pct: 15,
        currency: "USD",
        version: 1,
        notes: `${SEED_TAG} KMDW→KDTW. Completed on schedule.`,
      },
    });
  }

  // ── D) N234PE (Phenom 300E) – RECENTLY LANDED: KBOS → KJFK ──────────────
  // Departed 3h 30m ago, landed 2h 50m ago (~40m shuttle)
  {
    const dep = hrsAgo(3.5);
    const arr = hrsAgo(2.83);
    const blockHrs = 0.67;
    const tripId = crypto.randomUUID();
    pairs.push({
      trip: {
        id: tripId,
        client_id: CLIENT_IDS.chen,
        legs: [
          {
            from_icao: "KBOS",
            to_icao: "KJFK",
            date: dep.toISOString().slice(0, 10),
            time: `${String(dep.getUTCHours()).padStart(2, "0")}:00`,
          },
        ],
        trip_type: "one_way",
        pax_adults: 2,
        pax_children: 0,
        pax_pets: 0,
        wifi_required: true,
        bathroom_required: false,
        ai_extracted: false,
        flexibility_hours: 0,
        flexibility_hours_return: 0,
      },
      quote: {
        trip_id: tripId,
        client_id: CLIENT_IDS.chen,
        aircraft_id: AIRCRAFT_IDS.phenom,
        status: "completed",
        chosen_aircraft_category: "light",
        scheduled_departure_time: dep.toISOString(),
        scheduled_arrival_time: arr.toISOString(),
        scheduled_total_hours: blockHrs,
        estimated_total_hours: blockHrs,
        actual_departure_time: dep.toISOString(),
        actual_arrival_time: arr.toISOString(),
        actual_block_hours: blockHrs,
        actual_total_hours: blockHrs,
        confirmed_at: daysAgo(3).toISOString(),
        sent_at: daysAgo(4).toISOString(),
        margin_pct: 16,
        currency: "USD",
        version: 2,
        notes: `${SEED_TAG} KBOS→KJFK. Second version after client rescheduled departure.`,
      },
    });
  }

  // ── E) N567CR (Challenger 350) – PIPELINE: KORD → KLAS next week ─────────
  {
    const dep = daysFromNow(5, 9);
    const blockHrs = 3.0;
    const tripId = crypto.randomUUID();
    pairs.push({
      trip: {
        id: tripId,
        client_id: CLIENT_IDS.platinum,
        legs: [
          {
            from_icao: "KORD",
            to_icao: "KLAS",
            date: dep.toISOString().slice(0, 10),
            time: "09:00",
          },
        ],
        trip_type: "one_way",
        pax_adults: 8,
        pax_children: 0,
        pax_pets: 0,
        wifi_required: true,
        bathroom_required: true,
        ai_extracted: false,
        flexibility_hours: 2,
        flexibility_hours_return: 0,
      },
      quote: {
        trip_id: tripId,
        client_id: CLIENT_IDS.platinum,
        aircraft_id: AIRCRAFT_IDS.challenger,
        status: "negotiating",
        chosen_aircraft_category: "super-mid",
        estimated_total_hours: blockHrs,
        sent_at: daysAgo(1).toISOString(),
        quote_valid_until: daysFromNow(3).toISOString(),
        margin_pct: 17,
        currency: "USD",
        version: 1,
        notes: `${SEED_TAG} KORD→KLAS. Client negotiating on price – counter-offered at 14% margin.`,
      },
    });
  }

  // ── F) N890GL (Global 6000) – PIPELINE: KTEB → EGLL (transatlantic) ──────
  {
    const dep = daysFromNow(12, 20); // overnight departure
    const blockHrs = 7.5;
    const tripId = crypto.randomUUID();
    pairs.push({
      trip: {
        id: tripId,
        client_id: CLIENT_IDS.thornton,
        legs: [
          {
            from_icao: "KTEB",
            to_icao: "EGLL",
            date: dep.toISOString().slice(0, 10),
            time: "20:00",
          },
        ],
        trip_type: "one_way",
        pax_adults: 5,
        pax_children: 0,
        pax_pets: 0,
        wifi_required: true,
        bathroom_required: true,
        ai_extracted: false,
        flexibility_hours: 4,
        flexibility_hours_return: 0,
      },
      quote: {
        trip_id: tripId,
        client_id: CLIENT_IDS.thornton,
        aircraft_id: AIRCRAFT_IDS.global,
        status: "sent",
        chosen_aircraft_category: "ultra-long",
        estimated_total_hours: blockHrs,
        sent_at: new Date().toISOString(),
        quote_valid_until: daysFromNow(7).toISOString(),
        margin_pct: 22,
        currency: "USD",
        version: 1,
        notes: `${SEED_TAG} KTEB→EGLL. Thornton transatlantic – awaiting sign-off from client EA.`,
      },
    });
  }

  // ── G) Historical completed: N123CX round-trip 3 days ago ─────────────────
  {
    const dep1 = daysAgo(3, 8);
    const arr1 = daysAgo(3, 10);
    const dep2 = daysAgo(3, 15);
    const arr2 = daysAgo(3, 17);

    // Outbound leg
    const tripId1 = crypto.randomUUID();
    pairs.push({
      trip: {
        id: tripId1,
        client_id: CLIENT_IDS.chen,
        legs: [
          {
            from_icao: "KTEB",
            to_icao: "KSNA",
            date: dep1.toISOString().slice(0, 10),
            time: "08:00",
          },
        ],
        trip_type: "one_way",
        pax_adults: 3,
        pax_children: 0,
        pax_pets: 0,
        wifi_required: true,
        bathroom_required: true,
        ai_extracted: false,
        flexibility_hours: 0,
        flexibility_hours_return: 0,
      },
      quote: {
        trip_id: tripId1,
        client_id: CLIENT_IDS.chen,
        aircraft_id: AIRCRAFT_IDS.citation,
        status: "completed",
        chosen_aircraft_category: "midsize",
        scheduled_departure_time: dep1.toISOString(),
        scheduled_arrival_time: arr1.toISOString(),
        scheduled_total_hours: 2.0,
        actual_departure_time: dep1.toISOString(),
        actual_arrival_time: arr1.toISOString(),
        actual_block_hours: 2.0,
        actual_total_hours: 2.0,
        estimated_total_hours: 2.0,
        confirmed_at: daysAgo(5).toISOString(),
        margin_pct: 18,
        currency: "USD",
        version: 1,
        notes: `${SEED_TAG} KTEB→KSNA. Completed.`,
      },
    });

    // Return leg
    const tripId2 = crypto.randomUUID();
    pairs.push({
      trip: {
        id: tripId2,
        client_id: CLIENT_IDS.chen,
        legs: [
          {
            from_icao: "KSNA",
            to_icao: "KTEB",
            date: dep2.toISOString().slice(0, 10),
            time: "15:00",
          },
        ],
        trip_type: "one_way",
        pax_adults: 3,
        pax_children: 0,
        pax_pets: 0,
        wifi_required: true,
        bathroom_required: true,
        ai_extracted: false,
        flexibility_hours: 0,
        flexibility_hours_return: 0,
      },
      quote: {
        trip_id: tripId2,
        client_id: CLIENT_IDS.chen,
        aircraft_id: AIRCRAFT_IDS.citation,
        status: "completed",
        chosen_aircraft_category: "midsize",
        scheduled_departure_time: dep2.toISOString(),
        scheduled_arrival_time: arr2.toISOString(),
        scheduled_total_hours: 2.0,
        actual_departure_time: dep2.toISOString(),
        actual_arrival_time: arr2.toISOString(),
        actual_block_hours: 2.0,
        actual_total_hours: 2.0,
        estimated_total_hours: 2.0,
        confirmed_at: daysAgo(5).toISOString(),
        margin_pct: 18,
        currency: "USD",
        version: 1,
        notes: `${SEED_TAG} KSNA→KTEB return. Completed.`,
      },
    });
  }

  // ── H) Historical: N456GV KLAX → KPBI last week ──────────────────────────
  {
    const dep = daysAgo(7, 11);
    const arr = daysAgo(7, 16);
    const tripId = crypto.randomUUID();
    pairs.push({
      trip: {
        id: tripId,
        client_id: CLIENT_IDS.platinum,
        legs: [
          {
            from_icao: "KLAX",
            to_icao: "KPBI",
            date: dep.toISOString().slice(0, 10),
            time: "11:00",
          },
        ],
        trip_type: "one_way",
        pax_adults: 10,
        pax_children: 0,
        pax_pets: 0,
        wifi_required: true,
        bathroom_required: true,
        ai_extracted: false,
        flexibility_hours: 0,
        flexibility_hours_return: 0,
      },
      quote: {
        trip_id: tripId,
        client_id: CLIENT_IDS.platinum,
        aircraft_id: AIRCRAFT_IDS.gulfstream,
        status: "completed",
        chosen_aircraft_category: "heavy",
        scheduled_departure_time: dep.toISOString(),
        scheduled_arrival_time: arr.toISOString(),
        scheduled_total_hours: 5.0,
        actual_departure_time: dep.toISOString(),
        actual_arrival_time: arr.toISOString(),
        actual_block_hours: 5.0,
        actual_total_hours: 5.0,
        estimated_total_hours: 5.0,
        confirmed_at: daysAgo(9).toISOString(),
        margin_pct: 20,
        currency: "USD",
        version: 1,
        notes: `${SEED_TAG} KLAX→KPBI. 10-pax corporate retreat. Completed.`,
      },
    });
  }

  // ── I) Lost quote: N567CR KORD → KATL (client went with competitor) ───────
  {
    const tripId = crypto.randomUUID();
    pairs.push({
      trip: {
        id: tripId,
        client_id: CLIENT_IDS.rivera,
        legs: [
          {
            from_icao: "KORD",
            to_icao: "KATL",
            date: daysAgo(4).toISOString().slice(0, 10),
            time: "14:00",
          },
        ],
        trip_type: "one_way",
        pax_adults: 2,
        pax_children: 0,
        pax_pets: 0,
        wifi_required: false,
        bathroom_required: false,
        ai_extracted: false,
        flexibility_hours: 0,
        flexibility_hours_return: 0,
      },
      quote: {
        trip_id: tripId,
        client_id: CLIENT_IDS.rivera,
        aircraft_id: AIRCRAFT_IDS.challenger,
        status: "lost",
        chosen_aircraft_category: "super-mid",
        estimated_total_hours: 1.75,
        sent_at: daysAgo(6).toISOString(),
        won_lost_reason: "competitor",
        margin_pct: 15,
        currency: "USD",
        version: 1,
        notes: `${SEED_TAG} KORD→KATL. Lost to NetJets on price.`,
      },
    });
  }

  // ─── Insert trips → then quotes ───────────────────────────────────────────
  const { error: tripErr } = await supabase
    .from("trips")
    .insert(pairs.map((p) => p.trip));
  if (tripErr) {
    return NextResponse.json(
      { error: `trips: ${tripErr.message}` },
      { status: 500 },
    );
  }

  const { error: quoteErr } = await supabase
    .from("quotes")
    .insert(pairs.map((p) => p.quote));
  if (quoteErr) {
    return NextResponse.json(
      { error: `quotes: ${quoteErr.message}` },
      { status: 500 },
    );
  }

  const inFlight = pairs.filter((p) => p.quote.status === "confirmed").length;
  const landed = pairs.filter((p) => p.quote.status === "completed").length;
  const pipeline = pairs.filter(
    (p) => !["confirmed", "completed"].includes(p.quote.status as string),
  ).length;

  return NextResponse.json({
    success: true,
    clients_created: clients.length,
    aircraft_created: aircraft.length,
    trips_created: pairs.length,
    quotes_created: pairs.length,
    breakdown: {
      in_flight: inFlight,
      recently_landed: landed,
      pipeline,
    },
    aircraft_states: {
      currently_flying: ["N123CX (Citation XLS+) KTEB→KMIA", "N456GV (Gulfstream G450) KLAX→KDEN"],
      recently_landed: ["N789KA (King Air 350) KMDW→KDTW", "N234PE (Phenom 300E) KBOS→KJFK"],
      idle_pipeline: ["N567CR (Challenger 350) KORD→KLAS next week", "N890GL (Global 6000) KTEB→EGLL in 12 days"],
    },
  });
}

/**
 * DELETE /api/dev/seed-data
 *
 * Removes all quotes, trips, aircraft, and clients created by this endpoint
 * (identified by the "[seed-data]" notes prefix).
 */
export async function DELETE() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Find seed aircraft by notes tag
  const { data: seedAircraft } = await supabase
    .from("aircraft")
    .select("id")
    .like("notes", `${SEED_TAG}%`);

  const seedAircraftIds = (seedAircraft ?? []).map((a) => a.id);

  // Find seed quotes (by aircraft or client notes)
  const { data: seedClients } = await supabase
    .from("clients")
    .select("id")
    .like("notes", `${SEED_TAG}%`);

  const seedClientIds = (seedClients ?? []).map((c) => c.id);

  // Quotes referencing seed aircraft or clients
  let quoteQuery = supabase.from("quotes").select("id, trip_id");
  if (seedAircraftIds.length) {
    quoteQuery = quoteQuery.in("aircraft_id", seedAircraftIds);
  }
  const { data: seedQuotes } = await quoteQuery;
  const quoteIds = (seedQuotes ?? []).map((q) => q.id);
  const tripIds = [...new Set((seedQuotes ?? []).map((q) => q.trip_id))];

  let quotesDeleted = 0;
  let tripsDeleted = 0;

  if (quoteIds.length) {
    await supabase.from("quote_costs").delete().in("quote_id", quoteIds);
    const { count: qc } = await supabase
      .from("quotes")
      .delete({ count: "exact" })
      .in("id", quoteIds);
    quotesDeleted = qc ?? 0;
  }

  if (tripIds.length) {
    const { count: tc } = await supabase
      .from("trips")
      .delete({ count: "exact" })
      .in("id", tripIds);
    tripsDeleted = tc ?? 0;
  }

  let aircraftDeleted = 0;
  if (seedAircraftIds.length) {
    const { count: ac } = await supabase
      .from("aircraft")
      .delete({ count: "exact" })
      .in("id", seedAircraftIds);
    aircraftDeleted = ac ?? 0;
  }

  let clientsDeleted = 0;
  if (seedClientIds.length) {
    const { count: cc } = await supabase
      .from("clients")
      .delete({ count: "exact" })
      .in("id", seedClientIds);
    clientsDeleted = cc ?? 0;
  }

  return NextResponse.json({
    success: true,
    quotes_deleted: quotesDeleted,
    trips_deleted: tripsDeleted,
    aircraft_deleted: aircraftDeleted,
    clients_deleted: clientsDeleted,
  });
}
