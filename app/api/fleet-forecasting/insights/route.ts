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
} from "@/lib/forecasting/types";

// ─── POST /api/fleet-forecasting/insights ────────────────────────────────────
// Body: { tab: "forecast" | "utilization" | "learning", days?: number }

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = (await request.json()) as { tab: string; days?: number };
  const { tab, days = 7 } = body;

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
      planes_needed: planesNeeded,
      horizon_days: days,
      generated_at: new Date().toISOString(),
    };

    const insight = await generateForecastInsight(forecastData);

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "fleet_forecast.insight_generated",
      entity_type: "fleet_forecast",
      ai_generated: true,
      ai_model: "claude-sonnet-4-6",
      payload: { tab, days, confidence: insight.confidence },
    });

    return NextResponse.json(insight);
  }

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

    const insight = await generateUtilizationInsight(utilizationData, recsData);

    await supabase.from("audit_logs").insert({
      action: "fleet_utilization.insight_generated",
      entity_type: "fleet_forecast",
      ai_generated: true,
      ai_model: "claude-sonnet-4-6",
      payload: { tab, confidence: insight.confidence },
    });

    return NextResponse.json(insight);
  }

  if (tab === "learning") {
    // Compute forecast accuracy by comparing predicted vs actual
    const histEnd = new Date();
    const histStart = addDays(histEnd, -90);

    const { data: completedQuotes } = await supabase
      .from("quotes")
      .select(
        "chosen_aircraft_category, actual_total_hours, actual_departure_time, delay_reason_code",
      )
      .eq("status", "completed")
      .not("actual_total_hours", "is", null)
      .gte("actual_departure_time", histStart.toISOString());

    // Group actuals by category
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
        if (!delayCounts[q.delay_reason_code]) {
          delayCounts[q.delay_reason_code] = { count: 0, hours: 0 };
        }
        (
          delayCounts[q.delay_reason_code] as { count: number; hours: number }
        ).count += 1;
        (
          delayCounts[q.delay_reason_code] as { count: number; hours: number }
        ).hours += Number(q.actual_total_hours ?? 0);
      }
    }

    // Compute predicted using same forecast model for the past period
    const forecastDemand = await computeExpectedDemand(
      supabase,
      histStart,
      histEnd,
    );
    const predictedByCategory: Record<string, number> = {};
    for (const d of forecastDemand) {
      const cat = d.aircraft_category;
      predictedByCategory[cat] =
        (predictedByCategory[cat] ?? 0) + d.expected_total_hours;
    }

    const accuracy: ForecastAccuracy[] = Object.entries(catActuals).map(
      ([cat, v]) => {
        const predicted = predictedByCategory[cat] ?? 0;
        const errorPct =
          predicted > 0 ? ((v.total - predicted) / predicted) * 100 : 0;
        return {
          aircraft_category: cat,
          period_start: histStart.toISOString().slice(0, 10),
          period_end: histEnd.toISOString().slice(0, 10),
          predicted_hours: Math.round(predicted * 10) / 10,
          actual_hours: Math.round(v.total * 10) / 10,
          error_pct: Math.round(errorPct * 10) / 10,
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

    const insight = await generateLearningInsight(accuracy, delayReasons);

    await supabase.from("audit_logs").insert({
      action: "fleet_learning.insight_generated",
      entity_type: "fleet_forecast",
      ai_generated: true,
      ai_model: "claude-sonnet-4-6",
      payload: { tab, confidence: insight.confidence },
    });

    return NextResponse.json({
      insight,
      accuracy,
      delay_reasons: delayReasons,
    });
  }

  return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
}
