export function KPICard({
  label,
  value,
  subLabel,
  accent = false,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur">
      <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        {label}
      </p>
      <p
        className={`tabnum mt-3 text-4xl font-bold ${
          accent ? "text-emerald-400" : "text-zinc-100"
        }`}
      >
        {value}
      </p>
      {subLabel && <p className="mt-2 text-xs text-zinc-600">{subLabel}</p>}
    </div>
  );
}

export function KPISkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="h-3 w-20 rounded bg-zinc-800" />
      <div className="mt-4 h-9 w-16 rounded bg-zinc-800" />
      <div className="mt-3 h-3 w-24 rounded bg-zinc-800" />
    </div>
  );
}

export function SparkChart({ color = "#00e696" }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 100 40"
      className="h-12 w-full"
      preserveAspectRatio="none"
    >
      <polyline
        points="0,30 15,22 30,25 45,15 60,18 75,8 100,5"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
      />
      <polyline
        points="0,32 15,28 30,26 45,20 60,22 75,12 100,8"
        fill="none"
        stroke={`${color}33`}
        strokeWidth="1"
        strokeDasharray="2,2"
      />
    </svg>
  );
}
