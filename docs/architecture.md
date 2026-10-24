# Architecture Documentation: Focus Tracker

## 1. System Overview

Focus Tracker is a high-craft personal and small-group (2–4 profiles) productivity application designed to track focused work sessions, task completions, streaks, and periodic leaderboards.

The application is structured as a lightweight monorepo managed by **pnpm workspaces**:
- **`apps/web`**: Next.js (App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui). Runs on port `3000` in development.
- **`apps/api`**: Express 5 application written in TypeScript. Runs on port `8000` in development.
- **Neon PostgreSQL**: Hosted serverless PostgreSQL accessed exclusively by `apps/api` via Drizzle ORM and Drizzle Kit migrations.

```
+-------------------------------------------------------------+
| Browser Client                                              |
| Next.js App Router (localhost:3000)                         |
+-------------------------------------------------------------+
        |                               ^
        | Calls /api/v1/* (Same-origin) | Cookie / Response
        v                               |
+-------------------------------------------------------------+
| Next.js Server Rewrite / Proxy                              |
| Forwards /api/v1/* -> API_PROXY_TARGET (localhost:8000)     |
+-------------------------------------------------------------+
        |                               ^
        | HTTP Request                  | Response + Set-Cookie
        v                               |
+-------------------------------------------------------------+
| Express 5 API Server (localhost:8000)                       |
| Authentication, Timer Engine, Analytics, Leaderboard Jobs  |
+-------------------------------------------------------------+
        |                               ^
        | Drizzle ORM queries           |
        v                               |
+-------------------------------------------------------------+
| Neon Hosted PostgreSQL                                      |
| Tables: profiles, sessions, tasks, work_sessions,           |
|         work_segments, task_completions, snapshots          |
+-------------------------------------------------------------+
```

---

## 2. Key Architecture Decisions

### 2.1 Database Access Isolation
- Neon PostgreSQL access is strictly confined to `apps/api`.
- `apps/web` never connects directly to PostgreSQL and `DATABASE_URL` is never exposed to browser or client bundles.

### 2.2 Same-Origin Reverse Proxy & Cookie Forwarding
- Browser interactions send requests to relative paths under `/api/v1`.
- Next.js acts as a reverse proxy, forwarding requests to `API_PROXY_TARGET` (default `http://localhost:8000`).
- This design completely eliminates cross-site third-party cookie blocking in production and staging while keeping authentication cookie attributes clean (`SameSite=Lax`, `HttpOnly`, `Path=/`, and `Secure` in production).

### 2.3 Strict Server-Side User Ownership
- All user-specific operations (tasks, timers, work segments, completions) determine the owner directly from the authenticated session cookie on the server.
- Client-supplied `userId` or `ownerId` parameters are never trusted or accepted for data modification.
- Privacy boundaries: The only data shared across profiles is aggregate leaderboard metrics (focus seconds, completion counts, display names). Task titles, descriptions, and private session timelines remain strictly private.

### 2.4 Authoritative Database Source of Truth
- Timers, active segments, completions, streaks, and analytics are calculated from persisted database state.
- React state and browser storage are strictly for rendering; timers survive browser refreshes and device switches without state drift.

### 2.5 Timezone Architecture (Asia/Kolkata)
- All database timestamps are stored in UTC using `timestamp with time zone` (`timestamptz`).
- Calendar day boundaries, daily totals, streaks, contribution matrices, and snapshot schedules are evaluated in `Asia/Kolkata` (UTC+05:30) at the service layer.
- If a work segment spans midnight in `Asia/Kolkata`, the service layer splits the duration across the midnight boundary into respective calendar days for accurate daily analytics.

### 2.6 Centralized Services
To guarantee calculation consistency across the dashboard, analytics, and leaderboard, the architecture enforces:
1. **Timer Engine**: Exactly one state machine managing transitions (`running`, `paused`, `awaiting_decision`, `completed`, `stopped`).
2. **Time Aggregation Service**: Exactly one engine splitting work segments by date and calculating active duration.
3. **Streak Service**: Exactly one engine enforcing the India calendar day rules (including active grace period when today has no completions yet but yesterday did).

### 2.7 Leaderboard & Checkpoint Architecture
- Daily snapshots are captured at scheduled checkpoints: `10:00`, `18:00`, and `22:00` Asia/Kolkata.
- Snapshot records are keyed uniquely by `(snapshot_date, slot, profile_id)` to guarantee idempotency.
- Rolling 7-day metrics are computed directly from raw historical active work segments and completions, never by summing checkpoint snapshots.
- A protected endpoint (`/api/v1/jobs/leaderboard-snapshot`) allows triggering via external schedulers (e.g. cron-job.org, Cloudflare Cron Triggers, GitHub Actions) for serverless or sleeping deployments.
