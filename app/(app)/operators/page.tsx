import { createClient } from "@/lib/supabase/server";
import Card from "@/components/ui/Card";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null)
    return <span className="text-xs text-zinc-700">No date</span>;
  if (days < 0)
    return <span className="text-xs font-semibold text-red-400">Expired</span>;
  if (days <= 30)
    return (
      <span className="text-xs font-semibold text-amber-400">{days}d left</span>
    );
  return (
    <span className="text-xs text-emerald-500">
      {Math.floor(days / 30)}mo left
    </span>
  );
}

export default async function OperatorsPage() {
  const supabase = await createClient();

  const { data: operators } = await supabase
    .from("operators")
    .select(
      "id, name, cert_number, cert_expiry, insurance_expiry, reliability_score, blacklisted, notes",
    )
    .order("name");

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Operators</h1>
        <p className="mt-1 text-sm text-zinc-600">
          {operators?.length ?? 0} operators
        </p>
      </div>

      {!operators?.length ? (
        <Card>
          <p className="py-8 text-center text-sm text-zinc-600">
            No operators found.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {operators.map((op) => {
            const certDays = daysUntil(op.cert_expiry);
            const insDays = daysUntil(op.insurance_expiry);
            const hasIssue =
              op.blacklisted ||
              (certDays !== null && certDays <= 30) ||
              (insDays !== null && insDays <= 30);

            return (
              <Card key={op.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-zinc-100">{op.name}</h3>
                      {op.blacklisted && (
                        <span className="rounded border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-xs font-medium text-red-400">
                          BLACKLISTED
                        </span>
                      )}
                      {hasIssue && !op.blacklisted && (
                        <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                          ACTION NEEDED
                        </span>
                      )}
                    </div>
                    {op.cert_number && (
                      <p className="mt-0.5 font-mono text-xs text-zinc-600">
                        {op.cert_number}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-1.5 w-4 rounded-sm ${
                          i < Math.round(op.reliability_score)
                            ? "bg-amber-400"
                            : "bg-zinc-700"
                        }`}
                      />
                    ))}
                    <span className="tabnum ml-1 text-xs text-zinc-500">
                      {op.reliability_score.toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-4 border-t border-zinc-800 pt-4 text-sm">
                  <div>
                    <p className="text-xs text-zinc-600">Part 135 Cert</p>
                    <ExpiryBadge days={certDays} />
                    {op.cert_expiry && (
                      <p className="mt-0.5 text-xs text-zinc-700">
                        {new Date(op.cert_expiry).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-zinc-600">Insurance</p>
                    <ExpiryBadge days={insDays} />
                    {op.insurance_expiry && (
                      <p className="mt-0.5 text-xs text-zinc-700">
                        {new Date(op.insurance_expiry).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {op.notes && (
                    <div>
                      <p className="text-xs text-zinc-600">Notes</p>
                      <p className="mt-0.5 text-xs text-zinc-400">{op.notes}</p>
                    </div>
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
