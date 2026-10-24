"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy, ArrowRight, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface LeaderboardPreviewData {
  hasSnapshot: boolean;
  status?: string;
  slot?: string;
  capturedAt?: string;
  localDate: string;
  activeProfileCount?: number;
  nextScheduledSlot?: string;
  entries?: Array<{
    userId: string;
    displayName: string;
    focusSecondsToday: number;
    completedTasksToday: number;
  }>;
}

export function LeaderboardPreview() {
  const [data, setData] = useState<LeaderboardPreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const fetchPreview = async () => {
      try {
        const res = await fetch("/api/v1/stats/leaderboard-preview");
        if (res.ok) {
          const json = await res.json();
          if (!ignore && json.success) {
            setData(json.data);
          }
        }
      } catch {
        // Ignore network errors quietly
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchPreview();
    return () => {
      ignore = true;
    };
  }, []);

  const formatHoursMinutes = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs === 0) return `${mins}m`;
    return `${hrs}h ${mins}m`;
  };

  return (
    <section aria-labelledby="leaderboard-preview-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 id="leaderboard-preview-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Trophy className="size-3.5 text-purple-600 dark:text-purple-400" />
          <span>Team Leaderboard Preview</span>
        </h3>
        <Link
          href="/leaderboard"
          className="text-xs text-primary hover:text-primary/90 font-medium flex items-center gap-1 group"
        >
          <span>Full Standings</span>
          <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-xs">
        {loading ? (
          <div className="py-2 text-xs text-muted-foreground">Loading standings...</div>
        ) : data?.hasSnapshot && data.entries && data.entries.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/50">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3" />
                Snapshot checkpoint at <strong>{data.slot} IST</strong>
              </span>
              <Badge variant="secondary" className="text-[10px] px-2 py-0">
                Official
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
              {data.entries.map((entry, idx) => (
                <div
                  key={entry.userId}
                  className="p-3 rounded-xl bg-secondary/30 border border-border/40 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-mono font-bold text-muted-foreground w-4">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-foreground truncate">
                      {entry.displayName}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground shrink-0 font-medium">
                    {formatHoursMinutes(entry.focusSecondsToday)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center shrink-0">
                <Users className="size-4" />
              </div>
              <div>
                <span className="font-semibold text-foreground block">
                  Provisional Status for Today
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Official checkpoints capture at 10:00, 18:00, and 22:00 IST.
                </span>
              </div>
            </div>
            <Link href="/leaderboard">
              <Button variant="outline" size="sm" className="rounded-xl text-xs h-8">
                <span>View Today&apos;s Board</span>
                <ArrowRight className="size-3 ml-1" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
