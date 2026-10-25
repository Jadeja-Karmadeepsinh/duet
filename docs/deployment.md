# Focus Duo: Production Deployment Guide & Handoff Specification

This document provides a step-by-step production deployment guide for Focus Duo. It outlines the architecture, dashboard configurations, build commands, environment variables, migration procedures, scheduler setups, and post-deploy verification steps.

---

## 1. Production Architecture Overview

```
                                  ┌──────────────────────────────────────────────┐
                                  │                  CLIENT BROWSER              │
                                  └───────────────────────┬──────────────────────┘
                                                          │
                                     HTTPS Requests       │
                                     (Same-Origin Cookie) │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ NEXT.JS WEB APP (Vercel)                                                                        │
│ • Root: apps/web                                                                                │
│ • Static & Server-Rendered UI routes: /dashboard, /analytics, /leaderboard, /login              │
│ • Server-Only Reverse Proxy (next.config.ts rewrites):                                          │
│     /api/:path*  ──►  $API_PROXY_TARGET/api/:path*                                              │
│     /health      ──►  $API_PROXY_TARGET/health                                                  │
└────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │
                    Proxied HTTP Requests│ (Forwards HttpOnly focus_session cookie)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ EXPRESS API SERVICE (Render / Railway / Persistent Container)                                   │
│ • Root: Repository root (monorepo)                                                              │
│ • Trust Proxy: app.set('trust proxy', 1) enabled                                                │
│ • Cookie: Set-Cookie: focus_session=...; Path=/; HttpOnly; SameSite=Lax; Secure                 │
│ • Scheduler: In-process cron at 10:00, 18:00, 22:00 IST (UTC+05:30)                             │
│ • External Cron Hook: POST/GET /api/v1/jobs/due-snapshots (Protected via CRON_SECRET)          │
│ • Graceful Shutdown: SIGTERM/SIGINT drains HTTP server & PostgreSQL connection pool             │
└────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                         │
                    PostgreSQL Connection│ (SSL Required)
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ NEON POSTGRESQL DATABASE                                                                        │
│ • Pooled URL ($DATABASE_URL): Runtime queries & ACID transactions via PgBouncer                 │
│ • Direct URL ($DATABASE_URL_UNPOOLED): Schema migrations via drizzle-kit migrate                │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Environment Variables Specification

All variables below are **strictly server-only**. None are prefixed with `NEXT_PUBLIC_`, ensuring database connection strings and secret tokens are never bundled into client JavaScript.

| Variable Name | Required By | Scope | Secret? | Purpose & Description | Sample Placeholder |
|---|---|---|---|---|---|
| `DATABASE_URL` | API | Server-only | **YES** | Pooled Neon PostgreSQL connection string (PgBouncer) for runtime queries and sessions. | `postgresql://user:pass@ep-xyz-pooler.region.aws.neon.tech/neondb?sslmode=require` |
| `DATABASE_URL_UNPOOLED` | API (Migrations) | Server-only | **YES** | Direct, unpooled Neon connection string without PgBouncer. Required for DDL schema migrations (`drizzle-kit migrate`). | `postgresql://user:pass@ep-xyz.region.aws.neon.tech/neondb?sslmode=require` |
| `PORT` | API | Server-only | No | TCP port the Express server listens on. (Render/Railway inject this dynamically). | `8000` |
| `NODE_ENV` | API & Web | Server-only | No | Must be set to `production` on live environments to enforce the cookie `Secure` flag and strict session secret length. | `production` |
| `SESSION_SECRET` | API | Server-only | **YES** | Cryptographic key for session token hashes. In production, must be at least 32 random characters. | Generate via `openssl rand -hex 32` |
| `APP_INVITE_CODE` | API | Server-only | **YES** | Shared team invite code required for registering new profiles (max 4 profiles). Supported also via alias `INVITE_CODE`. | `duo-team-invite-2026` |
| `CRON_SECRET` | API | Server-only | **YES** | Shared secret token protecting `/api/v1/jobs/*` endpoints. Supported also via alias `JOB_SECRET`. | Generate via `openssl rand -hex 32` |
| `CLIENT_ORIGIN` | API | Server-only | No | Frontend domain for CORS response headers. | `https://focusduo.vercel.app` |
| `API_PROXY_TARGET` | Web (Next.js) | Server-only | No | Target URL where Next.js rewrites forward all `/api/*` requests. Never expose to client bundles. | `https://focus-duo-api.onrender.com` |

---

## 3. Step-by-Step Deployment Walkthrough

