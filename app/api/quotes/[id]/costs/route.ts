import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();
  const body: unknown = await request.json();

  if (
    typeof body !== "object" ||
    body === null ||
    !("fuel_cost" in body) ||
    !("fbo_fees" in body)
  ) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const costs = body as Record<string, unknown>;

  try {
    // First check if quote_costs exists
    const { data: existingCosts } = await supabase
      .from("quote_costs")
      .select("id")
      .eq("quote_id", id)
      .maybeSingle();

    let result;

    if (existingCosts) {
      // Update existing costs
      result = await supabase
        .from("quote_costs")
        .update(costs)
        .eq("quote_id", id)
        .select()
        .single();
    } else {
      // Insert new costs
      result = await supabase
        .from("quote_costs")
        .insert({ ...costs, quote_id: id })
        .select()
        .single();
    }

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: result.error?.message ?? "Failed to update costs" },
        { status: 500 },
      );
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      action: "quote_costs.updated",
      entity_type: "quotes",
      entity_id: id,
      ai_generated: false,
      human_verified: true,
      payload: { changes: costs } as unknown as Json,
    });

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Error updating quote costs:", error);
    return NextResponse.json(
      { error: "Failed to update quote costs" },
      { status: 500 },
    );
  }
}
