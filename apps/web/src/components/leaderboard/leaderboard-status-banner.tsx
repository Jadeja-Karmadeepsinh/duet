"use client";

import React, { useSyncExternalStore } from "react";
import { Clock, AlertTriangle, CheckCircle2, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatIndiaTime } from "@/lib/date";

interface LeaderboardStatusBannerProps {
  isProvisional: boolean;
  currentSlot: string;
  scheduledFor: string | null;
  capturedAt: string | null;
  isDelayed: boolean;
  nextScheduledSlot: string | null;
  timezone: string;
  period: "today" | "7d";
}

// Subscribe to system clock updates every 10s for the live IST pill
function subscribeToTime(callback: () => void) {
  const interval = setInterval(callback, 10000);
  return () => clearInterval(interval);
}

function getTimeSnapshot() {
  return formatIndiaTime();
}

function getServerSnapshot() {
  return "--:--";
}

function formatSlotDisplay(slot: string | null) {
  if (!slot) return "10:00 AM tomorrow";
  if (slot === "10:00") return "10:00 AM IST";
  if (slot === "18:00") return "6:00 PM IST";
  if (slot === "22:00") return "10:00 PM IST";
  return `${slot} IST`;
}

function formatIsoTime(dateIso?: string | null) {
  if (!dateIso) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(dateIso));
  } catch {
    return null;
  }
}

export function LeaderboardStatusBanner({
  isProvisional,
  currentSlot,
  scheduledFor,
  capturedAt,
  isDelayed,
  nextScheduledSlot,
  timezone,
  period,
}: LeaderboardStatusBannerProps) {
  const liveIstTime = useSyncExternalStore(subscribeToTime, getTimeSnapshot, getServerSnapshot);

  const capturedTime = formatIsoTime(capturedAt);
  const scheduledTime = formatIsoTime(scheduledFor);
  const nextCheckpoint = formatSlotDisplay(nextScheduledSlot);

  return (
    <div className="bg-card/70 backdrop-blur-md rounded-2xl sm:rounded-3xl border border-border p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status indicator badge */}
        <div className="flex flex-wrap items-center gap-2">
          {isProvisional ? (
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 text-xs gap-1.5 py-1 px-3 font-medium"
            >
              <Radio className="size-3 animate-pulse text-amber-500" />
              <span>Awaiting First Checkpoint (Live Tally)</span>
            </Badge>
          ) : isDelayed ? (
            <Badge
              variant="outline"
              className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 text-xs gap-1.5 py-1 px-3 font-medium"
            >
              <AlertTriangle className="size-3 text-rose-500" />
              <span>Checkpoint Delayed ({capturedTime || currentSlot} IST)</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 text-xs gap-1.5 py-1 px-3 font-medium"
            >
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>Official Snapshot ({currentSlot} IST)</span>
            </Badge>
          )}

          {isDelayed && scheduledTime && capturedTime && (
            <span className="text-[11px] text-muted-foreground font-mono">
              Scheduled for {scheduledTime}, captured at {capturedTime}
            </span>
          )}
        </div>

        {/* Live IST clock */}
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-xl border border-border/40 self-start sm:self-auto shrink-0">
          <Clock className="size-3.5 text-primary" />
          <span>
            IST: <strong className="text-foreground">{liveIstTime}</strong>
          </span>
        </div>
      </div>

      {/* Single restrained status line */}
      <div className="text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/40">
        <p className="leading-relaxed">
          {isProvisional ? (
            <span>
              Live activity recorded before the morning checkpoint. Next official snapshot captures at{" "}
              <strong className="text-foreground font-mono">{nextCheckpoint}</strong>.
            </span>
          ) : isDelayed ? (
            <span>
              Snapshot experienced a delayed background capture. Next scheduled checkpoint at{" "}
              <strong className="text-foreground font-mono">{nextCheckpoint}</strong>.
            </span>
          ) : (
            <span>
              Data verified on schedule at{" "}
              <strong className="text-foreground font-mono">{capturedTime || currentSlot} IST</strong>.
              Next checkpoint at{" "}
              <strong className="text-foreground font-mono">{nextCheckpoint}</strong>.
            </span>
          )}
        </p>

        <span className="text-[11px] font-mono text-muted-foreground/80 shrink-0">
          Scope: {period === "today" ? "Today" : "Rolling 7-day"} • {timezone}
        </span>
      </div>
    </div>
  );
}
