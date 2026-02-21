import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type OptimizationMode = "cost" | "balanced" | "time";

export interface PlanSummary {
  mode: OptimizationMode;
  total_routing_cost_usd: number;
  total_flight_time_hr: number;
  risk_score: number;
  on_time_probability: number;
  refuel_stops_count: number;
}

export interface RouteRecommendation {
  mode: OptimizationMode;
  explanation: string;
  comparisons: Record<OptimizationMode, string>;
}

export async function getRouteRecommendation(
  plans: PlanSummary[],
  tripNotes?: string | null,
): Promise<RouteRecommendation> {
  const payload = {
    plans: plans.map((p) => ({
      mode: p.mode,
      cost_usd: p.total_routing_cost_usd,
      flight_time_hr: p.total_flight_time_hr,
      risk_score: p.risk_score,
      on_time_pct: Math.round(p.on_time_probability * 100),
      fuel_stops: p.refuel_stops_count,
    })),
    trip_notes: tripNotes ?? null,
  };

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `You are an aviation charter operations advisor. Compare three route plan options (cost, balanced, time) and recommend the best one for the trip.
Your response must be valid JSON with this structure:
{
  "mode": "cost" | "balanced" | "time",
  "explanation": "1-2 sentence explanation of why this option is recommended",
  "comparisons": {
    "cost": "1 sentence: when to choose this (e.g. 'Lowest fuel cost; add X min vs balanced')",
    "balanced": "1 sentence: when to choose this",
    "time": "1 sentence: when to choose this"
  }
}
Consider: cost savings vs time savings, risk score, fuel stops. If trip_notes mention "budget" or "cost-sensitive" lean toward cost. If "urgent" or "time-sensitive" lean toward time. Otherwise balanced is often best.
Return ONLY valid JSON. No markdown.`,
    messages: [
      {
        role: "user",
        content: `Compare these route options:\n\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
  });

  const raw =
    message.content[0]?.type === "text" ? message.content[0].text : "{}";
  try {
    const parsed = JSON.parse(
      raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim(),
    ) as RouteRecommendation;
    // Ensure all three comparisons exist
    const modes: OptimizationMode[] = ["cost", "balanced", "time"];
    for (const m of modes) {
      if (!parsed.comparisons?.[m]) {
        parsed.comparisons = parsed.comparisons ?? {};
        parsed.comparisons[m] = `${m}-optimized option`;
      }
    }
    return parsed;
  } catch {
    return {
      mode: "balanced",
      explanation: "Balanced offers the best trade-off between cost and time.",
      comparisons: {
        cost: "Lowest fuel cost; may add flight time.",
        balanced: "Best trade-off between cost and time.",
        time: "Fastest route; may cost more.",
      },
    };
  }
}
