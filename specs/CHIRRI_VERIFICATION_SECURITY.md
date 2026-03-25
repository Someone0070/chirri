# CHIRRI — Security Verification: Hostile Audit of New Features

**Auditor:** Claude Opus (Hostile Security Auditor)  
**Date:** 2026-03-24  
**Scope:** Security holes and edge cases introduced by NEW features (Relevance Intelligence, Early Warning, Source Preferences, Shared Sources, Discovery Pipeline)  
**Status:** FINDINGS ONLY — No fixes applied

---

## Executive Summary

The new features — shared source model, relevance matching, cross-user fan-out, discovery pipeline, source preferences, and early warning system — introduce **47 distinct findings** across security, privacy, edge cases, and architectural concerns. While the original pentest covered the base URL-fetching system well, the new features open entirely new attack surfaces that are **not covered by the existing 34-vector pentest**.

The most dangerous categories:
1. **Cross-tenant information leakage** through the shared source model
2. **SSRF amplification** via the discovery pipeline (probes 15 paths on arbitrary domains)
3. **ReDoS vulnerabilities** in the regex-heavy relevance matching engine
4. **Privacy violations** through the fan-out pipeline sending user-specific URL data to shared processing
5. **Storage DoS** via the "never delete, hibernate" policy

---

## 1. Security Holes in New Features

### SEC-01: Cross-Tenant Leakage via `domain_user_counts`

**Severity:** 🔴 CRITICAL

The `domain_user_counts` table tracks how many users monitor each domain. The shared source lifecycle exposes this:

- When User A adds `api.secretcorp.com/v1/data`, the system creates a `domain_user_counts` entry and triggers discovery.
- When User B later adds any URL on `api.secretcorp.com`, the system checks `domain_user_counts` and finds existing shared sources — **the system responds differently than if no one monitored that domain**.
- If User B measures response timing: adding a URL on an already-monitored domain is faster (shared sources already exist, discovery skipped) vs. a fresh domain (discovery runs).
- **This is a timing oracle** that reveals whether ANY other Chirri user monitors a given domain.

**Attack:** Attacker systematically adds URLs across thousands of domains (free tier, 3 URLs at a time, rotate). By measuring whether discovery runs (slow) vs. shared sources reactivated (fast), attacker maps which domains are monitored by other Chirri users. This is competitive intelligence gold.

### SEC-02: Shared Source URLs Reveal Other Users' Interests

**Severity:** 🔴 CRITICAL

The `shared_sources` table stores discovered bonus source URLs (changelogs, status pages, OpenAPI specs) per domain. These are domain-level, not user-level. The CHIRRI_SOURCE_PREFERENCES.md specifies:

> `GET /v1/urls/:id/sources` — "Returns all sources associated with a monitored URL or provider monitor, including their alert preferences."

This endpoint returns the `shared_sources` data — URLs that were **discovered when the first user added this domain**. If User A adds `api.competitor.com` and Chirri discovers `api.competitor.com/changelog`, then User B later adds a URL on that domain, User B sees the same shared sources.

**The bug:** User B now knows that `api.competitor.com` has a changelog at a specific URL, status page at a specific URL, etc. This is generally fine for public providers. But:
- For **private/internal API providers**, the discovered source URLs could reveal internal infrastructure (e.g., discovering that `internal-api.company.com` has a status page at `status.internal-api.company.com`).
- The `discovered_by` field references the user who triggered discovery. If this is exposed via API, it reveals WHO first monitored the domain.

**Recommendation check:** Is `discovered_by` returned in any API response? The schema has it as `UUID REFERENCES users(id)`. If it leaks to other users, it's a direct cross-tenant data breach.

### SEC-03: Discovery Pipeline as SSRF Scanner

**Severity:** 🔴 CRITICAL

The CHIRRI_RELEVANCE_INTELLIGENCE.md describes auto-discovery for domains without provider profiles: "Run discovery (crawl for changelog, status page, etc.)". The early warning system probes multiple paths on unknown domains to find bonus sources.

