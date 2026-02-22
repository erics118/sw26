import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RoutingPlanRequestSchema } from "@/lib/schemas";
import { computeRoutePlan, RoutingError } from "@/lib/routing";

// ─── POST /api/routing/plan ───────────────────────────────────────────────────
// Computes a route plan for the given aircraft + legs.
// If quote_id is provided, persists the result to route_plans.
// Returns: { plan_id?, result: RoutePlanResult }

export async function POST(request: Request) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RoutingPlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { aircraft_id, legs, optimization_mode, quote_id, trip_id } =
    parsed.data;

  // Run routing engine
  let result;
  try {
    result = await computeRoutePlan({ aircraft_id, legs, optimization_mode });
  } catch (err) {
    if (err instanceof RoutingError) {
      const status =
        err.code === "AIRCRAFT_NOT_FOUND"
          ? 404
          : err.code === "UNKNOWN_AIRPORT"
            ? 422
            : err.code === "NO_ROUTE"
              ? 422
              : 500;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    console.error("Routing engine error:", err);
    return NextResponse.json(
      { error: "Internal routing error" },
      { status: 500 },
    );
  }

  // Optionally persist to route_plans
  let plan_id: string | undefined;
  if (quote_id) {
    const { data: plan, error: insertError } = await supabase
      .from("route_plans")
      .insert({
        quote_id,
        trip_id: trip_id ?? null,
        aircraft_id,
        optimization_mode,
        route_legs:
          result.route_legs as unknown as import("@/lib/database.types").Json,
        refuel_stops:
          result.refuel_stops as unknown as import("@/lib/database.types").Json,
        weather_summary:
          result.weather_summary as unknown as import("@/lib/database.types").Json,
        notam_alerts:
          result.notam_alerts as unknown as import("@/lib/database.types").Json,
        alternatives:
          result.alternatives as unknown as import("@/lib/database.types").Json,
        cost_breakdown:
          result.cost_breakdown as unknown as import("@/lib/database.types").Json,
        total_distance_nm: result.total_distance_nm,
        total_flight_time_hr: result.total_flight_time_hr,
        total_fuel_cost: result.total_fuel_cost_usd,
        risk_score: result.risk_score,
        on_time_probability: result.on_time_probability,
        weather_fetched_at: new Date().toISOString(),
        notam_fetched_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (!insertError && plan) plan_id = plan.id;
  }

  // Audit log
  await supabase.from("audit_logs").insert({
    action: "route_plan.computed",
    entity_type: "route_plans",
    entity_id: plan_id ?? null,
    ai_generated: false,
    human_verified: false,
    payload: {
      aircraft_id,
      leg_count: legs.length,
      stop_count: result.refuel_stops.length,
      risk_score: result.risk_score,
      optimization_mode,
    },
  });

  return NextResponse.json(
    { plan_id, result },
    { status: plan_id ? 201 : 200 },
  );
}
