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

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function ContributionGraph({
  data,
  todayFocusSeconds = 0,
  todayCompletions = 0,
  className,
}: ContributionGraphProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  // Group days into 7-day columns (weeks)
  const { weeks, monthLabelsByCol } = useMemo(() => {
    if (!data || !data.days || data.days.length === 0) {
      return { weeks: [], monthLabelsByCol: new Map<number, string>() };
    }

    const weeksList: DayContribution[][] = [];
    let currentWeek: DayContribution[] = [];

    data.days.forEach((day, index) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || index === data.days.length - 1) {
        weeksList.push(currentWeek);
        currentWeek = [];
      }
    });

    // Derive month labels strictly keyed by column index
    const monthMap = new Map<number, string>();
    let lastMonth = -1;

    weeksList.forEach((week, colIdx) => {
      const firstDay = week[0];
      if (firstDay) {
        const parts = firstDay.date.split("-");
        const monthNum = parseInt(parts[1], 10) - 1;
        // Place label if month changed and not too close to the end
        if (monthNum !== lastMonth) {
          monthMap.set(colIdx, MONTH_NAMES[monthNum]);
          lastMonth = monthNum;
        }
      }
    });

    return { weeks: weeksList, monthLabelsByCol: monthMap };
  }, [data]);

  // Auto-scroll to newest week on mobile/narrow screens
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
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
          "rounded-3xl border border-border bg-card p-5 sm:p-6 surface-elevation space-y-5 transition-all",
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

          {/* Concise Heatmap Legend */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground self-start sm:self-auto shrink-0 select-none">
            <span>Less</span>
            <span className="size-2.5 rounded-[2px] bg-muted/70 dark:bg-muted/50 border border-border/30" />
            <span className="size-2.5 rounded-[2px] bg-[oklch(0.84_0.07_145)] dark:bg-[oklch(0.30_0.09_145)]" />
            <span className="size-2.5 rounded-[2px] bg-[oklch(0.72_0.13_145)] dark:bg-[oklch(0.44_0.14_145)]" />
            <span className="size-2.5 rounded-[2px] bg-[oklch(0.60_0.18_145)] dark:bg-[oklch(0.56_0.18_145)]" />
            <span className="size-2.5 rounded-[2px] bg-[oklch(0.48_0.20_145)] dark:bg-[oklch(0.68_0.20_145)]" />
            <span>More</span>
          </div>
        </div>

        {/* Heatmap Grid Area with Internal Horizontal Scroll on Narrow Screens */}
        <div className="space-y-1.5">
          <div
            ref={scrollContainerRef}
            tabIndex={0}
            role="region"
            aria-label="Activity heatmap grid"
            className="overflow-x-auto pb-2 scrollbar-thin outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-lg"
          >
            <div className="inline-block min-w-fit">
              {/* Month Labels Row strictly matching grid column width */}
              <div className="flex mb-1 pl-7 text-[10px] text-muted-foreground font-medium select-none h-4">
                {weeks.map((_, colIdx) => (
                  <div
                    key={colIdx}
                    className="w-[15px] shrink-0 text-left relative overflow-visible"
                  >
                    {monthLabelsByCol.has(colIdx) && (
                      <span className="absolute left-0 top-0 whitespace-nowrap">
                        {monthLabelsByCol.get(colIdx)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Grid: Weekday Labels + Week Columns */}
              <div className="flex items-start gap-1">
                {/* Weekday Labels (Sun, Tue, Thu) */}
                <div className="flex flex-col gap-[3px] text-[9px] text-muted-foreground pr-1 pt-0.5 select-none w-6 shrink-0">
                  <span className="h-[12px] leading-[12px]">Sun</span>
                  <span className="h-[12px] leading-[12px] opacity-0">Mon</span>
                  <span className="h-[12px] leading-[12px]">Tue</span>
                  <span className="h-[12px] leading-[12px] opacity-0">Wed</span>
                  <span className="h-[12px] leading-[12px]">Thu</span>
                  <span className="h-[12px] leading-[12px] opacity-0">Fri</span>
                  <span className="h-[12px] leading-[12px]">Sat</span>
                </div>

                {/* Columns (Weeks) */}
                <div className="flex gap-[3px] select-none">
                  {weeks.map((week, wIdx) => (
                    <div key={wIdx} className="flex flex-col gap-[3px] w-[12px] shrink-0">
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
                                    "size-[12px] rounded-[2.5px] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer hover:scale-115 active:scale-95",
                                    getLevelClass(day.level),
                                    isToday && "ring-1.5 ring-primary ring-offset-1 ring-offset-card"
                                  )}
                                />
                              }
                            />
                            <TooltipContent side="top" className="text-xs">
                              <p className="font-semibold text-foreground">
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
                  ))}
                </div>
              </div>
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
