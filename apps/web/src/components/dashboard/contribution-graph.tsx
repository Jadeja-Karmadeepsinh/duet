"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { DayDetailDialog } from "./day-detail-dialog";
import { formatIndiaDate } from "@/lib/date";
import { cn } from "@/lib/utils";

export interface DayContribution {
  date: string;
  weekday: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  completionCount: number;
  focusSeconds: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ContributionData {
  startDate: string;
  endDate: string;
  totalFocusSeconds: number;
  totalCompletions: number;
  days: DayContribution[];
}

interface ContributionGraphProps {
  data: ContributionData | null;
  todayFocusSeconds?: number;
  todayCompletions?: number;
  className?: string;
}

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Groups a contiguous array of days starting from Sunday into 7-day week columns.
 * The final week may contain fewer than 7 days if today is not Saturday.
 */
export function groupDaysIntoWeeks(days: DayContribution[]): DayContribution[][] {
  if (!days || days.length === 0) return [];

  const weeksList: DayContribution[][] = [];
  let currentWeek: DayContribution[] = [];

  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      weeksList.push(currentWeek);
      currentWeek = [];
    }
  });

  return weeksList;
}

/**
 * Derives month labels mapped strictly to week column indices.
 * A month label is assigned to the week column that contains day 1 (the start) of that month,
 * correctly handling year boundaries (e.g. Dec -> Jan) and weeks spanning two months.
 * Minimum spacing between labels is maintained to avoid visual collisions.
 */
export function deriveMonthLabels(weeks: DayContribution[][]): Map<number, string> {
  const monthMap = new Map<number, string>();
  if (!weeks || weeks.length === 0) return monthMap;

  let lastLabeledCol = -999;

  weeks.forEach((week, colIdx) => {
    // Find if this week contains day 1 of any month
    const firstOfMonthDay = week.find((d) => d.date.endsWith("-01"));
    if (firstOfMonthDay) {
      const parts = firstOfMonthDay.date.split("-");
      const monthNum = parseInt(parts[1], 10) - 1;
      // Ensure at least 3 columns of breathing space between adjacent labels and avoid labeling the very last column
      if (colIdx - lastLabeledCol >= 3 && colIdx < weeks.length - 1) {
        monthMap.set(colIdx, MONTH_NAMES[monthNum]);
        lastLabeledCol = colIdx;
      }
    }
  });

  // Label week 0 if not already labeled and if there's enough space before the next label
  if (!monthMap.has(0)) {
    const firstDay = weeks[0]?.[0];
    if (firstDay) {
      const sortedKeys = Array.from(monthMap.keys()).sort((a, b) => a - b);
      const firstLabeledCol = sortedKeys[0];
      if (firstLabeledCol === undefined || firstLabeledCol >= 3) {
        const parts = firstDay.date.split("-");
        const monthNum = parseInt(parts[1], 10) - 1;
        monthMap.set(0, MONTH_NAMES[monthNum]);
      }
    }
  }

  return monthMap;
}

