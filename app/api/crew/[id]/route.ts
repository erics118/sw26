import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateCrewSchema } from "@/lib/schemas";
import type { Crew } from "@/lib/database.types";
import {
  parseBody,
  validationError,
  dbError,
  notFound,
} from "@/lib/api/helpers";

const UpdateCrewSchema = CreateCrewSchema.partial();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("crew")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return notFound("Crew member");
  }
  return NextResponse.json(data as Crew);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const [body, err] = await parseBody(request);
  if (err) return err;

  const parsed = UpdateCrewSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const { data, error } = await supabase
    .from("crew")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return dbError(error.message);
  }
  return NextResponse.json(data as Crew);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from("crew").delete().eq("id", id);

  if (error) {
    return dbError(error.message);
  }
  return new NextResponse(null, { status: 204 });
}
