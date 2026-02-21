import type { PlanesNeeded } from "@/lib/forecasting/types";

interface CapacityGapCardProps {
  category: string;
  data: PlanesNeeded[];
}

export function CapacityGapCard({ category, data }: CapacityGapCardProps) {
  const filtered = data.filter((d) => d.aircraft_category === category);
  if (filtered.length === 0) return null;

  const shortages = filtered.filter((d) => d.status === "shortage");
  const surpluses = filtered.filter((d) => d.status === "surplus");

  const totalGapHours = filtered.reduce(
    (sum, d) => sum + Math.max(0, d.capacity_gap_hours),
    0,
  );
  const maxRequired = Math.max(...filtered.map((d) => d.required_aircraft));
  const peakGap = filtered.reduce<(typeof filtered)[0] | undefined>(
    (max, d) =>
      !max || d.capacity_gap_aircraft > max.capacity_gap_aircraft ? d : max,
    undefined,
  );

  const hasShortage = shortages.length > 0;
  const hasSurplus = surpluses.length > 0 && shortages.length === 0;

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest text-zinc-600 uppercase">
          {category}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            hasShortage
              ? "bg-red-400/10 text-red-400"
              : hasSurplus
                ? "bg-amber-400/10 text-amber-400"
                : "bg-emerald-400/10 text-emerald-400"
          }`}
        >
          {hasShortage
            ? `${shortages.length}d shortage`
            : hasSurplus
              ? `${surpluses.length}d surplus`
              : "balanced"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-zinc-600">Peak required</p>
          <p className="tabnum mt-0.5 text-2xl font-bold text-zinc-100">
            {maxRequired}
          </p>
          <p className="text-[10px] text-zinc-600">aircraft</p>
        </div>
        <div>
          <p className="text-xs text-zinc-600">Gap hours</p>
          <p
            className={`tabnum mt-0.5 text-2xl font-bold ${
              totalGapHours > 0 ? "text-red-400" : "text-emerald-400"
            }`}
          >
            {totalGapHours > 0
              ? `+${totalGapHours.toFixed(1)}`
              : totalGapHours.toFixed(1)}
          </p>
          <p className="text-[10px] text-zinc-600">total shortage hrs</p>
        </div>
        <div>
          <p className="text-xs text-zinc-600">Peak gap</p>
          <p
            className={`tabnum mt-0.5 text-2xl font-bold ${
              (peakGap?.capacity_gap_aircraft ?? 0) > 0
                ? "text-red-400"
                : "text-zinc-100"
            }`}
          >
            {(peakGap?.capacity_gap_aircraft ?? 0) > 0
              ? `+${peakGap?.capacity_gap_aircraft}`
              : "0"}
          </p>
          <p className="text-[10px] text-zinc-600">
            aircraft on {peakGap?.date.slice(5) ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
