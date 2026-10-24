"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Clock, Tag, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  "Coding",
  "DSA",
  "Learning",
  "Project",
  "Personal",
  "Other",
] as const;

const DURATION_PRESETS = [
  { label: "15 min", seconds: 900 },
  { label: "25 min (Pomodoro)", seconds: 1500 },
  { label: "45 min", seconds: 2700 },
  { label: "60 min", seconds: 3600 },
] as const;

interface TaskItem {
  id: string;
  title: string;
  category: string | null;
  plannedDurationSeconds: number | null;
  status: string;
  createdAt: string;
}

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: (task: TaskItem) => void;
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
}: AddTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("Coding");
  const [budgetMode, setBudgetMode] = useState<"preset" | "stopwatch" | "custom">("preset");
  const [selectedPresetSeconds, setSelectedPresetSeconds] = useState<number>(1500); // 25m default
  const [customMinutes, setCustomMinutes] = useState<string>("30");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Task title is required.");
      return;
    }
    if (trimmedTitle.length > 100) {
      setError("Task title must be 100 characters or less.");
      return;
    }

    let plannedDurationSeconds: number | null = null;
    if (budgetMode === "preset") {
      plannedDurationSeconds = selectedPresetSeconds;
    } else if (budgetMode === "custom") {
      const mins = parseInt(customMinutes, 10);
      if (isNaN(mins) || mins <= 0 || mins > 720) {
        setError("Custom duration must be between 1 and 720 minutes.");
        return;
      }
      plannedDurationSeconds = mins * 60;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmedTitle,
          description: description.trim() || undefined,
          plannedDurationSeconds,
          category: category || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error?.message || "Failed to create task.");
        return;
      }

      // Reset form
      setTitle("");
      setDescription("");
      setError(null);
      onTaskCreated(json.data.task);
      onOpenChange(false);
    } catch {
      setError("Network error. Could not connect to API.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-2xl bg-card border border-border shadow-xl space-y-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Plus className="size-5 text-[#0071e3]" />
            Create Focus Task
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Create a reusable task for your focus countdown or stopwatch sessions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/10 text-destructive text-xs border border-destructive/20">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Task Name */}
          <div className="space-y-1.5">
            <label htmlFor="task-title" className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>Task Title <strong className="text-destructive font-normal">*</strong></span>
              <span className="text-[11px] font-normal text-muted-foreground">{title.length}/100</span>
            </label>
            <Input
              id="task-title"
              placeholder="e.g. Implement Timer Card Component"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="rounded-xl bg-secondary/30 text-sm"
              autoFocus
              required
            />
          </div>

          {/* Optional Description */}
          <div className="space-y-1.5">
            <label htmlFor="task-description" className="text-xs font-semibold text-foreground">
              Description <span className="font-normal text-muted-foreground">(Optional)</span>
            </label>
            <Input
              id="task-description"
              placeholder="e.g. Focus on state transitions and unit tests"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl bg-secondary/30 text-sm"
            />
          </div>

          {/* Time Budget */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              <span>Time Budget</span>
            </label>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-secondary/50 rounded-xl">
              <button
                type="button"
                onClick={() => setBudgetMode("preset")}
                className={cn(
                  "py-1.5 text-xs font-medium rounded-lg transition-all text-center",
                  budgetMode === "preset"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Presets
              </button>
              <button
                type="button"
                onClick={() => setBudgetMode("custom")}
                className={cn(
                  "py-1.5 text-xs font-medium rounded-lg transition-all text-center",
                  budgetMode === "custom"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Custom Min
              </button>
              <button
                type="button"
                onClick={() => setBudgetMode("stopwatch")}
                className={cn(
                  "py-1.5 text-xs font-medium rounded-lg transition-all text-center",
                  budgetMode === "stopwatch"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Stopwatch
              </button>
            </div>

            {budgetMode === "preset" && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.seconds}
                    type="button"
                    onClick={() => setSelectedPresetSeconds(p.seconds)}
                    className={cn(
                      "py-2 px-3 text-xs rounded-xl border transition-all text-left flex items-center justify-between",
                      selectedPresetSeconds === p.seconds
                        ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] font-semibold"
                        : "border-border bg-card hover:bg-secondary/40 text-muted-foreground"
                    )}
                  >
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}

            {budgetMode === "custom" && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min="1"
                  max="720"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  placeholder="Minutes"
                  className="rounded-xl bg-secondary/30 text-sm w-32"
                />
                <span className="text-xs text-muted-foreground">minutes planned countdown</span>
              </div>
            )}

            {budgetMode === "stopwatch" && (
              <p className="text-[11px] text-muted-foreground pt-1">
                Open-ended stopwatch timer. Tracks elapsed focus time without automatic countdown expiry.
              </p>
            )}
          </div>

          {/* Category Pills */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Tag className="size-3.5 text-muted-foreground" />
              <span>Category</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "px-3 py-1 text-xs rounded-lg border transition-all",
                    category === cat
                      ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] font-semibold"
                      : "border-border bg-card hover:bg-secondary/40 text-muted-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs py-2 px-4"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-xl text-xs py-2 px-5 bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold transition-all shadow-xs"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
