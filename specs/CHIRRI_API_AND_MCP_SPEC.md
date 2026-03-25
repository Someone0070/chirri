# CHIRRI API & MCP SERVER SPECIFICATION

**Version:** 1.0
**Date:** 2026-03-24
**Status:** Definitive API Reference
**Source of Truth for:** All REST endpoints, MCP tools, request/response schemas

A developer should be able to implement every endpoint from this document alone. Cross-references to the Bible are noted where deeper context exists.

---

## TABLE OF CONTENTS

- [1. Global Conventions](#1-global-conventions)
- [2. Authentication](#2-authentication)
- [3. Error Handling](#3-error-handling)
- [4. Pagination](#4-pagination)
- [5. Rate Limiting](#5-rate-limiting)
- [6. API Endpoints](#6-api-endpoints)
  - [6.1 Auth](#61-auth)
  - [6.2 API Keys](#62-api-keys)
  - [6.3 URLs](#63-urls)
  - [6.4 Changes](#64-changes)
  - [6.5 Forecasts](#65-forecasts)
  - [6.6 Check History](#66-check-history)
  - [6.7 Sources](#67-sources)
  - [6.8 Webhooks](#68-webhooks)
  - [6.9 Providers](#69-providers)
  - [6.10 Notifications](#610-notifications)
  - [6.11 Account](#611-account)
  - [6.12 Health & Internal](#612-health--internal)
- [7. Webhook Events](#7-webhook-events)
- [8. MCP Server Specification](#8-mcp-server-specification)
  - [8.1 Architecture](#81-architecture)
  - [8.2 Tools](#82-tools)
  - [8.3 Installation & Configuration](#83-installation--configuration)

---

# 1. GLOBAL CONVENTIONS

## Base URL

```
https://api.chirri.io/v1
```

Versioning via URL path. All endpoints are prefixed with `/v1/`.

## CORS

```typescript
cors({
  origin: process.env.DASHBOARD_ORIGIN || 'https://chirri.io',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
})
```

## Response Envelope

**Single object:**
```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.stripe.com/v1/prices",
  "status": "active"
}
```

**List:**
```json
{
  "data": [...],
  "has_more": true,
  "next_cursor": "cur_eyJjcmVhdGVkX2F0IjoiMjAyNi0wMy0yM1..."
}
```

**Error:**
```json
{
  "error": {
    "code": "invalid_input",
    "message": "URL must start with http:// or https://",
    "status": 422,
    "details": [
      { "field": "url", "message": "Invalid URL format" }
    ]
  }
}
```

## ID Format

Prefixed nanoid(21), generated app-side.

| Entity | Prefix | Example |
|---|---|---|
| User | `usr_` | `usr_a1b2c3d4e5f6g7h8i9j0k` |
| URL | `url_` | `url_e5f6g7h8i9j0k1l2m3n4o` |
| Change | `chg_` | `chg_i9j0k1l2m3n4o5p6q7r8s` |
| Webhook | `wh_` | `wh_q7r8s9t0u1v2w3x4y5z6a` |
| Forecast | `frc_` | `frc_m3n4o5p6q7r8s9t0u1v2w` |
| API Key | `ck_live_` / `ck_test_` | `ck_live_a1b2c3d4e5f6g7h8i9j0k` |
| Secret | `sec_` | `sec_x1y2z3a4b5c6d7e8f9g0h` |

## Dates

ISO 8601 UTC: `"2026-03-23T14:32:00Z"`

## Enums

```typescript
type Severity = "critical" | "high" | "medium" | "low";
type WorkflowState = "new" | "tracked" | "ignored" | "snoozed" | "resolved";
type UrlStatus = "learning" | "calibrating" | "active" | "paused" | "error" | "degraded" | "auth_required" | "redirect_detected" | "limited" | "monitoring_empty";
type ChangeType = "schema" | "status_code" | "header" | "content" | "redirect" | "timing" | "tls" | "error_format" | "availability" | "rate_limit";
type ConfirmationStatus = "pending" | "stage1_confirmed" | "stage2_confirmed" | "confirmed" | "reverted" | "unstable";
type Plan = "free" | "personal" | "team" | "business";
type CheckInterval = "1m" | "5m" | "15m" | "1h" | "6h" | "24h";
```

---

# 2. AUTHENTICATION

Two auth mechanisms, both accepted on most endpoints:

## Session Cookie (Dashboard)

Set by `POST /v1/auth/login`. HttpOnly, SameSite=Lax, Secure, Domain=.chirri.io. Managed by better-auth.

CSRF protection: `X-CSRF-Token` header + Origin/Referer verification on state-changing requests.

## API Key (Programmatic)

```
Authorization: Bearer ck_live_a1b2c3d4e5f6g7h8i9j0k
```

Two modes:
- `ck_live_*` — production, full access
- `ck_test_*` — test mode, returns mock data, no real HTTP requests

API keys have full read/write access (no per-resource scoping in V1). Scoped tokens planned for V1.1.

**Endpoints that ONLY accept session cookie:**
- `POST /v1/api-keys` (creating API keys)
- `POST /v1/account/delete` (account deletion)
- `POST /v1/account/billing/checkout` (Stripe checkout)

**Endpoints that accept EITHER:**
- All other authenticated endpoints

---

# 3. ERROR HANDLING

## Error Response Format

Inspired by Stripe's error format (simple, flat, predictable):

```typescript
// Zod schema
const ErrorResponse = z.object({
  error: z.object({
    code: z.string(),        // machine-readable code
    message: z.string(),     // human-readable message
    status: z.number(),      // HTTP status code (redundant but convenient)
    details: z.array(z.object({
      field: z.string().optional(),
      message: z.string(),
    })).optional(),           // validation errors only
    retry_after: z.number().optional(),  // seconds, for 429 responses
  }),
});
```

## Error Codes

| Code | HTTP | When |
|---|---|---|
| `unauthorized` | 401 | No/invalid session or API key |
| `invalid_credentials` | 401 | Wrong email/password (same message regardless of which is wrong) |
| `account_locked` | 403 | Too many failed login attempts |
| `forbidden` | 403 | Valid auth but no access (wrong tenant, wrong plan) |
| `not_found` | 404 | Resource doesn't exist or belongs to another user |
| `invalid_input` | 422 | Zod validation failure (details array populated) |
| `invalid_url` | 422 | URL format invalid or fails SSRF check |
| `invalid_cursor` | 422 | Pagination cursor expired or malformed |
| `duplicate_url` | 409 | User already monitors this URL |
| `duplicate_webhook` | 409 | Webhook with same URL already exists |
| `plan_limit_reached` | 403 | URL/webhook/interval limit exceeded |
| `interval_not_available` | 403 | Requested interval requires higher plan |
| `rate_limited` | 429 | Too many requests (includes `retry_after`) |
| `invalid_status_transition` | 409 | Workflow state change not allowed |
| `check_in_progress` | 409 | Manual check already running |
| `already_acknowledged` | 409 | Forecast/change already in target state |
| `ssrf_blocked` | 422 | URL resolves to private/internal IP |
| `dns_resolution_failed` | 422 | Hostname doesn't resolve |
| `self_referential` | 422 | chirri.io domain blocked |
| `check_timeout` | 504 | Sync check exceeded 30s |
| `server_error` | 500 | Internal error |

Never reveal whether an email exists. Login and forgot-password return the same error for invalid email and wrong password.

---

# 4. PAGINATION

Cursor-based pagination. Cursor is opaque base64 encoding of `(created_at, id)`.

## Request Parameters

```typescript
const PaginationParams = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),  // opaque, from previous response
  order: z.enum(["asc", "desc"]).default("desc"),
});
```

## Response

```typescript
interface PaginatedResponse<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;  // null when no more pages
}
```

**Why cursor-based:** Consistent results under concurrent writes. Offset-based pagination breaks when items are inserted/deleted between pages. Our data is append-heavy (changes, checks) making cursor ideal.

---

# 5. RATE LIMITING

## Headers (every response)

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1711234567
```

`X-RateLimit-Reset` is Unix timestamp of window reset. Follows IETF draft `RateLimit` header semantics.

## Limits by Plan

| Plan | Requests/Hour |
|---|---|
| Unauthenticated | 20/IP |
| Free | 10 |
| Personal | 60 |
| Team | 200 |
| Business | 500 |

Implementation: Redis sorted set sliding window per hour, keyed by `ratelimit:{api_key_hash}:{hour}` or `ratelimit:ip:{ip}:{hour}`.

## Per-Endpoint Overrides

Some endpoints have tighter limits (noted on each endpoint below). These are additional constraints on top of plan limits.

---

# 6. API ENDPOINTS

## 6.1 Auth

### POST /v1/auth/signup

Create a new account.

- **Auth:** None
- **Rate Limit:** 5/min per IP

**Request:**
```typescript
const SignupRequest = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
});
```

**Response (201):**
```typescript
interface SignupResponse {
  id: string;           // usr_...
  email: string;
  name: string | null;
  plan: "free";
  email_verified: false;
  created_at: string;
}
```

**Errors:** 422 `invalid_input` (bad email/password), 409 `duplicate_email` (email taken — but never reveal this; return generic 422 "Unable to create account" to prevent enumeration)

**Example:**
```json
// Request
POST /v1/auth/signup
{
  "email": "dev@example.com",
  "password": "securepassword123",
  "name": "Alex Dev"
}

// Response 201
{
  "id": "usr_a1b2c3d4e5f6g7h8i9j0k",
  "email": "dev@example.com",
  "name": "Alex Dev",
  "plan": "free",
  "email_verified": false,
  "created_at": "2026-03-24T14:00:00Z"
}
```

Triggers: verification email sent via Resend.

---

### POST /v1/auth/login

Authenticate and set session cookie.

- **Auth:** None
- **Rate Limit:** 20/min per IP

**Request:**
```typescript
const LoginRequest = z.object({
  email: z.string().email(),
  password: z.string(),
});
```

**Response (200):**
```typescript
interface LoginResponse {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  email_verified: boolean;
}
```

Sets `Set-Cookie` header with session cookie (HttpOnly, SameSite=Lax, Secure, Domain=.chirri.io).

**Errors:** 401 `invalid_credentials` (wrong email OR wrong password — same message), 403 `account_locked` (after 5 failures, locked for 15 min)

**Example:**
```json
// Request
POST /v1/auth/login
{ "email": "dev@example.com", "password": "securepassword123" }

// Response 200
{
  "id": "usr_a1b2c3d4e5f6g7h8i9j0k",
  "email": "dev@example.com",
  "name": "Alex Dev",
  "plan": "personal",
  "email_verified": true
}
```

---

### POST /v1/auth/logout

End session (revoke current or all sessions).

- **Auth:** Session cookie
- **Rate Limit:** Plan default

**Request:**
```typescript
const LogoutRequest = z.object({
  all_sessions: z.boolean().default(false),  // true = revoke all sessions
});
```

**Response (204):** No body. Clears session cookie.

---

### POST /v1/auth/verify-email

Verify email address with token from verification email.

- **Auth:** None
- **Rate Limit:** Plan default

**Request:**
```typescript
const VerifyEmailRequest = z.object({
  token: z.string(),
});
```

**Response (200):**
```json
{ "message": "Email verified successfully" }
```

**Errors:** 422 `invalid_token`, 422 `token_expired`

---

### POST /v1/auth/forgot-password

Request a password reset email.

- **Auth:** None
- **Rate Limit:** 3/hr per email

**Request:**
```typescript
const ForgotPasswordRequest = z.object({
  email: z.string().email(),
});
```

**Response (200):** Always returns success, even for non-existent emails (prevents enumeration).
```json
{ "message": "If an account with that email exists, a reset link has been sent." }
```

---

### POST /v1/auth/reset-password

Reset password with token from email.

- **Auth:** None
- **Rate Limit:** Plan default

**Request:**
```typescript
const ResetPasswordRequest = z.object({
  token: z.string(),
  password: z.string().min(8).max(128),
});
```

**Response (200):**
```json
{ "message": "Password reset successfully" }
```

**Errors:** 422 `invalid_token`, 422 `token_expired`

---

### POST /v1/auth/change-password

Change password (requires current password).

- **Auth:** Session cookie
- **Rate Limit:** Plan default

**Request:**
```typescript
const ChangePasswordRequest = z.object({
  current_password: z.string(),
  new_password: z.string().min(8).max(128),
});
```

**Response (200):**
```json
{ "message": "Password changed successfully" }
```

**Errors:** 401 `invalid_credentials` (wrong current password)

---

### GET /v1/auth/me

Get current authenticated user's profile.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface MeResponse {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  email_verified: boolean;
  timezone: string;
  notification_defaults: NotificationDefaults;
  onboarding_step: number;
  created_at: string;
}

interface NotificationDefaults {
  email: boolean;
  min_severity: Severity;
  quiet_hours: { start: string; end: string; timezone: string } | null;
  digest_mode: "daily" | "weekly" | null;
  slack_webhook_url: string | null;
  discord_webhook_url: string | null;
}
```

---

## 6.2 API Keys

### POST /v1/api-keys

Create a new API key.

- **Auth:** Session cookie ONLY (cannot create keys via API key)
- **Rate Limit:** Plan default

**Request:**
```typescript
const CreateApiKeyRequest = z.object({
  name: z.string().min(1).max(100),
  mode: z.enum(["live", "test"]).default("live"),
});
```

**Response (201):**
```typescript
interface CreateApiKeyResponse {
  id: string;
  name: string;
  mode: "live" | "test";
  key: string;         // ONLY returned on creation, never again
  prefix: string;      // "ck_live_a1b2" (first 12 chars)
  created_at: string;
}
```

**The `key` field is only returned once.** Store it securely. Subsequent GET requests only show prefix + suffix.

**Example:**
```json
// Request
POST /v1/api-keys
{ "name": "CI/CD Pipeline", "mode": "live" }

// Response 201
{
  "id": "key_m3n4o5p6q7r8s9t0u1v2w",
  "name": "CI/CD Pipeline",
  "mode": "live",
  "key": "ck_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "prefix": "ck_live_a1b2",
  "created_at": "2026-03-24T14:00:00Z"
}
```

---

### GET /v1/api-keys

List all API keys for the authenticated user.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface ApiKeyListItem {
  id: string;
  name: string;
  mode: "live" | "test";
  prefix: string;        // first 12 chars
  suffix: string;        // last 4 chars
  last_used_at: string | null;
  created_at: string;
}
```

**Example:**
```json
{
  "data": [
    {
      "id": "key_m3n4o5p6q7r8s9t0u1v2w",
      "name": "CI/CD Pipeline",
      "mode": "live",
      "prefix": "ck_live_a1b2",
      "suffix": "o5p6",
      "last_used_at": "2026-03-24T10:00:00Z",
      "created_at": "2026-03-24T14:00:00Z"
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

---

### PATCH /v1/api-keys/:id

Rename an API key.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const UpdateApiKeyRequest = z.object({
  name: z.string().min(1).max(100),
});
```

**Response (200):** Updated `ApiKeyListItem`.

---

### DELETE /v1/api-keys/:id

Revoke an API key. Takes effect immediately.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (204):** No body.

**Errors:** 404 `not_found`

---

## 6.3 URLs

### POST /v1/urls

Add a URL to monitor. **Async after SSRF check** — returns 201 with `status: "classifying"` immediately. Classification runs in background worker with SSE progress updates.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const CreateUrlRequest = z.object({
  url: z.string().url().max(2048),
  name: z.string().max(200).optional(),
  method: z.enum(["GET", "POST"]).default("GET"),
  headers: z.record(z.string()).optional(),  // custom headers (Personal+ only)
  body: z.string().optional(),               // for POST monitoring
  check_interval: z.enum(["1m", "5m", "15m", "1h", "6h", "24h"]).default("24h"),
  tags: z.array(z.string().max(50)).max(10).optional(),
  notification_config: z.object({
    email: z.boolean().optional(),
    webhook_ids: z.array(z.string()).optional(),
    min_severity: z.enum(["critical", "high", "medium", "low"]).optional(),
    slack_enabled: z.boolean().optional(),
    discord_enabled: z.boolean().optional(),
    digest_mode: z.enum(["daily", "weekly"]).nullable().optional(),
  }).optional(),
  source_preferences: z.record(z.object({
    min_severity: z.enum(["critical", "high", "medium", "low"]).optional(),
    digest: z.enum(["immediate", "daily", "weekly"]).optional(),
    alert_enabled: z.boolean().optional(),
  })).optional(),
  post_consent: z.boolean().optional(),  // required true for POST monitoring
});
```

**Response (201):**
```typescript
interface CreateUrlResponse {
  id: string;               // url_...
  url: string;
  name: string | null;
  status: "classifying";
  method: "GET" | "POST";
  check_interval: CheckInterval;
  tags: string[];
  provider: {               // null if unknown domain
    slug: string;
    name: string;
    sources: ProviderSource[];
  } | null;
  created_at: string;
}

interface ProviderSource {
  id: string;
  type: string;              // "openapi_spec", "changelog", "status_page", "sdk"
  name: string;
  url: string;
  bundled: boolean;
  alert_enabled: boolean;
}
```

**Errors:** 422 `invalid_url`, 422 `ssrf_blocked`, 422 `dns_resolution_failed`, 422 `self_referential`, 403 `plan_limit_reached`, 403 `interval_not_available`, 409 `duplicate_url`

**Example:**
```json
// Request
POST /v1/urls
{
  "url": "https://api.stripe.com/v1/prices",
  "name": "Stripe Prices API",
  "check_interval": "1h",
  "tags": ["payments", "critical"]
}

// Response 201
{
  "id": "url_e5f6g7h8i9j0k1l2m3n4o",
  "url": "https://api.stripe.com/v1/prices",
  "name": "Stripe Prices API",
  "status": "classifying",
  "method": "GET",
  "check_interval": "1h",
  "tags": ["payments", "critical"],
  "provider": {
    "slug": "stripe",
    "name": "Stripe",
    "sources": [
      { "id": "src_abc", "type": "openapi_spec", "name": "Stripe OpenAPI Spec", "url": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json", "bundled": true, "alert_enabled": true },
      { "id": "src_def", "type": "changelog", "name": "Stripe Changelog", "url": "https://stripe.com/docs/changelog", "bundled": true, "alert_enabled": true },
      { "id": "src_ghi", "type": "status_page", "name": "Stripe Status", "url": "https://status.stripe.com/api/v2/summary.json", "bundled": true, "alert_enabled": true }
    ]
  },
  "created_at": "2026-03-24T14:00:00Z"
}
```

**SSE Progress Events (sent to user via SSE channel):**
```typescript
// During classification:
{ type: "classification_stage", urlId: string, stage: 1-5, label: string }
// On completion:
{ type: "classification_complete", urlId: string, result: { contentType: string, method: string } }
// On learning progress:
{ type: "learning_progress", urlId: string, current: number, total: 30 }
// On learning complete:
{ type: "learning_complete", urlId: string }
```

---

### GET /v1/urls

List monitored URLs with filters and pagination.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Query Parameters:**
```typescript
const ListUrlsParams = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(["learning", "calibrating", "active", "paused", "error", "degraded", "auth_required", "redirect_detected", "limited", "monitoring_empty"]).optional(),
  tag: z.string().optional(),
  search: z.string().max(200).optional(),  // searches url and name
  order: z.enum(["asc", "desc"]).default("desc"),
});
```

**Response (200):**
```typescript
interface UrlListItem {
  id: string;
  url: string;
  name: string | null;
  status: UrlStatus;
  method: "GET" | "POST";
  check_interval: CheckInterval;
  content_type: string | null;
  monitoring_method: string | null;
  tags: string[];
  last_check_at: string | null;
  next_check_at: string | null;
  recent_change_count: number;    // changes in last 7 days
  provider_slug: string | null;
  created_at: string;
}

// Wrapped in PaginatedResponse<UrlListItem>
```

---

### GET /v1/urls/:id

Get full URL detail with stats and recent changes.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface UrlDetail {
  id: string;
  url: string;
  name: string | null;
  status: UrlStatus;
  status_reason: string | null;
  method: "GET" | "POST";
  check_interval: CheckInterval;
  content_type: string | null;
  monitoring_method: string | null;
  classification_confidence: number | null;
  confidence_threshold: number;
  volatile_fields: string[];
  tags: string[];
  notification_config: {
    email: boolean | null;
    webhook_ids: string[];
    min_severity: Severity | null;
    slack_enabled: boolean | null;
    discord_enabled: boolean | null;
    digest_mode: "daily" | "weekly" | null;
  };
  provider: {
    slug: string;
    name: string;
  } | null;
  stats: {
    total_checks: number;
    total_changes: number;
    uptime_pct: number;           // last 30 days
    avg_response_time_ms: number; // last 30 days
    last_change_at: string | null;
  };
  learning_progress: {            // null if not learning
    current: number;
    total: number;
    started_at: string;
    eta: string | null;
  } | null;
  sources: ProviderSource[];      // bundled + user-added sources
  last_check_at: string | null;
  next_check_at: string | null;
  paused_at: string | null;
  created_at: string;
  updated_at: string;
}
```

**Errors:** 404 `not_found`

---

### PATCH /v1/urls/:id

Update URL settings.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const UpdateUrlRequest = z.object({
  name: z.string().max(200).optional(),
  check_interval: z.enum(["1m", "5m", "15m", "1h", "6h", "24h"]).optional(),
  status: z.enum(["active", "paused"]).optional(),  // only these transitions allowed
  confidence_threshold: z.number().int().min(50).max(100).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  notification_config: z.object({
    email: z.boolean().nullable().optional(),
    webhook_ids: z.array(z.string()).optional(),
    min_severity: z.enum(["critical", "high", "medium", "low"]).nullable().optional(),
    slack_enabled: z.boolean().nullable().optional(),
    discord_enabled: z.boolean().nullable().optional(),
    digest_mode: z.enum(["daily", "weekly"]).nullable().optional(),
  }).optional(),
});
```

**Response (200):** Updated `UrlDetail`.

**Errors:** 404 `not_found`, 403 `interval_not_available`, 409 `invalid_status_transition`

---

### DELETE /v1/urls/:id

Delete a monitored URL. Stops monitoring. Change history retained per plan retention policy.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (204):** No body.

**Errors:** 404 `not_found`

---

### POST /v1/urls/bulk

Bulk import URLs. Max 100 per request. Returns HTTP 207 Multi-Status.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const BulkCreateRequest = z.object({
  urls: z.array(z.object({
    url: z.string().url().max(2048),
    name: z.string().max(200).optional(),
    check_interval: z.enum(["1m", "5m", "15m", "1h", "6h", "24h"]).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  })).min(1).max(100),
});
```

**Response (207):**
```typescript
interface BulkCreateResponse {
  results: Array<{
    url: string;
    status: 201 | 400 | 403 | 409 | 422;
    id?: string;             // present on success
    error?: string;          // error code on failure
  }>;
  summary: {
    created: number;
    failed: number;
  };
}
```

URLs processed sequentially. When plan limit hit, remaining URLs return `400 skipped_after_limit`.

**Example:**
```json
// Response 207
{
  "results": [
    { "url": "https://api.stripe.com/v1/prices", "status": 201, "id": "url_abc" },
    { "url": "https://api.github.com/repos", "status": 201, "id": "url_def" },
    { "url": "https://api.openai.com/v1/models", "status": 403, "error": "plan_limit_reached" },
    { "url": "https://api.twilio.com/v1/messages", "status": 400, "error": "skipped_after_limit" }
  ],
  "summary": { "created": 2, "failed": 2 }
}
```

---

### DELETE /v1/urls/bulk

Bulk delete URLs.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const BulkDeleteRequest = z.object({
  ids: z.array(z.string()).min(1).max(100),
});
```

**Response (200):**
```json
{
  "deleted": 3,
  "not_found": ["url_xyz"]
}
```

---

### GET /v1/urls/export

Export all URLs in re-importable format.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface UrlExport {
  exported_at: string;
  urls: Array<{
    url: string;
    name: string | null;
    check_interval: CheckInterval;
    tags: string[];
  }>;
}
```

---

### POST /v1/urls/:id/check

Trigger an immediate check.

- **Auth:** Session cookie or API key
- **Rate Limit:** 10/hr per URL

**Query Parameters:**
```typescript
const CheckNowParams = z.object({
  wait: z.boolean().default(false),  // true = synchronous (30s max)
});
```

**Response (202) — async (default):**
```json
{
  "job_id": "job_a1b2c3d4",
  "message": "Check queued"
}
```

**Response (200) — sync (`?wait=true`):**
```typescript
interface CheckResult {
  id: string;
  status_code: number;
  response_time_ms: number;
  body_size_bytes: number;
  change_detected: boolean;
  change_id: string | null;     // if change detected
  checked_at: string;
}
```

**Errors:** 409 `check_in_progress`, 504 `check_timeout` (sync mode exceeded 30s, includes `job_id`)

---

## 6.4 Changes

### GET /v1/changes

List detected changes with filters and pagination.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Query Parameters:**
```typescript
const ListChangesParams = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  url_id: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  change_type: z.enum(["schema", "status_code", "header", "content", "redirect", "timing", "tls", "error_format", "availability", "rate_limit"]).optional(),
  workflow_state: z.enum(["new", "tracked", "ignored", "snoozed", "resolved"]).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});
```

**Response (200):**
```typescript
interface ChangeListItem {
  id: string;               // chg_...
  url_id: string;
  url_name: string | null;
  url: string;
  change_type: ChangeType;
  severity: Severity;
  confidence: number;
  summary: string;
  workflow_state: WorkflowState;
  snoozed_until: string | null;
  confirmation_status: ConfirmationStatus;
  source_name: string | null;  // which source detected it
  detected_at: string;
  created_at: string;
}

// Wrapped in PaginatedResponse<ChangeListItem>
```

---

### GET /v1/changes/:id

Get full change detail with diff and actions.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface ChangeDetail {
  id: string;
  url_id: string;
  url: string;
  url_name: string | null;
  change_type: ChangeType;
  severity: Severity;
  confidence: number;
  summary: string;
  diff: object;                  // jsondiffpatch format or unified diff
  actions: Array<{
    type: string;                // "migration_link", "docs_link", "code_example"
    label: string;
    url?: string;
    content?: string;
  }>;
  workflow_state: WorkflowState;
  snoozed_until: string | null;
  note: string | null;
  feedback: "real_change" | "false_positive" | "not_sure" | null;
  feedback_comment: string | null;
  confirmation_status: ConfirmationStatus;
  confirmed_at: string | null;
  previous_snapshot: {
    status_code: number;
    headers: Record<string, string>;
    body_preview: string;        // first 10KB
    body_r2_url: string;         // presigned URL for full body
  };
  current_snapshot: {
    status_code: number;
    headers: Record<string, string>;
    body_preview: string;
    body_r2_url: string;
  };
  source_name: string | null;
  detected_at: string;
  created_at: string;
}
```

**Errors:** 404 `not_found`

---

### POST /v1/changes/:id/track

Mark change as tracked.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const WorkflowActionRequest = z.object({
  note: z.string().max(1000).optional(),
});
```

**Response (200):**
```json
{
  "id": "chg_i9j0k1l2m3n4o5p6q7r8s",
  "workflow_state": "tracked",
  "note": "Will migrate next sprint"
}
```

**Errors:** 404 `not_found`, 409 `invalid_status_transition`

---

### POST /v1/changes/:id/ignore

Mark change as ignored.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:** Same as `WorkflowActionRequest`.

**Response (200):** Same shape with `"workflow_state": "ignored"`.

---

### POST /v1/changes/:id/snooze

Snooze until a future date.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const SnoozeRequest = z.object({
  until: z.string().datetime(),          // required
  note: z.string().max(1000).optional(),
});
```

**Response (200):**
```json
{
  "id": "chg_i9j0k1l2m3n4o5p6q7r8s",
  "workflow_state": "snoozed",
  "snoozed_until": "2026-06-01T00:00:00Z",
  "note": "Revisit after Q2 sprint"
}
```

When snooze expires, state returns to `new`.

---

### POST /v1/changes/:id/resolve

Mark change as resolved.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:** Same as `WorkflowActionRequest`.

**Response (200):** Same shape with `"workflow_state": "resolved"`.

---

### DELETE /v1/changes/:id/workflow

Reset workflow state to "new" (re-open for triage).

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```json
{
  "id": "chg_i9j0k1l2m3n4o5p6q7r8s",
  "workflow_state": "new",
  "note": null,
  "snoozed_until": null
}
```

---

### POST /v1/changes/:id/feedback

Submit quality feedback on a detected change.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const FeedbackRequest = z.object({
  feedback: z.enum(["real_change", "false_positive", "not_sure"]),
  comment: z.string().max(500).optional(),
});
```

**Response (200):**
```json
{
  "id": "chg_i9j0k1l2m3n4o5p6q7r8s",
  "feedback": "false_positive",
  "feedback_comment": "This is a timestamp field that always changes"
}
```

`false_positive` feedback suppresses the field for THIS USER ONLY. Never modifies shared volatile lists.

---

### PATCH /v1/changes/:id/feedback

Update existing feedback.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request/Response:** Same as POST.

---

### GET /v1/changes/summary

Aggregated change stats for dashboard widgets.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface ChangesSummary {
  by_severity: Record<Severity, number>;
  by_type: Record<ChangeType, number>;
  by_workflow_state: Record<WorkflowState, number>;
  total: number;
  since: string;   // default: last 30 days
}
```

---

### GET /v1/changes/:id/impact

Get AI-generated impact analysis for a change. This uses LLM summarization to explain what the change means for the user's integration.

- **Auth:** Session cookie or API key
- **Rate Limit:** 20/hr (LLM calls are expensive)

**Response (200):**
```typescript
interface ImpactAnalysis {
  change_id: string;
  summary: string;                // 1-2 sentence plain English summary
  impact_level: "breaking" | "potentially_breaking" | "additive" | "cosmetic";
  affected_areas: string[];       // ["billing", "webhooks", "authentication"]
  migration_steps: string[];      // ordered list of migration actions
  code_examples: Array<{
    language: string;
    before: string;
    after: string;
    description: string;
  }>;
  related_docs: Array<{
    title: string;
    url: string;
  }>;
  generated_at: string;
  model: string;                  // which LLM generated this
}
```

**Errors:** 404 `not_found`, 503 `llm_unavailable`

---

## 6.5 Forecasts

### GET /v1/forecasts

List active early warning forecasts.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Query Parameters:**
```typescript
const ListForecastsParams = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(["active", "acknowledged", "dismissed", "expired"]).optional(),
  signal_type: z.string().optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  url_id: z.string().optional(),
});
```

**Response (200):**
```typescript
interface ForecastListItem {
  id: string;             // frc_...
  url_id: string;
  url_name: string | null;
  signal_type: string;    // "deprecation_header", "changelog_sunset", "version_eol"
  alert_level: string;
  severity: Severity;
  title: string;
  description: string;
  deadline: string | null;
  acknowledged: boolean;
  status: "active" | "acknowledged" | "dismissed" | "expired";
  created_at: string;
}
```

---

### GET /v1/forecasts/:id

Full forecast detail with timeline and evidence.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface ForecastDetail {
  id: string;
  url_id: string;
  url: string;
  url_name: string | null;
  signal_type: string;
  alert_level: string;
  severity: Severity;
  title: string;
  description: string;
  deadline: string | null;
  deadline_source: string | null;
  affected_endpoints: string[];
  source: string;             // "changelog", "deprecation_header", "status_page"
  source_url: string;
  confidence: number;
  evidence: Array<{
    type: string;
    description: string;
    detected_at: string;
  }>;
  timeline: Array<{
    date: string;
    event: string;
  }>;
  acknowledged: boolean;
  reminders_muted: boolean;
  status: "active" | "acknowledged" | "dismissed" | "expired";
  created_at: string;
}
```

---

### POST /v1/forecasts/:id/acknowledge

Acknowledge a forecast (optionally mute reminders).

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const AcknowledgeRequest = z.object({
  mute_reminders: z.boolean().default(false),
});
```

**Response (200):**
```json
{
  "id": "frc_m3n4o5p6q7r8s9t0u1v2w",
  "acknowledged": true,
  "reminders_muted": false,
  "status": "acknowledged"
}
```

---

### POST /v1/forecasts/:id/dismiss

Dismiss a forecast with a reason.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const DismissRequest = z.object({
  reason: z.enum(["false_positive", "not_relevant", "already_migrated"]),
});
```

**Response (200):**
```json
{
  "id": "frc_m3n4o5p6q7r8s9t0u1v2w",
  "status": "dismissed"
}
```

---

### GET /v1/forecasts/summary

Dashboard widget data.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface ForecastsSummary {
  active_count: number;
  next_deadline: string | null;
  by_severity: Record<Severity, number>;
  by_signal_type: Record<string, number>;
}
```

---

## 6.6 Check History

### GET /v1/urls/:id/checks

Paginated check results for a URL.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Query Parameters:**
```typescript
const ListChecksParams = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  status: z.enum(["success", "error"]).optional(),
});
```

History depth: Free=7d, Personal=30d, Team=90d, Business=365d.

**Response (200):**
```typescript
interface CheckResultItem {
  id: string;
  status_code: number | null;
  response_time_ms: number | null;
  body_size_bytes: number | null;
  error: string | null;
  change_detected: boolean;
  change_id: string | null;
  checked_at: string;
}
```

---

## 6.7 Sources

### GET /v1/urls/:id/sources

List all sources (bundled + user-added) for a URL/provider.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface SourceItem {
  id: string;
  type: string;                    // "openapi_spec", "changelog", "status_page", "sdk", "npm", "pypi"
  name: string;
  url: string;
  bundled: boolean;
  check_interval: string;
  status: "active" | "paused" | "orphaned";
  last_check_at: string | null;
  alert_preferences: {
    alert_enabled: boolean;
    min_severity: Severity | null;     // null = inherit from account
    digest: "immediate" | "daily" | "weekly" | null;
    channels: string[] | null;         // null = inherit
  };
}
```

---

### PATCH /v1/urls/:id/sources/:source_id

Update per-source alert preferences.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const UpdateSourcePrefsRequest = z.object({
  alert_enabled: z.boolean().optional(),
  min_severity: z.enum(["critical", "high", "medium", "low"]).nullable().optional(),
  digest: z.enum(["immediate", "daily", "weekly"]).nullable().optional(),
});
```

**Response (200):** Updated `SourceItem`.

---

### PATCH /v1/urls/:id/sources

Bulk update source preferences.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const BulkUpdateSourcesRequest = z.object({
  source_ids: z.array(z.string()).optional(),     // if omitted, applies to all
  filter_type: z.string().optional(),             // filter by source type
  preferences: z.object({
    alert_enabled: z.boolean().optional(),
    min_severity: z.enum(["critical", "high", "medium", "low"]).nullable().optional(),
    digest: z.enum(["immediate", "daily", "weekly"]).nullable().optional(),
  }),
});
```

**Response (200):**
```json
{ "updated": 4 }
```

---

### POST /v1/urls/:id/sources/:source_id/reset

Reset source preferences to defaults.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):** Updated `SourceItem` with default preferences.

---

## 6.8 Webhooks

### POST /v1/webhooks

Create a webhook endpoint.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const CreateWebhookRequest = z.object({
  url: z.string().url().max(2048),              // HTTPS only, SSRF validated
  name: z.string().max(100).optional(),
  events: z.array(z.string()).min(1),           // see webhook event types
  is_active: z.boolean().default(true),
});
```

**Response (201):**
```typescript
interface WebhookResponse {
  id: string;             // wh_...
  url: string;
  name: string | null;
  events: string[];
  is_active: boolean;
  signing_secret: string; // only returned on creation
  created_at: string;
}
```

**Errors:** 422 `invalid_url`, 422 `ssrf_blocked`, 403 `plan_limit_reached`, 409 `duplicate_webhook`

Plan limits: Free=0, Personal=3, Team=10, Business=unlimited.

---

### GET /v1/webhooks

List webhooks.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface WebhookListItem {
  id: string;
  url: string;
  name: string | null;
  events: string[];
  is_active: boolean;
  consecutive_failures: number;
  last_delivery_at: string | null;
  created_at: string;
}
```

---

### GET /v1/webhooks/:id

Webhook detail with recent deliveries.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface WebhookDetail extends WebhookListItem {
  stats: {
    total_deliveries: number;
    success_count: number;
    failure_count: number;
    avg_response_time_ms: number;
  };
  recent_deliveries: Array<{
    id: string;
    event_type: string;
    status_code: number | null;
    error: string | null;
    attempt_number: number;
    delivered_at: string;
  }>;
}
```

---

### PATCH /v1/webhooks/:id

Update a webhook.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const UpdateWebhookRequest = z.object({
  url: z.string().url().max(2048).optional(),
  name: z.string().max(100).optional(),
  events: z.array(z.string()).min(1).optional(),
  is_active: z.boolean().optional(),
});
```

**Response (200):** Updated `WebhookDetail`.

---

### DELETE /v1/webhooks/:id

Delete a webhook.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (204):** No body.

---

### POST /v1/webhooks/:id/test

Send a test event.

- **Auth:** Session cookie or API key
- **Rate Limit:** 5/hr per webhook

**Response (200):**
```typescript
interface TestDeliveryResult {
  delivery_id: string;
  status_code: number | null;
  response_time_ms: number;
  success: boolean;
  error: string | null;
}
```

---

### POST /v1/webhooks/:id/rotate-secret

Rotate the signing secret.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```json
{
  "signing_secret": "whsec_new_secret_here",
  "rotated_at": "2026-03-24T14:00:00Z"
}
```

---

### GET /v1/webhooks/:id/deliveries

Delivery log for a webhook.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Query Parameters:**
```typescript
const ListDeliveriesParams = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  status: z.enum(["success", "failure"]).optional(),
  since: z.string().datetime().optional(),
});
```

**Response (200):**
```typescript
interface DeliveryItem {
  id: string;
  event_type: string;
  payload_preview: string;       // first 500 chars
  status_code: number | null;
  response_body: string | null;  // first 500 chars
  error: string | null;
  attempt_number: number;
  delivered_at: string;
}
```

Delivery log retained for 30 days.

---

## 6.9 Providers

### GET /v1/providers

List all known providers.

- **Auth:** None (public)
- **Rate Limit:** 20/hr for unauthenticated

**Query Parameters:**
```typescript
const ListProvidersParams = z.object({
  category: z.string().optional(),  // "payments", "ai", "messaging", etc.
});
```

**Response (200):**
```typescript
interface ProviderListItem {
  slug: string;
  name: string;
  company: string | null;
  domains: string[];
  source_count: number;
  category: string;
}
```

---

### GET /v1/providers/search

Search the provider database.

- **Auth:** None (public)
- **Rate Limit:** 20/hr for unauthenticated

**Query Parameters:**
```typescript
const SearchProvidersParams = z.object({
  q: z.string().min(1).max(200),
});
```

**Response (200):** Array of `ProviderListItem` (max 20 results).

---

### GET /v1/providers/:slug

Provider detail with all available sources.

- **Auth:** None (public)
- **Rate Limit:** 20/hr for unauthenticated

**Response (200):**
```typescript
interface ProviderDetail {
  slug: string;
  name: string;
  company: string | null;
  domains: string[];
  sources: Array<{
    type: string;
    name: string;
    url: string;
    monitoring_method: string;
    default_interval: string;
    bundled: boolean;
  }>;
  packages: {
    npm: string[];
    pypi: string[];
  };
}
```

---

## 6.10 Notifications

### GET /v1/notifications

List notification history.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Query Parameters:**
```typescript
const ListNotificationsParams = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  channel: z.enum(["email", "slack", "discord", "webhook"]).optional(),
  since: z.string().datetime().optional(),
  until: z.string().datetime().optional(),
  status: z.enum(["sent", "failed", "queued", "rate_limited"]).optional(),
});
```

**Response (200):**
```typescript
interface NotificationItem {
  id: string;
  channel: string;
  event_type: string;
  recipient: string;
  subject: string;
  status: "sent" | "failed" | "queued" | "rate_limited";
  error: string | null;
  change_id: string | null;
  forecast_id: string | null;
  sent_at: string;
}
```

---

### GET /v1/notifications/preferences

Get notification preferences.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface NotificationPreferences {
  account_defaults: NotificationDefaults;
  per_url_overrides: Array<{
    url_id: string;
    url_name: string | null;
    config: {
      email: boolean | null;
      webhook_ids: string[];
      min_severity: Severity | null;
      slack_enabled: boolean | null;
      discord_enabled: boolean | null;
      digest_mode: "daily" | "weekly" | null;
    };
  }>;
}
```

---

### PATCH /v1/notifications/preferences

Update account-level notification defaults.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const UpdateNotificationPrefsRequest = z.object({
  email: z.boolean().optional(),
  min_severity: z.enum(["critical", "high", "medium", "low"]).optional(),
  quiet_hours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),  // "22:00"
    end: z.string().regex(/^\d{2}:\d{2}$/),    // "08:00"
    timezone: z.string(),
  }).nullable().optional(),
  digest_mode: z.enum(["daily", "weekly"]).nullable().optional(),
  slack_webhook_url: z.string().url().nullable().optional(),
  discord_webhook_url: z.string().url().nullable().optional(),
});
```

Slack/Discord webhook URLs validated: SSRF check + hostname pattern matching (`hooks.slack.com` for Slack, `discord.com/api/webhooks` for Discord).

**Response (200):** Updated `NotificationDefaults`.

---

## 6.11 Account

### GET /v1/account

Current account details with plan limits.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface AccountResponse {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
  email_verified: boolean;
  timezone: string;
  limits: {
    max_urls: number;
    min_interval: CheckInterval;
    history_days: number;
    max_webhooks: number;
    api_rate_limit: number;
  };
  features: {
    api_access: boolean;
    mcp_access: boolean;
    discord_integration: boolean;
    slack_integration: boolean;
    webhook_integration: boolean;
    schema_diff_detail: boolean;
    per_source_severity: boolean;
    per_source_channel_routing: boolean;
    digest_mode: boolean;
  };
  created_at: string;
}
```

---

### PATCH /v1/account

Update account profile.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const UpdateAccountRequest = z.object({
  name: z.string().max(100).optional(),
  timezone: z.string().optional(),
});
```

**Response (200):** Updated `AccountResponse`.

---

### GET /v1/account/usage

Current usage statistics.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface UsageResponse {
  urls: { used: number; limit: number };
  webhooks: { used: number; limit: number };
  api_requests: { used: number; limit: number; window: "hour" };
  checks_this_month: number;
  changes_this_month: number;
  storage_bytes: number;
}
```

---

### GET /v1/account/billing

Billing info and Stripe customer portal link.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```typescript
interface BillingResponse {
  plan: Plan;
  subscription_status: "active" | "past_due" | "canceled" | "trialing" | null;
  current_period_end: string | null;
  payment_method: {
    type: "card";
    last4: string;
    brand: string;
    exp_month: number;
    exp_year: number;
  } | null;
  portal_url: string;   // Stripe customer portal URL
}
```

---

### POST /v1/account/billing/checkout

Create a Stripe Checkout session for plan upgrade.

- **Auth:** Session cookie ONLY
- **Rate Limit:** Plan default

**Request:**
```typescript
const CheckoutRequest = z.object({
  plan: z.enum(["personal", "team", "business"]),
  billing_period: z.enum(["monthly", "yearly"]).default("monthly"),
});
```

**Response (200):**
```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_live_..."
}
```

---

### GET /v1/account/export

Request GDPR data export. Async for large accounts.

- **Auth:** Session cookie or API key
- **Rate Limit:** 1/day

**Response (200):**
```json
{
  "status": "processing",
  "message": "Export will be emailed to dev@example.com when ready",
  "estimated_minutes": 5
}
```

Or if already ready:
```json
{
  "status": "ready",
  "download_url": "https://r2.chirri.io/exports/...",
  "expires_at": "2026-03-25T14:00:00Z"
}
```

---

### POST /v1/account/delete

Request account deletion. 7-day grace period.

- **Auth:** Session cookie ONLY
- **Rate Limit:** Plan default

**Request:**
```typescript
const DeleteAccountRequest = z.object({
  confirmation: z.literal("DELETE MY ACCOUNT"),
});
```

**Response (200):**
```json
{
  "status": "pending_deletion",
  "deletion_scheduled_at": "2026-03-31T14:00:00Z",
  "message": "Account will be permanently deleted in 7 days. You can cancel this via POST /v1/account/cancel-deletion."
}
```

GDPR deletion cascade: all user data across all tables, Stripe subscription canceled, R2 objects cleaned up.

---

### POST /v1/account/cancel-deletion

Cancel a pending deletion.

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Response (200):**
```json
{
  "status": "active",
  "message": "Account deletion cancelled"
}
```

---

### POST /v1/account/email-preferences

Update email notification preferences (which email types to receive).

- **Auth:** Session cookie or API key
- **Rate Limit:** Plan default

**Request:**
```typescript
const EmailPreferencesRequest = z.object({
  onboarding: z.boolean().optional(),
  weekly_report: z.boolean().optional(),
  product_updates: z.boolean().optional(),
});
```

**Response (200):**
```json
{
  "onboarding": true,
  "weekly_report": true,
  "product_updates": false
}
```

---

## 6.12 Health & Internal

### GET /health

Health check. No auth required.

**Response (200):**
```json
{
  "status": "healthy",
  "database": "ok",
  "redis": "ok",
  "queue_depth": 42
}
```

**Response (503):**
```json
{
  "status": "unhealthy",
  "database": "ok",
  "redis": "error",
  "queue_depth": null
}
```

---

### GET /v1/status

Public API status. No auth required.

**Response (200):**
```json
{
  "status": "operational",
  "version": "1.0.0",
  "uptime_seconds": 86400
}
```

---

### GET /internal/metrics

Internal metrics. Auth: `INTERNAL_API_TOKEN` env var.

**Response (200):**
```typescript
interface MetricsResponse {
  queues: Record<string, { depth: number; failed: number; completed_last_hour: number }>;
  error_rates: Record<string, number>;
  entities: {
    users: number;
    urls: number;
    changes_today: number;
    checks_today: number;
  };
}
```

---

### GET /v1/openapi.json

Auto-generated OpenAPI 3.1 spec. No auth required. Generated via `@hono/zod-openapi`.

---

# 7. WEBHOOK EVENTS

Webhooks receive HTTP POST requests signed with HMAC-SHA256. The signing secret is provided on webhook creation.

## Signature Verification

```
Chirri-Signature: t=1711234567,v1=sha256_hash_here
```

Verify by computing HMAC-SHA256 of `${timestamp}.${raw_body}` with the signing secret. Reject if timestamp is >5 minutes old.

## Event Types

| Event | When | Payload Includes |
|---|---|---|
| `change.detected` | Change first detected (before confirmation) | change_id, severity, summary |
| `change.confirmed` | Change confirmed after recheck(s) | change_id, severity, summary, diff |
| `change.reverted` | Change reverted back to baseline | change_id |
| `url.created` | URL added to monitoring | url_id, url |
| `url.classified` | Classification complete | url_id, content_type, monitoring_method |
| `url.learning_complete` | Learning period finished | url_id |
| `url.active` | URL now in active monitoring | url_id |
| `url.error` | Check returned error | url_id, error |
| `url.degraded` | Persistent errors | url_id |
| `url.recovered` | Recovered from error state | url_id |
| `url.paused` | Monitoring paused | url_id |
| `url.resumed` | Monitoring resumed | url_id |
| `url.auth_required` | API requires authentication | url_id |
| `url.redirect_detected` | URL is redirecting | url_id, redirect_target |
| `url.limited` | Bot protection detected | url_id |
| `forecast.new` | New early warning signal | forecast_id, severity, title, deadline |
| `forecast.deadline` | Deadline approaching (<30 days) | forecast_id, days_remaining |
| `forecast.expired` | Forecast deadline passed | forecast_id |
| `account.usage_alert` | Approaching plan limits | resource, used, limit |
| `test` | Test event from webhook test | - |

## Webhook Payload Format

```typescript
interface WebhookPayload {
  id: string;                // unique delivery ID
  event: string;             // event type
  created_at: string;
  data: {
    // varies per event type
    [key: string]: any;
  };
}
```

**Example (`change.confirmed`):**
```json
{
  "id": "del_a1b2c3d4",
  "event": "change.confirmed",
  "created_at": "2026-03-24T14:00:00Z",
  "data": {
    "change_id": "chg_i9j0k1l2m3n4o5p6q7r8s",
    "url_id": "url_e5f6g7h8i9j0k1l2m3n4o",
    "url": "https://api.stripe.com/v1/prices",
    "url_name": "Stripe Prices API",
    "change_type": "schema",
    "severity": "high",
    "summary": "Field `amount` removed from response object",
    "diff": { "removed": ["/data/0/amount"] },
    "detected_at": "2026-03-24T13:55:00Z"
  }
}
```

## Retry Policy

Retries on non-2xx: 1m, 5m, 30m, 2h, 12h (5 attempts). Auto-disable webhook after 3 consecutive days of failures. User notified via email when webhook disabled.

---

# 8. MCP SERVER SPECIFICATION

## 8.1 Architecture

### Overview

The Chirri MCP server is a thin wrapper around the Chirri REST API. It translates MCP tool calls into authenticated REST API requests using the user's API key.

```
┌──────────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  Claude Desktop /    │     │  @chirri/mcp-server  │     │  Chirri API  │
│  Cursor / Windsurf   │────▶│                      │────▶│  api.chirri  │
│  (MCP Client)        │◀────│  stdio / HTTP        │◀────│  .io/v1      │
└──────────────────────┘     └─────────────────────┘     └──────────────┘
```

### Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Architecture | REST API wrapper | No direct DB access. MCP server is a distribution channel, not a backend. Easier to maintain, test, secure. |
| Transport | stdio (primary) + Streamable HTTP (optional) | stdio for local integrations (Claude Desktop, Cursor). HTTP for remote/headless. |
| Auth | API key in env var, passed as Bearer token to REST API | Simple for users to configure. No OAuth dance needed. |
| SDK | `@modelcontextprotocol/server` + Zod | Official TypeScript SDK. Zod for input validation matching the MCP spec. |
| Package | `@chirri/mcp-server` on npm | Global install or npx. |
| Error format | MCP `isError: true` with structured content | Follow MCP spec for tool errors. |

### Transport Details

**stdio (default):** Process spawned by MCP client. Communicates over stdin/stdout. No HTTP server. Used by Claude Desktop, Cursor, Windsurf.

**Streamable HTTP (optional):** For remote access, headless environments, or multi-client setups. Start with `--http --port 3100`. Supports session management and SSE notifications.

```bash
# stdio mode (default)
npx @chirri/mcp-server

# HTTP mode
npx @chirri/mcp-server --http --port 3100
```

### Error Handling

MCP tools return errors using the standard MCP error format:

```typescript
// Success
{
  content: [{ type: "text", text: JSON.stringify(result) }],
  structuredContent: result,  // typed output when outputSchema defined
}

// Error
{
  content: [{ type: "text", text: "Error: URL not found" }],
  isError: true,
}
```

Error messages are human-readable. The AI agent sees them and can explain to the user or retry.

### Pagination in MCP Tools

List tools (`chirri_list_monitors`, `chirri_get_changes`, `chirri_get_forecasts`) support pagination via `cursor` and `limit` parameters. The response includes `has_more` and `next_cursor` for the AI to follow up if needed.

In practice, AI agents typically request 10-20 items and rarely paginate. The default limit of 20 covers most use cases.

---

## 8.2 Tools

### Tool 1: chirri_list_monitors

List all monitored URLs.

**Description (shown to AI):** "List all API endpoints currently being monitored by Chirri. Returns URL, status, last check time, and recent change count. Supports filtering by status and searching by URL or name."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["learning", "active", "paused", "error", "degraded"],
      "description": "Filter by monitoring status"
    },
    "search": {
      "type": "string",
      "description": "Search by URL or name"
    },
    "limit": {
      "type": "number",
      "minimum": 1,
      "maximum": 50,
      "default": 20,
      "description": "Number of results to return"
    },
    "cursor": {
      "type": "string",
      "description": "Pagination cursor from previous response"
    }
  },
  "required": []
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "monitors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "url": { "type": "string" },
          "name": { "type": "string" },
          "status": { "type": "string" },
          "check_interval": { "type": "string" },
          "last_check_at": { "type": "string" },
          "recent_change_count": { "type": "number" },
          "provider": { "type": "string" }
        }
      }
    },
    "total": { "type": "number" },
    "has_more": { "type": "boolean" },
    "next_cursor": { "type": "string" }
  }
}
```

**REST API call:** `GET /v1/urls`

**Example:**
```json
// Input
{}

// Output
{
  "monitors": [
    {
      "id": "url_e5f6g7h8i9j0k1l2m3n4o",
      "url": "https://api.stripe.com/v1/prices",
      "name": "Stripe Prices API",
      "status": "active",
      "check_interval": "1h",
      "last_check_at": "2026-03-24T13:00:00Z",
      "recent_change_count": 2,
      "provider": "Stripe"
    },
    {
      "id": "url_a1b2c3d4e5f6g7h8i9j0k",
      "url": "https://api.openai.com/v1/models",
      "name": "OpenAI Models",
      "status": "active",
      "check_interval": "6h",
      "last_check_at": "2026-03-24T12:00:00Z",
      "recent_change_count": 0,
      "provider": "OpenAI"
    }
  ],
  "total": 2,
  "has_more": false,
  "next_cursor": null
}
```

---

### Tool 2: chirri_add_monitor

Add a new URL to monitor.

**Description:** "Add a new API endpoint URL to Chirri monitoring. The URL will go through classification and a learning period before active monitoring begins. For known providers (Stripe, OpenAI, etc.), bonus sources are automatically added."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "url": {
      "type": "string",
      "description": "The API endpoint URL to monitor (must be http:// or https://)"
    },
    "name": {
      "type": "string",
      "description": "Human-friendly name for this monitor"
    },
    "check_interval": {
      "type": "string",
      "enum": ["5m", "15m", "1h", "6h", "24h"],
      "default": "24h",
      "description": "How often to check for changes (available intervals depend on plan)"
    }
  },
  "required": ["url"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "url": { "type": "string" },
    "name": { "type": "string" },
    "status": { "type": "string" },
    "provider": { "type": "string" },
    "sources_added": { "type": "number" },
    "message": { "type": "string" }
  }
}
```

**REST API call:** `POST /v1/urls`

**Example:**
```json
// Input
{
  "url": "https://api.twilio.com/2010-04-01/Accounts",
  "name": "Twilio Accounts API"
}

// Output
{
  "id": "url_x1y2z3a4b5c6d7e8f9g0h",
  "url": "https://api.twilio.com/2010-04-01/Accounts",
  "name": "Twilio Accounts API",
  "status": "classifying",
  "provider": "Twilio",
  "sources_added": 3,
  "message": "Added! Classification in progress, then learning baseline (~10 minutes)."
}
```

---

### Tool 3: chirri_remove_monitor

Remove a monitored URL.

**Description:** "Remove a URL from Chirri monitoring. Stops all checks. Change history is retained per your plan's retention policy."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The URL monitor ID (url_...)"
    },
    "url": {
      "type": "string",
      "description": "Alternatively, the URL string to find and remove"
    }
  },
  "required": []
}
```

At least one of `id` or `url` must be provided. If `url` is given, the tool looks up the monitor by URL.

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "removed": { "type": "boolean" },
    "id": { "type": "string" },
    "url": { "type": "string" },
    "message": { "type": "string" }
  }
}
```

**REST API call:** `DELETE /v1/urls/:id`

**Example:**
```json
// Input
{ "url": "https://api.twilio.com/2010-04-01/Accounts" }

// Output
{
  "removed": true,
  "id": "url_x1y2z3a4b5c6d7e8f9g0h",
  "url": "https://api.twilio.com/2010-04-01/Accounts",
  "message": "Removed. Change history retained for 30 days."
}
```

---

### Tool 4: chirri_get_changes

Get recent detected API changes.

**Description:** "Get recent changes detected across your monitored APIs. Filter by URL, severity, or date range. Returns change summaries with severity levels and workflow states."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "url_id": {
      "type": "string",
      "description": "Filter by URL monitor ID"
    },
    "severity": {
      "type": "string",
      "enum": ["critical", "high", "medium", "low"],
      "description": "Filter by minimum severity"
    },
    "workflow_state": {
      "type": "string",
      "enum": ["new", "tracked", "ignored", "snoozed", "resolved"],
      "description": "Filter by workflow state"
    },
    "since": {
      "type": "string",
      "description": "ISO 8601 date to get changes since"
    },
    "limit": {
      "type": "number",
      "minimum": 1,
      "maximum": 50,
      "default": 10,
      "description": "Number of changes to return"
    },
    "cursor": {
      "type": "string",
      "description": "Pagination cursor"
    }
  },
  "required": []
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "changes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "url": { "type": "string" },
          "url_name": { "type": "string" },
          "change_type": { "type": "string" },
          "severity": { "type": "string" },
          "summary": { "type": "string" },
          "workflow_state": { "type": "string" },
          "confirmation_status": { "type": "string" },
          "detected_at": { "type": "string" }
        }
      }
    },
    "total": { "type": "number" },
    "has_more": { "type": "boolean" },
    "next_cursor": { "type": "string" }
  }
}
```

**REST API call:** `GET /v1/changes`

**Example:**
```json
// Input
{ "severity": "high", "limit": 5 }

