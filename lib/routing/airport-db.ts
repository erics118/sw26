import { createClient } from "@/lib/supabase/server";
import { RoutingError } from "./types";

// ─── Airport record from Supabase ────────────────────────────────────────────

export interface AirportRecord {
  icao: string;
  name: string;
  city: string | null;
  country_code: string;
  lat: number;
  lon: number;
  elevation_ft: number | null;
  longest_runway_ft: number | null;
  fuel_jet_a: boolean;
  fuel_price_usd_gal: number | null;
  fbo_fee_usd: number | null;
  operating_hours_utc: { from: string; to: string } | null;
  curfew_utc: { from: string; to: string } | null;
  customs_available: boolean;
  deicing_available: boolean;
  slot_required: boolean;
}

const AIRPORT_COLUMNS =
  "icao,name,city,country_code,lat,lon,elevation_ft,longest_runway_ft,fuel_jet_a,fuel_price_usd_gal,fbo_fee_usd,operating_hours_utc,curfew_utc,customs_available,deicing_available,slot_required";

// ─── Single airport lookup ────────────────────────────────────────────────────

export async function getAirport(icao: string): Promise<AirportRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("airports")
    .select(AIRPORT_COLUMNS)
    .eq("icao", icao.toUpperCase())
    .single();

  if (error || !data) return null;
  return data as AirportRecord;
}

// Like getAirport but throws RoutingError if not found
export async function requireAirport(icao: string): Promise<AirportRecord> {
  const airport = await getAirport(icao);
  if (!airport) {
    throw new RoutingError(
      `Unknown airport: ${icao}. Add it via the airport admin panel before routing.`,
      "UNKNOWN_AIRPORT",
    );
  }
  return airport;
}

// ─── Fuel stop candidate search ───────────────────────────────────────────────

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

// Returns airports within bbox that have Jet-A and meet the min runway requirement.
// Uses a SQL bounding box pre-filter for efficiency; further filtering is done in TypeScript.
export async function getFuelStopCandidates(
  minRunwayFt: number,
  bbox: BoundingBox,
): Promise<AirportRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("airports")
    .select(AIRPORT_COLUMNS)
    .eq("fuel_jet_a", true)
    .gte("longest_runway_ft", minRunwayFt)
    .gte("lat", bbox.minLat)
    .lte("lat", bbox.maxLat)
    .gte("lon", bbox.minLon)
    .lte("lon", bbox.maxLon);

  if (error || !data) return [];
  return data as AirportRecord[];
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

const EARTH_RADIUS_NM = 3440.065;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two AirportRecords in nautical miles. */
export function haversineNm(a: AirportRecord, b: AirportRecord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon;
  return EARTH_RADIUS_NM * 2 * Math.asin(Math.sqrt(h));
}

/** Great-circle midpoint between two airports. */
export function midpointLatLon(
  a: AirportRecord,
  b: AirportRecord,
): { lat: number; lon: number } {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const lon1 = toRad(a.lon);

  const Bx = Math.cos(lat2) * Math.cos(dLon);
  const By = Math.cos(lat2) * Math.sin(dLon);
  const lat = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + Bx) ** 2 + By ** 2),
  );
  const lon = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);

  return {
    lat: (lat * 180) / Math.PI,
    lon: (((lon * 180) / Math.PI + 540) % 360) - 180, // normalize to -180..180
  };
}

/**
 * Builds a bounding box centered on a point, expanded by radiusNm in all directions.
 * Degrees per nautical mile ≈ 1/60 lat; lon varies by cos(lat).
 */
export function buildBoundingBox(
  centerLat: number,
  centerLon: number,
  radiusNm: number,
): BoundingBox {
  const latDelta = radiusNm / 60;
  const lonDelta = radiusNm / (60 * Math.cos(toRad(centerLat)));
  return {
    minLat: centerLat - latDelta,
    maxLat: centerLat + latDelta,
    minLon: centerLon - lonDelta,
    maxLon: centerLon + lonDelta,
  };
}

// ─── Curfew check ─────────────────────────────────────────────────────────────

/**
 * Returns true if the arrival time (UTC ISO string) falls within the airport's curfew window.
 * Curfew times are in UTC (HH:MM format).
 */
export function isWithinCurfew(
  airport: AirportRecord,
  arrivalUtc: Date,
): boolean {
  if (!airport.curfew_utc) return false;

  const h = arrivalUtc.getUTCHours();
  const m = arrivalUtc.getUTCMinutes();
  const arrivalMinutes = h * 60 + m;

  const [fromH = 0, fromM = 0] = airport.curfew_utc.from.split(":").map(Number);
  const [toH = 0, toM = 0] = airport.curfew_utc.to.split(":").map(Number);
  const curfewFrom = fromH * 60 + fromM;
  const curfewTo = toH * 60 + toM;

  // Handle overnight curfews (e.g. 23:00-06:00)
  if (curfewFrom > curfewTo) {
    return arrivalMinutes >= curfewFrom || arrivalMinutes <= curfewTo;
  }
  return arrivalMinutes >= curfewFrom && arrivalMinutes <= curfewTo;
}
