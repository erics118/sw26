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

interface ComplianceResult {
  passed: boolean;
  failures: string[];
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

  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [checkingCompliance, setCheckingCompliance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const runCompliance = useCallback(async () => {
    if (!selectedTripId || !selectedAircraftId || !selectedOperatorId) return;
    setCheckingCompliance(true);
    setCompliance(null);
    try {
      const res = await fetch("/api/compliance/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trip_id: selectedTripId,
          aircraft_id: selectedAircraftId,
          operator_id: selectedOperatorId,
        }),
      });
      const data = (await res.json()) as ComplianceResult & { error?: string };
      if (!res.ok) {
        setCompliance({
          passed: false,
          failures: [data.error ?? "Check failed"],
        });
      } else {
        setCompliance(data);
      }
    } catch {
      setCompliance({ passed: false, failures: ["Network error"] });
    } finally {
      setCheckingCompliance(false);
    }
  }, [selectedTripId, selectedAircraftId, selectedOperatorId]);

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
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create quote");
      router.push(`/quotes/${data.id}`);
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
                        setCompliance(null);
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
                        setCompliance(null);
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
                        setCompliance(null);
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

        {/* Right sidebar — settings + compliance */}
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

          {/* Compliance */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance</CardTitle>
            </CardHeader>
            {compliance ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${compliance.passed ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {compliance.passed
                      ? "✓ All checks passed"
                      : "✗ Issues found"}
                  </span>
                </div>
                {compliance.failures.length > 0 && (
                  <ul className="space-y-1">
                    {compliance.failures.map((f, i) => (
                      <li key={i} className="text-xs text-red-400">
                        · {f}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => void runCompliance()}
                  className="mt-1 text-xs text-zinc-600 hover:text-amber-400"
                >
                  Re-run →
                </button>
              </div>
            ) : (
              <Button
                onClick={() => void runCompliance()}
                loading={checkingCompliance}
                variant="secondary"
                size="sm"
                disabled={!canSave}
                className="w-full justify-center"
              >
                {checkingCompliance ? "Checking…" : "Run Compliance Check"}
              </Button>
            )}
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

          {compliance && !compliance.passed && (
            <p className="text-center text-xs text-zinc-600">
              Compliance issues found — proceed with caution
            </p>
          )}

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
