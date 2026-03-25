# CHIRRI — Per-Source Alert Preferences & Toggling

**Date:** March 24, 2026  
**Status:** Design Complete  
**Depends on:** `CHIRRI_SOURCE_TRACKING_MODEL.md`, `CHIRRI_URL_ONBOARDING_FLOW.md`

---

## Problem Statement

A user monitors "Stripe" → Chirri watches 4 bundled sources (OpenAPI spec, changelog, status page, SDK releases). But the user only cares about breaking API changes — not every changelog entry or SDK bump. Today, it's all-or-nothing: every source fires alerts at the same severity threshold through the same channels.

Users need:
1. Visibility into all sources monitored for a provider
2. Per-source alert toggling (mute without stopping monitoring)
3. Per-source severity thresholds ("only breaking for changelog, everything for API endpoint")
4. Per-source notification channel routing ("API changes → Slack, changelog → email digest")
5. Full API control over all of the above

---

## 1. Data Model

### 1.1 Source Alert Preferences Table

New table: `source_alert_preferences`

```sql
CREATE TABLE source_alert_preferences (
  id            TEXT PRIMARY KEY DEFAULT ('sap_' || nanoid()),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id     TEXT NOT NULL,  -- References shared_sources(id) *(Aligned 2026-03-24 -- matches Bible v2.2; monitored_sources table does not exist in Bible schema)*

  -- Alert control
  alert_enabled   BOOLEAN NOT NULL DEFAULT true,    -- false = still monitored, just silent
  min_severity    TEXT NOT NULL DEFAULT 'low',       -- 'low' | 'medium' | 'high' | 'critical' *(Aligned 2026-03-24 -- matches Bible v2.2)*
  
  -- Channel routing (null = use account defaults)
  email_enabled     BOOLEAN DEFAULT null,            -- null = inherit from account
  webhook_ids       TEXT[] DEFAULT null,              -- null = inherit; [] = none; ['wh_...'] = specific
  integration_ids   TEXT[] DEFAULT null,              -- null = inherit; [] = none; ['int_...'] = specific
  
  -- Digest control
  digest_mode       BOOLEAN DEFAULT null,            -- null = inherit; true = batch; false = immediate
  digest_schedule   TEXT DEFAULT null,               -- 'daily' | 'weekly' | null (immediate)
  
  -- Quiet hours (null = inherit from account)
  quiet_hours_start TEXT DEFAULT null,               -- '23:00' format
  quiet_hours_end   TEXT DEFAULT null,               -- '08:00' format

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, source_id)
);

CREATE INDEX idx_sap_user_id ON source_alert_preferences(user_id);
CREATE INDEX idx_sap_source_id ON source_alert_preferences(source_id);
```

### 1.2 Severity Enum *(Aligned 2026-03-24 -- matches Bible v2.2)*

Ordered from lowest to highest (matches Bible §2.12):

| Level | Value | Meaning | Example |
|-------|-------|---------|---------|
| `low` | 0 | Informational, unlikely to require action | SDK minor version bump, docs typo fix |
| `medium` | 1 | Notable change requiring evaluation but not urgent | New optional field added, rate limit header changed, deprecation header added |
| `high` | 2 | Significant change requiring code modifications | Field removed, type changed, endpoint removed |
| `critical` | 3 | Breaking change already happened or imminent | Status page incident, 5xx errors, endpoint gone |

A source with `min_severity: 'high'` will only alert on `high` and `critical` changes.

### 1.3 Inheritance Model

Alert preferences cascade: **Account defaults → Source preferences → Override**

```
Account defaults (from notification_config on account):
  email: true
  min_severity: 'warning'
  quiet_hours: 23:00-08:00
  digest_mode: false

Source preference (from source_alert_preferences):
  email_enabled: null        → inherits true from account
  min_severity: 'breaking'   → OVERRIDES to 'breaking'
  quiet_hours_start: null    → inherits 23:00 from account
  digest_mode: true          → OVERRIDES to digest mode
```

**Resolution rule:** For each field, if the source preference value is `null`, use the account default. If it's an explicit value (including `false`, `[]`, etc.), use the source preference.

### 1.4 Updated Source Object

Extend the existing `MonitoredSource` (from `CHIRRI_SOURCE_TRACKING_MODEL.md`):

```typescript
interface MonitoredSource {
  // ... existing fields from source tracking model ...
  id: string;
  providerMonitorId: string;
  type: SourceType;
  url: string;
  checkInterval: number;
  intervalType: 'plan' | 'fixed';
  status: 'learning' | 'active' | 'paused' | 'error';
  lastCheckedAt: Date | null;
  lastChangeAt: Date | null;
  countsAsUrlSlot: boolean;
  config: SourceConfig;

  // NEW: Alert preferences (resolved — inheritance already applied)
  alertPreferences: ResolvedAlertPreferences;
}

interface ResolvedAlertPreferences {
  alertEnabled: boolean;
  minSeverity: Severity;
  email: boolean;
  webhookIds: string[];
  integrationIds: string[];
  digestMode: boolean;
  digestSchedule: 'daily' | 'weekly' | null;
  quietHours: { start: string; end: string } | null;
  inherited: {
    // Which fields are inherited vs explicitly set
    alertEnabled: boolean;    // true = inherited from account
    minSeverity: boolean;
    email: boolean;
    webhookIds: boolean;
    integrationIds: boolean;
    digestMode: boolean;
    quietHours: boolean;
  };
}

type Severity = 'low' | 'medium' | 'high' | 'critical';  // *(Aligned 2026-03-24 -- matches Bible v2.2)*
```

