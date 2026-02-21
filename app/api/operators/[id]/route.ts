import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateOperatorSchema } from "@/lib/schemas";
import type { Operator } from "@/lib/database.types";

const UpdateOperatorSchema = CreateOperatorSchema.partial();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const [operatorRes, aircraftRes, crewRes] = await Promise.all([
    supabase.from("operators").select("*").eq("id", id).single(),
    supabase
      .from("aircraft")
      .select("id, tail_number, category")
      .eq("operator_id", id),
    supabase
      .from("crew")
      .select("id, name, role, duty_hours_this_week")
      .eq("operator_id", id),
  ]);

  if (operatorRes.error || !operatorRes.data) {
    return NextResponse.json({ error: "Operator not found" }, { status: 404 });
  }

  const operator = operatorRes.data as Operator;
  return NextResponse.json({
    ...operator,
    aircraft: aircraftRes.data ?? [],
    crew: crewRes.data ?? [],
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateOperatorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("operators")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data as Operator);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("operators").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
