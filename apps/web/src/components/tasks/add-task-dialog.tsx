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
import { Plus, Clock, Tag, AlertCircle, Edit2 } from "lucide-react";
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
  { label: "15m", seconds: 900 },
  { label: "25m (Pomodoro)", seconds: 1500 },
  { label: "45m", seconds: 2700 },
  { label: "60m (Deep Work)", seconds: 3600 },
] as const;

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  category: string | null;
  plannedDurationSeconds: number | null;
  status: string;
  createdAt: string;
}

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: (task: TaskItem) => void;
  taskToEdit?: TaskItem | null;
  onTaskUpdated?: (task: TaskItem) => void;
}

function getInitialBudget(taskToEdit?: TaskItem | null) {
  if (!taskToEdit || taskToEdit.plannedDurationSeconds === 1500) {
    return { mode: "preset" as const, preset: 1500, custom: "30" };
  }
  if (taskToEdit.plannedDurationSeconds === null) {
    return { mode: "stopwatch" as const, preset: 1500, custom: "30" };
  }
  const matching = DURATION_PRESETS.find((p) => p.seconds === taskToEdit.plannedDurationSeconds);
  if (matching) {
    return { mode: "preset" as const, preset: matching.seconds, custom: "30" };
  }
  return {
    mode: "custom" as const,
    preset: 1500,
    custom: String(Math.round(taskToEdit.plannedDurationSeconds / 60)),
  };
}

interface AddTaskFormProps {
  taskToEdit?: TaskItem | null;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: (task: TaskItem) => void;
  onTaskUpdated?: (task: TaskItem) => void;
}

function AddTaskForm({
  taskToEdit,
  onOpenChange,
  onTaskCreated,
  onTaskUpdated,
}: AddTaskFormProps) {
  const isEditing = !!taskToEdit;
  const initialBudget = getInitialBudget(taskToEdit);

  const [title, setTitle] = useState(taskToEdit?.title ?? "");
  const [description, setDescription] = useState(taskToEdit?.description ?? "");
  const [category, setCategory] = useState<string>(taskToEdit?.category ?? "Coding");
  const [budgetMode, setBudgetMode] = useState<"preset" | "stopwatch" | "custom">(initialBudget.mode);
  const [selectedPresetSeconds, setSelectedPresetSeconds] = useState<number>(initialBudget.preset);
  const [customMinutes, setCustomMinutes] = useState<string>(initialBudget.custom);

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
      if (isEditing && taskToEdit) {
        const res = await fetch(`/api/v1/tasks/${taskToEdit.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmedTitle,
            description: description.trim() || null,
            plannedDurationSeconds,
            category: category || null,
          }),
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error?.message || "Failed to update task.");
          return;
        }

        if (onTaskUpdated) {
          onTaskUpdated(json.data.task);
        }
      } else {
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

        onTaskCreated(json.data.task);
      }

      onOpenChange(false);
    } catch {
      setError("Network error. Could not connect to API.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
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
              <span>
                Task Title <strong className="text-destructive font-normal">*</strong>
              </span>
              <span className="text-[11px] font-normal text-muted-foreground">{title.length}/100</span>
            </label>
            <Input
              id="task-title"
              placeholder="e.g. Implement Dashboard 12-column layout"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              className="rounded-xl text-sm"
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
              placeholder="e.g. Focus on mobile breakpoint and responsive spacing"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-xl text-sm"
            />
          </div>

          {/* Planned Duration / Time Budget */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="size-3.5 text-muted-foreground" />
              <span>Planned Duration</span>
            </label>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-secondary/60 rounded-xl">
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
                      "p-2 rounded-xl text-xs font-medium border text-left transition-all",
                      selectedPresetSeconds === p.seconds
                        ? "border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary/30"
                        : "border-border bg-card hover:bg-secondary/40 text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {budgetMode === "custom" && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="rounded-xl w-28 text-sm tabular-nums"
                  required
                />
                <span className="text-xs text-muted-foreground font-medium">Minutes (Countdown)</span>
              </div>
            )}

            {budgetMode === "stopwatch" && (
              <p className="text-[11px] text-muted-foreground pt-1">
                Stopwatch mode has no time limit. Focus timer counts upward until you stop it.
              </p>
            )}
          </div>

          {/* Category Tag Selection */}
          <div className="space-y-1.5">
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
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                    category === cat
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="text-xs rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4"
            >
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Create Task"}
            </Button>
          </div>
        </form>
  );
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onTaskCreated,
  taskToEdit,
  onTaskUpdated,
}: AddTaskDialogProps) {
  const isEditing = !!taskToEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 rounded-2xl bg-card border border-border shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            {isEditing ? (
              <>
                <Edit2 className="size-4 text-primary" />
                <span>Edit Focus Task</span>
              </>
            ) : (
              <>
                <Plus className="size-4.5 text-primary" />
                <span>Create Focus Task</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isEditing
              ? "Update task details or time budget."
              : "Create a task for your focus countdown or stopwatch sessions."}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <AddTaskForm
            key={taskToEdit?.id ?? "new"}
            taskToEdit={taskToEdit}
            onOpenChange={onOpenChange}
            onTaskCreated={onTaskCreated}
            onTaskUpdated={onTaskUpdated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