---

## 2. API Endpoints

### 2.1 `GET /v1/urls/:id/sources` — List Sources for a URL/Provider

Returns all sources associated with a monitored URL or provider monitor, including their alert preferences.

**Auth:** API key or JWT

#### Success: `200 OK`

```json
{
  "url_id": "url_e5f6g7h8",
  "provider": {
    "name": "Stripe",
    "slug": "stripe",
    "icon_url": "https://cdn.chirri.io/providers/stripe.svg"
  },
  "sources": [
    {
      "id": "src_aaa111",
      "type": "openapi_spec",
      "name": "OpenAPI Spec",
      "url": "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json",
      "check_interval": 300,
      "interval_type": "plan",
      "status": "active",
      "counts_as_url_slot": true,
      "is_bundled": false,
      "last_checked_at": "2026-03-23T15:00:00Z",
      "last_change_at": "2026-03-20T09:15:00Z",
      "last_change_severity": "notable",
      "changes_30d": 3,
      "alert_preferences": {
        "alert_enabled": true,
        "min_severity": "warning",
        "email": true,
        "webhook_ids": ["wh_q7r8s9t0"],
        "integration_ids": ["int_u1v2w3x4"],
        "digest_mode": false,
        "digest_schedule": null,
        "quiet_hours": { "start": "23:00", "end": "08:00" },
        "inherited": {
          "alert_enabled": true,
          "min_severity": true,
          "email": true,
          "webhook_ids": true,
          "integration_ids": true,
          "digest_mode": true,
          "quiet_hours": true
        }
      }
    },
    {
      "id": "src_bbb222",
      "type": "changelog_html",
      "name": "API Changelog",
      "url": "https://stripe.com/docs/upgrades",
      "check_interval": 7200,
      "interval_type": "fixed",
      "status": "active",
      "counts_as_url_slot": false,
      "is_bundled": true,
      "last_checked_at": "2026-03-23T14:00:00Z",
      "last_change_at": "2026-03-22T11:30:00Z",
      "last_change_severity": "info",
      "changes_30d": 8,
      "alert_preferences": {
        "alert_enabled": true,
        "min_severity": "breaking",
        "email": true,
        "webhook_ids": [],
        "integration_ids": [],
        "digest_mode": true,
        "digest_schedule": "weekly",
        "quiet_hours": { "start": "23:00", "end": "08:00" },
        "inherited": {
          "alert_enabled": true,
          "min_severity": false,
          "email": true,
          "webhook_ids": false,
          "integration_ids": false,
          "digest_mode": false,
          "quiet_hours": true
        }
      }
    },
    {
      "id": "src_ccc333",
      "type": "status_page_json",
      "name": "Status Page",
      "url": "https://status.stripe.com/api/v2/summary.json",
      "check_interval": 600,
      "interval_type": "fixed",
      "status": "active",
      "counts_as_url_slot": false,
      "is_bundled": true,
      "last_checked_at": "2026-03-23T15:50:00Z",
      "last_change_at": null,
      "last_change_severity": null,
      "changes_30d": 0,
      "alert_preferences": {
        "alert_enabled": true,
        "min_severity": "info",
        "email": true,
        "webhook_ids": ["wh_q7r8s9t0"],
        "integration_ids": ["int_u1v2w3x4"],
        "digest_mode": false,
        "digest_schedule": null,
        "quiet_hours": null,
        "inherited": {
          "alert_enabled": true,
          "min_severity": true,
          "email": true,
          "webhook_ids": true,
          "integration_ids": true,
          "digest_mode": true,
          "quiet_hours": false
        }
      }
    },
    {
      "id": "src_ddd444",
      "type": "github_releases",
      "name": "stripe-node SDK",
      "url": "https://github.com/stripe/stripe-node/releases.atom",
      "check_interval": 21600,
      "interval_type": "fixed",
      "status": "active",
      "counts_as_url_slot": false,
      "is_bundled": true,
      "last_checked_at": "2026-03-23T12:00:00Z",
      "last_change_at": "2026-03-21T16:00:00Z",
      "last_change_severity": "info",
      "changes_30d": 4,
      "alert_preferences": {
        "alert_enabled": false,
        "min_severity": "info",
        "email": true,
        "webhook_ids": ["wh_q7r8s9t0"],
        "integration_ids": ["int_u1v2w3x4"],
        "digest_mode": false,
        "digest_schedule": null,
        "quiet_hours": { "start": "23:00", "end": "08:00" },
        "inherited": {
          "alert_enabled": false,
          "min_severity": true,
          "email": true,
          "webhook_ids": true,
          "integration_ids": true,
          "digest_mode": true,
          "quiet_hours": true
        }
      }
    }
  ],
  "summary": {
    "total_sources": 4,
    "alerting": 3,
    "muted": 1,
    "bundled": 3,
    "url_slots_used": 1
  }
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"URL not found."` | Wrong ID or not owned by user |

