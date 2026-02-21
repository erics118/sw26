import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Badge, { statusVariant } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";

const ALL_STATUSES = [
  "new",
  "pricing",
  "sent",
  "negotiating",
  "confirmed",
  "lost",
  "completed",
];

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

type QuoteRow = {
  id: string;
  status: string;
  created_at: string;
  margin_pct: number;
  currency: string;
  clients: { name?: string } | null;
  aircraft: { tail_number?: string; category?: string } | null;
  trips: { legs?: Array<{ from_icao: string; to_icao: string }> } | null;
};

export default async function QuotesPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select(
      "id, status, created_at, margin_pct, currency, clients(name), aircraft(tail_number, category), trips(legs)",
    )
    .order("created_at", { ascending: false });

  if (status && ALL_STATUSES.includes(status)) {
    query = query.eq("status", status);
  }

  const { data: rawQuotes } = await query;
  const quotes = rawQuotes as unknown as QuoteRow[] | null;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Quotes</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {quotes?.length ?? 0} quotes
          </p>
        </div>
        <Link
          href="/quotes/new"
          className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm shadow-amber-400/20 transition-colors hover:bg-amber-300"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Quote
        </Link>
      </div>

      {/* Status filter */}
      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/quotes"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            !status
              ? "border-amber-400 bg-amber-400/10 text-amber-400"
              : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          }`}
        >
          All
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/quotes?status=${s}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
              status === s
                ? "border-amber-400 bg-amber-400/10 text-amber-400"
                : "border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      <Card padding={false}>
        {!quotes?.length ? (
          <div className="py-16 text-center">
            <p className="text-zinc-600">No quotes found.</p>
            <Link
              href="/quotes/new"
              className="mt-2 inline-block text-sm text-amber-400 hover:text-amber-300"
            >
              Create the first quote →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {[
                  "ID",
                  "Client",
                  "Route",
                  "Aircraft",
                  "Status",
                  "Margin",
                  "Date",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold tracking-wider text-zinc-600 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {quotes.map((q) => {
                const trips = q.trips as {
                  legs?: Array<{ from_icao: string; to_icao: string }>;
                } | null;
                const legs = trips?.legs ?? [];
                const route =
                  legs.length > 0
                    ? `${legs[0]?.from_icao ?? "?"} → ${legs[legs.length - 1]?.to_icao ?? "?"}`
                    : "—";
                const client = q.clients as { name?: string } | null;
                const aircraft = q.aircraft as {
                  tail_number?: string;
                  category?: string;
                } | null;

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
                      {client?.name ?? <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-zinc-400">
                      {route}
                    </td>
                    <td className="px-5 py-3 text-xs text-zinc-500">
                      {aircraft?.tail_number ?? "—"}
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
                    <td className="tabnum px-5 py-3 text-xs text-zinc-500">
                      {q.margin_pct}%
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
