export interface Flight {
  id: string;
  callsign: string;
  tail: string;
  aircraftType: string;
  lat: number;
  lon: number;
  heading: number;
  groundspeed: number;
  altitude: number;
  origin: string;
  destination: string;
  originCoords: [number, number];
  destCoords: [number, number];
  eta: string;
  etd: string;
  status: "green" | "yellow" | "red";
  pax: number;
  client: string;
  reasons: string[];
  inAir: boolean;
  trail: [number, number][];
}

export interface Alert {
  id: string;
  flightId: string;
  type: "NOTAM" | "Weather" | "Maintenance" | "Crew";
  severity: "green" | "yellow" | "red";
  title: string;
  description: string;
  timestamp: string;
}
