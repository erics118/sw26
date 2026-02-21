"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const AIRCRAFT_CATEGORIES = [
  "turboprop",
  "light",
  "midsize",
  "super-mid",
  "heavy",
  "ultra-long",
];

export default function NewAircraftPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      tail_number: formData.get("tail_number"),
      category: formData.get("category"),
      range_nm: parseInt(formData.get("range_nm") as string),
      pax_capacity: parseInt(formData.get("pax_capacity") as string),
      cabin_height_in: formData.get("cabin_height_in")
        ? parseFloat(formData.get("cabin_height_in") as string)
        : null,
      fuel_burn_gph: formData.get("fuel_burn_gph")
        ? parseFloat(formData.get("fuel_burn_gph") as string)
        : null,
      has_wifi: formData.get("has_wifi") === "on",
      has_bathroom: formData.get("has_bathroom") === "on",
      home_base_icao: formData.get("home_base_icao") || null,
      notes: formData.get("notes") || null,
    };

    try {
      const res = await fetch("/api/aircraft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create aircraft");
      }

      router.push("/aircraft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link
          href="/aircraft"
          className="mb-4 inline-block text-sm text-zinc-600 hover:text-zinc-400"
        >
          ← Back to Fleet
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-100">Add Aircraft</h1>
      </div>

      <div className="max-w-2xl">
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6"
        >
          {error && (
            <div className="rounded-md border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Tail Number */}
          <div>
            <label
              htmlFor="tail_number"
              className="block text-sm font-medium text-zinc-300"
            >
              Tail Number *
            </label>
            <input
              id="tail_number"
              name="tail_number"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="N123AA"
            />
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="category"
              className="block text-sm font-medium text-zinc-300"
            >
              Category *
            </label>
            <select
              id="category"
              name="category"
              required
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
            >
              <option value="">Select a category</option>
              {AIRCRAFT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Range */}
          <div>
            <label
              htmlFor="range_nm"
              className="block text-sm font-medium text-zinc-300"
            >
              Range (NM) *
            </label>
            <input
              id="range_nm"
              name="range_nm"
              type="number"
              required
              min="1"
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="2000"
            />
          </div>

          {/* Passenger Capacity */}
          <div>
            <label
              htmlFor="pax_capacity"
              className="block text-sm font-medium text-zinc-300"
            >
              Passenger Capacity *
            </label>
            <input
              id="pax_capacity"
              name="pax_capacity"
              type="number"
              required
              min="1"
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="8"
            />
          </div>

          {/* Cabin Height */}
          <div>
            <label
              htmlFor="cabin_height_in"
              className="block text-sm font-medium text-zinc-300"
            >
              Cabin Height (inches)
            </label>
            <input
              id="cabin_height_in"
              name="cabin_height_in"
              type="number"
              step="0.1"
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="72.0"
            />
          </div>

          {/* Fuel Burn */}
          <div>
            <label
              htmlFor="fuel_burn_gph"
              className="block text-sm font-medium text-zinc-300"
            >
              Fuel Burn (GPH)
            </label>
            <input
              id="fuel_burn_gph"
              name="fuel_burn_gph"
              type="number"
              step="0.1"
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="200.0"
            />
          </div>

          {/* Home Base */}
          <div>
            <label
              htmlFor="home_base_icao"
              className="block text-sm font-medium text-zinc-300"
            >
              Home Base (ICAO)
            </label>
            <input
              id="home_base_icao"
              name="home_base_icao"
              type="text"
              maxLength={4}
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="KJFK"
            />
          </div>

          {/* Amenities */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="has_wifi"
                name="has_wifi"
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400"
              />
              <label
                htmlFor="has_wifi"
                className="text-sm font-medium text-zinc-300"
              >
                Wi-Fi
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="has_bathroom"
                name="has_bathroom"
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400"
              />
              <label
                htmlFor="has_bathroom"
                className="text-sm font-medium text-zinc-300"
              >
                Lavatory
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-zinc-300"
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="Any additional notes about this aircraft..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-md bg-amber-400 px-4 py-2 font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Adding..." : "Add Aircraft"}
            </button>
            <Link
              href="/aircraft"
              className="flex-1 rounded-md border border-zinc-700 px-4 py-2 text-center font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
