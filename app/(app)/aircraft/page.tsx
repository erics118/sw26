import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Card from "@/components/ui/Card";
import { AircraftGrid } from "@/components/Aircraft/AircraftGrid";
import type { AircraftRow } from "@/components/Aircraft/AircraftGrid";

export default async function AircraftPage() {
  const supabase = await createClient();

  const { data: rawAircraft } = await supabase
    .from("aircraft")
    .select(
      "id, tail_number, category, range_nm, pax_capacity, cabin_height_in, has_wifi, has_bathroom, home_base_icao, status, daily_available_hours, fuel_burn_gph, cruise_speed_kts, max_fuel_capacity_gal, min_runway_ft, etops_certified, max_payload_lbs, reserve_fuel_gal, notes",
    )
    .order("tail_number");

  const aircraft = rawAircraft as unknown as AircraftRow[] | null;

  const categoryOrder = [
    "turboprop",
    "light",
    "midsize",
    "super-mid",
    "heavy",
    "ultra-long",
  ];
  const sorted = [...(aircraft ?? [])].sort(
    (a, b) =>
      categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category),
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Fleet</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {aircraft?.length ?? 0} aircraft
          </p>
        </div>
        <Link
          href="/aircraft/new"
          className="rounded-md bg-amber-400 px-4 py-2 font-semibold text-zinc-950 transition-colors hover:bg-amber-300"
        >
          + Add Aircraft
        </Link>
      </div>

      {!sorted.length ? (
        <Card>
          <p className="py-8 text-center text-sm text-zinc-600">
            No aircraft in fleet.
          </p>
        </Card>
      ) : (
        <AircraftGrid aircraft={sorted} />
      )}
    </div>
  );
}
