"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";
import { motion, activePillSpring } from "@/lib/motion";

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
            "relative px-4 py-1.5 text-xs font-medium rounded-xl select-none cursor-pointer flex items-center gap-1.5 transition-colors",
            period === "today"
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {period === "today" && (
            <motion.span
              layoutId="leaderboard-period-pill"
              className="absolute inset-0 bg-card rounded-xl shadow-xs -z-0"
              transition={activePillSpring}
            />
          )}
          <Clock className="relative z-10 size-3.5" />
          <span className="relative z-10">Today</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={period === "7d"}
          disabled={disabled}
          onClick={() => onPeriodChange("7d")}
          className={cn(
            "relative px-4 py-1.5 text-xs font-medium rounded-xl select-none cursor-pointer flex items-center gap-1.5 transition-colors",
            period === "7d"
              ? "text-foreground font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {period === "7d" && (
            <motion.span
              layoutId="leaderboard-period-pill"
              className="absolute inset-0 bg-card rounded-xl shadow-xs -z-0"
              transition={activePillSpring}
            />
          )}
          <Calendar className="relative z-10 size-3.5" />
          <span className="relative z-10">Last 7 Days</span>
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
                    "relative px-3 py-1 text-xs font-mono font-medium rounded-xl select-none cursor-pointer transition-colors",
                    isSelected
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isSelected && (
                    <motion.span
                      layoutId="leaderboard-slot-pill"
                      className="absolute inset-0 bg-card rounded-xl shadow-xs border border-border/60 -z-0"
                      transition={activePillSpring}
                    />
                  )}
                  <span className="relative z-10">{SLOT_LABELS[slot]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
