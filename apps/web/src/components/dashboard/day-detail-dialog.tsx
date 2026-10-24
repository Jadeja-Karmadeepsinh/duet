"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Calendar, AlertCircle } from "lucide-react";
import { formatIndiaDate, formatIndiaTime } from "@/lib/date";

export interface DayDetailsData {
  date: string;
  totalFocusSeconds: number;
  totalCompletions: number;
  completions: Array<{
    id: string;
    taskTitle: string;
    category: string | null;
    completedAt: string;
  }>;
  sessions: Array<{
    id: string;
    taskTitle: string;
    category: string | null;
    mode: "countdown" | "stopwatch";
    status: string;
    trackedSeconds: number;
    startedAt: string;
    finishedAt: string | null;
  }>;
}

interface DayDetailDialogProps {
  date: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DayDetailDialog({
  date,
  open,
  onOpenChange,
}: DayDetailDialogProps) {
  const [data, setData] = useState<DayDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !date) return;

    let ignore = false;
    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/stats/day?date=${date}`);
        const json = await res.json();
        if (!ignore) {
          if (res.ok && json.success) {
            setData(json.data);
          } else {
            setError(json.error?.message || "Failed to load day details.");
          }
        }
      } catch {
        if (!ignore) setError("Network error loading details.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchDetails();
    return () => {
      ignore = true;
    };
  }, [date, open]);

  const formatHoursMinutes = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hrs === 0 && mins === 0) return "0 min";
    if (hrs === 0) return `${mins} min`;
    if (mins === 0) return `${hrs} hr`;
    return `${hrs} hr ${mins} min`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-2xl bg-card border border-border shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Calendar className="size-3.5" />
            <span>Asia/Kolkata Calendar</span>
          </div>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
            {date ? formatIndiaDate(new Date(`${date}T12:00:00Z`)) : "Day Details"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Focus sessions and completed tasks recorded on this calendar day.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : error ? (
          <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <div className="space-y-4 pt-1">
            {/* Quick Metrics Header */}
            <div className="grid grid-cols-2 gap-2 p-3 bg-secondary/40 rounded-xl border border-border/50">
              <div>
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Total Focus Time
                </span>
                <span className="text-base font-bold font-mono text-foreground">
                  {formatHoursMinutes(data.totalFocusSeconds)}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Completed Tasks
                </span>
                <span className="text-base font-bold font-mono text-foreground">
                  {data.totalCompletions}
                </span>
              </div>
            </div>

            {/* Completed Tasks List */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Task Completions ({data.completions.length})
              </span>
              {data.completions.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {data.completions.map((comp) => (
                    <div
                      key={comp.id}
                      className="p-2.5 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-medium text-foreground truncate break-words">
                          {comp.taskTitle}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {comp.category && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                            {comp.category}
                          </Badge>
                        )}
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {formatIndiaTime(new Date(comp.completedAt))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/80 italic py-2 text-center bg-secondary/20 rounded-xl border border-dashed border-border/40">
                  No tasks marked completed on this date.
                </p>
              )}
            </div>

            {/* Work Sessions List */}
            <div className="space-y-2 pt-1 border-t border-border/50">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Work Sessions ({data.sessions.length})
              </span>
              {data.sessions.length > 0 ? (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {data.sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="p-2.5 rounded-xl border border-border/60 bg-secondary/30 hover:bg-secondary/50 flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <span className="font-medium text-foreground truncate block break-words">
                          {sess.taskTitle}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="capitalize">{sess.mode}</span>
                          <span>•</span>
                          <span className="capitalize">{sess.status.replace("_", " ")}</span>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold text-foreground shrink-0 tabular-nums">
                        {formatHoursMinutes(sess.trackedSeconds)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/80 italic py-2 text-center bg-secondary/20 rounded-xl border border-dashed border-border/40">
                  No work sessions recorded on this date.
                </p>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
