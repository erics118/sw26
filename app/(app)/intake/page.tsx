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

type SourceTab = "email" | "text" | "document";

interface MockEmail {
  id: string;
  from_name: string;
  from_email: string;
  subject: string;
  preview: string;
  time: string;
  status: "new" | "processed";
  body: string;
}

const SAMPLE = `Hi, I need to charter a flight for our team.

We're looking at flying from Los Angeles (LAX) to New York (JFK) on June 15th, departing around 2pm.
It'll be 4 passengers total — all adults. We'd love a mid-size jet if possible, wifi is a must.

Our CEO may want to return on June 17th in the evening.

We'll have quite a bit of luggage — 6 checked bags. No special dietary needs but would appreciate
light catering. Flexible by ±2 hours on departure.

Contact: James Whitfield, james@acmecorp.com, +1 (310) 555-0192, Acme Corp`;

const SAMPLE_EMAILS: MockEmail[] = [
  {
    id: "e1",
    from_name: "James Whitfield",
    from_email: "james@acmecorp.com",
    subject: "Charter request: LAX → JFK Jun 15",
    preview: "Hi, I need to charter a flight for our team...",
    time: "2h ago",
    status: "new",
    body: SAMPLE,
  },
  {
    id: "e2",
    from_name: "Sarah Chen",
    from_email: "schen@meridian.vc",
    subject: "Aspen ski trip — Dec 28 to Jan 2",
    preview: "We're planning our annual Aspen ski trip and would love to charter again...",
    time: "1d ago",
    status: "processed",
    body: `Hi team,

We're planning our annual Aspen ski trip and would love to charter with you again.

Dates: December 28 departure, returning January 2nd.
Route: SFO to ASE, return ASE to SFO.
Group: 6 adults, 2 children.

We'll have ski gear for all 8 guests, so please factor in extra luggage capacity.
Last year we used a heavy jet — would appreciate the same or better.
No dietary restrictions but light catering appreciated.

Can you send over a quote?

Best,
Sarah Chen
Meridian Ventures | schen@meridian.vc | +1 (415) 555-0284`,
  },
  {
    id: "e3",
    from_name: "Fortuna Aviation",
    from_email: "ops@fortunaaviation.com",
    subject: "FWD: VIP transfer — KSNA to KTEB",
    preview: "Forwarding a client request for an ASAP same-day or next-day trip...",
    time: "3d ago",
    status: "processed",
    body: `Hello,

Forwarding a client request for an ASAP same-day or next-day trip.

Segment: KSNA (Orange County) to KTEB (Teterboro, NJ)
Date: Flexible, ASAP this week
Passengers: 2 adults, VIP — privacy is critical
Aircraft: Super-mid or heavy preferred, full galley

Client contact is handled through us — please do not contact directly.
Budget is not an issue; please send your best available.

Regards,
Fortuna Aviation Ops
ops@fortunaaviation.com`,
  },
];

const INTAKE_ADDRESS = "intake@skyops.aero";

