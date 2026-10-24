"use client";

import React from "react";
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

function formatHoursMinutes(sec: number) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hrs === 0 && mins === 0) return "0m";
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function CategoryDistributionChart({
  categories,
  totalFocusSeconds,
}: CategoryDistributionChartProps) {
  const isEmpty = categories.length === 0 || totalFocusSeconds === 0;

  // Sort categories by focus seconds descending
  const sortedCategories = [...categories].sort(
    (a, b) => b.focusSeconds - a.focusSeconds
  );

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-border/50 gap-2">
        <div>
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderTree className="size-4 text-primary" />
            <span>Where Your Time Goes</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ranked distribution by task category
          </p>
        </div>
        <Badge variant="secondary" className="font-mono text-xs w-fit">
          {categories.length} {categories.length === 1 ? "category" : "categories"}
        </Badge>
      </div>

      {isEmpty ? (
        <div className="h-60 sm:h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground bg-secondary/20 rounded-2xl border border-dashed border-border">
          <FolderTree className="size-8 stroke-[1.5] text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium text-foreground">No category data recorded</p>
          <p className="text-xs max-w-xs text-muted-foreground mt-0.5">
            Assign categories when creating tasks to see your focus distribution here.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5 py-1 min-w-0">
          {sortedCategories.map((cat, idx) => (
            <div key={cat.category} className="space-y-1.5 min-w-0">
              <div className="flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="size-2 rounded-full bg-primary/80 shrink-0" />
                  <span className="font-medium text-foreground truncate" title={cat.category}>
                    {cat.category}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:inline">
                    ({cat.completionCount} {cat.completionCount === 1 ? "task" : "tasks"})
                  </span>
                </div>
                <div className="flex items-center gap-2.5 font-mono shrink-0">
                  <span className="text-foreground font-semibold">
                    {formatHoursMinutes(cat.focusSeconds)}
                  </span>
                  <span className="text-muted-foreground text-[11px] w-8 text-right">
                    {cat.percentage}%
                  </span>
                </div>
              </div>

              {/* Horizontal Progress Bar */}
              <div className="h-2 w-full bg-secondary/80 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width: `${Math.max(cat.percentage, 2)}%`,
                    opacity: Math.max(1 - idx * 0.12, 0.45),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

