import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  aircraft_category: z.string(),
  peak_multiplier: z.number().min(0.1).max(5.0),
  reason: z.string().optional(),
});

// ─── GET /api/fleet-forecasting/overrides ────────────────────────────────────

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("fleet_forecast_overrides")
    .select("*")
    .order("date", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── POST /api/fleet-forecasting/overrides ───────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const body: unknown = await request.json();

  const parsed = CreateOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("fleet_forecast_overrides")
    .upsert(parsed.data, { onConflict: "date,aircraft_category" })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
