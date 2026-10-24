"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type AnalyticsRange = "7d" | "30d" | "90d" | "1y" | "lifetime";

interface RangeSelectorProps {
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  startDate?: string;
  endDate?: string;
  rangeLabel?: string;
  disabled?: boolean;
}

const RANGES: Array<{ id: AnalyticsRange; label: string }> = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
  { id: "1y", label: "1Y" },
  { id: "lifetime", label: "All" },
];

export function RangeSelector({
  range,
  onRangeChange,
  startDate,
  endDate,
  rangeLabel,
  disabled,
}: RangeSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Range Pills */}
      <div
        role="radiogroup"
        aria-label="Analytics date range"
        className="inline-flex p-1 rounded-2xl bg-secondary/60 border border-border/50 shadow-xs"
      >
        {RANGES.map((r) => {
          const isSelected = range === r.id;
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onRangeChange(r.id)}
              className={cn(
                "px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all select-none cursor-pointer",
                isSelected
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Exact Inclusive Date Range Label */}
      {startDate && endDate && (
        <div className="text-xs text-muted-foreground font-mono">
          <span className="font-semibold text-foreground">{rangeLabel || range}</span>
          <span className="mx-1.5">•</span>
          <span>{startDate}</span>
          <span className="mx-1">→</span>
          <span>{endDate}</span>
          <span className="ml-1 text-[11px] text-muted-foreground/80">(IST)</span>
        </div>
      )}
    </div>
  );
}
