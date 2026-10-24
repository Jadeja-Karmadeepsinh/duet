"use client";

import React, { Suspense, useEffect, useState, useRef, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import {
  LeaderboardTabs,
  type LeaderboardPeriod,
  type LeaderboardSlot,
} from "@/components/leaderboard/leaderboard-tabs";
import { LeaderboardStatusBanner } from "@/components/leaderboard/leaderboard-status-banner";
import {
  StandingsList,
  type LeaderboardEntry,
} from "@/components/leaderboard/standings-list";
import {
  ThroughTheDayTable,
  type SlotSnapshotData,
} from "@/components/leaderboard/through-the-day-table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, Users, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatIndiaDate } from "@/lib/date";

interface LeaderboardApiResponse {
  period: LeaderboardPeriod;
  date: string;
  currentSlot: LeaderboardSlot | "provisional";
  availableSlots: LeaderboardSlot[];
  isProvisional: boolean;
  scheduledFor: string | null;
  capturedAt: string | null;
  isDelayed: boolean;
  nextScheduledSlot: LeaderboardSlot | null;
  activeProfileCount: number;
  entries: LeaderboardEntry[];
  timezone: string;
}

const ALL_SLOTS: Array<{ slot: LeaderboardSlot; label: string }> = [
  { slot: "10:00", label: "10:00 AM" },
  { slot: "18:00", label: "6:00 PM" },
  { slot: "22:00", label: "10:00 PM" },
];

function LeaderboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Parse URL parameters: support period=today|7d and scope=today|week
  const rawPeriod = searchParams.get("period") || searchParams.get("scope");
  const period: LeaderboardPeriod = rawPeriod === "7d" || rawPeriod === "week" ? "7d" : "today";

  const rawSlot = searchParams.get("slot") as LeaderboardSlot | null;
  const selectedSlot = rawSlot && ["10:00", "18:00", "22:00"].includes(rawSlot) ? rawSlot : undefined;

  const [data, setData] = useState<LeaderboardApiResponse | null>(null);
  const [throughTheDayData, setThroughTheDayData] = useState<SlotSnapshotData[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const inFlightRef = useRef(false);

  const handlePeriodChange = (newPeriod: LeaderboardPeriod) => {
    if (newPeriod !== period) {
      setIsFetching(true);
      startTransition(() => {
        router.replace(`/leaderboard?period=${newPeriod}`, { scroll: false });
      });
    }
  };

  const handleSlotChange = (slot: LeaderboardSlot) => {
    if (slot !== selectedSlot) {
      setIsFetching(true);
      startTransition(() => {
        router.replace(`/leaderboard?period=${period}&slot=${slot}`, { scroll: false });
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
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const queryParams = new URLSearchParams({ period });
        if (selectedSlot) {
          queryParams.set("slot", selectedSlot);
        }

        const res = await fetch(`/api/v1/leaderboard?${queryParams.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load leaderboard: HTTP ${res.status}`);
        }

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error?.message || "Failed to load leaderboard");
        }

        const boardData: LeaderboardApiResponse = json.data;
        if (!ignore) {
          setData(boardData);
          setError(null);
        }

        // If viewing today's leaderboard, fetch all captured slots for through-the-day progress
        if (period === "today") {
          const available = boardData.availableSlots || [];
          const slotsPromises = ALL_SLOTS.map(async ({ slot, label }) => {
            if (!available.includes(slot)) {
              return {
                slot,
                label,
                isCaptured: false,
                entries: [],
              };
            }

            // If current query was already for this slot, reuse the response
            if (boardData.currentSlot === slot) {
              return {
                slot,
                label,
                isCaptured: true,
                entries: boardData.entries,
              };
            }

            try {
              const slotRes = await fetch(`/api/v1/leaderboard?period=today&slot=${slot}`);
              if (slotRes.ok) {
                const slotJson = await slotRes.json();
                if (slotJson.success) {
                  return {
                    slot,
                    label,
                    isCaptured: true,
                    entries: slotJson.data.entries as LeaderboardEntry[],
                  };
                }
              }
            } catch {
              // Ignore individual slot failures gracefully
            }

            return {
              slot,
              label,
              isCaptured: false,
              entries: [],
            };
          });

          const resolvedSlots = await Promise.all(slotsPromises);
          if (!ignore) {
            setThroughTheDayData(resolvedSlots);
          }
        } else if (!ignore) {
          setThroughTheDayData([]);
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while loading leaderboard standings."
          );
        }
      } finally {
        inFlightRef.current = false;
        if (!ignore) {
          setInitialLoading(false);
          setIsFetching(false);
        }
      }
    }

    void loadData();

    // 15-second polling interval for real-time synchronization
    const interval = setInterval(() => {
      void loadData();
    }, 15000);

    // Refresh on window focus
    const onFocus = () => {
      void loadData();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      ignore = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [period, selectedSlot, refreshKey]);

  // Format full date in Asia/Kolkata for the header subtitle
  const fullIndiaDate = formatIndiaDate(new Date(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const profiles = data?.entries.map((e) => ({
    userId: e.userId,
    displayName: e.displayName,
    isCurrentUser: e.isCurrentUser,
  })) || [];

  return (
    <AppShell title="Leaderboard" subtitle={fullIndiaDate}>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
        {/* Navigation / Timeframe Tabs */}
        <div className="bg-card/70 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-border p-3.5 sm:p-5 shadow-xs">
          <LeaderboardTabs
            period={period}
            onPeriodChange={handlePeriodChange}
            availableSlots={data?.availableSlots || []}
            selectedSlot={selectedSlot || (data?.currentSlot !== "provisional" ? data?.currentSlot : undefined)}
            onSlotChange={handleSlotChange}
            isProvisional={data?.isProvisional ?? false}
            disabled={isFetching && !data}
          />
        </div>

        {/* Error notification */}
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
        {initialLoading && !data && (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl sm:rounded-3xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
        )}

        {/* Leaderboard Content */}
        {data && (
          <div
            className={`space-y-6 transition-opacity duration-200 ${
              isFetching ? "opacity-75" : "opacity-100"
            }`}
          >
            {/* 1. Status & Checkpoint Banner */}
            <LeaderboardStatusBanner
              isProvisional={data.isProvisional}
              currentSlot={data.currentSlot}
              scheduledFor={data.scheduledFor}
              capturedAt={data.capturedAt}
              isDelayed={data.isDelayed}
              nextScheduledSlot={data.nextScheduledSlot}
              timezone={data.timezone}
              period={data.period}
            />

            {/* 2. Standings Section */}
            <section aria-labelledby="standings-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3
                  id="standings-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                >
                  <Users className="size-3.5 text-primary" />
                  <span>
                    {data.period === "today" ? "Today's Standings" : "Last 7 Days Rolling Standings"}
                  </span>
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {data.entries.length} of {data.activeProfileCount} members
                </span>
              </div>

              <StandingsList
                entries={data.entries}
                period={data.period}
                currentSlot={data.currentSlot}
                isProvisional={data.isProvisional}
              />
            </section>

            {/* 3. Through-the-Day Checkpoint Progression (Today only) */}
            {data.period === "today" && throughTheDayData.length > 0 && (
              <section aria-label="Through the day progress">
                <ThroughTheDayTable
                  slotsData={throughTheDayData}
                  profiles={profiles}
                />
              </section>
            )}

            {/* 4. Checkpoint Schedule Architecture */}
            <section aria-labelledby="schedule-info-heading" className="pt-2">
              <div className="rounded-2xl border border-border/70 bg-card/60 p-4 shadow-xs space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Info className="size-3.5 text-primary" />
                  <span>Snapshot Checkpoint Schedule</span>
                </div>
                <p className="leading-relaxed">
                  Focus Duo captures official immutable snapshots three times daily at{" "}
                  <strong className="text-foreground font-mono">10:00 AM</strong>,{" "}
                  <strong className="text-foreground font-mono">6:00 PM</strong>, and{" "}
                  <strong className="text-foreground font-mono">10:00 PM IST</strong>.
                  Daily standings calculate focus duration and completed tasks recorded up to each checkpoint.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px]">
                  <Badge variant="outline" className="font-mono">10:00 AM (Morning Standup)</Badge>
                  <Badge variant="outline" className="font-mono">6:00 PM (Evening Review)</Badge>
                  <Badge variant="outline" className="font-mono">10:00 PM (Night Final)</Badge>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function LeaderboardSkeleton() {
  return (
    <AppShell title="Leaderboard" subtitle="Team focus standings">
      <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl sm:rounded-3xl" />
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    </AppShell>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <LeaderboardContent />
    </Suspense>
  );
}
