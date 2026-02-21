"use client";

import { useState } from "react";
import Link from "next/link";
import Badge, { statusVariant } from "@/components/ui/Badge";
import { QuoteDetailModal } from "./QuoteDetailModal";

type QuoteCosts = {
  subtotal: number;
  margin_amount: number;
  tax: number;
  total: number;
  fuel_cost: number;
  fbo_fees: number;
  repositioning_cost: number;
  repositioning_hours: number;
  permit_fees: number;
  crew_overnight_cost: number;
  catering_cost: number;
  peak_day_surcharge: number;
};

export type QuoteRow = {
  id: string;
  trip_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  version: number;
  margin_pct: number;
  currency: string;
  broker_name: string | null;
  broker_commission_pct: number | null;
  notes: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  quote_valid_until: string | null;
  chosen_aircraft_category: string | null;
  estimated_total_hours: number | null;
  won_lost_reason: string | null;
  scheduled_departure_time: string | null;
  scheduled_arrival_time: string | null;
  scheduled_total_hours: number | null;
  actual_departure_time: string | null;
  actual_arrival_time: string | null;
  actual_block_hours: number | null;
  actual_reposition_hours: number | null;
  actual_total_hours: number | null;
  delay_reason_code: string | null;
  clients: { name?: string } | null;
  aircraft: { tail_number?: string; category?: string } | null;
  trips: { legs?: Array<{ from_icao: string; to_icao: string }> } | null;
  quote_costs: QuoteCosts[] | null;
};

export function QuoteTable({ quotes }: { quotes: QuoteRow[] }) {
  const [selectedQuote, setSelectedQuote] = useState<QuoteRow | null>(null);

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            {[
              "Quote ID",
              "Trip ID",
              "Client",
              "Route",
              "Aircraft",
              "Status",
              "Margin",
              "Date",
              "",
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
            const legs = q.trips?.legs ?? [];
            const route =
              legs.length > 0
                ? `${legs[0]?.from_icao ?? "?"} → ${legs[legs.length - 1]?.to_icao ?? "?"}`
                : "—";

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
                <td
                  className="px-5 py-3 font-mono text-xs text-zinc-500"
                  title={q.trip_id}
                >
                  {q.trip_id?.slice(0, 8)}…
                </td>
                <td className="px-5 py-3 text-zinc-300">
                  {q.clients?.name ?? <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-5 py-3 font-mono text-xs text-zinc-400">
                  {route}
                </td>
                <td className="px-5 py-3 text-xs text-zinc-500">
                  {q.aircraft?.tail_number ?? "—"}
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
                <td className="px-5 py-3">
                  <button
                    onClick={() => setSelectedQuote(q)}
                    className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    More info →
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedQuote && (
        <QuoteDetailModal
          quote={selectedQuote}
          open={!!selectedQuote}
          onClose={() => setSelectedQuote(null)}
        />
      )}
    </>
  );
}
