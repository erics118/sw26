import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateClientSchema } from "@/lib/schemas";
import type { Client } from "@/lib/database.types";
import {
  parseBody,
  validationError,
  dbError,
  notFound,
} from "@/lib/api/helpers";

const UpdateClientSchema = CreateClientSchema.partial();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const [clientRes, tripsRes] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase
      .from("trips")
      .select("id, created_at, trip_type, pax_adults, legs, quotes(id, status)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (clientRes.error || !clientRes.data) {
    return notFound("Client");
  }

  const client = clientRes.data as Client;
  return NextResponse.json({ ...client, trips: tripsRes.data ?? [] });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  // Nullify client_id on related rows so FK constraints don't block the delete
  const [tripsErr, quotesErr] = await Promise.all([
    supabase
      .from("trips")
      .update({ client_id: null })
      .eq("client_id", id)
      .then((r) => r.error),
    supabase
      .from("quotes")
      .update({ client_id: null })
      .eq("client_id", id)
      .then((r) => r.error),
  ]);

  if (tripsErr) return dbError(tripsErr.message);
  if (quotesErr) return dbError(quotesErr.message);

  const { error } = await supabase.from("clients").delete().eq("id", id);

  if (error) {
    return dbError(error.message);
  }
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const [body, err] = await parseBody(request);
  if (err) return err;

  const parsed = UpdateClientSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { data, error } = await supabase
    .from("clients")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return dbError(error.message);
  }
  return NextResponse.json(data as Client);
}
