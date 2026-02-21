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

export interface MaintenanceItem {
  id: string;
  tail: string;
  aircraftType: string;
  squawk: string;
  status: "AOG" | "Open" | "Deferred" | "Resolved";
  dueDate: string;
  impactedFlights: string[];
  checklist: { item: string; done: boolean }[];
}

export interface CrewMember {
  id: string;
  name: string;
  role: "Captain" | "First Officer" | "Flight Attendant";
  base: string;
  available: boolean;
  dutyRisk: "green" | "yellow" | "red";
  currencies: { name: string; status: "current" | "expiring" | "expired" }[];
  nextDuty: string;
}

export interface FleetAircraft {
  id: string;
  tail: string;
  aircraftType: string;
  base: string;
  status: "Available" | "In Flight" | "Maintenance" | "Reserved";
  nextDue: string;
  openSquawks: number;
  availability: {
    date: string;
    status: "available" | "booked" | "maintenance";
  }[];
}
