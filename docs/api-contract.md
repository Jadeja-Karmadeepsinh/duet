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

## 4. Timer, Streaks, Analytics & Leaderboards (Upcoming Stages)
*Documented in data-model.md; endpoints to be activated in Stages 4, 5, and 6.*
