"use client";

import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type {
  PlanesNeeded,
  ExpectedDemandDay,
  PipelineDemandDay,
} from "@/lib/forecasting/types";
import { TARGET_UTIL_HOURS } from "@/lib/forecasting/types";
import { formatFlightTime } from "@/lib/format";

interface ForecastChartProps {
  data: PlanesNeeded[]; // planes_needed — has available_hours, p80_demand_hours
  demand: ExpectedDemandDay[]; // has expected_total_hours (P50), p80_hours
  pipeline: PipelineDemandDay[]; // pipeline_hours
  category: string;
  aggregation?: "daily" | "weekly";
  onBarClick?: (date: string) => void;
  truthMode?: boolean;
}

interface ChartRow {
  date: string; // MM-DD or "Wk MM-DD"
  fullDate: string; // YYYY-MM-DD (week start for aggregated)
  available: number;
  confirmed: number;
  forecast_p50: number;
  forecast_p80: number;
  pipeline: number;
  implied_aircraft: number;
  status: string;
}

/** Get Monday of the ISO week containing the given YYYY-MM-DD date string */
function getISOWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, …
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function aggregateWeekly(data: ChartRow[]): ChartRow[] {
  const weekMap: Record<string, ChartRow> = {};

  for (const row of data) {
    const weekStart = getISOWeekStart(row.fullDate);
    if (!weekMap[weekStart]) {
      weekMap[weekStart] = {
        date: "Wk " + weekStart.slice(5), // "Wk MM-DD"
        fullDate: weekStart,
        available: 0,
        confirmed: 0,
        forecast_p50: 0,
        forecast_p80: 0,
        pipeline: 0,
        implied_aircraft: 0,
        status: row.status,
      };
    }
    const w = weekMap[weekStart]!;
    w.available += row.available;
    w.confirmed += row.confirmed;
    w.forecast_p50 += row.forecast_p50;
    w.forecast_p80 += row.forecast_p80;
    w.pipeline += row.pipeline;
    w.implied_aircraft += row.implied_aircraft;
    // Keep the "worst" status for the week
    if (row.status === "shortage") w.status = "shortage";
    else if (row.status === "surplus" && w.status !== "shortage")
      w.status = "surplus";
  }

  return Object.values(weekMap).sort((a, b) =>
    a.fullDate < b.fullDate ? -1 : 1,
  );
}

export function ForecastChart({
  data,
  demand,
  pipeline,
  category,
  aggregation = "daily",
  onBarClick,
  truthMode = false,
}: ForecastChartProps) {
  const filtered = data.filter((d) => d.aircraft_category === category);
  const targetUtil = TARGET_UTIL_HOURS[category] ?? 3.0;

  const chartData: ChartRow[] = filtered.map((d) => {
    const demandRow = demand.find(
      (x) => x.date === d.date && x.aircraft_category === category,
    );
    const pipelineRow = pipeline.find(
      (x) => x.date === d.date && x.aircraft_category === category,
    );

    const p80 = demandRow?.p80_hours ?? 0;
    const impliedAircraft =
      targetUtil > 0 ? Math.round((p80 / targetUtil) * 10) / 10 : 0;

    return {
      date: d.date.slice(5), // MM-DD
      fullDate: d.date,
      available: d.available_hours,
      confirmed: demandRow?.is_confirmed ? demandRow.expected_total_hours : 0,
      forecast_p50: !demandRow?.is_confirmed
        ? (demandRow?.expected_total_hours ?? 0)
        : 0,
      forecast_p80: !demandRow?.is_confirmed ? (demandRow?.p80_hours ?? 0) : 0,
      pipeline: pipelineRow?.pipeline_hours ?? 0,
      implied_aircraft: impliedAircraft,
      status: d.status,
    };
  });

  const displayData =
    aggregation === "weekly" ? aggregateWeekly(chartData) : chartData;

  if (displayData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
        No data for {category}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart
        data={displayData}
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
        {/* Left Y-axis: hours */}
        <YAxis
          yAxisId="left"
          tick={{ fill: "#71717a", fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={36}
          unit="hrs"
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
          ) => {
            return [
              typeof value === "number" ? formatFlightTime(value) : "—",
              name === "available"
                ? "Fleet capacity (available hours)"
                : name === "confirmed"
                  ? "Booked flights"
                  : name === "forecast_p50"
                    ? "Expected demand"
                    : name === "forecast_p80"
                      ? "Upper estimate (high-demand scenario)"
                      : (name ?? ""),
            ] as [string, string];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#71717a" }}
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              available: "Fleet capacity",
              confirmed: "Booked flights",
              forecast_p50: "Expected demand",
            };
            if (value === "forecast_p80" || value === "pipeline") return "";
            return labels[value] ?? value;
          }}
        />

        {/* Available capacity */}
        <Bar
          yAxisId="left"
          dataKey="available"
          name="available"
          fill="#3f3f46"
          radius={[2, 2, 0, 0]}
          onClick={(_, index) =>
            onBarClick?.(displayData[index]?.fullDate ?? "")
          }
        />

        {/* Confirmed demand (hard actuals) */}
        <Bar
          yAxisId="left"
          dataKey="confirmed"
          name="confirmed"
          fill="#10b981"
          radius={[2, 2, 0, 0]}
          onClick={(_, index) =>
            onBarClick?.(displayData[index]?.fullDate ?? "")
          }
        />

        {/* Forecast P50 — hidden in truthMode */}
        {!truthMode && (
          <Bar
            yAxisId="left"
            dataKey="forecast_p50"
            name="forecast_p50"
            fill="#fbbf24"
            fillOpacity={0.6}
            radius={[2, 2, 0, 0]}
            onClick={(_, index) =>
              onBarClick?.(displayData[index]?.fullDate ?? "")
            }
          />
        )}

        {/* P80 uncertainty band — hidden in truthMode */}
        {!truthMode && (
          <Area
            yAxisId="left"
            dataKey="forecast_p80"
            name="forecast_p80"
            fill="#fbbf24"
            fillOpacity={0.15}
            stroke="none"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
