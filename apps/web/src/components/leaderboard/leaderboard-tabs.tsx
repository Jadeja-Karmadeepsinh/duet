"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";

export type LeaderboardPeriod = "today" | "7d";
export type LeaderboardSlot = "10:00" | "18:00" | "22:00";

interface LeaderboardTabsProps {
  period: LeaderboardPeriod;
  onPeriodChange: (period: LeaderboardPeriod) => void;
  availableSlots: LeaderboardSlot[];
  selectedSlot?: LeaderboardSlot | "provisional";
  onSlotChange: (slot: LeaderboardSlot) => void;
  isProvisional: boolean;
  disabled?: boolean;
}

const SLOT_LABELS: Record<LeaderboardSlot, string> = {
  "10:00": "10:00 AM",
  "18:00": "6:00 PM",
  "22:00": "10:00 PM",
};

export function LeaderboardTabs({
  period,
  onPeriodChange,
  availableSlots,
  selectedSlot,
  onSlotChange,
  isProvisional,
  disabled,
}: LeaderboardTabsProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Primary Period Pills (Today vs Last 7 Days) */}
      <div
        role="tablist"
        aria-label="Leaderboard timeframe"
        className="inline-flex p-1 rounded-2xl bg-secondary/60 border border-border/50 shadow-xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={period === "today"}
          disabled={disabled}
          onClick={() => onPeriodChange("today")}
          className={cn(
            "px-4 py-1.5 text-xs font-medium rounded-xl transition-all select-none cursor-pointer flex items-center gap-1.5",
            period === "today"
              ? "bg-card text-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Clock className="size-3.5" />
          <span>Today</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={period === "7d"}
          disabled={disabled}
          onClick={() => onPeriodChange("7d")}
          className={cn(
            "px-4 py-1.5 text-xs font-medium rounded-xl transition-all select-none cursor-pointer flex items-center gap-1.5",
            period === "7d"
              ? "bg-card text-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar className="size-3.5" />
          <span>Last 7 Days</span>
        </button>
      </div>

      {/* Checkpoint Slot Pills (for Today) */}
      {period === "today" && availableSlots.length > 0 && !isProvisional && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
            Checkpoint:
          </span>
          <div className="inline-flex p-1 rounded-2xl bg-secondary/40 border border-border/40">
            {availableSlots.map((slot) => {
              const isSelected = selectedSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSlotChange(slot)}
                  className={cn(
                    "px-3 py-1 text-xs font-mono font-medium rounded-xl transition-all cursor-pointer",
                    isSelected
                      ? "bg-card text-foreground font-semibold shadow-xs border border-border/60"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {SLOT_LABELS[slot]}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