// Output
{
  "changes": [
    {
      "id": "chg_i9j0k1l2m3n4o5p6q7r8s",
      "url": "https://api.stripe.com/v1/prices",
      "url_name": "Stripe Prices API",
      "change_type": "schema",
      "severity": "high",
      "summary": "Field `amount` removed from response object",
      "workflow_state": "new",
      "confirmation_status": "confirmed",
      "detected_at": "2026-03-24T13:55:00Z"
    }
  ],
  "total": 1,
  "has_more": false,
  "next_cursor": null
}
```

---

### Tool 5: chirri_get_diff

Get the detailed diff for a specific change.

**Description:** "Get the full diff between the previous and current state for a detected change. Shows exactly what fields, status codes, or headers changed."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "change_id": {
      "type": "string",
      "description": "The change ID (chg_...)"
    }
  },
  "required": ["change_id"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "change_id": { "type": "string" },
    "url": { "type": "string" },
    "change_type": { "type": "string" },
    "severity": { "type": "string" },
    "summary": { "type": "string" },
    "diff": {
      "type": "object",
      "description": "Structured diff (format depends on change_type)"
    },
    "previous_status_code": { "type": "number" },
    "current_status_code": { "type": "number" },
    "detected_at": { "type": "string" }
  }
}
```

**REST API call:** `GET /v1/changes/:id`

