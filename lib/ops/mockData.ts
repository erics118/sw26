import type { Flight, Alert } from "./types";

// Generate trail from origin toward current position (points along the route already traveled)
function generateTrail(
  originLat: number,
  originLon: number,
  curLat: number,
  curLon: number,
  points: number = 30,
): [number, number][] {
  const trail: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points; // 0 = near origin, 1 = current position
    // Interpolate from ~20% along the route to current position
    const segStart = 0.3;
    const frac = segStart + t * (1 - segStart);
    trail.push([
      originLat + (curLat - originLat) * frac + (Math.random() - 0.5) * 0.002,
      originLon + (curLon - originLon) * frac + (Math.random() - 0.5) * 0.002,
    ]);
  }
  return trail;
}

// Compute heading from origin to destination in degrees
function computeHeading(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const dLon = ((toLon - fromLon) * Math.PI) / 180;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Place aircraft along the great-circle route between origin and dest
function positionAlongRoute(
  originCoords: [number, number],
  destCoords: [number, number],
  progress: number, // 0-1, how far along the route
): { lat: number; lon: number } {
  return {
    lat: originCoords[0] + (destCoords[0] - originCoords[0]) * progress,
    lon: originCoords[1] + (destCoords[1] - originCoords[1]) * progress,
  };
}

const reasonsPool = [
  "Low ceilings",
  "Crosswind",
  "Runway closed",
  "Inspection due",
  "Crew rest risk",
  "Thunderstorm area",
  "NOTAM active",
  "Fuel stop required",
  "VIP pax",
  "Ice advisory",
  "Turbulence reported",
  "ATC delay",
];

function pickReasons(status: "green" | "yellow" | "red"): string[] {
  if (status === "green") return [];
  const count =
    status === "yellow"
      ? Math.floor(Math.random() * 2) + 1
      : Math.floor(Math.random() * 3) + 1;
  const shuffled = [...reasonsPool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

const aircraftTypes = [
  "G650",
  "G550",
  "Challenger 350",
  "Phenom 300",
  "Citation X",
  "King Air 350",
  "Falcon 900",
  "Legacy 500",
  "Global 7500",
  "Hawker 800",
];
const airports = [
  "KJFK",
  "KLAX",
  "KORD",
  "KMIA",
  "KTEB",
  "KLAS",
  "KDEN",
  "KSFO",
  "KBOS",
  "KDCA",
  "KPBI",
  "KSDL",
  "KVNY",
  "KHOU",
  "KATL",
  "KSEA",
];

const airportCoords: Record<string, [number, number]> = {
  KJFK: [40.6413, -73.7781],
  KLAX: [33.9425, -118.4081],
  KORD: [41.9742, -87.9073],
  KMIA: [25.7959, -80.287],
  KTEB: [40.8501, -74.0608],
  KLAS: [36.084, -115.1537],
  KDEN: [39.8561, -104.6737],
  KSFO: [37.6213, -122.379],
  KBOS: [42.3656, -71.0096],
  KDCA: [38.8512, -77.0402],
  KPBI: [26.6832, -80.0956],
  KSDL: [33.6229, -111.9105],
  KVNY: [34.2098, -118.49],
  KHOU: [29.6454, -95.2789],
  KATL: [33.6407, -84.4277],
  KSEA: [47.4502, -122.3088],
};
const clients = [
  "Apex Capital",
  "Meridian Group",
  "Summit Partners",
  "Atlas Holdings",
  "Centurion Mgmt",
  "Vanguard Corp",
  "Eclipse Fund",
  "Pinnacle LLC",
];

// Define 25 realistic flight routes between actual airports
const flightRoutes: {
  origin: string;
  destination: string;
  progress: number;
  inAir: boolean;
}[] = [
  { origin: "KJFK", destination: "KLAX", progress: 0.55, inAir: true },
  { origin: "KORD", destination: "KMIA", progress: 0.4, inAir: true },
  { origin: "KTEB", destination: "KPBI", progress: 0.65, inAir: false }, // on ground
  { origin: "KATL", destination: "KDEN", progress: 0.3, inAir: true },
  { origin: "KLAS", destination: "KSEA", progress: 0.7, inAir: true },
  { origin: "KSFO", destination: "KHOU", progress: 0.45, inAir: false }, // on ground
  { origin: "KMIA", destination: "KJFK", progress: 0.6, inAir: true },
  { origin: "KBOS", destination: "KDCA", progress: 0.5, inAir: true },
  { origin: "KDEN", destination: "KLAX", progress: 0.75, inAir: true },
  { origin: "KLAX", destination: "KORD", progress: 0.35, inAir: false }, // on ground
  { origin: "KHOU", destination: "KATL", progress: 0.55, inAir: true },
  { origin: "KSEA", destination: "KLAS", progress: 0.6, inAir: true },
  { origin: "KDCA", destination: "KORD", progress: 0.4, inAir: false }, // on ground
  { origin: "KSDL", destination: "KTEB", progress: 0.5, inAir: true },
  { origin: "KVNY", destination: "KDEN", progress: 0.65, inAir: true },
  { origin: "KPBI", destination: "KATL", progress: 0.45, inAir: true },
  { origin: "KJFK", destination: "KORD", progress: 0.7, inAir: false }, // on ground
  { origin: "KATL", destination: "KLAX", progress: 0.3, inAir: true },
  { origin: "KORD", destination: "KDEN", progress: 0.55, inAir: true },
  { origin: "KMIA", destination: "KHOU", progress: 0.8, inAir: false }, // on ground
  { origin: "KTEB", destination: "KSFO", progress: 0.4, inAir: true },
  { origin: "KLAS", destination: "KBOS", progress: 0.5, inAir: false }, // on ground
  { origin: "KDEN", destination: "KMIA", progress: 0.6, inAir: true },
  { origin: "KSFO", destination: "KSEA", progress: 0.7, inAir: true },
  { origin: "KHOU", destination: "KDCA", progress: 0.35, inAir: false }, // on ground
];

export const mockFlights: Flight[] = flightRoutes.map((route, i) => {
  const status: "green" | "yellow" | "red" =
    i < 15 ? "green" : i < 22 ? "yellow" : "red";
  const oCoords = airportCoords[route.origin]!;
  const dCoords = airportCoords[route.destination]!;
  const pos = positionAlongRoute(oCoords, dCoords, route.progress);
  const heading = computeHeading(
    oCoords[0],
    oCoords[1],
    dCoords[0],
    dCoords[1],
  );

  return {
    id: `FL-${String(i + 1).padStart(3, "0")}`,
    callsign: `SKY${100 + i}`,
    tail: `N-${String(400 + i)}SL`,
    aircraftType: aircraftTypes[i % aircraftTypes.length]!,
    lat: pos.lat,
    lon: pos.lon,
    heading,
    groundspeed: 320 + Math.floor(Math.random() * 200),
    altitude: 25000 + Math.floor(Math.random() * 20000),
    origin: route.origin,
    destination: route.destination,
    originCoords: oCoords,
    destCoords: dCoords,
    eta: `${String(14 + Math.floor(i / 5)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}Z`,
    etd: `${String(10 + Math.floor(i / 8)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}Z`,
    status,
    inAir: route.inAir,
    pax: 2 + Math.floor(Math.random() * 10),
    client: clients[i % clients.length]!,
    reasons: pickReasons(status),
    trail: generateTrail(oCoords[0], oCoords[1], pos.lat, pos.lon),
  };
});

export const mockAlerts: Alert[] = [
  {
    id: "ALT-001",
    flightId: "FL-016",
    type: "Weather",
    severity: "yellow",
    title: "Thunderstorm cell near KORD",
    description:
      "CB activity within 30nm of approach path. Expected to clear by 16:00Z.",
    timestamp: "14:22Z",
  },
  {
    id: "ALT-002",
    flightId: "FL-018",
    type: "NOTAM",
    severity: "yellow",
    title: "Runway 28L closed at KLAX",
    description:
      "Runway closed for maintenance until 18:00Z. Runway 25R available.",
    timestamp: "13:45Z",
  },
  {
    id: "ALT-003",
    flightId: "FL-023",
    type: "Maintenance",
    severity: "red",
    title: "MEL item on N-423SL",
    description:
      "Autopilot system deferred. Manual flight only. Inspection required within 10 flight hours.",
    timestamp: "12:30Z",
  },
  {
    id: "ALT-004",
    flightId: "FL-024",
    type: "Crew",
    severity: "red",
    title: "Crew rest violation risk",
    description:
      "Captain approaching 14-hour duty limit. Must land by 17:30Z or assign relief crew.",
    timestamp: "14:05Z",
  },
  {
    id: "ALT-005",
    flightId: "FL-020",
    type: "Weather",
    severity: "yellow",
    title: "Low ceilings at KMIA",
    description:
      "Visibility 1SM, ceiling 300ft. ILS approaches only. Alternate required.",
    timestamp: "14:15Z",
  },
  {
    id: "ALT-006",
    flightId: "FL-017",
    type: "NOTAM",
    severity: "yellow",
    title: "TFR active near KDCA",
    description: "Temporary flight restriction P-56 area. Reroute required.",
    timestamp: "11:00Z",
  },
  {
    id: "ALT-007",
    flightId: "FL-025",
    type: "Maintenance",
    severity: "red",
    title: "Engine vibration alert N-425SL",
    description:
      "Elevated N1 vibration on #2 engine. Monitoring closely. Diversion may be required.",
    timestamp: "14:35Z",
  },
  {
    id: "ALT-008",
    flightId: "FL-022",
    type: "Crew",
    severity: "yellow",
    title: "FO currency expiring",
    description:
      "First Officer recurrent training due in 3 days. Schedule check ride.",
    timestamp: "08:00Z",
  },
];

// Suppress unused variable warnings for airports array (kept for reference)
void airports;
