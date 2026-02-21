import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateMaintenanceSchema = z.object({
  aircraft_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  maintenance_type: z
    .enum(["scheduled", "unscheduled", "inspection", "overhaul"])
    .default("scheduled"),
  notes: z.string().optional(),
});

// ─── GET /api/fleet-forecasting/maintenance ───────────────────────────────────

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const aircraftId = searchParams.get("aircraft_id");

  let query = supabase
    .from("aircraft_maintenance")
    .select("*, aircraft(tail_number, category)")
    .order("start_time", { ascending: true });

  if (aircraftId) query = query.eq("aircraft_id", aircraftId);

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── POST /api/fleet-forecasting/maintenance ──────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient();
  const body: unknown = await request.json();

  const parsed = CreateMaintenanceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  if (new Date(input.end_time) <= new Date(input.start_time)) {
    return NextResponse.json(
      { error: "end_time must be after start_time" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("aircraft_maintenance")
    .insert(input)
    .select()
    .single();

  if (error || !data)
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    );

  await supabase.from("audit_logs").insert({
    action: "aircraft_maintenance.created",
    entity_type: "aircraft_maintenance",
    entity_id: (data as { id: string }).id,
    ai_generated: false,
    human_verified: true,
    payload: {
      aircraft_id: input.aircraft_id,
      start_time: input.start_time,
      end_time: input.end_time,
    },
  });

  return NextResponse.json(data, { status: 201 });
}
