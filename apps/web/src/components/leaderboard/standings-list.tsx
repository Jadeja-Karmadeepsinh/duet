"use client";

import React from "react";
import { Trophy, Clock, CheckCircle2, Medal } from "lucide-react";
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

export function StandingsList({
  entries,
  period,
  currentSlot,
  isProvisional,
}: StandingsListProps) {
  const formatHoursMinutes = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs === 0 && mins === 0) return "0m";
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  if (entries.length === 0) {
    return (
      <div className="bg-card rounded-3xl border border-dashed border-border p-8 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Trophy className="size-8 stroke-[1.5] text-muted-foreground/40 mb-1" />
        <p className="text-sm font-medium text-foreground">
          No active standings recorded for {period === "today" ? (isProvisional ? "today (live)" : `checkpoint ${currentSlot}`) : "the rolling 7-day period"}
        </p>
        <p className="text-xs max-w-sm text-muted-foreground">
          Complete focus sessions from the Dashboard to record activity for team checkpoints.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* List of active profile standings */}
      <div className="grid grid-cols-1 gap-3">
        {entries.map((entry) => {
          const isFirst = entry.rank === 1;

          return (
            <div
              key={entry.userId}
              className={cn(
                "p-4 sm:p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4",
                isFirst
                  ? "bg-gradient-to-r from-amber-500/10 via-card to-card border-amber-500/30 shadow-xs"
                  : "bg-card border-border/80 shadow-xs hover:border-border",
                entry.isCurrentUser && "ring-1 ring-[#0071e3]/40"
              )}
            >
              {/* Left: Rank, Avatar, Name */}
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Rank Badge */}
                <div
                  className={cn(
                    "size-9 rounded-2xl flex items-center justify-center font-mono font-bold text-sm shrink-0",
                    isFirst
                      ? "bg-amber-500 text-amber-950 shadow-xs"
                      : entry.rank === 2
                      ? "bg-secondary text-foreground border border-border"
                      : entry.rank === 3
                      ? "bg-secondary text-muted-foreground border border-border"
                      : "bg-secondary/40 text-muted-foreground"
                  )}
                >
                  {isFirst ? <Medal className="size-4" /> : `#${entry.rank}`}
                </div>

                {/* Avatar */}
                <Avatar className="size-10 shrink-0 border border-border/50">
                  <AvatarFallback
                    className={cn(
                      "font-semibold text-xs",
                      isFirst
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                        : "bg-secondary text-foreground"
                    )}
                  >
                    {entry.displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Name & Badge */}
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {entry.displayName}
                    </span>
                    {entry.isCurrentUser && (
                      <Badge
                        variant="secondary"
                        className="bg-[#0071e3]/10 text-[#0071e3] border-[#0071e3]/20 text-[10px] py-0 px-1.5"
                      >
                        You
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground block truncate">
                    Team Member
                  </span>
                </div>
              </div>

              {/* Right: Actual Focus Time & Tasks Count */}
              <div className="flex items-center gap-6 self-end sm:self-auto shrink-0">
                {/* Focus Time */}
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end text-xs text-muted-foreground">
                    <Clock className="size-3 text-[#0071e3]" />
                    <span>Focus Time</span>
                  </div>
                  <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-foreground tabular-nums block mt-0.5">
                    {formatHoursMinutes(entry.focusSeconds)}
                  </span>
                </div>

                {/* Completed Tasks */}
                <div className="text-right pl-6 border-l border-border/50 min-w-[90px]">
                  <div className="flex items-center gap-1.5 justify-end text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3 text-emerald-500" />
                    <span>Completed</span>
                  </div>
                  <span className="text-lg sm:text-xl font-bold font-mono tracking-tight text-foreground tabular-nums block mt-0.5">
                    {entry.completedTasks}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      {entry.completedTasks === 1 ? "task" : "tasks"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
