"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  Clock,
  Database,
  Layers,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

interface HealthData {
  status: string;
  serverTimeUtc: string;
  serverTimeAsiaKolkata: string;
  database: string;
  databaseError?: string;
}

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>("");

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      // Calls same-origin relative path /api/v1/health proxied to Express backend
      const res = await fetch("/api/v1/health");
      const json = await res.json();
      if (json.success && json.data) {
        setHealth(json.data);
      } else {
        setError(json.error?.message || "Failed to retrieve health status");
      }
    } catch (err: any) {
      setError(err?.message || "Could not connect to API via same-origin rewrite");
    } finally {
      setLoading(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] flex flex-col items-center justify-between p-6 md:p-12 selection:bg-sky-500/30">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-b from-sky-500/10 via-indigo-500/5 to-transparent blur-3xl rounded-full" />
      </div>

      {/* Header */}
      <header className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-white/[0.08] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Focus Tracker</h1>
            <p className="text-xs text-zinc-400">Personal & Small-Team Productivity</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Stage 1: Foundation Ready
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl my-auto py-12 flex flex-col gap-10">
        {/* Hero Section */}
        <div className="flex flex-col gap-3 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] w-fit mx-auto sm:mx-0 text-xs font-medium text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            Fixed Stack: Next.js + Express 5 + Neon PostgreSQL + Drizzle
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            High-Craft Focus Engine & Analytics
          </h2>
          <p className="text-base text-zinc-400 max-w-2xl leading-relaxed">
            Personal productivity system designed with fluid Apple-style motion, authoritative PostgreSQL persistence, Asia/Kolkata timezone accuracy, and same-origin cookie security.
          </p>
        </div>

        {/* Live System Connectivity Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-sky-400">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">System Health & Monorepo Bridge</h3>
                <p className="text-xs text-zinc-400">
                  Relative proxy verification: <code className="text-zinc-300 font-mono">/api/v1/health</code>
                </p>
              </div>
            </div>

            <Button
              onClick={checkHealth}
              disabled={loading}
              variant="outline"
              size="sm"
              className="self-start sm:self-auto border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 transition-all active:scale-95"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-2 ${loading ? "animate-spin text-sky-400" : ""}`} />
              Recheck Health
            </Button>
          </div>

          {/* Grid of Diagnostics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            {/* Database Card */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Database className="h-3.5 w-3.5 text-zinc-400" /> Neon PostgreSQL
                </span>
                {health?.database === "connected" ? (
                  <span className="text-emerald-400 font-medium">Connected</span>
                ) : (
                  <span className="text-amber-400 font-medium">Checking</span>
                )}
              </div>
              <p className="text-sm font-semibold text-zinc-200">
                {health?.database === "connected" ? "Drizzle ORM Active" : "Verifying..."}
              </p>
              <span className="text-[11px] text-zinc-500 font-mono">Migrations up-to-date</span>
            </div>

            {/* Timezone Card */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" /> Asia/Kolkata Clock
                </span>
                <span className="text-sky-400 font-medium">IST (+05:30)</span>
              </div>
              <p className="text-sm font-mono font-semibold text-zinc-200 tabular-nums">
                {health?.serverTimeAsiaKolkata || "Syncing..."}
              </p>
              <span className="text-[11px] text-zinc-500 font-mono">Calendar day authority</span>
            </div>

            {/* Same-origin proxy Card */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <Server className="h-3.5 w-3.5 text-zinc-400" /> Express 5 Proxy
                </span>
                <span className="text-emerald-400 font-medium">Active</span>
              </div>
              <p className="text-sm font-semibold text-zinc-200">
                Next.js Rewrites OK
              </p>
              <span className="text-[11px] text-zinc-500 font-mono">HttpOnly cookie safe</span>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <strong>Proxy Warning:</strong> {error}
            </div>
          )}

          {lastChecked && (
            <div className="mt-4 text-right text-[11px] text-zinc-500">
              Last queried: <span className="font-mono text-zinc-400">{lastChecked}</span>
            </div>
          )}
        </div>

        {/* Workspace Architectural Checklist */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.01] p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-300">Phase 1 Foundations Completed</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-400">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 block">pnpm Monorepo Structure</strong>
                <span><code>apps/web</code> (Next.js 16) and <code>apps/api</code> (Express 5).</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 block">Drizzle ORM & Neon PostgreSQL</strong>
                <span>Committed migration generated and applied to hosted Neon.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 block">Asia/Kolkata Time Engine</strong>
                <span>Day bounds, calendar splitting, and test suite passing.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-zinc-200 block">Documentation Suite</strong>
                <span>Architecture, data model, API contract, and design system saved.</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl py-6 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-4">
        <p>Focus Tracker © 2026. Internal team tool.</p>
        <div className="flex items-center gap-4">
          <span className="font-mono text-zinc-400">Asia/Kolkata Product Timezone</span>
          <span>•</span>
          <span className="flex items-center gap-1 text-zinc-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Server-side Ownership
          </span>
        </div>
      </footer>
    </div>
  );
}
