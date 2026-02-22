"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteCrewButton({
  crewId,
  crewName,
}: {
  crewId: string;
  crewName: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/crew/${crewId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Delete failed. Please try again.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded p-1.5 text-zinc-600 transition-colors hover:bg-red-500/10 hover:text-red-400"
        aria-label={`Delete ${crewName}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-zinc-700/60 bg-zinc-900 p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="text-red-400"
              >
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
              </svg>
            </div>

            <div className="text-center">
              <h2 className="text-lg font-semibold text-zinc-100">
                Remove crew member?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                <span className="font-medium text-zinc-200">{crewName}</span>{" "}
                will be permanently removed.
                <br />
                This action cannot be undone.
              </p>
            </div>

            {error && (
              <p className="mt-3 text-center text-xs text-red-400">{error}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md border border-zinc-700 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-md bg-red-600 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
