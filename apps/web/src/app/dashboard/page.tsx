"use client";

import React, { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { Flame, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TimerCard, type ActiveSession, type TaskItem } from "@/components/timer/timer-card";
import { RecentTasks } from "@/components/tasks/recent-tasks";
import { DailySummary, type StatsSummaryData } from "@/components/dashboard/daily-summary";
import { ContributionGraph, type ContributionData } from "@/components/dashboard/contribution-graph";
import { LeaderboardPreview } from "@/components/dashboard/leaderboard-preview";
import { formatIndiaDate } from "@/lib/date";

export default function DashboardPage() {
  const { user } = useAuth();

  const [currentSession, setCurrentSession] = useState<ActiveSession | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [statsSummary, setStatsSummary] = useState<StatsSummaryData | null>(null);
  const [contributionData, setContributionData] = useState<ContributionData | null>(null);

  const [loadingSession, setLoadingSession] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);

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

  // 1. Fetch current work session
  const fetchCurrentSession = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/work-sessions/current");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setCurrentSession(json.data.session);
          if (json.data.session?.taskId) {
            setSelectedTaskId(json.data.session.taskId);
          }
        }
      }
    } catch {
      // Ignore network errors quietly
    } finally {
      setLoadingSession(false);
    }
  }, []);

  // 2. Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/tasks?status=active");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setTasks(json.data.tasks || []);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  // 3. Fetch stats summary
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
      // Ignore
    }
  }, []);

  // 4. Fetch contribution graph data
  const fetchContributions = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/stats/contributions");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setContributionData(json.data);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Master refresh for stats and contributions
  const handleStatsRefresh = useCallback(() => {
    fetchStatsSummary();
    fetchContributions();
    fetchCurrentSession();
  }, [fetchStatsSummary, fetchContributions, fetchCurrentSession]);

  // Initial mount load
  useEffect(() => {
    let ignore = false;

    const loadInitialData = async () => {
      try {
        await Promise.all([
          fetchCurrentSession(),
          fetchTasks(),
          fetchStatsSummary(),
          fetchContributions(),
        ]);
      } catch {
        // Quiet
      }
    };

    loadInitialData();

    // Reconcile interval every 5 seconds
    const interval = setInterval(() => {
      if (!ignore) {
        fetchCurrentSession();
        fetchStatsSummary();
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
    <AppShell title="Dashboard" subtitle="Active focus sessions & daily tasks">
      <div className="flex flex-col gap-8 pb-12">
        {/* 1. Dashboard Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {user?.displayName || "Friend"}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="size-3.5 text-muted-foreground" />
                {todayFormatted} (IST)
              </span>
            </div>
          </div>

          {/* Small Streak Indicator Badge in Header */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className="bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 py-1.5 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold"
            >
              <Flame className="size-4 fill-amber-500 text-amber-500" />
              <span>{statsSummary?.currentStreak ?? 0} Day Streak</span>
            </Badge>
          </div>
        </header>

        {/* 2. Main Focus Area: Obvious Timer Surface */}
        <section aria-label="Main Focus Timer" className="w-full">
          <TimerCard
            currentSession={currentSession}
            tasks={tasks}
            loadingSession={loadingSession}
            onSessionUpdated={(session) => {
              setCurrentSession(session);
              if (session?.taskId) setSelectedTaskId(session.taskId);
            }}
            onStatsRefresh={handleStatsRefresh}
            onTaskCreated={handleTaskCreated}
            selectedTaskId={selectedTaskId}
            onSelectTaskId={setSelectedTaskId}
          />
        </section>

        {/* 3. Task List / Recent Tasks */}
        <section aria-label="Focus Tasks" className="w-full">
          <RecentTasks
            tasks={tasks}
            loading={loadingTasks}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onTaskCreated={handleTaskCreated}
            onTaskArchived={handleTaskArchived}
          />
        </section>

        {/* 4. Daily Summary & Streak Metrics */}
        <DailySummary
          stats={statsSummary}
          onGoalUpdated={(newGoal) => {
            setStatsSummary((prev) => (prev ? { ...prev, dailyGoalSeconds: newGoal } : null));
          }}
        />

        {/* 5. Contribution Graph (Last ~26 Weeks) */}
        <ContributionGraph
          data={contributionData}
        />

        {/* 6. Today's Leaderboard Preview */}
        <LeaderboardPreview />
      </div>
    </AppShell>
  );
}
