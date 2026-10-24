"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Timer, ArrowRight, Lock, User, KeyRound, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!displayName.trim()) {
      setError("Please enter your display name.");
      return;
    }
    if (!pin.trim() || pin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    if (mode === "signup" && !inviteCode.trim()) {
      setError("Team invite code is required to create a profile.");
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
        setError(res.error || "Invalid display name or PIN.");
      } else {
        const res = await signUp(displayName.trim(), pin.trim(), inviteCode.trim());
        if (res.success) {
          router.replace("/dashboard");
          return;
        }
        setError(res.error || "Failed to create profile.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="size-10 rounded-2xl bg-secondary flex items-center justify-center animate-pulse">
          <Timer className="size-5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-[380px] flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
            <Timer className="size-6 stroke-[2.2]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Focus Tracker</h1>
            <p className="text-xs text-muted-foreground">
              {mode === "signin" ? "Sign in to your productivity profile" : "Create a new team member profile"}
            </p>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col gap-5">
          {/* Segmented Control */}
          <div className="p-1 bg-secondary rounded-xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
              className={cn(
                "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all press-scale",
                mode === "signin"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
              }}
              className={cn(
                "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all press-scale",
                mode === "signup"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign Up
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2.5 text-destructive text-xs animate-in fade-in-50 duration-150">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Display Name */}
            <div className="space-y-1.5">
              <label htmlFor="displayName" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <User className="size-3.5 text-muted-foreground" />
                <span>Display Name</span>
              </label>
              <Input
                id="displayName"
                type="text"
                autoComplete="username"
                required
                placeholder="e.g. Alice"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {/* PIN */}
            <div className="space-y-1.5">
              <label htmlFor="pin" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-muted-foreground" />
                <span>PIN Code</span>
              </label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                placeholder="4-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="h-9 text-sm font-mono tracking-widest"
              />
            </div>

            {/* Invite Code (Sign Up Only) */}
            {mode === "signup" && (
              <div className="space-y-1.5 animate-in fade-in-50 duration-150">
                <label htmlFor="inviteCode" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Lock className="size-3.5 text-muted-foreground" />
                  <span>Team Invite Code</span>
                </label>
                <Input
                  id="inviteCode"
                  type="password"
                  required
                  placeholder="Shared team invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="h-9 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Private team access (up to 4 active profiles).</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 h-9 text-sm font-medium press-scale"
            >
              {submitting ? (
                <span>Please wait...</span>
              ) : mode === "signin" ? (
                <span className="flex items-center gap-1.5">
                  Sign In
                  <ArrowRight className="size-4" />
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  Create Profile
                  <ArrowRight className="size-4" />
                </span>
              )}
            </Button>
          </form>
        </div>

        {/* Footer Note */}
        <p className="text-[11px] text-center text-muted-foreground">
          Protected personal & small-team productivity application.
        </p>
      </div>
    </div>
  );
}
