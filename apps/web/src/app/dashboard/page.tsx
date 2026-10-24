"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { Calendar } from "lucide-react";
import { TimerCard, type ActiveSession, type TaskItem } from "@/components/timer/timer-card";
import { RecentTasks } from "@/components/tasks/recent-tasks";
import { StreakCard } from "@/components/dashboard/streak-card";
import { ContributionGraph, type ContributionData } from "@/components/dashboard/contribution-graph";
import { formatIndiaDate } from "@/lib/date";

export interface StatsSummaryData {
  todayDate: string;
  focusSecondsToday: number;
  completedTasksToday: number;
  dailyGoalSeconds: number;
  currentStreak: number;
  bestStreak: number;
}

export default function DashboardPage() {
  const { user } = useAuth();

  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [statsSummary, setStatsSummary] = useState<StatsSummaryData | null>(null);
  const [contributionData, setContributionData] = useState<ContributionData | null>(null);

  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Race-condition protection refs
  const sessionFetchSeqRef = useRef(0);
  const latestUpdatedAtRef = useRef<number>(0);
  const inFlightFetchRef = useRef<AbortController | null>(null);

  // Time-aware greeting in Asia/Kolkata
  const getGreeting = () => {
    try {
      const kolkataHour = parseInt(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          hour12: false,
        }).format(new Date()),
        10
      );
      if (kolkataHour < 12) return "Good morning";
      if (kolkataHour < 18) return "Good afternoon";
      return "Good evening";
    } catch {
      return "Welcome back";
    }
  };

  // 1. Fetch current work session with race condition guards
  const fetchCurrentSession = useCallback(async () => {
    // Abort any prior in-flight GET request
    if (inFlightFetchRef.current) {
      inFlightFetchRef.current.abort();
    }
    const controller = new AbortController();
    inFlightFetchRef.current = controller;
    const reqSeq = ++sessionFetchSeqRef.current;

    try {
      const res = await fetch("/api/v1/work-sessions/current", {
        signal: controller.signal,
      });
      if (res.ok) {
        const json = await res.json();
        // Guard against stale response if a newer fetch or mutation ran
        if (reqSeq < sessionFetchSeqRef.current) return;

        if (json.success) {
          const incomingSession: ActiveSession | null = json.data.session;
          if (incomingSession?.updatedAt) {
            const incomingTime = new Date(incomingSession.updatedAt).getTime();
            if (incomingTime < latestUpdatedAtRef.current) {
              // Stale response from before a newer mutation; discard
              return;
            }
            latestUpdatedAtRef.current = incomingTime;
          }

          setCurrentSession(incomingSession);
          if (incomingSession?.taskId) {
            setSelectedTaskId(incomingSession.taskId);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Expected cancellation on superseding request
      }
      // Ignore network errors quietly
    } finally {
      if (reqSeq === sessionFetchSeqRef.current) {
        setLoadingSession(false);
      }
    }
  }, []);

  const handleSessionUpdated = useCallback((session: ActiveSession | null) => {
    // Invalidate in-flight GET requests and advance sequence
    if (inFlightFetchRef.current) {
      inFlightFetchRef.current.abort();
    }
    sessionFetchSeqRef.current++;
    if (session?.updatedAt) {
      latestUpdatedAtRef.current = new Date(session.updatedAt).getTime();
    } else {
      latestUpdatedAtRef.current = Date.now();
    }
    setCurrentSession(session);
    if (session?.taskId) {
      setSelectedTaskId(session.taskId);
    }
  }, []);

  // 2. Fetch active tasks list
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/tasks?status=active");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setTasks(json.data.tasks);
          if (json.data.tasks.length > 0 && !selectedTaskId) {
            setSelectedTaskId(json.data.tasks[0].id);
          }
        }
      }
    } catch {
      // Ignore network errors quietly
    } finally {
      setLoadingTasks(false);
    }
  }, [selectedTaskId]);

  // 3. Fetch summary metrics & streak
  const fetchStatsSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/stats/summary");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setStatsSummary(json.data);
        }
      }
    } catch {
      // Ignore network errors quietly
    }
  }, []);

  // 4. Fetch contribution history (52 weeks for full-year span)
  const fetchContributions = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/stats/contributions?weeks=52");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setContributionData(json.data);
        }
      }
    } catch {
      // Ignore network errors quietly
    }
  }, []);

  const handleStatsRefresh = useCallback(() => {
    fetchStatsSummary();
    fetchContributions();
    fetchTasks();
  }, [fetchStatsSummary, fetchContributions, fetchTasks]);

  useEffect(() => {
    let ignore = false;

    async function loadInitialData() {
      if (ignore) return;
      await Promise.allSettled([
        fetchCurrentSession(),
        fetchTasks(),
        fetchStatsSummary(),
        fetchContributions(),
      ]);
    }

    void loadInitialData();

    // 5-second polling interval for real-time timer & streak state sync
    const interval = setInterval(() => {
      if (!ignore) {
        void fetchCurrentSession();
        void fetchStatsSummary();
      }
    }, 5000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [fetchCurrentSession, fetchTasks, fetchStatsSummary, fetchContributions]);

  const handleTaskCreated = (newTask: TaskItem) => {
    setTasks((prev) => [newTask, ...prev]);
    setSelectedTaskId(newTask.id);
  };

  const handleTaskUpdated = (updatedTask: TaskItem) => {
    setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
  };

  const handleTaskArchived = (archivedId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== archivedId));
    if (selectedTaskId === archivedId) {
      setSelectedTaskId(null);
    }
  };

  const todayFormatted = formatIndiaDate(new Date(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell title="Dashboard" subtitle="Active focus workspace & daily flow">
      <div className="flex flex-col gap-6 sm:gap-7 pb-8">
        {/* Compact Date-Aware Greeting Header */}
        <header className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1.5 pb-2 border-b border-border/40">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {user?.displayName || "Friend"}
            </h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 tabular-nums">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span>{todayFormatted} (IST)</span>
            </p>
          </div>
        </header>

        {/* 12-Column Responsive Workspace Grid
            Desktop: Col 1-7 (Timer), Col 8-12 (Streak + Tasks stacked column), Full-width (Activity)
            Mobile Order: Timer (1) → Streak (2) → Tasks (3) → Activity (4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-stretch">
          {/* Module 1: Primary Focus Timer */}
          <section
            aria-label="Focus Timer"
            className="order-1 lg:col-span-7 flex flex-col w-full"
          >
            <TimerCard
              currentSession={currentSession}
              tasks={tasks}
              loadingSession={loadingSession}
              onSessionUpdated={handleSessionUpdated}
              onStatsRefresh={handleStatsRefresh}
              onTaskCreated={handleTaskCreated}
              selectedTaskId={selectedTaskId}
              onSelectTaskId={setSelectedTaskId}
              className="h-full flex-1"
            />
          </section>

          {/* Right Column: Supporting Streak Card & Focus Tasks List */}
          <div className="order-2 lg:col-span-5 flex flex-col gap-5 lg:gap-6 w-full">
            {/* Module 2: Supporting Streak Card */}
            <section aria-label="Focus Streak" className="w-full">
              <StreakCard
                currentStreak={statsSummary?.currentStreak ?? 0}
                bestStreak={statsSummary?.bestStreak ?? 0}
                completedTasksToday={statsSummary?.completedTasksToday ?? 0}
              />
            </section>

            {/* Module 3: Focus Tasks List & Add/Edit Flow */}
            <section aria-label="Focus Tasks" className="flex-1 flex flex-col w-full">
              <RecentTasks
                tasks={tasks}
                loading={loadingTasks}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
                onTaskCreated={handleTaskCreated}
                onTaskUpdated={handleTaskUpdated}
                onTaskArchived={handleTaskArchived}
                className="h-full flex-1"
              />
            </section>
          </div>

          {/* Module 4: Activity / Contribution Graph with Today's Total in Header */}
          <section
            aria-label="Activity & Focus History"
            className="order-3 col-span-1 lg:col-span-12 w-full"
          >
            <ContributionGraph
              data={contributionData}
              todayFocusSeconds={statsSummary?.focusSecondsToday ?? 0}
              todayCompletions={statsSummary?.completedTasksToday ?? 0}
            />
          </section>
        </div>
      </div>
    </AppShell>
  );
}
