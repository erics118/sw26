"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";

export type AircraftRow = {
  id: string;
  tail_number: string;
  category: string;
  range_nm: number;
  pax_capacity: number;
  cabin_height_in: number | null;
  has_wifi: boolean;
  has_bathroom: boolean;
  home_base_icao: string | null;
  status: string;
  daily_available_hours: number;
  fuel_burn_gph: number | null;
  cruise_speed_kts: number | null;
  max_fuel_capacity_gal: number | null;
  min_runway_ft: number | null;
  etops_certified: boolean;
  max_payload_lbs: number | null;
  reserve_fuel_gal: number | null;
  notes: string | null;
};

export function AircraftGrid({ aircraft }: { aircraft: AircraftRow[] }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {aircraft.map((a) => (
        <Link key={a.id} href={`/aircraft/${a.id}`} className="group block">
          <Card className="transition-colors hover:border-zinc-700">
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
            </div>

            <div className="mt-3 flex items-center gap-2">
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
              <span className="ml-auto text-xs text-zinc-500 transition-colors group-hover:text-zinc-300">
                View details →
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
