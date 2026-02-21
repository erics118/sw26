/**
 * Great-circle distance between two ICAO airport codes.
 * Falls back to 500 nm if either code is not in the static table.
 */

interface LatLon {
  lat: number;
  lon: number;
}

// Common airports: ICAO → lat/lon (degrees)
const AIRPORTS: Record<string, LatLon> = {
  // USA
  KATL: { lat: 33.6407, lon: -84.4277 },
  KBOS: { lat: 42.3656, lon: -71.0096 },
  KBUR: { lat: 34.2007, lon: -118.3585 },
  KBWI: { lat: 39.1754, lon: -76.6683 },
  KCLT: { lat: 35.214, lon: -80.9431 },
  KCLEV: { lat: 41.4117, lon: -81.8498 },
  KCRW: { lat: 38.3731, lon: -81.5932 },
  KDAL: { lat: 32.8471, lon: -96.8518 },
  KDCA: { lat: 38.8521, lon: -77.0377 },
  KDEN: { lat: 39.8561, lon: -104.6737 },
  KDFW: { lat: 32.8998, lon: -97.0403 },
  KDTW: { lat: 42.2124, lon: -83.3534 },
  KEWR: { lat: 40.6895, lon: -74.1745 },
  KFLL: { lat: 26.0726, lon: -80.1527 },
  KHOU: { lat: 29.6454, lon: -95.2789 },
  KIND: { lat: 39.7173, lon: -86.294 },
  KJFK: { lat: 40.6398, lon: -73.7789 },
  KLAS: { lat: 36.08, lon: -115.1522 },
  KLAX: { lat: 33.9425, lon: -118.408 },
  KMCO: { lat: 28.4294, lon: -81.309 },
  KMDW: { lat: 41.786, lon: -87.7524 },
  KMEM: { lat: 35.0424, lon: -89.9767 },
  KMIA: { lat: 25.7959, lon: -80.287 },
  KMSP: { lat: 44.8848, lon: -93.2223 },
  KOAK: { lat: 37.7213, lon: -122.2208 },
  KORD: { lat: 41.9742, lon: -87.9073 },
  KPBI: { lat: 26.6832, lon: -80.0956 },
  KPDX: { lat: 45.5888, lon: -122.5975 },
  KPHL: { lat: 39.8719, lon: -75.2411 },
  KPHX: { lat: 33.4373, lon: -112.0078 },
  KPIT: { lat: 40.4915, lon: -80.2329 },
  KRDU: { lat: 35.8776, lon: -78.7875 },
  KRSW: { lat: 26.5362, lon: -81.7552 },
  KSАН: { lat: 32.7336, lon: -117.1897 },
  KSEA: { lat: 47.4502, lon: -122.3088 },
  KSFO: { lat: 37.6213, lon: -122.379 },
  KSLC: { lat: 40.7884, lon: -111.9778 },
  KSMF: { lat: 38.6954, lon: -121.5908 },
  KSTL: { lat: 38.7487, lon: -90.37 },
  KTEB: { lat: 40.8501, lon: -74.0608 },
  KTPA: { lat: 27.9755, lon: -82.5332 },
  KVNY: { lat: 34.2098, lon: -118.4899 },
  KBED: { lat: 42.4699, lon: -71.2896 },
  KPWK: { lat: 42.1142, lon: -87.9015 },
  KHPN: { lat: 41.0671, lon: -73.7076 },
  KMVY: { lat: 41.3931, lon: -70.6154 },
  KACK: { lat: 41.2531, lon: -70.0603 },
  KASE: { lat: 39.2232, lon: -106.8688 },
  KVAIL: { lat: 39.2232, lon: -106.8688 }, // alias
  KHST: { lat: 25.4888, lon: -80.3836 },
  KOPF: { lat: 25.9074, lon: -80.2784 },
  KFXE: { lat: 26.1973, lon: -80.1707 },
  // Canada
  CYYZ: { lat: 43.6772, lon: -79.6306 },
  CYVR: { lat: 49.1967, lon: -123.1815 },
  CYUL: { lat: 45.4706, lon: -73.7408 },
  CYYC: { lat: 51.1131, lon: -114.0199 },
  CYOW: { lat: 45.3225, lon: -75.6692 },
  // UK / Europe
  EGLL: { lat: 51.477, lon: -0.4613 },
  EGKK: { lat: 51.1481, lon: -0.1903 },
  EGLC: { lat: 51.5053, lon: 0.0553 },
  LFPG: { lat: 49.0097, lon: 2.5478 },
  LFPB: { lat: 48.9694, lon: 2.4414 },
  EHAM: { lat: 52.3086, lon: 4.7639 },
  EDDB: { lat: 52.3667, lon: 13.5033 },
  EDDM: { lat: 48.3537, lon: 11.7751 },
  LSZH: { lat: 47.4647, lon: 8.5492 },
  LIRF: { lat: 41.8003, lon: 12.2389 },
  LEMD: { lat: 40.4936, lon: -3.5668 },
  LPPT: { lat: 38.7813, lon: -9.1359 },
  LSGG: { lat: 46.238, lon: 6.1089 },
  EBCI: { lat: 50.4722, lon: 4.4528 },
  LFMN: { lat: 43.6584, lon: 7.2159 },
  LOWI: { lat: 47.26, lon: 11.344 },
  LOWW: { lat: 48.1103, lon: 16.5697 },
  // Middle East
  OMDB: { lat: 25.2532, lon: 55.3657 },
  OMDW: { lat: 24.8961, lon: 55.1614 },
  OMAA: { lat: 24.4328, lon: 54.6511 },
  OERK: { lat: 24.9576, lon: 46.6988 },
  // Asia-Pacific
  VHHH: { lat: 22.308, lon: 113.9185 },
  RJTT: { lat: 35.5494, lon: 139.7798 },
  WSSS: { lat: 1.3644, lon: 103.9915 },
  YSSY: { lat: -33.9461, lon: 151.1772 },
  YMML: { lat: -37.6733, lon: 144.8433 },
  // Caribbean
  TNCM: { lat: 18.041, lon: -63.1089 },
  MBPV: { lat: 21.7737, lon: -72.2655 },
  MYGF: { lat: 26.5587, lon: -78.6956 },
  MDPP: { lat: 19.758, lon: -70.5701 },
  TJSJ: { lat: 18.4394, lon: -66.0018 },
};

const FALLBACK_DISTANCE_NM = 500;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine great-circle distance in nautical miles.
 */
export function distanceNm(icaoA: string, icaoB: string): number {
  const a = AIRPORTS[icaoA.toUpperCase()];
  const b = AIRPORTS[icaoB.toUpperCase()];
  if (!a || !b) return FALLBACK_DISTANCE_NM;

  const R = 3440.065; // Earth radius in nm
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/** Whether a given ICAO is known. */
export function knownAirport(icao: string): boolean {
  return icao.toUpperCase() in AIRPORTS;
}
