"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ExtractedTripForm from "@/components/intake/ExtractedTripForm";

export interface TripLeg {
  from_icao: string;
  to_icao: string;
  date: string;
  time: string;
}

export interface Extracted {
  legs: TripLeg[];
  trip_type: string;
  pax_adults: number;
  pax_children: number;
  pax_pets: number;
  flexibility_hours: number;
  flexibility_hours_return: number;
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

const SAMPLE = `Hey — need a charter for next Thursday, the 26th. Flying 6 of us from
Teterboro (TEB) down to Palm Beach (PBI), wheels up around 9am.
Then returning Sunday evening, preferably before 8pm.

One passenger is our managing partner so we need a larger cabin —
definitely need WiFi both ways and light catering on the outbound leg.
We have about 8 bags total.

Client is James Harrington from Meridian Ventures, james@meridianvc.com,
+1 (212) 555-0174. He's flown with us before.

Flexible by an hour either way on departure if needed.`;

export default function IntakePage() {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

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
      setEx({
        ...data.extracted,
        flexibility_hours_return:
          (data.extracted as Extracted).flexibility_hours_return ?? 0,
      });
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
            <ExtractedTripForm
              ex={ex}
              conf={conf}
              onUpdateEx={updateEx}
              onUpdateLeg={updateLeg}
              onSave={handleSave}
              saving={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
