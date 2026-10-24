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
  binning: "daily" | "monthly";
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
      <div className="rounded-xl border border-border bg-card p-2.5 shadow-md text-xs space-y-1">
        <p className="font-semibold text-foreground">
          {point.label} ({point.key})
        </p>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 rounded-full bg-[#10b981]" />
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

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <CheckCircle2 className="size-4 text-[#10b981]" />
            <span>Task Completions Over Time</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {binning === "monthly"
              ? "Monthly completed tasks count"
              : "Daily completed tasks count (Asia/Kolkata)"}
          </p>
        </div>
        <span className="text-xs font-mono font-semibold text-[#10b981] bg-[#10b981]/10 px-2.5 py-1 rounded-full">
          Total: {totalCompletions} tasks
        </span>
      </div>

      {isEmpty ? (
        <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground bg-secondary/20 rounded-2xl border border-dashed border-border">
          <CheckCircle2 className="size-8 stroke-[1.5] text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-foreground">No task completions recorded</p>
          <p className="text-xs max-w-xs text-muted-foreground mt-0.5">
            Tasks completed during this period will display here as count bars.
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
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground"
              />
              <Tooltip content={<CompletionsTooltip />} />
              <Bar
                dataKey="completionCount"
                fill="#10b981"
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
