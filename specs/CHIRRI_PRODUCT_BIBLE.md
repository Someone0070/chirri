# CHIRRI — THE PRODUCT BIBLE

**The single source of truth for building Chirri.**

*Consolidated: March 24, 2026*
*Sources: 19 research documents totaling 25,700 lines*
*Status: Implementation-ready*

---

## How to Use This Document

This is THE document. Read it top to bottom to understand everything about Chirri. For implementation-level details (full SQL schemas, complete API response shapes, code samples), follow the references to companion documents. This Bible + those references = enough to build.

**Companion documents (for deep dives):**
- `CHIRRI_ARCHITECTURE.md` — full database schema, queue configs, worker pipeline code, deployment config
- `CHIRRI_URL_ONBOARDING_FLOW.md` — every API endpoint with every response shape, every error code, every edge case
- `CHIRRI_EARLY_WARNING_IMPLEMENTATION.md` — implementation-ready early warning code, database migrations, parsing functions
- `CHIRRI_SECURITY_PENTEST.md` — all 34 attack vectors with detailed exploitation steps and mitigations
- `CHIRRI_UNKNOWN_SOLUTIONS.md` — concrete fixes for every blind spot, with code patterns and library choices

---

# PART 1: WHAT IS CHIRRI?

## Summary

Chirri (chirri.io) watches the APIs you depend on and tells you the moment anything changes. Give it any URL — an API endpoint, a docs page, a status page, an OpenAPI spec — and it monitors for structural changes, schema drift, deprecation signals, and behavioral shifts. It's the weather forecast for your API dependencies.

## Taglines

- **Primary:** "APIs change. We'll let you know."
- **Short:** "Know when APIs change."
- **Secondary (early warning positioning):** "Weather forecast for your API dependencies."

## Target Users (Priority Order)

1. **AI Agent Developers** — agents call dozens of APIs, break silently when those APIs change. Highest-value vertical.
2. **SaaS Companies (API integrators)** — companies like Zapier/Make connecting hundreds of APIs.
3. **E-commerce (Shopify/Amazon app devs)** — quarterly deprecation cycles break apps.
4. **Fintech** — regulated industry, API changes = compliance issues.
5. **UptimeRobot refugees** — migration wave from UptimeRobot's 425% price hike ($8→$34/mo).

## The Problem

APIs break without warning. The data is clear:

| Data Point | Source |
|-----------|--------|
| **36%** of companies spend more time troubleshooting APIs than developing new features | Lunar.dev 2024 Survey (n=200) |
| **14.78%** of API changes break backward compatibility | IEEE SANER 2017 (317 libraries, 9K releases, 260K clients) |
| **69%** of developers spend 10+ hours/week on API tasks | Postman 2025 State of the API |
| Developers affected by breaking changes grew from **30% to 51%** over 4 years | Flutter Developer Survey |
| Reddit/HN threads with hundreds of devs asking for exactly this tool | Multiple sourced threads in research docs |

**Real incidents:** Twitter/X killed free API access overnight (Apollo calculated $20M/year). Reddit's API pricing destroyed the third-party ecosystem. Google Maps raised prices 1,400%. Stripe silently restructured response fields. UptimeRobot hiked prices 425%.

**Cost of a single undetected API change: $50,000+ in lost revenue, engineering time, and customer trust.**

## The Solution

