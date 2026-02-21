import Anthropic from "@anthropic-ai/sdk";
import type {
  ForecastSummary,
  UtilizationSummary,
  RecommendationSummary,
  ForecastAccuracy,
  DelayReasonBreakdown,
} from "@/lib/forecasting/types";

const MODEL = "claude-sonnet-4-6";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface ForecastInsight {
  summary: string;
  actions: string[];
  confidence: "high" | "medium" | "low";
}

// ─── Fleet Forecast Insight ───────────────────────────────────────────────────

export async function generateForecastInsight(
  forecastData: ForecastSummary,
): Promise<ForecastInsight> {
  // Build a concise data summary to send to Claude
  const shortages = forecastData.planes_needed.filter(
    (p) => p.status === "shortage",
  );
  const surpluses = forecastData.planes_needed.filter(
    (p) => p.status === "surplus",
  );

  // Category-level summary
  const catSummary: Record<
    string,
    { demand: number; supply: number; gap: number }
  > = {};
  for (const p of forecastData.planes_needed) {
    if (!catSummary[p.aircraft_category]) {
      catSummary[p.aircraft_category] = { demand: 0, supply: 0, gap: 0 };
    }
    const entry = catSummary[p.aircraft_category];
    if (entry) {
      entry.demand += p.expected_demand_hours;
      entry.supply += p.available_hours;
      entry.gap += p.capacity_gap_hours;
    }
  }

  const dataPayload = {
    horizon_days: forecastData.horizon_days,
    shortages: shortages.map((s) => ({
      date: s.date,
      category: s.aircraft_category,
      gap_hours: s.capacity_gap_hours,
      gap_aircraft: s.capacity_gap_aircraft,
    })),
    surpluses: surpluses.map((s) => ({
      date: s.date,
      category: s.aircraft_category,
      surplus_hours: Math.abs(s.capacity_gap_hours),
    })),
    category_totals: catSummary,
  };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `You are a fleet operations analyst for a Part 135 charter aviation company.
Analyze fleet forecast data and provide a concise, actionable briefing for dispatch and sales teams.
Your response must be valid JSON with this structure:
{
  "summary": "2-3 sentence plain English summary of the forecast outlook",
  "actions": ["Action 1 (specific and actionable)", "Action 2", "Action 3"],
  "confidence": "high" | "medium" | "low"
}
Be specific: mention aircraft categories, dates, and numbers. No markdown. Return ONLY valid JSON.`,
    messages: [
      {
        role: "user",
        content: `Analyze this ${forecastData.horizon_days}-day fleet forecast data and provide a briefing:\n\n${JSON.stringify(dataPayload, null, 2)}`,
      },
    ],
  });

  const raw =
    message.content[0]?.type === "text" ? message.content[0].text : "{}";
  try {
    return JSON.parse(
      raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim(),
    ) as ForecastInsight;
  } catch {
    return {
      summary: "Forecast data processed. Review charts for detailed breakdown.",
      actions: [
        "Review capacity gaps by category",
        "Check upcoming confirmed flights",
        "Update peak multipliers if needed",
      ],
      confidence: "medium",
    };
  }
}

// ─── Utilization Insight ──────────────────────────────────────────────────────

