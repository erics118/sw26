import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Card from "@/components/ui/Card";
import { QuoteTable } from "@/components/Quotes/QuoteTable";
import type { QuoteRow } from "@/components/Quotes/QuoteTable";

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

export default async function QuotesPage({ searchParams }: PageProps) {
  const { status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select(
      `id, trip_id, status, created_at, updated_at, version, margin_pct, currency,
       broker_name, broker_commission_pct, notes, sent_at, confirmed_at,
       quote_valid_until, chosen_aircraft_category, estimated_total_hours,
       won_lost_reason, scheduled_departure_time, scheduled_arrival_time,
       scheduled_total_hours, actual_departure_time, actual_arrival_time,
       actual_block_hours, actual_reposition_hours, actual_total_hours,
       delay_reason_code,
       clients(name), aircraft(tail_number, category),
       trips(legs),
       quote_costs(subtotal, margin_amount, tax, total, fuel_cost, fbo_fees,
         repositioning_cost, repositioning_hours, permit_fees,
         crew_overnight_cost, catering_cost, peak_day_surcharge)`,
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
          <QuoteTable quotes={quotes} />
        )}
      </Card>
    </div>
  );
}
