import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateClientAction } from "@/lib/ai/client-summary";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: clientRow }, { data: quotes }] = await Promise.all([
    supabase.from("clients").select("name").eq("id", id).single(),
    supabase
      .from("quotes")
      .select("status, created_at, currency, trips(legs), quote_costs(total)")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (!clientRow) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const clientName = (clientRow as { name: string }).name;
  const quoteRows = (quotes ?? []) as Array<{
    status: string;
    created_at: string;
    currency: string;
    trips: { legs?: Array<{ from_icao: string; to_icao: string }> } | null;
    quote_costs: Array<{ total: number }> | null;
  }>;

  const quoteSummaries = quoteRows.map((q) => {
    const legs = q.trips?.legs ?? [];
    const route =
      legs.length > 0
        ? `${legs[0]?.from_icao ?? "?"} → ${legs[legs.length - 1]?.to_icao ?? "?"}`
        : "—";
    return {
      status: q.status,
      route,
      date: new Date(q.created_at).toLocaleDateString(),
      total: (q.quote_costs ?? [])[0]?.total,
      currency: q.currency,
    };
  });

  const result = await generateClientAction({
    client_name: clientName,
    quotes: quoteSummaries,
  });

  return NextResponse.json(result);
}
