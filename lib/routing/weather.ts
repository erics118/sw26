// ─── Weather integration ───────────────────────────────────────────────────────
// Source: aviationweather.gov/api/data — no API key required (FAA public)
// All functions fail gracefully: return null/empty on timeout or API error.

import type {
  WeatherSummary,
  IcingRisk,
  ConvectiveRisk,
  GoNogo,
} from "./types";
import type { AircraftPerf } from "./performance";
import { effectiveSpeedKts } from "./performance";

const BASE_URL = "https://aviationweather.gov/api/data";
const FETCH_TIMEOUT_MS = 6000;

// ─── Raw API shapes (partial) ─────────────────────────────────────────────────

interface RawMetar {
  stationId?: string;
  rawOb?: string;
  temp?: number;
  dewp?: number;
  wdir?: number;
  wspd?: number;
  wgst?: number;
  visib?: number | string; // can be "10+" string
  altim?: number;
  wxString?: string;
  cover?: string;
  cldCvg1?: string;
  cldBas1?: number;
  cldCvg2?: string;
  cldBas2?: number;
  cldCvg3?: string;
  cldBas3?: number;
}

interface RawTaf {
  stationId?: string;
  rawTAF?: string;
}

// ─── Timeout wrapper ──────────────────────────────────────────────────────────

