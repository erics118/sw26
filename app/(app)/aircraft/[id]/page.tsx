import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Aircraft } from "@/lib/database.types";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import DeleteAircraftButton from "@/components/aircraft/DeleteAircraftButton";

interface PageProps {
  params: Promise<{ id: string }>;
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
        {value}
      </span>
    </div>
  );
}

export default async function AircraftDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rawAircraft } = await supabase
    .from("aircraft")
    .select("*")
    .eq("id", id)
    .single();

  const aircraft = rawAircraft as unknown as Aircraft | null;

  if (!aircraft) notFound();

  const statusStyles: Record<string, string> = {
    active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    maintenance: "border-amber-400/30 bg-amber-400/10 text-amber-400",
    inactive: "border-zinc-600/40 bg-zinc-700/20 text-zinc-500",
  };
  const statusStyle = statusStyles[aircraft.status] ?? statusStyles["inactive"];

  return (
    <div className="mx-auto max-w-5xl p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <Link
            href="/aircraft"
            className="text-xs text-zinc-600 hover:text-zinc-400"
          >
            ← Fleet
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="font-mono text-xs text-zinc-500">
            {aircraft.tail_number}
          </span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-2xl font-semibold text-zinc-100">
              {aircraft.tail_number}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 capitalize">
              {aircraft.category}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded border px-2.5 py-1 text-xs font-medium capitalize ${statusStyle}`}
            >
              {aircraft.status}
            </span>
            {aircraft.home_base_icao && (
              <span className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 font-mono text-xs text-zinc-400">
                {aircraft.home_base_icao}
              </span>
            )}
            <DeleteAircraftButton
              aircraftId={aircraft.id}
              tailNumber={aircraft.tail_number}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
            </CardHeader>
            <div>
              <DetailRow
                label="Range"
                value={`${aircraft.range_nm.toLocaleString()} nm`}
              />
              {aircraft.cruise_speed_kts && (
                <DetailRow
                  label="Cruise speed"
                  value={`${aircraft.cruise_speed_kts} kts`}
                />
              )}
              <DetailRow
                label="Passenger capacity"
                value={`${aircraft.pax_capacity} pax`}
              />
              {aircraft.cabin_height_in && (
                <DetailRow
                  label="Cabin height"
                  value={`${aircraft.cabin_height_in}"`}
                />
              )}
              {aircraft.min_runway_ft && (
                <DetailRow
                  label="Min runway"
                  value={`${aircraft.min_runway_ft.toLocaleString()} ft`}
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capabilities & Availability</CardTitle>
            </CardHeader>
            <div>
              <DetailRow
                label="Daily available hours"
                value={`${aircraft.daily_available_hours} hrs`}
              />
              <DetailRow
                label="ETOPS certified"
                value={aircraft.etops_certified ? "Yes" : "No"}
              />
              <DetailRow
                label="Wi-Fi"
                value={
                  aircraft.has_wifi ? (
                    <span className="rounded border border-sky-400/20 bg-sky-400/5 px-2 py-0.5 text-xs text-sky-400">
                      Yes
                    </span>
                  ) : (
                    "No"
                  )
                }
              />
              <DetailRow
                label="Lavatory"
                value={
                  aircraft.has_bathroom ? (
                    <span className="rounded border border-zinc-600/40 bg-zinc-700/20 px-2 py-0.5 text-xs text-zinc-400">
                      Yes
                    </span>
                  ) : (
                    "No"
                  )
                }
              />
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Weight & Fuel</CardTitle>
            </CardHeader>
            <div>
              {aircraft.max_payload_lbs && (
                <DetailRow
                  label="Max payload"
                  value={`${aircraft.max_payload_lbs.toLocaleString()} lbs`}
                />
              )}
              {aircraft.fuel_burn_gph && (
                <DetailRow
                  label="Fuel burn"
                  value={`${aircraft.fuel_burn_gph} gph`}
                />
              )}
              {aircraft.max_fuel_capacity_gal && (
                <DetailRow
                  label="Fuel capacity"
                  value={`${aircraft.max_fuel_capacity_gal.toLocaleString()} gal`}
                />
              )}
              {aircraft.reserve_fuel_gal && (
                <DetailRow
                  label="Reserve fuel"
                  value={`${aircraft.reserve_fuel_gal} gal`}
                />
              )}
              {!aircraft.fuel_burn_gph &&
                !aircraft.max_fuel_capacity_gal &&
                !aircraft.reserve_fuel_gal &&
                !aircraft.max_payload_lbs && (
                  <p className="py-2 text-xs text-zinc-500">—</p>
                )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <div>
              <DetailRow
                label="Added"
                value={new Date(aircraft.created_at).toLocaleDateString()}
              />
            </div>
          </Card>

          {aircraft.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <p className="text-sm leading-relaxed text-zinc-400">
                {aircraft.notes}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
