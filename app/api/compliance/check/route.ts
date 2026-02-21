import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runComplianceAgent } from "@/lib/agents/compliance.agent";

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

  let result;
  try {
    result = await runComplianceAgent(parsed.data);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Compliance agent failed",
      },
      {
        status:
          err instanceof Error && err.message.includes("not found") ? 404 : 502,
      },
    );
  }

  // Determine entity_id for audit (best-effort)
  const entity_id =
    "quote_id" in parsed.data
      ? parsed.data.quote_id
      : "trip_id" in parsed.data
        ? parsed.data.trip_id
        : undefined;

  await supabase.from("audit_logs").insert({
    action: "compliance_check",
    entity_type: "compliance",
    entity_id: entity_id ?? null,
    ai_generated: true,
    ai_model: "claude-sonnet-4-6",
    human_verified: false,
    payload: {
      input: parsed.data,
      result: {
        passed: result.passed,
        failures: result.failures,
        warnings: result.warnings,
      },
    },
  });

  return NextResponse.json(result, { status: result.passed ? 200 : 422 });
}
