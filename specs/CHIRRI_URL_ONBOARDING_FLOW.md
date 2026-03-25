# CHIRRI — Complete API Response Contract

**Version:** 1.0.0
**Date:** 2026-03-24
**Status:** Implementation-Ready

> Every endpoint. Every status code. Every edge case. Every error message.
> This is the contract between Chirri's API and the world.

---

## Table of Contents

1. [URL Onboarding State Machine](#1-url-onboarding-state-machine)
2. [Global Response Conventions](#2-global-response-conventions)
3. [Auth Endpoints](#3-auth-endpoints)
4. [API Key Endpoints](#4-api-key-endpoints)
5. [URL Endpoints](#5-url-endpoints)
6. [URL Onboarding Flow (All States)](#6-url-onboarding-flow-all-states)
7. [Changes Endpoints](#7-changes-endpoints)
8. [Snapshot Endpoints](#8-snapshot-endpoints)
9. [Webhook Endpoints](#9-webhook-endpoints)
10. [Integration Endpoints](#10-integration-endpoints)
11. [Classification Endpoints](#11-classification-endpoints)
12. [Monitoring Pack Endpoints](#12-monitoring-pack-endpoints)
13. [Account Endpoints](#13-account-endpoints)
14. [Provider Search & Discovery](#14-provider-search--discovery)
15. [Manual Check Trigger](#15-manual-check-trigger)
16. [Health & Status Endpoints](#16-health--status-endpoints)
17. [Webhook Event Catalog](#17-webhook-event-catalog)
18. [Complete Error Code Registry](#18-complete-error-code-registry)

---

## 1. URL Onboarding State Machine

This is the heart of the user experience. Every URL goes through this state machine.

```
                                    USER INPUT
                                        │
                                        ▼
                              ┌──────────────────┐
                              │   INPUT PARSING   │
                              │                   │
                              │  URL? Provider    │
                              │  name? Garbage?   │
                              └────────┬──────────┘
                                       │
                       ┌───────────────┼───────────────┐
                       │               │               │
                       ▼               ▼               ▼
                   Valid URL      Provider Name     Invalid
                       │               │               │
                       │               ▼               ▼
                       │        ┌─────────────┐   ┌────────┐
                       │        │  DB Lookup   │   │ reject │
                       │        │  Provider    │   │  400   │
                       │        │  Database    │   └────────┘
                       │        └──────┬──────┘
                       │               │
                       │        ┌──────┴──────┐
                       │        │             │
                       │     Found        Not Found
                       │        │             │
                       │        ▼             ▼
                       │   ┌─────────┐   ┌──────────┐
                       │   │ known   │   │ provider │
                       │   │ provider│   │ not_found│
                       │   │ → multi │   │   404    │
                       │   │ source  │   └──────────┘
                       │   └────┬────┘
                       │        │
                       ▼        ▼
               ┌──────────────────────────┐
               │     SSRF VALIDATION      │
               │                          │
               │  • Private IP? → reject  │
               │  • DNS fail? → dns_error │
               │  • Blocked? → reject     │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │   INITIAL FETCH (probe)  │
               │                          │
               │  HTTP GET with timeout   │
               └────────────┬─────────────┘
                            │
            ┌───────┬───────┼───────┬──────┬──────┬──────┐
            │       │       │       │      │      │      │
            ▼       ▼       ▼       ▼      ▼      ▼      ▼
          2xx     3xx     401/3    4xx    5xx   timeout  empty
            │       │       │       │      │      │      │
            ▼       ▼       ▼       ▼      ▼      ▼      ▼
       ┌────────┐ redir  auth_   not_  degraded limited monitor
       │CLASSIFY│ detect required found          │    _empty
       │        │   │       │       │      │      │      │
       └───┬────┘   │       │       │      │      │      │
           │        │       │       │      │      │      │
    ┌──────┼──────┐ │       │       │      │      │      │
    │      │      │ │       │       │      │      │      │
    ▼      ▼      ▼ ▼       ▼       ▼      ▼      ▼      ▼
  known  rss/  unknown     TERMINAL / WAITING STATES
  api    atom  content     (see state descriptions below)
    │      │      │
    ▼      ▼      ▼
 ┌─────────────────────┐
 │      LEARNING       │ ← status = "learning"
 │  30 checks / 10 min │
 │  Volatile detection  │
 │  Baseline building   │
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │    CALIBRATING      │ ← status = "calibrating"
 │  7 days, high thresh│
 │  Continue learning   │
 │  Suppress borderline │
 └──────────┬──────────┘
            │
            ▼
 ┌─────────────────────┐
 │      ACTIVE         │ ← status = "active"
 │  Normal monitoring   │
 │  User threshold      │
 │  Full alerting       │
 └──────────┬──────────┘
            │
   ┌────────┼────────┐
   │        │        │
   ▼        ▼        ▼
 paused  degraded   error
   │        │        │
   │        ▼        │
   │   ┌─────────┐   │
   │   │recovered│   │
   │   │ → active│   │
   │   └─────────┘   │
   │                  │
   ▼                  ▼
 ┌──────┐        ┌───────┐
 │resume│        │ user  │
 │→activ│        │ fixes │
 └──────┘        │→retry │
                 └───────┘
```

### Complete Status Enum

```typescript
type UrlStatus =
  | 'learning'          // First 10 min, rapid checks, building baseline
  | 'calibrating'       // Days 1-7, normal interval, higher threshold
  | 'active'            // Normal monitoring
  | 'paused'            // User-paused
  | 'error'             // Persistent errors (DNS, 404, SSRF blocked)
  | 'degraded'          // Intermittent errors (5xx, timeouts)
  | 'auth_required'     // 401/403 on fetch
  | 'redirect_detected' // 3xx needs user decision
  | 'limited'           // Bot protection detected
  | 'monitoring_empty'  // 200 but empty body
  | 'rejected'          // SSRF/validation failure (never saved to DB)
  | 'classifying';      // Brief: during initial classification
```

### Status Transition Rules

| From | To | Trigger | Webhook Event |
|------|----|---------|---------------|
| (new) | `learning` | URL created, first fetch succeeds | `url.created` |
| (new) | `classifying` | URL created, classification in progress | `url.created` |
| (new) | `auth_required` | First fetch returns 401/403 | `url.created`, `url.auth_required` |
| (new) | `redirect_detected` | First fetch returns 3xx | `url.created`, `url.redirect_detected` |
| (new) | `degraded` | First fetch returns 5xx/timeout | `url.created`, `url.degraded` |
| (new) | `monitoring_empty` | First fetch returns 200 with empty body | `url.created` |
| (new) | `limited` | Bot protection detected | `url.created`, `url.limited` |
| (new) | `error` | DNS failure, persistent 4xx | `url.created`, `url.error` |
| (new) | `rejected` | SSRF blocked, invalid URL | — (never persisted) |
| `classifying` | `learning` | Classification complete | `url.classified` |
| `learning` | `calibrating` | 30 samples collected, baseline established | `url.learning_complete` |
| `calibrating` | `active` | 7 days elapsed | `url.active` |
| `active` | `paused` | User pauses | `url.paused` |
| `active` | `degraded` | 3+ consecutive fetch errors | `url.degraded` |
| `active` | `error` | 24h+ consecutive failures | `url.error` |
| `paused` | `active` | User resumes | `url.resumed` |
| `degraded` | `active` | Successful fetch after degraded | `url.recovered` |
| `error` | `learning` | User re-triggers / URL becomes reachable | `url.recovered` |
| `auth_required` | `learning` | User adds headers, recheck succeeds | `url.recovered` |
| `redirect_detected` | `learning` | User confirms target URL | — |
| `limited` | `active` | Successful fetch through protection | `url.recovered` |
| `monitoring_empty` | `learning` | Non-empty response detected | `url.recovered` |

---

## 2. Global Response Conventions

### 2.1 Envelope Format

**All success responses** use a flat structure for single objects, `data` array for lists:

```json
// Single object (GET /v1/urls/:id, POST /v1/urls, etc.)
{
  "id": "url_a1b2c3d4",
  "url": "https://api.stripe.com/v1/prices",
  "status": "active",
  ...
}

// List (GET /v1/urls, GET /v1/changes, etc.)
{
  "data": [ { ... }, { ... } ],
  "has_more": true,
  "next_cursor": "cur_eyJ..."
}
```

### 2.2 Error Envelope

**All error responses** use this structure:

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Human-readable description.",
    "status": 400,
    "details": {}       // optional, varies by error
  }
}
```

### 2.3 Standard Headers (Every Response)

```http
Content-Type: application/json; charset=utf-8
X-Request-Id: req_a1b2c3d4e5f6
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 73
X-RateLimit-Reset: 1711209660
Cache-Control: no-store
```

### 2.4 Pagination

Cursor-based. Cursor is an opaque base64 string encoding `(created_at, id)`.

```
GET /v1/urls?limit=20&cursor=cur_eyJ...

// Response includes:
{
  "data": [...],
  "has_more": true,
  "next_cursor": "cur_eyJ..."    // null if has_more is false
}
```

| Param | Type | Default | Max | Description |
|-------|------|---------|-----|-------------|
| `limit` | int | 20 | 100 | Items per page |
| `cursor` | string | null | — | Opaque pagination cursor |

### 2.5 Date Format

All dates are ISO 8601 in UTC: `"2026-03-23T14:32:00Z"`

### 2.6 ID Prefixes

| Entity | Prefix | Example |
|--------|--------|---------|
| User | `usr_` | `usr_a1b2c3d4` |
| URL | `url_` | `url_e5f6g7h8` |
| Change | `chg_` | `chg_i9j0k1l2` |
| Snapshot | `snap_` | `snap_m3n4o5p6` |
| Webhook | `wh_` | `wh_q7r8s9t0` |
| Integration | `int_` | `int_u1v2w3x4` |
| API Key | `key_` | `key_y5z6a7b8` |
| Delivery | `del_` | `del_c9d0e1f2` |
| Event | `evt_` | `evt_g3h4i5j6` |
| Pack | `pack_` | `pack_k7l8m9n0` |
| Feedback token | `fb_` | `fb_o1p2q3r4` |

---

## 3. Auth Endpoints

### 3.1 `POST /v1/auth/signup`

Create a new account. Dashboard-only (not available via API key).

**Rate limit:** 5/minute per IP

#### Success: `201 Created`

```json
{
  "user": {
    "id": "usr_a1b2c3d4",
    "email": "dev@example.com",
    "name": "Alex",
    "plan": "free",
    "email_verified": false,
    "created_at": "2026-03-23T12:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "rt_x7y8z9a0b1c2d3e4f5..."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Email is required."` | Missing email field |
| `400` | `invalid_input` | `"Invalid email format."` | Email fails RFC 5322 validation |
| `400` | `invalid_input` | `"Password must be at least 8 characters."` | Password too short |
| `400` | `invalid_input` | `"Password must not exceed 72 characters."` | bcrypt limit |
| `400` | `invalid_input` | `"Name must not exceed 100 characters."` | Name too long |
| `409` | `duplicate_email` | `"An account with this email already exists."` | Email taken |
| `429` | `rate_limited` | `"Too many signup attempts. Retry after {n} seconds."` | Rate limited |
| `500` | `internal_error` | `"An unexpected error occurred. Please try again."` | Server error |

```json
// 409 Example
{
  "error": {
    "code": "duplicate_email",
    "message": "An account with this email already exists.",
    "status": 409
  }
}
```

#### Validation Details

```json
// 400 with multiple field errors
{
  "error": {
    "code": "invalid_input",
    "message": "Validation failed.",
    "status": 400,
    "details": {
      "fields": {
        "email": "Invalid email format.",
        "password": "Password must be at least 8 characters."
      }
    }
  }
}
```

---

### 3.2 `POST /v1/auth/login`

Authenticate and get tokens.

**Rate limit:** 20/minute per IP

#### Success: `200 OK`

```json
{
  "user": {
    "id": "usr_a1b2c3d4",
    "email": "dev@example.com",
    "name": "Alex",
    "plan": "indie",
    "email_verified": true,
    "created_at": "2026-03-23T12:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "rt_x7y8z9a0b1c2d3e4f5..."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Email and password are required."` | Missing fields |
| `401` | `invalid_credentials` | `"Invalid email or password."` | Wrong credentials |
| `423` | `account_locked` | `"Account locked due to too many failed attempts. Try again in {n} minutes."` | 10+ failed logins |
| `429` | `rate_limited` | `"Too many login attempts. Retry after {n} seconds."` | Rate limited |

```json
// 423 Example
{
  "error": {
    "code": "account_locked",
    "message": "Account locked due to too many failed attempts. Try again in 14 minutes.",
    "status": 423,
    "details": {
      "locked_until": "2026-03-23T12:15:00Z",
      "attempts": 10
    }
  }
}
```

**Security notes:**
- Never reveal whether email exists (always "Invalid email or password")
- Increment `login_failures` on each failed attempt
- Lock for 15 minutes after 10 failures
- Reset `login_failures` on successful login

---

### 3.3 `POST /v1/auth/refresh`

Rotate tokens using refresh token.

#### Success: `200 OK`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "rt_newtoken..."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Refresh token is required."` | Missing token |
| `401` | `invalid_refresh_token` | `"Refresh token is invalid or expired."` | Bad/expired/revoked token |

**Security notes:**
- Old refresh token is immediately invalidated (rotation)
- If a used (rotated) refresh token is presented, revoke ALL tokens for the user (potential theft detected)

---

### 3.4 `POST /v1/auth/revoke`

Revoke tokens. No body = revoke all. With body = revoke specific refresh token.

#### Success: `204 No Content`

(Empty response body)

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No valid auth |

---

### 3.5 `POST /v1/auth/verify-email`

Verify email with token from email.

#### Success: `200 OK`

```json
{
  "message": "Email verified successfully.",
  "user": {
    "id": "usr_a1b2c3d4",
    "email": "dev@example.com",
    "email_verified": true
  }
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_token` | `"Verification token is invalid."` | Bad token |
| `410` | `token_expired` | `"Verification token has expired. Request a new one."` | Expired (24h) |
| `409` | `already_verified` | `"Email is already verified."` | Double-verify |

---

### 3.6 `POST /v1/auth/forgot-password`

Request password reset email.

#### Success: `200 OK`

```json
{
  "message": "If an account with that email exists, a reset link has been sent."
}
```

**Always returns 200** — never reveals whether email exists.

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Email is required."` | Missing email |
| `429` | `rate_limited` | `"Too many requests. Try again later."` | >3/hour for same email |

---

### 3.7 `POST /v1/auth/reset-password`

Reset password with token from email.

#### Success: `200 OK`

```json
{
  "message": "Password reset successfully. Please log in with your new password."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Token and new password are required."` | Missing fields |
| `400` | `invalid_input` | `"Password must be at least 8 characters."` | Weak password |
| `400` | `invalid_token` | `"Reset token is invalid."` | Bad token |
| `410` | `token_expired` | `"Reset token has expired. Request a new one."` | Expired (1h) |

---

## 4. API Key Endpoints

### 4.1 `POST /v1/api-keys`

Create a new API key.

**Auth:** JWT only (dashboard). API keys cannot create API keys.

#### Success: `201 Created`

```json
{
  "id": "key_y5z6a7b8",
  "key": "dk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2",
  "name": "Production Key",
  "prefix": "dk_live_",
  "suffix": "...u1v2",
  "is_test": false,
  "created_at": "2026-03-23T12:00:00Z"
}
```

> ⚠️ `key` is shown ONCE. It is never stored or retrievable again.

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Name must not exceed 100 characters."` | Name too long |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `403` | `jwt_required` | `"API keys must be created from the dashboard."` | Using API key auth |
| `402` | `plan_limit_reached` | `"Free plan is limited to 2 API keys. Upgrade to create more."` | Key limit hit |

---

### 4.2 `GET /v1/api-keys`

List all API keys for the authenticated user.

**Auth:** JWT only.

#### Success: `200 OK`

```json
{
  "data": [
    {
      "id": "key_y5z6a7b8",
      "name": "Production Key",
      "prefix": "dk_live_",
      "suffix": "...u1v2",
      "is_test": false,
      "last_used_at": "2026-03-23T15:30:00Z",
      "created_at": "2026-03-23T12:00:00Z"
    },
    {
      "id": "key_c9d0e1f2",
      "name": "Test Key",
      "prefix": "dk_test_",
      "suffix": "...e1f2",
      "is_test": true,
      "last_used_at": null,
      "created_at": "2026-03-23T12:05:00Z"
    }
  ]
}
```

> Note: No `key` field — full key is never exposed after creation.

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `403` | `jwt_required` | `"API key management requires dashboard authentication."` | Using API key auth |

---

### 4.3 `PATCH /v1/api-keys/:id`

Rename an API key.

#### Success: `200 OK`

```json
{
  "id": "key_y5z6a7b8",
  "name": "Renamed Key",
  "prefix": "dk_live_",
  "suffix": "...u1v2",
  "is_test": false,
  "last_used_at": "2026-03-23T15:30:00Z",
  "created_at": "2026-03-23T12:00:00Z"
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Name must not exceed 100 characters."` | Name too long |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `403` | `jwt_required` | `"API key management requires dashboard authentication."` | API key auth |
| `404` | `not_found` | `"API key not found."` | Wrong ID / not owned by user |

---

### 4.4 `DELETE /v1/api-keys/:id`

Revoke an API key. Immediately stops working.

#### Success: `204 No Content`

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `403` | `jwt_required` | `"API key management requires dashboard authentication."` | API key auth |
| `404` | `not_found` | `"API key not found."` | Wrong ID or already revoked |

---

## 5. URL Endpoints

### 5.1 `POST /v1/urls` — Create Monitored URL

The most important endpoint. This is onboarding.

#### Request

```json
{
  "url": "https://api.stripe.com/v1/prices",
  "name": "Stripe Prices API",
  "interval": "1h",
  "method": "GET",
  "headers": {
    "Accept": "application/json"
  },
  "tags": ["payments", "critical"],
  "confidence_threshold": 80,
  "notifications": {
    "webhook_ids": ["wh_q7r8s9t0"],
    "email": true,
    "min_severity": "warning"
  }
}
```

| Field | Type | Required | Default | Constraints |
|-------|------|----------|---------|-------------|
| `url` | string | **yes** | — | HTTP(S), max 2048 chars, no userinfo, passes SSRF check |
| `name` | string | no | null | Max 200 chars |
| `interval` | string | no | per plan | `1m` \| `5m` \| `15m` \| `1h` \| `6h` \| `24h` |
| `method` | string | no | `GET` | `GET` \| `POST` |
| `headers` | object | no | `{}` | Max 10 keys, 1KB per value, no `Host`/`Transfer-Encoding`/`Content-Length` |
| `body` | string | no | null | Only for POST method, max 10KB |
| `tags` | string[] | no | `[]` | Max 10, alphanumeric + hyphens, max 50 chars each |
| `confidence_threshold` | int | no | 80 | 0–100 |
| `notifications` | object | no | default config | See notification config schema |

#### Success: `201 Created`

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.stripe.com/v1/prices",
  "name": "Stripe Prices API",
  "status": "learning",
  "status_reason": null,
  "check_interval": "1h",
  "method": "GET",
  "headers": { "Accept": "application/json" },
  "tags": ["payments", "critical"],
  "content_type": null,
  "monitoring_method": null,
  "classification_confidence": null,
  "confidence_threshold": 80,
  "volatile_fields": [],
  "notification_config": {
    "email": true,
    "webhook_ids": ["wh_q7r8s9t0"],
    "min_severity": "warning",
    "quiet_hours": null,
    "digest_mode": false
  },
  "provider": null,
  "learning": {
    "phase": "learning",
    "progress": 0.0,
    "samples_collected": 0,
    "samples_target": 30,
    "estimated_ready": "2026-03-23T12:10:00Z",
    "volatile_fields_detected": 0
  },
  "stats": {
    "total_checks": 0,
    "changes_detected": 0,
    "false_positive_rate": null,
    "avg_response_time_ms": null,
    "uptime_percentage": null
  },
  "last_check_at": null,
  "next_check_at": "2026-03-23T12:00:20Z",
  "created_at": "2026-03-23T12:00:00Z",
  "message": "URL added. Learning phase started — baseline will be ready in ~10 minutes."
}
```

#### Success with Known Provider: `201 Created`

When URL matches a known domain pattern:

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.stripe.com/v1/prices",
  "name": "Stripe Prices API",
  "status": "learning",
  "content_type": "json-api",
  "monitoring_method": "json-diff",
  "classification_confidence": 95,
  "provider": {
    "name": "Stripe",
    "slug": "stripe",
    "icon_url": "https://cdn.chirri.io/providers/stripe.svg",
    "sources_available": [
      "api_endpoint",
      "openapi_spec",
      "changelog",
      "status_page",
      "sdk_releases"
    ]
  },
  "learning": {
    "phase": "learning",
    "progress": 0.0,
    "samples_collected": 0,
    "samples_target": 30,
    "estimated_ready": "2026-03-23T12:10:00Z",
    "volatile_fields_detected": 0
  },
  "message": "✅ Stripe API detected. Monitoring started with JSON structural diffing. Baseline ready in ~10 minutes."
}
```

#### Success with Auth Required: `201 Created`

When the initial probe gets 401/403:

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.private.com/v1/data",
  "name": null,
  "status": "auth_required",
  "status_reason": "Initial fetch returned HTTP 401. Authentication headers required.",
  "check_interval": "1h",
  "content_type": null,
  "monitoring_method": null,
  "classification_confidence": null,
  "provider": null,
  "learning": null,
  "stats": {
    "total_checks": 1,
    "changes_detected": 0,
    "false_positive_rate": null,
    "avg_response_time_ms": 234,
    "uptime_percentage": 0
  },
  "last_check_at": "2026-03-23T12:00:02Z",
  "next_check_at": null,
  "created_at": "2026-03-23T12:00:00Z",
  "message": "🔒 This URL requires authentication. Add authorization headers via PATCH /v1/urls/{id} to start monitoring."
}
```

#### Success with Redirect Detected: `201 Created`

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.example.com/v1",
  "name": null,
  "status": "redirect_detected",
  "status_reason": "URL redirects to https://api.example.com/v2",
  "redirect": {
    "status_code": 301,
    "location": "https://api.example.com/v2",
    "chain": [
      { "url": "https://api.example.com/v1", "status": 301 },
      { "url": "https://api.example.com/v2", "status": 200 }
    ]
  },
  "learning": null,
  "message": "↗️ URL redirects to https://api.example.com/v2. Update the URL or confirm you want to monitor the redirect source."
}
```

#### Success with Degraded (5xx on first fetch): `201 Created`

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.unreliable.com/v1/data",
  "name": null,
  "status": "degraded",
  "status_reason": "Initial fetch returned HTTP 503 Service Unavailable.",
  "check_interval": "1h",
  "learning": null,
  "stats": {
    "total_checks": 1,
    "changes_detected": 0,
    "avg_response_time_ms": null,
    "uptime_percentage": 0
  },
  "last_check_at": "2026-03-23T12:00:03Z",
  "next_check_at": "2026-03-23T12:05:00Z",
  "created_at": "2026-03-23T12:00:00Z",
  "message": "⚠️ URL returned a server error (503). We'll keep checking — this may be temporary. Monitoring will begin once the URL responds successfully."
}
```

#### Success with Bot Protection Detected: `201 Created`

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://protected.example.com/api",
  "name": null,
  "status": "limited",
  "status_reason": "Cloudflare bot protection detected. Response contained a JS challenge.",
  "check_interval": "1h",
  "learning": null,
  "message": "⚠️ This URL is behind bot protection (Cloudflare). Monitoring will work but may have limited accuracy. Consider providing an API endpoint URL instead."
}
```

#### Success with Empty Response: `201 Created`

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.example.com/v1/empty",
  "name": null,
  "status": "monitoring_empty",
  "status_reason": "URL returned 200 OK with an empty response body.",
  "check_interval": "1h",
  "learning": null,
  "message": "ℹ️ URL returned an empty response. We'll monitor for when content appears and track status code and header changes."
}
```

#### Success with RSS/Atom Detection: `201 Created`

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://github.com/openai/openai-python/releases.atom",
  "name": "OpenAI Python SDK Releases",
  "status": "active",
  "content_type": "rss-feed",
  "monitoring_method": "feed-poll",
  "classification_confidence": 99,
  "provider": {
    "name": "GitHub",
    "slug": "github",
    "icon_url": "https://cdn.chirri.io/providers/github.svg"
  },
  "learning": null,
  "message": "📰 Atom feed detected (OpenAI Python SDK releases). Monitoring for new entries — no learning period needed."
}
```

> RSS/Atom feeds skip the learning phase entirely — they go straight to `active`.

#### Success with OpenAPI Spec Detection: `201 Created`

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.example.com/openapi.json",
  "name": "Example API Spec",
  "status": "active",
  "content_type": "openapi-spec",
  "monitoring_method": "spec-diff",
  "classification_confidence": 98,
  "spec_summary": {
    "title": "Example API",
    "version": "2.3.1",
    "endpoints": 47,
    "schemas": 156,
    "servers": ["https://api.example.com"]
  },
  "learning": null,
  "message": "📋 OpenAPI spec detected (47 endpoints, 156 schemas, v2.3.1). Monitoring for structural changes."
}
```

> OpenAPI specs also skip the learning phase — structural diffing starts immediately.

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_url` | `"Invalid URL format."` | Malformed URL |
| `400` | `invalid_url` | `"Only HTTP and HTTPS URLs are supported."` | Non-HTTP protocol |
| `400` | `invalid_url` | `"URL must not exceed 2048 characters."` | URL too long |
| `400` | `invalid_url` | `"URLs with embedded credentials are not allowed. Use custom headers instead."` | Has `user:pass@` |
| `400` | `ssrf_blocked` | `"Private/internal URLs cannot be monitored for security reasons."` | Private IP / localhost / metadata |
| `400` | `dns_resolution_failed` | `"Could not resolve hostname '{hostname}'. Check the URL and try again."` | DNS NXDOMAIN |
| `400` | `invalid_input` | `"Interval must be one of: 1m, 5m, 15m, 1h, 6h, 24h."` | Bad interval value |
| `400` | `invalid_input` | `"Method must be GET or POST."` | Bad method |
| `400` | `invalid_input` | `"Maximum 10 custom headers allowed."` | Too many headers |
| `400` | `invalid_input` | `"Header value must not exceed 1024 characters."` | Header value too long |
| `400` | `invalid_input` | `"Cannot override Host, Transfer-Encoding, or Content-Length headers."` | Blocked header |
| `400` | `invalid_input` | `"Maximum 10 tags allowed."` | Too many tags |
| `400` | `invalid_input` | `"Tags must be alphanumeric with hyphens, max 50 characters."` | Bad tag format |
| `400` | `invalid_input` | `"Confidence threshold must be between 0 and 100."` | Bad threshold |
| `400` | `invalid_input` | `"Request body is only allowed for POST method."` | Body with GET |
| `400` | `invalid_input` | `"Request body must not exceed 10KB."` | Body too large |
| `400` | `credential_warning` | `"URL appears to contain credentials in query parameters. Consider using custom headers instead."` | **Warning (200 + warning field)**, not rejection |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `402` | `plan_limit_reached` | `"Free plan is limited to 3 monitored URLs. Upgrade to monitor more."` | URL count exceeded |
| `402` | `interval_not_available` | `"5-minute interval requires Indie plan or higher."` | Interval too fast for plan |
| `409` | `duplicate_url` | `"You are already monitoring this URL."` | Same URL (normalized) exists for user |
| `422` | `self_referential` | `"Cannot monitor chirri.io URLs."` | Attempting to monitor Chirri itself |
| `429` | `rate_limited` | `"Rate limit exceeded. Retry after {n} seconds."` | Rate limited |

```json
// 402 plan_limit_reached example
{
  "error": {
    "code": "plan_limit_reached",
    "message": "Free plan is limited to 3 monitored URLs. Upgrade to monitor more.",
    "status": 402,
    "details": {
      "current_count": 3,
      "plan_limit": 3,
      "current_plan": "free",
      "upgrade_url": "https://chirri.io/delta/billing"
    }
  }
}
```

```json
// 400 ssrf_blocked example
{
  "error": {
    "code": "ssrf_blocked",
    "message": "Private/internal URLs cannot be monitored for security reasons.",
    "status": 400,
    "details": {
      "hostname": "192.168.1.100",
      "reason": "Resolved to private IP range (192.168.0.0/16)."
    }
  }
}
```

```json
// Credential warning (still 201, with warning)
{
  "id": "url_e5f6g7h8",
  "url": "https://api.example.com/v1/data?api_key=sk_test_xxx",
  "status": "learning",
  "warnings": [
    {
      "code": "credential_in_url",
      "message": "URL appears to contain an API key in query parameters. Consider moving it to custom headers for better security."
    }
  ],
  "message": "URL added with a security warning. Consider using custom headers for credentials."
}
```

---

### 5.2 `GET /v1/urls` — List Monitored URLs

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `status` | string | all | Filter: `learning`, `calibrating`, `active`, `paused`, `error`, `degraded`, `auth_required` |
| `tag` | string | all | Filter by tag |
| `search` | string | — | Search in URL and name (case-insensitive substring) |
| `sort` | string | `created_at` | `created_at`, `name`, `last_check_at`, `status` |
| `order` | string | `desc` | `asc` or `desc` |
| `cursor` | string | — | Pagination cursor |
| `limit` | int | 20 | Max 100 |

#### Success: `200 OK`

```json
{
  "data": [
    {
      "id": "url_e5f6g7h8",
      "url": "https://api.stripe.com/v1/prices",
      "name": "Stripe Prices API",
      "status": "active",
      "check_interval": "1h",
      "content_type": "json-api",
      "monitoring_method": "json-diff",
      "tags": ["payments", "critical"],
      "provider": {
        "name": "Stripe",
        "slug": "stripe",
        "icon_url": "https://cdn.chirri.io/providers/stripe.svg"
      },
      "stats": {
        "total_checks": 342,
        "changes_detected": 5,
        "avg_response_time_ms": 245,
        "uptime_percentage": 99.8
      },
      "last_check_at": "2026-03-23T15:00:00Z",
      "next_check_at": "2026-03-23T16:00:00Z",
      "created_at": "2026-03-23T12:00:00Z"
    }
  ],
  "has_more": true,
  "next_cursor": "cur_eyJ..."
}
```

#### Empty Result: `200 OK`

```json
{
  "data": [],
  "has_more": false,
  "next_cursor": null
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Invalid status filter. Must be one of: ..."` | Bad status filter |
| `400` | `invalid_input` | `"Limit must be between 1 and 100."` | Bad limit |
| `400` | `invalid_cursor` | `"Invalid pagination cursor."` | Malformed cursor |
| `401` | `unauthorized` | `"Authentication required."` | No auth |

---

### 5.3 `GET /v1/urls/:id` — Get URL Details

#### Success: `200 OK`

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.stripe.com/v1/prices",
  "name": "Stripe Prices API",
  "status": "active",
  "status_reason": null,
  "check_interval": "1h",
  "method": "GET",
  "headers": { "Accept": "application/json" },
  "tags": ["payments", "critical"],
  "content_type": "json-api",
  "monitoring_method": "json-diff",
  "classification_confidence": 92,
  "confidence_threshold": 80,
  "volatile_fields": ["request_id", "timestamp", "data[0].created"],
  "notification_config": {
    "email": true,
    "webhook_ids": ["wh_q7r8s9t0"],
    "min_severity": "warning",
    "quiet_hours": null,
    "digest_mode": false
  },
  "provider": {
    "name": "Stripe",
    "slug": "stripe",
    "icon_url": "https://cdn.chirri.io/providers/stripe.svg"
  },
  "learning": null,
  "recent_changes": [
    {
      "id": "chg_i9j0k1l2",
      "change_type": "schema",
      "severity": "breaking",
      "summary": "Field `amount` removed from response object",
      "acknowledged": false,
      "detected_at": "2026-03-23T14:32:00Z"
    }
  ],
  "stats": {
    "total_checks": 342,
    "changes_detected": 5,
    "false_positive_rate": 0.02,
    "avg_response_time_ms": 245,
    "uptime_percentage": 99.8,
    "p95_response_time_ms": 412,
    "last_status_code": 200,
    "response_size_bytes": 4523
  },
  "performance": {
    "current_response_time_ms": 234,
    "avg_24h_ms": 245,
    "avg_7d_ms": 252,
    "trend": "stable"
  },
  "last_check_at": "2026-03-23T15:00:00Z",
  "next_check_at": "2026-03-23T16:00:00Z",
  "created_at": "2026-03-23T12:00:00Z",
  "updated_at": "2026-03-23T15:00:00Z"
}
```

#### URL in Learning Phase: `200 OK`

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.example.com/v1/users",
  "status": "learning",
  "content_type": "json-api",
  "monitoring_method": "json-diff",
  "classification_confidence": 88,
  "learning": {
    "phase": "learning",
    "progress": 0.53,
    "samples_collected": 16,
    "samples_target": 30,
    "estimated_ready": "2026-03-23T12:06:40Z",
    "volatile_fields_detected": 3,
    "volatile_fields_preview": ["request_id", "timestamp", "trace_id"]
  },
  "message": "Learning... 16/30 checks complete. 3 volatile fields detected. Estimated ready: ~4 minutes."
}
```

#### URL in Calibrating Phase: `200 OK`

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.example.com/v1/users",
  "status": "calibrating",
  "learning": {
    "phase": "calibrating",
    "progress": 0.43,
    "calibrating_since": "2026-03-23T12:10:00Z",
    "calibrating_until": "2026-03-30T12:10:00Z",
    "days_remaining": 4,
    "volatile_fields_detected": 5,
    "suppressed_changes": 1
  },
  "message": "Calibrating (day 3 of 7). Detection accuracy improves over the first week. 1 borderline change suppressed."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"URL not found."` | Wrong ID or not owned by user |

---

### 5.4 `PATCH /v1/urls/:id` — Update URL

#### Request (all fields optional)

```json
{
  "name": "Updated Name",
  "interval": "5m",
  "status": "paused",
  "method": "POST",
  "headers": { "Authorization": "Bearer sk_test_..." },
  "body": "{\"limit\": 1}",
  "confidence_threshold": 90,
  "tags": ["payments"],
  "notifications": {
    "email": false,
    "webhook_ids": ["wh_q7r8s9t0"],
    "min_severity": "breaking"
  }
}
```

**Status transitions allowed via PATCH:**
- Any → `paused`
- `paused` → `active` (resumes monitoring)
- `auth_required` → will automatically retry with new headers
- `redirect_detected` + updating URL → starts fresh

#### Success: `200 OK`

Returns the full updated URL object (same shape as GET).

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | (various) | Validation errors (same as POST) |
| `400` | `invalid_status_transition` | `"Cannot transition from 'error' to 'active' directly. The URL will be retried automatically."` | Invalid status change |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `402` | `interval_not_available` | `"5-minute interval requires Pro plan or higher."` | Interval too fast |
| `404` | `not_found` | `"URL not found."` | Wrong ID |
| `409` | `duplicate_url` | `"You are already monitoring this URL."` | URL change creates duplicate |

---

### 5.5 `DELETE /v1/urls/:id` — Delete URL

#### Success: `204 No Content`

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"URL not found."` | Wrong ID |

**Side effects:**
- Monitoring stops immediately
- Decrements `shared_urls.subscriber_count`
- If subscriber count reaches 0, shared URL is cleaned up
- Historical data retained per plan retention period
- Associated `user_changes` records remain for the retention period

---

### 5.6 `POST /v1/urls/bulk` — Bulk Create URLs

Create up to 20 URLs in one request.

#### Request

```json
{
  "urls": [
    {
      "url": "https://api.stripe.com/v1/prices",
      "name": "Stripe Prices",
      "interval": "1h",
      "tags": ["payments"]
    },
    {
      "url": "https://api.stripe.com/v1/customers",
      "name": "Stripe Customers",
      "interval": "1h",
      "tags": ["payments"]
    }
  ]
}
```

#### Success: `200 OK` (not 201 — partial success possible)

```json
{
  "created": [
    {
      "index": 0,
      "url": { /* full url object */ }
    },
    {
      "index": 1,
      "url": { /* full url object */ }
    }
  ],
  "failed": [
    {
      "index": 2,
      "url": "https://192.168.1.1/api",
      "error": {
        "code": "ssrf_blocked",
        "message": "Private/internal URLs cannot be monitored for security reasons."
      }
    }
  ],
  "summary": {
    "total": 3,
    "created": 2,
    "failed": 1
  }
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"urls array is required."` | Missing urls |
| `400` | `invalid_input` | `"Maximum 20 URLs per bulk request."` | Too many |
| `400` | `invalid_input` | `"urls must be a non-empty array."` | Empty array |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `402` | `plan_limit_reached` | `"Adding {n} URLs would exceed your plan limit of {limit}. You have {remaining} slots remaining."` | Would exceed limit |

---

### 5.7 `DELETE /v1/urls/bulk` — Bulk Delete URLs

#### Request

```json
{
  "ids": ["url_e5f6g7h8", "url_a1b2c3d4"]
}
```

#### Success: `200 OK`

```json
{
  "deleted": ["url_e5f6g7h8", "url_a1b2c3d4"],
  "not_found": ["url_nonexistent"],
  "summary": {
    "total": 3,
    "deleted": 2,
    "not_found": 1
  }
}
```

---

## 6. URL Onboarding Flow — All States (Detailed)

This section documents every possible state a URL can be in after creation, what the user sees, and what happens next.

### State A: `learning` — Known API URL

**Trigger:** URL created, initial probe returns 2xx with JSON body, classification identifies REST API.

**User-facing message:**
> 🔍 REST API detected. Running first checks... Baseline will be ready in ~10 minutes.

**Dashboard UI:**
- URL card shows pulsing "Learning" badge in sakura pink
- Progress bar: 0/30 → 30/30 over 10 minutes
- Live counter of volatile fields detected
- Skeleton placeholders for stats (uptime, response time) that fill in as data arrives
- "Learning in progress" tooltip explains what's happening

**API response `learning` object:**
```json
{
  "phase": "learning",
  "progress": 0.53,
  "samples_collected": 16,
  "samples_target": 30,
  "estimated_ready": "2026-03-23T12:06:40Z",
  "volatile_fields_detected": 3,
  "volatile_fields_preview": ["request_id", "timestamp", "trace_id"]
}
```

**What happens next:**
1. 30 checks at 20-second intervals
2. After all samples: analyze volatility, establish baseline
3. Transition → `calibrating`
4. Webhook: `url.learning_complete`

---

### State B: `learning` — Known Provider

**Trigger:** URL matches domain pattern in `domain_patterns` table (e.g., `api.stripe.com`).

**User-facing message:**
> ✅ Stripe API detected. Monitoring with JSON structural diffing. 5 additional sources available.

**Dashboard UI:**
- Provider logo and name prominently displayed
- "Add more sources" card showing available monitoring targets (changelog, status page, etc.)
- Classification shown with high confidence badge
- Same learning progress bar

**API response additions:**
```json
{
  "provider": {
    "name": "Stripe",
    "slug": "stripe",
    "icon_url": "https://cdn.chirri.io/providers/stripe.svg",
    "sources_available": [
      { "type": "openapi_spec", "url": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json", "name": "OpenAPI Spec" },
      { "type": "changelog", "url": "https://stripe.com/docs/upgrades", "name": "API Changelog" },
      { "type": "status_page", "url": "https://status.stripe.com", "name": "Status Page" },
      { "type": "sdk_releases", "url": "https://github.com/stripe/stripe-node/releases.atom", "name": "Node SDK Releases" }
    ]
  },
  "classification_confidence": 95,
  "content_type": "json-api",
  "monitoring_method": "json-diff"
}
```

---

### State C: `active` — RSS/Atom Feed

**Trigger:** Content-Type is `application/rss+xml`, `application/atom+xml`, or body parses as valid RSS/Atom.

**User-facing message:**
> 📰 RSS feed detected. Monitoring for new entries.

**Dashboard UI:**
- Feed icon
- "Active" badge immediately (no learning)
- Shows most recent feed entries
- Entry count

**State transitions:** Goes directly to `active` — no learning phase needed for feeds.

---

### State D: `active` — OpenAPI Spec

**Trigger:** Body parses as valid OpenAPI 2.0 (Swagger) or 3.x spec.

**User-facing message:**
> 📋 OpenAPI spec detected (47 endpoints, 156 schemas). Monitoring for structural changes.

**Dashboard UI:**
- Spec summary card: title, version, endpoint count, schema count
- Endpoint tree view (collapsible)
- "Active" badge immediately
- Shows spec version prominently

---

### State E: `classifying` — Unknown URL

**Trigger:** URL doesn't match any known pattern. Classification pipeline running.

**User-facing message:**
> ⏳ Analyzing URL... We're figuring out the best monitoring strategy.

**Duration:** 5–30 seconds typically.

**Dashboard UI:**
- Spinner with "Classifying..." text
- Classification pipeline stages shown:
  1. ◉ URL pattern analysis
  2. ◉ Content-Type detection
  3. ○ Response structure analysis
  4. ○ Discovery probes (RSS, OpenAPI)
  5. ○ Monitoring method selection

**What happens next:**
- Classification completes → transition to `learning`
- If classification fails, falls back to `content-hash` method and still enters `learning`

---

### State F: `auth_required` — Authentication Needed

**Trigger:** Initial probe returns 401 or 403.

**User-facing message:**
> 🔒 This URL requires authentication. Add headers to start monitoring.

**Dashboard UI:**
- Lock icon
- "Auth Required" badge in amber
- Inline form to add authentication headers
- Example templates: `Authorization: Bearer <token>`, `X-API-Key: <key>`
- "Test connection" button
- Help link to docs on authentication

**API response:**
```json
{
  "status": "auth_required",
  "status_reason": "Initial fetch returned HTTP 401 Unauthorized.",
  "auth_hint": {
    "status_code": 401,
    "www_authenticate": "Bearer realm=\"api\"",
    "suggestion": "Add an Authorization header with a Bearer token."
  }
}
```

**What happens next:**
- User PATCHes headers → system retries probe
- If probe succeeds → transition to `learning`
- If still fails → stays `auth_required` with updated `status_reason`
- No automatic retries (wastes resources hitting 401)

---

### State G: `limited` — Bot Protection

**Trigger:** Response contains Cloudflare challenge page, CAPTCHA, or JS challenge indicators.

**Detection heuristics:**
- `cf-mitigated: challenge` header
- `server: cloudflare` + 403 with HTML body containing "challenge"
- Body contains `_cf_chl_opt` or similar markers
- Response is HTML when JSON was expected

**User-facing message:**
> ⚠️ This URL is behind bot protection. Monitoring may have limited accuracy.

**Dashboard UI:**
- Shield icon with warning
- "Limited" badge in orange
- Suggestions: "Try monitoring the API endpoint directly instead of the website"
- Option to proceed anyway (we'll monitor what we can: status codes, response times, headers)

**What happens next:**
- URL enters `learning` with limited capability
- Monitors: status code, response time, headers, response size
- Cannot do JSON structural diffing through bot protection
- Periodic retries to see if protection is relaxed

---

### State H: `error` — DNS Failure

**Trigger:** DNS resolution fails (NXDOMAIN, SERVFAIL, etc.)

Note: This is a **creation-time rejection**, not a persisted state. The URL is NOT created.

**API response:** `400`

```json
{
  "error": {
    "code": "dns_resolution_failed",
    "message": "Could not resolve hostname 'api.nonexistent.example'. Check the URL and try again.",
    "status": 400,
    "details": {
      "hostname": "api.nonexistent.example",
      "dns_error": "NXDOMAIN"
    }
  }
}
```

**Dashboard UI:**
- Red error inline on the URL input
- "Could not resolve hostname. Check the URL and try again."
- URL is NOT added to the dashboard

---

### State I: `degraded` — Server Errors (5xx)

**Trigger:** Initial fetch or subsequent checks return 5xx status codes.

On creation: If the very first probe returns 5xx, the URL is created in `degraded` status.
During monitoring: After 3+ consecutive failures, `active` → `degraded`.

**User-facing message:**
> ⚠️ URL returned a server error (503). We'll keep trying — this may be temporary.

**Dashboard UI:**
- Warning icon
- "Degraded" badge in orange
- Error history timeline
- "Last successful check: {time}" (or "Never" if first check failed)
- Auto-retry indicator showing next check time

**What happens next:**
- Continues checking at normal interval
- When a successful check occurs → transition to `learning` (if never learned) or `active` (if was previously active)
- After 24h of continuous failure → transition to `error`

---

### State J: `rejected` — SSRF Blocked

**Trigger:** URL resolves to private IP, localhost, metadata endpoint, etc.

**API response:** `400`

```json
{
  "error": {
    "code": "ssrf_blocked",
    "message": "Private/internal URLs cannot be monitored for security reasons.",
    "status": 400,
    "details": {
      "hostname": "192.168.1.100",
      "resolved_ip": "192.168.1.100",
      "reason": "Resolved to private IP range (192.168.0.0/16).",
      "blocked_ranges": "Private networks, localhost, link-local, metadata endpoints"
    }
  }
}
```

**Dashboard UI:**
- Red error inline
- "This URL points to a private network. Only publicly accessible URLs can be monitored."
- URL is NOT added

---

### State K: `monitoring_empty` — Empty Response

**Trigger:** 200 OK but response body is empty (0 bytes or only whitespace).

**User-facing message:**
> ℹ️ URL returned an empty response. We'll monitor for when content appears.

**Dashboard UI:**
- Info icon
- "Empty Response" badge in blue
- Shows: status code, headers, response time (what we CAN monitor)
- "We're watching for content to appear"

**What happens next:**
- Monitors status code, headers, response time
- When body appears → transition to `classifying` → `learning`

---

### State L: `redirect_detected` — Redirects

**Trigger:** Initial fetch returns 301, 302, 303, 307, or 308.

**User-facing message:**
> ↗️ URL redirects to https://api.example.com/v2. Would you like to monitor the final destination instead?

**Dashboard UI:**
- Redirect arrow icon
- Shows redirect chain visually:
  ```
  https://api.example.com/v1 → 301 → https://api.example.com/v2 → 200 OK
  ```
- Three action buttons:
  1. "Monitor destination" — updates URL to final destination
  2. "Monitor redirect" — monitors the redirect itself (detects if redirect changes)
  3. "Monitor both" — creates two URL entries (counts toward limit)

**API response:**
```json
{
  "status": "redirect_detected",
  "redirect": {
    "status_code": 301,
    "location": "https://api.example.com/v2",
    "chain": [
      { "url": "https://api.example.com/v1", "status": 301 },
      { "url": "https://api.example.com/v2", "status": 200 }
    ],
    "final_url": "https://api.example.com/v2",
    "actions": {
      "monitor_destination": "PATCH /v1/urls/{id} with {\"url\": \"https://api.example.com/v2\"}",
      "monitor_redirect": "PATCH /v1/urls/{id} with {\"follow_redirects\": false}",
      "monitor_both": "POST /v1/urls with the destination URL"
    }
  }
}
```

**What happens next:**
- Waits for user decision
- No automatic checks until resolved
- PATCH to update URL → re-probes → enters `learning`

---

### State M: `active` — Normal Monitoring

**Trigger:** Completed learning + calibrating phases.

**User-facing message:**
> ✅ Active. Last check: 2 minutes ago. No changes detected.

**Dashboard UI:**
- Green "Active" badge
- Real-time stats: uptime, response time, last check, next check
- Changes timeline
- Mini response time graph (last 24h)

---

### State N: `calibrating` — First Week

**Trigger:** Learning complete, baseline established.

**User-facing message:**
> 🔄 Monitoring active (calibrating). Detection accuracy improves over the first 7 days.

**Dashboard UI:**
- Blue "Calibrating" badge with day counter (Day 3/7)
- All monitoring features active
- Note: "Some borderline changes may be suppressed during calibration"
- Progress indicator to full "Active" status

---

### State O: `paused` — User Paused

**Trigger:** User sets status to `paused` via PATCH.

**User-facing message:**
> ⏸ Paused. No checks are running. Resume to continue monitoring.

**Dashboard UI:**
- Gray "Paused" badge
- Big "Resume" button
- Shows when paused and by whom
- Historical data still visible

---

### State P: `error` — Persistent Error

**Trigger:** 24+ hours of consecutive failures, or permanent error (e.g., 410 Gone).

**User-facing message:**
> ❌ URL has been unreachable for 26 hours. Last successful check: Mar 22 at 14:00 UTC.

**Dashboard UI:**
- Red "Error" badge
- Error details: error type, duration, last successful check
- "Retry now" button
- "Delete" button
- Suggestion to check if URL changed

**What happens next:**
- Continues checking at reduced frequency (1 check/hour regardless of interval)
- Doesn't count against check quota
- If succeeds → `recovered` → `active`
- User can delete or update URL

---

## 7. Changes Endpoints

### 7.1 `GET /v1/changes` — List Changes

#### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `url_id` | string | all | Filter by URL |
| `severity` | string | all | `critical`, `breaking`, `warning`, `info` |
| `type` | string | all | `schema`, `status_code`, `header`, `content`, `redirect`, `timing`, `tls`, `error_format`, `availability`, `rate_limit` |
| `since` | ISO date | — | Changes after this date |
| `until` | ISO date | — | Changes before this date |
| `acknowledged` | boolean | all | Filter by review state |
| `feedback` | string | all | `real_change`, `false_positive`, `not_sure` |
| `cursor` | string | — | Pagination |
| `limit` | int | 20 | Max 100 |

#### Success: `200 OK`

```json
{
  "data": [
    {
      "id": "chg_i9j0k1l2",
      "url": {
        "id": "url_e5f6g7h8",
        "url": "https://api.stripe.com/v1/prices",
        "name": "Stripe Prices API"
      },
      "change_type": "schema",
      "severity": "breaking",
      "confidence": 95,
      "summary": "Field `amount` removed from response object",
      "confirmation_status": "confirmed",
      "acknowledged": false,
      "feedback": null,
      "detected_at": "2026-03-23T14:32:00Z"
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Invalid severity filter."` | Bad severity value |
| `400` | `invalid_input` | `"'since' must be a valid ISO 8601 date."` | Bad date format |
| `401` | `unauthorized` | `"Authentication required."` | No auth |

---

### 7.2 `GET /v1/changes/:id` — Get Change Detail

The **core value endpoint** — full diff with before/after.

#### Success: `200 OK`

```json
{
  "id": "chg_i9j0k1l2",
  "url": {
    "id": "url_e5f6g7h8",
    "url": "https://api.stripe.com/v1/prices",
    "name": "Stripe Prices API"
  },
  "change_type": "schema",
  "severity": "breaking",
  "confidence": 95,
  "summary": "Field `amount` removed from response object",
  "description": "The `amount` field (type: number) was removed from the root response object. This is a breaking change that will affect any integration reading this field. The `unit_amount` field (type: number) was added, which may be a replacement.",
  "actions": [
    "Update your integration to handle the missing `amount` field",
    "Check if `unit_amount` is the replacement field",
    "Review the Stripe changelog for migration guidance"
  ],
  "diff": {
    "type": "jsondiffpatch",
    "delta": {
      "amount": [100, 0, 0],
      "unit_amount": [1000]
    },
    "human_readable": [
      { "action": "removed", "path": "$.amount", "old_value": 100, "old_type": "number" },
      { "action": "added", "path": "$.unit_amount", "new_value": 1000, "new_type": "number" }
    ]
  },
  "previous_state": {
    "status_code": 200,
    "headers": {
      "content-type": "application/json",
      "stripe-version": "2025-12-01"
    },
    "schema": {
      "id": "string",
      "object": "string",
      "amount": "number",
      "currency": "string",
      "active": "boolean"
    },
    "snapshot_id": "snap_prev123",
    "snapshot_url": "/v1/snapshots/snap_prev123"
  },
  "current_state": {
    "status_code": 200,
    "headers": {
      "content-type": "application/json",
      "stripe-version": "2026-03-01"
    },
    "schema": {
      "id": "string",
      "object": "string",
      "unit_amount": "number",
      "currency": "string",
      "active": "boolean"
    },
    "snapshot_id": "snap_curr456",
    "snapshot_url": "/v1/snapshots/snap_curr456"
  },
  "header_changes": {
    "changed": {
      "stripe-version": {
        "old": "2025-12-01",
        "new": "2026-03-01"
      }
    },
    "added": {},
    "removed": {}
  },
  "confirmation": {
    "status": "confirmed",
    "stage1_at": "2026-03-23T14:32:05Z",
    "stage1_matched": true,
    "stage2_at": "2026-03-23T15:02:05Z",
    "stage2_matched": true
  },
  "acknowledged": false,
  "acknowledged_at": null,
  "acknowledge_note": null,
  "feedback": null,
  "feedback_comment": null,
  "detected_at": "2026-03-23T14:32:00Z",
  "confirmed_at": "2026-03-23T15:02:05Z"
}
```

#### Change Types and Their Shapes

**Schema change:**
```json
{
  "change_type": "schema",
  "severity": "breaking",
  "diff": {
    "human_readable": [
      { "action": "removed", "path": "$.data[].amount", "old_type": "number" },
      { "action": "added", "path": "$.data[].unit_amount", "new_type": "number" },
      { "action": "type_changed", "path": "$.data[].active", "old_type": "boolean", "new_type": "string" }
    ]
  }
}
```

**Status code change:**
```json
{
  "change_type": "status_code",
  "severity": "critical",
  "summary": "Status code changed from 200 to 404 Not Found",
  "diff": {
    "human_readable": [
      { "action": "changed", "path": "status_code", "old_value": 200, "new_value": 404 }
    ]
  }
}
```

**Header change:**
```json
{
  "change_type": "header",
  "severity": "warning",
  "summary": "Deprecation header added: Sunset: Sat, 01 Jun 2026 00:00:00 GMT",
  "diff": {
    "human_readable": [
      { "action": "added", "path": "headers.sunset", "new_value": "Sat, 01 Jun 2026 00:00:00 GMT" },
      { "action": "added", "path": "headers.deprecation", "new_value": "true" }
    ]
  },
  "deprecation_info": {
    "sunset_date": "2026-06-01T00:00:00Z",
    "days_until_sunset": 69,
    "deprecation_link": "https://api.example.com/deprecation-notice"
  }
}
```

**Content change:**
```json
{
  "change_type": "content",
  "severity": "info",
  "summary": "Response content changed (structure unchanged)",
  "diff": {
    "human_readable": [
      { "action": "value_changed", "path": "$.version", "old_value": "2.3.0", "new_value": "2.4.0" }
    ]
  }
}
```

**Rate limit change:**
```json
{
  "change_type": "rate_limit",
  "severity": "warning",
  "summary": "Rate limit decreased from 1000/min to 500/min",
  "diff": {
    "human_readable": [
      { "action": "changed", "path": "headers.x-ratelimit-limit", "old_value": "1000", "new_value": "500" }
    ]
  }
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"Change not found."` | Wrong ID or not visible to user |

---

### 7.3 `POST /v1/changes/:id/acknowledge`

Mark a change as reviewed.

#### Request

```json
{
  "note": "Reviewed. Updating integration to use unit_amount."
}
```

| Field | Type | Required |
|-------|------|----------|
| `note` | string | no, max 1000 chars |

#### Success: `200 OK`

```json
{
  "id": "chg_i9j0k1l2",
  "acknowledged": true,
  "acknowledged_at": "2026-03-23T16:00:00Z",
  "acknowledge_note": "Reviewed. Updating integration to use unit_amount."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Note must not exceed 1000 characters."` | Note too long |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"Change not found."` | Wrong ID |
| `409` | `already_acknowledged` | `"Change is already acknowledged."` | Double ack |

---

### 7.4 `DELETE /v1/changes/:id/acknowledge`

Un-acknowledge a change (re-open for review).

#### Success: `200 OK`

```json
{
  "id": "chg_i9j0k1l2",
  "acknowledged": false,
  "acknowledged_at": null,
  "acknowledge_note": null
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"Change not found."` | Wrong ID |

---

### 7.5 `POST /v1/changes/:id/feedback`

Submit feedback on change detection quality.

#### Request

```json
{
  "verdict": "false_positive",
  "comment": "This field always changes — it's a request ID."
}
```

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `verdict` | string | **yes** | `real_change`, `false_positive`, `not_sure` |
| `comment` | string | no | Max 1000 chars |

#### Success: `200 OK`

```json
{
  "id": "chg_i9j0k1l2",
  "feedback": "false_positive",
  "feedback_comment": "This field always changes — it's a request ID.",
  "feedback_at": "2026-03-23T16:05:00Z",
  "action_taken": "Field path '$.request_id' added to volatile field list for this URL."
}
```

**Side effects:**
- `false_positive`: Field(s) added to URL's volatile list automatically
- If 3+ users report the same change as FP on a shared URL: auto-suppress for all subscribers
- `real_change`: Boosts confidence weight for similar patterns
- `not_sure`: Logged for manual review

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Verdict must be one of: real_change, false_positive, not_sure."` | Bad verdict |
| `400` | `invalid_input` | `"Comment must not exceed 1000 characters."` | Comment too long |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"Change not found."` | Wrong ID |
| `409` | `feedback_exists` | `"You have already submitted feedback for this change. Use PATCH to update."` | Duplicate feedback |

---

### 7.6 `PATCH /v1/changes/:id/feedback`

Update existing feedback.

#### Success: `200 OK`

Same shape as POST response.

---

### 7.7 `GET /v1/changes/summary`

Aggregated change statistics. Useful for dashboards.

#### Query Parameters

| Param | Type | Default |
|-------|------|---------|
| `since` | ISO date | 7 days ago |
| `until` | ISO date | now |
| `url_id` | string | all URLs |

#### Success: `200 OK`

```json
{
  "period": {
    "since": "2026-03-16T00:00:00Z",
    "until": "2026-03-23T23:59:59Z"
  },
  "total_changes": 12,
  "by_severity": {
    "critical": 1,
    "breaking": 3,
    "warning": 5,
    "info": 3
  },
  "by_type": {
    "schema": 4,
    "header": 3,
    "content": 2,
    "status_code": 1,
    "rate_limit": 1,
    "timing": 1
  },
  "acknowledged": 8,
  "unacknowledged": 4,
  "false_positive_rate": 0.08,
  "most_volatile_urls": [
    {
      "id": "url_e5f6g7h8",
      "url": "https://api.example.com/v1/data",
      "name": "Example API",
      "changes": 5
    }
  ]
}
```

---

## 8. Snapshot Endpoints

### 8.1 `GET /v1/snapshots/:id`

Retrieve a full response snapshot.

#### Success: `200 OK`

```json
{
  "id": "snap_m3n4o5p6",
  "url_id": "url_e5f6g7h8",
  "status_code": 200,
  "headers": {
    "content-type": "application/json",
    "x-request-id": "req_abc123",
    "x-ratelimit-limit": "1000",
    "stripe-version": "2026-03-01"
  },
  "body": {
    "id": "price_1abc",
    "object": "price",
    "unit_amount": 1000,
    "currency": "usd",
    "active": true
  },
  "body_size_bytes": 4523,
  "truncated": false,
  "response_time_ms": 234,
  "checked_at": "2026-03-23T14:32:00Z"
}
```

#### Large Body (truncated): `200 OK`

```json
{
  "id": "snap_m3n4o5p6",
  "body": "... first 1MB of response ...",
  "body_size_bytes": 5242880,
  "truncated": true,
  "truncated_at_bytes": 1048576,
  "full_body_url": "https://cdn.chirri.io/snapshots/snap_m3n4o5p6.json.gz",
  "message": "Response truncated at 1MB. Full body available via download link (valid for 1 hour)."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `403` | `plan_required` | `"Snapshot access requires Indie plan or higher."` | Free plan |
| `404` | `not_found` | `"Snapshot not found."` | Wrong ID, expired, or not owned |
| `410` | `expired` | `"Snapshot has been archived. Available snapshots are limited to your plan's retention period."` | Past retention |

---

## 9. Webhook Endpoints

### 9.1 `POST /v1/webhooks` — Create Webhook

#### Request

```json
{
  "url": "https://example.com/webhook",
  "name": "Production Webhook",
  "events": ["change.confirmed", "url.error", "url.recovered"]
}
```

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `url` | string | **yes** | — |
| `name` | string | no | `"Default Webhook"` |
| `events` | string[] | no | `["change.confirmed"]` |

Valid events: `change.detected`, `change.confirmed`, `url.created`, `url.error`, `url.recovered`, `url.degraded`, `url.learning_complete`, `url.active`, `url.paused`, `url.resumed`, `account.usage_alert`

#### Success: `201 Created`

```json
{
  "id": "wh_q7r8s9t0",
  "url": "https://example.com/webhook",
  "name": "Production Webhook",
  "signing_secret": "whsec_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "events": ["change.confirmed", "url.error", "url.recovered"],
  "is_active": true,
  "consecutive_failures": 0,
  "last_success_at": null,
  "last_failure_at": null,
  "created_at": "2026-03-23T12:00:00Z"
}
```

> ⚠️ `signing_secret` is shown ONCE.

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_url` | `"Webhook URL must use HTTPS."` | HTTP URL |
| `400` | `invalid_url` | `"Invalid webhook URL format."` | Malformed |
| `400` | `ssrf_blocked` | `"Webhook URL cannot point to a private network."` | SSRF blocked |
| `400` | `invalid_input` | `"Invalid event type '{event}'. Valid events: ..."` | Unknown event |
| `400` | `invalid_input` | `"Name must not exceed 100 characters."` | Name too long |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `402` | `plan_limit_reached` | `"Free plan is limited to 1 webhook. Upgrade to add more."` | Webhook limit |
| `409` | `duplicate_webhook` | `"A webhook with this URL already exists."` | Same URL |

---

### 9.2 `GET /v1/webhooks` — List Webhooks

#### Success: `200 OK`

```json
{
  "data": [
    {
      "id": "wh_q7r8s9t0",
      "url": "https://example.com/webhook",
      "name": "Production Webhook",
      "events": ["change.confirmed", "url.error"],
      "is_active": true,
      "consecutive_failures": 0,
      "last_success_at": "2026-03-23T15:00:00Z",
      "last_failure_at": null,
      "created_at": "2026-03-23T12:00:00Z"
    }
  ]
}
```

> Note: `signing_secret` is never returned after creation.

---

### 9.3 `GET /v1/webhooks/:id` — Get Webhook Detail

#### Success: `200 OK`

```json
{
  "id": "wh_q7r8s9t0",
  "url": "https://example.com/webhook",
  "name": "Production Webhook",
  "events": ["change.confirmed", "url.error"],
  "is_active": true,
  "consecutive_failures": 0,
  "last_success_at": "2026-03-23T15:00:00Z",
  "last_failure_at": null,
  "last_failure_reason": null,
  "disabled_at": null,
  "recent_deliveries": [
    {
      "id": "del_c9d0e1f2",
      "event_type": "change.confirmed",
      "status_code": 200,
      "response_time_ms": 145,
      "success": true,
      "delivered_at": "2026-03-23T15:00:00Z"
    }
  ],
  "stats": {
    "total_deliveries": 47,
    "successful": 46,
    "failed": 1,
    "success_rate": 0.979
  },
  "created_at": "2026-03-23T12:00:00Z",
  "updated_at": "2026-03-23T15:00:00Z"
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"Webhook not found."` | Wrong ID |

---

### 9.4 `PATCH /v1/webhooks/:id` — Update Webhook

#### Request

```json
{
  "url": "https://new-url.com/webhook",
  "name": "Updated Name",
  "events": ["change.confirmed", "change.detected"],
  "is_active": true
}
```

#### Success: `200 OK`

Full webhook object.

#### Special Case: Re-enabling a disabled webhook

```json
// PATCH with is_active: true on a disabled webhook
{
  "id": "wh_q7r8s9t0",
  "is_active": true,
  "consecutive_failures": 0,
  "disabled_at": null,
  "message": "Webhook re-enabled. Failure counter reset."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_url` | `"Webhook URL must use HTTPS."` | HTTP URL |
| `400` | `invalid_input` | `"Invalid event type."` | Unknown event |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"Webhook not found."` | Wrong ID |

---

### 9.5 `DELETE /v1/webhooks/:id` — Delete Webhook

#### Success: `204 No Content`

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"Webhook not found."` | Wrong ID |

---

### 9.6 `POST /v1/webhooks/:id/test` — Test Webhook

Sends a test event with sample data.

#### Success: `200 OK`

```json
{
  "delivery": {
    "id": "del_test123",
    "event_type": "test",
    "status_code": 200,
    "response_time_ms": 145,
    "response_body": "OK",
    "success": true,
    "delivered_at": "2026-03-23T16:00:00Z"
  }
}
```

#### Test Failure: `200 OK` (delivery attempted but failed)

```json
{
  "delivery": {
    "id": "del_test456",
    "event_type": "test",
    "status_code": 500,
    "response_time_ms": 2340,
    "response_body": "Internal Server Error",
    "success": false,
    "error": "Webhook endpoint returned HTTP 500.",
    "delivered_at": "2026-03-23T16:00:00Z"
  }
}
```

#### Connection Failure: `200 OK`

```json
{
  "delivery": {
    "id": "del_test789",
    "event_type": "test",
    "status_code": null,
    "response_time_ms": null,
    "success": false,
    "error": "Connection refused. Ensure your webhook endpoint is reachable.",
    "delivered_at": "2026-03-23T16:00:00Z"
  }
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"Webhook not found."` | Wrong ID |
| `429` | `rate_limited` | `"Webhook test rate limited. Max 5 tests per minute."` | Spam protection |

---

### 9.7 `GET /v1/webhooks/:id/deliveries` — Delivery Log

#### Query Parameters

| Param | Type | Default |
|-------|------|---------|
| `status` | string | all | `success`, `failed` |
| `since` | ISO date | 7 days ago |
| `cursor` | string | — |
| `limit` | int | 20 |

#### Success: `200 OK`

```json
{
  "data": [
    {
      "id": "del_c9d0e1f2",
      "event_type": "change.confirmed",
      "payload_preview": {
        "change_id": "chg_i9j0k1l2",
        "severity": "breaking",
        "summary": "Field `amount` removed..."
      },
      "status_code": 200,
      "response_time_ms": 145,
      "response_body_preview": "OK",
      "success": true,
      "attempt_number": 1,
      "delivered_at": "2026-03-23T15:00:00Z"
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

---

### 9.8 `POST /v1/webhooks/:id/rotate-secret`

Rotate the signing secret. Old secret immediately stops working.

#### Success: `200 OK`

```json
{
  "id": "wh_q7r8s9t0",
  "signing_secret": "whsec_newSecretHere...",
  "rotated_at": "2026-03-23T16:00:00Z",
  "message": "Signing secret rotated. Update your webhook verification code immediately."
}
```

> ⚠️ New `signing_secret` shown ONCE.

---

## 10. Integration Endpoints

### 10.1 `POST /v1/integrations` — Create Integration

#### Request (varies by type)

**Slack:**
```json
{
  "type": "slack",
  "name": "Engineering Channel",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/T.../B.../xxx"
  }
}
```

**Discord:**
```json
{
  "type": "discord",
  "name": "API Alerts Channel",
  "config": {
    "webhook_url": "https://discord.com/api/webhooks/123/abc..."
  }
}
```

**Telegram:**
```json
{
  "type": "telegram",
  "name": "Dev Alerts Bot",
  "config": {
    "bot_token": "123456:ABC-DEF...",
    "chat_id": "-1001234567890"
  }
}
```

**PagerDuty:**
```json
{
  "type": "pagerduty",
  "name": "On-Call Alerts",
  "config": {
    "integration_key": "abc123..."
  }
}
```

#### Success: `201 Created`

```json
{
  "id": "int_u1v2w3x4",
  "type": "slack",
  "name": "Engineering Channel",
  "is_active": true,
  "verified": true,
  "created_at": "2026-03-23T12:00:00Z"
}
```

> Note: `config` is never returned (contains secrets).

#### Verification: System sends a test message to verify the integration works.

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Type must be one of: slack, discord, telegram, teams, pagerduty, opsgenie."` | Unknown type |
| `400` | `invalid_input` | `"Slack webhook URL must start with https://hooks.slack.com/"` | Bad Slack URL |
| `400` | `invalid_input` | `"Discord webhook URL must start with https://discord.com/api/webhooks/"` | Bad Discord URL |
| `400` | `integration_verification_failed` | `"Could not send test message to Slack. Verify the webhook URL is correct."` | Test message failed |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `402` | `plan_required` | `"Integrations require Indie plan or higher."` | Free plan |
| `409` | `duplicate_integration` | `"An integration with this configuration already exists."` | Duplicate |

---

### 10.2 `GET /v1/integrations` — List Integrations

#### Success: `200 OK`

```json
{
  "data": [
    {
      "id": "int_u1v2w3x4",
      "type": "slack",
      "name": "Engineering Channel",
      "is_active": true,
      "last_used_at": "2026-03-23T15:00:00Z",
      "created_at": "2026-03-23T12:00:00Z"
    }
  ]
}
```

---

### 10.3 `PATCH /v1/integrations/:id` — Update Integration

Can update `name`, `is_active`, and `config`.

#### Success: `200 OK`

---

### 10.4 `DELETE /v1/integrations/:id` — Delete Integration

#### Success: `204 No Content`

---

### 10.5 `POST /v1/integrations/:id/test` — Test Integration

#### Success: `200 OK`

```json
{
  "success": true,
  "message": "Test message sent to Slack channel 'Engineering Channel'.",
  "delivered_at": "2026-03-23T16:00:00Z"
}
```

#### Failure: `200 OK`

```json
{
  "success": false,
  "error": "Slack returned HTTP 404. The webhook URL may have been revoked.",
  "delivered_at": "2026-03-23T16:00:00Z"
}
```

---

## 11. Classification Endpoints

### 11.1 `GET /v1/urls/:id/classification` — Get Classification Details

#### Success: `200 OK`

```json
{
  "url_id": "url_e5f6g7h8",
  "content_type": "json-api",
  "monitoring_method": "json-diff",
  "confidence": 92,
  "classified_at": "2026-03-23T12:00:05Z",
  "pipeline_results": {
    "phase_0_path_analysis": {
      "result": "rest_api",
      "confidence": 85,
      "reason": "URL path contains /v1/ pattern"
    },
    "phase_1_probe": {
      "status_code": 200,
      "content_type_header": "application/json",
      "response_size_bytes": 4523
    },
    "phase_2_content_analysis": {
      "result": "json-api",
      "confidence": 92,
      "reason": "Valid JSON object with consistent schema structure"
    },
    "phase_3_discovery": {
      "rss_feed": null,
      "openapi_spec": null,
      "changelog": null,
      "probes_made": 3,
      "probes_budget_remaining": 0
    }
  },
  "alternatives": [
    {
      "method": "content-hash",
      "confidence": 60,
      "reason": "Fallback: hash comparison"
    }
  ],
  "re_probe_scheduled": "2026-03-30T12:00:00Z"
}
```

#### Before Classification Complete: `200 OK`

```json
{
  "url_id": "url_e5f6g7h8",
  "content_type": null,
  "monitoring_method": null,
  "confidence": null,
  "status": "in_progress",
  "current_phase": 2,
  "total_phases": 5,
  "started_at": "2026-03-23T12:00:00Z",
  "estimated_complete": "2026-03-23T12:00:15Z"
}
```

---

### 11.2 `POST /v1/urls/:id/classify` — Re-run Classification

Forces re-classification. Useful if URL content type changed.

#### Success: `200 OK`

Same shape as GET classification, with fresh results.

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"URL not found."` | Wrong ID |
| `409` | `classification_in_progress` | `"Classification is already running for this URL."` | Duplicate request |
| `429` | `rate_limited` | `"Classification can only be triggered once per hour per URL."` | Spam prevention |

---

### 11.3 `PATCH /v1/urls/:id/monitoring` — Override Monitoring Method

User manually overrides auto-detected method.

#### Request

```json
{
  "monitoring_method": "feed-poll",
  "feed_url": "https://example.com/feed.xml"
}
```

| Field | Type | Required |
|-------|------|----------|
| `monitoring_method` | string | **yes** |
| `feed_url` | string | no (only for feed-poll) |

Valid methods: `json-diff`, `spec-diff`, `feed-poll`, `content-hash`, `header-only`

#### Success: `200 OK`

Returns updated URL object with new monitoring method.

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Invalid monitoring method."` | Unknown method |
| `400` | `invalid_input` | `"feed_url is required when monitoring_method is 'feed-poll'."` | Missing feed URL |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"URL not found."` | Wrong ID |

---

### 11.4 `GET /v1/urls/:id/quality` — Monitoring Quality Score

#### Success: `200 OK`

```json
{
  "url_id": "url_e5f6g7h8",
  "quality_score": 87,
  "components": {
    "classification_confidence": 92,
    "false_positive_rate": 0.02,
    "uptime": 99.8,
    "response_consistency": 95,
    "volatile_field_coverage": 100
  },
  "stats": {
    "total_checks": 342,
    "changes_detected": 5,
    "false_positives_reported": 1,
    "avg_response_time_ms": 245,
    "uptime_percentage": 99.8,
    "volatile_fields_count": 3
  },
  "recommendations": [
    "Consider lowering confidence threshold from 80 to 70 — your false positive rate is very low."
  ]
}
```

---

### 11.5 `GET /v1/patterns` — List Domain Patterns

Public endpoint showing known domain patterns.

#### Success: `200 OK`

```json
{
  "data": [
    {
      "domain": "github.com",
      "path_pattern": "/*/*",
      "content_type": "html-with-atom",
      "monitoring_method": "feed-poll",
      "rewrite": "{url}/releases.atom",
      "description": "GitHub repository — monitors release feed"
    },
    {
      "domain": "*.statuspage.io",
      "content_type": "status-page",
      "monitoring_method": "json-diff",
      "description": "Statuspage.io status pages"
    },
    {
      "domain": "api.stripe.com",
      "content_type": "json-api",
      "monitoring_method": "json-diff",
      "confidence": 95,
      "description": "Stripe API endpoints"
    }
  ],
  "total": 42
}
```

---

## 12. Monitoring Pack Endpoints

### 12.1 `GET /v1/packs` — List Packs

#### Query Parameters

| Param | Type | Default |
|-------|------|---------|
| `category` | string | all |
| `search` | string | — |

#### Success: `200 OK`

```json
{
  "data": [
    {
      "id": "pack_k7l8m9n0",
      "slug": "stripe-payment-stack",
      "name": "Stripe Payment Stack",
      "description": "Monitor Stripe API endpoints, OpenAPI spec, changelog, and status page",
      "icon": "💳",
      "url_count": 8,
      "category": "payments",
      "urls_preview": [
        { "url": "https://api.stripe.com/v1/prices", "name": "Prices API" },
        { "url": "https://status.stripe.com", "name": "Status Page" }
      ]
    },
    {
      "id": "pack_o1p2q3r4",
      "slug": "openai-ai-stack",
      "name": "OpenAI Stack",
      "description": "Monitor OpenAI API, models endpoint, status page, and Python SDK releases",
      "icon": "🤖",
      "url_count": 5,
      "category": "ai"
    }
  ]
}
```

---

### 12.2 `GET /v1/packs/:id` — Get Pack Detail

#### Success: `200 OK`

```json
{
  "id": "pack_k7l8m9n0",
  "slug": "stripe-payment-stack",
  "name": "Stripe Payment Stack",
  "description": "Complete monitoring setup for Stripe API integrations. Covers API endpoints, spec changes, status page, and SDK releases.",
  "icon": "💳",
  "category": "payments",
  "url_count": 8,
  "urls": [
    {
      "url": "https://api.stripe.com/v1/prices",
      "name": "Stripe Prices API",
      "monitoring_method": "json-diff",
      "recommended_interval": "1h"
    },
    {
      "url": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
      "name": "Stripe OpenAPI Spec",
      "monitoring_method": "spec-diff",
      "recommended_interval": "6h"
    },
    {
      "url": "https://status.stripe.com",
      "name": "Stripe Status Page",
      "monitoring_method": "json-diff",
      "recommended_interval": "5m"
    },
    {
      "url": "https://github.com/stripe/stripe-node/releases.atom",
      "name": "Stripe Node SDK Releases",
      "monitoring_method": "feed-poll",
      "recommended_interval": "1h"
    }
  ]
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `404` | `not_found` | `"Monitoring pack not found."` | Bad ID/slug |

---

### 12.3 `POST /v1/packs/:id/apply` — Apply Pack

Install all URLs from a pack.

#### Success: `200 OK`

```json
{
  "pack": {
    "id": "pack_k7l8m9n0",
    "name": "Stripe Payment Stack"
  },
  "urls_created": [
    { "id": "url_new1", "url": "https://api.stripe.com/v1/prices", "status": "learning" },
    { "id": "url_new2", "url": "https://status.stripe.com", "status": "learning" }
  ],
  "urls_skipped": [
    {
      "url": "https://github.com/stripe/stripe-node/releases.atom",
      "reason": "already_monitored",
      "existing_url_id": "url_existing1"
    }
  ],
  "summary": {
    "total_in_pack": 8,
    "created": 6,
    "skipped_duplicate": 1,
    "skipped_plan_limit": 1
  }
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `402` | `plan_limit_reached` | `"Cannot apply pack: would add 8 URLs but you only have 1 slot remaining."` | Would exceed |
| `404` | `not_found` | `"Monitoring pack not found."` | Bad ID |

---

## 13. Account Endpoints

### 13.1 `GET /v1/account` — Get Account

#### Success: `200 OK`

```json
{
  "id": "usr_a1b2c3d4",
  "email": "dev@example.com",
  "name": "Alex",
  "plan": "indie",
  "email_verified": true,
  "subscription_status": "active",
  "current_period_end": "2026-04-23T00:00:00Z",
  "timezone": "America/New_York",
  "notification_defaults": {
    "min_severity": "warning",
    "quiet_hours": { "start": "23:00", "end": "08:00" },
    "digest_mode": false
  },
  "limits": {
    "max_urls": 20,
    "min_interval": "15m",
    "history_days": 30,
    "max_webhooks": 3,
    "max_api_keys": 5,
    "rate_limit_rpm": 120,
    "rate_limit_rph": 5000,
    "features": {
      "api_access": true,
      "slack_integration": true,
      "webhook_integration": true,
      "schema_diff_detail": true,
      "team_seats": 1
    }
  },
  "created_at": "2026-03-23T12:00:00Z"
}
```

---

### 13.2 `GET /v1/account/usage` — Get Usage

#### Success: `200 OK`

```json
{
  "urls": {
    "active": 12,
    "learning": 1,
    "calibrating": 2,
    "paused": 3,
    "error": 0,
    "degraded": 1,
    "auth_required": 0,
    "total": 19,
    "limit": 20,
    "usage_percentage": 95
  },
  "checks": {
    "today": 288,
    "this_week": 1932,
    "this_month": 7840
  },
  "changes": {
    "this_week": 2,
    "this_month": 8,
    "unacknowledged": 3
  },
  "webhooks": {
    "used": 2,
    "limit": 3
  },
  "api_keys": {
    "active": 2,
    "limit": 5
  },
  "api_requests": {
    "this_hour": 47,
    "hour_limit": 5000,
    "this_minute": 3,
    "minute_limit": 120
  },
  "storage": {
    "snapshots_count": 4523,
    "snapshots_size_mb": 12.4
  }
}
```

---

### 13.3 `PATCH /v1/account` — Update Account

#### Request

```json
{
  "name": "New Name",
  "timezone": "America/New_York",
  "notification_defaults": {
    "min_severity": "breaking",
    "quiet_hours": { "start": "23:00", "end": "08:00" },
    "digest_mode": true
  }
}
```

#### Success: `200 OK`

Returns full account object.

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Invalid timezone. Use IANA timezone format (e.g., 'America/New_York')."` | Bad timezone |
| `400` | `invalid_input` | `"Name must not exceed 100 characters."` | Name too long |
| `401` | `unauthorized` | `"Authentication required."` | No auth |

---

### 13.4 `GET /v1/account/export` — GDPR Data Export

#### Success: `200 OK`

```json
{
  "user": {
    "id": "usr_a1b2c3d4",
    "email": "dev@example.com",
    "name": "Alex",
    "plan": "indie",
    "created_at": "2026-03-23T12:00:00Z"
  },
  "urls": [ /* all monitored URLs */ ],
  "changes": [ /* all changes for your URLs */ ],
  "webhooks": [ /* all webhook configs (secrets excluded) */ ],
  "integrations": [ /* all integrations (secrets excluded) */ ],
  "notifications": [ /* notification history */ ],
  "api_keys": [
    { "id": "key_...", "name": "...", "created_at": "...", "last_used_at": "..." }
  ],
  "exported_at": "2026-03-23T16:00:00Z",
  "format_version": "1.0"
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `429` | `rate_limited` | `"Data export can be requested once per hour."` | Spam prevention |

---

### 13.5 `DELETE /v1/account` — Delete Account

#### Request

```json
{
  "confirmation": "DELETE MY ACCOUNT",
  "password": "..."
}
```

#### Success: `200 OK`

```json
{
  "message": "Account scheduled for deletion. All data will be removed within 72 hours.",
  "deletion_scheduled_at": "2026-03-26T16:00:00Z",
  "undo_until": "2026-03-24T16:00:00Z",
  "undo_url": "/v1/account/cancel-deletion"
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Please type 'DELETE MY ACCOUNT' to confirm."` | Bad confirmation |
| `401` | `invalid_credentials` | `"Password is incorrect."` | Wrong password |
| `402` | `active_subscription` | `"Cancel your subscription before deleting your account."` | Active Stripe sub |

---

### 13.6 `POST /v1/account/cancel-deletion` — Cancel Account Deletion

#### Success: `200 OK`

```json
{
  "message": "Account deletion cancelled. Your account is active.",
  "cancelled_at": "2026-03-23T17:00:00Z"
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `no_pending_deletion` | `"No pending account deletion found."` | Nothing to cancel |
| `410` | `deletion_completed` | `"Account deletion has already been processed and cannot be reversed."` | Too late |

---

### 13.7 `POST /v1/account/change-password`

#### Request

```json
{
  "current_password": "...",
  "new_password": "..."
}
```

#### Success: `200 OK`

```json
{
  "message": "Password changed successfully. All existing sessions have been revoked."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"New password must be at least 8 characters."` | Weak password |
| `400` | `invalid_input` | `"New password must be different from current password."` | Same password |
| `401` | `invalid_credentials` | `"Current password is incorrect."` | Wrong current password |

---

### 13.8 `GET /v1/account/billing` — Get Billing Info

#### Success: `200 OK`

```json
{
  "plan": "indie",
  "price": {
    "monthly": 900,
    "currency": "usd",
    "formatted": "$9/month"
  },
  "subscription_status": "active",
  "current_period_start": "2026-03-23T00:00:00Z",
  "current_period_end": "2026-04-23T00:00:00Z",
  "cancel_at_period_end": false,
  "payment_method": {
    "type": "card",
    "brand": "visa",
    "last4": "4242",
    "exp_month": 12,
    "exp_year": 2027
  },
  "invoices_url": "https://billing.stripe.com/p/session/...",
  "portal_url": "https://billing.stripe.com/p/session/..."
}
```

#### Free Plan: `200 OK`

```json
{
  "plan": "free",
  "price": {
    "monthly": 0,
    "currency": "usd",
    "formatted": "Free"
  },
  "subscription_status": null,
  "upgrade_options": [
    {
      "plan": "indie",
      "price": "$9/month",
      "highlights": ["20 URLs", "15-min intervals", "API access", "Slack/Discord"]
    },
    {
      "plan": "pro",
      "price": "$29/month",
      "highlights": ["100 URLs", "5-min intervals", "90-day history", "Priority support"]
    }
  ]
}
```

---

### 13.9 `POST /v1/account/billing/checkout` — Create Checkout Session

#### Request

```json
{
  "plan": "indie",
  "billing_period": "monthly"
}
```

#### Success: `200 OK`

```json
{
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_...",
  "session_id": "cs_...",
  "expires_at": "2026-03-23T17:00:00Z"
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Invalid plan. Choose: indie, pro, or business."` | Bad plan |
| `409` | `already_subscribed` | `"You are already on the Indie plan."` | Same plan |

---

## 14. Provider Search & Discovery

### 14.1 `GET /v1/providers/search` — Search Providers

Search the built-in provider knowledge base.

#### Query Parameters

| Param | Type | Required |
|-------|------|----------|
| `q` | string | **yes** |
| `limit` | int | no (default 10) |

#### Success: `200 OK`

```json
{
  "query": "stripe",
  "results": [
    {
      "name": "Stripe",
      "slug": "stripe",
      "icon_url": "https://cdn.chirri.io/providers/stripe.svg",
      "description": "Payment processing API",
      "category": "payments",
      "sources": [
        {
          "type": "api",
          "url": "https://api.stripe.com/v1/prices",
          "name": "Prices API",
          "monitoring_method": "json-diff"
        },
        {
          "type": "openapi_spec",
          "url": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
          "name": "OpenAPI Spec"
        },
        {
          "type": "changelog",
          "url": "https://stripe.com/docs/upgrades",
          "name": "API Changelog"
        },
        {
          "type": "status_page",
          "url": "https://status.stripe.com",
          "name": "Status Page"
        },
        {
          "type": "sdk",
          "url": "https://github.com/stripe/stripe-node/releases.atom",
          "name": "Node SDK Releases"
        }
      ],
      "monitoring_pack_id": "pack_k7l8m9n0"
    }
  ],
  "total": 1
}
```

#### No Results: `200 OK`

```json
{
  "query": "acmecorp",
  "results": [],
  "total": 0,
  "suggestion": "No known provider found for 'acmecorp'. Enter a URL directly to start monitoring."
}
```

---

### 14.2 `GET /v1/providers` — List All Providers

#### Query Parameters

| Param | Type | Default |
|-------|------|---------|
| `category` | string | all |
| `cursor` | string | — |
| `limit` | int | 50 |

#### Success: `200 OK`

```json
{
  "data": [
    {
      "name": "Stripe",
      "slug": "stripe",
      "icon_url": "https://cdn.chirri.io/providers/stripe.svg",
      "category": "payments",
      "source_count": 5
    },
    {
      "name": "OpenAI",
      "slug": "openai",
      "icon_url": "https://cdn.chirri.io/providers/openai.svg",
      "category": "ai",
      "source_count": 4
    }
  ],
  "categories": ["payments", "ai", "devops", "communication", "auth", "database", "analytics"],
  "has_more": true,
  "next_cursor": "cur_..."
}
```

---

### 14.3 `GET /v1/providers/:slug` — Get Provider Detail

#### Success: `200 OK`

Full provider object (same as search result shape).

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `404` | `not_found` | `"Provider not found."` | Unknown slug |

---

## 15. Manual Check Trigger

### 15.1 `POST /v1/urls/:id/check` — Trigger Manual Check

Force an immediate check outside the scheduled interval.

#### Success: `200 OK`

```json
{
  "check_id": "chk_abc123",
  "url_id": "url_e5f6g7h8",
  "status": "queued",
  "queued_at": "2026-03-23T16:00:00Z",
  "estimated_completion": "2026-03-23T16:00:30Z",
  "message": "Check queued. Results will appear in ~30 seconds."
}
```

#### With Wait (synchronous response): `POST /v1/urls/:id/check?wait=true`

Waits up to 30 seconds for the check to complete.

```json
{
  "check_id": "chk_abc123",
  "url_id": "url_e5f6g7h8",
  "status": "completed",
  "result": {
    "status_code": 200,
    "response_time_ms": 234,
    "change_detected": false,
    "full_hash": "sha256:...",
    "stable_hash": "sha256:...",
    "schema_hash": "sha256:...",
    "body_size_bytes": 4523,
    "snapshot_id": "snap_abc123"
  },
  "completed_at": "2026-03-23T16:00:12Z",
  "message": "Check complete. No changes detected."
}
```

#### Check Detects Change: `200 OK`

```json
{
  "check_id": "chk_abc123",
  "url_id": "url_e5f6g7h8",
  "status": "completed",
  "result": {
    "status_code": 200,
    "response_time_ms": 234,
    "change_detected": true,
    "change": {
      "id": "chg_newchange",
      "change_type": "schema",
      "severity": "breaking",
      "summary": "Field `amount` removed from response object",
      "confirmation_status": "pending"
    }
  },
  "completed_at": "2026-03-23T16:00:12Z",
  "message": "⚠️ Change detected! Confirmation recheck in progress."
}
```

#### Check on Error-State URL: `200 OK`

```json
{
  "check_id": "chk_abc123",
  "url_id": "url_e5f6g7h8",
  "status": "completed",
  "result": {
    "status_code": null,
    "response_time_ms": null,
    "error": "Connection timeout after 30 seconds.",
    "error_category": "transient",
    "change_detected": false
  },
  "completed_at": "2026-03-23T16:00:32Z",
  "message": "Check failed: connection timeout. The URL may be temporarily unreachable."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"URL not found."` | Wrong ID |
| `409` | `check_in_progress` | `"A check is already in progress for this URL. Please wait."` | Duplicate |
| `422` | `url_paused` | `"Cannot trigger check on a paused URL. Resume monitoring first."` | URL is paused |
| `429` | `rate_limited` | `"Manual checks are limited to 10 per hour per URL."` | Spam prevention |

---

### 15.2 `GET /v1/urls/:id/checks` — Check History

#### Query Parameters

| Param | Type | Default |
|-------|------|---------|
| `since` | ISO date | 24h ago |
| `until` | ISO date | now |
| `change_only` | boolean | false |
| `cursor` | string | — |
| `limit` | int | 50 |

#### Success: `200 OK`

```json
{
  "data": [
    {
      "id": "chk_abc123",
      "status_code": 200,
      "response_time_ms": 234,
      "body_size_bytes": 4523,
      "error": null,
      "change_detected": false,
      "change_id": null,
      "full_hash": "sha256:abc...",
      "is_learning": false,
      "is_confirmation": false,
      "checked_at": "2026-03-23T16:00:00Z"
    },
    {
      "id": "chk_def456",
      "status_code": 200,
      "response_time_ms": 289,
      "body_size_bytes": 4510,
      "error": null,
      "change_detected": true,
      "change_id": "chg_i9j0k1l2",
      "full_hash": "sha256:def...",
      "is_learning": false,
      "is_confirmation": false,
      "checked_at": "2026-03-23T14:32:00Z"
    }
  ],
  "has_more": true,
  "next_cursor": "cur_..."
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `403` | `plan_required` | `"Check history requires Indie plan or higher."` | Free plan (limited to last 5 checks) |
| `404` | `not_found` | `"URL not found."` | Wrong ID |

---

## 16. Health & Status Endpoints

### 16.1 `GET /health` — Health Check

**No authentication required.** Used by Railway, UptimeRobot, and external monitoring.

#### Healthy: `200 OK`

```json
{
  "status": "healthy",
  "version": "1.0.3",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "queue": "ok",
    "r2": "ok"
  },
  "uptime_seconds": 86400,
  "timestamp": "2026-03-23T16:00:00Z"
}
```

#### Degraded: `200 OK` (still 200 for load balancers)

```json
{
  "status": "degraded",
  "version": "1.0.3",
  "checks": {
    "database": "ok",
    "redis": "slow",
    "queue": "ok",
    "r2": "ok"
  },
  "issues": ["Redis response time >100ms"],
  "uptime_seconds": 86400,
  "timestamp": "2026-03-23T16:00:00Z"
}
```

#### Unhealthy: `503 Service Unavailable`

```json
{
  "status": "unhealthy",
  "version": "1.0.3",
  "checks": {
    "database": "error",
    "redis": "ok",
    "queue": "ok",
    "r2": "ok"
  },
  "issues": ["Database connection failed: ECONNREFUSED"],
  "uptime_seconds": 86400,
  "timestamp": "2026-03-23T16:00:00Z"
}
```

---

### 16.2 `GET /v1/status` — API Status

Public endpoint showing service status.

#### Success: `200 OK`

```json
{
  "api": "operational",
  "monitoring": "operational",
  "notifications": "operational",
  "dashboard": "operational",
  "last_incident": null,
  "upcoming_maintenance": null,
  "status_page_url": "https://status.chirri.io"
}
```

#### During Incident: `200 OK`

```json
{
  "api": "operational",
  "monitoring": "degraded",
  "notifications": "operational",
  "dashboard": "operational",
  "last_incident": {
    "title": "Delayed check processing",
    "status": "investigating",
    "started_at": "2026-03-23T15:00:00Z",
    "updates": [
      {
        "message": "We are investigating delayed check processing for some URLs.",
        "posted_at": "2026-03-23T15:05:00Z"
      }
    ]
  }
}
```

---

### 16.3 `GET /internal/metrics` — Internal Metrics

**Auth:** `INTERNAL_API_TOKEN` header.

#### Success: `200 OK`

```json
{
  "checks": {
    "per_hour": 4520,
    "failed_pct": 0.3,
    "avg_duration_ms": 345,
    "p95_duration_ms": 890,
    "p99_duration_ms": 2100
  },
  "queues": {
    "url_checks": { "waiting": 45, "active": 18, "delayed": 12, "failed": 0 },
    "learning_checks": { "waiting": 3, "active": 2, "delayed": 8, "failed": 0 },
    "confirmation_checks": { "waiting": 1, "active": 0, "delayed": 2, "failed": 0 },
    "notifications": { "waiting": 0, "active": 1, "delayed": 0, "failed": 0 },
    "classification": { "waiting": 0, "active": 0, "delayed": 0, "failed": 0 },
    "maintenance": { "waiting": 0, "active": 0, "delayed": 0, "failed": 0 },
    "dead_letter": { "total": 3 }
  },
  "api": {
    "requests_per_minute": 42,
    "p50_ms": 12,
    "p95_ms": 87,
    "p99_ms": 234,
    "error_rate_pct": 0.1
  },
  "database": {
    "pool_size": 10,
    "pool_available": 7,
    "p50_ms": 5,
    "p95_ms": 23
  },
  "entities": {
    "active_urls": 1240,
    "active_users": 312,
    "total_changes_30d": 89,
    "total_checks_30d": 135600
  },
  "workers": {
    "count": 2,
    "ids": ["worker-1", "worker-2"]
  },
  "uptime_seconds": 86400,
  "timestamp": "2026-03-23T16:00:00Z"
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Internal API token required."` | Missing/wrong token |
| `403` | `forbidden` | `"Invalid internal API token."` | Wrong token |

---

### 16.4 `GET /v1/openapi.json` — OpenAPI Spec

No authentication required. Auto-generated from Zod schemas.

Returns the full OpenAPI 3.1 specification document.

---

## 17. Webhook Event Catalog

Every event that can be delivered to user webhooks and integrations.

### Event Payload Structure

All events follow this structure:

```json
{
  "id": "evt_g3h4i5j6",
  "type": "change.confirmed",
  "api_version": "2026-03-23",
  "created_at": "2026-03-23T14:32:00Z",
  "data": {
    /* event-specific payload */
  }
}
```

### Headers (for webhook deliveries)

```http
Content-Type: application/json
X-Chirri-Signature: t=1711209600,v1=sha256hmac...
X-Chirri-Event: change.confirmed
X-Chirri-Delivery: del_c9d0e1f2
User-Agent: Chirri-Webhook/1.0
```

### 17.1 `url.created`

Fired when a new URL is added to monitoring.

```json
{
  "id": "evt_...",
  "type": "url.created",
  "data": {
    "url": {
      "id": "url_e5f6g7h8",
      "url": "https://api.stripe.com/v1/prices",
      "name": "Stripe Prices API",
      "status": "learning",
      "check_interval": "1h",
      "content_type": "json-api",
      "created_at": "2026-03-23T12:00:00Z"
    }
  }
}
```

### 17.2 `url.classified`

Fired when auto-classification completes.

```json
{
  "type": "url.classified",
  "data": {
    "url_id": "url_e5f6g7h8",
    "content_type": "json-api",
    "monitoring_method": "json-diff",
    "confidence": 92,
    "classified_at": "2026-03-23T12:00:05Z"
  }
}
```

### 17.3 `url.learning_complete`

Fired when the 10-minute learning period finishes.

```json
{
  "type": "url.learning_complete",
  "data": {
    "url_id": "url_e5f6g7h8",
    "samples_collected": 30,
    "volatile_fields": ["request_id", "timestamp", "trace_id"],
    "baseline_established": true,
    "transitioned_to": "calibrating",
    "completed_at": "2026-03-23T12:10:00Z"
  }
}
```

### 17.4 `url.active`

Fired when URL transitions to fully active monitoring (after calibration).

```json
{
  "type": "url.active",
  "data": {
    "url_id": "url_e5f6g7h8",
    "calibration_days": 7,
    "volatile_fields_final": ["request_id", "timestamp", "trace_id"],
    "activated_at": "2026-03-30T12:10:00Z"
  }
}
```

### 17.5 `url.error`

Fired when a URL enters error state (24h+ failures).

```json
{
  "type": "url.error",
  "data": {
    "url_id": "url_e5f6g7h8",
    "url": "https://api.example.com/v1/data",
    "error": "DNS resolution failed: NXDOMAIN",
    "error_category": "permanent",
    "consecutive_failures": 24,
    "last_success_at": "2026-03-22T14:00:00Z",
    "errored_at": "2026-03-23T14:00:00Z"
  }
}
```

### 17.6 `url.degraded`

Fired when a URL enters degraded state (3+ consecutive failures).

```json
{
  "type": "url.degraded",
  "data": {
    "url_id": "url_e5f6g7h8",
    "url": "https://api.example.com/v1/data",
    "error": "HTTP 503 Service Unavailable",
    "consecutive_failures": 3,
    "last_success_at": "2026-03-23T13:00:00Z",
    "degraded_at": "2026-03-23T14:00:00Z"
  }
}
```

### 17.7 `url.recovered`

Fired when a degraded/errored URL successfully responds.

```json
{
  "type": "url.recovered",
  "data": {
    "url_id": "url_e5f6g7h8",
    "url": "https://api.example.com/v1/data",
    "previous_status": "degraded",
    "new_status": "active",
    "downtime_duration_minutes": 45,
    "recovered_at": "2026-03-23T14:45:00Z"
  }
}
```

### 17.8 `url.paused`

```json
{
  "type": "url.paused",
  "data": {
    "url_id": "url_e5f6g7h8",
    "paused_at": "2026-03-23T16:00:00Z"
  }
}
```

### 17.9 `url.resumed`

```json
{
  "type": "url.resumed",
  "data": {
    "url_id": "url_e5f6g7h8",
    "resumed_at": "2026-03-23T17:00:00Z"
  }
}
```

### 17.10 `url.auth_required`

```json
{
  "type": "url.auth_required",
  "data": {
    "url_id": "url_e5f6g7h8",
    "status_code": 401,
    "www_authenticate": "Bearer realm=\"api\"",
    "detected_at": "2026-03-23T12:00:02Z"
  }
}
```

### 17.11 `url.redirect_detected`

```json
{
  "type": "url.redirect_detected",
  "data": {
    "url_id": "url_e5f6g7h8",
    "redirect_status": 301,
    "redirect_location": "https://api.example.com/v2",
    "detected_at": "2026-03-23T12:00:02Z"
  }
}
```

### 17.12 `url.limited`

```json
{
  "type": "url.limited",
  "data": {
    "url_id": "url_e5f6g7h8",
    "reason": "cloudflare_challenge",
    "detected_at": "2026-03-23T12:00:02Z"
  }
}
```

### 17.13 `change.detected`

Fired immediately when a change is detected (before confirmation).

```json
{
  "type": "change.detected",
  "data": {
    "change": {
      "id": "chg_i9j0k1l2",
      "url_id": "url_e5f6g7h8",
      "url": "https://api.stripe.com/v1/prices",
      "url_name": "Stripe Prices API",
      "change_type": "schema",
      "severity": "breaking",
      "confidence": 95,
      "summary": "Field `amount` removed from response object",
      "confirmation_status": "pending",
      "detected_at": "2026-03-23T14:32:00Z"
    }
  }
}
```

### 17.14 `change.confirmed`

Fired after full confirmation cycle (the main alerting event).

```json
{
  "type": "change.confirmed",
  "data": {
    "change": {
      "id": "chg_i9j0k1l2",
      "url_id": "url_e5f6g7h8",
      "url": "https://api.stripe.com/v1/prices",
      "url_name": "Stripe Prices API",
      "change_type": "schema",
      "severity": "breaking",
      "confidence": 95,
      "summary": "Field `amount` removed from response object",
      "actions": [
        "Update your integration to handle missing `amount` field",
        "Check if `unit_amount` is the replacement field"
      ],
      "dashboard_url": "https://chirri.io/delta/changes/chg_i9j0k1l2",
      "feedback_url": "https://api.chirri.io/delta/v1/feedback/fb_token_...",
      "detected_at": "2026-03-23T14:32:00Z",
      "confirmed_at": "2026-03-23T15:02:05Z"
    }
  }
}
```

### 17.15 `change.reverted`

Fired when a detected change reverts during confirmation.

```json
{
  "type": "change.reverted",
  "data": {
    "change_id": "chg_i9j0k1l2",
    "url_id": "url_e5f6g7h8",
    "summary": "Previously detected change has reverted. No notification sent.",
    "reverted_at": "2026-03-23T14:32:05Z"
  }
}
```

### 17.16 `account.usage_alert`

Fired when approaching plan limits.

```json
{
  "type": "account.usage_alert",
  "data": {
    "alert_type": "url_limit_approaching",
    "current": 18,
    "limit": 20,
    "percentage": 90,
    "message": "You're using 18 of 20 monitored URLs on your Indie plan.",
    "upgrade_url": "https://chirri.io/delta/billing"
  }
}
```

### 17.17 `test`

Test event sent via webhook test endpoint.

```json
{
  "type": "test",
  "data": {
    "message": "This is a test webhook delivery from Chirri.",
    "webhook_id": "wh_q7r8s9t0",
    "timestamp": "2026-03-23T16:00:00Z"
  }
}
```

---

## 18. Complete Error Code Registry

Every error code used across the API, alphabetically.

| Code | Status | Message Template | Endpoint(s) |
|------|--------|-----------------|-------------|
| `account_locked` | 423 | Account locked due to too many failed attempts. Try again in {n} minutes. | auth/login |
| `active_subscription` | 402 | Cancel your subscription before deleting your account. | DELETE account |
| `already_acknowledged` | 409 | Change is already acknowledged. | POST changes/:id/acknowledge |
| `already_subscribed` | 409 | You are already on the {plan} plan. | billing/checkout |
| `already_verified` | 409 | Email is already verified. | auth/verify-email |
| `check_in_progress` | 409 | A check is already in progress for this URL. Please wait. | POST urls/:id/check |
| `classification_in_progress` | 409 | Classification is already running for this URL. | POST urls/:id/classify |
| `credential_in_url` | — | URL appears to contain credentials in query parameters. | POST urls (warning, not error) |
| `deletion_completed` | 410 | Account deletion has already been processed. | cancel-deletion |
| `dns_resolution_failed` | 400 | Could not resolve hostname '{hostname}'. | POST urls |
| `duplicate_email` | 409 | An account with this email already exists. | auth/signup |
| `duplicate_integration` | 409 | An integration with this configuration already exists. | POST integrations |
| `duplicate_url` | 409 | You are already monitoring this URL. | POST urls, PATCH urls |
| `duplicate_webhook` | 409 | A webhook with this URL already exists. | POST webhooks |
| `expired` | 410 | Snapshot has been archived. | GET snapshots/:id |
| `feedback_exists` | 409 | You have already submitted feedback for this change. | POST changes/:id/feedback |
| `forbidden` | 403 | You do not have permission to perform this action. | Various |
| `integration_verification_failed` | 400 | Could not send test message. Verify the configuration. | POST integrations |
| `internal_error` | 500 | An unexpected error occurred. Please try again. | All |
| `interval_not_available` | 402 | {interval} interval requires {plan} plan or higher. | POST/PATCH urls |
| `invalid_credentials` | 401 | Invalid email or password. | auth/login |
| `invalid_cursor` | 400 | Invalid pagination cursor. | List endpoints |
| `invalid_input` | 400 | (various field-specific messages) | All |
| `invalid_refresh_token` | 401 | Refresh token is invalid or expired. | auth/refresh |
| `invalid_status_transition` | 400 | Cannot transition from '{from}' to '{to}'. | PATCH urls |
| `invalid_token` | 400 | Verification/reset token is invalid. | auth/verify-email, auth/reset-password, feedback |
| `invalid_url` | 400 | Invalid URL format / Only HTTPS / etc. | POST urls, POST webhooks |
| `jwt_required` | 403 | This action requires dashboard authentication. | API key management |
| `no_pending_deletion` | 400 | No pending account deletion found. | cancel-deletion |
| `not_found` | 404 | {Resource} not found. | GET/PATCH/DELETE /:id |
| `plan_limit_reached` | 402 | {Plan} plan is limited to {n} {resource}. Upgrade to add more. | POST urls, POST webhooks, POST api-keys |
| `plan_required` | 403 | {Feature} requires {plan} plan or higher. | GET snapshots, check history |
| `rate_limited` | 429 | Rate limit exceeded. Retry after {n} seconds. | All |
| `self_referential` | 422 | Cannot monitor chirri.io URLs. | POST urls |
| `ssrf_blocked` | 400 | Private/internal URLs cannot be monitored for security reasons. | POST urls, POST webhooks |
| `token_expired` | 410 | Token has expired. Request a new one. | auth/verify-email, auth/reset-password, feedback |
| `unauthorized` | 401 | Authentication required. | All authenticated endpoints |
| `url_paused` | 422 | Cannot trigger check on a paused URL. Resume monitoring first. | POST urls/:id/check |

### Global Error Response Headers

Every error response includes:

```http
Content-Type: application/json; charset=utf-8
X-Request-Id: req_a1b2c3d4e5f6
```

429 responses additionally include:

```http
Retry-After: 12
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1711209660
```

### 500 Internal Server Error

Always the same shape — never leaks internal details:

```json
{
  "error": {
    "code": "internal_error",
    "message": "An unexpected error occurred. Please try again.",
    "status": 500,
    "request_id": "req_a1b2c3d4e5f6"
  }
}
```

The `request_id` allows support to correlate with server logs.

---

## Appendix A: One-Click Feedback Endpoint

### `POST /v1/feedback/:token`

Public endpoint — no authentication. Token-based access from email notifications.

#### Request

```json
{
  "verdict": "false_positive"
}
```

#### Success: `200 OK`

```json
{
  "message": "Thank you for your feedback.",
  "change_id": "chg_i9j0k1l2",
  "verdict": "false_positive"
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Verdict must be one of: real_change, false_positive, not_sure."` | Bad verdict |
| `400` | `invalid_token` | `"Feedback token is invalid."` | Bad token |
| `410` | `token_expired` | `"Feedback token has expired (5-day window)."` | Expired token |

---

## Appendix B: Webhook Signature Verification

```typescript
// Verify incoming webhook from Chirri
function verifyChirriWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const [tPart, v1Part] = signature.split(',');
  const timestamp = tPart.replace('t=', '');
  const expectedSig = v1Part.replace('v1=', '');

  // Reject if timestamp is >5 minutes old (replay protection)
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (age > 300) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const computed = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(expectedSig)
  );
}
```

---

## Appendix C: SDK Usage Example (Complete Flow)

```typescript
import { Chirri } from '@chirri/sdk';

const chirri = new Chirri('dk_live_...');

// 1. Add a URL
const url = await chirri.urls.create({
  url: 'https://api.stripe.com/v1/prices',
  name: 'Stripe Prices',
  interval: '1h',
  tags: ['payments']
});

console.log(url.status);     // "learning"
console.log(url.message);    // "✅ Stripe API detected..."

// 2. Check status
const detail = await chirri.urls.get(url.id);
console.log(detail.learning.progress);  // 0.53

// 3. List changes
const changes = await chirri.changes.list({
  severity: 'breaking',
  acknowledged: false
});

// 4. Get change detail
if (changes.data.length > 0) {
  const change = await chirri.changes.get(changes.data[0].id);
  console.log(change.diff.human_readable);
  console.log(change.actions);

  // 5. Acknowledge
  await chirri.changes.acknowledge(change.id, {
    note: 'Reviewed, updating integration'
  });
}

// 6. Set up webhook
const webhook = await chirri.webhooks.create({
  url: 'https://my-app.com/webhook',
  events: ['change.confirmed', 'url.error']
});

console.log(webhook.signing_secret);  // Save this!

// 7. Search providers
const results = await chirri.providers.search('openai');
console.log(results[0].sources);

// 8. Apply a monitoring pack
await chirri.packs.apply('stripe-payment-stack');
```

---

*This document specifies the complete API response contract for Chirri. Every endpoint, every status code, every error, every edge case. Build from this and the user's first experience will be flawless.*