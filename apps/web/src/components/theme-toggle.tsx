"use client";

import React, { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: "outline" | "ghost";
}

export function ThemeToggle({
  className,
  showLabel = false,
  variant = "ghost",
}: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted ? (resolvedTheme || theme) === "dark" : false;

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const currentLabel = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant={variant}
            size={showLabel ? "sm" : "icon-sm"}
            onClick={toggleTheme}
            aria-label={currentLabel}
            className={cn(
              "rounded-xl press-scale transition-colors select-none",
              showLabel ? "gap-2 px-3 text-xs" : "size-8.5",
              className
            )}
          >
            {mounted ? (
              isDark ? (
                <Moon className="size-4 text-primary transition-transform duration-200 rotate-0" />
              ) : (
                <Sun className="size-4 text-amber-500 transition-transform duration-200 rotate-0" />
              )
            ) : (
              <span className="size-4 block" aria-hidden="true" />
            )}
            {showLabel && (
              <span className="text-xs font-medium">
                {mounted ? (isDark ? "Dark" : "Light") : "Theme"}
              </span>
            )}
            <span className="sr-only">{currentLabel}</span>
          </Button>
        }
      />
      <TooltipContent side="bottom" className="text-xs">
        {mounted ? (isDark ? "Switch to Light mode" : "Switch to Dark mode") : "Toggle theme"}
      </TooltipContent>
    </Tooltip>
  );
}
