# Email API Documentation

Base URL: `/api/v1`

## Authentication

All `/api/v1/email/*` endpoints require an active session cookie (`authula.session_token`) and the caller's `role` must be `super_admin`. The `AuthSession` middleware also enforces `must_change_password = false` (same gate as every other authenticated route).

See [Authentication.md](./Authentication.md) for the full auth flow (sign-in/sign-up, OAuth2, password change, sign-out, etc.).

## Response Envelope

All responses follow the standard envelope:

```json
{
  "status_code": 202,
  "message": "welcome email dispatched",
  "data": { ... }
}
```

## Common Error Responses

| Status Code | Message | Meaning |
|-------------|---------|---------|
| 400 | `invalid request body` | Request body failed validation (missing fields, bad email, unknown locale, etc.) |
| 400 | `invalid language` | `locale` is not one of the configured languages (`en`, `es`). |
| 401 | `unauthorized` | Missing or invalid session cookie |
| 403 | `forbidden` | Authenticated but lacks the `super_admin` role |
| 403 | `must_change_password` | `must_change_password` is true; only `/api/v1/auth/change-password` is reachable |
| 502 | `upstream email provider failed` | The Resend API rejected the call (network error, bad API key, suspended template, etc.) |
| 500 | `internal server error` | Unhandled error |

---

## Endpoints

### POST /api/v1/email/welcome

Dispatches the welcome email through [Resend](https://resend.com) using the locale-specific template the client picks. The handler does not generate the temporary password — it forwards the values the caller already has (typically the same admin form that just called `POST /api/v1/users`).

**Authorization:** Requires `super_admin` role.

**Request**

```
POST /api/v1/email/welcome
Cookie: authula.session_token=<cookie>
Content-Type: application/json
```

```json
{
  "email": "newuser@example.com",
  "first_name": "Jane",
  "temporary_password": "a1b2c3d4e5f6...",
  "subject": "Welcome to Open GPS",
  "locale": "en"
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `email` | string | yes | RFC-5322 email | Recipient address. Rendered in the template as `{{email}}` and used as the `To:` header. |
| `first_name` | string | yes | 1–100 chars | Rendered in the template as `{{first_name}}`. |
| `temporary_password` | string | yes | 1–255 chars | Rendered in the template as `{{temporary_password}}`. The client is responsible for surfacing it to the admin before this call. |
| `subject` | string | yes | 1–200 chars | Forwarded to Resend as the message subject. The actual rendered subject comes from the template; this field is required by the SDK contract. |
| `locale` | string | yes | `"en"` or `"es"` | Selects which Resend template to render (`WELCOME_EMAIL_TEMPLATE_EN_ID` / `WELCOME_EMAIL_TEMPLATE_ES_ID`). |

**Response `202 Accepted`**

The 202 status reflects that the API has accepted the dispatch — delivery itself is asynchronous on Resend's side.

```json
{
  "status_code": 202,
  "message": "welcome email dispatched",
  "data": {
    "message_id": "71f3f9c8-7c8d-4c2a-9c1f-2b1c9d4f8e3a"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `message_id` | string | Resend's email id. Echoed back so the client (and support) can correlate with the Resend dashboard. |

**Failure — Resend upstream error**

```json
{
  "status_code": 502,
  "message": "upstream email provider failed"
}
```

**Failure — unknown locale**

```json
{
  "status_code": 400,
  "message": "invalid language"
}
```

**Failure — validation error**

```json
{
  "status_code": 400,
  "message": "Invalid request body",
  "data": [
    { "field": "Email", "message": "Email is required" },
    { "field": "Locale", "message": "Locale must be one of [en es]" }
  ]
}
```

---

## Environment

The handler is wired only if the four env vars below are present at startup. Missing values cause the API to fail fast with a clear log line.

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key used to authenticate every send. |
| `EMAIL_FROM` | RFC-5322 From header, e.g. `Open GPS <noreply@open-gps.com>`. |
| `WELCOME_EMAIL_TEMPLATE_EN_ID` | Resend template id for the English welcome email. |
| `WELCOME_EMAIL_TEMPLATE_ES_ID` | Resend template id for the Spanish welcome email. |

## Template Variables

The server passes the following variables to the Resend template engine. Variable names are case-sensitive and must match the placeholders declared on the Resend template.

| Variable | Source | Example |
|----------|--------|---------|
| `first_name` | `request.first_name` | `"Jane"` |
| `temporary_password` | `request.temporary_password` | `"a1b2c3d4e5f6..."` |
| `email` | `request.email` | `"newuser@example.com"` |