**Example:**
```json
// Input
{ "change_id": "chg_i9j0k1l2m3n4o5p6q7r8s" }

// Output
{
  "change_id": "chg_i9j0k1l2m3n4o5p6q7r8s",
  "url": "https://api.stripe.com/v1/prices",
  "change_type": "schema",
  "severity": "high",
  "summary": "Field `amount` removed from response object",
  "diff": {
    "removed": ["/data/0/amount"],
    "added": ["/data/0/unit_amount"],
    "modified": []
  },
  "previous_status_code": 200,
  "current_status_code": 200,
  "detected_at": "2026-03-24T13:55:00Z"
}
```

---

### Tool 6: chirri_check_now

Trigger an immediate check for a monitored URL.

**Description:** "Trigger an immediate check on a monitored URL right now, without waiting for the next scheduled check. Returns the check result if completed within 30 seconds."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "The URL monitor ID (url_...)"
    },
    "wait": {
      "type": "boolean",
      "default": true,
      "description": "Wait for check to complete (max 30s). If false, returns immediately with job ID."
    }
  },
  "required": ["id"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string" },
    "status_code": { "type": "number" },
    "response_time_ms": { "type": "number" },
    "change_detected": { "type": "boolean" },
    "change_id": { "type": "string" },
    "change_summary": { "type": "string" },
    "checked_at": { "type": "string" },
    "message": { "type": "string" }
  }
}
```

**REST API call:** `POST /v1/urls/:id/check?wait=true`

**Example:**
```json
// Input
{ "id": "url_e5f6g7h8i9j0k1l2m3n4o" }

