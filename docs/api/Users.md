# Users API Documentation

Base URL: `/api/v1`

## Authentication

All `/api/v1/users/*` endpoints require an active session cookie (`authula.session_token`). The cookie is set by Authula on sign-in / sign-up and sent automatically by the browser via `credentials: 'include'`. The middleware (`AuthSession`) reads the cookie, resolves the Authula actor, and materialises the local `domain.User` projection before any handler runs.

See [Authentication.md](./Authentication.md) for the full auth flow (sign-in/sign-up, OAuth2, password change, sign-out, etc.).

## Response Envelope

All responses follow a consistent envelope format:

```json
{
  "status_code": 200,
  "message": "success message",
  "data": { ... }
}
```

## Common Error Responses

| Status Code | Message | Meaning |
|-------------|---------|---------|
| 400 | `invalid user id` | The `:id` path parameter is not a valid UUID |
| 400 | `invalid request body` | Request body failed validation |
| 401 | `unauthorized` | Missing or invalid session cookie |
| 403 | `forbidden` | Authenticated but lacks the required role |
| 403 | `must_change_password` | `must_change_password` is true; only `/api/v1/auth/change-password` is reachable |
| 404 | `resource not found` | User does not exist |
| 409 | `conflict` | Email already exists (unique constraint violation) |
| 422 | `validation error` | Database constraint violation |

---

## User Roles

| Role | Description |
|------|-------------|
| `user` | Standard user — can only access/modify their own profile |
| `super_admin` | Administrator — can list all users, create users, and delete any user |

Role hierarchy: `user (1) < super_admin (2)`

---

## Endpoints

### GET /api/v1/users

Lists all users in the system except the requesting user.

**Authorization:** Requires `super_admin` role.

**Request**

```
GET /api/v1/users
Cookie: authula.session_token=<cookie>
```

**Response `200 OK`**

```json
{
  "status_code": 200,
  "message": "users retrieved",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "john@example.com",
      "email_verified": true,
      "name": "John",
      "lastname": "Doe",
      "role": "user",
      "must_change_password": false,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Fields:**
- `id` — User UUID
- `email` — User's email address (unique)
- `email_verified` — `true` if the email has been verified through Authula's verification flow
- `image` — Optional avatar URL (nullable; `null` until set)
- `name` — User's first name (may be empty string)
- `lastname` — User's last name (may be empty string)
- `role` — User's role: `user` or `super_admin`
- `must_change_password` — `true` for users created by an admin that haven't changed their temporary password yet
- `created_at` — ISO 8601 timestamp when user was created

**Error Responses**
- `401` — Unauthorized
- `403` — Forbidden (user is not `super_admin`)

---

### GET /api/v1/users/:id

Retrieves a single user by ID, including a paginated list of their devices.

**Authorization:**
- `super_admin` — can access any user
- Same user ID as the requesting user — can access their own profile
- Otherwise → 403 Forbidden

**Request**

```
GET /api/v1/users/:id?page=1&page_size=10
Cookie: authula.session_token=<cookie>
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | 1 | Page number (1-indexed) |
| `page_size` | int | 10 | Number of devices per page (max 100) |

**Response `200 OK`**

```json
{
  "status_code": 200,
  "message": "user retrieved",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "email_verified": true,
    "image": null,
    "name": "John",
    "lastname": "Doe",
    "role": "user",
    "must_change_password": false,
    "created_at": "2024-01-15T10:30:00Z",
    "devices": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440000",
        "uuid_firmware": "esp32-001",
        "name": "Living Room GPS"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 10,
      "total": 1,
      "total_pages": 1
    }
  }
}
```

**Fields (data):**
- All fields from the user record (same as `GET /api/v1/users`)
- `devices` — Array of devices the user has access to (basic projection)
- `pagination` — Pagination metadata

**Fields (devices[ ]):**
- `id` — Device UUID
- `uuid_firmware` — ESP32 firmware UUID
- `name` — Device display name

**Fields (pagination):**
- `page` — Current page number
- `page_size` — Items per page
- `total` — Total number of devices
- `total_pages` — Total number of pages

**Error Responses**
- `400` — Invalid user ID format
- `401` — Unauthorized
- `403` — Forbidden (not the user themselves and not a super_admin)
- `404` — User not found

---

### POST /api/v1/users

