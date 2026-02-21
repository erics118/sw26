"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ConfidenceChip from "@/components/ui/ConfidenceChip";

interface TripLeg {
  from_icao: string;
  to_icao: string;
  date: string;
  time: string;
}

interface Extracted {
  legs: TripLeg[];
  trip_type: string;
  pax_adults: number;
  pax_children: number;
  pax_pets: number;
  flexibility_hours: number;
  special_needs: string | null;
  catering_notes: string | null;
  luggage_notes: string | null;
  preferred_category: string | null;
  min_cabin_height_in: number | null;
  wifi_required: boolean;
  bathroom_required: boolean;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_company: string | null;
}

interface IntakeResult {
  trip_id: string;
  extracted: Extracted;
  confidence: Record<string, number>;
  client_hint: {
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
  };
}

const SAMPLE = `Hi, I need to charter a flight for our team.

We're looking at flying from Los Angeles (LAX) to New York (JFK) on June 15th, departing around 2pm.
It'll be 4 passengers total — all adults. We'd love a mid-size jet if possible, wifi is a must.

Our CEO may want to return on June 17th in the evening.

We'll have quite a bit of luggage — 6 checked bags. No special dietary needs but would appreciate
light catering. Flexible by ±2 hours on departure.

Contact: James Whitfield, james@acmecorp.com, +1 (310) 555-0192, Acme Corp`;

function FieldInput({
  label,
  value,
  onChange,
  confidence,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  confidence?: number;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
          {label}
        </label>
        <ConfidenceChip score={confidence} label />
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "—"}
        className="amber-glow w-full rounded border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 transition-colors focus:border-amber-400"
      />
    </div>
  );
}