### Step 1: Provision Neon Database
1. **[Dashboard Click]** Go to [console.neon.tech](https://console.neon.tech) and create a new project named `focus-duo`.
2. **[Dashboard Click]** On the project dashboard under **Connection Details**:
   - Select **Pooled connection**: Copy the connection string. This is your `DATABASE_URL`.
   - Uncheck/toggle **Connection pooling** (or select Direct connection): Copy the connection string. This is your `DATABASE_URL_UNPOOLED`.
3. **[Terminal Command]** Verify local connectivity:
   ```bash
   pnpm --filter api db:check
   ```

---

### Step 2: Apply Database Migrations
Migrations must be executed **once per release** and must **not** run automatically on every server request.

- **Option A (From local machine against production DB)**:
  ```bash
  DATABASE_URL_UNPOOLED="your-direct-neon-url" pnpm --filter api db:migrate
  ```
- **Option B (Using Drizzle Kit directly)**:
  ```bash
  DATABASE_URL="your-direct-neon-url" pnpm --filter api db:migrate:kit
  ```
- **Option C (Render Pre-Deploy Command)**:
  Configure Render Web Service **Pre-Deploy Command**:
  ```bash
  node apps/api/dist/db/migrate.js
  ```

---

### Step 3: Deploy Express API (Render / Persistent Host)
Deploy `apps/api` to a platform supporting persistent Node processes (e.g. Render Web Service, Railway, Fly.io, or VPS).

1. **[Dashboard Click]** Log into [dashboard.render.com](https://dashboard.render.com) and click **New + > Web Service**.
2. **[Dashboard Click]** Connect your Git repository (`focus-duo`).
3. **[Dashboard Click]** Configure Web Service settings:
   - **Name**: `focus-duo-api`
   - **Region**: Select the region closest to your Neon database (e.g., Singapore or Frankfurt).
   - **Root Directory**: *(Leave blank to use repository root for pnpm workspace)*
   - **Environment**: `Node`
   - **Build Command**:
     ```bash
     pnpm install --frozen-lockfile && pnpm --filter api build
     ```
   - **Start Command**:
     ```bash
     node apps/api/dist/server.js
     ```
   - **Health Check Path**: `/health` (or `/api/v1/health`)
4. **[Dashboard Click]** Under **Environment Variables**, add:
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: *(Your pooled Neon connection string)*
   - `DATABASE_URL_UNPOOLED`: *(Your direct Neon connection string)*
   - `SESSION_SECRET`: *(32+ character random hex string)*
   - `APP_INVITE_CODE`: *(Your team invite code)*
   - `CRON_SECRET`: *(32+ character random hex string)*
   - `CLIENT_ORIGIN`: `https://focusduo.vercel.app` (your frontend domain)
5. **[Dashboard Click]** Click **Create Web Service**.
6. **[Verification]** Once deployed, test the public health check endpoint:
   ```bash
   curl -i https://focus-duo-api.onrender.com/health
   ```
   Expected response: HTTP `200 OK` with JSON:
   ```json
   {
     "success": true,
     "data": {
       "status": "ok",
       "serverTimeUtc": "2026-10-25T...",
       "serverTimeAsiaKolkata": "2026-10-25 ...",
       "database": "connected"
     }
   }
   ```

---

### Step 4: Deploy Next.js Web App (Vercel)
Deploy `apps/web` to Vercel.

1. **[Dashboard Click]** Log into [vercel.com](https://vercel.com) and click **Add New... > Project**.
2. **[Dashboard Click]** Import the Git repository (`focus-duo`).
3. **[Dashboard Click]** In **Project Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click **Edit** and select `apps/web`.
   - **Include files outside of the Root Directory in the Build Step**: Ensure this is **Checked/Enabled** (allows access to root lockfile and packages).
4. **[Dashboard Click]** Under **Environment Variables**, add:
   - `API_PROXY_TARGET`: `https://focus-duo-api.onrender.com` (Your deployed Render API URL, without trailing slash)
   - `NODE_ENV`: `production`
5. **[Dashboard Click]** Click **Deploy**.
6. **[Verification]** Once deployed, visit your Vercel URL (e.g. `https://focusduo.vercel.app/health`). The request should rewrite through to the API health endpoint and return status `ok`.

---

### Step 5: Scheduler Configuration
Leaderboard snapshots freeze team progress at **10:00 AM**, **6:00 PM**, and **10:00 PM** in `Asia/Kolkata` (UTC+05:30).

#### Mode A: In-Process Cron (Always-On API Process)
- If your Express API runs continuously on a persistent container (e.g. Render Standard, Railway, VPS), the built-in `scheduler.service.ts` automatically runs in `Asia/Kolkata` timezone.
- No external configuration is required.
- On server startup or restart, the scheduler automatically detects and processes any missed slots.

#### Mode B: External Scheduler (API Sleeps / Restarts / Free Tier)
If your API host may sleep or scale to zero (e.g. Render Free tier), an external scheduler triggers the protected due-snapshots checkpoint.

We provide a built-in GitHub Actions workflow at `.github/workflows/scheduled-snapshots.yml`:

1. In your GitHub repository, navigate to **Settings > Secrets and variables > Actions**.
2. Click **New repository secret** and add:
   - `APP_URL`: Your deployed frontend or API URL (e.g. `https://focusduo.vercel.app` or `https://focus-duo-api.onrender.com`).
   - `CRON_SECRET`: The exact secret string configured in your API service.
3. The workflow runs automatically at:
   - `30 4 * * *` (04:30 UTC / 10:00 AM IST)
   - `30 12 * * *` (12:30 UTC / 06:00 PM IST)
   - `30 16 * * *` (16:30 UTC / 10:00 PM IST)
4. You can also trigger it on demand via **Actions > Scheduled Leaderboard Snapshots > Run workflow**.

Alternatively, you can configure an external service like [cron-job.org](https://cron-job.org) or Cloudflare Workers:
- **Endpoint URL**: `https://focusduo.vercel.app/api/v1/jobs/due-snapshots` (or direct API `https://focus-duo-api.onrender.com/api/v1/jobs/due-snapshots`)
- **HTTP Method**: `POST` (or `GET`)
- **HTTP Headers**:
  ```http
  Authorization: Bearer <YOUR_CRON_SECRET>
  Content-Type: application/json
  ```
  *(Or `x-cron-secret: <YOUR_CRON_SECRET>`)*
- **Security Rule**: Tokens in URL query strings (e.g. `?secret=...`) are strictly **rejected with HTTP 403 Forbidden** to prevent secrets from leaking into access logs.

---

## 4. Reverse Proxy & Cookie Architecture Validation

Focus Duo utilizes a same-origin reverse proxy architecture:
1. The browser visits `https://focusduo.vercel.app/login` and posts credentials to `/api/v1/auth/signin`.
2. Next.js server proxies the request to `$API_PROXY_TARGET/api/v1/auth/signin`.
3. The Express API responds with:
   ```http
   Set-Cookie: focus_session=<token>; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure
   ```
4. **Why this works seamlessly**:
   - The cookie has no `Domain` attribute, so the browser binds it directly to the requesting origin (`focusduo.vercel.app`).
   - Next.js proxies headers transparently in both directions.
   - Cross-origin restrictions (CORS preflight, Safari ITP, Chrome third-party cookie phaseout) are completely bypassed.
   - `API_PROXY_TARGET` is server-only and never exposed to the client.

### Manual Cookie Verification Checklist
1. Open browser DevTools (`F12`) > **Application** tab > **Cookies** > `https://focusduo.vercel.app`.
2. Sign in with your registered display name and PIN.
3. Verify the `focus_session` cookie properties:
   - **Name**: `focus_session`
   - **Value**: 64-character hex string
   - **Domain**: `focusduo.vercel.app` (matches frontend domain)
   - **Path**: `/`
   - **Expires / Max-Age**: 30 days from creation
   - **HttpOnly**: Checked (cannot be read via `document.cookie`)
   - **Secure**: Checked (only sent over HTTPS)
   - **SameSite**: `Lax`
4. Reload the page (`Ctrl + R`). Verify you remain signed in on `/dashboard`.
5. Open an incognito window, navigate to `/dashboard`, and verify you are redirected to `/login`.

---

## 5. Pre-Deployment Verification Checklist

Complete these checks prior to releasing to production:

- [ ] **Repository Clean**: Working tree clean, no uncommitted files or scratch artifacts.
- [ ] **Tests Pass**: `pnpm test` (all unit and integration tests green).
- [ ] **Linter Passes**: `pnpm lint` (0 errors across `api` and `web`).
- [ ] **Typecheck Passes**: `pnpm typecheck` (TypeScript compiles with 0 errors).
- [ ] **Web Production Build**: `pnpm --filter web build` compiles cleanly with Turbopack (9/9 static routes prerendered).
- [ ] **API Production Build**: `pnpm --filter api build` compiles to `dist/server.js`.
- [ ] **Database Migration Committed**: `drizzle/0000_polite_logan.sql` exists and matches `src/db/schema/index.ts`.
- [ ] **Environment Separation**: Root `.env` and `.env.production` are listed in `.gitignore`.
- [ ] **No Client Secrets**: Zero `NEXT_PUBLIC_` variables containing database URLs or session secrets.

---

## 6. Post-Deployment Smoke Test Matrix

Perform these manual acceptance tests on the live deployment:

| Test ID | Feature Area | Test Procedure | Expected Result | Pass? |
|---|---|---|---|:---:|
| **SMOKE-01** | **Health Check** | `curl -i https://<your-vercel-domain>/health` | HTTP `200 OK` with database connected and server time. | [ ] |
| **SMOKE-02** | **New Signup** | Register a new profile with name, 4-digit PIN, and valid `APP_INVITE_CODE`. | HTTP `201 Created`, user profile created, redirects to `/dashboard`. | [ ] |
| **SMOKE-03** | **Invite Code Rejection** | Attempt signup with an invalid invite code. | HTTP `403 Forbidden` with "Invalid team invite code." | [ ] |
| **SMOKE-04** | **4-Profile Limit** | Attempt to register a 5th profile when 4 active users exist. | HTTP `403 Forbidden` with "Maximum profile limit reached." | [ ] |
| **SMOKE-05** | **Login & Cookie** | Sign out, then sign back in using display name and PIN. | Profile loads, `focus_session` cookie present with `HttpOnly; Secure; SameSite=Lax`. | [ ] |
| **SMOKE-06** | **Timer Persistence** | Start a 25m countdown or stopwatch session. Hard-refresh browser (`Ctrl+Shift+R`). | Timer continues counting accurately from elapsed server time. | [ ] |
| **SMOKE-07** | **Pause & Resume** | Click Pause on the timer card. Wait 10 seconds. Click Resume. | Time paused does not snap back to running. Accumulated focus time is preserved. | [ ] |
| **SMOKE-08** | **Complete Session** | Complete the timer session. | Streak increments, activity heatmap adds today's minutes, session appears in log. | [ ] |
| **SMOKE-09** | **Activity Heatmap** | Inspect Activity card on `/dashboard`. | 52-week grid spans container without blank space; hover tooltips are legible in light/dark themes. | [ ] |
| **SMOKE-10** | **Analytics Ranges** | Navigate to `/analytics`. Toggle ranges: `7D`, `30D`, `90D`, `1Y`, `Lifetime`. | Metric cards and charts update accurately without errors. | [ ] |
| **SMOKE-11** | **Leaderboard Standings** | Navigate to `/leaderboard`. Verify Standings and Through-the-Day Progression. | Shows active user stats, current user badge ("You"), and checkpoint progression table. | [ ] |
| **SMOKE-12** | **Scheduled Snapshot** | Trigger snapshot manually: `curl -X POST https://<domain>/api/v1/jobs/due-snapshots -H "Authorization: Bearer <CRON_SECRET>"`. | HTTP `200 OK` with processed snapshot results; visible on `/leaderboard`. | [ ] |
| **SMOKE-13** | **Cross-User Isolation** | Sign in as User A and User B in two separate browser profiles. | User A cannot edit or see User B's uncompleted private tasks. | [ ] |
| **SMOKE-14** | **Theme Toggle** | Toggle Dark Mode and Light Mode on `/dashboard`. | All cards, buttons, rings, and tooltips switch seamlessly with correct contrast. | [ ] |

---

## 7. Troubleshooting & Common Questions

### Q: Why does my deployment return 503 on `/health`?
- **Cause**: The API server cannot establish an SSL connection to Neon.
- **Remedy**: Ensure `DATABASE_URL` ends with `?sslmode=require`. If using Neon's connection pooler, confirm that the pooler endpoint (`-pooler`) is active in your Neon console.

### Q: Why do API calls fail with 401 after signing in on Vercel?
- **Cause**: Next.js is rewriting to an incorrect or unreachable `API_PROXY_TARGET`.
- **Remedy**: In Vercel Project Settings > Environment Variables, confirm `API_PROXY_TARGET` is set to the full HTTPS URL of your deployed Express API (e.g. `https://focus-duo-api.onrender.com`) without a trailing slash.

### Q: Why did `drizzle-kit migrate` fail with an advisory lock error?
- **Cause**: DDL migrations were attempted through Neon's PgBouncer connection pooler (`-pooler`).
- **Remedy**: Use the direct unpooled connection string (`DATABASE_URL_UNPOOLED` without `-pooler`) when running migrations.

### Q: Does the Express server need custom domain DNS configuration?
- **Answer**: Not necessarily. Because all browser traffic routes through Next.js via same-origin rewrites (`https://yourdomain.com/api/*`), your Express API can remain on its default cloud domain (e.g. `https://focus-duo-api.onrender.com`). Only your Next.js frontend requires a custom domain if desired.
