"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface EditableQuoteDetailsProps {
  quoteId: string;
  marginPct: number;
  notes: string | null;
  brokerName: string | null;
  brokerCommissionPct: number | null;
  version: number;
  quoteValidUntil: string | null;
  estimatedTotalHours: number | null;
  wonLostReason: string | null;
  status: string;
  createdAt: string;
}

function InlineNumberField({
  label,
  value,
  suffix,
  onSave,
}: {
  label: string;
  value: number;
  suffix?: string;
  onSave: (val: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setLocalValue(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = useCallback(async () => {
    const num = parseFloat(localValue);
    if (isNaN(num) || num === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(num);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [localValue, value, onSave]);

  if (editing) {
    return (
      <div className="flex justify-between">
        <span className="text-zinc-600">{label}</span>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setLocalValue(String(value));
                setEditing(false);
              }
            }}
            disabled={saving}
            className="w-16 rounded border border-amber-400/60 bg-zinc-800 px-1.5 py-0.5 text-right font-mono text-sm text-zinc-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 focus:outline-none"
            autoFocus
          />
          {suffix && <span className="text-xs text-zinc-500">{suffix}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-between">
      <span className="text-zinc-600">{label}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="tabnum group flex items-center gap-1 text-zinc-300 transition-colors hover:text-amber-400"
        title={`Edit ${label.toLowerCase()}`}
      >
        {value}
        {suffix}
        <svg
          className="h-3 w-3 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
    </div>
  );
}

function InlineTextField({
  label,
  value,
  placeholder,
  onSave,
  multiline = false,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  onSave: (val: string | null) => Promise<void>;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setLocalValue(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const commit = useCallback(async () => {
    const trimmed = localValue.trim();
    const newVal = trimmed || null;
    if (newVal === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(newVal);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [localValue, value, onSave]);

  if (editing) {
    const sharedClasses =
      "w-full rounded border border-amber-400/60 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 focus:outline-none";

    return (
      <div>
        <span className="mb-1.5 block text-zinc-600">{label}</span>
        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setLocalValue(value ?? "");
                setEditing(false);
              }
              if (e.key === "Enter" && e.metaKey) {
                e.preventDefault();
                commit();
              }
            }}
            disabled={saving}
            rows={3}
            placeholder={placeholder}
            className={`${sharedClasses} resize-y`}
            autoFocus
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setLocalValue(value ?? "");
                setEditing(false);
              }
            }}
            disabled={saving}
            placeholder={placeholder}
            className={sharedClasses}
            autoFocus
          />
        )}
        {multiline && (
          <p className="mt-1 text-[10px] text-zinc-600">⌘ Enter to save</p>
        )}
      </div>
    );
  }

  const displayValue = value ?? (
    <span className="text-zinc-600 italic">{placeholder ?? "—"}</span>
  );

  if (multiline) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group w-full text-left"
        title={`Edit ${label.toLowerCase()}`}
      >
        <span className="mb-1 flex items-center gap-1.5 text-zinc-600">
          {label}
          <svg
            className="h-3 w-3 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </span>
        <p className="text-sm leading-relaxed text-zinc-400">{displayValue}</p>
      </button>
    );
  }

  return (
    <div className="flex justify-between">
      <span className="text-zinc-600">{label}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1 text-zinc-300 transition-colors hover:text-amber-400"
        title={`Edit ${label.toLowerCase()}`}
      >
        <span className="text-sm">{displayValue}</span>
        <svg
          className="h-3 w-3 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      </button>
    </div>
  );
}

export default function EditableQuoteDetails({
  quoteId,
  marginPct,
  notes,
  brokerName,
  brokerCommissionPct,
  version,
  quoteValidUntil,
  estimatedTotalHours,
  wonLostReason,
  status,
  createdAt,
}: EditableQuoteDetailsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const patchQuote = useCallback(
    async (updates: Record<string, unknown>) => {
      setError(null);
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        const msg =
          typeof data.error === "string" ? data.error : "Update failed";
        setError(msg);
        throw new Error(msg);
      }
      router.refresh();
    },
    [quoteId, router],
  );

  const isTerminal = status === "lost" || status === "completed";

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-sm">
        {!isTerminal ? (
          <InlineNumberField
            label="Margin"
            value={marginPct}
            suffix="%"
            onSave={async (val) => patchQuote({ margin_pct: val })}
          />
        ) : (
          <div className="flex justify-between">
            <span className="text-zinc-600">Margin</span>
            <span className="tabnum text-zinc-300">{marginPct}%</span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-zinc-600">Version</span>
          <span className="tabnum text-zinc-300">v{version}</span>
        </div>

        {!isTerminal ? (
          <InlineTextField
            label="Broker"
            value={brokerName}
            placeholder="Add broker name"
            onSave={async (val) => patchQuote({ broker_name: val })}
          />
        ) : (
          brokerName && (
            <div className="flex justify-between">
              <span className="text-zinc-600">Broker</span>
              <span className="text-zinc-300">{brokerName}</span>
            </div>
          )
        )}

        {!isTerminal
          ? brokerName && (
              <InlineNumberField
                label="Broker commission"
                value={brokerCommissionPct ?? 0}
                suffix="%"
                onSave={async (val) =>
                  patchQuote({ broker_commission_pct: val })
                }
              />
            )
          : brokerCommissionPct != null && (
              <div className="flex justify-between">
                <span className="text-zinc-600">Broker commission</span>
                <span className="tabnum text-zinc-300">
                  {brokerCommissionPct}%
                </span>
              </div>
            )}

        {quoteValidUntil && (
          <div className="flex justify-between">
            <span className="text-zinc-600">Valid until</span>
            <span className="text-xs text-zinc-500">
              {new Date(quoteValidUntil).toLocaleDateString()}
            </span>
          </div>
        )}

        {estimatedTotalHours != null && (
          <div className="flex justify-between">
            <span className="text-zinc-600">Est. total hours</span>
            <span className="tabnum text-zinc-300">
              {estimatedTotalHours} hrs
            </span>
          </div>
        )}

        {wonLostReason && status === "lost" && (
          <div className="flex justify-between">
            <span className="text-zinc-600">Lost reason</span>
            <span className="text-zinc-300 capitalize">
              {wonLostReason.replace("_", " ")}
            </span>
          </div>
        )}

        <div className="flex justify-between">
          <span className="text-zinc-600">Created</span>
          <span className="text-xs text-zinc-500">
            {new Date(createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded bg-red-400/10 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {!isTerminal && (
        <div className="border-t border-zinc-800 pt-4">
          <InlineTextField
            label="Notes"
            value={notes}
            placeholder="Add notes…"
            onSave={async (val) => patchQuote({ notes: val })}
            multiline
          />
        </div>
      )}
    </div>
  );
}
