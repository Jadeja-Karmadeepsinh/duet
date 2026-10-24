"use client";

import React, { useState } from "react";
import { Plus, Play, Archive, CheckCircle2, Clock, MoreHorizontal, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { AddTaskDialog, type TaskItem } from "./add-task-dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, taskRowVariants } from "@/lib/motion";

export type { TaskItem };

interface RecentTasksProps {
  tasks: TaskItem[];
  loading: boolean;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onTaskCreated: (task: TaskItem) => void;
  onTaskUpdated?: (task: TaskItem) => void;
  onTaskArchived: (taskId: string) => void;
  className?: string;
}

export function RecentTasks({
  tasks,
  loading,
  selectedTaskId,
  onSelectTask,
  onTaskCreated,
  onTaskUpdated,
  onTaskArchived,
  className,
}: RecentTasksProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const handleArchive = async (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const handleEditClick = (task: TaskItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTask(task);
    setShowAddDialog(true);
  };

  return (
    <>
      <section
        aria-labelledby="tasks-heading"
        className={cn(
          "rounded-3xl border border-border bg-card p-5 sm:p-6 surface-elevation flex flex-col justify-between min-h-[340px] sm:min-h-[380px] lg:min-h-[420px] transition-all",
          className
        )}
      >
        <div className="flex flex-col gap-3">
          {/* Header Row */}
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <h3
                id="tasks-heading"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
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
              onClick={() => {
                setEditingTask(null);
                setShowAddDialog(true);
              }}
              className="text-xs text-primary hover:text-primary hover:bg-primary/10 h-8 gap-1.5 px-3 rounded-xl font-medium press-scale"
            >
              <Plus className="size-3.5" />
              <span>New Task</span>
            </Button>
          </div>

          {/* Task List: Constrained in height with internal scrolling */}
          <div className="divide-y divide-border/60 overflow-y-auto max-h-[380px] -mx-1 px-1 rounded-xl">
            {loading ? (
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4 max-w-sm rounded-md" />
                <Skeleton className="h-4 w-1/2 max-w-xs rounded-md" />
                <Skeleton className="h-4 w-2/3 max-w-sm rounded-md" />
              </div>
            ) : tasks.length > 0 ? (
              <AnimatePresence initial={false}>
                {tasks.map((task) => {
                  const isSelected = selectedTaskId === task.id;

                  return (
                    <motion.div
                      key={task.id}
                      layout
                      variants={taskRowVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      onClick={() => onSelectTask(task.id)}
                      className={cn(
                        "p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors group rounded-xl my-0.5",
                        isSelected
                          ? "bg-secondary font-medium"
                          : "hover:bg-secondary/50"
                      )}
                    >
                      {/* Left: Title, Description & Metadata */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span
                                  className={cn(
                                    "text-sm font-medium truncate block",
                                    isSelected ? "text-primary font-semibold" : "text-foreground"
                                  )}
                                >
                                  {task.title}
                                </span>
                              }
                            />
                            <TooltipContent side="top" className="text-xs max-w-xs">
                              {task.title}
                            </TooltipContent>
                          </Tooltip>

                          {task.category && (
                            <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-md shrink-0">
                              {task.category}
                            </span>
                          )}
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <Clock className="size-3 shrink-0" />
                          <span>
                            {task.plannedDurationSeconds
                              ? `${Math.round(task.plannedDurationSeconds / 60)}m countdown`
                              : "Stopwatch"}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="button"
                          variant={isSelected ? "default" : "secondary"}
                          size="sm"
                          onClick={() => onSelectTask(task.id)}
                          className={cn(
                            "h-7 rounded-lg text-xs font-medium px-2.5 flex items-center gap-1 press-scale",
                            isSelected
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Play className="size-3 fill-current" />
                          <span className="hidden sm:inline">{isSelected ? "Selected" : "Select"}</span>
                        </Button>

                        {/* Dropdown Menu for Edit & Archive */}
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Task options"
                                className="text-muted-foreground hover:text-foreground size-7 rounded-lg"
                              >
                                <MoreHorizontal className="size-3.5" />
                                <span className="sr-only">Task actions</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end" className="w-36 p-1 z-50">
                            <DropdownMenuItem
                              onClick={() => handleEditClick(task)}
                              className="text-xs flex items-center gap-2 cursor-pointer py-1.5"
                            >
                              <Edit2 className="size-3.5 text-muted-foreground" />
                              <span>Edit Task</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={archivingId === task.id}
                              onClick={() => handleArchive(task.id)}
                              className="text-xs text-destructive focus:bg-destructive/10 focus:text-destructive flex items-center gap-2 cursor-pointer py-1.5"
                            >
                              <Archive className="size-3.5 text-destructive" />
                              <span>Archive Task</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <CheckCircle2 className="size-7 stroke-[1.5] text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No active tasks</p>
                <p className="text-xs max-w-xs text-muted-foreground">
                  Create a task to start tracking focus countdowns or stopwatch sessions.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTask(null);
                    setShowAddDialog(true);
                  }}
                  className="mt-2 text-xs rounded-xl"
                >
                  <Plus className="size-3.5 mr-1" />
                  <span>Create Task</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      <AddTaskDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onTaskCreated={onTaskCreated}
        taskToEdit={editingTask}
        onTaskUpdated={(updatedTask) => {
          if (onTaskUpdated) {
            onTaskUpdated(updatedTask);
          }
        }}
      />
    </>
  );
}
