"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Plus, Square, Info } from "lucide-react";

export interface DecisionSession {
  id: string;
  taskTitleSnapshot: string;
  categorySnapshot?: string | null;
  targetDurationSeconds: number | null;
  trackedSeconds: number;
}

interface DecisionDialogProps {
  open: boolean;
  session: DecisionSession | null;
  loadingAction: string | null;
  onComplete: () => Promise<void>;
  onExtend: (seconds: number) => Promise<void>;
  onStop: () => Promise<void>;
}

export function DecisionDialog({
  open,
  session,
  loadingAction,
  onComplete,
  onExtend,
  onStop,
}: DecisionDialogProps) {
  if (!session) return null;

  const targetMinutes = session.targetDurationSeconds
    ? Math.round(session.targetDurationSeconds / 60)
    : Math.round(session.trackedSeconds / 60);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md p-6 rounded-2xl bg-card border border-border shadow-xl space-y-5 max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader className="space-y-2 text-center items-center">
          <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="size-7" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Focus Block Complete
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground max-w-xs mx-auto">
            You completed {targetMinutes} minutes of focused work on{" "}
            <strong className="text-foreground font-semibold">
              {session.taskTitleSnapshot}
            </strong>
            .
          </DialogDescription>
        </DialogHeader>

        {/* Informative notice regarding paused/decision time exclusion */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-secondary/60 text-xs text-muted-foreground border border-border/50">
          <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
          <span>
            Decision and paused time is not counted towards your active focus metrics.
            Choose to mark the task completed, extend your session, or stop.
          </span>
        </div>

        {/* Action Options */}
        <div className="space-y-3 pt-1">
          {/* 1. Mark Completed (Primary) */}
          <Button
            type="button"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            disabled={loadingAction !== null}
            onClick={onComplete}
          >
            <CheckCircle2 className="size-4" />
            {loadingAction === "complete" ? "Completing..." : "Mark Task Completed"}
          </Button>

          {/* 2. Extension Options */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block text-center">
              Or extend your timer
            </span>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs font-medium py-2 flex items-center justify-center gap-1 hover:bg-secondary transition-colors"
                disabled={loadingAction !== null}
                onClick={() => onExtend(900)}
              >
                <Plus className="size-3" />
                {loadingAction === "extend-900" ? "..." : "+15 min"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs font-medium py-2 flex items-center justify-center gap-1 hover:bg-secondary transition-colors"
                disabled={loadingAction !== null}
                onClick={() => onExtend(1800)}
              >
                <Plus className="size-3" />
                {loadingAction === "extend-1800" ? "..." : "+30 min"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs font-medium py-2 flex items-center justify-center gap-1 hover:bg-secondary transition-colors"
                disabled={loadingAction !== null}
                onClick={() => onExtend(3600)}
              >
                <Plus className="size-3" />
                {loadingAction === "extend-3600" ? "..." : "+60 min"}
              </Button>
            </div>
          </div>

          {/* 3. Stop without completing */}
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground hover:text-foreground py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            disabled={loadingAction !== null}
            onClick={onStop}
          >
            <Square className="size-3.5" />
            {loadingAction === "stop" ? "Stopping..." : "Stop without completing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
