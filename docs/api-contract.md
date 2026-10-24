# API Contract: Focus Tracker

All application endpoints are served from `/api/v1` and use standard JSON request and response payloads. The public health check is also available at `/health`.

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

### `GET /health` or `GET /api/v1/health`
System status and active database connectivity verification.
- **Auth**: Public
- **Response** (`200 OK` or `503 Service Unavailable`):
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "serverTimeUtc": "2026-10-24T09:45:00.000Z",
    "serverTimeAsiaKolkata": "2026-10-24 15:15:00",
    "database": "connected"
  }
}
```

---

## 2. Authentication (`/api/v1/auth`)

### `POST /api/v1/auth/signup`
Registers a new user profile. Enforces maximum 4 active profiles, shared team invite code, and unique normalized display name.
- **Auth**: Public (Rate-limited: 15 req/min)
- **Request Body**:
```json
{
  "displayName": "Karmadeep",
  "pin": "1234",
  "inviteCode": "focus-team-2026"
}
```
- **Responses**:
  - `201 Created`: Sets `focus_session` HttpOnly cookie (`Path=/`, `SameSite=Lax`, `Max-Age=30d`).
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": "e7b0c793-f112-4f3b-87b6-f1c5040e53a2",
          "displayName": "Karmadeep",
          "createdAt": "2026-10-24T09:45:00.000Z"
        }
      }
    }
    ```
  - `400 Bad Request` (`VALIDATION_ERROR`): Name or PIN does not satisfy constraints.
  - `403 Forbidden` (`FORBIDDEN`): Invalid invite code OR 4-profile system limit reached.
  - `409 Conflict` (`CONFLICT`): Profile with normalized name already exists.

### `POST /api/v1/auth/signin`
Authenticate using display name and personal PIN.
- **Auth**: Public (Rate-limited: 15 req/min)
- **Request Body**:
```json
{
  "displayName": "Karmadeep",
  "pin": "1234"
}
```
- **Responses**:
  - `200 OK`: Sets `focus_session` HttpOnly cookie.
    ```json
    {
      "success": true,
      "data": {
        "user": {
          "id": "e7b0c793-f112-4f3b-87b6-f1c5040e53a2",
          "displayName": "Karmadeep",
          "createdAt": "2026-10-24T09:45:00.000Z"
        }
      }
    }
    ```
  - `401 Unauthorized` (`UNAUTHORIZED`): Display name not found or PIN incorrect.

### `POST /api/v1/auth/signout`
Revokes active session record in database and clears the `focus_session` cookie.
- **Auth**: Authenticated (`requireAuth`)
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "message": "Signed out successfully."
  }
}
```

### `GET /api/v1/auth/me`
Retrieves currently authenticated user profile.
- **Auth**: Authenticated (`requireAuth`)
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "e7b0c793-f112-4f3b-87b6-f1c5040e53a2",
      "displayName": "Karmadeep",
      "createdAt": "2026-10-24T09:45:00.000Z"
    }
  }
}
```
- `401 Unauthorized`: Cookie missing, invalid, or expired.

---

## 3. Tasks (`/api/v1/tasks`)

All task endpoints require authentication. User ownership is strictly enforced on the server; client-supplied `ownerUserId` is ignored.

### `GET /api/v1/tasks`
Lists reusable task templates owned by the authenticated user.
- **Query Parameters**:
  - `status`: `'active'` (default), `'archived'`, or `'all'`
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "f51276a1-6ba9-4db8-9d41-396a84c8a245",
        "ownerUserId": "e7b0c793-f112-4f3b-87b6-f1c5040e53a2",
        "title": "Deep Code Review",
        "description": "Reviewing pull requests and architecture",
        "plannedDurationSeconds": 1800,
        "category": "Engineering",
        "status": "active",
        "createdAt": "2026-10-24T09:45:00.000Z",
        "updatedAt": "2026-10-24T09:45:00.000Z",
        "archivedAt": null
      }
    ]
  }
}
```

### `GET /api/v1/tasks/:id`
Retrieves a specific task owned by the authenticated profile.
- **Response**:
  - `200 OK`: `{ "success": true, "data": { "task": { ... } } }`
  - `404 Not Found` (`NOT_FOUND`): Task does not exist or belongs to another user (prevents ownership probing).

### `POST /api/v1/tasks`
Creates a new reusable task template.
- **Request Body**:
```json
{
  "title": "Deep Code Review",
  "description": "Optional notes",
  "plannedDurationSeconds": 1800,
  "category": "Engineering"
}
```
- **Responses**:
  - `201 Created`: `{ "success": true, "data": { "task": { ... } } }`
  - `400 Bad Request`: Title missing or duration not a positive integer <= 86,400.

### `PATCH /api/v1/tasks/:id`
Updates task fields.
- **Request Body**:
```json
{
  "title": "Updated Title",
  "plannedDurationSeconds": 2400,
  "category": "Architecture"
}
```
- **Responses**:
  - `200 OK`: `{ "success": true, "data": { "task": { ... } } }`
  - `404 Not Found`: Task does not exist or belongs to another user.

### `DELETE /api/v1/tasks/:id`
Soft-archives a task (sets `status: 'archived'`, `archivedAt: now()`). Does not destroy historical work sessions or completions.
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "message": "Task archived successfully.",
    "task": { ... }
  }
}
```

