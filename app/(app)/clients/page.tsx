import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Card from "@/components/ui/Card";
import { formatDate } from "@/lib/format";

export default async function ClientsPage() {
  const supabase = await createClient();

  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, company, email, phone, vip, risk_flag, created_at")
    .order("name");

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Clients</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {clients?.length ?? 0} clients
          </p>
        </div>
        <Link
          href="/clients/new"
          className="inline-flex items-center gap-2 rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 shadow-sm shadow-amber-400/20 transition-colors hover:bg-amber-300"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Client
        </Link>
      </div>

      <Card padding={false}>
        {!clients?.length ? (
          <div className="py-16 text-center">
            <p className="text-zinc-600">No clients yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {["Name", "Company", "Contact", "Flags", "Added"].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-3 text-left text-xs font-semibold tracking-wider text-zinc-600 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="group transition-colors hover:bg-zinc-800/30"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="font-medium text-zinc-200 hover:text-amber-400"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-zinc-500">
                    {c.company ?? <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="px-5 py-3 text-zinc-500">
                    <div>{c.email ?? ""}</div>
                    {c.phone && (
                      <div className="text-xs text-zinc-600">{c.phone}</div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      {c.vip && (
                        <span className="rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-xs text-amber-400">
                          VIP
                        </span>
                      )}
                      {c.risk_flag && (
                        <span className="rounded border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 text-xs text-red-400">
                          RISK
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-600">
                    {formatDate(c.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
