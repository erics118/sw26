import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeCapacity } from "@/lib/forecasting/capacity";
import {
  computeExpectedDemand,
  computePipelineDemand,
} from "@/lib/forecasting/demand";
import { computePlanesNeeded } from "@/lib/forecasting/planes-needed";
import { addDays } from "@/lib/forecasting/utils";
import type { ForecastSummary } from "@/lib/forecasting/types";

// ─── GET /api/fleet-forecasting/forecast ──────────────────────────────────────
// Query params: days (7|30|90), category (optional)

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const days = Math.min(
    90,
    Math.max(7, parseInt(searchParams.get("days") ?? "7", 10)),
  );
  const category = searchParams.get("category") ?? undefined;

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  const endDate = addDays(startDate, days - 1);

  const [capacity, demand, pipeline] = await Promise.all([
    computeCapacity(supabase, startDate, endDate, category),
    computeExpectedDemand(supabase, startDate, endDate, category),
    computePipelineDemand(supabase, startDate, endDate, category),
  ]);

  const planesNeeded = computePlanesNeeded(capacity, demand, pipeline);

  const summary: ForecastSummary = {
    capacity,
    demand,
    pipeline,
    planes_needed: planesNeeded,
    horizon_days: days,
    generated_at: new Date().toISOString(),
  };

  return NextResponse.json(summary);
}
