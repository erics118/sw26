import { cache } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { KPICard } from "./KPICard";
import { createClient } from "@/lib/supabase/server";
import { computeCapacity } from "@/lib/forecasting/capacity";
import {
  computeExpectedDemand,
  computePipelineDemand,
} from "@/lib/forecasting/demand";
import { computePlanesNeeded } from "@/lib/forecasting/planes-needed";
import { computeUtilization } from "@/lib/forecasting/utilization";
import { generateRecommendations } from "@/lib/forecasting/actions";
import { addDays } from "@/lib/forecasting/utils";
import type {
  PlanesNeeded,
  CategoryUtilizationSummary,
} from "@/lib/forecasting/types";

type ForecastBundle = {
  planesNeeded: PlanesNeeded[];
  utilization: {
    aircraft: { aircraft_id: string; utilization_rate: number }[];
    by_category: CategoryUtilizationSummary[];
  };
  recommendations: {
    reposition: {
      aircraft_id: string;
      tail_number: string;
      move_to_airport: string;
    }[];
  };
};

const fetchForecastBundle = cache(async (): Promise<ForecastBundle> => {
  const supabase = await createClient();

  const forecastStart = new Date();
  forecastStart.setUTCHours(0, 0, 0, 0);
  const forecastEnd = addDays(forecastStart, 6);

  const utilEnd = new Date();
  utilEnd.setUTCHours(23, 59, 59, 999);
  const utilStart = addDays(utilEnd, -29);
  utilStart.setUTCHours(0, 0, 0, 0);

  const [capacity, demand, pipeline, utilResult] = await Promise.all([
    computeCapacity(supabase, forecastStart, forecastEnd),
    computeExpectedDemand(supabase, forecastStart, forecastEnd),
    computePipelineDemand(supabase, forecastStart, forecastEnd),
    computeUtilization(supabase, utilStart, utilEnd),
  ]);

  const planesNeeded = computePlanesNeeded(capacity, demand, pipeline);

  const recs = await generateRecommendations(
    supabase,
    utilResult.aircraft,
    demand,
    7,
  );

  return {
    planesNeeded,
    utilization: utilResult,
    recommendations: recs,
  };
});

// ── 3 forecast-dependent KPI cards (slots 3-5 in the KPI row) ───────────────

export async function ForecastKPIs() {
  const { planesNeeded, utilization } = await fetchForecastBundle();

  const underutilizedCount =
    utilization.by_category?.reduce(
      (sum, cat) => sum + (cat.underutilized_count ?? 0),
      0,
    ) || 0;

  const avgUtil = utilization.by_category?.length
    ? Math.round(
        (utilization.by_category.reduce(
          (sum, cat) => sum + (cat.avg_utilization_rate ?? 0),
          0,
        ) /
          utilization.by_category.length) *
          100,
      )
    : 0;

  const shortageCount =
    planesNeeded?.filter((p) => p.status === "shortage").length || 0;
  const shortageHours =
    planesNeeded
      ?.filter((p) => p.status === "shortage")
      .reduce((sum, p) => sum + (p.capacity_gap_hours || 0), 0) || 0;

  return (
    <>
      <KPICard
        label="Fleet Utilization"
        value={`${avgUtil}%`}
        subLabel="average health"
        accent={avgUtil > 70}
      />
      <KPICard
        label="Underutilized"
        value={underutilizedCount}
        subLabel="need repositioning"
        accent={underutilizedCount > 0}
      />
      <KPICard
        label="Shortage Risk"
        value={shortageCount > 0 ? shortageCount : "—"}
        subLabel={
          shortageCount > 0
            ? `${shortageHours.toFixed(1)} hours gap`
            : "next 7 days"
        }
        accent={shortageCount > 0}
      />
    </>
  );
}

// ── Capacity Status + Fleet Health (right column of main grid) ──────────────

export async function ForecastSideCards() {
  const { planesNeeded, utilization } = await fetchForecastBundle();

  const underutilizedCount =
    utilization.by_category?.reduce(
      (sum, cat) => sum + (cat.underutilized_count ?? 0),
      0,
    ) || 0;
  const overconstrained =
    utilization.by_category?.reduce(
      (sum, cat) => sum + (cat.overconstrained_count ?? 0),
      0,
    ) || 0;
  const totalAircraft = utilization.aircraft?.length ?? 0;
  const properlyUtilized = Math.max(
    0,
    totalAircraft - underutilizedCount - overconstrained,
  );

  return (
    <>
      {/* Capacity Status */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-zinc-100">Capacity Status</p>
          <Link
            href="/fleet-forecasting"
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            Details →
          </Link>
        </div>
        <div className="space-y-2">
          {planesNeeded
            ?.filter(
              (p, i, arr) =>
                arr.findIndex(
                  (x) => x.aircraft_category === p.aircraft_category,
                ) === i,
            )
            .slice(0, 3)
            .map((plan, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-xs text-zinc-600">
                  {plan.aircraft_category}
                </span>
                <span
                  className={`text-xs font-semibold ${
                    plan.status === "shortage"
                      ? "text-red-400"
                      : plan.status === "surplus"
                        ? "text-emerald-400"
                        : "text-zinc-400"
                  }`}
                >
                  {plan.status === "shortage" ? "⚠️" : "✓"}{" "}
                  {plan.capacity_gap_aircraft > 0
                    ? `+${plan.capacity_gap_aircraft}`
                    : plan.capacity_gap_aircraft}
                </span>
              </div>
            ))}
        </div>
      </Card>

      {/* Fleet Health */}
      <Card>
        <div className="mb-4">
          <p className="text-sm font-semibold text-zinc-100">Fleet Health</p>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-600">Optimal</span>
            <span className="text-xs font-semibold text-emerald-400">
              {properlyUtilized} aircraft
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{
                width: `${totalAircraft > 0 ? Math.min((properlyUtilized / totalAircraft) * 100, 100) : 0}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-600">Underutilized</span>
            <span className="text-xs font-semibold text-amber-400">
              {underutilizedCount} aircraft
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-amber-400"
              style={{
                width: `${Math.min((underutilizedCount / 10) * 100, 100)}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-zinc-600">Overconstrained</span>
            <span className="text-xs font-semibold text-red-400">
              {overconstrained} aircraft
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-red-400"
              style={{
                width: `${Math.min((overconstrained / 10) * 100, 100)}%`,
              }}
            />
          </div>
        </div>
      </Card>
    </>
  );
}

// ── Top Actions card (bottom row middle slot) ───────────────────────────────

export async function TopActionsCard() {
  const { recommendations } = await fetchForecastBundle();

  return (
    <Card padding={false}>
      <div className="mb-4 flex items-center justify-between px-5 pt-5">
        <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          Top Actions
        </h3>
        <Link
          href="/fleet-forecasting"
          className="text-xs text-emerald-400 hover:text-emerald-300"
        >
          View All →
        </Link>
      </div>
      <div className="space-y-2.5 px-5 pb-5">
        {recommendations.reposition?.slice(0, 2).map((rec, idx) => (
          <div
            key={idx}
            className="rounded-md border border-emerald-900/30 bg-emerald-900/10 p-2.5"
          >
            <p className="text-xs font-semibold text-emerald-400">
              {rec.tail_number ?? rec.aircraft_id}
            </p>
            <p className="mt-0.5 text-xs text-zinc-600">
              → {rec.move_to_airport}
            </p>
          </div>
        ))}
        {(!recommendations.reposition ||
          recommendations.reposition.length === 0) && (
          <p className="text-xs text-zinc-600">No actions right now</p>
        )}
      </div>
    </Card>
  );
}
