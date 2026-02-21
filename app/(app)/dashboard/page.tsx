import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Badge, { statusVariant } from "@/components/ui/Badge";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import OpsCenter from "@/components/ops/OpsCenter";
import DashboardRightPanel from "@/components/ops/DashboardRightPanel";
import { mockFlights, mockAlerts } from "@/lib/ops/mockData";

function kpiCard(
  label: string,
  value: string | number,
  sub?: string,
  color: "green" | "red" | "yellow" | "white" = "white",
  badge?: string,
  badgeColor: "green" | "red" | "yellow" | "white" = "white",
) {
  const valueColor =
    color === "green"
      ? "text-emerald-400"
      : color === "red"
        ? "text-red-400"
        : color === "yellow"
          ? "text-yellow-400"
          : "text-zinc-100";

  const badgeCls =
    badgeColor === "green"
      ? "bg-emerald-400/10 text-emerald-400"
      : badgeColor === "red"
        ? "bg-red-400/10 text-red-400"
        : badgeColor === "yellow"
          ? "bg-yellow-400/10 text-yellow-400"
          : "bg-zinc-700/40 text-zinc-400";

  return (
    <Card>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-widest text-zinc-600 uppercase">
          {label}
        </p>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeCls}`}
          >
            {badge}
          </span>
        )}
      </div>
      <p className={`tabnum mt-2 text-3xl font-bold ${valueColor}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-600">{sub}</p>}
    </Card>
  );
}

