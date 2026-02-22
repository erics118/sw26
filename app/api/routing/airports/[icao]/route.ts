import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AirportUpsertSchema } from "@/lib/schemas";

interface RouteParams {
  params: Promise<{ icao: string }>;
}

// ─── PATCH /api/routing/airports/[icao] ───────────────────────────────────────
// Partial update for an airport record. Ops team use.
// Only the provided fields are updated; omitted fields are unchanged.

export async function PATCH(request: Request, { params }: RouteParams) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { icao } = await params;
  const icaoUpper = icao.toUpperCase();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate against the upsert schema (all fields optional for a patch)
  const parsed = AirportUpsertSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("airports")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("icao", icaoUpper)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json(
        { error: `Airport ${icaoUpper} not found` },
        { status: 404 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// ─── GET /api/routing/airports/[icao] ─────────────────────────────────────────
// Single airport lookup by ICAO.

export async function GET(_request: Request, { params }: RouteParams) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { icao } = await params;

  const { data, error } = await supabase
    .from("airports")
    .select("*")
    .eq("icao", icao.toUpperCase())
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: `Airport ${icao.toUpperCase()} not found` },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
