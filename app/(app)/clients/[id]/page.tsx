import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/database.types";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import Badge, { statusVariant } from "@/components/ui/Badge";

type QuoteRow = {
  id: string;
  status: string;
  created_at: string;
  currency: string;
  trips: { legs?: Array<{ from_icao: string; to_icao: string }> } | null;
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  if (!id) notFound();

  const supabase = await createClient();

  const [
    { data: rawClient, error: clientError },
    { data: rawQuotes, error: quotesError },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase
      .from("quotes")
      .select("id, status, created_at, currency, trips(legs)")
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (clientError && clientError.code !== "PGRST116") {
    console.error("[clients/[id]] client fetch error:", clientError);
  }
  if (quotesError) {
    console.error("[clients/[id]] quotes fetch error:", quotesError);
  }

  const client = rawClient as unknown as Client | null;
  const quotes = (quotesError ? null : rawQuotes) as unknown as
    | QuoteRow[]
    | null;

  if (!client) notFound();

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <Link
            href="/clients"
            className="text-xs text-zinc-600 hover:text-zinc-400"
          >
            ← Clients
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-xs text-zinc-500">{client.name}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">
              {client.name}
            </h1>
            {client.company && (
              <p className="mt-1 text-sm text-zinc-500">{client.company}</p>
            )}
          </div>
          <div className="flex gap-2">
            {client.vip && (
              <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                VIP
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Quote history */}
        <div className="col-span-2">
          <Card padding={false}>
            <CardHeader className="px-5 pt-5">
              <CardTitle>Quote History</CardTitle>
              <span className="text-xs text-zinc-600">
                {quotes?.length ?? 0} quotes
              </span>
            </CardHeader>
            {!quotes?.length ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-zinc-600">No quotes yet.</p>
                <Link
                  href="/intake"
                  className="mt-2 inline-block text-sm text-amber-400 hover:text-amber-300"
                >
                  Start new intake →
                </Link>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {["ID", "Route", "Status", "Date"].map((h) => (
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
                    return (
                      <tr
                        key={q.id}
                        className="transition-colors hover:bg-zinc-800/30"
                      >
                        <td className="px-5 py-3">
                          <Link
                            href={`/quotes/${q.id}`}
                            className="font-mono text-xs text-amber-400 hover:text-amber-300"
                          >
                            {q.id.slice(0, 8)}…
                          </Link>
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

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <div className="space-y-2 text-sm">
              {client.email && (
                <div>
                  <p className="text-xs text-zinc-600">Email</p>
                  <a
                    href={`mailto:${client.email}`}
                    className="text-zinc-300 hover:text-amber-400"
                  >
                    {client.email}
                  </a>
                </div>
              )}
              {client.phone && (
                <div>
                  <p className="text-xs text-zinc-600">Phone</p>
                  <a
                    href={`tel:${client.phone}`}
                    className="text-zinc-300 hover:text-amber-400"
                  >
                    {client.phone}
                  </a>
                </div>
              )}
              {client.nationality && (
                <div>
                  <p className="text-xs text-zinc-600">Nationality</p>
                  <p className="text-zinc-300">{client.nationality}</p>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600">Member since</span>
                <span className="text-xs text-zinc-500">
                  {new Date(client.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Total quotes</span>
                <span className="tabnum text-zinc-300">
                  {quotes?.length ?? 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Confirmed</span>
                <span className="tabnum text-zinc-300">
                  {quotes?.filter((q) => q.status === "confirmed").length ?? 0}
                </span>
              </div>
            </div>
          </Card>

          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <p className="text-sm leading-relaxed text-zinc-400">
                {client.notes}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
