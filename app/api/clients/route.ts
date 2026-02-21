import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CreateClientSchema } from "@/lib/schemas";
import { parseBody, validationError, dbError } from "@/lib/api/helpers";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return dbError(error.message);
  }
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const [body, err] = await parseBody(request);
  if (err) return err;

  const parsed = CreateClientSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return dbError(error.message);
  }
  return NextResponse.json(data, { status: 201 });
}
