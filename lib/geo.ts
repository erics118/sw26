/**
 * Great-circle distance utilities for ICAO airport codes.
 *
 * haversineNm — returns null if either code is unknown
 * distanceNm  — returns 500 nm fallback if either code is unknown (use for pricing)
 * knownAirport — whether an ICAO code is in the static table
 */

interface LatLon {
  lat: number;
  lon: number;
}

const AIRPORTS: Record<string, LatLon> = {
  // USA — East
  KBDL: { lat: 41.9389, lon: -72.6832 },
  KBNA: { lat: 36.1245, lon: -86.6782 },
  KBOS: { lat: 42.3656, lon: -71.0096 },
  KBWI: { lat: 39.1754, lon: -76.6683 },
  KCLT: { lat: 35.214, lon: -80.9431 },
  KCVG: { lat: 39.0488, lon: -84.6678 },
  KDCA: { lat: 38.8521, lon: -77.0377 },
  KDTW: { lat: 42.2124, lon: -83.3534 },
  KEWR: { lat: 40.6895, lon: -74.1745 },
  KFLL: { lat: 26.0726, lon: -80.1527 },
  KIAD: { lat: 38.9531, lon: -77.4565 },
  KJFK: { lat: 40.6398, lon: -73.7789 },
  KLGA: { lat: 40.7772, lon: -73.8726 },
  KMEM: { lat: 35.0424, lon: -89.9767 },
  KMIA: { lat: 25.7959, lon: -80.287 },
  KMSP: { lat: 44.8848, lon: -93.2223 },
  KORD: { lat: 41.9742, lon: -87.9073 },
  KPBI: { lat: 26.6832, lon: -80.0956 },
  KPHL: { lat: 39.8719, lon: -75.2411 },
  KPIT: { lat: 40.4915, lon: -80.2329 },
  KRDU: { lat: 35.8776, lon: -78.7875 },
  KSTL: { lat: 38.7487, lon: -90.37 },
  KTEB: { lat: 40.8501, lon: -74.0608 },
  KATL: { lat: 33.6407, lon: -84.4277 },
  KBUR: { lat: 34.2007, lon: -118.3585 },
  KIND: { lat: 39.7173, lon: -86.294 },
  KMDW: { lat: 41.786, lon: -87.7524 },
  KORL: { lat: 28.5455, lon: -81.332 },
  KMCO: { lat: 28.4294, lon: -81.309 },
  // USA — South / Gulf
  KDAL: { lat: 32.8471, lon: -96.8518 },
  KDFW: { lat: 32.8998, lon: -97.0403 },
  KHOU: { lat: 29.6454, lon: -95.2789 },
  KIAH: { lat: 29.9902, lon: -95.3368 },
  KRSW: { lat: 26.5362, lon: -81.7552 },
  KTPA: { lat: 27.9755, lon: -82.5332 },
  KHST: { lat: 25.4888, lon: -80.3836 },
  KOPF: { lat: 25.9074, lon: -80.2784 },
  KFXE: { lat: 26.1973, lon: -80.1707 },
  // USA — Mountain / West
  KASE: { lat: 39.2232, lon: -106.8688 },
  KDEN: { lat: 39.8561, lon: -104.6737 },
  KLAS: { lat: 36.08, lon: -115.1522 },
  KPHX: { lat: 33.4373, lon: -112.0078 },
  KSLC: { lat: 40.7884, lon: -111.9778 },
  KVAIL: { lat: 39.2232, lon: -106.8688 }, // alias for KASE
  // USA — Pacific
  KHPN: { lat: 41.0671, lon: -73.7076 },
  KLAX: { lat: 33.9425, lon: -118.408 },
  KOAK: { lat: 37.7213, lon: -122.2208 },
  KPDX: { lat: 45.5888, lon: -122.5975 },
  KSEA: { lat: 47.4502, lon: -122.3088 },
  KSFO: { lat: 37.6213, lon: -122.379 },
  KSJC: { lat: 37.3626, lon: -121.929 },
  KSMF: { lat: 38.6954, lon: -121.5908 },
  KSNA: { lat: 33.6757, lon: -117.8683 },
  KSAN: { lat: 32.7336, lon: -117.1897 },
  KVNY: { lat: 34.2098, lon: -118.4899 },
  // USA — Northeast private
  KACK: { lat: 41.2531, lon: -70.0603 },
  KBED: { lat: 42.4699, lon: -71.2896 },
  KMVY: { lat: 41.3931, lon: -70.6154 },
  KPWK: { lat: 42.1142, lon: -87.9015 },
  KCRW: { lat: 38.3731, lon: -81.5932 },
  KCLEV: { lat: 41.4117, lon: -81.8498 },
  // Canada
  CYOW: { lat: 45.3225, lon: -75.6692 },
  CYUL: { lat: 45.4706, lon: -73.7408 },
  CYVR: { lat: 49.1967, lon: -123.1815 },
  CYYC: { lat: 51.1131, lon: -114.0199 },
  CYYZ: { lat: 43.6772, lon: -79.6306 },
  // UK / Europe
  EBCI: { lat: 50.4722, lon: 4.4528 },
  EDDB: { lat: 52.3667, lon: 13.5033 },
  EDDF: { lat: 50.0379, lon: 8.5622 },
  EDDM: { lat: 48.3537, lon: 11.7751 },
  EGKB: { lat: 51.3312, lon: 0.0324 },
  EGKK: { lat: 51.1481, lon: -0.1903 },
  EGLC: { lat: 51.5053, lon: 0.0553 },
  EGLL: { lat: 51.477, lon: -0.4613 },
  EHAM: { lat: 52.3086, lon: 4.7639 },
  LEIB: { lat: 38.8729, lon: 1.3731 },
  LEMD: { lat: 40.4936, lon: -3.5668 },
  LFMN: { lat: 43.6584, lon: 7.2159 },
  LFPB: { lat: 48.9694, lon: 2.4414 },
  LFPG: { lat: 49.0097, lon: 2.5478 },
  LICJ: { lat: 38.1759, lon: 13.0909 },
  LIRF: { lat: 41.8003, lon: 12.2389 },
  LMML: { lat: 35.8574, lon: 14.4775 },
  LOWW: { lat: 48.1103, lon: 16.5697 },
  LOWI: { lat: 47.26, lon: 11.344 },
  LPPT: { lat: 38.7813, lon: -9.1359 },
  LSGG: { lat: 46.238, lon: 6.1089 },
  LSZH: { lat: 47.4647, lon: 8.5492 },
  UUEE: { lat: 55.9726, lon: 37.4146 },
  // Middle East
  HECA: { lat: 30.1219, lon: 31.4056 },
  LLBG: { lat: 32.0114, lon: 34.8867 },
  OMAA: { lat: 24.4328, lon: 54.6511 },
  OMDB: { lat: 25.2532, lon: 55.3657 },
  OMDW: { lat: 24.8961, lon: 55.1614 },
  OERK: { lat: 24.9576, lon: 46.6988 },
  // Asia-Pacific
  RJAA: { lat: 35.7648, lon: 140.3864 },
  RJTT: { lat: 35.5494, lon: 139.7798 },
  VABB: { lat: 19.0896, lon: 72.8656 },
  VIDP: { lat: 28.5562, lon: 77.1 },
  VHHH: { lat: 22.308, lon: 113.9185 },
  WSSS: { lat: 1.3644, lon: 103.9915 },
  YMML: { lat: -37.6733, lon: 144.8433 },
  YSSY: { lat: -33.9461, lon: 151.1772 },
  ZBAA: { lat: 40.0799, lon: 116.6031 },
  // Caribbean
  MBPV: { lat: 21.7737, lon: -72.2655 },
  MDPP: { lat: 19.758, lon: -70.5701 },
  MYGF: { lat: 26.5587, lon: -78.6956 },
  TJSJ: { lat: 18.4394, lon: -66.0018 },
  TNCM: { lat: 18.041, lon: -63.1089 },
  // Latin America
  MMMX: { lat: 19.4363, lon: -99.0721 },
  SAEZ: { lat: -34.8222, lon: -58.5358 },
  SBGR: { lat: -23.4356, lon: -46.4731 },
  SEQM: { lat: -0.1292, lon: -78.3575 },
  SKBO: { lat: 4.7016, lon: -74.1469 },
};

const FALLBACK_DISTANCE_NM = 500;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversine(a: LatLon, b: LatLon): number {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Great-circle distance in nm. Returns null if either ICAO is unknown. */
export function haversineNm(icao1: string, icao2: string): number | null {
  const a = AIRPORTS[icao1.toUpperCase()];
  const b = AIRPORTS[icao2.toUpperCase()];
  if (!a || !b) return null;
  return haversine(a, b);
}

/** Great-circle distance in nm. Returns 500 nm fallback if either ICAO is unknown. */
export function distanceNm(icaoA: string, icaoB: string): number {
  const a = AIRPORTS[icaoA.toUpperCase()];
  const b = AIRPORTS[icaoB.toUpperCase()];
  if (!a || !b) return FALLBACK_DISTANCE_NM;
  return haversine(a, b);
}

/** Whether a given ICAO code is in the static table. */
export function knownAirport(icao: string): boolean {
  return icao.toUpperCase() in AIRPORTS;
}