export default function IntakePage() {
  const [activeTab, setActiveTab] = useState<SourceTab>("email");
  const [selectedEmail, setSelectedEmail] = useState<MockEmail | null>(null);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<IntakeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const [ex, setEx] = useState<Extracted | null>(null);

  function handleTabChange(tab: SourceTab) {
    setActiveTab(tab);
    setResult(null);
    setEx(null);
    setError("");
    if (tab !== "email") {
      setSelectedEmail(null);
    }
  }

  function handleSelectEmail(email: MockEmail) {
    setSelectedEmail(email);
    setRawText(email.body);
    setResult(null);
    setEx(null);
    setError("");
  }

  async function handleCopyAddress() {
    await navigator.clipboard.writeText(INTAKE_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
  const newEmailCount = SAMPLE_EMAILS.filter((e) => e.status === "new").length;
  const canExtract =
    activeTab !== "document" && rawText.trim().length > 0 && !loading;

  function tabClass(tab: SourceTab) {
    const base =
      "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-b-2";
    return activeTab === tab
      ? `${base} border-amber-400 text-amber-400`
      : `${base} border-transparent text-zinc-500 hover:text-zinc-300`;
  }

  return (
    <div className="min-h-full p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">New Intake</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Pick up an email, paste call notes, or upload a document — AI extracts
          the trip details.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Input panel */}
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
            {/* Tab bar */}
            <div className="flex border-b border-zinc-800 bg-zinc-950/40">
              <button onClick={() => handleTabChange("email")} className={tabClass("email")}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M2 8l10 6 10-6" />
                </svg>
                Email Inbox
                {newEmailCount > 0 && (
                  <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-400/20 px-1 text-[10px] font-semibold text-amber-400">
                    {newEmailCount}
                  </span>
                )}
              </button>
              <button onClick={() => handleTabChange("text")} className={tabClass("text")}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
                Paste Text
              </button>
              <button onClick={() => handleTabChange("document")} className={tabClass("document")}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Upload Doc
                <span className="rounded px-1 py-0.5 text-[10px] font-medium text-zinc-600 border border-zinc-700">
                  Soon
                </span>
              </button>
            </div>

            {/* ── Email inbox tab ── */}
            {activeTab === "email" && (
              <div>
                {/* Intake address bar */}
                <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-xs text-zinc-600">Receiving at</span>
                    <code className="text-xs font-mono text-zinc-300">
                      {INTAKE_ADDRESS}
                    </code>
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    className="text-xs text-zinc-600 transition-colors hover:text-amber-400"
                  >
                    {copied ? "copied ✓" : "copy"}
                  </button>
                </div>

                {/* Inbox list */}
                <div className="divide-y divide-zinc-800/60">
                  {SAMPLE_EMAILS.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => handleSelectEmail(email)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-zinc-800/50 ${
                        selectedEmail?.id === email.id ? "bg-zinc-800/70" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {email.status === "new" && (
                              <div className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                            )}
                            <span
                              className={`truncate text-xs font-medium ${
                                email.status === "new"
                                  ? "text-zinc-200"
                                  : "text-zinc-400"
                              }`}
                            >
                              {email.from_name}
                            </span>
                            {email.status === "new" && (
                              <span className="flex-shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-400/15 text-amber-400">
                                NEW
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-zinc-500">
                            {email.subject}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-zinc-700">
                            {email.preview}
                          </div>
                        </div>
                        <span className="flex-shrink-0 text-[11px] text-zinc-700">
                          {email.time}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Selected email body / placeholder */}
                {selectedEmail ? (
                  <div className="border-t border-zinc-800">
                    <div className="border-b border-zinc-800 bg-zinc-900/40 px-4 py-2.5">
                      <div className="text-xs text-zinc-600">
                        From:{" "}
                        <span className="text-zinc-400">
                          {selectedEmail.from_name}
                        </span>{" "}
                        <span className="text-zinc-700">
                          &lt;{selectedEmail.from_email}&gt;
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-600">
                        Subject:{" "}
                        <span className="text-zinc-400">
                          {selectedEmail.subject}
                        </span>
                      </div>
                    </div>
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      rows={8}
                      className="amber-glow w-full resize-none bg-transparent px-4 py-3 font-mono text-sm leading-relaxed text-zinc-300 placeholder-zinc-700 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center px-4 py-10 text-center">
                    <p className="text-xs text-zinc-700">
                      Select an email above to load its contents
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Paste text tab ── */}
            {activeTab === "text" && (
              <div>
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
            )}

            {/* ── Document upload tab ── */}
            {activeTab === "document" && (
              <div className="flex flex-col items-center justify-center gap-6 px-8 py-10">
                {/* Coming soon badge */}
                <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/60 px-3 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                  <span className="text-xs font-medium text-zinc-400">
                    Coming Soon
                  </span>
                </div>

                {/* Drop zone */}
                <div className="w-full cursor-not-allowed rounded-xl border-2 border-dashed border-zinc-700/60 px-8 py-10 text-center opacity-50">
                  <svg
                    className="mx-auto mb-3 text-zinc-600"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" />
                  </svg>
                  <p className="text-sm text-zinc-500">
                    Drop a file here or click to browse
                  </p>
                  <p className="mt-1 text-xs text-zinc-700">
                    PDF · DOCX · TXT · PNG · JPG
                  </p>
                </div>

                {/* Use cases */}
                <div className="w-full">
                  <p className="mb-2 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
                    Useful for
                  </p>
                  <ul className="space-y-1.5 text-xs text-zinc-600">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-zinc-700">·</span>
                      Scanned fax requests or printed forms
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-zinc-700">·</span>
                      PDF itinerary attachments from brokers
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-zinc-700">·</span>
                      Word documents with multi-leg trip details
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-zinc-700">·</span>
                      Photos of handwritten notes or whiteboard plans
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-zinc-700">·</span>
                      Multi-page charter agreements with embedded trip data
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Extract button — not shown for document tab */}
          {activeTab !== "document" && (
            <Button
              onClick={handleExtract}
              loading={loading}
              disabled={!canExtract}
              size="lg"
              className="w-full justify-center"
            >
              {loading ? "Extracting…" : "✈ Extract with AI"}
            </Button>
          )}

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
