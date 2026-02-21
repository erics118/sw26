import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Badge, { statusVariant } from "@/components/ui/Badge";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import StatusStepper from "@/components/ui/StatusStepper";
import QuoteStatusUpdate from "@/components/Quotes/QuoteStatusUpdate";
import CostBreakdown from "@/components/ui/CostBreakdown";
import type { RoutePlan } from "@/lib/database.types";
import RoutePlanSection from "@/components/Quotes/RoutePlanSection";

interface PageProps {
  params: Promise<{ id: string }>;
}

type QuoteDetail = {
  id: string;
  status: string;
  version: number;
  currency: string;
  margin_pct: number;
  broker_name: string | null;
  broker_commission_pct: number | null;
  quote_valid_until: string | null;
  estimated_total_hours: number | null;
  won_lost_reason: string | null;
  created_at: string;
  trip_id: string;
  notes: string | null;
  clients: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  aircraft: {
    tail_number: string;
    category: string;
    range_nm: number;
  } | null;
  trips: {
    legs: Array<{
      from_icao: string;
      to_icao: string;
      date: string;
      time: string;
    }>;
    trip_type: string;
    pax_adults: number;
    flexibility_hours?: number;
    flexibility_hours_return?: number;
  } | null;
  quote_costs: Array<{
    fuel_cost: number;
    fbo_fees: number;
    repositioning_cost: number;
    repositioning_hours: number;
    permit_fees: number;
    crew_overnight_cost: number;
    catering_cost: number;
    peak_day_surcharge: number;
    subtotal: number;
    margin_amount: number;
    tax: number;
    total: number;
  }> | null;
};

