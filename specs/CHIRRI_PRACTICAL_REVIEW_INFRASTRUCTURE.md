# CHIRRI PRACTICAL INFRASTRUCTURE REVIEW

**Date:** 2026-03-24  
**Reviewer:** Infrastructure skeptic (build-ready audit)  
**Scope:** Business model, technical architecture, security -- "How does this actually work?"

---

## 1. PLAN LIMITS ENFORCEMENT

### **How does it work when a Free user tries to add a 4th URL (limit is 3)?**

**Current spec (§5.9, §D.13):**
```sql
BEGIN;
SELECT COUNT(*) FROM urls 
WHERE user_id = $1 AND status != 'deleted' FOR UPDATE;
-- If count >= plan_limit: abort
INSERT INTO urls (...) VALUES (...);
COMMIT;
```

**Analysis:**
✅ **Locks correctly** -- `FOR UPDATE` serializes concurrent inserts  
✅ **Database-level enforcement** -- no race condition  
✅ **Transaction atomic** -- either count+insert or rollback  

**But what's the UX?**

Bible §6.2 doesn't specify the exact error response. Propose:

```json
{
  "error": {
    "code": "plan_limit_reached",
    "message": "You've reached your Free plan limit of 3 monitored URLs",
    "status": 403,
    "limit": 3,
    "current": 3,
    "upgrade_url": "https://chirri.io/pricing"
  }
}
```

**What if they're mid-import?**

§6.2 lists `POST /v1/urls/bulk` (max 100, partial success). Spec says "partial success" but doesn't define behavior.

**Proposed behavior:**
- Process URLs sequentially
- Stop at first limit violation
- Return HTTP 207 Multi-Status with per-URL results:
  - `201 Created` for successful
  - `403 plan_limit_reached` for the one that hit limit
  - `400 skipped` for remaining (not attempted)

```json
{
  "results": [
    { "url": "https://api.stripe.com/...", "status": 201, "id": "url_abc" },
    { "url": "https://api.github.com/...", "status": 201, "id": "url_def" },
    { "url": "https://api.openai.com/...", "status": 201, "id": "url_ghi" },
    { "url": "https://api.twilio.com/...", "status": 403, "error": "plan_limit_reached" },
    { "url": "https://api.shopify.com/...", "status": 400, "error": "skipped_after_limit" }
  ],
  "summary": { "created": 3, "failed": 2 }
}
```

**Gap:** Bulk import behavior not specified. **Add to CHIRRI_URL_ONBOARDING_FLOW.md.**

---

## 2. STRIPE BILLING FLOW

### **User signs up free → adds URLs → hits limit → clicks upgrade → what happens?**

**Current spec (§4.1):**

> - Checkout: `stripe.checkout.sessions.create()` with `mode: 'subscription'`
> - Upgrade: `stripe.subscriptions.update()` with `proration_behavior: 'always_invoice'`

**Actual implementation flow:**

1. **User clicks "Upgrade to Personal" on the plan limit modal**
2. `POST /v1/account/billing/checkout { "plan": "personal" }`
3. API creates Stripe Checkout Session:
   ```typescript
   const session = await stripe.checkout.sessions.create({
       mode: 'subscription',
       customer: user.stripe_customer_id || undefined,  // Link existing or create new
       customer_email: !user.stripe_customer_id ? user.email : undefined,
       line_items: [{ price: process.env.STRIPE_PRICE_PERSONAL, quantity: 1 }],
       success_url: 'https://chirri.io/dashboard?upgrade=success',
       cancel_url: 'https://chirri.io/pricing?upgrade=cancelled',
       metadata: { user_id: user.id, plan: 'personal' },
       subscription_data: {
           metadata: { user_id: user.id },
       },
   });
   ```
4. API returns `{ "checkout_url": session.url }`
5. User redirected to Stripe Checkout, completes payment
6. Stripe webhook: `checkout.session.completed` → API handler:
   ```typescript
   const session = await stripe.checkout.sessions.retrieve(event.data.object.id, {
       expand: ['subscription'],
   });
   await db.update(users).set({
       plan: 'personal',
       stripe_customer_id: session.customer,
       stripe_subscription_id: session.subscription.id,
       subscription_status: 'active',
       current_period_end: new Date(session.subscription.current_period_end * 1000),
   }).where(eq(users.id, session.metadata.user_id));
   ```
