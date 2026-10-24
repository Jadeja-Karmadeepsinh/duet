"use client";

import React, { useState } from "react";
import {
  Flame,
  CheckCircle2,
  Clock,
  Target,
  Trophy,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface StatsSummaryData {
  todayDate: string;
  focusSecondsToday: number;
  completedTasksToday: number;
  dailyGoalSeconds: number;
  currentStreak: number;
  bestStreak: number;
}

interface DailySummaryProps {
  stats: StatsSummaryData | null;
  loading?: boolean;
  onGoalUpdated: (newGoalSeconds: number) => void;
}

const GOAL_PRESETS = [
  { label: "2 Hours", seconds: 7200 },
  { label: "3 Hours", seconds: 10800 },
  { label: "4 Hours (Default)", seconds: 14400 },
  { label: "5 Hours", seconds: 18000 },
  { label: "6 Hours", seconds: 21600 },
  { label: "8 Hours", seconds: 28800 },
];

export function DailySummary({ stats, onGoalUpdated }: DailySummaryProps) {
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);

  const formatHoursMinutes = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs === 0 && mins === 0) return "0m";
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const focusSeconds = stats?.focusSecondsToday ?? 0;
  const goalSeconds = stats?.dailyGoalSeconds ?? 14400;
  const goalPercent = Math.min(100, Math.round((focusSeconds / goalSeconds) * 100));
  const completedTasks = stats?.completedTasksToday ?? 0;
  const currentStreak = stats?.currentStreak ?? 0;
  const bestStreak = stats?.bestStreak ?? 0;

  const handleSelectGoal = async (seconds: number) => {
    setSavingGoal(true);
    try {
      const res = await fetch("/api/v1/stats/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyGoalSeconds: seconds }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onGoalUpdated(json.data.dailyGoalSeconds);
        setShowGoalDialog(false);
      }
    } catch {
      // Ignore network error
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <>
      <section aria-labelledby="daily-summary-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 id="daily-summary-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Today&apos;s Progress
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowGoalDialog(true)}
            className="text-xs text-muted-foreground hover:text-foreground h-7 gap-1 px-2.5 rounded-lg font-medium"
          >
            <Sliders className="size-3" />
            <span>Goal: {Math.round(goalSeconds / 3600)}h</span>
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Focus Time Today */}
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Focus Time</span>
              <div className="size-8 rounded-xl bg-blue-500/10 text-[#0071e3] flex items-center justify-center">
                <Clock className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {formatHoursMinutes(focusSeconds)}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {goalPercent}% of {Math.round(goalSeconds / 3600)}h daily goal
              </p>
            </div>
          </div>

          {/* Card 2: Completed Tasks Today */}
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tasks Completed</span>
              <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="size-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {completedTasks}
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {completedTasks === 1 ? "1 task finished" : `${completedTasks} tasks finished`}
              </p>
            </div>
          </div>

          {/* Card 3: Current Streak */}
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Current Streak</span>
              <div className="size-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Flame className="size-4 fill-amber-500" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {currentStreak}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {currentStreak === 1 ? "day" : "days"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {currentStreak > 0 ? "Streak is active!" : "Complete a task today"}
            </p>
          </div>

          {/* Card 4: Best Streak */}
          <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Best Streak</span>
              <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <Trophy className="size-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {bestStreak}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                {bestStreak === 1 ? "day" : "days"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Personal record</p>
          </div>
        </div>

        {/* Daily Focus Goal Bar */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Target className="size-3.5 text-[#0071e3]" />
              <span>Daily Focus Goal</span>
            </div>
            <span className="text-muted-foreground">
              <strong className="text-foreground">{formatHoursMinutes(focusSeconds)}</strong> / {Math.round(goalSeconds / 3600)}h ({goalPercent}%)
            </span>
          </div>

          {/* Progress Track */}
          <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                goalPercent >= 100 ? "bg-emerald-500" : "bg-[#0071e3]"
              )}
              style={{ width: `${goalPercent}%` }}
            />
          </div>
        </div>
      </section>

      {/* Edit Goal Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="max-w-sm p-6 rounded-2xl bg-card border border-border shadow-xl space-y-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold tracking-tight text-foreground">
              Set Daily Focus Goal
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose your target active focus time for each day in Asia/Kolkata.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 pt-1">
            {GOAL_PRESETS.map((preset) => (
              <button
                key={preset.seconds}
                type="button"
                disabled={savingGoal}
                onClick={() => handleSelectGoal(preset.seconds)}
                className={cn(
                  "py-2.5 px-3 rounded-xl border text-xs font-medium text-left transition-all",
                  goalSeconds === preset.seconds
                    ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] font-semibold"
                    : "border-border hover:bg-secondary/40 text-muted-foreground"
                )}
              >
                <span>{preset.label}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowGoalDialog(false)}
              className="rounded-xl text-xs"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
