"use client";

import { useState, useMemo } from "react";
import type { ForecastSummary } from "@/lib/forecasting/types";
import { TARGET_UTIL_HOURS } from "@/lib/forecasting/types";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { ChevronDown, ChevronUp } from "lucide-react";

type Scenario = "aircraft" | "win_rate";

interface ScenarioPanelProps {
  forecastData: ForecastSummary | null;
}

interface CategoryResult {
  category: string;
  baseShortages: number;
  scenarioShortages: number;
  baseGapHours: number;
  scenarioGapHours: number;
  baseAircraft: number;
  scenarioAircraft: number;
}

const SCENARIOS: { id: Scenario; label: string; description: string }[] = [
  {
    id: "aircraft",
    label: "+1 Aircraft",
    description:
      "Add one aircraft per category — how many shortage days are eliminated?",
  },
  {
    id: "win_rate",
    label: "Deals Close 10% Less Often",
    description:
      "If 10% fewer open quotes convert to bookings, does demand still exceed capacity?",
  },
];

// Inline gap status calculation matching the engine logic
function gapStatus(
  gapHours: number,
  targetHoursPerDay: number,
): "shortage" | "balanced" | "surplus" {
  const threshold = targetHoursPerDay * 0.5;
  if (gapHours > threshold) return "shortage";
  if (gapHours < -threshold) return "surplus";
  return "balanced";
}

