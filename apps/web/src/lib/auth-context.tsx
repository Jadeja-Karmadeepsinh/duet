"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface UserProfile {
  id: string;
  displayName: string;
  normalizedName: string;
  createdAt: string;
  isActive: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  signIn: (displayName: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (displayName: string, pin: string, inviteCode: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me", {
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.user) {
          setUser(json.data.user);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/v1/auth/me", {
          headers: { "Cache-Control": "no-cache" },
        });
        if (!ignore) {
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data?.user) {
              setUser(json.data.user);
              return;
            }
          }
          setUser(null);
        }
      } catch {
        if (!ignore) setUser(null);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchUser();
    return () => {
      ignore = true;
    };
  }, []);

  const signIn = async (displayName: string, pin: string) => {
    try {
      const res = await fetch("/api/v1/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, pin }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUser(json.data.user);
        return { success: true };
      }
      return { success: false, error: json.error?.message || "Invalid name or PIN" };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  };

  const signUp = async (displayName: string, pin: string, inviteCode: string) => {
    try {
      const res = await fetch("/api/v1/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, pin, inviteCode }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setUser(json.data.user);
        return { success: true };
      }
      return { success: false, error: json.error?.message || "Failed to create profile" };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Connection failed" };
    }
  };

  const signOut = async () => {
    try {
      await fetch("/api/v1/auth/signout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
