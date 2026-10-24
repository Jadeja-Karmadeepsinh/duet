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

### 3.4 Analytics Engine & Architecture (Stage 7)
1. **Scope & Ranges**:
   - `7d`: Trailing 7 calendar days inclusive of today (`today - 6` through `today`).
   - `30d`: Trailing 30 calendar days inclusive of today (`today - 29` through `today`).
   - `90d`: Trailing 90 calendar days inclusive of today (`today - 89` through `today`).
   - `1y`: Trailing 365 India calendar days inclusive of today (`today - 364` through `today`).
   - `lifetime`: Earliest qualifying activity date (first session or completion) through today; if no activity, defaults to today.
2. **Boundary Derivation & Server Integrity**:
   - All range boundaries are computed strictly on the backend in `Asia/Kolkata` time; arbitrary date strings from the browser are never trusted.
   - Exact inclusive dates are returned and labeled in the UI (`YYYY-MM-DD → YYYY-MM-DD (IST)`).
3. **Midnight Segment Splitting**:
   - Focus time is derived exclusively from active work segments (`work_session_segments`), splitting across `Asia/Kolkata` midnight boundaries.
   - Open active segments include duration through `now`.
   - Pauses and decision windows are excluded.
4. **Task Completion Counting**:
   - Task counts are counted strictly from `task_completions.completed_at`, never from session starts or `tasks` rows.
5. **Averages & Baselines**:
   - Daily calendar average: `totalFocusSeconds / calendarDaysCount`.
   - Active day average: `totalFocusSeconds / activeDaysCount` (days with $\ge 1$ task completion OR focus time > 0).
   - Lifetime daily average: based on calendar days from first activity through today.
   - Prior-period comparison: Computed strictly against the immediate preceding period of equal length. If prior baseline is 0, percentage change returns `null` (never fabricated).
6. **Analytics UI Components**:
   - `RangeSelector`: Segmented pill controls for 7d, 30d, 90d, 1y, lifetime with exact IST date range.
   - `AnalyticsSummaryCards`: 3 editorial cards (Focus Time & Pace, Output & Consistency, Records & Highlights).
   - `FocusTimeChart`: Recharts BarChart with Apple system blue accent (`#0071e3`), responsive container, custom tooltip, empty state.
   - `CompletionsChart`: Recharts BarChart with emerald accent (`#10b981`), responsive container, custom tooltip, empty state.
   - `CategoryDistributionChart`: Donut chart + progress meters with Apple palette, including "Uncategorized".
   - `RecentSessions`: Chronological log of recent completed sessions.

### 3.5 Leaderboard, Snapshot Engine & Scheduling (Stage 8)
1. **Checkpoint Schedule**:
   - Three official checkpoints daily: `10:00`, `18:00`, and `22:00` in the `Asia/Kolkata` timezone (IST).
   - In-process scheduler: Runs via `cron` in `apps/api/src/services/scheduler.service.ts` configured explicitly with `timeZone: 'Asia/Kolkata'`.
   - Sleeping / Serverless deployments: Note that in-process cron only runs while the API process is alive. For platforms that sleep or scale to zero, an external HTTP scheduler (e.g., cron-job.org, Cloudflare Workers, GitHub Actions) must trigger `POST /api/v1/jobs/leaderboard-snapshot` with the `CRON_SECRET`.
2. **Missing Slot Recovery & Startup Catchup**:
   - On server startup and on a periodic 15-minute background check, the scheduler detects any due slots that have not yet been captured for today or yesterday.
   - Missing slots are processed idempotently. Both `scheduledFor` and actual `capturedAt` are preserved. If captured > 15 minutes past scheduled time, `isDelayed` is set to `true` (timestamps are never backdated).
3. **Idempotency & Concurrency**:
   - Guaranteed by database unique index `idx_leaderboard_runs_date_slot` on `(localDate, slot)` in `leaderboard_snapshot_runs`.
   - Concurrent snapshot triggers safely return the existing or winning run.
4. **Metrics per User per Checkpoint**:
   - `focusSecondsToday`: Active continuous work segments within today's IST boundaries up to capture time.
   - `completedTasksToday`: Completed tasks within today's IST boundaries up to capture time.
   - `focusSecondsLast7Days`: Active focus duration across rolling 7 India calendar days (`today - 6` through `today`).
   - `completedTasksLast7Days`: Completed tasks across rolling 7 India calendar days.
   - `displayNameSnapshot`: Snapshot of user's display name at capture time.
5. **Ranking Rules & Privacy**:
   - Primary sort: `focusSeconds` descending.
   - Secondary tie-break: `completedTasks` descending.
   - Tertiary tie-break: `displayName` ascending.
   - Returns up to 4 configured active profiles.
   - Privacy guarantee: No task titles, descriptions, categories, or private timelines are ever exposed.
6. **Provisional Live Board**:
   - Before today's first snapshot (10:00 AM IST) or when no snapshots exist yet today, `/leaderboard` computes and displays a live provisional tally clearly labeled with `isProvisional: true` and the next scheduled slot.
7. **Safe Local CLI**:
   - Developers can trigger manual snapshots locally using `pnpm snapshot` (or `pnpm --filter api snapshot --date=YYYY-MM-DD --slot=10:00`) without exposing the secret over HTTP.


