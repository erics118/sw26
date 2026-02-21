// ─── NOTAM integration ────────────────────────────────────────────────────────
// Three public sources, no API key required:
//   1. NASA DIP NOTAM API  — US NOTAMs (redistributes FAA SWIM data)
//   2. Autorouter API      — European NOTAMs (Eurocontrol EAD)
//   3. FAA ADDS ArcGIS     — US TFRs (geospatial open data)
//
// All functions fail gracefully (return [] on any error).

import type { NotamAlert, NotamType, NotamSeverity } from "./types";

const FETCH_TIMEOUT_MS = 8000;
const NASA_DIP_BASE = "https://dip.amesaero.nasa.gov";
const AUTOROUTER_BASE = "https://api.autorouter.aero/v1.0";
const FAA_ADDS_TFR_URL =
  "https://adds-faa.opendata.arcgis.com/datasets/1f48bcce855447138f3f0bcfdf55df65_0/query?where=1%3D1&outFields=*&f=json&resultRecordCount=200";

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function safeFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── NOTAM text classifier ────────────────────────────────────────────────────

function classifyNotamText(text: string): {
  type: NotamType;
  severity: NotamSeverity;
} {
  const t = text.toUpperCase();

  // TFR / restricted airspace
  if (t.includes("TFR") || t.includes("TEMPORARY FLIGHT RESTRICTION")) {
    return { type: "tfr", severity: "critical" };
  }
  // Runway closure
  if (
    (t.includes("RWY") || t.includes("RUNWAY")) &&
    (t.includes("CLSD") || t.includes("CLOSED"))
  ) {
    return { type: "runway_closure", severity: "critical" };
  }
  // Fuel outage
  if (
    t.includes("FUEL") &&
    (t.includes("UNAVAIL") || t.includes("OUTAGE") || t.includes("CLSD"))
  ) {
    return { type: "fuel_outage", severity: "caution" };
  }
  // Nav aid
  if (
    t.includes("ILS") ||
    t.includes("VOR") ||
    t.includes("NDB") ||
    t.includes("NAVAID") ||
    t.includes("LOC UNUSABLE")
  ) {
    return { type: "nav_aid", severity: "caution" };
  }

  return { type: "other", severity: "info" };
}

// ─── 1. NASA DIP NOTAM API (US NOTAMs) ───────────────────────────────────────

interface NasaDipNotam {
  notamId?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  notamText?: string;
  [key: string]: unknown;
}

export async function fetchUsNotams(
  icaos: string[],
  effectiveFrom: Date,
  effectiveTo: Date,
): Promise<NotamAlert[]> {
  const alerts: NotamAlert[] = [];

  for (const icao of icaos) {
    // NASA DIP endpoint — check current docs at https://dip.amesaero.nasa.gov
    const url = `${NASA_DIP_BASE}/api/v1/notams?location=${icao}&startDate=${effectiveFrom.toISOString()}&endDate=${effectiveTo.toISOString()}`;
    const data = await safeFetch<{ notams?: NasaDipNotam[] }>(url);
    if (!data?.notams) continue;

    for (const n of data.notams) {
      if (!n.notamText) continue;
      const { type, severity } = classifyNotamText(n.notamText);
      alerts.push({
        notam_id: n.notamId ?? `${icao}-${Date.now()}`,
        icao,
        type,
        raw_text: n.notamText,
        effective_from: n.startDate ?? null,
        effective_to: n.endDate ?? null,
        severity,
      });
    }
  }

  return alerts;
}

// ─── 2. Autorouter API (European NOTAMs) ─────────────────────────────────────

interface AutorouterNotam {
  id?: string | number;
  q?: string;
  a?: string; // ICAO location
  e?: string; // NOTAM text (E field)
  b?: string; // effective from
  c?: string; // effective to
  [key: string]: unknown;
}

