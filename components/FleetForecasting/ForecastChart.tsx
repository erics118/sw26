"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { PlanesNeeded } from "@/lib/forecasting/types";
import { formatFlightTime } from "@/lib/format";

interface ForecastChartProps {
  data: PlanesNeeded[];
  category: string;
}

export function ForecastChart({ data, category }: ForecastChartProps) {
  const filtered = data.filter((d) => d.aircraft_category === category);

  const chartData = filtered.map((d) => ({
    date: d.date.slice(5), // MM-DD
    available: d.available_hours,
    demand: d.expected_demand_hours,
    gap: Math.abs(d.capacity_gap_hours),
    status: d.status,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
        No data for {category}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#27272a"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={32}
          unit="h"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "6px",
            fontSize: 12,
            color: "#f4f4f5",
          }}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          formatter={(
            value: number | string | undefined,
            name: string | undefined,
          ) =>
            [
              typeof value === "number" ? formatFlightTime(value) : "—",
              name === "available" ? "Available" : "Demand",
            ] as [string, string]
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#71717a" }}
          iconType="circle"
          iconSize={8}
        />
        <Bar
          dataKey="available"
          name="Available"
          fill="#3f3f46"
          radius={[2, 2, 0, 0]}
        />
        <Bar
          dataKey="demand"
          name="Demand"
          fill="#fbbf24"
          radius={[2, 2, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
