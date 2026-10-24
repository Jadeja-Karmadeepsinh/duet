"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { FolderTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface CategoryStat {
  category: string;
  focusSeconds: number;
  completionCount: number;
  percentage: number;
}

interface CategoryDistributionChartProps {
  categories: CategoryStat[];
  totalFocusSeconds: number;
}

interface PieDataItem {
  name: string;
  value: number;
  percentage: number;
  completionCount: number;
  color: string;
}

interface TooltipPayloadItem {
  payload: PieDataItem;
}

interface CustomPieTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}

// Curated Apple-inspired palette: blue, indigo, purple, teal, amber, slate
const CATEGORY_COLORS = [
  "#0071e3", // Apple system blue
  "#5856d6", // Indigo
  "#af52de", // Purple
  "#00c7be", // Teal
  "#ff9500", // Amber / Orange
  "#34c759", // Green
  "#ff2d55", // Pink
  "#8e8e93", // Neutral / Gray (Uncategorized fallback)
];

function formatHoursMinutes(sec: number) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hrs === 0 && mins === 0) return "0m";
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

// Declared outside render to avoid recreation during renders
function CustomPieTooltip({ active, payload }: CustomPieTooltipProps) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-border bg-card p-2.5 shadow-md text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          <span>{data.name}</span>
        </div>
        <p className="text-muted-foreground">
          Focus:{" "}
          <strong className="text-foreground font-mono">
            {formatHoursMinutes(data.value)}
          </strong>{" "}
          ({data.percentage}%)
        </p>
        <p className="text-[11px] text-muted-foreground">
          {data.completionCount}{" "}
          {data.completionCount === 1 ? "task" : "tasks"} completed
        </p>
      </div>
    );
  }
  return null;
}

export function CategoryDistributionChart({
  categories,
  totalFocusSeconds,
}: CategoryDistributionChartProps) {
  const isEmpty = categories.length === 0 || totalFocusSeconds === 0;

  // Chart data formatted
  const pieData: PieDataItem[] = categories.map((cat, index) => ({
    name: cat.category,
    value: cat.focusSeconds,
    percentage: cat.percentage,
    completionCount: cat.completionCount,
    color:
      cat.category === "Uncategorized"
        ? "#8e8e93"
        : CATEGORY_COLORS[index % (CATEGORY_COLORS.length - 1)],
  }));

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex items-center justify-between pb-2 border-b border-border/50">
        <div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderTree className="size-4 text-[#af52de]" />
            <span>Focus Time by Category</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Distribution across project domains and tasks
          </p>
        </div>
        <Badge variant="secondary" className="font-mono text-xs">
          {categories.length} {categories.length === 1 ? "category" : "categories"}
        </Badge>
      </div>

      {isEmpty ? (
        <div className="h-48 sm:h-56 flex flex-col items-center justify-center text-center p-6 text-muted-foreground bg-secondary/20 rounded-2xl border border-dashed border-border">
          <FolderTree className="size-8 stroke-[1.5] text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-foreground">No category data recorded</p>
          <p className="text-xs max-w-xs text-muted-foreground mt-0.5">
            Assign categories to tasks when creating sessions to see your focus breakdown here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Donut Chart */}
          <div className="md:col-span-5 flex justify-center items-center">
            <div className="w-48 h-48 sm:w-56 sm:h-56 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Categories
                </span>
                <span className="text-lg font-bold font-mono text-foreground">
                  {categories.length}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Category Breakdown Bars */}
          <div className="md:col-span-7 space-y-3">
            {pieData.map((cat) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-medium text-foreground truncate">
                      {cat.name}
                    </span>
                    <span className="text-muted-foreground text-[11px] shrink-0">
                      ({cat.completionCount} {cat.completionCount === 1 ? "task" : "tasks"})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono shrink-0">
                    <span className="text-foreground font-semibold">
                      {formatHoursMinutes(cat.value)}
                    </span>
                    <span className="text-muted-foreground text-[11px] w-9 text-right">
                      {cat.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(cat.percentage, 2)}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