export async function fetchEuropeanNotams(
  icaos: string[],
): Promise<NotamAlert[]> {
  // Only query non-K (non-US) airports
  const euroIcaos = icaos.filter((icao) => !icao.startsWith("K"));
  if (euroIcaos.length === 0) return [];

  const alerts: NotamAlert[] = [];
  const iteams = JSON.stringify(euroIcaos);
  const url = `${AUTOROUTER_BASE}/notam?itemas=${encodeURIComponent(iteams)}&limit=100`;
  const data = await safeFetch<{ data?: AutorouterNotam[] }>(url);
  if (!data?.data) return [];

  for (const n of data.data) {
    const text = n.e ?? "";
    if (!text) continue;
    const icao = n.a ?? "ZZZZ";
    const { type, severity } = classifyNotamText(text);
    alerts.push({
      notam_id: String(n.id ?? `${icao}-${Date.now()}`),
      icao,
      type,
      raw_text: text,
      effective_from: n.b ?? null,
      effective_to: n.c ?? null,
      severity,
    });
  }

  return alerts;
}

// ─── 3. FAA ADDS ArcGIS — US TFRs ────────────────────────────────────────────

interface ArcGisFeature {
  attributes?: {
    OBJECTID?: number;
    notam_number?: string;
    state?: string;
    type_code?: string;
    [key: string]: unknown;
  };
  geometry?: { rings?: number[][][] };
}

interface ArcGisResponse {
  features?: ArcGisFeature[];
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Fetches active US TFRs and filters to those intersecting the route bounding box.
 * The FAA ADDS ArcGIS layer is publicly accessible with no API key.
 */
export async function fetchTfrs(
  routeBbox?: BoundingBox,
): Promise<NotamAlert[]> {
  const data = await safeFetch<ArcGisResponse>(FAA_ADDS_TFR_URL);
  if (!data?.features) return [];

  const alerts: NotamAlert[] = [];
  for (const feature of data.features) {
    const attrs = feature.attributes ?? {};
    const id = String(attrs.OBJECTID ?? attrs.notam_number ?? Date.now());

    // If a bounding box provided, rough-check the TFR centroid
    if (routeBbox && feature.geometry?.rings?.[0]) {
      const ring = feature.geometry.rings[0];
      const lons = ring.map((p) => p[0] ?? 0);
      const lats = ring.map((p) => p[1] ?? 0);
      const centroidLon = lons.reduce((a, b) => a + b, 0) / lons.length;
      const centroidLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const inBbox =
        centroidLat >= routeBbox.minLat &&
        centroidLat <= routeBbox.maxLat &&
        centroidLon >= routeBbox.minLon &&
        centroidLon <= routeBbox.maxLon;
      if (!inBbox) continue;
    }

    alerts.push({
      notam_id: `TFR-${id}`,
      icao: "ZZZZ", // TFRs are not airport-specific
      type: "tfr",
      raw_text: `TFR ${attrs.notam_number ?? id} — ${attrs.type_code ?? "Restricted airspace"}`,
      effective_from: null,
      effective_to: null,
      severity: "critical",
    });
  }

  return alerts;
}

// ─── Public API: fetch all NOTAMs for a route ─────────────────────────────────

export async function fetchNotamsForRoute(
  icaos: string[],
  effectiveFrom: Date,
  effectiveTo: Date,
  routeBbox?: BoundingBox,
): Promise<NotamAlert[]> {
  const [usNotams, euroNotams, tfrs] = await Promise.all([
    fetchUsNotams(icaos, effectiveFrom, effectiveTo).catch(
      () => [] as NotamAlert[],
    ),
    fetchEuropeanNotams(icaos).catch(() => [] as NotamAlert[]),
    fetchTfrs(routeBbox).catch(() => [] as NotamAlert[]),
  ]);

  // Merge and deduplicate by notam_id
  const seen = new Set<string>();
  const all = [...usNotams, ...euroNotams, ...tfrs];
  return all.filter((n) => {
    if (seen.has(n.notam_id)) return false;
    seen.add(n.notam_id);
    return true;
  });
}
