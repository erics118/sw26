import { createClient } from "@/lib/supabase/server";
import Card, { CardHeader, CardTitle } from "@/components/ui/Card";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

type Severity = "critical" | "warning" | "ok";

function severity(days: number | null): Severity {
  if (days === null) return "ok";
  if (days < 0) return "critical";
  if (days <= 30) return "warning";
  return "ok";
}

const severityRow: Record<Severity, string> = {
  critical: "border-red-500/30 bg-red-500/5",
  warning: "border-amber-400/30 bg-amber-400/5",
  ok: "border-zinc-800 bg-transparent",
};

const severityText: Record<Severity, string> = {
  critical: "text-red-400",
  warning: "text-amber-400",
  ok: "text-emerald-400",
};

function ExpiryRow({
  label,
  name,
  days,
  date,
}: {
  label: string;
  name: string;
  days: number | null;
  date: string | null;
}) {
  const sev = severity(days);
  if (sev === "ok") return null;

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${severityRow[sev]}`}
    >
      <div>
        <p className="text-sm font-medium text-zinc-200">{name}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
      <div className="text-right">
        <p className={`tabnum text-sm font-semibold ${severityText[sev]}`}>
          {days !== null && days < 0
            ? "Expired"
            : days !== null
              ? `${days}d left`
              : "—"}
        </p>
        {date && (
          <p className="text-xs text-zinc-600">
            {new Date(date).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

export default async function CompliancePage() {
  const supabase = await createClient();

  const [{ data: operators }, { data: crew }] = await Promise.all([
    supabase
      .from("operators")
      .select("id, name, cert_expiry, insurance_expiry, blacklisted")
      .order("name"),
    supabase
      .from("crew")
      .select("id, name, duty_hours_this_week, last_duty_end")
      .order("duty_hours_this_week", { ascending: false }),
  ]);

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Cert and insurance issues
  const certIssues = (operators ?? []).filter((op) => {
    if (op.blacklisted) return true;
    const cert = op.cert_expiry ? new Date(op.cert_expiry) : null;
    const ins = op.insurance_expiry ? new Date(op.insurance_expiry) : null;
    return (cert && cert <= thirtyDays) || (ins && ins <= thirtyDays);
  });

  // Crew duty issues (≥ 55 hours used this week = warning)
  const dutyIssues = (crew ?? []).filter((c) => c.duty_hours_this_week >= 55);

  const totalIssues = certIssues.length + dutyIssues.length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Compliance</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {totalIssues === 0
            ? "All clear — no compliance issues"
            : `${totalIssues} item${totalIssues !== 1 ? "s" : ""} need attention`}
        </p>
      </div>

      {totalIssues === 0 && (
        <Card>
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-emerald-400"
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-emerald-400">
              All systems nominal
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              No expiring certs, insurance, or duty issues
            </p>
          </div>
        </Card>
      )}

      {certIssues.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Operator Certificates & Insurance</CardTitle>
            <span className="tabnum text-xs text-zinc-600">
              {certIssues.length} issue{certIssues.length !== 1 ? "s" : ""}
            </span>
          </CardHeader>
          <div className="space-y-2">
            {certIssues.flatMap((op) => [
              <ExpiryRow
                key={`cert-${op.id}`}
                label="Part 135 Certificate"
                name={op.name}
                days={daysUntil(op.cert_expiry)}
                date={op.cert_expiry}
              />,
              <ExpiryRow
                key={`ins-${op.id}`}
                label="Insurance"
                name={op.name}
                days={daysUntil(op.insurance_expiry)}
                date={op.insurance_expiry}
              />,
            ])}
          </div>
        </Card>
      )}

      {dutyIssues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Crew Duty Hours</CardTitle>
            <span className="tabnum text-xs text-zinc-600">
              {dutyIssues.length} near limit
            </span>
          </CardHeader>
          <div className="space-y-2">
            {dutyIssues.map((c) => {
              const pct = Math.min(100, (c.duty_hours_this_week / 60) * 100);
              const isCritical = c.duty_hours_this_week >= 60;
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border px-4 py-3 ${isCritical ? "border-red-500/30 bg-red-500/5" : "border-amber-400/30 bg-amber-400/5"}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200">
                      {c.name}
                    </span>
                    <span
                      className={`tabnum text-sm font-semibold ${isCritical ? "text-red-400" : "text-amber-400"}`}
                    >
                      {c.duty_hours_this_week}h / 60h
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-800">
                    <div
                      className={`h-1.5 rounded-full transition-all ${isCritical ? "bg-red-400" : "bg-amber-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {c.last_duty_end && (
                    <p className="mt-1.5 text-xs text-zinc-600">
                      Last duty end:{" "}
                      {new Date(c.last_duty_end).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
