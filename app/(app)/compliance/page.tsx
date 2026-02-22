"use client";

import { useState, useEffect, useMemo } from "react";
import Card from "@/components/ui/Card";

type AuditLog = {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  ai_generated: boolean;
  ai_model: string | null;
  human_verified: boolean;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LockIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = "zinc",
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: "zinc" | "violet" | "emerald" | "amber";
}) {
  const valueColors = {
    zinc: "text-zinc-100",
    violet: "text-violet-400",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
  };
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">
        {label}
      </p>
      <p className={`tabnum mt-3 text-3xl font-bold ${valueColors[color]}`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs text-zinc-600">{sub}</p>}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const prefixColors: Record<string, string> = {
    "trip.":
      "text-blue-400 bg-blue-400/10 border-blue-800/50",
    "quote.":
      "text-amber-400 bg-amber-400/10 border-amber-800/50",
    "route.":
      "text-emerald-400 bg-emerald-400/10 border-emerald-800/50",
    "fleet.":
      "text-purple-400 bg-purple-400/10 border-purple-800/50",
  };
  const prefix = Object.keys(prefixColors).find((p) => action.startsWith(p));
  const cls = prefix
    ? prefixColors[prefix]
    : "text-zinc-400 bg-zinc-800 border-zinc-700";

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-xs ${cls}`}
    >
      {action}
    </span>
  );
}

function SourceBadge({
  aiGenerated,
  aiModel,
  humanVerified,
}: {
  aiGenerated: boolean;
  aiModel: string | null;
  humanVerified: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {aiGenerated ? (
        <span className="inline-flex items-center gap-1 rounded border border-violet-700/50 bg-violet-500/10 px-1.5 py-0.5 text-xs text-violet-400">
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          AI
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400">
          Human
        </span>
      )}
      {aiModel && (
        <span className="font-mono text-xs text-zinc-600">{aiModel}</span>
      )}
      {humanVerified && (
        <span className="inline-flex items-center gap-1 rounded border border-emerald-700/50 bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-400">
          ✓ Verified
        </span>
      )}
      {aiGenerated && !humanVerified && (
        <span className="inline-flex items-center gap-1 rounded border border-amber-700/50 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-500">
          Pending review
        </span>
      )}
    </div>
  );
}

function ExpandableRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);

  const confidence =
    log.payload &&
    typeof log.payload === "object" &&
    "_confidence" in log.payload
      ? (log.payload._confidence as Record<string, number>)
      : null;

  const payloadWithoutMeta =
    log.payload && confidence
      ? Object.fromEntries(
          Object.entries(log.payload).filter(([k]) => k !== "_confidence"),
        )
      : log.payload;

  return (
    <>
      <tr
        className="cursor-pointer border-b border-zinc-800/60 transition-colors hover:bg-zinc-800/20"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Timestamp */}
        <td className="px-4 py-3">
          <span className="tabnum whitespace-nowrap text-xs text-zinc-500">
            {new Date(log.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <p className="tabnum text-xs text-zinc-700">
            {new Date(log.created_at).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
        </td>

        {/* Action */}
        <td className="px-4 py-3">
          <ActionBadge action={log.action} />
        </td>

        {/* Entity */}
        <td className="px-4 py-3">
          {log.entity_type ? (
            <div>
              <span className="text-xs font-medium capitalize text-zinc-300">
                {log.entity_type}
              </span>
              {log.entity_id && (
                <p className="mt-0.5 max-w-[7rem] truncate font-mono text-xs text-zinc-600">
                  {log.entity_id.slice(0, 8)}…
                </p>
              )}
            </div>
          ) : (
            <span className="text-xs text-zinc-700">—</span>
          )}
        </td>

        {/* Source */}
        <td className="px-4 py-3">
          <SourceBadge
            aiGenerated={log.ai_generated}
            aiModel={log.ai_model}
            humanVerified={log.human_verified}
          />
        </td>

        {/* Expand toggle */}
        <td className="px-4 py-3 text-right">
          <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
            Details
            <ChevronIcon expanded={expanded} />
          </span>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-zinc-800/60 bg-zinc-900/30">
          <td colSpan={5} className="px-6 py-4">
            <div className="space-y-4">
              {/* Metadata row */}
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-zinc-600 uppercase">
                    Record ID
                  </p>
                  <p className="mt-1 font-mono text-xs text-zinc-400">
                    {log.id}
                  </p>
                </div>
                {log.entity_id && (
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-zinc-600 uppercase">
                      Entity ID
                    </p>
                    <p className="mt-1 font-mono text-xs text-zinc-400">
                      {log.entity_id}
                    </p>
                  </div>
                )}
                {log.user_id && (
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-zinc-600 uppercase">
                      User ID
                    </p>
                    <p className="mt-1 font-mono text-xs text-zinc-400">
                      {log.user_id}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold tracking-wider text-zinc-600 uppercase">
                    Timestamp (UTC)
                  </p>
                  <p className="mt-1 font-mono text-xs text-zinc-400">
                    {log.created_at}
                  </p>
                </div>
              </div>

              {/* Confidence scores */}
              {confidence && Object.keys(confidence).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wider text-zinc-600 uppercase">
                    AI Confidence Scores
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(confidence).map(([field, score]) => {
                      const pct = Math.round(score * 100);
                      const color =
                        pct >= 80
                          ? "text-emerald-400"
                          : pct >= 60
                            ? "text-amber-400"
                            : "text-red-400";
                      return (
                        <div
                          key={field}
                          className="rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5"
                        >
                          <p className="text-xs text-zinc-500 capitalize">
                            {field.replace(/_/g, " ")}
                          </p>
                          <p className={`tabnum text-sm font-bold ${color}`}>
                            {pct}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Payload */}
              {payloadWithoutMeta &&
                Object.keys(payloadWithoutMeta).length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wider text-zinc-600 uppercase">
                      Payload
                    </p>
                    <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-400">
                      {JSON.stringify(payloadWithoutMeta, null, 2)}
                    </pre>
                  </div>
                )}

              {/* Immutability notice */}
              <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-2">
                <span className="text-emerald-500">
                  <LockIcon size={10} />
                </span>
                <p className="text-xs text-zinc-600">
                  This record is append-only and cannot be modified or deleted.
                  It serves as a tamper-evident compliance audit trail.
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters (client-side)
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [aiFilter, setAiFilter] = useState<"" | "ai" | "human">("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch("/api/audit-logs?limit=500");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        setAllLogs(data.logs ?? []);
      } catch (e) {
        setFetchError(
          e instanceof Error ? e.message : "Failed to load audit logs",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Derive filter options from the full unfiltered dataset
  const uniqueActions = useMemo(
    () => [...new Set(allLogs.map((l) => l.action))].sort(),
    [allLogs],
  );
  const uniqueEntityTypes = useMemo(
    () =>
      [
        ...new Set(
          allLogs.filter((l) => l.entity_type).map((l) => l.entity_type!),
        ),
      ].sort(),
    [allLogs],
  );

  // Client-side filtering
  const filteredLogs = useMemo(() => {
    return allLogs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;
      if (entityTypeFilter && log.entity_type !== entityTypeFilter)
        return false;
      if (aiFilter === "ai" && !log.ai_generated) return false;
      if (aiFilter === "human" && log.ai_generated) return false;
      if (fromDate && log.created_at < fromDate) return false;
      if (toDate && log.created_at > `${toDate}T23:59:59`) return false;
      return true;
    });
  }, [allLogs, actionFilter, entityTypeFilter, aiFilter, fromDate, toDate]);

  // Stats from filtered set
  const aiCount = filteredLogs.filter((l) => l.ai_generated).length;
  const verifiedCount = filteredLogs.filter((l) => l.human_verified).length;
  const pendingReview = filteredLogs.filter(
    (l) => l.ai_generated && !l.human_verified,
  ).length;
  const total = filteredLogs.length;
  const aiPct = total > 0 ? Math.round((aiCount / total) * 100) : 0;
  const verifiedPct = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;

  function exportUrl(format: "csv" | "json") {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (entityTypeFilter) params.set("entity_type", entityTypeFilter);
    if (aiFilter) params.set("ai", aiFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    params.set("limit", "2000");
    params.set("export", format);
    return `/api/audit-logs?${params}`;
  }

  function clearFilters() {
    setActionFilter("");
    setEntityTypeFilter("");
    setAiFilter("");
    setFromDate("");
    setToDate("");
  }

  const hasFilters =
    actionFilter || entityTypeFilter || aiFilter || fromDate || toDate;

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-zinc-100">
              Audit Log
            </h1>
            <span className="inline-flex items-center gap-1 rounded border border-emerald-800/50 bg-emerald-950/50 px-2 py-0.5 text-xs text-emerald-500">
              <ShieldIcon />
              Compliance
            </span>
          </div>
          <p className="text-sm text-zinc-600">
            Immutable record of all AI-generated and human actions across the
            platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={exportUrl("csv")}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export CSV
          </a>
          <a
            href={exportUrl("json")}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Export JSON
          </a>
        </div>
      </div>

      {/* Security Banner */}
      <div className="mb-6 rounded-lg border border-emerald-800/30 bg-emerald-950/20 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-emerald-800/50 bg-emerald-900/40 text-emerald-400">
            <ShieldIcon />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-300">
              Data Security &amp; Compliance Controls Active
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-x-8 gap-y-1 sm:grid-cols-3">
              {[
                { label: "Append-only records", detail: "No edits or deletions permitted" },
                { label: "Encrypted at rest", detail: "AES-256 via Supabase" },
                { label: "Role-based access", detail: "Authenticated users only" },
                { label: "AI action tracing", detail: "Model & confidence captured" },
                { label: "Human verification", detail: "Dual-control for AI outputs" },
                { label: "Full payload retention", detail: "Complete request context stored" },
              ].map(({ label, detail }) => (
                <div key={label} className="flex items-start gap-1.5">
                  <span className="mt-px text-emerald-400">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <div>
                    <span className="text-xs font-medium text-emerald-400">
                      {label}
                    </span>
                    <p className="text-xs text-emerald-700">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <StatCard
          label="Total Records"
          value={loading ? "—" : total}
          sub={
            allLogs.length > total
              ? `${allLogs.length} total, filtered`
              : "in this period"
          }
        />
        <StatCard
          label="AI-Generated"
          value={loading ? "—" : `${aiPct}%`}
          sub={`${aiCount} records`}
          color="violet"
        />
        <StatCard
          label="Human-Verified"
          value={loading ? "—" : `${verifiedPct}%`}
          sub={`${verifiedCount} records`}
          color="emerald"
        />
        <StatCard
          label="Pending Review"
          value={loading ? "—" : pendingReview}
          sub="AI actions not yet verified"
          color={pendingReview > 0 ? "amber" : "zinc"}
        />
      </div>

      {/* Filters */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Action filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Action</label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
            >
              <option value="">All actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Entity type filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Entity</label>
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
            >
              <option value="">All entities</option>
              {uniqueEntityTypes.map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>

          {/* Source filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">Source</label>
            <div className="flex overflow-hidden rounded border border-zinc-700">
              {(
                [
                  { v: "" as const, label: "All" },
                  { v: "ai" as const, label: "AI" },
                  { v: "human" as const, label: "Human" },
                ] as const
              ).map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => setAiFilter(v)}
                  className={`px-2.5 py-1 text-xs transition-colors ${
                    aiFilter === v
                      ? "bg-amber-400/10 text-amber-400"
                      : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-500">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:border-amber-400 focus:outline-none"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto text-xs text-zinc-600 transition-colors hover:text-zinc-400"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Audit Log Table */}
      <Card padding={false}>
        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-600">
            Loading audit records…
          </div>
        ) : fetchError ? (
          <div className="py-16 text-center text-sm text-red-400">
            {fetchError}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-600">No audit records found.</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-xs text-amber-400 hover:text-amber-300"
              >
                Clear filters →
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                    Entity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                    Source
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold tracking-widest text-zinc-500 uppercase">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <ExpandableRow key={log.id} log={log} />
                ))}
              </tbody>
            </table>
            <div className="border-t border-zinc-800 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-600">
                  Showing {filteredLogs.length}{" "}
                  {filteredLogs.length === 1 ? "record" : "records"}
                  {allLogs.length === 500 && !hasFilters
                    ? " (latest 500 — export for full dataset)"
                    : ""}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-zinc-700">
                  <LockIcon size={10} />
                  Records are immutable
                </div>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
