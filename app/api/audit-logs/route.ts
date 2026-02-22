import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(req.url);

  const action = searchParams.get("action");
  const entityType = searchParams.get("entity_type");
  const ai = searchParams.get("ai"); // "ai" | "human"
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const exportFormat = searchParams.get("export"); // "csv" | "json"
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "500"), 2000);

  let query = supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) query = query.eq("action", action);
  if (entityType) query = query.eq("entity_type", entityType);
  if (ai === "ai") query = query.eq("ai_generated", true);
  if (ai === "human") query = query.eq("ai_generated", false);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);

  const { data: logs, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const records = logs ?? [];
  const dateStr = new Date().toISOString().split("T")[0];

  if (exportFormat === "csv") {
    const headers = [
      "id",
      "created_at",
      "user_id",
      "action",
      "entity_type",
      "entity_id",
      "ai_generated",
      "ai_model",
      "human_verified",
      "payload",
    ];
    const csvRows = records.map((log) =>
      headers
        .map((h) => {
          const val = (log as Record<string, unknown>)[h];
          if (val === null || val === undefined) return '""';
          if (typeof val === "object")
            return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csv = [headers.join(","), ...csvRows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-log-${dateStr}.csv"`,
      },
    });
  }

  if (exportFormat === "json") {
    return new NextResponse(JSON.stringify(records, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="audit-log-${dateStr}.json"`,
      },
    });
  }

  return NextResponse.json({ logs: records });
}
