"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface TripLeg {
  from_icao: string;
  to_icao: string;
  date: string;
  time: string;
}

interface Trip {
  id: string;
  legs: TripLeg[];
  trip_type: string;
  pax_adults: number;
  created_at: string;
}

interface Aircraft {
  id: string;
  tail_number: string;
  category: string;
  range_nm: number;
  pax_capacity: number;
  has_wifi: boolean;
  has_bathroom: boolean;
  operators: { name: string } | null;
}

interface Operator {
  id: string;
  name: string;
  cert_expiry: string | null;
  insurance_expiry: string | null;
  reliability_score: number;
  blacklisted: boolean;
}

interface RouteLeg {
  from_icao: string;
  to_icao: string;
  distance_nm: number;
  flight_time_hr: number;
  fuel_burn_gal: number;
  fuel_cost_usd: number;
  is_fuel_stop_leg: boolean;
}

interface RefuelStop {
  icao: string;
  airport_name: string;
  added_distance_nm: number;
  fuel_price_usd_gal: number;
  fuel_uplift_gal: number;
  fuel_cost_usd: number;
  fbo_fee_usd: number;
  ground_time_min: number;
  customs: boolean;
  deicing: boolean;
  reason: string;
}

interface WeatherSummary {
  icao: string;
  go_nogo: "go" | "marginal" | "nogo";
  ceiling_ft: number | null;
  visibility_sm: number | null;
  wind_speed_kts: number | null;
  icing_risk: string;
  convective_risk: string;
}

interface NotamAlert {
  notam_id: string;
  icao: string;
  type: string;
  severity: "info" | "caution" | "critical";
  raw_text: string;
}

interface CostBreakdownResult {
  fuel_cost_usd: number;
  fbo_fees_usd: number;
  refuel_stop_detour_cost_usd: number;
  avg_fuel_price_usd_gal: number;
  total_routing_cost_usd: number;
}

interface RoutePlanResult {
  route_legs: RouteLeg[];
  refuel_stops: RefuelStop[];
  total_distance_nm: number;
  total_flight_time_hr: number;
  total_fuel_cost_usd: number;
  weather_summary: WeatherSummary[];
  notam_alerts: NotamAlert[];
  risk_score: number;
  on_time_probability: number;
  cost_breakdown: CostBreakdownResult;
}

