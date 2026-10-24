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
        | Calls /api/:path* or /health  | Cookie / Response
        v                               |
+-------------------------------------------------------------+
| Next.js Server Rewrite / Proxy                              |
| Forwards /api/:path* -> API_PROXY_TARGET (localhost:8000)   |
| Forwards /health -> API_PROXY_TARGET/health                 |
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
- Browser interactions send requests to relative paths under `/api` or `/health`.
- Next.js acts as a reverse proxy via `next.config.ts` rewrites, forwarding requests to `API_PROXY_TARGET` (default `http://localhost:8000`).
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

---

## 3. Stage 1 Scaffold & Request Flow

### 3.1 Monorepo Layout
```
duet/
├── apps/
│   ├── api/                     # Express 5 + TypeScript server (port 8000)
│   │   ├── src/
│   │   │   ├── app.ts           # Express setup, middleware, /health, error handlers
│   │   │   ├── server.ts        # Startup listener
│   │   │   ├── config/env.ts    # Zod environment validation
│   │   │   ├── db/              # Neon database client & Drizzle schema
│   │   │   ├── routes/          # auth, tasks, work-sessions, stats
│   │   │   ├── services/        # timer.service.ts, stats.service.ts
│   │   │   ├── utils/timezone.ts# Asia/Kolkata timezone & calendar utilities
│   │   │   └── tests/           # Vitest integration & unit tests (73 tests)
│   │   ├── .env.example         # API server environment template
│   │   └── package.json
│   └── web/                     # Next.js 16 App Router (port 3000)
│       ├── src/
│       │   ├── app/             # App Router layout, globals.css, dashboard, analytics, leaderboard, login
│       │   ├── components/      # layout, timer, tasks, dashboard, ui
│       │   └── lib/utils.ts     # Styling utilities & Asia/Kolkata date formatters
│       ├── next.config.ts       # Same-origin proxy rewrites to Express (/api/*)
│       ├── .env.example         # Web environment template
│       └── package.json
├── docs/                        # Architecture, data model, API contract, design system
├── .env.example                 # Root workspace environment template
├── package.json                 # Monorepo root scripts (dev, dev:web, dev:api, build, test, etc.)
└── pnpm-workspace.yaml          # pnpm workspace definition (apps/*)
```

### 3.2 Dashboard UI Hierarchy (Stage 6)
1. **Header**: Time-aware greeting ("Good morning / afternoon / evening"), user's display name, today's date in `Asia/Kolkata` with `(IST)` badge, and flame streak indicator badge.
2. **Main Focus Timer Surface (`TimerCard`)**: One obvious timer surface with SVG circular progress ring, tabular numerals, mode label (Countdown / Stopwatch), planned vs remaining time, and controls (Start, Pause, Resume, Complete, Stop).
3. **Decision Dialog (`DecisionDialog`)**: Triggered upon countdown expiry (and restored from server `awaiting_decision` status), offering "Mark task completed", "Extend 15/30/60m", and "Stop without completing". Explains that paused/decision time is not counted.
4. **Add Task Dialog (`AddTaskDialog`)**: Accessible modal dialog with inline validation, presets (15m, 25m, 45m, 60m, custom), stopwatch mode, and category pills (`Coding`, `DSA`, `Learning`, `Project`, `Personal`, `Other`). Immediately selectable on creation.
5. **Task Queue (`RecentTasks`)**: Reusable focus tasks list with quick select and soft archive affordance.
6. **Daily Summary (`DailySummary`)**: Today's active focus time, completed tasks count, daily focus goal progress bar with persistent goal preference dialog, and current/best streaks.
7. **Contribution Graph (`ContributionGraph`)**: GitHub-style ~26-week calendar grid aligned to Sunday, intensity levels 0–4 based on completions, accessible tooltips, keyboard navigation, click-to-open `DayDetailDialog`, and genuine empty state.
8. **Leaderboard Preview (`LeaderboardPreview`)**: Displays latest snapshot checkpoint or provisional live status with link to full `/leaderboard`.

### 3.3 Request Flow
1. **Direct API Access (Development/Testing)**:
   - `GET http://localhost:8000/health` -> Express API returns JSON status directly.
2. **Same-Origin Client Access (Browser)**:
   - Browser on `http://localhost:3000` fetches relative path `/api/health`, `/health`, or `/api/v1/health`.
   - Next.js server inspects `next.config.ts` rewrites, resolves server-only `API_PROXY_TARGET` (`http://localhost:8000`), and proxies the HTTP request.
   - Express API returns JSON health payload.
   - Next.js streams the response back to browser with cookies intact.
