"use client";

import React, { useState } from "react";
import { Plus, Play, Archive, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AddTaskDialog } from "./add-task-dialog";
import { cn } from "@/lib/utils";

export interface TaskItem {
  id: string;
  title: string;
  category: string | null;
  plannedDurationSeconds: number | null;
  status: string;
  createdAt: string;
}

interface RecentTasksProps {
  tasks: TaskItem[];
  loading: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onTaskCreated: (task: TaskItem) => void;
  onTaskArchived: (taskId: string) => void;
}

export function RecentTasks({
  tasks,
  loading,
  selectedTaskId,
  onSelectTask,
  onTaskCreated,
  onTaskArchived,
}: RecentTasksProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const handleArchive = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchivingId(taskId);
    try {
      const res = await fetch(`/api/v1/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onTaskArchived(taskId);
      }
    } catch {
      // Ignore network error
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <>
      <section aria-labelledby="tasks-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 id="tasks-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Focus Tasks
            </h3>
            <Badge variant="secondary" className="text-[11px] font-normal px-2 py-0">
              {tasks.length}
            </Badge>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="text-xs text-[#0071e3] hover:text-[#0077ed] hover:bg-secondary/60 h-8 gap-1.5 px-3 rounded-xl font-medium"
          >
            <Plus className="size-3.5" />
            <span>Add Task</span>
          </Button>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-xs divide-y divide-border overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-3/4 max-w-sm rounded-md" />
              <Skeleton className="h-4 w-1/2 max-w-xs rounded-md" />
            </div>
          ) : tasks.length > 0 ? (
            tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className={cn(
                  "p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors group",
                  selectedTaskId === task.id
                    ? "bg-[#0071e3]/5 hover:bg-[#0071e3]/8"
                    : "hover:bg-secondary/40"
                )}
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium truncate",
                        selectedTaskId === task.id ? "text-[#0071e3] font-semibold" : "text-foreground"
                      )}
                    >
                      {task.title}
                    </span>
                    {task.category && (
                      <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md shrink-0">
                        {task.category}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="size-3 shrink-0" />
                    <span>
                      {task.plannedDurationSeconds
                        ? `${Math.round(task.plannedDurationSeconds / 60)}m countdown`
                        : "Stopwatch"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive h-8 w-8 p-0 rounded-lg"
                    title="Archive Task"
                    disabled={archivingId === task.id}
                    onClick={(e) => handleArchive(task.id, e)}
                  >
                    <Archive className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant={selectedTaskId === task.id ? "default" : "secondary"}
                    size="sm"
                    className={cn(
                      "h-8 rounded-xl text-xs font-medium px-3 flex items-center gap-1",
                      selectedTaskId === task.id && "bg-[#0071e3] text-white hover:bg-[#0077ed]"
                    )}
                  >
                    <Play className="size-3 fill-current" />
                    <span>Select</span>
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center flex flex-col items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="size-8 stroke-[1.5] text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">No active focus tasks</p>
              <p className="text-xs max-w-xs text-muted-foreground">
                Create a task above to start tracking focus countdowns or stopwatches.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="mt-2 text-xs rounded-xl"
              >
                <Plus className="size-3.5 mr-1" />
                <span>Create Task</span>
              </Button>
            </div>
          )}
        </div>
      </section>

      <AddTaskDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onTaskCreated={onTaskCreated}
      />
    </>
  );
}
