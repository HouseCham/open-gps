# Password Recovery API

Base URL: `/api/v1`

The password recovery flow lets a user who has forgotten their password reset it without an active session. The flow is two endpoints: one to request a single-use reset link by email, one to consume the link and rotate the password.

## Authentication

The two endpoints under `/api/v1/auth/{generate,consume}-pwd-recovery-token` are **public**. A user who has lost their password cannot sign in to recover it. Both are gated only by `RequireInitialized` (the system must already have at least one user) and the standard request-body validation. Neither requires the session cookie, and neither is blocked by `must_change_password`.

The implementation lives entirely on the application side and does NOT touch Authula's built-in `/api/auth/email-password/request-password-reset` route. Tokens, hashing, and email dispatch are all owned by the backend; Authula is only involved at the consume step (the actual password hash rotation).

## Response Envelope

All responses follow the standard envelope:

```json
{
  "status_code": 202,
  "message": "password recovery token requested",
  "data": { ... }
}
```

## Common Error Responses

| Status | Message | Meaning |
|--------|---------|---------|
| 400 | `invalid request body` | Body failed validation (missing fields, bad email, bad URL, weak password, etc.). |
| 400 | `invalid language` | `locale` is not one of the configured languages (`en`, `es`). |
| 400 | `invalid or expired token` | The consume token is unknown, expired, or already used. The three failure modes are deliberately indistinguishable on the wire — callers cannot probe token validity. |
| 503 | `application not initialized` | System has zero users; the user must hit `/api/v1/system/bootstrap` first. |
| 502 | `upstream email provider failed` | The Resend API rejected the call (network error, bad API key, suspended template, etc.). |
| 500 | `internal server error` | Unhandled error. |

---

## Endpoints

### POST /api/v1/auth/generate-pwd-recovery-token

