"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";

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
  operators: { name: string } | null;
};

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

function AircraftDetailModal({
  aircraft,
  open,
  onClose,
}: {
  aircraft: AircraftRow;
  open: boolean;
  onClose: () => void;
}) {
  const statusStyle =
    STATUS_STYLES[aircraft.status] ?? STATUS_STYLES["inactive"];

  return (
    <Modal open={open} onClose={onClose} title={aircraft.tail_number} size="md">
      <div className="space-y-5">
        {/* Header badges */}
        <div className="flex items-center gap-2">
          <span
            className={`rounded border px-2 py-0.5 text-xs font-medium capitalize ${statusStyle}`}
          >
            {aircraft.status}
          </span>
          <span className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 capitalize">
            {aircraft.category}
          </span>
          {aircraft.home_base_icao && (
            <span className="ml-auto font-mono text-xs text-zinc-500">
              {aircraft.home_base_icao}
            </span>
          )}
        </div>

        {/* Performance */}
        <div>
          <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Performance
          </p>
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
        </div>

        {/* Weight & Fuel */}
        {(aircraft.fuel_burn_gph ||
          aircraft.max_fuel_capacity_gal ||
          aircraft.reserve_fuel_gal ||
          aircraft.max_payload_lbs) && (
          <div>
            <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
              Weight & Fuel
            </p>
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
          </div>
        )}

        {/* Capabilities & Availability */}
        <div>
          <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
            Capabilities & Availability
          </p>
          <div>
            <DetailRow
              label="Daily available hours"
              value={`${aircraft.daily_available_hours} hrs`}
            />
            <DetailRow
              label="ETOPS certified"
              value={aircraft.etops_certified ? "Yes" : "No"}
            />
            <DetailRow label="Wi-Fi" value={aircraft.has_wifi ? "Yes" : "No"} />
            <DetailRow
              label="Lavatory"
              value={aircraft.has_bathroom ? "Yes" : "No"}
            />
          </div>
        </div>

        {/* Operator */}
        {aircraft.operators && (
          <div>
            <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
              Operator
            </p>
            <p className="text-sm text-zinc-300">{aircraft.operators.name}</p>
          </div>
        )}

        {/* Notes */}
        {aircraft.notes && (
          <div>
            <p className="mb-1 text-[10px] font-semibold tracking-widest text-zinc-600 uppercase">
              Notes
            </p>
            <p className="text-xs leading-relaxed text-zinc-400">
              {aircraft.notes}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AircraftGrid({ aircraft }: { aircraft: AircraftRow[] }) {
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftRow | null>(
    null,
  );

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        {aircraft.map((a) => {
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
                <button
                  onClick={() => setSelectedAircraft(a)}
                  className="ml-auto text-xs text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  More info →
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {selectedAircraft && (
        <AircraftDetailModal
          aircraft={selectedAircraft}
          open={!!selectedAircraft}
          onClose={() => setSelectedAircraft(null)}
        />
      )}
    </>
  );
}