---

### 2.2 `PATCH /v1/urls/:id/sources/:source_id` — Update Source Preferences

Update alert preferences for a specific source. Partial update — only included fields change.

**Auth:** API key or JWT

#### Request

```json
{
  "alert_enabled": true,
  "min_severity": "breaking",
  "email_enabled": false,
  "webhook_ids": [],
  "integration_ids": ["int_slack123"],
  "digest_mode": true,
  "digest_schedule": "weekly",
  "quiet_hours": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `alert_enabled` | boolean | Toggle alerts on/off for this source |
| `min_severity` | string | Minimum severity to alert on: `info`, `warning`, `notable`, `breaking`, `critical` |
| `email_enabled` | boolean \| null | Override email alerts. `null` = inherit from account |
| `webhook_ids` | string[] \| null | Override webhook routing. `null` = inherit; `[]` = disable webhooks for this source |
| `integration_ids` | string[] \| null | Override integration routing. `null` = inherit; `[]` = disable integrations for this source |
| `digest_mode` | boolean \| null | Override digest mode. `null` = inherit |
| `digest_schedule` | string \| null | `'daily'`, `'weekly'`, or `null` |
| `quiet_hours` | object \| null | `{ "start": "23:00", "end": "08:00" }` or `null` to inherit/disable |

#### Success: `200 OK`

```json
{
  "source_id": "src_bbb222",
  "url_id": "url_e5f6g7h8",
  "type": "changelog_html",
  "name": "API Changelog",
  "alert_preferences": {
    "alert_enabled": true,
    "min_severity": "breaking",
    "email": false,
    "webhook_ids": [],
    "integration_ids": ["int_slack123"],
    "digest_mode": true,
    "digest_schedule": "weekly",
    "quiet_hours": { "start": "23:00", "end": "08:00" },
    "inherited": {
      "alert_enabled": true,
      "min_severity": false,
      "email": false,
      "webhook_ids": false,
      "integration_ids": false,
      "digest_mode": false,
      "quiet_hours": true
    }
  },
  "updated_at": "2026-03-23T16:00:00Z"
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"min_severity must be one of: low, medium, high, critical."` | Bad severity | *(Aligned 2026-03-24 -- matches Bible v2.2)*
| `400` | `invalid_input` | `"digest_schedule must be 'daily' or 'weekly' when digest_mode is true."` | Missing schedule |
| `400` | `invalid_input` | `"Webhook 'wh_xxx' not found."` | Bad webhook ID |
| `400` | `invalid_input` | `"Integration 'int_xxx' not found."` | Bad integration ID |
| `400` | `invalid_input` | `"quiet_hours.start must be in HH:MM format."` | Bad time format |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"URL not found."` | Wrong URL ID |
| `404` | `source_not_found` | `"Source not found for this URL."` | Wrong source ID |

---

### 2.3 `PATCH /v1/urls/:id/sources` — Bulk Update Source Preferences

Update multiple source preferences in one call. Useful for "mute all bundled sources" or "only alert on breaking across the board."

**Auth:** API key or JWT

#### Request

```json
{
  "updates": [
    {
      "source_id": "src_bbb222",
      "alert_enabled": false
    },
    {
      "source_id": "src_ddd444",
      "alert_enabled": false
    }
  ]
}
```

Or use `filter` for batch operations:

```json
{
  "filter": {
    "is_bundled": true
  },
  "preferences": {
    "min_severity": "breaking"
  }
}
```

#### Success: `200 OK`

```json
{
  "updated": [
    { "source_id": "src_bbb222", "alert_enabled": false },
    { "source_id": "src_ccc333", "min_severity": "breaking" },
    { "source_id": "src_ddd444", "alert_enabled": false }
  ],
  "summary": {
    "total_updated": 3,
    "total_sources": 4
  }
}
```

#### Errors

| Status | Code | Message | When |
|--------|------|---------|------|
| `400` | `invalid_input` | `"Provide either 'updates' array or 'filter' + 'preferences', not both."` | Ambiguous |
| `400` | `invalid_input` | `"Maximum 50 source updates per request."` | Too many |
| `401` | `unauthorized` | `"Authentication required."` | No auth |
| `404` | `not_found` | `"URL not found."` | Wrong URL ID |

---

### 2.4 `POST /v1/urls/:id/sources/:source_id/reset` — Reset to Defaults

Remove all custom preferences for a source, reverting to account defaults.

**Auth:** API key or JWT

#### Success: `200 OK`

```json
{
  "source_id": "src_bbb222",
  "message": "Alert preferences reset to account defaults.",
  "alert_preferences": {
    "alert_enabled": true,
    "min_severity": "warning",
    "email": true,
    "webhook_ids": ["wh_q7r8s9t0"],
    "integration_ids": ["int_u1v2w3x4"],
    "digest_mode": false,
    "digest_schedule": null,
    "quiet_hours": { "start": "23:00", "end": "08:00" },
    "inherited": {
      "alert_enabled": true,
      "min_severity": true,
      "email": true,
      "webhook_ids": true,
      "integration_ids": true,
      "digest_mode": true,
      "quiet_hours": true
    }
  }
}
```

---

### 2.5 Updates to Existing Endpoints

#### `GET /v1/urls/:id` — Include Sources Summary

Add a `sources_summary` field to the existing URL detail response:

```json
{
  "id": "url_e5f6g7h8",
  "url": "https://api.stripe.com/v1/prices",
  // ... all existing fields ...
  "sources_summary": {
    "total": 4,
    "alerting": 3,
    "muted": 1,
    "types": ["openapi_spec", "changelog_html", "status_page_json", "github_releases"],
    "last_change_at": "2026-03-22T11:30:00Z",
    "detail_url": "/v1/urls/url_e5f6g7h8/sources"
  }
}
```

Sources are NOT embedded in the URL detail response by default (keep it lightweight). Users fetch `/sources` sub-resource when they need details.

**Optional query parameter:** `GET /v1/urls/:id?include=sources` — embeds full source list in the response for clients that want everything in one call.

#### `GET /v1/changes` — Include Source Info

Add source context to change objects:

```json
{
  "id": "chg_i9j0k1l2",
  "url": { "id": "url_e5f6g7h8", "url": "..." },
  "source": {
    "id": "src_bbb222",
    "type": "changelog_html",
    "name": "API Changelog"
  },
  "change_type": "content",
  "severity": "info",
  "alerted": false,
  "alert_suppressed_reason": "min_severity",
  // ... rest of change fields ...
}
```

New fields on changes:
- `source` — which source detected this change
- `alerted` — whether this change triggered a user notification
- `alert_suppressed_reason` — why it was suppressed (`null`, `"muted"`, `"min_severity"`, `"quiet_hours"`, `"digest_pending"`)

---

## 3. Default Alert Preferences by Source Type

When a provider is added, sources are created with **smart defaults** that minimize noise while keeping critical alerts active.

### 3.1 Default Preferences Matrix *(Aligned 2026-03-24 -- matches Bible v2.2)*

| Source Type | `alert_enabled` | `min_severity` | `digest_mode` | Rationale |
|------------|:---------------:|:--------------:|:-------------:|-----------|
| **OpenAPI Spec** (primary) | ✅ `true` | `medium` | `false` (immediate) | This is the money — every API change matters |
| **Changelog/RSS** | ✅ `true` | `medium` | `true` (daily) | Informational noise otherwise. Medium+ catches deprecations, breaking changes |
| **Status Page** | ✅ `true` | `low` | `false` (immediate) | Outages are urgent — don't filter |
| **SDK Releases** (bundled) | ✅ `true` | `high` | `true` (weekly) | SDK bumps are low-urgency unless breaking |
| **Custom URL** (user-added) | ✅ `true` | `medium` | `false` (immediate) | User explicitly added this — respect their intent |
| **Documentation** | ✅ `true` | `medium` | `true` (daily) | Docs rarely matter urgently |
| **npm/PyPI** (extended) | ✅ `true` | `high` | `true` (weekly) | Same rationale as SDK releases |

### 3.2 Implementation

Defaults are applied at creation time and stored in `source_alert_preferences`. They are NOT hardcoded in the resolution logic — this way users who change account defaults after provider creation don't get unexpected behavior.

```typescript
// *(Aligned 2026-03-24 -- matches Bible v2.2)*
const SOURCE_TYPE_DEFAULTS: Record<SourceType, Partial<AlertPreferences>> = {
  openapi_spec:      { min_severity: 'medium',   digest_mode: false },
  changelog_html:    { min_severity: 'medium',   digest_mode: true, digest_schedule: 'daily' },
  changelog_rss:     { min_severity: 'medium',   digest_mode: true, digest_schedule: 'daily' },
  status_page_json:  { min_severity: 'low',      digest_mode: false },
  github_releases:   { min_severity: 'high',     digest_mode: true, digest_schedule: 'weekly' },
  npm_package:       { min_severity: 'high',     digest_mode: true, digest_schedule: 'weekly' },
  pypi_package:      { min_severity: 'high',     digest_mode: true, digest_schedule: 'weekly' },
  documentation:     { min_severity: 'medium',   digest_mode: true, digest_schedule: 'daily' },
  custom_url:        { /* all null — inherit from account */ },
};
```

### 3.3 Smart Defaults Display (Onboarding)

When a provider is created, the API response includes the defaults so the user can review them:

```json
{
  "id": "url_e5f6g7h8",
  "status": "learning",
  "provider": { "name": "Stripe", "slug": "stripe" },
  "sources_created": [
    {
      "id": "src_aaa111",
      "type": "openapi_spec",
      "name": "OpenAPI Spec",
      "alert_defaults_applied": {
        "min_severity": "warning",
        "digest_mode": false,
        "note": "All API changes at warning+ severity, delivered immediately"
      }
    },
    {
      "id": "src_bbb222",
      "type": "changelog_html",
      "name": "API Changelog",
      "alert_defaults_applied": {
        "min_severity": "notable",
        "digest_mode": true,
        "digest_schedule": "daily",
        "note": "Notable+ changes in a daily digest"
      }
    },
    {
      "id": "src_ddd444",
      "type": "github_releases",
      "name": "stripe-node SDK",
      "alert_defaults_applied": {
        "min_severity": "breaking",
        "digest_mode": true,
        "digest_schedule": "weekly",
        "note": "Only breaking releases in a weekly digest"
      }
    }
  ],
  "message": "✅ Stripe added with smart alert defaults. Customize per-source alerts anytime."
}
```

---

## 4. Notification Pipeline Integration

### 4.1 Current Flow (Before This Feature)

```
Change Detected → Confirmation → Severity Classification → 
  → Check account min_severity → Check quiet hours → 
  → Send to all configured channels
```

### 4.2 Updated Flow (With Source Preferences)

```
Change Detected → Confirmation → Severity Classification →
  → Resolve source alert preferences (with inheritance) →
  → Is alert_enabled? 
    → NO: Record change with alerted=false, reason='muted'. Done.
    → YES: Continue.
  → Is severity >= min_severity?
    → NO: Record change with alerted=false, reason='min_severity'. Done.
    → YES: Continue.
  → Is digest_mode?
    → YES: Queue for digest. Record alerted=true, delivery='digest_pending'.
    → NO: Continue to immediate delivery.
  → Is in quiet_hours?
    → YES: Queue for delivery after quiet hours end. Record delivery='quiet_hours_delayed'.
    → NO: Continue.
  → Route to source-specific channels:
    → Email (if email_enabled)
    → Webhooks (source webhook_ids, with alerted field)
    → Integrations (source integration_ids)
  → Record alerted=true, delivery='sent'.
```

### 4.3 Webhook Event Updates

**`change.detected` fires for ALL changes, regardless of alert preferences.** This is critical — webhook consumers may have their own filtering logic.

Updated `change.detected` payload:

```json
{
  "type": "change.detected",
  "data": {
    "change": {
      "id": "chg_i9j0k1l2",
      "url_id": "url_e5f6g7h8",
      "source": {
        "id": "src_bbb222",
        "type": "changelog_html",
        "name": "API Changelog"
      },
      "change_type": "content",
      "severity": "info",
      "summary": "New changelog entry: 'Minor SDK improvements'",
      "alerted": false,
      "alert_suppressed_reason": "min_severity",
      "user_min_severity": "notable",
      "detected_at": "2026-03-23T14:32:00Z"
    }
  }
}
```

**New fields:**
- `alerted` (boolean) — whether this change triggered a notification to the user
- `alert_suppressed_reason` (string|null) — `null` if alerted, otherwise `"muted"`, `"min_severity"`, `"quiet_hours"`, `"digest_pending"`

### 4.4 New Webhook Events

#### `source.preferences_updated`

Fired when alert preferences change for a source.

```json
{
  "type": "source.preferences_updated",
  "data": {
    "url_id": "url_e5f6g7h8",
    "source_id": "src_bbb222",
    "source_type": "changelog_html",
    "source_name": "API Changelog",
    "changes": {
      "alert_enabled": { "old": true, "new": false },
      "min_severity": { "old": "warning", "new": "breaking" }
    },
    "updated_at": "2026-03-23T16:00:00Z"
  }
}
```

#### `source.muted` / `source.unmuted`

Convenience events (subset of `source.preferences_updated`):

```json
{
  "type": "source.muted",
  "data": {
    "url_id": "url_e5f6g7h8",
    "source_id": "src_ddd444",
    "source_type": "github_releases",
    "source_name": "stripe-node SDK",
    "muted_at": "2026-03-23T16:00:00Z"
  }
}
```

### 4.5 Digest Delivery

Sources in `digest_mode` collect changes into batched notifications:

**Daily digest** — delivered at 09:00 in user's timezone:
```
📬 Chirri Daily Digest — March 23, 2026

Stripe — API Changelog (2 changes)
  • [notable] Deprecation: /v1/charges endpoint sunset announced for June 2026
  • [info] New feature: Payment Links now support quantity limits

OpenAI — API Changelog (1 change)
  • [notable] New model 'gpt-5-mini' added to models endpoint

──────────
3 changes across 2 providers. Manage digest settings → https://chirri.io/delta/settings
```

**Weekly digest** — delivered Monday 09:00 in user's timezone:
```
📬 Chirri Weekly Digest — Week of March 17-23, 2026

Stripe
  SDK Releases (1):
    • stripe-node v15.3.0 — minor bug fixes
  
OpenAI
  SDK Releases (2):
    • openai-python v1.53.0 — new streaming API
    • openai-node v4.29.0 — TypeScript improvements

──────────
3 SDK releases across 2 providers. Manage digest settings → https://chirri.io/delta/settings
```

---

## 5. Dashboard UX

### 5.1 Provider Detail Page

The provider detail page shows all sources with toggle controls:

```
┌───────────────────────────────────────────────────────────────────┐
│ 🟣 Stripe                                        [Manage ▾]      │
│ Monitored since March 15, 2026 · 1 URL slot                      │
│                                                                    │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ 📋 OpenAPI Spec (Primary)                                    │   │
│ │ https://raw.githubusercontent.com/stripe/openapi/...         │   │
│ │                                                               │   │
│ │ Status: ✅ Active    Last check: 5m ago    Changes (30d): 3  │   │
│ │ Last change: "2 new endpoints added" (Mar 20) — notable      │   │
│ │                                                               │   │
│ │ 🔔 Alerts: ON    Severity: ≥ Warning    Delivery: Immediate  │   │
│ │ Channels: 📧 Email  🔗 Webhook  💬 Slack                     │   │
│ │                                              [Configure ▸]    │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ 📝 API Changelog (Bundled)                                   │   │
│ │ https://stripe.com/docs/upgrades                              │   │
│ │                                                               │   │
│ │ Status: ✅ Active    Last check: 1h ago    Changes (30d): 8  │   │
│ │ Last change: "Minor SDK improvements" (Mar 22) — info        │   │
│ │                                                               │   │
│ │ 🔔 Alerts: ON    Severity: ≥ Notable     Delivery: 📋 Daily  │   │
│ │ Channels: 📧 Email only                                      │   │
│ │                                              [Configure ▸]    │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ 🚦 Status Page (Bundled)                                     │   │
│ │ https://status.stripe.com/api/v2/summary.json                 │   │
│ │                                                               │   │
│ │ Status: ✅ All operational    Last check: 3m ago              │   │
│ │ No incidents in last 30 days                                  │   │
│ │                                                               │   │
│ │ 🔔 Alerts: ON    Severity: ≥ Info        Delivery: Immediate  │   │
│ │ Channels: 📧 Email  🔗 Webhook  💬 Slack  (no quiet hours)   │   │
│ │                                              [Configure ▸]    │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ ┌─────────────────────────────────────────────────────────────┐   │
│ │ 📦 stripe-node SDK (Bundled)                         🔇 MUTED│   │
│ │ https://github.com/stripe/stripe-node/releases.atom           │   │
│ │                                                               │   │
│ │ Status: ✅ Active    Last check: 4h ago    Changes (30d): 4  │   │
│ │ Last change: "v15.2.0 released" (Mar 21) — info              │   │
│ │                                                               │   │
│ │ 🔇 Alerts: OFF   (still monitoring, alerts silenced)         │   │
│ │                                    [Unmute]  [Configure ▸]    │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                    │
│ ─── Quick Actions ─────────────────────────────────────────────   │
│ [Mute all bundled]  [Only breaking changes]  [Reset all defaults] │
└───────────────────────────────────────────────────────────────────┘
```

### 5.2 Source Configuration Panel (Slide-out)

Clicking "Configure ▸" opens a slide-out panel:

```
┌──────────────────────────────────────────────┐
│ Configure: API Changelog                   ✕  │
│ Source type: changelog_html                    │
│                                                │
│ ── Alert Toggle ──────────────────────────     │
│ Alerts enabled        [●━━━━━━━━━━━━━━━━]  ON │
│                                                │
│ ── Minimum Severity ──────────────────────     │
│                                                │
│   ○ Info (everything)                          │
│   ○ Warning (potentially impactful+)           │
│   ● Notable (needs attention+)    ← current    │
│   ○ Breaking (will break things+)              │
│   ○ Critical (outages only)                    │
│                                                │
│ ── Delivery ──────────────────────────────     │
│   ● Immediate    ○ Daily Digest    ○ Weekly    │
│                                                │
│ ── Channels ──────────────────────────────     │
│ (Unset = uses your account defaults)           │
│                                                │
│   ☑ Email                                      │
│   ☐ Webhook: Production Webhook                │
│   ☐ Slack: Engineering Channel                 │
│   [Use account defaults]                       │
│                                                │
│ ── Quiet Hours ───────────────────────────     │
│   ● Use account quiet hours (23:00-08:00)      │
│   ○ Custom for this source                     │
│   ○ No quiet hours (always deliver)            │
│                                                │
│ ──────────────────────────────────────────     │
│ [Reset to defaults]              [Save]        │
└──────────────────────────────────────────────┘
```

### 5.3 Quick Actions

The provider detail page has quick-action buttons for common operations:

| Action | API Call | Effect |
|--------|----------|--------|
| **Mute all bundled** | `PATCH /v1/urls/:id/sources` with `filter: {is_bundled: true}, preferences: {alert_enabled: false}` | Silences changelog, status page, SDK — keeps primary alerts |
| **Only breaking changes** | `PATCH /v1/urls/:id/sources` with `preferences: {min_severity: 'breaking'}` | All sources only alert on breaking+ |
| **Reset all defaults** | `POST /v1/urls/:id/sources/reset` (all) | Reverts everything to smart defaults |
| **Mute changelog** | `PATCH /v1/urls/:id/sources/src_bbb222` with `{alert_enabled: false}` | One-click silence |

### 5.4 Global Source Alert Overview

New section in account settings: **Alert Routing Overview**

```
┌──────────────────────────────────────────────────────────────┐
│ Alert Routing Overview                                        │
│                                                                │
│ Provider          Source            Severity   Delivery  Chan  │
│ ─────────────────────────────────────────────────────────────  │
│ Stripe            OpenAPI Spec      ≥ Warning  Immed.   All   │
│                   Changelog         ≥ Notable  Daily    📧     │
│                   Status Page       ≥ Info     Immed.   All   │
│                   SDK Releases      🔇 MUTED   —        —     │
│ ─────────────────────────────────────────────────────────────  │
│ OpenAI            OpenAPI Spec      ≥ Warning  Immed.   All   │
│                   Changelog         ≥ Warning  Immed.   All   │
│                   Status Page       ≥ Info     Immed.   All   │
│                   SDK Releases      ≥ Breaking Weekly   📧     │
│ ─────────────────────────────────────────────────────────────  │
│ Custom: my-api    (single source)   ≥ Warning  Immed.   All   │
└──────────────────────────────────────────────────────────────┘
```

### 5.5 Adaptive Suggestions

When the system detects patterns, it suggests preference changes:

**After user dismisses 5+ changelog alerts from the same provider:**
```
💡 You've dismissed 5 changelog alerts from Stripe this month. 
   Would you like to raise the threshold to "Notable" or switch to a weekly digest?
   [Set to Notable]  [Weekly Digest]  [Dismiss]
```

**After a user never opens SDK release alerts:**
```
💡 You haven't opened any Stripe SDK release alerts in the last 30 days.
   Would you like to mute SDK releases for Stripe?
   [Mute]  [Keep as is]
```

These are tracked via a new table:

```sql
CREATE TABLE alert_engagement (
  id              TEXT PRIMARY KEY DEFAULT ('ae_' || nanoid()),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id       TEXT NOT NULL,  -- References shared_sources(id) *(Aligned 2026-03-24 -- matches Bible v2.2)*
  
  alerts_sent_30d       INT NOT NULL DEFAULT 0,
  alerts_opened_30d     INT NOT NULL DEFAULT 0,
  alerts_dismissed_30d  INT NOT NULL DEFAULT 0,
  alerts_actioned_30d   INT NOT NULL DEFAULT 0,  -- acknowledged or gave feedback
  
  suggestion_shown      TEXT DEFAULT null,        -- last suggestion type shown
  suggestion_shown_at   TIMESTAMPTZ DEFAULT null,
  suggestion_acted_on   BOOLEAN DEFAULT null,

  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, source_id)
);
```

Suggestion triggers:
- `dismissed_30d >= 5 AND opened_30d / sent_30d < 0.2` → Suggest raise severity or digest
- `opened_30d == 0 AND sent_30d >= 3` → Suggest mute
- Only show 1 suggestion per source per 30 days (avoid nagging)

---

## 6. Database Schema Summary

### New Tables

| Table | Purpose |
|-------|---------|
| `source_alert_preferences` | Per-source per-user alert customization |
| `alert_engagement` | Tracking alert open/dismiss rates for adaptive suggestions |

### Modified Tables

| Table | Change |
|-------|--------|
| `user_changes` | Add columns: `source_id TEXT`, `alerted BOOLEAN DEFAULT true`, `alert_suppressed_reason TEXT` |
| `monitored_sources` | No changes (preferences live in separate table) |

### Full Migration

```sql
-- Migration: Add per-source alert preferences

-- 1. Source alert preferences
CREATE TABLE source_alert_preferences (
  id              TEXT PRIMARY KEY DEFAULT ('sap_' || nanoid()),
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id       TEXT NOT NULL REFERENCES monitored_sources(id) ON DELETE CASCADE,
  alert_enabled   BOOLEAN NOT NULL DEFAULT true,
  min_severity    TEXT NOT NULL DEFAULT 'low'
    CHECK (min_severity IN ('low', 'medium', 'high', 'critical')),  -- *(Aligned 2026-03-24 -- matches Bible v2.2)*
  email_enabled   BOOLEAN DEFAULT null,
  webhook_ids     TEXT[] DEFAULT null,
  integration_ids TEXT[] DEFAULT null,
  digest_mode     BOOLEAN DEFAULT null,
  digest_schedule TEXT DEFAULT null
    CHECK (digest_schedule IS NULL OR digest_schedule IN ('daily', 'weekly')),
  quiet_hours_start TEXT DEFAULT null,
  quiet_hours_end   TEXT DEFAULT null,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_id)
);

CREATE INDEX idx_sap_user_id ON source_alert_preferences(user_id);
CREATE INDEX idx_sap_source_id ON source_alert_preferences(source_id);

-- 2. Alert engagement tracking
CREATE TABLE alert_engagement (
  id                    TEXT PRIMARY KEY DEFAULT ('ae_' || nanoid()),
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id             TEXT NOT NULL REFERENCES monitored_sources(id) ON DELETE CASCADE,
  alerts_sent_30d       INT NOT NULL DEFAULT 0,
  alerts_opened_30d     INT NOT NULL DEFAULT 0,
  alerts_dismissed_30d  INT NOT NULL DEFAULT 0,
  alerts_actioned_30d   INT NOT NULL DEFAULT 0,
  suggestion_shown      TEXT DEFAULT null,
  suggestion_shown_at   TIMESTAMPTZ DEFAULT null,
  suggestion_acted_on   BOOLEAN DEFAULT null,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, source_id)
);

CREATE INDEX idx_ae_user_id ON alert_engagement(user_id);

-- 3. Add source context to changes
ALTER TABLE user_changes ADD COLUMN source_id TEXT REFERENCES monitored_sources(id);
ALTER TABLE user_changes ADD COLUMN alerted BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE user_changes ADD COLUMN alert_suppressed_reason TEXT
  CHECK (alert_suppressed_reason IS NULL OR alert_suppressed_reason IN 
    ('muted', 'min_severity', 'quiet_hours', 'digest_pending'));

CREATE INDEX idx_uc_source_id ON user_changes(source_id);
CREATE INDEX idx_uc_alerted ON user_changes(alerted);

-- 4. New webhook event types (add to events enum if applicable)
-- 'source.preferences_updated', 'source.muted', 'source.unmuted'
```

---

## 7. ID Prefix Registry Update

| Entity | Prefix | Example |
|--------|--------|---------|
| Source Alert Preference | `sap_` | `sap_a1b2c3d4` |
| Alert Engagement | `ae_` | `ae_e5f6g7h8` |
| Source (existing) | `src_` | `src_i9j0k1l2` |

---

## 8. Plan Restrictions

*(Aligned 2026-03-24 -- matches Bible v2.2)*

| Feature | Free | Personal ($5) | Team ($19) | Business ($49) |
|---------|------|--------------|-----------|----------------|
| Per-source alert toggling | ✅ | ✅ | ✅ | ✅ |
| Per-source min_severity | ❌ (account-level only) | ✅ | ✅ | ✅ |
| Per-source channel routing | ❌ | ❌ | ✅ | ✅ |
| Digest mode | ❌ | ✅ | ✅ | ✅ |
| Per-source quiet hours | ❌ | ❌ | ❌ | ✅ |
| Adaptive suggestions | ❌ | ✅ | ✅ | ✅ |

**Rationale:** Alert toggling is table stakes — everyone gets it. Severity thresholds are the key differentiator for Personal. Channel routing and digests add real value for Team users managing multiple providers. Per-source quiet hours is a niche Business feature. *(Aligned 2026-03-24 -- matches Bible v2.2)*

---

## 9. Implementation Priority

### Phase 1 (MVP — Week 5-6)
- `source_alert_preferences` table
- `GET /v1/urls/:id/sources` endpoint
- `PATCH /v1/urls/:id/sources/:source_id` (alert_enabled, min_severity only)
- Updated notification pipeline with alert_enabled + min_severity checks
- `alerted` and `alert_suppressed_reason` on changes
- Dashboard: source list with on/off toggles and severity selector

### Phase 2 (v1.1)
- Per-source channel routing (webhook_ids, integration_ids)
- Bulk update endpoint
- `sources_summary` on URL detail response
- Dashboard: full configuration panel
- Quick actions

### Phase 3 (v1.2)
- Digest mode (daily/weekly)
- Per-source quiet hours
- `source.muted` / `source.unmuted` webhook events
- Dashboard: alert routing overview page

### Phase 4 (v2.0)
- Adaptive suggestions based on engagement tracking
- `alert_engagement` table and tracking
- "Learn from my behavior" opt-in setting

---

*This document defines the per-source alert preferences system for Chirri. It should be read alongside `CHIRRI_SOURCE_TRACKING_MODEL.md` (source model and bundling) and `CHIRRI_URL_ONBOARDING_FLOW.md` (API contract and notification system).*

---

## API-First Clarification *(Added 2026-03-24 — Alex Direction)*

### Three Interaction Modes

**1. Dashboard (we control UX):**
- User adds "Stripe" → we show all discovered sources with smart defaults pre-selected
- Toggle switches already set based on source type lookup table
- User adjusts before confirming, or accepts defaults
- Under the hood: dashboard sends API calls with `source_preferences` populated

**2. API (developer controls everything):**
- `POST /v1/urls` with just the URL → **everything ON by default, all severity levels, immediate delivery**
- No smart defaults applied unless explicitly requested via `"apply_smart_defaults": true`
- Developer configures each source via `PATCH /v1/urls/:id/sources/:source_id`
- Or passes preferences inline at creation time:
```json
{
  "url": "https://api.stripe.com",
  "source_preferences": {
    "changelog": {"min_severity": "notable", "digest": "daily"},
    "sdk": {"alert_enabled": false}
  }
}
```

**3. MCP (agent controls it):**
- Same as API — everything ON by default
- Agent decides what to mute based on its own logic
- The `apply_smart_defaults` flag is available for agents that want our recommendations

**Key principle:** Smart defaults are dashboard-only sugar. The API is always explicit — you get what you ask for, nothing hidden. If you don't specify preferences, everything is on.

### Default Lookup Table (Source Type → Defaults)

*(Aligned 2026-03-24 -- matches Bible v2.2)*

| Source Type | Dashboard Default | API Default |
|------------|------------------|-------------|
| `api_endpoint` | All severities, immediate | All severities, immediate |
| `openapi_spec` | Medium+, immediate | All severities, immediate |
| `changelog` | Medium+, daily digest | All severities, immediate |
| `status_page` | All severities, immediate | All severities, immediate |
| `sdk_release` | High only, weekly digest | All severities, immediate |

The source type comes from the classifier (already runs when URL is added). No ML, just a lookup table.
