import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Badge, { statusVariant } from "@/components/ui/Badge";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import OpsCenter from "@/components/ops/OpsCenter";

function kpiCard(
  label: string,
  value: string | number,
  sub?: string,
  accent = false,
) {
  return (
    <Card>
      <p className="text-xs font-semibold tracking-widest text-zinc-600 uppercase">
        {label}
      </p>
      <p
        className={`tabnum mt-1.5 text-3xl font-bold ${accent ? "text-amber-400" : "text-zinc-100"}`}
      >
        {value}
      </p>
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

  const [{ data: rawQuotes }, { data: trips }] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, status, created_at, confirmed_at, clients(name), trips(legs)",
      )
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("trips").select("id", { count: "exact" }),
  ]);

  const quotes = rawQuotes as unknown as QuoteRow[] | null;

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

  const recentQuotes = quotes?.slice(0, 8) ?? [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">
          Operations Overview
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {kpiCard("Open Quotes", openQuotes, "active pipeline", openQuotes > 0)}
        {kpiCard("Confirmed This Week", confirmedThisWeek, "last 7 days")}
        {kpiCard("Total Trips", trips?.length ?? 0, "all time")}
      </div>

      {/* Live Operations */}
      <div className="mb-8">
        <p className="mb-3 text-xs font-semibold tracking-widest text-zinc-600 uppercase">
          Live Operations
        </p>
        <OpsCenter />
      </div>

      {/* Recent quotes */}
      <Card padding={false}>
        <CardHeader className="px-5 pt-5">
          <CardTitle>Recent Quotes</CardTitle>
          <Link
            href="/quotes"
            className="text-xs text-amber-400 transition-colors hover:text-amber-300"
          >
            View all →
          </Link>
        </CardHeader>

        {recentQuotes.length === 0 ? (
          <div className="px-5 pt-2 pb-8 text-center">
            <p className="text-sm text-zinc-600">No quotes yet.</p>
            <Link
              href="/intake"
              className="mt-2 inline-block text-sm text-amber-400 hover:text-amber-300"
            >
              Start with a new intake →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {["Quote ID", "Client", "Route", "Status", "Created"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left text-xs font-semibold tracking-wider text-zinc-600 uppercase"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
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
                  <tr
                    key={q.id}
                    className="group transition-colors hover:bg-zinc-800/30"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/quotes/${q.id}`}
                        className="font-mono text-xs text-amber-400 hover:text-amber-300"
                      >
                        {q.id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-300">
                      {client?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">
                      {route}
                    </td>
                    <td className="px-5 py-3">
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
                      >
                        {q.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-600">
                      {new Date(q.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
