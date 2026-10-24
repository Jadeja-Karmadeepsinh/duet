"use client";

import React from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakCardProps {
  currentStreak: number;
  bestStreak: number;
  completedTasksToday?: number;
  className?: string;
}

export function StreakCard({
  currentStreak,
  bestStreak,
  completedTasksToday = 0,
  className,
}: StreakCardProps) {
  const completedToday = completedTasksToday > 0;

  let statusMessage = "Complete your first task to start a streak";
  if (completedToday) {
    statusMessage = "Streak locked in for today!";
  } else if (currentStreak > 0) {
    statusMessage = "Complete a task today to keep your streak alive";
  }

  return (
    <div
      className={cn(
        "rounded-3xl border border-border bg-card p-5 sm:p-6 surface-elevation flex items-center justify-between gap-4 transition-colors",
        className
      )}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={cn(
            "size-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
            currentStreak > 0
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-secondary text-muted-foreground"
          )}
        >
          <Flame
            className={cn(
              "size-5",
              currentStreak > 0 ? "fill-amber-500 text-amber-500" : "text-muted-foreground"
            )}
          />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {currentStreak} {currentStreak === 1 ? "Day" : "Days"}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              Current Streak
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-xs mt-0.5">
            {statusMessage}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-end text-right shrink-0 border-l border-border/50 pl-4">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Best Record
        </span>
        <span className="text-sm font-bold text-foreground tabular-nums mt-0.5">
          {bestStreak} {bestStreak === 1 ? "day" : "days"}
        </span>
      </div>
    </div>
  );
}
