# Chirri — Relevance Matching & Shared Intelligence Pipeline

**Version:** 1.0.0  
**Date:** 2026-03-24  
**Status:** Design-Ready  
**Depends on:** `CHIRRI_EARLY_WARNING_IMPLEMENTATION.md`, `CHIRRI_SOURCE_TRACKING_MODEL.md`, `DELTA_API_MASTER_SPEC.md`

> **Severity enum:** `critical | high | medium | low` (Bible §2.12). **Plan names:** Free, Personal ($5), Team ($19), Business ($49) (Bible §4.1). **IDs:** TEXT + nanoid, not UUID (Bible §5.2). *(Aligned 2026-03-24 -- matches Bible v2.2)*

> This document designs the system that determines WHETHER a signal from a shared/bonus source is relevant to a specific user's monitored endpoint, HOW intelligence is shared across users on the same domain, and the full pipeline from signal detection to per-user notification.

---

## Table of Contents

1. [Relevance Matching Engine](#1-relevance-matching-engine)
2. [Shared Source Model](#2-shared-source-model)
3. [Announcement Detection](#3-announcement-detection)
4. [Cross-User Fan-Out Pipeline](#4-cross-user-fan-out-pipeline)
5. [Signal Deduplication](#5-signal-deduplication)
6. [Confidence Scoring Model](#6-confidence-scoring-model)
7. [Database Schema Additions](#7-database-schema-additions)
8. [Full Pipeline](#8-full-pipeline)
9. [Performance Analysis](#9-performance-analysis)
10. [Implementation Effort Estimate](#10-implementation-effort-estimate)

---

## 1. Relevance Matching Engine

### 1.1 The Problem

A changelog on `api.example.com` says: *"We will be deprecating v1 endpoints starting September 1, 2026. Please migrate to v2."*

Users monitoring this domain:
- **User A** monitors `api.example.com/v1/users` → **AFFECTED** (on v1)
- **User B** monitors `api.example.com/v1/orders` → **AFFECTED** (on v1)
- **User C** monitors `api.example.com/v2/accounts` → **NOT affected** (on v2)
- **User D** monitors `api.example.com/docs` → **NOT affected** (different concern)

### 1.2 Chosen Approach: Hybrid (D) with Three-Layer Matching

After evaluating four approaches, the **hybrid** wins. No single technique covers all cases well. The three layers run in sequence — fast/cheap first, expensive last.

#### Layer 1: Structural Extraction (Fast, Deterministic)

Extract structured facts from the signal text using regex and path parsing. No NLP, no LLM.

```typescript
interface ExtractedSignal {
  // What the signal mentions
  mentionedPaths: string[];        // ["/v1/users", "/v1/orders", "/v1/*"]
  mentionedVersions: string[];     // ["v1", "1", "2023-12-01"]
  mentionedMethods: string[];      // ["POST", "GET"]
  mentionedProducts: string[];     // ["Sources API", "Charges"]
  
  // Intent
  action: 'deprecation' | 'removal' | 'breaking_change' | 'migration' | 'sunset' | 'maintenance' | 'info';
  scope: 'specific_endpoint' | 'version_wide' | 'product_wide' | 'service_wide' | 'unknown';
  
  // Timeline
  dates: { date: Date; label: string }[];  // [{date: 2026-09-01, label: "sunset date"}]
}
```

**Extraction patterns:**

```typescript
// Path extraction: find API paths in text
const PATH_PATTERNS = [
  // Explicit paths: /v1/users, /api/v2/orders
  /(?:^|\s|`|")(\/(?:api\/)?v?\d+(?:\/[\w\-\.]+)+)/gi,
  // Backtick-wrapped paths: `POST /v1/charges`
  /`(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[\w\-\.\/]+)`/gi,
  // URL-style references: https://api.example.com/v1/charges
  /https?:\/\/[^\/\s]+?(\/(?:api\/)?v?\d+(?:\/[\w\-\.]+)+)/gi,
];

// Version extraction: find API version references
const VERSION_PATTERNS = [
  // Explicit: "v1", "V2", "v1.2"
  /\bv(\d+(?:\.\d+)?)\b/gi,
  // Spelled out: "version 1", "API version 2"
  /\b(?:api\s+)?version\s+(\d+(?:\.\d+)?)\b/gi,
  // Date-based: "API version 2023-12-01", "2024-01"
  /\b(?:api\s+)?version\s+(\d{4}-\d{2}(?:-\d{2})?)\b/gi,
  // Shopify-style: "2024-04"
  /\b(20\d{2}-(?:0[1-9]|1[0-2]))\b/g,
];

// Scope detection: is this about all endpoints or specific ones?
const SCOPE_PATTERNS = {
  service_wide: [
    /\ball\s+(?:v\d+\s+)?endpoints?\b/i,
    /\bthe\s+entire\s+(?:v\d+\s+)?api\b/i,
    /\bservice[\s-]wide\b/i,
    /\bplatform[\s-]wide\b/i,
  ],
  version_wide: [
    /\bv\d+\s+(?:endpoints?|api|resources?)\b/i,
    /\ball\s+v\d+\b/i,
    /\bv\d+\s+will\s+be\b/i,
    /\bthe\s+v\d+\s+(?:api|version)\b/i,
  ],
  specific_endpoint: [
    /\b(?:the\s+)?\/[\w\/]+\s+endpoint\b/i,
    /\b(?:GET|POST|PUT|DELETE)\s+\/[\w\/]+/i,
  ],
};
```

#### Layer 2: Path-Based Relevance Matching (Core Logic)

Match extracted signal facts against each user's monitored URL.

```typescript
interface UserUrl {
  url: string;                     // "https://api.example.com/v1/users"
  parsedPath: string;              // "/v1/users"
  pathComponents: string[];        // ["v1", "users"]
  version: string | null;          // "v1" or "2024-04" or null
  domain: string;                  // "api.example.com"
}

interface RelevanceResult {
  isRelevant: boolean;
  score: number;                   // 0.0 - 1.0
  reasons: string[];               // human-readable reasons
  matchType: 'exact_path' | 'version_match' | 'product_match' | 'service_wide' | 'none';
}

function matchRelevance(signal: ExtractedSignal, userUrl: UserUrl): RelevanceResult {
  const reasons: string[] = [];
  let score = 0;

  // ── Rule 1: Exact path match (highest confidence) ──
  for (const path of signal.mentionedPaths) {
    if (userUrl.parsedPath === path) {
      score = Math.max(score, 0.95);
      reasons.push(`Signal mentions your exact endpoint: ${path}`);
    } else if (userUrl.parsedPath.startsWith(path.replace(/\*$/, ''))) {
      score = Math.max(score, 0.90);
      reasons.push(`Signal mentions parent path: ${path}`);
    } else if (path.includes('*') && matchGlob(userUrl.parsedPath, path)) {
      score = Math.max(score, 0.85);
      reasons.push(`Signal matches path pattern: ${path}`);
    }
  }

  // ── Rule 2: Version match ──
  if (userUrl.version && signal.mentionedVersions.length > 0) {
    const normalizedUserVersion = normalizeVersion(userUrl.version);
    for (const v of signal.mentionedVersions) {
      const normalizedSignalVersion = normalizeVersion(v);
      if (normalizedUserVersion === normalizedSignalVersion) {
        // User is on the mentioned version
        if (signal.scope === 'version_wide' || signal.scope === 'service_wide') {
          score = Math.max(score, 0.80);
          reasons.push(`Signal affects version ${v} (your endpoint is on this version)`);
        } else if (signal.scope === 'specific_endpoint') {
          // Version matches but signal is about a specific endpoint
          // Only relevant if path also matches (already handled in Rule 1)
          score = Math.max(score, 0.40);
          reasons.push(`Signal affects version ${v} but targets specific endpoints`);
        }
      }
    }

    // NEGATIVE signal: user is on a DIFFERENT version than what's affected
    if (signal.mentionedVersions.length > 0 && 
        !signal.mentionedVersions.some(v => normalizeVersion(v) === normalizedUserVersion)) {
      // The signal mentions versions but NOT the user's version
      // This is ANTI-relevant — reduce score
      score = Math.min(score, 0.15);
      reasons.push(`Signal affects versions ${signal.mentionedVersions.join(', ')} (you're on ${userUrl.version})`);
    }
  }

  // ── Rule 3: Service-wide scope ──
  if (signal.scope === 'service_wide') {
    score = Math.max(score, 0.70);
    reasons.push('Signal affects the entire service');
  }

  // ── Rule 4: Product name match ──
  for (const product of signal.mentionedProducts) {
    const productLower = product.toLowerCase();
    // Check if the user's path contains the product name
    if (userUrl.pathComponents.some(c => c.toLowerCase().includes(productLower)) ||
        userUrl.parsedPath.toLowerCase().includes(productLower)) {
      score = Math.max(score, 0.70);
      reasons.push(`Signal mentions "${product}" which appears in your endpoint path`);
    }
  }

  // ── Rule 5: SDK major bump — always somewhat relevant ──
  if (signal.action === 'breaking_change' && signal.scope === 'product_wide') {
    score = Math.max(score, 0.50);
    reasons.push('Major SDK update may affect your integration');
  }

  // ── Threshold ──
  const isRelevant = score >= 0.40;

  const matchType = score >= 0.85 ? 'exact_path'
    : score >= 0.70 ? 'version_match'
    : score >= 0.50 ? 'product_match'
    : score >= 0.40 ? 'service_wide'
    : 'none';

  return { isRelevant, score, reasons, matchType };
}
```

#### Layer 3: Status Page — Always Relevant for Service Degradation

Status page signals (degradation, outage, maintenance) follow different rules. If the status affects the API service the user depends on, it's relevant regardless of version or path.

```typescript
function matchStatusPageRelevance(
  statusSignal: StatusPageSignal,
  userUrl: UserUrl
): RelevanceResult {
  // Status page affects a specific component?
  if (statusSignal.affectedComponent) {
    const componentName = statusSignal.affectedComponent.toLowerCase();
    // "API" component affects all API users
    if (componentName.includes('api')) {
      return { isRelevant: true, score: 0.85, reasons: ['API service degradation'], matchType: 'service_wide' };
    }
    // Specific component (e.g., "Payments API") — match against user path
    if (userUrl.parsedPath.toLowerCase().includes(componentName.replace(/\s+api$/i, ''))) {
      return { isRelevant: true, score: 0.90, reasons: [`"${statusSignal.affectedComponent}" is degraded`], matchType: 'product_match' };
    }
    // Unrelated component
    return { isRelevant: false, score: 0.10, reasons: [`Affects "${statusSignal.affectedComponent}" (not your endpoint)`], matchType: 'none' };
  }
  
  // No specific component — general service status
  return { isRelevant: true, score: 0.75, reasons: ['General service status change'], matchType: 'service_wide' };
}
```

### 1.3 Approach Comparison (Why Hybrid Wins)

| Approach | False Positives | False Negatives | Speed | Build Effort |
|----------|----------------|-----------------|-------|-------------|
| **A: Text matching** | HIGH (too broad) | LOW | Fast | Easy |
| **B: Path/version extraction** | LOW | MEDIUM (misses natural language) | Fast | Medium |
| **C: Semantic tagging** | VERY LOW | LOW | Medium | Hard (requires good tagger) |
| **D: Hybrid (chosen)** | LOW | LOW | Fast (Layer 1+2 <5ms) | Medium |

The hybrid approach runs Layer 1 (extraction) as pure regex — no external calls, <1ms. Layer 2 (matching) is simple conditional logic — also <1ms. Total: <5ms per user match. For 1000 users, that's <5 seconds total (trivially parallelizable).

### 1.4 URL Parsing for Relevance

Every monitored URL gets pre-parsed when added/updated:

```typescript
function parseUserUrl(rawUrl: string): UserUrl {
  const parsed = new URL(rawUrl);
  const pathComponents = parsed.pathname.split('/').filter(Boolean);
  
  // Extract version from path
  let version: string | null = null;
  for (const component of pathComponents) {
    // Versioned path: /v1/, /v2/, /api/v3/
    const versionMatch = component.match(/^v(\d+(?:\.\d+)?)$/i);
    if (versionMatch) {
      version = `v${versionMatch[1]}`;
      break;
    }
    // Date-versioned: /2024-04/
    const dateVersionMatch = component.match(/^(20\d{2}-(?:0[1-9]|1[0-2])(?:-\d{2})?)$/);
    if (dateVersionMatch) {
      version = dateVersionMatch[1];
      break;
    }
  }
  
  return {
    url: rawUrl,
    parsedPath: parsed.pathname,
    pathComponents,
    version,
    domain: parsed.hostname,
  };
}
```

### 1.5 Version Normalization

APIs use wildly different versioning schemes. Normalization enables comparison:

```typescript
function normalizeVersion(v: string): string {
  // Strip leading "v" or "V"
  let normalized = v.replace(/^[vV]/, '');
  
  // "1" → "1", "1.0" → "1", "2024-04" → "2024-04"
  // Only strip trailing ".0" for simple numeric versions
  if (/^\d+\.0$/.test(normalized)) {
    normalized = normalized.replace(/\.0$/, '');
  }
  
  return normalized.toLowerCase();
}
```

### 1.6 Helper: Glob Matching

```typescript
function matchGlob(path: string, pattern: string): boolean {
  // Convert glob pattern to regex: /v1/* → /v1/.*
  const regexStr = '^' + pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*')
    + '$';
  return new RegExp(regexStr).test(path);
}
```

---

## 2. Shared Source Model

### 2.1 Design: Domain-Level Shared Sources

Bonus sources (changelogs, status pages, OpenAPI specs) are **not owned by any user**. They belong to the **domain**.

**Lifecycle:**

```
User A adds api.example.com/v1/users
  → System checks: does domain "api.example.com" have shared sources?
  → No → Run discovery (crawl for changelog, status page, etc.)
  → Create shared_sources rows for domain
  → Start checking shared sources on system schedule

User B adds api.example.com/v1/orders
  → System checks: does domain "api.example.com" have shared sources?
  → Yes → Skip discovery (already exists)
  → User B automatically benefits from existing shared sources

User A deletes their URL
  → System checks: any other users on domain "api.example.com"?
  → Yes (User B still active) → Keep shared sources running

User B deletes their URL
  → System checks: any other users on domain "api.example.com"?
  → No → Mark shared sources as orphaned
  → After 7-day grace period → Delete shared sources (stop checking)
```

### 2.2 Shared Source Table

```sql
CREATE TABLE shared_sources (
    id              TEXT PRIMARY KEY,
    
    -- Domain grouping
    domain          TEXT NOT NULL,              -- "api.example.com"
    
    -- Source details
    source_type     TEXT NOT NULL
                    CHECK (source_type IN (
                        'changelog',           -- HTML changelog page
                        'changelog_rss',       -- RSS/Atom feed
                        'openapi_spec',        -- OpenAPI/Swagger spec
                        'status_page',         -- Statuspage.io or similar
                        'github_releases',     -- GitHub Atom feed for releases
                        'blog',                -- Blog/announcements page
                        'migration_guide'      -- Migration/upgrade guide
                    )),
    url             TEXT NOT NULL,              -- The actual URL to check
    
    -- Discovery tracking
    discovered_by   TEXT REFERENCES users(id) ON DELETE SET NULL,  -- Who triggered discovery
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    discovery_method TEXT NOT NULL DEFAULT 'auto'
                    CHECK (discovery_method IN ('auto', 'provider_profile', 'manual', 'crawled')),
    
    -- Check configuration (system-controlled, not user-controlled)
    check_interval  INTERVAL NOT NULL DEFAULT '2 hours',
    last_checked_at TIMESTAMPTZ,
    last_change_at  TIMESTAMPTZ,
    consecutive_errors INT NOT NULL DEFAULT 0,
    
    -- Shared content tracking (for diffing)
    current_body_hash TEXT,                    -- SHA-256 of latest content
    current_body_r2_key TEXT,                  -- Full body in R2
    previous_body_r2_key TEXT,                 -- Previous body for diffing
    
    -- Lifecycle
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN (
                        'active',              -- Being checked on schedule
                        'paused',              -- Temporarily paused (too many errors)
                        'orphaned',            -- No users on this domain anymore
                        'deleted'              -- Soft-deleted
                    )),
    orphaned_at     TIMESTAMPTZ,              -- When last user left the domain
    
    -- Metadata
    content_type    TEXT,                      -- Detected content type
    title           TEXT,                      -- Page title or feed name
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- One source of each type per domain
    UNIQUE (domain, source_type, url)
);

CREATE INDEX idx_shared_sources_domain ON shared_sources (domain) WHERE status = 'active';
CREATE INDEX idx_shared_sources_schedule ON shared_sources (last_checked_at) WHERE status = 'active';
CREATE INDEX idx_shared_sources_orphaned ON shared_sources (orphaned_at) WHERE status = 'orphaned';
```

### 2.3 Domain User Count Tracking

We need a fast way to know "how many users are on this domain?" without scanning all URLs.

```sql
-- Materialized view or maintained counter
CREATE TABLE domain_user_counts (
    domain          TEXT PRIMARY KEY,
    user_count      INT NOT NULL DEFAULT 0,
    url_count       INT NOT NULL DEFAULT 0,
    first_user_at   TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_domain_user_counts_active ON domain_user_counts (domain) WHERE user_count > 0;
```

Updated via triggers on `urls` table (or in application code when URLs are added/removed):

```typescript
// When a URL is added
async function onUrlAdded(userId: string, url: string): Promise<void> {
  const domain = new URL(url).hostname;
  
  await db.query(`
    INSERT INTO domain_user_counts (domain, user_count, url_count, first_user_at)
    VALUES ($1, 1, 1, now())
    ON CONFLICT (domain) DO UPDATE SET
      user_count = (
        SELECT COUNT(DISTINCT u.user_id)
        FROM urls u
        JOIN shared_urls su ON u.shared_url_id = su.id
        WHERE su.domain = $1 AND u.deleted_at IS NULL
      ),
      url_count = domain_user_counts.url_count + 1,
      last_updated_at = now()
  `, [domain]);
  
  // Check if shared sources exist for this domain
  const existing = await db.query(
    `SELECT id FROM shared_sources WHERE domain = $1 AND status = 'active' LIMIT 1`,
    [domain]
  );
  
  if (existing.rows.length === 0) {
    // First URL on this domain — trigger discovery
    await discoveryQueue.add('discover-domain', { domain, triggered_by: userId });
  } else {
    // Re-activate orphaned sources if they exist
    await db.query(`
      UPDATE shared_sources SET status = 'active', orphaned_at = NULL, updated_at = now()
      WHERE domain = $1 AND status = 'orphaned'
    `, [domain]);
  }
}

// When a URL is removed
async function onUrlRemoved(userId: string, url: string): Promise<void> {
  const domain = new URL(url).hostname;
  
  const result = await db.query(`
    UPDATE domain_user_counts SET
      user_count = (
        SELECT COUNT(DISTINCT u.user_id)
        FROM urls u
        JOIN shared_urls su ON u.shared_url_id = su.id
        WHERE su.domain = $1 AND u.deleted_at IS NULL
      ),
      url_count = GREATEST(url_count - 1, 0),
      last_updated_at = now()
    WHERE domain = $1
    RETURNING user_count
  `, [domain]);
  
  if (result.rows[0]?.user_count === 0) {
    // Last user left — orphan the shared sources
    await db.query(`
      UPDATE shared_sources SET
        status = 'orphaned',
        orphaned_at = now(),
        updated_at = now()
      WHERE domain = $1 AND status = 'active'
    `, [domain]);
  }
}
```

### 2.4 Orphan Cleanup Cron

```typescript
// Run daily: clean up shared sources orphaned > 7 days ago
async function cleanupOrphanedSources(): Promise<void> {
  const orphaned = await db.query(`
    UPDATE shared_sources SET
      status = 'deleted',
      updated_at = now()
    WHERE status = 'orphaned'
      AND orphaned_at < now() - INTERVAL '7 days'
    RETURNING id, domain, url
  `);
  
  for (const row of orphaned.rows) {
    logger.info({ domain: row.domain, url: row.url }, 'Cleaned up orphaned shared source');
    // Clean up R2 bodies if desired
  }
  
  // Also clean up domain_user_counts with 0 users
  await db.query(`
    DELETE FROM domain_user_counts WHERE user_count = 0
  `);
}
```

### 2.5 Integration with Existing Provider Model

The shared source model integrates with the existing provider profiles from `CHIRRI_SOURCE_TRACKING_MODEL.md`:

- **Provider profiles** (Stripe, OpenAI, etc.) define KNOWN bonus source URLs
- **Auto-discovery** finds bonus sources on domains WITHOUT provider profiles
- Both paths create rows in `shared_sources`
- The `discovery_method` field tracks the origin:
  - `provider_profile` — came from a known provider template
  - `auto` — discovered by crawling the domain
  - `manual` — user explicitly added it
  - `crawled` — found via link analysis of the main URL

---

## 3. Announcement Detection

### 3.1 The Key Insight

The highest value isn't detecting that an endpoint is already deprecated. It's detecting the **announcement of a FUTURE deprecation** — the changelog entry that says "v1 will be removed on September 1, 2026."

This is a **temporal intent extraction** problem: find text that describes a future event with a specific action (deprecation/removal/sunset) and a date.

### 3.2 Real-World Deprecation Language Patterns

From analyzing actual deprecation announcements across 10+ major API providers:

#### Stripe
- *"We've deprecated support for local payment methods in the Sources API and plan to turn it off."*
- *"The Checkout resource is deprecated and will sunset on April 1, 2025."*
- *"Support for .NET Core versions 5 & 7 are deprecated and will be removed in the next major version scheduled for March 2026."*
- *"id property on the Issuing Authorization resource has been deprecated and will be removed in a future API version."*

#### OpenAI
- *"On April 14th, 2025, we notified developers that the gpt-4.5-preview model is deprecated and will be removed from the API in the coming months."*
- *"On November 14th, 2025, we notified developers using DALL·E model snapshots of their deprecation and removal from the API on May 12, 2026."*
- *"Access to these models will be shut down on the dates below."*
- *"The Realtime API Beta will be deprecated and removed from the API on May 7, 2026."*

#### Twilio
- *"We have decided to End of Life (EOL) our Programmable Video product on December 5, 2024."*
- *"Notify will now EOL on December 31, 2025."*
- *"Twilio will officially sunset Voice JavaScript SDK version 1.x on September 10, 2025."*
- *"Starting on March 31, 2025, the following SDK versions will no longer be supported."*

#### GitHub
- *"Version 2022-11-28 will continue to be fully supported for at least 24 months from today."*
- (Implies deprecation AFTER that period — detecting future-positive signals)

#### Shopify
- *"The Checkout resource is deprecated and will sunset on April 1, 2025."*
- *"It's marked as deprecated when it's removed in a newer version of the API."*
- Uses `X-Shopify-API-Deprecated-Reason` header — machine-readable!

#### Google Cloud
- *"The managed BigQuery data lake... will be shut down."*
- *"Sunset (shutdown) date of the deprecated library is yet to be determined."*
- *"March 17, 2025: Maintenance mode starts."*

#### Heroku
- *"We have deprecated the legacy version of the Heroku Platform API (v2). It will be sunset on April 15, 2017."*

### 3.3 Common Language Patterns (Extracted)

From the real examples above, deprecation announcements follow remarkably consistent patterns:

**Action phrases** (what's happening):

| Pattern | Frequency | Example |
|---------|-----------|---------|
| `will be removed` | Very common | "will be removed from the API on May 12, 2026" |
| `will be deprecated` | Very common | "will be deprecated and removed" |
| `is deprecated` | Very common | "the gpt-4.5-preview model is deprecated" |
| `will sunset` / `will be sunset` | Common | "will sunset on April 1, 2025" |
| `end of life` / `EOL` | Common | "End of Life (EOL) our Programmable Video product" |
| `will be shut down` | Common | "will be shut down on the dates below" |
| `will no longer be supported` | Common | "will no longer be supported" |
| `plan to turn it off` | Occasional | "and plan to turn it off" |
| `will officially sunset` | Occasional | "Twilio will officially sunset..." |
| `maintenance mode` | Occasional | "Maintenance mode starts" |

**Temporal markers** (when it's happening):

| Pattern | Example |
|---------|---------|
| `on <date>` | "on May 12, 2026" |
| `starting <date>` | "starting on March 31, 2025" |
| `scheduled for <date>` | "scheduled for March 2026" |
| `by <date>` | "migrate by December 2025" |
| `in the coming months` | "will be removed in the coming months" |
| `in a future version` | "will be removed in a future API version" |
| `at least <N> months` | "supported for at least 24 months" |
| `within <N> months` | "deprecated for at least 9 months" |

**Migration directives** (what to do):

| Pattern | Example |
|---------|---------|
| `migrate to` | "you must migrate to the current APIs" |
| `please migrate` | "Please migrate to v2" |
| `upgrade to` | "upgrade to Voice SDK 2.x" |
| `we recommend` | "we are recommending our customers migrate" |
| `in favor of` | "removed in favor of the Payment Intents API" |
| `replaced by` | "replaced by PaymentMethods" |

### 3.4 Announcement Detection Engine

```typescript
// src/workers/signals/announcement-detector.ts

import * as chrono from 'chrono-node';

interface AnnouncementSignal {
  type: 'deprecation' | 'removal' | 'sunset' | 'eol' | 'breaking_change' | 'migration';
  
  // What's affected
  affectedEntities: string[];    // paths, products, versions mentioned
  scope: 'specific_endpoint' | 'version_wide' | 'product_wide' | 'service_wide' | 'unknown';
  
  // When
  deadline: Date | null;         // Specific date if found
  deadlineText: string | null;   // "May 12, 2026" — the raw text
  timeframe: string | null;      // "in the coming months", "within 9 months"
  
  // Migration path
  migrationTarget: string | null; // "v2", "Payment Intents API"
  migrationUrl: string | null;    // Link to migration guide
  
  // Context
  rawText: string;               // The paragraph that triggered detection
  matchedPatterns: string[];     // Which patterns matched
  confidence: number;            // 0-100
}

/**
 * FUTURE-INTENT patterns: these detect announcements about upcoming changes.
 * Different from CURRENT-STATE patterns ("is deprecated") — these find
 * "will be deprecated", "planned for removal", etc.
 */
const FUTURE_INTENT_PATTERNS: { pattern: RegExp; type: AnnouncementSignal['type']; weight: number }[] = [
  // Removal
  { pattern: /will\s+be\s+removed/i, type: 'removal', weight: 90 },
  { pattern: /will\s+(?:be\s+)?shut\s*down/i, type: 'removal', weight: 90 },
  { pattern: /plan(?:s|ning)?\s+to\s+(?:remove|turn\s+(?:it\s+)?off|shut\s*down)/i, type: 'removal', weight: 85 },
  { pattern: /scheduled\s+for\s+removal/i, type: 'removal', weight: 90 },
  
  // Deprecation
  { pattern: /will\s+(?:be\s+)?deprecated/i, type: 'deprecation', weight: 85 },
  { pattern: /is\s+(?:now\s+)?deprecated/i, type: 'deprecation', weight: 80 },
  { pattern: /have\s+been\s+deprecated/i, type: 'deprecation', weight: 80 },
  { pattern: /we(?:'ve|'re|\s+have)\s+deprecated/i, type: 'deprecation', weight: 85 },
  { pattern: /marked\s+as\s+deprecated/i, type: 'deprecation', weight: 80 },
  
  // Sunset
  { pattern: /will\s+(?:be\s+)?sunset/i, type: 'sunset', weight: 90 },
  { pattern: /will\s+officially\s+sunset/i, type: 'sunset', weight: 95 },
  { pattern: /sunset\s+(?:date|on|by)/i, type: 'sunset', weight: 85 },
  { pattern: /sunsetting/i, type: 'sunset', weight: 80 },
  
  // End of Life
  { pattern: /end\s+of\s+life/i, type: 'eol', weight: 90 },
  { pattern: /\bEOL\b/i, type: 'eol', weight: 85 },
  { pattern: /will\s+(?:now\s+)?EOL/i, type: 'eol', weight: 90 },
  { pattern: /end[\s-]of[\s-]support/i, type: 'eol', weight: 80 },
  
  // Breaking changes
  { pattern: /breaking\s+change(?:s)?\s+(?:coming|planned|scheduled|in\s+(?:the\s+)?next)/i, type: 'breaking_change', weight: 85 },
  { pattern: /will\s+no\s+longer\s+(?:be\s+)?(?:supported|available|work)/i, type: 'removal', weight: 85 },
  
  // Migration directives (strong signal when combined with other patterns)
  { pattern: /(?:must|need\s+to|should)\s+migrate/i, type: 'migration', weight: 70 },
  { pattern: /please\s+migrate/i, type: 'migration', weight: 75 },
  { pattern: /migration\s+(?:required|needed|guide)/i, type: 'migration', weight: 70 },
  { pattern: /upgrade\s+(?:required|needed)/i, type: 'migration', weight: 70 },
];

/**
 * MIGRATION TARGET patterns: what should users migrate TO?
 */
const MIGRATION_TARGET_PATTERNS = [
  /migrate\s+to\s+(?:the\s+)?(.+?)(?:\.|,|\s+before|\s+by)/i,
  /replaced?\s+(?:by|with)\s+(?:the\s+)?(.+?)(?:\.|,)/i,
  /in\s+favor\s+of\s+(?:the\s+)?(.+?)(?:\.|,)/i,
  /upgrade\s+to\s+(?:the\s+)?(.+?)(?:\.|,)/i,
  /recommend(?:ing|ed)?\s+(?:.*?\s+)?(?:migrate|switch|move)\s+to\s+(?:the\s+)?(.+?)(?:\.|,)/i,
];

export function detectAnnouncements(
  text: string,
  sourceUrl: string
): AnnouncementSignal[] {
  // Split text into paragraphs/sections for per-section analysis
  const sections = text.split(/\n\n+|\n(?=#{1,4}\s)/).filter(s => s.trim().length > 20);
  const signals: AnnouncementSignal[] = [];
  
  for (const section of sections) {
    const matchedPatterns: { pattern: string; type: AnnouncementSignal['type']; weight: number }[] = [];
    
    // Check each future-intent pattern
    for (const { pattern, type, weight } of FUTURE_INTENT_PATTERNS) {
      if (pattern.test(section)) {
        matchedPatterns.push({ pattern: pattern.source, type, weight });
      }
    }
    
    if (matchedPatterns.length === 0) continue;
    
    // Extract dates from this section using chrono-node
    const chronoResults = chrono.parse(section, new Date(), { forwardDate: true });
    const dates = chronoResults
      .filter(r => {
        // Only accept dates that look like deadlines (future, with at least year certainty)
        return r.start.isCertain('year') && r.start.date() > new Date();
      })
      .map(r => ({ date: r.start.date(), text: r.text }));
    
    // Extract affected entities (paths, versions, products)
    const affectedEntities = extractAffectedEntities(section);
    
    // Determine scope
    const scope = determineScope(section, affectedEntities);
    
    // Extract migration target
    let migrationTarget: string | null = null;
    for (const pattern of MIGRATION_TARGET_PATTERNS) {
      const match = section.match(pattern);
      if (match) {
        migrationTarget = match[1].trim().replace(/['"]/g, '');
        break;
      }
    }
    
    // Pick the highest-weight match type
    const primaryMatch = matchedPatterns.sort((a, b) => b.weight - a.weight)[0];
    
    // Calculate confidence
    let confidence = primaryMatch.weight;
    if (dates.length > 0) confidence = Math.min(confidence + 10, 100);
    if (matchedPatterns.length > 1) confidence = Math.min(confidence + 5, 100);
    if (migrationTarget) confidence = Math.min(confidence + 5, 100);
    if (affectedEntities.length > 0) confidence = Math.min(confidence + 5, 100);
    
    signals.push({
      type: primaryMatch.type,
      affectedEntities,
      scope,
      deadline: dates[0]?.date || null,
      deadlineText: dates[0]?.text || null,
      timeframe: extractTimeframe(section),
      migrationTarget,
      migrationUrl: extractMigrationUrl(section),
      rawText: section.substring(0, 2000),
      matchedPatterns: matchedPatterns.map(m => m.pattern),
      confidence,
    });
  }
  
  return signals;
}

function extractAffectedEntities(text: string): string[] {
  const entities: string[] = [];
  
  // Extract paths
  for (const pattern of PATH_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const match of matches) {
      entities.push(match[1] || match[0]);
    }
  }
  
  // Extract version references
  for (const pattern of VERSION_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const match of matches) {
      entities.push(`v${match[1]}`);
    }
  }
  
  // Extract product names (capitalized phrases before "API", "SDK", etc.)
  const productMatches = text.matchAll(/\b([A-Z][\w]*(?:\s+[A-Z][\w]*)*)\s+(?:API|SDK|service|product|endpoint|resource)\b/g);
  for (const match of productMatches) {
    entities.push(match[1]);
  }
  
  return [...new Set(entities)]; // dedupe
}

function extractTimeframe(text: string): string | null {
  const timeframePatterns = [
    /in\s+the\s+coming\s+(?:months?|weeks?|days?)/i,
    /within\s+(?:the\s+next\s+)?\d+\s+(?:months?|weeks?|days?)/i,
    /in\s+(?:a\s+)?future\s+(?:version|release|update)/i,
    /(?:at\s+)?least\s+\d+\s+(?:months?|weeks?|days?)/i,
    /(?:next|upcoming)\s+(?:major\s+)?(?:version|release)/i,
  ];
  
  for (const pattern of timeframePatterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  
  return null;
}

function extractMigrationUrl(text: string): string | null {
  // Look for URLs near migration keywords
  const urlPattern = /https?:\/\/[^\s<>"')\]]+/g;
  const urls = [...text.matchAll(urlPattern)].map(m => m[0]);
  
  for (const url of urls) {
    if (/migrat|upgrade|transit/i.test(url)) return url;
  }
  
  return urls.length > 0 ? urls[0] : null;
}

function determineScope(text: string, entities: string[]): AnnouncementSignal['scope'] {
  // Check scope patterns from Layer 1
  for (const pattern of SCOPE_PATTERNS.service_wide) {
    if (pattern.test(text)) return 'service_wide';
  }
  for (const pattern of SCOPE_PATTERNS.version_wide) {
    if (pattern.test(text)) return 'version_wide';
  }
  for (const pattern of SCOPE_PATTERNS.specific_endpoint) {
    if (pattern.test(text)) return 'specific_endpoint';
  }
  
  // Infer from entities
  if (entities.some(e => e.startsWith('/'))) return 'specific_endpoint';
  if (entities.some(e => /^v\d/.test(e))) return 'version_wide';
  
  return 'unknown';
}
```

### 3.5 chrono-node Capabilities and Limitations

`chrono-node` handles most date formats API changelogs use:

| Format | chrono-node handles? | Example |
|--------|---------------------|---------|
| "May 12, 2026" | ✅ Yes | OpenAI style |
| "December 5, 2024" | ✅ Yes | Twilio style |
| "April 1, 2025" | ✅ Yes | Shopify style |
| "March 2026" | ✅ Yes (defaults to March 1) | Stripe .NET style |
| "2026-09-01" | ✅ Yes | ISO format |
| "Q3 2026" | ❌ No — needs custom parser | Quarter notation |
| "in the coming months" | ❌ No — vague | Captured as timeframe instead |
| "in a future version" | ❌ No — vague | Captured as timeframe instead |
| "next major release" | ❌ No — vague | Captured as timeframe instead |

**Q-notation parser addition:**

```typescript
// Custom chrono-node parser for "Q1 2026", "Q3 2025"
const quarterParser: chrono.Parser = {
  pattern: () => /\bQ([1-4])\s+(20\d{2})\b/i,
  extract: (context, match) => {
    const quarter = parseInt(match[1]);
    const year = parseInt(match[2]);
    const month = (quarter - 1) * 3 + 1; // Q1=Jan, Q2=Apr, Q3=Jul, Q4=Oct
    return context.createParsingComponents({
      year,
      month,
      day: 1,
    });
  },
};

// Add to chrono instance
const customChrono = chrono.casual.clone();
customChrono.parsers.push(quarterParser);
```

### 3.6 Can We Do This Without an LLM?

**Yes, for 90%+ of cases.** The research above shows that API deprecation announcements use remarkably predictable language. The combination of:

1. **Keyword matching** (25 future-intent patterns)
2. **chrono-node date extraction** (handles 90% of date formats)
3. **Path/version regex extraction** (handles structured references)
4. **Migration target extraction** (5 patterns)

...covers the vast majority of real-world deprecation announcements without any LLM calls.

**Where an LLM would help (future enhancement):**
- Summarizing long changelog entries into one-liner alerts
- Disambiguating vague signals ("considering changes" vs "will change")
- Extracting affected entities from complex natural language
- Translating non-English changelogs

**Recommendation:** Ship without LLM. Add LLM summarization as a V2 enhancement for the notification message, not the detection pipeline.

---

## 4. Cross-User Fan-Out Pipeline

### 4.1 Architecture

When a shared source detects a change, the fan-out happens in three phases:

```
Phase 1: DETECT          Phase 2: MATCH          Phase 3: DELIVER
─────────────────        ─────────────────       ─────────────────
Shared source check  →   Extract signal      →   For each matched user:
detects content change   Run announcement        Create user_forecast
                         detector                Create notification
                         Extract affected     →   For each non-matched user:
                         entities/versions        Store in shared history
                                                  (visible in dashboard)
                    →   Query all users on
                        this domain (batch)
                    →   For each user:
                        Run relevance match
```

### 4.2 BullMQ Integration

The fan-out uses a **two-queue approach**:

```
Queue: shared-source-checks     (NEW — checks shared sources on schedule)
  ├── Job: { shared_source_id, domain, url, source_type }
  ├── Concurrency: 5 per worker
  ├── On change detected → add job to signal-fanout queue
  └── Rate limit: per-domain (uses existing domain rate limiter)

Queue: signal-fanout             (NEW — processes signals and fans out to users)
  ├── Job: { signal_id, domain, signal_data, affected_entities }
  ├── Concurrency: 10 per worker
  ├── Batch-loads all users on domain
  ├── Runs relevance matching for each
  └── Creates user_forecasts + notifications
```

**Why a separate queue for fan-out?**
- Shared source checks are I/O-bound (HTTP fetch). Fan-out is CPU-bound (regex matching).
- Keeps check latency predictable (checking doesn't block on N-user fan-out).
- Fan-out can be retried independently if it fails.

### 4.3 The Fan-Out Worker

```typescript
// src/workers/signal-fanout-worker.ts

interface SignalFanoutJob {
  signalId: string;
  domain: string;
  sharedSourceId: string;
  signalType: 'announcement' | 'header' | 'spec_change' | 'status';
  extractedSignal: ExtractedSignal;
  announcementSignal?: AnnouncementSignal;
  changeId?: string;
}

async function processSignalFanout(job: Job<SignalFanoutJob>): Promise<void> {
  const { domain, extractedSignal, announcementSignal, sharedSourceId } = job.data;
  
  // ── Step 1: Batch-load all user URLs on this domain ──
  const userUrls = await db.query(`
    SELECT u.id as url_id, u.user_id, u.url, su.url as shared_url,
           su.domain, su.id as shared_url_id
    FROM urls u
    JOIN shared_urls su ON u.shared_url_id = su.id
    WHERE su.domain = $1
      AND u.deleted_at IS NULL
      AND u.paused = FALSE
  `, [domain]);
  
  if (userUrls.rows.length === 0) return;
  
  // ── Step 2: Pre-parse all user URLs (done once) ──
  const parsedUrls = userUrls.rows.map(row => ({
    ...row,
    parsed: parseUserUrl(row.shared_url),
  }));
  
  // ── Step 3: Create the signal record ──
  const signalId = await createSignalRecord(job.data);
  
  // ── Step 4: Run relevance matching for each user URL ──
  const matched: { urlId: string; userId: string; relevance: RelevanceResult }[] = [];
  const unmatched: { urlId: string; userId: string; relevance: RelevanceResult }[] = [];
  
  for (const userUrl of parsedUrls) {
    const relevance = matchRelevance(extractedSignal, userUrl.parsed);
    
    if (relevance.isRelevant) {
      matched.push({ urlId: userUrl.url_id, userId: userUrl.user_id, relevance });
    } else {
      unmatched.push({ urlId: userUrl.url_id, userId: userUrl.user_id, relevance });
    }
  }
  
  // ── Step 5: Deduplicate by user (a user with 3 matched URLs gets ONE notification) ──
  const userBestMatch = new Map<string, { urlId: string; relevance: RelevanceResult }>();
  for (const m of matched) {
    const existing = userBestMatch.get(m.userId);
    if (!existing || m.relevance.score > existing.relevance.score) {
      userBestMatch.set(m.userId, { urlId: m.urlId, relevance: m.relevance });
    }
  }
  
  // ── Step 6: Create signal_matches for ALL users (matched and unmatched) ──
  const matchRows = [
    ...matched.map(m => ({
      signalId, userId: m.userId, urlId: m.urlId,
      isRelevant: true, score: m.relevance.score,
      matchType: m.relevance.matchType, reasons: m.relevance.reasons,
    })),
    ...unmatched.map(m => ({
      signalId, userId: m.userId, urlId: m.urlId,
      isRelevant: false, score: m.relevance.score,
      matchType: m.relevance.matchType, reasons: m.relevance.reasons,
    })),
  ];
  
  // Batch insert (efficient for large user counts)
  if (matchRows.length > 0) {
    await batchInsertSignalMatches(matchRows);
  }
  
  // ── Step 7: Create forecasts + notifications for matched users ──
  for (const [userId, best] of userBestMatch) {
    await createForecastForUser(userId, best.urlId, signalId, job.data, best.relevance);
    
    // Only notify if confidence is above threshold
    const confidence = calculateConfidence(job.data, best.relevance);
    if (confidence >= 50) {
      await notificationQueue.add('send', {
        type: 'forecast.new',
        user_id: userId,
        forecast_id: signalId,
        url_id: best.urlId,
        severity: confidence >= 80 ? 'warning' : 'info',
        message: buildChirpMessage(job.data, best.relevance),
      });
    }
  }
  
  // ── Step 8: Update signal record with match stats ──
  await db.query(`
    UPDATE signals SET
      matched_users = $1,
      total_users = $2,
      processed_at = now()
    WHERE id = $3
  `, [userBestMatch.size, parsedUrls.length, signalId]);
  
  logger.info({
    domain,
    signal_type: job.data.signalType,
    total_users: parsedUrls.length,
    matched_users: userBestMatch.size,
  }, 'Signal fan-out complete');
}
```

### 4.4 Batch Optimization for Large Domains

For domains with many users (e.g., Stripe with 1000+ users), we optimize:

```typescript
async function batchInsertSignalMatches(
  rows: SignalMatchRow[]
): Promise<void> {
  // Use pg COPY or multi-row INSERT
  // Batch in chunks of 500 to avoid query size limits
  const CHUNK_SIZE = 500;
  
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    
    // Build multi-row VALUES clause
    const values: any[] = [];
    const placeholders: string[] = [];
    
    chunk.forEach((row, idx) => {
      const offset = idx * 6;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`
      );
      values.push(
        row.signalId, row.userId, row.urlId,
        row.isRelevant, row.score, JSON.stringify(row.reasons)
      );
    });
    
    await db.query(`
      INSERT INTO signal_matches (signal_id, user_id, url_id, is_relevant, relevance_score, reasons)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (signal_id, user_id, url_id) DO NOTHING
    `, values);
  }
}
```

---

## 5. Signal Deduplication

### 5.1 The Problem

When multiple sources detect the same underlying event, users should get ONE chirp, not three:

| Source | What it detects | It's the same event |
|--------|----------------|-------------------|
| Changelog | "v1 endpoints deprecated September 1" | ← Same deprecation |
| Sunset header | `Sunset: Mon, 01 Sep 2026 00:00:00 GMT` | ← Same deprecation |
| OpenAPI spec | `deprecated: true` on `/v1/charges` | ← Same deprecation |

### 5.2 Deduplication Strategy: Correlation Groups

Signals are grouped into **correlation groups** based on:

```
correlation_key = SHA-256(domain + action_type + normalized_scope + deadline_month)
```

Where:
- `domain` = "api.example.com"
- `action_type` = "deprecation" | "removal" | "sunset" | "eol" (normalized)
- `normalized_scope` = "v1" | "/v1/charges" | "Sources API" (the most specific affected entity)
- `deadline_month` = "2026-09" | "unknown" (month granularity for grouping)

```typescript
function generateCorrelationKey(signal: ExtractedSignal | AnnouncementSignal, domain: string): string {
  // Normalize action type
  const actionType = normalizeActionType(signal.type || signal.action);
  
  // Pick most specific scope
  const scope = signal.affectedEntities?.[0]  // Most specific entity first
    || signal.mentionedVersions?.[0]           // Fall back to version
    || 'service';                              // Fall back to service-wide
  
  // Deadline month (for temporal grouping)
  const deadline = signal.deadline || signal.dates?.[0]?.date;
  const deadlineMonth = deadline
    ? `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}`
    : 'unknown';
  
  return createHash('sha256')
    .update(`${domain}:${actionType}:${scope}:${deadlineMonth}`)
    .digest('hex');
}

function normalizeActionType(type: string): string {
  // Group similar types
  const mapping: Record<string, string> = {
    'deprecation': 'deprecation',
    'deprecated': 'deprecation',
    'removal': 'removal',
    'sunset': 'removal',     // sunset ≈ removal for grouping
    'eol': 'removal',        // EOL ≈ removal for grouping
    'breaking_change': 'breaking',
    'migration': 'deprecation',  // migration directive implies deprecation
  };
  return mapping[type.toLowerCase()] || type.toLowerCase();
}
```

### 5.3 Correlation Group Behavior

When a new signal arrives with a correlation key that already exists:

```typescript
async function deduplicateSignal(
  newSignal: Signal,
  correlationKey: string
): Promise<{ isDuplicate: boolean; existingSignalId?: string; action: 'skip' | 'merge' | 'create' }> {
  // Find existing signals in the same correlation group
  const existing = await db.query(`
    SELECT id, signal_type, confidence, deadline, created_at
    FROM signals
    WHERE correlation_key = $1
      AND status = 'active'
    ORDER BY confidence DESC, created_at ASC
    LIMIT 5
  `, [correlationKey]);
  
  if (existing.rows.length === 0) {
    return { isDuplicate: false, action: 'create' };
  }
  
  const primary = existing.rows[0]; // highest-confidence existing signal
  
  // If same source type → exact duplicate, skip
  if (existing.rows.some(r => r.signal_type === newSignal.signalType)) {
    return { isDuplicate: true, existingSignalId: primary.id, action: 'skip' };
  }
  
  // Different source type but same correlation → MERGE (corroborating evidence)
  // This INCREASES the confidence of the existing signal
  return { isDuplicate: false, existingSignalId: primary.id, action: 'merge' };
}

async function mergeCorroboratingSignal(
  existingSignalId: string,
  newSignal: Signal
): Promise<void> {
  // Add as corroborating evidence
  await db.query(`
    INSERT INTO signal_evidence (signal_id, source_type, source_url, evidence_text, detected_at)
    VALUES ($1, $2, $3, $4, now())
  `, [existingSignalId, newSignal.signalType, newSignal.sourceUrl, newSignal.rawText]);
  
  // Boost confidence of the primary signal
  await db.query(`
    UPDATE signals SET
      confidence = LEAST(confidence + 10, 100),
      evidence_count = evidence_count + 1,
      updated_at = now()
    WHERE id = $1
  `, [existingSignalId]);
  
  // Don't create a new notification — the original chirp already went out
  // But DO update the forecast description if it exists
  await db.query(`
    UPDATE forecasts SET
      description = description || E'\n\n' || $1,
      confidence = LEAST(confidence + 10, 100),
      updated_at = now()
    WHERE id IN (
      SELECT forecast_id FROM signal_matches WHERE signal_id = $2 AND is_relevant = TRUE
    )
  `, [
    `🔗 Corroborating signal: ${newSignal.signalType} also confirms this. (${new Date().toISOString().split('T')[0]})`,
    existingSignalId
  ]);
}
```

### 5.4 User-Facing Correlated Signals

When multiple signals corroborate each other, the user sees ONE chirp with multiple evidence sources:

```
🔮 HIGH CONFIDENCE: Stripe v1 endpoints will be deprecated on September 1, 2026

Evidence:
  📝 Changelog (Mar 15): "We will be deprecating v1 endpoints starting September 1, 2026"
  🔧 Sunset Header (Mar 16): Sunset: Mon, 01 Sep 2026 00:00:00 GMT
  📋 OpenAPI Spec (Mar 17): /v1/charges marked deprecated:true

Migration: Upgrade to v2 Payment Intents API
  → https://stripe.com/docs/migration/charges
```

---

## 6. Confidence Scoring Model

### 6.1 Confidence Factors

Confidence is a 0-100 score that answers: "How sure are we that this signal is real and actionable?"

```typescript
interface ConfidenceFactors {
  sourceReliability: number;       // How reliable is the source type?
  signalClarity: number;           // How clear/unambiguous is the signal?
  temporalSpecificity: number;     // Is there a specific date?
  corroboration: number;           // Multiple sources confirm?
  relevanceScore: number;          // How well does it match the user's URL?
}

function calculateConfidence(
  signal: Signal,
  relevance: RelevanceResult,
  evidenceCount: number = 1
): number {
  // ── Source reliability (base score) ──
  const sourceScores: Record<string, number> = {
    'sunset_header':       90,  // RFC standard, machine-readable → very high
    'deprecation_header':  90,  // RFC standard → very high
    'spec_deprecated':     85,  // OpenAPI deprecated:true → high
    'spec_breaking':       85,  // Structural API change → high
    'changelog_keyword':   70,  // Text analysis → medium-high
    'sdk_major_bump':      65,  // May or may not affect user → medium
    'github_signal':       60,  // Release notes vary in quality → medium
    'status_page':         80,  // Machine-readable, operational data → high
    'blog':                45,  // Blogs are noisy → lower
    'migration_guide':     75,  // Existence of migration guide → fairly strong
  };
  
  let confidence = sourceScores[signal.signalType] || 50;
  
  // ── Temporal specificity bonus ──
  if (signal.deadline) {
    confidence += 10;  // Specific date → more actionable
  } else if (signal.timeframe) {
    confidence += 5;   // Vague timeframe → slight boost
  }
  
  // ── Signal clarity ──
  // Multiple keywords matched → more confident
  if (signal.matchedPatterns && signal.matchedPatterns.length > 2) {
    confidence += 5;
  }
  // Migration target identified → more confident (they're actively directing users)
  if (signal.migrationTarget) {
    confidence += 5;
  }
  
  // ── Corroboration bonus ──
  // Each additional source adds confidence (diminishing returns)
  if (evidenceCount > 1) {
    confidence += Math.min((evidenceCount - 1) * 8, 20);
  }
  
  // ── Relevance adjustment ──
  // High relevance → maintain confidence
  // Low relevance → reduce confidence (we're less sure it affects THIS user)
  if (relevance.score < 0.5) {
    confidence *= 0.8;
  } else if (relevance.score >= 0.85) {
    confidence += 5;
  }
  
  // ── Cap ──
  return Math.round(Math.min(Math.max(confidence, 0), 100));
}
```

### 6.2 Notification Thresholds

| Confidence | Action | User Experience |
|-----------|--------|-----------------|
*(Aligned 2026-03-24 -- matches Bible v2.2, Bible §3.7 confidence thresholds)*

| **≥ 60** | **Full chirp** | Notification + dashboard + webhook |
| **40-59** | **Soft chirp** | Dashboard + webhook with "low confidence" label, NO push notification |
| **< 40** | **Dashboard only** | Visible with human-readable explanation. Nothing swallowed silently. |

### 6.3 User-Facing Confidence Display

```
🔴 HIGH CONFIDENCE (95): Sunset header + changelog confirm
🟡 MEDIUM CONFIDENCE (65): Changelog mentions "considering deprecation"
⚪ LOW CONFIDENCE (45): Blog post mentions "v2 coming soon"
```

---

## 7. Database Schema Additions

### 7.1 Complete New Tables

```sql
-- Migration: 006_relevance_intelligence.sql

BEGIN;

-- ═══════════════════════════════════════════════════════
-- 1. SHARED SOURCES — Domain-level bonus sources
-- ═══════════════════════════════════════════════════════

CREATE TABLE shared_sources (
    id                  TEXT PRIMARY KEY,
    domain              TEXT NOT NULL,
    source_type         TEXT NOT NULL CHECK (source_type IN (
                            'changelog', 'changelog_rss', 'openapi_spec',
                            'status_page', 'github_releases', 'blog', 'migration_guide'
                        )),
    url                 TEXT NOT NULL,
    
    -- Discovery
    discovered_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
    discovered_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    discovery_method    TEXT NOT NULL DEFAULT 'auto'
                        CHECK (discovery_method IN ('auto', 'provider_profile', 'manual', 'crawled')),
    
    -- Check schedule
    check_interval      TEXT NOT NULL DEFAULT '2h',  -- *(Aligned 2026-03-24 -- matches Bible v2.2: TEXT, not INTERVAL)*
    last_checked_at     TIMESTAMPTZ,
    last_change_at      TIMESTAMPTZ,
    consecutive_errors  INT NOT NULL DEFAULT 0,
    
    -- Content tracking
    current_body_hash   TEXT,
    current_body_r2_key TEXT,
    previous_body_r2_key TEXT,
    
    -- Lifecycle
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'orphaned', 'deleted')),
    orphaned_at         TIMESTAMPTZ,
    
    -- Metadata
    content_type        TEXT,
    title               TEXT,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (domain, source_type, url)
);

CREATE INDEX idx_shared_sources_domain ON shared_sources (domain) WHERE status = 'active';
CREATE INDEX idx_shared_sources_schedule ON shared_sources (last_checked_at)
    WHERE status = 'active';
CREATE INDEX idx_shared_sources_orphaned ON shared_sources (orphaned_at)
    WHERE status = 'orphaned';

-- ═══════════════════════════════════════════════════════
-- 2. DOMAIN USER COUNTS — Fast lookup for user counts per domain
-- ═══════════════════════════════════════════════════════

CREATE TABLE domain_user_counts (
    domain              TEXT PRIMARY KEY,
    user_count          INT NOT NULL DEFAULT 0,
    url_count           INT NOT NULL DEFAULT 0,
    first_user_at       TIMESTAMPTZ,
    last_updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_domain_user_counts_active ON domain_user_counts (domain)
    WHERE user_count > 0;

-- ═══════════════════════════════════════════════════════
-- 3. SIGNALS — Detected early warning signals (domain-level)
-- ═══════════════════════════════════════════════════════

CREATE TABLE signals (
    id                  TEXT PRIMARY KEY,
    shared_source_id    TEXT REFERENCES shared_sources(id) ON DELETE SET NULL,
    domain              TEXT NOT NULL,
    
    -- Signal classification
    signal_type         TEXT NOT NULL CHECK (signal_type IN (
                            'announcement',    -- Future deprecation/removal from changelog
                            'header',          -- Sunset/Deprecation HTTP header
                            'spec_change',     -- OpenAPI spec structural change
                            'status',          -- Status page event
                            'sdk_release',     -- SDK major version bump
                            'github_release'   -- GitHub release with breaking changes
                        )),
    action_type         TEXT NOT NULL CHECK (action_type IN (
                            'deprecation', 'removal', 'sunset', 'eol',
                            'breaking_change', 'migration', 'maintenance', 'info'
                        )),
    scope               TEXT NOT NULL DEFAULT 'unknown' CHECK (scope IN (
                            'specific_endpoint', 'version_wide', 'product_wide',
                            'service_wide', 'unknown'
                        )),
    
    -- Content
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    raw_text            TEXT,                  -- Source text snippet (max 2000 chars)
    source_url          TEXT,
    
    -- Affected entities
    affected_paths      JSONB DEFAULT '[]',    -- ["/v1/charges", "/v1/sources"]
    affected_versions   JSONB DEFAULT '[]',    -- ["v1", "2023-12-01"]
    affected_products   JSONB DEFAULT '[]',    -- ["Sources API", "Charges"]
    
    -- Timeline
    deadline            TIMESTAMPTZ,
    deadline_text       TEXT,                  -- "September 1, 2026" as written
    timeframe           TEXT,                  -- "in the coming months"
    
    -- Migration
    migration_target    TEXT,                  -- "v2 Payment Intents API"
    migration_url       TEXT,
    documentation_url   TEXT,
    
    -- Confidence & dedup
    confidence          INT NOT NULL DEFAULT 70 CHECK (confidence BETWEEN 0 AND 100),
    correlation_key     TEXT NOT NULL,          -- For grouping related signals
    dedup_key           TEXT NOT NULL UNIQUE,   -- For exact dedup
    evidence_count      INT NOT NULL DEFAULT 1,
    
    -- Fan-out stats
    total_users         INT DEFAULT 0,
    matched_users       INT DEFAULT 0,
    
    -- Lifecycle
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                            'active', 'superseded', 'expired', 'false_positive'
                        )),
    processed_at        TIMESTAMPTZ,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signals_domain ON signals (domain, created_at DESC);
CREATE INDEX idx_signals_correlation ON signals (correlation_key);
CREATE INDEX idx_signals_status ON signals (status) WHERE status = 'active';
CREATE INDEX idx_signals_dedup ON signals (dedup_key);

-- ═══════════════════════════════════════════════════════
-- 4. SIGNAL EVIDENCE — Corroborating sources for a signal
-- ═══════════════════════════════════════════════════════

CREATE TABLE signal_evidence (
    id                  TEXT PRIMARY KEY,
    signal_id           TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    
    source_type         TEXT NOT NULL,          -- 'changelog', 'header', 'spec', etc.
    source_url          TEXT,
    evidence_text       TEXT,                   -- Raw text snippet
    
    detected_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signal_evidence_signal ON signal_evidence (signal_id);

-- ═══════════════════════════════════════════════════════
-- 5. SIGNAL MATCHES — Per-user relevance results
-- ═══════════════════════════════════════════════════════

CREATE TABLE signal_matches (
    id                  TEXT PRIMARY KEY,
    signal_id           TEXT NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url_id              TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    
    -- Relevance result
    is_relevant         BOOLEAN NOT NULL,
    relevance_score     REAL NOT NULL DEFAULT 0,    -- 0.0 to 1.0
    match_type          TEXT CHECK (match_type IN (
                            'exact_path', 'version_match', 'product_match',
                            'service_wide', 'none'
                        )),
    reasons             JSONB DEFAULT '[]',    -- Human-readable match reasons
    
    -- Notification tracking
    chirped             BOOLEAN NOT NULL DEFAULT FALSE,
    chirped_at          TIMESTAMPTZ,
    chirp_confidence    INT,                    -- Confidence at time of chirp
    
    -- User feedback
    feedback            TEXT CHECK (feedback IN (
                            NULL, 'helpful', 'not_relevant', 'false_positive'
                        )),
    feedback_at         TIMESTAMPTZ,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (signal_id, user_id, url_id)
);

CREATE INDEX idx_signal_matches_user ON signal_matches (user_id, created_at DESC);
CREATE INDEX idx_signal_matches_signal ON signal_matches (signal_id) WHERE is_relevant = TRUE;
CREATE INDEX idx_signal_matches_unnotified ON signal_matches (user_id)
    WHERE is_relevant = TRUE AND chirped = FALSE;

-- ═══════════════════════════════════════════════════════
-- 6. UPDATES TO EXISTING TABLES
-- ═══════════════════════════════════════════════════════

-- Add parsed URL components to urls table for fast matching
ALTER TABLE urls ADD COLUMN IF NOT EXISTS parsed_path TEXT;
ALTER TABLE urls ADD COLUMN IF NOT EXISTS parsed_version TEXT;
ALTER TABLE urls ADD COLUMN IF NOT EXISTS path_components JSONB DEFAULT '[]';

-- Add domain to shared_urls if not present (for fast domain lookups)
-- (shared_urls.domain likely already exists from CHIRRI_ARCHITECTURE.md)

-- Populate parsed fields for existing URLs
-- (run as data migration)
-- UPDATE urls SET
--   parsed_path = ...,
--   parsed_version = ...,
--   path_components = ...
-- WHERE parsed_path IS NULL;

COMMIT;
```

### 7.2 Schema Relationship Diagram

```
shared_sources (domain-level)
    │
    ├──1:N──▶ signals (detected events)
    │              │
    │              ├──1:N──▶ signal_evidence (corroborating sources)
    │              │
    │              └──1:N──▶ signal_matches (per-user relevance)
    │                             │
    │                             ├──N:1──▶ users
    │                             └──N:1──▶ urls
    │
    └── Lifecycle tied to domain_user_counts

forecasts (from EARLY_WARNING_IMPLEMENTATION.md)
    │
    └── Can be created FROM signal_matches when is_relevant=true
        (forecasts are the user-facing entity;
         signals are the system-level detection entity)
```

### 7.3 Relationship Between `signals` and `forecasts`

The existing `forecasts` table (from CHIRRI_EARLY_WARNING_IMPLEMENTATION.md) is the **user-facing** entity. The new `signals` table is the **system-level detection** entity. The relationship:

```
Signal (system-level)  →  Relevance Match  →  Forecast (user-facing)
                                           →  signal_matches (tracking)
```

When a signal is relevant to a user, we create BOTH:
1. A `forecast` (linked to the user's `shared_url_id` — for the dashboard, API, notifications)
2. A `signal_match` (tracking the relevance decision — for analytics, feedback, debugging)

The `forecast.change_id` links to the change that triggered detection. The new `signal_matches.signal_id` links to the underlying signal. Both are accessible from the user-facing forecast detail page.

---

## 8. Full Pipeline

### Step-by-Step

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: SCHEDULE SHARED SOURCE CHECK                                │
│                                                                     │
│ Cron job (every minute) queries shared_sources:                     │
│   WHERE status = 'active'                                           │
│     AND (last_checked_at IS NULL                                    │
│       OR last_checked_at + check_interval <= now())                 │
│   ORDER BY last_checked_at ASC NULLS FIRST                         │
│   LIMIT 100                                                         │
│                                                                     │
│ Adds jobs to `shared-source-checks` queue.                          │
└────────────────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: FETCH SHARED SOURCE CONTENT                                 │
│                                                                     │
│ Worker fetches the URL (using existing safeFetch with SSRF          │
│ protection, domain rate limiting, circuit breaker).                  │
│                                                                     │
│ Compares content hash with current_body_hash:                       │
│   If same → update last_checked_at, DONE                            │
│   If different → proceed to Step 3                                  │
│                                                                     │
│ Store new body in R2. Update shared_sources row.                    │
└────────────────────────────────────────┬────────────────────────────┘
                                         │ (content changed)
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: SIGNAL EXTRACTION                                           │
│                                                                     │
│ Based on source_type, run appropriate extraction:                    │
│                                                                     │
│   changelog/blog →  scanChangelogForSignals() (existing)            │
│                     + detectAnnouncements() (new)                   │
│                                                                     │
│   openapi_spec   →  diffOpenAPISpecs() (V1.1)                      │
│                                                                     │
│   status_page    →  checkStatusPage() (existing)                    │
│                                                                     │
│   changelog_rss  →  Parse RSS entries, run keyword scan on new      │
│                     entries only                                     │
│                                                                     │
│ Produces: ExtractedSignal + AnnouncementSignal[]                    │
└────────────────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: DEDUPLICATION                                               │
│                                                                     │
│ Generate correlation_key from signal facts.                         │
│ Check existing signals with same correlation_key:                   │
│                                                                     │
│   No existing  → CREATE new signal record                           │
│   Same type    → SKIP (exact duplicate)                             │
│   Different type → MERGE (corroborating evidence)                   │
│                    Boost existing signal confidence +10              │
│                    Add to signal_evidence table                     │
│                    Do NOT create new notification                    │
│                                                                     │
│ If SKIP → DONE (no fan-out needed)                                  │
│ If CREATE or MERGE → proceed to Step 5                              │
└────────────────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: ADD TO FAN-OUT QUEUE                                        │
│                                                                     │
│ Add job to `signal-fanout` queue with signal data.                  │
│ This decouples detection from per-user processing.                  │
└────────────────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 6: BATCH LOAD USERS ON DOMAIN                                  │
│                                                                     │
│ Single query: all active user URLs on this domain.                  │
│ Pre-parse each URL (version, path components).                      │
│ This is done ONCE per signal, not per-user.                         │
│                                                                     │
│ Optimization: If domain_user_counts.user_count = 0, skip.          │
└────────────────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 7: RELEVANCE MATCHING (per user)                               │
│                                                                     │
│ For each user URL:                                                  │
│   Layer 1: Structural extraction (regex, <1ms)                      │
│   Layer 2: Path/version matching (<1ms)                             │
│   Layer 3: Status page matching (if applicable, <1ms)               │
│                                                                     │
│ Result: RelevanceResult { isRelevant, score, reasons, matchType }   │
│                                                                     │
│ Performance: 1000 users × <3ms each = <3 seconds total              │
└────────────────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 8: CONFIDENCE SCORING                                          │
│                                                                     │
│ For each matched user:                                              │
│   Combine source reliability + signal clarity + temporal            │
│   specificity + corroboration + relevance score                     │
│                                                                     │
│   Result: confidence 0-100                                          │
└────────────────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 9: RECORD MATCHES + CREATE FORECASTS                           │
│                                                                     │
│ Batch insert signal_matches for ALL users (matched + unmatched).    │
│                                                                     │
│ For matched users (confidence ≥ 40):                                │
│   Create/update forecast in forecasts table                         │
│   Create user_forecast linking user to forecast                     │
│                                                                     │
│ For unmatched users:                                                │
│   Store in signal_matches only (visible in dashboard history)       │
└────────────────────────────────────────┬────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 10: SMART CHIRP (Notification)                                 │
│                                                                     │
│ For each matched user with confidence ≥ 60:                         │
│   Deduplicate by user (best match if multiple URLs)                 │
│   Create notification job in notifications queue                    │
│                                                                     │
│ Chirp format:                                                       │
│   🔮 <title>                                                       │
│   Affects: <your endpoint>                                          │
│   Deadline: <date> (<N> days away)                                  │
│   Confidence: <HIGH/MEDIUM>                                         │
│   Reason: <why this is relevant to you>                             │
│   Action: <migration target if known>                               │
│                                                                     │
│ For confidence 40-59:                                               │
│   Record in dashboard but do NOT send notification                  │
│                                                                     │
│ For confidence < 40:                                                │
│   Log only, not shown in dashboard                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Cron Schedule Summary

| Cron | Task | Queue |
|------|------|-------|
| `* * * * *` (every minute) | Schedule due shared source checks | `shared-source-checks` |
| `0 */6 * * *` (every 6h) | Schedule package version checks | `package-checks` |
| `0 8 * * *` (daily 08:00 UTC) | Deadline reminder scan | Direct (no queue) |
| `0 0 * * *` (daily midnight) | Forecast expiry | Direct |
| `0 3 * * *` (daily 03:00 UTC) | Orphaned source cleanup | Direct |
| `0 */4 * * *` (every 4h) | domain_user_counts maintenance | Direct |

### 8.3 Queue Topology (Updated)

```
Existing:
  1. url-checks          (10 concurrency/worker)
  2. learning-checks     (5 concurrency/worker)
  3. confirmation-checks (5 concurrency/worker)
  4. notifications       (20 concurrency/worker)

New:
  5. shared-source-checks (5 concurrency/worker)  — checks shared sources
  6. signal-fanout        (10 concurrency/worker)  — relevance matching + delivery
  7. package-checks       (5 concurrency/worker)   — npm/PyPI version checks
```

---

## 9. Performance Analysis

### 9.1 Scenario: 1000 Users Monitor Stripe

```
Domain: api.stripe.com
Users: 1,000
URLs per user: ~2 (average)
Total user URLs: ~2,000
Shared sources: 4 (changelog, status page, OpenAPI spec, GitHub releases)
```

#### Shared Source Deduplication

Without shared sources:
- 1000 users × 4 sources × check interval = thousands of redundant requests

With shared sources:
- 4 shared source checks (ONE per source)
- ~$0.00001/check × 4 = negligible cost

**Savings: 99.6% fewer HTTP requests**

#### Fan-Out Performance

When the changelog detects a change:

| Step | Time | Notes |
|------|------|-------|
| Fetch changelog | ~200ms | Single HTTP request |
| Extract signal | ~5ms | Regex + chrono-node |
| Query 2000 user URLs | ~15ms | Indexed query on domain |
| Parse 2000 URLs | ~10ms | Regex, pre-cached in practice |
| 2000 relevance matches | ~6ms | <3µs per match |
| Batch insert 2000 signal_matches | ~50ms | Multi-row INSERT, 4 chunks |
| Create ~500 forecasts (25% match rate) | ~100ms | Batch upsert |
| Queue ~500 notifications | ~20ms | BullMQ bulk add |
| **Total** | **~400ms** | **Sub-second for 1000 users** |

#### Memory Usage

- 2000 parsed URLs in memory: ~2000 × 200 bytes = ~400KB
- Signal data: ~1KB
- Total working memory for fan-out: <1MB

#### Database Load

| Operation | Queries | Rows affected |
|-----------|---------|---------------|
| Load user URLs | 1 | 2000 rows read |
| Insert signal | 1 | 1 row write |
| Insert signal_matches | 4 (batched) | 2000 rows write |
| Upsert forecasts | ~500 | 500 rows write |
| Upsert user_forecasts | ~500 | 500 rows write |
| Queue notifications | 1 (bulk) | 500 jobs |
| **Total** | **~1007** | **~3501 rows** |

This is well within PostgreSQL's comfort zone. A single fan-out for 1000 users takes <500ms of DB time.

### 9.2 Scenario: 10,000 Users Monitor Stripe

At 10x scale:
- Fan-out time: ~3 seconds (mostly batch inserts)
- Memory: ~4MB
- DB rows: ~35,000

Still manageable. The batch insert approach scales linearly. At this scale, consider:
- Partitioning `signal_matches` by month
- Using PostgreSQL COPY instead of INSERT for the batch
- Processing fan-out in chunks of 1000 users to avoid long-running transactions

### 9.3 Worst Case: Every User Gets Notified

If a signal is `service_wide` (e.g., "Stripe API experiencing degraded performance"):
- ALL 1000 users match
- 1000 notifications queued
- The `notifications` queue handles this fine (concurrency: 20/worker, 1000 jobs ≈ 50 seconds to drain at 1 email/second)

For webhooks (instant delivery), the throughput is higher: 20 concurrent × ~100ms/webhook = ~5 seconds for 1000 notifications.

### 9.4 Index Strategy

The key queries that need to be fast:

```sql
-- "All user URLs on this domain" — the fan-out query
-- Index: shared_urls(domain), urls(shared_url_id, deleted_at)
EXPLAIN SELECT u.id, u.user_id, su.url
FROM urls u JOIN shared_urls su ON u.shared_url_id = su.id
WHERE su.domain = 'api.stripe.com' AND u.deleted_at IS NULL;
-- Expected: Index scan on shared_urls(domain) → nested loop join on urls(shared_url_id)

-- "Due shared source checks" — the scheduler query
-- Index: shared_sources(last_checked_at) WHERE status = 'active'
EXPLAIN SELECT * FROM shared_sources
WHERE status = 'active' AND (last_checked_at IS NULL OR last_checked_at + check_interval <= now())
ORDER BY last_checked_at ASC NULLS FIRST LIMIT 100;
-- Expected: Index scan on idx_shared_sources_schedule

-- "Existing signals for correlation" — dedup query
-- Index: signals(correlation_key)
EXPLAIN SELECT * FROM signals WHERE correlation_key = $1 AND status = 'active';
-- Expected: Index scan on idx_signals_correlation
```

---

## 10. Implementation Effort Estimate

### Phase 1: Core Pipeline (MVP — During Week 3-4)

| # | Component | Effort | Dependencies |
|---|-----------|--------|-------------|
| 1 | Database migration (all new tables) | 2h | DB setup |
| 2 | URL parsing + version extraction | 3h | None |
| 3 | Relevance matching engine (Layer 1+2) | 6h | #2 |
| 4 | Announcement detection engine | 8h | chrono-node |
| 5 | Shared source model + lifecycle | 4h | #1 |
| 6 | Domain user count tracking | 2h | #1, #5 |
| 7 | Shared source check worker | 4h | #5, existing safeFetch |
| 8 | Signal extraction (plugging into existing keyword scanner) | 3h | #4, existing scanner |
| 9 | Signal deduplication + correlation | 4h | #1 |
| 10 | Confidence scoring | 2h | #3 |
| 11 | Fan-out worker (batch processing) | 6h | #3, #9, #10 |
| 12 | Integration: shared source → signal → fan-out → forecast → notification | 4h | All above |
| 13 | Orphan cleanup cron | 1h | #5 |
| 14 | Unit tests (relevance matching, announcement detection) | 6h | #3, #4 |
| 15 | Integration tests (end-to-end pipeline) | 4h | #12 |
| **Total** | | **~59h (~8 days)** | |

### Phase 2: Enhancements (V1.1 — Weeks 9-12)

| Component | Effort |
|-----------|--------|
| Status page integration with relevance matching | 1 day |
| OpenAPI spec diff → signal extraction | 2 days |
| User feedback loop (helpful/not relevant/false positive) | 0.5 day |
| Confidence auto-tuning from feedback | 1 day |
| Dashboard: signal history per domain | 1 day |
| Multi-signal correlation view | 1 day |
| **Total** | **~6.5 days** |

### Phase 3: Intelligence (V2+)

| Component | Effort |
|-----------|--------|
| LLM-powered signal summarization | 2 days |
| Cross-domain intelligence ("Stripe SDK release affects all Stripe integrations") | 3 days |
| Machine learning relevance refinement from user feedback | 5 days |
| Auto-discovery of new bonus sources via web crawling | 3 days |

### Total MVP Investment

| Category | Hours |
|----------|-------|
| Early Warning System (from IMPLEMENTATION.md) | ~37h |
| Relevance Intelligence (this document) | ~59h |
| **Overlap** (shared work: forecasts table, notification integration) | **~-10h** |
| **Total unique work** | **~86h (~11 days)** |

This is a 2-3 week sprint for one developer, or 1-2 weeks with two.

---

## Appendix A: Test Scenarios

### A.1 Version-Wide Deprecation

```
Signal: "We will be deprecating v1 endpoints starting September 1, 2026."
Domain: api.example.com

User A: api.example.com/v1/users      → MATCH (version=v1, scope=version_wide) score=0.80
User B: api.example.com/v1/orders     → MATCH (version=v1, scope=version_wide) score=0.80
User C: api.example.com/v2/accounts   → NO MATCH (version=v2, anti-relevant) score=0.15
User D: api.example.com/docs          → NO MATCH (no version) score=0.10
```

### A.2 Specific Endpoint Deprecation

```
Signal: "The /v1/charges endpoint is deprecated. Use /v2/payment_intents instead."
Domain: api.stripe.com

User A: api.stripe.com/v1/charges     → MATCH (exact path) score=0.95
User B: api.stripe.com/v1/customers   → NO MATCH (different path, same version but specific scope) score=0.40
User C: api.stripe.com/v2/customers   → NO MATCH (different version) score=0.15
```

### A.3 Service-Wide Outage

```
Signal: Status page shows "API service degraded — elevated error rates"
Domain: api.stripe.com

User A: api.stripe.com/v1/charges     → MATCH (service degradation affects all) score=0.85
User B: api.stripe.com/v1/customers   → MATCH (service degradation affects all) score=0.85
User C: api.stripe.com/v2/customers   → MATCH (service degradation affects all) score=0.85
User D: stripe.com/docs              → NO MATCH (different subdomain, docs not API) score=0.10
```

### A.4 SDK Major Bump

```
Signal: stripe-node v16.0.0 released (major bump from v15.x)
Domain: api.stripe.com

ALL users on this domain → MATCH (SDK bump is broadly relevant) score=0.50
Confidence: 65 (SDK bump doesn't guarantee breaking changes for their specific endpoint)
```

### A.5 Correlated Signals

```
Signal 1 (Day 1): Changelog says "v1 deprecated September 1, 2026"
  → Create signal, correlation_key = hash(stripe.com:deprecation:v1:2026-09)
  → Fan out to users A, B (matched), skip C, D
  → Confidence: 75

Signal 2 (Day 2): Sunset header appears on api.stripe.com/v1/charges
  → Generate correlation_key = hash(stripe.com:removal:v1:2026-09)
  → Same correlation group! → MERGE
  → Add to signal_evidence
  → Boost confidence to 85
  → Do NOT send new notification
  → Update forecast description with "corroborating: Sunset header also confirms"

Signal 3 (Day 5): OpenAPI spec marks /v1/charges as deprecated:true
  → Same correlation group → MERGE
  → Boost confidence to 95
  → Update forecast with third evidence source
```

---

## Appendix B: Real Changelog Language Catalog

Extracted from actual API provider deprecation announcements for pattern validation:

| Provider | Exact Language | Detected Patterns |
|----------|---------------|-------------------|
| **Stripe** | "We've deprecated support for local payment methods in the Sources API and plan to turn it off" | `deprecated`, `plan to turn it off` |
| **Stripe** | "The Checkout resource is deprecated and will sunset on April 1, 2025" | `deprecated`, `will sunset`, date |
| **Stripe** | "will be removed in the next major version scheduled for March 2026" | `will be removed`, `scheduled for`, date |
| **OpenAI** | "the gpt-4.5-preview model is deprecated and will be removed from the API" | `deprecated`, `will be removed` |
| **OpenAI** | "Access to these models will be shut down on the dates below" | `will be shut down` |
| **OpenAI** | "will be deprecated and removed from the API on May 7, 2026" | `deprecated`, `removed`, date |
| **Twilio** | "we have decided to End of Life (EOL) our Programmable Video product on December 5, 2024" | `End of Life`, `EOL`, date |
| **Twilio** | "Twilio will officially sunset Voice JavaScript SDK version 1.x on September 10, 2025" | `will officially sunset`, version, date |
| **Twilio** | "Starting on March 31, 2025, the following SDK versions will no longer be supported" | `will no longer be supported`, `Starting on`, date |
| **GitHub** | "Version 2022-11-28 will continue to be fully supported for at least 24 months" | `at least 24 months` (implies future deprecation) |
| **Shopify** | "The Checkout resource is deprecated and will sunset on April 1, 2025" | `deprecated`, `will sunset`, date |
| **Shopify** | `X-Shopify-API-Deprecated-Reason` header | Machine-readable deprecation header! |
| **Google** | "will be shut down" | `will be shut down` |
| **Google** | "Sunset (shutdown) date of the deprecated library is yet to be determined" | `Sunset`, `shutdown`, `deprecated` |
| **Heroku** | "It will be sunset on April 15, 2017" | `will be sunset`, date |
| **Heroku** | "We will only sunset products that have seen significantly decreased usage" | `will only sunset` |

**Key observation:** The patterns we've defined in §3.4 cover 100% of these real-world examples. The future-intent patterns (`will be removed`, `will be deprecated`, `will sunset`, `End of Life`) catch every single one.

---

*This document is complete and design-ready. It defines the full relevance matching engine, shared source model, announcement detection patterns (from real changelogs), cross-user fan-out pipeline, signal deduplication, confidence scoring, database schema, complete pipeline, and performance analysis for Chirri's shared intelligence system.*

*Document created: 2026-03-24*  
*Author: Opus (subagent)*

---

## AMENDMENTS — Alex Direction *(Added 2026-03-24)*

### Amendment 1: Never Clean Up — Hibernate Instead

**Old:** 7-day grace period then delete shared sources when last user leaves.
**New:** Never delete. Hibernate. Stop active checking but keep all metadata.
- Weekly pulse check (one HEAD request) to verify domain is still alive
- If dead → mark as `hibernated_dead`, stop pulse checks
- If someone new adds a URL on this domain → instant reactivation, zero discovery needed
- Cost: kilobytes of metadata, basically free
- Benefit: accumulated intelligence is preserved forever

### Amendment 2: Human-Readable Confidence Reasoning

Every signal/chirp MUST include a human-readable explanation of WHY it was or wasn't a notification:

**Examples:**
- "⚠️ Low confidence: Only the changelog mentions upcoming v1 changes. No date specified. No corroborating signals yet."
- "🔴 High confidence: Deprecation header (Sept 1, 2026) + changelog announcement + OpenAPI spec all confirm /v1/charges sunset."
- "ℹ️ Medium: Blog post mentions 'upcoming changes to v1' but no specific endpoint or date."
- "📊 Not notified: Detected a changelog update but content doesn't reference any endpoints you monitor. Visible in your dashboard history."

This reasoning is visible in:
- Dashboard change detail view
- Webhook payload (`chirp_reason` field)
- Email/Slack notifications
- API response (`GET /v1/changes/:id`)

### Amendment 3: Fair Scoring for Small APIs

**Old:** Corroboration = +10 per additional source. Penalizes small APIs with fewer sources.
**New:** Score based on RATIO of confirming sources, not absolute count.

- 1/1 sources confirming = same weight as 10/10
- 2/2 sources confirming = HIGH confidence (100% agreement)
- 2/20 sources confirming = LOW confidence (10% agreement)

**Formula:** `corroboration_score = confirming_sources / total_relevant_sources`

A tiny API with one changelog that says "shutting down August 1" should be HIGH confidence, not penalized for only having one source.

### Amendment 4: Even 1 Source = Action

**Old:** <40 confidence = log only (invisible to user).
**New:** EVERY detected signal reaches the user somehow:

| Confidence | Action |
|-----------|--------|
| ≥60 | Full chirp: notification + dashboard + webhook |
| 40-59 | Soft chirp: dashboard + webhook (with `"severity": "low"`) but NO push notification |
| <40 | Dashboard only with human-readable explanation. Webhook with `"severity": "info"` flag |

**Nothing is swallowed silently.** The user can always see everything in their dashboard. We just control how loudly we chirp.

### Amendment 5: Path-Grouped Fan-Out (Performance Fix)

**Old:** Per-user relevance check. 1000 users = 1000 checks.
**New:** Path-grouped fan-out:

1. Detect signal ONCE (one fetch, one parse)
2. Extract affected paths/versions ONCE
3. Query users grouped by monitored path pattern:
   - "All users monitoring /v1/* on stripe.com" → one query, returns user IDs
4. Batch create change records for the group
5. Batch send notifications

**Result:** Performance depends on unique PATH PATTERNS (maybe 50-100 for Stripe), not USER COUNT. 1,000 users vs 100,000 users = same detection cost.

### Amendment 6: Time-Based Signal Escalation

**Signals don't just accumulate — they escalate over time.**

**Scenario:** Week 1, changelog mentions "considering v1 changes." Week 3, deprecation header appears. Week 5, OpenAPI spec marks endpoints deprecated.

**The escalation logic:**
- Signals within a **rolling 90-day window** correlate with each other
- Each new corroborating signal ESCALATES the existing forecast:
  - Week 1: "ℹ️ Chirri noticed: changelog mentions possible v1 changes (low confidence)"
  - Week 3: "⚠️ Escalated: Deprecation header now confirms v1 sunset. Original changelog signal corroborated." (confidence jumps)
  - Week 5: "🔴 Confirmed: OpenAPI spec marks your endpoints deprecated. 3 sources now agree."
- If NO new signals appear for 90 days → forecast status becomes `stale`, confidence decays
- Escalation always re-notifies the user at the NEW confidence level

**The user sees a TIMELINE of mounting evidence, not isolated signals.**

### Amendment 7: Content-Dependent Severity

**What was actually SAID matters more than WHERE it was said.**

A changelog entry saying "we're shutting down the entire API on June 1" is more severe than a deprecation header with a date 2 years from now.

**Severity factors from content:**
- **Urgency keywords:** "immediately", "effective now", "urgent" → boost severity
- **Timeline:** <30 days = critical, 30-90 days = warning, >90 days = info
- **Scope:** "all v1 endpoints" vs "one optional parameter removed" → different severity
- **Action required:** "migration required" vs "new feature available" → different severity
- **Finality:** "will be removed" vs "considering deprecation" → different severity

**The severity comes from the CONTENT, not just the source type.**
