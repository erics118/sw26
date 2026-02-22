"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format";

interface EditableCostBreakdownProps {
  quoteId: string;
  fuelCost: number;
  fboFees: number;
  repositioningCost: number;
  repositioningHours: number;
  permitFees: number;
  crewOvernightCost: number;
  cateringCost: number;
  peakDaySurcharge: number;
  marginPct: number;
  currency: string;
}

function CurrencyInput({
  value,
  onChange,
  currency,
}: {
  value: number;
  onChange: (val: number) => void;
  currency: string;
}) {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));
  const committedRef = useRef(false);

  function enterEdit() {
    setLocalValue(String(value));
    committedRef.current = false;
    setFocused(true);
  }

  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    const cleaned = localValue.replace(/[^0-9.-]/g, "");
    const num = parseFloat(cleaned) || 0;
    const clamped = Math.max(0, Math.round(num));
    onChange(clamped);
    setFocused(false);
  }, [localValue, onChange]);

  return focused ? (
    <input
      type="text"
      inputMode="numeric"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setFocused(false);
        }
      }}
      className="w-32 rounded border border-amber-400/60 bg-zinc-800 px-2.5 py-1 text-right font-mono text-sm text-amber-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 focus:outline-none"
      autoFocus
    />
  ) : (
    <button
      type="button"
      onClick={enterEdit}
      className="w-32 cursor-text rounded border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-right font-mono text-sm text-amber-400 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
    >
      {formatCurrency(value, currency)}
    </button>
  );
}

function EditableRow({
  label,
  value,
  onChange,
  currency,
  showZero = false,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  currency: string;
  showZero?: boolean;
}) {
  if (value === 0 && !showZero) return null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-zinc-400">{label}</span>
      <CurrencyInput value={value} onChange={onChange} currency={currency} />
    </div>
  );
}

export default function EditableCostBreakdown({
  quoteId,
  fuelCost: initialFuelCost,
  fboFees: initialFboFees,
  repositioningCost: initialRepositioningCost,
  repositioningHours,
  permitFees: initialPermitFees,
  crewOvernightCost: initialCrewOvernightCost,
  cateringCost: initialCateringCost,
  peakDaySurcharge: initialPeakDaySurcharge,
  marginPct,
  currency,
}: EditableCostBreakdownProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [fuelCost, setFuelCost] = useState(initialFuelCost);
  const [fboFees, setFboFees] = useState(initialFboFees);
  const [repositioningCost, setRepositioningCost] = useState(
    initialRepositioningCost,
  );
  const [permitFees, setPermitFees] = useState(initialPermitFees);
  const [crewOvernightCost, setCrewOvernightCost] = useState(
    initialCrewOvernightCost,
  );
  const [cateringCost, setCateringCost] = useState(initialCateringCost);
  const [peakDaySurcharge, setPeakDaySurcharge] = useState(
    initialPeakDaySurcharge,
  );

  const subtotal =
    fuelCost +
    fboFees +
    repositioningCost +
    permitFees +
    crewOvernightCost +
    cateringCost +
    peakDaySurcharge;
  const marginAmount = (subtotal * marginPct) / 100;
  const tax = 0;
  const total = subtotal + marginAmount + tax;

  const isDirty =
    fuelCost !== initialFuelCost ||
    fboFees !== initialFboFees ||
    repositioningCost !== initialRepositioningCost ||
    permitFees !== initialPermitFees ||
    crewOvernightCost !== initialCrewOvernightCost ||
    cateringCost !== initialCateringCost ||
    peakDaySurcharge !== initialPeakDaySurcharge;

  const buildCostsPayload = () => ({
    fuel_cost: fuelCost,
    fbo_fees: fboFees,
    repositioning_cost: repositioningCost,
    repositioning_hours: repositioningHours,
    permit_fees: permitFees,
    crew_overnight_cost: crewOvernightCost,
    catering_cost: cateringCost,
    peak_day_surcharge: peakDaySurcharge,
    subtotal,
    margin_amount: marginAmount,
    tax,
    total,
  });

  async function saveCosts() {
    const res = await fetch(`/api/quotes/${quoteId}/costs`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCostsPayload()),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? "Failed to save costs");
    }
  }

  async function handleSaveCosts() {
    setSaving(true);
    setFeedback(null);
    try {
      await saveCosts();
      setFeedback({ type: "success", message: "Costs saved" });
      router.refresh();
    } catch (e) {
      setFeedback({
        type: "error",
        message: e instanceof Error ? e.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendQuote() {
    setSending(true);
    setFeedback(null);
    try {
      await saveCosts();
      const quoteRes = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "sent" }),
      });
      if (!quoteRes.ok) {
        const data = (await quoteRes.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to send quote");
      }
      router.refresh();
    } catch (e) {
      setFeedback({
        type: "error",
        message: e instanceof Error ? e.message : "Send failed",
      });
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (feedback?.type === "success") {
      const t = setTimeout(() => setFeedback(null), 2500);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const busy = saving || sending;

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <EditableRow
          label="Fuel"
          value={fuelCost}
          onChange={setFuelCost}
          currency={currency}
          showZero
        />
        <EditableRow
          label="FBO Fees"
          value={fboFees}
          onChange={setFboFees}
          currency={currency}
        />
        <EditableRow
          label={`Repositioning${repositioningHours > 0 ? ` (${repositioningHours}h)` : ""}`}
          value={repositioningCost}
          onChange={setRepositioningCost}
          currency={currency}
        />
        <EditableRow
          label="International Permits"
          value={permitFees}
          onChange={setPermitFees}
          currency={currency}
        />
        <EditableRow
          label="Crew Overnight"
          value={crewOvernightCost}
          onChange={setCrewOvernightCost}
          currency={currency}
        />
        <EditableRow
          label="Catering"
          value={cateringCost}
          onChange={setCateringCost}
          currency={currency}
        />
        <EditableRow
          label="Peak Day Surcharge"
          value={peakDaySurcharge}
          onChange={setPeakDaySurcharge}
          currency={currency}
        />

        <div className="mt-2 border-t border-zinc-800 pt-2">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-zinc-600">Subtotal</span>
            <span className="tabnum text-sm text-zinc-500">
              {formatCurrency(subtotal, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-zinc-600">Margin ({marginPct}%)</span>
            <span className="tabnum text-sm text-zinc-500">
              {formatCurrency(marginAmount, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-zinc-600">Tax</span>
            <span className="tabnum text-sm text-zinc-500">
              {formatCurrency(tax, currency)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between py-2 pt-3">
          <span className="text-sm font-semibold text-zinc-100">Total</span>
          <span className="tabnum text-base font-bold text-amber-400">
            {formatCurrency(total, currency)}
          </span>
        </div>
      </div>

      <div className="space-y-3 border-t border-zinc-800 pt-4">
        {isDirty && (
          <p className="text-xs text-amber-400/80">Unsaved changes</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSaveCosts}
            disabled={busy || !isDirty}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Costs"}
          </button>
          <button
            type="button"
            onClick={handleSendQuote}
            disabled={busy}
            className="flex-1 rounded-md bg-amber-400 px-4 py-2 font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Sending…" : "Save & Send Quote"}
          </button>
        </div>
        {feedback && (
          <p
            className={`text-xs ${feedback.type === "success" ? "text-emerald-400" : "text-red-400"}`}
          >
            {feedback.message}
          </p>
        )}
      </div>
    </div>
  );
}