type QuoteRow = {
  id: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  clients: { name: string } | null;
  trips: { legs: Array<{ from_icao: string; to_icao: string }> } | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: rawQuotes }, { data: rawOperators }, { data: rawRevenue }] =
    await Promise.all([
      supabase
        .from("quotes")
        .select(
          "id, status, created_at, confirmed_at, clients(name), trips(legs)",
        )
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("operators")
        .select("id, name, cert_expiry, insurance_expiry, reliability_score"),
      supabase
        .from("quote_costs")
        .select("total, quotes!inner(confirmed_at)")
        .not("quotes.confirmed_at", "is", null),
    ]);

  const quotes = rawQuotes as unknown as QuoteRow[] | null;
  const operators = rawOperators as unknown as Array<{
    cert_expiry: string | null;
    insurance_expiry: string | null;
  }> | null;
  const revenueRows = rawRevenue as unknown as Array<{
    total: number;
    quotes: { confirmed_at: string };
  }> | null;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const openStatuses = ["new", "pricing", "sent", "negotiating"];
  const openQuotes =
    quotes?.filter((q) => openStatuses.includes(q.status)).length ?? 0;
  const confirmedThisWeek =
    quotes?.filter(
      (q) =>
        q.status === "confirmed" &&
        q.confirmed_at &&
        new Date(q.confirmed_at) >= weekAgo,
    ).length ?? 0;

  const expiringSoon =
    operators?.filter((op) => {
      const certExpiry = op.cert_expiry ? new Date(op.cert_expiry) : null;
      const insExpiry = op.insurance_expiry
        ? new Date(op.insurance_expiry)
        : null;
      const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return (
        (certExpiry && certExpiry <= thirtyDays) ||
        (insExpiry && insExpiry <= thirtyDays)
      );
    }).length ?? 0;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const totalRevenue =
    revenueRows?.reduce((sum, r) => sum + (r.total ?? 0), 0) ?? 0;
  const revenueToday =
    revenueRows
      ?.filter((r) => new Date(r.quotes.confirmed_at) >= startOfToday)
      .reduce((sum, r) => sum + (r.total ?? 0), 0) ?? 0;

  function fmtMoney(n: number) {
    return n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
        ? `$${(n / 1_000).toFixed(1)}k`
        : `$${n}`;
  }

  const revenueLabel = fmtMoney(totalRevenue);
  const revenueTodayBadge =
    revenueToday > 0 ? `+${fmtMoney(revenueToday)} today` : undefined;

  const recentQuotes = quotes?.slice(0, 5) ?? [];
  const flightsToday = mockFlights.filter((f) => f.inAir).length;
  const fleetUtilPct = Math.round(
    (mockFlights.filter((f) => f.inAir).length / mockFlights.length) * 100,
  );
  const activeFlightsBottom = mockFlights.filter((f) => f.inAir).slice(3, 8);
  const recommendations = mockAlerts.slice(0, 3);

  return (
    <div className="page-in flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-8 py-5">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            Operations Overview
          </h1>
          <p className="mt-0.5 text-sm text-zinc-600">
            {now.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-zinc-600"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              className="w-40 bg-transparent text-sm text-zinc-400 placeholder-zinc-700 outline-none"
            />
          </div>
          {/* Notifications */}
          <button className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors hover:text-zinc-300">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            {expiringSoon > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {expiringSoon}
              </span>
            )}
          </button>
          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/20 text-xs font-semibold text-amber-400">
            S
          </div>
        </div>
      </div>

      <div className="space-y-6 p-8">
        {/* KPI Row */}
        <div className="grid grid-cols-5 gap-4">
          {kpiCard(
            "Total Revenue",
            revenueLabel,
            "confirmed bookings",
            totalRevenue > 0 ? "green" : "white",
            revenueTodayBadge,
            "green",
          )}
          {kpiCard(
            "Open Quotes",
            openQuotes,
            "active pipeline",
            openQuotes > 0 ? "yellow" : "white",
            openQuotes > 0 ? `+${Math.min(openQuotes, 2)} today` : undefined,
            "yellow",
          )}
          {kpiCard(
            "Confirmed This Week",
            confirmedThisWeek,
            "last 7 days",
            confirmedThisWeek > 0 ? "green" : "white",
            confirmedThisWeek > 0 ? `+${confirmedThisWeek}` : undefined,
            "green",
          )}
          {kpiCard(
            "Flights Today",
            flightsToday,
            "currently airborne",
            "white",
          )}
          {kpiCard(
            "Fleet Utilization",
            `${fleetUtilPct}%`,
            "of fleet active",
            fleetUtilPct > 60 ? "yellow" : "green",
          )}
        </div>

        {/* Main: Full-width Map */}
        <div>
          <p className="mb-3 text-xs font-semibold tracking-widest text-zinc-600 uppercase">
            Live Operations
          </p>
          <OpsCenter />
        </div>

        {/* Fleet Overview — below map, full width */}
        <div>
          <p className="mb-3 text-xs font-semibold tracking-widest text-zinc-600 uppercase">
            Fleet Overview
          </p>
          <DashboardRightPanel />
        </div>

        {/* Bottom: Recommendations + Open Quotes + Active Flights */}
        <div className="grid grid-cols-3 gap-6">
          {/* Optimization Recommendations */}
          <Card padding={false}>
            <CardHeader className="px-5 pt-5">
              <CardTitle>Recommendations</CardTitle>
              <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-xs text-yellow-400">
                {recommendations.length} alerts
              </span>
            </CardHeader>
            <div className="scrollbar-thin mt-1 max-h-72 divide-y divide-zinc-800/50 overflow-y-auto pb-2">
              {recommendations.map((alert) => (
                <div key={alert.id} className="px-5 py-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        alert.severity === "red"
                          ? "bg-red-400"
                          : alert.severity === "yellow"
                            ? "bg-yellow-400"
                            : "bg-emerald-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-300">
                        {alert.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zinc-600">
                        {alert.description}
                      </p>
                      <p className="mt-1 text-xs text-zinc-700">
                        {alert.type} · {alert.timestamp}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Open Quotes */}
          <Card padding={false}>
            <CardHeader className="px-5 pt-5">
              <CardTitle>Open Quotes</CardTitle>
              <Link
                href="/quotes"
                className="text-xs text-amber-400 transition-colors hover:text-amber-300"
              >
                View all →
              </Link>
            </CardHeader>
            {recentQuotes.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-zinc-600">No quotes yet.</p>
                <Link
                  href="/intake"
                  className="mt-1 inline-block text-xs text-amber-400 hover:text-amber-300"
                >
                  Start an intake →
                </Link>
              </div>
            ) : (
              <div className="scrollbar-thin mt-1 max-h-72 divide-y divide-zinc-800/50 overflow-y-auto pb-2">
                {recentQuotes.map((q) => {
                  const legs = Array.isArray(q.trips)
                    ? []
                    : (((q.trips as { legs?: unknown })?.legs as
                        | Array<{ from_icao: string; to_icao: string }>
                        | undefined) ?? []);
                  const route =
                    legs.length > 0
                      ? `${legs[0]?.from_icao ?? "?"} → ${legs[legs.length - 1]?.to_icao ?? "?"}`
                      : "—";
                  const client = Array.isArray(q.clients)
                    ? null
                    : (q.clients as { name?: string } | null);
                  return (
                    <div key={q.id} className="px-5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/quotes/${q.id}`}
                          className="font-mono text-xs text-amber-400 hover:text-amber-300"
                        >
                          {q.id.slice(0, 8)}…
                        </Link>
                        <Badge
                          variant={
                            statusVariant(q.status) as
                              | "amber"
                              | "green"
                              | "red"
                              | "yellow"
                              | "blue"
                              | "zinc"
                          }
                          size="sm"
                        >
                          {q.status}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {client?.name ?? "—"}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-zinc-600">
                        {route}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Active Flights */}
          <Card padding={false}>
            <CardHeader className="px-5 pt-5">
              <CardTitle>Active Flights</CardTitle>
              <span className="text-xs text-zinc-600">
                {activeFlightsBottom.length} more
              </span>
            </CardHeader>
            <div className="scrollbar-thin mt-1 max-h-72 divide-y divide-zinc-800/50 overflow-y-auto pb-2">
              {activeFlightsBottom.map((f) => (
                <div key={f.id} className="px-5 py-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-zinc-200">
                        {f.callsign}
                      </span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          f.status === "green"
                            ? "bg-emerald-400"
                            : f.status === "yellow"
                              ? "bg-yellow-400"
                              : "bg-red-400"
                        }`}
                      />
                    </div>
                    <span className="font-mono text-xs text-zinc-600">
                      {f.altitude.toLocaleString()} ft
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                    <span>{f.origin}</span>
                    <span className="text-zinc-700">→</span>
                    <span>{f.destination}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-700">
                    {f.client}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
