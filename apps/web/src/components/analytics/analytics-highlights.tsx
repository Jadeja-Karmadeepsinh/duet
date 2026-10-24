"use client";

import React from "react";
import { Sparkles, Trophy, Calendar, Award, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AnalyticsSummary } from "./analytics-summary-cards";

interface HistoricalSession {
  id: string;
  taskTitleSnapshot: string;
  categorySnapshot?: string | null;
  trackedSeconds: number;
  status: string;
  startedAt: string;
}

interface AnalyticsHighlightsProps {
  summary: AnalyticsSummary | null;
  recentSessions: HistoricalSession[];
}

function formatHoursMinutes(sec: number) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hrs === 0 && mins === 0) return "0m";
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

function formatDateLabel(isoString: string) {
  try {
    return new Date(isoString).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return isoString;
  }
}

export function AnalyticsHighlights({
  summary,
  recentSessions,
}: AnalyticsHighlightsProps) {
  if (!summary) return null;

  // Extract up to 3 best sessions by duration from completed sessions
  const topSessions = [...recentSessions]
    .filter((s) => s.trackedSeconds > 0)
    .sort((a, b) => b.trackedSeconds - a.trackedSeconds)
    .slice(0, 3);

  return (
    <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
            Highlights & Records
          </h3>
        </div>
        <Badge variant="outline" className="text-[11px] font-mono font-medium">
          Personal Bests
        </Badge>
      </div>

      {/* 4 Key Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Most Focused Day */}
        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3 text-primary shrink-0" />
            <span>Most Focused Day</span>
          </span>
          <div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-foreground">
              {summary.mostFocusDay ? formatHoursMinutes(summary.mostFocusDay.focusSeconds) : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {summary.mostFocusDay ? formatDateLabel(`${summary.mostFocusDay.date}T12:00:00Z`) : "No activity"}
            </p>
          </div>
        </div>

        {/* 2. Most Tasks in a Day */}
        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Award className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Most Tasks in a Day</span>
          </span>
          <div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-foreground">
              {summary.mostCompletionsDay ? `${summary.mostCompletionsDay.completionCount} tasks` : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {summary.mostCompletionsDay ? formatDateLabel(`${summary.mostCompletionsDay.date}T12:00:00Z`) : "No completions"}
            </p>
          </div>
        </div>

        {/* 3. Longest Individual Session */}
        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Calendar className="size-3 text-primary shrink-0" />
            <span>Longest Session</span>
          </span>
          <div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-foreground truncate">
              {summary.longestSession ? formatHoursMinutes(summary.longestSession.trackedSeconds) : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate" title={summary.longestSession?.taskTitle}>
              {summary.longestSession ? summary.longestSession.taskTitle : "No sessions recorded"}
            </p>
          </div>
        </div>

        {/* 4. Best Streak */}
        <div className="p-3.5 rounded-2xl bg-secondary/30 border border-border/60 flex flex-col justify-between space-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Trophy className="size-3 text-amber-500 shrink-0" />
            <span>Best Streak</span>
          </span>
          <div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-foreground">
              {summary.longestStreak} {summary.longestStreak === 1 ? "day" : "days"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              Historical record
            </p>
          </div>
        </div>
      </div>

      {/* Up to Three Best Sessions */}
      {topSessions.length > 0 && (
        <div className="pt-2 border-t border-border/40 space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
            Top Sessions in Range
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {topSessions.map((session, idx) => (
              <div
                key={session.id}
                className="p-3 rounded-xl bg-secondary/20 border border-border/40 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="size-5 rounded-full bg-primary/10 text-primary text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                    #{idx + 1}
                  </span>
                  <div className="min-w-0">
                    <span className="font-medium text-foreground truncate block" title={session.taskTitleSnapshot}>
                      {session.taskTitleSnapshot}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate block">
                      {session.categorySnapshot || "General"} • {formatDateLabel(session.startedAt)}
                    </span>
                  </div>
                </div>
                <span className="font-mono font-bold text-foreground shrink-0">
                  {formatHoursMinutes(session.trackedSeconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
