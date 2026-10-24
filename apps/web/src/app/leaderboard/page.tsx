"use client";

import React, { useEffect, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, RefreshCw, Trophy, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

export default function LeaderboardPage() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [selectedSlot, setSelectedSlot] = useState<LeaderboardSlot | undefined>(undefined);
  const [data, setData] = useState<LeaderboardApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePeriodChange = (newPeriod: LeaderboardPeriod) => {
    if (newPeriod !== period) {
      setLoading(true);
      setPeriod(newPeriod);
      // Reset selected slot when switching period
      setSelectedSlot(undefined);
    }
  };

  const handleSlotChange = (slot: LeaderboardSlot) => {
    if (slot !== selectedSlot) {
      setLoading(true);
      setSelectedSlot(slot);
    }
  };

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    let ignore = false;

    async function fetchLeaderboard() {
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
        if (json.success && !ignore) {
          setData(json.data);
          setError(null);
        } else if (!ignore) {
          throw new Error(json.error?.message || "Failed to load leaderboard");
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
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchLeaderboard();

    return () => {
      ignore = true;
    };
  }, [period, selectedSlot, refreshKey]);

  const checkpoints = [
    {
      slot: "10:00 AM",
      label: "Morning Standup Checkpoint",
      desc: "Captures early deep-work sessions before midday syncs",
    },
    {
      slot: "6:00 PM",
      label: "Evening Review Checkpoint",
      desc: "Captures main daytime core engineering and problem-solving",
    },
    {
      slot: "10:00 PM",
      label: "Night Final Checkpoint",
      desc: "Final day completion tally and daily streak confirmation",
    },
  ];

  return (
    <AppShell
      title="Team Leaderboard"
      subtitle="Scheduled focus checkpoints at 10:00, 18:00, and 22:00 IST"
    >
      <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
        {/* Navigation / Tabs */}
        <div className="bg-card/60 backdrop-blur-md rounded-3xl border border-border p-4 sm:p-5 shadow-xs">
          <LeaderboardTabs
            period={period}
            onPeriodChange={handlePeriodChange}
            availableSlots={data?.availableSlots || []}
            selectedSlot={selectedSlot || (data?.currentSlot !== "provisional" ? data?.currentSlot : undefined)}
            onSlotChange={handleSlotChange}
            isProvisional={data?.isProvisional ?? false}
            disabled={loading}
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

        {/* Loading Skeletons */}
        {loading && !data && (
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-3xl" />
            <Skeleton className="h-20 rounded-3xl" />
            <Skeleton className="h-20 rounded-3xl" />
            <Skeleton className="h-20 rounded-3xl" />
          </div>
        )}

        {/* Leaderboard Content */}
        {data && (
          <>
            {/* Status & Checkpoint Banner */}
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

            {/* Standings Section */}
            <section aria-labelledby="standings-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <h3
                  id="standings-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
                >
                  <Trophy className="size-3.5 text-amber-500" />
                  <span>
                    {data.period === "today" ? "Today's Standings" : "Last 7 Days Rolling Standings"}
                  </span>
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {data.entries.length} of {data.activeProfileCount} team members
                </span>
              </div>

              <StandingsList
                entries={data.entries}
                period={data.period}
                currentSlot={data.currentSlot}
                isProvisional={data.isProvisional}
              />
            </section>

            {/* Checkpoint Schedule Information */}
            <section aria-labelledby="schedule-info-heading" className="space-y-3 pt-4">
              <h3
                id="schedule-info-heading"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                <Info className="size-3.5 text-muted-foreground" />
                <span>Checkpoint Operational Architecture</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {checkpoints.map((cp) => (
                  <div
                    key={cp.slot}
                    className="p-4 rounded-3xl bg-card border border-border/70 shadow-xs flex flex-col justify-between space-y-2"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs font-semibold text-[#0071e3] bg-[#0071e3]/10"
                        >
                          {cp.slot} IST
                        </Badge>
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">
                          Slot
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-foreground mt-2">
                        {cp.label}
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                        {cp.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
