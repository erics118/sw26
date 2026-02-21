"use client";

import Card, { CardHeader, CardTitle } from "@/components/ui/Card";
import { mockFlights } from "@/lib/ops/mockData";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

const utilizationData = [
  { day: "Mon", pct: 82 },
  { day: "Tue", pct: 95 },
  { day: "Wed", pct: 71 },
  { day: "Thu", pct: 88 },
  { day: "Fri", pct: 76 },
  { day: "Sat", pct: 42 },
  { day: "Sun", pct: 35 },
];

export default function DashboardRightPanel() {
  const activeFlights = mockFlights.filter((f) => f.inAir).slice(0, 5);

  return (
    <div className="grid grid-cols-4 gap-4">
      {/* Utilization Forecast — spans 2 cols */}
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Utilization Forecast</CardTitle>
          <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
            +8% vs last week
          </span>
        </CardHeader>
        <div className="mt-3 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={utilizationData} barSize={24} barCategoryGap="30%">
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "#52525b" }}
              />
              <Tooltip
                cursor={false}
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 6,
                  fontSize: 11,
                }}
                itemStyle={{ color: "#34d399" }}
                formatter={(v: number) => [`${v}%`, "Utilization"]}
              />
              <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                {utilizationData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={i < 5 ? "#34d399" : "#27272a"}
                    fillOpacity={i < 5 ? 0.75 : 0.5}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Flights Today */}
      <Card padding={false}>
        <CardHeader className="px-4 pt-4">
          <CardTitle>Flights Today</CardTitle>
          <span className="text-xs text-zinc-600">
            {activeFlights.length} active
          </span>
        </CardHeader>
        <div className="scrollbar-thin mt-1 max-h-48 divide-y divide-zinc-800/50 overflow-y-auto pb-1">
          {activeFlights.map((f) => (
            <div key={f.id} className="px-4 py-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-zinc-200">
                    {f.aircraftType}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      f.status === "green"
                        ? "bg-emerald-400"
                        : f.status === "yellow"
                          ? "bg-yellow-400"
                          : "bg-red-400"
                    }`}
                  />
                </div>
                <span className="text-xs text-zinc-600">ETA {f.eta}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                <span>{f.origin}</span>
                <span className="text-zinc-700">→</span>
                <span>{f.destination}</span>
                <span className="ml-auto text-zinc-700">{f.pax} pax</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Fuel + Crew stacked */}
      <div className="flex flex-col gap-4">
        <Card>
          <p className="text-xs font-semibold tracking-widest text-zinc-600 uppercase">
            Fuel Savings
          </p>
          <p className="tabnum mt-1.5 text-2xl font-bold text-emerald-400">
            $4.2k
          </p>
          <p className="mt-1 text-xs text-zinc-600">optimized routing</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold tracking-widest text-zinc-600 uppercase">
            Crew Ready
          </p>
          <p className="tabnum mt-1.5 text-2xl font-bold text-zinc-100">8/10</p>
          <p className="mt-1 text-xs text-zinc-600">
            <span className="text-yellow-400">2</span> on duty risk
          </p>
        </Card>
      </div>
    </div>
  );
}
