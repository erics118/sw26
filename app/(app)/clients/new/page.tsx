"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewClientPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      company: formData.get("company") || null,
      email: formData.get("email") || null,
      phone: formData.get("phone") || null,
      nationality: formData.get("nationality") || null,
      notes: formData.get("notes") || null,
      vip: formData.get("vip") === "on",
      risk_flag: formData.get("risk_flag") === "on",
    };

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create client");
      }

      const client = await res.json();
      router.push(`/clients/${client.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setIsLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link
          href="/clients"
          className="mb-4 inline-block text-sm text-zinc-600 hover:text-zinc-400"
        >
          ← Back to Clients
        </Link>
        <h1 className="text-2xl font-semibold text-zinc-100">New Client</h1>
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

          {/* Name */}
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-300"
            >
              Name *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="John Doe"
            />
          </div>

          {/* Company */}
          <div>
            <label
              htmlFor="company"
              className="block text-sm font-medium text-zinc-300"
            >
              Company
            </label>
            <input
              id="company"
              name="company"
              type="text"
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="Acme Corp"
            />
          </div>

          {/* Email */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="john@example.com"
            />
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-zinc-300"
            >
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="+1 (310) 555-0192"
            />
          </div>

          {/* Nationality */}
          <div>
            <label
              htmlFor="nationality"
              className="block text-sm font-medium text-zinc-300"
            >
              Nationality
            </label>
            <input
              id="nationality"
              name="nationality"
              type="text"
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              placeholder="US"
            />
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
              placeholder="Any additional notes..."
            />
          </div>

          {/* Flags */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="vip"
                name="vip"
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-amber-400 focus:ring-amber-400"
              />
              <label
                htmlFor="vip"
                className="text-sm font-medium text-zinc-300"
              >
                VIP Client
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="risk_flag"
                name="risk_flag"
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-red-400 focus:ring-red-400"
              />
              <label
                htmlFor="risk_flag"
                className="text-sm font-medium text-zinc-300"
              >
                Risk Flag
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-6">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-md bg-amber-400 px-4 py-2 font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Client"}
            </button>
            <Link
              href="/clients"
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
