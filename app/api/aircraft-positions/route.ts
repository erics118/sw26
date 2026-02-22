import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Flight } from "@/lib/ops/types";
import type { Json } from "@/lib/database.types";

export async function GET() {
  const supabase = await createClient();

  const { data: positions, error } = await supabase
    .from("aircraft_positions")
    .select("*, aircraft(id, tail_number, category)")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!positions?.length) {
    return NextResponse.json({ flights: [] });
  }

  const icaos = new Set<string>();
  for (const p of positions) {
    if (p.origin_icao) icaos.add(p.origin_icao);
    if (p.destination_icao) icaos.add(p.destination_icao);
  }

  const airportCoords: Record<string, [number, number]> = {};
  if (icaos.size > 0) {
    const { data: airports } = await supabase
      .from("airports")
      .select("icao, lat, lon")
      .in("icao", [...icaos]);

    if (airports) {
      for (const ap of airports) {
        airportCoords[ap.icao] = [ap.lat, ap.lon];
      }
    }
  }

  const flights: Flight[] = positions.map((p) => {
    const aircraft = p.aircraft as {
      id: string;
      tail_number: string;
      category: string;
    } | null;

    const originCoords: [number, number] = p.origin_icao
      ? (airportCoords[p.origin_icao] ?? [0, 0])
      : [p.lat, p.lon];
    const destCoords: [number, number] = p.destination_icao
      ? (airportCoords[p.destination_icao] ?? [0, 0])
      : [p.lat, p.lon];

    const trail = Array.isArray(p.trail)
      ? (p.trail as [number, number][])
      : parseTrail(p.trail);

    return {
      id: p.aircraft_id,
      callsign: p.callsign ?? aircraft?.tail_number ?? "—",
      tail: aircraft?.tail_number ?? "—",
      aircraftType: aircraft?.category ?? "unknown",
      lat: p.lat,
      lon: p.lon,
      heading: p.heading,
      groundspeed: p.groundspeed_kts,
      altitude: p.altitude_ft,
      origin: p.origin_icao ?? "—",
      destination: p.destination_icao ?? "—",
      originCoords,
      destCoords,
      eta: p.eta ? formatTime(p.eta) : "—",
      etd: p.etd ? formatTime(p.etd) : "—",
      status: (p.status as Flight["status"]) ?? "green",
      pax: p.pax,
      client: p.client_name ?? "—",
      reasons: p.reasons ?? [],
      inAir: p.in_air,
      trail,
    };
  });

  return NextResponse.json({ flights });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}Z`;
}

function parseTrail(raw: Json): [number, number][] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is [number, number] =>
      Array.isArray(item) && item.length === 2,
  );
}
