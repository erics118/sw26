import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Aircraft } from "@/lib/database.types";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  active: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  maintenance: "border-amber-400/30 bg-amber-400/10 text-amber-400",
  inactive: "border-zinc-600/40 bg-zinc-700/20 text-zinc-500",
};

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

  const statusStyle =
    STATUS_STYLES[aircraft.status] ?? STATUS_STYLES["inactive"];

  return (
    <div className="p-8">
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
          <div className="flex gap-2">
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
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Performance */}
        <div className="col-span-2">
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
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
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
                value={aircraft.has_wifi ? "Yes" : "No"}
              />
              <DetailRow
                label="Lavatory"
                value={aircraft.has_bathroom ? "Yes" : "No"}
              />
            </div>
          </Card>

          {(aircraft.fuel_burn_gph ||
            aircraft.max_fuel_capacity_gal ||
            aircraft.reserve_fuel_gal ||
            aircraft.max_payload_lbs) && (
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
              </div>
            </Card>
          )}

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