// Output
{
  "url": "https://api.stripe.com/v1/prices",
  "status_code": 200,
  "response_time_ms": 234,
  "change_detected": false,
  "change_id": null,
  "change_summary": null,
  "checked_at": "2026-03-24T14:30:00Z",
  "message": "Check complete. No changes detected."
}
```

---

### Tool 7: chirri_get_forecasts

Get active early warning signals.

**Description:** "Get early warning forecasts for your monitored APIs. These are advance notices of upcoming changes like deprecations, sunset dates, and version migrations detected from changelogs, headers, and status pages."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["active", "acknowledged", "dismissed", "expired"],
      "description": "Filter by forecast status"
    },
    "severity": {
      "type": "string",
      "enum": ["critical", "high", "medium", "low"],
      "description": "Filter by severity"
    },
    "url_id": {
      "type": "string",
      "description": "Filter by URL monitor ID"
    },
    "limit": {
      "type": "number",
      "minimum": 1,
      "maximum": 50,
      "default": 10,
      "description": "Number of forecasts to return"
    }
  },
  "required": []
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "forecasts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "url_name": { "type": "string" },
          "signal_type": { "type": "string" },
          "severity": { "type": "string" },
          "title": { "type": "string" },
          "description": { "type": "string" },
          "deadline": { "type": "string" },
          "status": { "type": "string" }
        }
      }
    },
    "total": { "type": "number" },
    "has_more": { "type": "boolean" }
  }
}
```

