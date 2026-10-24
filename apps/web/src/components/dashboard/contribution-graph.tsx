"use client";

import React, { useState, useMemo } from "react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { DayDetailDialog } from "./day-detail-dialog";
import { Sparkles, Calendar, Clock, CheckCircle2 } from "lucide-react";
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
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function ContributionGraph({ data }: ContributionGraphProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const formatHoursMinutes = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs === 0 && mins === 0) return "0m";
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  // Group days into 7-day columns (weeks)
  const { weeks, monthLabels } = useMemo(() => {
    if (!data || !data.days || data.days.length === 0) {
      return { weeks: [], monthLabels: [] };
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

    // Derive month labels
    const labels: Array<{ text: string; colIndex: number }> = [];
    let lastMonth = -1;

    weeksList.forEach((week, colIdx) => {
      // Look at the first day of the week
      const firstDay = week[0];
      if (firstDay) {
        const monthNum = parseInt(firstDay.date.split("-")[1], 10) - 1;
        if (monthNum !== lastMonth) {
          labels.push({
            text: MONTH_NAMES[monthNum],
            colIndex: colIdx,
          });
          lastMonth = monthNum;
        }
      }
    });

    return { weeks: weeksList, monthLabels: labels };
  }, [data]);

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

  const isCompletelyEmpty =
    data && data.totalCompletions === 0 && data.totalFocusSeconds === 0;

  return (
    <TooltipProvider>
      <section
        aria-labelledby="contributions-heading"
        className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4"
      >
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/50 pb-4">
          <div>
            <h3 id="contributions-heading" className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Calendar className="size-4 text-[#0071e3]" />
              Focus & Completion History
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Activity across the past 26 weeks in Asia/Kolkata
            </p>
          </div>

          {/* Top-left/Top-right Summary Totals */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Clock className="size-3.5 text-muted-foreground" />
              <span>
                Total Focus: <strong className="font-semibold">{formatHoursMinutes(data?.totalFocusSeconds ?? 0)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span>
                Completed: <strong className="font-semibold">{data?.totalCompletions ?? 0} tasks</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Empty State vs Graph */}
        {isCompletelyEmpty ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-2.5 rounded-2xl bg-secondary/20 border border-dashed border-border">
            <div className="size-10 rounded-2xl bg-[#0071e3]/10 text-[#0071e3] flex items-center justify-center">
              <Sparkles className="size-5" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">
              Your first completed task will appear here
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm">
              Start a countdown session or stopwatch timer above and mark your first task completed to see your activity grid come alive.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Scrollable Container for 26 Weeks Grid */}
            <div className="overflow-x-auto pb-2 scrollbar-thin">
              <div className="min-w-[680px]">
                {/* Month labels row */}
                <div className="flex text-[10px] text-muted-foreground mb-1.5 pl-7 relative h-4">
                  {monthLabels.map((lbl, idx) => (
                    <div
                      key={idx}
                      className="absolute"
                      style={{ left: `${28 + lbl.colIndex * 14}px` }}
                    >
                      {lbl.text}
                    </div>
                  ))}
                </div>

                {/* Grid with Weekday Labels on left */}
                <div className="flex gap-1.5 items-start">
                  {/* Weekday Labels (Sun, Tue, Thu) */}
                  <div className="flex flex-col gap-[3px] text-[9px] text-muted-foreground pr-1 pt-0.5 select-none w-6">
                    <span className="h-[11px] leading-[11px]">Sun</span>
                    <span className="h-[11px] leading-[11px] opacity-0">Mon</span>
                    <span className="h-[11px] leading-[11px]">Tue</span>
                    <span className="h-[11px] leading-[11px] opacity-0">Wed</span>
                    <span className="h-[11px] leading-[11px]">Thu</span>
                    <span className="h-[11px] leading-[11px] opacity-0">Fri</span>
                    <span className="h-[11px] leading-[11px]">Sat</span>
                  </div>

                  {/* Columns (Weeks) */}
                  <div className="flex gap-[3px] flex-1">
                    {weeks.map((week, wIdx) => (
                      <div key={wIdx} className="flex flex-col gap-[3px]">
                        {week.map((day) => {
                          const dateObj = new Date(`${day.date}T12:00:00Z`);
                          const formattedDate = formatIndiaDate(dateObj);

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
                                      "size-[11px] rounded-[2px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer hover:ring-1 hover:ring-foreground/30",
                                      day.level === 0 && "bg-[#ebedf0] dark:bg-[#21262d]",
                                      day.level === 1 && "bg-[#9be9a8] dark:bg-[#0e4429]",
                                      day.level === 2 && "bg-[#40c463] dark:bg-[#006d32]",
                                      day.level === 3 && "bg-[#30a14e] dark:bg-[#26a641]",
                                      day.level === 4 && "bg-[#216e39] dark:bg-[#39d353]"
                                    )}
                                  />
                                }
                              />
                              <TooltipContent className="text-center font-normal">
                                <span className="font-semibold block">{formattedDate}</span>
                                <span className="text-[11px] text-muted-foreground block">
                                  {day.completionCount === 1 ? "1 task completed" : `${day.completionCount} tasks completed`}
                                  {day.focusSeconds > 0 && ` • ${formatHoursMinutes(day.focusSeconds)} focus`}
                                </span>
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

            {/* Less / More Legend */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span>Click any date to view detailed tasks and sessions</span>
              <div className="flex items-center gap-1.5">
                <span>Less</span>
                <div className="flex gap-[3px]">
                  <div className="size-[10px] rounded-[2px] bg-[#ebedf0] dark:bg-[#21262d]" title="0 tasks" />
                  <div className="size-[10px] rounded-[2px] bg-[#9be9a8] dark:bg-[#0e4429]" title="1 task" />
                  <div className="size-[10px] rounded-[2px] bg-[#40c463] dark:bg-[#006d32]" title="2-3 tasks" />
                  <div className="size-[10px] rounded-[2px] bg-[#30a14e] dark:bg-[#26a641]" title="4-6 tasks" />
                  <div className="size-[10px] rounded-[2px] bg-[#216e39] dark:bg-[#39d353]" title="7+ tasks" />
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Day Detail Dialog */}
      <DayDetailDialog
        date={selectedDate}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />
    </TooltipProvider>
  );
}