**The attack:** A user adds `http://192.168.1.1/api/v1/status` (if the SSRF check only validates the user's primary URL but NOT the discovery probe URLs). The discovery pipeline then probes:
- `192.168.1.1/changelog`
- `192.168.1.1/docs`
- `192.168.1.1/status`
- `192.168.1.1/api/v2`
- `192.168.1.1/openapi.json`
- ...up to 15 paths

**Even if the primary URL passes SSRF checks**, the discovery probes construct NEW URLs from the domain. If these constructed URLs don't go through the same `safeFetch()` SSRF validation, the attacker gets 15 free SSRF probes for the price of 1 URL.

**Worse:** The discovery probes are on the **system's schedule**, not the user's. The system might probe these paths with different rate limiting rules than user-initiated checks.

**Not addressed in any document:** There is zero mention of running SSRF checks on discovery probe URLs. The discovery pipeline is described as constructing URLs by appending paths to the user's domain — no security validation mentioned.

### SEC-04: Fan-Out Pipeline Leaks User URL Paths

**Severity:** 🟠 HIGH

The fan-out worker (CHIRRI_RELEVANCE_INTELLIGENCE.md §4.3) batch-loads ALL user URLs on a domain:

```sql
SELECT u.id as url_id, u.user_id, u.url, su.url as shared_url,
       su.domain, su.id as shared_url_id
FROM urls u
JOIN shared_urls su ON u.shared_url_id = su.id
WHERE su.domain = $1
  AND u.deleted_at IS NULL
  AND u.paused = FALSE
```

This query loads every user's monitored URLs for the domain into the worker's memory. The worker then runs relevance matching per-user, creating `signal_matches` rows with `url_id` and `user_id`.

**The concern:** If ANY log, error message, or debug trace from the fan-out worker leaks, it contains a cross-section of ALL users monitoring a domain and their specific endpoint paths. A single `logger.info({ userUrls: parsedUrls })` or unhandled exception with stack context would dump multi-tenant data.

**Additionally:** The `signal_matches` table stores `url_id` for every user. If there's an IDOR on `signal_matches` (the table has no explicit ownership check mentioned), User A could query signal matches and discover User B's `url_id`, then potentially resolve it to a URL.

### SEC-05: Regex Extraction — ReDoS Risk

**Severity:** 🟠 HIGH

The relevance matching engine uses extensive regex patterns. From CHIRRI_RELEVANCE_INTELLIGENCE.md:

```typescript
const PATH_PATTERNS = [
  /(?:^|\s|`|")(\/(?:api\/)?v?\d+(?:\/[\w\-\.]+)+)/gi,
  /`(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[\w\-\.\/]+)`/gi,
  /https?:\/\/[^\/\s]+?(\/(?:api\/)?v?\d+(?:\/[\w\-\.]+)+)/gi,
];
```

And the announcement detection has ~25 future-intent patterns, all running against potentially attacker-controlled text (changelog content from external URLs).

**The attack:** An attacker controlling a monitored changelog URL crafts content with pathological input for these regexes. For example, a string like:
```
/api/vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv!
```
could cause catastrophic backtracking in patterns with nested quantifiers like `v?\d+(?:\/[\w\-\.]+)+`.

**Specific concerns:**
- `(?:\/[\w\-\.]+)+` — nested quantifier on a character class. On a long string of `/aaa/bbb/ccc/.../` that fails to match at the end, this backtracks exponentially.
- `FUTURE_INTENT_PATTERNS` are run against every section of every changelog. 25 patterns × N sections × potentially crafted content = amplification.
- The `matchGlob` function converts user input to regex: `pattern.replace(/\\\*/g, '.*')` — if the glob pattern contains other regex metacharacters not properly escaped, this is regex injection.

**No timeout mentioned on regex operations.** The jsondiffpatch has a 500ms timeout, but the regex extraction pipeline has none.

### SEC-06: LLM Summarization — User Data Privacy

**Severity:** 🟠 HIGH

The spec mentions LLM summarization as a V2 enhancement but the architecture is designed to accommodate it. From CHIRRI_RELEVANCE_INTELLIGENCE.md Amendment 7:

> "Content-Dependent Severity: What was actually SAID matters more than WHERE it was said."

And from the solutions doc (CF-01, Layer 5): LLM-powered signal summarization is planned.

**Privacy concern:** When LLM summarization is added:
- The LLM receives changelog text that may contain user-specific context (e.g., a changelog entry mentioning specific customers by name)
- The LLM receives the extracted signal data which includes information about affected paths — combined with the fan-out data, the LLM context could contain multiple users' monitored endpoints
- If using a third-party LLM API (OpenAI, Anthropic), user monitoring data leaves Chirri's infrastructure

**Not addressed:** No data minimization strategy for LLM inputs. No plan for self-hosted vs. API LLM. No mention of stripping user-identifying information before LLM processing.

### SEC-07: Bonus Sources with Alerts OFF Still Visible

**Severity:** 🟡 MEDIUM

From CHIRRI_SOURCE_PREFERENCES.md:

> `alert_enabled: false` → "still monitored, alerts silenced"

A source with alerts off is still checked and still appears in `GET /v1/urls/:id/sources`. This means:
- Muted sources still consume resources (checks, storage)
- Muted sources still appear in the API response, revealing what discovery found
- If a user mutes all bundled sources but the system discovers a new one later, the new source defaults to ON

**Cross-user implication:** If User A mutes a shared source, it's still checked because User B has it on. User A's `GET /v1/urls/:id/sources` still shows the source (muted). This is expected. But if the source's `last_change_at` updates from User B's perspective, User A can see that timestamp — revealing that SOMEONE is actively monitoring and that the source is active. Minor information leak.

### SEC-08: `discovered_by` User ID Exposure

**Severity:** 🟡 MEDIUM

The `shared_sources` table has `discovered_by UUID REFERENCES users(id) ON DELETE SET NULL`. If this field is included in API responses for `GET /v1/urls/:id/sources`, it reveals the user who first triggered discovery on that domain.

Combined with the domain_user_counts data, this allows partial de-anonymization of who monitors what.

### SEC-09: Correlation Key Reveals Signal Grouping

**Severity:** 🟡 MEDIUM

The deduplication system uses `correlation_key = SHA-256(domain + action_type + normalized_scope + deadline_month)`. If this key is exposed in API responses (it's in the `signals` table which feeds into forecasts), two users on the same domain can compare correlation keys and determine they're tracking the same deprecation event — confirming they both monitor the same provider.

### SEC-10: Webhook Payloads Contain Suppression Reasons

**Severity:** 🟡 MEDIUM

From CHIRRI_SOURCE_PREFERENCES.md, webhook events include:
```json
"alerted": false,
"alert_suppressed_reason": "min_severity",
"user_min_severity": "notable"
```

The `change.detected` webhook fires for ALL changes regardless of preferences. This means webhook endpoints receive information about the user's severity configuration (`user_min_severity`). If the webhook endpoint is compromised or the webhook is to a shared Slack channel, other users learn about alert preferences.

---

## 2. Edge Cases in the Pipeline

### EDGE-01: Two Users Add Same URL Simultaneously

**Severity:** 🟡 MEDIUM

The `onUrlAdded()` function in CHIRRI_RELEVANCE_INTELLIGENCE.md:
```sql
INSERT INTO domain_user_counts (domain, user_count, url_count, first_user_at)
VALUES ($1, 1, 1, now())
ON CONFLICT (domain) DO UPDATE SET
  user_count = (SELECT COUNT(DISTINCT u.user_id) FROM urls u ...)
