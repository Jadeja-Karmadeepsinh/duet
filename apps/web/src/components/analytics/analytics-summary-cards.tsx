"use client";

import React from "react";
import {
  Clock,
  CheckCircle2,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface LongestSessionRecord {
  id: string;
  taskTitle: string;
  category: string | null;
  mode: "countdown" | "stopwatch";
  trackedSeconds: number;
  startedAt: string;
}

export interface PriorPeriodComparison {
  priorStartDate: string;
  priorEndDate: string;
  priorTotalFocusSeconds: number;
  priorTotalCompletions: number;
  focusChangePercent: number | null;
  completionsChangePercent: number | null;
}

export interface AnalyticsSummary {
  totalFocusSeconds: number;
  totalCompletions: number;
  calendarDaysCount: number;
  activeDaysCount: number;
  averageFocusSecondsPerCalendarDay: number;
  averageFocusSecondsPerActiveDay: number;
  mostFocusDay: { date: string; focusSeconds: number } | null;
  mostCompletionsDay: { date: string; completionCount: number } | null;
  currentStreak: number;
  longestStreak: number;
  longestSession: LongestSessionRecord | null;
  priorPeriod: PriorPeriodComparison | null;
}

interface AnalyticsSummaryCardsProps {
  summary: AnalyticsSummary | null;
  rangeLabel: string;
}

export function AnalyticsSummaryCards({ summary, rangeLabel }: AnalyticsSummaryCardsProps) {
  if (!summary) return null;

  const formatHoursMinutes = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs === 0 && mins === 0) return "0m";
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const activeRate =
    summary.calendarDaysCount > 0
      ? Math.round((summary.activeDaysCount / summary.calendarDaysCount) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
      {/* 1. Total Focus Time */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 truncate">
            <Clock className="size-3.5 text-primary shrink-0" />
            <span>Total Focus Time</span>
          </span>
          {summary.priorPeriod && summary.priorPeriod.focusChangePercent !== null && (
            <Badge
              variant="secondary"
              className={
                summary.priorPeriod.focusChangePercent >= 0
                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-[10px] px-1.5 py-0 gap-0.5 shrink-0"
                  : "text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 text-[10px] px-1.5 py-0 gap-0.5 shrink-0"
              }
            >
              {summary.priorPeriod.focusChangePercent >= 0 ? (
                <ArrowUpRight className="size-2.5" />
              ) : (
                <ArrowDownRight className="size-2.5" />
              )}
              <span>
                {summary.priorPeriod.focusChangePercent >= 0 ? "+" : ""}
                {summary.priorPeriod.focusChangePercent}%
              </span>
            </Badge>
          )}
        </div>

        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
            {formatHoursMinutes(summary.totalFocusSeconds)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {summary.calendarDaysCount} calendar days ({rangeLabel})
          </p>
        </div>
      </div>

      {/* 2. Tasks Completed */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 truncate">
            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Tasks Completed</span>
          </span>
          {summary.priorPeriod && summary.priorPeriod.completionsChangePercent !== null && (
            <Badge
              variant="secondary"
              className={
                summary.priorPeriod.completionsChangePercent >= 0
                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-[10px] px-1.5 py-0 gap-0.5 shrink-0"
                  : "text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 text-[10px] px-1.5 py-0 gap-0.5 shrink-0"
              }
            >
              {summary.priorPeriod.completionsChangePercent >= 0 ? (
                <ArrowUpRight className="size-2.5" />
              ) : (
                <ArrowDownRight className="size-2.5" />
              )}
              <span>
                {summary.priorPeriod.completionsChangePercent >= 0 ? "+" : ""}
                {summary.priorPeriod.completionsChangePercent}%
              </span>
            </Badge>
          )}
        </div>

        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
            {summary.totalCompletions}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            {summary.activeDaysCount} of {summary.calendarDaysCount} days active ({activeRate}%)
          </p>
        </div>
      </div>

      {/* 3. Daily Average */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 truncate">
            <Clock className="size-3.5 text-primary shrink-0" />
            <span>Daily Average</span>
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/80 bg-secondary/80 px-1.5 py-0.5 rounded">
            Active
          </span>
        </div>

        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
            {formatHoursMinutes(summary.averageFocusSecondsPerActiveDay)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            <span className="font-mono">{formatHoursMinutes(summary.averageFocusSecondsPerCalendarDay)}</span> / calendar day
          </p>
        </div>
      </div>

      {/* 4. Current Streak */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 truncate">
            <Flame className="size-3.5 text-amber-500 fill-amber-500 shrink-0" />
            <span>Current Streak</span>
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/80 bg-secondary/80 px-1.5 py-0.5 rounded">
            IST
          </span>
        </div>

        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums flex items-baseline gap-1.5">
            <span>{summary.currentStreak}</span>
            <span className="text-xs font-normal font-sans text-muted-foreground">
              {summary.currentStreak === 1 ? "day" : "days"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 truncate">
            Best: <span className="font-mono font-medium text-foreground">{summary.longestStreak}</span> {summary.longestStreak === 1 ? "day" : "days"}
          </p>
        </div>
      </div>
    </div>
  );
}
