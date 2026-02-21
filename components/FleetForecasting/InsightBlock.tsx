"use client";

import type { ForecastInsight } from "@/lib/ai/forecasting";

interface InsightBlockProps {
  insight: ForecastInsight | null;
  loading?: boolean;
}

const CONFIDENCE_COLORS = {
  high: "border-emerald-500/30 bg-emerald-500/5",
  medium: "border-amber-400/30 bg-amber-400/5",
  low: "border-zinc-700 bg-zinc-800/50",
};

const CONFIDENCE_LABEL = {
  high: "text-emerald-400",
  medium: "text-amber-400",
  low: "text-zinc-500",
};

export function InsightBlock({ insight, loading }: InsightBlockProps) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-400/40" />
          <div className="h-3 w-24 rounded bg-zinc-800" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full rounded bg-zinc-800" />
          <div className="h-3 w-4/5 rounded bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (!insight) return null;

  const conf = insight.confidence ?? "medium";

  return (
    <div className={`rounded-lg border p-4 ${CONFIDENCE_COLORS[conf]}`}>
      <div className="flex items-center gap-2">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-amber-400"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          AI Analysis
        </span>
        <span
          className={`ml-auto text-[10px] font-medium tracking-widest uppercase ${CONFIDENCE_LABEL[conf]}`}
        >
          {conf} confidence
        </span>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-zinc-300">
        {insight.summary}
      </p>

      {insight.actions.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {insight.actions.map((action, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400/20 text-[9px] font-bold text-amber-400">
                {i + 1}
              </span>
              <p className="text-xs text-zinc-400">{action}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
