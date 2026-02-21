import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Badge, { statusVariant } from "@/components/ui/Badge";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import StatusStepper from "@/components/ui/StatusStepper";
import CostBreakdown from "@/components/ui/CostBreakdown";
import type { RoutePlan } from "@/lib/database.types";

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

  const [{ data: rawQuote }, { data: rawRoutePlan }] = await Promise.all([
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
  ]);

  const quote = rawQuote as unknown as QuoteDetail | null;
  const routePlan = rawRoutePlan as unknown as RoutePlan | null;

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

      {/* Status stepper */}
      <Card className="mb-6">
        <StatusStepper status={quote.status} />
      </Card>

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
          {routePlan ? (
            <Card>
              <CardHeader>
                <CardTitle>Route Plan</CardTitle>
                <div className="flex items-center gap-2">
                  {routePlan.is_stale && (
                    <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                      stale
                    </span>
                  )}
                  <span className="text-xs text-zinc-500 capitalize">
                    {routePlan.optimization_mode}-optimized
                  </span>
                </div>
              </CardHeader>
              <div className="space-y-4">
                {/* Summary stats */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    {
                      label: "Distance",
                      value: routePlan.total_distance_nm
                        ? `${routePlan.total_distance_nm.toLocaleString()} nm`
                        : "—",
                    },
                    {
                      label: "Flight time",
                      value: routePlan.total_flight_time_hr
                        ? `${routePlan.total_flight_time_hr.toFixed(1)} hr`
                        : "—",
                    },
                    {
                      label: "Risk score",
                      value:
                        routePlan.risk_score != null
                          ? `${routePlan.risk_score}/100`
                          : "—",
                      highlight:
                        routePlan.risk_score != null
                          ? routePlan.risk_score < 30
                            ? "text-emerald-400"
                            : routePlan.risk_score < 60
                              ? "text-amber-400"
                              : "text-red-400"
                          : undefined,
                    },
                    {
                      label: "On-time",
                      value:
                        routePlan.on_time_probability != null
                          ? `${(routePlan.on_time_probability * 100).toFixed(0)}%`
                          : "—",
                    },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="rounded bg-zinc-800/40 px-3 py-2 text-center"
                    >
                      <p className="text-xs text-zinc-600">{s.label}</p>
                      <p
                        className={`tabnum mt-0.5 text-sm font-semibold ${s.highlight ?? "text-zinc-200"}`}
                      >
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Route legs */}
                {Array.isArray(routePlan.route_legs) && (
                  <div className="space-y-1">
                    {(
                      routePlan.route_legs as Array<{
                        from_icao: string;
                        to_icao: string;
                        distance_nm: number;
                        flight_time_hr: number;
                        is_fuel_stop_leg: boolean;
                      }>
                    ).map((leg, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded bg-zinc-800/40 px-3 py-2 text-sm"
                      >
                        <span className="font-mono text-amber-400">
                          {leg.from_icao}
                        </span>
                        <span className="text-zinc-700">→</span>
                        <span className="font-mono text-amber-400">
                          {leg.to_icao}
                        </span>
                        {leg.is_fuel_stop_leg && (
                          <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-400">
                            fuel stop
                          </span>
                        )}
                        <span className="tabnum ml-auto text-xs text-zinc-500">
                          {leg.distance_nm} nm · {leg.flight_time_hr.toFixed(1)}{" "}
                          hr
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Refuel stops */}
                {Array.isArray(routePlan.refuel_stops) &&
                  (
                    routePlan.refuel_stops as Array<{
                      icao: string;
                      airport_name: string;
                      fuel_price_usd_gal: number;
                      fuel_uplift_gal: number;
                      fbo_fee_usd: number;
                      ground_time_min: number;
                    }>
                  ).length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-zinc-500">
                        Refuel Stops
                      </p>
                      <div className="space-y-1.5">
                        {(
                          routePlan.refuel_stops as Array<{
                            icao: string;
                            airport_name: string;
                            fuel_price_usd_gal: number;
                            fuel_uplift_gal: number;
                            fbo_fee_usd: number;
                            ground_time_min: number;
                            customs: boolean;
                            deicing: boolean;
                          }>
                        ).map((stop, i) => (
                          <div
                            key={i}
                            className="rounded border border-zinc-800 px-3 py-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-semibold text-zinc-200">
                                {stop.icao}
                              </span>
                              <span className="text-zinc-500">
                                {stop.airport_name}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-3 text-zinc-600">
                              <span>
                                ${stop.fuel_price_usd_gal.toFixed(2)}/gal
                              </span>
                              <span>{stop.fuel_uplift_gal} gal</span>
                              <span>${stop.fbo_fee_usd} FBO</span>
                              <span>{stop.ground_time_min} min ground</span>
                              {stop.customs && (
                                <span className="text-emerald-600">
                                  customs
                                </span>
                              )}
                              {stop.deicing && (
                                <span className="text-blue-600">deicing</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Weather */}
                {Array.isArray(routePlan.weather_summary) &&
                  (routePlan.weather_summary as Array<unknown>).length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-zinc-500">
                        Weather
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(
                          routePlan.weather_summary as Array<{
                            icao: string;
                            go_nogo: "go" | "marginal" | "nogo";
                          }>
                        ).map((w) => (
                          <div
                            key={w.icao}
                            className="flex items-center gap-1.5 rounded bg-zinc-800/40 px-2 py-1 text-xs"
                          >
                            <span className="font-mono text-zinc-400">
                              {w.icao}
                            </span>
                            <span
                              className={`rounded px-1 py-0.5 text-xs font-medium ${
                                w.go_nogo === "go"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : w.go_nogo === "marginal"
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-red-500/10 text-red-400"
                              }`}
                            >
                              {w.go_nogo}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* NOTAMs */}
                {Array.isArray(routePlan.notam_alerts) &&
                  (
                    routePlan.notam_alerts as Array<{
                      severity: string;
                    }>
                  ).filter((n) => n.severity !== "info").length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-zinc-500">
                        NOTAMs
                      </p>
                      <div className="space-y-1">
                        {(
                          routePlan.notam_alerts as Array<{
                            icao: string;
                            type: string;
                            severity: string;
                            raw_text: string;
                          }>
                        )
                          .filter((n) => n.severity !== "info")
                          .slice(0, 5)
                          .map((n, i) => (
                            <div
                              key={i}
                              className={`rounded px-2 py-1.5 text-xs ${
                                n.severity === "critical"
                                  ? "bg-red-500/10 text-red-400"
                                  : "bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              <span className="font-mono">{n.icao}</span> ·{" "}
                              {n.type.replace("_", " ")} —{" "}
                              <span className="text-zinc-500">
                                {n.raw_text.slice(0, 80)}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                <div className="flex items-center justify-between text-xs text-zinc-600">
                  <span>
                    Computed {new Date(routePlan.computed_at).toLocaleString()}
                  </span>
                  {routePlan.is_stale && (
                    <Link
                      href={`/quotes/new?trip_id=${quote.trip_id}`}
                      className="text-amber-400 hover:text-amber-300"
                    >
                      Re-plan →
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ) : null}

          {/* Trip legs */}
          {legs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Legs</CardTitle>
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
