"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type {
  ForecastAccuracy,
  DelayReasonBreakdown,
} from "@/lib/forecasting/types";

interface AccuracyChartProps {
  accuracy: ForecastAccuracy[];
}

interface DelayChartProps {
  delays: DelayReasonBreakdown[];
}

export function AccuracyChart({ accuracy }: AccuracyChartProps) {
  if (accuracy.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
        No completed flights yet — accuracy improves with data
      </div>
    );
  }

  const chartData = accuracy.map((a) => ({
    category: a.aircraft_category,
    error: a.error_pct,
    predicted: a.predicted_hours,
    actual: a.actual_hours,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={chartData}
        margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#27272a"
          vertical={false}
        />
        <XAxis
          dataKey="category"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={36}
          unit="%"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "6px",
            fontSize: 12,
            color: "#f4f4f5",
          }}
          formatter={(value: number | string | undefined) =>
            [
              typeof value === "number" ? `${value.toFixed(1)}%` : "—",
              "Forecast error",
            ] as [string, string]
          }
        />
        <ReferenceLine y={0} stroke="#52525b" strokeWidth={1} />
        <Bar
          dataKey="error"
          name="Forecast error"
          radius={[2, 2, 0, 0]}
          fill="#fbbf24"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DelayReasonChart({ delays }: DelayChartProps) {
  if (delays.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
        No delay data recorded yet
      </div>
    );
  }

  const chartData = delays.slice(0, 6).map((d) => ({
    reason: d.reason_code,
    count: d.count,
    hours: d.total_hours_lost,
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 32, left: 56, bottom: 4 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#27272a"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="reason"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "6px",
            fontSize: 12,
            color: "#f4f4f5",
          }}
          formatter={(
            value: number | string | undefined,
            name: string | undefined,
          ) =>
            [value ?? 0, name === "count" ? "Occurrences" : "Hours lost"] as [
              number | string,
              string,
            ]
          }
        />
        <Bar
          dataKey="count"
          name="count"
          fill="#71717a"
          radius={[0, 2, 2, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
