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

## 5. Streaks, Analytics & Leaderboards (Upcoming Stages)
*Documented in data-model.md; endpoints to be activated in Stages 5 and 6.*