### `POST /api/v1/tasks/:id/unarchive`
Restores an archived task back to `active`.
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "message": "Task unarchived successfully.",
    "task": { ... }
  }
}
```

---

## 4. Timer & Work Sessions API (Stage 4)

All work session routes require authentication via HttpOnly `focus_session` cookie or `Authorization: Bearer <token>` header.

### State Machine Transitions
- **Modes**: `countdown` (when task `plannedDurationSeconds > 0`) or `stopwatch` (when `plannedDurationSeconds` is null).
- **Statuses**: `running`, `paused`, `awaiting_decision`, `completed`, `stopped`.
- **Single Running Timer Invariant**: Enforced by both service transactions and database partial unique index (`idx_work_sessions_single_running`). Simultaneous start requests result in exactly one 201 and one 409 Conflict.
- **Expiry Exactness**: Countdown expiry closes the open segment exactly at `startedAt + remainingNeeded` (target boundary), locking `trackedSeconds` at `targetDurationSeconds` and status to `awaiting_decision`. No time accrues while awaiting choice.
- **Extension Gaps**: Extending adds 900, 1800, or 3600 seconds to target and starts a new segment at action time; the decision gap is completely excluded.
- **Idempotency**: `complete`, `stop`, and `expire` are fully idempotent. Repeated completion calls return the existing session and completion without duplicate rows.

### `GET /api/v1/work-sessions/current`
Retrieves the currently active (`running` or `awaiting_decision`) session for the authenticated profile with server-derived metrics. Reconciles expired countdown sessions on fetch/reload.
- **Response** (`200 OK` - Active session):
```json
{
  "success": true,
  "data": {
    "session": {
      "id": "18cfd600-...",
      "userId": "45f9e801-...",
      "taskId": "72a11b03-...",
      "mode": "countdown",
      "status": "running",
      "targetDurationSeconds": 1500,
      "trackedSeconds": 0,
      "taskTitleSnapshot": "Deep Work Session",
      "categorySnapshot": "Engineering",
      "startedAt": "2026-10-24T10:00:00.000Z",
      "finishedAt": null,
      "elapsedSeconds": 300,
      "remainingSeconds": 1200,
      "isExpired": false,
      "staleRunningWarning": false,
      "activeSegmentStartedAt": "2026-10-24T10:00:00.000Z"
    }
  }
}
```
- **Response** (`200 OK` - None active): `{ "success": true, "data": { "session": null } }`

### `GET /api/v1/work-sessions/paused`
Lists all resumable paused sessions for the authenticated profile.
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "sessions": [ ... ]
  }
}
```

