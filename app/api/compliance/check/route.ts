import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runComplianceCheck } from "@/lib/compliance/checker";
import type { Quote, Trip, TripLeg } from "@/lib/database.types";

const CheckByQuoteSchema = z.object({
  quote_id: z.string().uuid(),
  estimated_flight_hours: z.number().optional(),
});

const CheckByParamsSchema = z.object({
  trip_id: z.string().uuid().optional(),
  aircraft_id: z.string().uuid(),
  operator_id: z.string().uuid(),
  crew_ids: z.array(z.string().uuid()).optional(),
  estimated_flight_hours: z.number().optional(),
});

const BodySchema = z.union([CheckByQuoteSchema, CheckByParamsSchema]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  let aircraft_id: string;
  let operator_id: string;
  let crew_ids: string[] | undefined;
  let legs: TripLeg[] | undefined;
  let min_cabin_height_in: number | null | undefined;
  let estimated_flight_hours: number | undefined;
  let entity_id: string | undefined;

  if ("quote_id" in parsed.data) {
    const { data: quoteData, error } = await supabase
      .from("quotes")
      .select("*, trips(*)")
      .eq("id", parsed.data.quote_id)
      .single();
    const quote = quoteData as (Quote & { trips: Trip | null }) | null;

    if (error || !quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }
    if (!quote.aircraft_id || !quote.operator_id) {
      return NextResponse.json(
        { error: "Quote is missing aircraft or operator" },
        { status: 422 },
      );
    }

    aircraft_id = quote.aircraft_id;
    operator_id = quote.operator_id;
    entity_id = quote.id;
    estimated_flight_hours = parsed.data.estimated_flight_hours;

    if (quote.trips) {
      legs = quote.trips.legs as unknown as TripLeg[];
      min_cabin_height_in = quote.trips.min_cabin_height_in;
    }
  } else {
    aircraft_id = parsed.data.aircraft_id;
    operator_id = parsed.data.operator_id;
    crew_ids = parsed.data.crew_ids;
    estimated_flight_hours = parsed.data.estimated_flight_hours;
    entity_id = parsed.data.trip_id;

    if (parsed.data.trip_id) {
      const { data: tripData } = await supabase
        .from("trips")
        .select("legs, min_cabin_height_in")
        .eq("id", parsed.data.trip_id)
        .single();
      const trip = tripData as Pick<
        Trip,
        "legs" | "min_cabin_height_in"
      > | null;
      if (trip) {
        legs = trip.legs as unknown as TripLeg[];
        min_cabin_height_in = trip.min_cabin_height_in;
      }
    }
  }

  const result = await runComplianceCheck({
    aircraft_id,
    operator_id,
    crew_ids,
    legs,
    min_cabin_height_in,
    estimated_flight_hours,
  });

  await supabase.from("audit_logs").insert({
    action: "compliance_check",
    entity_type: "compliance",
    entity_id: entity_id ?? null,
    ai_generated: false,
    human_verified: false,
    payload: {
      input: {
        aircraft_id,
        operator_id,
        ...(crew_ids !== undefined ? { crew_ids } : {}),
      },
      result: {
        passed: result.passed,
        failures: result.failures,
        warnings: result.warnings,
      },
    },
  });

  return NextResponse.json(result, { status: result.passed ? 200 : 422 });
}
