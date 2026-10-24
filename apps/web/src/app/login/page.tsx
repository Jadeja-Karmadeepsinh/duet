"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Timer,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

interface FieldErrors {
  displayName?: string;
  pin?: string;
  inviteCode?: string;
}

export default function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [showPin, setShowPin] = useState(false);
  const [showInviteCode, setShowInviteCode] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  const switchMode = (newMode: "signin" | "signup") => {
    if (newMode !== mode) {
      setMode(newMode);
      setGlobalError(null);
      setFieldErrors({});
      // Preserve displayName, reset sensitive credentials
      setPin("");
      setInviteCode("");
      setShowPin(false);
      setShowInviteCode(false);
    }
  };

  const validateFields = (): boolean => {
    const errors: FieldErrors = {};
    const trimmedName = displayName.trim();
    const trimmedPin = pin.trim();
    const trimmedInvite = inviteCode.trim();

    if (!trimmedName) {
      errors.displayName = "Display name is required.";
    } else if (trimmedName.length > 50) {
      errors.displayName = "Display name must be 50 characters or less.";
    }

    if (!trimmedPin) {
      errors.pin = "PIN is required.";
    } else if (mode === "signup" && trimmedPin.length < 4) {
      errors.pin = "PIN must be at least 4 digits.";
    } else if (trimmedPin.length > 16) {
      errors.pin = "PIN cannot exceed 16 digits.";
    }

    if (mode === "signup" && !trimmedInvite) {
      errors.inviteCode = "Team invite code is required to register.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    if (!validateFields()) {
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signin") {
        const res = await signIn(displayName.trim(), pin.trim());
        if (res.success) {
          router.replace("/dashboard");
          return;
        }
        setGlobalError(res.error || "Invalid display name or PIN. Please verify your credentials.");
        // Clear PIN on failed authentication for security
        setPin("");
      } else {
        const res = await signUp(displayName.trim(), pin.trim(), inviteCode.trim());
        if (res.success) {
          router.replace("/dashboard");
          return;
        }
        setGlobalError(res.error || "Failed to create profile. Please verify your invite code or name.");
        setPin("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex flex-col items-center justify-center p-6 select-none">
        <div className="size-11 rounded-2xl bg-secondary flex items-center justify-center shadow-xs animate-pulse">
          <Timer className="size-5.5 text-muted-foreground stroke-[2.2]" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-background flex flex-col justify-center items-center p-4 py-8 sm:py-12 select-none overflow-y-auto">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <ThemeToggle variant="outline" />
      </div>

      <div className="w-full max-w-[390px] mx-auto flex flex-col gap-5 sm:gap-6 my-auto">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs mb-1">
            <Timer className="size-6 stroke-[2.2]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
              Focus Duo
            </h1>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {mode === "signin"
                ? "Enter your credentials to access your daily focus workspace"
                : "Create a new team member profile with your shared invite code"}
            </p>
          </div>
        </div>

        {/* Auth Card */}
        <div className="bg-card rounded-2xl sm:rounded-3xl border border-border p-5 sm:p-7 shadow-xs space-y-5">
          {/* Segmented Control */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="p-1 bg-secondary/80 rounded-xl border border-border/50 flex items-center gap-1"
          >
            <button
              type="button"
              role="tab"
              id="tab-signin"
              aria-selected={mode === "signin"}
              aria-controls="panel-auth"
              disabled={submitting}
              onClick={() => switchMode("signin")}
              className={cn(
                "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                mode === "signin"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              id="tab-signup"
              aria-selected={mode === "signup"}
              aria-controls="panel-auth"
              disabled={submitting}
              onClick={() => switchMode("signup")}
              className={cn(
                "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                mode === "signup"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Create Profile
            </button>
          </div>

          {/* Global API Error Alert */}
          {globalError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-destructive/10 border border-destructive/25 flex items-start gap-2.5 text-destructive text-xs animate-in fade-in-50 duration-150"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{globalError}</span>
            </div>
          )}

          {/* Form */}
          <form
            id="panel-auth"
            role="tabpanel"
            aria-labelledby={mode === "signin" ? "tab-signin" : "tab-signup"}
            onSubmit={handleSubmit}
            noValidate
            className="space-y-3.5"
          >
            {/* Display Name Field */}
            <div className="space-y-1">
              <label
                htmlFor="displayName"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>
                  Display Name <strong className="text-destructive font-normal">*</strong>
                </span>
                <span className="text-[11px] font-normal text-muted-foreground font-mono">
                  {displayName.length}/50
                </span>
              </label>
              <Input
                id="displayName"
                name="displayName"
                type="text"
                autoComplete="username"
                required
                maxLength={50}
                placeholder="e.g. Karmadeep"
                value={displayName}
                disabled={submitting}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (fieldErrors.displayName) {
                    setFieldErrors((prev) => ({ ...prev, displayName: undefined }));
                  }
                }}
                className="h-10 text-sm rounded-xl"
                aria-invalid={!!fieldErrors.displayName}
                aria-describedby="displayName-msg"
              />
              <div id="displayName-msg" className="min-h-[16px] text-[11px] text-destructive flex items-center gap-1">
                {fieldErrors.displayName && (
                  <>
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{fieldErrors.displayName}</span>
                  </>
                )}
              </div>
            </div>

            {/* PIN Field */}
            <div className="space-y-1">
              <label
                htmlFor="pin"
                className="text-xs font-semibold text-foreground flex items-center justify-between"
              >
                <span>
                  {mode === "signin" ? "PIN Code" : "Choose 4-Digit PIN"}{" "}
                  <strong className="text-destructive font-normal">*</strong>
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Numeric digits
                </span>
              </label>
              <div className="relative">
                <Input
                  id="pin"
                  name="pin"
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={16}
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder={mode === "signup" ? "4–16 digit PIN" : "Enter PIN"}
                  value={pin}
                  disabled={submitting}
                  onChange={(e) => {
                    setPin(e.target.value);
                    if (fieldErrors.pin) {
                      setFieldErrors((prev) => ({ ...prev, pin: undefined }));
                    }
                  }}
                  className="h-10 text-sm rounded-xl font-mono tracking-widest pr-10"
                  aria-invalid={!!fieldErrors.pin}
                  aria-describedby="pin-msg"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={submitting}
                  onClick={() => setShowPin(!showPin)}
                  aria-label={showPin ? "Hide PIN" : "Show PIN"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors cursor-pointer"
                >
                  {showPin ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <div id="pin-msg" className="min-h-[16px] text-[11px] text-destructive flex items-center gap-1">
                {fieldErrors.pin && (
                  <>
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{fieldErrors.pin}</span>
                  </>
                )}
              </div>
            </div>

            {/* Team Invite Code (Create Profile only) */}
            {mode === "signup" && (
              <div className="space-y-1 animate-in fade-in-50 duration-200">
                <label
                  htmlFor="inviteCode"
                  className="text-xs font-semibold text-foreground flex items-center justify-between"
                >
                  <span>
                    Team Invite Code <strong className="text-destructive font-normal">*</strong>
                  </span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    Shared secret
                  </span>
                </label>
                <div className="relative">
                  <Input
                    id="inviteCode"
                    name="inviteCode"
                    type={showInviteCode ? "text" : "password"}
                    autoComplete="one-time-code"
                    required
                    placeholder="Enter team invite code"
                    value={inviteCode}
                    disabled={submitting}
                    onChange={(e) => {
                      setInviteCode(e.target.value);
                      if (fieldErrors.inviteCode) {
                        setFieldErrors((prev) => ({ ...prev, inviteCode: undefined }));
                      }
                    }}
                    className="h-10 text-sm rounded-xl pr-10"
                    aria-invalid={!!fieldErrors.inviteCode}
                    aria-describedby="inviteCode-msg"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={submitting}
                    onClick={() => setShowInviteCode(!showInviteCode)}
                    aria-label={showInviteCode ? "Hide invite code" : "Show invite code"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 transition-colors cursor-pointer"
                  >
                    {showInviteCode ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <div id="inviteCode-msg" className="min-h-[16px] text-[11px] flex items-center justify-between">
                  {fieldErrors.inviteCode ? (
                    <span className="text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3 shrink-0" />
                      {fieldErrors.inviteCode}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Access restricted to team members (up to 4 profiles).
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-10 text-sm font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-xs"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin shrink-0" />
                  <span>{mode === "signin" ? "Signing In..." : "Creating Profile..."}</span>
                </>
              ) : mode === "signin" ? (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="size-4" />
                </>
              ) : (
                <>
                  <span>Create Profile</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Footer Policy Note */}
        <p className="text-[11px] text-center text-muted-foreground leading-relaxed px-4">
          Focus Duo is a private team productivity tool. Authentication is secured by private sessions and personal PIN verification.
        </p>
      </div>
    </div>
  );
}
