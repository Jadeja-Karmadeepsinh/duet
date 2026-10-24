"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { formatIndiaDate } from "@/lib/date";
import {
  LayoutDashboard,
  BarChart3,
  Trophy,
  LogOut,
  Timer,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { motion, activePillSpring } from "@/lib/motion";

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Analytics",
    href: "/analytics",
    icon: BarChart3,
  },
  {
    name: "Leaderboard",
    href: "/leaderboard",
    icon: Trophy,
  },
];

export function AppShell({ title, subtitle, children }: AppShellProps) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [indiaDate] = useState(() => formatIndiaDate());

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col items-center gap-4">
          <div className="size-12 rounded-2xl bg-secondary flex items-center justify-center animate-pulse">
            <Timer className="size-6 text-muted-foreground" />
          </div>
          <div className="w-48 space-y-2 text-center">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-3 w-44 mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-dvh md:h-dvh md:max-h-dvh md:overflow-hidden bg-background text-foreground flex flex-col md:flex-row">
      {/* Desktop Sidebar: Viewport-bound (h-dvh), pinned profile, independent scroll */}
      <aside
        data-slot="sidebar"
        className="hidden md:flex flex-col w-60 lg:w-64 h-full shrink-0 border-r border-border bg-sidebar select-none z-20"
      >
        {/* Top Brand Header (shrink-0) */}
        <div className="h-14 shrink-0 flex items-center px-5 gap-2.5 border-b border-border/60">
          <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Timer className="size-4.5 stroke-[2.2]" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-[15px] tracking-tight text-foreground">Focus</span>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
              Duo
            </span>
          </div>
        </div>

        {/* Navigation Region: Scrollable if items exceed height, with generous bottom padding */}
        <nav
          className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-1 pb-6"
          aria-label="Main Navigation"
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={
                    <Link
                      href={item.href}
                      aria-label={item.name}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative group flex items-center gap-3 px-3 py-2 rounded-xl text-[13.5px] font-medium transition-colors press-scale",
                        active
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active-tab"
                          className="absolute inset-0 rounded-xl bg-secondary shadow-2xs -z-0"
                          transition={activePillSpring}
                        />
                      )}
                      <Icon
                        className={cn(
                          "relative z-10 size-4 shrink-0 transition-colors",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )}
                      />
                      <span className="relative z-10 truncate">{item.name}</span>
                      {active && (
                        <span className="relative z-10 ml-auto size-1.5 rounded-full bg-primary" aria-hidden="true" />
                      )}
                    </Link>
                  }
                />
                <TooltipContent side="right" sideOffset={10} className="hidden md:block">
                  {item.name}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* User / Profile Section: Pinned at bottom of sidebar (mt-auto shrink-0) */}
        <div className="mt-auto shrink-0 p-3 border-t border-border/60 flex flex-col gap-2 bg-sidebar">
          {/* Appearance Toggle Row */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-secondary/40">
            <span className="text-xs text-muted-foreground font-medium">Appearance</span>
            <ThemeToggle variant="ghost" />
          </div>

          {/* User Profile Card */}
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-secondary/50 border border-border/40 min-w-0">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                {getInitials(user.displayName)}
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col min-w-0 flex-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="text-xs font-semibold text-foreground truncate cursor-default block">
                      {user.displayName}
                    </span>
                  }
                />
                <TooltipContent side="top" sideOffset={8} className="text-xs max-w-[200px]">
                  <span className="font-semibold block">{user.displayName}</span>
                  <span className="text-[10px] text-muted-foreground block">Active profile</span>
                </TooltipContent>
              </Tooltip>
              <span className="text-[10px] text-muted-foreground truncate">Active Profile</span>
            </div>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => signOut()}
                    aria-label="Sign out of Focus Duo"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <LogOut className="size-3.5" />
                    <span className="sr-only">Sign out</span>
                  </Button>
                }
              />
              <TooltipContent side="top" sideOffset={8} className="text-xs">
                Sign out
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </aside>

      {/* Main Content Area: Separate layout/scroll region */}
      <div className="flex-1 min-w-0 md:h-full md:overflow-y-auto md:overflow-x-hidden flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {/* Sticky Glass Top Header Navigation */}
        <header className="sticky top-0 z-20 h-14 shrink-0 border-b border-border/80 glass-panel backdrop-blur-md px-4 md:px-8 flex items-center justify-between select-none">
          {/* Left: Mobile Brand Mark & Page Context */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Mobile Brand Mark */}
            <div className="md:hidden size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Timer className="size-4.5 stroke-[2.2]" />
            </div>

            <div className="min-w-0">
              <h1 className="text-sm md:text-[15px] font-semibold tracking-tight text-foreground truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right: India Local Date Pill, Theme Toggle, & Profile Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {indiaDate && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 px-2.5 py-1 rounded-full border border-border/50 tabular-nums select-none">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>{indiaDate}</span>
                <span className="text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-wider ml-0.5">
                  IST
                </span>
              </div>
            )}

            {/* Accessible Theme Toggle */}
            <ThemeToggle />

            {/* User Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open user profile menu"
                    className="rounded-full size-8.5 press-scale"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                        {getInitials(user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="sr-only">User menu</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56 p-1 z-50">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2.5 py-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {user.displayName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">Focus Duo Profile</span>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer px-2.5 py-2 text-xs"
                >
                  <LogOut className="size-3.5 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto p-4 md:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Safe-area aware, thumb reachable, translucent glass) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border/80 glass-panel backdrop-blur-lg flex items-center justify-around px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 select-none"
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-xl transition-all press-scale min-w-[64px]",
                active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {active && (
                <motion.span
                  layoutId="mobile-active-pill"
                  className="absolute inset-0 rounded-xl bg-secondary/80 -z-0"
                  transition={activePillSpring}
                />
              )}
              <div className="relative z-10 p-1 rounded-lg">
                <Icon className="size-4.5" />
                {active && (
                  <span
                    className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
              </div>
              <span className="relative z-10 text-[10.5px] leading-none tracking-tight">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
