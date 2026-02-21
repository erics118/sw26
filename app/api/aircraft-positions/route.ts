import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAirport } from "@/lib/routing/airport-db";
import type { Flight } from "@/lib/ops/types";

export async function GET() {
  const supabase = await createClient();

  try {
    // Fetch all active aircraft with their home base
    const { data: aircraft, error } = await supabase
      .from("aircraft")
      .select("id, tail_number, category, home_base_icao")
      .eq("status", "active");

    if (error || !aircraft) {
      return NextResponse.json(
        { error: "Failed to fetch aircraft" },
        { status: 500 },
      );
    }

    // Convert aircraft to Flight objects with coordinates
    const flights: Flight[] = [];

    for (const plane of aircraft) {
      const airportIcao = plane.home_base_icao || "KJFK"; // Default to KJFK
      const airport = await getAirport(airportIcao);

      if (!airport) continue;

      const flight: Flight = {
        id: plane.id,
        callsign: plane.tail_number,
        tail: plane.tail_number,
        aircraftType: plane.category,
        lat: airport.lat,
        lon: airport.lon,
        heading: Math.floor(Math.random() * 360), // Random heading (aircraft at rest)
        groundspeed: 0,
        altitude: airport.elevation_ft
          ? Math.round(airport.elevation_ft / 100)
          : 0,
        origin: airportIcao,
        destination: airportIcao,
        originCoords: [airport.lat, airport.lon],
        destCoords: [airport.lat, airport.lon],
        eta: new Date().toISOString(),
        etd: new Date().toISOString(),
        status: "green",
        pax: 0,
        client: "—",
        reasons: [],
        inAir: false,
        trail: [[airport.lat, airport.lon]],
      };

      flights.push(flight);
    }

    return NextResponse.json({ flights });
  } catch (error) {
    console.error("Error fetching aircraft positions:", error);
    return NextResponse.json(
      { error: "Failed to fetch aircraft positions" },
      { status: 500 },
    );
  }
}
