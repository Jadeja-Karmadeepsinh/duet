"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Plus,
  ArrowRight,
  Flame,
  Search,
  User,
  Sliders,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export default function DesignPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const [selectedTab, setSelectedTab] = useState("overview");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [progressVal, setProgressVal] = useState(68);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased pb-24">
      {/* Sticky Preview Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Timer className="size-4.5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base tracking-tight">Focus Duo Design System</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase font-mono">
                QA Preview
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Apple-inspired monochrome token system & shared primitives (Phase UI-1)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="text-xs gap-1.5">
              <span>Back to App</span>
              <ArrowRight className="size-3.5" />
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <ThemeToggle variant="outline" />
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-12">
        {/* Banner note */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-foreground">
            <span className="flex size-2 rounded-full bg-primary animate-pulse" />
            <span>
              <strong>Development-only preview:</strong> Verifies Poppins typography, OKLCH Apple tokens, and reusable primitives across light and dark modes.
            </span>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">Will be omitted from production nav</span>
        </div>

        {/* SECTION 1: TYPOGRAPHY HIERARCHY */}
        <section className="space-y-4">
          <div className="border-b border-border/60 pb-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">1. Typography Scale (Poppins)</h2>
            <p className="text-xs text-muted-foreground">
              Applied from root layout with weights 400, 500, 600, 700 and tabular figures.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Hierarchy Scales</CardTitle>
                <CardDescription>Scale standards for titles, sections, body, and metadata</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Display / Hero (30px/700)</span>
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Focus on Deep Work</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Section Header (20px/600)</span>
                  <p className="text-lg sm:text-xl font-semibold tracking-tight text-foreground">Weekly Performance Overview</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Subhead / Card Title (15px/600)</span>
                  <p className="text-sm sm:text-base font-semibold tracking-tight text-foreground">Active Countdown Timer</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Body Text (14px/400)</span>
                  <p className="text-sm text-foreground leading-relaxed">
                    A distraction-free focus tracker built for solo flow and small team visibility. Synchronized in India Standard Time.
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Caption / Helper Text (12px/400)</span>
                  <p className="text-xs text-muted-foreground">
                    Last session synced 2 minutes ago • Auto-save enabled
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Tabular Numerals</CardTitle>
                <CardDescription>Monospaced figure alignment for timers, streaks, ranks, and dates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Large Timer Digits</span>
                  <div className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground tabular-nums mt-1">
                    24:59<span className="text-base text-muted-foreground font-normal ml-2">remaining</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-xl bg-secondary/50 p-3">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">Streak Record</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Flame className="size-4 text-amber-500 fill-amber-500" />
                      <span className="text-lg font-bold tabular-nums">14 Days</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-secondary/50 p-3">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase">Total Focus Time</span>
                    <div className="text-lg font-bold tabular-nums mt-1">42h 15m</div>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Rank & Metric Rows</span>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 px-2 rounded-lg bg-secondary/30 tabular-nums">
                      <span className="font-medium">#1 Alex</span>
                      <span className="font-semibold text-primary">08h 42m</span>
                    </div>
                    <div className="flex justify-between py-1 px-2 rounded-lg bg-secondary/30 tabular-nums">
                      <span className="font-medium">#2 Jordan</span>
                      <span className="font-semibold text-muted-foreground">06h 15m</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECTION 2: BUTTONS & INTERACTIVE STATES */}
        <section className="space-y-4">
          <div className="border-b border-border/60 pb-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">2. Buttons & Hit Areas</h2>
            <p className="text-xs text-muted-foreground">
              Standardized heights, radii, hover surfaces, active spring scale, and accessible icon buttons.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Variants */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">Variants</span>
                <div className="flex flex-wrap gap-2.5 items-center">
                  <Button variant="default">Primary Default</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                  <Button disabled>Disabled</Button>
                </div>
              </div>

              {/* Sizes */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">Sizes</span>
                <div className="flex flex-wrap gap-2.5 items-center">
                  <Button size="xs">Size XS</Button>
                  <Button size="sm">Size SM</Button>
                  <Button size="default">Size Default (h-8)</Button>
                  <Button size="lg">Size LG (h-9)</Button>
                </div>
              </div>

              {/* Icon Buttons with Accessible Labels */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">Icon-Only (Accessible Hit Area & Label)</span>
                <div className="flex flex-wrap gap-2.5 items-center">
                  <Button size="icon-sm" variant="outline" aria-label="Start timer">
                    <Play className="size-3.5 fill-current" />
                  </Button>
                  <Button size="icon-sm" variant="secondary" aria-label="Pause session">
                    <Pause className="size-3.5" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" aria-label="Reset timer">
                    <RotateCcw className="size-3.5" />
                  </Button>
                  <Button size="icon" variant="default" aria-label="Add new task">
                    <Plus className="size-4" />
                  </Button>
                  <Button size="icon" variant="outline" aria-label="Search items">
                    <Search className="size-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* SECTION 3: FORM INPUTS & SELECTS */}
        <section className="space-y-4">
          <div className="border-b border-border/60 pb-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">3. Form Primitives & Select</h2>
            <p className="text-xs text-muted-foreground">
              Consistent heights, focus rings, placeholder contrast, and disabled states.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Text Inputs</CardTitle>
                <CardDescription>Single-line fields with focus rings and error states</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Task Title</label>
                  <Input placeholder="e.g. Refactor API controllers" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">With Icon Label</label>
                  <div className="relative">
                    <Input placeholder="Enter username" defaultValue="Karmadeepsinh" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Disabled State</label>
                  <Input disabled placeholder="Cannot edit read-only field" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Select Dropdown</CardTitle>
                <CardDescription>Custom styled accessible select using @base-ui/react</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Planned Duration</label>
                  <Select defaultValue="25">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Pomodoro Standards</SelectLabel>
                        <SelectItem value="15">15 Minutes (Short)</SelectItem>
                        <SelectItem value="25">25 Minutes (Standard)</SelectItem>
                        <SelectItem value="45">45 Minutes (Extended)</SelectItem>
                        <SelectItem value="60">60 Minutes (Deep Dive)</SelectItem>
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>Open Session</SelectLabel>
                        <SelectItem value="stopwatch">Open Stopwatch (No Limit)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Status Filter</label>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Filter tasks" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sessions</SelectItem>
                      <SelectItem value="completed">Completed Only</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECTION 4: TABS, BADGES & SEGMENTED CONTROLS */}
        <section className="space-y-4">
          <div className="border-b border-border/60 pb-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">4. Badges & Segmented Controls</h2>
            <p className="text-xs text-muted-foreground">
              Apple-inspired pill badges and segmented tabs for mode toggling.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Badges</CardTitle>
                <CardDescription>Restrained semantic indicators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Primary Badge</Badge>
                  <Badge variant="secondary">Secondary Pill</Badge>
                  <Badge variant="outline">Outline</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                </div>

                <div className="pt-2 border-t border-border/50 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Running
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    Paused
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium text-[11px]">
                    <span className="size-1.5 rounded-full bg-muted-foreground/60" />
                    Idle
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Segmented Control (Tabs)</CardTitle>
                <CardDescription>Smooth switching tab bar</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedTab} onValueChange={(val) => setSelectedTab(val as string)}>
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>
                  <div className="mt-3 p-3 rounded-xl bg-secondary/40 text-xs">
                    <TabsContent value="overview">
                      <p className="text-muted-foreground">
                        <strong>Overview Panel:</strong> Displays current active streak and session stats.
                      </p>
                    </TabsContent>
                    <TabsContent value="history">
                      <p className="text-muted-foreground">
                        <strong>History Panel:</strong> Trailing 30 days of completed focus sessions.
                      </p>
                    </TabsContent>
                    <TabsContent value="settings">
                      <p className="text-muted-foreground">
                        <strong>Settings Panel:</strong> Timezone configuration (Asia/Kolkata) and preferences.
                      </p>
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* SECTION 5: OVERLAYS (DIALOG, SHEET, DROPDOWN, TOOLTIP) */}
        <section className="space-y-4">
          <div className="border-b border-border/60 pb-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">5. Overlays, Dialogs & Menus</h2>
            <p className="text-xs text-muted-foreground">
              Proper stacking contexts, blur backdrops, and unclipped positioning.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3 items-center">
                {/* Modal Dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger
                    render={
                      <Button variant="outline">
                        <ExternalLink className="size-3.5 mr-1.5" />
                        Open Dialog
                      </Button>
                    }
                  />
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Focus Task</DialogTitle>
                      <DialogDescription>
                        Set task title and planned duration for your session.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                      <Input placeholder="What are you working on?" defaultValue="Design system audit" />
                      <p className="text-xs text-muted-foreground">
                        Mode is automatically determined by duration (countdown vs stopwatch).
                      </p>
                    </div>
                    <DialogFooter showCloseButton>
                      <Button onClick={() => {
                        setDialogOpen(false);
                        toast.success("Task created successfully!");
                      }}>
                        Save Task
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Side Sheet */}
                <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                  <SheetTrigger
                    render={
                      <Button variant="outline">
                        <Sliders className="size-3.5 mr-1.5" />
                        Open Sheet Drawer
                      </Button>
                    }
                  />
                  <SheetContent side="right">
                    <SheetHeader>
                      <SheetTitle>Session Filter Drawer</SheetTitle>
                      <SheetDescription>
                        Filter sessions by date range, tag, and completion status.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="py-4 space-y-3 text-xs">
                      <p className="text-muted-foreground">
                        Sheets provide non-intrusive auxiliary panels on desktop and slide-up drawers on mobile.
                      </p>
                    </div>
                    <SheetFooter>
                      <Button onClick={() => setSheetOpen(false)}>Done</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                {/* Dropdown Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline">
                        <User className="size-3.5 mr-1.5" />
                        Dropdown Menu
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="start" className="w-48">
                    <DropdownMenuLabel>Profile Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuItem>
                        <span>Account Details</span>
                        <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <span>Team Leaderboard</span>
                        <DropdownMenuShortcut>⌘L</DropdownMenuShortcut>
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive">
                      <span>Sign Out</span>
                      <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Tooltip */}
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button variant="secondary" size="sm">
                        Hover for Tooltip
                      </Button>
                    }
                  />
                  <TooltipContent>
                    Tabular digits align perfectly on 360px screens.
                  </TooltipContent>
                </Tooltip>

                {/* Toast Triggers */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast.success("Focus block of 25m recorded in IST!")}
                >
                  Trigger Success Toast
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toast.error("Session pause limit reached")}
                >
                  Trigger Error Toast
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* SECTION 6: PROGRESS, HEATMAP & SKELETONS */}
        <section className="space-y-4">
          <div className="border-b border-border/60 pb-2">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">6. Progress, Activity Heatmap & Skeletons</h2>
            <p className="text-xs text-muted-foreground">
              Apple-inspired progress metrics and restrained activity cell shades.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Progress Bar</CardTitle>
                <CardDescription>Accessible progress indicator with tabular percentage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Session Progress</span>
                    <span className="font-bold tabular-nums text-primary">{progressVal}%</span>
                  </div>
                  <Progress value={progressVal} />
                </div>

                <div className="flex gap-2">
                  <Button size="xs" variant="outline" onClick={() => setProgressVal(Math.max(0, progressVal - 15))}>
                    -15%
                  </Button>
                  <Button size="xs" variant="outline" onClick={() => setProgressVal(Math.min(100, progressVal + 15))}>
                    +15%
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setProgressVal(100)}>
                    Complete
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Activity Heatmap Ramps</CardTitle>
                <CardDescription>Restrained emerald ramp across 5 activity levels</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12">Levels:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="size-4 rounded-xs bg-[#ebedf0] dark:bg-[#21262d] border border-border/40" title="Level 0 (0m)" />
                    <span className="size-4 rounded-xs bg-[#9be9a8] dark:bg-[#0e4429]" title="Level 1 (<30m)" />
                    <span className="size-4 rounded-xs bg-[#40c463] dark:bg-[#006d32]" title="Level 2 (30-60m)" />
                    <span className="size-4 rounded-xs bg-[#30a14e] dark:bg-[#26a641]" title="Level 3 (60-120m)" />
                    <span className="size-4 rounded-xs bg-[#216e39] dark:bg-[#39d353]" title="Level 4 (120m+)" />
                  </div>
                  <span className="text-[11px] text-muted-foreground ml-2">Less → More Focus</span>
                </div>

                <div className="pt-2 border-t border-border/50">
                  <span className="text-xs font-semibold text-muted-foreground">Loading Skeleton</span>
                  <div className="mt-2 space-y-2">
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-3 w-1/2 rounded-md" />
                    <div className="flex items-center gap-2 pt-1">
                      <Skeleton className="size-6 rounded-full" />
                      <Skeleton className="h-3 w-28 rounded-md" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