export function ScenarioPanel({ forecastData }: ScenarioPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeScenario, setActiveScenario] = useState<Scenario>("aircraft");

  const results: CategoryResult[] = useMemo(() => {
    if (!forecastData) return [];

    const categories = [
      ...new Set(forecastData.planes_needed.map((d) => d.aircraft_category)),
    ];

    return categories.map((cat) => {
      const rows = forecastData.planes_needed.filter(
        (d) => d.aircraft_category === cat,
      );
      const capacityRows = forecastData.capacity.filter(
        (d) => d.aircraft_category === cat,
      );
      const targetHours = TARGET_UTIL_HOURS[cat] ?? 3.0;

      // ── Baseline ──────────────────────────────────────────────────────────────
      const baseShortages = rows.filter((r) => r.status === "shortage").length;
      const baseGapHours = rows.reduce((s, r) => s + r.capacity_gap_hours, 0);
      const baseAircraft =
        capacityRows.length > 0
          ? Math.round(
              capacityRows.reduce((s, r) => s + r.num_active_aircraft, 0) /
                capacityRows.length,
            )
          : 0;

      // ── Scenario computation ──────────────────────────────────────────────────
      let scenarioShortages = 0;
      let scenarioGapHoursTotal = 0;
      let scenarioAircraft = baseAircraft;

      if (activeScenario === "aircraft") {
        // Add one aircraft worth of daily hours to available supply
        scenarioAircraft = baseAircraft + 1;
        rows.forEach((r) => {
          const extraHours = targetHours; // one extra aircraft per day
          const newAvailable = r.available_hours + extraHours;
          const demand =
            r.p80_demand_hours > 0
              ? r.p80_demand_hours
              : r.expected_demand_hours;
          const newGap = demand - newAvailable;
          scenarioGapHoursTotal += newGap;
          if (gapStatus(newGap, targetHours) === "shortage")
            scenarioShortages++;
        });
      } else if (activeScenario === "win_rate") {
        // Drop pipeline_hours by 10% — affects demand if pipeline is the binding constraint
        rows.forEach((r) => {
          const adjustedPipeline = r.pipeline_hours * 0.9;
          // Reduce P80 demand proportionally by the pipeline share
          const pipelineShare =
            r.expected_demand_hours > 0
              ? Math.min(r.pipeline_hours / r.expected_demand_hours, 1)
              : 0;
          const demandReduction =
            (r.pipeline_hours - adjustedPipeline) * pipelineShare;
          const newDemand = Math.max(
            0,
            (r.p80_demand_hours > 0
              ? r.p80_demand_hours
              : r.expected_demand_hours) - demandReduction,
          );
          const newGap = newDemand - r.available_hours;
          scenarioGapHoursTotal += newGap;
          if (gapStatus(newGap, targetHours) === "shortage")
            scenarioShortages++;
        });
        scenarioAircraft = baseAircraft;
      }

      return {
        category: cat,
        baseShortages,
        scenarioShortages,
        baseGapHours: Math.round(baseGapHours * 10) / 10,
        scenarioGapHours: Math.round(scenarioGapHoursTotal * 10) / 10,
        baseAircraft,
        scenarioAircraft,
      };
    });
  }, [forecastData, activeScenario]);

  const totalBaseShortages = results.reduce((s, r) => s + r.baseShortages, 0);
  const totalScenarioShortages = results.reduce(
    (s, r) => s + r.scenarioShortages,
    0,
  );
  const shortagesDelta = totalScenarioShortages - totalBaseShortages;

  if (!forecastData) return null;

  return (
    <Card>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-zinc-300">
            Scenario Planning
          </h2>
          <p className="mt-0.5 text-xs text-zinc-600">
            What-if simulations on current forecast data
          </p>
        </div>
        <div className="flex items-center gap-3">
          {open && shortagesDelta !== 0 && (
            <Badge variant={shortagesDelta < 0 ? "green" : "red"}>
              {shortagesDelta > 0 ? "+" : ""}
              {shortagesDelta} shortage days
            </Badge>
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-5 pt-4 pb-5">
          {/* Scenario selector */}
          <div className="mb-5 flex gap-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveScenario(s.id)}
                className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  activeScenario === s.id
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                }`}
              >
                <p className="font-medium">{s.label}</p>
                <p className="mt-0.5 leading-tight text-zinc-600">
                  {s.description}
                </p>
              </button>
            ))}
          </div>

          {/* Summary delta */}
          <div className="mb-4 flex items-center gap-6 rounded-md border border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <div>
              <p className="text-[10px] tracking-widest text-zinc-600 uppercase">
                Baseline shortage days
              </p>
              <p className="tabnum mt-0.5 text-xl font-bold text-zinc-100">
                {totalBaseShortages}
              </p>
            </div>
            <div className="text-zinc-700">→</div>
            <div>
              <p className="text-[10px] tracking-widest text-zinc-600 uppercase">
                Scenario shortage days
              </p>
              <p
                className={`tabnum mt-0.5 text-xl font-bold ${
                  totalScenarioShortages < totalBaseShortages
                    ? "text-emerald-400"
                    : totalScenarioShortages > totalBaseShortages
                      ? "text-red-400"
                      : "text-zinc-100"
                }`}
              >
                {totalScenarioShortages}
              </p>
            </div>
            {shortagesDelta !== 0 && (
              <div className="ml-auto">
                <Badge variant={shortagesDelta < 0 ? "green" : "red"}>
                  {shortagesDelta > 0 ? "+" : ""}
                  {shortagesDelta} days
                </Badge>
              </div>
            )}
          </div>

          {/* Per-category breakdown */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="py-2 text-left font-semibold tracking-widest text-zinc-600 uppercase">
                  Category
                </th>
                <th className="py-2 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                  {activeScenario === "aircraft" ? "Aircraft" : "Shortage days"}{" "}
                  — Base
                </th>
                <th className="py-2 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                  {activeScenario === "aircraft" ? "Aircraft" : "Shortage days"}{" "}
                  — Scenario
                </th>
                <th className="py-2 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                  Gap hrs — Base
                </th>
                <th className="py-2 text-right font-semibold tracking-widest text-zinc-600 uppercase">
                  Gap hrs — Scenario
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const primaryBase =
                  activeScenario === "aircraft"
                    ? r.baseAircraft
                    : r.baseShortages;
                const primaryScenario =
                  activeScenario === "aircraft"
                    ? r.scenarioAircraft
                    : r.scenarioShortages;
                const gapDelta = r.scenarioGapHours - r.baseGapHours;
                return (
                  <tr key={r.category} className="border-b border-zinc-800/50">
                    <td className="py-2 text-zinc-300 capitalize">
                      {r.category}
                    </td>
                    <td className="tabnum py-2 text-right text-zinc-400">
                      {primaryBase}
                    </td>
                    <td
                      className={`tabnum py-2 text-right font-medium ${
                        primaryScenario < primaryBase
                          ? "text-emerald-400"
                          : primaryScenario > primaryBase
                            ? "text-red-400"
                            : "text-zinc-400"
                      }`}
                    >
                      {primaryScenario}
                      {primaryScenario !== primaryBase && (
                        <span className="ml-1 text-zinc-600">
                          ({primaryScenario > primaryBase ? "+" : ""}
                          {primaryScenario - primaryBase})
                        </span>
                      )}
                    </td>
                    <td className="tabnum py-2 text-right text-zinc-400">
                      {r.baseGapHours > 0
                        ? `+${r.baseGapHours}h`
                        : `${r.baseGapHours}h`}
                    </td>
                    <td
                      className={`tabnum py-2 text-right font-medium ${
                        gapDelta < 0
                          ? "text-emerald-400"
                          : gapDelta > 0
                            ? "text-red-400"
                            : "text-zinc-400"
                      }`}
                    >
                      {r.scenarioGapHours > 0
                        ? `+${r.scenarioGapHours}h`
                        : `${r.scenarioGapHours}h`}
                      {gapDelta !== 0 && (
                        <span className="ml-1 text-zinc-600">
                          ({gapDelta > 0 ? "+" : ""}
                          {Math.round(gapDelta * 10) / 10}h)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="mt-3 text-[10px] text-zinc-700">
            Simulations run client-side on current forecast data. P80 used for
            gap calculations.
            {activeScenario === "win_rate" &&
              forecastData.pipeline.length === 0 && (
                <span className="ml-1 text-amber-600">
                  No open pipeline quotes — win rate impact will be minimal
                  until quotes enter the pipeline.
                </span>
              )}
          </p>
        </div>
      )}
    </Card>
  );
}
