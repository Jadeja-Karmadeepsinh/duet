"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { Timer, CheckCircle2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ActiveSession {
  id: string;
  mode: "countdown" | "stopwatch";
  status: "running" | "paused" | "awaiting_decision" | "completed" | "stopped";
  targetDurationSeconds: number | null;
  trackedSeconds: number;
  taskTitleSnapshot: string;
  categorySnapshot?: string | null;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  isExpired: boolean;
  staleRunningWarning: boolean;
  activeSegmentStartedAt?: string | null;
}

interface TaskItem {
  id: string;
  title: string;
  category: string | null;
  plannedDurationSeconds: number | null;
  status: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Fetch current session from real API
  useEffect(() => {
    let ignore = false;
    const fetchCurrent = async () => {
      try {
        const res = await fetch("/api/v1/work-sessions/current");
        if (res.ok) {
          const json = await res.json();
          if (!ignore && json.success) {
            setCurrentSession(json.data.session);
          }
        }
      } catch {
        // Handle network error quietly
      } finally {
        if (!ignore) setLoadingSession(false);
      }
    };

    fetchCurrent();
    const interval = setInterval(fetchCurrent, 5000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  // Fetch tasks from real API
  useEffect(() => {
    let ignore = false;
    const fetchTasks = async () => {
      try {
        const res = await fetch("/api/v1/tasks?status=active");
        if (res.ok) {
          const json = await res.json();
          if (!ignore && json.success) {
            setTasks(json.data.tasks || []);
          }
        }
      } catch {
        // Handle quietly
      } finally {
        if (!ignore) setLoadingTasks(false);
      }
    };

    fetchTasks();
    return () => {
      ignore = true;
    };
  }, []);

  const formatSeconds = (sec: number | null | undefined) => {
    if (sec === null || sec === undefined) return "--:--";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <AppShell title="Dashboard" subtitle="Active focus sessions & daily tasks">
      <div className="flex flex-col gap-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Hello, {user?.displayName}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ready for focused work today.
            </p>
          </div>
        </div>

        {/* Current Timer Status Card */}
        <section aria-labelledby="active-timer-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 id="active-timer-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current Session
            </h3>
            {currentSession && (
              <Badge
                variant={currentSession.status === "running" ? "default" : "secondary"}
                className={cn(
                  "capitalize text-[11px] font-medium",
                  currentSession.status === "running" && "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-600/20"
                )}
              >
                {currentSession.status.replace("_", " ")}
              </Badge>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            {loadingSession ? (
              <div className="space-y-3 w-full">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-10 w-32" />
              </div>
            ) : currentSession ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-foreground tracking-tight">
                      {currentSession.taskTitleSnapshot}
                    </span>
                    {currentSession.categorySnapshot && (
                      <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                        {currentSession.categorySnapshot}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-4xl font-bold tracking-tight text-foreground tabular-nums">
                      {currentSession.mode === "countdown"
                        ? formatSeconds(currentSession.remainingSeconds)
                        : formatSeconds(currentSession.elapsedSeconds)}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {currentSession.mode === "countdown" ? "remaining" : "elapsed"}
                    </span>
                  </div>
                  {currentSession.staleRunningWarning && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-900/50">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>This session has been active for over 12 hours.</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Mode: <strong className="font-semibold text-foreground capitalize">{currentSession.mode}</strong>
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4 py-2">
                <div className="flex items-center gap-4">
                  <div className="size-11 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                    <Timer className="size-5.5 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">No timer currently running</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select or create a task below to start your focus session.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Task Queue Section */}
        <section aria-labelledby="tasks-heading" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 id="tasks-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active Tasks ({tasks.length})
            </h3>
          </div>

          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xs divide-y divide-border">
            {loadingTasks ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-4 w-full max-w-md" />
                <Skeleton className="h-4 w-3/4 max-w-sm" />
              </div>
            ) : tasks.length > 0 ? (
              tasks.map((task) => (
                <div key={task.id} className="p-4 flex items-center justify-between gap-4 hover:bg-secondary/30 transition-colors">
                  <div className="space-y-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">{task.title}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {task.category && <span>{task.category}</span>}
                      {task.plannedDurationSeconds && (
                        <span>• {Math.round(task.plannedDurationSeconds / 60)}m planned</span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] shrink-0 font-normal">
                    {task.plannedDurationSeconds ? "Countdown" : "Stopwatch"}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="p-8 text-center flex flex-col items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="size-8 stroke-[1.5] text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">No active tasks</p>
                <p className="text-xs max-w-xs text-muted-foreground">
                  Create your first focus task to start tracking work sessions.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
