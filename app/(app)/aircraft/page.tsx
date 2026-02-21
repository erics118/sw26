import { createClient } from "@/lib/supabase/server";
import Card from "@/components/ui/Card";

type AircraftRow = {
  id: string;
  tail_number: string;
  category: string;
  range_nm: number;
  pax_capacity: number;
  cabin_height_in: number | null;
  has_wifi: boolean;
  has_bathroom: boolean;
  home_base_icao: string | null;
  operators: { name: string } | null;
};

export default async function AircraftPage() {
  const supabase = await createClient();

  const { data: rawAircraft } = await supabase
    .from("aircraft")
    .select(
      "id, tail_number, category, range_nm, pax_capacity, cabin_height_in, has_wifi, has_bathroom, home_base_icao, operators(name)",
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Fleet</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {aircraft?.length ?? 0} aircraft
        </p>
      </div>

      {!sorted.length ? (
        <Card>
          <p className="py-8 text-center text-sm text-zinc-600">
            No aircraft in fleet.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {sorted.map((a) => {
            const op = a.operators;
            return (
              <Card key={a.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-xl font-bold text-zinc-100">
                      {a.tail_number}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 capitalize">
                      {a.category}
                    </p>
                  </div>
                  {a.home_base_icao && (
                    <span className="font-mono text-xs text-zinc-600">
                      {a.home_base_icao}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-zinc-600">Range</span>
                    <p className="tabnum font-medium text-zinc-300">
                      {a.range_nm.toLocaleString()} nm
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-600">Capacity</span>
                    <p className="tabnum font-medium text-zinc-300">
                      {a.pax_capacity} pax
                    </p>
                  </div>
                  {a.cabin_height_in && (
                    <div>
                      <span className="text-zinc-600">Cabin height</span>
                      <p className="tabnum font-medium text-zinc-300">
                        {a.cabin_height_in}&quot;
                      </p>
                    </div>
                  )}
                  {op && (
                    <div className="col-span-2">
                      <span className="text-zinc-600">Operator</span>
                      <p className="font-medium text-zinc-300">{op.name}</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  {a.has_wifi && (
                    <span className="rounded border border-sky-400/20 bg-sky-400/5 px-2 py-0.5 text-xs text-sky-400">
                      wifi
                    </span>
                  )}
                  {a.has_bathroom && (
                    <span className="rounded border border-zinc-600/40 bg-zinc-700/20 px-2 py-0.5 text-xs text-zinc-400">
                      lavatory
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
