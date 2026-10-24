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
      // Ignore network error; fallback on next polling reconcile
    } finally {
      expiredCallInProgressRef.current = false;
    }
  }, [onSessionUpdated]);

  // Smooth live ticking timer
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

  // Progress ring math
  const radius = 100;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;

  let progress = 0;
  if (currentSession) {
    if (currentSession.mode === "countdown" && currentSession.targetDurationSeconds) {
      const totalElapsed = currentSession.targetDurationSeconds - displaySeconds;
      progress = Math.min(1, Math.max(0, totalElapsed / currentSession.targetDurationSeconds));
    } else if (currentSession.mode === "stopwatch") {
      // Stopwatch: cyclical 60-second sweep
      progress = (displaySeconds % 60) / 60;
    }
  } else if (activeTask?.plannedDurationSeconds) {
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
          "relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 md:p-10 shadow-sm transition-all",
          currentSession?.status === "running" && "ring-1 ring-[#0071e3]/30"
        )}
      >
        {/* Stale Running Recovery Warning Banner */}
        {currentSession?.staleRunningWarning && (
          <div className="mb-6 flex items-center gap-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <strong>Session Recovery Notice:</strong> This session has been running continuously for over 12 hours. You can safely complete or stop it without losing recorded focus time.
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center text-center">
          {/* Top Status & Mode Indicator */}
          <div className="flex items-center gap-2 mb-4">
            {currentSession ? (
              <>
                <Badge
                  variant={currentSession.status === "running" ? "default" : "secondary"}
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-wider px-2.5 py-0.5",
                    currentSession.status === "running" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 animate-pulse",
                    currentSession.status === "paused" && "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25",
                    currentSession.status === "awaiting_decision" && "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25"
                  )}
                >
                  {currentSession.status.replace("_", " ")}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">•</span>
                <span className="text-xs font-semibold text-muted-foreground capitalize">
                  {currentSession.mode}
                </span>
              </>
            ) : (
              <>
                <Badge variant="outline" className="text-[11px] font-normal px-2.5 py-0.5 text-muted-foreground">
                  Ready to Focus
                </Badge>
                {activeTask?.plannedDurationSeconds ? (
                  <span className="text-xs text-muted-foreground font-medium">
                    • {Math.round(activeTask.plannedDurationSeconds / 60)}m Countdown
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground font-medium">• Stopwatch</span>
                )}
              </>
            )}
          </div>

          {/* Task Selector or Active Task Title */}
          <div className="mb-6 max-w-md w-full">
            {currentSession ? (
              <div className="flex flex-col items-center gap-1.5">
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate max-w-xs sm:max-w-md">
                  {currentSession.taskTitleSnapshot}
                </h3>
                {currentSession.categorySnapshot && (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {currentSession.categorySnapshot}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                {tasks.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          className="rounded-2xl px-4 py-2 text-sm font-semibold border-border hover:bg-secondary/60 flex items-center gap-2 max-w-[280px] sm:max-w-[340px] truncate"
                        >
                          <span className="truncate">{activeTask?.title || "Select a task"}</span>
                          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent className="w-72 rounded-2xl p-1.5 shadow-lg border border-border">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Select Focus Task
                      </div>
                      {tasks.map((task) => (
                        <DropdownMenuItem
                          key={task.id}
                          onClick={() => onSelectTaskId(task.id)}
                          className={cn(
                            "rounded-xl px-2.5 py-2 text-xs flex items-center justify-between cursor-pointer",
                            selectedTaskId === task.id && "bg-secondary font-semibold"
                          )}
                        >
                          <span className="truncate">{task.title}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                            {task.plannedDurationSeconds ? `${Math.round(task.plannedDurationSeconds / 60)}m` : "Stopwatch"}
                          </span>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem
                        onClick={() => setShowAddTaskDialog(true)}
                        className="rounded-xl px-2.5 py-2 text-xs text-[#0071e3] font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                        <span>Create New Task</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowAddTaskDialog(true)}
                    className="rounded-2xl px-4 py-2 text-xs font-medium border-dashed border-border hover:border-[#0071e3] text-muted-foreground hover:text-[#0071e3] flex items-center gap-1.5"
                  >
                    <Plus className="size-3.5" />
                    <span>Create your first task</span>
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Central Timer Surface with Progress Ring */}
          <div className="relative size-64 sm:size-72 flex items-center justify-center mb-8">
            <svg
              className="size-full -rotate-90 transform"
              viewBox="0 0 220 220"
              aria-hidden="true"
            >
              {/* Background Track Circle */}
              <circle
                cx="110"
                cy="110"
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="transparent"
                className="text-border/40 dark:text-secondary"
              />
              {/* Active Progress Ring */}
              <circle
                cx="110"
                cy="110"
                r={radius}
                stroke={currentSession?.status === "paused" ? "#f59e0b" : "#0071e3"}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-500 ease-out"
              />
            </svg>

            {/* Digits Surface */}
            <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
              <span
                className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-foreground tabular-nums drop-shadow-xs"
                aria-live="polite"
              >
                {formatTime(displaySeconds)}
              </span>
              <span className="text-xs font-medium text-muted-foreground mt-1 tracking-wide uppercase">
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
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!currentSession ? (
              /* No active session: Start Focus Button */
              <Button
                type="button"
                size="lg"
                disabled={pendingAction !== null || loadingSession}
                onClick={handleStartSession}
                className="rounded-2xl px-8 py-6 text-base font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98] flex items-center gap-2.5"
              >
                <Play className="size-5 fill-white" />
                <span>Start Focus</span>
              </Button>
            ) : currentSession.status === "running" ? (
              /* Running Session: Pause, Complete, Stop */
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={pendingAction !== null}
                  onClick={handlePauseSession}
                  className="rounded-2xl px-6 py-5 text-sm font-semibold border-border hover:bg-secondary transition-all flex items-center gap-2"
                >
                  <Pause className="size-4" />
                  <span>Pause</span>
                </Button>
                <Button
                  type="button"
                  size="lg"
                  disabled={pendingAction !== null}
                  onClick={handleCompleteSession}
                  className="rounded-2xl px-7 py-5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="size-4.5" />
                  <span>Complete</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  disabled={pendingAction !== null}
                  onClick={handleStopSession}
                  className="rounded-2xl px-5 py-5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                >
                  <Square className="size-3.5" />
                  <span>Stop</span>
                </Button>
              </>
            ) : currentSession.status === "paused" ? (
              /* Paused Session: Resume, Complete, Stop */
              <>
                <Button
                  type="button"
                  size="lg"
                  disabled={pendingAction !== null}
                  onClick={handleResumeSession}
                  className="rounded-2xl px-8 py-5 text-sm font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-xs transition-all flex items-center gap-2"
                >
                  <Play className="size-4 fill-white" />
                  <span>Resume</span>
                </Button>
                <Button
                  type="button"
                  size="lg"
                  disabled={pendingAction !== null}
                  onClick={handleCompleteSession}
                  className="rounded-2xl px-6 py-5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="size-4.5" />
                  <span>Complete</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  disabled={pendingAction !== null}
                  onClick={handleStopSession}
                  className="rounded-2xl px-5 py-5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1.5"
                >
                  <Square className="size-3.5" />
                  <span>Stop</span>
                </Button>
              </>
            ) : currentSession.status === "awaiting_decision" ? (
              /* Awaiting Decision */
              <Button
                type="button"
                size="lg"
                onClick={() => setDecisionDismissed(false)}
                className="rounded-2xl px-8 py-5 text-sm font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white shadow-md transition-all flex items-center gap-2"
              >
                <Sparkles className="size-4" />
                <span>Review Decision</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Decision Dialog Modal */}
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

      {/* Add Task Modal */}
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
