import Button from "@/components/ui/Button";
import ConfidenceChip from "@/components/ui/ConfidenceChip";
import FieldInput from "./FieldInput";
import type { Extracted, TripLeg } from "@/app/(app)/intake/page";

interface Props {
  ex: Extracted;
  conf: Record<string, number>;
  onUpdateEx: <K extends keyof Extracted>(key: K, value: Extracted[K]) => void;
  onUpdateLeg: (idx: number, field: keyof TripLeg, value: string) => void;
  onSave: () => void;
  saving: boolean;
}

export default function ExtractedTripForm({
  ex,
  conf,
  onUpdateEx,
  onUpdateLeg,
  onSave,
  saving,
}: Props) {
  return (
    <div className="slide-in space-y-4">
      {/* Route / Legs */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            Route
          </h3>
          <ConfidenceChip score={conf["legs"]} label />
        </div>
        {ex.legs.map((leg: TripLeg, i: number) => (
          <div key={i} className="mb-3 grid grid-cols-4 gap-2">
            <input
              value={leg.from_icao}
              onChange={(e) => onUpdateLeg(i, "from_icao", e.target.value)}
              placeholder="XXXX"
              className="amber-glow rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-center font-mono text-sm text-amber-400 focus:border-amber-400"
            />
            <div className="flex items-center justify-center text-zinc-600">
              →
            </div>
            <input
              value={leg.to_icao}
              onChange={(e) => onUpdateLeg(i, "to_icao", e.target.value)}
              placeholder="XXXX"
              className="amber-glow rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-center font-mono text-sm text-amber-400 focus:border-amber-400"
            />
            <input
              value={leg.date}
              onChange={(e) => onUpdateLeg(i, "date", e.target.value)}
              type="date"
              className="amber-glow rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 font-mono text-xs text-zinc-300 focus:border-amber-400"
            />
          </div>
        ))}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="text-xs text-zinc-600">Type:</span>
          <select
            value={ex.trip_type}
            onChange={(e) => onUpdateEx("trip_type", e.target.value)}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
          >
            {["one_way", "round_trip", "multi_leg"].map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
          <span className="text-xs text-zinc-600">Flex dep:</span>
          <input
            type="number"
            min={0}
            value={ex.flexibility_hours}
            onChange={(e) =>
              onUpdateEx("flexibility_hours", parseInt(e.target.value) || 0)
            }
            className="w-12 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
          />
          <span className="text-xs text-zinc-600">hrs</span>
          {(ex.trip_type === "round_trip" || ex.trip_type === "multi_leg") && (
            <>
              <span className="text-xs text-zinc-600">Flex ret:</span>
              <input
                type="number"
                min={0}
                value={ex.flexibility_hours_return ?? 0}
                onChange={(e) =>
                  onUpdateEx(
                    "flexibility_hours_return",
                    parseInt(e.target.value) || 0,
                  )
                }
                className="w-12 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300"
              />
              <span className="text-xs text-zinc-600">hrs</span>
            </>
          )}
        </div>
      </div>

      {/* Passengers */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          Passengers
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <FieldInput
            label="Adults"
            value={String(ex.pax_adults)}
            onChange={(v) => onUpdateEx("pax_adults", parseInt(v) || 1)}
            confidence={conf["pax_adults"]}
            type="number"
          />
          <FieldInput
            label="Children"
            value={String(ex.pax_children)}
            onChange={(v) => onUpdateEx("pax_children", parseInt(v) || 0)}
            confidence={conf["pax_children"]}
            type="number"
          />
          <FieldInput
            label="Pets"
            value={String(ex.pax_pets)}
            onChange={(v) => onUpdateEx("pax_pets", parseInt(v) || 0)}
            confidence={conf["pax_pets"]}
            type="number"
          />
        </div>
      </div>

      {/* Aircraft prefs */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          Aircraft Preferences
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                Category
              </label>
              <ConfidenceChip score={conf["preferred_category"]} label />
            </div>
            <select
              value={ex.preferred_category ?? ""}
              onChange={(e) =>
                onUpdateEx("preferred_category", e.target.value || null)
              }
              className="amber-glow w-full rounded border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">Any</option>
              {[
                "turboprop",
                "light",
                "midsize",
                "super-mid",
                "heavy",
                "ultra-long",
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <FieldInput
            label="Min Cabin Height (in)"
            value={String(ex.min_cabin_height_in ?? "")}
            onChange={(v) =>
              onUpdateEx("min_cabin_height_in", parseFloat(v) || null)
            }
            confidence={conf["min_cabin_height_in"]}
            type="number"
            placeholder="None"
          />
        </div>
        <div className="mt-3 flex gap-4">
          {(["wifi_required", "bathroom_required"] as const).map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={ex[key]}
                onChange={(e) => onUpdateEx(key, e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-amber-400"
              />
              <span className="text-xs text-zinc-400 capitalize">
                {key.replace("_", " ")}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Client */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          Client (from text)
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FieldInput
            label="Name"
            value={ex.client_name ?? ""}
            onChange={(v) => onUpdateEx("client_name", v || null)}
            confidence={conf["client_name"]}
          />
          <FieldInput
            label="Email"
            value={ex.client_email ?? ""}
            onChange={(v) => onUpdateEx("client_email", v || null)}
            confidence={conf["client_email"]}
            type="email"
          />
          <FieldInput
            label="Phone"
            value={ex.client_phone ?? ""}
            onChange={(v) => onUpdateEx("client_phone", v || null)}
            confidence={conf["client_phone"]}
            type="tel"
          />
          <FieldInput
            label="Company"
            value={ex.client_company ?? ""}
            onChange={(v) => onUpdateEx("client_company", v || null)}
            confidence={conf["client_company"]}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
          Notes
        </h3>
        <div className="space-y-3">
          <FieldInput
            label="Catering"
            value={ex.catering_notes ?? ""}
            onChange={(v) => onUpdateEx("catering_notes", v || null)}
            confidence={conf["catering_notes"]}
            placeholder="None"
          />
          <FieldInput
            label="Luggage"
            value={ex.luggage_notes ?? ""}
            onChange={(v) => onUpdateEx("luggage_notes", v || null)}
            confidence={conf["luggage_notes"]}
            placeholder="None"
          />
          <FieldInput
            label="Special needs"
            value={ex.special_needs ?? ""}
            onChange={(v) => onUpdateEx("special_needs", v || null)}
            confidence={conf["special_needs"]}
            placeholder="None"
          />
        </div>
      </div>

      <Button
        onClick={onSave}
        loading={saving}
        size="lg"
        className="w-full justify-center"
      >
        Save Trip & Build Quote →
      </Button>
    </div>
  );
}
