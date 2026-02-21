// Great-circle distance using the Haversine formula.
// Returns distance in nautical miles, or null if either ICAO code is unknown.

const AIRPORT_COORDS: Record<string, [number, number]> = {
  // North America
  KJFK: [40.6413, -73.778],
  KLAX: [33.9425, -118.408],
  KORD: [41.9742, -87.9073],
  KATL: [33.6407, -84.4277],
  KDFW: [32.8998, -97.0403],
  KDEN: [39.8561, -104.6737],
  KLGA: [40.7772, -73.8726],
  KBOS: [42.3656, -71.0096],
  KSFO: [37.6213, -122.379],
  KIAD: [38.9531, -77.4565],
  KMIA: [25.7959, -80.287],
  KLAS: [36.08, -115.152],
  KPHX: [33.4373, -112.0078],
  KSEA: [47.4502, -122.3088],
  KMCO: [28.4294, -81.309],
  KDTW: [42.2162, -83.3554],
  KPHL: [39.8719, -75.2411],
  KMSP: [44.8848, -93.2223],
  KBWI: [39.1754, -76.6682],
  KTEB: [40.8499, -74.0608],
  KVNY: [34.2098, -118.49],
  KHPN: [41.067, -73.7076],
  KBUR: [34.2007, -118.3585],
  KSNA: [33.6757, -117.8683],
  KSAN: [32.7336, -117.1897],
  KOAK: [37.7213, -122.2208],
  KSJC: [37.3626, -121.929],
  KPDX: [45.5887, -122.5975],
  KSLC: [40.7884, -111.9778],
  KIAH: [29.9902, -95.3368],
  KHOU: [29.6454, -95.2789],
  KDAL: [32.8471, -96.8518],
  KFLL: [26.0726, -80.1527],
  KPBI: [26.6832, -80.0956],
  KORL: [28.5455, -81.332],
  KSMF: [38.6954, -121.5908],
  KBNA: [36.1245, -86.6782],
  KCLT: [35.214, -80.9431],
  KMEM: [35.0424, -89.9767],
  KMDW: [41.7868, -87.7442],
  KSTL: [38.7487, -90.37],
  KCVG: [39.0488, -84.6678],
  KBDL: [41.9389, -72.6832],
  KACK: [41.2531, -70.0602],
  KMVY: [41.3931, -70.6138],
  // Europe
  EGLL: [51.477, -0.4613],
  LFPG: [49.0097, 2.5479],
  EDDF: [50.0379, 8.5622],
  LEMD: [40.4936, -3.5668],
  LIRF: [41.8003, 12.2389],
  LSGG: [46.2381, 6.1089],
  LSZH: [47.4647, 8.5492],
  EHAM: [52.3086, 4.7639],
  EDDM: [48.3538, 11.786],
  EGKB: [51.3312, 0.0324],
  LFMN: [43.6584, 7.2159],
  LOWI: [47.26, 11.3436],
  LMML: [35.8574, 14.4775],
  UUEE: [55.9726, 37.4146],
  LEIB: [38.8729, 1.3731],
  LICJ: [38.1759, 13.0909],
  // Middle East
  OMDB: [25.2532, 55.3657],
  OERK: [24.9576, 46.6988],
  HECA: [30.1219, 31.4056],
  LLBG: [32.0114, 34.8867],
  // Asia
  RJTT: [35.5494, 139.7798],
  RJAA: [35.7648, 140.3864],
  VHHH: [22.308, 113.9185],
  WSSS: [1.3644, 103.9915],
  ZBAA: [40.0799, 116.6031],
  VABB: [19.0896, 72.8656],
  VIDP: [28.5562, 77.1],
  // Oceania
  YSSY: [-33.9399, 151.1753],
  YMML: [-37.6733, 144.8433],
  // Latin America
  SBGR: [-23.4356, -46.4731],
  MMMX: [19.4363, -99.0721],
  SKBO: [4.7016, -74.1469],
  SEQM: [-0.1292, -78.3575],
  SAEZ: [-34.8222, -58.5358],
};

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineNm(icao1: string, icao2: string): number | null {
  const c1 = AIRPORT_COORDS[icao1.toUpperCase()];
  const c2 = AIRPORT_COORDS[icao2.toUpperCase()];
  if (!c1 || !c2) return null;

  const R = 3440.065; // Earth radius in nautical miles
  const dLat = toRad(c2[0] - c1[0]);
  const dLon = toRad(c2[1] - c1[1]);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(c1[0])) * Math.cos(toRad(c2[0])) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
