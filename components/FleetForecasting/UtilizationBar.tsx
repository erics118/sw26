"use client";

interface UtilizationBarProps {
  value: number; // 0–1
  showLabel?: boolean;
}

export function UtilizationBar({
  value,
  showLabel = true,
}: UtilizationBarProps) {
  const pct = Math.round(value * 100);

  let color: string;
  if (value < 0.6) {
    color = "bg-red-400";
  } else if (value > 0.85) {
    color = "bg-amber-400";
  } else {
    color = "bg-emerald-400";
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {showLabel && (
        <span className="tabnum w-10 text-right text-xs text-zinc-400">
          {pct}%
        </span>
      )}
    </div>
  );
}
