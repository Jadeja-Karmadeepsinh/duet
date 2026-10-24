# API Contract: Focus Tracker

All endpoints are served from `/api/v1` and use standard JSON request and response payloads.

## Standard Envelope

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | RATE_LIMITED | INTERNAL_ERROR",
    "message": "Human readable explanation.",
    "details": null
  }
}
```

---

## 1. System & Health

### `GET /api/v1/health`
Healthcheck and system status.
- **Auth**: Public
- **Response**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "serverTimeUtc": "2026-10-24T08:45:00.000Z",
    "serverTimeAsiaKolkata": "2026-10-24 14:15:00",
    "database": "connected"
  }
}
```

---

## 2. Authentication

### `POST /api/v1/auth/signup`
Creates a new profile if under the 4-profile limit.
- **Auth**: Public (Requires shared invite code in payload or header)
- **Request Body**:
```json
{
  "displayName": "Karmadeep",
  "pin": "1234",
  "inviteCode": "secret-invite-token"
}
```
- **Response**: Sets `focus_session` HttpOnly cookie. Returns profile summary.

### `POST /api/v1/auth/signin`
Sign in with existing display name and personal PIN.
- **Auth**: Public
- **Request Body**:
```json
{
  "displayName": "Karmadeep",
  "pin": "1234"
}
```
- **Response**: Sets `focus_session` HttpOnly cookie.

### `POST /api/v1/auth/signout`
Invalidates current session token in database and clears cookie.
- **Auth**: Authenticated

### `GET /api/v1/auth/me`
Retrieves current profile information.
- **Auth**: Authenticated

---

## 3. Tasks

### `GET /api/v1/tasks`
List user's active reusable tasks.

### `POST /api/v1/tasks`
Create a reusable task.
- **Request Body**:
```json
{
  "title": "Deep Architecture Design",
  "description": "Monorepo and schema setup",
  "plannedDurationSeconds": 1500,
  "category": "Architecture"
}
```

### `PATCH /api/v1/tasks/:id`
Update a task's details.

### `DELETE /api/v1/tasks/:id`
Archive a task (soft delete).

---

## 4. Timer & Focus Sessions

### `GET /api/v1/timer/current`
Fetches current active or awaiting-decision session for authenticated user, with calculated elapsed seconds.

### `POST /api/v1/timer/start`
Starts a new focus session.
- **Request Body**:
```json
{
  "taskId": "task-uuid-or-null",
  "title": "Ad-hoc deep work",
  "plannedDurationSeconds": 1800,
  "category": "Deep Work"
}
```

### `POST /api/v1/timer/:id/pause`
Closes current active segment and sets status to `paused`.

### `POST /api/v1/timer/:id/resume`
Starts a new segment and sets status to `running`.

### `POST /api/v1/timer/:id/extend`
Extends countdown by 15, 30, or 60 minutes (`extensionSeconds: 900 | 1800 | 3600`), creates a new work segment, and resumes.

### `POST /api/v1/timer/:id/complete`
Marks session completed, closes active segment, and creates a `task_completions` record.

### `POST /api/v1/timer/:id/stop`
Stops session without marking completed. Active time is saved, but no completion record or streak increment is triggered.

---

## 5. Streaks & Contributions

### `GET /api/v1/streaks/summary`
Current streak, longest streak, today's completion status.

### `GET /api/v1/streaks/contributions?year=2026`
Daily completion counts and focus seconds formatted for the contribution graph in `Asia/Kolkata`.

---

## 6. Analytics

### `GET /api/v1/analytics?range=7d|30d|90d|1y|lifetime`
Returns:
- Total focus seconds & completed tasks
- Calendar-day average & active-day average
- Most-focus-time day & most-tasks-completed day
- Time series of focus seconds and completed tasks
- Category distribution breakdown (grouping nulls into "Uncategorized")

---

## 7. Leaderboard & Scheduled Jobs

### `GET /api/v1/leaderboard/today`
Today's leaderboard. Displays live/provisional view before the 10:00 checkpoint, or the latest checkpoint with slot inspection (`10:00`, `18:00`, `22:00`).

### `GET /api/v1/leaderboard/rolling-7-days`
Aggregated rolling 7-day leaderboard across active profiles.

### `POST /api/v1/jobs/leaderboard-snapshot`
- **Auth**: Protected via `x-job-secret` header or bearer token.
- Triggers capture of current or overdue checkpoint snapshot idempotently.
