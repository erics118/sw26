"use client";

import { useState } from "react";
import Link from "next/link";
import Badge, { statusVariant } from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";

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

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function money(n: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800 py-2 last:border-0">
      <span className="shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="text-right text-xs font-medium text-zinc-300">
        {value ?? "—"}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
      {children}
    </p>
  );
}

function QuoteDetailModal({
  quote,
  open,
  onClose,
}: {
  quote: QuoteRow;
  open: boolean;
  onClose: () => void;
}) {
  const legs = quote.trips?.legs ?? [];
  const route =
    legs.length > 0
      ? legs.map((l) => l.from_icao).join(" → ") +
        " → " +
        (legs[legs.length - 1]?.to_icao ?? "?")
      : null;

  const costs = quote.quote_costs?.[0] ?? null;
  const cur = quote.currency;

  const hasScheduled =
    quote.scheduled_departure_time ||
    quote.scheduled_arrival_time ||
    quote.scheduled_total_hours;

  const hasActuals =
    quote.actual_departure_time ||
    quote.actual_arrival_time ||
    quote.actual_block_hours ||
    quote.actual_total_hours;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Quote ${quote.id.slice(0, 8)}…`}
      size="lg"
    >
      <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
        {/* Status row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              statusVariant(quote.status) as
                | "amber"
                | "green"
                | "red"
                | "yellow"
                | "blue"
                | "zinc"
            }
          >
            {quote.status}
          </Badge>
          <span className="text-xs text-zinc-600">v{quote.version}</span>
          <span className="text-xs text-zinc-600">·</span>
          <span className="text-xs text-zinc-600">{quote.currency}</span>
          {route && (
            <>
              <span className="text-xs text-zinc-600">·</span>
              <span className="font-mono text-xs text-zinc-500">{route}</span>
            </>
          )}
          <Link
            href={`/quotes/${quote.id}`}
            className="ml-auto text-xs text-amber-400 transition-colors hover:text-amber-300"
          >
            Open full page →
          </Link>
        </div>

        {/* Overview */}
        <div>
          <SectionLabel>Overview</SectionLabel>
          <div>
            <DetailRow
              label="Full ID"
              value={<span className="font-mono text-[11px]">{quote.id}</span>}
            />
            <DetailRow label="Created" value={fmt(quote.created_at)} />
            <DetailRow label="Updated" value={fmt(quote.updated_at)} />
            {quote.sent_at && (
              <DetailRow label="Sent" value={fmt(quote.sent_at)} />
            )}
            {quote.confirmed_at && (
              <DetailRow label="Confirmed" value={fmt(quote.confirmed_at)} />
            )}
            {quote.quote_valid_until && (
              <DetailRow
                label="Valid until"
                value={fmtDate(quote.quote_valid_until)}
              />
            )}
          </div>
        </div>

        {/* Client & Assignment */}
        <div>
          <SectionLabel>Client & Assignment</SectionLabel>
          <div>
            <DetailRow label="Client" value={quote.clients?.name} />
            <DetailRow
              label="Aircraft"
              value={
                quote.aircraft?.tail_number
                  ? `${quote.aircraft.tail_number}${quote.aircraft.category ? ` (${quote.aircraft.category})` : ""}`
                  : null
              }
            />
            {quote.chosen_aircraft_category && (
              <DetailRow
                label="Chosen category"
                value={
                  <span className="capitalize">
                    {quote.chosen_aircraft_category}
                  </span>
                }
              />
            )}
            {quote.broker_name && (
              <DetailRow label="Broker" value={quote.broker_name} />
            )}
            {quote.broker_commission_pct != null && (
              <DetailRow
                label="Broker commission"
                value={`${quote.broker_commission_pct}%`}
              />
            )}
          </div>
        </div>

        {/* Financials */}
        {costs && (
          <div>
            <SectionLabel>Financials</SectionLabel>
            <div>
              <DetailRow label="Subtotal" value={money(costs.subtotal, cur)} />
              <DetailRow
                label={`Margin (${quote.margin_pct}%)`}
                value={money(costs.margin_amount, cur)}
              />
              <DetailRow label="Tax" value={money(costs.tax, cur)} />
              <DetailRow
                label="Total"
                value={
                  <span className="font-semibold text-zinc-100">
                    {money(costs.total, cur)}
                  </span>
                }
              />
            </div>

            {/* Cost breakdown */}
            <div className="mt-2 space-y-1 rounded-lg bg-zinc-800/50 p-3">
              <p className="mb-2 text-[10px] tracking-widest text-zinc-600 uppercase">
                Cost breakdown
              </p>
              {costs.fuel_cost > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Fuel</span>
                  <span className="tabnum text-zinc-400">
                    {money(costs.fuel_cost, cur)}
                  </span>
                </div>
              )}
              {costs.fbo_fees > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">FBO fees</span>
                  <span className="tabnum text-zinc-400">
                    {money(costs.fbo_fees, cur)}
                  </span>
                </div>
              )}
              {costs.repositioning_cost > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">
                    Repositioning ({costs.repositioning_hours.toFixed(1)} hrs)
                  </span>
                  <span className="tabnum text-zinc-400">
                    {money(costs.repositioning_cost, cur)}
                  </span>
                </div>
              )}
              {costs.permit_fees > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Permit fees</span>
                  <span className="tabnum text-zinc-400">
                    {money(costs.permit_fees, cur)}
                  </span>
                </div>
              )}
              {costs.crew_overnight_cost > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Crew overnight</span>
                  <span className="tabnum text-zinc-400">
                    {money(costs.crew_overnight_cost, cur)}
                  </span>
                </div>
              )}
              {costs.catering_cost > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Catering</span>
                  <span className="tabnum text-zinc-400">
                    {money(costs.catering_cost, cur)}
                  </span>
                </div>
              )}
              {costs.peak_day_surcharge > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Peak surcharge</span>
                  <span className="tabnum text-zinc-400">
                    {money(costs.peak_day_surcharge, cur)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scheduled flight */}
        {hasScheduled && (
          <div>
            <SectionLabel>Scheduled Flight</SectionLabel>
            <div>
              {quote.scheduled_departure_time && (
                <DetailRow
                  label="Departure"
                  value={fmt(quote.scheduled_departure_time)}
                />
              )}
              {quote.scheduled_arrival_time && (
                <DetailRow
                  label="Arrival"
                  value={fmt(quote.scheduled_arrival_time)}
                />
              )}
              {quote.scheduled_total_hours != null && (
                <DetailRow
                  label="Total hours"
                  value={`${quote.scheduled_total_hours.toFixed(1)} hrs`}
                />
              )}
              {quote.estimated_total_hours != null && (
                <DetailRow
                  label="Estimated hours"
                  value={`${quote.estimated_total_hours.toFixed(1)} hrs`}
                />
              )}
            </div>
          </div>
        )}

        {/* Post-flight actuals */}
        {hasActuals && (
          <div>
            <SectionLabel>Post-Flight Actuals</SectionLabel>
            <div>
              {quote.actual_departure_time && (
                <DetailRow
                  label="Actual departure"
                  value={fmt(quote.actual_departure_time)}
                />
              )}
              {quote.actual_arrival_time && (
                <DetailRow
                  label="Actual arrival"
                  value={fmt(quote.actual_arrival_time)}
                />
              )}
              {quote.actual_block_hours != null && (
                <DetailRow
                  label="Block hours"
                  value={`${quote.actual_block_hours.toFixed(1)} hrs`}
                />
              )}
              {quote.actual_reposition_hours != null && (
                <DetailRow
                  label="Reposition hours"
                  value={`${quote.actual_reposition_hours.toFixed(1)} hrs`}
                />
              )}
              {quote.actual_total_hours != null && (
                <DetailRow
                  label="Total hours"
                  value={`${quote.actual_total_hours.toFixed(1)} hrs`}
                />
              )}
              {quote.delay_reason_code && (
                <DetailRow
                  label="Delay reason"
                  value={quote.delay_reason_code}
                />
              )}
            </div>
          </div>
        )}

        {/* Internal */}
        {(quote.won_lost_reason || quote.notes) && (
          <div>
            <SectionLabel>Internal</SectionLabel>
            <div>
              {quote.won_lost_reason && (
                <DetailRow
                  label="Won / lost reason"
                  value={quote.won_lost_reason}
                />
              )}
            </div>
            {quote.notes && (
              <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                {quote.notes}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function QuoteTable({ quotes }: { quotes: QuoteRow[] }) {
  const [selectedQuote, setSelectedQuote] = useState<QuoteRow | null>(null);

  return (
    <>
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
