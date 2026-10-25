# Focus Duo

Focus Duo is an internal, high-craft personal and small-group productivity tool designed for 2–4 people. It tracks focused work sessions (countdown and stopwatch modes), reusable task templates, daily streaks, calendar-accurate contribution graphs, deep analytics, and periodic checkpoints on the team leaderboard.

---

## Architecture Principles

1. **Strict Backend Separation**: Neon PostgreSQL and Drizzle ORM are exclusively accessed by `apps/api` (Express 5). Next.js never connects directly to the database.
2. **Same-Origin Reverse Proxy**: Next.js App Router proxies `/api/v1/*` to the Express backend using `API_PROXY_TARGET`. This ensures clean, secure `HttpOnly` session cookie forwarding without cross-site cookie restrictions.
3. **Database as Single Source of Truth**: Timers, work segments, completions, and streaks are recorded in the database. Timers survive browser restarts and device switches without relying on volatile client intervals.
4. **Asia/Kolkata Timezone Standard**: All timestamps are stored in UTC (`timestamptz`). Daily boundaries, streaks, contribution matrices, and leaderboard checkpoints (at 10:00, 18:00, and 22:00) are resolved in `Asia/Kolkata` (UTC+05:30).

---

## Workspace Structure

```
├── apps
│   ├── api          # Express 5 API, Drizzle ORM, timer engine, jobs, Vitest tests
│   └── web          # Next.js App Router frontend, Tailwind CSS, shadcn/ui
├── docs
│   ├── deployment.md      # Step-by-step production hosting, env vars & verification
│   ├── architecture.md    # System design and core decisions
│   ├── data-model.md      # Drizzle PostgreSQL schema specifications
│   ├── api-contract.md    # Request / response specifications
│   └── design-system.md   # Apple Design & shadcn tokens and motion rules
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## Quickstart: Step-by-Step Setup (For Developers & Non-Coders)

Follow these steps sequentially to run Focus Duo locally:

### Prerequisites
- Install **Node.js** (v20 or v22+ recommended): [nodejs.org](https://nodejs.org)
- Install **pnpm** (v9+): Run `npm install -g pnpm` in your terminal.

---

### Step 1: Install Project Dependencies
Open your terminal in the project directory and run:

```bash
pnpm install
```

---

### Step 2: Configure Environment Variables
Copy the template file `.env.example` to create your local `.env` file:

- **macOS / Linux**:
  ```bash
  cp .env.example .env
  ```
- **Windows (PowerShell)**:
  ```powershell
  Copy-Item .env.example .env
  ```

Open `.env` in any text editor and paste your Neon PostgreSQL connection string into `DATABASE_URL`:
```ini
DATABASE_URL="postgresql://username:password@ep-sample-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```
*(Optionally set `DATABASE_URL_UNPOOLED` if you have a direct non-pooled Neon connection string for migrations).*

---

### Step 3: Run Database Migrations
Run this command once to set up the database schema and tables in Neon:

```bash
pnpm db:migrate
```

---

### Step 4: Start the Development Server
Launch both the frontend and backend servers together:

```bash
pnpm dev
```

Once running:
- **Frontend App**: Open your browser at [http://localhost:3000](http://localhost:3000)
- **API Health Check**: Verify backend connectivity at [http://localhost:8000/health](http://localhost:8000/health)

---

### Step 5: Run Automated Tests & Quality Checks
To verify that all components, database routines, and layout calculations are working:

```bash
# Run unit and integration test suite
pnpm test

# Verify TypeScript types
pnpm typecheck

# Check code formatting & linting
pnpm lint
```

---

## Leaderboard Checkpoints & Scheduling

Leaderboard checkpoints freeze team standings daily at **10:00 AM**, **6:00 PM**, and **10:00 PM** in `Asia/Kolkata` (UTC+05:30).

- **In-Process Scheduler**: When running the API server locally (`pnpm dev`) or on a persistent production host, the built-in scheduler automatically executes checkpoints and catches up on any missed slots on startup.
- **External Cron Trigger**: If deployed on a host that sleeps (e.g. Render free tier), trigger the protected HTTP endpoint via an external cron service (such as [cron-job.org](https://cron-job.org)):
  ```bash
  curl -X POST https://your-domain.com/api/v1/jobs/due-snapshots \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```
  *(Query string tokens like `?secret=...` are strictly rejected with HTTP 403 to prevent token leakage in access logs).*
- **Manual CLI Command**: Trigger a checkpoint immediately from your terminal:
  ```bash
  pnpm snapshot
  ```

---

## Production Deployment

For complete, step-by-step instructions for deploying to **Neon (Database)**, **Render (Express API)**, and **Vercel (Next.js Frontend)**, see the dedicated deployment guide:

👉 **[Read the Full Deployment Guide (docs/deployment.md)](docs/deployment.md)**

### Key Deployment Summary:
- **Database (Neon)**: Set up `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct).
- **API Service (Render)**:
  - Root: Blank (repository root)
  - Build Command: `pnpm install --frozen-lockfile && pnpm --filter api build`
  - Start Command: `node apps/api/dist/server.js`
  - Pre-Deploy Command: `node apps/api/dist/db/migrate.js`
- **Web App (Vercel)**:
  - Framework: `Next.js`
  - Root Directory: `apps/web` (Include files outside root: Enabled)
  - Environment Variable: `API_PROXY_TARGET=https://focus-duo-api.onrender.com`

---

## Environment Variables Reference

| Variable | Target | Scope | Description |
|---|---|---|---|
| `DATABASE_URL` | API Server | Server-only | Pooled Neon PostgreSQL connection string (with SSL) |
| `DATABASE_URL_UNPOOLED` | API (Migrations) | Server-only | Direct unpooled Neon connection string for schema migrations |
| `PORT` | API Server | Server-only | Port for Express API (default: `8000`) |
| `NODE_ENV` | API & Web | Server-only | Environment mode (`development` or `production`) |
| `SESSION_SECRET` | API Server | Server-only | 32-byte secret for session token hashing (Required in production) |
| `APP_INVITE_CODE` | API Server | Server-only | Team invite code required for registering new profiles (max 4 profiles) |
| `CRON_SECRET` | API Server | Server-only | Secret token protecting automated checkpoint trigger endpoints |
| `CLIENT_ORIGIN` | API Server | Server-only | Allowed CORS origin (e.g., `https://focusduo.vercel.app`) |
| `API_PROXY_TARGET` | Next.js Web | Server-only | Target URL for Next.js same-origin `/api/*` reverse proxy rewrites |

> [!IMPORTANT]
> None of the server variables are prefixed with `NEXT_PUBLIC_`. Secrets are strictly kept out of client bundles.

---

## Invariants & Guardrails

1. **Maximum Profile Limit**: By application design, at most 4 active user profiles can exist simultaneously. This matches the target small-group focus team model.
2. **Single Active Timer Rule**: A user profile may have at most one timer running across all browser tabs or devices. Attempting to start a second timer returns an HTTP 409 conflict and prevents race conditions via a partial unique index on PostgreSQL (`idx_work_sessions_single_running`).
3. **No Retroactive Backdating**: Leaderboard snapshots preserve both `scheduledFor` and actual `capturedAt`. If a snapshot was delayed due to process downtime, `isDelayed: true` is permanently recorded and visible in the audit history.
4. **Calendar Standard**: Daily midnight boundaries, streaks, and rolling analytics are resolved strictly in `Asia/Kolkata` (UTC+05:30). Work sessions spanning across midnight are split at `00:00:00 IST` into their respective calendar days so that metrics remain mathematically consistent across the Dashboard, Analytics, and Leaderboard.
