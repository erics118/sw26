import { formatCurrency as fmt } from "@/lib/format";

interface LineItem {
  label: string;
  amount: number;
}

interface CostBreakdownProps {
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
  currency?: string;
  extraItems?: LineItem[];
}

function Row({
  label,
  amount,
  currency,
  dim = false,
  bold = false,
}: {
  label: string;
  amount: number;
  currency?: string;
  dim?: boolean;
  bold?: boolean;
}) {
  if (amount === 0 && !bold) return null;
  return (
    <div
      className={`flex items-center justify-between py-1.5 ${bold ? "mt-1 border-t border-zinc-700 pt-3" : ""}`}
    >
      <span
        className={`text-sm ${dim ? "text-zinc-600" : bold ? "font-semibold text-zinc-100" : "text-zinc-400"}`}
      >
        {label}
      </span>
      <span
        className={`tabnum text-sm ${bold ? "text-base font-bold text-amber-400" : dim ? "text-zinc-600" : "text-zinc-300"}`}
      >
        {fmt(amount, currency)}
      </span>
    </div>
  );
}

export default function CostBreakdown({
  fuelCost,
  fboFees,
  repositioningCost,
  repositioningHours,
  permitFees,
  crewOvernightCost,
  cateringCost,
  peakDaySurcharge,
  subtotal,
  marginPct,
  marginAmount,
  tax,
  total,
  currency = "USD",
  extraItems = [],
}: CostBreakdownProps) {
  return (
    <div className="space-y-0.5">
      <Row label="Fuel" amount={Math.max(0, fuelCost)} currency={currency} />
      <Row label="FBO Fees" amount={fboFees} currency={currency} />
      <Row
        label={`Repositioning${repositioningHours > 0 ? ` (${repositioningHours}h)` : ""}`}
        amount={repositioningCost}
        currency={currency}
      />
      <Row
        label="International Permits"
        amount={permitFees}
        currency={currency}
      />
      <Row
        label="Crew Overnight"
        amount={crewOvernightCost}
        currency={currency}
      />
      <Row label="Catering" amount={cateringCost} currency={currency} />
      <Row
        label="Peak Day Surcharge"
        amount={peakDaySurcharge}
        currency={currency}
      />
      {extraItems.map((item) => (
        <Row
          key={item.label}
          label={item.label}
          amount={item.amount}
          currency={currency}
        />
      ))}
      <div className="mt-2 border-t border-zinc-800 pt-2">
        <Row label="Subtotal" amount={subtotal} currency={currency} dim />
        <Row
          label={`Margin (${marginPct}%)`}
          amount={marginAmount}
          currency={currency}
          dim
        />
        <Row label="Tax" amount={tax} currency={currency} dim />
      </div>
      <Row label="Total" amount={total} currency={currency} bold />
    </div>
  );
}
