# THE CHIRRI PRODUCT BIBLE

**Version:** 2.5 (March 24 Ops & Testing)
**Date:** 2026-03-24
**Status:** Single Source of Truth
**Replaces:** DELTA_API_MASTER_SPEC.md

**Changelog v2.5 (2026-03-24):** Added 5 operational systems previously unspecified. New sections: §5.12 CI/CD Pipeline, §5.13 Testing Strategy, §5.14 Admin Panel, §5.15 Error Monitoring & Alerting, §5.16 Analytics & Metrics. New table: feature_flags. Added is_admin column to users. Updated effort estimate (§9.9). Added CHIRRI_OPS_AND_TESTING_SPEC.md to document index (Appendix B). All changes marked with *(Added 2026-03-24 -- Ops & Testing Spec)*.

**Changelog v2.4 (2026-03-24):** Integrated 8 new MVP features approved by Alex. All changes marked with *(Added 2026-03-24 -- New MVP Features)*. New sections: §2.16 API Dependency Intelligence, §2.17 Auto-Generated Migration Checklists, §2.18 SDK/Package Version Intelligence, §2.19 Impact Simulator ("What Breaks If..."), §2.20 Security & Compliance Flagging, §2.21 Historical Event Collection. Extended: §3.10 Dependency Graph Visualization, §7.1 Workflow Routing / Notification Rules, §7.5 GitHub Issue Auto-Creation. Updated: §9.1 MVP Feature List, §9.9 Effort Estimate. See CHIRRI_NEW_FEATURES_IMPLEMENTATION.md and CHIRRI_API_INTELLIGENCE.md for detailed implementation research.

**Changelog v2.3 (2026-03-24):** Applied all findings from 4 Practical Review documents (Onboarding, Notifications, Detection, Infrastructure). All changes marked with *(Fixed 2026-03-24 -- Practical Review)*. Key changes: POST /v1/urls made async after SSRF check, SSE classification progress added, learning period UX spec added, 429 target rate limit handling added, classification heuristics implementation added, email template specs added, SPF/DKIM/DMARC DNS records added, webhook retry decision tree added, webhook failure notifications added, Slack Block Kit severity colors added, Discord embed severity color mapping added, quiet hours queuing logic added, cross-source notification dedup added, MCP server installation guide added, 11-step checking pipeline detailed, diff strategy selection logic added, concrete severity assignment rules added, LLM role clarified (summarization only), soft error detection patterns expanded, cross-source correlation dedup key construction added, concurrency model documented, array reorder handling added, GDPR deletion Stripe call moved outside transaction, bulk import 207 behavior added, environment variables completed, worker health check endpoint added, dunning email templates added, Stripe billing flow details added, single-process vs multi-service clarified.

**Changelog v2.2 (2026-03-24):** Applied all 64 findings from CHIRRI_BACKEND_PENTEST_V2.md. All changes marked with *(Fixed 2026-03-24 -- Pentest v2)*. Key changes: 5 missing tables added (url_secrets, oauth_tokens, feedback, integrations, tickets), baseline quorum columns added, CORS configuration added, retention model fixed (highest subscriber), workflow state transition endpoints added, shared_urls creation logic specified, Redis eviction policy fixed to noeviction, rate limits fixed to per-hour sliding window, GDPR deletion cascade completed across all tables, check_results PK + indexes added, SSE auth documented, section numbering fixed, 20+ additional bug-causers and cosmetic issues resolved.

This document is the definitive specification for Chirri (chirri.io). A new developer reads this top to bottom and understands everything needed to start building.

(!) **For all frontend/UI specifications, see CHIRRI_FRONTEND_BIBLE.md.** That document covers design language, component library, page specs, responsive design, accessibility, and the complete frontend tech stack. This Bible covers product, backend, API, and business.

---

## TABLE OF CONTENTS

- Part 1: Product Overview (incl. Email Configuration)
- Part 2: How It Works (incl. Feedback System, Soft Error Detection, Proactive FP Detection, API Intelligence, Migration Checklists, SDK Intelligence, Impact Simulator, Security Flagging, Historical Events)
- Part 3: Early Warning System (incl. Dependency Graph Visualization)
- Part 4: Pricing & Business *(Updated 2026-03-24: new tiers)*
- Part 5: Technical Architecture (incl. CI/CD, Testing, Admin Panel, Error Monitoring, Analytics)
- Part 6: API Overview
- Part 7: Integrations (incl. Workflow Routing / Notification Rules, GitHub Issue Auto-Creation)
- Part 8: Security (incl. Security Solutions, Design Ambiguity Solutions)
- Part 9: Launch Plan (incl. Effort Estimate) *(Updated 2026-03-24: 8 new MVP features)*
- Part 10: Known Risks & Mitigations
- Appendix A: All Key Decisions *(Updated 2026-03-24: decisions 29-44)*
- Appendix B: Detailed Document Index
- Appendix C: Complete Tech Stack

---

# PART 1: PRODUCT OVERVIEW

## 1.1 What Chirri Is

Chirri is an API change detection service for developers. You give it the URL of any API you depend on -- Stripe, OpenAI, Twilio, your partner's internal API -- and Chirri watches it. When the response schema changes, when fields get removed, when deprecation headers appear, when the changelog announces a sunset date, Chirri tells you. Before your users notice. Before your integration breaks in production.

## 1.2 Taglines

**Primary:** APIs change. We'll let you know.

**Short (for tight spaces):** Know when APIs change.

**SEO/Meta:** Chirri watches your APIs so you don't have to. Get notified when endpoints change their response, schema, or behavior. Free tier available.

## 1.3 Target Users

**Primary segment:** Solo developers and small teams (2-10) who depend on third-party APIs and can't afford a dedicated SRE. They integrate Stripe for payments, OpenAI for AI, Twilio for messaging, and need to know when those APIs change before their integration breaks silently.

**Secondary segment:** AI agent developers. AI API traffic surged 73% in 2024 (Postman State of the API). Agents can't "read a blog post" about API changes -- they need automated detection. Chirri's MCP server is built for this.

**Tertiary segment:** DevOps engineers managing CI/CD pipelines who want API change checks as a pipeline step (via GitHub Action).

(Source: CHIRRI_GROWTH_STRATEGY.md, CHIRRI_REAL_DEVELOPER_RESEARCH.md)

## 1.4 The Problem

APIs break without warning. This is not theoretical:

- 14.78% of API changes break compatibility with previous versions, and the frequency increases over time. (IEEE SANER 2017, study of 317 Java libraries, 9K releases, 260K client apps)
- 36% of companies report spending more time troubleshooting APIs than developing new features. (Lunar.dev 2024 API Consumer Survey, 200 companies)
- A major news API silently changed field names (`title` to `headline`, `content` to `body.text`) with zero documentation. 200+ applications broke within hours. (dev.to/@mrdubey)
- The Flutter developer survey found that developers affected by breaking changes increased from 30% to 51% over four years. (Flutter Q1 2023 Survey)
- Stripe ships breaking changes under new API versions (e.g., `2025-03-31.basil`, `2026-01-28.clover`), each requiring migration guides. OpenAI deprecated models with 3-12 months notice. Twilio extended a product EOL by two years after community pushback. Twitter/X silently broke v1.1 endpoints with zero announcement.

(Source: CHIRRI_REAL_DEVELOPER_RESEARCH.md, CHIRRI_ESCALATION_AND_SEVERITY.md)

Existing tools don't solve this:

- **Uptime monitors** (UptimeRobot, Better Stack) check if an API is *up*, not if it *changed*. Different problem.
- **changedetection.io** is generic web page watching -- no API schema awareness, no auto-classification, no severity levels, consumer-focused ("restock alerts"). 
- **API Drift Alert** attempted this at $149-749/mo and appears dead -- no traction, no community.
- **Postman Monitors** require manual test authoring. If you don't assert on a field, you don't catch its removal.
- **Datadog Synthetic** monitors YOUR infrastructure, not third-party dependencies, at enterprise prices ($8,500+/mo at scale).

(Source: CHIRRI_MARKET_ANALYSIS.md)

## 1.5 The Solution

Chirri fills the empty quadrant: **simple + developer-first + affordable + API-specific**.

You paste a URL. Chirri figures out what kind of content it is (JSON API, RSS feed, OpenAPI spec, HTML changelog), picks the right monitoring strategy, learns what's volatile (request IDs, timestamps), establishes a baseline, and watches. When something meaningful changes, you get a calm, precise notification with a side-by-side diff showing exactly what's different.

For known providers (Stripe, OpenAI, etc.), Chirri goes further. Type "Stripe" and get automatic monitoring of the OpenAPI spec, changelog, status page, and primary SDK releases -- all from one URL slot. Bonus sources run silently in the background and only chirp when something is relevant to your specific endpoints.

## 1.6 The Tree Metaphor -- "Plant a Seed"

Each monitored domain is a tree:

- **Trunk** = the domain/provider (stripe.com)
- **Branches** = your monitored endpoints (/v1/charges, /v1/customers)
- **Roots** = bonus sources (changelog, OpenAPI spec, status page, SDK releases) -- hidden underground, feeding intelligence upward
- **Blossoms** = alerts -- sakura petals appearing when something needs attention

Roots are undeletable. You can mute them (go grey) but not remove them. "You can't rip out the roots of a tree." They're structural -- always sensing, even when silent.

The landing page hero uses an animated sakura tree to tell this story visually.

(Source: CHIRRI_BRAND_IDENTITY.md, Alex direction)

## 1.7 Brand

**Name:** Chirri (chirri.io). Pronounced "CHEE-ree." From Japanese onomatopoeia for a cricket's chirp. The cricket doesn't panic -- it simply lets you know.

**Aesthetic:** Japanese zen minimalism. White + sakura pink (#FFB7C5). Generous whitespace. Line art only. Cherry blossom petals as the recurring motif. The sakura pink is the *only* strong color -- everything else is intentionally restrained (grays, near-whites, near-blacks). The pink earns its power by being rare.

**Voice:** Calm, precise, warm, minimal, observant. Like a quiet friend who notices things others miss. Never panicky ("URGENT!"), never cute ("Oopsie!"), never corporate ("We are pleased to inform you..."), never verbose. Says exactly what changed, nothing more.

**Typography:** Inter (headings + body), JetBrains Mono (code). Large headings, small body, generous line height.

**No emojis anywhere in the product.** Use colored dots or text markers for status indicators.

(!) For deep brand details: see CHIRRI_BRAND_IDENTITY.md
(!) For design system implementation (colors, typography, components, dark mode): see CHIRRI_FRONTEND_BIBLE.md Part 1

## 1.8 Email Configuration *(Updated 2026-03-24)*

| Address | Purpose | Usage |
|---|---|---|
| **support@chirri.io** | Customer-facing communication | Feedback replies, support tickets, human conversations |
| **chirp@chirri.io** | Automated notification emails | No-reply sender for change alerts, weekly reports, onboarding emails. *(Fixed 2026-03-24 -- Pentest v2)* All email templates use "Chirri" branding (not "Chirp"). Signature: "— Chirri" |
| **alex@chirri.io** | Internal only | Never customer-facing, never visible to users |

---

# PART 2: HOW IT WORKS

## 2.1 Input Handling

Chirri accepts URLs and domain names only. No natural language input ("monitor Stripe's pricing API"). The user pastes a URL or types a provider name into a search field.

**Decision tree when user enters input:**

```
Has specific path? (e.g., /v1/charges, /changelog)
  YES --> Monitor that specific URL

Is bare domain? (e.g., stripe.com)
  Is known provider in database?
    YES --> Show provider card with source selection
    NO  --> Monitor the homepage for content changes

Is API endpoint? (e.g., api.stripe.com/v1/charges)
  --> Detect provider, enter monitoring flow
```

**URL validation rules:**
- Must be http:// or https://
- Hostname must resolve to a public IP (SSRF check)
- Max 2048 characters
- No user:pass@ in URL (rejected)
- Query params with credential patterns trigger a warning (not rejection)
- chirri.io domains blocked (self-referential prevention)

**POST /v1/urls is async after SSRF check:** *(Fixed 2026-03-24 -- Practical Review)*

The URL creation endpoint MUST be asynchronous after the SSRF validation. Flow:

1. API validates URL format, runs SSRF check (DNS + IP validation) — <1s
2. If SSRF passes: create `urls` row with `status="classifying"`, return `201 Created` immediately
3. Enqueue classification job to BullMQ `classification` queue
4. Dashboard shows URL card with skeleton + "Classifying..." spinner (via SSE updates)
5. Worker completes classification → status update → dashboard refreshes via SSE

User sees response in <1 second (median 500ms), not 5-18 seconds. This allows bulk-adding URLs without waiting for each to classify.

(Source: CHIRRI_URL_ONBOARDING_FLOW.md, CHIRRI_DOMAIN_VS_PAGE_MONITORING.md, Alex direction)

## 2.2 Provider Detection

When a URL is submitted, Chirri checks it against a database of known provider profiles. MVP ships with 15-20 hardcoded profiles stored as a JSON configuration file.

**Known provider flow (e.g., user enters anything matching stripe.com):**
- Display provider card showing all available sources
- Pre-select default sources (OpenAPI spec, changelog, status page, primary SDK)
- User confirms or adjusts
- One URL slot consumed, multiple sources monitored

**Unknown domain flow:**
- Treat as a generic URL
- Run auto-classification on the response
- Monitor according to detected content type

Provider profiles include domain matching with wildcard support:
- `api.stripe.com` --> exact match
- `*.googleapis.com` --> wildcard match for Google APIs
- Mega-providers (Google, AWS, Amazon) are split by product: `google-maps`, `google-cloud`, `aws-s3`

(!) For provider onboarding UI wireframes and the "Plant a Seed" flow: see CHIRRI_FRONTEND_BIBLE.md Part 3.11 and Part 6.

**Provider onboarding via API:**
```json
POST /v1/urls
{
    "url": "https://api.stripe.com/v1/prices",
    "source_preferences": {
        "changelog": { "min_severity": "notable", "digest": "daily" },
        "sdk": { "alert_enabled": false }
    }
}
```

Without `source_preferences`, API defaults everything to ON (immediate delivery, all severities). Dashboard applies smart defaults automatically.

(Source: CHIRRI_CATEGORY_D_RESEARCH.md D12, CHIRRI_PROVIDER_MONITORING.md)

## 2.3 Discovery Service

When a new domain is added (not a known provider), Chirri runs a one-time asynchronous discovery probe. It checks up to 15 well-known paths to find bonus sources:

**Phase 1 (always probe):**
- /openapi.json, /openapi.yaml, /swagger.json
- /api/v2/summary.json (Statuspage.io standard)
- /changelog
- /feed.xml

**Phase 2 (if Phase 1 found nothing useful):**
- /atom.xml, /rss.xml
- /docs/changelog, /blog/changelog
- /.well-known/openapi

**Phase 3 (speculative, budget permitting):**
- /status, /api-docs, /docs, /sitemap.xml

Discovery is HTTPS only, runs once per domain, is rate-limited to 1 probe/second, aborts responses >1MB, and does NOT follow redirects (stores redirect targets for manual review). All probes go through safeFetch() with full SSRF protection.

Results are stored in `discovery_results` and suggested to the user -- never auto-added without confirmation.

(Source: CHIRRI_CATEGORY_D_RESEARCH.md D11, Alex direction)

## 2.4 Auto-Classification (3 Phases)

When Chirri fetches a URL for the first time, it determines the content type and monitoring strategy through a 3-phase pipeline:

**Phase 1: Domain Pattern Matching**
Check URL against `domain_patterns` database. Known domains (github.com, *.statuspage.io, api.stripe.com) get instant classification with high confidence (90+).

**Phase 2: Response-Based Classification**
Analyze the HTTP response: Content-Type header, body structure (JSON object? RSS XML? HTML?), presence of OpenAPI/Swagger keys. Assign content type and monitoring method.

**Phase 3: Fallback**
If Phases 1-2 can't determine a monitoring strategy, fall back to `content-hash` (detect THAT something changed, even if we can't show exactly WHAT).

Additional phases (path heuristics, response header signals, discovery budget, generator-to-feed mapping) are deferred to V2.

### SSE Progress Updates During Classification *(Fixed 2026-03-24 -- Practical Review)*

The classification worker emits SSE events at each stage so the dashboard can show real-time progress:

```typescript
// Worker emits 5 stages during classification
async function runClassification(urlId: string, userId: string) {
  await emitSSE(userId, { type: 'classification_stage', urlId, stage: 1, label: 'URL pattern analysis' });
  const phase1 = await runPhase1PatternMatch(urlId);

  await emitSSE(userId, { type: 'classification_stage', urlId, stage: 2, label: 'Fetching response' });
  const response = await safeFetch(url);

  await emitSSE(userId, { type: 'classification_stage', urlId, stage: 3, label: 'Content-Type detection' });
  const contentType = detectContentType(response);

  await emitSSE(userId, { type: 'classification_stage', urlId, stage: 4, label: 'Structural analysis' });
  const structure = analyzeStructure(response, contentType);

  await emitSSE(userId, { type: 'classification_stage', urlId, stage: 5, label: 'Monitoring method selected' });
  const method = selectMonitoringMethod(contentType, structure);

  await emitSSE(userId, { type: 'classification_complete', urlId, result: { contentType, method } });
}
```

Total duration: 5-30s (median 12s). After 30s timeout: fall back to "Unknown content type, using hash comparison."

### Phase 2 Response Classification Heuristics (Implementation Reference) *(Fixed 2026-03-24 -- Practical Review)*

Concrete rules for Phase 2 response-based classification:

```typescript
function classifyResponseContent(response: Response): ContentClassification {
  const ct = response.headers.get('content-type') || '';

  // Priority 1: Content-Type header
  if (ct.includes('application/json') || ct.includes('application/') && ct.includes('+json')) {
    const body = await response.json();
    if (body.openapi || body.swagger) {
      return { type: 'openapi-spec', confidence: 98, method: 'spec-diff' };
    }
    if (body.paths && body.definitions) {
      return { type: 'openapi-spec', confidence: 95, method: 'spec-diff' };  // Swagger 2.0 without version field
    }
    if (Array.isArray(body) || (typeof body === 'object' && body !== null)) {
      return { type: 'json-api', confidence: 85, method: 'json-diff' };
    }
  }

  if (ct.includes('application/rss+xml') || ct.includes('application/atom+xml')) {
    return { type: 'rss-feed', confidence: 99, method: 'feed-poll' };
  }

  if (ct.includes('application/xml') || ct.includes('text/xml')) {
    const text = await response.text();
    if (text.includes('<rss') || text.includes('<feed')) {
      return { type: 'rss-feed', confidence: 95, method: 'feed-poll' };
    }
    return { type: 'unknown', confidence: 50, method: 'content-hash' };
  }

  if (ct.includes('text/html')) {
    const text = await response.text();
    if (text.match(/<h[12]>changelog/i) || text.includes('id="changelog"')) {
      return { type: 'html-changelog', confidence: 70, method: 'html-text-diff' };
    }
    return { type: 'html-page', confidence: 60, method: 'content-hash' };
  }

  if (ct.includes('text/plain')) {
    return { type: 'unknown', confidence: 50, method: 'content-hash' };
  }

  if (ct.includes('application/octet-stream')) {
    return { type: 'rejected', confidence: 100, method: 'none' };  // Can't monitor binary
  }

  // Fallback
  return { type: 'unknown', confidence: 30, method: 'content-hash' };
}
```

OpenAPI detection summary:
- Root keys `openapi` + `paths` present: confidence 98
- Only `paths` + `definitions`: confidence 90 (Swagger 2.0 without version field)

**Content types and their monitoring methods:**

| Content Type | Monitoring Method | Notes |
|---|---|---|
| json-api | json-diff | Structural comparison using jsondiffpatch |
| openapi-spec | spec-diff (V1.1), hash (MVP) | Full OpenAPI structural diff is V1.1 |
| rss-feed / atom-feed | feed-poll | Detect new entries; skips learning period |
| status-page | json-diff | Standard Statuspage.io JSON API |
| html (changelog) | html-text-diff | Extract text via cheerio, diff with jsdiff |
| html (other) | content-hash | Hash comparison only |
| unknown | content-hash | Safe fallback |

(Source: CHIRRI_CATEGORY_A_VALIDATION.md A3, CHIRRI_ARCHITECTURE.md)

## 2.5 Source Types and Source Tracking Model

A provider is not a single URL -- it's an ecosystem of monitorable sources. Chirri uses a "Smart Sources" model:

**One provider = one URL slot + bundled intelligence sources (free)**

When a user monitors "Stripe":

| Source | Counts as URL slot? | Check Interval | Controlled By |
|---|---|---|---|
| OpenAPI Spec (primary) | YES (1 slot) | User's plan interval | User's plan |
| Changelog | NO (bundled) | Every 2 hours (fixed) | System |
| Status Page JSON | NO (bundled) | Every 10 minutes (fixed) | System |
| Primary SDK Releases | NO (bundled) | Every 6 hours (fixed) | System |

**Total URL slots used: 1. Total sources monitored: 4.**

Bundled sources are free because they use smart intervals matched to actual change frequency. A changelog that updates 3x/week doesn't need 5-minute checks. Status pages need frequent checks during incidents but are static otherwise.

**Cost per bundled provider: ~$0.03/month** (negligible due to shared monitoring deduplication).

Users can optionally add more sources (additional SDKs, npm/PyPI packages, docs pages), each consuming one additional URL slot.

(Source: CHIRRI_SOURCE_TRACKING_MODEL.md)

## 2.6 Bonus Sources

Bonus sources are the bundled intelligence sources that don't count toward URL quotas. Key rules:

- **Auto-added** when a provider is detected, with alerts OFF by default
- **Smart chirp**: Only notify the user when a bonus source change is *relevant* to their specific monitored endpoints (relevance matching via path/version extraction)
- **Uncapped per provider**: No limit on how many bonus sources a provider can have
- **Undeletable roots**: Bonus sources can be muted but not deleted. They're structural to the provider intelligence model
- **Shared monitoring**: 100 users all monitoring Stripe's changelog = 1 actual HTTP check, fanned out to all users

**Dashboard defaults vs API defaults:**
- Dashboard: Smart defaults applied (changelog = notable+, daily digest; SDK = breaking only, weekly digest; status page = everything, immediate)
- API: Everything ON by default, all severity levels, immediate delivery. Smart defaults only applied if `"apply_smart_defaults": true` is passed

**Shared source lifecycle:**

```
User A adds api.stripe.com/v1/users
  --> System checks: shared sources for "api.stripe.com"?
  --> No --> Run discovery + apply provider profile
  --> Create shared_sources rows, start checking

User B adds api.stripe.com/v1/orders
  --> System checks: shared sources exist?
  --> Yes --> Skip discovery, link to existing shared sources
  --> User B benefits immediately from existing intelligence

User A deletes their URL
  --> Other users on domain? Yes (User B) --> Keep shared sources

User B deletes their URL
  --> Other users on domain? No --> Mark shared sources "orphaned"
  --> After 7-day grace period: stop checking (but never delete metadata)
  --> Weekly pulse check (one HEAD request) to verify domain alive

User C adds api.stripe.com/v1/payments (months later)
  --> Shared sources still exist (hibernated) --> Instant reactivation
  --> Zero discovery needed, accumulated intelligence preserved
```

Shared sources are NEVER deleted. They hibernate when no users are on the domain. Cost of keeping metadata: kilobytes. Benefit: instant reactivation, preserved intelligence.

**Source alert preference inheritance:**
```
Account defaults (notification_config on users table)
  --> Per-source preferences (source_alert_preferences table)
     --> For each field: if source pref is null, inherit from account
     --> If source pref is explicit (including false/[]), use source pref
```

Cannot distinguish "user explicitly set to null" from "user never touched this." Functionally identical behavior -- both inherit. Accepted ambiguity for MVP.

(Source: CHIRRI_SOURCE_PREFERENCES.md, Alex direction)

## 2.7 Learning Period

Every new URL goes through a learning period before active monitoring begins. The goal: identify volatile fields (request IDs, timestamps, trace IDs) that change on every request and would cause false positives.

**Phase 1: Rapid Learning (10 minutes)**
- 30 checks at 20-second intervals
- Each check stores response in `learning_samples`
- After ~30 samples: fields changing in >50% of samples marked volatile
- Establish baseline from final sample
- *(Fixed 2026-03-24 -- Pentest v2)* Baseline creation order: shared_urls row must exist first (created synchronously during URL addition -- see §5.2 shared_urls creation logic). The learning worker creates the `baselines` row with `baseline_status: 'provisional'` and `baseline_contributors: 1`. If learning fails mid-way, partial learning_samples are kept and learning can resume on next attempt.
- Transition: learning --> calibrating

**Phase 2: Calibrating (7 days)**
- Normal scheduled checks at plan interval
- Higher confidence threshold (95 instead of user-configured 80)
- Continues learning volatile patterns
- Suppresses borderline changes
- User sees "Active" status (calibrating state is hidden from UI and API)

(*) During calibration, if a high-severity change is detected (status code 5xx, endpoint returning 404), it OVERRIDES the 95 confidence threshold and alerts immediately. Status code changes don't need calibration.

(*) Low-confidence notifications are shown during learning with a label, not silently suppressed.

**Phase 3: Active**
- Normal monitoring at user's configured threshold (default 80)
- Full alerting enabled
- Volatile field list stabilized

**Exceptions:** RSS/Atom feeds and OpenAPI specs skip learning entirely -- they go straight to active. Feeds are item-based (new item = change), and specs are structural (schema diff, not content hash).

### Learning Period UX Spec *(Fixed 2026-03-24 -- Practical Review)*

The learning period runs server-side. User behavior during learning:

**User CAN:**
- Navigate to other pages (learning continues in the background)
- Close the browser tab (learning continues server-side)
- Add more URLs (each learns independently)
- View live snapshot preview after first 3-5 checks (latest status code, avg response time, volatile fields detected so far)
- View the latest raw response via "View Latest Response" button

**User CANNOT:**
- Trigger manual checks (greyed out until active)
- Configure alert thresholds (greyed out until baseline exists)

**Progress updates via SSE:**
- Dashboard URL list shows "Learning (12/30)" badge, updated in real-time
- URL detail page shows full progress view with ETA and volatile fields detected so far

