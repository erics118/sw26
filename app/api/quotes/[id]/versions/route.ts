import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json, Quote } from "@/lib/database.types";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/quotes/[id]/versions ───────────────────────────────────────────
// Returns all version snapshots for a quote from audit_logs.

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_type", "quote_version")
    .eq("entity_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

// ─── POST /api/quotes/[id]/versions ──────────────────────────────────────────
// Snapshots the current quote state before an edit.

export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch current quote + costs
  const { data: rawQuote, error: quoteErr } = await supabase
    .from("quotes")
    .select("*, quote_costs(*)")
    .eq("id", id)
    .single();

  if (quoteErr || !rawQuote) {
    return NextResponse.json(
      { error: quoteErr?.message ?? "Quote not found" },
      { status: 404 },
    );
  }
  const quote = rawQuote as unknown as Quote;

  // Persist snapshot as an audit log entry
  const { error: logErr } = await supabase.from("audit_logs").insert({
    action: "quote.version_snapshot",
    entity_type: "quote_version",
    entity_id: id,
    ai_generated: false,
    human_verified: true,
    payload: {
      version: quote.version,
      snapshot: rawQuote,
    } as unknown as Json,
  });

  if (logErr) {
    return NextResponse.json({ error: logErr.message }, { status: 500 });
  }

  const nextVersion = (quote.version ?? 0) + 1;
  await supabase.from("quotes").update({ version: nextVersion }).eq("id", id);

  return NextResponse.json({ snapshotted: true, version: nextVersion });
}
