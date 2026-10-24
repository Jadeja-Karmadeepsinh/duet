"use client";

import React, { useEffect, useState } from "react";
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
  const [liveIstTime, setLiveIstTime] = useState(() => formatIndiaTime());

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveIstTime(formatIndiaTime());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const formatTimeOnly = (dateIso?: string | null) => {
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
  };

  return (
    <div className="bg-card/70 backdrop-blur-md rounded-3xl border border-border p-5 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2.5">
          {isProvisional ? (
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-xs gap-1.5 py-1 px-3"
            >
              <Radio className="size-3 animate-pulse text-amber-500" />
              <span>Provisional Live Board</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs gap-1.5 py-1 px-3"
            >
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>Official Snapshot ({currentSlot} IST)</span>
            </Badge>
          )}

          {isDelayed && (
            <Badge
              variant="secondary"
              className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[11px] gap-1 py-0.5"
            >
              <AlertTriangle className="size-3 text-rose-500" />
              <span>Captured late at {formatTimeOnly(capturedAt)}</span>
            </Badge>
          )}
        </div>

        {/* Live IST clock */}
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-secondary/50 px-3 py-1.5 rounded-2xl border border-border/40 self-start sm:self-auto">
          <Clock className="size-3.5 text-[#0071e3]" />
          <span>Current IST: <strong className="text-foreground">{liveIstTime}</strong></span>
        </div>
      </div>

      {/* Explanatory subtitle & next checkpoint note */}
      <div className="text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-border/40">
        <p>
          {isProvisional ? (
            <span>
              Pre-checkpoint live tally. Next official snapshot captures at{" "}
              <strong className="text-foreground font-mono">{nextScheduledSlot || "10:00"} IST</strong>.
            </span>
          ) : (
            <span>
              Snapshot frozen at <strong className="text-foreground font-mono">{formatTimeOnly(capturedAt)} IST</strong>
              {scheduledFor && ` (scheduled for ${formatTimeOnly(scheduledFor)} IST)`}.
            </span>
          )}
        </p>

        <span className="text-[11px] font-mono text-muted-foreground/80">
          Scope: {period === "today" ? "Today" : "Rolling 7-day"} • Timezone: {timezone}
        </span>
      </div>
    </div>
  );
}
