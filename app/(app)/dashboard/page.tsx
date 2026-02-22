import { Suspense } from "react";
import Link from "next/link";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import OpsCenter from "@/components/ops/OpsCenter";
import { createClient } from "@/lib/supabase/server";
import { KPICard } from "./_components/KPICard";
import {
  ForecastKPIs,
  ForecastSideCards,
  TopActionsCard,
} from "./_components/ForecastWidgets";
import {
  ForecastKPISkeleton,
  ForecastSideCardsSkeleton,
  RevenueCardSkeleton,
  TopActionsSkeleton,
} from "./_components/ForecastSkeleton";
import { RevenueCard } from "./_components/RevenueCard";

type QuoteRow = {
  id: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  clients: { name: string } | null;
  trips: { legs: Array<{ from_icao: string; to_icao: string }> } | null;
  aircraft: { id: string; tail_number: string } | null;
};

async function fetchDashboardData() {
  const supabase = await createClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [{ data: rawQuotes }, { data: trips }, { data: crews }] =
    await Promise.all([
      supabase
        .from("quotes")
        .select(
          "id, status, created_at, confirmed_at, clients(name), trips(legs), aircraft(id, tail_number)",
        )
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("trips")
        .select("id, requested_departure_window_start, clients(name), legs")
        .gte(
          "requested_departure_window_start",
          new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
        )
        .lte(
          "requested_departure_window_start",
          new Date(new Date().setHours(23, 59, 59, 999)).toISOString(),
        ),
      supabase.from("crew").select("id, name, role").limit(5),
    ]);

  const quotes = rawQuotes as QuoteRow[] | null;

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

  return {
    openQuotes: openQuotesCount,
    confirmedThisWeek: confirmedThisWeekCount,
    todayTrips: trips?.length ?? 0,
    recentQuotes: (quotes?.slice(0, 8) ?? []) as QuoteRow[],
    crews: crews ?? [],
  };
}

export default async function DashboardPage() {
  const data = await fetchDashboardData();

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sentQuotes =
    data.recentQuotes.filter((q) => q.status === "sent").length || 0;
  const confirmedQuotes =
    data.recentQuotes.filter((q) => q.status === "confirmed").length || 0;
  const conversionRate =
    sentQuotes > 0 ? Math.round((confirmedQuotes / sentQuotes) * 100) : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">
            Operations Overview
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{dateStr}</p>
        </div>
      </div>

      {/* Top KPI Row */}
      <div className="mb-6 grid grid-cols-5 gap-4">
        <KPICard
          label="Open Quotes"
          value={data.openQuotes}
          subLabel="in pipeline"
          accent={data.openQuotes > 0}
        />
        <KPICard
          label="Conversion Rate"
          value={`${conversionRate}%`}
          subLabel={`${sentQuotes} sent, ${confirmedQuotes} confirmed`}
          accent={conversionRate > 50}
        />
        <Suspense fallback={<ForecastKPISkeleton />}>
          <ForecastKPIs />
        </Suspense>
      </div>

      {/* Main Grid */}
      <div className="mb-6 grid grid-cols-3 gap-6">
        {/* Left: Live Operations */}
        <div className="col-span-2">
          <p className="mb-3 text-xs font-semibold tracking-widest text-zinc-600 uppercase">
            Live Operations
          </p>
          <OpsCenter />
        </div>

        {/* Right Column: Revenue & Forecasting */}
        <div className="space-y-6">
          <Suspense fallback={<RevenueCardSkeleton />}>
            <RevenueCard />
          </Suspense>

          <Suspense fallback={<ForecastSideCardsSkeleton />}>
            <ForecastSideCards />
          </Suspense>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Quote Pipeline */}
        <Card padding={false}>
          <CardHeader className="px-5 pt-5 pb-4">
            <CardTitle>Quote Pipeline</CardTitle>
            <Link
              href="/quotes"
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View All →
            </Link>
          </CardHeader>
          <div className="space-y-3 px-5 pb-5">
            {[
              { status: "sent", count: sentQuotes, color: "emerald" },
              {
                status: "negotiating",
                count:
                  data.recentQuotes.filter((q) => q.status === "negotiating")
                    .length || 0,
                color: "amber",
              },
              {
                status: "confirmed",
                count: confirmedQuotes,
                color: "green",
              },
            ].map((stage) => {
              const colorClass =
                stage.color === "emerald"
                  ? "bg-emerald-400"
                  : stage.color === "amber"
                    ? "bg-amber-400"
                    : "bg-green-400";
              return (
                <div key={stage.status} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-zinc-400 capitalize">
                      {stage.status}
                    </p>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${colorClass}`}
                        style={{
                          width: `${Math.min((stage.count / 5) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="w-6 text-right text-xs font-bold text-zinc-300">
                    {stage.count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Top Recommendations */}
        <Suspense fallback={<TopActionsSkeleton />}>
          <TopActionsCard />
        </Suspense>

        {/* High-Value Quotes */}
        <Card padding={false}>
          <CardHeader className="px-5 pt-5 pb-4">
            <CardTitle>High-Value Quotes</CardTitle>
            <Link
              href="/quotes"
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              View All →
            </Link>
          </CardHeader>
          <div className="space-y-2.5 px-5 pb-5">
            {data.recentQuotes
              .filter((q) => q.status === "sent" || q.status === "confirmed")
              .slice(0, 3)
              .map((q) => {
                const client = !Array.isArray(q.clients)
                  ? (q.clients as { name?: string } | null)
                  : null;
                const aircraft = !Array.isArray(q.aircraft)
                  ? (q.aircraft as { tail_number?: string } | null)
                  : null;
                return (
                  <div
                    key={q.id}
                    className="flex items-start justify-between rounded-md border border-zinc-800 p-2.5 hover:border-emerald-500/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-zinc-100">
                        {client?.name || "Unknown"}
                      </p>
                      <p
                        className={`mt-0.5 text-xs ${
                          q.status === "confirmed"
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {q.status}
                        {aircraft?.tail_number
                          ? ` · ${aircraft.tail_number}`
                          : ""}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-zinc-400">$28k</p>
                  </div>
                );
              })}
          </div>
        </Card>
      </div>
    </div>
  );
}