7. User redirected back to dashboard, sees updated plan immediately

**What if payment fails during checkout?**

Stripe Checkout shows inline error ("Card declined"). User can retry with different payment method. No webhook fired until success.

**What about prorations?**

§4.1 says **upgrade** uses `'always_invoice'` (charge difference immediately). But the flow above is a **new subscription** (Free → Personal), not an upgrade. No proration needed.

**Actual upgrade flow (Personal → Team):**

User already has `stripe_subscription_id`. Clicking "Upgrade to Team":

1. `POST /v1/account/billing/upgrade { "plan": "team" }`
2. API:
   ```typescript
   const subscription = await stripe.subscriptions.update(user.stripe_subscription_id, {
       items: [{
           id: subscription.items.data[0].id,
           price: process.env.STRIPE_PRICE_TEAM,
       }],
       proration_behavior: 'always_invoice',  // Immediate charge for difference
   });
   await db.update(users).set({ plan: 'team' }).where(eq(users.id, user.id));
   ```
3. Stripe immediately charges prorated amount, fires `invoice.paid` webhook
4. No redirect needed -- API call completes synchronously

**Downgrade (Team → Personal):**

§4.1 says `'create_prorations'` (credit on next invoice). Same as upgrade but:
```typescript
proration_behavior: 'create_prorations',  // Credit appears on next month's invoice
```

