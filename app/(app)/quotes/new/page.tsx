"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import CostBreakdown from "@/components/ui/CostBreakdown";
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
type Step = "configure" | "preview";

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

interface PricingCosts {
  fuel_cost: number;
  fbo_fees: number;
  repositioning_cost: number;
  repositioning_hours: number;
  permit_fees: number;
  crew_overnight_cost: number;
  catering_cost: number;
  peak_day_surcharge: number;
  subtotal: number;
  margin_amount: number;
  tax: number;
  total: number;
}

interface QuotePricingResult {
  costs: PricingCosts;
  aircraft: {
    tail_number: string;
    category: string;
    range_nm: number;
    pax_capacity: number;
  };
  trip: {
    legs: TripLeg[];
    trip_type: string;
    pax_adults: number;
  };
  optimization_mode: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
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

  const [step, setStep] = useState<Step>("configure");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState("");
  const previewFetchedRef = useRef(false);

  // Quote pricing preview state (step 2)
  const [quotePricing, setQuotePricing] = useState<QuotePricingResult | null>(
    null,
  );
  const [loadingPricing, setLoadingPricing] = useState(false);

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

  // Preview flow: fetch aircraft + 3 route plans when trip_id in URL
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

  const canSave =
    !!selectedTripId &&
    (isPreviewFlow
      ? !!preview && !!selectedPlan?.plan_id
      : !!selectedAircraftId);

  // Fetch pricing preview and advance to step 2
  async function handlePreviewQuote() {
    if (!canSave) return;
    setLoadingPricing(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        trip_id: selectedTripId,
        aircraft_id: selectedAircraftId,
        margin_pct: marginPct,
      };

      if (isPreviewFlow && preview && selectedPlan?.plan_id) {
        body.route_plan_id = selectedPlan.plan_id;
      } else if (selectedPlan?.cost_breakdown) {
        body.fuel_price_override_usd =
          selectedPlan.cost_breakdown.avg_fuel_price_usd_gal;
      }

      const res = await fetch("/api/quotes/price-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as QuotePricingResult & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Pricing preview failed");
      setQuotePricing(data);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoadingPricing(false);
    }
  }

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

  // ─── Live margin recalculation for preview step ───────────────────────────
  // Subtotal is fixed; only margin / tax / total change with slider.
  const previewSubtotal = quotePricing?.costs.subtotal ?? 0;
  const liveMarginAmount = previewSubtotal * (marginPct / 100);
  const liveTax = (previewSubtotal + liveMarginAmount) * 0.075;
  const liveTotal = previewSubtotal + liveMarginAmount + liveTax;

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

  // ─── Step 2: Quote Preview ─────────────────────────────────────────────────
  if (step === "preview" && quotePricing) {
    const previewLegs = quotePricing.trip.legs;
    const previewRoute =
      previewLegs.length > 0
        ? previewLegs
            .map((l) => l.from_icao)
            .concat([previewLegs[previewLegs.length - 1]?.to_icao ?? ""])
            .join(" → ")
        : "No legs";

    return (
      <div className="p-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <button
              onClick={() => setStep("configure")}
              className="mb-2 text-xs text-zinc-600 hover:text-zinc-400"
            >
              ← Back to Edit
            </button>
            <h1 className="text-2xl font-semibold text-zinc-100">
              Quote Preview
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              Review the quote below, adjust margin or notes, then confirm to
              save.
            </p>
          </div>
          <div className="text-right">
            <div className="tabnum text-2xl font-bold text-amber-400">
              {fmt(liveTotal)}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">estimated total</div>
          </div>
        </div>

        {/* Route + Aircraft summary bar */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-5 py-3">
          <span className="font-mono text-base font-semibold text-amber-400">
            {previewRoute}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-sm text-zinc-400">
            {quotePricing.aircraft.tail_number}
          </span>
          <span className="text-sm text-zinc-600 capitalize">
            {quotePricing.aircraft.category}
          </span>
          <span className="text-sm text-zinc-600">
            {quotePricing.trip.pax_adults} pax
          </span>
          <span className="ml-auto">
            <Badge variant="amber" size="sm">
              {quotePricing.optimization_mode}-optimized
            </Badge>
          </span>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: cost breakdown + legs */}
          <div className="col-span-2 space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
                <span className="tabnum text-lg font-bold text-amber-400">
                  {fmt(liveTotal)}
                </span>
              </CardHeader>
              <CostBreakdown
                fuelCost={quotePricing.costs.fuel_cost}
                fboFees={quotePricing.costs.fbo_fees}
                repositioningCost={quotePricing.costs.repositioning_cost}
                repositioningHours={quotePricing.costs.repositioning_hours}
                permitFees={quotePricing.costs.permit_fees}
                crewOvernightCost={quotePricing.costs.crew_overnight_cost}
                cateringCost={quotePricing.costs.catering_cost}
                peakDaySurcharge={quotePricing.costs.peak_day_surcharge}
                subtotal={previewSubtotal}
                marginPct={marginPct}
                marginAmount={liveMarginAmount}
                tax={liveTax}
                total={liveTotal}
              />
            </Card>

            {/* Trip legs */}
            {previewLegs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Legs</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {previewLegs.map((leg, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 rounded-md bg-zinc-800/40 px-4 py-3"
                    >
                      <span className="font-mono text-lg font-semibold text-amber-400">
                        {leg.from_icao}
                      </span>
                      <span className="text-zinc-600">→</span>
                      <span className="font-mono text-lg font-semibold text-amber-400">
                        {leg.to_icao}
                      </span>
                      <span className="ml-auto font-mono text-xs text-zinc-500">
                        {leg.date} {leg.time}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right sidebar: margin, notes, confirm */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Aircraft</CardTitle>
              </CardHeader>
              <div className="space-y-1.5 text-sm">
                <p className="font-mono text-base font-semibold text-zinc-200">
                  {quotePricing.aircraft.tail_number}
                </p>
                <p className="text-zinc-500 capitalize">
                  {quotePricing.aircraft.category}
                </p>
                <p className="text-zinc-500">
                  {quotePricing.aircraft.range_nm.toLocaleString()} nm range ·{" "}
                  {quotePricing.aircraft.pax_capacity} pax
                </p>
              </div>
            </Card>

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
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span className="tabnum">{fmt(previewSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Margin</span>
                    <span className="tabnum">+{fmt(liveMarginAmount)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Tax (7.5%)</span>
                    <span className="tabnum">+{fmt(liveTax)}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-800 pt-1 font-medium text-zinc-300">
                    <span>Total</span>
                    <span className="tabnum text-amber-400">
                      {fmt(liveTotal)}
                    </span>
                  </div>
                </div>
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
              size="lg"
              className="w-full justify-center"
            >
              Confirm &amp; Save →
            </Button>

            <button
              onClick={() => setStep("configure")}
              className="w-full text-center text-xs text-zinc-600 hover:text-zinc-400"
            >
              ← Back to Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 1: Configure ─────────────────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">New Quote</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {isPreviewFlow
            ? previewError
              ? "Preview failed. Select options below to continue."
              : "Choose a route option, adjust margin, then preview the quote."
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

      {/* Route option cards (preview flow) */}
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

      {/* Trip / aircraft / route plan detail */}
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

          {/* Aircraft — manual flow only */}
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

          {/* AI-selected aircraft (preview flow) */}
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
            onClick={() => void handlePreviewQuote()}
            loading={loadingPricing}
            disabled={!canSave}
            size="lg"
            className="w-full justify-center"
          >
            Preview Quote →
          </Button>
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
