import Link from "next/link";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import { formatFlightTime } from "@/lib/format";
import type { RoutePlan } from "@/lib/database.types";

interface Props {
  routePlan: RoutePlan;
  tripId: string;
  currency: string;
}

export default function RoutePlanSection({
  routePlan,
  tripId,
  currency: _currency,
}: Props) {
  return (
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
                ? formatFlightTime(routePlan.total_flight_time_hr)
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
                <span className="font-mono text-amber-400">{leg.to_icao}</span>
                {leg.is_fuel_stop_leg && (
                  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-400">
                    fuel stop
                  </span>
                )}
                <span className="tabnum ml-auto text-xs text-zinc-500">
                  {leg.distance_nm} nm · {formatFlightTime(leg.flight_time_hr)}
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
                      <span className="text-zinc-500">{stop.airport_name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-zinc-600">
                      <span>${stop.fuel_price_usd_gal.toFixed(2)}/gal</span>
                      <span>{stop.fuel_uplift_gal} gal</span>
                      <span>${stop.fbo_fee_usd} FBO</span>
                      <span>{stop.ground_time_min} min ground</span>
                      {stop.customs && (
                        <span className="text-emerald-600">customs</span>
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
                    <span className="font-mono text-zinc-400">{w.icao}</span>
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
          (routePlan.notam_alerts as Array<{ severity: string }>).filter(
            (n) => n.severity !== "info",
          ).length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-zinc-500">NOTAMs</p>
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
              href={`/quotes/new?trip_id=${tripId}`}
              className="text-amber-400 hover:text-amber-300"
            >
              Re-plan →
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
