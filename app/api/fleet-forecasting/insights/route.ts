import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateForecastInsight,
  generateUtilizationInsight,
  generateLearningInsight,
} from "@/lib/ai/forecasting";
import { computeCapacity } from "@/lib/forecasting/capacity";
import { computeExpectedDemand } from "@/lib/forecasting/demand";
import { computePlanesNeeded } from "@/lib/forecasting/planes-needed";
import { computeUtilization } from "@/lib/forecasting/utilization";
import { generateRecommendations } from "@/lib/forecasting/actions";
import { addDays } from "@/lib/forecasting/utils";
import type {
  ForecastAccuracy,
  DelayReasonBreakdown,
  ForecastSummary,
  UtilizationSummary,
  RecommendationSummary,
  WinRateCalibration,
} from "@/lib/forecasting/types";

// Win probability priors by quote stage (must match demand.ts)
const STAGE_PRIORS: Record<string, number> = {
  pending: 0.2,
  quoted: 0.4,
  negotiating: 0.65,
  verbally_confirmed: 0.85,
};

// ─── POST /api/fleet-forecasting/insights ────────────────────────────────────
// Body: { tab: "forecast" | "utilization" | "learning", days?: number, horizon?: 7 | 30 | 90 }

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json()) as {
    tab: string;
    days?: number;
    horizon?: 7 | 30 | 90;
  };
  const { tab, days = 7 } = body;

  // ─── Forecast tab ──────────────────────────────────────────────────────────

  if (tab === "forecast") {
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = addDays(startDate, days - 1);

    const [capacity, demand] = await Promise.all([
      computeCapacity(supabase, startDate, endDate),
      computeExpectedDemand(supabase, startDate, endDate),
    ]);
    const planesNeeded = computePlanesNeeded(capacity, demand);

    const forecastData: ForecastSummary = {
      capacity,
      demand,
      pipeline: [],
      planes_needed: planesNeeded,
      horizon_days: days,
      generated_at: new Date().toISOString(),
    };

    const insight = await generateForecastInsight(forecastData, supabase);

    await supabase.from("audit_logs").insert({
      action: "fleet_forecast.insight_generated",
      entity_type: "fleet_forecast",
      ai_generated: true,
      ai_model: "claude-sonnet-4-6",
      payload: { tab, days, confidence: insight.confidence },
    });

    return NextResponse.json(insight);
  }

  // ─── Utilization tab ───────────────────────────────────────────────────────

  if (tab === "utilization") {
    const endDate = new Date();
    endDate.setUTCHours(23, 59, 59, 999);
    const startDate = addDays(endDate, -29);
    startDate.setUTCHours(0, 0, 0, 0);

    const forecastStart = new Date();
    forecastStart.setUTCHours(0, 0, 0, 0);
    const forecastEnd = addDays(forecastStart, 6);

    const [utilResult, demand] = await Promise.all([
      computeUtilization(supabase, startDate, endDate),
      computeExpectedDemand(supabase, forecastStart, forecastEnd),
    ]);

    const recs = await generateRecommendations(
      supabase,
      utilResult.aircraft,
      demand,
    );

    const utilizationData: UtilizationSummary = {
      ...utilResult,
      period_start: startDate.toISOString().slice(0, 10),
      period_end: endDate.toISOString().slice(0, 10),
    };
    const recsData: RecommendationSummary = {
      ...recs,
      generated_at: new Date().toISOString(),
    };

    const insight = await generateUtilizationInsight(
      utilizationData,
      recsData,
      supabase,
    );

    await supabase.from("audit_logs").insert({
      action: "fleet_utilization.insight_generated",
      entity_type: "fleet_forecast",
      ai_generated: true,
      ai_model: "claude-sonnet-4-6",
      payload: { tab, confidence: insight.confidence },
    });

    return NextResponse.json(insight);
  }

  // ─── Learning tab ──────────────────────────────────────────────────────────

  if (tab === "learning") {
    const horizonDays = (body.horizon ?? 90) as 7 | 30 | 90;
    const histEnd = new Date();
    const histStart = addDays(histEnd, -horizonDays);

    // ── Actuals from completed quotes ────────────────────────────────────────
    const { data: completedQuotes } = await supabase
      .from("quotes")
      .select(
        "chosen_aircraft_category, actual_total_hours, actual_departure_time, delay_reason_code, scheduled_total_hours",
      )
      .eq("status", "completed")
      .not("actual_total_hours", "is", null)
      .gte("actual_departure_time", histStart.toISOString());

    const catActuals: Record<string, { total: number; count: number }> = {};
    const delayCounts: Record<string, { count: number; hours: number }> = {};

    for (const q of completedQuotes ?? []) {
      const cat = q.chosen_aircraft_category ?? "unknown";
      if (!catActuals[cat]) catActuals[cat] = { total: 0, count: 0 };
      (catActuals[cat] as { total: number; count: number }).total += Number(
        q.actual_total_hours ?? 0,
      );
      (catActuals[cat] as { total: number; count: number }).count += 1;

      if (q.delay_reason_code) {
        if (!delayCounts[q.delay_reason_code])
          delayCounts[q.delay_reason_code] = { count: 0, hours: 0 };
        (
          delayCounts[q.delay_reason_code] as { count: number; hours: number }
        ).count += 1;
        (
          delayCounts[q.delay_reason_code] as { count: number; hours: number }
        ).hours += Number(q.actual_total_hours ?? 0);
      }
    }

    // ── Predicted hours for the same past window ─────────────────────────────
    const forecastDemand = await computeExpectedDemand(
      supabase,
      histStart,
      histEnd,
    );
    const predictedByCategory: Record<string, number> = {};
    for (const d of forecastDemand) {
      predictedByCategory[d.aircraft_category] =
        (predictedByCategory[d.aircraft_category] ?? 0) +
        d.expected_total_hours;
    }

    // ── Build accuracy rows with signed error + error_driver ─────────────────
    const accuracy: ForecastAccuracy[] = Object.entries(catActuals).map(
      ([cat, v]) => {
        const predicted = predictedByCategory[cat] ?? 0;
        // signed: positive = over-forecast (predicted > actual)
        const signedErrorPct =
          predicted > 0 ? ((predicted - v.total) / predicted) * 100 : 0;

        // Simple heuristic driver classification
        let errorDriver: ForecastAccuracy["error_driver"] = "demand_shift";
        if (Math.abs(signedErrorPct) < 5) {
          errorDriver = undefined; // accurate — no driver needed
        } else if (signedErrorPct > 20) {
          // We forecast too high — likely win rate lower than expected
          errorDriver = "win_rate_shift";
        } else if (signedErrorPct < -20) {
          // We forecast too low — demand higher than expected
          errorDriver = "demand_shift";
        }

        return {
          aircraft_category: cat,
          period_start: histStart.toISOString().slice(0, 10),
          period_end: histEnd.toISOString().slice(0, 10),
          predicted_hours: Math.round(predicted * 10) / 10,
          actual_hours: Math.round(v.total * 10) / 10,
          signed_error_pct: Math.round(signedErrorPct * 10) / 10,
          error_pct: Math.round(Math.abs(signedErrorPct) * 10) / 10,
          horizon_days: horizonDays,
          error_driver: errorDriver,
          num_flights: v.count,
        };
      },
    );

    const delayReasons: DelayReasonBreakdown[] = Object.entries(delayCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([code, v]) => ({
        reason_code: code,
        count: v.count,
        total_hours_lost: Math.round(v.hours * 10) / 10,
      }));

    // ── Win-rate calibration ─────────────────────────────────────────────────
    // Pull resolved quotes (completed = won, cancelled/rejected = lost) from last 180 days
    const calibStart = addDays(histEnd, -180);
    const { data: resolvedQuotes } = await supabase
      .from("quotes")
      .select("status")
      .in("status", ["completed", "confirmed", "cancelled", "rejected"])
      .gte("created_at", calibStart.toISOString());

    const stageTotals: Record<string, { won: number; total: number }> = {};
    for (const q of resolvedQuotes ?? []) {
      // Map final status back to the pipeline stage it likely passed through.
      // completed/confirmed = won; cancelled/rejected = lost.
      // We use the final status as a proxy since we don't store stage history.
      const stage =
        q.status === "completed" || q.status === "confirmed"
          ? "completed"
          : "lost";
      // Attribute the win/loss to the "quoted" stage (the one all pipeline quotes pass through)
      if (!stageTotals["quoted"]) stageTotals["quoted"] = { won: 0, total: 0 };
      (stageTotals["quoted"] as { won: number; total: number }).total += 1;
      if (stage === "completed")
        (stageTotals["quoted"] as { won: number; total: number }).won += 1;
    }

    // Also count currently-open quotes per stage for sample display
    const { data: openQuotes } = await supabase
      .from("quotes")
      .select("status")
      .in("status", Object.keys(STAGE_PRIORS));

    const openByStage: Record<string, number> = {};
    for (const q of openQuotes ?? []) {
      openByStage[q.status] = (openByStage[q.status] ?? 0) + 1;
    }

    const winRateCalibration: WinRateCalibration[] = Object.entries(
      STAGE_PRIORS,
    ).map(([stage, predicted]) => {
      const resolved = stageTotals[stage];
      const sampleSize = (resolved?.total ?? 0) + (openByStage[stage] ?? 0);
      const actualRate =
        resolved && resolved.total >= 5
          ? Math.round((resolved.won / resolved.total) * 1000) / 1000
          : null;
      return {
        stage,
        predicted_rate: predicted,
        actual_rate: actualRate,
        sample_size: sampleSize,
        drift: actualRate !== null ? actualRate - predicted : null,
      };
    });

    const insight = await generateLearningInsight(
      accuracy,
      delayReasons,
      supabase,
    );

    await supabase.from("audit_logs").insert({
      action: "fleet_learning.insight_generated",
      entity_type: "fleet_forecast",
      ai_generated: true,
      ai_model: "claude-sonnet-4-6",
      payload: { tab, horizon: horizonDays, confidence: insight.confidence },
    });

    return NextResponse.json({
      insight,
      accuracy,
      delay_reasons: delayReasons,
      win_rate_calibration: winRateCalibration,
      horizon_days: horizonDays,
    });
  }

  return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
}
