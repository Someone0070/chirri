# CHIRRI — Unknown Solutions: Concrete Fixes for Every Blind Spot

**Author:** Opus (Solution Engineer)  
**Date:** 2026-03-24  
**Purpose:** For every unknown identified in CHIRRI_UNKNOWN_UNKNOWNS.md, a specific, implementable solution. No hand-waving.

---

## Table of Contents

1. [Technical Solutions (T-01 through T-10)](#1-technical-solutions)
2. [User Behavior Solutions (U-01 through U-07)](#2-user-behavior-solutions)
3. [Infrastructure Solutions (I-01 through I-06)](#3-infrastructure-solutions)
4. [Business & Legal Solutions (B-01 through B-05)](#4-business--legal-solutions)
5. [Competitive Solutions (C-01 through C-02)](#5-competitive-solutions)
6. [Edge Case Solutions (E-01 through E-08)](#6-edge-case-solutions)
7. [Operational Solutions (O-01 through O-05)](#7-operational-solutions)
8. [Compound Failure Solutions (CF-01 through CF-03)](#8-compound-failure-solutions)
9. [Prioritized Implementation Checklist](#9-prioritized-implementation-checklist)

---

## 1. Technical Solutions

---

### T-01: jsondiffpatch at Scale

**Problem:** jsondiffpatch uses O(n²) LCS for array diffing; 500-element arrays with many changes could freeze workers.

**Solution:** Use jsondiffpatch with a tiered strategy:
1. **Fast path (90% of checks):** fullHash match → skip diff entirely. Zero CPU cost.
2. **Normal path:** For responses <100KB, use jsondiffpatch as-is — benchmarks show it's the fastest npm diff library for typical payloads.
3. **Large response path (>100KB or arrays >100 elements):** Disable LCS array diffing. Use `objectHash` to match array items by ID field, falling back to positional comparison. Set a 500ms timeout on the diff operation via `AbortSignal.timeout(500)`.
4. **Huge response path (>1MB):** Hash-only comparison. No structural diff. Store the body for manual comparison in the dashboard.

**Libraries/tools:**
- `jsondiffpatch` (primary — fastest in benchmarks, 5.5K+ GitHub stars)
- `microdiff` (fallback for simple diffs — zero dependencies, 5x faster than deep-diff on large objects)
- Built-in `AbortSignal.timeout()` for diff timeout

**Code pattern:**
```typescript
async function computeDiff(baseline: any, current: any, bodySize: number): Promise<DiffResult> {
  // Fast path
  if (baselineHash === currentHash) return { changed: false };
  
  // Hash-only for large responses
  if (bodySize > 1_000_000) {
    return { changed: true, diffType: 'hash-only', diff: null };
  }
  
  // Configure jsondiffpatch based on response characteristics
  const maxArraySize = 100;
  const diffInstance = jsondiffpatch.create({
    arrays: {
      detectMove: bodySize < 100_000,
      includeValueOnMove: false,
    },
    objectHash: (obj: any) => obj.id || obj._id || obj.name || obj.slug || JSON.stringify(obj),
    textDiff: { minLength: bodySize < 50_000 ? 60 : Infinity }, // disable text diff for large payloads
  });
  
  // Timeout wrapper
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);
  try {
    const delta = diffInstance.diff(baseline, current);
    clearTimeout(timeout);
    return { changed: !!delta, diff: delta, diffType: 'structural' };
  } catch (e) {
    clearTimeout(timeout);
    // Fallback to hash-only on timeout or error
    return { changed: true, diffType: 'hash-only', diff: null };
  }
}
```

**Effort:** 4 hours  
**When:** Before launch — Week 2

---

### T-02: The 4.9MB Response Cliff (Memory Pressure)

**Problem:** Buffering full response bodies (up to 5MB) across 10 concurrent workers could OOM the container.

**Solution:** Stream responses. Never hold the full body in memory for large responses.

**Libraries/tools:**
- Node.js built-in `crypto.createHash('sha256')` (streaming hash)
- Node.js built-in `stream.pipeline()` 
- `@aws-sdk/lib-storage` for streaming uploads to R2

**Code pattern:**
```typescript
async function processResponse(response: Response, bodySize: number) {
  const hash = crypto.createHash('sha256');
  
  if (bodySize > 1_000_000) {
    // Stream directly: compute hash + upload to R2 simultaneously
    const [hashStream, r2Stream] = tee(response.body);
    
    const hashPromise = pipeline(hashStream, hash);
    const r2Promise = uploadStreamToR2(r2Stream, r2Key);
    
    await Promise.all([hashPromise, r2Promise]);
    return { hash: hash.digest('hex'), body: null }; // body NOT in memory
  }
  
  // Small responses: buffer is fine
  const body = await response.text();
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
  return { hash: bodyHash, body };
}
```

**Memory budget enforcement:**
```typescript
const WORKER_MEMORY_BUDGET = 200 * 1024 * 1024; // 200MB
let currentBuffered = 0;

// Before accepting a job:
if (currentBuffered + estimatedBodySize > WORKER_MEMORY_BUDGET) {
  // Re-queue the job with 1s delay
  throw new DelayedError(1000);
}
```

**Effort:** 6 hours  
**When:** Before launch — Week 2

---

### T-03: False Positive Rate Validation

**Problem:** The 0.1% FP rate claim is unvalidated; 50 URLs for 48 hours provides no statistical power.

**Solution:** Multi-pronged FP measurement and mitigation:

1. **Extended pre-launch test:** Monitor 200+ URLs across 30+ providers for 14 days minimum (not just 48 hours). Collect at least 50,000 checks before claiming any FP rate.

2. **Shadow mode for first 100 users:** Detect changes but suppress alerts for the first 48 hours per URL (beyond learning). Log what WOULD have been sent. After 48h, email user: "Here's what we detected in the last 2 days. Were any of these false positives?"

3. **FP rate as first-class metric:**
```typescript
// In /internal/metrics
{
  fp_rate_7d: (fp_reports / total_alerts_7d) * 100,
  fp_rate_by_type: {
    schema: 0.5,
    content: 2.1,
    header: 0.3,
    status_code: 0.0,
  },
  fp_rate_by_content_type: {
    'json-api': 0.8,
    'rss-feed': 0.1,
    'html': 3.2,
  }
}
```

4. **Automatic FP learning:** When 3+ users mark the same change as FP → auto-suppress for all users. Add the triggering field path to a global volatile list.

**Libraries/tools:** No external libraries needed — pure application logic.

**Effort:** 3 days (shadow mode) + ongoing monitoring  
**When:** Before launch — extend testing; first month — shadow mode

---

### T-04: Auto-Classification Accuracy

**Problem:** Most user URLs won't match hardcoded domain patterns; response-based classification may be wrong.

**Solution:** Accept that classification will be imperfect, and design for self-correction:

1. **Log every classification with confidence score.** Track which classifications lead to FP reports.

2. **User override is the escape valve.** Already planned via `PATCH /v1/urls/:id/monitoring`. Make this prominent in the dashboard.

3. **Classifier confidence warning:**
```typescript
if (classification.confidence < 70) {
  // Add to URL response:
  warnings: ["We're not fully confident about the monitoring strategy for this URL. If you see false positives, try switching to 'hash-only' mode in URL settings."]
}
```

4. **Post-launch data pipeline:** After 30 days, analyze which content_type + monitoring_method combinations have the lowest FP rate. Update the classification weights.

5. **Smart fallback hierarchy:**
   - `json-api` → json-diff (structural)
   - `rss-feed` → feed-poll (item comparison)
   - `openapi-spec` → spec-diff
   - `html` → content-hash (NOT structural — HTML is too volatile)
   - `unknown` → content-hash with learning period

**Libraries/tools:** No additional libraries.

**Effort:** 2 hours (confidence warning) + ongoing analysis  
**When:** Before launch — confidence warning; first month — analyze data

---

### T-05: Connection Pooling with undici

**Problem:** Shared connection pools to frequently-monitored domains may go stale, causing false ECONNRESET errors.

**Solution:** Don't pool connections for monitoring checks. Use a fresh connection per check.

```typescript
import { request } from 'undici';

async function makeCheck(url: string, options: CheckOptions) {
  const response = await request(url, {
    method: options.method,
    headers: options.headers,
    // Fresh connection every time — no pooling
    reset: true,  // undici: close connection after response
    headersTimeout: 10_000,
    bodyTimeout: 30_000,
    throwOnError: false,
  });
  return response;
}
```

The per-domain rate limit (1 req/sec) means we're not making enough requests to benefit from pooling anyway. The 50-200ms connection overhead is negligible at this rate.

**Monitor ECONNRESET:** Track per-domain error rates. If a domain's ECONNRESET rate exceeds 10%, investigate.

**Libraries/tools:** `undici` (already chosen)

**Effort:** 1 hour  
**When:** Before launch — Week 2

---

### T-06: Postgres Partitioning on Railway

**Problem:** Railway's managed Postgres may not have pg_partman extension.

**Solution:** Use Postgres native partitioning (no extension needed). Available since PostgreSQL 10.

```sql
-- Create the partitioned table (no extension required)
CREATE TABLE check_results (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    shared_url_id UUID NOT NULL,
    status_code INT,
    response_time_ms INT,
    error TEXT,
    full_hash TEXT,
    stable_hash TEXT,
    schema_hash TEXT,
    header_hash TEXT,
    body_r2_key TEXT,
    body_size_bytes INT,
    change_detected BOOLEAN NOT NULL DEFAULT FALSE,
    change_id UUID,
    is_learning BOOLEAN NOT NULL DEFAULT FALSE,
    is_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
    worker_id TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (checked_at);

-- Create partitions (one per month, create 3 months ahead)
CREATE TABLE check_results_2026_03 PARTITION OF check_results
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE check_results_2026_04 PARTITION OF check_results
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE check_results_2026_05 PARTITION OF check_results
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE check_results_2026_06 PARTITION OF check_results
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

**Automated partition management (scheduler cron, runs monthly):**
```typescript
async function managePartitions(db: Pool) {
  const now = new Date();
  
  // Create partition 3 months ahead
  const futureMonth = addMonths(now, 3);
  const partName = `check_results_${format(futureMonth, 'yyyy_MM')}`;
  const rangeStart = startOfMonth(futureMonth).toISOString();
  const rangeEnd = startOfMonth(addMonths(futureMonth, 1)).toISOString();
  
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${partName} PARTITION OF check_results
    FOR VALUES FROM ('${rangeStart}') TO ('${rangeEnd}')
  `);
  
  // Drop partitions older than retention (per plan, use the maximum: 365 days)
  const dropBefore = subMonths(now, 13); // 13 months safety margin
  const dropPartName = `check_results_${format(dropBefore, 'yyyy_MM')}`;
  await db.query(`DROP TABLE IF EXISTS ${dropPartName}`);
}
```

**Effort:** 3 hours  
**When:** Before launch — Week 1

---

### T-07: BullMQ Redis Memory Management

**Problem:** BullMQ stores all job data in Redis; uncontrolled growth leads to OOM and total monitoring failure.

**Solution:** Aggressive job cleanup + memory monitoring + circuit breaker.

**Redis configuration (set via `CONFIG SET` at application startup):**
```typescript
async function configureRedis(redis: Redis) {
  // CRITICAL: noeviction prevents silent data loss
  await redis.config('SET', 'maxmemory-policy', 'noeviction');
  
  // Set maxmemory based on Railway plan (default ~256MB for $3/mo)
  // BullMQ needs ~100MB for 5000 URLs; set to 200MB to leave headroom
  await redis.config('SET', 'maxmemory', '200mb');
}
```

**BullMQ job retention settings:**
```typescript
const defaultJobOptions = {
  removeOnComplete: {
    age: 3600,    // 1 hour max
    count: 100,   // keep last 100 per queue
  },
  removeOnFail: {
    age: 86400,   // 24 hours, then auto-delete
    count: 500,   // keep last 500 failures for debugging
  },
};
```

**Memory monitoring (runs every 5 minutes via scheduler):**
```typescript
async function checkRedisMemory(redis: Redis) {
  const info = await redis.info('memory');
  const usedMemory = parseRedisInfo(info, 'used_memory');
  const maxMemory = parseRedisInfo(info, 'maxmemory');
  const usagePercent = (usedMemory / maxMemory) * 100;
  
  if (usagePercent > 80) {
    // Alert ops via Telegram
    await alertOps(`⚠️ Redis memory at ${usagePercent.toFixed(1)}% (${formatBytes(usedMemory)}/${formatBytes(maxMemory)})`);
  }
  
  if (usagePercent > 90) {
    // Emergency: purge completed jobs aggressively
    await purgeCompletedJobs(redis);
    await alertOps(`🚨 Redis memory CRITICAL at ${usagePercent.toFixed(1)}%. Purged completed jobs.`);
  }
}
```

**Circuit breaker for scheduler:**
```typescript
async function enqueueCheck(queue: Queue, job: CheckJob) {
  const queueDepth = await queue.getWaitingCount() + await queue.getActiveCount();
  
  if (queueDepth > 5000) {
    logger.warn({ queueDepth }, 'Queue depth exceeded threshold, skipping enqueue');
    return; // Don't enqueue — the queue is backed up
  }
  
  await queue.add('check', job, defaultJobOptions);
}
```

**Recovery after Redis OOM:**
- When Redis recovers (OOM clears), BullMQ reconnects automatically via ioredis retry.
- The scheduler's "missed-check recovery" on every minute scan catches URLs that were missed during the OOM window.
- Queued jobs that were in progress during OOM are marked as stalled and retried.

**Libraries/tools:** `bullmq`, `ioredis` (already in stack)

**Effort:** 4 hours  
**When:** Before launch — Week 1

---

### T-08: IP Flagging / Bot Detection

**Problem:** All checks from Railway's shared/static IPs; target APIs may rate-limit or block, causing mass false positives.

**Solution:** Multi-layer defense:

**1. Never treat 429/bot-protection as "changes":**
```typescript
const TRANSIENT_STATUS_CODES = [429, 503, 502, 504];
const CLOUDFLARE_MARKERS = ['<title>Just a moment...</title>', 'cf-browser-verification', 'Checking your browser'];

function classifyResponse(statusCode: number, body: string): CheckResult {
  if (TRANSIENT_STATUS_CODES.includes(statusCode)) {
    return { type: 'transient_error', alertUsers: false };
  }
  
  if (CLOUDFLARE_MARKERS.some(marker => body.includes(marker))) {
    return { type: 'bot_detection', alertUsers: false };
  }
  
  // Check for common error JSON patterns
  try {
    const json = JSON.parse(body);
    if (json.error === 'rate_limited' || json.error === 'too_many_requests') {
      return { type: 'rate_limited', alertUsers: false };
    }
  } catch {}
  
  return { type: 'normal', alertUsers: true };
}
```

**2. Transparent User-Agent:**
```
Chirri-Monitor/1.0 (+https://chirri.io/bot; API change monitoring service)
```
Format follows web standards: product/version, info URL, description. The info URL (`chirri.io/bot`) should explain what Chirri does and how to request exclusion.

**3. Railway now supports static outbound IPs!** (Found in research)
- Navigate to Service → Settings → Networking → "Enable Static IPs"
- This gives a dedicated IPv4 per region, tied to the service
- No proxy needed unless IP gets blocked

**4. Proactive provider outreach template:**
```
Subject: Chirri API Monitoring Service — IP Whitelist Request

Hi [DevRel/API Team],

We run Chirri (chirri.io), an API change monitoring service. Our users 
monitor your public API endpoints to detect breaking changes.

Our monitoring agent:
- User-Agent: Chirri-Monitor/1.0
- Static IP: [IP from Railway]
- Rate: ≤1 request/minute per endpoint
- Only reads public endpoints (no auth, no write operations)

Could you whitelist our IP/User-Agent? Happy to discuss.
```

**5. If a provider blocks us:** Detect via sustained error rates (>80% failure for a domain over 1 hour) → pause monitoring for that domain → email affected users: "We're unable to monitor [domain] right now. The provider may be blocking automated requests."

**Libraries/tools:** No additional libraries.

**Effort:** 4 hours (detection logic) + ongoing (provider outreach)  
**When:** Before launch — Week 2 (detection); first month (outreach)

---

### T-09: Learning Period Blind Spot

**Problem:** Breaking changes during the 10-minute learning period are silently baked into the baseline.

**Solution:** Track intra-learning variance and flag significant mid-learning changes.

```typescript
async function processLearningSample(sample: LearningSample, allSamples: LearningSample[]) {
  if (allSamples.length < 3) return; // Need minimum samples
  
  // Compare this sample's schema to the FIRST sample's schema
  const firstSchema = allSamples[0].schema_snapshot;
  const currentSchema = sample.schema_snapshot;
  
  if (schemaHash(firstSchema) !== schemaHash(currentSchema)) {
    // Schema changed DURING learning — flag it
    await db.query(`
      UPDATE urls SET status_reason = 'Schema change detected during learning. Review recommended.'
      WHERE shared_url_id = $1
    `, [sample.shared_url_id]);
    
    // Show warning in dashboard
    // But DON'T use the first sample as baseline — use the LATEST consistent run
    // Find the longest consistent streak from the end
    const consistentSamples = findLongestConsistentStreak(allSamples);
    // Use those for baseline
  }
}
```

**Additional safeguard:** Store full learning history in `learning_samples` table (already planned). Users can review what happened during learning via a "Learning History" section on the URL detail page.

**Force-alert option:** Add a per-URL setting `alert_during_learning: boolean` (default false). Power users can opt in to receiving alerts even during learning.

**Effort:** 3 hours  
**When:** Before launch — Week 2-3

---

### T-10: Shared Monitoring Key Collision

**Problem:** Header casing differences (`Accept` vs `accept`) cause duplicate monitors.

**Solution:** Normalize everything before computing the shared URL key.

```typescript
import normalizeUrl from 'normalize-url';

function computeSharedKey(url: string, method: string, headers: Record<string, string>): string {
  // 1. Normalize URL
  const normalizedUrl = normalizeUrl(url, {
    stripHash: true,              // remove fragments
    stripWWW: true,               // www.example.com → example.com
    removeTrailingSlash: true,    // /path/ → /path
    removeQueryParameters: false, // keep query params
    sortQueryParameters: true,    // ?b=2&a=1 → ?a=1&b=2
    normalizeProtocol: true,      // HTTP → https (lowercase)
    removeSingleSlash: false,     // keep root path
    removeExplicitPort: true,     // :443 on HTTPS, :80 on HTTP removed
  });
  
  // 2. Normalize headers: lowercase keys, trim values, sort
  const normalizedHeaders = Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase().trim(), v.trim()])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join('\n');
  
  // 3. Compute key
  const keyInput = `${method.toUpperCase()}|${normalizedUrl}|${normalizedHeaders}`;
  return crypto.createHash('sha256').update(keyInput).digest('hex');
}
```

**Libraries/tools:**
- `normalize-url` (npm: 19M+ weekly downloads, by sindresorhus) — handles all URL normalization edge cases
- Built-in `crypto` for SHA-256

**Effort:** 2 hours  
**When:** Before launch — Week 2

---

## 2. User Behavior Solutions

---

### U-01: Same URL with Trivial Variations

**Problem:** Users waste quota on duplicate URLs with trivial differences (trailing slash, http vs https).

**Solution:** Use `normalize-url` (same as T-10) to normalize URLs before the `url_hash` uniqueness check.

```typescript
async function addUrl(userId: string, rawUrl: string) {
  const normalizedUrl = normalizeUrl(rawUrl, {
    stripHash: true,
    stripWWW: true,
    removeTrailingSlash: true,
    sortQueryParameters: true,
    removeExplicitPort: true,
    forceHttps: false, // preserve user's protocol choice
  });
  
  const urlHash = crypto.createHash('sha256').update(normalizedUrl).digest('hex');
  
  // Check for existing
  const existing = await db.query(
    'SELECT id, url FROM urls WHERE user_id = $1 AND url_hash = $2',
    [userId, urlHash]
  );
  
  if (existing.rows.length > 0) {
    throw new ApiError(409, 'duplicate_url', 
      `You're already monitoring this URL (${existing.rows[0].id}). ` +
      `Minor variations like trailing slashes and www are normalized.`
    );
  }
  
  // Store normalized URL
  return db.query('INSERT INTO urls ...', [normalizedUrl, urlHash, ...]);
}
```

**Libraries/tools:** `normalize-url` (already needed for T-10)

**Effort:** 1 hour (integrated with T-10)  
**When:** Before launch — Week 2

---

### U-02: URLs That Change Every Request

**Problem:** Numeric fields that drift slightly (uptime: 99.997 → 99.996) may trigger constant low-confidence alerts.

**Solution:** Numeric proximity detection during volatile field analysis.

```typescript
function isVolatileNumeric(values: number[]): boolean {
  if (values.length < 5) return false;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const maxDeviation = Math.max(...values.map(v => Math.abs(v - mean)));
  const deviationPercent = (maxDeviation / Math.abs(mean)) * 100;
  
  // If the field changes by <1% across samples, it's a slowly drifting number
  // Mark as volatile
  return deviationPercent < 1;
}

// In stableHash computation: exclude volatile numeric fields
function computeStableHash(body: any, volatileFields: string[]): string {
  const filtered = deepClone(body);
  for (const path of volatileFields) {
    unset(filtered, path);
  }
  return crypto.createHash('sha256').update(JSON.stringify(filtered)).digest('hex');
}
```

**Add per-URL "numeric tolerance" setting:**
```typescript
// PATCH /v1/urls/:id
{ numeric_tolerance_percent: 1 } // ignore numeric changes under 1%
```

**Libraries/tools:** No additional libraries.

**Effort:** 3 hours  
**When:** First month — observe real usage patterns

---

### U-03: User Monitors a Login Page

**Problem:** Users paste dashboard/login URLs expecting API monitoring; get constant noise from HTML dynamic content.

**Solution:** Smart rejection/redirection during URL creation.

```typescript
const LOGIN_INDICATORS = [
  '<form', 'type="password"', 'csrf', 'login', 'sign-in', 'signin',
  '<input type="hidden"', 'captcha', 'recaptcha'
];

const SPA_INDICATORS = [
  '<div id="root">', '<div id="app">', 'window.__NEXT_DATA__',
  'bundle.js', 'main.js', '<noscript>'
];

async function classifyUrl(url: string, response: Response): Promise<Classification> {
  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';
  
  if (contentType.includes('text/html')) {
    const isLogin = LOGIN_INDICATORS.some(i => body.toLowerCase().includes(i.toLowerCase()));
    const isSPA = SPA_INDICATORS.some(i => body.includes(i));
    
    if (isLogin) {
      return {
        type: 'html-login',
        confidence: 90,
        warning: "This looks like a login page, not an API endpoint. " +
                 "For API monitoring, use the actual API URL (e.g., api.stripe.com/v1/prices). " +
                 "You can still monitor this page with hash-based detection.",
        suggestedAlternative: guessApiUrl(url), // e.g., dashboard.stripe.com → api.stripe.com
      };
    }
    
    if (isSPA) {
      return {
        type: 'html-spa',
        confidence: 80,
        warning: "This appears to be a single-page application. " +
                 "Dynamic content will change frequently. Hash-only monitoring recommended.",
        monitoring_method: 'content-hash',
      };
    }
  }
  
  // ... normal classification
}
```

**Libraries/tools:** No additional libraries.

**Effort:** 3 hours  
**When:** Before launch — Week 3

---

### U-04: 500 URLs Added in One Minute

**Problem:** Bulk URL creation floods the learning queue, overwhelming workers.

**Solution:** Rate-limit creation + stagger learning.

```typescript
// Rate limit: max 10 URLs per minute, max 50 per hour
const URL_CREATION_LIMITS = {
  perMinute: 10,
  perHour: 50,
};

// Stagger learning: max 5 URLs in learning simultaneously per account
const MAX_CONCURRENT_LEARNING = 5;

async function addUrl(userId: string, input: UrlInput) {
  // Check rate limits
  const recentCount = await db.query(
    'SELECT COUNT(*) FROM urls WHERE user_id = $1 AND created_at > now() - interval \'1 minute\'',
    [userId]
  );
  if (recentCount.rows[0].count >= URL_CREATION_LIMITS.perMinute) {
    throw new ApiError(429, 'creation_rate_limited', 
      'Max 10 URLs per minute. Try again shortly.');
  }
  
  // Check concurrent learning limit
  const learningCount = await db.query(
    'SELECT COUNT(*) FROM urls WHERE user_id = $1 AND status = \'learning\'',
    [userId]
  );
  
  // Create the URL but queue learning start
  const url = await createUrl(userId, input);
  
  if (learningCount.rows[0].count >= MAX_CONCURRENT_LEARNING) {
    // Don't start learning immediately — queue it
    url.status = 'pending_learning';
    url.status_reason = 'Waiting for other URLs to finish learning. Will start automatically.';
  }
  
  return url;
}

// Scheduler: promote pending_learning → learning when slots free up
async function promotePendingLearning() {
  const pendingByUser = await db.query(`
    SELECT user_id, id FROM urls 
    WHERE status = 'pending_learning'
    ORDER BY created_at ASC
    LIMIT 50
  `);
  
  for (const [userId, urls] of groupBy(pendingByUser.rows, 'user_id')) {
    const currentLearning = await countLearning(userId);
    const slotsAvailable = MAX_CONCURRENT_LEARNING - currentLearning;
    
    for (const url of urls.slice(0, slotsAvailable)) {
      await startLearning(url.id);
    }
  }
}
```

**Libraries/tools:** No additional libraries.

**Effort:** 4 hours  
**When:** Before launch — Week 3

---

### U-05: Alert Fatigue vs. "Is This Thing Working?"

**Problem:** Two opposite failure modes: too many alerts → fatigue → missed critical changes; zero alerts → "is it working?" → churn.

**Solution (Alert Fatigue):**

1. **Default to `breaking` and `critical` only.** Users opt in to `warning` and `info`.

2. **Daily digest option:**
```typescript
// notification_config.digest_mode = 'daily'
// Collect non-critical changes, send one email at 09:00 user's timezone
async function sendDailyDigest(userId: string) {
  const changes = await db.query(`
    SELECT c.* FROM user_changes uc
    JOIN changes c ON uc.change_id = c.id
    WHERE uc.user_id = $1 AND uc.notified = FALSE
    AND c.severity NOT IN ('critical', 'breaking')
    AND c.detected_at > now() - interval '24 hours'
  `, [userId]);
  
  if (changes.rows.length === 0) return;
  
  await sendDigestEmail(userId, changes.rows);
  await markAsNotified(changes.rows.map(c => c.id), userId);
}
```

3. **Snooze per URL:** `PATCH /v1/urls/:id { snoozed_until: '2026-03-25T12:00:00Z' }`

**Solution ("Is it Working?"):**

1. **Weekly stability report** (already planned — ensure it ships at MVP)
2. **Dashboard "pulse" indicator:** "✅ System healthy. Last check: 2 min ago. Next: in 58 min."
3. **Monthly summary email:** "This month, Chirri ran 8,642 checks on your 12 URLs. 2 changes detected. Everything's stable."

**Libraries/tools:** No additional libraries.

**Effort:** 8 hours (daily digest + snooze)  
**When:** First month — daily digest; MVP — weekly report + pulse indicator

---

### U-06: International Users — Timezone & Encoding

**Problem:** DST-aware quiet hours, non-UTF-8 responses, and IDN domains need special handling.

**Solution:**

**Timezone (quiet hours):**
```typescript
import { DateTime } from 'luxon';

function isInQuietHours(userTimezone: string, quietStart: string, quietEnd: string): boolean {
  const now = DateTime.now().setZone(userTimezone);
  const start = now.set({ hour: parseInt(quietStart.split(':')[0]), minute: parseInt(quietStart.split(':')[1]) });
  const end = now.set({ hour: parseInt(quietEnd.split(':')[0]), minute: parseInt(quietEnd.split(':')[1]) });
  
  // Handle overnight quiet hours (23:00 → 08:00)
  if (start > end) {
    return now >= start || now <= end;
  }
  return now >= start && now <= end;
}
```

**Encoding detection and conversion:**
```typescript
import iconv from 'iconv-lite';

function decodeResponseBody(buffer: Buffer, contentType: string): string {
  // Extract charset from Content-Type header
  const charsetMatch = contentType.match(/charset=([^\s;]+)/i);
  const charset = charsetMatch ? charsetMatch[1].toLowerCase() : 'utf-8';
  
  if (charset === 'utf-8' || charset === 'utf8') {
    return buffer.toString('utf-8');
  }
  
  // Convert non-UTF-8 to UTF-8
  if (iconv.encodingExists(charset)) {
    return iconv.decode(buffer, charset);
  }
  
  // Fallback: try UTF-8 anyway
  return buffer.toString('utf-8');
}
```

**IDN domains:** Node.js `new URL()` handles punycode automatically. Verify in SSRF checks:
```typescript
const url = new URL('https://日本語.jp/api');
// url.hostname → 'xn--wgv71a309e.jp' (punycode)
// SSRF check runs against the punycode hostname
```

**Libraries/tools:**
- `luxon` (npm: timezone-safe date handling, 21M+ weekly downloads)
- `iconv-lite` (npm: encoding conversion, 39M+ weekly downloads)

**Effort:** 4 hours  
**When:** Before launch — basic encoding; first month — timezone edge cases

---

### U-07: Teams and Access Control

**Problem:** Pricing promises team seats but there's no teams implementation.

**Solution:** **Remove team seat claims from pricing page before launch.** MVP is single-user only.

The unknowns doc already has this right: don't sell what you haven't built. Update the pricing page:
- Free: 1 user
- Indie: 1 user
- (No team language whatsoever)

**V1.1 (weeks 9-12):** Basic teams:
```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (team_id, user_id)
);
```

**Effort:** 30 minutes (remove claims) + 2 weeks (V1.1 teams)  
**When:** Before launch — remove claims; V1.1 — basic teams

---

## 3. Infrastructure Solutions

---

### I-01: Railway Cold Starts and Worker Recovery

**Problem:** During deploys, SIGTERM → SIGKILL gap causes brief monitoring blackouts.

**Solution:** 

**1. Set Railway graceful shutdown timeout:**
Railway's default is **0 seconds** for graceful shutdown (discovered in research). Set `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` or configure via Settings → Deploy → Drain Timeout.

```
# Set via Railway environment variable
RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30
```

This gives BullMQ workers 30 seconds to complete in-flight jobs before SIGKILL.

**2. BullMQ graceful shutdown handler:**
```typescript
async function handleShutdown(signal: string) {
  logger.info(`Received ${signal}, draining workers...`);
  
  // Stop accepting new jobs
  await Promise.all(workers.map(w => w.close()));
  
  // Close connections
  await db.end();
  await redis.quit();
  
  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
```

**3. Stalled job recovery:** Set `stalledInterval: 15000` (15s, down from default 30s).

**4. With `numReplicas: 2` for workers:** Railway does rolling deploys — one instance restarts at a time. Verify this in testing.

**Libraries/tools:** No additional libraries.

**Effort:** 2 hours  
**When:** Before launch — Week 5

---

### I-02: Railway Postgres IOPS Limits

**Problem:** High write volume to `check_results` may exceed Railway's undocumented IOPS limits.

**Solution:** Reduce write volume + batch writes.

**1. Conditional writes — only write check_results when something interesting happens:**
```typescript
async function recordCheckResult(result: CheckResult) {
  // Always update urls.last_check_at (lightweight)
  await db.query(
    'UPDATE urls SET last_check_at = now() WHERE shared_url_id = $1',
    [result.shared_url_id]
  );
  
  // Only write to check_results if:
  // - Change detected
  // - Error occurred
  // - It's been >1 hour since last recorded result (periodic snapshot)
  // - It's a learning/confirmation check
  const shouldRecord = result.change_detected 
    || result.error 
    || result.is_learning 
    || result.is_confirmation
    || (result.check_number % 10 === 0); // Every 10th stable check
  
  if (shouldRecord) {
    await db.query('INSERT INTO check_results ...', [/* ... */]);
  }
}
```

This reduces write volume by ~90% for stable URLs (most checks show no change).

**2. Batch inserts for learning samples:**
```typescript
// Instead of 30 individual INSERTs during learning, batch them
const VALUES_PLACEHOLDER = learningResults
  .map((_, i) => `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}, $${i*5+5})`)
  .join(', ');

await db.query(`
  INSERT INTO learning_samples (shared_url_id, status_code, body_hash, schema_snapshot, sampled_at)
  VALUES ${VALUES_PLACEHOLDER}
`, learningResults.flatMap(r => [r.shared_url_id, r.status_code, r.body_hash, r.schema_snapshot, r.sampled_at]));
```

**3. Use Railway Pro plan for Postgres:** $20/mo gives better resource guarantees. Budget is $42/mo total; this adds $13 but prevents a scaling wall.

**Libraries/tools:** No additional libraries.

**Effort:** 4 hours  
**When:** Before launch — Week 2

---

### I-03: Railway Egress and IP Assignment

**Problem:** Railway's shared IPs may be blocked by target APIs.

**Solution:** Railway now supports static outbound IPs natively!

**Setup:**
1. Go to check-worker service → Settings → Networking
2. Enable "Static IPs"
3. Note the assigned IPv4 address
4. Use this IP in provider outreach emails (see T-08)

**If the static IP gets blocked by a specific provider:**
1. Detect via sustained failure rate for that domain
2. Option A: Contact the provider to whitelist (first choice)
3. Option B: Route checks for that specific domain through a proxy service
4. Use QuotaGuard ($19/mo) as a backup proxy — set `HTTP_PROXY` only for blocked domains

```typescript
async function makeCheck(url: string, options: CheckOptions) {
  const domain = new URL(url).hostname;
  const isBlocked = await isdomainBlocked(domain); // check a Redis set
  
  const fetchOptions: RequestInit = { ...options };
  if (isBlocked) {
    // Route through proxy
    fetchOptions.dispatcher = new ProxyAgent(process.env.QUOTAGUARD_URL);
  }
  
  return fetch(url, fetchOptions);
}
```

**Libraries/tools:**
- `undici` ProxyAgent (built-in)
- QuotaGuard ($19/mo backup plan — only activate if needed)

**Effort:** 1 hour (enable static IPs) + 2 hours (proxy fallback logic)  
**When:** Before launch — Week 1 (static IPs); first month (proxy if needed)

---

### I-04: Deploy Without Missing Checks

**Problem:** Deploying restarts all instances of a service; brief monitoring gap during deploy.

**Solution:** Ordered deploy strategy + missed-check recovery.

**Deploy procedure (manual checklist, later automate):**
```
1. Deploy check-workers FIRST
   - With numReplicas: 2, Railway does rolling restart
   - One worker processes jobs while the other restarts
   - Wait for health check green (both instances)

2. Deploy scheduler SECOND
   - Single instance: ~30s gap in scheduling
   - The 1-minute cron interval means at most 1 cycle is missed
   - Missed-check recovery runs on startup → catches the gap

3. Deploy API server LAST
   - Single instance: ~10-30s downtime
   - Cloudflare caches recent responses (short TTL: 30s)
   - Users see stale data briefly, not errors

4. NEVER deploy during 00:00-02:00 UTC (peak for US West)
   - Prefer 05:00-07:00 UTC (low traffic worldwide)
```

**Missed-check recovery (runs on scheduler startup + every 5 minutes):**
```typescript
async function recoverMissedChecks() {
  const missedUrls = await db.query(`
    SELECT su.* FROM shared_urls su
    WHERE su.next_check_at < now() - interval '2 minutes'
    AND su.next_check_at IS NOT NULL
    LIMIT 100
  `);
  
  for (const url of missedUrls.rows) {
    await urlCheckQueue.add('check', { shared_url_id: url.id, ... }, {
      priority: 1, // High priority for catch-up
    });
    
    // Reschedule next check
    await db.query(
      'UPDATE shared_urls SET next_check_at = $1 WHERE id = $2',
      [nextCheckTime(url.effective_interval, new Date()), url.id]
    );
  }
  
  if (missedUrls.rows.length > 0) {
    logger.info({ count: missedUrls.rows.length }, 'Recovered missed checks');
  }
}
```

**Libraries/tools:** No additional libraries.

**Effort:** 3 hours  
**When:** Before launch — Week 5

---

### I-05: Redis Persistence and Data Loss

**Problem:** Railway Redis persistence settings are undocumented; data loss during restart could lose jobs.

**Solution:** Design for Redis ephemerality — treat it as a queue/cache, not a database.

**Principle:** All critical state lives in Postgres. Redis is only for job queuing and rate limiting.

**Implementation:**
```typescript
// 1. Write to Postgres BEFORE acknowledging the BullMQ job
async function processCheckJob(job: Job<CheckJob>) {
  const result = await performCheck(job.data);
  
  // Write to Postgres FIRST
  await db.query('INSERT INTO check_results ...', [result]);
  
  if (result.changeDetected) {
    // Create change in Postgres
    const change = await db.query('INSERT INTO changes ...', [result]);
    
    // Store confirmation state in Postgres, not just Redis
    await db.query(
      'UPDATE changes SET confirmation_status = $1 WHERE id = $2',
      ['pending', change.rows[0].id]
    );
    
    // THEN enqueue confirmation check (Redis job is a trigger, not state)
    await confirmationQueue.add('confirm', { change_id: change.rows[0].id }, {
      delay: 5000, // 5s
    });
  }
  
  // BullMQ marks job complete AFTER Postgres write
  // If Redis loses this job's completion status, it may re-process
  // → check for idempotency (see below)
}

// 2. Idempotency guard for check results
async function isAlreadyChecked(sharedUrlId: string, windowMinutes: number): boolean {
  const result = await db.query(
    'SELECT 1 FROM check_results WHERE shared_url_id = $1 AND checked_at > now() - $2::interval LIMIT 1',
    [sharedUrlId, `${windowMinutes} minutes`]
  );
  return result.rows.length > 0;
}
```

**3. On scheduler startup: reconcile against Postgres, not Redis:**
```typescript
// Don't trust Redis for "what needs to be checked"
// Always consult shared_urls.next_check_at in Postgres
async function scheduleChecks() {
  const dueUrls = await db.query(`
    SELECT * FROM shared_urls 
    WHERE next_check_at <= now()
    ORDER BY next_check_at ASC
    LIMIT 500
    FOR UPDATE SKIP LOCKED
  `);
  // Enqueue to Redis
}
```

**4. Confirmation recovery on startup:**
```typescript
// Find changes stuck in 'pending' confirmation that don't have active Redis jobs
async function recoverPendingConfirmations() {
  const pending = await db.query(`
    SELECT * FROM changes 
    WHERE confirmation_status = 'pending'
    AND detected_at < now() - interval '1 minute'
  `);
  
  for (const change of pending.rows) {
    await confirmationQueue.add('confirm', { change_id: change.id }, {
      delay: 0, // Immediately
    });
  }
}
```

**Libraries/tools:** No additional libraries.

**Effort:** 4 hours  
**When:** Before launch — Week 2

---

### I-06: Cloudflare R2 Latency and Availability

**Problem:** If R2 is slow/down, check pipeline grinds to a halt.

**Solution:** Make R2 writes async and non-blocking with circuit breaker.

```typescript
import CircuitBreaker from 'opossum';

// Circuit breaker for R2
const r2Breaker = new CircuitBreaker(uploadToR2, {
  timeout: 5000,       // 5s timeout per write
  errorThresholdPercentage: 50,  // open circuit after 50% failure
  resetTimeout: 300000,  // try again after 5 minutes
  volumeThreshold: 5,   // minimum 5 calls before evaluating
});

r2Breaker.on('open', () => {
  logger.error('R2 circuit breaker OPEN — falling back to Postgres-only storage');
  alertOps('🚨 R2 circuit breaker opened. Snapshots stored in Postgres only.');
});

async function storeSnapshot(body: string, r2Key: string): Promise<string | null> {
  // Small responses: store directly in Postgres JSONB (no R2 needed)
  if (body.length < 10_000) { // <10KB
    return null; // Signal to store in check_results.body_inline column
  }
  
  // Try R2 (non-blocking, with circuit breaker)
  try {
    await r2Breaker.fire(body, r2Key);
    return r2Key;
  } catch (e) {
    // R2 failed — not a disaster
    logger.warn({ r2Key, error: e.message }, 'R2 write failed, will retry later');
    
    // Queue for retry
    await maintenanceQueue.add('r2-retry', { body_hash: hash(body), r2Key }, {
      delay: 60000, // Retry in 1 minute
      attempts: 5,
    });
    
    return null; // Store hash-only in check_results for now
  }
}

// Main check flow: R2 is fire-and-forget
async function processCheck(job: Job) {
  const response = await fetchUrl(job.data);
  const body = await response.text();
  
  // Compute hashes and detect changes synchronously
  const result = await detectChanges(body, job.data);
  
  // Write to Postgres (critical path)
  await saveCheckResult(result);
  
  // Store to R2 (non-critical, async)
  storeSnapshot(body, generateR2Key(job.data))
    .catch(e => logger.error({ error: e }, 'Background R2 write failed'));
  
  // Return — job complete even if R2 hasn't finished
}
```

**R2 SLA:** Cloudflare R2 has a 99.9% uptime SLA (enterprise) — ~8.7h downtime/year. For non-enterprise, no formal SLA but similar reliability in practice.

**Libraries/tools:**
- `opossum` (npm: circuit breaker, 5K+ stars, Netflix Hystrix-inspired)
- `@aws-sdk/client-s3` (for R2, already planned)

**Effort:** 4 hours  
**When:** Before launch — Week 2

---

## 4. Business & Legal Solutions

---

### B-01: Terms of Service Violations

**Problem:** Monitoring APIs may violate their ToS; legal risk if Chirri becomes prominent.

**Solution:**

1. **Focus on public endpoints:** Status pages, changelogs, OpenAPI specs, RSS feeds. These are explicitly published for consumption.

2. **Respectful behavior (already designed):** max 1 req/min per endpoint, transparent User-Agent, low impact.

3. **chirri.io/bot info page:**
```markdown
# Chirri Monitoring Bot

Chirri (chirri.io) is an API change monitoring service.

## What we do
- Monitor publicly accessible API endpoints
- Check at most once per minute per endpoint
- Only make GET requests (no writes)
- Respect robots.txt for HTML pages

## Our bot
- User-Agent: Chirri-Monitor/1.0 (+https://chirri.io/bot)
- Static IP: [listed here]
- Contact: bot@chirri.io

## Want us to stop?
Email bot@chirri.io with your domain and we'll add it to our exclusion list.
```

4. **chirri.io/tos clause:** "Users are responsible for ensuring they have the legal right to monitor the URLs they add to Chirri. Chirri makes requests to URLs on behalf of its users."

5. **Budget $1-2K for legal review** of top 20 API providers' ToS before launch.

6. **Domain exclusion list:** If a provider requests exclusion, add their domain immediately. No legal fight.

**Effort:** 2 hours (bot page + ToS clause) + $1-2K (legal review)  
**When:** Before launch — Week 5

---

### B-02: GDPR Data Processor Implications

**Problem:** Stored API response snapshots may contain PII, making Chirri a data processor.

**Solution (MVP — public endpoints only):**

1. **Privacy policy states:** "Chirri stores response data from the URLs you monitor. Do not monitor endpoints that return personally identifiable information unless you understand the GDPR implications."

2. **Data export:** `GET /v1/account/export` (already planned) — satisfies right of access.

3. **Data deletion:** `deleteUserData(userId)` function (see O-04) — satisfies right to erasure.

4. **30-day soft delete:** Account marked as "pending deletion" for 30 days, then hard delete.

**Solution (V2 — authenticated monitoring):**
```typescript
// PII detection before storage
const PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,  // email
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,                  // US phone
  /\b\d{3}-\d{2}-\d{4}\b/g,                           // SSN
  /\b4[0-9]{12}(?:[0-9]{3})?\b/g,                     // Visa
  /\b5[1-5][0-9]{14}\b/g,                             // Mastercard
];

function redactPII(body: string): string {
  let redacted = body;
  for (const pattern of PII_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}
```

**Effort:** 3 hours (privacy policy + deletion function) + 8 hours (V2 PII detection)  
**When:** Before launch — privacy policy; V2 — PII detection

---

### B-03: Payment Failure Cascade

**Problem:** Payment fails → what happens during 14-day grace period → which URLs survive downgrade?

**Solution:**

**Stripe dunning configuration:**
- Use Stripe's built-in Smart Retries (enabled in Stripe Dashboard → Settings → Subscriptions → Retry schedule)
- Stripe retries: day 1, day 3, day 5, day 7 automatically
- After all retries fail: mark subscription `past_due`

**Grace period: 14 days at full service.**
```typescript
// Stripe webhook handler
async function handleInvoicePaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  
  if (subscription.status === 'past_due') {
    const daysPastDue = daysSince(invoice.period_end);
    
    // Send escalating emails
    if (daysPastDue === 1) {
      await sendEmail(user, 'payment-failed', {
        subject: "Your Chirri payment failed — update your card",
        tone: 'friendly',
      });
    } else if (daysPastDue === 7) {
      await sendEmail(user, 'payment-failed-reminder', {
        subject: "Your Chirri subscription is at risk",
        tone: 'urgent',
      });
    } else if (daysPastDue === 14) {
      await downgradeToFree(user.id);
    }
  }
}
```

**Downgrade logic:**
```typescript
async function downgradeToFree(userId: string) {
  // 1. Send email listing all URLs with their "value score"
  const urls = await db.query(
    `SELECT id, name, url, 
     (SELECT COUNT(*) FROM user_changes uc WHERE uc.url_id = urls.id) as change_count
     FROM urls WHERE user_id = $1 ORDER BY change_count DESC`,
    [userId]
  );
  
  await sendEmail(userId, 'downgrade-notice', {
    subject: "Your Chirri account has been downgraded to Free",
    body: `You can keep 3 URLs. We've kept your most active ones. 
           Log in within 7 days to choose which to keep.`,
    urls: urls.rows,
  });
  
  // 2. Keep top 3 by activity, pause the rest
  const keepIds = urls.rows.slice(0, 3).map(u => u.id);
  
  await db.query(
    `UPDATE urls SET status = 'paused', status_reason = 'Account downgraded to Free plan'
     WHERE user_id = $1 AND id != ALL($2)`,
    [userId, keepIds]
  );
  
  // 3. Update plan
  await db.query(
    `UPDATE users SET plan = 'free', subscription_status = 'canceled' WHERE id = $1`,
    [userId]
  );
  
  // 4. NEVER delete data — paused URLs retain all history
}
```

**Libraries/tools:** Stripe (already in stack)

**Effort:** 6 hours  
**When:** Before launch — Week 5

---

### B-04: Free Tier Abuse

**Problem:** Determined abusers could create many free accounts to bypass limits.

**Solution:** **Don't over-engineer before launch.** Implement progressive friction only when abuse is detected.

**Monitoring (post-launch):**
```typescript
// Daily job: detect potential abuse patterns
async function detectAbuse() {
  // Accounts per IP in last 24h
  const ipAbuse = await db.query(`
    SELECT ip_address, COUNT(*) as account_count 
    FROM users WHERE created_at > now() - interval '24 hours'
    GROUP BY ip_address HAVING COUNT(*) > 3
  `);
  
  // Accounts per email domain  
  const domainAbuse = await db.query(`
    SELECT split_part(email, '@', 2) as domain, COUNT(*) as count
    FROM users WHERE created_at > now() - interval '7 days'
    GROUP BY domain HAVING COUNT(*) > 5
    AND domain NOT IN ('gmail.com', 'outlook.com', 'yahoo.com', 'protonmail.com')
  `);
  
  if (ipAbuse.rows.length > 0 || domainAbuse.rows.length > 0) {
    await alertOps('⚠️ Potential account abuse detected', { ipAbuse, domainAbuse });
  }
}
```

**Escalation ladder (only as needed):**
1. Email verification only (MVP)
2. If abuse detected: add hCaptcha on signup
3. If still abused: require phone verification for >1 URL
4. Nuclear: credit card on file (even for free, $0 authorization)

**Effort:** 0 hours now; 4 hours when abuse detected  
**When:** Can wait

---

### B-05: Chargebacks

**Problem:** At $9/mo, a single chargeback costs more than the user's LTV.

**Solution:**

1. **Clear billing descriptor:** Configure in Stripe Dashboard → Settings → Account → Statement descriptor: `CHIRRI.IO`

2. **Send receipt on every charge:** Stripe does this automatically if enabled in Settings → Emails → Successful payments.

3. **Easy cancellation:** One-click cancel from dashboard Settings page. No "are you sure?" dark pattern chain. Just: "Cancel subscription" → "Are you sure? You'll keep access until [end date]" → Done.

4. **Refund policy:** If someone emails asking for a refund, give it immediately. $9 is not worth the chargeback fee ($15) or the Stripe dispute overhead.

5. **Enable Stripe Radar:** Built-in fraud detection, free on Stripe standard pricing.

**Effort:** 2 hours  
**When:** Before launch — Week 5

---

## 5. Competitive Solutions

---

### C-01: Postman Ships API Change Detection

**Problem:** Postman acquired Akita (API traffic analysis); could ship competing feature to 30M+ users.

**Solution:** This is an existential risk with no technical fix. Strategic response:

1. **Speed:** Ship before them. They've had Akita since 2023 and haven't shipped this feature yet.

2. **Positioning wedge:** "Postman monitors YOUR APIs. Chirri monitors THEIR APIs." Different use case, different buyer.

3. **Data moat:** Every day Chirri runs, it accumulates historical API change data that can't be replicated retroactively. The @ChirriChangelog content brand and API Stability Index are network effects.

4. **Price advantage:** Chirri at $9/mo for a team vs. Postman at $12-49/user/month.

5. **If Postman ships it:** Pivot positioning to "Chirri: the indie developer's API change monitor" — lean into simplicity and price.

**Effort:** 0 hours (strategic awareness)  
**When:** Ongoing

---

### C-02: changedetection.io Adds API-Specific Features

**Problem:** Free, self-hosted tool with 22K+ GitHub stars could add JSON schema-aware diffing.

**Solution:**

1. **Managed service advantage:** Most developers don't want to run another Docker container.

2. **Provider intelligence:** "Type Stripe, get everything" is impossible for self-hosted tools — requires curated provider database.

3. **Quality obsession:** changedetection.io has known FP issues with dynamic content. If Chirri's FP rate is 10x better, that's the differentiator.

4. **Aggregate intelligence (V2):** "73% of Chirri users saw this change" — impossible for self-hosted.

**Effort:** 0 hours (strategic awareness)  
**When:** Ongoing — monitor their releases

---

## 6. Edge Case Solutions

---

### E-01: 200 OK with Error Body (Soft Errors)

**Problem:** APIs return HTTP 200 but body contains error — Chirri misclassifies as "content changed."

**Solution:** Error body detection after status code check.

```typescript
const ERROR_JSON_KEYS = ['error', 'errors', 'fault', 'exception', 'error_message'];
const ERROR_BODY_PATTERNS = [
  /rate.?limit/i,
  /unauthorized/i,
  /forbidden/i,
  /internal.?(?:server)?.?error/i,
  /too.?many.?requests/i,
  /service.?unavailable/i,
  /maintenance/i,
];

function detectSoftError(statusCode: number, body: string): SoftErrorResult | null {
  if (statusCode !== 200) return null; // Only check 200 OK responses
  
  try {
    const json = JSON.parse(body);
    
    // Check for error keys at top level
    for (const key of ERROR_JSON_KEYS) {
      if (json[key] !== undefined && json[key] !== null && json[key] !== false) {
        return { type: 'soft_error', key, value: json[key] };
      }
    }
    
    // GraphQL error pattern
    if (json.data === null && Array.isArray(json.errors) && json.errors.length > 0) {
      return { type: 'graphql_error', errors: json.errors };
    }
    
    // { success: false } pattern
    if (json.success === false || json.ok === false || json.status === 'error') {
      return { type: 'soft_error', pattern: 'success_false' };
    }
  } catch {
    // Not JSON — check for HTML error patterns
    if (ERROR_BODY_PATTERNS.some(p => p.test(body))) {
      return { type: 'soft_error', pattern: 'body_text_match' };
    }
    
    // HTML page saying "404 Not Found"
    if (body.includes('<title>404') || body.includes('Page Not Found') || body.includes('Not Found</')) {
      return { type: 'soft_error', pattern: 'html_404' };
    }
  }
  
  return null;
}

// In check pipeline:
const softError = detectSoftError(response.status, body);
if (softError) {
  // Classify as availability event, NOT schema/content change
  return {
    type: 'availability',
    severity: 'warning',
    summary: `API returned 200 OK but body contains error: ${softError.type}`,
    alertUsers: false, // Don't alert for transient soft errors
    trackRate: true,   // Track soft error rate over time
  };
}
```

**Libraries/tools:** No additional libraries.

**Effort:** 4 hours  
**When:** Before launch — Week 3

---

### E-02: DNS Resolution Caching

**Problem:** 5,000 DNS queries per hour adds latency and may trigger DNS throttling.

**Solution:** Use undici's built-in DNS interceptor (discovered in research — added in recent undici versions).

```typescript
import { Agent, interceptors } from 'undici';

// Create agent with DNS caching
const monitoringAgent = new Agent().compose(
  interceptors.dns({
    dualStack: true,
    affinity: 4,       // prefer IPv4
    maxTTL: 60_000,    // max cache: 60 seconds
    lookup: undefined,  // use default resolver
  })
);

// For SSRF checks: ALWAYS resolve fresh (don't use cache)
async function ssrfCheck(hostname: string): Promise<string> {
  // Bypass cache — resolve fresh for security
  const { address } = await dns.promises.lookup(hostname, { family: 0 });
  
  if (isBlockedIP(address)) {
    throw new SSRFError(`Blocked IP: ${address}`);
  }
  
  return address;
}
```

**Alternative if undici DNS interceptor isn't available in our version:**
```typescript
import CacheableLookup from 'cacheable-lookup';

const cacheable = new CacheableLookup({
  maxTtl: 60, // 60 seconds max cache
});

// Use with undici
const agent = new Agent({
  connect: {
    lookup: cacheable.lookup,
  }
});
```

**Libraries/tools:**
- `cacheable-lookup` (npm: 9.6M weekly downloads) as fallback
- undici built-in DNS interceptor (preferred if available)

**Effort:** 2 hours  
**When:** Before launch — Week 2

---

### E-03: Servers That Behave Differently Based on Headers

**Problem:** API may return different content based on User-Agent, Accept, etc.

**Solution:** Consistent, documented request headers per URL type.

```typescript
const DEFAULT_HEADERS_BY_TYPE: Record<string, Record<string, string>> = {
  'json-api': {
    'Accept': 'application/json',
    'User-Agent': 'Chirri-Monitor/1.0 (+https://chirri.io/bot)',
  },
  'rss-feed': {
    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
    'User-Agent': 'Chirri-Monitor/1.0 (+https://chirri.io/bot)',
  },
  'openapi-spec': {
    'Accept': 'application/json, application/yaml',
    'User-Agent': 'Chirri-Monitor/1.0 (+https://chirri.io/bot)',
  },
  'html': {
    'Accept': 'text/html, */*',
    'User-Agent': 'Mozilla/5.0 (compatible; Chirri-Monitor/1.0; +https://chirri.io/bot)',
  },
  'unknown': {
    'Accept': 'application/json, text/html;q=0.9, */*;q=0.8',
    'User-Agent': 'Chirri-Monitor/1.0 (+https://chirri.io/bot)',
  },
};
```

**Documentation:** Add to chirri.io/bot: "Chirri monitors the response as seen by its monitoring agent. If you need to monitor a specific client experience, set custom headers in your URL configuration."

**Libraries/tools:** No additional libraries.

**Effort:** 1 hour  
**When:** Before launch — Week 2

---

### E-04: Brotli/Zstd Compressed Responses

**Problem:** Brotli-compressed responses without decompression produces false positives and broken diffs.

**Solution:** Handle all common compression encodings.

```typescript
import zlib from 'node:zlib';

async function decompressResponse(body: Buffer, contentEncoding: string | null): Promise<Buffer> {
  if (!contentEncoding) return body;
  
  switch (contentEncoding.toLowerCase().trim()) {
    case 'gzip':
      return zlib.gunzipSync(body);
    case 'deflate':
      return zlib.inflateSync(body);
    case 'br':
      return zlib.brotliDecompressSync(body);
    case 'zstd':
      // Node.js doesn't have built-in zstd yet
      // Use @aspect/node-zstd or fzstd
      try {
        const { decompress } = await import('fzstd');
        return Buffer.from(decompress(body));
      } catch {
        // If zstd library not available, treat as raw bytes
        return body;
      }
    default:
      return body;
  }
}

// Send Accept-Encoding to get compressed responses (saves bandwidth)
const CHECK_HEADERS = {
  'Accept-Encoding': 'gzip, deflate, br',
};
```

Note: Node.js has built-in `zlib.brotliDecompressSync()` since v10. No external library needed for Brotli.

For undici's newer versions, the `autoSelectFamily` and decompression interceptor handle this automatically. But we should handle it explicitly for reliability.

**Libraries/tools:**
- `node:zlib` (built-in — handles gzip, deflate, brotli)
- `fzstd` (npm: only needed for zstd, rare in APIs)

**Effort:** 2 hours  
**When:** Before launch — Week 2

---

### E-05: JSONP Responses

**Problem:** JSONP-wrapped responses fail `JSON.parse()`, losing structural diffing capability.

**Solution:** Detect and strip JSONP wrapper.

```typescript
function unwrapJSONP(body: string): { json: string; isJSONP: boolean } {
  // Pattern: callback_name({...}) or /**/ callback({...})
  const jsonpPattern = /^(?:\/\*\*\/\s*)?(?:typeof\s+\w+\s*===?\s*['"]function['"]\s*&&\s*)?\w[\w.]*\s*\(\s*([\s\S]*)\s*\);?\s*$/;
  const match = body.trim().match(jsonpPattern);
  
  if (match) {
    return { json: match[1], isJSONP: true };
  }
  
  return { json: body, isJSONP: false };
}

// In response processing:
let parseable = body;
const { json, isJSONP } = unwrapJSONP(body);
if (isJSONP) {
  parseable = json;
  logger.info({ url }, 'Detected JSONP response, stripped callback wrapper');
}
```

**Libraries/tools:** No additional libraries.

**Effort:** 1 hour  
**When:** Can wait — first month if reported

---

### E-06: Binary/Non-Text Responses

**Problem:** Binary responses (protobuf, images, PDFs) break text-based diffing.

**Solution:** Detect via Content-Type and fall back to hash-only.

```typescript
const BINARY_CONTENT_TYPES = [
  'application/octet-stream',
  'application/protobuf', 'application/x-protobuf', 'application/grpc',
  'application/msgpack', 'application/x-msgpack',
  'application/cbor',
  'image/', 'audio/', 'video/',
  'application/pdf', 'application/zip',
  'application/wasm',
];

function isBinaryResponse(contentType: string): boolean {
  return BINARY_CONTENT_TYPES.some(bt => contentType.toLowerCase().includes(bt));
}

// In classification:
if (isBinaryResponse(response.headers['content-type'])) {
  return {
    content_type: 'binary',
    monitoring_method: 'hash-only',
    confidence: 100,
    warning: 'This URL returns binary content. We can detect changes via hash comparison but cannot show detailed diffs.',
  };
}
```

**Libraries/tools:** No additional libraries.

**Effort:** 1 hour  
**When:** Can wait

---

### E-07: Geographic Load Balancer Inconsistency

**Problem:** Chirri checks from one region; user's app may see different data in another region.

**Solution (MVP):** Accept as known limitation. Document it.

**Dashboard text:** "📍 Checks from US East (Virginia). Results may differ from your local region."

**V2: Multi-region checking:**
- Deploy a lightweight "check agent" in EU and Asia (minimal Railway service: $5/mo each)
- Both regions check; only alert if BOTH detect the same change
- Reduces false positives from geo-specific CDN differences

**Effort:** 30 minutes (documentation) + 2 weeks (V2 multi-region)  
**When:** MVP — document; V2 — implement

---

### E-08: Daylight Saving Time and Quiet Hours

**Problem:** UTC offset math breaks quiet hours during DST transitions.

**Solution:** Use IANA timezone strings + `luxon` for all timezone math. Never store or compute with UTC offsets.

```typescript
import { DateTime } from 'luxon';

function isInQuietHours(
  userTimezone: string,  // IANA: 'America/New_York'
  quietStart: string,    // '23:00'
  quietEnd: string       // '08:00'
): boolean {
  // luxon handles DST automatically
  const now = DateTime.now().setZone(userTimezone);
  
  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);
  
  const currentMinutes = now.hour * 60 + now.minute;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  if (startMinutes > endMinutes) {
    // Overnight: 23:00 → 08:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
  
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

// Test cases to add:
// - America/New_York during March DST (spring forward)
// - America/New_York during November DST (fall back)
// - Europe/London during October DST
// - Asia/Kolkata (no DST — should always work)
// - Pacific/Auckland (southern hemisphere DST)
// - Pacific/Chatham (UTC+12:45 — 45-minute offset)
```

**Libraries/tools:** `luxon` (already needed for U-06)

**Effort:** 2 hours (implementation + test cases)  
**When:** Before launch — Week 3

---

## 7. Operational Solutions

---

### O-01: On-Call and Incident Response

**Problem:** No on-call rotation; incidents at 3am go unnoticed for hours.

**Solution:**

**1. Set up BetterStack (free tier) for incident alerting:**
- Monitors `/health` endpoint every 30 seconds
- Escalation: Telegram → phone call → SMS
- All 3 channels alert simultaneously (solo founder, no rotation needed)

**2. Create RUNBOOK.md:**
```markdown
# Chirri Incident Runbook

## Quick Diagnosis
1. Check Railway dashboard: https://railway.app/project/[id]
2. Check Redis memory: `redis-cli -u $REDIS_URL INFO memory`
3. Check queue depth: `redis-cli -u $REDIS_URL LLEN bull:url-checks:wait`
4. Check Postgres connections: `SELECT count(*) FROM pg_stat_activity;`
5. Check R2: try `curl https://[r2-endpoint]/health-test`

## Common Fixes
- **Worker crash loop:** Check logs for OOM. Scale up memory or reduce concurrency.
- **Queue backup:** Check if domain rate limiters are stuck. Flush: `redis-cli DEL domain_throttle:*`
- **Redis OOM:** Purge completed jobs: `redis-cli EVAL "..." 0`
- **Postgres slow:** Check for missing indexes: `SELECT * FROM pg_stat_user_tables WHERE seq_scan > 1000;`
- **R2 down:** Non-critical. Checks continue. Snapshots queue for later.

## Escalation
- Not fixable in 15 min → Post to status page → Email affected users
```

**3. Status page:** Use Instatus free tier (instatus.com) or BetterStack status page.

**4. Canary monitoring:** Chirri monitors itself via a known stable URL (httpbin.org/get). If the canary fails 3x in a row, alert ops.

**Libraries/tools:**
- BetterStack (free tier) for uptime monitoring
- Instatus (free tier) for status page

**Effort:** 3 hours  
**When:** Before launch — Week 5

---

### O-02: Database Migrations Without Downtime

**Problem:** Schema changes on large tables can lock and cause downtime.

**Solution:** Follow these migration rules strictly:

```typescript
// RULES (enforce in code review checklist):
// 1. ALWAYS: ALTER TABLE ADD COLUMN ... DEFAULT value (instant on PG 11+)
// 2. ALWAYS: CREATE INDEX CONCURRENTLY (no write lock)
// 3. NEVER: ALTER TABLE ... NOT NULL on existing column without DEFAULT
// 4. NEVER: DROP COLUMN in the same deploy as code change
// 5. ALWAYS: additive-only migrations (new columns nullable, new tables)

// Migration pattern: "expand and contract"
// Deploy 1: Add new nullable column
// Deploy 2: Code writes to both old and new columns
// Deploy 3: Backfill new column
// Deploy 4: Code reads from new column
// Deploy 5: Drop old column (weeks later)
```

**Railway-specific:** Verify PostgreSQL version (should be 14+):
```sql
SELECT version(); -- Must be >= 14 for instant ADD COLUMN
```

**Migration testing:** Before every migration, test against a copy of production data. Use Railway's database fork feature or a local pg_dump restore.

**Libraries/tools:** `drizzle-orm` (already chosen) + `drizzle-kit` for migrations

**Effort:** 2 hours (document rules + set up testing)  
**When:** Before launch — Week 1

---

### O-03: Rollback Strategy

**Problem:** Bad deploys with DB migrations can't be easily rolled back.

**Solution:** Feature flags + backward-compatible migrations + versioned job payloads.

**1. Feature flags via environment variables:**
```typescript
const FEATURES = {
  NEW_DIFF_ENGINE: process.env.FEATURE_NEW_DIFF_ENGINE === 'true',
  DAILY_DIGEST: process.env.FEATURE_DAILY_DIGEST === 'true',
  MULTI_REGION: process.env.FEATURE_MULTI_REGION === 'true',
};

// Usage:
if (FEATURES.NEW_DIFF_ENGINE) {
  result = newDiffEngine(baseline, current);
} else {
  result = legacyDiffEngine(baseline, current);
}

// Rollback = flip env var in Railway dashboard (instant, no redeploy)
```

**2. Job schema versioning:**
```typescript
interface CheckJob {
  _version: 1; // Increment when schema changes
  shared_url_id: string;
  url: string;
  // ...
}

// Worker: handle version mismatch
async function processJob(job: Job) {
  if (job.data._version > SUPPORTED_VERSION) {
    logger.warn({ version: job.data._version }, 'Job version too new, re-queuing');
    throw new Error('Unsupported job version'); // Will retry when compatible worker deploys
  }
}
```

**3. Railway rollback:** Railway keeps recent deployments. One-click rollback via dashboard. Test this during Week 6.

**Libraries/tools:** No additional libraries (just env vars).

**Effort:** 3 hours  
**When:** Before launch — Week 5

---

### O-04: Customer Data Deletion (GDPR)

**Problem:** User data spread across 12+ tables and R2; deletion must be complete.

**Solution:** Single `deleteUserData()` function that handles everything.

```typescript
async function deleteUserData(userId: string): Promise<DeletionReport> {
  const report: DeletionReport = { tables: {}, r2Objects: 0 };
  
  await db.transaction(async (tx) => {
    // 1. Get all user's URLs and their shared URL IDs
    const urls = await tx.query(
      'SELECT id, shared_url_id FROM urls WHERE user_id = $1', [userId]
    );
    
    // 2. Delete user-specific tables (order matters for FKs)
    report.tables.notifications = await tx.query(
      'DELETE FROM notifications WHERE user_id = $1', [userId]
    ).rowCount;
    
    report.tables.user_changes = await tx.query(
      'DELETE FROM user_changes WHERE user_id = $1', [userId]
    ).rowCount;
    
    report.tables.webhook_deliveries = await tx.query(
      'DELETE FROM webhook_deliveries WHERE webhook_id IN (SELECT id FROM webhooks WHERE user_id = $1)', [userId]
    ).rowCount;
    
    report.tables.webhooks = await tx.query(
      'DELETE FROM webhooks WHERE user_id = $1', [userId]
    ).rowCount;
    
    report.tables.integrations = await tx.query(
      'DELETE FROM integrations WHERE user_id = $1', [userId]
    ).rowCount;
    
    // 3. For each URL: decrement shared subscriber count
    for (const url of urls.rows) {
      if (url.shared_url_id) {
        const result = await tx.query(
          `UPDATE shared_urls SET subscriber_count = subscriber_count - 1 
           WHERE id = $1 RETURNING subscriber_count`,
          [url.shared_url_id]
        );
        
        // If no more subscribers: delete shared URL and all its data
        if (result.rows[0]?.subscriber_count <= 0) {
          // Delete check_results across ALL partitions
          await tx.query(
            'DELETE FROM check_results WHERE shared_url_id = $1', [url.shared_url_id]
          );
          await tx.query(
            'DELETE FROM changes WHERE shared_url_id = $1', [url.shared_url_id]
          );
          await tx.query(
            'DELETE FROM baselines WHERE shared_url_id = $1', [url.shared_url_id]
          );
          await tx.query(
            'DELETE FROM learning_samples WHERE shared_url_id = $1', [url.shared_url_id]
          );
          
          // Queue R2 cleanup (async — don't block deletion)
          await maintenanceQueue.add('r2-cleanup', { shared_url_id: url.shared_url_id });
          
          await tx.query('DELETE FROM shared_urls WHERE id = $1', [url.shared_url_id]);
        }
      }
    }
    
    // 4. Delete URLs
    report.tables.urls = await tx.query(
      'DELETE FROM urls WHERE user_id = $1', [userId]
    ).rowCount;
    
    // 5. Revoke all API keys
    report.tables.api_keys = await tx.query(
      'DELETE FROM api_keys WHERE user_id = $1', [userId]
    ).rowCount;
    
    // 6. Delete user
    await tx.query('DELETE FROM users WHERE id = $1', [userId]);
  });
  
  // 7. Log deletion for audit (keep for 90 days)
  await db.query(
    `INSERT INTO deletion_audit_log (user_id, report, deleted_at) VALUES ($1, $2, now())`,
    [userId, JSON.stringify(report)]
  );
  
  return report;
}
```

**30-day soft delete:** Mark account `pending_deletion`, schedule hard delete via delayed BullMQ job.

**Testing:** Create a test user in Week 6, populate with data, run `deleteUserData()`, verify all tables are clean.

**Libraries/tools:** No additional libraries.

**Effort:** 6 hours  
**When:** Before launch — Week 5

---

### O-05: Backup Restore Testing

**Problem:** Backups are untested; restore time unknown.

**Solution:**

**1. Daily backup (already planned):**
```bash
# pg_dump → gzip → upload to R2
pg_dump $DATABASE_URL --format=custom | gzip > chirri_$(date +%Y%m%d).dump.gz
# Upload to R2 via aws CLI (S3-compatible)
aws s3 cp chirri_$(date +%Y%m%d).dump.gz s3://chirri-backups/ --endpoint-url $R2_ENDPOINT
```

**2. Test restore in Week 6:**
```bash
# Create a temporary Railway Postgres instance
# Download backup from R2
aws s3 cp s3://chirri-backups/chirri_20260401.dump.gz . --endpoint-url $R2_ENDPOINT
gunzip chirri_20260401.dump.gz
# Restore
pg_restore -d $TEST_DATABASE_URL chirri_20260401.dump
# Measure time
# Verify data integrity: run count queries on all tables
```

**3. WAL-based PITR:** Check if Railway supports Point-in-Time Recovery (their managed Postgres likely has WAL archiving). If so, enable it — gives continuous backup with arbitrary restore points.

**4. Monthly restore test:** Schedule a maintenance job that restores the latest backup to a temporary database, runs integrity checks, and reports results.

**5. Define RTO:** Target: 2 hours. Acceptable: 4 hours. Unacceptable: >8 hours.

**Libraries/tools:** `pg_dump`, `pg_restore` (PostgreSQL built-in)

**Effort:** 4 hours  
**When:** Before launch — Week 6

---

## 8. Compound Failure Solutions

---

### CF-01: Launch Day DDoS + False Positive Cascade

**Problem:** 500 users all monitor Stripe → 6,000 learning requests in 10 min → rate limited → 429 baked into baselines → mass false alerts.

**Solution:** Multi-layer defense (THE #1 priority):

**Layer 1: Global per-domain cap already prevents step 3:**
```typescript
const DOMAIN_RATE_LIMITS = {
  maxRequestsPerMinute: 1,   // per unique URL
  maxRequestsPerHour: 60,    // across ALL URLs for this domain
};
```
60 req/hour to Stripe = 1/min max. Even with 500 users, shared monitoring means only 1 actual request per unique URL per interval.

**Layer 2: 429/error responses NEVER become baselines:**
```typescript
async function processLearningSample(response: Response, sample: LearningSample) {
  // CRITICAL: Discard non-success responses from learning
  if (response.status !== 200 && response.status !== 201) {
    logger.warn({ status: response.status }, 'Non-success during learning, discarding sample');
    // Re-queue this sample attempt with delay
    return { action: 'retry', delay: 30_000 }; // Try again in 30s
  }
  
  // Cloudflare/bot protection check
  const body = await response.text();
  if (isCloudflareChallenge(body) || isBotProtection(body)) {
    logger.warn('Bot protection during learning, discarding sample');
    return { action: 'retry', delay: 60_000 };
  }
  
  // Only store successful, clean responses as learning samples
  return { action: 'store', body };
}
```

**Layer 3: Cross-user correlation (canary check):**
```typescript
async function detectFalsePositiveCascade() {
  // If >50% of checks in the last 5 minutes detected changes, 
  // something is wrong with US, not them
  const recentChecks = await db.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE change_detected = true) as changes
    FROM check_results
    WHERE checked_at > now() - interval '5 minutes'
  `);
  
  const changeRate = recentChecks.rows[0].changes / recentChecks.rows[0].total;
  
  if (changeRate > 0.5 && recentChecks.rows[0].total > 20) {
    // HALT ALL NOTIFICATIONS
    await redis.set('notification_pause', '1', 'EX', 3600); // 1 hour pause
    await alertOps(`🚨 CANARY ALERT: ${(changeRate * 100).toFixed(0)}% of checks detecting changes. ` +
                   `This is likely a false positive cascade. Notifications paused for 1 hour.`);
  }
}

// Run this every 5 minutes via scheduler
```

**Layer 4: Notification rate limiting per domain:**
```typescript
const MAX_ALERTS_PER_DOMAIN_PER_HOUR = 5;

async function shouldSendAlert(domain: string, userId: string): Promise<boolean> {
  const key = `alert_rate:${domain}:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 3600);
  
  if (count > MAX_ALERTS_PER_DOMAIN_PER_HOUR) {
    logger.info({ domain, userId, count }, 'Alert rate limit hit, suppressing');
    return false;
  }
  return true;
}
```

**Layer 5: Shared monitoring means 500 users = 1 check:**
When 500 users monitor `api.stripe.com/v1/prices`, they all share ONE `shared_url`. One HTTP request. One learning cycle. One baseline. The system doesn't multiply requests by users — that's the entire point of shared monitoring.

**Libraries/tools:** No additional libraries.

**Effort:** 8 hours (all layers combined)  
**When:** Before launch — HIGHEST PRIORITY

---

### CF-02: Redis OOM + Worker Crash + Scheduler Orphan

**Problem:** Redis OOM → BullMQ failure → worker crash → scheduler double-run → duplicate alerts.

**Solution:**

**1. Handle BullMQ enqueue failures gracefully:**
```typescript
async function safeEnqueue(queue: Queue, name: string, data: any, opts: any) {
  try {
    await queue.add(name, data, opts);
  } catch (e) {
    if (e.message.includes('OOM')) {
      logger.error('Redis OOM — cannot enqueue. Will retry on next cycle.');
      // The scheduler's next run will try again
      // Meanwhile, missed-check recovery will catch missed URLs
      return null;
    }
    throw e; // Re-throw non-OOM errors
  }
}
```

**2. Scheduler idempotency:**
```typescript
// Scheduler uses shared_urls.next_check_at as source of truth, NOT Redis job existence
// Even if two schedulers run simultaneously (should never happen with Redis lock, but defensive):
async function scheduleChecks() {
  const urls = await db.query(`
    SELECT * FROM shared_urls
    WHERE next_check_at <= now()
    FOR UPDATE SKIP LOCKED  -- Key: SKIP LOCKED prevents double-scheduling
  `);
  // ...
}
```

**3. Worker deduplication:**
```typescript
async function processCheck(job: Job) {
  // Idempotency check: was this URL already checked in the last interval?
  const interval = parseInterval(job.data.check_interval);
  const recentCheck = await db.query(
    `SELECT 1 FROM check_results 
     WHERE shared_url_id = $1 AND checked_at > now() - $2::interval * 0.5
     LIMIT 1`,
    [job.data.shared_url_id, interval]
  );
  
  if (recentCheck.rows.length > 0) {
    logger.info({ shared_url_id: job.data.shared_url_id }, 'Duplicate check, skipping');
    return; // Already checked recently
  }
  
  // Proceed with check
}
```

**Libraries/tools:** No additional libraries.

**Effort:** 4 hours  
**When:** Before launch — Week 2

---

### CF-03: R2 Outage + Large Response + No Fallback

**Problem:** R2 timeout → worker stuck → all checks blocked → total monitoring failure.

**Solution:** Already solved in I-06 (R2 writes are async + circuit breaker). This compound failure is eliminated by making R2 non-blocking.

Additional safety: set explicit timeout on R2 operations:
```typescript
const R2_TIMEOUT_MS = 5000;

async function uploadToR2(body: string, key: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), R2_TIMEOUT_MS);
  
  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
    }), { abortSignal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
```

**Effort:** Included in I-06 (0 additional hours)  
**When:** Before launch — Week 2

---

## 9. Prioritized Implementation Checklist

### 🔴 CRITICAL — Must Be Done Before Launch (Priority Order)

| # | Item | Refs | Effort | Week |
|---|------|------|--------|------|
| 1 | **False positive cascade prevention** (all 5 layers) | CF-01 | 8h | 2-3 |
| 2 | **429/bot-protection never becomes baseline** | T-08, CF-01 | 4h | 2 |
| 3 | **URL + header normalization for shared monitoring** | T-10, U-01 | 2h | 2 |
| 4 | **jsondiffpatch tiered strategy with timeout** | T-01 | 4h | 2 |
| 5 | **Stream large responses (never buffer >1MB)** | T-02 | 6h | 2 |
| 6 | **BullMQ job retention + Redis memory monitoring** | T-07 | 4h | 1 |
| 7 | **Redis maxmemory-policy noeviction configuration** | T-07 | 1h | 1 |
| 8 | **R2 writes async with circuit breaker** | I-06, CF-03 | 4h | 2 |
| 9 | **Brotli/gzip/deflate decompression** | E-04 | 2h | 2 |
| 10 | **Soft error detection (200 with error body)** | E-01 | 4h | 3 |
| 11 | **Postgres native partitioning (no pg_partman)** | T-06 | 3h | 1 |
| 12 | **Learning period protection (discard errors)** | T-09 | 3h | 2-3 |
| 13 | **Railway graceful shutdown (30s drain)** | I-01 | 2h | 1 |
| 14 | **Railway static outbound IPs** | I-03 | 1h | 1 |
| 15 | **Deploy strategy (ordered, not simultaneous)** | I-04 | 3h | 5 |
| 16 | **Design for Redis ephemerality** | I-05 | 4h | 2 |
| 17 | **Conditional DB writes (reduce IOPS)** | I-02 | 4h | 2 |
| 18 | **Login page / SPA detection in classification** | U-03 | 3h | 3 |
| 19 | **Stagger learning for bulk URL creation** | U-04 | 4h | 3 |
| 20 | **On-call setup + runbook + status page** | O-01 | 3h | 5 |
| 21 | **deleteUserData() function + test** | O-04 | 6h | 5 |
| 22 | **Payment failure / downgrade logic** | B-03 | 6h | 5 |
| 23 | **DNS caching (60s TTL)** | E-02 | 2h | 2 |
| 24 | **DST-safe quiet hours (luxon)** | E-08, U-06 | 2h | 3 |
| 25 | **Encoding detection (iconv-lite)** | U-06 | 2h | 2 |
| 26 | **Privacy policy + chirri.io/bot page** | B-01, B-02 | 2h | 5 |
| 27 | **Remove team seat claims from pricing** | U-07 | 0.5h | 5 |
| 28 | **Migration rules documented + enforced** | O-02 | 2h | 1 |
| 29 | **Feature flags for rollback** | O-03 | 3h | 5 |
| 30 | **Backup restore test** | O-05 | 4h | 6 |

**Total pre-launch effort: ~92 hours (~12 working days)**  
This is absorbed into the existing 8-week timeline, distributed across the appropriate weeks.

### 🟡 IMPORTANT — First Month After Launch

| # | Item | Refs | Effort |
|---|------|------|--------|
| 1 | Shadow mode for first 100 users (FP measurement) | T-03 | 3 days |
| 2 | Daily digest notification option | U-05 | 8h |
| 3 | Numeric tolerance for slowly-drifting fields | U-02 | 3h |
| 4 | Classification accuracy analysis from real data | T-04 | Ongoing |
| 5 | Provider outreach (Stripe, OpenAI, GitHub) | T-08 | 4h |
| 6 | Monitor Railway IP reputation and failures | I-03 | Ongoing |
| 7 | Legal review of top 20 API ToS | B-01 | 1 week + $1-2K |
| 8 | Extended FP testing (200+ URLs, 14 days) | T-03 | Lead time |
| 9 | Monthly backup restore verification | O-05 | 2h/month |
| 10 | API Stability Index page | C-02 | 1 week |

### 🟢 CAN WAIT — Only If Needed

| # | Item | Refs | Trigger |
|---|------|------|---------|
| 1 | Connection pooling tuning | T-05 | If ECONNRESET > 5% |
| 2 | JSONP detection | E-05 | If user reports |
| 3 | Binary response handling | E-06 | If user reports |
| 4 | Multi-region checking | E-07 | V2 / user demand |
| 5 | PII detection in responses | B-02 | V2 / authenticated monitoring |
| 6 | Anti-abuse escalation | B-04 | When abuse detected |
| 7 | Chargeback policy | B-05 | When it happens |
| 8 | Proxy service for blocked domains | I-03 | When blocking occurs |
| 9 | Zstd decompression | E-04 | If encountered |
| 10 | Teams implementation | U-07 | V1.1 |

---

## NPM Dependencies Summary

| Package | Purpose | Weekly Downloads | When |
|---------|---------|-----------------|------|
| `jsondiffpatch` | Structural JSON diffing | 500K+ | Week 2 |
| `microdiff` | Lightweight fallback diff | 50K+ | Week 2 |
| `normalize-url` | URL canonicalization | 19M+ | Week 2 |
| `luxon` | Timezone-safe date handling | 21M+ | Week 3 |
| `iconv-lite` | Character encoding conversion | 39M+ | Week 2 |
| `opossum` | Circuit breaker (R2, external) | 250K+ | Week 2 |
| `cacheable-lookup` | DNS caching (fallback) | 9.6M+ | Week 2 |
| `bullmq` | Job queues (already planned) | 400K+ | Week 1 |
| `ioredis` | Redis client (already planned) | 2M+ | Week 1 |
| `pino` | Logging (already planned) | 5M+ | Week 1 |

All other solutions use Node.js built-in modules (`crypto`, `zlib`, `dns`, `stream`).

---

## The Single Most Important Thing

**The false positive cascade on shared URLs is the kill shot.** Every engineering decision should be evaluated through this lens: "Does this increase or decrease the chance of a mass false alert?"

The five-layer defense (domain rate limits → error response filtering → cross-user canary → per-domain notification caps → notification pause switch) must be implemented as a single cohesive system, not as five separate features. They work together.

If ONE of these layers fails, the others catch it. If ALL of them fail... we have a status page and a sincere apology email template ready to go.

---

*Created: 2026-03-24*  
*Author: Opus (Solution Engineer)*  
*Every unknown now has a concrete answer. Time to build.*
