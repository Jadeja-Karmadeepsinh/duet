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
import { CheckCircle2 } from "lucide-react";
import type { TimeSeriesPoint } from "./focus-time-chart";

interface CompletionsChartProps {
  data: TimeSeriesPoint[];
  binning: "daily" | "weekly" | "monthly";
  totalCompletions: number;
}

interface ChartItem {
  key: string;
  label: string;
  completionCount: number;
  focusMinutes: number;
}

interface TooltipPayloadItem {
  payload: ChartItem;
}

interface CompletionsTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

// Declared outside render to avoid recreation during renders
function CompletionsTooltip({ active, payload }: CompletionsTooltipProps) {
  if (active && payload && payload.length > 0) {
    const point = payload[0].payload;
    return (
      <div className="rounded-xl border border-border bg-popover text-popover-foreground p-3 shadow-lg text-xs space-y-1.5 backdrop-blur-md">
        <p className="font-semibold text-foreground">
          {point.label} ({point.key})
        </p>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span>Completed:</span>
          <strong className="text-foreground font-mono">
            {point.completionCount} {point.completionCount === 1 ? "task" : "tasks"}
          </strong>
        </div>
        {point.focusMinutes > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {point.focusMinutes} min active focus
          </p>
        )}
      </div>
    );
  }
  return null;
}

export function CompletionsChart({
  data,
  binning,
  totalCompletions,
}: CompletionsChartProps) {
  const chartData: ChartItem[] = data.map((d) => ({
    key: d.key,
    label: d.label,
    completionCount: d.completionCount,
    focusMinutes: Math.round(d.focusSeconds / 60),
  }));

  const isEmpty = totalCompletions === 0;

  // Compute smart tick interval to prevent label collisions on narrow screens
  const getInterval = () => {
    if (data.length > 60) return Math.floor(data.length / 8);
    if (data.length > 20) return Math.floor(data.length / 7);
    if (data.length > 10) return 1;
    return 0;
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-border/50 gap-2">
        <div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>Tasks Completed</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {binning === "monthly"
              ? "Monthly completed tasks count"
              : binning === "weekly"
              ? "Weekly completed tasks count"
              : "Daily completed tasks count (Asia/Kolkata)"}
          </p>
        </div>
        <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full w-fit">
          Total: {totalCompletions} tasks
        </span>
      </div>

      {isEmpty ? (
        <div className="h-60 sm:h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground bg-secondary/20 rounded-2xl border border-dashed border-border">
          <CheckCircle2 className="size-8 stroke-[1.5] text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-foreground">No task completions recorded</p>
          <p className="text-xs max-w-xs text-muted-foreground mt-0.5">
            Tasks completed during this period will display here as count bars.
          </p>
        </div>
      ) : (
        <div className="w-full h-60 sm:h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-border/30"
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground"
                interval={getInterval()}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground"
              />
              <Tooltip content={<CompletionsTooltip />} cursor={{ fill: "currentColor", opacity: 0.05 }} />
              <Bar
                dataKey="completionCount"
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
