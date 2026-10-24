"use client";

import React from "react";
import { Clock, CheckCircle2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  focusSeconds: number;
  completedTasks: number;
  isCurrentUser: boolean;
}

interface StandingsListProps {
  entries: LeaderboardEntry[];
  period: "today" | "7d";
  currentSlot: string;
  isProvisional: boolean;
}

function formatHoursMinutes(sec: number) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hrs === 0 && mins === 0) return "0m";
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function StandingsList({
  entries,
  period,
  currentSlot,
  isProvisional,
}: StandingsListProps) {
  if (entries.length === 0) {
    return (
      <div className="bg-card rounded-2xl sm:rounded-3xl border border-dashed border-border p-8 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <User className="size-8 stroke-[1.5] text-muted-foreground/40 mb-1" />
        <p className="text-sm font-medium text-foreground">
          No active standings recorded for{" "}
          {period === "today"
            ? isProvisional
              ? "today (pre-checkpoint)"
              : `checkpoint ${currentSlot}`
            : "the rolling 7-day period"}
        </p>
        <p className="text-xs max-w-sm text-muted-foreground">
          Focus sessions completed on the Dashboard will be recorded here at the next scheduled checkpoint.
        </p>
      </div>
    );
  }

  // Determine highest focus duration in the group for proportional bar calculation
  const maxFocusSeconds = Math.max(...entries.map((e) => e.focusSeconds), 1);

  return (
    <div className="space-y-2.5">
      {entries.map((entry) => {
        const percent = Math.round((entry.focusSeconds / maxFocusSeconds) * 100);

        return (
          <div
            key={entry.userId}
            className={cn(
              "p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0",
              entry.isCurrentUser
                ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20 shadow-xs"
                : "bg-card border-border/80 shadow-xs hover:border-border"
            )}
          >
            {/* Left: Rank, Avatar, Name & Proportional Bar */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Restrained Rank Badge */}
              <div className="size-7 rounded-xl flex items-center justify-center font-mono font-semibold text-xs shrink-0 bg-secondary/80 text-foreground border border-border/50">
                #{entry.rank}
              </div>

              {/* Avatar */}
              <Avatar className="size-8 shrink-0 border border-border/60">
                <AvatarFallback className="font-semibold text-[11px] bg-secondary text-foreground">
                  {entry.displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Profile Name & Proportional Bar */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-sm text-foreground truncate" title={entry.displayName}>
                    {entry.displayName}
                  </span>
                  {entry.isCurrentUser && (
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0 px-1.5 font-medium"
                    >
                      You
                    </Badge>
                  )}
                </div>

                {/* Thin proportional focus bar */}
                <div className="h-1 w-full max-w-[200px] bg-secondary/80 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all duration-500"
                    style={{ width: `${Math.max(percent, 2)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Actual Focus Time (Primary) & Tasks Count (Supporting) */}
            <div className="flex items-center gap-4 sm:gap-6 self-end sm:self-auto shrink-0 pl-10 sm:pl-0">
              {/* Focus Time (Primary) */}
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end text-[11px] text-muted-foreground">
                  <Clock className="size-3 text-primary" />
                  <span>Focus</span>
                </div>
                <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground tabular-nums block">
                  {formatHoursMinutes(entry.focusSeconds)}
                </span>
              </div>

              {/* Completed Tasks (Supporting) */}
              <div className="text-right pl-4 border-l border-border/50 min-w-[75px]">
                <div className="flex items-center gap-1 justify-end text-[11px] text-muted-foreground">
                  <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Tasks</span>
                </div>
                <span className="text-base sm:text-lg font-bold font-mono tracking-tight text-foreground tabular-nums block">
                  {entry.completedTasks}{" "}
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {entry.completedTasks === 1 ? "task" : "tasks"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
