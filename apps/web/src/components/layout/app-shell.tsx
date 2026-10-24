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
  Menu,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { ThemeToggle } from "@/components/theme-toggle";

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
  const [mobileOpen, setMobileOpen] = useState(false);
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
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Desktop Navigation Rail / Sidebar (240px) */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-sidebar shrink-0 justify-between select-none">
        {/* Top brand header */}
        <div className="flex flex-col">
          <div className="h-14 flex items-center px-5 gap-2.5 border-b border-border/60">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Timer className="size-4.5 stroke-[2.2]" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[15px] tracking-tight">Focus</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                Duo
              </span>
            </div>
          </div>

          {/* Navigation links */}
          <nav className="p-3 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors press-scale",
                    active
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom profile & signout rail */}
        <div className="p-3 border-t border-border/60 flex flex-col gap-2">
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-secondary/30">
            <span className="text-xs text-muted-foreground font-medium">Appearance</span>
            <ThemeToggle variant="ghost" />
          </div>
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-secondary/50">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                {getInitials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-medium text-foreground truncate">{user.displayName}</span>
              <span className="text-[10px] text-muted-foreground truncate">Active Profile</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => signOut()}
              title="Sign Out"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-3.5" />
              <span className="sr-only">Sign out</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30 px-4 md:px-8 flex items-center justify-between select-none">
          {/* Left: Mobile trigger & Page Title */}
          <div className="flex items-center gap-3">
            {/* Mobile Sheet Menu */}
            <div className="md:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger
                  render={
                    <Button variant="ghost" size="icon" className="size-9">
                      <Menu className="size-5" />
                      <span className="sr-only">Open navigation menu</span>
                    </Button>
                  }
                />
                <SheetContent side="left" className="w-64 p-0 flex flex-col justify-between">
                  <div>
                    <SheetHeader className="p-4 border-b border-border text-left">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <Timer className="size-4" />
                        </div>
                        <SheetTitle className="text-base font-semibold">Focus Duo</SheetTitle>
                      </div>
                    </SheetHeader>
                    <nav className="p-3 flex flex-col gap-1">
                      {NAV_ITEMS.map((item) => {
                        const active = pathname === item.href;
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                              active
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                            )}
                          >
                            <Icon className="size-4" />
                            <span>{item.name}</span>
                          </Link>
                        );
                      })}
                    </nav>
                  </div>
                  <div className="p-4 border-t border-border flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground font-medium">Appearance</span>
                      <ThemeToggle variant="ghost" />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8">
                          <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                            {getInitials(user.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium truncate max-w-[110px]">{user.displayName}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => signOut()} className="text-xs text-destructive">
                        Sign Out
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div>
              <h1 className="text-sm md:text-[15px] font-semibold tracking-tight text-foreground">{title}</h1>
              {subtitle && <p className="text-[11px] text-muted-foreground hidden sm:block">{subtitle}</p>}
            </div>
          </div>

          {/* Right: India Local Date, Theme Toggle, & Profile Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3">
            {indiaDate && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 px-2.5 py-1 rounded-full border border-border/50 tabular-nums">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>{indiaDate}</span>
                <span className="text-[10px] font-semibold text-muted-foreground/75 uppercase tracking-wider ml-0.5">IST</span>
              </div>
            )}

            {/* Mobile & Topbar Theme Toggle */}
            <ThemeToggle />

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="rounded-full size-8.5 press-scale">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                        {getInitials(user.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="sr-only">User menu</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56 p-1">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2.5 py-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground">{user.displayName}</span>
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

        {/* Main Content Body (Max width 1280px with generous margins) */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto p-4 md:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Thumb reach for mobile screens) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-background/90 backdrop-blur-lg border-t border-border z-30 flex items-center justify-around px-2 select-none">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1 px-4 rounded-lg text-[10px] font-medium transition-colors",
                active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("size-4.5", active ? "text-primary" : "text-muted-foreground")} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