Issues a single-use password-reset token and dispatches a locale-specific email via [Resend](https://resend.com). The frontend builds the full reset URL (origin + path, **without** the token) and passes it here; the server embeds the freshly-generated token in the URL it sends.

**Anti-enumeration:** the response is identical for unknown emails, rate-limited requests, and successful dispatches. The server does not disclose whether the address exists. All three paths answer `202 Accepted`.

**Rate limiting (per IP + per email, sliding 15-minute window):**
- 3 requests per email
- 10 requests per IP

When the cap is hit, the server logs at debug level and the client still gets `202`. The endpoint never returns `429`.

**Request**

```
POST /api/v1/auth/generate-pwd-recovery-token
Content-Type: application/json
```

```json
{
  "email": "user@example.com",
  "locale": "en",
  "reset_password_url": "https://app.example.com/reset?token="
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `email` | string | yes | RFC-5322 email | Recipient address. Rendered in the template as `{{email}}` and used as the `To:` header. |
| `locale` | string | yes | `"en"` or `"es"` | Selects which Resend template to render (`PASSWORD_RESET_EMAIL_TEMPLATE_EN_ID` / `PASSWORD_RESET_EMAIL_TEMPLATE_ES_ID`). |
| `reset_password_url` | string | yes | RFC-3986 URL | The full URL the user will click. The server appends the raw token to this string verbatim, so it must end with the delimiter the frontend expects (typically `?token=`). |

**Response `202 Accepted`**

```json
{
  "status_code": 202,
  "message": "password recovery token requested",
  "data": {
    "message_id": "71f3f9c8-7c8d-4c2a-9c1f-2b1c9d4f8e3a"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `message_id` | string | Resend's email id when dispatch actually happened. Empty string when the request was silently dropped (unknown email or rate-limit hit) — the response shape is the same regardless. |

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

**Failure — unknown locale**

```json
{ "status_code": 400, "message": "invalid language" }
```

**Failure — Resend upstream error**

```json
{ "status_code": 502, "message": "upstream email provider failed" }
```

---

### POST /api/v1/auth/consume-pwd-recovery-token

Validates a token from the email link, rotates the user's Authula password, and clears the local `must_change_password` flag. Single-use: a successful consume stamps `used_at` and a second consume of the same token returns `400 invalid or expired token`.

**Request**

```
POST /api/v1/auth/consume-pwd-recovery-token
Content-Type: application/json
```

```json
{
  "token": "9b3f...64-hex-chars",
  "new_password": "new-password-min-8-chars"
}
```

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `token` | string | yes | 1+ chars | The raw token from the email's `reset_password_url`. Server hashes it (sha256) and looks the row up by hash. |
| `new_password` | string | yes | 8+ chars | The new password. Hashed by Authula; never logged. |

**Response `200 OK`**

```json
{ "status_code": 200, "message": "password reset", "data": false }
```

**Failure — invalid / expired / already-used token**

```json
{ "status_code": 400, "message": "invalid or expired token" }
```

The three failure modes are deliberately indistinguishable on the wire. Callers cannot probe whether a token ever existed, only that it isn't usable now.

**Failure — validation error**

```json
{
  "status_code": 400,
  "message": "Invalid request body",
  "data": [
    { "field": "NewPassword", "message": "NewPassword must be at least 8 characters" }
  ]
}
```

---

## Token Lifecycle

| Phase | What happens |
|-------|--------------|
| Issue | `generate-pwd-recovery-token` writes a row to `password_reset_tokens` containing the sha256 of a fresh 32-byte random token, the recipient's `user_id`, the request IP, and `expires_at = NOW() + 1h`. Any prior outstanding (unused, unexpired) tokens for the same user are marked used first — only the freshest link works. |
| Dispatch | The raw token is appended to the caller's `reset_password_url` and sent in the email. The DB never sees the raw token; only the hash. |
| Consume | `consume-pwd-recovery-token` hashes the incoming token, looks it up, verifies it is unused and unexpired, stamps `used_at`, then rotates the Authula password and clears `must_change_password` on the local user. |
| Race | The `MarkUsed` SQL includes `AND used_at IS NULL`, so a concurrent second consume affects zero rows. The service treats that as `invalid or expired token`. |
| Expiry | A token whose `expires_at < NOW()` is invisible to the lookup query — consumed returns `invalid or expired token`. |

The token TTL is **1 hour** (OWASP / Auth0 / GitHub default). The DB does not auto-purge expired tokens; see [Environment](#environment) for cleanup notes.

---

## Environment

The handler is wired only if the env vars below are present at startup. Missing values cause the API to fail fast with a clear log line. Welcome and reset templates are loaded independently — a missing welcome template does NOT block the reset endpoint and vice versa.

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key used to authenticate every send. |
| `EMAIL_FROM` | RFC-5322 From header, e.g. `Open GPS <noreply@open-gps.com>`. |
| `PASSWORD_RESET_EMAIL_TEMPLATE_EN_ID` | Resend template id for the English password-reset email. |
| `PASSWORD_RESET_EMAIL_TEMPLATE_ES_ID` | Resend template id for the Spanish password-reset email. |

## Template Variables

The server passes the following variables to the Resend template engine. Variable names are case-sensitive and must match the placeholders declared on the Resend template.

| Variable | Source | Example |
|----------|--------|---------|
| `first_name` | local `users.name` | `"Jane"` |
| `email` | recipient address | `"user@example.com"` |
| `reset_password_url` | `request.reset_password_url` + raw token | `"https://app.example.com/reset?token=9b3f…"` |

## Database

The flow uses a single new table — see `migrate/migrations/000018_create_password_reset_tokens.up.sql`. The `token_hash` column stores the sha256 of the raw token (so a DB leak does not yield working reset links). The `ip_address` column supports the per-IP rate-limit probe. Cleanup of expired rows is not automated; a nightly `DELETE FROM password_reset_tokens WHERE created_at < NOW() - INTERVAL '7 days'` is the trivial version to add once the table grows past ~100k rows.