### `GET /api/v1/work-sessions`
Paginated history of sessions for the authenticated profile with optional filters.
- **Query Parameters**:
  - `page`: default 1
  - `limit`: default 20 (max 100)
  - `taskId`: optional UUID
  - `status`: optional enum (`running` | `paused` | `awaiting_decision` | `completed` | `stopped`)
  - `from`: optional ISO date string
  - `to`: optional ISO date string
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "sessions": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalCount": 42,
      "totalPages": 3
    }
  }
}
```

### `POST /api/v1/work-sessions/start`
Starts a new work session and open segment.
- **Request Body**:
```json
{
  "taskId": "72a11b03-..."
}
```
- **Responses**:
  - `201 Created`: `{ "success": true, "data": { "session": { ... } } }`
  - `409 Conflict`: User already has an active running session.
  - `404 Not Found`: Task does not exist or belongs to another user.
  - `400 Bad Request`: Task is archived.

### `POST /api/v1/work-sessions/:id/pause`
Closes the open segment at server time, accumulates segment duration into `trackedSeconds`, and sets status to `paused`.
- **Response** (`200 OK`): `{ "success": true, "data": { "session": { ... } } }`
- **Errors**: `409 Conflict` if session is not running or countdown expired before pause.

### `POST /api/v1/work-sessions/:id/resume`
Resumes a paused session, sets status to `running`, and creates a new open segment.
- **Response** (`200 OK`): `{ "success": true, "data": { "session": { ... } } }`
- **Errors**: `409 Conflict` if session is not paused or another session is already running.

### `POST /api/v1/work-sessions/:id/expire`
Explicit countdown expiry trigger when client timer reaches 0. Closes segment at exact target boundary and transitions status to `awaiting_decision`. Idempotent.
- **Response** (`200 OK`): `{ "success": true, "data": { "session": { ... } } }`

### `POST /api/v1/work-sessions/:id/extend`
Extends an awaiting-decision countdown session. Only allowed from `awaiting_decision`.
- **Request Body**:
```json
{
  "extensionSeconds": 900 // 900 (15m), 1800 (30m), or 3600 (60m)
}
```
- **Response** (`200 OK`): `{ "success": true, "data": { "session": { ... } } }`
- **Errors**: `409 Conflict` if session is not awaiting decision, or if another session is running. `400 Bad Request` if invalid duration.

### `POST /api/v1/work-sessions/:id/complete`
Closes any active segment, marks session `completed`, and transactionally records exactly one `task_completions` row. Idempotent against double-clicks.
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "session": { ... },
    "completion": {
      "id": "99b380f2-...",
      "userId": "45f9e801-...",
      "taskId": "72a11b03-...",
      "workSessionId": "18cfd600-...",
      "taskTitleSnapshot": "Deep Work Session",
      "categorySnapshot": "Engineering",
      "completedAt": "2026-10-24T10:25:00.000Z"
    }
  }
}
```

### `POST /api/v1/work-sessions/:id/stop`
Stops session, closes open segment, sets status `stopped`, preserves `trackedSeconds`, and creates NO completion record.
- **Response** (`200 OK`): `{ "success": true, "data": { "session": { ... } } }`

---

---

## 5. Stats, Streaks & Contributions (`/api/v1/stats`)

### `GET /api/v1/stats/summary`
Returns today's active focus time, completed tasks count, daily goal seconds, and streak calculations in Asia/Kolkata.
- **Auth**: Required
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "todayDate": "2026-10-24",
    "focusSecondsToday": 7200,
    "completedTasksToday": 3,
    "dailyGoalSeconds": 14400,
    "currentStreak": 5,
    "bestStreak": 12
  }
}
```

### `GET /api/v1/stats/contributions`
Returns approximately 26 weeks of calendar day intensity cells, aligned to Sunday, for the GitHub-style contribution graph.
- **Auth**: Required
- **Query**: `weeks` (optional, 1..52, default 26)
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "startDate": "2026-04-26",
    "endDate": "2026-10-24",
    "totalFocusSeconds": 144000,
    "totalCompletions": 42,
    "days": [
      {
        "date": "2026-04-26",
        "weekday": 0,
        "completionCount": 2,
        "focusSeconds": 3600,
        "level": 2
      }
    ]
  }
}
```

### `GET /api/v1/stats/day`
Returns task completion events and work session records for a clicked date in Asia/Kolkata.
- **Auth**: Required
- **Query**: `date=YYYY-MM-DD` (required)
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "date": "2026-10-24",
    "totalFocusSeconds": 7200,
    "totalCompletions": 2,
    "completions": [
      {
        "id": "...",
        "taskTitle": "Feature Implementation",
        "category": "Coding",
        "completedAt": "2026-10-24T08:30:00.000Z"
      }
    ],
    "sessions": [ ... ]
  }
}
```

### `GET /api/v1/stats/preferences` & `PATCH /api/v1/stats/preferences`
Retrieves or updates persistent user preferences (e.g. `dailyGoalSeconds`).
- **Auth**: Required
- **PATCH Request Body**:
```json
{
  "dailyGoalSeconds": 18000
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "dailyGoalSeconds": 18000
  }
}
```

### `GET /api/v1/stats/leaderboard-preview`
Retrieves today's latest snapshot run if captured, or provisional standings status.
- **Auth**: Required
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "hasSnapshot": false,
    "status": "provisional",
    "localDate": "2026-10-24",
    "activeProfileCount": 2,
    "nextScheduledSlot": "10:00"
  }
}
```

---

## 6. Analytics API (`/api/v1/analytics`)