**REST API call:** `GET /v1/forecasts`

**Example:**
```json
// Input
{ "status": "active" }

// Output
{
  "forecasts": [
    {
      "id": "frc_m3n4o5p6q7r8s9t0u1v2w",
      "url_name": "Stripe Prices API",
      "signal_type": "deprecation_header",
      "severity": "high",
      "title": "Stripe API version 2025-12-01 deprecated",
      "description": "The Sunset header indicates API version 2025-12-01 will be removed on 2026-06-01. Migration to version 2026-01-28 required.",
      "deadline": "2026-06-01T00:00:00Z",
      "status": "active"
    }
  ],
  "total": 1,
  "has_more": false
}
```

---

### Tool 8: chirri_acknowledge

Acknowledge a change or forecast.

**Description:** "Acknowledge a detected change or early warning forecast. For changes, this updates the workflow state (track, ignore, resolve). For forecasts, this marks it as acknowledged."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Change ID (chg_...) or Forecast ID (frc_...)"
    },
    "action": {
      "type": "string",
      "enum": ["track", "ignore", "resolve", "acknowledge", "dismiss"],
      "description": "Action to take. 'track/ignore/resolve' for changes, 'acknowledge/dismiss' for forecasts."
    },
    "note": {
      "type": "string",
      "description": "Optional note explaining the action"
    },
    "snooze_until": {
      "type": "string",
      "description": "ISO 8601 date to snooze until (changes only, uses 'snooze' action implicitly)"
    },
    "dismiss_reason": {
      "type": "string",
      "enum": ["false_positive", "not_relevant", "already_migrated"],
      "description": "Reason for dismissal (forecasts with 'dismiss' action only)"
    }
  },
  "required": ["id", "action"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "type": { "type": "string", "enum": ["change", "forecast"] },
    "action": { "type": "string" },
    "new_state": { "type": "string" },
    "message": { "type": "string" }
  }
}
```

**REST API calls:**
- Changes: `POST /v1/changes/:id/{track|ignore|resolve|snooze}`
- Forecasts: `POST /v1/forecasts/:id/{acknowledge|dismiss}`

Tool auto-detects change vs forecast based on ID prefix (`chg_` vs `frc_`).

**Example:**
```json
// Input
{
  "id": "chg_i9j0k1l2m3n4o5p6q7r8s",
  "action": "track",
  "note": "Will migrate in next sprint"
}