Plus: **Downgrade execution** (§4.1):
> Set plan to 'free', adjust intervals to daily, pause excess URLs (user's choice or most-recently-created first after 72h).

**Implementation:**

```typescript
if (oldPlan.maxUrls > newPlan.maxUrls) {
    const activeUrls = await db.select().from(urls)
        .where(eq(urls.user_id, user.id))
        .where(notInArray(urls.status, ['deleted', 'paused']));
    
    if (activeUrls.length > newPlan.maxUrls) {
        // Notify user: choose which URLs to keep
        await sendEmail({
            to: user.email,
            subject: 'Action required: Choose URLs to keep after downgrade',
            body: '...',
        });
        // Store pending downgrade
        await db.insert(pending_downgrades).values({
            user_id: user.id,
            old_plan: oldPlan.name,
            new_plan: newPlan.name,
            must_choose_by: new Date(Date.now() + 72 * 3600 * 1000),
        });
    }
}
```

After 72h, if user hasn't chosen:
```sql
UPDATE urls SET status = 'paused', paused_at = now()
WHERE user_id = $1
  AND id IN (
      SELECT id FROM urls 
      WHERE user_id = $1 AND status NOT IN ('deleted', 'paused')
      ORDER BY created_at DESC  -- Most recent first
      OFFSET $2  -- Offset = new plan limit
  );
```

**Gap:** Downgrade URL selection UI not specified. **Add to CHIRRI_FRONTEND_BIBLE.md.**

**What if payment fails on recurring subscription?**

§4.1 references **Dunning**:
> Stripe Smart Retries + 4-email sequence over 14 days + downgrade to Free after 14 days

Webhook flow:
1. `invoice.payment_failed` → send email "Payment failed, retrying..."
2. Stripe auto-retries (Smart Retries)
3. If still failing after 14 days → `customer.subscription.deleted` webhook
4. API: downgrade to Free, pause all URLs

```typescript
webhooks.on('customer.subscription.deleted', async (event) => {
    const subscription = event.data.object;
    const user = await db.query.users.findFirst({
        where: eq(users.stripe_subscription_id, subscription.id),
    });
    
    await db.update(users).set({
        plan: 'free',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
    }).where(eq(users.id, user.id));
    
    // Pause all but 3 URLs (Free limit)
    // Same logic as downgrade
});
```

**Assessment:** Stripe flow is **mostly specified** but missing:
- Downgrade URL selection UX
- Email templates for dunning sequence (4 emails over 14 days)
- Annual billing implementation (§4.1 mentions 20% off but no Stripe Price ID for annual plans)

---

## 3. SHARED MONITORING ECONOMICS

### **50 users monitor stripe.com. We check it once. Who pays? How do we attribute cost?**

**Current spec (§2.6, §5.2):**

> shared_urls table: one HTTP request at highest subscriber frequency

**Implementation:**

When 50 users add `api.stripe.com/v1/prices`:
1. All 50 link to the same `shared_url_id`
2. `shared_urls.effective_interval` = **minimum** of all subscribers' intervals
   - User A (Free, 24h), User B (Personal, 1h), User C (Business, 5m)
   - `effective_interval = '5m'` (highest paying subscriber wins)
3. Scheduler enqueues ONE check every 5 minutes for this `shared_url_id`
4. Worker fetches once, fans out to 50 `user_changes` rows if change detected

**Who pays?**

No one "pays" directly. The cost is absorbed by Chirri's infrastructure. Economics (§4.2):

| Plan | Revenue/User | Bundled Cost | Custom URL Cost | Total Cost | Margin |
|---|---|---|---|---|---|
| Business ($49) | $49/mo | $0.60/mo | $18.00/mo | $18.60/mo | $30.40 (62%) |

At 50 users on one domain, the marginal cost per user approaches **zero** due to shared monitoring. The HTTP check itself costs ~$0.001 (compute + bandwidth). R2 storage for snapshots: ~$0.0001/snapshot (5MB × 0.015/GB = $0.000075).

**Does it matter who "owns" the check?**

No. The shared monitoring model means:
- Early users subsidize late users (first user triggers setup, later users benefit instantly)
- High-frequency users subsidize low-frequency users (Business user's 5m interval applies to everyone)
- **This is intentional** -- it's a moat. The more users on a domain, the better the data, the lower the per-user cost.

**Assessment:** Economics are **sound**. No attribution needed. Cost is negligible and scales inversely with users.

---

## 4. DATABASE PARTITIONING AT MVP

### **Does check_results ACTUALLY need partitioning at MVP?**

**Current spec (§5.2):**

> Partitioned by month (native Postgres declarative partitioning)

**Math:**

Assume 1,000 users at MVP, average 5 URLs each, 1h check interval:
- 5,000 URLs × 24 checks/day = **120,000 rows/day**
- Per month: 3.6M rows
- Per year: 43.8M rows

**Row size estimate:**
```sql
id (TEXT, ~30 bytes)
shared_url_id (TEXT, ~30 bytes)
status_code (INT, 4 bytes)
response_time_ms (INT, 4 bytes)
body_size_bytes (INT, 4 bytes)
error (TEXT, ~50 bytes avg)
error_category (TEXT, ~10 bytes)
full_hash (TEXT, 64 bytes)
stable_hash (TEXT, 64 bytes)
schema_hash (TEXT, 64 bytes)
header_hash (TEXT, 64 bytes)
body_r2_key (TEXT, ~80 bytes)
change_detected (BOOLEAN, 1 byte)
change_id (TEXT, ~30 bytes)
is_learning (BOOLEAN, 1 byte)
is_confirmation (BOOLEAN, 1 byte)
worker_id (TEXT, ~20 bytes)
checked_at (TIMESTAMPTZ, 8 bytes)
```

**Total:** ~540 bytes/row (conservative, Postgres adds ~28 bytes overhead = ~570 bytes)

**Storage:**
- Per month: 3.6M × 570 bytes ≈ **2.05 GB**
- Per year: 43.8M × 570 bytes ≈ **25 GB**

**Query performance without partitioning:**

Postgres handles 43.8M rows fine with proper indexes. Index on `(shared_url_id, checked_at DESC)` makes queries like "last 100 checks for this URL" **fast** even at 50M rows.

**But partitioning gives:**
1. **Fast retention enforcement** -- drop entire partition instead of DELETE (instant, no bloat)
2. **Query performance** -- Postgres prunes partitions automatically (`WHERE checked_at > '2026-03-01'` only scans March+ partitions)
3. **Reduced index bloat** -- each partition has its own indexes

**Is it premature optimization?**

**No.** Partitioning is trivial to set up (§5.2 has the DDL) and impossible to add later without downtime. Retention enforcement **requires** partitioning -- DELETE 3.6M rows is slow and causes bloat.

**Assessment:** Partitioning is **necessary at MVP**. Not optimization, it's the **correct architecture** for time-series data with retention.

---

## 5. REDIS CONTENTS & MEMORY ESTIMATE

### **What's actually IN Redis? Will Upstash free tier handle it?**

**Current spec (§5.3, §5.9):**

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| ratelimit:{api_key_hash}:{hour} | Sorted Set | 3700s | API rate limiting (sliding window) |
| ratelimit:ip:{ip}:{hour} | Sorted Set | 3700s | Unauthenticated rate limiting |
| domain_throttle:{domain} | Token bucket | 10s | Outbound request limiting |
| circuit:{domain} | Hash | 600s | Domain circuit breaker state |
| scheduler:lock | SETNX | 60s | Single scheduler guarantee |
| notif_rate:{user_id}:{domain}:{severity}:{hour} | Counter | 2h | Notification rate limiting |
| bull:* | Various | BullMQ managed | All queue data |

**Memory estimate:**

**1. Rate limiting keys:**

Assume 1,000 users, 5 URLs each:
- 1,000 API keys × 1 hour window = 1,000 sorted sets
- Each sorted set: ~100 entries (60 req/hr for Personal, up to 500 for Business)
- Entry size: timestamp (8 bytes) + score (8 bytes) = 16 bytes
- Per key: 100 × 16 = 1.6 KB
- Total: 1,000 × 1.6 KB = **1.6 MB**

IP rate limits (unauthenticated):
- Assume 500 unique IPs/day
- 500 × 1.6 KB = **0.8 MB**

**2. Domain throttles:**

5,000 monitored URLs ≈ ~500 unique domains (10 URLs per domain avg)
- 500 domains × token bucket state (~100 bytes) = **50 KB**

**3. Circuit breakers:**

Same 500 domains:
- 500 × hash (200 bytes: failure_count, last_failure, state, etc.) = **100 KB**

**4. Scheduler lock:**

Single key, ~50 bytes: **negligible**

**5. Notification rate limits:**

1,000 users × 10 active notifications/hour:
- 10,000 counters × 50 bytes = **500 KB**

**6. BullMQ queues:**

This is the big one. Each job is ~2-5 KB (serialized JSON with URL, headers, baseline, etc.).

Assume steady state:
- `url-checks`: 5,000 URLs × 1 job queued = 5,000 × 3 KB = **15 MB**
- `confirmation-checks`: ~50 active confirmations × 3 KB = **150 KB**
- `notifications`: ~200 queued = **600 KB**
- `learning-checks`: ~50 URLs learning × 30 samples × 3 KB = **4.5 MB**

BullMQ also stores completed/failed job metadata (configurable retention):
- Keep last 100 completed per queue × 10 queues × 1 KB = **1 MB**

**Total BullMQ:** ~21 MB

**Grand total:** 1.6 + 0.8 + 0.05 + 0.1 + 0.5 + 21 = **~24 MB**

**Upstash free tier:** 256 MB  
**Safety margin:** 24/256 = **9.4% usage**

**Assessment:** Upstash free tier is **more than sufficient** at MVP scale. Even at 10K users, Redis usage ~200 MB.

**Critical fix (§5.3, §D.20):**

> maxmemory-policy noeviction

This is **correct** (Bible says so). `allkeys-lru` would evict BullMQ job data under pressure, breaking the queue. `noeviction` returns errors on write when full, which BullMQ handles gracefully.

But **monitor memory usage** in production. If approaching 256 MB, upgrade to paid Upstash tier ($10/mo for 1 GB).

---

## 6. R2 STORAGE CONTENTS & COST

### **What goes there? How much storage per URL per month? Cost for 10K URLs?**

**Current spec (§D.8):**

```
snapshots/{shared_url_id}/{YYYY-MM}/{check_id}.json.gz     -- Response body snapshots
snapshots/{shared_url_id}/{YYYY-MM}/{check_id}.text         -- Extracted text (for HTML sources)
exports/{user_id}/{export_id}.zip                            -- GDPR data exports
backups/{YYYY-MM-DD}/chirri.sql.gz                          -- Daily DB backups
archives/{YYYY-MM}/check_results.jsonl.gz                   -- Archived check results
```

**Math:**

**1. Response snapshots:**

Assume average response size: 50 KB (JSON API). Compressed (gzip): ~10 KB.

Per URL (1h interval):
- 24 checks/day × 10 KB = 240 KB/day
- Per month: 7.2 MB/URL
- 10,000 URLs: 72 GB/month

**But:** retention is plan-dependent (§5.7):
- Free: 7 days → 7 × 240 KB = 1.68 MB/URL
- Personal: 30 days → 7.2 MB/URL
- Team: 90 days → 21.6 MB/URL
- Business: 365 days → 87.6 MB/URL

At MVP (mostly Free + Personal):
- 8,000 Free users (5 URLs avg) = 40K URLs × 1.68 MB = **67 GB**
- 2,000 Personal users (5 URLs avg) = 10K URLs × 7.2 MB = **72 GB**
- **Total snapshots:** ~140 GB/month

**2. Extracted text (HTML sources):**

~10% of URLs are HTML. Extracted text: ~5 KB uncompressed.
- 5,000 HTML URLs × 7 days × 24 checks × 5 KB = **~4 GB**

**3. GDPR exports:**

Assume 5 exports/month, 50 MB each: **250 MB**

**4. DB backups:**

Daily backup, 500 MB compressed, 30-day retention: **15 GB**

**5. Archived check_results:**

After retention purge, archive to R2 as compressed JSONL. Estimate 10% of snapshots size: **14 GB**

**Grand total:** 140 + 4 + 0.25 + 15 + 14 = **~173 GB/month**

**Cloudflare R2 pricing:**
- Storage: $0.015/GB/month
- 173 GB × $0.015 = **$2.60/month**

Free tier: 10 GB storage. We exceed that immediately.

**Assessment:** R2 cost at MVP is **negligible** ($2.60/mo). At 100K URLs: ~$26/mo. Still cheap.

**Optimization:** Implement **snapshot deduplication** in V1.1:
- Hash every snapshot
- If hash matches previous, store a pointer instead of full body
- Saves ~80% for stable APIs

---

## 7. RAILWAY DEPLOYMENT ARCHITECTURE

### **Single service or multiple? Can we run everything in one process at MVP?**

**Current spec (§5.1):**

> Three Railway services:
> 1. API SERVER (Hono)
> 2. SCHEDULER (cron)
> 3. CHECK WORKERS (x2)

**Could we run all in one process?**

**NO.** Here's why:

**1. Horizontal scaling requirements differ:**
- API server: scale based on HTTP requests (stateless, easy to scale)
- Scheduler: single instance only (uses Redis lock to prevent duplicates)
- Workers: scale based on queue depth (stateful, harder to scale)

**2. Resource usage patterns differ:**
- API server: CPU-bound (JSON parsing, validation)
- Scheduler: lightweight (just enqueues jobs)
- Workers: I/O-bound (HTTP fetches, waiting for responses)

**3. Failure isolation:**
- Worker crash shouldn't take down API server
- API server deploy shouldn't interrupt in-flight checks

**4. Deployment independence:**
- Can deploy API changes without restarting workers
- Can scale workers independently

**But at MVP, could we run Scheduler + Workers together?**

**Maybe.** They're both lightweight. But Rails Railway billing:
- 3 services on Hobby = 3 × $5/mo base = $15/mo base (plus usage)
- 2 services (API + Scheduler/Workers) = 2 × $5/mo = $10/mo base

**Savings:** $5/mo.  
**Complexity cost:** Mixing scheduler and workers in one process adds complexity, reduces failure isolation.

**Recommendation:** Keep 3 separate services. $5/mo is worth the simplicity and isolation.

**Assessment:** Architecture is **correct**. Don't merge services to save $5/mo.

---

## 8. ENVIRONMENT VARIABLES COMPLETENESS

### **Are they ALL defined? Is the list complete?**

**Current spec (§D.20):**

Shared:
- DATABASE_URL, DATABASE_POOL_SIZE
- REDIS_URL
- R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
- NODE_ENV, LOG_LEVEL
- INTERNAL_API_TOKEN
- ENCRYPTION_MASTER_KEY

API Server:
- PORT
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_PERSONAL, STRIPE_PRICE_TEAM, STRIPE_PRICE_BUSINESS
- DASHBOARD_ORIGIN
- SENTRY_DSN

Worker:
- RESEND_API_KEY
- EMAIL_FROM
- WORKER_ID
- USER_AGENT

**Missing:**

1. **better-auth configuration:**
   - `BETTER_AUTH_SECRET` (for session encryption)
   - `BETTER_AUTH_URL` (base URL for OAuth callbacks)

2. **Stripe Product IDs:**
   - Spec lists `STRIPE_PRICE_*` but not `STRIPE_PRODUCT_*`
   - Stripe Checkout needs product IDs for metadata

3. **LLM API key (for chirp summarization):**
   - `OPENAI_API_KEY` (for GPT-4o-mini)

4. **Twitter/X API (for @chirri_io automation):**
   - `TWITTER_API_KEY`, `TWITTER_API_SECRET`
   - `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_SECRET`

5. **Railway-specific:**
   - `RAILWAY_ENVIRONMENT` (production/staging, for logging context)
   - `RAILWAY_GIT_COMMIT_SHA` (for version tracking in logs)

6. **Slack/Discord OAuth (V1.1, but prepare):**
   - `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
   - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`

7. **PM integrations:**
   - `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`
   - `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`
   - `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

8. **Feature flags (for gradual rollout):**
   - `FEATURE_MCP_ENABLED`
   - `FEATURE_PM_INTEGRATIONS_ENABLED`

**Proposed complete .env.template:**

```bash
# Database
DATABASE_URL=postgresql://...
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL=redis://...

# R2 Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=chirri-snapshots

# Node
NODE_ENV=production
LOG_LEVEL=info

# Security
INTERNAL_API_TOKEN=...
ENCRYPTION_MASTER_KEY=...  # 32-byte hex for AES-256

# Auth
BETTER_AUTH_SECRET=...  # 32-byte random string
BETTER_AUTH_URL=https://api.chirri.io

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PERSONAL=price_...
STRIPE_PRICE_TEAM=price_...
STRIPE_PRICE_BUSINESS=price_...

# CORS
DASHBOARD_ORIGIN=https://chirri.io

# Monitoring
SENTRY_DSN=https://...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM="Chirri <chirp@chirri.io>"

# LLM
OPENAI_API_KEY=sk-...

# Twitter/X (optional, for @chirri_io automation)
TWITTER_API_KEY=...
TWITTER_API_SECRET=...
TWITTER_ACCESS_TOKEN=...
TWITTER_ACCESS_SECRET=...

# PM Integrations (V1.1)
JIRA_CLIENT_ID=...
JIRA_CLIENT_SECRET=...
LINEAR_CLIENT_ID=...
LINEAR_CLIENT_SECRET=...
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Worker
WORKER_ID=worker-01
USER_AGENT="Chirri-Monitor/1.0 (https://chirri.io; monitoring service)"

# Railway (auto-injected)
PORT=...
RAILWAY_ENVIRONMENT=...
RAILWAY_GIT_COMMIT_SHA=...

# Feature Flags
FEATURE_MCP_ENABLED=true
FEATURE_PM_INTEGRATIONS_ENABLED=false
```

**Assessment:** Env vars list is **incomplete**. Add the above to Bible Appendix D.

---

## 9. GDPR DELETION CASCADE

### **Does the cascade ACTUALLY work? What's the order? What if it fails midway?**

**Current spec (§8.9):**

15 tables to delete from:
- users (anonymize)
- api_keys, urls, url_secrets, oauth_tokens, integrations, tickets, feedback (hard delete)
- user_changes, user_forecasts, signal_matches, source_alert_preferences, webhooks, webhook_deliveries, notifications (hard delete)
- learning_samples (CASCADE from urls → shared_url)

**Deletion order matters:**

Foreign key constraints require **child → parent** deletion:

1. **webhook_deliveries** (FK: webhook_id)
2. **webhooks** (FK: user_id)
3. **notifications** (FK: user_id)
4. **tickets** (FK: user_id, change_id, integration_id)
5. **integrations** (FK: user_id, oauth_token_id)
6. **oauth_tokens** (FK: user_id)
7. **source_alert_preferences** (FK: user_id)
8. **signal_matches** (FK: user_id)
9. **user_forecasts** (FK: user_id, forecast_id)
10. **user_changes** (FK: user_id, change_id)
11. **url_secrets** (FK: user_id, url_id)
12. **urls** (FK: user_id)
13. **api_keys** (FK: user_id)
14. **feedback** (FK: user_id)
15. **users** (anonymize)

**Implementation:**

```typescript
async function deleteUserAccount(userId: string): Promise<void> {
    return await db.transaction(async (tx) => {
        // Child tables first
        await tx.delete(webhook_deliveries)
            .where(inArray(webhook_deliveries.webhook_id, 
                tx.select({ id: webhooks.id }).from(webhooks).where(eq(webhooks.user_id, userId))
            ));
        
        await tx.delete(webhooks).where(eq(webhooks.user_id, userId));
        await tx.delete(notifications).where(eq(notifications.user_id, userId));
        await tx.delete(tickets).where(eq(tickets.user_id, userId));
        await tx.delete(integrations).where(eq(integrations.user_id, userId));
        await tx.delete(oauth_tokens).where(eq(oauth_tokens.user_id, userId));
        await tx.delete(source_alert_preferences).where(eq(source_alert_preferences.user_id, userId));
        await tx.delete(signal_matches).where(eq(signal_matches.user_id, userId));
        await tx.delete(user_forecasts).where(eq(user_forecasts.user_id, userId));
        await tx.delete(user_changes).where(eq(user_changes.user_id, userId));
        await tx.delete(url_secrets).where(eq(url_secrets.user_id, userId));
        
        // URLs (triggers CASCADE to learning_samples via shared_url)
        const userUrls = await tx.select({ shared_url_id: urls.shared_url_id })
            .from(urls)
            .where(eq(urls.user_id, userId));
        
        await tx.delete(urls).where(eq(urls.user_id, userId));
        
        // Decrement shared_urls.subscriber_count, delete if 0
        for (const { shared_url_id } of userUrls) {
            if (!shared_url_id) continue;
            
            const updated = await tx.update(shared_urls)
                .set({ subscriber_count: sql`subscriber_count - 1` })
                .where(eq(shared_urls.id, shared_url_id))
                .returning({ count: shared_urls.subscriber_count });
            
            if (updated[0].count === 0) {
                await tx.delete(baselines).where(eq(baselines.shared_url_id, shared_url_id));
                await tx.delete(learning_samples).where(eq(learning_samples.shared_url_id, shared_url_id));
                await tx.delete(shared_urls).where(eq(shared_urls.id, shared_url_id));
            }
        }
        
        await tx.delete(api_keys).where(eq(api_keys.user_id, userId));
        await tx.delete(feedback).where(eq(feedback.user_id, userId));
        
        // Anonymize user (keep row for referential integrity)
        await tx.update(users).set({
            email: `deleted-${userId}@chirri.io`,
            password_hash: 'DELETED',
            name: null,
            stripe_customer_id: null,
            stripe_subscription_id: null,
        }).where(eq(users.id, userId));
        
        // Cancel Stripe subscription
        if (user.stripe_subscription_id) {
            await stripe.subscriptions.cancel(user.stripe_subscription_id);
        }
    });
}
```

**What if it fails midway?**

The **transaction** ensures atomicity. If any DELETE fails, the entire transaction rolls back. User data remains intact.

**But what if Stripe API call fails?**

Stripe call is **inside the transaction**. If it fails, transaction aborts. This is **wrong** -- Stripe failure shouldn't block GDPR deletion.

**Fix:**

```typescript
// Delete from DB first (atomic)
await db.transaction(async (tx) => { /* all DELETEs */ });

// Then cancel Stripe (best-effort)
try {
    if (user.stripe_subscription_id) {
        await stripe.subscriptions.cancel(user.stripe_subscription_id);
    }
} catch (err) {
    logger.error({ err, userId }, 'Failed to cancel Stripe subscription during deletion');
    // Continue -- DB already clean
}
```

**Assessment:** Cascade order is **correct** but implementation must move Stripe call **outside transaction**.

---

## 10. MONITORING CHIRRI ITSELF

### **If OUR service goes down, how do we know? Who gets paged?**

**Current spec (§D.14):**

> 1. External canary: Monitor httpbin.org/get as a real URL
> 2. Health endpoint: /health (DB, Redis, queue depth, last check)
> 3. Queue depth alerting: >500 = warning, >2000 = critical
> 4. Worker heartbeat: Redis key updated every 60s
> 5. Daily digest validation: verify ≥1 email sent

**Implementation:**

**1. UptimeRobot checks /health every 5 minutes**

UptimeRobot Free: 50 monitors, 5-min intervals. Alert via email if /health returns non-200.

**2. Internal canary monitor**

Chirri monitors itself:
```typescript
// In discovery or setup:
await createMonitor({
    url: 'https://httpbin.org/get',
    name: '[INTERNAL] Canary Check',
    internal: true,  // Hidden from user dashboard
    alert_email: 'alex@chirri.io',  // Direct to admin
});
```

If this monitor stops producing check_results, the pipeline is broken.

**3. Queue depth metrics**

Daily cron (§5.7) checks queue depths:
```typescript
const depths = {
    urlChecks: await urlChecksQueue.count(),
    notifications: await notificationsQueue.count(),
    // ... all queues
};

if (depths.urlChecks > 2000) {
    await sendAlert({
        severity: 'critical',
        message: `url-checks queue depth: ${depths.urlChecks}`,
        channel: 'telegram',  // Or PagerDuty when we have it
    });
}
```

**4. Worker heartbeat**

Each worker:
```typescript
setInterval(() => {
    redis.setex(`worker:heartbeat:${WORKER_ID}`, 120, Date.now());
}, 60000);
```

Scheduler checks:
```typescript
// Every 5 minutes
const workers = ['worker-01', 'worker-02'];
for (const id of workers) {
    const heartbeat = await redis.get(`worker:heartbeat:${id}`);
    if (!heartbeat) {
        logger.error({ worker: id }, 'Worker heartbeat missing');
        // Alert
    }
}
```

**5. Sentry error tracking**

All services send errors to Sentry. Alert on:
- Error rate >1% (5xx responses)
- New error type (first occurrence)
- Error spike (>10x baseline)

**Who gets paged?**

At MVP: Alex only. Alerts via:
- UptimeRobot → email
- Queue depth → Telegram (fast)
- Sentry → email (configurable to Slack/Discord/PagerDuty)

**When to add PagerDuty:**

When we have >100 paying users OR when Alex is not the only person maintaining Chirri.

**Assessment:** Self-monitoring is **adequate for MVP**. Add PagerDuty when scaling beyond solo dev.

---

## SUMMARY: GAPS & ACTION ITEMS

| # | Gap | Action | Priority |
|---|---|---|---|
| 1 | Bulk import plan limit behavior not specified | Add to CHIRRI_URL_ONBOARDING_FLOW.md | **High** |
| 2 | Downgrade URL selection UX missing | Add to CHIRRI_FRONTEND_BIBLE.md | **High** |
| 3 | Dunning email templates (4 emails) missing | Create email templates | **Medium** |
| 4 | Annual billing Stripe Price IDs not created | Create in Stripe dashboard | **Medium** |
| 5 | Environment variables list incomplete | Add to Bible Appendix D | **High** |
| 6 | GDPR deletion Stripe call inside transaction | Move outside, make best-effort | **Critical** |
| 7 | Worker health check endpoint missing | Add `/health` to workers on port 3001 | **High** |
| 8 | Snapshot deduplication (optimization) | V1.1 feature, not MVP | Low |
| 9 | Feature flags for gradual rollout | Add to env vars, implement toggles | **Medium** |
| 10 | PagerDuty integration | V1.1, when >100 paying users | Low |

**Overall assessment:** Infrastructure is **90% production-ready**. The 10% is mostly documentation gaps and minor UX details, not architectural flaws.

**Critical path to launch:**
1. Fix GDPR Stripe call (move outside transaction)
2. Complete env vars list
3. Implement bulk import limit behavior
4. Add worker health endpoint
5. Create downgrade URL selection UI
6. Write dunning email templates

**Everything else can be done in parallel or post-MVP.**

---

**End of practical review. Ready to build.**
