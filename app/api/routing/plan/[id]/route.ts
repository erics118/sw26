import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── GET /api/routing/plan/[id] ───────────────────────────────────────────────
// Returns a persisted route_plans row by ID.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();

  const { id } = await params;

  const { data, error } = await supabase
    .from("route_plans")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Route plan not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