// Output
{
  "id": "chg_i9j0k1l2m3n4o5p6q7r8s",
  "type": "change",
  "action": "track",
  "new_state": "tracked",
  "message": "Change marked as tracked."
}
```

---

### Tool 9: chirri_get_impact_analysis

Get AI-generated impact analysis for a detected change.

**Description:** "Get an AI-generated impact analysis for a detected change. Explains what changed, how it affects your integration, and provides migration steps and code examples."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "change_id": {
      "type": "string",
      "description": "The change ID (chg_...)"
    }
  },
  "required": ["change_id"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "change_id": { "type": "string" },
    "summary": { "type": "string" },
    "impact_level": { "type": "string", "enum": ["breaking", "potentially_breaking", "additive", "cosmetic"] },
    "affected_areas": { "type": "array", "items": { "type": "string" } },
    "migration_steps": { "type": "array", "items": { "type": "string" } },
    "code_examples": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "language": { "type": "string" },
          "before": { "type": "string" },
          "after": { "type": "string" },
          "description": { "type": "string" }
        }
      }
    },
    "related_docs": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "url": { "type": "string" }
        }
      }
    }
  }
}
```

**REST API call:** `GET /v1/changes/:id/impact`

**Example:**
```json
// Input
{ "change_id": "chg_i9j0k1l2m3n4o5p6q7r8s" }

// Output
{
  "change_id": "chg_i9j0k1l2m3n4o5p6q7r8s",
  "summary": "The `amount` field has been replaced by `unit_amount` in the Stripe Prices API response. This is a breaking change for any code that reads `amount` directly.",
  "impact_level": "breaking",
  "affected_areas": ["billing", "pricing display", "invoice generation"],
  "migration_steps": [
    "Replace all references to `price.amount` with `price.unit_amount`",
    "Update any amount calculations that used `amount` (in cents)",
    "Test with Stripe test mode before deploying"
  ],
  "code_examples": [
    {
      "language": "javascript",
      "before": "const amount = price.amount;",
      "after": "const amount = price.unit_amount;",
      "description": "Direct field rename"
    }
  ],
  "related_docs": [
    { "title": "Stripe Prices Migration Guide", "url": "https://stripe.com/docs/..." }
  ]
}
```

