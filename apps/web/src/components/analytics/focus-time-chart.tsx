"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { Clock } from "lucide-react";

export interface TimeSeriesPoint {
  key: string;
  label: string;
  focusSeconds: number;
  completionCount: number;
}

interface FocusTimeChartProps {
  data: TimeSeriesPoint[];
  binning: "daily" | "monthly";
  totalFocusSeconds: number;
}

interface ChartItem {
  key: string;
  label: string;
  focusMinutes: number;
  focusSeconds: number;
  completionCount: number;
}

interface TooltipPayloadItem {
  payload: ChartItem;
}

interface FocusTimeTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

function formatHoursMinutes(sec: number) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hrs === 0 && mins === 0) return "0m";
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

// Declared outside render to avoid recreation during renders
function FocusTimeTooltip({ active, payload }: FocusTimeTooltipProps) {
  if (active && payload && payload.length > 0) {
    const point = payload[0].payload;
    return (
      <div className="rounded-xl border border-border bg-card p-2.5 shadow-md text-xs space-y-1">
        <p className="font-semibold text-foreground">
          {point.label} ({point.key})
        </p>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-[#0071e3]" />
          <span>Focus:</span>
          <strong className="text-foreground font-mono">
            {formatHoursMinutes(point.focusSeconds)}
          </strong>
        </div>
        {point.completionCount > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {point.completionCount}{" "}
            {point.completionCount === 1 ? "task" : "tasks"} completed
          </p>
        )}
      </div>
    );
  }
  return null;
}

export function FocusTimeChart({
  data,
  binning,
  totalFocusSeconds,
}: FocusTimeChartProps) {
  const chartData: ChartItem[] = data.map((d) => ({
    key: d.key,
    label: d.label,
    focusMinutes: Math.round(d.focusSeconds / 60),
    focusSeconds: d.focusSeconds,
    completionCount: d.completionCount,
  }));

  const isEmpty = totalFocusSeconds === 0;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Clock className="size-4 text-[#0071e3]" />
            <span>Focus Time Over Time</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {binning === "monthly"
              ? "Monthly active focus duration"
              : "Daily active focus duration (Asia/Kolkata)"}
          </p>
        </div>
        <span className="text-xs font-mono font-semibold text-[#0071e3] bg-[#0071e3]/10 px-2.5 py-1 rounded-full">
          Total: {formatHoursMinutes(totalFocusSeconds)}
        </span>
      </div>

      {isEmpty ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground bg-secondary/20 rounded-2xl border border-dashed border-border">
          <Clock className="size-8 stroke-[1.5] text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-foreground">No focus activity recorded</p>
          <p className="text-xs max-w-xs text-muted-foreground mt-0.5">
            Focus sessions recorded during this period will display here as daily duration bars.
          </p>
        </div>
      ) : (
        <div className="w-full h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-border/40"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground"
                interval={data.length > 31 ? Math.floor(data.length / 8) : 0}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground"
                tickFormatter={(mins) =>
                  mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`
                }
              />
              <Tooltip content={<FocusTimeTooltip />} />
              <Bar
                dataKey="focusMinutes"
                fill="#0071e3"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
