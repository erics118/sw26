/**
 * POST /api/dev/seed-demo
 *
 * Seeds a full realistic demo environment: clients, aircraft, pipeline quotes,
 * and 6 weeks of completed flight history for forecasting charts.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS.
 * Safe to call once per fresh environment.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";

// ─── Seed data ───────────────────────────────────────────────────────────────

const CLIENTS = [
  {
    name: "Apex Capital Group",
    company: "Apex Capital Group",
    email: "apex@apexcap.com",
    phone: "+1 (212) 555-0101",
    vip: true,
    risk_flag: false,
    notes: "Preferred operator since 2019. Always books G550 or larger.",
  },
  {
    name: "James Harrington",
    company: "Meridian Ventures",
    email: "james@meridianvc.com",
    phone: "+1 (212) 555-0174",
    vip: true,
    risk_flag: false,
    notes: "Managing partner. Requires large cabin and WiFi.",
  },
  {
    name: "Summit Partners LLC",
    company: "Summit Partners LLC",
    email: "summit@summitpartners.com",
    phone: "+1 (617) 555-0233",
    vip: false,
    risk_flag: false,
    notes: null,
  },
  {
    name: "Atlas Holdings",
    company: "Atlas Holdings",
    email: "atlas@atlashold.com",
    phone: "+1 (305) 555-0318",
    vip: false,
    risk_flag: false,
    notes: null,
  },
  {
    name: "Centurion Management",
    company: "Centurion Management",
    email: "info@centurionmgmt.com",
    phone: "+1 (312) 555-0422",
    vip: false,
    risk_flag: false,
    notes: null,
  },
  {
    name: "Eclipse Capital Fund",
    company: "Eclipse Capital Fund",
    email: "eclipse@eclipsefund.com",
    phone: "+1 (310) 555-0599",
    vip: false,
    risk_flag: true,
    notes: "Flagged for late payments in 2024. Require deposit upfront.",
  },
] as const;

const AIRCRAFT_SEED = [
  {
    tail_number: "N350KA",
    category: "turboprop",
    home_base_icao: "KBOS",
    pax_capacity: 8,
    range_nm: 1800,
    has_wifi: true,
    has_bathroom: true,
    cruise_speed_kts: 310,
    fuel_burn_gph: 85,
    daily_available_hours: 10,
  },
  {
    tail_number: "N300PE",
    category: "light",
    home_base_icao: "KTEB",
    pax_capacity: 7,
    range_nm: 2010,
    has_wifi: true,
    has_bathroom: true,
    cruise_speed_kts: 453,
    fuel_burn_gph: 120,
    daily_available_hours: 10,
  },
  {
    tail_number: "N3CJ",
    category: "light",
    home_base_icao: "KHOU",
    pax_capacity: 6,
    range_nm: 1900,
    has_wifi: false,
    has_bathroom: false,
    cruise_speed_kts: 416,
    fuel_burn_gph: 110,
    daily_available_hours: 10,
  },
  {
    tail_number: "N400XL",
    category: "midsize",
    home_base_icao: "KPBI",
    pax_capacity: 9,
    range_nm: 2100,
    has_wifi: true,
    has_bathroom: true,
    cruise_speed_kts: 441,
    fuel_burn_gph: 175,
    daily_available_hours: 10,
  },
  {
    tail_number: "N350CH",
    category: "super-mid",
    home_base_icao: "KORD",
    pax_capacity: 10,
    range_nm: 3200,
    has_wifi: true,
    has_bathroom: true,
    cruise_speed_kts: 470,
    fuel_burn_gph: 220,
    daily_available_hours: 10,
  },
  {
    tail_number: "N600LG",
    category: "heavy",
    home_base_icao: "KDEN",
    pax_capacity: 13,
    range_nm: 3400,
    has_wifi: true,
    has_bathroom: true,
    cruise_speed_kts: 476,
    fuel_burn_gph: 280,
    daily_available_hours: 10,
  },
  {
    tail_number: "N900FL",
    category: "heavy",
    home_base_icao: "KLAX",
    pax_capacity: 12,
    range_nm: 4500,
    has_wifi: true,
    has_bathroom: true,
    cruise_speed_kts: 480,
    fuel_burn_gph: 290,
    daily_available_hours: 10,
  },
  {
    tail_number: "N650GS",
    category: "ultra-long",
    home_base_icao: "KJFK",
    pax_capacity: 16,
    range_nm: 6750,
    has_wifi: true,
    has_bathroom: true,
    cruise_speed_kts: 488,
    fuel_burn_gph: 360,
    daily_available_hours: 12,
  },
] as const;

// ─── History seed helpers (same logic as seed-history) ───────────────────────

const CATEGORY_BASELINE: Record<string, number> = {
  turboprop: 2.5,
  light: 3.0,
  midsize: 3.5,
  "super-mid": 3.2,
  heavy: 4.5,
  "ultra-long": 5.0,
};

const DOW_MULTIPLIER = [1.25, 0.85, 0.9, 0.95, 1.1, 1.35, 1.2];

const ROUTE_PAIRS = [
  ["KLAX", "KLAS"],
  ["KTEB", "KMIA"],
  ["KSNA", "KSFO"],
  ["KMDW", "KDTW"],
  ["KBOS", "KJFK"],
  ["KPBI", "KATL"],
  ["KHPN", "KBWI"],
  ["KBUR", "KDEN"],
  ["KDAL", "KHOU"],
  ["KTEB", "KPBI"],
];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// ─── Pipeline quote scenarios ─────────────────────────────────────────────────

const PIPELINE_ROUTES = [
  { from: "KTEB", to: "KPBI", pax: 6, category: "super-mid" },
  { from: "KJFK", to: "KLAX", pax: 4, category: "midsize" },
  { from: "KORD", to: "KMIA", pax: 8, category: "heavy" },
  { from: "KBOS", to: "KDCA", pax: 3, category: "light" },
  { from: "KDEN", to: "KSFO", pax: 5, category: "midsize" },
  { from: "KATL", to: "KHOU", pax: 7, category: "super-mid" },
  { from: "KLAX", to: "KLAS", pax: 4, category: "light" },
  { from: "KMIA", to: "KJFK", pax: 9, category: "heavy" },
  { from: "KSFO", to: "KORD", pax: 6, category: "super-mid" },
  { from: "KTEB", to: "KBOS", pax: 2, category: "turboprop" },
  { from: "KPBI", to: "KDCA", pax: 5, category: "midsize" },
  { from: "KHOU", to: "KDFW", pax: 4, category: "light" },
  { from: "KJFK", to: "KMIA", pax: 12, category: "ultra-long" },
  { from: "KORD", to: "KDEN", pax: 6, category: "midsize" },
  { from: "KSEA", to: "KLAX", pax: 8, category: "heavy" },
  { from: "KDCA", to: "KBOS", pax: 3, category: "light" },
  { from: "KLAS", to: "KSFO", pax: 5, category: "midsize" },
  { from: "KATL", to: "KJFK", pax: 7, category: "super-mid" },
  { from: "KLAX", to: "KDEN", pax: 4, category: "midsize" },
  { from: "KTEB", to: "KORD", pax: 10, category: "heavy" },
];

// Status distribution: 3 new, 3 pricing, 4 sent, 3 negotiating, 4 confirmed, 2 completed, 1 lost
const STATUSES: Array<{
  status: string;
  daysAgo: number;
  daysAhead?: number;
  price: number;
  margin: number;
}> = [
  { status: "new", daysAgo: 0, price: 28000, margin: 0.15 },
  { status: "new", daysAgo: 1, price: 42000, margin: 0.16 },
  { status: "new", daysAgo: 0, price: 19500, margin: 0.14 },
  { status: "pricing", daysAgo: 2, price: 55000, margin: 0.17 },
  { status: "pricing", daysAgo: 1, price: 33000, margin: 0.15 },
  { status: "pricing", daysAgo: 3, price: 78000, margin: 0.18 },
  { status: "sent", daysAgo: 5, price: 24500, margin: 0.15 },
  { status: "sent", daysAgo: 4, price: 61000, margin: 0.17 },
  { status: "sent", daysAgo: 6, price: 45000, margin: 0.16 },
  { status: "sent", daysAgo: 3, price: 92000, margin: 0.19 },
  { status: "negotiating", daysAgo: 8, price: 38000, margin: 0.16 },
  { status: "negotiating", daysAgo: 10, price: 115000, margin: 0.2 },
  { status: "negotiating", daysAgo: 7, price: 185000, margin: 0.22 },
  {
    status: "confirmed",
    daysAgo: 14,
    daysAhead: 7,
    price: 52000,
    margin: 0.17,
  },
  {
    status: "confirmed",
    daysAgo: 12,
    daysAhead: 10,
    price: 88000,
    margin: 0.18,
  },
  {
    status: "confirmed",
    daysAgo: 9,
    daysAhead: 14,
    price: 34000,
    margin: 0.15,
  },
  {
    status: "confirmed",
    daysAgo: 20,
    daysAhead: 3,
    price: 142000,
    margin: 0.21,
  },
  { status: "completed", daysAgo: 30, price: 67000, margin: 0.18 },
  { status: "completed", daysAgo: 21, price: 48500, margin: 0.16 },
  { status: "lost", daysAgo: 15, price: 95000, margin: 0.19 },
];

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // ── 1. Insert clients ──────────────────────────────────────────────────────
  const { data: insertedClients, error: clientError } = await supabase
    .from("clients")
    .insert(CLIENTS.map((c) => ({ ...c })))
    .select("id, email");

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }

  const clientIds = insertedClients.map((c) => c.id);

  // ── 2. Insert aircraft ─────────────────────────────────────────────────────
  const { data: insertedAircraft, error: aircraftError } = await supabase
    .from("aircraft")
    .insert(
      AIRCRAFT_SEED.map((a) => ({
        ...a,
        status: "active",
        has_bathroom: a.has_bathroom,
      })),
    )
    .select("id, category, tail_number");

  if (aircraftError) {
    return NextResponse.json({ error: aircraftError.message }, { status: 500 });
  }

  const aircraftIds = insertedAircraft.map((a) => a.id);

  // ── 3. Insert pipeline trips + quotes ──────────────────────────────────────
  const now = new Date();

  const pipelineTrips = STATUSES.map((s, i) => {
    const route = PIPELINE_ROUTES[i % PIPELINE_ROUTES.length]!;
    const depDate = new Date(now);
    depDate.setDate(depDate.getDate() - s.daysAgo);
    const dateStr = depDate.toISOString().slice(0, 10);

    return {
      id: crypto.randomUUID(),
      client_id: clientIds[i % clientIds.length]!,
      legs: [
        {
          from_icao: route.from,
          to_icao: route.to,
          date: dateStr,
          time: "09:00",
        },
      ],
      trip_type: "one_way" as const,
      pax_adults: route.pax,
      pax_children: 0,
      pax_pets: 0,
      ai_extracted: true,
      wifi_required: i % 3 !== 0,
      bathroom_required: true,
      flexibility_hours: 1,
      flexibility_hours_return: 0,
      preferred_category: route.category,
      _status: s.status,
      _price: s.price,
      _margin: s.margin,
      _daysAhead: s.daysAhead,
      _daysAgo: s.daysAgo,
    };
  });

  const tripInserts = pipelineTrips.map(
    ({ _status, _price, _margin, _daysAhead, _daysAgo, ...t }) => t,
  );

  const { error: tripError } = await supabase.from("trips").insert(tripInserts);
  if (tripError) {
    return NextResponse.json({ error: tripError.message }, { status: 500 });
  }

  // Build quotes
  const quoteInserts = pipelineTrips.map((t, i) => {
    const aircraftId = aircraftIds[i % aircraftIds.length]!;
    const aircraft = insertedAircraft[i % insertedAircraft.length]!;

    const depDate = new Date(now);
    depDate.setDate(depDate.getDate() - t._daysAgo);

    let sentAt: string | null = null;
    let confirmedAt: string | null = null;
    let scheduledDep: string | null = null;
    let scheduledArr: string | null = null;
    let actualDep: string | null = null;
    let actualArr: string | null = null;
    let actualBlockHours: number | null = null;
    let wonLostReason: string | null = null;

    if (
      ["sent", "negotiating", "confirmed", "completed", "lost"].includes(
        t._status,
      )
    ) {
      sentAt = new Date(depDate.getTime() + 86400000).toISOString();
    }

    if (["confirmed", "completed"].includes(t._status)) {
      confirmedAt = new Date(depDate.getTime() + 2 * 86400000).toISOString();
      const daysAhead = t._daysAhead ?? 0;
      const schedDep = new Date(now);
      schedDep.setDate(schedDep.getDate() + daysAhead);
      schedDep.setUTCHours(9, 0, 0, 0);
      const flightHrs = 2.5 + Math.random() * 2;
      const schedArr = new Date(schedDep.getTime() + flightHrs * 3600000);
      scheduledDep = schedDep.toISOString();
      scheduledArr = schedArr.toISOString();
    }

    if (t._status === "completed") {
      const schedDep = new Date(depDate);
      schedDep.setUTCHours(9, 0, 0, 0);
      const flightHrs = 2.5 + Math.random() * 2;
      actualDep = schedDep.toISOString();
      actualArr = new Date(
        schedDep.getTime() + flightHrs * 3600000,
      ).toISOString();
      actualBlockHours = Math.round(flightHrs * 10) / 10;
    }

    if (t._status === "lost") {
      wonLostReason = "Client chose competitor — price sensitivity";
    }

    return {
      trip_id: t.id,
      client_id: t.client_id,
      aircraft_id: aircraftId,
      status: t._status,
      version: 1,
      margin_pct: t._margin,
      currency: "USD",
      chosen_aircraft_category: aircraft.category,
      estimated_total_hours: 2.5 + Math.random() * 2,
      sent_at: sentAt,
      confirmed_at: confirmedAt,
      scheduled_departure_time: scheduledDep,
      scheduled_arrival_time: scheduledArr,
      scheduled_total_hours: scheduledDep
        ? Math.round((2.5 + Math.random() * 2) * 10) / 10
        : null,
      actual_departure_time: actualDep,
      actual_arrival_time: actualArr,
      actual_block_hours: actualBlockHours,
      actual_total_hours: actualBlockHours,
      won_lost_reason: wonLostReason,
      _price: t._price,
      _margin: t._margin,
    };
  });

  const { data: insertedQuotes, error: quoteError } = await supabase
    .from("quotes")
    .insert(quoteInserts.map(({ _price, _margin, ...q }) => q))
    .select("id, status");

  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 });
  }

  // ── 4. Insert quote_costs for confirmed + completed ────────────────────────
  const costsToInsert = insertedQuotes
    .map((q, i) => {
      if (!["confirmed", "completed"].includes(q.status)) return null;
      const p = quoteInserts[i]!._price;
      const m = quoteInserts[i]!._margin;
      const subtotal = Math.round(p / (1 + m));
      const marginAmount = p - subtotal;
      const tax = Math.round(p * 0.07);
      const total = p + tax;
      const fuelCost = Math.round(subtotal * 0.4);
      const fboFees = Math.round(subtotal * 0.08);
      const repositioningCost = Math.round(subtotal * 0.06);
      const permitFees = Math.round(subtotal * 0.02);
      const crewOvernight = Math.round(subtotal * 0.04);
      const catering = Math.round(subtotal * 0.03);
      const peak = Math.round(subtotal * 0.02);
      return {
        quote_id: q.id,
        fuel_cost: fuelCost,
        fbo_fees: fboFees,
        repositioning_cost: repositioningCost,
        repositioning_hours: 0.5,
        permit_fees: permitFees,
        crew_overnight_cost: crewOvernight,
        catering_cost: catering,
        peak_day_surcharge: peak,
        subtotal,
        margin_amount: marginAmount,
        tax,
        total,
        per_leg_breakdown: [],
      };
    })
    .filter(Boolean);

  if (costsToInsert.length > 0) {
    const { error: costError } = await supabase
      .from("quote_costs")
      .insert(costsToInsert as NonNullable<(typeof costsToInsert)[number]>[]);
    if (costError) {
      return NextResponse.json({ error: costError.message }, { status: 500 });
    }
  }

  // ── 5. Seed 6 weeks of flight history ─────────────────────────────────────
  const historyTrips: {
    id: string;
    legs: Json;
    trip_type: string;
    pax_adults: number;
    pax_children: number;
    pax_pets: number;
    ai_extracted: boolean;
    wifi_required: boolean;
    bathroom_required: boolean;
    flexibility_hours: number;
    flexibility_hours_return: number;
  }[] = [];

  const historyQuotes: {
    trip_id: string;
    aircraft_id: string;
    status: string;
    chosen_aircraft_category: string;
    actual_departure_time: string;
    actual_arrival_time: string;
    actual_block_hours: number;
    actual_total_hours: number;
    scheduled_departure_time: string;
    scheduled_arrival_time: string;
    scheduled_total_hours: number;
    estimated_total_hours: number;
    margin_pct: number;
    currency: string;
    version: number;
  }[] = [];

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const historyStart = new Date(today);
  historyStart.setUTCDate(historyStart.getUTCDate() - 42);

  for (const plane of insertedAircraft) {
    const baseline = CATEGORY_BASELINE[plane.category] ?? 3.0;
    const cursor = new Date(historyStart);

    while (cursor < today) {
      const dow = cursor.getUTCDay();
      const dowMult = DOW_MULTIPLIER[dow] ?? 1.0;
      const roll = Math.random();
      const numFlights = roll < 0.25 ? 0 : roll < 0.75 ? 1 : 2;

      for (let f = 0; f < numFlights; f++) {
        const flightHours =
          Math.round(rand(baseline * 0.65, baseline * 1.35) * dowMult * 10) /
          10;
        const departureHour = 7 + Math.floor(rand(0, 9)) + f * 4;
        const departure = new Date(cursor);
        departure.setUTCHours(Math.min(departureHour, 20), 0, 0, 0);
        const arrival = new Date(
          departure.getTime() + flightHours * 3600 * 1000,
        );
        const route =
          ROUTE_PAIRS[Math.floor(Math.random() * ROUTE_PAIRS.length)]!;
        const dateStr = cursor.toISOString().slice(0, 10);
        const tripId = crypto.randomUUID();

        historyTrips.push({
          id: tripId,
          legs: [
            {
              from_icao: route[0] as string,
              to_icao: route[1] as string,
              date: dateStr,
              time: `${String(departure.getUTCHours()).padStart(2, "0")}:00`,
            },
          ] as Json,
          trip_type: "one_way",
          pax_adults: Math.max(1, Math.floor(rand(1, 6))),
          pax_children: 0,
          pax_pets: 0,
          ai_extracted: false,
          wifi_required: false,
          bathroom_required: false,
          flexibility_hours: 0,
          flexibility_hours_return: 0,
        });

        historyQuotes.push({
          trip_id: tripId,
          aircraft_id: plane.id,
          status: "completed",
          chosen_aircraft_category: plane.category,
          actual_departure_time: departure.toISOString(),
          actual_arrival_time: arrival.toISOString(),
          actual_block_hours: flightHours,
          actual_total_hours: flightHours,
          scheduled_departure_time: departure.toISOString(),
          scheduled_arrival_time: arrival.toISOString(),
          scheduled_total_hours: flightHours,
          estimated_total_hours: flightHours,
          margin_pct: 0.15,
          currency: "USD",
          version: 1,
        });
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  if (historyTrips.length > 0) {
    const { error: hTripErr } = await supabase
      .from("trips")
      .insert(historyTrips);
    if (hTripErr) {
      return NextResponse.json({ error: hTripErr.message }, { status: 500 });
    }

    const { error: hQuoteErr } = await supabase
      .from("quotes")
      .insert(historyQuotes);
    if (hQuoteErr) {
      return NextResponse.json({ error: hQuoteErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    clients_created: insertedClients.length,
    aircraft_created: insertedAircraft.length,
    quotes_created: insertedQuotes.length,
    history_flights: historyQuotes.length,
  });
}