export default async function QuoteDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: rawQuote }, { data: rawRoutePlan }, { data: rawAuditLog }] =
    await Promise.all([
      supabase
        .from("quotes")
        .select(
          `
        *,
        clients(*),
        aircraft(*),
        trips(*),
        quote_costs(*)
      `,
        )
        .eq("id", id)
        .single(),
      supabase
        .from("route_plans")
        .select("*")
        .eq("quote_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("audit_logs")
        .select("payload")
        .eq("entity_type", "quotes")
        .eq("entity_id", id)
        .eq("action", "quote.created")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const quote = rawQuote as unknown as QuoteDetail | null;
  const routePlan = rawRoutePlan as unknown as RoutePlan | null;
  const auditPayload = (
    rawAuditLog as { payload?: Record<string, unknown> } | null
  )?.payload;
  const selectionReasoning =
    auditPayload &&
    typeof auditPayload.aircraft_explanation === "string" &&
    typeof auditPayload.route_explanation === "string"
      ? {
          aircraft_explanation: auditPayload.aircraft_explanation as string,
          route_explanation: auditPayload.route_explanation as string,
          optimization_mode: auditPayload.optimization_mode as
            | string
            | undefined,
        }
      : null;

  if (!quote) notFound();

  const client = quote.clients;
  const aircraft = quote.aircraft;
  const trip = quote.trips;
  const costs = (quote.quote_costs ?? [])[0] ?? null;

  const legs = trip?.legs ?? [];
  const route =
    legs.length > 0
      ? legs
          .map((l) => l.from_icao)
          .concat([legs[legs.length - 1]?.to_icao ?? ""])
          .join(" → ")
      : "No legs";

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/quotes"
              className="text-xs text-zinc-600 hover:text-zinc-400"
            >
              ← Quotes
            </Link>
            <span className="text-zinc-700">/</span>
            <span className="font-mono text-xs text-zinc-500">
              {id.slice(0, 8)}…
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">{route}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {client?.name ?? "No client"} · v{quote.version} · {quote.currency}
          </p>
        </div>
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
          size="md"
        >
          {quote.status}
        </Badge>
      </div>

      {/* Status stepper + update */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4">
          <StatusStepper status={quote.status} />
          {quote.status !== "lost" && quote.status !== "completed" && (
            <QuoteStatusUpdate
              quoteId={quote.id}
              currentStatus={quote.status}
            />
          )}
        </div>
      </Card>

      {/* AI selection reasoning (collapsible) */}
      {selectionReasoning && (
        <Card className="mb-6 border-amber-400/20 bg-amber-400/5">
          <details className="group">
            <summary className="cursor-pointer list-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Why we chose this</CardTitle>
                <span className="text-xs text-zinc-500 transition-transform group-open:rotate-180">
                  ▼
                </span>
              </CardHeader>
            </summary>
            <div className="space-y-3 px-6 pb-6 text-sm">
              <div>
                <span className="text-zinc-500">Aircraft: </span>
                <span className="text-zinc-300">
                  {selectionReasoning.aircraft_explanation}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">
                  Route ({selectionReasoning.optimization_mode ?? "balanced"}
                  ):{" "}
                </span>
                <span className="text-zinc-300">
                  {selectionReasoning.route_explanation}
                </span>
              </div>
            </div>
          </details>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* Cost breakdown */}
        <div className="col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <span className="tabnum text-lg font-bold text-amber-400">
                {costs
                  ? new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: quote.currency,
                    }).format(costs.total)
                  : "Not priced"}
              </span>
            </CardHeader>
            {costs ? (
              <CostBreakdown
                fuelCost={costs.fuel_cost}
                fboFees={costs.fbo_fees}
                repositioningCost={costs.repositioning_cost}
                repositioningHours={costs.repositioning_hours}
                permitFees={costs.permit_fees}
                crewOvernightCost={costs.crew_overnight_cost}
                cateringCost={costs.catering_cost}
                peakDaySurcharge={costs.peak_day_surcharge}
                subtotal={costs.subtotal}
                marginPct={quote.margin_pct}
                marginAmount={costs.margin_amount}
                tax={costs.tax}
                total={costs.total}
                currency={quote.currency}
              />
            ) : (
              <p className="text-sm text-zinc-600">
                No pricing data yet.{" "}
                <Link
                  href={`/quotes/new?trip_id=${quote.trip_id}`}
                  className="text-amber-400 hover:text-amber-300"
                >
                  Run pricing engine →
                </Link>
              </p>
            )}
          </Card>

          {/* Route Plan */}
          {routePlan && (
            <RoutePlanSection
              routePlan={routePlan}
              tripId={quote.trip_id}
              currency={quote.currency}
            />
          )}

          {/* Trip legs */}
          {legs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Legs</CardTitle>
                {(trip?.flexibility_hours ?? 0) > 0 ||
                (trip?.flexibility_hours_return ?? 0) > 0 ? (
                  <span className="text-xs text-zinc-500">
                    Flex: dep ±{trip?.flexibility_hours ?? 0}h
                    {["round_trip", "multi_leg"].includes(
                      trip?.trip_type ?? "",
                    ) && (trip?.flexibility_hours_return ?? 0) > 0
                      ? `, ret ±${trip?.flexibility_hours_return ?? 0}h`
                      : ""}
                  </span>
                ) : null}
              </CardHeader>
              <div className="space-y-2">
                {legs.map((leg, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 rounded-md bg-zinc-800/40 px-4 py-3"
                  >
                    <span className="font-mono text-lg font-semibold text-amber-400">
                      {leg.from_icao}
                    </span>
                    <span className="text-zinc-600">→</span>
                    <span className="font-mono text-lg font-semibold text-amber-400">
                      {leg.to_icao}
                    </span>
                    <span className="ml-auto font-mono text-xs text-zinc-500">
                      {leg.date} {leg.time}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar details */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Client</CardTitle>
            </CardHeader>
            {client ? (
              <div className="space-y-2 text-sm">
                <p className="font-medium text-zinc-200">{client.name}</p>
                {client.email && (
                  <p className="text-zinc-500">{client.email}</p>
                )}
                {client.phone && (
                  <p className="text-zinc-500">{client.phone}</p>
                )}
                <Link
                  href={`/clients/${client.id}`}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  View profile →
                </Link>
              </div>
            ) : (
              <p className="text-sm text-zinc-600">No client linked</p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aircraft</CardTitle>
            </CardHeader>
            {aircraft ? (
              <div className="space-y-1.5 text-sm">
                <p className="font-mono text-base font-semibold text-zinc-200">
                  {aircraft.tail_number}
                </p>
                <p className="text-zinc-500 capitalize">{aircraft.category}</p>
                <p className="text-zinc-500">
                  {aircraft.range_nm.toLocaleString()} nm range
                </p>
              </div>
            ) : (
              <p className="text-sm text-zinc-600">No aircraft assigned</p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quote Details</CardTitle>
            </CardHeader>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-600">Margin</span>
                <span className="tabnum text-zinc-300">
                  {quote.margin_pct}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-600">Version</span>
                <span className="tabnum text-zinc-300">v{quote.version}</span>
              </div>
              {quote.broker_name && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Broker</span>
                  <span className="text-zinc-300">{quote.broker_name}</span>
                </div>
              )}
              {quote.broker_commission_pct != null && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Broker commission</span>
                  <span className="tabnum text-zinc-300">
                    {quote.broker_commission_pct}%
                  </span>
                </div>
              )}
              {quote.quote_valid_until && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Valid until</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(quote.quote_valid_until).toLocaleDateString()}
                  </span>
                </div>
              )}
              {quote.estimated_total_hours != null && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Est. total hours</span>
                  <span className="tabnum text-zinc-300">
                    {quote.estimated_total_hours} hrs
                  </span>
                </div>
              )}
              {quote.won_lost_reason && quote.status === "lost" && (
                <div className="flex justify-between">
                  <span className="text-zinc-600">Lost reason</span>
                  <span className="text-zinc-300 capitalize">
                    {quote.won_lost_reason.replace("_", " ")}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-600">Created</span>
                <span className="text-xs text-zinc-500">
                  {new Date(quote.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </Card>

          {quote.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <p className="text-sm leading-relaxed text-zinc-400">
                {quote.notes}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
