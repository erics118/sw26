/**
 * POST /api/dev/seed-history
 *
 * Inserts ~6 weeks of synthetic completed flights (trips + quotes) for every
 * active aircraft in the database.  This populates the historical actuals that
 * lib/forecasting/demand.ts uses to compute baselines, DOW multipliers, and
 * utilization metrics.
 *
 * Safe to call multiple times – each call adds a new batch, so only call once
 * per environment unless you want to accumulate more history.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Typical revenue flight hours per category (P50 baseline target)
const CATEGORY_BASELINE: Record<string, number> = {
  turboprop: 2.5,
  light: 3.0,
  midsize: 3.5,
  "super-mid": 3.2,
  heavy: 4.5,
  "ultra-long": 5.0,
};

// Day-of-week demand shape: 0=Sun … 6=Sat
const DOW_MULTIPLIER = [1.25, 0.85, 0.9, 0.95, 1.1, 1.35, 1.2];

// Sample route pairs to make legs data look realistic
const ROUTE_PAIRS = [
  ["KLAX", "KLAS"],
  ["KTEB", "KMIA"],
  ["KSNA", "KSFO"],
  ["KMDW", "KDTW"],
  ["KBOS", "KJFK"],
  ["KPBI", "KATL"],
  ["KHPN", "KBWI"],
  ["KVAN", "KORD"],
  ["KBUR", "KDEN"],
  ["KDAL", "KHOU"],
];

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export async function POST() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: aircraft, error: aircraftError } = await supabase
    .from("aircraft")
    .select("id, category")
    .eq("status", "active");

  if (aircraftError) {
    return NextResponse.json({ error: aircraftError.message }, { status: 500 });
  }
  if (!aircraft?.length) {
    return NextResponse.json(
      { error: "No active aircraft found. Add aircraft first." },
      { status: 400 },
    );
  }

  // Build all trips and quotes ahead-of-time so we can match IDs without
  // relying on insertion order from Supabase.
  const trips: {
    id: string;
    legs: unknown;
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

  const quotes: {
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
  historyStart.setUTCDate(historyStart.getUTCDate() - 42); // 6 weeks back

  for (const plane of aircraft) {
    const baseline = CATEGORY_BASELINE[plane.category] ?? 3.0;

    const cursor = new Date(historyStart);
    while (cursor < today) {
      const dow = cursor.getUTCDay();
      const dowMult = DOW_MULTIPLIER[dow] ?? 1.0;

      // Probabilistic flight count per aircraft per day
      const roll = Math.random();
      const numFlights =
        roll < 0.25
          ? 0 // 25 % no-fly day
          : roll < 0.75
            ? 1 // 50 % one flight
            : 2; // 25 % two flights

      for (let f = 0; f < numFlights; f++) {
        const flightHours =
          Math.round(rand(baseline * 0.65, baseline * 1.35) * dowMult * 10) /
          10;

        // Departure between 07:00–16:00 UTC, stagger second flight
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

        trips.push({
          id: tripId,
          legs: [
            {
              from_icao: route[0],
              to_icao: route[1],
              date: dateStr,
              time: `${String(departure.getUTCHours()).padStart(2, "0")}:00`,
            },
          ],
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

        quotes.push({
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

  if (!trips.length) {
    return NextResponse.json({
      success: true,
      trips_created: 0,
      quotes_created: 0,
      message: "No flights generated (all days rolled as no-fly).",
    });
  }

  // Insert trips first (quotes FK → trips.id)
  const { error: tripError } = await supabase.from("trips").insert(trips);
  if (tripError) {
    return NextResponse.json({ error: tripError.message }, { status: 500 });
  }

  // Insert quotes
  const { error: quoteError } = await supabase.from("quotes").insert(quotes);
  if (quoteError) {
    return NextResponse.json({ error: quoteError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    aircraft_seeded: aircraft.length,
    trips_created: trips.length,
    quotes_created: quotes.length,
    history_window: `${historyStart.toISOString().slice(0, 10)} → ${today.toISOString().slice(0, 10)}`,
  });
}

/**
 * DELETE /api/dev/seed-history
 *
 * Removes all quotes with a null client_id and their associated trips.
 */
export async function DELETE() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Collect trip IDs linked to clientless quotes before deleting
  const { data: orphanQuotes, error: fetchError } = await supabase
    .from("quotes")
    .select("id, trip_id")
    .is("client_id", null);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  let quotesDeleted = 0;
  let tripsDeleted = 0;

  if (orphanQuotes?.length) {
    const quoteIds = orphanQuotes.map((q) => q.id);

    // Delete quote_costs first (FK → quotes)
    await supabase.from("quote_costs").delete().in("quote_id", quoteIds);

    // Delete quotes (FK → trips)
    const { error: quoteDeleteError } = await supabase
      .from("quotes")
      .delete()
      .in("id", quoteIds);

    if (quoteDeleteError) {
      return NextResponse.json(
        { error: quoteDeleteError.message },
        { status: 500 },
      );
    }
    quotesDeleted = quoteIds.length;
  }

  // Sweep up any trips that have no quotes referencing them
  const { data: allTrips } = await supabase.from("trips").select("id");
  if (allTrips?.length) {
    const { data: referencedTrips } = await supabase
      .from("quotes")
      .select("trip_id");
    const referencedSet = new Set(
      (referencedTrips ?? []).map((q) => q.trip_id),
    );
    const orphanedTripIds = allTrips
      .map((t) => t.id)
      .filter((id) => !referencedSet.has(id));

    if (orphanedTripIds.length) {
      const { count } = await supabase
        .from("trips")
        .delete({ count: "exact" })
        .in("id", orphanedTripIds);
      tripsDeleted = count ?? orphanedTripIds.length;
    }
  }

  return NextResponse.json({
    success: true,
    quotes_deleted: quotesDeleted,
    trips_deleted: tripsDeleted,
  });
}