---

### Tool 10: chirri_get_dependency_graph

Get the dependency tree showing all sources monitored for a URL's provider.

**Description:** "Get the full dependency graph for a monitored URL, showing all sources being tracked: the primary endpoint, changelog, OpenAPI spec, status page, and SDK versions. Shows what Chirri is watching and the status of each source."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "url_id": {
      "type": "string",
      "description": "The URL monitor ID (url_...)"
    }
  },
  "required": ["url_id"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "url_id": { "type": "string" },
    "url": { "type": "string" },
    "provider": { "type": "string" },
    "sources": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "type": { "type": "string" },
          "name": { "type": "string" },
          "url": { "type": "string" },
          "status": { "type": "string" },
          "bundled": { "type": "boolean" },
          "last_check_at": { "type": "string" },
          "recent_changes": { "type": "number" }
        }
      }
    }
  }
}
```

**REST API call:** `GET /v1/urls/:id` (sources included in response) + `GET /v1/urls/:id/sources`

---

### Tool 11: chirri_search

Full-text search across changes, forecasts, and monitors.

**Description:** "Search across all your Chirri data — changes, forecasts, and monitored URLs. Useful for finding specific changes by keyword, or checking if a particular API field or endpoint has been affected."

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query (e.g., 'amount field removed', 'stripe deprecation', 'openai model')"
    },
    "type": {
      "type": "string",
      "enum": ["all", "changes", "forecasts", "monitors"],
      "default": "all",
      "description": "Limit search to a specific type"
    },
    "limit": {
      "type": "number",
      "minimum": 1,
      "maximum": 20,
      "default": 10,
      "description": "Number of results"
    }
  },
  "required": ["query"]
}
```

