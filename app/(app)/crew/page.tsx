import { createClient } from "@/lib/supabase/server";
import Card from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import DeleteCrewButton from "@/components/crew/DeleteCrewButton";

const ROLE_LABELS: Record<string, string> = {
  captain: "Captain",
  first_officer: "First Officer",
  flight_attendant: "Flight Attendant",
};

export default async function CrewPage() {
  const supabase = await createClient();

  const { data: crew } = await supabase
    .from("crew")
    .select(
      "id, name, role, ratings, duty_hours_this_week, available_hours_per_day, last_duty_end, created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Crew</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {crew?.length ?? 0} crew members
          </p>
        </div>
      </div>

      <Card padding={false}>
        {!crew?.length ? (
          <div className="py-16 text-center">
            <p className="text-zinc-600">No crew members yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {[
                  "Name",
                  "Role",
                  "Ratings",
                  "Duty Hrs (week)",
                  "Avail Hrs/Day",
                  "Last Duty End",
                  "",
                ].map((h) => (
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
              {crew.map((c) => (
                <tr
                  key={c.id}
                  className="group transition-colors hover:bg-zinc-800/30"
                >
                  <td className="px-5 py-3 font-medium text-zinc-200">
                    {c.name}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">
                    {ROLE_LABELS[c.role] ?? c.role}
                  </td>
                  <td className="px-5 py-3">
                    {c.ratings?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {c.ratings.map((r) => (
                          <span
                            key={r}
                            className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-400"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">
                    {c.duty_hours_this_week}h
                  </td>
                  <td className="px-5 py-3 text-zinc-400">
                    {c.available_hours_per_day}h
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-600">
                    {formatDate(c.last_duty_end)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <DeleteCrewButton crewId={c.id} crewName={c.name} />
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
