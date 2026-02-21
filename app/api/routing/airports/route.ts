import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AirportUpsertSchema } from "@/lib/schemas";

// ─── GET /api/routing/airports ────────────────────────────────────────────────
// Query params:
//   ?icao=KJFK            — single airport lookup
//   ?has_fuel=true        — filter to airports with Jet-A
//   ?min_runway=4000      — filter by minimum runway length

export async function GET(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const icao = searchParams.get("icao");
  const hasFuel = searchParams.get("has_fuel");
  const minRunway = searchParams.get("min_runway");

  let query = supabase.from("airports").select("*").order("icao");

  if (icao) {
    query = query.eq("icao", icao.toUpperCase());
  }
  if (hasFuel === "true") {
    query = query.eq("fuel_jet_a", true);
  }
  if (minRunway) {
    const minRwy = parseInt(minRunway, 10);
    if (!isNaN(minRwy)) query = query.gte("longest_runway_ft", minRwy);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(icao ? (data?.[0] ?? null) : data);
}

// ─── POST /api/routing/airports ───────────────────────────────────────────────
// Creates a new airport record. Ops team use.

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AirportUpsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("airports")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error: `Airport ${parsed.data.icao} already exists. Use PATCH to update.`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
