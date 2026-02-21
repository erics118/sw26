import { createClient } from "@/lib/supabase/server";
import { extractTripFromText } from "@/lib/ai/intake";
import type { Json } from "@/lib/database.types";

export interface IntakeAgentResult {
  trip_id: string;
  extracted: Record<string, unknown>;
  confidence: Record<string, number>;
  client_hint: {
    name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
  };
}

const ICAO_REGEX = /^[A-Z]{4}$/i;

async function resolveIcao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  value: string,
): Promise<string> {
  const v = value.trim().toUpperCase();
  if (ICAO_REGEX.test(v)) return v;
  const safe = v.replace(/'/g, "''");
  const { data } = await supabase
    .from("airports")
    .select("icao")
    .or(
      `city.ilike.%${safe}%,name.ilike.%${safe}%,icao.ilike.%${safe}%,iata.ilike.%${safe}%`,
    )
    .limit(1)
    .maybeSingle();
  return (data as { icao: string } | null)?.icao ?? v;
}

export async function runIntakeAgent(
  rawText: string,
  clientId?: string,
): Promise<IntakeAgentResult> {
  const supabase = await createClient();

  // 1. Extract (single LLM call, no tools)
  const extracted = await extractTripFromText(rawText);

  // 2. Resolve airport codes (server-side)
  const legs = await Promise.all(
    extracted.legs.map(async (leg) => ({
      from_icao: await resolveIcao(supabase, leg.from_icao),
      to_icao: await resolveIcao(supabase, leg.to_icao),
      date: leg.date,
      time: leg.time,
    })),
  );

  // 3. Search for matching client
  let matchedClientId: string | null = clientId ?? null;
  if (
    !matchedClientId &&
    (extracted.client_name || extracted.client_email || extracted.client_phone)
  ) {
    let q = supabase.from("clients").select("id").limit(1);
    if (extracted.client_email)
      q = q.ilike("email", `%${extracted.client_email}%`);
    else if (extracted.client_phone)
      q = q.ilike("phone", `%${extracted.client_phone}%`);
    else if (extracted.client_name)
      q = q.ilike("name", `%${extracted.client_name}%`);
    const { data: clients } = await q;
    matchedClientId = (clients as { id: string }[])?.[0]?.id ?? null;
  }

  // 4. Save trip
  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      raw_input: rawText,
      client_id: matchedClientId,
      legs: legs as unknown as Json,
      trip_type: extracted.trip_type,
      pax_adults: extracted.pax_adults,
      pax_children: extracted.pax_children ?? 0,
      pax_pets: extracted.pax_pets ?? 0,
      flexibility_hours: extracted.flexibility_hours ?? 0,
      special_needs: extracted.special_needs ?? null,
      catering_notes: extracted.catering_notes ?? null,
      luggage_notes: extracted.luggage_notes ?? null,
      preferred_category: extracted.preferred_category ?? null,
      min_cabin_height_in: extracted.min_cabin_height_in ?? null,
      wifi_required: extracted.wifi_required ?? false,
      bathroom_required: extracted.bathroom_required ?? false,
      ai_extracted: true,
      ai_confidence: (extracted.confidence ?? {}) as unknown as Json,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save trip: ${error.message}`);
  if (!trip) throw new Error("No trip returned");

  return {
    trip_id: trip.id,
    extracted: {
      legs,
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
      client_name: extracted.client_name,
      client_email: extracted.client_email,
      client_phone: extracted.client_phone,
      client_company: extracted.client_company,
    },
    confidence: extracted.confidence ?? {},
    client_hint: {
      name: extracted.client_name ?? null,
      email: extracted.client_email ?? null,
      phone: extracted.client_phone ?? null,
      company: extracted.client_company ?? null,
    },
  };
}
