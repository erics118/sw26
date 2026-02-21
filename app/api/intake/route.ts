import { NextResponse } from "next/server";
import { runIntakeAgent } from "@/lib/agents/intake.agent";
import { auditAICall } from "@/lib/ai/audit";
import { IntakeRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = IntakeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join(", ") },
      { status: 400 },
    );
  }

  const { raw_text, client_id } = parsed.data;

  let result;
  try {
    result = await runIntakeAgent(raw_text, client_id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent intake failed" },
      { status: 502 },
    );
  }

  // Audit trail (fire-and-forget)
  await auditAICall({
    action: "trip.ai_intake",
    entityType: "trips",
    entityId: result.trip_id,
    model: "claude-sonnet-4-6",
    payload: {
      raw_text_length: raw_text.length,
      extracted: result.extracted,
    },
    confidence: result.confidence,
  }).catch(() => {});

  return NextResponse.json(result, { status: 201 });
}