export default function NewQuotePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripIdParam = searchParams.get("trip_id");

  const supabase = createClient();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);

  const [selectedTripId, setSelectedTripId] = useState(tripIdParam ?? "");
  const [selectedAircraftId, setSelectedAircraftId] = useState("");
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [marginPct, setMarginPct] = useState(20);
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [routePlan, setRoutePlan] = useState<RoutePlanResult | null>(null);
  const [planningRoute, setPlanningRoute] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [optimizationMode, setOptimizationMode] = useState<
    "cost" | "time" | "balanced"
  >("balanced");

  useEffect(() => {
    async function load() {
      const [{ data: tripsData }, { data: aircraftData }, { data: opsData }] =
        await Promise.all([
          supabase
            .from("trips")
            .select("id, legs, trip_type, pax_adults, created_at")
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("aircraft")
            .select(
              "id, tail_number, category, range_nm, pax_capacity, has_wifi, has_bathroom, operators(name)",
            )
            .order("tail_number"),
          supabase
            .from("operators")
            .select(
              "id, name, cert_expiry, insurance_expiry, reliability_score, blacklisted",
            )
            .order("name"),
        ]);

      type RawTrip = {
        id: string;
        legs: unknown;
        trip_type: string;
        pax_adults: number;
        created_at: string;
      };
      setTrips(
        ((tripsData as unknown as RawTrip[]) ?? []).map((t) => ({
          id: t.id,
          trip_type: t.trip_type,
          pax_adults: t.pax_adults,
          created_at: t.created_at,
          legs: Array.isArray(t.legs) ? (t.legs as unknown as TripLeg[]) : [],
        })),
      );
      setAircraft((aircraftData as unknown as Aircraft[]) ?? []);
      setOperators((opsData as unknown as Operator[]) ?? []);
    }
    void load();
  }, [supabase]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  const selectedAircraft = aircraft.find((a) => a.id === selectedAircraftId);
  const selectedOperator = operators.find((o) => o.id === selectedOperatorId);

  const tripRoute = selectedTrip
    ? selectedTrip.legs.length > 0
      ? selectedTrip.legs
          .map((l) => l.from_icao)
          .concat([
            selectedTrip.legs[selectedTrip.legs.length - 1]?.to_icao ?? "",
          ])
          .join(" → ")
      : "No legs"
    : null;

  const runRoutePlan = useCallback(async () => {
    if (!selectedTripId || !selectedAircraftId) return;
    const trip = trips.find((t) => t.id === selectedTripId);
    if (!trip || trip.legs.length === 0) return;
    setPlanningRoute(true);
    setRouteError("");
    setRoutePlan(null);
    try {
      const res = await fetch("/api/routing/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aircraft_id: selectedAircraftId,
          legs: trip.legs,
          optimization_mode: optimizationMode,
        }),
      });
      const data = (await res.json()) as
        | { result: RoutePlanResult }
        | { error: string };
      if (!res.ok || "error" in data) {
        setRouteError(
          ("error" in data ? data.error : null) ?? "Route planning failed",
        );
      } else {
        setRoutePlan(data.result);
      }
    } catch {
      setRouteError("Network error");
    } finally {
      setPlanningRoute(false);
    }
  }, [selectedTripId, selectedAircraftId, optimizationMode, trips]);

  async function handleSave() {
    if (!selectedTripId || !selectedAircraftId || !selectedOperatorId) {
      setError("Select a trip, aircraft, and operator.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: selectedTripId,
          aircraft_id: selectedAircraftId,
          operator_id: selectedOperatorId,
          margin_pct: marginPct,
          notes: notes || null,
          status: "sent",
          fuel_price_override_usd:
            routePlan?.cost_breakdown.avg_fuel_price_usd_gal ?? undefined,
        }),
      });
      const data = (await res.json()) as {
        quote?: { id: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to create quote");
      const quoteId = data.quote?.id;

      // If a route plan was computed, persist it linked to the new quote
      if (quoteId && routePlan) {
        const trip = trips.find((t) => t.id === selectedTripId);
        if (trip) {
          await fetch("/api/routing/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              aircraft_id: selectedAircraftId,
              legs: trip.legs,
              optimization_mode: optimizationMode,
              quote_id: quoteId,
              trip_id: selectedTripId,
            }),
          });
        }
      }

      router.push(`/quotes/${quoteId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSaving(false);
    }
  }

  const canSave = selectedTripId && selectedAircraftId && selectedOperatorId;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">New Quote</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Select trip, aircraft, and operator to build the quote.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left col — selectors */}
        <div className="col-span-2 space-y-5">
          {/* Trip */}
          <Card>
            <CardHeader>
              <CardTitle>Trip</CardTitle>
            </CardHeader>
            {trips.length === 0 ? (
              <p className="text-sm text-zinc-600">
                No trips found.{" "}
                <a
                  href="/intake"
                  className="text-amber-400 hover:text-amber-300"
                >
                  Create one via intake →
                </a>
              </p>
            ) : (
              <div className="space-y-2">
                {trips.map((t) => {
                  const legs = t.legs;
                  const route =
                    legs.length > 0
                      ? legs
                          .map((l) => l.from_icao)
                          .concat([legs[legs.length - 1]?.to_icao ?? ""])
                          .join(" → ")
                      : "No legs";
                  const isSelected = t.id === selectedTripId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTripId(t.id);
                      }}
                      className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-amber-400/50 bg-amber-400/5"
                          : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-amber-400">
                          {route}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {t.pax_adults} pax ·{" "}
                          {new Date(t.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-zinc-600">
                        {t.id.slice(0, 8)}…
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Aircraft */}
          <Card>
            <CardHeader>
              <CardTitle>Aircraft</CardTitle>
            </CardHeader>
            {aircraft.length === 0 ? (
              <p className="text-sm text-zinc-600">
                No aircraft found.{" "}
                <a
                  href="/aircraft"
                  className="text-amber-400 hover:text-amber-300"
                >
                  Add aircraft →
                </a>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {aircraft.map((a) => {
                  const isSelected = a.id === selectedAircraftId;
                  return (
                    <button
                      key={a.id}
                      onClick={() => {
                        setSelectedAircraftId(a.id);
                      }}
                      className={`rounded-md border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "border-amber-400/50 bg-amber-400/5"
                          : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold text-zinc-200">
                          {a.tail_number}
                        </span>
                        <span className="text-xs text-zinc-500 capitalize">
                          {a.category}
                        </span>
                      </div>
                      <div className="mt-1 flex gap-3 text-xs text-zinc-600">
                        <span>{a.range_nm.toLocaleString()} nm</span>
                        <span>{a.pax_capacity} pax</span>
                        {a.has_wifi && <span>wifi</span>}
                      </div>
                      {a.operators && (
                        <div className="mt-0.5 text-xs text-zinc-700">
                          {a.operators.name}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Route Plan Results */}
          {routePlan && (
            <Card>
              <CardHeader>
                <CardTitle>Route Plan</CardTitle>
                <span className="text-xs text-zinc-500 capitalize">
                  {optimizationMode}-optimized
                </span>
              </CardHeader>
              <div className="space-y-4">
                {/* Legs */}
                <div className="space-y-1">
                  {routePlan.route_legs.map((leg, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded bg-zinc-800/40 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-amber-400">
                        {leg.from_icao}
                      </span>
                      <span className="text-zinc-700">→</span>
                      <span className="font-mono text-amber-400">
                        {leg.to_icao}
                      </span>
                      {leg.is_fuel_stop_leg && (
                        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-400">
                          fuel stop
                        </span>
                      )}
                      <span className="tabnum ml-auto text-xs text-zinc-500">
                        {leg.distance_nm} nm · {leg.flight_time_hr.toFixed(1)}{" "}
                        hr
                      </span>
                    </div>
                  ))}
                </div>

                {/* Refuel stops */}
                {routePlan.refuel_stops.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">
                      Refuel Stops
                    </p>
                    <div className="space-y-1.5">
                      {routePlan.refuel_stops.map((stop, i) => (
                        <div
                          key={i}
                          className="rounded border border-zinc-800 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-semibold text-zinc-200">
                              {stop.icao}
                            </span>
                            <span className="text-zinc-500">
                              {stop.airport_name}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-3 text-zinc-600">
                            <span>
                              ${stop.fuel_price_usd_gal.toFixed(2)}/gal
                            </span>
                            <span>{stop.fuel_uplift_gal} gal</span>
                            <span>${stop.fbo_fee_usd} FBO</span>
                            <span>{stop.ground_time_min} min ground</span>
                            {stop.customs && (
                              <span className="text-emerald-600">customs</span>
                            )}
                            {stop.deicing && (
                              <span className="text-blue-600">deicing</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Weather go/nogo */}
                {routePlan.weather_summary.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">
                      Weather
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {routePlan.weather_summary.map((w) => (
                        <div
                          key={w.icao}
                          className="flex items-center gap-1.5 rounded bg-zinc-800/40 px-2 py-1 text-xs"
                        >
                          <span className="font-mono text-zinc-400">
                            {w.icao}
                          </span>
                          <span
                            className={`rounded px-1 py-0.5 text-xs font-medium ${
                              w.go_nogo === "go"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : w.go_nogo === "marginal"
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {w.go_nogo}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* NOTAM alerts */}
                {routePlan.notam_alerts.filter((n) => n.severity !== "info")
                  .length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">
                      NOTAMs
                    </p>
                    <div className="space-y-1">
                      {routePlan.notam_alerts
                        .filter((n) => n.severity !== "info")
                        .slice(0, 5)
                        .map((n, i) => (
                          <div
                            key={i}
                            className={`rounded px-2 py-1.5 text-xs ${
                              n.severity === "critical"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            <span className="font-mono">{n.icao}</span> ·{" "}
                            {n.type.replace("_", " ")} —{" "}
                            <span className="text-zinc-500">
                              {n.raw_text.slice(0, 80)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Operator */}
          <Card>
            <CardHeader>
              <CardTitle>Operator</CardTitle>
            </CardHeader>
            {operators.length === 0 ? (
              <p className="text-sm text-zinc-600">
                No operators found.{" "}
                <a
                  href="/operators"
                  className="text-amber-400 hover:text-amber-300"
                >
                  Add operator →
                </a>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {operators.map((op) => {
                  const isSelected = op.id === selectedOperatorId;
                  const now = new Date();
                  const certOk =
                    !op.cert_expiry || new Date(op.cert_expiry) > now;
                  const insOk =
                    !op.insurance_expiry || new Date(op.insurance_expiry) > now;
                  return (
                    <button
                      key={op.id}
                      onClick={() => {
                        setSelectedOperatorId(op.id);
                      }}
                      disabled={op.blacklisted}
                      className={`rounded-md border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected
                          ? "border-amber-400/50 bg-amber-400/5"
                          : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-200">
                          {op.name}
                        </span>
                        {op.blacklisted && (
                          <span className="text-xs text-red-400">
                            blacklisted
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex gap-3 text-xs">
                        <span
                          className={
                            certOk ? "text-emerald-500" : "text-red-400"
                          }
                        >
                          cert {certOk ? "✓" : "expired"}
                        </span>
                        <span
                          className={
                            insOk ? "text-emerald-500" : "text-red-400"
                          }
                        >
                          ins {insOk ? "✓" : "expired"}
                        </span>
                        <span className="text-zinc-600">
                          {op.reliability_score.toFixed(1)} rel
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right sidebar — settings */}
        <div className="space-y-5">
          {/* Selection summary */}
          {(selectedTrip || selectedAircraft || selectedOperator) && (
            <Card>
              <CardHeader>
                <CardTitle>Selection</CardTitle>
              </CardHeader>
              <div className="space-y-2 text-sm">
                {selectedTrip && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Route</span>
                    <span className="font-mono text-xs text-amber-400">
                      {tripRoute}
                    </span>
                  </div>
                )}
                {selectedAircraft && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Aircraft</span>
                    <span className="font-mono text-zinc-300">
                      {selectedAircraft.tail_number}
                    </span>
                  </div>
                )}
                {selectedOperator && (
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Operator</span>
                    <span className="text-zinc-300">
                      {selectedOperator.name}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Margin */}
          <Card>
            <CardHeader>
              <CardTitle>Margin</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={1}
                  value={marginPct}
                  onChange={(e) => setMarginPct(parseInt(e.target.value))}
                  className="flex-1 accent-amber-400"
                />
                <span className="tabnum w-10 text-right text-lg font-bold text-amber-400">
                  {marginPct}%
                </span>
              </div>
              <p className="text-xs text-zinc-600">
                Applied on top of operator costs
              </p>
            </div>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this quote…"
              rows={3}
              className="w-full resize-none rounded border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-300 placeholder-zinc-700 focus:border-amber-400 focus:outline-none"
            />
          </Card>

          {/* Route Planning */}
          <Card>
            <CardHeader>
              <CardTitle>Route Planning</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              <div className="flex gap-1 rounded-md bg-zinc-800/60 p-1">
                {(["cost", "balanced", "time"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setOptimizationMode(m);
                      setRoutePlan(null);
                    }}
                    className={`flex-1 rounded px-2 py-1 text-xs capitalize transition-colors ${
                      optimizationMode === m
                        ? "bg-amber-400/20 text-amber-400"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {routeError && (
                <p className="text-xs text-red-400">{routeError}</p>
              )}
              {routePlan && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Distance</span>
                    <span className="tabnum text-zinc-300">
                      {routePlan.total_distance_nm.toLocaleString()} nm
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Flight time</span>
                    <span className="tabnum text-zinc-300">
                      {routePlan.total_flight_time_hr.toFixed(1)} hr
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Fuel stops</span>
                    <span className="tabnum text-zinc-300">
                      {routePlan.refuel_stops.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Risk score</span>
                    <span
                      className={`tabnum font-medium ${
                        routePlan.risk_score < 30
                          ? "text-emerald-400"
                          : routePlan.risk_score < 60
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {routePlan.risk_score}/100
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">On-time prob.</span>
                    <span className="tabnum text-zinc-300">
                      {(routePlan.on_time_probability * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Avg fuel price</span>
                    <span className="tabnum text-zinc-300">
                      $
                      {routePlan.cost_breakdown.avg_fuel_price_usd_gal.toFixed(
                        2,
                      )}
                      /gal
                    </span>
                  </div>
                </div>
              )}
              <Button
                onClick={() => void runRoutePlan()}
                loading={planningRoute}
                variant="secondary"
                size="sm"
                disabled={!selectedTripId || !selectedAircraftId}
                className="w-full justify-center"
              >
                {planningRoute
                  ? "Planning…"
                  : routePlan
                    ? "Re-plan Route"
                    : "Plan Route"}
              </Button>
              {routePlan && (
                <p className="text-center text-xs text-zinc-600">
                  Fuel price override applied to quote
                </p>
              )}
            </div>
          </Card>

          {/* Save */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
          <Button
            onClick={() => void handleSave()}
            loading={saving}
            disabled={!canSave}
            size="lg"
            className="w-full justify-center"
          >
            Save & Send Quote →
          </Button>

          {/* Status badge preview */}
          {canSave && (
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
              Status will be set to{" "}
              <Badge variant="blue" size="sm">
                sent
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
