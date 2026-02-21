"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STEPS = ["new", "pricing", "sent", "negotiating", "confirmed"] as const;
const LABELS: Record<string, string> = {
  new: "New",
  pricing: "Pricing",
  sent: "Sent",
  negotiating: "Negotiating",
  confirmed: "Confirmed",
  lost: "Lost",
  completed: "Completed",
};

function allowedNextStatuses(from: string): string[] {
  if (from === "lost" || from === "completed") return [];
  const fromIdx = STEPS.indexOf(from as (typeof STEPS)[number]);
  const next: string[] = [];
  // Forward steps
  for (let i = fromIdx + 1; i < STEPS.length; i++) next.push(STEPS[i]);
  // sent <-> negotiating
  if (from === "sent") next.push("negotiating");
  if (from === "negotiating") next.push("sent");
  // Terminal from any active
  next.push("lost", "completed");
  return [...new Set(next)];
}

interface QuoteStatusUpdateProps {
  quoteId: string;
  currentStatus: string;
}

export default function QuoteStatusUpdate({
  quoteId,
  currentStatus,
}: QuoteStatusUpdateProps) {
  const router = useRouter();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const options = allowedNextStatuses(currentStatus);
  if (options.length === 0) return null;

  async function handleChange(newStatus: string) {
    if (newStatus === currentStatus) return;
    setUpdating(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium text-zinc-500 uppercase">
        Update status
      </label>
      <select
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (v) handleChange(v);
          e.target.value = "";
        }}
        disabled={updating}
        className="rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-200 focus:border-amber-400 focus:outline-none disabled:opacity-50"
      >
        <option value="">—</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {LABELS[s] ?? s}
          </option>
        ))}
      </select>
      {updating && <span className="text-xs text-zinc-500">Updating…</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