Chirri monitors any URL you give it and detects changes before they break your integration. Not just "is it up?" (that's UptimeRobot) — but "did it *change*?" Schema drift, new fields, removed fields, header changes, deprecation signals, version bumps.

**"Plant a seed"** — Chirri's onboarding uses the Japanese garden metaphor:
- **Plant** = add a URL or provider to watch
- **Grow** = Chirri learns the endpoint's behavior during the silent learning period
- **Chirp** = you get notified when something changes

The hero copy, CTAs, and dashboard should all reinforce this metaphor. "Plant a seed," not "Start monitoring."

## Brand

| Element | Decision |
|---------|----------|
| **Name** | Chirri (chirri.io) — Japanese for cricket chirp (チリチリ). Pronounced "CHEE-ree." |
| **Tagline** | APIs change. We'll let you know. |
| **Voice** | Calm, precise, warm, minimal, observant. The cricket chirps, it doesn't scream. |
| **Primary color** | Sakura pink `#FFB7C5` |
| **Background** | Snow `#FAFAFA` (light) / Night `#0F0F0F` (dark, default) |
| **Text** | Ink `#1A1A1A` |
| **Font** | Inter (headings + body), JetBrains Mono (code) |
| **Logo** | Chirp Wave — single sound wave mark |
| **Illustration** | Line art, cherry blossom petals, generous whitespace, Japanese zen minimalism |
| **Dashboard** | Dark mode default. Sakura pink for active states only — power through restraint. |

**Voice examples:**
- ✅ "The Stripe API response changed. Here's what's different."
- ✅ "We couldn't reach that endpoint. We'll try again in 5 minutes."
- ❌ "URGENT: API CHANGE DETECTED!"
- ❌ "Oopsie! Something changed! 🙈"

> For full brand guide including color palette, typography rules, landing page copy options, and competitive positioning map, see `CHIRRI_BRAND_IDENTITY.md`.

---

# PART 2: HOW IT WORKS (User Perspective)

## The "Plant a Seed" Flow

1. **Create an account** on chirri.io — email + password, no credit card required
2. **Grab your API key** — `dk_live_` prefix for production, `dk_test_` for mock data
3. **Plant a seed** — add any URL via `POST /v1/urls` or the dashboard
4. **Chirri learns it** — 10-minute rapid check period builds a baseline
5. **Chirri checks it** — clock-aligned intervals (hourly, daily, etc.)
6. **Something changes?** → notification with full diff via webhook, email, Slack, or Discord
7. **Review the change** — side-by-side diff view (THE money screen) with auto-generated summary
8. **That's it.** Integration takes under 10 minutes.

## Input: URLs and Domains Only

**No natural language parsing.** Input is always a URL or domain. Provider matching is domain-based.

### What Happens When You Enter a URL

```
Input URL
│
├─ Known provider domain (e.g., stripe.com)?
│   └─ YES → Show all monitorable sources (OpenAPI spec, changelog, status page, SDK releases)
│           User selects which to monitor. Provider = 1 URL slot, bundled sources free.
│
├─ Unknown domain, bare (e.g., myblog.com)?
│   └─ Monitor the homepage. Optionally probe common paths (/changelog, /docs, etc.)
│
├─ Specific URL path (e.g., api.example.com/v1/users)?
│   └─ Classify content type and monitor directly
│
└─ Invalid / private IP / SSRF blocked?
    └─ Reject with helpful error
```

### Provider Detection (Known Providers)

When user enters `stripe.com`, Chirri recognizes it from 15-20 hardcoded provider profiles (MVP) and offers:
- **OpenAPI Spec** — structural diff (primary source, counts as 1 URL slot)
- **Changelog** — keyword scanning for deprecations (bundled, free, checked every 2h)
- **Status Page** — JSON API monitoring (bundled, free, checked every 10min)
- **Primary SDK releases** — GitHub Atom feed (bundled, free, checked every 6h)

**Provider = 1 URL slot.** Multiple bundled sources are free. User can optionally add extended sources (additional SDK repos, npm/PyPI tracking) at 1 slot each.

> For complete per-provider source maps (Stripe, OpenAI, Twilio, GitHub, Shopify), see `CHIRRI_PROVIDER_MONITORING.md`.
> For the source tracking data model and cost analysis, see `CHIRRI_SOURCE_TRACKING_MODEL.md`.

### Unknown Domain → Lightweight Discovery

For domains not in the provider database, Chirri monitors the specific URL given. Future enhancement (V1.1): probe common paths like `/changelog`, `/docs`, `/openapi.json`, `/sitemap.xml` to discover monitorable resources.

### Auto-Classification (3 Phases)

**No existing monitoring tool does auto-classification.** Chirri figures out the optimal monitoring strategy automatically.

```
Phase 1: DOMAIN PATTERN MATCH → Known domains from JSON config (~30 patterns)
Phase 2: RESPONSE-BASED       → Content-Type header, parse body (JSON/RSS/HTML/XML)
Phase 3: FALLBACK              → JSON diff with learning period for everything else
```

**10 essential domain patterns ship with V1:** GitHub, npm, Stripe, OpenAI, Shopify, Twilio, AWS, Statuspage.io, PyPI, Docker Hub.

### Source Types & Monitoring Methods

| Source Type | Monitoring Method | False Positive Risk |
|------------|------------------|-------------------|
| RSS/Atom feeds | `feed-poll` — detect new items | Very low |
| OpenAPI specs | `spec-diff` — structural comparison | Very low |
| JSON API responses | `json-diff` — structural + value diffing | Medium (learning handles it) |
| Status pages (Statuspage.io) | `status-page` — JSON API component status | Very low |
| Headers only | `header-watch` — rate limits, deprecation, versions | Low |
| Everything else | `content-hash` — SHA-256 of response body | Medium |

### Learning Period

When a URL is added:

1. **Learning (10 minutes):** 30 rapid checks at 20-second intervals. Zero alerts. Volatile fields identified. Non-200 responses discarded (never become baselines).
2. **Calibrating (7 days, invisible to user):** Normal check interval, higher confidence threshold (95 vs 80). User sees "Active" status — calibration is internal only.
3. **Active (ongoing):** Full alerting at user-configured confidence threshold (default 80).

**Key safeguard:** If the API returns 429/bot-protection/errors during learning, those responses are discarded and retried. Error responses never become baselines.

### Checking Pipeline

```
Scheduler → SSRF validation → Domain rate limit → HTTP request →
Response processing (fingerprint, decompress, parse) →
Baseline comparison (fullHash → stableHash → schemaHash → headerHash) →
Change detection + severity scoring →
Confirmation recheck (5s delay) →
Notification dispatch → Result storage
```

**90% of checks end at baseline comparison** — fullHash matches, no further processing needed.

### Change Detection & Fingerprinting

Four fingerprints per response, checked in order:

| Fingerprint | What It Catches | Alert? |
|------------|----------------|--------|
| `fullHash` | Any change (including volatile) | Never alone |
| `stableHash` | Real content changes (volatile fields excluded) | Primary trigger |
| `schemaHash` | Structure/type changes only | High priority |
| `headerHash` | API metadata (rate limits, deprecation, CORS) | Secondary |

**Volatile field detection:** During learning, fields changing in >50% of checks are auto-marked volatile and excluded from `stableHash`. Numeric fields drifting <1% are also marked volatile.

### Source Alert Preferences

Users interact with Chirri through multiple surfaces with different defaults:

| Surface | Default Behavior | Rationale |
|---------|-----------------|-----------|
| **Dashboard** | Smart defaults pre-selected (recommended sources ON, niche OFF) | Don't overwhelm new users |
| **API** | Everything ON by default | Developers using the API are power users |
| **MCP** | Everything ON by default | AI agents need maximum signal |

Per-source controls include: toggle alerts on/off, set minimum severity threshold, route to specific notification channels, enable digest mode (daily/weekly).

> For the complete per-source preferences system (data model, API endpoints, UI wireframes), see `CHIRRI_SOURCE_PREFERENCES.md`.

### The Change Detail View (THE Money Screen)

When a user clicks through from an alert, they see:
- **Side-by-side diff** — left panel (before), right panel (after), scroll-synced
- **Auto-generated summary** — "Field `amount` removed from response object"
- **Actionable recommendations** — "Update your integration to handle missing `amount` field"
- **Severity badge** — 🔴 Breaking / 🟡 Notable / 🟢 Info
- **Feedback buttons** — ✅ Real | ❌ False Positive | 🤷 Not Sure

This is the screen that converts free users to paid. Responsive: falls back to unified diff on mobile.

**XSS Prevention (CRITICAL):** The diff viewer renders third-party API responses. All response data MUST be HTML-escaped via framework auto-escaping. Never use `dangerouslySetInnerHTML`. CSP headers as defense-in-depth.

### Notification Channels

| Channel | Availability | Implementation |
|---------|-------------|----------------|
| **Email** | All plans (MVP) | Via Resend |
| **Webhooks** | All plans (MVP) | HMAC-signed, per-webhook secrets, retry with backoff |
| **Slack** | Indie+ (MVP) | Incoming webhook URL |
| **Discord** | Indie+ (MVP) | Webhook URL (nearly identical to Slack) |
| **Telegram** | Indie+ (V2) | Bot token + chat ID |
| **PagerDuty** | Pro+ (V1.1) | Events API v2 |
| **Microsoft Teams** | Pro+ (V2) | Incoming webhook |

Every notification includes: what changed, severity, confidence score, link to diff view, one-click feedback buttons.

### Alert Taxonomy

| Icon | Level | Meaning | Example |
|------|-------|---------|---------|
| 🔮 | **Forecast** | Change is coming | Deprecation header detected, changelog announcement |
| ⏰ | **Deadline** | X days until sunset | Countdown from Sunset header date |
| 🔴 | **Breaking** | Something broke NOW | Schema change, 404, auth change |
| 🟡 | **Notable** | Changed, probably not breaking | New field added, response time shift |
| 🟢 | **Info** | FYI | New SDK version, status page update |

---

# PART 3: EARLY WARNING SYSTEM

## The Insight

APIs don't break overnight. There's always a trail of signals — deprecation headers, changelog posts, migration guides, version bumps. Chirri detects these signals and warns users BEFORE the break happens.

**Nobody else does this.** No monitoring tool asks "Is this API ABOUT TO break?"

## 8 Signal Types

### 1. Deprecation & Sunset HTTP Headers (MVP)

Parse `Sunset` (RFC 8594) and `Deprecation` (RFC 9745) headers from every probe response. Zero extra HTTP requests — it's free data.

- **Sunset:** `Sat, 31 Dec 2026 23:59:59 GMT` — hard deadline when endpoint stops working
- **Deprecation:** `@1688169599` (epoch) or `@1` (boolean true) — endpoint is deprecated
- Also check: `X-Deprecated`, `X-API-Warn`, and `Link` headers with `rel="deprecation"` or `rel="sunset"`

**Effort:** 4-8 hours. **Library:** `structured-headers` npm package for RFC 9651 parsing.

### 2. Changelog Keyword Scanning (MVP)

When a content change is detected on a changelog/blog URL, scan the ADDED text for deprecation keywords and extract dates.

**Strong signals:** "deprecated," "sunset," "breaking change," "will be removed," "migration required"
**Date extraction:** Use `chrono-node` npm package for natural language dates ("by June 1, 2026," "Q3 2026")

Only scans NEW content (paragraph-level diff against previous version). Minimum confidence threshold of 50 before creating a forecast.

### 3. API Version Header Tracking (MVP)

Track version-related headers (`Stripe-Version`, `X-API-Version`, `anthropic-version`, etc.) and alert when they change. Zero extra requests.

### 4. OpenAPI Spec Diffing (V1.1)

Diff successive versions of OpenAPI specs to detect newly deprecated endpoints, removed fields, new required parameters. Use `openapi-diff` npm package.

### 5. SDK/Package Version Monitoring (V1.1)

Poll npm (`registry.npmjs.org/{pkg}`) and PyPI (`pypi.org/pypi/{pkg}/json`) registries. Alert on major version bumps. Parse CHANGELOG.md for breaking change descriptions.

### 6. GitHub Release Signals (MVP)

Monitor GitHub Atom feeds (`/{owner}/{repo}/releases.atom`) — public, no auth needed. Scan release body text for breaking change keywords.

### 7. Migration Guide Detection (V1.1)

Monitor known migration guide URLs. When a page goes from 404→200, that's a strong signal a breaking change is imminent.

### 8. Status Page Maintenance (V1.1)

Check Statuspage.io scheduled maintenances API for entries mentioning breaking changes or deprecation keywords.

## Reminder/Countdown System

Forecasts with deadlines trigger escalating reminders at: 90, 60, 30, 14, 7, 3, 1, and 0 days out.

**Implementation:** Daily cron job queries `forecasts` table for upcoming deadlines. Database polling (not BullMQ delayed jobs) because deadline dates can change — easier to recalculate than cancel/reschedule jobs.

## Database Tables

| Table | Purpose |
|-------|---------|
| `forecasts` | All early warning signals with deadline, severity, dedup key, status |
| `user_forecasts` | Per-user view (acknowledgment, reminder tracking, mute state) |
| `header_snapshots` | Response headers per check (pre-parsed sunset/deprecation/version data) |
| `package_versions` | SDK/package version tracking across registries |
| `spec_snapshots` | OpenAPI spec versions for diffing |

> For complete implementation details (SQL schemas, parsing code, edge cases, test fixtures), see `CHIRRI_EARLY_WARNING_IMPLEMENTATION.md`.

---

# PART 4: PRICING & BUSINESS

## Pricing Table

| Plan | Price | URLs | Min Interval | History | Webhooks | Key Features |
|------|-------|------|-------------|---------|----------|-------------|
| **Free** | $0/mo | 3 URLs | Daily (24h) | 7 days | 1 | Email alerts, basic dashboard, uptime %, TTFB |
| **Indie** | $9/mo | 20 URLs | 1 hour | 30 days | 3 | Slack/Discord/webhook alerts, schema diff, API access, header alerts |
| **Pro** | $29/mo (V1.1) | 100 URLs | 5 min | 90 days | 10 | All channels, teams (3 seats), priority support |
| **Business** | $79/mo (V1.1) | 500 URLs | 1 min | 1 year | Unlimited | SSO, SLA, 10 seats, all features |

**MVP launches with Free + Indie only.** Pro and Business added when demand warrants.

**Annual discount:** 20% off (2 months free). Push after 2+ months of active usage.

### Why $9

- Below the "ask permission" threshold — developer puts it on a personal card
- Matches Postman Solo at $9/user/mo — validated price point
- 16.5x cheaper than API Drift Alert ($149/mo) which died at that price
- "Insurance you forget about" — too cheap to bother canceling
- Launch at $9. Raise to $14 after 6 months if conversion data supports it.

### Provider = 1 Slot Model

A provider (e.g., "Stripe") uses 1 URL slot. The primary source (OpenAPI spec) counts toward quota. Bundled sources (changelog, status page, SDK releases) are free, checked at system-controlled intervals optimized for their change frequency.

**Corrected Per-Provider Cost Math:**

| Scale | Cost/Provider/Month | Why |
|-------|-------------------|-----|
| 10 providers | **~$4.20** | Fixed infra ($42/mo) dominates |
| 50 providers | **~$0.84** | Fixed costs amortizing |
| 500 providers | **~$0.08** | Approaching marginal cost |

Don't quote per-provider costs until scale justifies it. Lead with flat pricing.

### Source Preferences by Plan

| Feature | Free | Indie | Pro | Business |
|---------|------|-------|-----|----------|
| Per-source alert toggling | ✅ | ✅ | ✅ | ✅ |
| Per-source severity threshold | ❌ | ✅ | ✅ | ✅ |
| Per-source channel routing | ❌ | ❌ | ✅ | ✅ |
| Digest mode (daily/weekly) | ❌ | ✅ | ✅ | ✅ |

## Revenue Projections

| Month | Free Users | Paid Users | MRR |
|-------|-----------|------------|-----|
| 1 | 200 | 5 | $45 |
| 6 | 2,000 | 50 | $450 |
| 12 | 5,000 | 125 | $1,125-$5,000 |

**Realistic Year 1 ARR: $25-50K.** Break-even at ~6 Indie customers ($54/mo > $42/mo infrastructure).

**Target:** $5K MRR at 12 months. $10K MRR at 18-24 months. This is a profitable indie product that compounds, not a VC moonshot.

## Market Size

| Metric | Number | Source |
|--------|--------|--------|
| Professional developers worldwide | ~20.8M | JetBrains DevEcosystem 2025 |
| Developers using third-party APIs | ~12.8M (69%) | Nordic APIs |
| **TAM** (API monitoring sub-market) | **$500M–$1.3B** | Derived from market reports |
| API Management Market | $8.86B→$19.28B (2025→2030) | Mordor Intelligence |

## Competitors

| Competitor | Status | Threat |
|-----------|--------|--------|
| **APIShift** (apishift.site) | Active — real-time schema monitoring, free plan | 🔴 **HIGH** — nearly identical positioning |
| **Postman** | Acquired Akita (API diffing) in 2023 | 🔴 **Existential** — has developer trust + could ship this as a feature |
| **changedetection.io** | Active, 22K+ GitHub stars | 🟡 Medium — generic, not API-schema-aware |
| **API Drift Alert** | Zombie — $149-749/mo, no visible community | ⚠️ Low — validates market gap |

**Our moat:** Historical baseline data (compounds daily, impossible to replicate), auto-classification (no competitor does this), aggregate intelligence (cross-customer detection), provider intelligence (APIs.guru 14K+ seed data), and the brand (becoming "the source of truth" for API changes).

---

# PART 5: TECHNICAL ARCHITECTURE

## System Diagram

Three Railway services from day 1 — non-negotiable for reliability:

```
                    ┌─────────────────────────────────────┐
                    │  SERVICE 1: API SERVER (Hono/Fastify)│
                    │  • REST API (/v1/*)                  │
                    │  • Dashboard (Next.js/SvelteKit)     │
                    │  • Auth (JWT in HttpOnly cookie)     │
                    │  • Rate limiting (Redis)             │
                    │  • Stripe webhook receiver           │
                    └──────────┬───────────┬──────────────┘
                          reads/writes   publishes
                               │           │
                    ┌──────────▼───┐  ┌───▼──────────────┐
                    │  PostgreSQL  │  │     Redis         │
                    │  (managed)   │  │   (managed)       │
                    │  11+ tables  │  │  4 BullMQ queues  │
                    └──────▲───▲──┘  └──▲────────▲───────┘
                           │   │        │        │
                    ┌──────┴───┴────────┴──┐  ┌─┴───────────────┐
                    │  SERVICE 2: SCHEDULER │  │ SERVICE 3:       │
                    │  • Clock-aligned cron │  │ CHECK WORKERS    │
                    │  • BullMQ producer    │  │ (2 instances)    │
                    │  • Missed-check scan  │  │ • BullMQ consumer│
                    └──────────────────────┘  │ • SSRF validation│
                                              │ • HTTP fetcher   │
                                              │ • JSON diffing   │
                                              │ • Notifications  │
                                              └─────────┬────────┘
                                                        │ writes
                                                        ▼
                                                 ┌──────────────┐
                                                 │ Cloudflare R2│
                                                 │ (snapshots)  │
                                                 └──────────────┘
```

## Database Schema (11 Core Tables + 5 Early Warning Tables)

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Accounts + Stripe billing |
| `api_keys` | SHA-256 hashed API keys (key shown once, never stored) |
| `urls` | Monitored endpoints per user (status machine: learning→calibrating→active→paused/error) |
| `shared_urls` | Deduplication — one fetch per unique URL at highest frequency |
| `baselines` | Current known state per shared URL (4 fingerprint hashes) |
| `check_results` | Check history (**partitioned by month** via native Postgres range partitioning) |
| `changes` | Detected changes with full diff data, confirmation status |
| `user_changes` | Per-user view (feedback, acknowledgment, notification tracking) |
| `webhooks` | User-configured webhook endpoints with per-webhook signing secrets |
| `webhook_deliveries` | Delivery log (30-day retention) |
| `notifications` | Log of all notifications sent across all channels |

### Early Warning Tables

`forecasts`, `user_forecasts`, `header_snapshots`, `package_versions`, `spec_snapshots`

> For complete SQL CREATE TABLE statements with all columns, indexes, and constraints, see `CHIRRI_ARCHITECTURE.md` §2.

## Queue Architecture (4 BullMQ Queues)

| Queue | Concurrency/Worker | Purpose |
|-------|-------------------|---------|
| `url-checks` | 10 | Main check pipeline |
| `learning-checks` | 5 | Rapid 20s checks during learning |
| `confirmation-checks` | 5 | 5s recheck after change detection |
| `notifications` | 20 | Webhook/email/Slack delivery with retries |

**Redis configuration (CRITICAL):**
- `maxmemory-policy: noeviction` — BullMQ breaks with any eviction policy
- Job retention: `removeOnComplete: { age: 3600, count: 100 }`, `removeOnFail: { age: 86400, count: 500 }`
- Monitor Redis memory: alert at 70%, emergency purge at 90%

## Worker Pipeline

The check worker processes each job through 11 steps:

1. **Schedule** — clock-aligned, 0-10% jitter, `FOR UPDATE SKIP LOCKED`
2. **Pick up job** — BullMQ consumer dequeues
3. **SSRF validation** — `safeFetch()` module (see Security section)
4. **Domain rate limit** — Redis token bucket, 1 req/sec/domain; circuit breaker if >50% failures
5. **HTTP request** — undici with DNS pinning, manual redirect following, 5MB body limit
6. **Response processing** — decompress (gzip/brotli), parse, compute 4 fingerprints, store headers
7. **Baseline comparison** — fast-path: fullHash match → skip (90% of checks end here)
8. **Change detection** — jsondiffpatch with tiered strategy, severity scoring, summary generation
9. **Confirmation recheck** — 5s delay, compare against both baseline and detected change
10. **Notification dispatch** — per-user routing based on severity threshold and channel preferences
11. **Result storage** — write to Postgres (conditional: only write when something interesting happens to reduce IOPS)

> For the complete pipeline flowchart with every decision branch, see `CHIRRI_ARCHITECTURE.md` §5.

## Auto-Classifier (3 Phases)

Already covered in Part 2. Key detail: the fallback (json-diff with learning period) handles most URLs well. Don't over-engineer classification — log results and improve post-launch based on real user URLs.

**Quality tracking:** Track FP rate per URL type and monitoring method. If quality drops below 50 → try alternative method. User feedback loop: ✅ real / ❌ false positive / 🔔 missed.

## Diff Engine

**Library:** jsondiffpatch (5.5K+ GitHub stars, fastest in benchmarks)

**Tiered strategy:**
1. **Fast path (90%):** fullHash match → skip entirely
2. **Normal (<100KB):** Full jsondiffpatch with array ID matching
3. **Large (>100KB or arrays >100):** Disable LCS, use `objectHash` for ID-based matching, 500ms timeout
4. **Huge (>1MB):** Hash-only comparison, no structural diff

**Array handling:** Sort primitive arrays before diffing. For object arrays, use `id`/`_id`/`name` for identity. Max recursion depth of 20 — hash subtrees beyond that.

**Prototype pollution prevention:** Sanitize all external JSON — filter `__proto__`, `constructor`, `prototype` keys. Use `Object.create(null)`.

## SSRF Prevention

**`safeFetch()` is the single most important piece of code in the entire product.**

Complete implementation:
1. Parse URL, extract hostname
2. Block dangerous hostnames: `*.railway.internal`, `*.internal`, `*.local`, `localhost`, `metadata.google.internal`, `*.chirri.io`
3. Block non-HTTP protocols (`file://`, `ftp://`, `data://`, etc.)
4. Strip and reject `user:pass@` from URLs
5. DNS resolve using pinned lookup (resolve once, connect to that IP — prevents DNS rebinding)
6. Check ALL resolved IPs against blocklist using `ipaddr.js`:
   - Private: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - Loopback: `127.0.0.0/8`, `::1`
   - Link-local: `169.254.0.0/16`, `fe80::/10`
   - Cloud metadata: `169.254.169.254`
   - Carrier-grade NAT / Tailscale: `100.64.0.0/10`
   - IPv6 ULA: `fd00::/8`
   - IPv4-mapped IPv6: `::ffff:0:0/96`
   - `ipaddr.js` handles octal (`0177.0.0.1`), hex (`0x7f000001`), decimal (`2130706433`) bypasses
7. Make HTTP request connecting to the PINNED IP (not re-resolving DNS)
8. Follow redirects MANUALLY — re-validate resolved IP at each hop (max 5)
9. Abort if response body > 5MB

> For the complete SSRF blocklist with every CIDR, every bypass technique, and test cases, see `CHIRRI_SECURITY_PENTEST.md` §1.

## Five-Layer False Positive Cascade Defense

**This is the #1 engineering priority.** False positives kill trust instantly.

| Layer | Name | How It Works | When |
|-------|------|-------------|------|
| **0** | Learning Period | Volatile field detection before first alert | MVP |
| **1** | Confirmation Recheck | 5s recheck; 30min delayed recheck for non-critical (V1.1) | MVP |
| **2** | Cross-User Correlation | If only one user's check sees it → likely CDN edge issue | V1.1 |
| **3** | Notification Rate Limiting | Max N alerts per provider per hour | MVP |
| **4** | Canary Check | If >50% of ALL checks detect changes → something wrong with US | V1.1 |
| **5** | Human Review Queue | First-time patterns get delayed notification | V1.1 |

**Additional safeguards:**
- 429/bot-protection responses NEVER become baselines or trigger change alerts
- Detect Cloudflare challenge pages, soft errors (200 with error body)
- Debug mode per URL: full pipeline logging for investigating FP reports

## Infrastructure ($42/mo)

| Component | Cost |
|-----------|------|
| API Server (Railway) | ~$7 |
| Scheduler (Railway) | ~$7 |
| Check Workers ×2 (Railway) | ~$14 |
| PostgreSQL (Railway managed) | ~$7 |
| Redis (Railway managed) | ~$3 |
| Cloudflare R2 | ~$1 |
| Email (Resend) | ~$3 |
| **Total** | **~$42/mo** |

### Railway Requirements

| Setting | Value | Why |
|---------|-------|-----|
| `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `30` | Default is 0 — workers get SIGKILL'd mid-job. Set to 30 for graceful shutdown. |
| Static outbound IP | **Enabled** | Settings → Networking. Required for provider IP whitelisting. |
| Redis `maxmemory-policy` | `noeviction` | BullMQ breaks with eviction policies. `noeviction` fails loudly. |

**R2 writes are async and non-blocking** with a circuit breaker (5s timeout, opens at 50% failure rate). If R2 is down, checks continue — snapshots queue for later. Small responses (<10KB) stored directly in Postgres.

---

# PART 6: API REFERENCE

## Global Conventions

- **Base URL:** `https://api.chirri.io/v1`
- **Auth:** `Authorization: Bearer dk_live_abc123...` (API key) or JWT in HttpOnly cookie (dashboard)
- **Content-Type:** `application/json` for all request/response bodies
- **Dates:** ISO 8601 UTC (`2026-03-23T14:32:00Z`)
- **Pagination:** Cursor-based — `{ data: [...], has_more: bool, next_cursor: string }`
- **Rate limit headers on every response:** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### ID Prefixes

| Entity | Prefix | Entity | Prefix |
|--------|--------|--------|--------|
| User | `usr_` | Webhook | `wh_` |
| URL | `url_` | Integration | `int_` |
| Change | `chg_` | API Key | `key_` |
| Snapshot | `snap_` | Delivery | `del_` |
| Event | `evt_` | Pack | `pack_` |
| Forecast | `frc_` | Source Alert Pref | `sap_` |

### Error Format

```json
{
  "error": {
    "code": "url_limit_exceeded",
    "message": "Your Indie plan allows 20 URLs. You currently have 20 active.",
    "status": 402,
    "doc_url": "https://docs.chirri.io/errors#url_limit_exceeded",
    "suggestion": "Remove an existing URL or upgrade your plan."
  }
}
```

### Rate Limits by Plan

| Plan | Requests/Minute | Requests/Hour |
|------|----------------|---------------|
| Free | 60 | 1,000 |
| Indie | 120 | 5,000 |
| Pro | 300 | 20,000 |
| Business | 600 | 50,000 |
| Unauthenticated (login/signup) | 20/IP | — |

## Endpoint Summary (27 core + forecast + provider endpoints)

### Auth (4 endpoints)
`POST /v1/auth/signup` · `POST /v1/auth/login` · `POST /v1/auth/refresh` · `POST /v1/auth/revoke`

### API Keys (3 endpoints)
`POST /v1/api-keys` · `GET /v1/api-keys` · `DELETE /v1/api-keys/:id`

### URLs (5 endpoints)
`POST /v1/urls` · `GET /v1/urls` · `GET /v1/urls/:id` · `PATCH /v1/urls/:id` · `DELETE /v1/urls/:id`

Plus: `POST /v1/urls/:id/check` (manual check trigger), `GET /v1/urls/:id/sources` (list sources)

### Changes (4 endpoints)
`GET /v1/changes` · `GET /v1/changes/:id` · `POST /v1/changes/:id/acknowledge` · `POST /v1/changes/:id/feedback`

### Webhooks (5 endpoints)
`POST /v1/webhooks` · `GET /v1/webhooks` · `PATCH /v1/webhooks/:id` · `DELETE /v1/webhooks/:id` · `POST /v1/webhooks/:id/test`

### Account (3 endpoints)
`GET /v1/account` · `GET /v1/account/usage` · `GET /v1/account/export`

### Health & Internal (3 endpoints)
`GET /health` · `GET /internal/metrics` · `GET /v1/openapi.json`

### One-Click Feedback
`POST /v1/feedback/:token` — public endpoint, no auth, HMAC-signed token from email notifications

### Webhook Event Catalog

| Event | Trigger |
|-------|---------|
| `change.detected` | Change found (before confirmation) |
| `change.confirmed` | Change confirmed after recheck (main alerting event) |
| `url.error` | URL enters error state (24h+ failures) |
| `url.recovered` | Degraded/errored URL responds successfully |
| `url.baseline_ready` | Learning complete |
| `account.usage_alert` | Approaching plan limits |
| `forecast.new` | Early warning signal detected |
| `forecast.deadline` | Countdown reminder |

**Webhook security:** Per-webhook signing secrets, timestamp in signature (`t={ts},v1={hmac}`), reject signatures >5 minutes old. Re-validate webhook destination IP at DELIVERY time (prevents DNS rebinding).

> For complete API response shapes for every endpoint, every status code, every edge case, see `CHIRRI_URL_ONBOARDING_FLOW.md`.
> For the complete error code registry (30+ codes), see `CHIRRI_URL_ONBOARDING_FLOW.md` §18.

---

# PART 7: SECURITY

## Security Posture Summary

Chirri is inherently a URL-fetching service — sanctioned SSRF-as-a-Service. A comprehensive threat model identified **34 distinct attack vectors**: 8 critical, 13 high, 10 medium, 3 low. All critical and high findings are addressed.

## 9 Launch Blocker Security Requirements

These MUST be implemented before any user touches the product:

### 1. SSRF Comprehensive Module (`safeFetch()`)
DNS pinning, IP blocklist via `ipaddr.js`, hostname blocklist (incl. `.railway.internal`), manual redirect following with re-validation, 5MB body limit, `user:pass@` rejection. *See Part 5 for full spec.*

### 2. Cross-Tenant Isolation
Shared URL key = `SHA-256(url + method + sorted_lowercase_headers)`. Users with different custom headers = different monitors. Baselines strictly per-user for diff comparison.

### 3. XSS Prevention
CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:`. Framework auto-escaping for ALL external data in diff viewer. Never `dangerouslySetInnerHTML`.

### 4. DDoS/Abuse Prevention
- Per-domain outbound rate: 1 req/sec (Redis token bucket)
- Per-account per-domain URL limit: 5
- Global domain cap: 60 req/hour
- Email verification before checks begin
- New account velocity: max 5 URLs in first 24 hours
- Cache-buster detection: normalize URLs before dedup

### 5. API Key Security
Generate with `crypto.randomBytes(32)`. Store SHA-256 hash only. Show key once. `timingSafeEqual` for hash comparison. Reject API keys in query parameters with helpful error.

### 6. Rate Limiting
Sliding window in Redis. Per-API-key by plan. Per-IP for unauthenticated (20/min login/signup).

### 7. Input Validation
Zod schemas on all request bodies. URL: http/https only, max 2048 chars. Custom headers: max 10, 1KB each, no CRLF characters, no Host/Transfer-Encoding override.

### 8. Credential Protection
Strip `user:pass@` from URLs. Encrypted custom header storage. Never log full API keys.

### 9. Self-Referential Blocking + Test Mode
Block `*.chirri.io`. `dk_test_` keys return mock data only — no real outbound requests.

## Quick-Fix Post-Launch Security (Weeks 9-10)

| Item | Fix |
|------|-----|
| URL parser differentials | Sanitize: strip non-ASCII, canonical form, verify round-trip |
| Snapshot IDOR | UUIDs + ownership check on every resource. Return 404 not 403. |
| CRLF header injection | Reject `\r\n\x00` in custom header names/values |
| Webhook URL SSRF | Same `safeFetch()` checks at delivery time |
| Prototype pollution | Filter `__proto__`, `constructor`, `prototype` from external JSON |
| CSRF on dashboard | SameSite=Strict cookies + CSRF token + Origin/Referer check |
| JWT storage | HttpOnly cookie, NOT localStorage |
| Redis auth | Verify Railway Redis requires auth; use TLS |
| Plan limit race condition | `SELECT ... FOR UPDATE` in transaction |
| Account enumeration | Same error message for valid/invalid emails |

## Automated SSRF Bypass Test Suite

18 test cases covering every bypass technique. Runs on every deploy — if any test passes (SSRF not blocked), deploy fails.

| Test | Input | Expected |
|------|-------|----------|
| Loopback | `http://127.0.0.1/` | BLOCKED |
| Octal | `http://0177.0.0.1/` | BLOCKED |
| Hex | `http://0x7f000001/` | BLOCKED |
| Decimal | `http://2130706433/` | BLOCKED |
| IPv4-mapped IPv6 | `http://[::ffff:127.0.0.1]/` | BLOCKED |
| Railway internal | `http://api.railway.internal:3000/` | BLOCKED |
| Cloud metadata | `http://169.254.169.254/` | BLOCKED |
| Self-referential | `http://api.chirri.io/` | BLOCKED |
| Userinfo | `http://user:pass@example.com/` | REJECTED |
| *(+ 9 more)* | | |

> For all 34 attack vectors with detailed exploitation steps and mitigations, see `CHIRRI_SECURITY_PENTEST.md`.

---

# PART 8: LAUNCH PLAN

## Timeline (8 Weeks)

| Week | Focus | Key Deliverable |
|------|-------|----------------|
| **1** | Foundation | Railway 3 services, DB schema (11 tables, native partitioning), auth, API skeleton, rate limiting, pino logging |
| **2** | Check Engine + Security | `safeFetch()` (18/18 SSRF tests passing), BullMQ queues, check worker, JSON diff engine, learning period, shared monitoring, TTFB capture, decompression (brotli/gzip) |
| **3** | Detection + Notifications | Full detection pipeline, header tracking, confirmation recheck, CRUD API, webhook delivery (HMAC), email + Slack + Discord, weekly stability report, input validation, OpenAPI spec |
| **4** | **Dashboard — DEMO DAY** 🎯 | Full UI: auth, URL management, **Change Detail View** (side-by-side diff), change feed, URL detail (TTFB graph, uptime %), provider intelligence (15-20 profiles), "Check Now" button, "What's New" changelog |
| **5** | Billing + Landing + Content | Stripe Checkout (Free + Indie), landing page (sakura pink), 15 programmatic SEO pages, legal (Termly), security hardening, Scalar docs, start monitoring 50 popular APIs |
| **6** | Testing + Beta | Unit tests (diff engine, SSRF, classification), integration tests, mock API server, 15+ beta users |
| **7** | Beta + Hardening | 10-20 beta users on real URLs, k6 load test, **48-hour zero-false-positive validation on 50+ URLs**, quick-fix security items |
| **8** | **🚀 LAUNCH** | Show HN → Product Hunt → Reddit → Dev.to. Monitor 48 hours. |

### Demo Day (Week 4) Exit Criteria

**Full flow works:** Type "Stripe" → see all monitorable sources → add them → detect change → see side-by-side diff in dashboard → get Slack notification → mark as reviewed.

## MVP Feature List (Exact)

**IN:**
- URL monitoring with JSON structural diffing (jsondiffpatch)
- Silent learning period (10min) + invisible 7-day calibration
- Auto-classification (3 phases, 10 domain patterns)
- Multi-layer fingerprinting (4 hashes)
- Confirmation recheck (5s)
- Clock-aligned scheduling + shared monitoring
- TTFB, uptime %, response size, header change tracking
- Deprecation header detection (Sunset RFC 8594, Deprecation RFC 9745)
- Email + Webhook + Slack + Discord notifications
- Weekly stability report email
- Dashboard with Change Detail View (side-by-side diff)
- Provider Intelligence (15-20 hardcoded profiles, "Monitor Stripe" flow)
- Free + Indie billing via Stripe
- 27 API endpoints + OpenAPI spec + Scalar docs
- All 9 security launch blockers
- Debug mode per URL

**OUT (V1.1, Weeks 9-12):**
SSL cert monitoring, RSS/Atom feed monitoring, OpenAPI import, GitHub Action, CLI, MCP server, Pro/Business tiers, PagerDuty, 30-min delayed recheck, tag filtering, dynamic provider discovery (APIs.guru)

**OUT (V2, Months 3-6):**
OpenAPI spec diffing, GraphQL introspection, SLA monitoring, multi-region checking, public changelog pages, @ChirriChangelog automated Twitter, team features, AI-powered summaries

## Launch Sequence

### Pre-Launch (Weeks 1-7)

| Week | Action |
|------|--------|
| 1 | Twitter @ChirriChangelog created. GitHub org created. npm `chirri` reserved. |
| 2 | Start manually monitoring 20 APIs. Tweet detected changes. |
| 3 | Publish `awesome-api-changelogs` GitHub repo. |
| 4 | Identify 20 beta users (AI agent devs, indie SaaS, Shopify devs, DevOps). |
| 5 | Contact betas. Blog posts 1+2 drafted. Show HN post drafted. |
| 6 | Beta users onboarded. Collect testimonials. |
| 7 | Beta feedback incorporated. Show HN finalized. |

### Launch Week (Week 8)

| Day | Action | Target |
|-----|--------|--------|
| Monday | **Show HN** — link to GitHub, answer 50+ comments fast | 50-200 signups |
| Tuesday | **Product Hunt** + **Reddit** (r/programming, r/webdev, r/node) | 50-100 + 30-80 |
| Wednesday | **Dev.to / Hashnode** technical article | 20-40 signups |
| Thursday | **Indie Hackers** | 10-20 signups |
| Friday | "UptimeRobot Alternative" blog post — SEO seed | Long-term |

## Marketing Strategy Summary

### Content-Product Flywheel

```
Chirri monitors APIs → Detects changes → Auto-generates changelog pages (SEO)
  → Auto-tweets changes (@ChirriChangelog) → Feeds newsletter
  → Powers "API Changes This Week" blog → Attracts developers
  → Signups → More monitoring → More data → Better content → (loop)
```

### @ChirriChangelog Twitter
Automated account tweeting every significant API change detected. Utility account, not personality account. Tags affected provider accounts. Zero marginal cost per tweet.

### Programmatic SEO
- **`chirri.io/monitor/{provider}`** — 15 at launch, scale to 500+. Auto-populated with monitoring data.
- **`chirri.io/changelog/{provider}`** — free public changelog aggregation. Developers search for "{provider} API changelog" — we own these pages.

### Open-Source Distribution (V1.1)
- **`chirri-cli`** — `npx chirri check https://api.stripe.com/v1/prices`. Top of funnel.
- **GitHub Action** — `chirri/api-change-check`. Every repo using it = distribution node.
- **MCP Server** — AI agents query Chirri for API change status. Non-negotiable for the AI agent segment.

### UptimeRobot Migration Capture
UptimeRobot's 425% price hike is creating a migration wave. Tactical: blog post, landing page (`chirri.io/uptimerobot`), Reddit presence. Position: "Free uptime monitoring for 3 URLs, plus API change detection UptimeRobot doesn't have."

### First 5 Blog Posts
1. "The Hidden Cost of Third-Party API Changes" — pain validation, launch week
2. "How We Built an API Change Detection System" — HN bait
3. "How to Detect Breaking Changes in the Stripe API" — provider SEO
4. "Monitor OpenAI API Changes with Chirri (5-Min Setup)" — tutorial
5. "UptimeRobot Monitors Uptime. Here's What It Doesn't Monitor." — migration wave

## Kill Criteria

| Signal | Threshold | Action |
|--------|-----------|--------|
| Zero paying customers | 60 days post-launch | Reassess or kill |
| <10 free signups in first week | Launch week | Re-launch on different channel |
| False positive rate >5% | Any time | Halt new signups, fix engine |
| <$1K MRR at Month 6 | Month 6 | Serious pivot/wind-down conversation |
| Postman ships identical feature | Any time | Evaluate indie niche viability |

---

# PART 9: KNOWN RISKS & MITIGATIONS

## Top 10 Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | **False positive cascade on popular APIs** | Possible | Catastrophic | Five-layer cascade defense. 429/bot-protection never becomes baseline. Canary check pauses all notifications if >50% of checks detect changes. |
| 2 | **Postman ships this as a feature** | Possible | Existential | Speed to market. Data moat. Position as "indie dev" focused alternative. |
| 3 | **"Nothing happened" churn** | Certain | Major | Weekly stability reports. TTFB/uptime tracking makes dashboard feel alive. $9 is too cheap to bother canceling. |
| 4 | **IP blocking by target APIs** | Likely | Major | Railway static IPs. Transparent User-Agent. Proactive provider outreach. Detect rate-limit responses. Circuit breaker per domain. |
| 5 | **jsondiffpatch performance on large responses** | Likely | Major | Tiered strategy: 500ms timeout, >1MB falls to hash-only. Benchmark with 200+ real responses pre-launch. |
| 6 | **Redis OOM kills all monitoring** | Possible | Catastrophic | `noeviction` policy. Aggressive job retention. Memory monitoring with alerts at 70%. Design for Redis ephemerality — all critical state in Postgres. |
| 7 | **APIShift outcompetes on features** | Possible | Major | Outrank on SEO with better content. Out-feature with auto-classification, TTFB/uptime/headers. |
| 8 | **Learning period misses real changes** | Possible | Major | Track intra-learning variance. Flag significant schema changes during learning. Never use error responses as baselines. |
| 9 | **Free tier abuse (Sybil attack)** | Possible at scale | Minor | Email verification. Don't over-engineer pre-launch. Progressive friction when abuse detected. |
| 10 | **API ToS violations** | Possible | Major | Focus on public endpoints. Respectful rate limiting. chirri.io/bot info page. Domain exclusion list. Budget $1-2K for legal review. |

## Compound Failure Scenarios

**CF-01: Launch Day DDoS + False Positive Cascade**
500 users add Stripe → shared monitoring means only 1 check per unique URL → global domain cap (60/hour) prevents hammering → 429 responses discarded from baselines → no false positives.

**CF-02: Redis OOM + Worker Crash + Scheduler Orphan**
Handle BullMQ enqueue failures gracefully. Scheduler uses `FOR UPDATE SKIP LOCKED` for idempotency. Workers check for recent results before processing (dedup guard).

**CF-03: R2 Outage + Large Response**
R2 writes are async with circuit breaker. If R2 is down, checks continue with hash-only comparison. Snapshots queue for later upload.

> For all 31 unknown unknowns and their concrete solutions (with code patterns), see `CHIRRI_UNKNOWN_SOLUTIONS.md`.

## Operational Requirements

| Requirement | Solution |
|-------------|----------|
| On-call | BetterStack free tier → PagerDuty → phone call (founder is sole on-call) |
| Status page | Instatus free tier |
| Runbook | `RUNBOOK.md` with diagnosis steps and common fixes |
| Graceful shutdown | Handle SIGTERM, stop accepting jobs, wait 30s max, flush logs, exit |
| Missed-check recovery | On startup: scan for URLs where `last_check_at < now - 2×interval`, run catch-up |
| Backup/restore | Daily pg_dump to R2 at 03:00 UTC. Test restore in Week 6. Target RTO: 2 hours. |
| Deploy strategy | Workers first (rolling), then scheduler, then API server. Never all simultaneously. Prefer 05:00-07:00 UTC. |
| GDPR deletion | `deleteUserData(userId)` function covering all 11+ tables + R2 snapshots. Test before launch. |

---

# APPENDIX A: KEY DECISIONS

All 23 canonical decisions, dated:

| # | Decision | Date |
|---|----------|------|
| 1 | **Name:** Chirri (chirri.io) — Japanese for cricket chirp | 2026-03-23 |
| 2 | **Tagline:** "APIs change. We'll let you know." | 2026-03-23 |
| 3 | **Pricing:** Flat monthly tiers — Free $0, Indie $9, Pro $29 (V1.1), Business $79 (V1.1) | 2026-03-23 |
| 4 | **Free tier:** 3 URLs forever, 24h checks, email alerts, no CC | 2026-03-23 |
| 5 | **MVP launches with Free + Indie only.** Pro/Business added when demand warrants. | 2026-03-23 |
| 6 | **Silent learning period:** 20s rapid checks for 10min → 7-day calibration (invisible) → active | 2026-03-23 |
| 7 | **Shared monitoring:** One request per unique URL at highest frequency. Key includes headers hash. | 2026-03-23 |
| 8 | **Confirmation recheck:** 5s immediate (MVP). 30min delayed for non-critical (V1.1). | 2026-03-23 |
| 9 | **API-first:** Dashboard is just another API client (Stripe model). Show API requests. | 2026-03-23 |
| 10 | **Infrastructure:** Railway, 3 services, ~$42/mo. Not Lambda/serverless. | 2026-03-23 |
| 11 | **Architecture:** 11 core tables + 5 early warning, 27+ endpoints, 4 queues, 3-phase classification | 2026-03-23 |
| 12 | **MVP features:** Core detection + TTFB + uptime + headers + deprecation headers + provider intelligence | 2026-03-24 |
| 13 | **Security:** 9 launch blockers + 11 quick-fix post-launch. 18-case SSRF test suite on every deploy. | 2026-03-23 |
| 14 | **Launch:** HN first, PH second. No waitlist. Pre-launch monitoring of 50 APIs. | 2026-03-23 |
| 15 | **Growth:** Open-source CLI + GitHub Action, programmatic SEO, @ChirriChangelog, UptimeRobot migration | 2026-03-23 |
| 16 | **Brand:** Sakura pink + white, Japanese zen, calm/precise/warm voice, dark mode default | 2026-03-23 |
| 17 | **MCP server:** Non-negotiable for V1.1. AI agent market demands it. | 2026-03-23 |
| 18 | **Timeline:** 8 weeks to launch, Demo Day at Week 4 | 2026-03-23 |
| 19 | **UX metaphor:** "Plant a Seed" — not generic "Start monitoring" | 2026-03-24 |
| 20 | **Track anything:** Chirri monitors ANY URL. Provider intelligence enhances but is never required. | 2026-03-24 |
| 21 | **False positive defense:** Five-layer cascade. #1 engineering priority. | 2026-03-24 |
| 22 | **Secondary tagline:** "Weather forecast for your API dependencies" | 2026-03-24 |
| 23 | **Railway ops:** `DRAINING_SECONDS=30`, static outbound IP, Redis `noeviction` | 2026-03-24 |

---

# APPENDIX B: RESEARCH REFERENCES

| Document | Contains | Role |
|----------|---------|------|
| `CHIRRI_ARCHITECTURE.md` | Full DB schema (SQL), 27+ endpoint specs, queue configs, worker pipeline code, deployment TOML, graceful shutdown code, Redis key patterns | **Implementation companion** — build from this |
| `CHIRRI_URL_ONBOARDING_FLOW.md` | Every API endpoint with full request/response shapes, every HTTP status code, every error message, URL onboarding state machine, webhook event catalog, error code registry | **API contract** — every edge case documented |
| `CHIRRI_EARLY_WARNING_SYSTEM.md` | 8 signal types research, detection methods, keyword lists, alert taxonomy, competitive analysis of early warning space | **Early warning research** |
| `CHIRRI_EARLY_WARNING_IMPLEMENTATION.md` | Implementation-ready code for all early warning signals, database migrations, parsing functions, pipeline integration points, test fixtures | **Early warning implementation** |
| `CHIRRI_SECURITY_PENTEST.md` | 34 attack vectors (8 critical, 13 high, 10 medium, 3 low), exploitation steps, mitigations, compound attack chains | **Security reference** |
| `CHIRRI_UNKNOWN_UNKNOWNS.md` | 31 blind spots across technical, user behavior, infrastructure, business, competitive, edge case, and operational categories | **Risk catalog** |
| `CHIRRI_UNKNOWN_SOLUTIONS.md` | Concrete fix for every blind spot — code patterns, library choices, prioritized implementation checklist | **Solutions companion to unknowns** |
| `CHIRRI_FEATURES_AND_INTEGRATIONS.md` | Feature research (TTFB, uptime, SSL, headers, SLA), integration research (Slack, PagerDuty, MCP), priority matrix | **Feature roadmap research** |
| `CHIRRI_SOURCE_TRACKING_MODEL.md` | How providers/sources/slots work, bundled source intervals, cost analysis per source type, pricing interaction | **Source model design** |
| `CHIRRI_SOURCE_PREFERENCES.md` | Per-source alert preferences system — data model, API endpoints, inheritance model, smart defaults, dashboard UX wireframes | **Preferences design** |
| `CHIRRI_PROVIDER_MONITORING.md` | Per-provider source maps (Stripe, OpenAI, Twilio, GitHub, Shopify), monitoring strategy per source type, status page standardization | **Provider intelligence data** |
| `CHIRRI_DOMAIN_VS_PAGE_MONITORING.md` | Research on domain vs. page monitoring behavior, competitor analysis, decision tree for URL input handling | **UX decision research** |
| `CHIRRI_BRAND_IDENTITY.md` | Full brand guide — positioning, voice, colors, typography, illustration style, landing page copy, competitive positioning map | **Brand guide** |
| `CHIRRI_GROWTH_STRATEGY.md` | Launch playbook, HN strategy, UptimeRobot opportunity, open-source distribution, community strategy, pricing psychology | **Growth playbook** |
| `CHIRRI_CONTENT_STRATEGY.md` | SEO keywords (SERP analysis), programmatic SEO plan, 20 blog posts with target keywords, @ChirriChangelog strategy, content calendar | **Content/SEO plan** |
| `CHIRRI_MARKET_ANALYSIS.md` | Deep competitor analysis with pricing, Reddit/forum research, TAM/SAM/SOM, win/loss scenarios, timing analysis | **Market intelligence** |
| `CHIRRI_REAL_DEVELOPER_RESEARCH.md` | Real developer quotes, SDK breaking change evidence, MCP research, notification channel analysis, provider directory research | **Developer research data** |
| `CHIRRI_DEFINITIVE_PLAN.md` | Six-expert debate, feature cuts/adds, integration priority, security must-haves, week-by-week timeline, kill criteria | **Planning debate outcomes** |
| `DELTA_API_MASTER_SPEC.md` | Original consolidated spec (updated multiple times) — superseded by this Product Bible but contains historical context | **Historical reference** |

---

# APPENDIX C: TECH STACK

| Component | Choice | Why |
|-----------|--------|-----|
| API Server | Node.js + Hono or Fastify | Fast, lightweight |
| Database | PostgreSQL (Railway managed) | Reliable, JSON support, native partitioning |
| Job Queue | BullMQ + Redis | Repeatable jobs, retries, rate limiting |
| HTTP Client | undici (Node.js built-in) | Fastest, DNS pinning support |
| JSON Diffing | jsondiffpatch | Smart array diffing, 5.5K+ stars |
| IP Validation | ipaddr.js | Handles all IP formats (octal, hex, IPv4-mapped IPv6) |
| Schema Validation | zod + zod-to-openapi | Validation + OpenAPI spec generation |
| Dashboard | Next.js or SvelteKit | Fast to build |
| API Docs | Scalar | Modern, interactive |
| Hosting | Railway | Simple, scales, ~$42/mo |
| Billing | Stripe Subscriptions | Flat tier billing |
| Email | Resend | Transactional email |
| Object Storage | Cloudflare R2 | S3-compatible, cheap |
| Self-Monitoring | pino (logging) + UptimeRobot (free) | $0 |
| Analytics | PostHog (free tier) | Product analytics |
| URL Normalization | normalize-url (npm) | Handles all edge cases |
| Timezone | luxon (npm) | DST-safe date handling |
| Date Extraction | chrono-node (npm) | Natural language date parsing |
| Circuit Breaker | opossum (npm) | R2 + external service resilience |
| Decompression | Node.js zlib (built-in) | gzip, deflate, brotli |

---

*This is THE document. The single source of truth. Everything needed to build Chirri is here or referenced from here. The next file created should be `package.json`.*

*Consolidated: March 24, 2026*
*Sources: 19 documents, 25,700 lines → 1 document, ~1,200 lines*
