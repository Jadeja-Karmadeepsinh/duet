"use client";

import React, { Suspense, useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { RangeSelector, type AnalyticsRange } from "@/components/analytics/range-selector";
import {
  AnalyticsSummaryCards,
  type AnalyticsSummary,
} from "@/components/analytics/analytics-summary-cards";
import {
  FocusTimeChart,
  type TimeSeriesPoint,
} from "@/components/analytics/focus-time-chart";
import { CompletionsChart } from "@/components/analytics/completions-chart";
import {
  CategoryDistributionChart,
  type CategoryStat,
} from "@/components/analytics/category-distribution-chart";
import { AnalyticsHighlights } from "@/components/analytics/analytics-highlights";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AnalyticsApiResponse {
  range: AnalyticsRange;
  rangeLabel: string;
  startDate: string;
  endDate: string;
  binning: "daily" | "weekly" | "monthly";
  summary: AnalyticsSummary;
  timeSeries: TimeSeriesPoint[];
  categories: CategoryStat[];
}

interface HistoricalSession {
  id: string;
  taskTitleSnapshot: string;
  categorySnapshot?: string | null;
  trackedSeconds: number;
  status: string;
  startedAt: string;
}

const VALID_RANGES: AnalyticsRange[] = ["7d", "30d", "90d", "1y", "lifetime"];

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const rawRange = searchParams.get("range") as AnalyticsRange;
  const currentRange: AnalyticsRange = VALID_RANGES.includes(rawRange) ? rawRange : "7d";

  const [refreshKey, setRefreshKey] = useState(0);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsApiResponse | null>(null);
  const [recentSessions, setRecentSessions] = useState<HistoricalSession[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRangeChange = (newRange: AnalyticsRange) => {
    if (newRange !== currentRange) {
      setIsFetching(true);
      startTransition(() => {
        router.replace(`/analytics?range=${newRange}`, { scroll: false });
      });
    }
  };

  const handleRetry = () => {
    setIsFetching(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    let ignore = false;

    async function loadData() {
      try {
        const [analyticsRes, sessionsRes] = await Promise.all([
          fetch(`/api/v1/analytics?range=${currentRange}`),
          fetch("/api/v1/work-sessions?status=completed&limit=15"),
        ]);

        if (!analyticsRes.ok) {
          throw new Error(`Failed to load analytics: HTTP ${analyticsRes.status}`);
        }

        const analyticsJson = await analyticsRes.json();
        if (analyticsJson.success) {
          if (!ignore) {
            setAnalyticsData(analyticsJson.data);
            setError(null);
          }
        } else {
          throw new Error(analyticsJson.error?.message || "Failed to load analytics");
        }

        if (sessionsRes.ok) {
          const sessionsJson = await sessionsRes.json();
          if (sessionsJson.success && !ignore) {
            setRecentSessions(sessionsJson.data.sessions || []);
          }
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while fetching analytics."
          );
        }
      } finally {
        if (!ignore) {
          setInitialLoading(false);
          setIsFetching(false);
        }
      }
    }

    void loadData();

    return () => {
      ignore = true;
    };
  }, [currentRange, refreshKey]);

  const subtitle = analyticsData
    ? `${analyticsData.rangeLabel} (${analyticsData.startDate} → ${analyticsData.endDate} IST)`
    : "Focus trends, output & productivity velocity";

  return (
    <AppShell title="Analytics" subtitle={subtitle}>
      <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-12">
        {/* Top Header / Range Selector */}
        <div className="bg-card/70 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-border p-3.5 sm:p-5 shadow-xs">
          <RangeSelector
            range={currentRange}
            onRangeChange={handleRangeChange}
            startDate={analyticsData?.startDate}
            endDate={analyticsData?.endDate}
            rangeLabel={analyticsData?.rangeLabel}
            disabled={isFetching && !analyticsData}
          />
        </div>

        {/* Error Notification */}
        {error && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="gap-1.5 text-xs h-8 border-destructive/30 hover:bg-destructive/10"
            >
              <RefreshCw className="size-3.5" />
              <span>Retry</span>
            </Button>
          </div>
        )}

        {/* Initial Loading Skeletons */}
        {initialLoading && !analyticsData && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-28 rounded-2xl" />
            </div>
            <Skeleton className="h-80 rounded-3xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Skeleton className="h-72 rounded-3xl" />
              <Skeleton className="h-72 rounded-3xl" />
            </div>
            <Skeleton className="h-56 rounded-3xl" />
          </div>
        )}

        {/* Analytics Content Area */}
        {analyticsData && (
          <div
            className={`space-y-6 transition-opacity duration-200 ${
              isFetching ? "opacity-75 pointer-events-none" : "opacity-100"
            }`}
          >
            {/* Subtle reload indicator line */}
            {isFetching && (
              <div className="h-1 w-full bg-primary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-full" />
              </div>
            )}

            {/* 1. Summary Metrics Cards (Balanced 4-col row, 2x2 mobile) */}
            <section aria-label="Summary productivity metrics">
              <AnalyticsSummaryCards
                summary={analyticsData.summary}
                rangeLabel={analyticsData.rangeLabel}
              />
            </section>

            {/* 2. Dominant Focus Time Chart (Full-width) */}
            <section aria-label="Focus time duration">
              <FocusTimeChart
                data={analyticsData.timeSeries}
                binning={analyticsData.binning}
                totalFocusSeconds={analyticsData.summary.totalFocusSeconds}
              />
            </section>

            {/* 3. Side-by-side: Tasks Completed & Where Your Time Goes */}
            <section
              aria-label="Completions and category distribution"
              className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 min-w-0"
            >
              <CompletionsChart
                data={analyticsData.timeSeries}
                binning={analyticsData.binning}
                totalCompletions={analyticsData.summary.totalCompletions}
              />
              <CategoryDistributionChart
                categories={analyticsData.categories}
                totalFocusSeconds={analyticsData.summary.totalFocusSeconds}
              />
            </section>

            {/* 4. Highlights & Records */}
            <section aria-label="Personal records and highlights">
              <AnalyticsHighlights
                summary={analyticsData.summary}
                recentSessions={recentSessions}
              />
            </section>

            {/* 5. Recent Completed Sessions Log */}
            <section aria-labelledby="recent-sessions-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3
                  id="recent-sessions-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Recent Completed Sessions Log
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {recentSessions.length} recorded
                </span>
              </div>

              <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-xs divide-y divide-border/60">
                {recentSessions.length > 0 ? (
                  recentSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-4 flex items-center justify-between gap-4 hover:bg-secondary/20 transition-colors text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <span className="text-sm font-medium text-foreground truncate block" title={session.taskTitleSnapshot}>
                          {session.taskTitleSnapshot}
                        </span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {session.categorySnapshot && (
                            <span className="font-medium text-foreground/80">
                              {session.categorySnapshot} •
                            </span>
                          )}
                          <span>
                            {new Date(session.startedAt).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              timeZone: "Asia/Kolkata",
                            })}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="font-mono text-xs shrink-0">
                        {Math.round(session.trackedSeconds / 60)} min
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center flex flex-col items-center gap-2 text-muted-foreground">
                    <Clock className="size-8 stroke-[1.5] text-muted-foreground/40 mb-1" />
                    <p className="text-sm font-medium text-foreground">
                      No completed sessions recorded yet
                    </p>
                    <p className="text-xs max-w-xs text-muted-foreground">
                      Start and finish focus sessions from the Dashboard to see your historical log here.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function AnalyticsSkeleton() {
  return (
    <AppShell title="Analytics" subtitle="Focus velocity, trends & productivity metrics">
      <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-12">
        <Skeleton className="h-14 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-80 rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      </div>
    </AppShell>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsContent />
    </Suspense>
  );
}
