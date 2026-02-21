"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { formatFlightTime } from "@/lib/format";
import Link from "next/link";
import RoutePlanDetail from "@/components/Quotes/RoutePlanDetail";
import {
  useRoutePlanning,
  type RoutePlanResult,
} from "./hooks/useRoutePlanning";

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
}

type OptimizationMode = "cost" | "time" | "balanced";

interface PreviewResult {
  aircraft_id: string;
  aircraft: {
    id: string;
    tail_number: string;
    category: string;
    range_nm: number;
    pax_capacity: number;
  };
  cost: RoutePlanResult | null;
  balanced: RoutePlanResult | null;
  time: RoutePlanResult | null;
  recommendation: {
    mode: OptimizationMode;
    explanation: string;
    comparisons: Record<OptimizationMode, string>;
  };
  warnings?: string[];
}

function NewQuotePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripIdParam = searchParams.get("trip_id");

  const supabase = createClient();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);

  const [selectedTripId, setSelectedTripId] = useState(tripIdParam ?? "");
  const [selectedAircraftId, setSelectedAircraftId] = useState("");
  const [marginPct, setMarginPct] = useState(20);
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState("");
  const previewFetchedRef = useRef(false);

  const [optimizationMode, setOptimizationMode] =
    useState<OptimizationMode>("balanced");

  const { routePlan, planningRoute, routeError, runRoutePlan } =
    useRoutePlanning({
      selectedTripId,
      selectedAircraftId,
      optimizationMode,
      trips,
    });

  const isPreviewFlow = !!tripIdParam;

  useEffect(() => {
    async function load() {
      // Preview flow: load just the specific trip by ID.
      // Manual flow: load unquoted trips only (left join filter).
      const tripsQuery = isPreviewFlow
        ? supabase
            .from("trips")
            .select("id, legs, trip_type, pax_adults, created_at")
            .eq("id", tripIdParam!)
            .limit(1)
        : supabase
            .from("trips")
            .select(
              "id, legs, trip_type, pax_adults, created_at, quotes!left(id)",
            )
            .is("quotes.id", null)
            .order("created_at", { ascending: false })
            .limit(100);

      const [{ data: tripsData }, { data: aircraftData }] = await Promise.all([
        tripsQuery,
        supabase
          .from("aircraft")
          .select(
            "id, tail_number, category, range_nm, pax_capacity, has_wifi, has_bathroom",
          )
          .eq("status", "active")
          .order("tail_number"),
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
    }
    void load();
  }, [supabase, isPreviewFlow, tripIdParam]);

  // Preview flow: fetch aircraft + 3 plans when trip_id in URL
  useEffect(() => {
    if (!tripIdParam || previewFetchedRef.current) return;
    previewFetchedRef.current = true;
    setPreviewLoading(true);
    setPreviewError("");
    fetch("/api/quotes/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trip_id: tripIdParam }),
    })
      .then(async (res) => {
        const data = (await res.json()) as PreviewResult & { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Preview failed");
        setPreview(data);
        setSelectedTripId(tripIdParam);
        setSelectedAircraftId(data.aircraft_id);
        setOptimizationMode(data.recommendation.mode);
      })
      .catch((e) => {
        setPreviewError(e instanceof Error ? e.message : "Preview failed");
        previewFetchedRef.current = false;
      })
      .finally(() => setPreviewLoading(false));
  }, [tripIdParam]);

  const selectedTrip = trips.find((t) => t.id === selectedTripId);
  const previewAircraft = preview?.aircraft;

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

  // Manual flow: auto-run route plan when trip + aircraft selected
  useEffect(() => {
    if (isPreviewFlow || !selectedTripId || !selectedAircraftId) return;
    const trip = trips.find((t) => t.id === selectedTripId);
    if (!trip || trip.legs.length === 0) return;
    void runRoutePlan();
  }, [
    isPreviewFlow,
    selectedTripId,
    selectedAircraftId,
    optimizationMode,
    trips,
    runRoutePlan,
  ]);

  const selectedPlan =
    isPreviewFlow && preview ? (preview[optimizationMode] ?? null) : routePlan;

  async function handleSave() {
    if (!selectedTripId) {
      setError("Select a trip.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        trip_id: selectedTripId,
        aircraft_id: selectedAircraftId || undefined,
        margin_pct: marginPct,
        notes: notes || null,
        status: "new",
      };

      if (isPreviewFlow && preview && selectedPlan?.plan_id) {
        body.route_plan_id = selectedPlan.plan_id;
      } else if (selectedPlan?.cost_breakdown) {
        body.fuel_price_override_usd =
          selectedPlan.cost_breakdown.avg_fuel_price_usd_gal;
      }

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        quote?: { id: string };
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to create quote");
      const quoteId = data.quote?.id;
      if (quoteId) router.push(`/quotes/${quoteId}`);
      else throw new Error("No quote ID returned");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSaving(false);
    }
  }

  const canSave =
    !!selectedTripId &&
    (isPreviewFlow
      ? !!preview && !!selectedPlan?.plan_id
      : !!selectedAircraftId);

  if (previewLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
          <h2 className="text-lg font-semibold text-zinc-100">
            Building route options…
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            AI is selecting the best aircraft and computing cost, balanced, and
            time-optimized routes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">New Quote</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {isPreviewFlow
            ? previewError
              ? "Preview failed. Select options below to continue."
              : "Choose a route option, adjust margin, and save."
            : "Select a trip (and optionally an aircraft). AI will choose the best aircraft and route plan if not specified."}
        </p>
      </div>

      {previewError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {previewError}
        </div>
      )}

      {preview?.warnings?.map((w, i) => (
        <div
          key={i}
          className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-400"
        >
          {w}
        </div>
      ))}

      {/* Row 1: Route options (preview) or mode selector (manual) */}
      {isPreviewFlow && preview && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {(["cost", "balanced", "time"] as const).map((m) => {
            const p = preview[m];
            const isRec = preview.recommendation.mode === m;
            const isSelected = optimizationMode === m;
            if (!p) return null;
            return (
              <button
                key={m}
                onClick={() => setOptimizationMode(m)}
                className={`rounded-lg border px-4 py-4 text-left transition-colors ${
                  isSelected
                    ? "border-amber-400/50 bg-amber-400/5"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-200 capitalize">
                    {m}
                  </span>
                  {isRec && (
                    <Badge variant="amber" size="sm">
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
                  <span className="tabnum">
                    ${p.total_fuel_cost_usd.toFixed(0)}
                  </span>
                  <span>{formatFlightTime(p.total_flight_time_hr)}</span>
                  <span>{p.refuel_stops.length} stops</span>
                  <span
                    className={
                      p.risk_score < 30
                        ? "text-emerald-400"
                        : p.risk_score < 60
                          ? "text-amber-400"
                          : "text-red-400"
                    }
                  >
                    {p.risk_score}/100 risk
                  </span>
                </div>
                {preview.recommendation.comparisons[m] && (
                  <p className="mt-2 text-xs text-zinc-600">
                    {preview.recommendation.comparisons[m]}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Row 2: Trip/aircraft/plan detail + sidebar */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-5">
          {/* Trip */}
          <Card>
            <CardHeader>
              <CardTitle>Trip</CardTitle>
            </CardHeader>
            {isPreviewFlow ? (
              selectedTrip ? (
                <div className="rounded-md border border-amber-400/30 bg-amber-400/5 px-4 py-3">
                  <div className="font-mono text-sm text-amber-400">
                    {tripRoute}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-600">
                    <span>
                      {selectedTrip.pax_adults} pax ·{" "}
                      {new Date(selectedTrip.created_at).toLocaleDateString()}
                    </span>
                    <span className="font-mono text-zinc-500">
                      {selectedTrip.id}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-600">Loading trip…</p>
              )
            ) : trips.length === 0 ? (
              <p className="text-sm text-zinc-600">
                No unquoted trips found.{" "}
                <a
                  href="/intake"
                  className="text-amber-400 hover:text-amber-300"
                >
                  Create one via intake →
                </a>
              </p>
            ) : (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
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
                      onClick={() => setSelectedTripId(t.id)}
                      className={`w-full rounded-md border px-4 py-3 text-left transition-colors ${
                        isSelected
                          ? "border-amber-400/50 bg-amber-400/5"
                          : "border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm text-amber-400">
                          {route}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {t.pax_adults} pax ·{" "}
                          {new Date(t.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-zinc-500">
                        {t.id}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Aircraft — only when manual flow */}
          {!isPreviewFlow && (
            <Card>
              <CardHeader>
                <CardTitle>Aircraft</CardTitle>
              </CardHeader>
              {aircraft.length === 0 ? (
                <p className="text-sm text-zinc-600">
                  No aircraft found.{" "}
                  <Link
                    href="/aircraft"
                    className="text-amber-400 hover:text-amber-300"
                  >
                    Add aircraft →
                  </Link>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {aircraft.map((a) => {
                    const isSelected = a.id === selectedAircraftId;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAircraftId(a.id)}
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
                      </button>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* AI-selected aircraft when preview flow */}
          {isPreviewFlow && previewAircraft && (
            <Card>
              <CardHeader>
                <CardTitle>Aircraft</CardTitle>
                <span className="text-xs text-zinc-500">AI-selected</span>
              </CardHeader>
              <div className="rounded-md border border-amber-400/30 bg-amber-400/5 px-4 py-3">
                <div className="font-mono text-sm font-semibold text-zinc-200">
                  {previewAircraft.tail_number}
                </div>
                <div className="mt-1 flex gap-3 text-xs text-zinc-600">
                  <span className="capitalize">{previewAircraft.category}</span>
                  <span>{previewAircraft.range_nm.toLocaleString()} nm</span>
                  <span>{previewAircraft.pax_capacity} pax</span>
                </div>
              </div>
            </Card>
          )}

          {/* Route Plan Detail */}
          {selectedPlan && (
            <Card>
              <CardHeader>
                <CardTitle>Route Plan</CardTitle>
                <span className="text-xs text-zinc-500 capitalize">
                  {optimizationMode}-optimized
                </span>
              </CardHeader>
              <RoutePlanDetail plan={selectedPlan} />
            </Card>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Route Planning — manual flow only */}
          {!isPreviewFlow && (
            <Card>
              <CardHeader>
                <CardTitle>Route Planning</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex gap-1 rounded-md bg-zinc-800/60 p-1">
                  {(["cost", "balanced", "time"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setOptimizationMode(m)}
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
                        {formatFlightTime(routePlan.total_flight_time_hr)}
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
              </div>
            </Card>
          )}

          {/* AI recommendation note */}
          {isPreviewFlow && preview && (
            <p className="text-xs text-zinc-600">
              {preview.recommendation.explanation}
            </p>
          )}

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
                Applied on top of cost breakdown
              </p>
            </div>
          </Card>

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

export default function NewQuotePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
        </div>
      }
    >
      <NewQuotePageContent />
    </Suspense>
  );
}