### `GET /api/v1/analytics`
Returns aggregate focus metrics, time series bins, category distribution, and prior-period comparisons.
- **Auth**: Required
- **Query Parameters**:
  - `range`: `'7d' | '30d' | '90d' | '1y' | 'lifetime'` (default: `'7d'`). Range bounds are computed strictly on the server in `Asia/Kolkata`.
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "range": "7d",
    "rangeLabel": "Last 7 Days",
    "startDate": "2026-10-18",
    "endDate": "2026-10-24",
    "binning": "daily",
    "summary": {
      "totalFocusSeconds": 28800,
      "totalCompletions": 12,
      "calendarDaysCount": 7,
      "activeDaysCount": 5,
      "averageFocusSecondsPerCalendarDay": 4114,
      "averageFocusSecondsPerActiveDay": 5760,
      "mostFocusDay": {
        "date": "2026-10-22",
        "focusSeconds": 10800
      },
      "mostCompletionsDay": {
        "date": "2026-10-24",
        "completionCount": 4
      },
      "currentStreak": 5,
      "longestStreak": 12,
      "longestSession": {
        "id": "18cfd600-...",
        "taskTitle": "Timer Engine Architecture",
        "category": "Coding",
        "mode": "countdown",
        "trackedSeconds": 3600,
        "startedAt": "2026-10-22T04:30:00.000Z"
      },
      "priorPeriod": {
        "priorStartDate": "2026-10-11",
        "priorEndDate": "2026-10-17",
        "priorTotalFocusSeconds": 21600,
        "priorTotalCompletions": 9,
        "focusChangePercent": 33,
        "completionsChangePercent": 33
      }
    },
    "timeSeries": [
      {
        "key": "2026-10-18",
        "label": "Oct 18",
        "focusSeconds": 3600,
        "completionCount": 2
      }
    ],
    "categories": [
      {
        "category": "Coding",
        "focusSeconds": 21600,
        "completionCount": 9,
        "percentage": 75
      },
      {
        "category": "Uncategorized",
        "focusSeconds": 7200,
        "completionCount": 3,
        "percentage": 25
      }
    ]
  }
}
```

---

## 7. Leaderboard & Scheduled Jobs API (`/api/v1/leaderboard` & `/api/v1/jobs`)

### `GET /api/v1/leaderboard`
Returns official checkpoint standings or provisional live standings for the authenticated profile.
- **Auth**: Required (session cookie or bearer token)
- **Query Parameters**:
  - `period`: `'today' | '7d'` (default: `'today'`).
  - `slot`: optional checkpoint slot (`'10:00' | '18:00' | '22:00'`) to inspect earlier snapshots captured today.
- **Sorting & Ranking**:
  - Primary: `focusSeconds` descending.
  - Secondary tie-break: `completedTasks` descending.
  - Tertiary stable tie-break: `displayName` ascending.
  - Maximum profiles returned: 4.
  - Zero private data leak: No task titles, notes, or raw session histories are returned.
- **Response** (`200 OK`):
```json
{
  "success": true,
  "data": {
    "period": "today",
    "date": "2026-10-24",
    "currentSlot": "10:00",
    "availableSlots": ["10:00"],
    "isProvisional": false,
    "scheduledFor": "2026-10-24T04:30:00.000Z",
    "capturedAt": "2026-10-24T04:31:00.000Z",
    "isDelayed": false,
    "nextScheduledSlot": "18:00",
    "activeProfileCount": 2,
    "entries": [
      {
        "rank": 1,
        "userId": "0c01899c-...",
        "displayName": "imjadejakj",
        "focusSeconds": 7200,
        "completedTasks": 3,
        "isCurrentUser": true
      }
    ],
    "timezone": "Asia/Kolkata (IST)"
  }
}
```

### `POST /api/v1/jobs/leaderboard-snapshot`
Internal protected endpoint that processes due/missed snapshot slots or triggers a specific slot.
- **Auth**: Required via `x-cron-secret` header or `Authorization: Bearer <CRON_SECRET>`. Verified using constant-time comparison (`crypto.timingSafeEqual`). Normal user sessions cannot invoke this endpoint.
- **Request Body (optional)**:
```json
{
  "date": "2026-10-24",
  "slot": "10:00"
}
```
- **Responses**:
  - `200 OK`: `{ "success": true, "message": "Processed due snapshot checkpoints.", "data": { "results": [ ... ] } }`
  - `401 Unauthorized`: Missing or invalid `CRON_SECRET`.


