# CHIRRI — Unknown Unknowns: The Blind Spot Report

**Author:** Opus (Blind Spot Hunter)  
**Date:** 2026-03-24  
**Purpose:** Every underwater rock, invisible wall, and 3am pager that nobody planned for.

> "It's not the things you don't know that get you. It's the things you don't know you don't know."

---

## Table of Contents

1. [Technical Unknowns](#1-technical-unknowns)
2. [User Behavior Unknowns](#2-user-behavior-unknowns)
3. [Infrastructure Unknowns](#3-infrastructure-unknowns)
4. [Business & Legal Unknowns](#4-business--legal-unknowns)
5. [Competitive Unknowns](#5-competitive-unknowns)
6. [Edge Cases Nobody Thinks About](#6-edge-cases-nobody-thinks-about)
7. [Operational Unknowns](#7-operational-unknowns)
8. [The Compound Failures](#8-the-compound-failures)
9. [Summary: The Launch Day Checklist](#9-summary-the-launch-day-checklist)

---

## 1. Technical Unknowns

### T-01: jsondiffpatch on Real-World Responses at Scale

**What is it?** The spec bets everything on jsondiffpatch for JSON structural diffing. But has anyone benchmarked it against the kind of responses real APIs actually return? Stripe's `/v1/prices` list endpoint can return paginated arrays of 100+ deeply nested objects. OpenAI's `/v1/models` returns 100+ models with nested permission arrays.

**Why is it dangerous?** jsondiffpatch uses LCS (Longest Common Subsequence) for array diffing. LCS is O(n²) in time and space. An array of 500 objects where half of them changed means ~250,000 comparisons. Multiply by 10 concurrent workers, each diffing responses, and the workers could lock up under load.

**Likelihood:** Likely  
**Impact:** Major — workers freeze, checks back up, queue grows, cascade failure  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Benchmark jsondiffpatch with 100+ real API responses collected during pre-launch monitoring (the 50 APIs from Week 5)
- Set a **timeout on the diff operation itself** (500ms max). If it takes longer, fall back to hash-only comparison
- For arrays >50 elements, skip LCS and use ID-based matching only (already partially planned)
- Consider `fast-json-patch` as a lighter alternative for simple diffs

**When to address:** Before launch — Week 6 testing

---

### T-02: The 4.9MB Response Cliff

**What is it?** The spec sets a 5MB response limit and says "for responses >1MB, fall back to hash-only comparison." But what about the gap between 1MB and 5MB? We still download the full body (up to 5MB), store it in R2, and compute the SHA-256 hash. That's 5MB of memory allocation per check. With 10 concurrent workers × 2 instances = up to 100MB just in response buffers.

**Why is it dangerous?** Railway containers have memory limits. If multiple checks simultaneously hit large responses, the worker OOMs. Node.js garbage collection under memory pressure is notoriously laggy, causing all concurrent checks to slow down (GC pause storm).

**Likelihood:** Possible  
**Impact:** Major — worker crash, missed checks, restart loop  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Stream response bodies instead of buffering: compute hash incrementally using `crypto.createHash('sha256').update(chunk)` as chunks arrive
- Set a per-worker memory budget and track it: if total buffered responses exceed 200MB, start rejecting new check jobs (let them requeue)
- For responses >1MB: stream directly to R2, compute hash during streaming, never hold full body in memory
- Consider `undici`'s `body.pipeline()` for zero-copy streaming

**When to address:** Before launch — Week 2 when building check worker

---

### T-03: False Positive Rate Claim Is Unvalidated

**What is it?** The spec claims "<0.1% false positive rate" but this number appears to be aspirational, not measured. The 48-hour zero-false-positive validation in Week 7 tests 50 URLs for 48 hours. That's ~2,400 checks. At 0.1%, we'd expect 2.4 false positives — not enough statistical power to validate the claim.

**Why is it dangerous?** If the real FP rate is 1%, with 1,000 URLs at hourly checks, that's 240 false alerts per day across all users. Users will mark the tool as "the boy who cried wolf" and churn. The spec itself says "if 2 false positives happen: 'This tool is useless.'"

**Likelihood:** Certain (that we don't actually know the rate)  
**Impact:** Catastrophic — churn, reputation damage, product failure  
**Can we test before launch?** Partially — need diverse URLs and longer test  
**Recommended mitigation:**
- Extend pre-launch monitoring to 200+ URLs across 20+ different providers for 2+ weeks (not just 50 URLs for 48 hours)
- **Measure FP rate per URL type** — RSS feeds will have near-zero FP, raw JSON APIs will have higher FP, HTML pages will have much higher FP
- Implement a **shadow mode** for first 100 users: detect changes but don't alert, send weekly summary. Let users retroactively flag what they would have considered FP.
- Track FP rate as a first-class metric in `/internal/metrics` from day one

**When to address:** Before launch — extend testing period

---

### T-04: Auto-Classification Accuracy on "Weird" URLs

**What is it?** The classification pipeline has 3 phases: domain pattern match → response-based → fallback. But what percentage of real-world URLs submitted by users will match the 10 hardcoded domain patterns? Probably less than 30%. The remaining 70%+ go through response-based classification, which checks Content-Type and tries to parse the body.

**Why is it dangerous?** A URL like `https://internal-company.com/api/v3/config` won't match any domain pattern. The response might be JSON with nested objects — but is it a REST API response, a config file, a GraphQL response, or a static JSON file? If we classify it wrong, the monitoring method is wrong, and false positive rate skyrockets for that URL.

**Likelihood:** Likely — most user URLs won't match hardcoded patterns  
**Impact:** Major — wrong classification → wrong monitoring → bad detection  
**Can we test before launch?** Partially  
**Recommended mitigation:**
- The fallback (json-diff with learning period) is actually fine for most cases — don't over-engineer classification
- **Log every classification result** with the URL and response sample for post-launch analysis
- Allow users to override classification manually (already planned via `PATCH /v1/urls/:id/monitoring`)
- Add a "classifier confidence" warning in the dashboard: "We're 60% confident about this monitoring strategy. If you see false positives, try switching to hash-only mode."
- Expand domain patterns rapidly post-launch based on actual user URLs

**When to address:** First month — analyze classification data from real users

---

### T-05: Connection Pooling with undici at Scale

**What is it?** undici manages connection pools per origin. With 10 concurrent workers checking diverse URLs, we'll have connections to potentially thousands of different origins. undici's default pool size is `pipelining: 1` (no pipelining) with connection reuse per origin.

**Why is it dangerous?** If we check the same domain frequently (e.g., 50 users monitor different Stripe endpoints), undici creates and maintains a pool of connections to `api.stripe.com`. But if Stripe rotates IPs or load balancer instances, those pooled connections go stale. Stale connections cause ECONNRESET errors that look like "API is down" when it isn't — false availability alerts.

**Likelihood:** Possible  
**Impact:** Minor to Major — false availability alerts on high-profile APIs  
**Can we test before launch?** Partially  
**Recommended mitigation:**
- Set `keepAliveTimeout: 30000` (30s) and `keepAliveMaxTimeout: 60000` (60s) in undici dispatcher options
- Use a fresh undici `Agent` per check (not a shared pool) — this adds connection overhead but eliminates stale connection issues. The per-domain rate limit (1 req/sec) means we're not making enough requests to benefit from pooling anyway.
- Monitor ECONNRESET rates per domain as an operational metric

**When to address:** Before launch — Week 2

---

### T-06: Postgres Partitioning with pg_partman on Railway

**What is it?** The architecture calls for `check_results` to be partitioned by month using pg_partman. But Railway's managed Postgres may not have pg_partman installed, or may not support the extension.

**Why is it dangerous?** Without partitioning, `check_results` grows unbounded. At 5,000 URLs × 24 checks/day × 30 days = 3.6M rows in the first month. By month 6, 21.6M rows. Queries on this table (especially for URL detail pages showing check history) become progressively slower. Retention purge requires `DELETE FROM check_results WHERE checked_at < X` — which on an unpartitioned table of millions of rows causes table locks and kills performance.

**Likelihood:** Likely (that pg_partman isn't available on Railway)  
**Impact:** Major — performance degrades over months, eventually critical  
**Can we test before launch?** Yes — check Railway Postgres extensions  
**Recommended mitigation:**
- **Day 1:** Check if pg_partman is available: `SELECT * FROM pg_available_extensions WHERE name = 'pg_partman';`
- **If not available:** Implement manual partitioning using Postgres native range partitioning (available since PG 10, no extension needed):
  ```sql
  CREATE TABLE check_results (...) PARTITION BY RANGE (checked_at);
  CREATE TABLE check_results_2026_03 PARTITION OF check_results 
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
  ```
  - Use the scheduler cron to create next month's partition and drop old ones
- **Alternative:** Use a time-series approach — archive to R2 after 7 days (already planned), aggressive `DELETE` in small batches during off-peak hours
- Consider `citus` extension for distributed tables if Railway supports it

**When to address:** Before launch — Week 1 during DB setup

---

### T-07: BullMQ Failure Modes at Scale

**What is it?** BullMQ stores all job data in Redis. Each job payload includes the URL, method, headers, subscriber IDs, and baseline reference. At scale, Redis memory becomes the bottleneck.

**Why is it dangerous?** 
- Redis on Railway's hobby plan has limited memory (likely 25-100MB)
- Each BullMQ job consumes ~1-5KB of Redis memory
- With 4 queues, 5,000 URLs, and delayed/scheduled jobs, we could have 50,000+ Redis keys
- BullMQ's `removeOnComplete` setting is crucial — if set to `false` or too high, completed jobs accumulate and consume memory
- If Redis hits maxmemory, BullMQ fails to enqueue new jobs → all monitoring stops
- Redis eviction policies (noeviction, allkeys-lru, etc.) interact badly with BullMQ — evicting a job mid-processing causes undefined behavior

**Likelihood:** Likely (at 1,000+ URLs)  
**Impact:** Catastrophic — all monitoring stops  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Set `removeOnComplete: { age: 3600, count: 1000 }` (keep last 1000 completed jobs for max 1 hour)
- Set `removeOnFail: { age: 86400 }` (keep failed jobs for 24h then clean)
- **Monitor Redis memory** as a top-line metric: alert at 70% of max memory
- Set Redis `maxmemory-policy noeviction` — better to fail loudly than silently lose jobs
- Calculate expected Redis memory: `(avg_job_size × concurrent_jobs × queues) + (completed_retention × throughput/hour)`. Budget this explicitly.
- Consider Railway's Redis memory limit and choose the right plan size

**When to address:** Before launch — Week 1

---

### T-08: IP Flagging / Bot Detection by Monitored APIs

**What is it?** When Chirri monitors a popular API, all checks come from the same Railway IP addresses. The target API might flag these IPs as suspicious (too many requests from one source) and start returning different content — CAPTCHAs, rate limit responses, or outright blocks.

**Why is it dangerous?** If Stripe starts rate-limiting or blocking Chirri's IP, ALL users monitoring Stripe are affected simultaneously. Worse: if Stripe returns a 429 or Cloudflare challenge page, Chirri might interpret this as "the API changed" and send false alerts to every Stripe-monitoring user at once. A false-positive cascade.

**Likelihood:** Likely (for popular APIs with many monitors)  
**Impact:** Catastrophic — mass false alerts, reputation destruction  
**Can we test before launch?** Partially  
**Recommended mitigation:**
- **Detect rate-limit responses**: 429 status codes should NEVER trigger change alerts. They should be categorized as transient errors.
- **Detect Cloudflare/bot-protection pages**: check if response body contains Cloudflare challenge markers. Classify as `limited` status, not a "change."
- **The circuit breaker is critical**: if >50% of checks for a domain fail → stop checking, alert ops, don't alert users about changes
- **Transparent User-Agent**: `Chirri-Monitor/1.0 (https://chirri.io; monitoring service)` — some APIs whitelist monitoring services
- **Register with major API providers**: proactively email Stripe, OpenAI, GitHub etc. to whitelist Chirri's IP range. This is standard practice for monitoring services.
- **Consider using residential proxies** for critical checks (expensive but reliable)

**When to address:** Before launch — implement detection; first month — register with providers

---

### T-09: The Learning Period Creates a Blind Spot

**What is it?** During the 10-minute learning period, Chirri makes 30 rapid checks but sends ZERO alerts. During the 7-day calibration, the confidence threshold is raised to 95. What if a breaking change happens during these periods?

**Why is it dangerous?** User adds a URL at 2pm. At 2:05pm, the API pushes a breaking change. Chirri's learning period suppresses it. User thinks they're protected but they're not. The change gets baked into the baseline. User never finds out until they manually check.

**Likelihood:** Possible (rare per-URL but certain to happen across all users)  
**Impact:** Major — silent missed detection, trust violation  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- During learning, if the response changes significantly between rapid checks (e.g., schema hash changes), flag it but don't suppress it entirely. Show in dashboard: "⚠️ We detected changes during the learning period. These may be volatile or may be real changes."
- **Store the full learning history** so users can retroactively review what happened
- During calibration: if a change would score above 90 confidence (not just 95), alert anyway. Only suppress truly borderline changes.
- Add a "force alert" option: user can opt in to receiving ALL change alerts even during learning/calibration

**When to address:** Before launch — Week 2-3

---

### T-10: Shared Monitoring Key Collision

**What is it?** The shared URL key is `SHA-256(url + method + sorted headers)`. Two users monitoring the same URL with `GET` and identical headers share the same monitor. But what if User A has `Accept: application/json` and User B has `accept: application/json` (different casing)? The headers are different strings, so they get different monitors — making two HTTP requests instead of one.

**Why is it dangerous?** Header casing inconsistency means deduplication fails silently. Instead of one request to Stripe, we make two. At scale, this doubles our outbound request volume, potentially triggering rate limits from target APIs. Worse: if we normalize headers for the key but NOT for the actual request, the request might behave differently than expected.

**Likelihood:** Certain — HTTP headers are case-insensitive, users WILL use different casings  
**Impact:** Minor — wasted resources, potential rate limiting  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Normalize header names to lowercase AND values to trimmed strings before computing the shared URL key
- Normalize the URL itself: lowercase scheme and host, sort query parameters, remove default ports, resolve `.` and `..` in path
- Document the normalization rules so users understand when monitors are shared

**When to address:** Before launch — Week 2

---

## 2. User Behavior Unknowns

### U-01: Same URL with Trivial Variations

**What is it?** User adds `https://api.stripe.com/v1/prices` and `https://api.stripe.com/v1/prices/` (trailing slash). Or `http://api.stripe.com/v1/prices` vs `https://api.stripe.com/v1/prices`. The spec has `UNIQUE (user_id, url_hash)` but what normalization is applied before hashing?

**Why is it dangerous?** Without normalization, users waste their URL quota on duplicates, get confused by "two monitors for the same thing showing different results" (because timing differs), and Chirri makes unnecessary requests.

**Likelihood:** Certain  
**Impact:** Minor — user confusion, wasted quota  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Normalize URLs before hashing: remove trailing slashes, lowercase scheme+host, sort query params, remove default ports (80/443), strip fragments
- On duplicate detection, return a helpful error: "You're already monitoring this URL (url_id). The trailing slash is ignored."
- Consider a "similar URL" warning: "You're monitoring api.stripe.com/v1/prices. Did you mean to add a different endpoint?"

**When to address:** Before launch — Week 2

---

### U-02: Monitoring URLs That Change Every Request

**What is it?** User monitors `https://api.example.com/v1/status` which returns a response like `{"status": "ok", "uptime": 99.997, "request_id": "abc123", "server_time": "2026-03-24T12:00:00Z", "random_nonce": "xk9f3"}`. Every field changes on every request.

**Why is it dangerous?** The volatile field detection (>50% change rate in learning) should catch `request_id`, `server_time`, and `random_nonce`. But `uptime` changes slightly each time (99.997 → 99.996). The learning period might mark it as volatile, or might not (it changes but not by much). Result: constant low-confidence change alerts that aren't really meaningful.

**Likelihood:** Likely  
**Impact:** Minor per-user but alert fatigue at scale  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Volatile field detection should consider **numeric proximity**, not just exact match: if a numeric field changes by <1% between checks, treat it as volatile
- Add a "numeric tolerance" config per URL: "Ignore numeric changes under X%"
- The stableHash (excluding volatile fields) should handle most of this, but edge cases with slowly drifting numbers will slip through

**When to address:** First month — observe real usage patterns

---

### U-03: User Monitors a Login Page or HTML App

**What is it?** User pastes `https://dashboard.stripe.com/login` hoping to "monitor the Stripe API." Gets back an HTML page with CSRF tokens, nonces, and session-specific content that changes on every request.

**Why is it dangerous?** Classification should detect this as HTML (not JSON API), but the user expects API monitoring. They'll see constant "content changed" alerts (because the HTML has dynamic elements) and think the tool is broken.

**Likelihood:** Likely  
**Impact:** Minor — user frustration, bad first impression  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- When classification detects HTML with login form elements: show a specific message: "This looks like a login page, not an API endpoint. Did you mean to monitor the API at api.stripe.com?"
- For provider intelligence URLs: when user adds a dashboard/login URL for a known provider, redirect them to the actual API endpoints
- For HTML monitoring: use content-hash method and only alert on structural HTML changes, not dynamic element changes
- Consider declining to monitor URLs that are clearly not APIs (login pages, SPA shells) with a helpful error

**When to address:** Before launch — Week 3 during classification

---

### U-04: 500 URLs Added in One Minute (Business Plan)

**What is it?** Business plan user uses the bulk endpoint to add 500 URLs simultaneously. Each URL triggers a learning period with 30 rapid checks at 20-second intervals. That's 500 × 30 = 15,000 learning checks in 10 minutes = 25 checks/second.

**Why is it dangerous?** The learning-checks queue gets flooded with 15,000 jobs. Workers process 10 concurrent jobs = 15,000 / 10 = 1,500 seconds = 25 minutes to process. But each job has a 20-second spacing, so they need to execute within their timing window. Some URLs will time out during learning, the queue will build up, and the scheduler's regular checks will compete for worker capacity.

**Likelihood:** Possible  
**Impact:** Major — system overload, degraded service for all users  
**Can we test before launch?** Yes (k6 load test)  
**Recommended mitigation:**
- **Rate-limit URL creation**: max 10 URLs per minute even on Business plan (documented in API)
- **Stagger learning periods**: don't start all 500 learning sessions simultaneously. Queue them and start 10 at a time, with 10-minute gaps between batches.
- **Learning queue priority**: learning checks should be LOWER priority than regular scheduled checks. If the system is under load, delay learning.
- **Implement a "learning budget"** per account: max 5 URLs in learning simultaneously

**When to address:** Before launch — Week 3

---

### U-05: Alert Fatigue vs. "Is This Thing Working?"

**What is it?** Two opposite failure modes: (1) User monitors 50 APIs, gets 20 alerts per week, stops reading them, misses the one critical breaking change. (2) User monitors 3 stable APIs, gets zero alerts for 3 months, wonders if they're paying for nothing.

**Why is it dangerous?** Both lead to churn. The spec addresses #2 with weekly stability reports and TTFB/uptime tracking, but doesn't address #1 at all. Alert fatigue is the silent killer of monitoring products.

**Likelihood:** Certain  
**Impact:** Major — churn  
**Can we test before launch?** No — requires real usage data  
**Recommended mitigation:**
- **For alert fatigue:**
  - Default notification to `breaking` and `critical` only — users must opt in to `warning` and `info`
  - Daily digest option: batch non-critical alerts into a single daily email
  - "Snooze" per URL: "Don't alert me about this URL for 24h"
  - Track "notification open rate" — if a user hasn't opened/clicked an alert in 30 days, they're probably ignoring them
- **For "is it working":**
  - Weekly stability report (already planned — good)
  - Monthly "Chirri caught X potential issues across your APIs" email even if nothing broke
  - Dashboard "last activity" indicator: "System healthy. Last check: 2 minutes ago."
  - Consider a "monthly API health report" PDF that users can share with their team

**When to address:** First month — implement daily digest; ongoing — monitor engagement

---

### U-06: International Users — Timezone and Encoding

**What is it?** Users in different timezones expect alerts during their business hours. API responses may contain non-UTF-8 content. URLs may contain non-ASCII characters (IDN domains, emoji paths).

**Why is it dangerous?** 
- "Quiet hours" in the spec are per-user, but the scheduler runs on UTC. If the user sets quiet hours 23:00-08:00 in JST, that's 14:00-23:00 UTC. Simple to implement but easy to get wrong with DST.
- Non-UTF-8 responses (Shift-JIS, EUC-KR, ISO-8859-1) will break JSON parsing, produce garbled diffs, and potentially cause Node.js buffer errors.
- IDN domains (punycode) need special handling in the SSRF module.

**Likelihood:** Certain (for international users)  
**Impact:** Minor to Major depending on encoding issues  
**Can we test before launch?** Partially  
**Recommended mitigation:**
- Store all user timezones as IANA timezone strings (already in schema: `timezone TEXT DEFAULT 'UTC'`)
- Use `Intl.DateTimeFormat` or `luxon` for timezone-aware alert scheduling — never do manual UTC offset math
- Detect response encoding from `Content-Type: charset=` header and convert to UTF-8 using `iconv-lite` before processing
- For IDN domains: normalize to punycode before SSRF checks (Node.js `URL` constructor does this automatically)
- Test with URLs containing: Chinese characters, emoji, Arabic right-to-left text, and Cyrillic characters

**When to address:** Before launch — basic encoding handling; first month — timezone edge cases

---

### U-07: Teams and Access Control

**What is it?** The spec mentions team seats (Pro: 3, Business: 10) but there's no `teams` table, no invitation flow, no RBAC. What happens when two team members both want to acknowledge the same change? Or one team member adds a URL and another deletes it?

**Why is it dangerous?** Without teams, the product is single-user only. The pricing includes team seats but there's no implementation plan. Enterprise buyers won't consider a tool without team access. This is a gap between what's promised (pricing table) and what's built (nothing).

**Likelihood:** Certain (that team features will be needed)  
**Impact:** Major — blocks Pro/Business sales  
**Can we test before launch?** N/A  
**Recommended mitigation:**
- **MVP: skip teams entirely.** Remove team seat numbers from pricing. Indie and Free are single-user. Period.
- **V1.1 (weeks 9-12):** Add basic teams: invite by email, shared URL list, shared change feed. No RBAC — all team members have equal access.
- **V2:** RBAC (admin/member/viewer), audit log, SSO
- Don't sell what you haven't built. Adjust pricing table before launch.

**When to address:** Before launch — remove team seat claims from pricing page

---

## 3. Infrastructure Unknowns

### I-01: Railway Cold Starts and Worker Recovery

**What is it?** Railway may scale down idle services or restart them during deploys. What's the actual cold start time for the check worker service? The graceful shutdown handles SIGTERM, but what about SIGKILL (force kill after timeout)?

**Why is it dangerous?** During a deploy, Railway sends SIGTERM, waits ~10 seconds, then SIGKILL. If active checks take >10 seconds (large response bodies, slow target APIs), those checks are killed mid-flight. BullMQ marks them as "stalled" and eventually retries — but the stall detection window is 30 seconds by default. During that window, the URL doesn't get checked, and the retry might happen on the new instance before it's fully warmed up.

**Likelihood:** Certain (on every deploy)  
**Impact:** Minor — brief monitoring gap during deploys  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Set BullMQ `stalledInterval: 15000` (15s, down from default 30s) for faster stalled job recovery
- Set Railway graceful shutdown timeout higher if possible (check Railway docs)
- **Blue-green deploys**: keep old worker running until new worker is confirmed healthy. Railway may support this via `numReplicas` temporarily set to 3 during deploy.
- The "missed-check recovery" on startup (already planned) covers the gap, but add logging so we can measure the actual gap duration

**When to address:** Before launch — Week 7 deployment testing

---

### I-02: Railway Postgres IOPS and Storage Limits

**What is it?** Railway managed Postgres has undocumented IOPS limits. The `check_results` table will be the highest-write-volume table, with potentially thousands of INSERTs per hour. Railway's Starter plan may not handle this.

**Why is it dangerous?** If IOPS are throttled, write latency increases, check workers block on DB writes, jobs time out, queue backs up. The insidious part: this degrades gradually. Everything works fine at 100 URLs, gets a bit slow at 500, and falls apart at 2,000.

**Likelihood:** Possible  
**Impact:** Major — performance degradation at scale  
**Can we test before launch?** Partially (k6 load test)  
**Recommended mitigation:**
- **Batch inserts**: instead of one INSERT per check, batch 10-50 results and INSERT in a single transaction
- **Reduce write volume**: only write to `check_results` when something changed or on every Nth check (e.g., every 10th check for stable URLs). For stable URLs, just update `urls.last_check_at`.
- **Async writes**: write to `check_results` after the check is complete and the worker has released the job. Use a separate write queue or just fire-and-forget (if we lose a few historical records, it's OK).
- **Monitor Postgres stats**: `pg_stat_user_tables` for sequential scans, `pg_stat_activity` for blocked queries
- **Budget Railway plan**: don't use Starter/Hobby. Use Pro ($20/mo for DB) which has better resource guarantees.

**When to address:** Before launch — test with k6 in Week 7

---

### I-03: Railway Egress and IP Assignment

**What is it?** Chirri makes outbound HTTP requests to arbitrary URLs. Railway charges for egress bandwidth and may throttle high-volume outbound traffic. Also: Railway assigns dynamic IPs from shared pools. Some target APIs whitelist IPs — and our IP will be shared with other Railway customers' traffic.

**Why is it dangerous?** 
- If another Railway customer uses the same IP to spam an API, that IP gets blocked. Chirri's checks to that API fail — for a reason completely outside our control.
- If Railway rotates our IP, any target APIs that implicitly track our "monitoring IP" might see requests from a new IP and behave differently (different rate limits, different content based on geo-IP).
- Static IP on Railway requires a custom domain with a reverse proxy, adding complexity.

**Likelihood:** Possible  
**Impact:** Minor to Major depending on IP reputation  
**Can we test before launch?** Partially  
**Recommended mitigation:**
- **Accept that IP reputation is shared** — this is inherent to any shared cloud platform
- **Consider a proxy layer**: route outbound checks through a fixed proxy (e.g., Smartproxy, Bright Data) for $50-100/mo. This gives static IPs and prevents Railway IP issues. Only needed if IP blocking becomes a real problem.
- **Monitor check failure rates per domain**: sudden spikes in failures for a popular domain may indicate IP blocking
- **Long-term**: consider dedicated infrastructure (VPS with static IP) for the check workers specifically

**When to address:** First month — monitor, add proxy if needed

---

### I-04: What Happens During Railway Deploy?

**What is it?** The spec assumes 3 separate Railway services. During a deploy, all instances of a service restart. What's the deploy strategy? Rolling? Blue-green? All-at-once?

**Why is it dangerous?** If all-at-once (Railway's default for single-instance services):
- API server: 10-30 seconds of downtime. Dashboard users see errors. API clients get 502.
- Scheduler: misses one scheduling cycle (1 minute). Checks scheduled during this window are late.
- Workers: both instances restart. 30-60 seconds with zero check processing capacity. Queue grows.

**Likelihood:** Certain (on every deploy)  
**Impact:** Minor — brief service interruption  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- **Workers**: `numReplicas: 2` means Railway does rolling restarts (one at a time). Verify this behavior.
- **API server**: single instance, so deploy causes brief downtime. Put Cloudflare in front with short cache (already planned) to serve stale responses during deploy.
- **Scheduler**: has a Redis lock (`SETNX`). If the scheduler restarts, the lock expires (60s TTL), and the new instance acquires it. But during the gap, no new checks are scheduled. The missed-check recovery on startup handles this.
- **Deploy during low traffic**: establish a deploy window (e.g., 03:00-05:00 UTC) when most users' checks have slack
- **Never deploy all three services simultaneously**: deploy workers first, verify health, then scheduler, then API server

**When to address:** Before launch — Week 5 deployment strategy

---

### I-05: Redis Persistence and Data Loss

**What is it?** Railway managed Redis persistence settings are undocumented. BullMQ stores all job state in Redis. If Redis restarts without persistence (or with RDB snapshots every 5 minutes), up to 5 minutes of job state is lost.

**Why is it dangerous?** Lost job state means:
- In-flight check results are lost (not written to DB yet)
- Scheduled jobs disappear (checks are missed until the scheduler re-enqueues them)
- Confirmation recheck jobs are lost (changes that were detected but awaiting confirmation are silently dropped)
- Rate limit counters reset (briefly allows burst traffic to target APIs)

**Likelihood:** Possible (Redis restart during Railway maintenance)  
**Impact:** Major — silent data loss, missed alerts  
**Can we test before launch?** Partially  
**Recommended mitigation:**
- **Verify Railway Redis persistence**: check if AOF (append-only file) is enabled. If only RDB (snapshotting), data loss window is the snapshot interval.
- **Design for Redis ephemerality**: treat Redis as a cache/queue, not a database. All critical state must be in Postgres.
  - After a check completes, write results to Postgres BEFORE acknowledging the BullMQ job
  - Confirmation rechecks: store pending confirmation state in `changes.confirmation_status` (Postgres), not just in the delayed BullMQ job
  - On scheduler startup: always do a full reconciliation against Postgres, not just Redis
- **Redis sentinel/cluster**: not available on Railway. Accept single-point-of-failure for Redis and design recovery procedures.

**When to address:** Before launch — Week 1 (verify), Week 2 (design for ephemerality)

---

### I-06: Cloudflare R2 Latency and Availability

**What is it?** Every check stores a response snapshot in R2. The check worker needs to write to R2 synchronously (or at least await the write) before moving on. R2 write latency is typically 50-200ms but can spike during regional outages.

**Why is it dangerous?** If R2 is slow or down, every check job takes longer, workers back up, queue grows. If R2 is completely unavailable, checks fail and the system grinds to a halt — even though the target APIs are perfectly fine.

**Likelihood:** Unlikely (R2 is very reliable) but possible during incidents  
**Impact:** Major — all monitoring blocked by storage dependency  
**Can we test before launch?** Partially  
**Recommended mitigation:**
- **Make R2 writes async/optional**: complete the check, write to Postgres, send alerts, THEN write to R2 in the background. If R2 fails, log it and retry later — don't block the check pipeline.
- **R2 write timeout**: 5 seconds max. If exceeded, skip R2 write, use Postgres `body` column as fallback for this check.
- **Circuit breaker for R2**: if R2 fails 5 times in a row, stop trying for 5 minutes. Fall back to not storing full snapshots (hash-only mode).
- Consider storing small responses (<10KB) directly in Postgres JSONB column and only using R2 for larger responses.

**When to address:** Before launch — Week 2

---

## 4. Business & Legal Unknowns

### B-01: Terms of Service Violations

**What is it?** Many APIs' ToS prohibit automated monitoring, scraping, or competitive intelligence. If Chirri monitors `api.openai.com/v1/models`, is that a ToS violation?

**Why is it dangerous?** If OpenAI's legal team decides Chirri violates their ToS, they can:
- Block Chirri's IPs (disruptive but survivable)
- Send a C&D letter (costly to respond to, even if legally defensible)
- File a CFAA complaint (if the ToS is interpreted as an "unauthorized access" restriction)

**Likelihood:** Possible (especially if Chirri becomes prominent)  
**Impact:** Catastrophic (legal action could kill a bootstrapped startup)  
**Can we test before launch?** Partially — legal review  
**Recommended mitigation:**
- **Lawyer review of ToS for top 20 monitored APIs** ($1-2K one-time) — specifically: "does monitoring their public endpoints violate their ToS?"
- **Focus on public endpoints**: status pages, changelogs, OpenAPI specs, RSS feeds. These are explicitly published for consumption.
- **Respectful behavior**: low frequency (max 1/min, typically hourly), transparent User-Agent, obey `robots.txt` for HTML pages
- **ToS clause**: Chirri's own ToS should include "Users are responsible for ensuring they have the right to monitor the URLs they add"
- **Proactive outreach**: email DevRel teams at Stripe, OpenAI, GitHub, etc. explaining what Chirri does. Most monitoring services do this.

**When to address:** Before launch — Week 5 legal review

---

### B-02: GDPR Data Processor Implications

**What is it?** If a monitored URL returns personally identifiable information (PII) in its response — names, emails, phone numbers — Chirri stores that in snapshots and diffs. Under GDPR, this makes Chirri a data processor.

**Why is it dangerous?** 
- Data subject access requests: "I found my email in one of your stored API responses. Delete it." — How do you find and delete PII across millions of stored snapshots?
- Data breach notification: if Chirri is compromised, we must notify not just our users but potentially every data subject whose PII we stored.
- DPA (Data Processing Agreement) requirements with EU customers.

**Likelihood:** Likely (authenticated API monitoring will catch PII)  
**Impact:** Major — compliance violations, fines  
**Can we test before launch?** No  
**Recommended mitigation:**
- **MVP: only monitor public endpoints** — public APIs shouldn't return PII (if they do, that's the API provider's problem, not ours)
- **V2 (authenticated monitoring)**: implement PII detection and redaction in stored snapshots. Use regex patterns for emails, phone numbers, credit card numbers, SSNs. Redact before storage.
- **Privacy policy**: clearly state that we store response data from monitored URLs and that users should not monitor endpoints that return PII unless they understand the implications
- **Data export endpoint** (already planned): ensures GDPR right of access
- **Data deletion**: implement cascade delete that purges all stored snapshots when a URL is removed or account is deleted

**When to address:** Before launch — privacy policy; V2 — PII detection

---

### B-03: Payment Failure Cascade

**What is it?** Stripe retries failed payments 3 times over ~14 days. The spec says "after 14 days past_due → downgrade to Free." But what happens during those 14 days? Does the user keep full Indie features? What about their 20 URLs when they get downgraded to 3?

**Why is it dangerous?** 
- If we pause URLs during the past_due period, the user gets angry: "I paid for this month, my card just expired, and you stopped monitoring my production APIs?"
- If we DON'T pause, the user gets 14 free days of monitoring
- The downgrade path is painful: 20 URLs → 3 URLs. Which 17 get paused? Random? Oldest? The user has no control.

**Likelihood:** Certain (5-10% of subscribers will have payment issues)  
**Impact:** Minor per-user but recurring headache  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- **During past_due**: maintain full service. Send email on days 1, 7, 14: "Your payment failed. Update your card to keep monitoring active."
- **On downgrade to Free**: 
  1. Send email listing all URLs and their priority
  2. Give user 7-day grace period to choose which 3 URLs to keep
  3. If no action: keep the 3 URLs with the most recent changes detected (most "valuable")
  4. Paused URLs retain their data — user can re-activate them by upgrading
- **Never delete data due to billing**: this burns trust irreparably

**When to address:** Before launch — Week 5 billing logic

---

### B-04: Free Tier Abuse at Scale

**What is it?** The spec mentions email verification and CAPTCHA to prevent multi-account abuse. But determined abusers can buy email accounts in bulk and solve CAPTCHAs via services like 2Captcha ($2-3 per 1000 solves).

**Why is it dangerous?** 100 fake accounts × 3 URLs = 300 monitored URLs = equivalent of 1.5 Pro plans for free. At 24h check intervals, that's 300 requests/day. Not individually dangerous, but at scale it consumes resources.

**Likelihood:** Possible (only if Chirri becomes popular enough to attract abuse)  
**Impact:** Minor — resource waste  
**Can we test before launch?** No  
**Recommended mitigation:**
- **Don't over-engineer anti-abuse before launch**. With 200 free users, abuse isn't an issue.
- **Post-launch monitoring**: track accounts-per-IP, accounts-per-email-domain, URLs-per-domain-across-accounts
- **Gradual friction**: 
  - Week 1: email verification only
  - If abuse detected: add CAPTCHA
  - If still abused: require phone verification for accounts adding >1 URL
  - Nuclear option: require credit card on file (even for free tier, $0 charge)

**When to address:** Only when abuse is detected — can wait

---

### B-05: Chargebacks

**What is it?** User subscribes to Indie ($9/mo), uses the service for 6 months, then files a chargeback claiming they "didn't authorize the charge." Stripe deducts $9 + $15 chargeback fee from Chirri.

**Why is it dangerous?** At $9/mo subscription, a single chargeback costs more than the user's total LTV. If chargeback rate exceeds 1%, Stripe may increase fees or terminate the merchant account.

**Likelihood:** Unlikely at small scale  
**Impact:** Minor (financial), potentially Major (Stripe account risk)  
**Can we test before launch?** No  
**Recommended mitigation:**
- **Clear billing descriptor**: "CHIRRI.IO" on credit card statements (not some random company name — confusing)
- **Confirmation emails**: send receipt for every charge
- **Easy cancellation**: one-click cancel from dashboard. No dark patterns.
- **Stripe Radar**: use Stripe's built-in fraud detection
- **Refund liberally**: if someone emails asking for a refund, give it immediately. $9 is not worth fighting over.

**When to address:** Can wait until post-launch

---

## 5. Competitive Unknowns

### C-01: Postman's Acquired API Diffing (Akita)

**What is it?** Postman acquired Akita in 2023, which does API traffic analysis and schema inference. Postman has 30M+ developers, existing API monitoring (Postman Monitors), and the brand trust. They could ship "API change detection" as a feature in months.

**Why is it dangerous?** If Postman adds "detect when your third-party APIs change" as a Postman Monitor feature, Chirri's entire market disappears. Postman already has the user base, the brand, and the distribution.

**Likelihood:** Possible (but Postman has been sitting on Akita for 3 years without shipping this)  
**Impact:** Catastrophic — existential threat  
**Can we test before launch?** No  
**Recommended mitigation:**
- **Speed**: ship before Postman. Build the data moat (historical change data) that can't be replicated.
- **Specialization**: Postman monitors YOUR APIs. Chirri monitors THEIR APIs. Different use case, different positioning.
- **Community**: build the "@ChirriChangelog" content brand. Become the canonical source for "what changed in the Stripe API this week."
- **Price**: Postman's monitor feature is part of their $12-49/user/month plans. Chirri at $9/mo for the whole team is cheaper.
- **Honestly**: accept this risk. Build fast, build well, and if Postman ships it, pivot to being the "indie developer" focused alternative.

**When to address:** Ongoing — monitor Postman's product announcements

---

### C-02: changedetection.io Adds API-Specific Features

**What is it?** changedetection.io has 22K+ GitHub stars and an active community. It's generic web change detection. If they add JSON schema-aware diffing, volatile field detection, and API classification — they'd be 80% of Chirri's value, for free.

**Why is it dangerous?** Self-hosted, free, already has brand recognition. Developer who's evaluating Chirri will compare to changedetection.io and think "close enough."

**Likelihood:** Possible  
**Impact:** Major — compete on features instead of just distribution  
**Can we test before launch?** No  
**Recommended mitigation:**
- **Managed service advantage**: changedetection.io requires self-hosting. Chirri is SaaS. Many developers don't want to maintain another Docker container.
- **Provider intelligence**: "Monitor Stripe" with one click is something self-hosted tools can't do (no curated provider database).
- **Aggregate intelligence** (V2): "73% of Chirri users saw this Stripe change" — impossible for self-hosted.
- **Quality**: obsess over false positive rate. changedetection.io has known FP issues with dynamic content.

**When to address:** Ongoing — monitor their releases

---

## 6. Edge Cases Nobody Thinks About

### E-01: APIs That Return 200 OK with Error Body

**What is it?** Many APIs return HTTP 200 but include an error in the body: `{"error": "rate_limited", "message": "Too many requests"}` or `{"data": null, "errors": [{"message": "Unauthorized"}]}`. Chirri's detection pipeline checks status codes first, and 200 = "success" = compare body.

**Why is it dangerous?** If the API starts returning 200+error instead of its normal 200+data response, Chirri detects this as a "content change" or "schema change." Which is technically correct — but the real issue is an error condition, not an API change. The alert should say "this API is returning errors" not "this API changed its schema."

**Likelihood:** Certain — this is extremely common, especially with GraphQL APIs  
**Impact:** Minor — misleading alerts  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- **Error body detection**: after receiving 200 OK, check if the body contains common error patterns:
  - JSON with top-level `error`, `errors`, `fault`, `exception` keys
  - GraphQL: `{"data": null, "errors": [...]}`
  - Body contains "rate limit", "unauthorized", "forbidden", "internal error"
- Classify these as `availability` events, not `schema` or `content` events
- Track "soft error rate" separately from HTTP error rate

**When to address:** Before launch — Week 3

---

### E-02: DNS Resolution Caching

**What is it?** The SSRF module does DNS resolution on every check (DNS pinning). But Node.js's `dns.resolve4()` doesn't cache by default. At 5,000 URLs checked hourly, that's 5,000 DNS queries per hour.

**Why is it dangerous?** 
- Each DNS query takes 10-100ms, adding latency to every check
- If our DNS resolver (Railway's, or Google's 8.8.8.8) rate-limits us, DNS queries fail and checks fail
- If we add DNS caching, stale entries could route checks to old IPs — security risk if the old IP is reassigned to a malicious actor

**Likelihood:** Likely at scale  
**Impact:** Minor — latency, potential DNS throttling  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- **Short-lived DNS cache**: cache DNS results for 60 seconds (shorter than most DNS TTLs). This reduces queries by ~99% for frequently-checked URLs while still refreshing regularly.
- Use `cacheable-lookup` npm package which provides a simple DNS cache for `undici`/`http`
- **Always re-resolve for SSRF checks**: the cached IP is only used for the request, but the SSRF blocklist check still runs against the cached IP

**When to address:** Before launch — Week 2

---

### E-03: Servers That Behave Differently Based on Headers

**What is it?** Many APIs return different content based on `Accept`, `User-Agent`, `Accept-Language`, `Accept-Encoding`, or even custom headers. Chirri sends a specific User-Agent (`Chirri-Monitor/1.0`) and `Accept: application/json` for JSON endpoints.

**Why is it dangerous?** 
- If an API detects Chirri's User-Agent and returns a simplified "monitoring-friendly" response, we're not monitoring what real users see
- If we don't send `Accept: application/json`, some APIs return HTML instead of JSON
- Content negotiation means two different clients might see completely different responses from the same URL

**Likelihood:** Likely  
**Impact:** Minor — monitoring wrong representation  
**Can we test before launch?** Partially  
**Recommended mitigation:**
- Let users configure custom `User-Agent` if they want to simulate a specific client (already supported via custom headers)
- **Default to mimicking a real client**: send `Accept: application/json, text/html;q=0.9, */*;q=0.8` and a generic browser-like User-Agent for HTML endpoints
- For JSON APIs: send `Accept: application/json` explicitly
- Document this behavior: "Chirri monitors the response as seen by its monitoring agent. If you need to monitor a specific client experience, set custom headers."

**When to address:** Before launch — Week 2

---

### E-04: Brotli/Zstd Compressed Responses

**What is it?** The spec doesn't mention response decompression. Modern APIs and CDNs may respond with `Content-Encoding: br` (Brotli), `zstd` (Zstandard), or `deflate`. undici handles gzip/deflate automatically but Brotli requires explicit support.

**Why is it dangerous?** If we receive a Brotli-compressed response and don't decompress it, we compute hashes on the compressed bytes. This means: (1) the hash changes if the compression ratio changes even though content doesn't, (2) we can't parse the JSON body, (3) the diff viewer shows garbage.

**Likelihood:** Likely — Cloudflare enables Brotli by default  
**Impact:** Major — false positives, broken diffs  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Send `Accept-Encoding: gzip, deflate, br` in check requests
- Use undici's built-in decompression for gzip/deflate
- For Brotli: use `zlib.brotliDecompressSync()` (Node.js built-in since v10)
- For Zstd: use `@aspect/node-zstd` or similar npm package
- **Test explicitly** against Cloudflare-fronted APIs that return Brotli

**When to address:** Before launch — Week 2

---

### E-05: JSONP and Non-Standard JSON Responses

**What is it?** Some older APIs return JSONP: `callback({"data": "value"})` or `/**/ typeof callback === 'function' && callback({"data":"value"})`. These are technically JavaScript, not JSON. `JSON.parse()` will fail.

**Why is it dangerous?** If `JSON.parse()` fails, the check worker treats it as a non-JSON response and falls back to content-hash comparison. This might be fine, but it means we lose structural diffing for these endpoints.

**Likelihood:** Unlikely for modern APIs, possible for legacy APIs  
**Impact:** Minor — degraded monitoring quality  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Detect JSONP pattern: `^[a-zA-Z_$][a-zA-Z0-9_$]*\(` and strip the callback wrapper before parsing
- If the response has `Content-Type: application/javascript` and contains JSON-like content, try JSONP extraction
- Low priority — handle it if users report it

**When to address:** Can wait — first month if reported

---

### E-06: Binary/Non-Text Responses

**What is it?** User monitors a URL that returns Protocol Buffers, MessagePack, CBOR, or another binary format. Or the URL returns an image, PDF, or zip file.

**Why is it dangerous?** Binary responses break text-based diffing. Trying to `JSON.parse()` a protobuf response throws an error, not a useful result. Hash-based comparison works but provides no useful diff information.

**Likelihood:** Unlikely for most users  
**Impact:** Minor — no useful diff  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Detect binary content via `Content-Type` header: if `application/octet-stream`, `application/protobuf`, `application/x-protobuf`, `image/*`, `application/pdf`, etc. → fall back to hash-only mode
- Show in dashboard: "This URL returns binary content. We can detect changes (via hash comparison) but can't show a detailed diff."
- For MessagePack: consider adding `msgpack-lite` deserialization → JSON → diff. Low priority but nice.

**When to address:** Can wait

---

### E-07: APIs Behind Geographic Load Balancers

**What is it?** Some APIs return different data based on the geographic location of the requester. Chirri checks from Railway's US East data center. A user in Tokyo monitoring their Tokyo-region API might see different responses than Chirri sees.

**Why is it dangerous?** Chirri reports "no changes" but the user sees changes in their region. Or Chirri reports changes that the user doesn't see. Either way, the monitoring doesn't match the user's reality.

**Likelihood:** Possible  
**Impact:** Minor — discrepancy between monitored and real experience  
**Can we test before launch?** No  
**Recommended mitigation:**
- Document: "Chirri checks from US East region. If your API returns different content based on geographic location, results may not match your local experience."
- **V2: Multi-region checking** (already planned). Check from 2+ regions and alert only if both detect the change.
- Allow users to configure a specific endpoint or region-specific URL

**When to address:** V2

---

### E-08: Daylight Saving Time and Quiet Hours

**What is it?** User sets quiet hours 23:00-08:00 in `America/New_York`. During DST transition (March/November), clocks jump forward or back by 1 hour. If the implementation uses UTC offsets instead of IANA timezone handling, quiet hours shift by an hour twice a year.

**Why is it dangerous?** User gets a 3am alert that should have been suppressed. Minor, but annoying — and it erodes trust in the tool's precision.

**Likelihood:** Certain (twice per year)  
**Impact:** Minor — 1 hour of wrong quiet hours  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- Always store timezone as IANA string (`America/New_York`), never as UTC offset
- Use `Temporal.ZonedDateTime` (TC39 proposal) or `luxon` for timezone-aware comparisons
- Test with: `America/New_York` during March DST forward, `Europe/London` during October DST back, `Asia/Kolkata` (no DST), `Pacific/Auckland` (southern hemisphere DST)

**When to address:** Before launch — Week 3

---

## 7. Operational Unknowns

### O-01: Who Gets Paged When Chirri Goes Down?

**What is it?** The spec mentions UptimeRobot monitoring `/health` and alerting to "personal Telegram/email." But there's no on-call rotation, no escalation policy, no incident response runbook.

**Why is it dangerous?** At 3am, Chirri's workers crash. UptimeRobot sends an email to... who? The founder's personal email? That they check at 8am? For 5 hours, no user gets alerts about API changes. If a major API breaks during that window, users discover Chirri failed them.

**Likelihood:** Certain (incidents will happen)  
**Impact:** Major — trust destruction  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- **Set up PagerDuty or Opsgenie for ops** (free tier) — yes, use the same incident management tools we'll eventually integrate with
- **On-call**: Alex (founder) is the sole on-call. UptimeRobot alerts → PagerDuty → phone call (not email)
- **Runbook in RUNBOOK.md**: 
  1. Check Railway dashboard for service status
  2. Check Redis memory (`redis-cli info memory`)
  3. Check BullMQ queue depth
  4. Check Postgres connection count
  5. Check R2 availability
  6. Common fixes: restart worker, clear stuck jobs, scale up instances
- **Status page**: use a free Instatus or Betterstack page. Update it during incidents.

**When to address:** Before launch — Week 5

---

### O-02: Database Migrations Without Downtime

**What is it?** The architecture uses Drizzle ORM with migrations. How do we add a column or index to a 10M-row table without locking it?

**Why is it dangerous?** Postgres `ALTER TABLE ADD COLUMN ... DEFAULT value` on a large table rewrites the entire table (pre-PG 11). Even on PG 11+, adding a column with a `NOT NULL DEFAULT` is fast, but adding an index can take minutes and blocks writes.

**Likelihood:** Certain (we'll need to migrate eventually)  
**Impact:** Major — service downtime during migration  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- **Use Postgres 14+** (Railway should have this): `ALTER TABLE ADD COLUMN ... DEFAULT` is instant
- **Always use `CREATE INDEX CONCURRENTLY`**: doesn't block writes (takes longer but no downtime)
- **Never use `NOT NULL` without `DEFAULT` on existing tables**: requires table rewrite
- **Migration testing**: run every migration against a copy of production data before deploying
- **Blue-green database** (V2): for major schema changes, create new tables, migrate data in background, swap

**When to address:** Before launch — establish migration best practices

---

### O-03: Rollback Strategy

**What is it?** A bad deploy breaks change detection — users start getting false positives. How do we roll back?

**Why is it dangerous?** Railway supports "rollback to previous deploy" but:
- Database migrations are forward-only (Drizzle doesn't auto-rollback)
- If the bad deploy changed the baseline format, old code can't read new baselines
- BullMQ job schema changes mean old workers can't process new-format jobs

**Likelihood:** Certain (bad deploys happen)  
**Impact:** Major — extended outage if rollback fails  
**Can we test before launch?** Partially  
**Recommended mitigation:**
- **Every migration must be backward-compatible**: new columns are nullable, new tables are additive. Old code ignores new columns; new code handles missing columns.
- **Feature flags**: use environment variables for new features. Deploy code first (dormant), then enable via env var. Rollback = disable flag, not redeploy.
- **Railway instant rollback**: test this before launch. Understand what it does and doesn't reset.
- **Keep previous Docker image**: Railway stores recent deployments. Tag the "known good" deploy.
- **Job schema versioning**: include a version field in BullMQ job payloads. Workers ignore jobs with unknown versions (they'll be retried when compatible workers are deployed).

**When to address:** Before launch — Week 5

---

### O-04: Customer Data Deletion Request

**What is it?** User emails: "Delete my account and all my data." GDPR requires this within 30 days. But Chirri's data is spread across: `users`, `urls`, `shared_urls`, `baselines`, `check_results` (partitioned!), `changes`, `user_changes`, `webhooks`, `webhook_deliveries`, `notifications`, `header_snapshots`, `forecasts`, `user_forecasts`, R2 snapshots.

**Why is it dangerous?** If we miss any table, we're violating GDPR. The `check_results` table is partitioned and has no FK to `users` (for performance). How do we find and delete a user's check results across 12+ monthly partitions? The `shared_urls` table is shared across users — we can't delete the shared URL if other users still monitor it, but we need to delete this user's references.

**Likelihood:** Certain  
**Impact:** Major — GDPR violation  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- **Write a `deleteUserData(userId)` function before launch** that:
  1. Revokes all API keys
  2. Deletes all `user_changes`, `user_forecasts`, `notifications` for user
  3. Deletes all `webhooks` and `webhook_deliveries` for user
  4. For each URL: decrement `shared_urls.subscriber_count`, delete the `urls` row
  5. If `subscriber_count` reaches 0: delete `shared_url`, `baselines`, `check_results` (across all partitions), `changes`, R2 snapshots
  6. Delete `users` row
  7. Log the deletion for audit trail
- **Test this function** with a test user in Week 6
- **30-day soft delete**: mark account as "pending deletion" and actually delete after 30 days (allows recovery from accidental deletion)

**When to address:** Before launch — Week 5

---

### O-05: Backup Restore Time

**What is it?** The spec calls for daily pg_dump to R2 at 03:00 UTC. But has anyone tested restoring from backup? How long does it take? Does the R2 upload actually work?

**Why is it dangerous?** A database corruption event at month 6 (with 20M+ rows in check_results) could take hours to restore from a pg_dump. During restoration, the service is down. Users are not getting monitored.

**Likelihood:** Unlikely (Postgres corruption is rare)  
**Impact:** Catastrophic — extended outage  
**Can we test before launch?** Yes  
**Recommended mitigation:**
- **Test backup/restore in Week 6**: create backup, drop database, restore, measure time
- **Point-in-time recovery**: Railway managed Postgres may support WAL-based PITR — check and enable
- **Backup verification**: after each daily backup, run a checksum or restore to a test instance monthly
- **Multi-layer**: pg_dump (full backup) + WAL archiving (continuous) + R2 storage (offsite)
- **Acceptable RTO**: define it. Is 2 hours acceptable? 4 hours? 24 hours? This determines backup strategy.

**When to address:** Before launch — Week 6

---

## 8. The Compound Failures

These are scenarios where multiple issues combine to create disasters worse than any individual problem.

### CF-01: Launch Day DDoS + False Positive Cascade

**Scenario:** 
1. HN launch drives 500 signups in one day
2. 200 users all add `api.stripe.com` endpoints
3. Chirri hammers Stripe with 200 concurrent learning checks (30 rapid checks × 200 URLs = 6,000 requests in 10 minutes)
4. Stripe rate-limits Chirri's IP
5. 429 responses during learning period get baked into baselines
6. When rate limiting lifts, normal 200 responses look like "changes" from the 429 baseline
7. 200 users all get false "Stripe API changed" alerts simultaneously
8. Twitter: "Chirri is broken, just sent me a fake alert 10 minutes after signup"
9. HN thread turns negative

**Likelihood:** Possible (if launch is successful)  
**Impact:** Catastrophic  
**Mitigation:** 
- Global per-domain cap (60 req/hour) prevents step 3
- 429 responses must NEVER be stored as baselines — they're always transient errors
- Learning period should detect and discard non-200 responses, retry until a successful response is captured
- Rate-stagger learning for shared URLs: if 200 users add the same URL, it only needs ONE learning cycle (shared monitoring)

---

### CF-02: Redis OOM + Worker Crash + Scheduler Orphan

**Scenario:**
1. Redis hits maxmemory (queue jobs accumulating faster than processed)
2. BullMQ fails to enqueue new jobs (Redis rejects writes)
3. Workers crash because BullMQ throws unhandled errors on stalled job processing
4. Scheduler keeps running, keeps trying to enqueue (each attempt fails)
5. Scheduler's Redis lock expires during reconnection attempts → two schedulers run
6. Double-scheduling: when Redis recovers, duplicate jobs flood in
7. Workers come back, process duplicates → duplicate alerts sent to users

**Likelihood:** Unlikely  
**Impact:** Major — duplicate alerts, confused users  
**Mitigation:**
- BullMQ error handling: catch enqueue failures gracefully, log and retry
- Scheduler idempotency: `shared_urls.next_check_at` acts as the source of truth, not job existence in Redis
- Dedup at worker level: before processing, check if this shared_url was already checked within the expected interval
- Redis maxmemory alert at 70%: gives time to investigate before failure

---

### CF-03: R2 Outage + Large Response + No Fallback

**Scenario:**
1. Cloudflare R2 experiences a regional outage (rare but has happened)
2. Check worker tries to store a 3MB response snapshot to R2 → timeout
3. Worker retries R2 write 3 times → all fail
4. Worker is now stuck for 15+ seconds on this single check
5. Other checks in the same concurrency slot are blocked
6. Worker's BullMQ stall timeout fires → job marked as stalled → retried → same failure
7. Workers enter a failure loop, processing no real checks
8. All monitoring stops

**Likelihood:** Unlikely  
**Impact:** Catastrophic  
**Mitigation:**
- R2 writes must be non-blocking with a 5s timeout and circuit breaker
- If R2 is down, skip snapshot storage (just compute hash and store in Postgres)
- Never let an R2 failure cascade to check failure

---

## 9. Summary: The Launch Day Checklist

### Must Fix Before Launch (13 items)

| # | Issue | Ref | Effort |
|---|-------|-----|--------|
| 1 | Benchmark jsondiffpatch with real responses | T-01 | 1 day |
| 2 | Stream large responses instead of buffering | T-02 | 2 days |
| 3 | Extend FP testing to 200+ URLs / 2 weeks | T-03 | 2 weeks lead time |
| 4 | Handle 429/bot-protection in check pipeline | T-08 | 1 day |
| 5 | Protect learning period from error baselines | T-09 | 1 day |
| 6 | Normalize URLs and headers for shared monitoring | T-10, U-01 | 1 day |
| 7 | Verify pg_partman / implement manual partitioning | T-06 | 1 day |
| 8 | Configure BullMQ job retention and Redis memory | T-07 | 0.5 day |
| 9 | Make R2 writes async with circuit breaker | I-06 | 1 day |
| 10 | Handle Brotli decompression | E-04 | 0.5 day |
| 11 | Detect 200-with-error-body soft errors | E-01 | 1 day |
| 12 | Set up on-call / incident response | O-01 | 0.5 day |
| 13 | Write and test `deleteUserData()` | O-04 | 1 day |

### Must Fix First Month (10 items)

| # | Issue | Ref | Effort |
|---|-------|-----|--------|
| 1 | Shadow mode for first 100 users to measure FP | T-03 | 3 days |
| 2 | Analyze classification accuracy from real data | T-04 | Ongoing |
| 3 | Stagger learning for bulk URL additions | U-04 | 1 day |
| 4 | Implement daily digest for alert fatigue | U-05 | 2 days |
| 5 | Remove team seat claims from pricing | U-07 | 0.5 day |
| 6 | Monitor Railway IP reputation and check failures | I-03 | Ongoing |
| 7 | Legal review of top 20 API ToS | B-01 | 1 week |
| 8 | Test backup/restore end-to-end | O-05 | 1 day |
| 9 | Establish migration best practices | O-02 | 0.5 day |
| 10 | Implement feature flags for rollback safety | O-03 | 2 days |

### Can Wait (8 items)

| # | Issue | Ref |
|---|-------|-----|
| 1 | Connection pooling tuning | T-05 |
| 2 | JSONP detection | E-05 |
| 3 | Binary response handling | E-06 |
| 4 | Multi-region checking | E-07 |
| 5 | PII detection in responses | B-02 |
| 6 | Anti-abuse escalation | B-04 |
| 7 | Chargeback policy | B-05 |
| 8 | Geographic response differences | E-07 |

---

## The One Thing That Scares Me Most

**The false positive cascade on popular APIs.**

If 500 users monitor Stripe and Chirri sends all 500 a false "Stripe changed" alert at the same time, the product is dead. Not wounded — dead. Every one of those users will screenshot it, post it on Twitter, and the HN thread will go from "cool tool" to "broken toy" in an hour.

The entire engineering effort should orient around preventing this single failure mode. Every check against a shared URL should be paranoid: confirm twice, check for rate limiting, check for bot detection, compare against multiple baselines, and — when in doubt — **don't alert**.

A missed real change is a bug. A false positive cascade is a tombstone.

---

*Created: 2026-03-24*  
*Author: Opus (Blind Spot Hunter)*  
*This document is the paranoia that keeps the product alive.*