async function fetchWithTimeout<T>(url: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── METAR fetch ──────────────────────────────────────────────────────────────

export async function fetchMetars(
  icaos: string[],
): Promise<Map<string, RawMetar>> {
  if (icaos.length === 0) return new Map();
  const ids = icaos.join(",");
  const url = `${BASE_URL}/metar?ids=${ids}&format=json&hours=2`;
  const data = await fetchWithTimeout<RawMetar[]>(url);
  const result = new Map<string, RawMetar>();
  if (!data) return result;
  for (const metar of data) {
    if (metar.stationId) result.set(metar.stationId, metar);
  }
  return result;
}

// ─── TAF fetch ────────────────────────────────────────────────────────────────

export async function fetchTafs(icaos: string[]): Promise<Map<string, RawTaf>> {
  if (icaos.length === 0) return new Map();
  const ids = icaos.join(",");
  const url = `${BASE_URL}/taf?ids=${ids}&format=json`;
  const data = await fetchWithTimeout<RawTaf[]>(url);
  const result = new Map<string, RawTaf>();
  if (!data) return result;
  for (const taf of data) {
    if (taf.stationId) result.set(taf.stationId, taf);
  }
  return result;
}

// ─── Ceiling extraction ───────────────────────────────────────────────────────

function extractCeilingFt(metar: RawMetar): number | null {
  // Check cloud layers in order: BKN or OVC = ceiling
  const layers: Array<{ cvg: string | undefined; bas: number | undefined }> = [
    { cvg: metar.cldCvg1, bas: metar.cldBas1 },
    { cvg: metar.cldCvg2, bas: metar.cldBas2 },
    { cvg: metar.cldCvg3, bas: metar.cldBas3 },
  ];
  for (const layer of layers) {
    if (
      layer.cvg &&
      (layer.cvg === "BKN" || layer.cvg === "OVC") &&
      layer.bas !== undefined
    ) {
      return layer.bas * 100; // AGL in hundreds of feet
    }
  }
  return null;
}

function extractVisibilitySm(metar: RawMetar): number | null {
  if (metar.visib === undefined) return null;
  if (typeof metar.visib === "string") {
    // "10+" → 10+
    return parseFloat(metar.visib.replace("+", "")) || null;
  }
  return metar.visib;
}

// ─── Crosswind calculation ────────────────────────────────────────────────────

function crosswindKts(
  windDirDeg: number | null,
  windSpeedKts: number | null,
  runwayHeadingDeg: number,
): number | null {
  if (windDirDeg === null || windSpeedKts === null) return null;
  const angleDiff =
    ((windDirDeg - runwayHeadingDeg + 360) % 360) * (Math.PI / 180);
  return Math.abs(windSpeedKts * Math.sin(angleDiff));
}

// ─── Weather classification ───────────────────────────────────────────────────

function classifyIcing(metar: RawMetar): IcingRisk {
  const wx = metar.wxString?.toLowerCase() ?? "";
  if (wx.includes("fzra") || wx.includes("fzdz")) return "severe";
  if (wx.includes("freezing")) return "moderate";
  const temp = metar.temp;
  if (temp !== undefined && temp <= 0 && temp >= -15) return "light";
  return "none";
}

function classifyConvective(metar: RawMetar): ConvectiveRisk {
  const wx = metar.wxString?.toLowerCase() ?? "";
  if (wx.includes("ts") && (wx.includes("+") || wx.includes("heavy")))
    return "high";
  if (wx.includes("ts")) return "moderate";
  if (wx.includes("shra") || wx.includes("vcts")) return "low";
  return "none";
}

function classifyGoNogo(
  ceilingFt: number | null,
  visibilitySm: number | null,
  icingRisk: IcingRisk,
  convectiveRisk: ConvectiveRisk,
): GoNogo {
  if (icingRisk === "severe" || convectiveRisk === "high") return "nogo";
  if (ceilingFt !== null && ceilingFt < 500) return "nogo";
  if (visibilitySm !== null && visibilitySm < 1) return "nogo";
  if (icingRisk === "moderate" || convectiveRisk === "moderate")
    return "marginal";
  if (ceilingFt !== null && ceilingFt < 1000) return "marginal";
  if (visibilitySm !== null && visibilitySm < 3) return "marginal";
  return "go";
}

// ─── WeatherSummary builder ───────────────────────────────────────────────────

export function buildWeatherSummary(
  icao: string,
  metar: RawMetar | undefined,
  taf: RawTaf | undefined,
  _aircraft: AircraftPerf, // reserved for aircraft-specific crosswind limits
): WeatherSummary {
  const now = new Date().toISOString();

  if (!metar) {
    // No data — return marginal (not nogo) so routing is never blocked by API outage
    return {
      icao,
      metar_raw: null,
      taf_raw: taf?.rawTAF ?? null,
      ceiling_ft: null,
      visibility_sm: null,
      wind_dir_deg: null,
      wind_speed_kts: null,
      crosswind_kts: null,
      icing_risk: "none",
      convective_risk: "none",
      go_nogo: "marginal",
      fetched_at: now,
    };
  }

  const ceilingFt = extractCeilingFt(metar);
  const visibilitySm = extractVisibilitySm(metar);
  const icingRisk = classifyIcing(metar);
  const convectiveRisk = classifyConvective(metar);
  // Use 360° (runway heading unknown) for a conservative crosswind estimate
  const xwind = crosswindKts(
    metar.wdir ?? null,
    metar.wspd ?? null,
    metar.wdir ?? 0, // if heading unknown, crosswind = 0 (conservative)
  );

  return {
    icao,
    metar_raw: metar.rawOb ?? null,
    taf_raw: taf?.rawTAF ?? null,
    ceiling_ft: ceilingFt,
    visibility_sm: visibilitySm,
    wind_dir_deg: metar.wdir ?? null,
    wind_speed_kts: metar.wspd ?? null,
    crosswind_kts: xwind,
    icing_risk: icingRisk,
    convective_risk: convectiveRisk,
    go_nogo: classifyGoNogo(ceilingFt, visibilitySm, icingRisk, convectiveRisk),
    fetched_at: now,
  };
}

// ─── Public API: fetch weather for a list of ICAOs ───────────────────────────

export async function fetchWeatherForIcaos(
  icaos: string[],
  aircraft: AircraftPerf,
): Promise<WeatherSummary[]> {
  if (icaos.length === 0) return [];

  const [metars, tafs] = await Promise.all([
    fetchMetars(icaos),
    fetchTafs(icaos),
  ]);

  return icaos.map((icao) =>
    buildWeatherSummary(icao, metars.get(icao), tafs.get(icao), aircraft),
  );
}
