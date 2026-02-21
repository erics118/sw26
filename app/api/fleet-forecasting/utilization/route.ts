import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeUtilization } from "@/lib/forecasting/utilization";
import { addDays } from "@/lib/forecasting/utils";

// ─── GET /api/fleet-forecasting/utilization ───────────────────────────────────
// Query params: days (default 30)

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const days = Math.min(
    90,
    Math.max(7, parseInt(searchParams.get("days") ?? "30", 10)),
  );

  const endDate = new Date();
  endDate.setUTCHours(23, 59, 59, 999);
  const startDate = addDays(endDate, -(days - 1));
  startDate.setUTCHours(0, 0, 0, 0);

  const result = await computeUtilization(supabase, startDate, endDate);

  return NextResponse.json({
    ...result,
    period_start: startDate.toISOString().slice(0, 10),
    period_end: endDate.toISOString().slice(0, 10),
  });
}
