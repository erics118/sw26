import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeUtilization } from "@/lib/forecasting/utilization";
import { computeExpectedDemand } from "@/lib/forecasting/demand";
import { generateRecommendations } from "@/lib/forecasting/actions";
import { addDays } from "@/lib/forecasting/utils";

// ─── GET /api/fleet-forecasting/recommendations ───────────────────────────────
// Query params: horizon (days, default 7)

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const horizon = Math.min(
    30,
    Math.max(3, parseInt(searchParams.get("horizon") ?? "7", 10)),
  );

  // Past 30 days for utilization
  const endDate = new Date();
  endDate.setUTCHours(23, 59, 59, 999);
  const startDate = addDays(endDate, -29);
  startDate.setUTCHours(0, 0, 0, 0);

  // Future horizon for demand forecast
  const forecastStart = new Date();
  forecastStart.setUTCHours(0, 0, 0, 0);
  const forecastEnd = addDays(forecastStart, horizon - 1);

  const [{ aircraft: underutilized }, demand] = await Promise.all([
    computeUtilization(supabase, startDate, endDate),
    computeExpectedDemand(supabase, forecastStart, forecastEnd),
  ]);

  const recommendations = await generateRecommendations(
    supabase,
    underutilized,
    demand,
    horizon,
  );

  return NextResponse.json({
    ...recommendations,
    generated_at: new Date().toISOString(),
  });
}