**Completion notification:**
- Desktop notification (if browser notifications enabled): "Stripe Prices API is now active"
- Email notification (if >30 minutes elapsed since URL was added and user hasn't returned to dashboard)

**Live preview during learning (after 3-5 checks):**
```
Preview (not final baseline):
  Response: 200 OK
  Content-Type: application/json
  Avg response time: 234ms
  Volatile fields detected: request_id, timestamp

  [View Latest Response]

  Full monitoring begins when learning completes.
```

(Source: CHIRRI_ARCHITECTURE.md Section 5.2, CHIRRI_CATEGORY_A_VALIDATION.md A4, Alex direction)

## 2.8 Checking Pipeline

The complete check flow, from scheduling to notification:

```
Step 1:  SCHEDULE         Scheduler queries shared_urls WHERE next_check_at <= now()
                          Enqueue to url-checks BullMQ queue with jitter

Step 2:  PICK UP JOB      Worker dequeues from url-checks

Step 3:  SSRF VALIDATION   Parse URL, DNS resolve (pinned), check ALL IPs
                          against blocklist. Reject if private/blocked.

Step 4:  DOMAIN RATE LIMIT  Redis token bucket: 1 req/sec per domain, max burst 3
                          Circuit breaker check. Throttled = re-enqueue with delay.

Step 5:  HTTP REQUEST      undici with connect.lookup for DNS pinning
                          Manual redirect following (re-validate IP each hop, max 5)
                          10s headers timeout, 30s body timeout, 5MB body limit
                          Record TTFB + total time

Step 6:  RESPONSE PROCESSING
                          Parse body (JSON/XML/HTML)
                          Extract JSON schema (keys + types, max 20 depth)
                          Compute 4 fingerprints:
                            fullHash    = SHA-256(entire body)
                            stableHash  = SHA-256(body minus volatile fields)
                            schemaHash  = SHA-256(schema snapshot)
                            headerHash  = SHA-256(normalized headers)
                          Store body snapshot to R2
                          Parse deprecation/sunset headers (early warning)
                          Track version header changes

Step 7:  BASELINE COMPARISON
                          fullHash matches baseline? --> No change (90% of checks)
                          stableHash matches? --> Volatile change only, update stats
                          Otherwise --> proceed to diff

Step 8:  CHANGE DETECTION
                          Run jsondiffpatch.diff(baseline, new)
                          Classify: schema/status_code/header/content/redirect
                          Compute severity + confidence
                          Generate human-readable summary
                          CREATE changes row (shared, one per shared_url_id)
                          Fan-out: CREATE user_changes rows for each subscriber
                            *(Fixed 2026-03-24 -- Pentest v2)* Fan-out runs in the check worker
                            within a DB transaction. For >100 subscribers, use batched
                            multi-row INSERT (100 rows per batch) to avoid long transactions.
                            Notification dispatch is a SEPARATE step (Step 10) via BullMQ queue.
                          If changelog URL: run keyword scanning for early warning

Step 9:  CONFIRMATION RECHECK
                          Stage 1 (5 seconds): recheck URL
                            Matches change? Critical = alert NOW. Non-critical = Stage 2.
                            Matches old baseline? Discard (false positive).
                            Matches neither? Retry (max 3x).
                          Stage 2 (30 minutes): recheck again
                            Still changed? CONFIRMED. Update baseline. Notify.
                            Reverted? Discard.

Step 10: NOTIFICATION DISPATCH
                          For each subscriber: check preferences, min_severity,
                          quiet hours, digest mode
                          Enqueue to notifications queue per channel
                          (email, webhook, Slack, Discord, etc.)

Step 11: RESULT STORAGE
                          INSERT into check_results (unconditional -- every check)
                          UPDATE urls.last_check_at
                          UPDATE baselines (if change confirmed)
```

### 2.8.0 Target API Rate Limit Handling (429 Responses) *(Fixed 2026-03-24 -- Practical Review)*

When a target API returns `429 Too Many Requests`:

1. Parse `Retry-After` header (if present)
2. If `Retry-After` present: delay next check by that duration (max 24h cap)
3. If no `Retry-After`: exponential backoff starting at 5 min (5m → 15m → 1h → 6h → 24h)
4. Update URL status to `limited` with `status_reason: 'rate_limited_by_target'` if 3+ consecutive 429s
5. Notify user: "Target API rate-limited Chirri. Checks paused until [time]."
6. Do NOT count 429s toward `degraded` status (they're not server errors)
7. Do NOT open circuit breaker for 429s (circuit breaker is for 5xx/timeout errors)

```typescript
// In check worker, after receiving HTTP response
if (response.status === 429) {
  const retryAfter = parseRetryAfterHeader(response.headers.get('retry-after'));
  const delay = retryAfter
    ? Math.min(retryAfter, 24 * 60 * 60 * 1000)  // Cap at 24h
    : getExponentialBackoff(consecutiveRateLimits);  // 5m, 15m, 1h, 6h, 24h

  await db.update(shared_urls)
    .set({ next_check_at: new Date(Date.now() + delay) })
    .where(eq(shared_urls.id, sharedUrlId));

  if (consecutiveRateLimits >= 3) {
    await updateUrlStatus(sharedUrlId, 'limited', 'rate_limited_by_target');
  }
}
```

User-facing message:
```
Status: Limited (rate-limited by target)
Next check: In 47 minutes
The target API returned "429 Too Many Requests". We're respecting their rate limit.
```

### 2.8.0b 11-Step Checking Pipeline Detail *(Fixed 2026-03-24 -- Practical Review)*

The checking pipeline is exactly 11 steps, always executed in this order:

| Step | Name | What Happens | Failure Behavior |
|---|---|---|---|
| 1 | SCHEDULE | Scheduler queries `shared_urls WHERE next_check_at <= now()`, enqueue with jitter | Missed checks recovered on next cron run |
| 2 | PICK UP JOB | BullMQ worker dequeues (concurrency: 10 per worker) | Jobs wait in queue if all slots busy |
| 3 | SSRF VALIDATION | DNS resolve + IP validation against blocklist | Reject → check fails, URL status → error |
| 4 | DOMAIN RATE LIMIT | Redis token bucket (1 req/s, burst 3) + circuit breaker check | Throttled → re-enqueue with delay |
| 5 | HTTP REQUEST | undici fetch with DNS pinning, manual redirect following (max 5), 30s timeout, 5MB limit | Timeout → retry 3x; 429 → exponential backoff |
| 6 | RESPONSE PROCESSING | Parse body, extract schema, compute 4 fingerprints, store snapshot to R2, detect soft errors | Parse failure → content-hash fallback |
| 7 | BASELINE COMPARISON | fullHash match → done (90% of checks); stableHash match → volatile only; else → diff | No baseline → skip (learning period) |
| 8 | CHANGE DETECTION | jsondiffpatch.diff(), classify type, assign severity, create changes row, fan-out user_changes | Transaction failure → rollback, BullMQ retry |
| 9 | CONFIRMATION RECHECK | Stage 1 (5s): recheck. Stage 2 (30min): recheck again. Critical alerts bypass Stage 2. | Matches neither → retry 3x, then mark unstable |
| 10 | NOTIFICATION DISPATCH | Check preferences, min_severity, quiet hours, rate limits; enqueue per channel | BullMQ retry with backoff |
| 11 | RESULT STORAGE | INSERT check_results, UPDATE shared_urls.last_check_at, UPDATE baselines if confirmed | Unconditional write; partition must exist |

**Concurrency model:** *(Fixed 2026-03-24 -- Practical Review)*
- Memory per check: ~7MB (response body ~2MB + parsed JSON ~4MB + diff result ~1MB)
- CPU per diff: <10ms for 10KB JSON, ~50ms for 100KB, ~500ms for 1MB (timeout fallback)
- Concurrent checks per worker: 10 (BullMQ concurrency setting)
- Total workers at MVP: 2 Railway instances = 20 concurrent checks
- Throughput: ~4 checks/sec (avg 5s per check)
- Capacity: 10,000 URLs on 1-hour interval (167 checks/min, well within 4/sec capacity)
- At 5-minute intervals for 10K URLs: need ~9 workers across ~5 Railway instances

**Why unconditional writes:** 1.4 writes/second is trivially low for Postgres. Conditional writes break uptime stats, response time tracking, and "did Chirri actually check at 3am?" verification. Storage cost: ~$0.27/month for 120K rows/day.

### 2.8.1 Response Time Tracking *(Updated 2026-03-24)*

Track on ALL URLs, every check. Six timing metrics recorded per check:

| Metric | What It Measures |
|---|---|
| **TTFB** | Time to first byte (server processing time) |
| **Total response time** | Full request duration including body download |
| **DNS lookup** | DNS resolution time |
| **TLS handshake** | TLS negotiation time |
| **Connect** | TCP connection establishment |
| **Download** | Body transfer time |

**Aggregation:**
- Rolling averages: 7-day and 30-day windows
- Percentile tracking: p50, p95, p99
- Stored in check_results (per-check) and computed on read via window functions

**Trend detection:** "p95 went from 200ms to 600ms over past week" -- detects gradual degradation that wouldn't trigger a single-check alert.

**Anomaly alerts:** "Response time is 3x the 30-day average" = Medium severity change event. Classified as `change_type: 'timing'` in the changes table.

(Source: CHIRRI_ARCHITECTURE.md Section 5, CHIRRI_CATEGORY_B_RESEARCH.md B9)

## 2.9 Change Detection & Diff Engine

Chirri uses a 4-fingerprint system for efficient change detection:

1. **fullHash** -- SHA-256 of entire response body. If unchanged, skip everything (90% of checks).
2. **stableHash** -- SHA-256 of body with volatile fields removed. If only volatile fields changed, log but don't alert.
3. **schemaHash** -- SHA-256 of the JSON schema (keys + types only). Schema changes are structural and almost always significant.
4. **headerHash** -- SHA-256 of normalized response headers. Detects new/removed headers, version changes, deprecation signals.

**JSON structural diffing** uses jsondiffpatch with tiered strategy:
- Responses <100KB: full structural diff with LCS array diffing
- 100KB-1MB: structural diff with LCS disabled, positional array comparison
- >1MB: hash-only comparison, body stored for manual review
- 500ms timeout on diff operations; fallback to hash-only if exceeded

### Diff Strategy Selection Logic *(Fixed 2026-03-24 -- Practical Review)*

The diff strategy is selected based on response size and content type. Only ONE strategy runs per check:

```typescript
function chooseDiffStrategy(bodySize: number, contentType: string): DiffStrategy {
  // Content-type specific strategies override size-based selection
  if (contentType === 'rss-feed' || contentType === 'atom-feed') return 'feed-poll';
  if (contentType === 'html-changelog') return 'html-text-diff';
  if (contentType === 'html-page') return 'content-hash';

  // Size-based strategy for JSON/API content
  if (bodySize > 1_000_000) return 'hash-only';        // >1MB: hash comparison
  if (bodySize > 100_000) return 'positional-diff';     // 100KB-1MB: no LCS array diffing
  return 'full-structural-diff';                         // <100KB: full diff with LCS
}
```

| Content Type | Strategy | Tool | Notes |
|---|---|---|---|
| json-api (<100KB) | full-structural-diff | jsondiffpatch (default) | LCS array diffing detects moves/reorders |
| json-api (100KB-1MB) | positional-diff | jsondiffpatch `{arrays:{detectMove:false}}` | Array elements compared by position. Reorders show as remove+add. |
| json-api (>1MB) | hash-only | SHA-256 | User downloads snapshots to compare manually |
| json-api (>500ms diff) | hash-only (timeout) | SHA-256 | Diff timed out, fallback |
| html-changelog | html-text-diff | cheerio + readability + turndown + jsdiff | Strip boilerplate, extract article, diff markdown |
| html-page | content-hash | SHA-256 | Hash comparison only |
| rss-feed / atom-feed | feed-poll | GUID/link comparison | Detect new entries |
| openapi-spec | content-hash (MVP) | SHA-256 | spec-diff in V1.1 |

### Array Reorder Handling *(Fixed 2026-03-24 -- Practical Review)*

Array element reorder is a known source of false positives. Handling:

```typescript
function isArrayReorder(diff: any): boolean {
  // jsondiffpatch marks array moves with _t: 'a' and entries like "_N": [value, index, 3]
  // where the third element 3 indicates a move operation
  return deepScan(diff, (value, key) =>
    key === '_t' && value === 'a' ||
    (Array.isArray(value) && value.length === 3 && value[2] === 3)  // move marker
  );
}

// In severity classification:
if (isArrayReorder(diff) && !hasRemovedFields(diff) && !hasAddedFields(diff)) {
  return 'low';  // Reorder-only changes are LOW severity
}
```

When jsondiffpatch detects a pure reorder (no additions/removals), severity is downgraded to LOW. Known limitation: jsondiffpatch's LCS algorithm doesn't always detect reorders correctly for large arrays. For positional-diff strategy (100KB-1MB), reorders show as remove+add pairs — severity remains as classified by the change type.

**HTML text diffing** (for changelogs, docs pages):
- cheerio strips boilerplate (nav, footer, scripts)
- @mozilla/readability extracts article content
- turndown converts to markdown
- jsdiff.diffLines() for line-level comparison, diffWords() for word-level detail within changed lines

**Response size anomaly detection:** Track baseline_size_bytes. Alert on >50% deviation. >200% = warning severity, 50-200% = info.

**fast-xml-parser security configuration (critical):**
```typescript
const parser = new XMLParser({
    processEntities: false,          // DISABLE entity processing (eliminates entire CVE class)
    htmlEntities: false,
    maxTotalExpansions: 100,
    maxExpandedLength: 10_000,
});
```
Input size limit: max 5MB XML. Monitor for CVEs (3 entity expansion CVEs in 3 months as of March 2026).

**HTML text diff pipeline in detail:**
```
HTML page --> cheerio (strip nav/footer/script/style)
  --> @mozilla/readability (extract article content)
  --> turndown (convert to markdown for clean diffing)
  --> jsdiff.diffLines (line-level comparison)
  --> For changed lines: jsdiff.diffWords (word-level detail)
```

For HTML sources, the Change Detail page shows extracted text (markdown-formatted), NOT raw HTML. Word-level highlighting within changed paragraphs. Summary: "3 paragraphs added, 1 modified in the Stripe API Upgrades changelog."

**extractAddedContent() improvement (fuzzy matching):**
Paragraph-level dedup uses normalized text comparison (lowercase, collapse whitespace, remove punctuation) + Jaccard similarity on word trigrams. Threshold 0.8 -- paragraphs >80% similar are treated as reformatted, not new. This prevents CMS template changes from triggering false "new content" detection.

(Source: CHIRRI_ARCHITECTURE.md, CHIRRI_CATEGORY_D_RESEARCH.md D4, D24, D28, CHIRRI_UNKNOWN_SOLUTIONS.md T-01)

## 2.10 The Change Detail View

The change detail page is the "money screen" -- where users see exactly what changed. It presents jsondiffpatch delta output with human-readable summaries, severity badges, recommended actions, and workflow triage buttons.

For HTML sources: extracted text diff (not raw HTML diff) to avoid false positives from template/CSS changes.

(!) For complete UI specification of the Change Detail View (Monaco DiffEditor configuration, layout, action bar, responsive behavior): see CHIRRI_FRONTEND_BIBLE.md Part 4.

(Source: CHIRRI_INTEGRATION_DETAILS.md Section 4.2, CHIRRI_CATEGORY_D_RESEARCH.md D4)

## 2.11 Post-Detection Workflow

Chirri uses a 5-state workflow optimized for solo developers:

```
         NEW
          |
    +-----+-----+
    |     |      |
 TRACKED  IGNORED  SNOOZED
    |              |
    |   (expires)--+
    |   returns to NEW
    |
 RESOLVED
```

| State | Meaning | Solo Dev Translation |
|---|---|---|
| **New** | Change detected, not yet triaged | "I haven't looked at this yet" |
| **Tracked** | Acknowledged, needs action | "I know about this and need to deal with it" |
| **Snoozed** | Remind me later (with date) | "Not now, but don't let me forget" |
| **Ignored** | Doesn't affect me | "Stop bothering me about this" |
| **Resolved** | Fixed / migrated / no longer relevant | "Done" |

**Key features:**
- One-click triage buttons: Track / Ignore / Snooze
- Notes field per change
- Copy-as-markdown button (for pasting into Linear/Jira/GitHub Issues/Slack)
- Deadline display with countdown
- "X changes need triage" prominent counter (drive toward inbox zero for New)

**Snooze options:** 1 week / 1 month / 3 months / specific date / 30 days before deadline

**Pause/Resume behavior:**
- Pausing does NOT free the URL slot (prevents gaming)
- Resume uses existing baseline (no re-learning)
- Paused <30 days: resume immediately
- Paused 30-90 days: warn that baseline may be stale
- Paused >90 days: offer "Resume" (old baseline) or "Re-learn" (start fresh)
- Billing continues while paused (slot reserved)

**Downgrade handling:**
When a user downgrades (e.g., Personal to Free), excess URLs must be paused. The user chooses which URLs to keep via a selection UI. If no selection is made within 72 hours, most recently created URLs are paused first.

(Source: CHIRRI_SEVERITY_AND_WORKFLOW.md, CHIRRI_CATEGORY_D_RESEARCH.md D3, Alex direction)

## 2.12 Severity and Urgency

**Severity: 4 levels (Critical / High / Medium / Low)**

| Level | Definition | Notification Behavior |
|---|---|---|
| **Critical** | Breaking change already happened or will within days. Immediate action required. | Immediate push, bypasses quiet hours |
| **High** | Significant change requiring code modifications. Clear deadline exists. | Push notification during business hours |
| **Medium** | Notable change requiring evaluation but not urgent action. | Daily digest |
| **Low** | Informational. Good to know, unlikely to require action. | Weekly digest or in-app only |

Severity is about **impact**, not time. A deprecation might be High severity (affects your payment flow) but forecast urgency (6 months away).

**Urgency is a separate internal axis** derived from deadlines, not user-assigned. The system calculates urgency from detected deadline dates for sorting and notification frequency. Users see severity; urgency drives the countdown system.

**Rule-based severity assignment (MVP):**
- Matches "deprecated" + deadline within 30 days --> High
- Matches "removed|sunset|breaking" --> Critical
- Matches "deprecated" + no deadline --> Medium
- Matches "new feature|added|optional" --> Low
- Default --> Medium (force user to triage unknowns)

Users can override severity manually via `PATCH /v1/changes/:id { "severity": "low" }`.

### Concrete Severity Assignment Rules (Implementation Reference) *(Fixed 2026-03-24 -- Practical Review)*

Severity is assigned by **deterministic rules**, NOT by LLM. The LLM is used only for summarization (see §3.6).

```typescript
function assignSeverity(change: Change): 'critical' | 'high' | 'medium' | 'low' {
  // 1. Status code changes
  if (change.change_type === 'status_code') {
    if (change.current_status_code >= 500) return 'critical';
    if (change.current_status_code === 404) return 'high';
    if (change.current_status_code >= 400) return 'high';
    if (change.current_status_code >= 300) return 'medium';
    return 'low';
  }

  // 2. Schema changes (JSON structural diff)
  if (change.change_type === 'schema') {
    if (hasRemovedFields(change.diff)) return 'critical';        // Removed field = breaking
    if (hasTypeChanges(change.diff)) return 'high';              // Type changed (string → number)
    if (hasAddedRequiredFields(change.diff)) return 'high';      // Added required field
    if (isArrayReorder(change.diff)) return 'low';               // Pure reorder
    return 'low';                                                  // Added optional field
  }

  // 3. Header changes
  if (change.change_type === 'header') {
    if (change.diff.added?.includes('sunset') || change.diff.added?.includes('deprecation')) return 'critical';
    if (change.diff.changed?.includes('api-version') || change.diff.changed?.includes('x-api-version')) return 'high';
    return 'medium';
  }

  // 4. Content changes (body changed but schema didn't)
  if (change.change_type === 'content') {
    if (change.monitoring_method === 'html-text-diff') {
      const addedText = extractAddedText(change.diff);
      const keywords = scanKeywords(addedText);
      if (keywords.strong.length > 0) return 'high';    // "deprecated", "breaking", "sunset"
      if (keywords.medium.length > 0) return 'medium';  // "migration guide", "legacy"
      return 'low';
    }
    return 'low';  // Non-HTML content changes
  }

  // 5. Soft error detection
  if (change.change_type === 'error_format') return 'medium';

  // 6. Timing anomaly
  if (change.change_type === 'timing') return 'medium';

  // Default
  return 'medium';
}
```

**Summary of severity rules:**

| Condition | Severity |
|---|---|
| Removed field from JSON schema | Critical |
| HTTP 5xx status code | Critical |
| Sunset/Deprecation header appears | Critical |
| HTTP 404 status code | High |
| HTTP 4xx status code | High |
| Field type changed (string→number) | High |
| API version header changed | High |
| Changelog mentions "deprecated"/"breaking" | High |
| Added required field | High |
| HTTP 3xx status code | Medium |
| Other header changes | Medium |
| Soft error detected (200 with error body) | Medium |
| Response time 3x 30-day average | Medium |
| Changelog mentions "migration guide" | Medium |
| Added optional field | Low |
| Array reorder only | Low |
| Non-HTML content change | Low |

(Source: CHIRRI_SEVERITY_AND_WORKFLOW.md, Alex direction)

## 2.13 Feedback System *(Updated 2026-03-24)*

Dashboard modal for user feedback with structured input:

**Fields:**
- Type: bug / feature / complaint / other
- Text: free-form description
- Screenshot: optional attachment

**Storage:** Dedicated `feedback` table in PostgreSQL.

**Internal admin page:**
- Filter by type, status, plan
- Search by keyword
- Quick reply via support@chirri.io
- Users NEVER see other users' feedback
- No public voting, no public roadmap
- Feedback never auto-modifies shared detection (ever)

**Aggregate feedback pipeline:** Daily cron job groups feedback by URL+field, thresholds create internal review items. WE review and decide whether to add to system volatile list. Human-in-the-loop always for shared changes.

**Core rule:** False positive marking is suppressed FOR THAT USER ONLY. System detects volatile fields automatically during learning (based on actual data). No user, regardless of plan or account age, ever modifies shared volatile lists.

(Source: CHIRRI_FEEDBACK_LEARNING.md)

## 2.14 Soft Error Detection *(Updated 2026-03-24)*

Detect 200 OK responses that contain error body patterns:

**Patterns detected (5 core patterns):** *(Fixed 2026-03-24 -- Practical Review)*

```typescript
function detectSoftError(parsed: any): { detected: boolean; pattern?: string } {
  if (!parsed || typeof parsed !== 'object') return { detected: false };

  // Pattern 1: {"error": true} or {"error": "..."}
  if (parsed.error === true || (typeof parsed.error === 'string' && parsed.error.length > 0)) {
    return { detected: true, pattern: 'error_field' };
  }
  // Pattern 2: {"status": "error"} or {"status": "fail"}
  if (['error', 'fail'].includes(parsed.status)) {
    return { detected: true, pattern: 'status_error' };
  }
  // Pattern 3: {"success": false}
  if (parsed.success === false) {
    return { detected: true, pattern: 'success_false' };
  }
  // Pattern 4: {"errors": [...]} with non-empty array
  if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
    return { detected: true, pattern: 'errors_array' };
  }
  // Pattern 5: Known text patterns in any string field
  const allStrings = extractAllStrings(parsed);
  const errorPatterns = ['access denied', 'service unavailable', 'rate limit exceeded', 'maintenance mode'];
  for (const str of allStrings) {
    for (const pattern of errorPatterns) {
      if (str.toLowerCase().includes(pattern)) {
        return { detected: true, pattern: `text_${pattern.replace(/ /g, '_')}` };
      }
    }
  }
  return { detected: false };
}
```

**Learning integration:** During the learning period, record whether any soft error patterns match. If a response consistently contains `"success": true`, note that as expected baseline. If a check later returns `"success": false`, flag as potential soft error.

**Classification:** Treat soft errors as "degraded" not "changed" -- uses the `degraded` status on the URL, not a schema change event. This prevents noise from intermittent error responses while still alerting the user.

**Pipeline position:** *(Fixed 2026-03-24 -- Pentest v2)* Soft error detection runs in Step 6 (Response Processing) of the checking pipeline, AFTER body parsing and BEFORE baseline comparison. If a soft error is detected and the baseline response was healthy, the URL status transitions to `degraded` and a Medium-severity change event is created with `change_type: 'error_format'`. If the response was already degraded in the baseline, no change is emitted.

(Source: CHIRRI_PROBLEMS_SOLVED.md #16)

## 2.15 Proactive False Positive Detection *(Updated 2026-03-24)*

Beyond waiting for user reports, Chirri detects likely FP sources automatically:

- **Auto-flag fields changing on >90% of checks** across all monitors for a URL as likely volatile
- **Seed list of ~30 known volatile patterns:** request_id, timestamp, nonce, cache headers (cf-ray, x-cache, age), csrf tokens, trace IDs, rate limit counters, server-timing, set-cookie, etag
- **Prevents most FPs before users see them** -- catches ~70% of volatile fields proactively
- **V1.1:** Learning pipeline from aggregate feedback data refines detection further

**Volatility scoring per field:**
```
volatility_score(field) = (
  times_changed / times_checked * 0.4 +
  unique_values_ratio * 0.3 +
  pattern_match_score * 0.2 +
  fp_report_rate * 0.1
)

If volatility_score > 0.7 → auto-flag for review
```

(Source: CHIRRI_FEEDBACK_LEARNING.md Section 4)

## 2.16 API Dependency Intelligence *(Added 2026-03-24 -- New MVP Features)*

Chirri goes beyond "something changed" to "here's what it means for YOU." This feature detects upstream API dependencies and generates personalized impact analyses.

### 2.16.1 How It Works

Two capabilities working together:

**Part 1: API Dependency Chain Detection.** When a user monitors `api.mycompany.com/v1/payments`, Chirri automatically detects that the API wraps Stripe (via response headers, error patterns, doc references), auto-subscribes to Stripe's changelog/status page, and when Stripe changes something, alerts the user: "Your dependency changed."

**Part 2: Integration Impact Analysis (LLM-powered).** When any monitored API's docs/contract change, the system analyzes the contract before vs now, generates what changed, how the user's integration breaks, what to do, and sample code diffs — personalized to the specific endpoints the user monitors.

**Detection methods (ordered by reliability):**

| Tier | Signal | Example | Confidence |
|---|---|---|---|
| 1 (High) | HTTP Response Headers | `Stripe-Version: 2024-12-18`, `Via: kong/3.4` | ~85-95% |
| 1 (High) | Error Response Patterns | Stripe's distinctive `{"error": {"type": "card_error"}}` | ~85-90% |
| 1 (High) | API Gateway Signatures | AWS: `x-amzn-requestid`, Kong: `Via: kong` | ~90% |
| 2 (Medium) | Documentation References | "Built on Stripe", SDK import statements | ~70-85% |
| 2 (Medium) | OpenAPI Spec References | `$ref` to external schemas, `x-*` extensions | ~80-85% |
| 3 (Lower) | Response Field Names | `stripe_customer_id`, `twilio_sid` in responses | ~60-70% |

**Detection flow:** On URL add → probe response → match against fingerprint DB → score 0-1. Score ≥0.7 = auto-link (user can remove). Score 0.4-0.7 = suggest (user confirms). Score <0.4 = ignore.

**Impact analysis is LLM-powered.** Uses Claude Haiku 3.5 or GPT-5.4-nano by default (~$0.005-0.008 per analysis). Escalates to Sonnet/GPT-5.4 for breaking changes. Analyses are cached per `(change_id, api_id)` — if 100 users monitor Stripe, one LLM call serves all. Personalized overlay (user-specific endpoints, language preference) is a cheap secondary call.

**LLM role:** Impact analysis ONLY. The LLM generates the human-readable impact report. Detection, severity assignment, and classification remain deterministic (same as §2.12).

### 2.16.2 Data Model

```sql
-- Dependency chains between monitored URLs and known APIs
CREATE TABLE api_dependencies (
    id              TEXT PRIMARY KEY,       -- dep_ + nanoid(21)
    url_id          TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    api_slug        TEXT NOT NULL,          -- "stripe", "twilio"
    confidence      DECIMAL(3,2) NOT NULL,  -- 0.00-1.00
    detection_method TEXT NOT NULL,          -- "header", "error_pattern", "doc_reference", "user_confirmed"
    user_confirmed  BOOLEAN DEFAULT FALSE,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    dismissed_at    TIMESTAMPTZ,
    UNIQUE (url_id, api_slug)
);
CREATE INDEX idx_api_dependencies_url ON api_dependencies (url_id);

-- User's monitored endpoint context (what they actually use)
CREATE TABLE user_api_context (
    id              TEXT PRIMARY KEY,       -- uac_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url_id          TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    endpoints       JSONB NOT NULL DEFAULT '[]',   -- ["POST /v1/charges", "GET /v1/customers/{id}"]
    language        TEXT,                   -- "nodejs", "python", "go"
    sdk_version     TEXT,                   -- "stripe@14.0.0"
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_api_context_user ON user_api_context (user_id);

-- Impact analyses (cached, shareable across users with same change)
CREATE TABLE impact_analyses (
    id              TEXT PRIMARY KEY,       -- ima_ + nanoid(21)
    change_id       TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    api_slug        TEXT,
    raw_diff        TEXT NOT NULL,
    severity        TEXT NOT NULL CHECK (severity IN ('breaking', 'deprecation', 'additive', 'docs_only', 'uncertain')),
    summary         TEXT NOT NULL,
    impact_detail   TEXT NOT NULL,
    action_items    JSONB NOT NULL DEFAULT '[]',
    code_examples   JSONB DEFAULT '{}',     -- { "nodejs": "...", "python": "..." }
    confidence      DECIMAL(3,2) NOT NULL,
    model_used      TEXT NOT NULL,
    prompt_tokens   INT,
    output_tokens   INT,
    cost_usd        DECIMAL(10,6),
    upvotes         INT DEFAULT 0,
    downvotes       INT DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (change_id, api_slug)
);

-- Per-user personalized impact (references shared analysis + user context)
CREATE TABLE user_impact_views (
    id              TEXT PRIMARY KEY,       -- uiv_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_id     TEXT NOT NULL REFERENCES impact_analyses(id) ON DELETE CASCADE,
    user_context_id TEXT REFERENCES user_api_context(id) ON DELETE SET NULL,
    personalized_impact TEXT,
    personalized_code JSONB,
    read_at         TIMESTAMPTZ,
    feedback        TEXT CHECK (feedback IN ('helpful', 'unhelpful')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, analysis_id)
);
```

### 2.16.3 API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /v1/urls/:id/dependencies | List detected dependencies for a URL |
| POST | /v1/urls/:id/dependencies | Manually add a dependency |
| DELETE | /v1/urls/:id/dependencies/:dep_id | Remove/dismiss a dependency |
| POST | /v1/urls/:id/dependencies/:dep_id/confirm | Confirm auto-detected dependency |
| GET | /v1/changes/:id/impact | Get impact analysis (generate or return cached) |
| POST | /v1/changes/:id/impact | Trigger impact analysis generation |
| POST | /v1/changes/:id/impact/feedback | Submit feedback (helpful/unhelpful) |
| GET | /v1/account/api-context | Get user's endpoint context |
| PATCH | /v1/account/api-context | Update endpoint context (language, endpoints, SDK version) |

**MCP Tools:**
- `chirri_get_dependencies(monitor_id)` — list detected dependencies
- `chirri_get_impact_analysis(change_id)` — get or generate impact analysis
- `chirri_set_api_context(monitor_id, endpoints, language, sdk_version)` — set user context

### 2.16.4 Cost Model

| Scenario | Users | Changes/mo | Analyses/mo | Cost (Haiku) | With caching |
|---|---|---|---|---|---|
| Small | 100 | 500 | 500 | $4 | ~$1 |
| Medium | 1,000 | 5,000 | 5,000 | $40 | ~$10 |
| At scale | 10,000 | 50,000 | 50,000 | $400 | ~$100 |

Caching reduces costs ~75%. Top 20 APIs account for 80% of monitored endpoints; each API averages ~3 changes/month = ~60 unique analyses serving thousands of users.

**Free tier:** 5 impact analyses/month (on-demand "Analyze Impact" button). Paid tiers: unlimited + automatic.

### 2.16.5 Effort Estimate

~130 hours total (MVP: ~90h for basic impact analysis + manual dependency linking; V1.1: +40h for auto-detection fingerprinting).

(!) For complete implementation details: see CHIRRI_API_INTELLIGENCE.md

## 2.17 Auto-Generated Migration Checklists *(Added 2026-03-24 -- New MVP Features)*

When the early warning system or change detection pipeline detects a **deprecation or breaking change**, Chirri generates a personalized step-by-step migration checklist.

### 2.17.1 How It Works

**Trigger flow:**
1. Change detected with `change_type` = deprecation or breaking change
2. System checks for migration guide URL (from changelog scan, provider profile, or LLM extraction)
3. If migration guide found → fetch content, feed to LLM with user context
4. If not → use raw diff + known provider patterns, feed to LLM
5. LLM generates structured JSON checklist
6. Store in `migration_checklists` table (cached by change + user endpoint set)
7. Display on Change Detail page + include in notification

**Two trigger modes:**
- **Automatic (paid users):** Generated when deprecation/breaking change is confirmed (Step 9). Runs as background BullMQ job on `migration-checklists` queue.
- **On-demand (free users):** "Generate migration plan" button on Change Detail page. Rate-limited to 3/month on free tier.

**Personalization:** Checklist is personalized using `parsed_path`, `parsed_version`, and `user_api_context` (if provided). If user monitors `/v1/charges` and `/v1/customers`, only steps relevant to those endpoints are included.

**Checklist structure (modeled on Stripe's migration guides):**
1. What changed — one-sentence summary
2. Who is affected — which API versions, endpoints, SDKs
3. Step-by-step migration — numbered checklist with before/after code
4. Testing guidance — how to verify in sandbox/test mode
5. Deadline — when the old behavior stops working
6. Resources — links to docs, migration guide, SDK changelogs

### 2.17.2 Data Model

```sql
CREATE TABLE migration_checklists (
    id              TEXT PRIMARY KEY,         -- mcl_ + nanoid(21)
    change_id       TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context_hash    TEXT NOT NULL,            -- SHA-256(change_id + sorted user endpoint paths)
    summary         TEXT NOT NULL,
    affected_endpoints JSONB NOT NULL DEFAULT '[]',
    steps           JSONB NOT NULL DEFAULT '[]',
    -- steps schema: [{title, description, code_before?, code_after?, effort_minutes, completed: bool}]
    testing_notes   TEXT,
    deadline        TIMESTAMPTZ,
    total_effort_minutes INT,
    risk_level      TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
    completed_steps INT NOT NULL DEFAULT 0,
    total_steps     INT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'generated'
                    CHECK (status IN ('generating', 'generated', 'in_progress', 'completed', 'dismissed')),
    model_used      TEXT NOT NULL,
    prompt_tokens   INT,
    output_tokens   INT,
    cost_usd        DECIMAL(10,6),
    source_guide_url TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (change_id, user_id, context_hash)
);
CREATE INDEX idx_migration_checklists_user ON migration_checklists (user_id, status);
CREATE INDEX idx_migration_checklists_change ON migration_checklists (change_id);
```

**Caching:** Checklists with the same `context_hash` (same change + same endpoint set) are shared. Progress tracking (completed_steps) is per-user.

### 2.17.3 API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /v1/changes/:id/migration-checklist | Generate (or return cached) |
| GET | /v1/changes/:id/migration-checklist | Retrieve checklist |
| PATCH | /v1/migration-checklists/:id | Update step completion |
| DELETE | /v1/migration-checklists/:id | Dismiss checklist |
| GET | /v1/migration-checklists | List all active checklists for user |

**MCP Tools:**
- `chirri_generate_migration_checklist(change_id)` — generate or retrieve
- `chirri_get_migration_checklist(change_id)` — retrieve existing
- `chirri_list_migration_checklists(status?)` — list user's checklists
- `chirri_update_checklist_step(checklist_id, step_index, completed)` — mark step done

### 2.17.4 Effort Estimate

~57 hours: Data model (3h), LLM prompt engineering (12h), BullMQ job (6h), REST API (6h), MCP tools (3h), Frontend checklist component (10h), progress tracking (5h), caching (4h), testing (8h).

### 2.17.5 Risks

- **LLM hallucination:** May generate incorrect steps. Mitigation: always link to original migration guide; add "AI-generated — verify steps" disclaimer.
- **Stale checklists:** If provider updates their migration guide, cached checklist becomes stale. Mitigation: re-generate if migration guide page changes (detected by Chirri's own monitoring).

(!) For complete implementation details: see CHIRRI_NEW_FEATURES_IMPLEMENTATION.md §1

## 2.18 SDK/Package Version Intelligence *(Added 2026-03-24 -- New MVP Features)*

Monitor npm/PyPI/RubyGems package registries for SDK version changes and cross-reference them with the user's monitored API endpoints.

### 2.18.1 How It Works

**Data flow:**
1. User monitors `api.stripe.com/v1/charges`
2. Provider profile for Stripe includes: primary SDK = `stripe` (npm)
3. Scheduler enqueues package check job (every 6h for primary SDKs)
4. Worker fetches `https://api.deps.dev/v3/systems/npm/packages/stripe` (Google's free API)
5. Compare latest version against stored `last_known_version`
6. Patch bump → log only. Minor bump → check changelog. Major bump → ALWAYS notify + impact analysis
7. For major/minor: fetch CHANGELOG.md from GitHub, LLM cross-references with user's monitored endpoints

**Primary data source: deps.dev (Google's free API).** CC-BY 4.0 license. Covers npm, PyPI, Go, Maven, Cargo, NuGet. Provides version history, dependency graphs, security advisories, OpenSSF Scorecard data, license info. Direct registry APIs (npm, PyPI) used as fallback.

**API-to-SDK mapping** stored in provider profiles:
```yaml
# providers/stripe.yaml
sdks:
  - registry: npm
    package: stripe
    primary: true
  - registry: pypi
    package: stripe
    primary: false
```

User can also manually link packages via Settings or upload `package.json` for auto-detection.

### 2.18.2 Data Model

```sql
CREATE TABLE monitored_packages (
    id              TEXT PRIMARY KEY,         -- pkg_ + nanoid(21)
    user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,  -- NULL = system-level (shared)
    registry        TEXT NOT NULL CHECK (registry IN ('npm', 'pypi', 'rubygems', 'go', 'maven', 'nuget')),
    package_name    TEXT NOT NULL,
    provider_slug   TEXT,                     -- links to provider profiles
    url_id          TEXT REFERENCES urls(id) ON DELETE SET NULL,
    last_known_version TEXT,
    latest_version  TEXT,
    last_checked_at TIMESTAMPTZ,
    check_interval  TEXT NOT NULL DEFAULT '6h',
    source          TEXT NOT NULL DEFAULT 'provider_profile'
                    CHECK (source IN ('provider_profile', 'user_manual', 'package_json_scan')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, registry, package_name)
);
CREATE INDEX idx_monitored_packages_user ON monitored_packages (user_id);
CREATE INDEX idx_monitored_packages_provider ON monitored_packages (provider_slug);

CREATE TABLE package_versions (
    id              TEXT PRIMARY KEY,         -- pkv_ + nanoid(21)
    package_id      TEXT NOT NULL REFERENCES monitored_packages(id) ON DELETE CASCADE,
    version         TEXT NOT NULL,
    version_major   INT,
    version_minor   INT,
    version_patch   INT,
    is_prerelease   BOOLEAN NOT NULL DEFAULT FALSE,
    published_at    TIMESTAMPTZ,
    changelog_url   TEXT,
    changelog_content TEXT,
    breaking_changes JSONB,
    deprecations    JSONB,
    security_advisories JSONB,               -- From deps.dev
    impact_analysis TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_package_versions_package ON package_versions (package_id, published_at DESC);
```

### 2.18.3 API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /v1/packages | List monitored packages |
| POST | /v1/packages | Add package to monitor |
| DELETE | /v1/packages/:id | Remove package |
| GET | /v1/packages/:id/versions | Version history |
| GET | /v1/packages/:id/versions/:version | Version detail with analysis |
| POST | /v1/packages/scan | Upload package.json for auto-detection |

**MCP Tools:**
- `chirri_list_packages()` — list monitored packages
- `chirri_add_package(registry, package_name, url_id?)` — add package
- `chirri_get_package_versions(package_id, limit?)` — version history
- `chirri_scan_package_json(content)` — parse and auto-add packages

### 2.18.4 Effort Estimate

~73 hours: Data model (4h), registry API integration (10h), deps.dev integration (6h), semver logic (4h), changelog fetching+parsing (8h), LLM cross-reference (8h), BullMQ job (4h), REST API (6h), MCP tools (3h), Frontend packages UI (10h), package.json scan (4h), testing (6h).

(!) For complete implementation details: see CHIRRI_NEW_FEATURES_IMPLEMENTATION.md §3

## 2.19 Impact Simulator — "What Breaks If..." *(Added 2026-03-24 -- New MVP Features)*

Let developers ask: "What happens if I upgrade from Stripe API version X to Y?" Chirri compares the two API versions and generates a personalized impact report.

### 2.19.1 How It Works

**Three approaches depending on data availability:**

| Approach | When Available | Quality |
|---|---|---|
| OpenAPI Spec Diff | Provider has specs for both versions (Stripe, GitHub, Twilio) | Excellent |
| Changelog Analysis | Provider has detailed changelog | Good |
| Snapshot Diff | Chirri has historical snapshots in R2 | Decent |

**OpenAPI diff uses oasdiff** — a Go CLI with 300+ breaking change rules across 12 categories. Installed as a binary in the Docker image, called via `child_process.execFile()` with JSON output format. 30-second timeout per diff operation.

```typescript
async function runOasdiff(baseSpec: string, revisionSpec: string): Promise<OasdiffResult> {
  return execFilePromise('oasdiff', [
    'breaking', '--format', 'json',
    '--base', baseSpec, '--revision', revisionSpec
  ], { timeout: 30000 });
}
```

**LLM fallback for unstructured docs:** When no OpenAPI specs available, changelog entries between versions are collected and fed to LLM for analysis. Historical snapshots from R2 can be diffed and LLM summarizes the delta.

**Personalization:** Simulation results filtered to user's monitored paths. Shows "BREAKING", "WARNING", or "SAFE" per endpoint.

### 2.19.2 Data Model

```sql
CREATE TABLE simulations (
    id              TEXT PRIMARY KEY,         -- sim_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_slug   TEXT NOT NULL,
    from_version    TEXT NOT NULL,
    to_version      TEXT NOT NULL,
    method          TEXT NOT NULL CHECK (method IN ('openapi_diff', 'changelog_analysis', 'snapshot_diff')),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    breaking_changes JSONB,
    warnings        JSONB,
    safe_endpoints  JSONB,
    summary         TEXT,
    risk_score      INT,                      -- 0-10
    estimated_effort_hours DECIMAL(5,1),
    user_endpoints  JSONB,                    -- Snapshot of user's monitored paths
    base_spec_r2_key TEXT,
    revision_spec_r2_key TEXT,
    oasdiff_output  JSONB,
    model_used      TEXT,
    cost_usd        DECIMAL(10,6),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_simulations_user ON simulations (user_id, created_at DESC);
CREATE INDEX idx_simulations_provider ON simulations (provider_slug, from_version, to_version);
```

### 2.19.3 API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /v1/simulations | Create simulation |
| GET | /v1/simulations/:id | Get result |
| GET | /v1/simulations | List user's simulations |
| GET | /v1/providers/:slug/versions | List available versions for a provider |

**MCP Tools:**
- `chirri_simulate_upgrade(provider, from_version, to_version)` — run simulation
- `chirri_get_simulation(simulation_id)` — get results
- `chirri_list_provider_versions(provider_slug)` — list versions

### 2.19.4 Effort Estimate

~86 hours: Data model (3h), oasdiff binary integration (8h), version-specific spec fetching (10h), changelog aggregation (6h), snapshot diff from R2 (8h), LLM summarization (8h), REST API (6h), MCP tools (3h), Frontend simulation UI (12h), results display (8h), provider version catalog (6h), testing (8h).

### 2.19.5 Risks

- **Version discovery is hard.** Not all providers publish versioned OpenAPI specs. Gracefully degrade: OpenAPI diff → changelog analysis → snapshot diff.
- **oasdiff adds ~20MB Go binary** to Docker image. Acceptable trade-off for 300+ breaking change rules.
- **User's current version often unknown.** Simplest: user selects from/to versions in a dropdown.

(!) For complete implementation details: see CHIRRI_NEW_FEATURES_IMPLEMENTATION.md §4

## 2.20 Security & Compliance Flagging *(Added 2026-03-24 -- New MVP Features)*

A classification layer that runs on top of the existing diff engine. Every detected change passes through a security analyzer that checks for security-relevant patterns and flags them. **No LLM needed** — pure pattern matching.

### 2.20.1 How It Works

Runs in **Step 8 (Change Detection)** of the checking pipeline, after `jsondiffpatch.diff()` and classification, before Step 9 (Confirmation Recheck):

1. Pattern match on response headers (TLS, auth, CORS, security headers)
2. Pattern match on response body field names (OAuth scopes, auth fields, sensitive data)
3. Keyword match on changelog content (security, auth, encryption terms)
4. If security-relevant: add `security_flags` to change record, boost severity, flag for bypass_quiet_hours

### 2.20.2 Security Change Categories

| Category | Detection Method | Severity Boost |
|---|---|---|
| TLS version change | `Strict-Transport-Security` max-age change | +1 level |
| Auth method change | `WWW-Authenticate` header changes, auth-related body fields | +1 level |
| OAuth scope change | Body field changes mentioning scope/permission | +1 level |
| CORS policy change | `Access-Control-Allow-Origin/Methods` changes | +1 level if more restrictive |
| Rate limit change | `X-RateLimit-*` header changes | No boost (informational) |
| Security header removal | CSP, X-Frame-Options, X-Content-Type-Options removed | +1 level |
| Sensitive field data format change | Type change on fields matching password/token/key/secret/ssn/credit_card patterns | +1 level |
| API key format change | Key prefix/format changes | +1 level |

### 2.20.3 Implementation

```typescript
const SECURITY_HEADERS = [
  'strict-transport-security', 'content-security-policy',
  'x-frame-options', 'x-content-type-options', 'referrer-policy',
  'permissions-policy', 'x-xss-protection',
  'access-control-allow-origin', 'access-control-allow-methods',
  'www-authenticate',
];

const SENSITIVE_FIELD_PATTERNS = [
  /password/i, /token/i, /secret/i, /key/i, /auth/i,
  /credit.?card/i, /ssn/i, /social.?security/i,
  /account.?number/i, /routing.?number/i, /cvv/i, /cvc/i,
  /pin/i, /otp/i, /mfa/i, /2fa/i,
];
```

### 2.20.4 Data Model Changes

No new table. Add columns to `changes` table:

```sql
ALTER TABLE changes ADD COLUMN security_flags JSONB DEFAULT NULL;
-- Schema: [{category, description, severity, header_or_field, old_value, new_value}]
ALTER TABLE changes ADD COLUMN security_severity_boost INT DEFAULT 0;
ALTER TABLE changes ADD COLUMN compliance_tags TEXT[] DEFAULT '{}';
-- e.g., {"PCI-DSS", "SOC2"}
ALTER TABLE changes ADD COLUMN bypass_quiet_hours BOOLEAN DEFAULT FALSE;
```

### 2.20.5 Notification Behavior

- Security-flagged changes **always bypass quiet hours** (configurable via notification rules)
- **"SECURITY" badge** in notifications (email subject prefix, Slack emoji, Discord embed color)
- Severity boost applies **BEFORE** notification rule evaluation

### 2.20.6 API Surface

No new endpoints. Security data returned as part of existing change responses:
- `GET /v1/changes?security_flag=true` — filter changes by security relevance
- `GET /v1/changes/:id` — response includes `security_flags`, `compliance_tags`

**MCP:** `chirri_list_changes(security_only: true)` — filter parameter on existing tool.

### 2.20.7 Effort Estimate

~34 hours: Security analyzer module (8h), header analysis patterns (4h), sensitive field detection (3h), DB migration (2h), pipeline integration (4h), notification bypass logic (3h), Frontend badges+section (4h), security filter (2h), testing (4h).

(!) For complete implementation details: see CHIRRI_NEW_FEATURES_IMPLEMENTATION.md §5

## 2.21 Historical Event Collection *(Added 2026-03-24 -- New MVP Features)*

Store every detected change event from day 1 for future analytics, pattern analysis, and provider health scoring. The UI for historical analytics is V2; the **data collection starts now** so we have 6+ months of data when we build the UI.

### 2.21.1 Data Model

```sql
CREATE TABLE provider_events (
    id              TEXT PRIMARY KEY,         -- pev_ + nanoid(21)
    provider_slug   TEXT NOT NULL,            -- "stripe", "openai", etc.
    domain          TEXT NOT NULL,            -- "api.stripe.com"
    event_type      TEXT NOT NULL
                    CHECK (event_type IN ('breaking_change', 'deprecation', 'additive_change',
                           'status_incident', 'sdk_major', 'sdk_minor', 'pricing_change',
                           'security_change', 'docs_update', 'sunset_header', 'deprecation_header')),
    severity        TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title           TEXT NOT NULL,
    description     TEXT,
    change_id       TEXT REFERENCES changes(id) ON DELETE SET NULL,
    forecast_id     TEXT REFERENCES forecasts(id) ON DELETE SET NULL,
    source_type     TEXT,                     -- "api_check", "changelog", "status_page", "sdk", "header"
    source_url      TEXT,
    deadline        TIMESTAMPTZ,              -- For deprecations
    metadata        JSONB DEFAULT '{}',       -- Flexible storage for event-specific data
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_provider_events_provider ON provider_events (provider_slug, detected_at DESC);
CREATE INDEX idx_provider_events_type ON provider_events (event_type, detected_at DESC);
CREATE INDEX idx_provider_events_domain ON provider_events (domain, detected_at DESC);
```

### 2.21.2 Collection Strategy

Events are inserted automatically by the check worker whenever:
- A change is confirmed (Step 9 of pipeline) → insert with `change_id` reference
- A forecast is created → insert with `forecast_id` reference
- A sunset/deprecation header appears for the first time → insert with `event_type: 'sunset_header'`
- An SDK major/minor version is detected → insert with version info in `metadata`

**No extra HTTP requests.** Piggybacks on existing detection pipeline. Cost: one INSERT per event (~trivial).

### 2.21.3 Future Use (V2)

- **Provider health score:** Breaking change frequency, deprecation notice duration, uptime
- **Predictive forecasting:** Statistical model on historical change intervals
- **Comparative analytics:** "Stripe averages 4.2 months between breaking changes; Twilio averages 2.1"
- **SEO content:** Auto-generated "State of API Changes 2026" reports

---

# PART 3: EARLY WARNING SYSTEM

## 3.1 The Concept

Chirri's early warning system is a "weather forecast for your API dependencies." It detects signals of upcoming changes -- deprecation announcements, sunset headers, SDK major version bumps -- before the actual breaking change hits.

This runs as a post-processing layer on top of the existing check pipeline. Zero extra HTTP requests for header-based signals. Changelog scanning piggybacks on existing content change detection. Package version checks run on a separate queue.

## 3.2 Signal Types

Chirri detects 8 types of early warning signals:

| Signal Type | Source | Confidence | Extra HTTP? |
|---|---|---|---|
| **Sunset Header** (RFC 8594) | Response headers | 90-95 | No |
| **Deprecation Header** (RFC 9745) | Response headers | 90-95 | No |
| **API Version Header Change** | Response headers | 60-80 | No |
| **Changelog Keyword** | Changelog content diff | 50-90 | No (piggybacks) |
| **OpenAPI deprecated:true** | Spec structural diff | 85 | No (piggybacks) |
| **SDK Major Version Bump** | npm/PyPI/GitHub | 65-90 | Yes (separate queue) |
| **GitHub Release Signal** | GitHub Atom feed | 60-80 | Yes (separate queue) |
| **Status Page Maintenance** | Statuspage.io JSON | 80 | No (piggybacks) |

Sunset/Deprecation header parsing uses the `structured-headers` library for RFC 9651 compliance. Date extraction from changelog text uses `chrono-node` (WITHOUT `forwardDate: true` -- dates are parsed relative to publication date, not forward-biased).

**Header parsing details:**

The Sunset header (RFC 8594) uses HTTP-date format: `Sat, 31 Dec 2026 23:59:59 GMT`. Parsed directly via Date constructor.

The Deprecation header (RFC 9745) uses Structured Field Date: `@1688169599` (epoch seconds) or `@1` (boolean -- already deprecated, no date). Parsed via `structured-headers` library.

Non-standard headers also checked: `X-Deprecated`, `X-API-Deprecated`, plus Link rel="deprecation" and rel="sunset" for documentation URLs.

**First-detection vs. already-present logic:** Compare current headers against previous header_snapshot. Only alert when a deprecation/sunset header APPEARS for the first time, or when its date CHANGES. Headers already present on first check are flagged with lower confidence (60 vs 95).

**Changelog keyword scanning:**

25+ keywords grouped by strength:
- Strong (high confidence): deprecated, deprecating, sunset, end of life, breaking change, will be removed, will stop working, migration required, decommission
- Medium: migration guide, upgrade guide, replacing, legacy, removed, end of support
- Info: new version, major update, v2/v3/v4

Only ADDED content is scanned (not existing text). Uses paragraph-level diffing to identify new paragraphs/sections, then scans those for keywords. chrono-node extracts dates WITHOUT forwardDate (dates resolved relative to changelog publication date, not future-biased).

**Date extraction edge cases:**
- "Q3 2026" handled by custom chrono-node parser (quarter to month mapping)
- "in the coming months" captured as vague timeframe, not a specific date
- Past dates (>1 year ago) get 50% confidence reduction to avoid false forecasts from historical content

(!) For complete implementation: see CHIRRI_EARLY_WARNING_IMPLEMENTATION.md

## 3.3 Smart Chirp Logic

When a shared/bonus source detects a signal, Chirri determines whether it's relevant to each subscriber's specific endpoints using a 3-layer relevance matching engine:

**Layer 1: Structural Extraction** -- Extract paths, versions, products, and action intent from signal text using regex. Zero NLP, <1ms.

**Layer 2: Path-Based Relevance Matching** -- Match extracted facts against each user's monitored URL:
- Exact path match (score 0.95): signal mentions `/v1/charges`, user monitors `/v1/charges`
- Version match (score 0.80): signal affects "v1 endpoints", user is on v1
- Product match (score 0.70): signal mentions "Sources API", user's path contains "sources"
- Service-wide (score 0.70): signal says "all API endpoints"
- Anti-relevance: signal affects v1, user is on v2 --> score drops to 0.15

**Layer 3: Status Page** -- Service degradation is relevant to all users on the domain, regardless of version/path.

**Fan-out performance:** For 1,000 users on Stripe, the entire relevance matching + notification takes <500ms. Path-grouped fan-out means performance depends on unique path patterns (~50-100), not user count. *(Fixed 2026-03-24 -- Pentest v2)* At scale beyond 1K users (e.g., 10K users on one provider), fan-out is batched: user_changes inserts use COPY or multi-row INSERT (1K rows per batch), notification jobs are enqueued in batches of 100. Total fan-out for 10K users: ~5-10 seconds, not the <500ms target for 1K users.

(!) For complete pipeline: see CHIRRI_RELEVANCE_INTELLIGENCE.md

## 3.4 Escalation

Signals don't just accumulate -- they escalate over time. The escalation window is dynamic, driven by content:

- Explicit deadline: window = deadline - now, milestones at 50%, 25%, 10%, 5%, 1%
- "In the coming months": assume 6 months
- "In a future version": assume 12 months
- No deadline: no time-based escalation, purely evidence-based

**Evidence accumulation model:** Each signal type contributes evidence points (sunset header: +35, changelog keyword: +10, migration guide: +20). Score is ratio-based, not absolute count -- 1/1 sources confirming is treated the same as 10/10.

**Escalation levels:** info --> advisory --> warning --> urgent --> critical. Determined by combining evidence score and deadline proximity in a 2D matrix.

**Re-notification rules:**
- Chirp on level CHANGE, not every signal
- Deadline milestone chirps (adaptive to deadline distance)
- New evidence within 24h: batch into "Additional evidence" update
- Stale events (no new signals for 180+ days, no deadline): marked stale, no continued chirping

**Real-world escalation example:**

```
Week 1:  Changelog mentions "considering v1 changes"
         --> info level, evidence score 15
         --> Dashboard only, no notification

Week 3:  Deprecation header appears on /v1/charges
         --> evidence score jumps to 50 (header = +30, corroboration = +5)
         --> warning level
         --> Full notification: "Escalated: Deprecation header now confirms v1 sunset"

Week 5:  OpenAPI spec marks /v1/charges as deprecated:true
         --> evidence score reaches 75 (spec = +25)
         --> urgent level (approaching 90-day deadline)
         --> "Confirmed: 3 sources agree on /v1/charges deprecation"

Day -7:  Deadline 7 days away
         --> critical level regardless of evidence score
         --> Daily reminders begin
```

**Signal polarity (reversals):**
Not all signals are positive. When a provider says "we decided to keep v1" or a Sunset header disappears, that's a NEGATIVE signal. Negative signals reduce evidence score by 2x the positive value. User notified: "Reversal detected: [provider] appears to have reversed their deprecation."

(!) For complete escalation model: see CHIRRI_ESCALATION_AND_SEVERITY.md

## 3.5 Content-Dependent Severity Extraction

Severity comes from WHAT was said, not just WHERE it was said. The severity extractor analyzes 5 dimensions:

- **Urgency** (30% weight): "immediately" = critical, "will be removed" = high, "deprecated" = medium, "considering" = low
- **Timeline** (25% weight): <7 days = 100, 30-90 days = 60, >1 year = 25, none = 0
- **Scope** (20% weight): service-wide = 100, product = 80, version = 60, endpoint = 40, field = 20
- **Action Required** (15% weight): "must migrate" = 100, "please migrate" = 70, "no action needed" = 0
- **Finality** (10% weight): "has been removed" = 100, "will be deprecated" = 80, "considering" = 15

Negative modifiers reduce scores: "don't currently plan to turn it off" near "deprecated" reduces severity by 30 points.

All patterns are regex-based for MVP. Tested against 10 real-world deprecation announcements with ~95% accuracy.

## 3.6 LLM Chirp Summarization

Every chirp notification includes a one-sentence LLM-generated summary of the detected signal. Cost: ~$0.003 per call using GPT-4o-mini. Summaries are cached per `sha256(diff)` (not per user) so the same signal sent to 1,000 users costs one LLM call.

**Critical clarification:** *(Fixed 2026-03-24 -- Practical Review)* The LLM is used for ONE thing only: **summarization**. It generates the human-readable one-sentence summary. The LLM does NOT:
- Assign severity (severity is rule-based, see §2.12)
- Classify change types (classification is deterministic heuristics)
- Decide confidence scores (confidence is formula-based, see §3.7)
- Determine relevance (relevance is path-matching, see §3.3)
- Make any detection decisions

Detection is pure regex + chrono-node + jsondiffpatch + deterministic rules. The LLM is a presentation layer only.

**Fallback when LLM is unavailable:** *(Fixed 2026-03-24 -- Practical Review)* Template-based fallback summaries:
```typescript
function generateFallbackSummary(change: Change): string {
  if (change.change_type === 'schema') {
    const removed = countRemovedFields(change.diff);
    const added = countAddedFields(change.diff);
    return `Schema changed: ${removed} fields removed, ${added} fields added`;
  }
  if (change.change_type === 'status_code') {
    return `HTTP status changed: ${change.previous_status_code} → ${change.current_status_code}`;
  }
  if (change.change_type === 'header') {
    return `Response headers changed: ${change.diff.added?.join(', ') || 'modified'}`;
  }
  return `${change.change_type} change detected`;
}
```

**LLM fallback:** *(Fixed 2026-03-24 -- Pentest v2)* If GPT-4o-mini is unavailable (timeout after 10s, 3 retries with exponential backoff): notifications go out WITHOUT a summary. The notification includes the raw change type + severity + affected fields instead of an AI-generated sentence. Template-based fallback: "Breaking change detected on {url}: {change_type} affecting {field_list}." Summary is backfilled when LLM becomes available (queued for retry).

(Source: Alex direction)

## 3.7 Confidence Scoring

Confidence is a 0-100 score answering "how sure are we this is real and actionable?"

**Factors:**
- Source reliability (sunset header: 90, changelog keyword: 70, blog: 45)
- Temporal specificity (has date: +10, vague timeframe: +5)
- Signal clarity (multiple keywords: +5, migration target identified: +5)
- Corroboration (each additional source: +8, capped at +20)
- Relevance score (<0.5: multiply by 0.8, >=0.85: +5)

**Thresholds:**
- >=60: Full chirp (notification + dashboard + webhook)
- 40-59: Dashboard + webhook with "low confidence" label, NO push notification
- <40: Dashboard only with human-readable explanation

Nothing is swallowed silently. Every detected signal reaches the user somehow.

**Human-readable reasoning is mandatory** on every signal:
"High confidence: Deprecation header (Sept 1, 2026) + changelog announcement + OpenAPI spec all confirm /v1/charges sunset."

## 3.8 Forecast States and Reminder System

Forecasts have a lifecycle: active --> acknowledged --> expired / superseded / resolved / false_positive

**Deadline reminders** use adaptive milestones (not fixed intervals):
- >365 days: remind at 180, 90, 30, 14, 7, 3, 1 days
- 90-365 days: 60, 30, 14, 7, 3, 1
- 30-90 days: 14, 7, 3, 1
- <7 days: daily

Reminders are database-polled (daily cron), not BullMQ delayed jobs, because deadlines can change. When a deadline moves, reminder tracking resets automatically.

## 3.9 Forecast Deduplication

When multiple signals describe the same event (changelog + sunset header + OpenAPI deprecated:true), users should get ONE forecast, not three.

**Dedup key construction:**
```
dedup_key = SHA-256(provider_slug + ":" + direction + ":" + target_path + ":" + deadline_month)
```

Example: `sha256("stripe:deprecation:/v1/charges:2026-09")`

### Cross-Source Correlation Dedup Key Construction *(Fixed 2026-03-24 -- Practical Review)*

When signals arrive from different source types (changelog, sunset header, OpenAPI spec), the dedup key enables automatic correlation:

```typescript
function computeDedupeKey(signal: Signal): string {
  const parts = [
    signal.provider_slug,                                    // "stripe"
    signal.action_type,                                      // "deprecation"
    signal.affected_paths[0] || '',                          // "/v1/charges"
    signal.deadline ? signal.deadline.toISOString().slice(0, 7) : 'no_deadline',  // "2026-09"
  ];
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex');
}
```

**Matching "Q3 2026" to "Sep 1, 2026":** Both round to deadline_month `2026-09` (chrono-node parses "Q3 2026" → July 1, but dedup uses month granularity; the forecast's deadline updates to the most specific date when a more precise signal arrives).

**Cross-source notification deduplication:** *(Fixed 2026-03-24 -- Practical Review)* When a bonus source (e.g., changelog) detects a change and later another source (e.g., OpenAPI spec) detects the same change:

1. Match existing forecast/change via dedup key
2. Link to existing record (don't create new one)
3. Boost confidence by signal weight (+20 for sunset header, +15 for spec, +10 for changelog)
4. Add to `signal_evidence` table
5. Do NOT send a new notification (user already knows)
6. DO notify if confidence crossed a threshold (e.g., 50→80)

```typescript
async function processSignalDetection(signal, sharedSourceId) {
  const dedupKey = computeDedupeKey(signal);
  const existing = await db.select().from(forecasts)
    .where(eq(forecasts.dedup_key, dedupKey)).limit(1);

  if (existing.length > 0) {
    const forecast = existing[0];
    const confidenceBoost = { sunset_header: 20, deprecation_header: 20,
      changelog_keyword: 10, openapi_deprecated: 15 }[signal.signal_type] || 5;
    const newConfidence = Math.min(100, forecast.confidence + confidenceBoost);

    await db.update(forecasts).set({
      confidence: newConfidence,
      signal_types: [...forecast.signal_types, signal.signal_type],
    }).where(eq(forecasts.id, forecast.id));

    // Notify only if threshold crossed
    if (forecast.confidence < 80 && newConfidence >= 80) {
      await notifyConfidenceIncrease(forecast.id);
    }
    return { deduplicated: true };
  }
  return processNewForecast(signal);
}
```

**When new signal arrives with matching dedup key:**
- Same source type --> SKIP (exact duplicate)
- Different source type --> MERGE (corroborating evidence):
  - Boost existing forecast confidence by signal weight (sunset header: +20, changelog: +10, spec: +15)
  - Add to signal_evidence table
  - Update signal_types array
  - Update deadline if new signal has more specific date
  - Do NOT create new notification (original chirp already went out)
  - But DO notify if confidence crossed a threshold (e.g., 50 --> 80)

**User sees correlated signals as one forecast with timeline:**
```
Stripe /v1/charges Deprecation (confidence: 95)
  Mar 15: Changelog -- "v1/charges deprecated September 1, 2026"
  Mar 16: Sunset Header -- Sunset: Mon, 01 Sep 2026
  Mar 17: OpenAPI Spec -- /v1/charges marked deprecated:true
```

(!) For complete early warning implementation: CHIRRI_EARLY_WARNING_IMPLEMENTATION.md
(!) For relevance intelligence: CHIRRI_RELEVANCE_INTELLIGENCE.md
(!) For escalation model: CHIRRI_ESCALATION_AND_SEVERITY.md

## 3.10 Dependency Graph Visualization *(Added 2026-03-24 -- New MVP Features)*

An interactive visual map showing the user's monitored APIs, their dependencies, SDKs, and health status. Built with React Flow and dagre layout.

### 3.10.1 How It Works

**Node types:**
- `app` — The user's application (center node)
- `api` — Monitored API endpoint (e.g., api.stripe.com/v1/charges)
- `provider` — API provider (e.g., Stripe)
- `sdk` — SDK package (e.g., stripe@18.0.0)
- `upstream` — Detected upstream dependency

**Edge types:**
- `monitors` — User's app → API endpoint
- `provides` — Provider → API endpoint
- `wraps` — SDK → Provider
- `depends_on` — Provider → upstream provider (from dependency detection)

**Graph data computed from existing tables** — no new tables needed:
- `urls` → API endpoint nodes
- `monitored_packages` → SDK nodes
- `api_dependencies` → dependency edges
- `changes` (30-day lookback) → health status (color of nodes)
- Provider profiles → provider metadata nodes

### 3.10.2 Libraries

| Library | Purpose | Notes |
|---|---|---|
| `@xyflow/react` (React Flow) | Interactive graph rendering | DOM-based nodes (custom React components for health badges, sakura styling). 25K+ GitHub stars. MIT. |
| `dagre` | Graph layout algorithm | Hierarchical layout with user's app at top. |

**Why React Flow:** Chirri's graphs will have 5-50 nodes. The ability to render custom React components as nodes (with sakura-styled health badges, change counts) is worth more than raw performance. Canvas-based alternatives (Cytoscape.js) are overkill for this scale.

### 3.10.3 Node Styling

| Status | Node Border | Background | Animation |
|---|---|---|---|
| Healthy | `#E5E7EB` (gray-200) | white | None |
| Warning (deprecation) | `#FBBF24` (amber-400) | `#FFFBEB` | Slow pulse |
| Breaking change | `#EF4444` (red-500) | `#FEF2F2` | Fast pulse |
| New change (<24h) | `#FFB7C5` (sakura) | `#FFF0F3` | Sakura petal animation |
| Unknown/no data | `#D1D5DB` (gray-300) | `#F9FAFB` | None |

### 3.10.4 API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /v1/dependency-graph | Computed graph for current user |

Returns:
```typescript
interface DependencyGraph {
  nodes: GraphNode[];  // {id, type, label, url?, status, change_count_30d, last_change_at, metadata}
  edges: GraphEdge[];  // {source, target, type, confidence?}
}
```

**MCP Tool:** `chirri_get_dependency_graph()` — returns same structure.

### 3.10.5 UI Location

- **Dashboard:** "Dependency Map" tab (alongside URL list and changes list)
- **Standalone page:** `/dependencies` — full-page interactive graph
- **Click interactions:** Click node → sidebar panel with details (recent changes, health timeline, linked issues). "View changes" → filtered changes list.
- **Mobile (<768px):** Fall back to simplified list/tree view (interactive graphs are painful on mobile)

### 3.10.6 Effort Estimate

~50 hours: Graph data assembly API (6h), React Flow setup (4h), custom node components (10h), dagre layout (4h), health status calculation (4h), click interaction sidebar (8h), animations (4h), responsive fallback (4h), MCP tool (2h), testing (4h).

(!) For complete implementation details: see CHIRRI_NEW_FEATURES_IMPLEMENTATION.md §7

---

# PART 4: PRICING & BUSINESS

## 4.1 Pricing Tiers *(Updated 2026-03-24)*

| | Free | Personal ($5/mo) | Team ($19/mo) | Business ($49/mo) | Enterprise |
|---|---|---|---|---|---|
| **URL slots** | 3 | 10 | 50 | 200 | Custom |
| **Min check interval** | Daily | 1 hour | 15 minutes | 5 minutes | 1 minute |
| **Notifications** | Email + Discord | Email, Discord, Webhooks | All integrations | All integrations | Custom, SSO |
| **API + MCP access** | Yes (10 req/hr) | Yes (60 req/hr) | Yes (200 req/hr) | Yes (500 req/hr) | Custom |
| **Team seats** | — | — | — | — | Custom |

(*) No seats on any plan. Team collaboration features = V2, triggered by demand.
(*) Plan names signal who it's FOR, not collaboration features.
(*) API + MCP access on ALL tiers including free (with rate limits as shown).
(*) MVP launches with Free + Personal. Team and Business tiers added when demand warrants.
(*) Enterprise tier added when 500+ users reached.

**Annual billing:** 20% off (2 months free). $4/mo for Personal annually. Don't push annual at signup -- let users experience value on monthly first. Push after 2+ months of active usage.

**Stripe billing implementation:**
- Products: Chirri Personal, Chirri Team, Chirri Business (created in Stripe Dashboard)
- Checkout: `stripe.checkout.sessions.create()` with `mode: 'subscription'`
- Upgrade: `stripe.subscriptions.update()` with `proration_behavior: 'always_invoice'` (charge difference immediately)
- Downgrade: `stripe.subscriptions.update()` with `proration_behavior: 'create_prorations'` (credit on next invoice)
- Customer portal: `stripe.billingPortal.sessions.create()` for self-service billing management
- Dunning: Stripe Smart Retries + 4-email sequence over 14 days + downgrade to Free after 14 days

**Stripe webhook events handled:**
- checkout.session.completed --> provision plan
- invoice.paid --> confirm active access
- invoice.payment_failed --> send dunning email, restrict after N failures
- customer.subscription.updated --> sync plan & status
- customer.subscription.deleted --> downgrade to free

**Downgrade execution:** Set plan to 'free', adjust intervals to daily, pause excess URLs (user's choice or most-recently-created first after 72h).

### Stripe Billing Flow Details *(Fixed 2026-03-24 -- Practical Review)*

**New subscription (Free → Personal):**
1. User clicks "Upgrade to Personal" → `POST /v1/account/billing/checkout { "plan": "personal" }`
2. API creates Stripe Checkout Session with `mode: 'subscription'`, `success_url`, `cancel_url`, user metadata
3. User redirected to Stripe Checkout, completes payment
4. Stripe webhook `checkout.session.completed` → API updates user's plan, `stripe_customer_id`, `stripe_subscription_id`
5. User redirected back to dashboard, sees updated plan immediately

**Upgrade (Personal → Team):**
Uses `stripe.subscriptions.update()` with `proration_behavior: 'always_invoice'` (charge prorated difference immediately). No redirect needed — API call completes synchronously. Stripe fires `invoice.paid` webhook.

**Downgrade (Team → Personal):**
Uses `stripe.subscriptions.update()` with `proration_behavior: 'create_prorations'` (credit appears on next invoice). If `oldPlan.maxUrls > newPlan.maxUrls` and user has more URLs than new limit:
1. Send email: "Choose which URLs to keep after downgrade"
2. Store pending downgrade with 72h deadline
3. After 72h, if user hasn't chosen: auto-pause most-recently-created URLs beyond the new plan limit

**Payment failure during checkout:** Stripe Checkout shows inline error ("Card declined"). User can retry with different payment method. No webhook fired until success.

**Recurring payment failure (dunning):** See §7.1 for the 4-email dunning sequence. After 14 days of failed payments, `customer.subscription.deleted` webhook fires → auto-downgrade to Free, pause excess URLs.

(Source: CHIRRI_SOURCE_TRACKING_MODEL.md, CHIRRI_CATEGORY_B_RESEARCH.md B7/B8, CHIRRI_INTEGRATION_DETAILS.md, Alex direction)

## 4.2 Source Tracking Model Economics

One provider with 4 bundled sources costs ~$0.001/day (~$0.03/month). At scale with shared monitoring deduplication, cost approaches zero (1,000 users monitoring Stripe's changelog = 1 HTTP check).

| Plan | Revenue/User | Bundled Cost | Custom URL Cost | Total Cost | Margin |
|---|---|---|---|---|---|
| Free | $0 | $0.06/mo | $0.05/mo | $0.11/mo | -$0.11 |
| Personal ($5) | $5/mo | $0.10/mo | $0.45/mo | $0.55/mo | $4.45 (89%) |
| Team ($19) | $19/mo | $0.30/mo | $4.50/mo | $4.80/mo | $14.20 (75%) |
| Business ($49) | $49/mo | $0.60/mo | $18.00/mo | $18.60/mo | $30.40 (62%) |

*(Updated 2026-03-24)*

Break-even: 10 Personal subscribers ($50/mo) or 3 Team subscribers ($57/mo).

(Source: CHIRRI_SOURCE_TRACKING_MODEL.md Section 7)

## 4.3 Revenue Projections (Conservative) *(Updated 2026-03-24)*

| Metric | Month 3 | Month 12 |
|---|---|---|
| Free signups | 800 | 5,000 |
| Paid conversions (3%) | 24 | 150 |
| MRR | $500 | $3,750 |
| ARR | — | $45,000 |

Industry benchmark for freemium developer tools: 1-3% conversion rate. $5 entry price expected to improve conversion rate vs $9. Lower per-user revenue offset by higher conversion volume and stronger upgrade pipeline.

**Real-world deprecation timelines (research from actual providers):**

| Provider | Lead Time | Pattern |
|---|---|---|
| Stripe (Sources API) | 5+ years, no hard cutoff | Blog --> docs --> migration guide --> changelog "deprecated" --> email campaigns |
| OpenAI (models) | 3-12 months, always specific date | Deprecation page + email (same day) --> reminders --> shutdown |
| Twitter/X (v1.1) | 0 days to 7 months (chaotic) | Announcements without dates, silent breakage, contradictory signals |
| Heroku (free tier) | 3 months exact | Blog + changelog + email (same day) --> 30-day reminder --> shutdown |
| Google+ (API) | 10 months, compressed to 5 | Blog (10mo) --> security incident --> acceleration (3mo) --> shutdown |
| Twilio (Video) | 12 months, extended to 36 | Email --> community pushback --> deadline extended 2 years |

Key insight: deadlines move BOTH forward (Google+) and backward (Twilio). The escalation system must handle both.

(Source: CHIRRI_GROWTH_STRATEGY.md, CHIRRI_ESCALATION_AND_SEVERITY.md)

## 4.4 Market Size

- 12.8M developers use third-party APIs worldwide (JetBrains + Nordic APIs data)
- TAM: $500M-$1.3B (API monitoring sub-market within $8.86B API management market)
- SAM: $115M-$230M (developers who actively monitor APIs, ~5-10%)
- SOM Year 1: $52.5K ARR (<0.01% of SAM)
- API management market CAGR: 16.83% (Mordor Intelligence)
- Website monitoring software market: growing at 9.3-18.6% CAGR

(Source: CHIRRI_MARKET_ANALYSIS.md Section 3)

## 4.5 Competitors

| Competitor | What They Do | Threat to Chirri |
|---|---|---|
| **changedetection.io** | Generic web page change detection, 22K+ GitHub stars, $8.99/mo for 5K URLs | Medium -- "good enough" for some; no API schema awareness |
| **UptimeRobot** | Uptime monitoring, undergoing 425% price hike backlash | Low -- different product; migration wave is a marketing opportunity |
| **Better Stack** | Uptime + logs + incidents, starts at $29/mo | Low -- different product category |
| **Checkly** | Synthetic monitoring (your own APIs), $24/mo | Low -- monitors YOUR APIs, not third-party |
| **Postman Monitors** | Collection-based testing, $9/user/mo | Medium -- has developer trust; acquired Akita |
| **API Drift Alert** | Direct competitor concept, $149-749/mo | None -- appears dead, validated market at wrong price |
| **Datadog Synthetic** | Enterprise monitoring, $8,500+/mo at scale | Very low -- different universe |

**Chirri's unique quadrant:** Simple + developer-first + affordable + API-specific. No one else occupies this space.

(!) For deep competitive analysis: see CHIRRI_MARKET_ANALYSIS.md

---

# PART 5: TECHNICAL ARCHITECTURE

## 5.1 System Overview

### Single-Process vs Multi-Service at MVP *(Fixed 2026-03-24 -- Practical Review)*

Chirri runs as **3 separate Railway services** at MVP, NOT a single process. Rationale:
- **Horizontal scaling differs:** API scales on HTTP load, workers scale on queue depth, scheduler is singleton
- **Resource patterns differ:** API is CPU-bound (JSON parsing), workers are I/O-bound (HTTP fetches)
- **Failure isolation:** Worker crash shouldn't take down API; API deploy shouldn't interrupt in-flight checks
- **Deployment independence:** Can deploy API changes without restarting workers
- Cost: 3 services × $5/mo base = $15/mo. The $5/mo savings from merging services is NOT worth the complexity/isolation loss.

Three Railway services on the Hobby plan, backed by managed Postgres and Redis:

```
                     Cloudflare CDN
                          |
            +-------------+-------------+
            |                           |
    SERVICE 1: API SERVER       SERVICE 3: CHECK WORKERS (x2)
    (Hono + better-auth)        (BullMQ consumers)
    - REST API (/v1/*)          - SSRF validation
    - Dashboard (Vite+React)    - HTTP fetcher (undici)
    - Session auth + API keys   - JSON/HTML diffing
    - Rate limiting             - Classification
    - Stripe webhooks           - Baseline comparison
    - Health (/health)          - Change detection
            |                   - Confirmation recheck
            |                   - Notification dispatch
    +-------+-------+          - Early warning processing
    |               |                    |
  PostgreSQL      Redis              Cloudflare R2
  (managed)     (managed)           (snapshots, archives)
    |               |
    SERVICE 2: SCHEDULER
    - Clock-aligned cron
    - Enqueue check jobs
    - Dedup (shared monitoring)
    - Missed-check recovery
    - Partition management
    - Retention purge
    - Weekly report generation
```

## 5.2 Database Schema

All tables use TEXT PRIMARY KEY with prefixed nanoid IDs (e.g., `usr_V1StGXR8_Z5jdHi6B`). Generated app-side using the `nanoid` package, not in Postgres. ID length: prefix + nanoid(21).

### Core Tables

**users**
```sql
CREATE TABLE users (
    id              TEXT PRIMARY KEY,      -- usr_ + nanoid(21)
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,          -- Argon2id via better-auth
    name            TEXT,
    plan            TEXT NOT NULL DEFAULT 'free'
                    CHECK (plan IN ('free', 'personal', 'team', 'business')),  -- Updated 2026-03-24
    stripe_customer_id    TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    subscription_status   TEXT DEFAULT 'active',
    current_period_end    TIMESTAMPTZ,
    email_verified  BOOLEAN NOT NULL DEFAULT FALSE,
    login_failures  INT NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    timezone        TEXT DEFAULT 'UTC',
    notification_defaults JSONB DEFAULT '{}',
    -- *(Fixed 2026-03-24 -- Pentest v2)* notification_defaults schema:
    -- {"email": true, "min_severity": "medium", "quiet_hours": {"start": "22:00", "end": "08:00", "timezone": "UTC"},
    --  "digest_mode": null | "daily" | "weekly", "slack_webhook_url": null, "discord_webhook_url": null}
    onboarding_step INT DEFAULT 0,
    last_dashboard_visit_at TIMESTAMPTZ,
    email_preferences JSONB DEFAULT
      '{"onboarding":true,"weekly_report":true,"product_updates":true}',
    is_admin        BOOLEAN NOT NULL DEFAULT FALSE,    -- *(Added 2026-03-24 -- Ops & Testing Spec)*
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**urls** -- One row per monitored URL slot.
```sql
CREATE TABLE urls (
    id              TEXT PRIMARY KEY,      -- url_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    url_hash        TEXT NOT NULL,          -- SHA-256 of normalized URL
    name            TEXT,
    method          TEXT NOT NULL DEFAULT 'GET' CHECK (method IN ('GET', 'POST')),
    post_consent    BOOLEAN NOT NULL DEFAULT FALSE,  -- *(Fixed 2026-03-24 -- Pentest v2)* Required TRUE for POST monitoring
    post_consent_at TIMESTAMPTZ,                     -- *(Fixed 2026-03-24 -- Pentest v2)* Timestamp for audit trail
    headers         JSONB DEFAULT '{}',
    body            TEXT,
    check_interval  TEXT NOT NULL DEFAULT '24h'
                    CHECK (check_interval IN ('1m','5m','15m','1h','6h','24h')),
    status          TEXT NOT NULL DEFAULT 'learning'
                    CHECK (status IN ('learning','calibrating','active',
                           'paused','error','degraded','auth_required',
                           'redirect_detected','limited','monitoring_empty')),
    status_reason   TEXT,
    content_type    TEXT,
    monitoring_method TEXT,
    classification_confidence INT,
    confidence_threshold INT NOT NULL DEFAULT 80,
    volatile_fields JSONB DEFAULT '[]',
    notification_config JSONB DEFAULT '{"email":true,"webhook_ids":[],"min_severity":"medium"}',
    -- *(Fixed 2026-03-24 -- Pentest v2)* notification_config schema (per-URL override of account notification_defaults):
    -- {"email": bool, "webhook_ids": string[], "min_severity": "critical"|"high"|"medium"|"low",
    --  "slack_enabled": bool, "discord_enabled": bool, "digest_mode": null|"daily"|"weekly"}
    -- Fields set to null inherit from users.notification_defaults
    tags            TEXT[] DEFAULT '{}',
    shared_url_id   TEXT REFERENCES shared_urls(id),  -- *(Fixed 2026-03-24 -- Pentest v2)* Added FK constraint
    parsed_domain   TEXT,
    parsed_path     TEXT,
    parsed_version  TEXT,
    paused_at       TIMESTAMPTZ,
    learning_started_at  TIMESTAMPTZ,
    calibrating_since    TIMESTAMPTZ,
    last_check_at        TIMESTAMPTZ,
    next_check_at        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, url_hash)
);
CREATE INDEX idx_urls_user ON urls (user_id);
CREATE INDEX idx_urls_next_check ON urls (next_check_at) WHERE status IN ('learning','calibrating','active');
CREATE INDEX idx_urls_domain_path ON urls (parsed_domain, parsed_path);
CREATE INDEX idx_urls_domain_active ON urls (parsed_domain) WHERE status IN ('active','calibrating');
```

**shared_urls** -- Dedup layer. One HTTP request at highest subscriber frequency.
```sql
CREATE TABLE shared_urls (
    id              TEXT PRIMARY KEY,
    url_hash        TEXT NOT NULL UNIQUE,
    url             TEXT NOT NULL,
    domain          TEXT NOT NULL,
    effective_interval TEXT NOT NULL DEFAULT '24h',
    subscriber_count INT NOT NULL DEFAULT 1,
    content_type    TEXT,
    monitoring_method TEXT,
    last_check_at   TIMESTAMPTZ,
    next_check_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**shared_urls creation logic:** *(Fixed 2026-03-24 -- Pentest v2)* When a user adds a URL via `POST /v1/urls`, the API handler creates or links to a shared_url **synchronously within a transaction** using advisory lock to prevent race conditions:

```sql
-- Atomic shared_url lookup-or-create with advisory lock
BEGIN;
SELECT pg_advisory_xact_lock(hashtext($url_hash));  -- Lock on url_hash to serialize concurrent creates
SELECT id FROM shared_urls WHERE url_hash = $url_hash;
-- If found: use existing id, increment subscriber_count
UPDATE shared_urls SET subscriber_count = subscriber_count + 1 WHERE url_hash = $url_hash;
-- If not found: create new shared_url
INSERT INTO shared_urls (id, url_hash, url, domain, subscriber_count) VALUES (...);
-- Then create the user's urls row with shared_url_id set
INSERT INTO urls (..., shared_url_id) VALUES (..., $shared_url_id);
COMMIT;
```

This prevents the race condition where two users adding the same URL simultaneously create duplicate shared_urls rows. The advisory lock serializes on the url_hash, and the transaction ensures atomicity.

**baselines** -- Current known state per shared URL.
```sql
CREATE TABLE baselines (
    id              TEXT PRIMARY KEY,
    shared_url_id   TEXT NOT NULL UNIQUE REFERENCES shared_urls(id) ON DELETE CASCADE,
    full_hash       TEXT NOT NULL,
    stable_hash     TEXT NOT NULL,
    schema_hash     TEXT NOT NULL,
    header_hash     TEXT NOT NULL,
    status_code     INT NOT NULL,
    response_headers JSONB NOT NULL,
    content_type    TEXT,
    response_time_ms INT,
    body_r2_key     TEXT NOT NULL,
    body_size_bytes INT NOT NULL,
    baseline_size_bytes INT,
    size_variance_pct FLOAT DEFAULT 0,
    schema_snapshot JSONB,
    field_stats     JSONB DEFAULT '{}',
    extracted_text_hash TEXT,
    baseline_status TEXT NOT NULL DEFAULT 'provisional'
                    CHECK (baseline_status IN ('provisional', 'confirmed')),  -- *(Fixed 2026-03-24 -- Pentest v2)*
    baseline_contributors INT NOT NULL DEFAULT 1,                             -- *(Fixed 2026-03-24 -- Pentest v2)*
    quorum_threshold INT NOT NULL DEFAULT 2,                                  -- *(Fixed 2026-03-24 -- Pentest v2)*
    established_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Quorum-based baseline defense: first baseline is `provisional` (single contributor). When a second independent user monitors the same URL, 5 fresh checks are run. If they match the provisional baseline (within variance thresholds), baseline is promoted to `confirmed`. Baselines older than 30 days without re-confirmation are demoted back to `provisional`. *(Fixed 2026-03-24 -- Pentest v2)*

**check_results** -- Every check. Partitioned by month (native Postgres declarative partitioning). *(Fixed 2026-03-24 -- Pentest v2)*
```sql
CREATE TABLE check_results (
    id              TEXT NOT NULL,
    shared_url_id   TEXT NOT NULL,
    status_code     INT,
    response_time_ms INT,
    body_size_bytes INT,
    error           TEXT,
    error_category  TEXT CHECK (error_category IN ('transient','permanent','internal')),
    full_hash       TEXT,
    stable_hash     TEXT,
    schema_hash     TEXT,
    header_hash     TEXT,
    body_r2_key     TEXT,
    change_detected BOOLEAN NOT NULL DEFAULT FALSE,
    change_id       TEXT,
    is_learning     BOOLEAN NOT NULL DEFAULT FALSE,
    is_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
    worker_id       TEXT,
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, checked_at)       -- *(Fixed 2026-03-24 -- Pentest v2)* Composite PK required for partitioned tables
) PARTITION BY RANGE (checked_at);

-- Indexes on partitioned table (created on parent, automatically applied to all partitions)
CREATE INDEX idx_check_results_shared_url_time ON check_results (shared_url_id, checked_at DESC);  -- *(Fixed 2026-03-24 -- Pentest v2)*
CREATE INDEX idx_check_results_change ON check_results (change_id) WHERE change_detected = TRUE;    -- *(Fixed 2026-03-24 -- Pentest v2)*

-- Note: Foreign key on shared_url_id not enforced on partitioned tables for performance.
-- Application layer ensures referential integrity. Orphan cleanup runs in daily maintenance cron.

-- Partitions created by BullMQ cron job:
-- CREATE TABLE check_results_2026_03 PARTITION OF check_results
--   FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
-- Cron creates next month's partition daily, drops expired partitions per retention policy.
```

**Retention model for shared check_results:** *(Fixed 2026-03-24 -- Pentest v2)* Retention follows the HIGHEST paying subscriber on a given shared URL. If a Free user and a Business user both monitor the same URL, results are kept for 1 year (Business retention). When the Business user unsubscribes, retention drops to the next highest plan. This avoids per-user duplication of check results while being generous to all subscribers. Partition drops are gated by a query: `SELECT MAX(p.retention_days) FROM urls u JOIN users usr ON u.user_id = usr.id JOIN plan_config p ON usr.plan = p.plan WHERE u.shared_url_id = ?`.

**changes** -- Detected changes with full diff data.
```sql
CREATE TABLE changes (
    id              TEXT PRIMARY KEY,       -- chg_ + nanoid(21)
    shared_url_id   TEXT NOT NULL REFERENCES shared_urls(id),
    change_type     TEXT NOT NULL
                    CHECK (change_type IN ('schema','status_code','header',
                           'content','redirect','timing','tls',
                           'error_format','availability','rate_limit')),
    severity        TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
    confidence      INT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
    summary         TEXT NOT NULL,
    diff            JSONB NOT NULL,
    actions         JSONB DEFAULT '[]',
    previous_body_r2_key TEXT NOT NULL,
    current_body_r2_key  TEXT NOT NULL,
    previous_schema      JSONB,
    current_schema       JSONB,
    previous_status_code INT,
    current_status_code  INT,
    previous_headers     JSONB,
    current_headers      JSONB,
    confirmation_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (confirmation_status IN ('pending','stage1_confirmed',
                           'stage2_confirmed','confirmed','reverted','unstable')),
    confirmed_at    TIMESTAMPTZ,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_changes_shared_url ON changes (shared_url_id, detected_at DESC);
CREATE INDEX idx_changes_severity ON changes (severity, detected_at DESC);
```

**user_changes** -- Per-user view with workflow state.
```sql
CREATE TABLE user_changes (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_id       TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    url_id          TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    source_id       TEXT,                   -- References shared_sources(id) -- the source that detected this change *(Fixed 2026-03-24 -- Pentest v2)*
    workflow_state   TEXT NOT NULL DEFAULT 'new'
                    CHECK (workflow_state IN ('new','tracked','ignored','snoozed','resolved')),
    snoozed_until   TIMESTAMPTZ,
    note            TEXT,
    feedback        TEXT CHECK (feedback IN ('real_change','false_positive','not_sure')),
    feedback_comment TEXT,
    feedback_at     TIMESTAMPTZ,
    notified        BOOLEAN NOT NULL DEFAULT FALSE,
    notified_at     TIMESTAMPTZ,
    alerted         BOOLEAN NOT NULL DEFAULT TRUE,
    alert_suppressed_reason TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, change_id)
);
CREATE INDEX idx_user_changes_user ON user_changes (user_id, created_at DESC);
CREATE INDEX idx_user_changes_unacked ON user_changes (user_id)
    WHERE workflow_state = 'new';
```

### Notification Tables

**webhooks** -- User-configured webhook endpoints.
- id, user_id, url (HTTPS only), name, signing_secret
- events (TEXT[]), is_active, consecutive_failures

**webhook_deliveries** -- Delivery log (30-day retention).
- id, webhook_id, event_type, payload (JSONB)
- status_code, response_body, error, attempt_number

**notifications** -- Log of all notifications sent.
- id, user_id, change_id, channel, recipient
- subject, status, error, feedback_token

### Early Warning Tables

**forecasts** -- Early warning signals.
- id, shared_url_id, signal_type, alert_level, severity
- title, description, deadline, deadline_source
- affected_endpoints (JSONB), source, source_url
- confidence, dedup_key (UNIQUE), status

**user_forecasts** -- Per-user forecast view.
- id, user_id, forecast_id, url_id
- acknowledged, last_reminder_at, last_reminder_days, reminders_muted

**header_snapshots** -- Response headers for every check (for version/deprecation tracking).
- id, shared_url_id, check_result_id, headers (JSONB)
- sunset_date, deprecation_date, api_version

### Shared Intelligence Tables

**shared_sources** -- Domain-level bonus sources. *(Fixed 2026-03-24 -- Pentest v2)*
- id, domain, source_type, url
- discovered_by, discovery_method, check_interval
- current_body_hash, status (active/paused/orphaned)
- last_check_at TIMESTAMPTZ, next_check_at TIMESTAMPTZ  -- Required for scheduler queries
- subscriber_count INT NOT NULL DEFAULT 0

**signals** -- Detected early warning signals (domain-level).
- id, shared_source_id, domain, signal_type, action_type, scope
- title, description, affected_paths/versions/products (JSONB)
- deadline, migration_target, confidence
- correlation_key, dedup_key (UNIQUE), evidence_count

**signal_matches** -- Per-user relevance results.
- id, signal_id, user_id, url_id
- is_relevant, relevance_score, match_type, reasons (JSONB)

### Security & Secrets Tables *(Fixed 2026-03-24 -- Pentest v2)*

**url_secrets** -- Encrypted custom headers for authenticated URL monitoring. Personal+ only.
```sql
CREATE TABLE url_secrets (
    id              TEXT PRIMARY KEY,       -- sec_ + nanoid(21)
    url_id          TEXT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    header_name     TEXT NOT NULL,           -- e.g., "Authorization"
    header_value_encrypted BYTEA NOT NULL,   -- AES-256-GCM encrypted
    encryption_key_id TEXT NOT NULL,          -- For key rotation support
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (url_id, header_name)
);
CREATE INDEX idx_url_secrets_url ON url_secrets (url_id);
```
Encryption: AES-256-GCM with per-tenant key derived from master key (env var `ENCRYPTION_MASTER_KEY`). Random IV per record via `crypto.createCipheriv()`. Header values are WRITE-ONLY from the API -- never returned in GET responses. Displayed as `Authorization: ••••••••` in UI.

URLs with custom headers are ALWAYS private checks (never shared). Custom headers available on Personal+ only.

**oauth_tokens** -- OAuth 2.0 tokens for PM integrations (Jira, Linear, GitHub).
```sql
CREATE TABLE oauth_tokens (
    id              TEXT PRIMARY KEY,       -- oat_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,           -- 'jira', 'linear', 'github'
    access_token_encrypted  BYTEA NOT NULL,  -- AES-256-GCM encrypted
    refresh_token_encrypted BYTEA,           -- AES-256-GCM encrypted (nullable for non-refresh flows)
    token_type      TEXT DEFAULT 'Bearer',
    expires_at      TIMESTAMPTZ,
    scopes          TEXT[],
    encryption_key_id TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, provider)
);
```
Same encryption as url_secrets. Auto-refresh: on API call, if token expires within 5 minutes, refresh automatically. On 401 during PM API call: attempt one refresh + retry; if refresh fails, mark token `invalid` and notify user to re-authenticate.

**integrations** -- PM integration configurations (which Jira project, which Linear team, etc.).
```sql
CREATE TABLE integrations (
    id              TEXT PRIMARY KEY,       -- int_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL            -- 'jira', 'linear', 'github'
                    CHECK (provider IN ('jira', 'linear', 'github', 'asana')),
    oauth_token_id  TEXT REFERENCES oauth_tokens(id) ON DELETE SET NULL,
    config          JSONB NOT NULL DEFAULT '{}',
    -- config examples:
    -- Jira: {"site_url": "https://myteam.atlassian.net", "project_key": "PROJ", "issue_type": "Task"}
    -- Linear: {"team_id": "...", "project_id": "..."}
    -- GitHub: {"owner": "...", "repo": "...", "labels": ["api-change"]}
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, provider)
);
```

**tickets** -- Tracks change_id <-> ticket_url mapping for duplicate prevention.
```sql
CREATE TABLE tickets (
    id              TEXT PRIMARY KEY,       -- tkt_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    change_id       TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    integration_id  TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,           -- 'jira', 'linear', 'github'
    ticket_key      TEXT NOT NULL,           -- 'PROJ-42', 'LIN-123', '#456'
    ticket_url      TEXT NOT NULL,           -- Full URL to the ticket
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (change_id, integration_id)      -- One ticket per change per integration
);
CREATE INDEX idx_tickets_change ON tickets (change_id);
CREATE INDEX idx_tickets_user ON tickets (user_id);
```
Dashboard shows "Already ticketed: PROJ-42" badge on change cards when a ticket exists.

**feedback** -- User-submitted feedback (bug reports, feature requests).
```sql
CREATE TABLE feedback (
    id              TEXT PRIMARY KEY,       -- fb_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('bug', 'feature', 'complaint', 'other')),
    text            TEXT NOT NULL,
    screenshot_r2_key TEXT,                 -- Optional screenshot stored in R2
    url_id          TEXT REFERENCES urls(id) ON DELETE SET NULL,   -- Optional context
    status          TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'reviewed', 'resolved', 'archived')),
    admin_note      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_user ON feedback (user_id);
CREATE INDEX idx_feedback_status ON feedback (status, created_at DESC);
```

### Supporting Tables

**learning_samples** -- Rapid-fire check results during learning period.
**domain_patterns** -- Built-in knowledge for known domains.
**package_versions** -- SDK/package version tracking (npm, PyPI, GitHub releases).
**spec_snapshots** -- OpenAPI spec versions for diffing.
**source_alert_preferences** -- Per-source per-user alert customization.
**domain_user_counts** -- Fast lookup for user counts per domain. Columns: domain TEXT PRIMARY KEY, user_count INT, refreshed_at TIMESTAMPTZ. *(Fixed 2026-03-24 -- Pentest v2)*
**discovery_results** -- Results from domain discovery probes.
**feature_flags** -- Admin-toggled feature flags. *(Added 2026-03-24 -- Ops & Testing Spec)* Columns: key TEXT PRIMARY KEY, value BOOLEAN, description TEXT, updated_at TIMESTAMPTZ, updated_by TEXT REFERENCES users(id). Cached in Redis with 5-min TTL.

(Source: CHIRRI_ARCHITECTURE.md Section 2, CHIRRI_RELEVANCE_INTELLIGENCE.md Section 7, CHIRRI_EARLY_WARNING_IMPLEMENTATION.md Section 1)

## 5.3 Queue Architecture

All queues managed by BullMQ backed by Redis.

| Queue | Concurrency/Worker | Rate Limit | Retries | Purpose |
|---|---|---|---|---|
| url-checks | 10 | 1/sec/domain | 3, exponential | Main monitoring checks |
| learning-checks | 5 | 1/sec/domain (shared) | 1 (best-effort) | Rapid learning period checks |
| confirmation-checks | 5 | 1/sec/domain (shared) | 1 | 5s and 30min rechecks |
| notifications | 20 | 10/sec to Resend | 5 (1m,5m,30m,2h,12h) | Email, webhook, Slack, etc. |
| classification | 3 | shared domain limit | 2 | Auto-classification pipeline |
| shared-source-checks | 5 | per-domain | 2 | Bonus source checks |
| signal-fanout | 10 | -- | 2 | Relevance matching + delivery |
| package-checks | 5 | 10/min npm, 5/min PyPI | 2 | npm/PyPI version checks |
| maintenance | 1 | -- | 3 | Retention, archival, reports |
| migration-checklists | 3 | -- | 2 | LLM-powered migration checklist generation | *(Added 2026-03-24 -- New MVP Features)*
| impact-analysis | 3 | -- | 2 | LLM-powered impact analysis generation | *(Added 2026-03-24 -- New MVP Features)*
| simulations | 2 | -- | 2 | Impact simulator (oasdiff + LLM) | *(Added 2026-03-24 -- New MVP Features)*
| failed-jobs (DLQ) | -- | -- | -- | All queues route here after max retries, 7-day retention |

**Job schemas (TypeScript):**

```typescript
// url-checks
interface UrlCheckJob {
    shared_url_id: string;
    url: string;
    method: 'GET' | 'POST';
    headers: Record<string, string>;
    body?: string;
    subscriber_ids: string[];      // user URL IDs subscribing to this shared URL
    baseline_id?: string;
    is_learning: boolean;
    check_number: number;
}

// confirmation-checks  *(Fixed 2026-03-24 -- Pentest v2)*
interface ConfirmationCheckJob {
    change_id: string;
    shared_url_id: string;
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;  // Decrypted at enqueue time for private checks with custom headers
    body?: string;                     // For POST checks
    stage: 1 | 2;                  // stage 1 = 5s, stage 2 = 30min
    attempt: number;
    previous_baseline: { stable_hash: string; schema_hash: string };
    detected_change: { stable_hash: string; schema_hash: string };
}

// notifications (unified contract)
interface NotificationPayload {
    id: string;
    idempotency_key: string;       // ${event_type}:${change_id}:${user_id}:${channel}
    event_type: string;            // change.confirmed, forecast.new, etc.
    severity: 'critical' | 'high' | 'medium' | 'low';
    user_id: string;
    channel: 'email' | 'webhook' | 'slack' | 'discord' | 'telegram' | 'pagerduty';
    recipient: string;
    subject: string;
    summary: string;
    body: { text: string; html?: string; data?: Record<string, any> };
    url_id?: string;
    change_id?: string;
    forecast_id?: string;
    webhook_id?: string;
    feedback_token?: string;
    created_at: string;
    attempt: number;
    priority: number;              // 1=highest (critical), 5=lowest (weekly report)
}
```

**Domain rate limiting:** Redis token bucket per domain.
```
Key: domain_throttle:{domain}
Algorithm: Token bucket, 1 token/second, max burst 3
Implementation: Atomic Lua script via Redis EVALSHA
```

**Redis key patterns:**

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| ratelimit:{api_key_hash}:{hour} | Sorted Set | 3700s | API rate limiting (sliding window per hour) | *(Fixed 2026-03-24 -- Pentest v2)*
| ratelimit:ip:{ip}:{hour} | Sorted Set | 3700s | Unauthenticated rate limiting (sliding window per hour) | *(Fixed 2026-03-24 -- Pentest v2)*
| domain_throttle:{domain} | Token bucket | 10s | Outbound request limiting |
| circuit:{domain} | Hash | 600s | Domain circuit breaker state |
| scheduler:lock | SETNX | 60s | Single scheduler guarantee |
| notif_rate:{user_id}:{domain}:{severity}:{hour} | Counter | 2h | Notification rate limiting |
| bull:* | Various | BullMQ managed | All queue data |

## 5.4 Tech Stack

| Layer | Choice | Why |
|---|---|---|
| HTTP framework | Hono | Native better-auth integration, TypeScript-first, lightweight (13KB) |
| Auth | better-auth (sessions + API key plugin) | Handles both auth paths, Drizzle adapter, active development. *(Fixed 2026-03-24 -- Pentest v2)* Configure `additionalFields` in better-auth schema to register Chirri's custom user columns (plan, stripe_customer_id, stripe_subscription_id, subscription_status, email_verified, notification_defaults, onboarding_step, etc.) so better-auth doesn't overwrite them. See better-auth docs on custom user fields. |
| Password hashing | Argon2id (via better-auth) | OWASP recommended, memory-hard |
| ORM | Drizzle ORM 0.x (pinned) | Lightweight, SQL-native, full Postgres support |
| Database | PostgreSQL (Railway managed) | Native declarative partitioning (not pg_partman) |
| Cache/Queue | Redis (Railway managed) + BullMQ | Job queues, rate limiting, circuit breakers |
| Object storage | Cloudflare R2 | Response snapshots, archives. Zero egress fees. |
| Email | Resend | 3K emails/mo free, React Email templates |
| Billing | Stripe | Checkout, subscriptions, customer portal |
| Dashboard | Vite + React + React Router + TanStack Query | SPA, shadcn/ui, Tailwind. See CHIRRI_FRONTEND_BIBLE.md for full UI spec. |
| Diff viewer | @monaco-editor/react DiffEditor | VS Code's diff engine. See CHIRRI_FRONTEND_BIBLE.md Part 4. |
| Logging | Pino (structured JSON) | Fast, Railway-compatible |
| Error tracking | Sentry (free tier) | 5K errors/mo, best SDK |
| CI | GitHub Actions | 2K min/mo free |
| CD | Railway auto-deploy | Wait for CI, zero config |
| Testing | Vitest + Supertest | Fast, native ESM/TS |
| DNS/CDN | Cloudflare | DDoS protection, SSL, free plan |
| Monitoring | UptimeRobot (free) | External health checks |

## 5.5 SSRF Prevention

Every outbound HTTP request goes through `safeFetch()`:

1. **Protocol check:** Only http/https allowed
2. **Hostname blocklist:** Block .railway.internal, .internal, .local, .localhost, metadata.google.internal
3. **DNS resolution with pinning:** Resolve hostname, validate ALL resolved IPs against blocklist, connect to the validated IP (not re-resolved hostname)
4. **IP blocklist (complete):**
   - RFC 1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
   - Loopback: 127.0.0.0/8
   - Link-local: 169.254.0.0/16 (including cloud metadata 169.254.169.254)
   - Current network: 0.0.0.0/8
   - CGN/Tailscale: 100.64.0.0/10
   - Documentation: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
   - Benchmarking: 198.18.0.0/15
   - IPv6: ::1/128, fe80::/10, fd00::/8, ::ffff:0:0/96, fec0::/10
   - Alibaba Cloud metadata: 100.100.100.200/32
5. **IP normalization:** Use ipaddr.js to handle ALL representations (octal, decimal, hex, IPv4-mapped IPv6)
6. **Redirect handling:** Manual redirect following (max 5 hops), re-validate IP at each hop
7. **Custom headers stripped for blocked destinations:** *(Fixed 2026-03-24 -- Pentest v2)* As defense-in-depth, ALL custom headers are stripped from requests to any IP that matches the blocklist -- even if the IP check itself somehow passes due to a bypass. This prevents AWS IMDSv2 token requests (requires `X-aws-ec2-metadata-token-ttl-seconds` header), Azure metadata access (requires `Metadata: true` header), and similar header-dependent cloud metadata attacks. Also block IPv6 metadata endpoints: `fd00:ec2::254` (AWS IPv6 metadata).
8. **Body limit:** Abort if >5MB
9. **Timeout:** 30s total, 10s headers

All discovery probes, webhook deliveries, and monitoring checks use safeFetch(). Webhook URLs are re-validated at DELIVERY time, not just registration.

(Source: CHIRRI_SECURITY_PENTEST.md, CHIRRI_ARCHITECTURE.md Section 6, CHIRRI_CATEGORY_B_RESEARCH.md B13)

## 5.6 Six-Layer False Positive Defense *(Fixed 2026-03-24 -- Pentest v2)*

| Layer | Mechanism | What It Catches |
|---|---|---|
| 1. Volatile field filtering | Learning period identifies fields that change every request | Request IDs, timestamps, trace IDs, nonce values |
| 2. Cross-source correlation (shared sources) | Multiple sources for same provider must agree | Single noisy source doesn't trigger. Changelog + header = higher confidence |
| 3. Confirmation recheck | Stage 1 (5s) + Stage 2 (30min) | CDN edge differences, temporary glitches, deployment rollbacks |
| 4. User feedback (per-user only) | false_positive reports suppress FOR THAT USER ONLY; never modifies shared detection | Per-user view cleanup without contaminating shared data |
| 5. Content stability scoring | Track response variance over rolling window; flag unstable sources | Noisy sources where content changes on every check |
| 6. Proactive FP detection | Auto-flag fields changing on >90% of checks as likely volatile; seed list of ~30 known volatile patterns | Prevents most FPs before users ever see them |

*(Updated 2026-03-24)* Layer 4 changed: user feedback NEVER auto-modifies shared volatile lists. No user, regardless of plan or account age, ever affects shared detection. Feedback is useful to us internally (admin panel, trend detection) but never auto-acts. Human-in-the-loop always for shared changes.

(*) Layer 2 uses cross-source correlation for shared sources (not cross-user correlation, which provides zero value when all users see the same fetch result).

(Source: CHIRRI_CATEGORY_D_RESEARCH.md D21, CHIRRI_SECURITY_PENTEST.md)

## 5.7 Scheduler Cron Jobs

The Scheduler service (Service 2) runs these recurring tasks:

| Cron | Task | Description |
|---|---|---|
| `* * * * *` (every min) | Shared URL check scheduling | Query `shared_urls WHERE next_check_at <= now()`, enqueue check jobs. This handles all URLs participating in shared monitoring. | *(Fixed 2026-03-24 -- Pentest v2)*
| `* * * * *` (every min) | Private URL check scheduling | Query `urls WHERE shared_url_id IS NULL AND next_check_at <= now()`, enqueue check jobs. This handles URLs with custom headers (private checks not in shared monitoring). | *(Fixed 2026-03-24 -- Pentest v2)*
| `* * * * *` (every min) | Shared source scheduling | Query `shared_sources WHERE next_check_at <= now()`, enqueue bonus source check jobs |
| `0 */6 * * *` (every 6h) | Package version checks | Enqueue due npm/PyPI/GitHub release checks |
| `0 8 * * *` (daily 08:00 UTC) | Deadline reminder scan | Query forecasts with upcoming deadlines, send reminders |
| `0 0 * * *` (daily midnight) | Forecast expiry | Mark forecasts with past deadlines as expired |
| `0 3 * * *` (daily 03:00 UTC) | Retention purge | Drop expired check_results partitions per HIGHEST subscriber plan (not per-user). *(Fixed 2026-03-24 -- Pentest v2)* For each shared_url, find the highest-paying subscriber's retention period. Only drop partitions older than that retention. When highest-paying subscriber leaves, retention drops to next highest plan level. |
| `0 3 * * *` (daily 03:00 UTC) | Partition management | Create next month's partition if needed |
| `0 3 * * *` (daily 03:00 UTC) | Orphaned source cleanup | Hibernate shared sources orphaned >7 days (stop checking, keep metadata; weekly pulse HEAD request) | *(Fixed 2026-03-24 -- Pentest v2)*
| `0 4 * * *` (daily 04:00 UTC) | Archive to R2 | Export old check_results as compressed JSONL |
| `0 4 * * *` (daily 04:00 UTC) | DB backup | pg_dump -> compress -> upload to R2 |
| `0 5 * * *` (daily 05:00 UTC) | Cleanup learning_samples | Delete samples >24h after learning complete |
| `0 6 * * 1` (Mon 06:00 UTC) | Weekly reports | Enqueue weekly stability report emails |
| `0 */4 * * *` (every 4h) | domain_user_counts refresh | Maintain user count per domain |
| On startup | Missed-check recovery | Scan for last_check_at < now - 2x interval, enqueue |

## 5.8 Failure Modes

| Failure | User Impact | Recovery |
|---|---|---|
| **Redis down** | No new checks scheduled, rate limits not enforced | Fail-closed for outbound (skip checks). Auto-reconnect every 5s. |
| **PostgreSQL down** | Entire system unusable (API returns 503) | Auto-reconnect with exponential backoff. Railway auto-restarts. |
| **R2 unreachable** | Checks continue but snapshots not stored | Circuit breaker opens after 3 failures. Queue snapshots for retry. |
| **Worker crash mid-check** | One check lost. BullMQ marks job failed. | BullMQ retry with backoff. Stale lock timeout 30s. |
| **Worker crash mid-notification** | User may miss notification. Change still recorded. | BullMQ retry. Idempotency key prevents duplicates. |
| **Resend (email) down** | Email notifications delayed | Retry with backoff. Queue depth alert at >100 pending. |
| **Stripe webhook missed** | Plan change not reflected | Stripe retries 72h. Fallback: verify subscription on API request. |
| **Scheduler crash** | No new checks scheduled until restart (up to 60s lock TTL + restart time) | Railway auto-restart. Missed-check recovery on startup. *(Fixed 2026-03-24 -- Pentest v2)* Cron jobs within the scheduler run as separate BullMQ repeatable jobs (not sequential blocking calls), ensuring a slow retention purge doesn't block check scheduling. Each cron task has its own concurrency limit and timeout (retention purge: 300s max, check scheduling: 10s max). |

**Circuit breaker config:** R2 (timeout 5s, open at 50% failure, reset after 30s). Resend (timeout 10s, open at 50%, reset after 60s).

## 5.9 Plan Limits Reference *(Updated 2026-03-24)*

```typescript
const PLAN_LIMITS = {
    free: {
        maxUrls: 3,
        minInterval: '24h',
        historyDays: 7,
        maxWebhooks: 0,
        apiRateLimit: 10,      // requests per hour
        features: {
            apiAccess: true,
            mcpAccess: true,
            discordIntegration: true,
            slackIntegration: false,
            webhookIntegration: false,
            schemaDiffDetail: false,
            perSourceSeverity: false,
            perSourceChannelRouting: false,
            digestMode: false,
        }
    },
    personal: {
        maxUrls: 10,  // *(Fixed 2026-03-24 -- Pentest v2)* Authoritative value. CHIRRI_PROBLEMS_SOLVED.md #20 references 20 (stale).
        minInterval: '1h',
        historyDays: 30,
        maxWebhooks: 3,
        apiRateLimit: 60,      // requests per hour
        features: {
            apiAccess: true,
            mcpAccess: true,
            discordIntegration: true,
            slackIntegration: true,
            webhookIntegration: true,
            schemaDiffDetail: true,
            perSourceSeverity: true,
            perSourceChannelRouting: false,
            digestMode: true,
        }
    },
    team: {
        maxUrls: 50,
        minInterval: '15m',
        historyDays: 90,
        maxWebhooks: 10,
        apiRateLimit: 200,     // requests per hour
        features: {
            apiAccess: true,
            mcpAccess: true,
            discordIntegration: true,
            slackIntegration: true,
            webhookIntegration: true,
            schemaDiffDetail: true,
            perSourceSeverity: true,
            perSourceChannelRouting: true,
            digestMode: true,
        }
    },
    business: {
        maxUrls: 200,
        minInterval: '5m',
        historyDays: 365,
        maxWebhooks: Infinity,
        apiRateLimit: 500,     // requests per hour
        features: {
            apiAccess: true,
            mcpAccess: true,
            discordIntegration: true,
            slackIntegration: true,
            webhookIntegration: true,
            schemaDiffDetail: true,
            perSourceSeverity: true,
            perSourceChannelRouting: true,
            digestMode: true,
        }
    }
};
```

## 5.10 Provider Profile Data Structure

MVP ships with 15-20 hardcoded profiles. Each profile:

```typescript
interface ProviderProfile {
    slug: string;               // "stripe"
    name: string;               // "Stripe"
    company?: string;           // For mega-providers: "Google"
    domains: string[];          // ["api.stripe.com", "stripe.com"]
    sources: {
        type: string;           // openapi_spec, changelog, status_page, etc.
        name: string;           // "Stripe OpenAPI Spec"
        url: string;            // Actual URL to monitor
        monitoring_method: string;
        default_interval: string;
        bundled: boolean;       // true = free, doesn't use slot
    }[];
    packages?: {
        npm?: string[];         // ["stripe"]
        pypi?: string[];        // ["stripe"]
    };
}
```

**MVP providers (15-20):**
Stripe, OpenAI, Twilio, GitHub, Shopify, Cloudflare, AWS (umbrella), Vercel, Heroku, Datadog, PagerDuty, Slack, npm, Auth0, Firebase

**Statuspage.io providers (standard JSON API -- one monitoring strategy covers all):**
status.stripe.com, status.openai.com, status.twilio.com, www.githubstatus.com, www.cloudflarestatus.com, status.datadoghq.com, status.pagerduty.com, www.vercel-status.com, status.heroku.com, status.slack.com, status.npmjs.org

## 5.11 Railway Operational Requirements

- **Plan:** Start on Hobby ($5/mo + usage). Upgrade to Pro when static IPs needed or >5GB volume storage.
- **Estimated cost:** ~$65/mo total (API + scheduler + workers + Postgres + Redis)
- **Scaling:** Vertical auto-scaling (Railway handles CPU/RAM). Horizontal manual (set replica count).
- **Health checks:** API server at /health (checks DB, Redis, queue depth). Scheduler at /health. Workers: *(Fixed 2026-03-24 -- Pentest v2)* expose a minimal HTTP server on a secondary port (e.g., 3001) with `/health` endpoint returning 200 if the BullMQ consumer is connected and processing. This allows Railway's HTTP health check to detect stuck workers (e.g., blocked event loop). The endpoint checks: Redis connection alive, last job processed within 5 minutes, event loop not blocked.
- **Graceful shutdown:** SIGTERM handler stops accepting work, waits 30s for in-flight jobs, flushes logs, closes connections.
- **Deploy strategy:** Railway watches main branch with "Wait for CI." Migrations run in prestart script before accepting traffic.

(!) For infrastructure details: see CHIRRI_INFRASTRUCTURE_DETAILS.md

## 5.12 CI/CD Pipeline *(Added 2026-03-24 -- Ops & Testing Spec)*

**System:** GitHub Actions with Railway "Wait for CI" auto-deploy. No `railway` CLI needed in CI.

**Repository:** pnpm monorepo with packages: `api/`, `scheduler/`, `worker/`, `mcp-server/`, `shared/`, `landing/`.

**Branch strategy:** `main` = production (auto-deploys to Railway after CI passes). No staging environment at MVP (add when first paid customer arrives).

**PR pipeline stages (GitHub Actions):**
1. **Lint** — ESLint across all packages
2. **Typecheck** — `tsc --noEmit` across all packages
3. **Test** — Vitest with Postgres 16 + Redis 7 service containers

**Deploy mechanism:** Railway watches `main` branch with "Wait for CI" enabled. When GitHub Actions checks pass, Railway auto-deploys each service independently. No deploy step in GitHub Actions.

**Database migrations in deploy:** Railway prestart script: `pnpm db:migrate && node dist/index.js`. Only the API server runs migrations (deploys first). Workers and scheduler connect after migrations are applied.

**Migration safety (expand-contract, from §D.15):**
- Add nullable column: safe
- Add NOT NULL: nullable → backfill → ALTER
- Drop column: remove from code first → deploy → drop next migration
- `CREATE INDEX CONCURRENTLY` always

**Rollback:** Railway "Rollback" button for code. DB snapshot restore for migration rollbacks.

**Landing page deploy:** Separate workflow, triggers on `packages/landing/**` changes, deploys to Cloudflare Pages via `wrangler`.

**MCP server publish:** Separate workflow, triggers on `mcp-v*` tags, publishes `@chirri/mcp-server` to npm.

**Secrets:** Railway env vars for runtime secrets (DATABASE_URL, STRIPE_SECRET_KEY, etc). GitHub repo secrets for CI-only secrets (NPM_TOKEN, CLOUDFLARE_API_TOKEN).

(!) For complete CI/CD specification: see CHIRRI_OPS_AND_TESTING_SPEC.md §1

## 5.13 Testing Strategy *(Added 2026-03-24 -- Ops & Testing Spec)*

**Framework:** Vitest (native ESM/TypeScript, Hono-compatible, same API as Jest).

**Test database:** GitHub Actions service containers (Postgres 16 + Redis 7). Locally: Docker Compose. NOT SQLite (Chirri uses Postgres-specific features: partitioning, advisory locks, JSONB operators).

**Test layers:**

| Layer | What | DB/Redis? | Speed |
|---|---|---|---|
| Unit | Pure functions: severity assignment, classification, SSRF checks, dedup keys | No | <1s per test |
| Integration | API endpoints via `app.request()`, DB operations, BullMQ processing | Yes | 1-5s per test |
| E2E | Full browser flows (Playwright) | Yes | Deferred to V1.1 |

**Hono testing:** Use `app.request()` method (official Hono testing approach) or `testClient()` from `hono/testing` for typed client.

**BullMQ testing:** Extract processor functions, call directly with mock job data. For queue integration tests, use real Redis.

**Mock strategy:**
- Target URLs: `vi.spyOn(global, 'fetch')` or MSW (Mock Service Worker)
- Stripe: `stripe-mock` or manual mocks
- Resend/R2/OpenAI: mock SDK methods
- DNS resolution: mock `dns.resolve4/resolve6` for SSRF testing

**Test DB lifecycle:** Migrations applied in `beforeAll`. Tables truncated (not dropped) in `afterEach`.

**Coverage targets:** SSRF + severity assignment: 100%. API endpoints + workers: 80%. Overall: 70%+.

**MUST test before launch:**
- SSRF prevention (all bypass vectors)
- Plan limit enforcement (race conditions with `FOR UPDATE`)
- Severity assignment (every rule)
- Authentication (sessions, API keys, email verification)
- Webhook HMAC signing
- Content classification
- Change detection pipeline
- Stripe webhook handlers
- GDPR account deletion cascade
- Rate limiting

(!) For complete testing specification: see CHIRRI_OPS_AND_TESTING_SPEC.md §2

## 5.14 Admin Panel *(Added 2026-03-24 -- Ops & Testing Spec)*

**Approach:** Internal API endpoints + React pages at `app.chirri.io/admin` (same SPA, protected route). NOT AdminJS (too generic for Chirri's specialized views).

**Auth:** `is_admin` flag on users table. Same session auth. API endpoints under `/internal/admin/*` check flag server-side.

**Sections:**
- **System Health** — Service status, DB connections, Redis memory, queue depths, worker heartbeats, last 24h stats
- **Users** — List, detail, impersonation (read-only with audit log), password reset
- **URL Monitoring** — All URLs, shared URLs, error/degraded URLs, learning URLs
- **Shared Monitoring Stats** — Top subscribed shared URLs, orphaned sources, discovery results
- **Feedback Review** — Filter by type/status, admin notes, aggregate FP patterns
- **Billing Overview** — MRR, plan distribution, churn rate, conversion rate, dunning status
- **Feature Flags** — Toggle flags via `feature_flags` table with Redis cache (5-min TTL)

**Feature flags table:**
```sql
CREATE TABLE feature_flags (
    key         TEXT PRIMARY KEY,
    value       BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  TEXT REFERENCES users(id)
);
```

**Initial flags:** `mcp_enabled`, `pm_integrations_enabled`, `impact_analysis_enabled`, `simulation_enabled`, `twitter_automation_enabled`.

**Bull Board:** Mounted at `/internal/admin/queues/board` via `@bull-board/hono` adapter. Shows all 9 queues with real-time status, job details, manual retry/remove.

**Admin API endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | /internal/admin/health | System health data |
| GET | /internal/admin/users | User list (paginated, searchable) |
| GET | /internal/admin/users/:id | User detail |
| POST | /internal/admin/users/:id/impersonate | Impersonation session (audit-logged) |
| GET | /internal/admin/urls | All URLs (filterable) |
| GET | /internal/admin/shared-urls | Shared monitoring stats |
| GET | /internal/admin/feedback | Feedback list |
| PATCH | /internal/admin/feedback/:id | Update feedback status/note |
| GET | /internal/admin/billing | Billing overview |
| GET | /internal/admin/queues | Queue stats |
| GET | /internal/admin/feature-flags | List flags |
| PATCH | /internal/admin/feature-flags/:key | Toggle flag |

(!) For complete admin panel specification: see CHIRRI_OPS_AND_TESTING_SPEC.md §3

## 5.15 Error Monitoring & Alerting *(Added 2026-03-24 -- Ops & Testing Spec)*

### Sentry Configuration

Sentry (free tier: 5K errors/month) is initialized in all 3 services with:
- Environment and release tagging from Railway env vars
- 10% trace sample rate for API, 5% for workers
- Ignored errors: `ECONNRESET`, `ETIMEDOUT`, `UND_ERR_CONNECT_TIMEOUT` (expected for URL monitoring)
- Sensitive data stripping in `beforeSend` hook (API keys, auth headers)
- BullMQ integration: capture exhausted retries as errors, tag with queue name and job data

**Sentry alerts (configured in Sentry UI):**
- >50 errors in 1 hour → Email + Slack
- Any fatal event → Email immediately
- >10 events of new issue in 5 min → Slack

### Custom Operational Alerts

A health monitor cron (every 60s in Scheduler) checks:

| Alert | Condition | Severity |
|---|---|---|
| Queue backing up | url-checks waiting >100 | Warning |
| Queue critical | url-checks waiting >500 | Critical |
| DLQ not empty | failed-jobs count >0 | Warning |
| Worker missing | No heartbeat for >2 min | Critical |
| Scheduler died | No checks scheduled for >5 min | Critical |
| Error rate spike | >5% checks failing in 15 min | Warning |
| DB pool exhausted | Active connections >90/97 | Critical |
| Redis memory high | >200MB of 256MB | Warning |
| Zero checks running | No check_results in 10 min | Critical |

**Alert channels (MVP):** Email to alex@chirri.io + Slack webhook to #chirri-alerts. Alert dedup: 5-minute cooldown per alert type.

### Logging

**MVP: Railway logs** (captures Pino JSON stdout, 7-day retention, searchable). Sufficient for launch.

**V1.1:** Add Axiom (`pino-axiom` transport) for 30-day retention, cross-service correlation, and advanced querying.

### Uptime Monitoring

- **External:** UptimeRobot (free) checks `/health` every 5 minutes
- **Internal:** Chirri monitors `httpbin.org/get` as canary (self-monitoring validates entire pipeline)

(!) For complete error monitoring specification: see CHIRRI_OPS_AND_TESTING_SPEC.md §4

## 5.16 Analytics & Metrics *(Added 2026-03-24 -- Ops & Testing Spec)*

### Tool Choice

**Product analytics: PostHog Cloud (free tier: 1M events/month).** Includes product analytics, session replay, and feature flags. Node SDK for backend events, JS SDK for frontend.

**Landing page analytics: Umami/Plausible** (lightweight, privacy-first, no consent banner). Already in Appendix C.

### Key Events Tracked

**Frontend (dashboard):** `url_added`, `change_viewed`, `change_triaged`, `webhook_created`, `provider_searched`, `diff_viewed`, `copy_as_markdown`, `plan_upgrade_clicked`, `api_key_created`, `mcp_tool_used`, `onboarding_step_completed`.

**Backend:** `check_completed` (aggregated daily), `change_detected`, `change_confirmed`, `notification_sent`, `notification_failed`, `learning_completed`, `classification_completed`, `false_positive_reported`, `account_created`, `account_upgraded`, `account_downgraded`, `account_deleted`, `api_request`, `impact_analysis_generated`.

### Key Metrics

| Category | Metrics |
|---|---|
| **Product** | Time to First Value (<48h target), Activation Rate (>60%), URLs/user/week, FP Rate (<5%), Triage Completion (>70%), MCP usage |
| **Business** | MRR (Stripe is source of truth), Churn Rate, Free→Paid Conversion, Plan Distribution, ARPU, LTV |
| **Technical** | Check latency p50/p95/p99, API response time p95, Diff processing time, LLM cost/day, Queue depths, Error rates |

### Privacy

- Landing page: no PostHog, cookieless analytics only
- Dashboard: PostHog with `respect_dnt: true`, `maskAllInputs: true` for session replay
- No tracking of API response content (only metadata)
- Users can opt out via Settings → Privacy
- GDPR deletion removes all PostHog data via API

### Event Volume

Optimized (daily check summaries instead of per-check events): ~300K events/month at 100 users, ~1M at 1K users (within free tier).

**Environment variables:** `POSTHOG_API_KEY`, `VITE_POSTHOG_KEY`, `POSTHOG_HOST`.

(!) For complete analytics specification: see CHIRRI_OPS_AND_TESTING_SPEC.md §5

---

# PART 6: API OVERVIEW

(*) This section summarizes all endpoint groups. The complete 4,313-line response contract is in CHIRRI_URL_ONBOARDING_FLOW.md.

## 6.1 Global Conventions

**Base URL:** `https://api.chirri.io/v1`

**CORS Configuration:** *(Fixed 2026-03-24 -- Pentest v2)*
The API at `api.chirri.io` serves the dashboard SPA at `chirri.io`. CORS headers are required:
```typescript
app.use('*', cors({
    origin: process.env.DASHBOARD_ORIGIN || 'https://chirri.io',
    credentials: true,           // Allow cookies (session auth)
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400,               // Preflight cache: 24h
}));
```
Only the dashboard origin is allowed. No wildcard origins. `credentials: true` enables cookie-based session auth for cross-origin requests.

**Authentication:**
- Dashboard: Session cookie via better-auth (HttpOnly, SameSite=Lax, Secure, Domain=.chirri.io) *(Fixed 2026-03-24 -- Pentest v2)*
- API: `Authorization: Bearer ck_live_...` or `ck_test_...` header

**Cookie configuration:** *(Fixed 2026-03-24 -- Pentest v2)* `SameSite=Lax` (not Strict) is required because the dashboard at `chirri.io` makes cross-origin requests to `api.chirri.io`. SameSite=Strict would block cookies on these cross-origin requests. `Domain=.chirri.io` ensures the cookie is sent to all chirri.io subdomains. CSRF protection via CSRF token + Origin/Referer header verification compensates for Lax vs Strict.

**Response envelope:**
- Single object: flat JSON `{ "id": "url_...", "url": "...", ... }`
- List: `{ "data": [...], "has_more": true, "next_cursor": "cur_..." }`
- Error: `{ "error": { "code": "...", "message": "...", "status": 400 } }`

**Pagination:** Cursor-based. Cursor is opaque base64 encoding (created_at, id). Max limit: 100.

**Dates:** ISO 8601 in UTC: `"2026-03-23T14:32:00Z"`

**IDs:** Prefixed nanoid. Prefix `ck_` for API keys (live: `ck_live_`, test: `ck_test_`).

| Entity | Prefix | Example |
|---|---|---|
| User | usr_ | usr_a1b2c3d4 |
| URL | url_ | url_e5f6g7h8 |
| Change | chg_ | chg_i9j0k1l2 |
| Webhook | wh_ | wh_q7r8s9t0 |
| Forecast | frc_ | frc_m3n4o5p6 |

## 6.2 Endpoint Groups

### Auth
| Method | Path | Description | Rate Limit |
|---|---|---|---|
| POST | /v1/auth/signup | Create account | 5/min per IP |
| POST | /v1/auth/login | Authenticate (returns session cookie) | 20/min per IP |
| POST | /v1/auth/logout | End session (revoke all or specific) | -- |
| POST | /v1/auth/verify-email | Verify email with token | -- |
| POST | /v1/auth/forgot-password | Request password reset | 3/hr per email |
| POST | /v1/auth/reset-password | Reset password with token | -- |
| POST | /v1/auth/change-password | Change password (requires current) | -- |

No /auth/refresh endpoint -- sessions don't need token refresh.
Never reveal whether an email exists (same error message for invalid email and wrong password).

### API Keys
| Method | Path | Description |
|---|---|---|
| POST | /v1/api-keys | Create key (session auth only, not via API key) |
| GET | /v1/api-keys | List keys (never shows full key, only prefix + suffix) |
| PATCH | /v1/api-keys/:id | Rename key |
| DELETE | /v1/api-keys/:id | Revoke key (immediately stops working) |

better-auth API key plugin handles dual configs: `ck_live_` (production) and `ck_test_` (test mode -- returns mock data, no real HTTP requests). *(Fixed 2026-03-24 -- Pentest v2)* Known limitation: API keys have no per-resource scoping (no read-only keys, no per-URL keys). All `ck_live_` keys have full read/write access. Scoped tokens planned for V1.1 when MCP server and CI/CD integrations need finer-grained access.

### URLs
| Method | Path | Description |
|---|---|---|
| POST | /v1/urls | Add monitored URL (triggers SSRF check, classification, learning) |
| GET | /v1/urls | List URLs (filter by status, tag, search) |
| GET | /v1/urls/:id | URL detail (stats, recent changes, learning progress) |
| PATCH | /v1/urls/:id | Update URL (name, interval, status, headers, notifications) |
| DELETE | /v1/urls/:id | Delete URL (stops monitoring, keeps history per retention) |
| POST | /v1/urls/bulk | Bulk create (max 100, partial success — HTTP 207) |
| DELETE | /v1/urls/bulk | Bulk delete |
| GET | /v1/urls/export | Export all URLs (re-importable format) |

POST /v1/urls returns different shapes based on probe result: learning (normal), auth_required (401/403), redirect_detected (3xx), degraded (5xx), limited (bot protection), monitoring_empty (empty body). *(Fixed 2026-03-24 -- Practical Review)* POST /v1/urls is async after SSRF check — returns `201` with `status: "classifying"` immediately, classification runs in background worker.

### Bulk Import Plan Limit Behavior (HTTP 207) *(Fixed 2026-03-24 -- Practical Review)*

`POST /v1/urls/bulk` processes URLs sequentially and returns HTTP 207 Multi-Status with per-URL results:

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

Behavior: URLs are processed in order. When the plan limit is hit, the offending URL returns `403 plan_limit_reached`, and all remaining URLs return `400 skipped_after_limit` (not attempted). The response always includes all URLs with their individual status.

### Changes
| Method | Path | Description |
|---|---|---|
| GET | /v1/changes | Change feed (filter: url_id, severity, type, date, workflow_state) |
| GET | /v1/changes/:id | Full change detail with diff, actions, snapshots |
| POST | /v1/changes/:id/track | Mark as tracked (with optional note) | *(Fixed 2026-03-24 -- Pentest v2)*
| POST | /v1/changes/:id/ignore | Mark as ignored | *(Fixed 2026-03-24 -- Pentest v2)*
| POST | /v1/changes/:id/snooze | Snooze until date `{ "until": "2026-06-01T00:00:00Z" }` | *(Fixed 2026-03-24 -- Pentest v2)*
| POST | /v1/changes/:id/resolve | Mark as resolved (with optional note) | *(Fixed 2026-03-24 -- Pentest v2)*
| DELETE | /v1/changes/:id/workflow | Reset to "new" (re-open for triage) | *(Fixed 2026-03-24 -- Pentest v2)*
| POST | /v1/changes/:id/feedback | Submit quality feedback (real_change/false_positive/not_sure) |
| PATCH | /v1/changes/:id/feedback | Update existing feedback |
| GET | /v1/changes/summary | Aggregated stats (by severity, type, workflow_state count) |

All workflow endpoints accept optional `{ "note": "..." }` body. Snooze requires `until` date. When snooze expires, state returns to `new`. Invalid transitions return 409 Conflict.

false_positive feedback suppresses the field FOR THAT USER ONLY. No user feedback ever modifies shared volatile lists. *(Updated 2026-03-24)*

### Forecasts
| Method | Path | Description |
|---|---|---|
| GET | /v1/forecasts | List active forecasts (filter: status, signal_type, severity, url_id) |
| GET | /v1/forecasts/:id | Full forecast detail with timeline, evidence, deadline |
| POST | /v1/forecasts/:id/acknowledge | Acknowledge (optional: mute reminders) |
| POST | /v1/forecasts/:id/dismiss | Mark as false_positive, not_relevant, or already_migrated |
| GET | /v1/forecasts/summary | Dashboard widget data (active count, next deadline, by severity) |

### Check History
| Method | Path | Description |
|---|---|---|
| GET | /v1/urls/:id/checks | Paginated check results (filter: since, until, status) |
| POST | /v1/urls/:id/check | Trigger immediate check (?wait=true for sync, 30s max; returns 504 with `{"error": {"code": "check_timeout", "message": "Check still running", "job_id": "..."}}` if timeout exceeded) | *(Fixed 2026-03-24 -- Pentest v2)*

Plan-limited history depth: Free=7 days, Personal=30, Team=90, Business=365.

### Sources
| Method | Path | Description |
|---|---|---|
| GET | /v1/urls/:id/sources | List all sources for a URL/provider with alert preferences |
| PATCH | /v1/urls/:id/sources/:source_id | Update per-source alert preferences |
| PATCH | /v1/urls/:id/sources | Bulk update (filter + preferences) |
| POST | /v1/urls/:id/sources/:source_id/reset | Reset to defaults |

### Webhooks
| Method | Path | Description |
|---|---|---|
| POST | /v1/webhooks | Create webhook (HTTPS only, SSRF validated) |
| GET | /v1/webhooks | List webhooks |
| GET | /v1/webhooks/:id | Webhook detail with recent deliveries and stats |
| PATCH | /v1/webhooks/:id | Update URL, events, active state |
| DELETE | /v1/webhooks/:id | Delete webhook |
| POST | /v1/webhooks/:id/test | Send test event |
| POST | /v1/webhooks/:id/rotate-secret | Rotate signing secret |
| GET | /v1/webhooks/:id/deliveries | Delivery log (filter: status, since) |

Plan limits: Free=0, Personal=3, Team=10, Business=unlimited.
Retry: 1m, 5m, 30m, 2h, 12h (5 attempts). Auto-disable after 3 consecutive days of failures.

### Providers
| Method | Path | Description |
|---|---|---|
| GET | /v1/providers | List all known providers (filter: category) |
| GET | /v1/providers/search?q=stripe | Search provider database |
| GET | /v1/providers/:slug | Provider detail with all available sources |

### Notifications *(Fixed 2026-03-24 -- Pentest v2)*
| Method | Path | Description |
|---|---|---|
| GET | /v1/notifications | List notification history (filter: channel, since, until, status) |
| GET | /v1/notifications/preferences | Get notification preferences (account defaults + per-URL overrides) |
| PATCH | /v1/notifications/preferences | Update account-level notification defaults (quiet hours, digest mode, channels) |

### Account
| Method | Path | Description |
|---|---|---|
| GET | /v1/account | Account details with plan limits |
| PATCH | /v1/account | Update name, timezone, notification defaults |
| GET | /v1/account/usage | Current usage stats (URLs, checks, changes, webhooks) |
| GET | /v1/account/billing | Billing info, payment method, invoices link |
| POST | /v1/account/billing/checkout | Create Stripe checkout session |
| GET | /v1/account/export | GDPR data export (async for large accounts) |
| POST | /v1/account/delete | Request deletion (7-day grace period) |
| POST | /v1/account/cancel-deletion | Cancel pending deletion |
| POST | /v1/account/email-preferences | Update email notification preferences |

### Health & Internal
| Method | Path | Description | Auth |
|---|---|---|---|
| GET | /health | Health check (DB, Redis, queue depth) | None |
| GET | /v1/status | Public API status | None |
| GET | /internal/metrics | Internal metrics (queue depths, error rates, entity counts) | INTERNAL_API_TOKEN *(Fixed 2026-03-24 -- Pentest v2)* Known limitation: single static token, no rotation mechanism. Rotate manually via env var update + deploy. For V1.1: support comma-separated list of valid tokens for zero-downtime rotation. |
| GET | /v1/openapi.json | Auto-generated OpenAPI 3.1 spec | None |

### Admin *(Added 2026-03-24 -- Ops & Testing Spec)*
All admin endpoints require `is_admin: true` on the authenticated user.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET | /internal/admin/health | System health dashboard data | Admin session |
| GET | /internal/admin/users | User list (paginated, searchable) | Admin session |
| GET | /internal/admin/users/:id | User detail | Admin session |
| POST | /internal/admin/users/:id/impersonate | Start impersonation session (audit-logged) | Admin session |
| GET | /internal/admin/urls | All URLs (filterable) | Admin session |
| GET | /internal/admin/shared-urls | Shared monitoring stats | Admin session |
| GET | /internal/admin/feedback | Feedback list | Admin session |
| PATCH | /internal/admin/feedback/:id | Update feedback status/note | Admin session |
| GET | /internal/admin/billing | Billing overview (MRR, churn, conversions) | Admin session |
| GET | /internal/admin/queues | Queue depths and job stats | Admin session |
| GET | /internal/admin/feature-flags | List feature flags | Admin session |
| PATCH | /internal/admin/feature-flags/:key | Toggle feature flag | Admin session |

### Rate Limits by Plan *(Updated 2026-03-24)*
| Plan | API Requests/Hour |
|---|---|
| Unauthenticated | 20/IP |
| Free | 10 |
| Personal | 60 |
| Team | 200 |
| Business | 500 |

Every response includes X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers.

## 6.3 Severity Enum

```
"critical" | "high" | "medium" | "low"
```

## 6.4 Workflow States Enum

```
"new" | "tracked" | "ignored" | "snoozed" | "resolved"
```

## 6.5 Webhook Event Types

- change.detected, change.confirmed, change.reverted
- url.created, url.classified, url.learning_complete, url.active
- url.error, url.degraded, url.recovered
- url.paused, url.resumed
- url.auth_required, url.redirect_detected, url.limited
- forecast.new, forecast.deadline, forecast.expired
- account.usage_alert
- source.preferences_updated, source.muted, source.unmuted
- test

## 6.6 Error Code Categories

| Category | Codes |
|---|---|
| Auth | unauthorized, invalid_credentials, account_locked, jwt_required |
| Input | invalid_input, invalid_url, invalid_cursor |
| Limits | plan_limit_reached, interval_not_available, rate_limited |
| Resources | not_found, duplicate_url, duplicate_webhook |
| State | invalid_status_transition, check_in_progress, already_acknowledged |
| Security | ssrf_blocked, dns_resolution_failed, self_referential |

(!) For complete response contract: see CHIRRI_URL_ONBOARDING_FLOW.md

---

# PART 7: INTEGRATIONS

## 7.1 Notification Channels

| Channel | MVP? | Approach | Format | Cost |
|---|---|---|---|---|
| **Email** | Yes | Resend API with React Email templates | HTML + plain text | Free (3K/mo) |
| **Slack** | Yes | Incoming webhooks (Block Kit) | Structured blocks with fields | Free |
| **Discord** | Yes (Free+) | Incoming webhooks (Embeds) | Rich embeds with severity color | Free |
| **Telegram** | V1.1 | Bot API | Markdown | Free |
| **PagerDuty** | V1.1 | Events API v2 | Structured payload with dedup_key | Free (to send) |
| **Webhook** | Yes (Personal+) | HMAC-SHA256 signed POST | JSON with markdown/HTML/text variants | Free |

MVP ships Slack + Discord via incoming webhooks (user provides URL, Chirri POSTs formatted JSON). No OAuth, no integrations table for Slack/Discord. Full Slack/Discord integrations with OAuth are V1.1.

**Slack/Discord webhook configuration:** *(Fixed 2026-03-24 -- Pentest v2)* Users configure Slack/Discord incoming webhook URLs via `PATCH /v1/notifications/preferences { "slack_webhook_url": "https://hooks.slack.com/...", "discord_webhook_url": "https://discord.com/api/webhooks/..." }`. These are stored in `users.notification_defaults` JSONB. Webhook URLs are validated (SSRF check, must match expected hostname patterns: `hooks.slack.com` for Slack, `discord.com/api/webhooks` for Discord). Per-URL overrides via `PATCH /v1/urls/:id` notification_config.

Free tier: Email + Discord, 0 webhooks. *(Updated 2026-03-24)*

**Notification rate limits per plan:**

| Plan | Critical alerts/provider/hr | Other alerts/provider/hr | Total alerts/hr |
|---|---|---|---|
| Free | 3 | 2 | 10 |
| Personal | 10 | 5 | 30 |
| Team | 20 | 10 | 100 |
| Business | 50 | 25 | 500 |

When rate-limited, notifications queue for next window with a note: "This alert was delayed due to rate limiting."

**Email templates (5 onboarding + recurring):**
1. Welcome (Day 0, immediate)
2. Nudge (Day 1, if 0 URLs)
3. First check report (after first URL completes learning)
4. Inactivity (Day 7, if no dashboard visits in 5 days)
5. Weekly stability report (every Monday at 09:00 in user's timezone)
6. Dunning sequence (4 emails over 14 days on payment failure)

### Email Template Specs *(Fixed 2026-03-24 -- Practical Review)*

**Change notification email:**

```
Subject: [Chirri] {severity} severity change detected on {url_name}
From: Chirri <chirp@chirri.io>
Reply-To: support@chirri.io

Hi {user_name},

Chirri detected a {SEVERITY} severity change on your monitored API:

**{url_name}**
{url}

**What changed:**
{summary_bullet_list}

**Source:** {source_type}
**Detected:** {detected_at} UTC
**Confidence:** {confidence}%

[View Full Diff →]({dashboard_url})
[Mark as Reviewed →]({track_url})

---

This change was detected automatically.
If this looks like a false positive: [Report Issue]({feedback_url})

You're receiving this because you're monitoring this URL with immediate notifications.
[Manage notification preferences]({preferences_url})

— Chirri
https://chirri.io
```

**HTML version:** Same content with severity badge (colored dot matching §1.2 severity colors), monospace font for code, buttons styled with sakura pink (#FFB7C5) accent.

**Plain text version:** Identical structure, no styling (multipart MIME for email clients that don't support HTML).

**Implementation:** React Email component `ChangeDetectedEmail.tsx` with `@react-email/components`. Every email includes `List-Unsubscribe` header for one-click unsubscribe (CAN-SPAM/GDPR compliance).

### Dunning Email Templates (4 emails over 14 days) *(Fixed 2026-03-24 -- Practical Review)*

| Day | Trigger | Subject |
|---|---|---|
| 0 | `invoice.payment_failed` webhook | "Payment failed for your Chirri subscription" |
| 3 | Still unpaid (BullMQ delayed job) | "Reminder: Payment failed 3 days ago" |
| 7 | Still unpaid (BullMQ delayed job) | "Final reminder: Update payment method within 7 days" |
| 14 | Still unpaid (BullMQ delayed job) | "Your Chirri account has been downgraded to Free" |

**Day 0 email:**
```
Subject: Payment failed for your Chirri subscription

Hi {name},

We tried to charge your payment method for your Chirri {plan} plan (${price}/month) but the payment failed.

Next steps:
1. Update your payment method in the next 14 days
2. Your service will continue during this grace period
3. If not resolved, your account will be downgraded to the Free plan

[Update Payment Method →]({stripe_billing_portal_url})

Payment failure reason: {failure_reason}

— Chirri
```

**Day 14 email (downgrade notice):**
```
Subject: Your Chirri account has been downgraded to Free

Hi {name},

Your payment method could not be charged after multiple attempts.
Your account has been automatically downgraded to the Free plan.

What changed:
- Monitoring interval: {old_interval} → Every 24 hours
- URLs paused: {paused_count} URLs (exceeds Free plan limit of 3)

To restore your {plan} plan:
1. Update your payment method
2. Your paused URLs will resume automatically

[Update Payment Method →]({stripe_billing_portal_url})

— Chirri
```

**Implementation:** On `invoice.payment_failed` webhook, enqueue email #1 immediately + schedule emails #2-#4 as BullMQ delayed jobs (3d, 7d, 14d). On `invoice.paid` webhook, cancel all pending dunning jobs. Day 14 job also triggers account downgrade logic.

### SPF/DKIM/DMARC DNS Records *(Fixed 2026-03-24 -- Practical Review)*

Required DNS records for email deliverability (Cloudflare DNS):

```
# SPF (Sender Policy Framework)
chirri.io  TXT  "v=spf1 include:_spf.resend.com ~all"

# DKIM (DomainKeys Identified Mail — provided by Resend)
resend._domainkey.chirri.io   CNAME  resend1._domainkey.resend.com
resend2._domainkey.chirri.io  CNAME  resend2._domainkey.resend.com

# DMARC (Domain-based Message Authentication)
_dmarc.chirri.io  TXT  "v=DMARC1; p=quarantine; rua=mailto:alex@chirri.io; pct=100; adkim=s; aspf=s"
```

**Anti-spam checklist:**
- From address matches SPF record (`chirp@chirri.io` via Resend)
- Consistent sender name ("Chirri")
- Clear subject lines (no all-caps, no excessive punctuation)
- Plain text + HTML versions (multipart MIME)
- Unsubscribe link in footer + `List-Unsubscribe` header
- No URL shorteners, no embedded images (logo hosted on CDN)
- Monitor bounce rate via Resend webhooks (email.bounced, email.complained) — if bounce rate >5% or spam complaint rate >0.1%: urgent review

### Slack Block Kit Severity Colors *(Fixed 2026-03-24 -- Practical Review)*

The Slack Block Kit structure (Appendix D.10) should include attachment color bars for severity indication:

```typescript
{
  "blocks": [ /* ...existing Block Kit blocks from D.10... */ ],
  "attachments": [{
    "color": getSeverityColor(change.severity),
    "fallback": `${change.severity} severity change on ${change.url_name}`
  }]
}

function getSeverityColor(severity: string): string {
  return { critical: '#DC2626', high: '#DC2626', medium: '#F59E0B', low: '#10B981' }[severity];
}
```

Message truncation: if `change.summary` exceeds 1,000 characters, truncate with "... [View full diff on Chirri]" link.

### Discord Embed Severity Color Mapping *(Fixed 2026-03-24 -- Practical Review)*

The Discord embed structure (Appendix D.11) should use these decimal color values:

```typescript
function getDiscordColor(severity: string): number {
  return {
    critical: 15548997,  // #ED4245 (red)
    high: 15548997,      // #ED4245 (red)
    medium: 16776960,    // #FFFF00 (yellow)
    low: 5763719,        // #57F287 (green)
  }[severity];
}
```

Additionally include `author` and `avatar_url` fields for branding consistency:
```json
{
  "username": "Chirri",
  "avatar_url": "https://cdn.chirri.io/logo-512.png",
  "embeds": [{
    "author": { "name": "Chirri API Monitor", "url": "https://chirri.io", "icon_url": "https://cdn.chirri.io/logo-64.png" },
    ...existing embed from D.11...
  }]
}
```

### Webhook Retry Decision Tree *(Fixed 2026-03-24 -- Practical Review)*

Detailed retry logic for webhook deliveries:

```typescript
async function processWebhookDelivery(job) {
  try {
    const response = await deliverWebhook(webhook.url, payload, webhook.signing_secret);
    await recordSuccess(webhookId, response.status, job.attemptsMade);
    await resetConsecutiveFailures(webhookId);
  } catch (error) {
    const statusCode = error.response?.status;

    // Don't retry 4xx errors (permanent failures) — except 429
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
      await recordFailure(webhookId, error, false);  // permanent, no retry
      return;
    }

    // Retry 5xx, network errors, and 429
    await recordFailure(webhookId, error, true);
    await incrementConsecutiveFailures(webhookId);

    // Auto-disable after ~30 consecutive failures (3 days × ~10 events/day)
    if (consecutiveFailures >= 30) {
      await disableWebhook(webhookId, 'Auto-disabled due to consecutive failures');
      await sendWebhookDisabledEmail(webhook.user_id, webhookId);
    }

    throw error;  // Let BullMQ retry (1m, 5m, 30m, 2h, 12h)
  }
}
```

### Webhook Failure Notifications *(Fixed 2026-03-24 -- Practical Review)*

When a webhook is auto-disabled due to consecutive failures, the user is notified via email:

```
Subject: Webhook disabled due to delivery failures

Hi {name},

Your webhook endpoint has been automatically disabled after 3 consecutive days of delivery failures:

Webhook: {webhook_name}
URL: {webhook_url}
Last error: {last_error}

Next steps:
1. Fix the endpoint and verify it's accepting requests
2. Re-enable the webhook in your Chirri settings
3. Test with a sample event before re-enabling

[View Delivery Log →]({delivery_log_url})

— Chirri
```

Webhook delivery log is accessible at `GET /v1/webhooks/:id/deliveries` and shown in the Settings → Webhooks page with success rate badge (Healthy/Failing/Disabled).

### Quiet Hours Queuing Logic *(Fixed 2026-03-24 -- Practical Review)*

When a notification is generated during the user's configured quiet hours:

1. **Critical severity:** Send immediately (override quiet hours)
2. **High/Medium/Low severity:** Delay until quiet hours end

```typescript
async function scheduleNotification(userId, change) {
  const user = await getUser(userId);
  const quietHours = user.notification_defaults?.quiet_hours;

  if (!quietHours?.enabled) return sendNotification(userId, change);
  if (change.severity === 'critical') return sendNotification(userId, change);

  if (isInQuietHours(quietHours)) {
    const endTime = calculateQuietHoursEnd(quietHours);
    await queue.add('send-notification', { userId, changeId: change.id }, {
      delay: endTime.getTime() - Date.now(),
      jobId: `notification:${userId}:${change.id}`,  // Prevent duplicates
    });
    return { delayed: true, sendAt: endTime.toISOString() };
  }

  return sendNotification(userId, change);
}

function isInQuietHours(quietHours): boolean {
  const userLocalTime = getCurrentTimeInTimezone(quietHours.timezone);
  const { start, end } = quietHours;
  // Handle overnight ranges (e.g., 22:00 to 08:00)
  if (start > end) return userLocalTime >= start || userLocalTime < end;
  return userLocalTime >= start && userLocalTime < end;
}
```

Delayed notifications are sent individually (not batched) when quiet hours end. Optional `batch_delayed: true` setting in quiet_hours config sends a single "Morning Summary" digest instead.

(Source: CHIRRI_INTEGRATION_DETAILS.md, CHIRRI_CATEGORY_A_VALIDATION.md A10, Alex direction)

## 7.2 PM Integrations

| Tool | MVP? | Auth | Description Format |
|---|---|---|---|
| **Jira Cloud** | Yes (MVP) | OAuth 2.0 (3LO) | ADF (Atlassian Document Format) -- requires markdown-to-ADF conversion |
| **Linear** | Yes (MVP) | OAuth 2.0 | Native Markdown |
| **GitHub Issues** | Yes (MVP) | GitHub App OAuth | GitHub Flavored Markdown |
| **Asana** | V1.1 | OAuth 2.0 | Limited HTML subset |
| **Generic Webhook** | Yes (MVP) | HMAC signature | JSON with markdown/HTML/text variants |

All PM integrations follow the same UX: user clicks "Create Ticket" on a change --> modal with pre-filled title, description, project selector --> one click to create. Ticket link badge appears on the change card.

**Shared OAuth infrastructure:** Arctic library (lightweight, zero-dependency OAuth 2.0 client).

**Jira ADF conversion note:** Jira Cloud requires Atlassian Document Format (NOT markdown) for issue descriptions. This is a JSON tree structure. Use `adf-builder` or `md-to-adf` npm packages to convert Chirri's markdown change summaries to ADF. This is the most complex part of the Jira integration (~6h of the 20-28h estimate).

**Duplicate prevention:** Track change_id <-> ticket_url mapping. Show "Already ticketed: PROJ-42" badge on change cards. Users can create tickets in multiple tools simultaneously for the same change.

**Priority mapping (Chirri severity --> PM tool priority):**

| Chirri | Jira | Linear | GitHub | Asana |
|---|---|---|---|---|
| Critical | Highest | 1 (Urgent) | Label: severity-critical | Tag/Custom |
| High | High | 2 (High) | Label: severity-high | Tag/Custom |
| Medium | Medium | 3 (Medium) | Label: severity-medium | Tag/Custom |
| Low | Low | 4 (Low) | Label: severity-low | Tag/Custom |

(!) For complete PM integration details: see CHIRRI_PM_INTEGRATIONS.md

## 7.3 MCP Server

Chirri ships an MCP server as MVP. 8 core tools + 20 new feature tools (28 total):

| Tool | Description |
|---|---|
| chirri_list_monitors | List watched API endpoints |
| chirri_add_monitor | Add a new URL to monitor |
| chirri_remove_monitor | Remove a monitored URL |
| chirri_get_changes | Get recent detected changes |
| chirri_get_diff | Get the diff between two snapshots |
| chirri_check_now | Trigger an immediate check |
| chirri_get_forecasts | Get active early warning signals |
| chirri_acknowledge | Acknowledge a change or forecast |

An AI agent using Chirri's MCP server = recurring API calls = retention.

### MCP Server Installation & Configuration Guide *(Fixed 2026-03-24 -- Practical Review)*

**Installation:**
```bash
npm install -g @chirri/mcp-server
# or run directly
npx @chirri/mcp-server
```

**Configuration for Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):
```json
{
  "mcpServers": {
    "chirri": {
      "command": "npx",
      "args": ["-y", "@chirri/mcp-server"],
      "env": {
        "CHIRRI_API_KEY": "ck_live_abc123..."
      }
    }
  }
}
```

**Configuration for Cursor IDE:** Same JSON format in Cursor's MCP settings.

**Usage example in Claude:**
```
User: "What APIs am I currently monitoring?"
Claude: [calls chirri_list_monitors]
→ You're monitoring 3 APIs: Stripe Prices API (active), OpenAI Completions (active), GitHub REST API (learning, 7/30)

User: "Any recent changes?"
Claude: [calls chirri_get_changes with limit=5]
→ Yes, Stripe Prices API: Field `amount` removed from /v1/charges response. Severity: High.

User: "Add monitoring for api.twilio.com/v1/messages"
Claude: [calls chirri_add_monitor]
→ Added! Learning baseline, ~10 minutes.
```

**Additional MCP tools from new features:** *(Added 2026-03-24 -- New MVP Features)*
See §2.16 (dependencies + impact), §2.17 (migration checklists), §2.18 (packages), §2.19 (simulations), §3.10 (dependency graph), §7.5 (notification rules), §7.6 (GitHub issues) for 20 additional tool definitions.

**Tool specs:** See Appendix D.7 for complete input/output schemas for the 8 core tools. New feature tools documented in their respective sections.

(Source: Alex direction -- MCP is MVP)

## 7.4 Twitter/X Automation

One account: @chirri_io. Used for both product updates and detected API changes.

Strategy: Start monitoring 50 popular APIs pre-launch. Tweet every significant change detected. This builds audience before anyone signs up and creates a public proof-of-concept.

Implementation: X API Free tier (1,500 tweets/month), `twitter-api-v2` npm package. Runs as a separate lightweight service.

(Source: CHIRRI_GROWTH_STRATEGY.md, Alex direction -- one account, not separate changelog)

## 7.5 Workflow Routing / Notification Rules *(Added 2026-03-24 -- New MVP Features)*

Users define rules that route specific types of changes to specific notification channels. This sits between Step 9 (Change Detection) and Step 10 (Notification Dispatch) in the checking pipeline.

### 7.5.1 How It Works

**Evaluation flow:**
1. Change confirmed (Step 9)
2. Load user's notification rules (ordered by priority)
3. For each rule (first-match-wins, unless `continue_processing` flag): evaluate conditions against change facts
4. MATCH → Apply actions (route to channel, set severity override, suppress)
5. No rules matched → Fall through to user's default `notification_config`

**Rule engine:** `json-rules-engine` (17kb gzipped, zero heavy deps, JSON-serializable rules, <1ms evaluation). Rules stored as JSON in DB, evaluated at runtime.

### 7.5.2 Available Condition Facts

| Fact | Type | Example |
|---|---|---|
| `severity` | string | "critical", "high", "medium", "low" |
| `change_type` | string | "schema", "status_code", "header", "content", "deprecation" |
| `provider` | string | "stripe", "openai", "twilio" |
| `path_pattern` | string | "/v1/charges/*" (glob matching) |
| `tags` | string[] | ["payment", "auth"] |
| `security_flag` | boolean | true/false |
| `has_deadline` | boolean | true/false |
| `days_until_deadline` | number | 30 |
| `source_type` | string | "api", "changelog", "status_page", "sdk" |

### 7.5.3 Preset Templates

5 ready-made rule templates users can one-click install:

1. **"Breaking changes → immediate"** — severity in [critical, high] → bypass digest + quiet hours, all channels
2. **"Security changes → #security"** — security_flag = true → route to security Slack/Discord channel
3. **"Deprecations → weekly digest"** — change_type = deprecation → digest mode, no push
4. **"Status page → email only"** — source_type = status_page → email channel only
5. **"Low severity → suppress"** — severity = low → suppress notifications (dashboard only)

### 7.5.4 Data Model

```sql
CREATE TABLE notification_rules (
    id              TEXT PRIMARY KEY,         -- nrl_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    priority        INT NOT NULL DEFAULT 0,   -- Lower = evaluated first
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    conditions      JSONB NOT NULL,           -- json-rules-engine format
    -- Example: {"all": [
    --   {"fact": "severity", "operator": "in", "value": ["critical", "high"]},
    --   {"fact": "provider", "operator": "equal", "value": "stripe"}
    -- ]}
    actions         JSONB NOT NULL,
    -- Example: {
    --   "channels": ["slack:#payments-urgent", "email"],
    --   "severity_override": null,
    --   "suppress": false,
    --   "add_tags": ["urgent"],
    --   "create_github_issue": false,
    --   "bypass_quiet_hours": true,
    --   "bypass_digest": true
    -- }
    continue_processing BOOLEAN NOT NULL DEFAULT FALSE,
    times_matched   INT NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_rules_user ON notification_rules (user_id, enabled, priority);
```

### 7.5.5 API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /v1/notification-rules | List rules (ordered by priority) |
| POST | /v1/notification-rules | Create rule |
| PUT | /v1/notification-rules/:id | Update rule |
| DELETE | /v1/notification-rules/:id | Delete rule |
| POST | /v1/notification-rules/reorder | Reorder priorities |
| POST | /v1/notification-rules/test | Dry-run: "what would happen to this change?" |
| GET | /v1/notification-rules/templates | List preset templates |
| POST | /v1/notification-rules/from-template | Install a preset template |

**MCP Tools:**
- `chirri_list_notification_rules()` — list rules
- `chirri_create_notification_rule(name, conditions, actions)` — create
- `chirri_test_notification_rule(rule_id, change_id)` — dry-run

### 7.5.6 Plan Gating

- **Free / Personal:** Default notification config only (no custom rules)
- **Team:** Up to 10 notification rules
- **Business:** Up to 25 notification rules + preset templates

### 7.5.7 Integration with Existing Pipeline

Rules **OVERRIDE** per-URL `notification_config` when they match. If no rule matches, fall through to existing config. Rules are cached in Redis per user (invalidated on rule update).

### 7.5.8 Effort Estimate

~52 hours: Data model (2h), json-rules-engine integration + custom operators (8h), rule evaluation in pipeline (6h), REST API (6h), MCP tools (2h), Frontend rule builder form (14h), preset templates UI (4h), test/dry-run UI (4h), testing (6h).

(!) For complete implementation details: see CHIRRI_NEW_FEATURES_IMPLEMENTATION.md §2

## 7.6 GitHub Issue Auto-Creation *(Added 2026-03-24 -- New MVP Features)*

Users connect their GitHub account, configure a default repo, and Chirri creates rich, contextual issues from detected changes with one click or automatically via notification rules.

### 7.6.1 How It Works

**Auth: GitHub App (not OAuth App).** Better permission model (fine-grained, per-repo), issues created as "chirri-bot" (clearly automated), no long-lived tokens stored. Uses `@octokit/app` for JWT generation and installation token management.

**Flow:**
1. User clicks "Connect GitHub" in Settings → GitHub App installation flow
2. User installs Chirri GitHub App on their repo(s) → `installation_id` stored
3. User configures default repo in Settings
4. On change: "Create Issue" button OR automatic (via notification rules)

**Issue content includes:** Change summary, severity badge, diff highlights, migration steps (if checklist exists), impact analysis (if available), deadline countdown, links to Chirri change detail and provider changelog.

### 7.6.2 Auto-Created Labels

| Label | Color | Applied When |
|---|---|---|
| `chirri` | #FFB7C5 (sakura pink) | Always |
| `api-change` | #1D76DB | Always |
| `breaking-change` | #B60205 | severity = critical |
| `deprecation` | #FBCA04 | change_type = deprecation |
| `security` | #D93F0B | security_flags present |
| `migration` | #0E8A16 | migration checklist attached |

### 7.6.3 Data Model

```sql
CREATE TABLE github_connections (
    id              TEXT PRIMARY KEY,         -- ghc_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    installation_id BIGINT NOT NULL,
    account_login   TEXT NOT NULL,
    account_type    TEXT NOT NULL CHECK (account_type IN ('user', 'organization')),
    default_repo    TEXT,                     -- "owner/repo"
    default_labels  TEXT[] DEFAULT '{}',
    auto_assign     TEXT,                     -- GitHub username to auto-assign
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'revoked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, installation_id)
);

CREATE TABLE github_issues (
    id              TEXT PRIMARY KEY,         -- ghi_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id   TEXT NOT NULL REFERENCES github_connections(id) ON DELETE CASCADE,
    change_id       TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    repo            TEXT NOT NULL,
    issue_number    INT NOT NULL,
    issue_url       TEXT NOT NULL,
    labels          TEXT[] DEFAULT '{}',
    assignee        TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (change_id, repo)                  -- One issue per change per repo
);
CREATE INDEX idx_github_issues_user ON github_issues (user_id, created_at DESC);
CREATE INDEX idx_github_issues_change ON github_issues (change_id);
```

**No long-lived access tokens stored.** GitHub App installation tokens are generated on demand from the App's private key + `installation_id`. They expire after 1 hour.

### 7.6.4 API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /v1/integrations/github | List GitHub connections |
| POST | /v1/integrations/github/install | Initiate GitHub App installation |
| DELETE | /v1/integrations/github/:id | Disconnect |
| PATCH | /v1/integrations/github/:id | Update default repo/labels |
| GET | /v1/integrations/github/repos | List accessible repos |
| POST | /v1/changes/:id/github-issue | Create issue for a change |
| GET | /v1/github-issues | List created issues |

**MCP Tools:**
- `chirri_create_github_issue(change_id, repo?, labels?, assignee?)` — create issue
- `chirri_list_github_issues(change_id?)` — list created issues

### 7.6.5 Duplicate Prevention

`UNIQUE (change_id, repo)` constraint prevents duplicate issues. "Create Issue" button changes to "View Issue" badge once created. Dashboard shows "Already ticketed: owner/repo#42" badge on change cards.

### 7.6.6 Effort Estimate

~55 hours: GitHub App registration (2h), OAuth/installation flow backend (8h), token management (4h), issue creation API (6h), issue template rendering (4h), label management (2h), data model (3h), REST API (6h), MCP tools (2h), Frontend connection UI (6h), "Create Issue" button + repo picker (4h), Settings page (4h), testing (4h).

(!) For complete implementation details: see CHIRRI_NEW_FEATURES_IMPLEMENTATION.md §6

## 7.7 Accounts Chirri Needs to Create

- chirri.io domain (Cloudflare)
- Railway project
- Cloudflare R2 bucket
- Stripe account (billing)
- Resend account (email)
- Sentry project (error tracking)
- GitHub organization (code, Actions, open-source CLI)
- Twitter/X @chirri_io
- Atlassian Developer Console (Jira OAuth app)
- Linear OAuth application
- GitHub App (for GitHub Issues integration + GitHub Issue Auto-Creation)

---

# PART 8: SECURITY

## 8.1 Launch Blockers

9 security items that must be resolved before shipping:

| # | Item | Status | Severity |
|---|---|---|---|
| 1 | SSRF prevention module (all 8 bypass vectors) | Design complete | Critical |
| 2 | Cross-tenant isolation for shared sources | Design complete | Critical |
| 3 | XSS prevention on diff viewer (CSP + sanitization) | Design complete | Critical |
| 4 | Auth security (session-based, not JWT in localStorage) | Decided | Critical |
| 5 | Webhook signing (HMAC-SHA256 with replay protection) | Spec complete | High |
| 6 | Redis authentication + TLS | *(Fixed 2026-03-24 -- Pentest v2)* Use `REDIS_URL` with credentials (Railway auto-injects password). Configure ioredis with `password` from URL and `tls: {}` for TLS. Railway managed Redis supports requirepass. All BullMQ/ioredis connections use the authenticated `REDIS_URL`. | High |
| 7 | DDoS amplification prevention (global per-domain caps) | Design complete | High |
| 8 | Account enumeration prevention (same error messages) | Design complete | Medium |
| 9 | ReDoS prevention (re2js for pattern matching) | Research complete | High |

## 8.2 SSRF Blocklist

Complete IP blocklist (see Section 5.5) plus hostname blocklist:
- *.railway.internal, *.internal, *.local, *.localhost
- metadata.google.internal, metadata.gcp.internal
- instance-data (AWS EC2 metadata alias)
- *.chirri.io (self-referential)

Additional protections:
- IPv4-mapped IPv6 normalization via ipaddr.js
- Octal/decimal/hex IP notation handling
- URL parser differential attack prevention (canonical URL reconstruction)
- Cloud metadata CNAME resolution blocking

## 8.3 Cross-Tenant Isolation

Shared monitoring creates potential information leakage:

**Timing oracle:** Adding a URL on an already-monitored domain responds faster than a fresh domain. Mitigation: normalize response time to ~3 seconds for all URL additions.

**discovered_by field:** Never exposed in any API response. Internal analytics only.

**Shared source metadata:** API responses never include other users' data. subscriber_count hidden or bucketed.

**Baseline isolation:** Per-user baselines are strictly isolated. Fan-out iterates per-user, never cross-references.

## 8.4 XSS Prevention on Diff Viewer

External API responses may contain malicious HTML/JS. Defense:

1. **CSP header:** `default-src 'self'; script-src 'self'`
2. **Framework auto-escaping:** React auto-escapes by default. Never use dangerouslySetInnerHTML for API response data.
3. **JSON rendering:** Diff viewer renders JSON with syntax highlighting, never as raw HTML.
4. **jsondiffpatch:** Use programmatic delta format, NOT the HTML formatter (has CVE-2025-9910).
5. **Prototype pollution prevention:** Sanitize external JSON (strip `__proto__`, `constructor`, `prototype` keys) before passing to jsondiffpatch.

## 8.5 Auth Security

- Sessions via better-auth (HttpOnly, SameSite=Lax, Secure, Domain=.chirri.io cookies) *(Fixed 2026-03-24 -- Pentest v2)*
- Argon2id password hashing (OWASP recommended params: memoryCost 19456, timeCost 2, parallelism 1)
- Account lockout after 10 failed login attempts (15 minutes)
- Same error message for invalid email and invalid password (plus dummy bcrypt hash to normalize timing)
- CSRF: SameSite=Lax cookies + CSRF token on all state-changing requests + Origin/Referer header verification *(Fixed 2026-03-24 -- Pentest v2)*
- Referrer-Policy: strict-origin (don't leak full URLs in referer)
- API keys never accepted in query parameters (reject with helpful error)
- Password change revokes all existing sessions
- Disposable email domain blocking on signup

**Email verification flow (non-blocking):**
1. Signup --> verification email sent --> user can immediately add 1 URL
2. Email verified --> unlock full Free tier quota (3 URLs)
3. After 72h without verification --> pause all monitoring, show "verify email to continue" banner
4. Unverified accounts limited to 1 URL (prevents mass-account abuse while allowing instant "aha moment")

## 8.6 Webhook Signing

Stripe-style HMAC-SHA256 signature:
```
X-Chirri-Signature: t=1711238100,v1=sha256hmac...
X-Chirri-Event: change.confirmed
X-Chirri-Delivery: del_...
User-Agent: Chirri-Webhook/1.0
```

Verification: `HMAC-SHA256(signing_secret, timestamp + "." + body)`. Reject if timestamp >300 seconds old. Constant-time comparison via `crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(received, 'hex'))` -- do NOT use `===` (timing-vulnerable). *(Fixed 2026-03-24 -- Pentest v2)*

## 8.7 Discovery SSRF Protection

All discovery probe URLs go through safeFetch(). HTTPS only. No redirect following. 1 probe/second rate limit. Abort >1MB responses. Only validate responses returning 200. Total discovery budget: 15 requests per domain.

## 8.8 ReDoS Prevention

All regex pattern matching against untrusted content (changelog text, user URLs, relevance matching) uses `re2js` -- a pure JavaScript port of Google's RE2 engine guaranteeing linear-time matching. This eliminates catastrophic backtracking entirely.

Specific patterns identified as vulnerable without RE2:
- `(?:\/[\w\-\.]+)+` in PATH_PATTERNS (nested quantifier)
- `matchGlob()` converting user input to regex

Additional safeguards: input size limits (100KB before regex matching), bounded repetition in patterns, 5-second per-operation timeout.

## 8.9 Account Deletion (GDPR)

Flow: User requests deletion --> 7-day grace period (monitoring paused, can cancel) --> deletion job runs:

| Data | Action | Rationale |
|---|---|---|
| users row | Anonymize (email hash, clear name/password) | Keep for referential integrity |
| api_keys | Hard delete | No longer needed |
| urls | Hard delete | User's monitoring config |
| url_secrets | Hard delete (CASCADE from urls) | Encrypted credentials |
| oauth_tokens | Hard delete | OAuth credentials |
| integrations | Hard delete | PM integration configs |
| tickets | Hard delete (CASCADE from integrations) | Ticket mappings |
| feedback | Hard delete | User-submitted feedback |
| user_changes | Hard delete | Per-user change views |
| user_forecasts | Hard delete | Per-user forecast acknowledgments | *(Fixed 2026-03-24 -- Pentest v2)*
| signal_matches | Hard delete | Per-user relevance results | *(Fixed 2026-03-24 -- Pentest v2)*
| source_alert_preferences | Hard delete | Per-user alert customization | *(Fixed 2026-03-24 -- Pentest v2)*
| migration_checklists | Hard delete | Per-user migration checklists | *(Added 2026-03-24 -- New MVP Features)*
| user_impact_views | Hard delete | Per-user impact analyses | *(Added 2026-03-24 -- New MVP Features)*
| user_api_context | Hard delete | Per-user endpoint context | *(Added 2026-03-24 -- New MVP Features)*
| api_dependencies | Hard delete (CASCADE from urls) | Per-URL dependency links | *(Added 2026-03-24 -- New MVP Features)*
| monitored_packages (user_id rows) | Hard delete | Per-user package monitoring | *(Added 2026-03-24 -- New MVP Features)*
| simulations | Hard delete | Per-user impact simulations | *(Added 2026-03-24 -- New MVP Features)*
| notification_rules | Hard delete | Per-user notification rules | *(Added 2026-03-24 -- New MVP Features)*
| github_connections | Hard delete | Per-user GitHub connections | *(Added 2026-03-24 -- New MVP Features)*
| github_issues | Hard delete (CASCADE from github_connections) | Per-user created issues | *(Added 2026-03-24 -- New MVP Features)*
| webhooks | Hard delete | User's webhook configs |
| webhook_deliveries | Hard delete (CASCADE from webhooks) | Delivery logs |
| notifications | Hard delete | Notification history |
| learning_samples | Hard delete (CASCADE from urls via shared_url) | Learning data |
| check_results, changes | Keep (shared_url_id based) | Shared monitoring data, not personal |
| shared_urls, baselines | Decrement subscriber_count; delete if 0 | Shared resource |
| Stripe subscription | Cancel via API (OUTSIDE transaction) | Billing cleanup |

*(Fixed 2026-03-24 -- Pentest v2)* Complete cascade ensures no PII-linked data survives deletion. Previously missing: user_forecasts, signal_matches, source_alert_preferences, url_secrets, oauth_tokens, integrations, tickets, feedback, learning_samples.

*(Fixed 2026-03-24 -- Practical Review)* **Critical: Stripe API call must be OUTSIDE the DB transaction.** The deletion flow is:

```typescript
// Step 1: Delete from DB (atomic transaction)
await db.transaction(async (tx) => {
  // All DELETE statements in order (child → parent)
  // ... (all table deletions as listed above)
  // Anonymize users row
});

// Step 2: Cancel Stripe subscription (best-effort, OUTSIDE transaction)
try {
  if (user.stripe_subscription_id) {
    await stripe.subscriptions.cancel(user.stripe_subscription_id);
  }
} catch (err) {
  logger.error({ err, userId }, 'Failed to cancel Stripe subscription during deletion');
  // Continue — DB already clean. Stripe subscription will expire naturally
  // or can be cleaned up manually.
}
```

Rationale: If the Stripe API call is inside the transaction and fails (network timeout, Stripe outage), it would roll back the entire GDPR deletion. GDPR deletion must not be blocked by a third-party API failure.

Requires typing "DELETE MY ACCOUNT" + password confirmation. Sends email at each stage (scheduled, completed, or cancelled).

## 8.10 Webhook URL Security

Webhook URLs validated with same SSRF protections as monitored URLs:
- HTTPS required (webhook payloads contain sensitive data)
- IP validation at DELIVERY time (not just registration -- prevents DNS rebinding)
- Hostname blocklist applied
- 30s timeout per delivery
- Don't retry 4xx errors (except 429)
- Auto-disable after 3 consecutive days of failures

## 8.11 Prototype Pollution Prevention

External JSON (API responses) sanitized before passing to jsondiffpatch:
- Strip `__proto__`, `constructor`, `prototype` keys recursively
- Use `Object.create(null)` for diff operations
- Consider `Object.freeze(Object.prototype)` at worker startup

## 8.12 Security Solutions *(Updated 2026-03-24)*

Solutions for all identified security attack vectors:

| Attack | Solution | Details |
|---|---|---|
| **LLM prompt injection** | 4-layer defense | Layer 1: Best-effort input sanitization (strip HTML, regex patterns, NFKD Unicode normalization -- known to be bypassable, defense-in-depth only) → Layer 2: Sandwich prompt (system instruction wraps untrusted text) → Layer 3: Output validation (strip URLs, length check, reject non-software content) → Layer 4: Label AI-generated. Layers 2-4 do the real security work; Layer 1 is a speed bump. *(Fixed 2026-03-24 -- Pentest v2)* |
| **SSRF cannon (unverified accounts)** | Graduated activation | Unverified accounts: 5 learning checks (not 30), 0 discovery probes, 24h interval only |
| **Baseline poisoning** | Quorum-based confirmation | First baseline = "provisional"; promoted to "confirmed" when 2nd independent user's sample matches; staleness expiry at 30 days |
| **Feedback weaponization** | REMOVED | Users never affect shared data at all. FP marking suppresses FOR THAT USER ONLY. No trust-weighted voting needed. |
| **Dedup key collision** | Expanded key | `hash(provider_id + signal_type + field_path + source_type + detection_timestamp_hour)` prevents cross-source collision and pre-planted keys |

## 8.13 Design Ambiguity Solutions *(Updated 2026-03-24)*

| Ambiguity | Decision | Details |
|---|---|---|
| **Custom headers** | MVP, encrypted storage | AES-256-GCM with per-tenant key, write-only API (never returned in GET), Personal+ only, always private check (never shared) |
| **POST monitoring** | Allow with safeguards | Consent warning ("will send real POST requests"), skip learning period (single baseline), 1h minimum interval, no retry on failure |
| **OpenAPI diff** | openapi-diff npm (Atlassian) | Structural diff with breaking/non-breaking classification + custom deprecation walker for `deprecated: true` fields |
| **Critical alert confirmation** | Immediate "unconfirmed" + fast Stage 2 | 5s recheck → send alert marked "unconfirmed" → fast confirmation at 1min, 3min, 5min (not 30min) → update confirmed/reverted |
| **Response decompression** | Free (automatic) | Node.js fetch handles gzip/deflate/brotli automatically. Compare decompressed body. Zero implementation effort. |

(Source: CHIRRI_PROBLEMS_SOLVED.md)

(!) For complete security analysis: see CHIRRI_SECURITY_PENTEST.md
(!) For solution implementations: see CHIRRI_UNKNOWN_SOLUTIONS.md

---

# PART 9: LAUNCH PLAN

## 9.1 MVP Feature List

Everything that ships at launch:

**Core Monitoring:**
- URL/domain input with SSRF validation
- Auto-classification (3-phase pipeline)
- Learning period (10min rapid + 7-day calibrating)
- JSON structural diffing (jsondiffpatch)
- HTML text extraction and diffing (cheerio + jsdiff)
- 4-fingerprint change detection (full, stable, schema, header)
- Confirmation recheck (Stage 1: 5s, Stage 2: 30min)
- Response size anomaly detection (>50% deviation)

**Provider Intelligence:**
- 15-20 hardcoded provider profiles (JSON config)
- Provider search and quick-add
- Bundled bonus sources (changelog, status page, SDK)
- Discovery service (15-path probe, async, once per domain)
- Shared monitoring deduplication

**Early Warning:**
- Sunset/Deprecation header parsing (RFC 8594/9745)
- API version header tracking
- Changelog keyword scanning
- LLM chirp summarization ($0.003/call, cached)
- Confidence scoring with human-readable reasoning
- Deadline countdown and reminder system

**Workflow:**
- 4-level severity (Critical/High/Medium/Low)
- 5-state workflow (New/Tracked/Ignored/Snoozed/Resolved)
- Notes field per change
- Copy-as-markdown
- Snooze with date picker

**Notifications:**
- Email (Resend) -- all plans
- Discord (incoming webhooks) -- all plans including free *(Updated 2026-03-24)*
- Slack (incoming webhooks) -- Personal+
- Notification rate limiting per plan

**Integrations:**
- MCP server (8 core tools + 20 new feature tools)
- Jira Cloud (with ADF conversion)
- Linear
- GitHub Issues
- Generic webhook

**Dashboard:** (see CHIRRI_FRONTEND_BIBLE.md for complete UI specification)
- Tree-view layout with status dots
- Change feed (filterable)
- Change detail (Monaco DiffEditor, side-by-side)
- URL detail with check log, TTFB stats
- Provider detail with source management
- Settings (API keys, webhooks, notifications, billing)
- Dark mode (system preference, dark fallback)
- Real data only (public API feed for new users while monitors learn)

**Account:**
- Email/password auth (better-auth)
- API keys (ck_live_, ck_test_)
- Free + Personal plans *(Updated 2026-03-24)*
- Stripe billing (checkout, portal, dunning emails)
- GDPR account deletion (7-day grace period)
- Data export
- Onboarding email sequence (5 emails)
- Weekly stability report

**New MVP Features (8 features):** *(Added 2026-03-24 -- New MVP Features)*
- API Dependency Intelligence: auto-detect upstream API dependencies, LLM-powered impact analysis ($0.005-0.008/analysis), cached per change (§2.16)
- Auto-Generated Migration Checklists: LLM-generated step-by-step migration plans personalized to user's endpoints, triggered on deprecation/breaking changes (§2.17)
- SDK/Package Version Intelligence: cross-reference npm/pip/gem updates with monitored APIs using deps.dev (Google's free API), personalized impact per user's endpoints (§2.18)
- Impact Simulator ("What Breaks If..."): simulate API version upgrades using oasdiff (300+ breaking change rules) for OpenAPI specs, LLM fallback for unstructured docs (§2.19)
- Security & Compliance Flagging: pattern matching on headers + field names for TLS/OAuth/CORS/auth changes, severity boost system, no LLM needed (§2.20)
- Historical Event Collection: `provider_events` table logging every change from day 1, UI in V2 (§2.21)
- Workflow Routing / Notification Rules: json-rules-engine based configurable rules, 5 preset templates, Business tier (§7.5)
- GitHub Issue Auto-Creation: GitHub App, one-click issue creation with migration context, @octokit/app (§7.6)
- Dependency Graph Visualization: React Flow interactive graph, dagre layout, color-coded by status (§3.10)

## 9.2 V1.1 Features *(Updated 2026-03-24)*

- Full Slack/Discord OAuth integrations (integrations table)
- OpenAPI spec semantic diffing (via openapi-diff library)
- GitHub release monitoring (Atom feeds)
- Status page integration (Statuspage.io)
- Bulk URL operations (import/export)
- Async data export for large accounts
- Smart chirp relevance filter (full implementation)
- Per-source channel routing
- Digest mode (daily/weekly)
- Telegram, PagerDuty notifications
- Team plan launch ($19/mo)
- Learning pipeline from aggregate feedback data (proactive FP detection improvement)

## 9.3 V2 Features *(Updated 2026-03-24)*

- Team collaboration features (seats, permissions) -- triggered by demand
- Business plan launch ($49/mo) + Enterprise (custom)
- LLM-powered changelog summarization (full pipeline)
- Community provider profiles
- Cross-domain intelligence
- CLI tool (chirri-cli)
- GitHub Action (chirri/api-change-check)
- Chirri Garden View (animated dashboard skin)
- Resolution verification (re-check after marking resolved)
- Historical event analytics UI (provider health scores, predictive forecasting -- data collected from day 1 per §2.21) *(Added 2026-03-24 -- New MVP Features)*
- Cost impact calculator (pricing page change → dollar impact) *(Added 2026-03-24 -- New MVP Features)*
- Competitive API intelligence (track competitor public APIs/pricing) *(Added 2026-03-24 -- New MVP Features)*
- GitLab/Bitbucket issue integration *(Added 2026-03-24 -- New MVP Features)*

## 9.4 Launch Sequence

1. **HN first** (Monday 9-10am ET): "Show HN: Chirri -- Get notified when any API you depend on changes." Link to GitHub repo.
2. **Product Hunt** (Tuesday): Full launch with demo video.
3. **Reddit** (Tuesday-Wednesday): r/programming, r/webdev, r/node, r/devops.
4. **Dev.to + Hashnode** (Wednesday): Technical deep-dive post.
5. **Indie Hackers** (Thursday): Building-in-public story.
6. **"UptimeRobot Alternative" blog post** (Friday): SEO seed targeting migration wave.

## 9.5 Marketing Strategy

- **Pre-launch:** Twitter @chirri_io monitoring 50 popular APIs, tweeting changes. `awesome-api-changelogs` GitHub repo.
- **Content:** Weekly "API Changes This Week" blog post. Per-API changelog pages (auto-generated, SEO goldmine). "State of API Changes 2026" report after 6 months.
- **Distribution:** Open-source CLI + GitHub Action (top of funnel). MCP server (AI agent distribution).
- **Community:** 5 hours/week: answer Reddit/HN questions (9:1 ratio), engage on "API broke" Twitter threads, post in Discord/Slack communities.

## 9.6 SEO Strategy

Target adjacent keywords (nobody searches "API change detection"):
- "[Provider] API changelog" (e.g., "Stripe API changelog")
- "API deprecation notification"
- "monitor third party APIs"
- "[Provider] API down" / "[Provider] API status"
- "UptimeRobot alternative"

## 9.7 Unfair Advantages

1. **Auto-classification is unique.** No monitoring tool auto-detects optimal monitoring strategy. Paste a URL, Chirri figures it out.
2. **Historical baseline data compounds.** After 6 months of monitoring, our data is irreplaceable. Switching cost increases over time.
3. **Aggregate intelligence creates network effects.** More users monitoring the same API = better detection, fewer false positives. Proactive FP detection + internal review pipeline improves shared detection over time. *(Updated 2026-03-24)*
4. **The "third-party API change detection" niche is empty.** API Drift Alert ($149/mo) is dead. apibeats is pre-revenue. No established competitor.
5. **Price destroys competition.** $5/mo vs $149/mo. Even a VC-funded competitor can't match our margins. *(Updated 2026-03-24)*
6. **The product generates its own content.** Every detected change = a tweet, a blog data point, a changelog entry. Content marketing is automated by the product.
7. **UptimeRobot's self-destruction.** 425% price increase creates a one-time migration wave. Chirri captures refugees and upsells change detection.
8. **AI agents are the tailwind.** Every new AI agent is a potential Chirri customer (MCP server).

## 9.8 Kill Criteria

If after 6 months:
- <500 free signups AND
- <15 paid users AND
- No clear product-market fit signal (users aren't retaining)

Then reassess the product direction. Not the market (the market is real) but the execution/positioning.

## 9.9 Effort Estimate *(Updated 2026-03-24)*

**Core MVP (existing): 750-870 hours (19-22 weeks solo developer)**

**New MVP Features (8 features):** *(Added 2026-03-24 -- New MVP Features)*

| Feature | Effort | Section |
|---|---|---|
| API Dependency Intelligence | ~130h (MVP 90h + V1.1 40h) | §2.16 |
| Auto-Generated Migration Checklists | ~57h | §2.17 |
| SDK/Package Version Intelligence | ~73h | §2.18 |
| Impact Simulator ("What Breaks If...") | ~86h | §2.19 |
| Security & Compliance Flagging | ~34h | §2.20 |
| Historical Event Collection | ~8h (table + pipeline hooks) | §2.21 |
| Workflow Routing / Notification Rules | ~52h | §7.5 |
| GitHub Issue Auto-Creation | ~55h | §7.6 |
| Dependency Graph Visualization | ~50h | §3.10 |
| **New features total** | **~545h** | |

**Ops & Testing Systems (5 systems):** *(Added 2026-03-24 -- Ops & Testing Spec)*

| System | Effort | Section | Priority |
|---|---|---|---|
| CI/CD Pipeline | ~20h | §5.12 | P0 (before first deploy) |
| Testing Strategy | ~35h | §5.13 | P0 (before first deploy) |
| Error Monitoring & Alerting | ~25h | §5.15 | P1 (at launch) |
| Admin Panel | ~40h | §5.14 | P2 (after launch) |
| Analytics & Metrics | ~25h | §5.16 | P2 (at launch, minimal) |
| **Ops total** | **~145h** | | |

**Grand total: ~1,440-1,560 hours (36-39 weeks solo developer)**

**Recommended build order** (by impact/effort ratio):
1. **CI/CD Pipeline (20h)** — can't deploy without it *(Ops)*
2. **Testing Strategy (35h)** — can't deploy safely without it *(Ops)*
3. Security & Compliance Flagging (34h) — lowest effort, highest differentiation
4. Historical Event Collection (8h) — trivial effort, compounds over time
5. **Error Monitoring (25h)** — catch issues from day 1 *(Ops)*
6. **Analytics (25h, minimal)** — capture day-1 data *(Ops)*
7. GitHub Issue Auto-Creation (55h) — enables workflow integration
8. Workflow Routing (52h) — multiplies value of all notifications
9. Migration Checklists (57h) — flagship feature, biggest conversion driver
10. **Admin Panel (40h)** — build iteratively after launch *(Ops)*
11. API Dependency Intelligence (90h MVP) — core intelligence layer
12. SDK/Package Intelligence (73h) — cross-references with monitoring
13. Dependency Graph (50h) — visual differentiation, marketing value
14. Impact Simulator (86h) — most complex, needs OpenAPI diffing

No fixed timeline -- ship when ready. Codex agents parallelize implementation significantly, reducing calendar time while maintaining the same total effort hours.

(!) For complete growth strategy: see CHIRRI_GROWTH_STRATEGY.md

---

# PART 10: KNOWN RISKS & MITIGATIONS

## 10.1 Top 10 Risks

| # | Risk | One-Line Mitigation |
|---|---|---|
| 1 | **False positives destroy trust** | 5-layer defense cascade + user feedback loop + confirmation rechecks |
| 2 | **"Nothing happened" churn** | Weekly stability reports, public API feed for new users, tree health indicators |
| 3 | **Postman builds this feature** | Speed to market + data moat (historical baselines are irreplaceable) |
| 4 | **SSRF bypass leads to internal compromise** | Comprehensive safeFetch() with ipaddr.js, DNS pinning, hostname blocklist |
| 5 | **DDoS amplification via Chirri** | Global per-domain caps (60/hr), email verification, CAPTCHA, cross-account dedup monitoring |
| 6 | **Changelog false chirps (attacker-controlled content)** | Source reputation scoring, first-time high-severity delay, keyword density anomaly detection |
| 7 | **Railway goes down / raises prices** | Standard Docker deployment, portable architecture, no Railway-specific dependencies |
| 8 | **Cost overrun from shared source checking** | Smart intervals (2h changelog, 10min status, 6h releases) + shared monitoring dedup |
| 9 | **Drizzle ORM v1.0 compatibility breaks** | Pin to Drizzle 0.x stable, don't upgrade until better-auth adapter confirmed compatible |
| 10 | **Single developer bus factor** | Comprehensive documentation (this Bible + companion docs), clean architecture, no tribal knowledge |

## 10.2 Compound Failure Scenarios

**Scenario 1: Redis down + DDoS**
Redis fails --> rate limits not enforced --> attacker floods target domain. Mitigation: fail-closed for outbound (skip check, re-enqueue) when Redis is unreachable.

**Scenario 2: SSRF + Redis access**
SSRF bypass reaches redis.railway.internal --> attacker reads job payloads containing webhook secrets. Mitigation: defense in depth -- SSRF prevention AND Redis authentication AND worker network isolation.

**Scenario 3: Learning period + real breaking change**
Day 2 of calibration, genuine 404 on endpoint. 85 confidence suppressed by 95 threshold. User trusts "Active" status but Chirri missed real outage. Mitigation: status code changes (5xx, 404) bypass calibration threshold and alert immediately.

(!) For all identified unknowns: see CHIRRI_UNKNOWN_SOLUTIONS.md

---

(!) **Dashboard UX, design language, component library, page specs, responsive breakpoints, glassmorphic buttons, tree visualization, empty states, and all other frontend/UI specifications have been moved to CHIRRI_FRONTEND_BIBLE.md.** Refer to that document for all frontend development.

---

# APPENDIX A: ALL KEY DECISIONS

Every decision Alex made, in the order they were recorded:

| # | Decision | Details |
|---|---|---|
| 1 | Product name | Chirri (chirri.io), not Delta API |
| 2 | No timeline | Ship when ready, no fixed deadline |
| 3 | No emojis | Colored dots or text markers everywhere |
| 4 | Build everything | No half-assing features |
| 5 | MCP is MVP | Ships at launch, not V1.1 or V2 |
| 6 | LLM chirp summarization is MVP | $0.003/call, cached per signal |
| 7 | Auth: Sessions + API keys | Via better-auth, not JWT |
| 8 | API key prefix | ck_ (not dk_) |
| 9 | URL/domain input only | No natural language parsing |
| 10 | Auto-add bonus sources | Alerts off, smart chirp when relevant |
| 11 | Uncapped bonus sources | No per-plan limit on bonus sources per provider |
| 12 | User chooses URLs on downgrade | Not LIFO or priority-based |
| 13 | Low-confidence notifications shown | With label, not silently suppressed |
| 14 | Real data only on dashboard | Public API feed for new users while monitors learn |
| 15 | Severity: 4 levels | Critical / High / Medium / Low (separate from urgency) |
| 16 | Workflow: 5 states | New -> Tracked / Ignored / Snoozed -> Resolved |
| 17 | HTTP framework: Hono | Not Fastify |
| 18 | IDs: Prefixed nanoid | ck_live_..., ck_test_..., usr_..., url_..., etc. |
| 19 | Railway Hobby plan | Start Hobby, upgrade to Pro when needed |
| 20 | Drizzle 0.x (pinned) | Don't upgrade to v1.0 until stable + better-auth compatible |
| 21 | Native Postgres partitioning | Not pg_partman (not available on Railway) |
| 22 | Free tier: Email + Discord | 0 webhooks, but Discord and email notifications included *(Updated 2026-03-24)* |
| 23 | Jira integration: MVP | With ADF conversion |
| 24 | Linear + GitHub Issues: MVP | Markdown-native, easiest to build |
| 25 | One Twitter account | @chirri_io for everything (not separate changelog) |
| 26 | Tree metaphor for dashboard | Clean tree-view with status dots, not animated |
| 27 | Roots undeletable | Bonus sources can be muted but not deleted |
| 28 | Discovery: 15 paths | Async, runs once per domain |
| 29 | Pricing: $5 Personal entry *(2026-03-24)* | Free / $5 Personal / $19 Team / $49 Business / Enterprise (custom) |
| 30 | No seats on any plan *(2026-03-24)* | Team collaboration = V2, triggered by demand |
| 31 | API + MCP on all tiers *(2026-03-24)* | Including free (rate-limited: 10/hr free, 60/hr personal, 200/hr team, 500/hr business) |
| 32 | User feedback never affects shared data *(2026-03-24)* | FP marking = per-user only. No auto-modify shared volatile lists. Human-in-the-loop always. |
| 33 | Email addresses *(2026-03-24)* | support@chirri.io (customer-facing), chirp@chirri.io (automated), alex@chirri.io (internal only) |
| 34 | Glassmorphic CTA buttons *(2026-03-24)* | Landing page only. Semi-transparent + backdrop-blur + sakura petals behind. |
| 35 | Proactive FP detection *(2026-03-24)* | Auto-flag >90% change rate fields. Seed ~30 volatile patterns. V1.1 feedback pipeline. |
| 36 | Effort estimate *(2026-03-24)* | 750-870 hours (19-22 weeks solo). No fixed timeline. Codex parallelizes. |
| 37 | CI/CD: GitHub Actions + Railway Wait for CI *(2026-03-24)* | No railway CLI in CI. Railway auto-deploys after GitHub Actions pass. |
| 38 | Testing: Vitest + real Postgres (not SQLite) *(2026-03-24)* | Chirri uses Postgres-specific features. SQLite would mask real behavior. |
| 39 | Admin: Internal API + React pages, not AdminJS *(2026-03-24)* | AdminJS too generic for Chirri's specialized views (queue health, shared monitoring). |
| 40 | Error monitoring: Sentry + custom health monitor cron *(2026-03-24)* | Sentry for errors. Custom cron for operational alerts (queue depth, worker heartbeat, etc). |
| 41 | Analytics: PostHog for product, Umami/Plausible for landing *(2026-03-24)* | PostHog covers product analytics + session replay. Lightweight analytics for landing page. |
| 42 | Feature flags: Simple DB table + Redis cache *(2026-03-24)* | No external service (LaunchDarkly etc). Simple key-value flags in feature_flags table. |
| 43 | No staging environment at MVP *(2026-03-24)* | Add dev→staging when first paid customer arrives. Saves ~$15/mo. |
| 44 | Migrations: drizzle-kit migrate + raw SQL for partitioned tables *(2026-03-24)* | Drizzle can't manage partitioned tables. Use raw SQL alongside Drizzle migrations. |
| 37 | API Dependency Intelligence is MVP *(2026-03-24)* | LLM-powered impact analysis, fingerprint-based dependency detection, consumer-side focus |
| 38 | Migration checklists are MVP *(2026-03-24)* | LLM-generated, personalized to user endpoints, cached by change + endpoint set |
| 39 | Workflow routing is Business tier *(2026-03-24)* | json-rules-engine, 5 preset templates, Business tier gating |
| 40 | SDK intelligence uses deps.dev *(2026-03-24)* | Google's free API (CC-BY 4.0), covers all major registries |
| 41 | Impact simulator uses oasdiff *(2026-03-24)* | Go CLI as subprocess, 300+ breaking change rules, LLM fallback for unstructured docs |
| 42 | Security flagging is pattern-based *(2026-03-24)* | No LLM needed. Header + field name pattern matching with severity boost. |
| 43 | GitHub integration uses GitHub App *(2026-03-24)* | Not OAuth App. Fine-grained permissions, no long-lived tokens, issues as "chirri-bot" |
| 44 | Historical data collection starts day 1 *(2026-03-24)* | provider_events table, UI in V2, data compounds over time |

---

# APPENDIX B: DETAILED DOCUMENT INDEX

| Filename | Lines | Contains | When to Read |
|---|---|---|---|
| CHIRRI_BIBLE.md | ~3500 | This file. Product + backend single source of truth. | Always first. |
| CHIRRI_FRONTEND_BIBLE.md | ~2200 | Frontend/UI single source of truth. Design system, components, pages, responsive, accessibility. | When building any UI. |
| CHIRRI_CATEGORY_A_VALIDATION.md | ~350 | Validation of 14 "researched" Category A decisions | When questioning a resolved contradiction |
| CHIRRI_CATEGORY_B_RESEARCH.md | ~900 | Research results for 16 Category B items | When implementing framework/library choices |
| CHIRRI_CATEGORY_D_RESEARCH.md | ~1800 | Design specs for 28 missing items (dashboard, pause/resume, HTML diff, etc.) | When building specific features |
| CHIRRI_SEVERITY_AND_WORKFLOW.md | ~350 | Severity taxonomy research + post-detection workflow design | When implementing change triage UI |
| CHIRRI_CONTRADICTION_LIST.md | ~500 | Master list of 72 contradictions across all docs | Reference only -- all resolved in Bible |
| CHIRRI_ARCHITECTURE.md | ~1200 | Database schema, API endpoints, queue architecture, worker pipeline, SSRF prevention | Primary implementation reference |
| CHIRRI_URL_ONBOARDING_FLOW.md | ~4300 | Complete API response contract (every endpoint, status code, error) | API implementation reference |
| CHIRRI_EARLY_WARNING_IMPLEMENTATION.md | ~1800 | Signal parsing, forecast tables, header detection, keyword scanning, reminder system | When building early warning features |
| CHIRRI_RELEVANCE_INTELLIGENCE.md | ~2000 | Relevance matching engine, shared source model, announcement detection, fan-out pipeline | When building shared intelligence |
| CHIRRI_ESCALATION_AND_SEVERITY.md | ~1200 | Real deprecation timelines, escalation model, content severity extraction, re-notification | When building escalation logic |
| CHIRRI_SECURITY_PENTEST.md | ~1200 | 34 attack vectors with mitigations (SSRF, XSS, DDoS, cross-tenant) | Security review before launch |
| CHIRRI_UNKNOWN_SOLUTIONS.md | ~2500 | Concrete fixes for every blind spot (FP rate, memory, ReDoS, etc.) | When hitting an edge case |
| CHIRRI_OPS_AND_TESTING_SPEC.md | ~1200 | CI/CD pipeline, testing strategy, admin panel, error monitoring, analytics & metrics | When building ops infrastructure | *(Added 2026-03-24 -- Ops & Testing Spec)*
| CHIRRI_SOURCE_TRACKING_MODEL.md | ~600 | Source types, bundling model, cost analysis, pricing interaction | When building provider features |
| CHIRRI_SOURCE_PREFERENCES.md | ~700 | Per-source alert preferences, dashboard vs API defaults | When building notification routing |
| CHIRRI_TECH_STACK_DECISIONS.md | ~600 | Framework comparisons, auth library, ORM validation, testing strategy | When setting up the project |
| CHIRRI_INTEGRATION_DETAILS.md | ~900 | Slack/Discord/email payloads, webhook signing, Stripe billing, Monaco diff, SSE | When building integrations |
| CHIRRI_INFRASTRUCTURE_DETAILS.md | ~500 | Railway specifics, Postgres partitioning, R2 archival, migration strategy | When deploying |
| CHIRRI_PM_INTEGRATIONS.md | ~800 | Jira (ADF), Linear (GraphQL), GitHub Issues, Asana -- OAuth flows, payloads | When building PM integrations |
| CHIRRI_PROVIDER_MONITORING.md | ~500 | Per-provider source maps (Stripe, OpenAI, Twilio, GitHub, Shopify) | When building provider profiles |
| CHIRRI_DOMAIN_VS_PAGE_MONITORING.md | ~300 | Research: how input URLs are interpreted (domain vs page vs provider) | When building URL input handling |
| CHIRRI_BRAND_IDENTITY.md | ~500 | Positioning, voice guide, visual identity, landing page copy, color palette | When building UI/marketing |
| CHIRRI_GROWTH_STRATEGY.md | ~700 | Launch sequence, content strategy, community playbook, pricing psychology | When planning launch |
| CHIRRI_MARKET_ANALYSIS.md | ~800 | Competitive analysis, pricing benchmarks, market size, timing analysis | When pitching/planning |
| CHIRRI_REAL_DEVELOPER_RESEARCH.md | ~400 | Real developer pain points, integration research, AI agent use cases | When validating product decisions |
| CHIRRI_API_INTELLIGENCE.md | ~1500 | API dependency detection, impact analysis, fingerprint DB design, LLM prompts, cost model | When building dependency intelligence (§2.16) | *(Added 2026-03-24)*
| CHIRRI_NEW_FEATURES_IMPLEMENTATION.md | ~2000 | Implementation details for 7 new features: migration checklists, workflow routing, SDK intelligence, impact simulator, security flagging, GitHub issues, dependency graph | When building any new MVP feature (§2.17-§2.20, §3.10, §7.5-§7.6) | *(Added 2026-03-24)*
| CHIRRI_PRODUCT_OPPORTUNITIES.md | ~1500 | Feature opportunity analysis, scoring, prioritization, moat analysis, revenue impact | Product strategy reference | *(Added 2026-03-24)*

---

# APPENDIX C: COMPLETE TECH STACK

All versions pinned. No floating ranges for critical dependencies.

## Runtime & Framework
```json
{
    "node": ">=22.0.0",
    "hono": "^4.x",
    "@hono/node-server": "^1.x",
    "typescript": "^5.4"
}
```

## Auth
```json
{
    "better-auth": "^1.5.5",
    "@better-auth/drizzle-adapter": "^1.5.5"
}
```
Argon2id (via better-auth default), jose (via better-auth internals). No separate installs needed.

## Database
```json
{
    "drizzle-orm": "^0.36.0",
    "drizzle-kit": "^0.30.0",
    "pg": "^8.x"
}
```
PostgreSQL 16 (Railway managed). Drizzle pinned to 0.x -- do NOT upgrade to v1.0 until stable and better-auth adapter confirmed compatible. *(Fixed 2026-03-24 -- Pentest v2)* Note: Drizzle ORM has limited/no support for Postgres declarative partitioning. The `check_results` partitioned table must use raw SQL migrations (not Drizzle Kit generated). Create a `migrations/001_initial.sql` with all DDL, and use `drizzle-kit push` only for non-partitioned tables. Partition creation/drops are handled by the scheduler cron, not Drizzle Kit.

## Queue & Cache
```json
{
    "bullmq": "^5.x",
    "ioredis": "^5.x"
}
```
Redis 7 (Railway managed). Set maxmemory explicitly via `CONFIG SET maxmemory 256mb`. Set `maxmemory-policy noeviction`. *(Fixed 2026-03-24 -- Pentest v2)* `allkeys-lru` is WRONG for BullMQ job queues -- it can evict active job data under memory pressure. `noeviction` returns errors on write when full, which BullMQ handles gracefully (retries). Monitor memory usage and scale before hitting limit. Require authentication via `REDIS_URL` with credentials (Railway injects password automatically).

## Storage
```json
{
    "@aws-sdk/client-s3": "^3.x",
    "@aws-sdk/lib-storage": "^3.x"
}
```
Cloudflare R2. Store gzipped response snapshots. Free tier: 10GB storage, 1M Class A ops, 10M Class B ops. Zero egress fees.

**R2 key structure:** *(Fixed 2026-03-24 -- Pentest v2)*
```
snapshots/{shared_url_id}/{YYYY-MM}/{check_id}.json.gz     -- Response body snapshots
snapshots/{shared_url_id}/{YYYY-MM}/{check_id}.text         -- Extracted text (for HTML sources)
exports/{user_id}/{export_id}.zip                            -- GDPR data exports (24h signed URL)
backups/{YYYY-MM-DD}/chirri.sql.gz                          -- Daily DB backups
archives/{YYYY-MM}/check_results.jsonl.gz                   -- Archived check results
```
Content-Type: `application/gzip` for .gz files, `text/plain` for .text files. Retention managed by the daily maintenance cron (partition drops cascade to R2 key cleanup via a separate R2 lifecycle policy or maintenance job).

## Dashboard
```json
{
    "vite": "^5.x",
    "@vitejs/plugin-react": "^4.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "react-router": "^7.x",
    "@tanstack/react-query": "^5.x",
    "tailwindcss": "^3.x",
    "@monaco-editor/react": "^4.7",
    "recharts": "^2.x",
    "date-fns": "^3.x",
    "@xyflow/react": "^12.x",
    "dagre": "^0.8.x"
}
```
shadcn/ui installed via CLI (not npm package). Components copied into project.

## Content Processing
```json
{
    "jsondiffpatch": "^0.7.3",
    "cheerio": "^1.0.0",
    "@mozilla/readability": "^0.5",
    "jsdom": "^25.x",
    "turndown": "^7.x",
    "diff": "^7.x",
    "fast-xml-parser": "^5.5.8",
    "re2js": "latest",
    "chrono-node": "^2.9",
    "structured-headers": "^2.0",
    "semver": "^7.x",
    "normalize-url": "^8.x",
    "ipaddr.js": "^2.x"
}
```

(!) fast-xml-parser: MUST set `processEntities: false`. Three entity expansion CVEs in 3 months.
(!) jsondiffpatch: Use programmatic delta, NOT HTML formatter (CVE-2025-9910).

## Email & Notifications
```json
{
    "resend": "^4.x",
    "@react-email/components": "^0.0.30"
}
```

## Billing
```json
{
    "stripe": "^17.x"
}
```

## API & Validation
```json
{
    "zod": "^3.x",
    "zod-to-openapi": "^7.x"
}
```

## Integrations
```json
{
    "twitter-api-v2": "^1.18",
    "arctic": "latest",
    "@octokit/app": "^14.x",
    "@octokit/rest": "^21.x"
}
```

## New MVP Feature Dependencies *(Added 2026-03-24 -- New MVP Features)*
```json
{
    "json-rules-engine": "^6.x",
    "@xyflow/react": "^12.x",
    "dagre": "^0.8.x",
    "semver": "^7.x"
}
```
Also: `oasdiff` Go binary installed in Docker image (~20MB) for OpenAPI spec diffing (Impact Simulator §2.19).

## Logging & Monitoring
```json
{
    "pino": "^9.x",
    "@sentry/node": "^8.x"
}
```

## Testing
```json
{
    "vitest": "^2.x",
    "supertest": "^7.x",
    "msw": "^2.x",
    "pino-pretty": "^11.x"
}
```
pino-pretty and msw are devDependencies only. MSW (Mock Service Worker) mocks external HTTP APIs in integration tests (Stripe, Resend, OpenAI, GitHub). *(Added 2026-03-24 -- Ops & Testing Spec)*

## Analytics *(Added 2026-03-24 -- Ops & Testing Spec)*
```json
{
    "posthog-js": "^1.x",
    "posthog-node": "^4.x"
}
```
PostHog JS SDK for frontend (dashboard only, NOT landing page). PostHog Node SDK for backend event tracking. Free tier: 1M events/month.

## Admin *(Added 2026-03-24 -- Ops & Testing Spec)*
```json
{
    "@bull-board/api": "^6.x",
    "@bull-board/hono": "^6.x"
}
```
Bull Board for queue visualization in admin panel. Mounted at `/internal/admin/queues/board` behind admin auth.

## CI/CD
- GitHub Actions (2K min/mo free for private repos)
- Railway auto-deploy with "Wait for CI" enabled

## Infrastructure
- Cloudflare Free plan (CDN, DNS, DDoS)
- UptimeRobot Free plan (external /health monitoring)
- Sentry Free plan (5K errors/mo)

## Self-Monitoring

Chirri monitors itself:
- External: UptimeRobot checks /health every 5 minutes
- Internal: canary URL (httpbin.org/get) monitored by Chirri itself
- Queue depth alert at >1000 waiting jobs
- Error rate alert at >1% 5xx responses
- Worker heartbeat missing alert at >2 minutes

## Landing Page (Separate from Dashboard)

The landing page (chirri.io) is a separate static site:
- **Framework:** Astro (ships zero JS by default, fastest page loads)
- **Deployment:** Cloudflare Pages or Vercel (free tier)
- **Styling:** Same Tailwind config as dashboard
- **Content:** MDX for blog posts, React components for interactive elements
- **SEO:** Static HTML, structured data, sitemap.xml, robots.txt
- **Analytics:** Umami Cloud (free, privacy-friendly) or Plausible self-hosted

The dashboard (app.chirri.io) is the Vite+React SPA. These are separate deployments sharing a design system.

## Blog
- Astro with MDX and Content Collections
- Deployed to chirri.io/blog (or blog.chirri.io)
- Same Tailwind/design system as main site
- Cost: $0 (Cloudflare Pages / Vercel free tier)

## Newsletter
- Buttondown (free for <100 subscribers, $9/mo for <1K)
- RSS-to-email automation for blog posts
- Markdown-native

---

---

# APPENDIX D: KEY IMPLEMENTATION PATTERNS

## D.1 URL Normalization

Before hashing or comparing URLs, normalize via `normalize-url`:
```typescript
import normalizeUrl from 'normalize-url';

function normalizeMonitorUrl(url: string): string {
    return normalizeUrl(url, {
        stripWWW: false,
        removeTrailingSlash: true,
        sortQueryParameters: true,
        stripHash: true,
        removeQueryParameters: [/^utm_/i],
    });
}
```

Shared URL key = SHA-256(normalized URL). Method and headers NOT included for MVP (GET-only, no custom headers on free tier). Add when custom headers ship in V1.1.

## D.2 Copy-as-Markdown Format

The clipboard format for pasting into task trackers:

```markdown
## [HIGH] Stripe: /v1/charges deprecated

**Source:** https://stripe.com/docs/changelog#2026-03-15
**Detected:** 2026-03-20
**Deadline:** 2026-09-15 (178 days)

Stripe has deprecated the /v1/charges endpoint. All integrations
should migrate to /v2/payment_intents by September 15, 2026.

**Affects:** payment-service (based on your monitors)

[View diff on Chirri](https://chirri.io/changes/chg_abc123)
```

## D.3 Weekly Stability Report Template

Subject: "Your API stability report -- Week of {date}"
(or: "Your API stability report -- {n} changes detected")

Content:
- Header: {n} URLs monitored, {checks} checks run, {changes} changes detected, {uptime}% avg uptime
- Changes This Week (if 0: "No changes detected. Your APIs are stable.")
  - Top 5 by severity, each with severity dot, summary, detection time, "View diff" link
  - If >5: "+N more changes" link to dashboard
- Response Time Trends: top 3 URLs by response time change (direction + percentage)
- URL Health Summary: N active, N paused, N errors
- Footer: plan info, slot usage, manage preferences link, unsubscribe link

Sent every Monday at 09:00 in user's timezone. *(Fixed 2026-03-24 -- Pentest v2)* Implementation: the Monday 06:00 UTC cron job queries all users grouped by timezone, calculates which users' local time is currently 09:00 (±30 min window), and enqueues report generation jobs for those users. Users in later timezones are handled by subsequent cron runs throughout the day. This avoids BullMQ delayed jobs for timezone scheduling. Opt-out via email preferences or one-click unsubscribe link (CAN-SPAM/GDPR requirement).

## D.4 Webhook Payload Format

```json
{
    "id": "evt_...",
    "type": "change.confirmed",
    "api_version": "2026-03-24",
    "created_at": "2026-03-23T14:32:00Z",
    "data": {
        "change": {
            "id": "chg_...",
            "url": "https://api.stripe.com/v1/prices",
            "url_name": "Stripe Prices API",
            "change_type": "schema",
            "severity": "high",
            "confidence": 95,
            "summary": "Field `amount` removed from response object",
            "actions": ["Update integration to handle missing `amount` field"],
            "dashboard_url": "https://chirri.io/changes/chg_...",
            "feedback_url": "https://api.chirri.io/v1/feedback/fb_token_...",
            "detected_at": "2026-03-23T14:32:00Z",
            "confirmed_at": "2026-03-23T15:02:05Z"
        }
    }
}
```

Headers:
```
Content-Type: application/json
X-Chirri-Signature: t=1711209600,v1=sha256hmac...
X-Chirri-Event: change.confirmed
X-Chirri-Delivery: del_...
User-Agent: Chirri-Webhook/1.0
```

## D.5 Notification Pipeline Flow

Complete notification dispatch flow after a change is confirmed:

```
Change confirmed
  |
  For each subscriber:
    |
    Resolve source alert preferences (with inheritance):
      Account defaults --> Source preferences --> Override
      For each field: if source pref is null, use account default
    |
    Is alert_enabled for this source?
      NO --> Record alerted=false, reason='muted'. Done.
    |
    Is change severity >= min_severity?
      NO --> Record alerted=false, reason='min_severity'. Done.
    |
    Is digest_mode enabled?
      YES --> Queue for digest (daily/weekly). Record delivery='digest_pending'.
    |
    Is in quiet_hours?
      YES --> Queue for delivery after quiet hours end.
    |
    Route to source-specific channels:
      Email (if email_enabled)
      Webhooks (per source webhook_ids; fallback to account defaults)
      Integrations (per source integration_ids)
    |
    Check notification rate limit (Redis counter per user/provider/severity/hour)
      EXCEEDED --> Queue for next window with "delayed" note
    |
    Enqueue to notifications BullMQ queue with appropriate priority
    Record alerted=true
```

change.detected webhook fires for ALL changes regardless of alert preferences (webhook consumers may have their own filtering).

## D.6 Interval-to-Cron Mapping

Clock-aligned scheduling with jitter:

```typescript
function nextCheckTime(interval: string, now: Date): Date {
    const ms = {
        '1m': 60_000, '5m': 300_000, '15m': 900_000,
        '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000,
    }[interval];
    const epochMs = now.getTime();
    const next = Math.ceil(epochMs / ms) * ms;
    const jitter = Math.random() * ms * 0.10;  // 0-10% jitter
    return new Date(next + jitter);
}
```

## D.7 MCP Server Tool Specifications

Each MCP tool with input/output schema:

**chirri_list_monitors**
```
Input: { status?: "active" | "paused" | "all" }
Output: { monitors: [{ id, url, name, status, last_check_at, changes_count }] }
```

**chirri_add_monitor**
```
Input: { url: string, name?: string, interval?: string }
Output: { id, url, name, status: "learning", message }
```

**chirri_remove_monitor**
```
Input: { monitor_id: string }
Output: { success: boolean }
```

**chirri_get_changes**
```
Input: { monitor_id?: string, since?: string, severity?: string, limit?: number }
Output: { changes: [{ id, url, change_type, severity, summary, detected_at }] }
```

**chirri_get_diff**
```
Input: { change_id: string }
Output: { change_type, severity, summary, diff: { human_readable: [...] }, previous_schema, current_schema }
```

**chirri_check_now**
```
Input: { monitor_id: string, wait?: boolean }
Output: { status_code, response_time_ms, change_detected, change?: { id, summary } }
```

**chirri_get_forecasts**
```
Input: { status?: string, severity?: string }
Output: { forecasts: [{ id, title, deadline, days_until, confidence, signal_types }] }
```

**chirri_acknowledge**
```
Input: { id: string, type: "change" | "forecast", note?: string }
Output: { acknowledged: true, acknowledged_at }
```

The MCP server authenticates via API key (ck_live_ or ck_test_) passed as a tool configuration parameter. It connects to the same REST API as all other clients.

*(Fixed 2026-03-24 -- Pentest v2)* **MCP server deployment:** The MCP server is an npm package (`@chirri/mcp-server`) that users run locally as a stdio transport (standard MCP pattern). It does NOT need Railway deployment -- it runs on the user's machine alongside their AI agent (Claude, Cursor, etc.). The package is a thin REST API client that translates MCP tool calls to Chirri API requests. Alternatively, an SSE-based remote MCP transport can be hosted on Railway as a separate lightweight service for cloud-based AI agents.

## D.8 Graceful Shutdown

All services handle SIGTERM:
1. Stop accepting new work (close HTTP server, close BullMQ workers)
2. Wait for in-flight work (max 30s timeout)
3. Flush logs
4. Close DB and Redis connections
5. Exit

## D.9 Real-Time Dashboard Updates (SSE) *(Fixed 2026-03-24 -- Pentest v2)*

(!) For client-side SSE implementation (React hooks, TanStack Query invalidation, reconnection UI): see CHIRRI_FRONTEND_BIBLE.md Part 7.

The dashboard uses Server-Sent Events (not WebSocket) for real-time updates. SSE is server-to-client only (monitoring results pushed to user), works over standard HTTP, has built-in browser reconnection, and works through proxies/CDNs.

**SSE authentication:** *(Fixed 2026-03-24 -- Pentest v2)* SSE uses session cookie auth (not Authorization header), because the browser `EventSource` API cannot send custom headers. This works because CORS is configured with `credentials: true` and cookies use `SameSite=Lax` + `Domain=.chirri.io`. For API key users, SSE is accessed via `GET /v1/events?token=ck_live_...` (query param allowed only for SSE endpoint).

**Server implementation:**
```typescript
// Hono SSE endpoint
app.get('/v1/events', auth, async (c) => {
    const userId = c.get('user').id;
    return streamSSE(c, async (stream) => {
        // Subscribe to user's events (via Redis pub/sub)
        const unsubscribe = eventBus.subscribe(userId, async (event) => {
            await stream.writeSSE({ data: JSON.stringify(event) });
        });
        // Heartbeat every 30s
        const heartbeat = setInterval(async () => {
            await stream.writeSSE({ comment: 'heartbeat' });
        }, 30000);
        // Cleanup
        stream.onAbort(() => { unsubscribe(); clearInterval(heartbeat); });
    });
});
```

**Client:** Standard `EventSource` API. On message, invalidate TanStack Query cache for affected queries. Auto-reconnects on disconnect.

Events pushed: change.detected, change.confirmed, url.status_changed, forecast.new, check.completed

## D.10 Slack Block Kit Message Format *(Fixed 2026-03-24 -- Pentest v2)*

```json
{
    "blocks": [
        {
            "type": "header",
            "text": { "type": "plain_text", "text": "API Change Detected" }
        },
        {
            "type": "section",
            "fields": [
                { "type": "mrkdwn", "text": "*API:*\nStripe Prices API" },
                { "type": "mrkdwn", "text": "*Severity:*\n[red dot] High" },
                { "type": "mrkdwn", "text": "*Source:*\nOpenAPI Spec" },
                { "type": "mrkdwn", "text": "*Detected:*\nMar 24, 02:15 UTC" }
            ]
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*What changed:*\n- Removed field `amount` from /v1/charges response\n- Added required param `payment_method` to POST /v1/payment_intents"
            }
        },
        { "type": "divider" },
        {
            "type": "context",
            "elements": [{
                "type": "mrkdwn",
                "text": "<https://chirri.io/changes/chg_abc|View diff> | Monitoring api.stripe.com"
            }]
        }
    ]
}
```

## D.11 Discord Embed Format *(Fixed 2026-03-24 -- Pentest v2)*

```json
{
    "username": "Chirri",
    "embeds": [{
        "title": "API Change Detected -- Stripe Prices API",
        "url": "https://chirri.io/changes/chg_abc",
        "color": 15548997,
        "description": "**High severity changes in OpenAPI spec**\n\n- Removed field `amount` from /v1/charges\n- Added required param `payment_method`",
        "fields": [
            { "name": "Severity", "value": "High", "inline": true },
            { "name": "Source", "value": "OpenAPI Spec", "inline": true }
        ],
        "footer": { "text": "Chirri -- chirri.io" },
        "timestamp": "2026-03-24T02:15:00.000Z"
    }]
}
```

Severity colors: Critical/High = 15548997 (red), Medium = 16776960 (yellow), Low = 5763719 (green).

## D.12 Test Mode Behavior *(Fixed 2026-03-24 -- Pentest v2)*

API keys with `ck_test_` prefix operate in test mode:
- Do NOT make any outbound HTTP requests
- Return synthetic/mock responses (fixed JSON samples per content type)
- Respect the same plan limits as live mode
- Do NOT access any shared monitoring cache or real data
- Webhook test events clearly marked `"test": true`
- Changes detected in test mode are synthetic and do not appear in the real change feed

*(Fixed 2026-03-24 -- Pentest v2)* **Dashboard test mode:** The dashboard uses session auth (cookies), not API keys. To test with mock data, developers set `CHIRRI_TEST_MODE=true` in local environment, which makes the API return mock data for session-authenticated requests. In production, test mode is only accessible via `ck_test_` API keys. There is no dashboard toggle for test mode (it's a developer/CI tool, not a user feature).

## D.13 Error Budget and Plan Limit Enforcement *(Fixed 2026-03-24 -- Pentest v2)*

Plan limits enforced at the database level to prevent race conditions:

```sql
-- Atomic URL addition with plan limit check
BEGIN;
SELECT COUNT(*) as count FROM urls
WHERE user_id = $1 AND status != 'deleted' FOR UPDATE;
-- If count >= plan_limit: abort
INSERT INTO urls (...) VALUES (...);
COMMIT;
```

The FOR UPDATE lock prevents the TOCTOU race condition where 5 simultaneous POST /v1/urls requests all pass the count check.

On plan change (Stripe webhook), intervals are adjusted atomically:
```sql
UPDATE urls SET check_interval = '24h'
WHERE user_id = $1
  AND check_interval_seconds < (parse_interval('24h'));
```

## D.14 Monitoring Self-Check (Canary) *(Fixed 2026-03-24 -- Pentest v2)*

Chirri monitors itself to ensure the pipeline works end-to-end:

1. **External canary:** Monitor `https://httpbin.org/get` as a real URL. If this stops producing check results, the pipeline is broken.
2. **Health endpoint:** `/health` returns JSON with DB ping, Redis ping, queue depth, last check completed timestamp. UptimeRobot checks this every 5 minutes.
3. **Queue depth alerting:** If url-checks queue >500 waiting jobs, alert via Telegram. If >2000, critical.
4. **Worker heartbeat:** Each worker updates a Redis key every 60s. If no heartbeat for 120s, scheduler logs a warning.
5. **Daily digest validation:** After weekly report cron runs, verify at least 1 email was sent. If 0, alert.

## D.15 Migration Strategy (Expand-Contract) *(Fixed 2026-03-24 -- Pentest v2)*

**Initial schema creation:** *(Fixed 2026-03-24 -- Pentest v2)* The initial database schema is created via a `migrations/001_initial.sql` file containing all DDL from §5.2. Drizzle Kit generates schema definitions for non-partitioned tables (in `src/db/schema.ts` using `pgTable(...)` syntax). The partitioned `check_results` table and its partition management are handled via raw SQL (Drizzle Kit cannot manage partitioned tables). Run initial migration via `drizzle-kit push` for Drizzle-managed tables + `psql -f migrations/001_initial.sql` for raw SQL tables. Subsequent migrations use Drizzle Kit for standard tables and numbered SQL files for partition/raw SQL changes.

For zero-downtime schema changes:

| Change Type | Safe? | Approach |
|---|---|---|
| Add column (nullable) | Safe | Just add it -- old code ignores it |
| Add column (NOT NULL) | Careful | Add nullable, backfill, then ALTER to NOT NULL |
| Drop column | Careful | Remove from code first, deploy, THEN drop in next migration |
| Rename column | NOT safe | Add new, copy data, update code, drop old |
| Add table | Safe | Just add it |
| Add index | Safe | Use CREATE INDEX CONCURRENTLY |
| Change column type | NOT safe | Add new column, copy, swap |

Drizzle Kit is forward-only (no built-in rollback). Rollback via database snapshots or manual down migrations.

Deploy sequence: API server deploys first (runs migrations in prestart). Worker deploys second (schema already updated). Overlap period must be backward-compatible.

## D.16 Pino Logging Configuration *(Fixed 2026-03-24 -- Pentest v2)*

```typescript
const logger = pino({
    formatters: {
        level(label) { return { level: label }; },  // Fix Railway log level override
        bindings(bindings) {
            return { pid: bindings.pid, hostname: bindings.hostname, service: 'chirri-api' };
        },
    },
    level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
        paths: [
            'req.headers.authorization', 'req.headers.cookie',
            'password', 'apiKey', 'token', 'refreshToken',
        ],
        censor: '[REDACTED]',
    },
    base: {
        env: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV,
        version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    },
});
```

**Structured logging patterns:**
```typescript
// Good: structured context + message
logger.info({ userId, urlId, duration: 1234 }, 'check completed');

// Good: error with context
logger.error({ err, jobId, attempt: 3 }, 'check failed');

// Bad: string interpolation
logger.info(`User ${userId} checked ${urlId}`);  // NO
```

Log levels: fatal (process can't continue), error (operation failed), warn (degraded), info (normal operations), debug (development), trace (verbose).

## D.17 Startup Sequence *(Fixed 2026-03-24 -- Pentest v2)*

```
1. API Server starts:
   - Connect to PostgreSQL (retry 5x, 2s backoff)
   - Connect to Redis (retry 5x, 2s backoff)
   - Run pending Drizzle migrations
   - Start Hono HTTP server on $PORT
   - Register Stripe webhook handler
   - Log: "API server ready on port {PORT}"

2. Scheduler starts:
   - Connect to PostgreSQL + Redis
   - Acquire scheduler lock (Redis SETNX with 60s TTL)
     If lock taken: wait and retry (only one scheduler active)
   - Run missed-check recovery scan
     For each URL where last_check_at < now - 2x interval: enqueue catch-up
   - Start cron loops
   - Log: "Scheduler ready, recovered N missed checks"

3. Check Workers start (x2 instances):
   - Connect to PostgreSQL + Redis + R2
   - Start health check HTTP server on port 3001 (see below)
   - Register BullMQ consumers for all queues
   - Register SIGTERM handler for graceful shutdown
   - Log: "Worker {WORKER_ID} ready, consuming from all queues"
```

### Worker Health Check Endpoint *(Fixed 2026-03-24 -- Practical Review)*

Each worker exposes a lightweight HTTP health check on port 3001 (separate from the API server's port):

```typescript
// Worker health server (runs alongside BullMQ consumers)
import { createServer } from 'http';

const healthServer = createServer(async (req, res) => {
  if (req.url === '/health') {
    const health = {
      status: 'ok',
      worker_id: WORKER_ID,
      uptime_seconds: process.uptime(),
      redis_connected: redis.status === 'ready',
      db_connected: await checkDbConnection(),
      queues: {
        url_checks: await urlChecksQueue.count(),
        notifications: await notificationsQueue.count(),
        confirmations: await confirmationQueue.count(),
      },
      last_check_completed_at: lastCheckTimestamp,  // Updated on each successful check
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
    res.writeHead(health.redis_connected && health.db_connected ? 200 : 503);
    res.end(JSON.stringify(health));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(3001, () => logger.info('Worker health server on :3001'));
```

Railway health checks can probe `GET :3001/health` to detect unhealthy workers and restart them automatically.

## D.18 Content-Type Detection Heuristics *(Fixed 2026-03-24 -- Pentest v2)*

When auto-classification can't determine content type from domain patterns or Content-Type headers:

```typescript
function detectContentType(body: string, headers: Record<string, string>): string {
    // 1. Content-Type header
    const ct = headers['content-type'] || '';
    if (ct.includes('application/json')) return 'json-api';
    if (ct.includes('application/xml') || ct.includes('text/xml')) return 'xml';
    if (ct.includes('rss+xml') || ct.includes('atom+xml')) return 'rss-feed';

    // 2. Try JSON parse
    try {
        const json = JSON.parse(body);
        if (json.openapi || json.swagger) return 'openapi-spec';
        if (json.page && (json.components || json.status)) return 'status-page';
        return 'json-api';
    } catch {}

    // 3. Try XML detection
    if (body.trim().startsWith('<?xml') || body.trim().startsWith('<rss') || body.trim().startsWith('<feed')) {
        if (body.includes('<rss') || body.includes('<channel>')) return 'rss-feed';
        if (body.includes('<feed')) return 'atom-feed';
        return 'xml';
    }

    // 4. HTML detection
    if (body.includes('<html') || body.includes('<!DOCTYPE')) return 'html';

    // 5. Fallback
    return 'unknown';
}
```

**Monitoring method selection by content type:**
```
json-api       --> json-diff (jsondiffpatch structural comparison)
openapi-spec   --> content-hash (MVP), spec-diff (V1.1)
rss-feed       --> feed-poll (detect new entries by GUID/link)
atom-feed      --> feed-poll
status-page    --> json-diff (component status changes)
html           --> html-text-diff (if changelog-like URL), content-hash (otherwise)
xml            --> content-hash
unknown        --> content-hash
```

## D.19 Plan Limit Race Condition Prevention *(Fixed 2026-03-24 -- Pentest v2)*

Multiple simultaneous URL creation requests can bypass plan limits via TOCTOU (Time-of-Check-Time-of-Use). Prevention:

```sql
-- In a transaction with row-level lock:
BEGIN;
SELECT COUNT(*) FROM urls
WHERE user_id = $1 AND status NOT IN ('deleted')
FOR UPDATE;  -- Lock prevents concurrent reads

-- Check count against plan limit
-- If over: ROLLBACK
-- If under: INSERT
INSERT INTO urls (...) VALUES (...);
COMMIT;
```

The `FOR UPDATE` on the user's URL rows serializes concurrent insertions.

## D.20 Environment Variables *(Fixed 2026-03-24 -- Pentest v2)*

Shared across all services:
- DATABASE_URL, DATABASE_POOL_SIZE  -- *(Fixed 2026-03-24 -- Pentest v2)* Recommended pool sizes: API server=10, Scheduler=5, Worker (each)=10. Total ~35 connections. Railway Postgres has a default limit of ~97 connections. Monitor with `SELECT count(*) FROM pg_stat_activity`. If approaching limit, add PgBouncer or reduce pool sizes.
- REDIS_URL
- R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
- NODE_ENV, LOG_LEVEL
- INTERNAL_API_TOKEN
- ENCRYPTION_MASTER_KEY  -- *(Fixed 2026-03-24 -- Pentest v2)* For AES-256-GCM encryption of url_secrets and oauth_tokens

API Server only:
- PORT (Railway injects)
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PERSONAL, STRIPE_PRICE_TEAM, STRIPE_PRICE_BUSINESS  -- Updated 2026-03-24
- DASHBOARD_ORIGIN (CORS)
- SENTRY_DSN

Worker only:
- RESEND_API_KEY
- EMAIL_FROM (Chirri <chirp@chirri.io>)  -- Updated 2026-03-24
- WORKER_ID
- USER_AGENT (Chirri-Monitor/1.0 (https://chirri.io; monitoring service))

### Complete Environment Variables List *(Fixed 2026-03-24 -- Practical Review)*

The following variables were missing from the original list and are required:

**Auth (all services):**
- BETTER_AUTH_SECRET -- 32-byte random string for session encryption
- BETTER_AUTH_URL -- Base URL for OAuth callbacks (https://api.chirri.io)

**LLM (worker only):**
- OPENAI_API_KEY -- For GPT-4o-mini chirp summarization

**Twitter/X automation (optional, worker/separate service):**
- TWITTER_API_KEY, TWITTER_API_SECRET
- TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET

**PM Integrations (API server, V1.1+):**
- JIRA_CLIENT_ID, JIRA_CLIENT_SECRET
- LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET
- GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

**Railway (auto-injected):**
- RAILWAY_ENVIRONMENT -- production/staging (for logging context)
- RAILWAY_GIT_COMMIT_SHA -- For version tracking in logs

**Feature flags:**
- FEATURE_MCP_ENABLED (default: true)
- FEATURE_PM_INTEGRATIONS_ENABLED (default: false)

---

*This document is the single source of truth for Chirri. When in doubt, this Bible wins. When this Bible is silent, check the companion document listed in Appendix B. When companion documents disagree with this Bible, this Bible wins.*

*Written: 2026-03-24*
