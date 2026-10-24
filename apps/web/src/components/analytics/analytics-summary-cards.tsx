"use client";

import React from "react";
import {
  Clock,
  CheckCircle2,
  Flame,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatIndiaDate } from "@/lib/date";

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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card 1: Focus Time & Daily Averages */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-[#0071e3]" />
              <span>Total Focus Time</span>
            </span>
            {summary.priorPeriod && summary.priorPeriod.focusChangePercent !== null && (
              <Badge
                variant="secondary"
                className={
                  summary.priorPeriod.focusChangePercent >= 0
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-[11px] gap-0.5"
                    : "text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 text-[11px] gap-0.5"
                }
              >
                {summary.priorPeriod.focusChangePercent >= 0 ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                <span>
                  {summary.priorPeriod.focusChangePercent >= 0 ? "+" : ""}
                  {summary.priorPeriod.focusChangePercent}% vs prior
                </span>
              </Badge>
            )}
          </div>

          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-mono tabular-nums">
              {formatHoursMinutes(summary.totalFocusSeconds)}
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              across {summary.calendarDaysCount} calendar days ({rangeLabel})
            </p>
          </div>
        </div>

        <div className="pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Daily Calendar Avg</span>
            <strong className="text-foreground font-mono">
              {formatHoursMinutes(summary.averageFocusSecondsPerCalendarDay)}/day
            </strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Active Day Avg</span>
            <strong className="text-foreground font-mono">
              {formatHoursMinutes(summary.averageFocusSecondsPerActiveDay)}/day
            </strong>
          </div>
        </div>
      </div>

      {/* Card 2: Output & Active Consistency */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" />
              <span>Tasks Completed</span>
            </span>
            {summary.priorPeriod && summary.priorPeriod.completionsChangePercent !== null && (
              <Badge
                variant="secondary"
                className={
                  summary.priorPeriod.completionsChangePercent >= 0
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 text-[11px] gap-0.5"
                    : "text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 text-[11px] gap-0.5"
                }
              >
                {summary.priorPeriod.completionsChangePercent >= 0 ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                <span>
                  {summary.priorPeriod.completionsChangePercent >= 0 ? "+" : ""}
                  {summary.priorPeriod.completionsChangePercent}% vs prior
                </span>
              </Badge>
            )}
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground font-mono tabular-nums">
              {summary.totalCompletions}
            </span>
            <span className="text-xs text-muted-foreground">completed tasks</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {summary.activeDaysCount} of {summary.calendarDaysCount} days active ({activeRate}%)
          </p>
        </div>

        <div className="pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Current Streak</span>
            <div className="flex items-center gap-1 font-semibold text-foreground">
              <Flame className="size-3.5 fill-amber-500 text-amber-500" />
              <span>{summary.currentStreak} {summary.currentStreak === 1 ? "day" : "days"}</span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Longest Streak</span>
            <div className="flex items-center gap-1 font-semibold text-foreground">
              <Trophy className="size-3.5 text-purple-600" />
              <span>{summary.longestStreak} {summary.longestStreak === 1 ? "day" : "days"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: Highlights & Records */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-xs flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-purple-600" />
              <span>Personal Records</span>
            </span>
            <Badge variant="outline" className="text-[10px] font-normal px-2 py-0">
              In Range
            </Badge>
          </div>

          <div className="mt-3 space-y-2.5 text-xs">
            {/* Most focus day */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/40 border border-border/40">
              <div className="min-w-0">
                <span className="text-[11px] text-muted-foreground block">Peak Focus Day</span>
                <span className="font-semibold text-foreground truncate block">
                  {summary.mostFocusDay
                    ? formatIndiaDate(new Date(`${summary.mostFocusDay.date}T12:00:00Z`))
                    : "No activity yet"}
                </span>
              </div>
              <span className="font-mono font-bold text-foreground shrink-0 text-sm">
                {summary.mostFocusDay ? formatHoursMinutes(summary.mostFocusDay.focusSeconds) : "—"}
              </span>
            </div>

            {/* Most completions day */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/40 border border-border/40">
              <div className="min-w-0">
                <span className="text-[11px] text-muted-foreground block">Peak Output Day</span>
                <span className="font-semibold text-foreground truncate block">
                  {summary.mostCompletionsDay
                    ? formatIndiaDate(new Date(`${summary.mostCompletionsDay.date}T12:00:00Z`))
                    : "No completions yet"}
                </span>
              </div>
              <span className="font-mono font-bold text-foreground shrink-0 text-sm">
                {summary.mostCompletionsDay ? `${summary.mostCompletionsDay.completionCount} tasks` : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Longest Session Record */}
        <div className="pt-2 border-t border-border/50 text-xs">
          <span className="text-muted-foreground block text-[11px]">Longest Individual Session</span>
          <div className="flex items-center justify-between mt-0.5">
            <span className="font-medium text-foreground truncate max-w-[180px]">
              {summary.longestSession ? summary.longestSession.taskTitle : "No recorded sessions"}
            </span>
            <span className="font-mono font-semibold text-foreground shrink-0">
              {summary.longestSession ? formatHoursMinutes(summary.longestSession.trackedSeconds) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