Creates a new user account. The user is provisioned in **both** Authula (credentials) and the local `users` table (role, FK relationships). Admin-created users get a temporary password and `must_change_password = true`; they must hit `POST /api/v1/auth/change-password` before any other endpoint becomes reachable.

**Authorization:** Requires `super_admin` role.

**Request**

```
POST /api/v1/users
Cookie: authula.session_token=<cookie>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "name": "New",
  "lastname": "User"
}
```

**Fields (request body):**
| Field | Type | Required | Validation |
|-------|------|----------|-------------|
| `email` | string | Yes | Must be a valid email address |
| `name` | string | Yes | 1–100 characters |
| `lastname` | string | No | Max 100 characters |

**Response `201 Created`**

```json
{
  "status_code": 201,
  "message": "user created",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "email": "newuser@example.com",
    "email_verified": false,
    "image": null,
    "name": "New",
    "lastname": "User",
    "role": "user",
    "must_change_password": true,
    "created_at": "2024-06-14T12:00:00Z",
    "temporary_password": "9f2b8c1a4e3d5f6b7c8d9e0a1b2c3d4e"
  }
}
```

**Special Behavior:**
- Users created through this endpoint are assigned the `user` role. The role is not accepted in the request body.
- The first user in a completely empty system is assigned the `super_admin` role by the application bootstrap flow; this endpoint requires an authenticated `super_admin` and is intended for subsequent users.
- The `temporary_password` returned in the response is a one-time, 32-character hex string (128 bits of entropy). The admin is responsible for delivering it to the new user through a secure channel.
- The new user is created with `must_change_password = true` and can only reach `/api/v1/auth/change-password` until they update it.
- Authula creates the shared user record as part of credential provisioning; the API updates that existing record rather than inserting a duplicate local row.

**Error Responses**
- `400` — Invalid request body or validation failure
- `401` — Unauthorized
- `403` — Forbidden (user is not `super_admin`)
- `409` — Email already exists

---

### PUT /api/v1/users/:id

Updates a user's `name` and/or `lastname`.

**Authorization:** Only the user themselves can update their own profile. Not even `super_admin` can update other users.

**Request**

```
PUT /api/v1/users/:id
Cookie: authula.session_token=<cookie>
Content-Type: application/json

{
  "name": "John",
  "lastname": "UpdatedLastName"
}
```

**Fields (request body):**
| Field | Type | Required | Validation |
|-------|------|----------|-------------|
| `name` | string | No | Max 100 characters |
| `lastname` | string | No | Max 100 characters |

> **Note:** `email`, `role`, and `must_change_password` cannot be changed through this endpoint. Password changes go through `POST /api/v1/auth/change-password`.

**Response `200 OK`**

```json
{
  "status_code": 200,
  "message": "user updated",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "email_verified": true,
    "image": null,
    "name": "John",
    "lastname": "UpdatedLastName",
    "role": "user",
    "must_change_password": false,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Responses**
- `400` — Invalid user ID or request body
- `401` — Unauthorized
- `403` — Forbidden (user is not updating their own profile)
- `404` — User not found

---

### DELETE /api/v1/users/:id

Soft-deletes a user by setting `deleted_at = NOW()`. The user row is NOT physically removed. This operation is idempotent — re-deleting an already-deleted user succeeds silently.

**Authorization:**
- `super_admin` — can delete any user
- Same user ID as the requesting user — can delete their own account
- Otherwise → 403 Forbidden

**Request**

```
DELETE /api/v1/users/:id
Cookie: authula.session_token=<cookie>
```

**Response `204 No Content`**

**Error Responses**
- `400` — Invalid user ID
- `401` — Unauthorized
- `403` — Forbidden (not the user themselves and not a super_admin)
- `404` — User not found

---

## Notes

- All timestamps are in ISO 8601 format (UTC).
- Soft-deleted users are filtered out of all queries — they are effectively invisible to the API.
- The `super_admin` role is unique (enforced by a DB index) and cannot be deleted or transferred through the API.
- Device access relationships (`user_device_access`) are managed separately and are not affected by user deletion (RESTRICT foreign key).
- New users created by an admin receive a `temporary_password` and `must_change_password = true`. They cannot use any `/api/v1/*` endpoint (except `/api/v1/auth/change-password`) until they change it.