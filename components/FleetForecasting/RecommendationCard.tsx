"use client";

import type { ActionRecommendation } from "@/lib/forecasting/types";
import { formatFlightTime } from "@/lib/format";

interface RecommendationCardProps {
  rec: ActionRecommendation;
}

export function RecommendationCard({ rec }: RecommendationCardProps) {
  if (rec.type === "reposition") {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-amber-400/10 text-amber-400">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-100">
                Reposition {rec.tail_number}
              </p>
              <p className="text-xs text-zinc-500">
                {rec.move_from_airport} → {rec.move_to_airport}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400">
            reposition
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-zinc-600">Repo cost</p>
            <p className="tabnum text-xs font-medium text-zinc-300">
              ${rec.estimated_reposition_cost.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600">Repo hours</p>
            <p className="tabnum text-xs font-medium text-zinc-300">
              {formatFlightTime(rec.estimated_reposition_hours)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-600">Util gain</p>
            <p className="tabnum text-xs font-medium text-emerald-400">
              +{formatFlightTime(rec.expected_utilization_gain)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-600">{rec.reason}</p>
      </div>
    );
  }

  // maintenance_window
  const startDate = new Date(rec.suggested_start);
  const endDate = new Date(rec.suggested_end);
  const dateStr = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-400/10 text-emerald-400">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-medium text-zinc-100">
              Schedule maintenance: {rec.tail_number}
            </p>
            <p className="text-xs text-zinc-500">
              {dateStr} {startDate.getUTCHours()}:00–
              {endDate.getUTCHours()}:00 UTC
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
          maintenance
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-600">{rec.reason}</p>
    </div>
  );
}
