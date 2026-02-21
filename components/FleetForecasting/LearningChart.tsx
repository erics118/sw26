"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import type {
  ForecastAccuracy,
  DelayReasonBreakdown,
} from "@/lib/forecasting/types";

// ─── Accuracy (signed bias) chart ─────────────────────────────────────────────

interface AccuracyChartProps {
  accuracy: ForecastAccuracy[];
  horizon: 7 | 30 | 90;
  onHorizonChange: (h: 7 | 30 | 90) => void;
}

const HORIZONS = [7, 30, 90] as const;

export function AccuracyChart({
  accuracy,
  horizon,
  onHorizonChange,
}: AccuracyChartProps) {
  const chartData = accuracy.map((a) => ({
    category: a.aircraft_category,
    // signed_error_pct: positive = over-forecast, negative = under-forecast
    error: a.signed_error_pct ?? a.error_pct,
    predicted: a.predicted_hours,
    actual: a.actual_hours,
    driver: a.error_driver,
  }));

  return (
    <div>
      {/* Horizon filter */}
      <div className="mb-3 flex gap-1">
        {HORIZONS.map((h) => (
          <button
            key={h}
            onClick={() => onHorizonChange(h)}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              horizon === h
                ? "bg-amber-400 text-zinc-950"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {h} days
          </button>
        ))}
        <span className="ml-2 self-center text-[10px] text-zinc-600">
          + = predicted too high · − = predicted too low
        </span>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
          No completed flights yet — accuracy improves with data
        </div>
      ) : (
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
              formatter={(
                value: number | string | undefined,
                _name: string | undefined,
                props: { payload?: { driver?: string } },
              ) => {
                const pct =
                  typeof value === "number"
                    ? `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
                    : "—";
                const label =
                  (value as number) > 0
                    ? "We predicted too high"
                    : "We predicted too low";
                const driver = props?.payload?.driver;
                return [
                  `${pct} ${driver ? `· ${driver.replace("_", " ")}` : ""}`,
                  label,
                ] as [string, string];
              }}
            />
            {/* Zero line */}
            <ReferenceLine y={0} stroke="#52525b" strokeWidth={1} />
            <Bar dataKey="error" name="Forecast error" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  // Red = over-forecast (we predicted too high)
                  // Blue = under-forecast (demand exceeded prediction)
                  fill={entry.error > 0 ? "#f87171" : "#60a5fa"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── Error driver donut ────────────────────────────────────────────────────────

interface ErrorDriverDonutProps {
  accuracy: ForecastAccuracy[];
}

const DRIVER_COLORS: Record<string, string> = {
  weather: "#60a5fa",
  maintenance: "#f59e0b",
  win_rate_shift: "#f87171",
  demand_shift: "#a78bfa",
  other: "#71717a",
};

const DRIVER_LABELS: Record<string, string> = {
  win_rate_shift: "Quote close rate changed",
  demand_shift: "Demand changed",
  maintenance: "Maintenance impact",
  weather: "Weather",
};

export function ErrorDriverDonut({ accuracy }: ErrorDriverDonutProps) {
  const driverCounts: Record<string, number> = {};
  for (const a of accuracy) {
    if (a.error_driver) {
      driverCounts[a.error_driver] = (driverCounts[a.error_driver] ?? 0) + 1;
    }
  }

  const data = Object.entries(driverCounts).map(([driver, count]) => ({
    name: DRIVER_LABELS[driver] ?? driver.replace(/_/g, " "),
    value: count,
    color: DRIVER_COLORS[driver] ?? "#71717a",
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
        No error patterns detected
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={45}
          outerRadius={70}
          dataKey="value"
          paddingAngle={3}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#18181b",
            border: "1px solid #27272a",
            borderRadius: "6px",
            fontSize: 12,
            color: "#f4f4f5",
          }}
          formatter={(value: number | string | undefined) => {
            const n =
              typeof value === "number"
                ? value
                : typeof value === "string"
                  ? Number(value)
                  : 0;
            return [`${n} aircraft type${n !== 1 ? "s" : ""}`, ""] as [
              string,
              string,
            ];
          }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, color: "#71717a" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Delay reason chart ────────────────────────────────────────────────────────

interface DelayChartProps {
  delays: DelayReasonBreakdown[];
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
