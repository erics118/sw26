import { formatFlightTime } from "@/lib/format";

// Minimal display types — structural subset of what RoutePlanResult provides
interface RouteLegDisplay {
  from_icao: string;
  to_icao: string;
  distance_nm: number;
  flight_time_hr: number;
  is_fuel_stop_leg: boolean;
}

interface RefuelStopDisplay {
  icao: string;
  airport_name: string;
  fuel_price_usd_gal: number;
  fuel_uplift_gal: number;
  fuel_cost_usd: number;
  fbo_fee_usd: number;
  ground_time_min: number;
  customs: boolean;
  deicing: boolean;
  reason: string;
}

interface WeatherDisplay {
  icao: string;
  go_nogo: "go" | "marginal" | "nogo";
}

interface NotamDisplay {
  notam_id: string;
  icao: string;
  type: string;
  severity: "info" | "caution" | "critical";
  raw_text: string;
}

export interface RoutePlanDisplayData {
  route_legs: RouteLegDisplay[];
  refuel_stops: RefuelStopDisplay[];
  weather_summary: WeatherDisplay[];
  notam_alerts: NotamDisplay[];
}

export default function RoutePlanDetail({
  plan,
}: {
  plan: RoutePlanDisplayData;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {plan.route_legs.map((leg, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded bg-zinc-800/40 px-3 py-2 text-sm"
          >
            <span className="font-mono text-amber-400">{leg.from_icao}</span>
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
      {plan.refuel_stops.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">
            Refuel Stops
          </p>
          <div className="space-y-1.5">
            {plan.refuel_stops.map((stop, i) => (
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
      {plan.weather_summary.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">Weather</p>
          <div className="flex flex-wrap gap-2">
            {plan.weather_summary.map((w) => (
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
      {plan.notam_alerts.filter((n) => n.severity !== "info").length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">NOTAMs</p>
          <div className="space-y-1">
            {plan.notam_alerts
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
    </div>
  );
}
