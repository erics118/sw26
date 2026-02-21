import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeRoutePlan } from "@/lib/routing";
import { getRouteRecommendation } from "@/lib/ai/route-recommendation";
import type { RoutePlanResult } from "@/lib/routing/types";
import type { Json, Trip, TripLeg } from "@/lib/database.types";

// ─── POST /api/quotes/preview ──────────────────────────────────────────────────
// For a trip_id: AI picks aircraft, computes 3 route plans, persists all 3 to
// route_plans (quote_id=null), returns plans + recommendation.

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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tripId =
    typeof body === "object" && body !== null && "trip_id" in body
      ? (body as { trip_id: string }).trip_id
      : null;
  if (!tripId || typeof tripId !== "string") {
    return NextResponse.json({ error: "trip_id is required" }, { status: 400 });
  }

  // 1. Load trip
  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .select("*")
    .eq("id", tripId)
    .single();
  if (tripErr || !trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const t = trip as Trip;
  const legs: TripLeg[] = Array.isArray(t.legs)
    ? (t.legs as unknown as TripLeg[])
    : [];
  if (legs.length === 0) {
    return NextResponse.json({ error: "Trip has no legs" }, { status: 400 });
  }

  // 2. List aircraft with cascading filters (soft constraints fall back gracefully)
  const baseQuery = () =>
    supabase
      .from("aircraft")
      .select(
        "id, tail_number, category, range_nm, pax_capacity, fuel_burn_gph, home_base_icao",
      )
      .eq("status", "active")
      .gte("range_nm", 500) // per-leg minimum; router handles fuel stops
      .gte("pax_capacity", t.pax_adults ?? 1)
      .order("range_nm", { ascending: false })
      .limit(10);

  const warnings: string[] = [];

  // Attempt 1: strict — category + amenities
  let q = baseQuery();
  if (t.preferred_category) q = q.eq("category", t.preferred_category);
  if (t.wifi_required) q = q.eq("has_wifi", true);
  if (t.bathroom_required) q = q.eq("has_bathroom", true);
  let { data: aircraftList, error: aircraftErr } = await q;

  // Fallback 1: drop category (it's a preference, not a requirement)
  if ((aircraftErr || !aircraftList?.length) && t.preferred_category) {
    q = baseQuery();
    if (t.wifi_required) q = q.eq("has_wifi", true);
    if (t.bathroom_required) q = q.eq("has_bathroom", true);
    ({ data: aircraftList, error: aircraftErr } = await q);
    if (aircraftList?.length) {
      warnings.push(
        `No ${t.preferred_category} aircraft available — showing all categories`,
      );
    }
  }

  // Fallback 2: drop amenity requirements
  if (
    (aircraftErr || !aircraftList?.length) &&
    (t.wifi_required || t.bathroom_required)
  ) {
    ({ data: aircraftList, error: aircraftErr } = await baseQuery());
    if (aircraftList?.length) {
      const missing = [
        t.wifi_required && "wifi",
        t.bathroom_required && "bathroom",
      ]
        .filter(Boolean)
        .join(" and ");
      warnings.push(
        `No aircraft with ${missing} available — showing all active aircraft`,
      );
    }
  }

  if (aircraftErr || !aircraftList?.length) {
    // Give a specific reason if possible
    const { count } = await supabase
      .from("aircraft")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    if (!count) {
      return NextResponse.json(
        { error: "No active aircraft in fleet" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        error: `No aircraft can carry ${t.pax_adults ?? 1} passenger(s) with sufficient range`,
      },
      { status: 404 },
    );
  }

  // 3. Pick best aircraft: run balanced plan for each, choose lowest cost
  let bestAircraftId: string | null = null;
  let bestCost = Infinity;
  let firstRouteError: string | null = null;
  for (const ac of aircraftList) {
    try {
      const plan = await computeRoutePlan({
        aircraft_id: ac.id,
        legs: legs.map((l) => ({
          from_icao: l.from_icao,
          to_icao: l.to_icao,
          date: l.date,
          time: l.time ?? "12:00",
        })),
        optimization_mode: "balanced",
      });
      const cost =
        plan.cost_breakdown?.total_routing_cost_usd ?? plan.total_fuel_cost_usd;
      if (cost < bestCost) {
        bestCost = cost;
        bestAircraftId = ac.id;
      }
    } catch (err) {
      if (!firstRouteError)
        firstRouteError = err instanceof Error ? err.message : String(err);
      continue;
    }
  }

  if (!bestAircraftId) {
    const message = firstRouteError
      ? `Could not compute a valid route for any aircraft: ${firstRouteError}`
      : "Could not compute a valid route for any aircraft";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const aircraft = aircraftList.find((a) => a.id === bestAircraftId)!;
  const legsForRouting = legs.map((l) => ({
    from_icao: l.from_icao,
    to_icao: l.to_icao,
    date: l.date,
    time: l.time ?? "12:00",
  }));

  // 4. Compute all 3 plans in parallel
  const modes = ["cost", "balanced", "time"] as const;
  const results = await Promise.allSettled(
    modes.map((mode) =>
      computeRoutePlan({
        aircraft_id: bestAircraftId,
        legs: legsForRouting,
        optimization_mode: mode,
      }),
    ),
  );

  const plans: Record<string, RoutePlanResult & { plan_id: string }> = {};
  for (let i = 0; i < modes.length; i++) {
    const r = results[i];
    const mode = modes[i]!;
    if (r?.status === "fulfilled") {
      const result = r.value;
      // 5. Persist to route_plans (quote_id=null)
      const { data: plan, error: insertErr } = await supabase
        .from("route_plans")
        .insert({
          quote_id: null,
          trip_id: tripId,
          aircraft_id: bestAircraftId!,
          optimization_mode: mode,
          route_legs: result.route_legs as unknown as Json,
          refuel_stops: result.refuel_stops as unknown as Json,
          weather_summary: result.weather_summary as unknown as Json,
          notam_alerts: result.notam_alerts as unknown as Json,
          alternatives: result.alternatives as unknown as Json,
          cost_breakdown: result.cost_breakdown as unknown as Json,
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

      if (!insertErr && plan) {
        plans[mode] = {
          ...result,
          plan_id: plan.id,
        };
      }
    }
  }

  if (Object.keys(plans).length === 0) {
    return NextResponse.json(
      { error: "Could not compute any route plans" },
      { status: 500 },
    );
  }

  // 6. AI recommendation
  const planSummaries = Object.entries(plans).map(([mode, p]) => ({
    mode: mode as "cost" | "balanced" | "time",
    total_routing_cost_usd:
      (p.cost_breakdown as { total_routing_cost_usd?: number })
        ?.total_routing_cost_usd ?? p.total_fuel_cost_usd,
    total_flight_time_hr: p.total_flight_time_hr,
    risk_score: p.risk_score,
    on_time_probability: p.on_time_probability,
    refuel_stops_count: p.refuel_stops.length,
  }));

  const tripNotes =
    [t.special_needs, t.catering_notes].filter(Boolean).join(" ") || null;
  const recommendation = await getRouteRecommendation(planSummaries, tripNotes);

  return NextResponse.json({
    aircraft_id: bestAircraftId,
    aircraft: {
      id: aircraft.id,
      tail_number: aircraft.tail_number,
      category: aircraft.category,
      range_nm: aircraft.range_nm,
      pax_capacity: aircraft.pax_capacity,
    },
    cost: plans.cost ?? null,
    balanced: plans.balanced ?? null,
    time: plans.time ?? null,
    recommendation,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}
