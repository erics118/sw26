// ─── Routing graph + Dijkstra ─────────────────────────────────────────────────
// Builds a lightweight graph per routing call (not a global singleton).
// Nodes = airports; edges = viable legs between them for a given aircraft.

import type { AirportRecord } from "./airport-db";
import { haversineNm, isWithinCurfew } from "./airport-db";
import type { AircraftPerf } from "./performance";
import {
  flightTimeHr,
  effectiveMinRunwayFt,
  fuelForLegGal,
} from "./performance";
import type { OptimizationMode } from "./types";

const DEFAULT_FUEL_PRICE_USD = 7.5; // fallback if airport.fuel_price_usd_gal is null
const DEFAULT_FBO_FEE_USD = 600; // fallback if airport.fbo_fee_usd is null

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphEdge {
  from_icao: string;
  to_icao: string;
  distance_nm: number;
  flight_time_hr: number;
  fuel_cost_usd: number; // based on fuel burned × destination fuel price
  fbo_fee_usd: number;
  is_viable: boolean;
  viability_reason: string | null;
}

// ─── Edge builder ─────────────────────────────────────────────────────────────

export function buildEdge(
  from: AirportRecord,
  to: AirportRecord,
  aircraft: AircraftPerf,
  globalFuelPrice = DEFAULT_FUEL_PRICE_USD,
  departureUtc?: Date,
): GraphEdge {
  const distNm = haversineNm(from, to);
  const legFlightTimeHr = flightTimeHr(distNm, aircraft);
  const fuelBurnGal = fuelForLegGal(distNm, aircraft);
  const fuelPrice = to.fuel_price_usd_gal ?? globalFuelPrice;
  const fboFee = to.fbo_fee_usd ?? DEFAULT_FBO_FEE_USD;
  const fuelCostUsd = fuelBurnGal * fuelPrice;

  // Viability checks
  const minRunway = effectiveMinRunwayFt(aircraft);
  if (to.longest_runway_ft !== null && to.longest_runway_ft < minRunway) {
    return {
      from_icao: from.icao,
      to_icao: to.icao,
      distance_nm: distNm,
      flight_time_hr: legFlightTimeHr,
      fuel_cost_usd: fuelCostUsd,
      fbo_fee_usd: fboFee,
      is_viable: false,
      viability_reason: `Runway at ${to.icao} (${to.longest_runway_ft} ft) below aircraft minimum (${minRunway} ft)`,
    };
  }

  if (!to.fuel_jet_a) {
    return {
      from_icao: from.icao,
      to_icao: to.icao,
      distance_nm: distNm,
      flight_time_hr: legFlightTimeHr,
      fuel_cost_usd: fuelCostUsd,
      fbo_fee_usd: fboFee,
      is_viable: false,
      viability_reason: `No Jet-A fuel available at ${to.icao}`,
    };
  }

  if (departureUtc) {
    const arrivalUtc = new Date(
      departureUtc.getTime() + legFlightTimeHr * 3600 * 1000,
    );
    if (isWithinCurfew(to, arrivalUtc)) {
      return {
        from_icao: from.icao,
        to_icao: to.icao,
        distance_nm: distNm,
        flight_time_hr: legFlightTimeHr,
        fuel_cost_usd: fuelCostUsd,
        fbo_fee_usd: fboFee,
        is_viable: false,
        viability_reason: `Arrival at ${to.icao} falls within curfew window`,
      };
    }
  }

  return {
    from_icao: from.icao,
    to_icao: to.icao,
    distance_nm: distNm,
    flight_time_hr: legFlightTimeHr,
    fuel_cost_usd: fuelCostUsd,
    fbo_fee_usd: fboFee,
    is_viable: true,
    viability_reason: null,
  };
}

// ─── Edge weight ──────────────────────────────────────────────────────────────