export default function IntakePage() {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Editable state for extracted fields
  const [ex, setEx] = useState<Extracted | null>(null);

  async function handleExtract() {
    if (!rawText.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setEx(null);

    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText }),
      });
      const data = (await res.json()) as IntakeResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      setResult(data);
      setEx(data.extracted);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function updateEx<K extends keyof Extracted>(key: K, value: Extracted[K]) {
    setEx((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateLeg(idx: number, field: keyof TripLeg, value: string) {
    setEx((prev) => {
      if (!prev) return prev;
      const legs = prev.legs.map((l, i) =>
        i === idx ? { ...l, [field]: value } : l,
      );
      return { ...prev, legs };
    });
  }

  async function handleSave() {
    if (!result || !ex) return;
    setSaving(true);
    // The trip was already saved by the API. Navigate to quotes/new to build the quote.
    router.push(`/quotes/new?trip_id=${result.trip_id}`);
  }

  const conf = result?.confidence ?? {};

  return (
    <div className="min-h-full p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">New Intake</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Paste an email or call notes — AI will extract the trip details.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Input panel */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                Raw Input
              </span>
              <button
                onClick={() => setRawText(SAMPLE)}
                className="text-xs text-zinc-600 transition-colors hover:text-amber-400"
              >
                Load sample →
              </button>
            </div>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste email or call notes here..."
              rows={16}
              className="amber-glow w-full resize-none rounded-b-lg bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-zinc-300 placeholder-zinc-700 focus:outline-none"
            />
          </div>

          <Button
            onClick={handleExtract}
            loading={loading}
            disabled={!rawText.trim()}
            size="lg"
            className="w-full justify-center"
          >
            {loading ? "Extracting…" : "✈ Extract with AI"}
          </Button>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>

        {/* Right: Extracted results */}
        <div>
          {!ex && !loading && (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-800 text-center">
              <div>
                <div className="mb-2 text-3xl opacity-20">✈</div>
                <p className="text-sm text-zinc-700">
                  Extracted fields will appear here
                </p>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex h-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
              <div className="text-center">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
                <p className="text-sm text-zinc-500">
                  Extracting trip details…
                </p>
                <p className="mt-1 text-xs text-zinc-700">
                  claude-haiku-4-5-20251001
                </p>
              </div>
            </div>
          )}

          {ex && (
            <div className="slide-in space-y-4">
              {/* Route / Legs */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                    Route
                  </h3>
                  <ConfidenceChip score={conf["legs"]} label />
                </div>
                {ex.legs.map((leg, i) => (
                  <div key={i} className="mb-3 grid grid-cols-4 gap-2">
                    <input
                      value={leg.from_icao}
                      onChange={(e) =>
                        updateLeg(i, "from_icao", e.target.value)
                      }
                      placeholder="XXXX"
                      className="amber-glow rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-center font-mono text-sm text-amber-400 focus:border-amber-400"
                    />
                    <div className="flex items-center justify-center text-zinc-600">
                      →
                    </div>
                    <input
                      value={leg.to_icao}
                      onChange={(e) => updateLeg(i, "to_icao", e.target.value)}
                      placeholder="XXXX"
                      className="amber-glow rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-center font-mono text-sm text-amber-400 focus:border-amber-400"
                    />
                    <input
                      value={leg.date}
                      onChange={(e) => updateLeg(i, "date", e.target.value)}
                      type="date"
                      className="amber-glow rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 font-mono text-xs text-zinc-300 focus:border-amber-400"
                    />
                  </div>
                ))}
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-xs text-zinc-600">Type:</span>
                  <select
                    value={ex.trip_type}
                    onChange={(e) => updateEx("trip_type", e.target.value)}
                    className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                  >
                    {["one_way", "round_trip", "multi_leg"].map((t) => (
                      <option key={t} value={t}>
                        {t.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-zinc-600">Flex:</span>
                  <input
                    type="number"
                    value={ex.flexibility_hours}
                    onChange={(e) =>
                      updateEx(
                        "flexibility_hours",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    className="w-14 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
                  />
                  <span className="text-xs text-zinc-600">hrs</span>
                </div>
              </div>

              {/* Passengers */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                  Passengers
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <FieldInput
                    label="Adults"
                    value={String(ex.pax_adults)}
                    onChange={(v) => updateEx("pax_adults", parseInt(v) || 1)}
                    confidence={conf["pax_adults"]}
                    type="number"
                  />
                  <FieldInput
                    label="Children"
                    value={String(ex.pax_children)}
                    onChange={(v) => updateEx("pax_children", parseInt(v) || 0)}
                    confidence={conf["pax_children"]}
                    type="number"
                  />
                  <FieldInput
                    label="Pets"
                    value={String(ex.pax_pets)}
                    onChange={(v) => updateEx("pax_pets", parseInt(v) || 0)}
                    confidence={conf["pax_pets"]}
                    type="number"
                  />
                </div>
              </div>

              {/* Aircraft prefs */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                  Aircraft Preferences
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                        Category
                      </label>
                      <ConfidenceChip
                        score={conf["preferred_category"]}
                        label
                      />
                    </div>
                    <select
                      value={ex.preferred_category ?? ""}
                      onChange={(e) =>
                        updateEx("preferred_category", e.target.value || null)
                      }
                      className="amber-glow w-full rounded border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100"
                    >
                      <option value="">Any</option>
                      {[
                        "turboprop",
                        "light",
                        "midsize",
                        "super-mid",
                        "heavy",
                        "ultra-long",
                      ].map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <FieldInput
                    label="Min Cabin Height (in)"
                    value={String(ex.min_cabin_height_in ?? "")}
                    onChange={(v) =>
                      updateEx("min_cabin_height_in", parseFloat(v) || null)
                    }
                    confidence={conf["min_cabin_height_in"]}
                    type="number"
                    placeholder="None"
                  />
                </div>
                <div className="mt-3 flex gap-4">
                  {(["wifi_required", "bathroom_required"] as const).map(
                    (key) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={ex[key]}
                          onChange={(e) => updateEx(key, e.target.checked)}
                          className="h-3.5 w-3.5 rounded accent-amber-400"
                        />
                        <span className="text-xs text-zinc-400 capitalize">
                          {key.replace("_", " ")}
                        </span>
                      </label>
                    ),
                  )}
                </div>
              </div>

              {/* Client */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                  Client (from text)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput
                    label="Name"
                    value={ex.client_name ?? ""}
                    onChange={(v) => updateEx("client_name", v || null)}
                    confidence={conf["client_name"]}
                  />
                  <FieldInput
                    label="Email"
                    value={ex.client_email ?? ""}
                    onChange={(v) => updateEx("client_email", v || null)}
                    confidence={conf["client_email"]}
                    type="email"
                  />
                  <FieldInput
                    label="Phone"
                    value={ex.client_phone ?? ""}
                    onChange={(v) => updateEx("client_phone", v || null)}
                    confidence={conf["client_phone"]}
                    type="tel"
                  />
                  <FieldInput
                    label="Company"
                    value={ex.client_company ?? ""}
                    onChange={(v) => updateEx("client_company", v || null)}
                    confidence={conf["client_company"]}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                  Notes
                </h3>
                <div className="space-y-3">
                  <FieldInput
                    label="Catering"
                    value={ex.catering_notes ?? ""}
                    onChange={(v) => updateEx("catering_notes", v || null)}
                    confidence={conf["catering_notes"]}
                    placeholder="None"
                  />
                  <FieldInput
                    label="Luggage"
                    value={ex.luggage_notes ?? ""}
                    onChange={(v) => updateEx("luggage_notes", v || null)}
                    confidence={conf["luggage_notes"]}
                    placeholder="None"
                  />
                  <FieldInput
                    label="Special needs"
                    value={ex.special_needs ?? ""}
                    onChange={(v) => updateEx("special_needs", v || null)}
                    confidence={conf["special_needs"]}
                    placeholder="None"
                  />
                </div>
              </div>

              <Button
                onClick={handleSave}
                loading={saving}
                size="lg"
                className="w-full justify-center"
              >
                Save Trip & Build Quote →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
