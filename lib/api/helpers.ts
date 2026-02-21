import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export async function parseBody(
  request: Request,
): Promise<[unknown, null] | [null, NextResponse]> {
  try {
    return [await request.json(), null];
  } catch {
    return [
      null,
      NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
    ];
  }
}

export function validationError(error: ZodError): NextResponse {
  return NextResponse.json(
    { error: error.issues.map((i) => i.message).join(", ") },
    { status: 400 },
  );
}

export function dbError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function notFound(resource: string): NextResponse {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 });
}