export function edgeWeight(edge: GraphEdge, mode: OptimizationMode): number {
  switch (mode) {
    case "cost":
      return edge.fuel_cost_usd + edge.fbo_fee_usd;
    case "time":
      return edge.flight_time_hr * 60; // minutes as weight
    case "balanced":
      return (
        (edge.fuel_cost_usd + edge.fbo_fee_usd) * 0.5 + edge.flight_time_hr * 30
      );
  }
}

// ─── Min-heap (priority queue) ────────────────────────────────────────────────

interface HeapNode {
  cost: number;
  icao: string;
}

class MinHeap {
  private heap: HeapNode[] = [];

  push(node: HeapNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): HeapNode | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0]!;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent]!.cost <= this.heap[i]!.cost) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i]!, this.heap[parent]!];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      if (left < n && this.heap[left]!.cost < this.heap[smallest]!.cost)
        smallest = left;
      if (right < n && this.heap[right]!.cost < this.heap[smallest]!.cost)
        smallest = right;
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [
        this.heap[smallest]!,
        this.heap[i]!,
      ];
      i = smallest;
    }
  }
}

// ─── Dijkstra ─────────────────────────────────────────────────────────────────

/**
 * Finds the lowest-cost path from `fromIcao` to `toIcao` through the provided
 * graph edges using Dijkstra's algorithm.
 *
 * Returns an ordered array of ICAO codes (including start and end),
 * or null if no viable path exists.
 */
export function dijkstra(
  nodes: AirportRecord[],
  edges: GraphEdge[],
  fromIcao: string,
  toIcao: string,
  mode: OptimizationMode,
): string[] | null {
  const icaos = nodes.map((n) => n.icao);
  const dist = new Map<string, number>(icaos.map((icao) => [icao, Infinity]));
  const prev = new Map<string, string | null>(
    icaos.map((icao) => [icao, null]),
  );

  // Adjacency list from viable edges only
  const adj = new Map<string, GraphEdge[]>();
  for (const icao of icaos) adj.set(icao, []);
  for (const edge of edges) {
    if (!edge.is_viable) continue;
    adj.get(edge.from_icao)?.push(edge);
  }

  dist.set(fromIcao, 0);
  const pq = new MinHeap();
  pq.push({ cost: 0, icao: fromIcao });

  while (pq.size > 0) {
    const { cost, icao } = pq.pop()!;
    if (cost > (dist.get(icao) ?? Infinity)) continue; // stale entry
    if (icao === toIcao) break;

    for (const edge of adj.get(icao) ?? []) {
      const w = edgeWeight(edge, mode);
      const newCost = (dist.get(icao) ?? Infinity) + w;
      if (newCost < (dist.get(edge.to_icao) ?? Infinity)) {
        dist.set(edge.to_icao, newCost);
        prev.set(edge.to_icao, icao);
        pq.push({ cost: newCost, icao: edge.to_icao });
      }
    }
  }

  // Reconstruct path
  if ((dist.get(toIcao) ?? Infinity) === Infinity) return null;

  const path: string[] = [];
  let cursor: string | null = toIcao;
  while (cursor !== null) {
    path.unshift(cursor);
    cursor = prev.get(cursor) ?? null;
  }
  return path.length > 0 && path[0] === fromIcao ? path : null;
}

// ─── Graph builder ────────────────────────────────────────────────────────────

/**
 * Builds a fully connected graph from a set of airports for a given aircraft.
 * Returns edges for all pairs (both directions). Caller uses this with dijkstra().
 */
export function buildGraph(
  airports: AirportRecord[],
  aircraft: AircraftPerf,
  globalFuelPrice = DEFAULT_FUEL_PRICE_USD,
  departureUtc?: Date,
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let i = 0; i < airports.length; i++) {
    for (let j = 0; j < airports.length; j++) {
      if (i === j) continue;
      edges.push(
        buildEdge(
          airports[i]!,
          airports[j]!,
          aircraft,
          globalFuelPrice,
          departureUtc,
        ),
      );
    }
  }
  return edges;
}
