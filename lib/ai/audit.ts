import { createClient } from "@/lib/supabase/server";

interface AuditAICallParams {
  action: string;
  entityType?: string;
  entityId?: string;
  model: string;
  payload: Record<string, unknown>;
  confidence?: Record<string, number>;
  userId?: string;
}

/**
 * Write every Claude call to audit_logs as an immutable record.
 */
export async function auditAICall({
  action,
  entityType,
  entityId,
  model,
  payload,
  confidence,
  userId,
}: AuditAICallParams): Promise<void> {
  const supabase = await createClient();
  await supabase.from("audit_logs").insert({
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    user_id: userId ?? null,
    ai_generated: true,
    ai_model: model,
    human_verified: false,
    payload: {
      ...payload,
      ...(confidence ? { _confidence: confidence } : {}),
    },
  });
}