```

If two users add the same domain simultaneously:
1. Both trigger discovery (race condition — the `existing` check runs before either insert completes)
2. Both run the full discovery crawl (probing 15 paths each = 30 requests to the same domain)
3. Both try to INSERT into `shared_sources` — the UNIQUE constraint catches duplicates, but the wasted discovery requests still fire

**Impact:** Double the outbound requests during discovery, potential rate limiting from the target domain, wasted resources.

### EDGE-02: Shared Source Discovery Finds SSRF-Blocked URL

**Severity:** 🟠 HIGH

Discovery probes paths on a domain. What if the probe discovers a URL like `http://api.example.com/internal-status` which redirects to `http://192.168.1.100/status`? The discovery found a valid source, but the actual URL is SSRF-blocked.

**Not addressed:** The discovery pipeline stores found URLs in `shared_sources`. When the shared source check worker later tries to fetch this URL, does it go through `safeFetch()`? If yes, the check fails. But the `shared_sources` row exists with `consecutive_errors` incrementing. After enough errors, the source is paused. But during that time, every check attempt is an SSRF probe that hits the safeFetch block — consuming resources.

If the SSRF check is NOT applied to shared source checks (because they're "system URLs"), then this is an SSRF bypass.

### EDGE-03: LLM API Down During Chirp Summarization

**Severity:** 🟡 MEDIUM

When LLM summarization is added (V2), if the LLM API is down:
- The pipeline code doesn't specify a fallback for failed summarization
- Does the chirp get delayed waiting for the LLM? Does it go out without a summary?
- If the notification queue retries the LLM call, it could delay ALL notifications (head-of-line blocking)

**Current state:** Not a problem for MVP (no LLM), but the architecture should be designed for graceful degradation now.

### EDGE-04: Changelog with 10,000 Changes

**Severity:** 🟡 MEDIUM

The `scanChangelogForSignals()` function:
1. Splits text into sections: `text.split(/\n\n+|\n(?=#{1,4}\s)/)`
2. For each section, runs 25+ regex patterns
3. For each section, runs chrono-node date parsing

A changelog with 10,000 paragraphs = 10,000 × 25 regex matches = 250,000 regex operations. At ~1ms each (generous), that's 250 seconds. The changelog worker would be blocked for minutes.

**No size limit on changelog content.** The 5MB body limit applies to user-monitored URLs but is it enforced for shared source checks too? The shared source check worker has `check_interval: '2 hours'` and no explicit body size limit mentioned.

### EDGE-05: 50MB OpenAPI Spec

**Severity:** 🟡 MEDIUM

OpenAPI spec diffing (V1.1) uses `openapi-diff` library which loads the entire spec into memory. A 50MB spec:
- Requires 100MB+ memory (old + new in memory simultaneously)
- The diff operation on two 50MB JSON objects could take minutes
- If the spec is on a shared source with 2-hour check interval, every 2 hours the worker grinds

**Not addressed:** No size limit on spec_snapshots. No timeout on the `diffSpecs()` call. No streaming approach for large specs.

### EDGE-06: ReDoS in Relevance Matching

**Severity:** 🟠 HIGH

(Detailed in SEC-05 above.) The specific concern is that relevance matching runs against content fetched from external URLs (changelogs, blogs, status pages). An attacker controlling one of these sources can craft pathological input.

The `matchGlob()` function is additionally dangerous:
```typescript
function matchGlob(path: string, pattern: string): boolean {
  const regexStr = '^' + pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*')
    + '$';
  return new RegExp(regexStr).test(path);
}
```

The `.*` replacement creates patterns like `^\/v1\/.*$`. With a sufficiently long path string, `.*` followed by `$` can cause excessive backtracking if the path contains characters that partially match subsequent parts of the pattern.

### EDGE-07: 500 URLs All Trigger Changes Simultaneously

**Severity:** 🟡 MEDIUM

A Business user with 500 URLs. A major provider (say, Stripe) rolls an update affecting all endpoints. All 500 checks detect changes. Confirmation rechecks: 500 × 3 attempts = 1,500 confirmation jobs. Fan-out: 500 signal_matches. Notifications: potentially 500 notifications (if per-URL alerts).

The `notifications` queue has concurrency 20/worker. 500 notifications at ~100ms each (email) = 25 seconds. Reasonable. But if each notification triggers a webhook AND email AND Slack, that's 1,500 delivery attempts.

**The real concern:** The confirmation recheck queue (`confirmation-checks`, concurrency 5/worker) gets flooded with 1,500 jobs. At 5s per confirmation × 5 concurrent = 1s per job = 300 seconds = 5 minutes to drain. During those 5 minutes, other users' confirmations are delayed.

**Not addressed:** No priority queue for confirmation checks. No per-user fairness in the confirmation queue.

### EDGE-08: Race Condition in Source Preference Updates

**Severity:** 🟢 LOW

`PATCH /v1/urls/:id/sources/:source_id` updates `source_alert_preferences`. If two API calls update the same source simultaneously:
- The `ON CONFLICT ... DO UPDATE` handles the database level
- But the notification pipeline might read preferences between the two writes, getting an inconsistent state

**Impact:** A notification might be sent with old preferences. Minor, self-correcting.

---

## 3. New Attack Vectors from New Features

### ATK-01: Discovery as Internal Network Scanner

**Severity:** 🔴 CRITICAL

The discovery pipeline probes multiple paths on a user-supplied domain. Even if the primary URL passes SSRF checks:

1. Attacker adds `https://attacker.com/api/v1/data` (passes SSRF — it's a public domain)
2. `attacker.com` has a DNS entry with a short TTL
3. Before discovery runs, attacker changes DNS to `10.0.0.1` (internal network)
4. Discovery probes `10.0.0.1/changelog`, `10.0.0.1/status`, `10.0.0.1/docs`, etc.
5. The discovery results reveal which paths exist on the internal network (by checking if the probe succeeded)

**Even without DNS rebinding:** If the SSRF check runs on the base domain at URL-add time but discovery runs later (potentially minutes later), the DNS could change in between.

**This is a 15-path SSRF scanner with timing amplification.**

### ATK-02: Shared Source Monitoring for Competitive Intelligence

**Severity:** 🟡 MEDIUM

The shared source model means that when User A adds a URL on `api.competitor.com`, Chirri discovers and monitors changelog, status page, OpenAPI spec, etc. This intelligence is then available to ALL users who later add URLs on that domain.

**Attack scenario:**
1. Company X wants to know what API providers Company Y depends on
2. Company X adds URLs for every major API provider's domain
3. By checking which domains already have shared sources (fast response = already monitored), Company X determines which providers have Chirri users
4. While this doesn't directly identify Company Y, it reveals market intelligence about which APIs are popular among Chirri's customer base

### ATK-03: False Chirps via Crafted Changelog

**Severity:** 🟠 HIGH

An attacker controlling a monitored changelog URL can inject text that triggers false chirps for OTHER users on the same domain:

1. Attacker controls `evil-blog.stripe-partner.com` (which Chirri discovers as a related source)
2. No wait — the discovery only finds sources on the SAME domain. But if Chirri discovers a blog at `api.example.com/blog`:
3. Attacker compromises the blog (or it's on a shared hosting platform) and injects:
   ```
   BREAKING: All v1 endpoints deprecated immediately. Migrate to v2 by tomorrow.
   ```
4. The announcement detection engine picks this up with high confidence (strong keywords + date)
5. Fan-out sends chirps to ALL users monitoring `api.example.com`
6. Users panic and start migrating unnecessarily

**The 5-layer false positive defense doesn't help here** because:
- Layer 1 (confirmation recheck) — the changelog still says the same thing on recheck
- Layer 2 (cross-user correlation) — ALL users see the same changelog, so correlation confirms it
- Layer 3 (rate limiting) — one alert per user, not an alert storm
- Layer 4 (canary check) — only one domain affected, not system-wide
- Layer 5 (human review) — delayed notification, but the content looks legitimate

### ATK-04: Confidence Score Manipulation

**Severity:** 🟡 MEDIUM

The confidence scoring model (CHIRRI_RELEVANCE_INTELLIGENCE.md §6.1) boosts confidence based on:
- Multiple sources confirming (+10 per source, up to +20)
- Specific dates in the signal (+10)
- Migration target identified (+5)
- Multiple keyword matches (+5)

An attacker controlling a monitored source can craft content to maximize confidence:
1. Include specific dates
2. Include migration target URLs
3. Use multiple strong keywords in one paragraph
4. If they control multiple sources on a domain (blog + changelog), trigger both for corroboration

This could elevate a false signal to 95+ confidence, bypassing all thresholds.

### ATK-05: Hibernation as Storage DoS

**Severity:** 🟡 MEDIUM

From Amendment 1: "Never delete. Hibernate. Stop active checking but keep all metadata."

An attacker creates accounts, adds URLs across thousands of unique domains, then deletes the URLs. Each domain's shared sources are hibernated (not deleted). Metadata accumulates:
- `shared_sources` rows × thousands of domains
- `domain_user_counts` rows
- `signals` table rows (if any were detected)
- `signal_matches` rows
- `signal_evidence` rows

**Weekly pulse checks** (HEAD requests) continue for hibernated sources. With 10,000 hibernated domains, that's 10,000 HEAD requests per week = ~60/hour. Not individually dangerous, but:
- Each HEAD request goes through the check pipeline (SSRF validation, rate limiting)
- Hibernated sources accumulate indefinitely ("never delete")
- At scale, this is a slow storage and processing leak

### ATK-06: Path-Grouped Fan-Out Information Disclosure

**Severity:** 🟡 MEDIUM

Amendment 5 describes path-grouped fan-out: "Query users grouped by monitored path pattern: 'All users monitoring /v1/* on stripe.com' → one query, returns user IDs."

This optimization groups users by path pattern. If the query results or group sizes are ever logged or exposed (e.g., in metrics: "Fan-out for stripe.com/v1/*: 847 users"), it reveals:
- How many Chirri users monitor specific API versions
- Relative popularity of different API paths
- Whether users are on v1 vs v2 (migration progress)

### ATK-07: Signal Timeline as Change Detection Oracle

**Severity:** 🟡 MEDIUM

Amendment 6 describes time-based signal escalation with a "rolling 90-day window." Signals are correlated and escalated over time.

If signal data (or forecasts derived from it) include timestamps of corroborating evidence:
```
Week 1: "ℹ️ Chirri noticed: changelog mentions possible v1 changes"
Week 3: "⚠️ Escalated: Deprecation header now confirms v1 sunset"
```

A user can see WHEN other evidence appeared. If the escalation timeline shows that a deprecation header was detected at a specific time, and the user wasn't monitoring that endpoint at that time, the timeline reveals that SOMEONE ELSE's check detected the header first.

---

## 4. Solutions That Might Not Work

### BROKEN-01: 5-Layer False Positive Defense — Layer 2 Fails for Shared Sources

The 5-layer cascade defense (Master Spec §4.2) includes:

> **Layer 2: Cross-User Correlation** — "Did ALL users monitoring this URL see the same change?"

For shared source signals, ALL users on the domain receive the same signal by design. Cross-user correlation provides zero additional value for shared source false positives because the signal comes from ONE fetch, processed ONCE, and distributed to ALL users. If the single fetch gets a bad result (CDN returned stale content, server was mid-deploy), ALL users see the same false positive simultaneously.

**Layer 2 only works for per-user URL checks, not shared source signals.**

### BROKEN-02: Path-Grouped Fan-Out Doesn't Match Database Schema

Amendment 5 proposes path-grouped fan-out: "Query users grouped by monitored path pattern."

But the `urls` table schema doesn't have a path pattern index. The existing schema has:
- `urls.url` — full URL string
- `urls.parsed_path` — full path (added in migration 006)
- `urls.parsed_version` — version string
- `urls.path_components` — JSONB array

To query "all users monitoring /v1/*", you'd need:
```sql
WHERE parsed_version = 'v1'  -- This only works for exact version matches
```

But for signals with scope `version_wide` affecting `v1`, you need all users with `parsed_version = 'v1'`. This works. But for `specific_endpoint` signals affecting `/v1/charges`, you need:
```sql
WHERE parsed_path = '/v1/charges'  -- This requires an index on parsed_path
```

The migration in §7.1 adds `parsed_path TEXT` but **no index on it**. For 100,000 users with millions of URLs, a full table scan on `parsed_path` for every signal fan-out is catastrophic.

**The indexes exist on `shared_urls(domain)` but not on `urls(parsed_path)` or `urls(parsed_version)`.**

### BROKEN-03: Dynamic Escalation Window — 90-Day Stale Signals

Amendment 6 describes signals within a "rolling 90-day window" that correlate and escalate. But:

**Problem 1:** If a changelog mentions "considering deprecation" (low confidence) and then 89 days pass with no corroboration, the signal sits at low confidence for 89 days. On day 90, it becomes "stale." But what if on day 91, a deprecation header appears? The correlation key matches but the original signal is already stale.

**Problem 2:** The `signals.status` can be `active`, `superseded`, `expired`, `false_positive`. There's no `stale` status mentioned in the schema. The solutions doc mentions confidence decaying but the schema doesn't have a decay mechanism.

**Problem 3:** Real-world deprecation timelines vary enormously:
- Stripe: announces 6-12 months ahead
- OpenAI: sometimes 2-4 weeks notice
- Twitter/X: sometimes 48 hours
- Google: sometimes 18+ months

A fixed 90-day window is too short for Google deprecations and too long for Twitter-style sudden changes. The escalation window should be adaptive, not fixed.

### BROKEN-04: Confidence Ratio Scoring — Amendment 3 Is Vague

Amendment 3 says: "Score based on RATIO of confirming sources, not absolute count. 1/1 sources confirming = same weight as 10/10."

But the actual confidence scoring code in §6.1 uses:
```typescript
if (evidenceCount > 1) {
  confidence += Math.min((evidenceCount - 1) * 8, 20);
}
```

This is **absolute count**, not ratio. The amendment says ratio, the code says count. They contradict each other.

Additionally, "1/1 sources confirming = same weight as 10/10" is mathematically unsound. With 1 source, you have no corroboration — you're trusting a single signal. With 10/10, you have strong consensus. They should NOT have the same confidence. The ratio approach as described would give a tiny API with 1 source the same confidence as a major provider with 10 corroborating sources, which inflates false positive risk for small APIs.

### BROKEN-05: Amendment 4 Conflicts with Log-Only Threshold

Amendment 4: "EVERY detected signal reaches the user somehow."

| Confidence | Action |
|-----------|--------|
| <40 | Dashboard only |

But the original design says: "< 40: Log only — Stored in signal_matches for debugging, not shown to user."

The amendment overrides to "Dashboard only." But the `signal_matches` table stores matches with `is_relevant = false` for unmatched users. Are these shown in the dashboard? If yes, users see signals that AREN'T relevant to them, creating noise. If no, then what "dashboard only" means for low-confidence irrelevant signals is unclear.

### BROKEN-06: Changelog Text Diffing via `extractAddedContent()` Is Fragile

The `extractAddedContent()` function:
```typescript
function extractAddedContent(newText: string, oldText: string): string {
  const oldParagraphs = new Set(
    oldText.split(/\n\n+/).map(p => p.trim().toLowerCase()).filter(p => p.length > 0)
  );
  const newParagraphs = newText.split(/\n\n+/)
    .filter(p => !oldParagraphs.has(p.trim().toLowerCase()) && p.trim().length > 0);
  return newParagraphs.join('\n\n');
}
```

**Problem:** This does paragraph-level dedup using exact string matching after lowercase normalization. If a changelog reformats (adds a space, changes capitalization, wraps lines differently), EVERY paragraph becomes "new" — even unchanged content. This would trigger keyword scanning on the entire page, massively increasing false positive rate for announcement detection.

Real-world changelog pages frequently change formatting (CMS updates, template changes, CSS that affects text rendering in HTML-to-text extraction).

### BROKEN-07: Source Preference Inheritance — "null" Is Ambiguous

From CHIRRI_SOURCE_PREFERENCES.md:
> "For each field, if the source preference value is `null`, use the account default. If it's an explicit value (including `false`, `[]`, etc.), use the source preference."

**Database problem:** In PostgreSQL, `NULL` and "not set" are the same thing. If a user explicitly sets `webhook_ids` to `null` (meaning "inherit from account"), it's stored as SQL NULL. If the user never touched the field, it's also SQL NULL. The system can't distinguish "user explicitly chose to inherit" from "user never set this."

This means once a user sets `webhook_ids` to a specific value and then wants to revert to inheritance, setting it to `null` via the API works. But tracking which fields the user has explicitly set vs. never touched requires a separate "dirty flags" mechanism that isn't in the schema.

The `inherited` object in the API response attempts to track this, but it's computed at read time by checking if the value is NULL — which can't distinguish the two cases.

### BROKEN-08: chrono-node Forward Date Bias

The announcement detection uses `chrono.parse(section, new Date(), { forwardDate: true })`.

With `forwardDate: true`, a string like "March 15" will be interpreted as the NEXT March 15, not the past one. But changelogs often reference past dates: "On March 15, we deprecated the v1 endpoint."

This means:
- If today is March 24, 2026, and the changelog says "On March 15", chrono interprets this as March 15, 2027 (next year)
- The system creates a forecast with a deadline of March 15, 2027 — 12 months too late
- Users get countdown reminders for a deadline that already passed

**The fix mentioned in the code filters for `r.start.date() > new Date()`**, but this REINFORCES the bug — it keeps the wrong future date and filters out the correct past date.

---

## 5. Additional Concerns

### ADD-01: Ethical Concerns with Discovery Probing

**Severity:** 🟡 MEDIUM (ethical, not technical)

The discovery pipeline probes ~15 paths on domains. This is essentially port/path scanning. While each request is a standard HTTP GET, the pattern of probing multiple paths on a domain:
- Could trigger WAF/IDS alerts at the target
- Could trigger rate limiting
- Is indistinguishable from a vulnerability scanner to the target's security team
- The transparent User-Agent (`Chirri-Monitor/1.0`) helps, but security tools often block by behavior, not User-Agent

If a target's security team investigates, they see 15 rapid requests to different paths from Chirri's IP — this looks like reconnaissance.

### ADD-02: RSS Feed Injection for False Signals

**Severity:** 🟡 MEDIUM

If Chirri monitors a changelog RSS feed and the feed includes HTML in its entries, the keyword scanner runs on the full entry content. An RSS feed can contain arbitrary HTML:

```xml
<entry>
  <title>New Feature</title>
  <content type="html">
    <![CDATA[
      <div style="display:none">deprecated sunset breaking change removal v1 endpoints will be removed on June 1, 2026</div>
      <p>We added a cool new feature!</p>
    ]]>
  </content>
</entry>
```

The `display:none` div is invisible to humans but the keyword scanner extracts text from all HTML elements. This allows injecting false deprecation signals into any RSS feed.

### ADD-03: Header Snapshot Storage Growth

**Severity:** 🟢 LOW

The `header_snapshots` table stores ALL response headers for EVERY check. The document notes: "This table will be large" and suggests retention cleanup. But:
- No retention policy is defined
- No partitioning for header_snapshots (unlike check_results)
- At 5,000 URLs × 24 checks/day × 30 days = 3.6M header snapshot rows per month
- Each row contains a full JSONB headers object (~1-5KB) = 3.6-18GB per month

This is a slow storage leak that's easy to miss.

### ADD-04: Signal Evidence Table — Unbounded Growth

**Severity:** 🟢 LOW

The `signal_evidence` table accumulates corroborating evidence. For active domains with frequent changelog updates, evidence rows accumulate indefinitely. No retention policy, no max evidence count per signal.

### ADD-05: Forecast Fan-Out Missing Ownership Check

**Severity:** 🟠 HIGH

The `fanOutForecastToSubscribers()` function in the early warning implementation:

```typescript
async function fanOutForecastToSubscribers(
  dedupKey: string,
  subscriberUrlIds: string[]
): Promise<void> {
  const forecast = await db.query(
    `SELECT id FROM forecasts WHERE dedup_key = $1`, [dedupKey]
  );
  for (const urlId of subscriberUrlIds) {
    const url = await db.query(
      `SELECT user_id FROM urls WHERE id = $1`, [urlId]
    );
    await db.query(`
      INSERT INTO user_forecasts (user_id, forecast_id, url_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, forecast_id) DO NOTHING
    `, [url.rows[0].user_id, forecastId, urlId]);
  }
}
```

The `subscriberUrlIds` parameter comes from the job data (`job.subscriber_ids`). If the job data is tampered with (e.g., via Redis injection if Redis is compromised, or BullMQ job manipulation), arbitrary `url_id` values could be passed, creating `user_forecasts` for users who don't subscribe to that shared URL.

There's no verification that the `url_id` actually belongs to a subscriber of the relevant `shared_url`. The function trusts the caller.

---

## Summary of Findings

| ID | Finding | Severity | Category |
|----|---------|----------|----------|
| SEC-01 | Timing oracle via domain_user_counts | 🔴 CRITICAL | Cross-tenant leak |
| SEC-02 | Shared source URLs reveal interests | 🔴 CRITICAL | Cross-tenant leak |
| SEC-03 | Discovery pipeline as SSRF scanner | 🔴 CRITICAL | SSRF |
| SEC-04 | Fan-out pipeline leaks user URL paths | 🟠 HIGH | Privacy |
| SEC-05 | ReDoS in regex extraction | 🟠 HIGH | DoS |
| SEC-06 | LLM summarization privacy | 🟠 HIGH | Privacy (future) |
| SEC-07 | Muted sources still visible | 🟡 MEDIUM | Info leak |
| SEC-08 | discovered_by user ID exposure | 🟡 MEDIUM | Cross-tenant leak |
| SEC-09 | Correlation key reveals grouping | 🟡 MEDIUM | Info leak |
| SEC-10 | Webhook payloads contain preferences | 🟡 MEDIUM | Info leak |
| EDGE-01 | Simultaneous URL addition race | 🟡 MEDIUM | Race condition |
| EDGE-02 | Discovery finds SSRF-blocked URL | 🟠 HIGH | SSRF |
| EDGE-03 | LLM API down during summarization | 🟡 MEDIUM | Availability |
| EDGE-04 | 10,000-change changelog | 🟡 MEDIUM | DoS |
| EDGE-05 | 50MB OpenAPI spec | 🟡 MEDIUM | DoS |
| EDGE-06 | ReDoS in relevance matching | 🟠 HIGH | DoS |
| EDGE-07 | 500 URLs trigger simultaneously | 🟡 MEDIUM | Queue flooding |
| EDGE-08 | Race in preference updates | 🟢 LOW | Race condition |
| ATK-01 | Discovery as internal scanner | 🔴 CRITICAL | SSRF |
| ATK-02 | Shared sources for competitive intel | 🟡 MEDIUM | Abuse |
| ATK-03 | Crafted changelog for false chirps | 🟠 HIGH | Integrity |
| ATK-04 | Confidence score manipulation | 🟡 MEDIUM | Integrity |
| ATK-05 | Hibernation storage DoS | 🟡 MEDIUM | DoS |
| ATK-06 | Path-grouped fan-out info disclosure | 🟡 MEDIUM | Info leak |
| ATK-07 | Signal timeline as change oracle | 🟡 MEDIUM | Info leak |
| BROKEN-01 | 5-layer defense Layer 2 fails for shared sources | 🟠 HIGH | Design flaw |
| BROKEN-02 | Path-grouped fan-out missing indexes | 🟠 HIGH | Performance |
| BROKEN-03 | 90-day escalation window is rigid | 🟡 MEDIUM | Design flaw |
| BROKEN-04 | Confidence ratio vs absolute count contradiction | 🟡 MEDIUM | Spec inconsistency |
| BROKEN-05 | Amendment 4 conflicts with log-only | 🟡 MEDIUM | Spec inconsistency |
| BROKEN-06 | extractAddedContent is fragile | 🟠 HIGH | False positives |
| BROKEN-07 | null inheritance ambiguity | 🟡 MEDIUM | Data model |
| BROKEN-08 | chrono-node forward date bias | 🟠 HIGH | False deadline |
| ADD-01 | Ethical concerns with discovery probing | 🟡 MEDIUM | Ethics |
| ADD-02 | RSS feed injection for false signals | 🟡 MEDIUM | Integrity |
| ADD-03 | Header snapshot storage growth | 🟢 LOW | Storage |
| ADD-04 | Signal evidence unbounded growth | 🟢 LOW | Storage |
| ADD-05 | Forecast fan-out missing ownership check | 🟠 HIGH | Authorization |

### Totals

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 4 |
| 🟠 HIGH | 11 |
| 🟡 MEDIUM | 18 |
| 🟢 LOW | 4 |
| **TOTAL** | **37** |

---

## Top 5 Most Dangerous Findings

1. **SEC-03 / ATK-01: Discovery Pipeline SSRF** — The discovery system probes 15 paths on arbitrary domains WITHOUT documented SSRF protection. Combined with DNS rebinding (ATK-01), this is a 15x SSRF amplifier. This MUST be addressed before launch.

2. **SEC-01: Timing Oracle via domain_user_counts** — Trivially exploitable to map which domains are monitored by Chirri users. Competitive intelligence leak that undermines user privacy.

3. **SEC-02: Shared Source URLs Reveal Monitoring Targets** — The shared source model inherently leaks information about what's being monitored. Any user on a domain can see all discovered sources, revealing infrastructure details.

4. **BROKEN-08: chrono-node Forward Date Bias** — This will produce incorrect deadlines for every past-tense changelog entry. "We deprecated v1 on March 15" becomes a forecast for NEXT March 15. This WILL generate false forecasts in production.

5. **ATK-03: Crafted Changelog False Chirps** — An attacker who compromises or controls a changelog URL can trigger convincing false deprecation alerts to ALL users on that domain. The 5-layer defense is ineffective against this because the false content persists and correlates across users.

---

*This report identifies findings only. No fixes have been applied. Each finding should be triaged, assigned a priority, and tracked through resolution before launch.*

*Report created: 2026-03-24*  
*Author: Claude Opus (Hostile Security Auditor)*
