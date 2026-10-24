"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { formatIndiaTime } from "@/lib/date";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [indiaTime, setIndiaTime] = useState(() => formatIndiaTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setIndiaTime(formatIndiaTime());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const checkpoints = [
    { slot: "10:00 AM", label: "Morning Standup Checkpoint", desc: "First pulse of early focus hours" },
    { slot: "6:00 PM", label: "Evening Review Checkpoint", desc: "Main daytime deep-work tally" },
    { slot: "10:00 PM", label: "Night Final Checkpoint", desc: "Day completion and daily streak update" },
  ];

  return (
    <AppShell title="Leaderboard" subtitle="Team focus checkpoints (10:00, 18:00, 22:00 IST)">
      <div className="flex flex-col gap-8">
        {/* Checkpoint Schedule Card */}
        <section aria-labelledby="schedule-heading" className="bg-card rounded-2xl border border-border p-6 shadow-xs flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-4">
            <div>
              <h3 id="schedule-heading" className="text-base font-semibold text-foreground tracking-tight">
                Scheduled Snapshot Checkpoints
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Focus time is captured at three exact checkpoint slots in Asia/Kolkata time.
              </p>
            </div>
            {indiaTime && (
              <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-muted-foreground bg-secondary px-3 py-1 rounded-full self-start sm:self-auto">
                <Clock className="size-3.5 text-primary" />
                <span>Current IST: {indiaTime}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {checkpoints.map((cp) => (
              <div key={cp.slot} className="p-3.5 rounded-xl bg-secondary/40 border border-border/50 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[11px] font-semibold text-primary border-primary/20 bg-primary/5">
                    {cp.slot}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase">Slot</span>
                </div>
                <h4 className="text-xs font-semibold text-foreground mt-1">{cp.label}</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{cp.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Current Active Team Profile */}
        <section aria-labelledby="team-heading" className="flex flex-col gap-3">
          <h3 id="team-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active Team Profile
          </h3>

          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Avatar className="size-10">
                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                  {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : "ME"}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-0.5">
                <span className="text-sm font-semibold text-foreground block">{user?.displayName}</span>
                <span className="text-xs text-muted-foreground">Authenticated Team Profile</span>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs font-medium bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-600/20">
              Active
            </Badge>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