export function ContributionGraph({
  data,
  todayFocusSeconds = 0,
  todayCompletions = 0,
  className,
}: ContributionGraphProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasInitiallyScrolledRef = useRef(false);

  const formatHoursMinutes = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs === 0 && mins === 0) return "0m";
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  // Derive today's date in Asia/Kolkata (YYYY-MM-DD)
  const todayKolkata = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }, []);

  // Group days into 7-day columns (weeks) and derive month labels
  const { weeks, monthLabelsByCol } = useMemo(() => {
    if (!data || !data.days || data.days.length === 0) {
      return { weeks: [], monthLabelsByCol: new Map<number, string>() };
    }

    const weeksList = groupDaysIntoWeeks(data.days);
    const monthMap = deriveMonthLabels(weeksList);

    return { weeks: weeksList, monthLabelsByCol: monthMap };
  }, [data]);

  // Auto-scroll to newest week on mobile/narrow screens only once on initial data load
  useEffect(() => {
    if (!hasInitiallyScrolledRef.current && scrollContainerRef.current && weeks.length > 0) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
      hasInitiallyScrolledRef.current = true;
    }
  }, [weeks]);

  const handleCellClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setShowDetailDialog(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent, dateStr: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCellClick(dateStr);
    }
  };

  const getLevelClass = (level: number) => {
    switch (level) {
      case 1:
        return "bg-[oklch(0.84_0.07_145)] dark:bg-[oklch(0.30_0.09_145)]";
      case 2:
        return "bg-[oklch(0.72_0.13_145)] dark:bg-[oklch(0.44_0.14_145)]";
      case 3:
        return "bg-[oklch(0.60_0.18_145)] dark:bg-[oklch(0.56_0.18_145)]";
      case 4:
        return "bg-[oklch(0.48_0.20_145)] dark:bg-[oklch(0.68_0.20_145)]";
      default:
        return "bg-muted/70 dark:bg-muted/50 border border-border/30";
    }
  };

  return (
    <TooltipProvider>
      <section
        aria-labelledby="activity-heading"
        className={cn(
          "rounded-3xl border border-border bg-card p-5 sm:p-6 surface-elevation space-y-5 transition-all min-w-0 w-full",
          className
        )}
      >
        {/* Card Header: Today's Total Focus Time at Top-Left */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-border/50 pb-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                id="activity-heading"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Activity & Focus
              </h3>
              <span className="text-[11px] text-muted-foreground">• Asia/Kolkata</span>
            </div>

            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
                {formatHoursMinutes(todayFocusSeconds)}
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                today
              </span>
              <span className="text-xs text-muted-foreground/80 tabular-nums">
                • {todayCompletions} {todayCompletions === 1 ? "task" : "tasks"} completed
              </span>
            </div>
          </div>
        </div>

        {/* Heatmap Grid Area with Internal Horizontal Scroll on Narrow Screens */}
        <div className="space-y-3">
          <div
            ref={scrollContainerRef}
            tabIndex={0}
            role="region"
            aria-label="Activity heatmap grid"
            className="w-full overflow-x-auto pb-2 scrollbar-thin outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg min-w-0"
          >
            <div className="inline-flex items-start gap-1.5 sm:gap-2 min-w-fit">
              {/* Sticky Weekday Labels (Sun, Tue, Thu) */}
              <div className="sticky left-0 bg-card z-10 flex flex-col shrink-0 select-none pr-1.5 sm:pr-2">
                {/* Spacer matching Month Header height */}
                <div className="h-4 sm:h-5 mb-1" aria-hidden="true" />
                <div className="flex flex-col gap-[2.5px] sm:gap-[3px] md:gap-[3.5px] lg:gap-[4px] text-[9px] sm:text-[10px] text-muted-foreground font-medium">
                  <span className="h-[12px] sm:h-[13px] md:h-[14px] lg:h-[15px] xl:h-[16px] leading-[12px] sm:leading-[13px] md:leading-[14px] lg:leading-[15px] xl:leading-[16px]">
                    Sun
                  </span>
                  <span
                    className="h-[12px] sm:h-[13px] md:h-[14px] lg:h-[15px] xl:h-[16px] leading-[12px] sm:leading-[13px] md:leading-[14px] lg:leading-[15px] xl:leading-[16px] opacity-0"
                    aria-hidden="true"
                  >
                    Mon
                  </span>
                  <span className="h-[12px] sm:h-[13px] md:h-[14px] lg:h-[15px] xl:h-[16px] leading-[12px] sm:leading-[13px] md:leading-[14px] lg:leading-[15px] xl:leading-[16px]">
                    Tue
                  </span>
                  <span
                    className="h-[12px] sm:h-[13px] md:h-[14px] lg:h-[15px] xl:h-[16px] leading-[12px] sm:leading-[13px] md:leading-[14px] lg:leading-[15px] xl:leading-[16px] opacity-0"
                    aria-hidden="true"
                  >
                    Wed
                  </span>
                  <span className="h-[12px] sm:h-[13px] md:h-[14px] lg:h-[15px] xl:h-[16px] leading-[12px] sm:leading-[13px] md:leading-[14px] lg:leading-[15px] xl:leading-[16px]">
                    Thu
                  </span>
                  <span
                    className="h-[12px] sm:h-[13px] md:h-[14px] lg:h-[15px] xl:h-[16px] leading-[12px] sm:leading-[13px] md:leading-[14px] lg:leading-[15px] xl:leading-[16px] opacity-0"
                    aria-hidden="true"
                  >
                    Fri
                  </span>
                  <span className="h-[12px] sm:h-[13px] md:h-[14px] lg:h-[15px] xl:h-[16px] leading-[12px] sm:leading-[13px] md:leading-[14px] lg:leading-[15px] xl:leading-[16px]">
                    Sat
                  </span>
                </div>
              </div>

              {/* Weeks Container */}
              <div className="flex flex-col min-w-0">
                {/* Month Labels Row strictly locked to Week Column widths */}
                <div className="flex gap-[2.5px] sm:gap-[3px] md:gap-[3.5px] lg:gap-[4px] mb-1 text-[10px] sm:text-[11px] text-muted-foreground font-medium select-none h-4 sm:h-5">
                  {weeks.length > 0
                    ? weeks.map((_, colIdx) => (
                        <div
                          key={colIdx}
                          className="w-[12px] sm:w-[13px] md:w-[14px] lg:w-[15px] xl:w-[16px] shrink-0 relative overflow-visible"
                        >
                          {monthLabelsByCol.has(colIdx) && (
                            <span className="absolute left-0 top-0 whitespace-nowrap">
                              {monthLabelsByCol.get(colIdx)}
                            </span>
                          )}
                        </div>
                      ))
                    : Array.from({ length: 52 }).map((_, colIdx) => (
                        <div
                          key={colIdx}
                          className="w-[12px] sm:w-[13px] md:w-[14px] lg:w-[15px] xl:w-[16px] shrink-0"
                        />
                      ))}
                </div>

                {/* Day Grid Columns */}
                <div className="flex gap-[2.5px] sm:gap-[3px] md:gap-[3.5px] lg:gap-[4px] select-none">
                  {weeks.length > 0
                    ? weeks.map((week, wIdx) => (
                        <div
                          key={wIdx}
                          className="flex flex-col gap-[2.5px] sm:gap-[3px] md:gap-[3.5px] lg:gap-[4px] w-[12px] sm:w-[13px] md:w-[14px] lg:w-[15px] xl:w-[16px] shrink-0"
                        >
                          {week.map((day) => {
                            const dateObj = new Date(`${day.date}T12:00:00Z`);
                            const formattedDate = formatIndiaDate(dateObj);
                            const isToday = day.date === todayKolkata;

                            return (
                              <Tooltip key={day.date}>
                                <TooltipTrigger
                                  render={
                                    <button
                                      type="button"
                                      tabIndex={0}
                                      aria-label={`${formattedDate}: ${day.completionCount} tasks completed, ${formatHoursMinutes(day.focusSeconds)} focus`}
                                      onClick={() => handleCellClick(day.date)}
                                      onKeyDown={(e) => handleKeyDown(e, day.date)}
                                      className={cn(
                                        "size-[12px] sm:size-[13px] md:size-[14px] lg:size-[15px] xl:size-[16px] rounded-[2.5px] sm:rounded-[3px] aspect-square transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer hover:scale-115 active:scale-95",
                                        getLevelClass(day.level),
                                        isToday && "ring-1.5 ring-primary ring-offset-1 ring-offset-card"
                                      )}
                                    />
                                  }
                                />
                                <TooltipContent
                                  side="top"
                                  className="text-xs bg-popover text-popover-foreground border border-border shadow-md py-1.5 px-3"
                                >
                                  <p className="font-semibold text-popover-foreground">
                                    {formattedDate} {isToday && "(Today)"}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {day.completionCount} completed • {formatHoursMinutes(day.focusSeconds)} focus
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      ))
                    : Array.from({ length: 52 }).map((_, wIdx) => (
                        <div
                          key={wIdx}
                          className="flex flex-col gap-[2.5px] sm:gap-[3px] md:gap-[3.5px] lg:gap-[4px] w-[12px] sm:w-[13px] md:w-[14px] lg:w-[15px] xl:w-[16px] shrink-0"
                        >
                          {Array.from({ length: 7 }).map((_, dIdx) => (
                            <div
                              key={dIdx}
                              className="size-[12px] sm:size-[13px] md:size-[14px] lg:size-[15px] xl:size-[16px] rounded-[2.5px] sm:rounded-[3px] aspect-square bg-muted/40 border border-border/20"
                            />
                          ))}
                        </div>
                      ))}
                </div>
              </div>
            </div>
          </div>

          {/* Heatmap Legend Aligned to Lower Edge */}
          <div className="flex items-center justify-between pt-2 select-none text-[11px] text-muted-foreground border-t border-border/40">
            <span className="text-[11px] text-muted-foreground/80">
              {weeks.length > 0 ? `${weeks.length} weeks of activity` : ""}
            </span>
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <span>Less</span>
              <span className="size-2.5 rounded-[2px] bg-muted/70 dark:bg-muted/50 border border-border/30" />
              <span className="size-2.5 rounded-[2px] bg-[oklch(0.84_0.07_145)] dark:bg-[oklch(0.30_0.09_145)]" />
              <span className="size-2.5 rounded-[2px] bg-[oklch(0.72_0.13_145)] dark:bg-[oklch(0.44_0.14_145)]" />
              <span className="size-2.5 rounded-[2px] bg-[oklch(0.60_0.18_145)] dark:bg-[oklch(0.56_0.18_145)]" />
              <span className="size-2.5 rounded-[2px] bg-[oklch(0.48_0.20_145)] dark:bg-[oklch(0.68_0.20_145)]" />
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Day Detail Popover / Dialog */}
        <DayDetailDialog
          date={selectedDate}
          open={showDetailDialog}
          onOpenChange={setShowDetailDialog}
        />
      </section>
    </TooltipProvider>
  );
}