export async function generateUtilizationInsight(
  utilizationData: UtilizationSummary,
  recommendations: RecommendationSummary,
): Promise<ForecastInsight> {
  const underutilized = utilizationData.aircraft.filter((a) =>
    a.flags.includes("underutilized"),
  );
  const inefficient = utilizationData.aircraft.filter((a) =>
    a.flags.includes("inefficient"),
  );

  const dataPayload = {
    period: `${utilizationData.period_start} to ${utilizationData.period_end}`,
    total_aircraft: utilizationData.aircraft.length,
    underutilized_count: underutilized.length,
    inefficient_count: inefficient.length,
    worst_aircraft: underutilized.slice(0, 3).map((a) => ({
      tail: a.tail_number,
      category: a.category,
      utilization_pct: (a.utilization_rate * 100).toFixed(1) + "%",
      idle_days: a.idle_days,
    })),
    by_category: utilizationData.by_category.map((c) => ({
      category: c.aircraft_category,
      avg_util_pct: (c.avg_utilization_rate * 100).toFixed(1) + "%",
      underutilized: c.underutilized_count,
      total: c.total_aircraft,
    })),
    top_reposition_recs: recommendations.reposition.slice(0, 3).map((r) => ({
      tail: r.tail_number,
      from: r.move_from_airport,
      to: r.move_to_airport,
      gain_hours: r.expected_utilization_gain.toFixed(1),
    })),
  };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `You are a fleet utilization analyst for a Part 135 charter company.
Analyze underutilization data and provide prioritized recommendations.
Return ONLY valid JSON:
{
  "summary": "2-3 sentence assessment of fleet utilization health",
  "actions": ["Specific action 1 (include tail numbers/airports)", "Action 2", "Action 3"],
  "confidence": "high" | "medium" | "low"
}
Focus on highest-impact actions. Mention specific aircraft and airports.`,
    messages: [
      {
        role: "user",
        content: `Analyze this fleet utilization data and suggest prioritized actions:\n\n${JSON.stringify(dataPayload, null, 2)}`,
      },
    ],
  });

  const raw =
    message.content[0]?.type === "text" ? message.content[0].text : "{}";
  try {
    return JSON.parse(
      raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim(),
    ) as ForecastInsight;
  } catch {
    return {
      summary: `${underutilized.length} aircraft flagged as underutilized. Review reposition recommendations.`,
      actions: [
        "Execute top reposition recommendations",
        "Schedule maintenance during low-demand windows",
      ],
      confidence: "medium",
    };
  }
}

// ─── Post-Flight Learning Insight ────────────────────────────────────────────

export async function generateLearningInsight(
  accuracy: ForecastAccuracy[],
  delayReasons: DelayReasonBreakdown[],
): Promise<ForecastInsight> {
  const dataPayload = {
    forecast_accuracy: accuracy.map((a) => ({
      category: a.aircraft_category,
      error_pct: a.error_pct.toFixed(1) + "%",
      predicted: a.predicted_hours.toFixed(1),
      actual: a.actual_hours.toFixed(1),
    })),
    top_delay_reasons: delayReasons.slice(0, 5).map((d) => ({
      reason: d.reason_code,
      count: d.count,
      hours_lost: d.total_hours_lost.toFixed(1),
    })),
    overall_accuracy:
      accuracy.length > 0
        ? (
            accuracy.reduce((sum, a) => sum + Math.abs(a.error_pct), 0) /
            accuracy.length
          ).toFixed(1) + "% avg error"
        : "no data",
  };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `You are a data analyst for a Part 135 charter company improving forecast accuracy.
Analyze forecast errors and delay patterns to suggest model improvements.
Return ONLY valid JSON:
{
  "summary": "2-3 sentence assessment of model accuracy and key issues",
  "actions": ["Specific model improvement action", "Operational improvement", "Data collection suggestion"],
  "confidence": "high" | "medium" | "low"
}
Be specific about which categories are over/under-forecast and why.`,
    messages: [
      {
        role: "user",
        content: `Analyze this forecast accuracy and delay data to suggest improvements:\n\n${JSON.stringify(dataPayload, null, 2)}`,
      },
    ],
  });

  const raw =
    message.content[0]?.type === "text" ? message.content[0].text : "{}";
  try {
    return JSON.parse(
      raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim(),
    ) as ForecastInsight;
  } catch {
    return {
      summary:
        "Forecast model is running. More flight data will improve accuracy over time.",
      actions: [
        "Log actual hours for all completed flights",
        "Review day-of-week multipliers monthly",
        "Add peak-day overrides for known events",
      ],
      confidence: "low",
    };
  }
}