**Output Schema:**
```json
{
  "type": "object",
  "properties": {
    "results": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": { "type": "string", "enum": ["change", "forecast", "monitor"] },
          "id": { "type": "string" },
          "title": { "type": "string" },
          "summary": { "type": "string" },
          "url": { "type": "string" },
          "relevance_score": { "type": "number" }
        }
      }
    },
    "total": { "type": "number" }
  }
}
```

**REST API calls:** Multiple queries against `GET /v1/changes?search=`, `GET /v1/forecasts?search=`, `GET /v1/urls?search=` — aggregated and ranked by relevance.

---

## 8.3 Installation & Configuration

### npm Installation

```bash
npm install -g @chirri/mcp-server
```

Or run directly without installing:
```bash
npx @chirri/mcp-server
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `CHIRRI_API_KEY` | Yes | Your Chirri API key (`ck_live_...`) |
| `CHIRRI_API_URL` | No | Override API base URL (default: `https://api.chirri.io/v1`) |

### Claude Desktop Configuration

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "chirri": {
      "command": "npx",
      "args": ["-y", "@chirri/mcp-server"],
      "env": {
        "CHIRRI_API_KEY": "ck_live_your_api_key_here"
      }
    }
  }
}
```

### Cursor IDE Configuration

In Cursor Settings → MCP:

```json
{
  "mcpServers": {
    "chirri": {
      "command": "npx",
      "args": ["-y", "@chirri/mcp-server"],
      "env": {
        "CHIRRI_API_KEY": "ck_live_your_api_key_here"
      }
    }
  }
}
```

### Windsurf Configuration

Same JSON format as Cursor, placed in Windsurf's MCP configuration file.

### Docker (for remote/server use)

```bash
docker run -e CHIRRI_API_KEY=ck_live_... -p 3100:3100 ghcr.io/chirri/mcp-server --http --port 3100
```

### Server Implementation Reference

```typescript
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

const CHIRRI_API_URL = process.env.CHIRRI_API_URL || "https://api.chirri.io/v1";
const CHIRRI_API_KEY = process.env.CHIRRI_API_KEY;

if (!CHIRRI_API_KEY) {
  console.error("CHIRRI_API_KEY environment variable is required");
  process.exit(1);
}

// Helper: authenticated fetch to Chirri API
async function chirriApi(path: string, options?: RequestInit) {
  const res = await fetch(`${CHIRRI_API_URL}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${CHIRRI_API_KEY}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error: ${res.status}`);
  }
  return res.json();
}

const server = new McpServer({
  name: "chirri",
  version: "1.0.0",
});

// Register tools...
server.registerTool("chirri_list_monitors", {
  title: "List Monitored APIs",
  description: "List all API endpoints currently being monitored by Chirri.",
  inputSchema: z.object({
    status: z.string().optional(),
    search: z.string().optional(),
    limit: z.number().min(1).max(50).default(20),
    cursor: z.string().optional(),
  }),
}, async ({ status, search, limit, cursor }) => {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  if (limit) params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);

  const data = await chirriApi(`/urls?${params}`);
  const result = {
    monitors: data.data.map((u: any) => ({
      id: u.id,
      url: u.url,
      name: u.name,
      status: u.status,
      check_interval: u.check_interval,
      last_check_at: u.last_check_at,
      recent_change_count: u.recent_change_count,
      provider: u.provider_slug,
    })),
    total: data.data.length,
    has_more: data.has_more,
    next_cursor: data.next_cursor,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: result,
  };
});

// ... (additional tool registrations follow same pattern)

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

---

# APPENDIX A: Zod Schema Reference

All request schemas are defined using Zod and validated via `@hono/zod-validator` middleware. OpenAPI spec auto-generated via `@hono/zod-openapi`.

## Shared Schemas

```typescript
import { z } from "zod";

// Pagination
export const PaginationParams = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// Severity
export const SeverityEnum = z.enum(["critical", "high", "medium", "low"]);

// Workflow state
export const WorkflowStateEnum = z.enum(["new", "tracked", "ignored", "snoozed", "resolved"]);

// Check interval
export const CheckIntervalEnum = z.enum(["1m", "5m", "15m", "1h", "6h", "24h"]);

// URL status
export const UrlStatusEnum = z.enum([
  "learning", "calibrating", "active", "paused", "error",
  "degraded", "auth_required", "redirect_detected", "limited", "monitoring_empty",
]);

// Change type
export const ChangeTypeEnum = z.enum([
  "schema", "status_code", "header", "content", "redirect",
  "timing", "tls", "error_format", "availability", "rate_limit",
]);

// Plan
export const PlanEnum = z.enum(["free", "personal", "team", "business"]);

// Notification config (per-URL override)
export const NotificationConfig = z.object({
  email: z.boolean().nullable().optional(),
  webhook_ids: z.array(z.string()).optional(),
  min_severity: SeverityEnum.nullable().optional(),
  slack_enabled: z.boolean().nullable().optional(),
  discord_enabled: z.boolean().nullable().optional(),
  digest_mode: z.enum(["daily", "weekly"]).nullable().optional(),
});
```

---

# APPENDIX B: Implementation Notes

## Hono + Zod Validation Pattern

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const app = new Hono();

app.post(
  "/v1/urls",
  authMiddleware,        // session or API key
  rateLimitMiddleware,
  zValidator("json", CreateUrlRequest, (result, c) => {
    if (!result.success) {
      return c.json({
        error: {
          code: "invalid_input",
          message: "Validation failed",
          status: 422,
          details: result.error.issues.map(i => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
      }, 422);
    }
  }),
  async (c) => {
    const body = c.req.valid("json");
    // ... handler logic
  }
);
```

## SSE Endpoint for Real-Time Updates

```typescript
// GET /v1/events (SSE stream)
app.get("/v1/events", authMiddleware, async (c) => {
  return streamSSE(c, async (stream) => {
    const userId = c.get("userId");
    // Subscribe to Redis pub/sub channel for this user
    const subscriber = redis.duplicate();
    await subscriber.subscribe(`user:${userId}:events`);

    subscriber.on("message", (_, message) => {
      stream.writeSSE({ data: message, event: "update" });
    });

    // Keep-alive ping every 30s
    const interval = setInterval(() => {
      stream.writeSSE({ data: "", event: "ping" });
    }, 30000);

    stream.onAbort(() => {
      clearInterval(interval);
      subscriber.unsubscribe();
      subscriber.quit();
    });
  });
});
```

---

*End of specification. This document covers all REST API endpoints and MCP server tools for Chirri v1.0.*
