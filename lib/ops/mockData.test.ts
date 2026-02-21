import { describe, it, expect } from "vitest";
import { mockFlights } from "./mockData";
import type { Flight } from "./types";

/** Same shape as FlightMap: traveled path positions for Polyline (origin → trail → plane) */
function getTraveledPolylinePositions(flight: Flight): [number, number][] {
  if (flight.trail?.length > 1) {
    return [flight.originCoords, ...flight.trail, [flight.lat, flight.lon]] as [
      number,
      number,
    ][];
  }
  return [flight.originCoords, [flight.lat, flight.lon]];
}

function isValidLatLng([lat, lon]: [number, number]): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

describe("mockData / flight trail", () => {
  it("mockFlights has at least one flight", () => {
    expect(mockFlights.length).toBeGreaterThan(0);
  });

  it("every flight has a trail array with at least 2 points", () => {
    for (const f of mockFlights) {
      expect(Array.isArray(f.trail)).toBe(true);
      expect(f.trail.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every trail point is a valid [lat, lon] tuple", () => {
    for (const f of mockFlights) {
      for (const pt of f.trail) {
        expect(Array.isArray(pt)).toBe(true);
        expect(pt.length).toBe(2);
        expect(isValidLatLng(pt as [number, number])).toBe(true);
      }
    }
  });

  it("getTraveledPolylinePositions produces valid Polyline positions (origin → trail → plane)", () => {
    for (const flight of mockFlights) {
      const positions = getTraveledPolylinePositions(flight);
      expect(positions.length).toBeGreaterThanOrEqual(2);
      expect(positions[0]).toEqual(flight.originCoords);
      expect(positions[positions.length - 1]).toEqual([flight.lat, flight.lon]);
      for (const pt of positions) {
        expect(isValidLatLng(pt)).toBe(true);
      }
    }
  });

  it("traveled path is continuous (no NaN, finite coords)", () => {
    const flight = mockFlights[0]!;
    const positions = getTraveledPolylinePositions(flight);
    for (const [lat, lon] of positions) {
      expect(Number.isFinite(lat)).toBe(true);
      expect(Number.isFinite(lon)).toBe(true);
    }
  });
});
