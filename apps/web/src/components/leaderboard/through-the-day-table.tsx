"use client";

import React from "react";
import { GitCommit, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LeaderboardEntry } from "./standings-list";

export interface SlotSnapshotData {
  slot: "10:00" | "18:00" | "22:00";
  label: string;
  isCaptured: boolean;
  entries: LeaderboardEntry[];
}

interface ThroughTheDayTableProps {
  slotsData: SlotSnapshotData[];
  profiles: Array<{ userId: string; displayName: string; isCurrentUser: boolean }>;
}

function formatHoursMinutes(sec: number) {
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hrs === 0 && mins === 0) return "0m";
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

export function ThroughTheDayTable({ slotsData, profiles }: ThroughTheDayTableProps) {
  if (profiles.length === 0) return null;

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-xs space-y-4 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-border/50 gap-2">
        <div className="flex items-center gap-2">
          <GitCommit className="size-4 text-primary" />
          <h3 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
            Through the Day Progress
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Cumulative focus and checkpoint deltas in Asia/Kolkata
        </p>
      </div>

      {/* Internal Horizontally Scrollable Container (No Page Overflow) */}
      <div className="overflow-x-auto min-w-0">
        <table className="w-full text-left text-xs border-collapse min-w-[560px]">
          <thead>
            <tr className="border-b border-border/40 text-muted-foreground">
              <th className="pb-2.5 font-semibold text-[11px] uppercase tracking-wider pl-1">
                Team Member
              </th>
              {slotsData.map((s) => (
                <th key={s.slot} className="pb-2.5 font-semibold text-[11px] uppercase tracking-wider text-right pr-2">
                  <div className="inline-flex items-center gap-1.5">
                    <span>{s.label}</span>
                    {s.isCaptured ? (
                      <span className="size-1.5 rounded-full bg-emerald-500" title="Captured" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground/30" title="Upcoming" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {profiles.map((profile) => {
              // Calculate checkpoint values and deltas for this profile
              let previousFocus = 0;

              return (
                <tr key={profile.userId} className="hover:bg-secondary/20 transition-colors">
                  {/* Profile Name */}
                  <td className="py-3 pl-1 pr-3 font-medium text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[140px] sm:max-w-[180px]" title={profile.displayName}>
                        {profile.displayName}
                      </span>
                      {profile.isCurrentUser && (
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-primary/20 text-[9px] py-0 px-1 font-medium"
                        >
                          You
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Slot Columns */}
                  {slotsData.map((slotInfo) => {
                    if (!slotInfo.isCaptured) {
                      return (
                        <td key={slotInfo.slot} className="py-3 pr-2 text-right text-muted-foreground/50 font-mono">
                          —
                        </td>
                      );
                    }

                    const entry = slotInfo.entries.find((e) => e.userId === profile.userId);
                    const currentFocus = entry ? entry.focusSeconds : 0;
                    const currentTasks = entry ? entry.completedTasks : 0;
                    const delta = currentFocus - previousFocus;
                    previousFocus = currentFocus;

                    return (
                      <td key={slotInfo.slot} className="py-3 pr-2 text-right">
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-foreground tabular-nums">
                            {formatHoursMinutes(currentFocus)}
                          </div>
                          <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground">
                            <span>{currentTasks} {currentTasks === 1 ? "task" : "tasks"}</span>
                            {delta > 0 && (
                              <span className="text-primary font-mono font-medium">
                                (+{formatHoursMinutes(delta)})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend / Helper Note */}
      <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
        <Clock className="size-3 text-muted-foreground/60 shrink-0" />
        <span>
          Checkpoints freeze at 10:00 AM, 6:00 PM, and 10:00 PM IST. Deltas show focus time accumulated since the previous checkpoint.
        </span>
      </div>
    </div>
  );
}
