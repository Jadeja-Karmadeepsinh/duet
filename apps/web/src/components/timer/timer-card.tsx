"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DecisionDialog } from "./decision-dialog";
import { AddTaskDialog } from "../tasks/add-task-dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, statusPillVariants } from "@/lib/motion";

export interface ActiveSession {
  id: string;
  mode: "countdown" | "stopwatch";
  status: "running" | "paused" | "awaiting_decision" | "completed" | "stopped";
  targetDurationSeconds: number | null;
  trackedSeconds: number;
  taskId?: string | null;
  taskTitleSnapshot: string;
  categorySnapshot?: string | null;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  isExpired: boolean;
  staleRunningWarning: boolean;
  activeSegmentStartedAt?: string | null;
}

export interface TaskItem {
  id: string;
  title: string;
  category: string | null;
  plannedDurationSeconds: number | null;
  status: string;
  createdAt: string;
}

interface TimerCardProps {
  currentSession: ActiveSession | null;
  tasks: TaskItem[];
  loadingSession: boolean;
  onSessionUpdated: (session: ActiveSession | null) => void;
  onStatsRefresh: () => void;
  onTaskCreated: (task: TaskItem) => void;
  selectedTaskId: string | null;
  onSelectTaskId: (id: string | null) => void;
}

export function TimerCard({
  currentSession,
  tasks,
  loadingSession,
  onSessionUpdated,
  onStatsRefresh,
  onTaskCreated,
  selectedTaskId,
  onSelectTaskId,
}: TimerCardProps) {
  const [now, setNow] = useState<number>(() => Date.now());
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [completedSuccess, setCompletedSuccess] = useState(false);
  const [decisionDismissed, setDecisionDismissed] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const expiredCallInProgressRef = useRef(false);

  // Determine current active task
  const activeTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0] || null;

  // Sync selected task if not set and tasks available
  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      onSelectTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId, onSelectTaskId]);

  // Handle countdown expiry call to backend
  const triggerExpiry = useCallback(async (sessionId: string) => {
    if (expiredCallInProgressRef.current) return;
    expiredCallInProgressRef.current = true;

    try {
      const res = await fetch(`/api/v1/work-sessions/${sessionId}/expire`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          onSessionUpdated(json.data.session);
          setDecisionDismissed(false);
        }
      }
    } catch {
      // Ignore network error; fallback on polling reconcile
    } finally {
      expiredCallInProgressRef.current = false;
    }
  }, [onSessionUpdated]);

  // Live ticking timer
  useEffect(() => {
    if (currentSession?.status !== "running") return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(interval);
  }, [currentSession?.status]);

  // Calculate displaySeconds as a derived value
  let displaySeconds = 0;
  if (!currentSession) {
    displaySeconds = activeTask?.plannedDurationSeconds ?? 0;
  } else if (currentSession.status === "running") {
    const segStart = currentSession.activeSegmentStartedAt
      ? new Date(currentSession.activeSegmentStartedAt).getTime()
      : now;
    const currentElapsed = Math.max(0, Math.floor((now - segStart) / 1000));
    const totalElapsed = currentSession.trackedSeconds + currentElapsed;

    if (currentSession.mode === "countdown") {
      const target = currentSession.targetDurationSeconds ?? 0;
      displaySeconds = Math.max(0, target - totalElapsed);
    } else {
      displaySeconds = totalElapsed;
    }
  } else if (currentSession.status === "paused") {
    if (currentSession.mode === "countdown") {
      const target = currentSession.targetDurationSeconds ?? 0;
      displaySeconds = Math.max(0, target - currentSession.trackedSeconds);
    } else {
      displaySeconds = currentSession.trackedSeconds;
    }
  } else if (currentSession.status === "awaiting_decision") {
    displaySeconds = 0;
  } else {
    displaySeconds = currentSession.trackedSeconds;
  }

  // Trigger expiry when running countdown hits zero
  useEffect(() => {
    if (
      currentSession?.status === "running" &&
      currentSession.mode === "countdown" &&
      displaySeconds === 0 &&
      !expiredCallInProgressRef.current
    ) {
      triggerExpiry(currentSession.id);
    }
  }, [currentSession?.status, currentSession?.mode, currentSession?.id, displaySeconds, triggerExpiry]);

  const showDecisionDialog = currentSession?.status === "awaiting_decision" && !decisionDismissed;

  // Format MM:SS or HH:MM:SS
  const formatTime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Progress ring math (Strictly for Countdown mode, not fake for stopwatch)
  const radius = 95;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;

  let progress = 0;
  const isCountdown = currentSession ? currentSession.mode === "countdown" : !!activeTask?.plannedDurationSeconds;

  if (currentSession && currentSession.mode === "countdown" && currentSession.targetDurationSeconds) {
    const totalElapsed = currentSession.targetDurationSeconds - displaySeconds;
    progress = Math.min(1, Math.max(0, totalElapsed / currentSession.targetDurationSeconds));
  } else if (!currentSession && activeTask?.plannedDurationSeconds) {
    progress = 0; // ready state
  }

  const strokeDashoffset = circumference * (1 - progress);

  // API Action Mutators
  const handleStartSession = async () => {
    if (!activeTask) {
      setShowAddTaskDialog(true);
      return;
    }

    setPendingAction("start");
    try {
      const res = await fetch("/api/v1/work-sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: activeTask.id }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onSessionUpdated(json.data.session);
        onStatsRefresh();
      }
    } catch {
      // Handle network error
    } finally {
      setPendingAction(null);
    }
  };

  const handlePauseSession = async () => {
    if (!currentSession) return;
    setPendingAction("pause");
    try {
      const res = await fetch(`/api/v1/work-sessions/${currentSession.id}/pause`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onSessionUpdated(json.data.session);
        onStatsRefresh();
      }
    } catch {
      // Handle error
    } finally {
      setPendingAction(null);
    }
  };

  const handleResumeSession = async () => {
    if (!currentSession) return;
    setPendingAction("resume");
    try {
      const res = await fetch(`/api/v1/work-sessions/${currentSession.id}/resume`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onSessionUpdated(json.data.session);
        onStatsRefresh();
      }
    } catch {
      // Handle error
    } finally {
      setPendingAction(null);
    }
  };

  const handleCompleteSession = async () => {
    if (!currentSession) return;
    setPendingAction("complete");
    try {
      const res = await fetch(`/api/v1/work-sessions/${currentSession.id}/complete`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setCompletedSuccess(true);
        setTimeout(() => {
          setCompletedSuccess(false);
          onSessionUpdated(null);
          setDecisionDismissed(true);
          onStatsRefresh();
        }, 400);
        return;
      }
    } catch {
      // Handle error
    } finally {
      setPendingAction(null);
    }
  };

  const handleStopSession = async () => {
    if (!currentSession) return;
    setPendingAction("stop");
    try {
      const res = await fetch(`/api/v1/work-sessions/${currentSession.id}/stop`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onSessionUpdated(null);
        setDecisionDismissed(true);
        onStatsRefresh();
      }
    } catch {
      // Handle error
    } finally {
      setPendingAction(null);
    }
  };

  const handleExtendSession = async (extensionSeconds: number) => {
    if (!currentSession) return;
    setPendingAction(`extend-${extensionSeconds}`);
    try {
      const res = await fetch(`/api/v1/work-sessions/${currentSession.id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extensionSeconds }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onSessionUpdated(json.data.session);
        setDecisionDismissed(true);
        onStatsRefresh();
      }
    } catch {
      // Handle error
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-8 surface-elevation transition-all flex flex-col justify-between min-h-[440px]",
          currentSession?.status === "running" && "ring-1 ring-primary/40 shadow-sm"
        )}
      >
        {/* Stale Running Recovery Warning Banner */}
        {currentSession?.staleRunningWarning && (
          <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <strong>Session Recovery Notice:</strong> This session has been running for over 12 hours. You can complete or stop it without losing recorded focus time.
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center text-center w-full">
          {/* Top Status & Mode Caption */}
          <div className="flex items-center justify-center gap-2 mb-3 min-h-[26px]">
            <AnimatePresence mode="wait">
              {currentSession ? (
                <motion.div
                  key={`session-${currentSession.status}-${currentSession.mode}`}
                  variants={statusPillVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex items-center gap-2"
                >
                  <Badge
                    variant={currentSession.status === "running" ? "default" : "secondary"}
                    className={cn(
                      "text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-0.5",
                      currentSession.status === "running" &&
                        "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25",
                      currentSession.status === "paused" &&
                        "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25",
                      currentSession.status === "awaiting_decision" &&
                        "bg-primary/15 text-primary border border-primary/25"
                    )}
                  >
                    {currentSession.status === "running" ? (
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Running
                      </span>
                    ) : currentSession.status === "paused" ? (
                      <span className="flex items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        Paused
                      </span>
                    ) : (
                      currentSession.status.replace("_", " ")
                    )}
                  </Badge>
                  <span className="text-xs text-muted-foreground/60">•</span>
                  <span className="text-xs font-semibold text-muted-foreground capitalize">
                    {currentSession.mode}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="session-ready"
                  variants={statusPillVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="flex items-center gap-2"
                >
                  <Badge
                    variant="outline"
                    className="text-[10.5px] font-semibold uppercase tracking-wider px-2.5 py-0.5 text-muted-foreground"
                  >
                    Ready
                  </Badge>
                  <span className="text-xs text-muted-foreground/60">•</span>
                  {activeTask?.plannedDurationSeconds ? (
                    <span className="text-xs text-muted-foreground font-medium">
                      {Math.round(activeTask.plannedDurationSeconds / 60)}m Countdown
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-medium">Stopwatch</span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Task Selector or Active Task Title */}
          <div className="mb-4 max-w-md w-full">
            {currentSession ? (
              <div className="flex flex-col items-center gap-1">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate max-w-xs sm:max-w-md">
                  {currentSession.taskTitleSnapshot}
                </h2>
                {currentSession.categorySnapshot && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">
                    {currentSession.categorySnapshot}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                {tasks.length > 0 ? (
                  <div className="flex items-center gap-2 max-w-full">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="outline"
                            className="rounded-xl px-3.5 py-1.5 text-xs font-semibold border-border hover:bg-secondary/60 flex items-center gap-2 max-w-[220px] sm:max-w-[320px] min-w-0 truncate"
                          >
                            <span className="truncate min-w-0">{activeTask?.title || "Select focus task"}</span>
                            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent className="w-72 rounded-xl p-1.5 shadow-lg border border-border z-50">
                        <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase">
                          Select Focus Task
                        </div>
                        {tasks.map((task) => (
                          <DropdownMenuItem
                            key={task.id}
                            onClick={() => onSelectTaskId(task.id)}
                            className={cn(
                              "rounded-lg px-2.5 py-1.5 text-xs flex items-center justify-between cursor-pointer",
                              selectedTaskId === task.id && "bg-secondary font-semibold"
                            )}
                          >
                            <span className="truncate">{task.title}</span>
                            <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                              {task.plannedDurationSeconds
                                ? `${Math.round(task.plannedDurationSeconds / 60)}m`
                                : "Stopwatch"}
                            </span>
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator className="my-1" />
                        <DropdownMenuItem
                          onClick={() => setShowAddTaskDialog(true)}
                          className="rounded-lg px-2.5 py-1.5 text-xs text-primary font-medium flex items-center gap-2 cursor-pointer"
                        >
                          <Plus className="size-3.5" />
                          <span>New Task</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowAddTaskDialog(true)}
                      aria-label="Create new task"
                      title="Create new task"
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowAddTaskDialog(true)}
                    className="rounded-xl px-3.5 py-2 text-xs font-medium border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    <span>Create first task</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Central Timer Surface: SVG Ring (Countdown only) or Ambient Track (Stopwatch) */}
          <div className="relative size-56 sm:size-64 flex items-center justify-center my-2 select-none">
            <svg
              className="size-full -rotate-90 transform"
              viewBox="0 0 210 210"
              aria-hidden="true"
            >
              {/* Background Track Circle */}
              <circle
                cx="105"
                cy="105"
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="transparent"
                className="text-border/40"
              />
              {/* Active Progress Ring - strictly for Countdown mode */}
              {isCountdown && (
                <circle
                  cx="105"
                  cy="105"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  className={cn(
                    "transition-all duration-500 ease-out",
                    currentSession?.status === "paused" ? "text-amber-500" : "text-primary"
                  )}
                />
              )}
            </svg>

            {/* Fixed-Width Tabular Digits Surface */}
            <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
              <span
                className="font-mono text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground tabular-nums drop-shadow-xs"
                aria-live="polite"
              >
                {formatTime(displaySeconds)}
              </span>
              <span className="text-[11px] font-semibold text-muted-foreground mt-1 tracking-wider uppercase">
                {currentSession?.mode === "countdown"
                  ? currentSession.status === "awaiting_decision"
                    ? "Time's Up"
                    : "Remaining"
                  : currentSession
                  ? "Elapsed"
                  : "Ready"}
              </span>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2.5 mt-4 w-full max-w-sm">
            {!currentSession ? (
              /* Idle: Primary Start Focus Button */
              <Button
                type="button"
                size="lg"
                disabled={pendingAction !== null || loadingSession}
                onClick={handleStartSession}
                className="w-full sm:w-auto min-w-[180px] rounded-xl px-6 py-2.5 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs press-scale flex items-center justify-center gap-2"
              >
                <Play className="size-4 fill-current" />
                <span>Start Focus</span>
              </Button>
            ) : currentSession.status === "running" ? (
              /* Running Session: Pause, Complete, Stop */
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  disabled={pendingAction !== null}
                  onClick={handlePauseSession}
                  className="flex-1 rounded-xl text-xs font-semibold press-scale flex items-center justify-center gap-1.5"
                >
                  <Pause className="size-3.5" />
                  <span>Pause</span>
                </Button>
                <Button
                  type="button"
                  size="default"
                  disabled={pendingAction !== null}
                  onClick={handleCompleteSession}
                  className={cn(
                    "flex-1 rounded-xl text-xs font-semibold shadow-xs press-scale flex items-center justify-center gap-1.5 transition-all",
                    completedSuccess
                      ? "bg-emerald-500 text-white scale-[1.02]"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  )}
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>{completedSuccess ? "Completed!" : "Complete"}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  disabled={pendingAction !== null}
                  onClick={handleStopSession}
                  className="rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 press-scale flex items-center justify-center gap-1"
                >
                  <Square className="size-3" />
                  <span>End</span>
                </Button>
              </>
            ) : currentSession.status === "paused" ? (
              /* Paused Session: Resume (Primary), Complete, Stop */
              <>
                <Button
                  type="button"
                  size="default"
                  disabled={pendingAction !== null}
                  onClick={handleResumeSession}
                  className="flex-1 rounded-xl text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs press-scale flex items-center justify-center gap-1.5"
                >
                  <Play className="size-3.5 fill-current" />
                  <span>Resume</span>
                </Button>
                <Button
                  type="button"
                  size="default"
                  disabled={pendingAction !== null}
                  onClick={handleCompleteSession}
                  className={cn(
                    "flex-1 rounded-xl text-xs font-semibold shadow-xs press-scale flex items-center justify-center gap-1.5 transition-all",
                    completedSuccess
                      ? "bg-emerald-500 text-white scale-[1.02]"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  )}
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>{completedSuccess ? "Completed!" : "Complete"}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="default"
                  disabled={pendingAction !== null}
                  onClick={handleStopSession}
                  className="rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 press-scale flex items-center justify-center gap-1"
                >
                  <Square className="size-3" />
                  <span>End</span>
                </Button>
              </>
            ) : currentSession.status === "awaiting_decision" ? (
              /* Awaiting Decision */
              <Button
                type="button"
                size="default"
                onClick={() => setDecisionDismissed(false)}
                className="w-full sm:w-auto rounded-xl px-6 py-2.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs press-scale flex items-center justify-center gap-2"
              >
                <Sparkles className="size-4" />
                <span>Review Decision</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Target Reached Decision Dialog */}
      <DecisionDialog
        open={showDecisionDialog}
        session={
          currentSession
            ? {
                id: currentSession.id,
                taskTitleSnapshot: currentSession.taskTitleSnapshot,
                categorySnapshot: currentSession.categorySnapshot,
                targetDurationSeconds: currentSession.targetDurationSeconds,
                trackedSeconds: currentSession.trackedSeconds,
              }
            : null
        }
        loadingAction={pendingAction}
        onComplete={handleCompleteSession}
        onExtend={handleExtendSession}
        onStop={handleStopSession}
      />

      {/* Add Task Dialog */}
      <AddTaskDialog
        open={showAddTaskDialog}
        onOpenChange={setShowAddTaskDialog}
        onTaskCreated={(newTask) => {
          onTaskCreated(newTask);
          onSelectTaskId(newTask.id);
        }}
      />
    </>
  );
}
