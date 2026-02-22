"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  subtotal: number;
  marginPct: number;
  marginAmount: number;
  tax: number;
  total: number;
  currency: string;
  isEditable: boolean;
}

function fmt(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
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
  isEditable,
}: EditableCostBreakdownProps) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Local editable state
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

  // Calculate totals dynamically
  const subtotal =
    fuelCost +
    fboFees +
    repositioningCost +
    permitFees +
    crewOvernightCost +
    cateringCost +
    peakDaySurcharge;
  const marginAmount = (subtotal * marginPct) / 100;
  const tax = 0; // Simplified - can be enhanced
  const total = subtotal + marginAmount + tax;

  const formatCurrency = (value: number) => fmt(value, currency);

  const handleInputChange = (value: string, setter: (val: number) => void) => {
    const num = parseFloat(value) || 0;
    setter(Math.max(0, num));
  };

  async function handleSendQuote() {
    setSending(true);
    setError("");

    try {
      // Update quote_costs
      const costsRes = await fetch(`/api/quotes/${quoteId}/costs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      if (!costsRes.ok) {
        const data = (await costsRes.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save costs");
      }

      // Update quote status to "sent"
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
      setError(e instanceof Error ? e.message : "Failed to send quote");
    } finally {
      setSending(false);
    }
  }

  const EditableRow = ({
    label,
    value,
    onChange,
    showZero = false,
  }: {
    label: string;
    value: number;
    onChange?: (val: number) => void;
    showZero?: boolean;
  }) => {
    if (value === 0 && !showZero && !isEditable) return null;

    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-sm text-zinc-400">{label}</span>
        {isEditable && onChange ? (
          <input
            type="number"
            value={value}
            onChange={(e) => handleInputChange(e.target.value, onChange)}
            min="0"
            step="100"
            className="w-32 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-right font-mono text-sm text-amber-400 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
          />
        ) : (
          <span className="tabnum text-sm text-zinc-300">
            {formatCurrency(value)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-0.5">
        <EditableRow
          label="Fuel"
          value={fuelCost}
          onChange={setFuelCost}
          showZero={true}
        />
        <EditableRow label="FBO Fees" value={fboFees} onChange={setFboFees} />
        <EditableRow
          label={`Repositioning${repositioningHours > 0 ? ` (${repositioningHours}h)` : ""}`}
          value={repositioningCost}
          onChange={setRepositioningCost}
        />
        <EditableRow
          label="International Permits"
          value={permitFees}
          onChange={setPermitFees}
        />
        <EditableRow
          label="Crew Overnight"
          value={crewOvernightCost}
          onChange={setCrewOvernightCost}
        />
        <EditableRow
          label="Catering"
          value={cateringCost}
          onChange={setCateringCost}
        />
        <EditableRow
          label="Peak Day Surcharge"
          value={peakDaySurcharge}
          onChange={setPeakDaySurcharge}
        />

        <div className="mt-2 border-t border-zinc-800 pt-2">
          <EditableRow label="Subtotal" value={subtotal} showZero={true} />
          <EditableRow
            label={`Margin (${marginPct}%)`}
            value={marginAmount}
            showZero={true}
          />
          <EditableRow label="Tax" value={tax} showZero={true} />
        </div>

        <div className="flex items-center justify-between py-2 pt-3">
          <span className="text-sm font-semibold text-zinc-100">Total</span>
          <span className="tabnum text-base font-bold text-amber-400">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {isEditable && (
        <div className="flex gap-3 border-t border-zinc-800 pt-4">
          <button
            onClick={handleSendQuote}
            disabled={sending}
            className="flex-1 rounded-md bg-amber-400 px-4 py-2 font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send Quote"}
          </button>
          {error && (
            <span className="flex items-center text-xs text-red-400">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
