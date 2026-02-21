import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type QuoteRow = {
  id: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  clients: { name: string } | null;
  trips: { legs: Array<{ from_icao: string; to_icao: string }> } | null;
};

export async function GET() {
  const supabase = await createClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Fetch quotes
    const { data: rawQuotes } = await supabase
      .from("quotes")
      .select(
        "id, status, created_at, confirmed_at, clients(name), trips(legs)",
      )
      .order("created_at", { ascending: false })
      .limit(20);

    const quotes = rawQuotes as QuoteRow[] | null;

    // Fetch today's trips
    const { data: trips } = await supabase
      .from("trips")
      .select(
        "id, requested_departure_window_start, clients(name), trips(legs)",
      )
      .gte(
        "requested_departure_window_start",
        new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
      )
      .lte(
        "requested_departure_window_start",
        new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
      );

    // Fetch crew
    const { data: crews } = await supabase
      .from("crew")
      .select("id, name, status")
      .limit(5);

    // Calculate KPIs
    const openStatuses = ["new", "pricing", "sent", "negotiating"];
    const openQuotesCount =
      quotes?.filter((q) => openStatuses.includes(q.status)).length ?? 0;

    const confirmedThisWeekCount =
      quotes?.filter(
        (q) =>
          q.status === "confirmed" &&
          q.confirmed_at &&
          new Date(q.confirmed_at) >= weekAgo,
      ).length ?? 0;

    const todayTripsCount = trips?.length ?? 0;

    return NextResponse.json({
      openQuotes: openQuotesCount,
      confirmedThisWeek: confirmedThisWeekCount,
      todayTrips: todayTripsCount,
      emptyLegRatio: "34%",
      recentQuotes: quotes?.slice(0, 8) ?? [],
      recommendedTrips: trips ?? [],
      activeTrips: trips ?? [],
      crews: crews ?? [],
    });
  } catch (error) {
    console.error("Dashboard data fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 },
    );
  }
}
