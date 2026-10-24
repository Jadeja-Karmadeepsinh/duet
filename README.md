# Focus Tracker

Focus Tracker is an internal, high-craft personal and small-group productivity tool designed for 2–4 people. It tracks focused work sessions (countdown and stopwatch modes), reusable task templates, daily streaks, calendar-accurate contribution graphs, deep analytics, and periodic snapshots on the team leaderboard.

## Key Architecture Principles

1. **Strict Backend Separation**: Neon PostgreSQL and Drizzle ORM are exclusively accessed by `apps/api` (Express 5). Next.js never connects directly to the database.
2. **Same-Origin Reverse Proxy**: Next.js App Router on port `3000` proxies `/api/v1/*` to the Express backend on port `8000` using `API_PROXY_TARGET`. This ensures clean, secure `HttpOnly` session cookie forwarding without cross-site cookie restrictions.
3. **Database as Single Source of Truth**: Timers, work segments, completions, and streaks are recorded in the database. Timers survive browser restarts and device switches without relying on volatile client intervals.
4. **Asia/Kolkata Timezone Standard**: All timestamps are stored in UTC (`timestamptz`). Daily boundaries, streaks, contribution matrices, and leaderboard snapshots (at 10:00, 18:00, and 22:00) are resolved in `Asia/Kolkata` (UTC+05:30).

---

## Workspace Structure

```
├── apps
│   ├── api          # Express 5 API, Drizzle ORM, timer engine, jobs, Vitest tests
│   └── web          # Next.js App Router frontend, Tailwind CSS, shadcn/ui
├── docs
│   ├── architecture.md    # System design and core decisions
│   ├── data-model.md      # Drizzle PostgreSQL schema specifications
│   ├── api-contract.md    # Request / response specifications
│   └── design-system.md   # Apple Design & shadcn tokens and motion rules
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## Quickstart

### Prerequisites
- Node.js >= 20 (tested on Node.js 24)
- pnpm >= 9

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and provide your Neon PostgreSQL `DATABASE_URL`:
```bash
cp .env.example .env
```

### 3. Run Database Migrations
```bash
pnpm --filter api db:migrate
```

### 4. Start Development Servers
Run both frontend (`localhost:3000`) and backend (`localhost:8000`):
```bash
pnpm dev
```

### 5. Run Quality Checks & Tests
```bash
pnpm typecheck
pnpm test
```

### 6. Leaderboard Snapshots & Scheduling

Snapshots freeze team standings daily at **10:00**, **18:00**, and **22:00** in `Asia/Kolkata` (UTC+05:30).

- **In-Process Scheduler**: When running an always-on Express API process (`pnpm dev` or production Node process), `cron` schedules checkpoints and performs startup/periodic missed-slot catchups automatically.
- **Scaling to Zero / Serverless Sleep**: In-process cron only executes while the Express process is actively awake and running. If deploying to platforms that sleep or scale to zero (e.g. Render free tier, Fly machine sleep, Cloud Run), configure an external cron service (such as GitHub Actions, Upstash QStash, or Cloud Scheduler) to trigger the protected HTTP endpoint:
  ```http
  POST /api/v1/jobs/leaderboard-snapshot
  Headers:
    Authorization: Bearer <CRON_SECRET>
    # or
    x-cron-secret: <CRON_SECRET>
  ```
  The endpoint verifies `CRON_SECRET` using constant-time comparison (`crypto.timingSafeEqual`) and idempotently captures any due or missing snapshot slots.
- **Manual Local Development CLI**: Run snapshots on demand without exposing secrets or public routes:
  ```bash
  pnpm snapshot
  # or
  pnpm --filter api snapshot
  ```
