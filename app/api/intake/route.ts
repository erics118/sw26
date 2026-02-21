import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTripFromText } from "@/lib/ai/intake";
import { auditAICall } from "@/lib/ai/audit";
import { IntakeRequestSchema } from "@/lib/schemas";
import type { Trip } from "@/lib/database.types";

export async function POST(request: Request) {
  const body = await request.json();

  const parsed = IntakeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const { raw_text, client_id } = parsed.data;

  let intakeResult;
  try {
    intakeResult = await extractTripFromText(raw_text);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "AI extraction failed" },
      { status: 502 },
    );
  }

  const { extracted, confidence } = intakeResult;

  const supabase = await createClient();

  // Insert trip
  const { data: trip, error: tripError } = (await supabase
    .from("trips")
    .insert({
      raw_input: raw_text,
      client_id: client_id ?? null,
      legs: extracted.legs,
      trip_type: extracted.trip_type,
      pax_adults: extracted.pax_adults,
      pax_children: extracted.pax_children,
      pax_pets: extracted.pax_pets,
      flexibility_hours: extracted.flexibility_hours,
      special_needs: extracted.special_needs,
      catering_notes: extracted.catering_notes,
      luggage_notes: extracted.luggage_notes,
      preferred_category: extracted.preferred_category,
      min_cabin_height_in: extracted.min_cabin_height_in,
      wifi_required: extracted.wifi_required,
      bathroom_required: extracted.bathroom_required,
      ai_extracted: true,
      ai_confidence: confidence,
    })
    .select()
    .single()) as unknown as {
    data: Trip | null;
    error: { message: string } | null;
  };

  if (tripError || !trip) {
    return NextResponse.json(
      { error: tripError?.message ?? "Insert failed" },
      { status: 500 },
    );
  }

  // Write to audit_logs (fire-and-forget — don't fail the request if this fails)
  await auditAICall({
    action: "trip.ai_intake",
    entityType: "trips",
    entityId: trip.id,
    model: "claude-sonnet-4-6",
    payload: {
      raw_text_length: raw_text.length,
      extracted,
    },
    confidence,
  }).catch(() => {});

  return NextResponse.json(
    {
      trip_id: trip.id,
      extracted,
      confidence,
      // Surface client info for the UI to optionally create/match a client
      client_hint: {
        name: extracted.client_name,
        email: extracted.client_email,
        phone: extracted.client_phone,
        company: extracted.client_company,
      },
    },
    { status: 201 },
  );
}
