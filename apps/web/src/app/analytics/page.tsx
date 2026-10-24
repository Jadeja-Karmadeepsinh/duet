"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface HistoricalSession {
  id: string;
  taskTitleSnapshot: string;
  categorySnapshot?: string | null;
  trackedSeconds: number;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
}

export default function AnalyticsPage() {
  const [sessions, setSessions] = useState<HistoricalSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const fetchAnalytics = async () => {
      try {
        const res = await fetch("/api/v1/work-sessions?status=completed&limit=50");
        if (res.ok) {
          const json = await res.json();
          if (!ignore && json.success) {
            setSessions(json.data.sessions || []);
          }
        }
      } catch {
        // Handle network error
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchAnalytics();
    return () => {
      ignore = true;
    };
  }, []);

  const totalTrackedSeconds = sessions.reduce((sum, s) => sum + (s.trackedSeconds || 0), 0);
  const totalHours = Math.floor(totalTrackedSeconds / 3600);
  const totalMinutes = Math.floor((totalTrackedSeconds % 3600) / 60);

  return (
    <AppShell title="Analytics" subtitle="Focus history & productivity metrics">
      <div className="flex flex-col gap-8">
        {/* Real Summary Metrics */}
        <section aria-labelledby="metrics-heading" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Focus Time</span>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                  {totalHours}h {totalMinutes}m
                </span>
                <span className="text-xs text-muted-foreground">recorded</span>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed Sessions</span>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                  {sessions.length}
                </span>
                <span className="text-xs text-muted-foreground">sessions</span>
              </div>
            )}
          </div>
        </section>

        {/* Completed Sessions Log */}
        <section aria-labelledby="history-heading" className="flex flex-col gap-3">
          <h3 id="history-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Completed Sessions Log ({sessions.length})
          </h3>

          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-xs divide-y divide-border">
            {loading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-4 w-full max-w-sm" />
                <Skeleton className="h-4 w-3/4 max-w-xs" />
              </div>
            ) : sessions.length > 0 ? (
              sessions.map((session) => (
                <div key={session.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate block">
                      {session.taskTitleSnapshot}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {session.categorySnapshot && <span>{session.categorySnapshot} •</span>}
                      <span>{new Date(session.startedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {Math.round(session.trackedSeconds / 60)} min
                  </Badge>
                </div>
              ))
            ) : (
              <div className="p-8 text-center flex flex-col items-center gap-2 text-muted-foreground">
                <Clock className="size-8 stroke-[1.5] text-muted-foreground/60" />
                <p className="text-sm font-medium text-foreground">No completed sessions yet</p>
                <p className="text-xs max-w-xs text-muted-foreground">
                  Complete your first focus session from the Dashboard to see your historical insights here.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
