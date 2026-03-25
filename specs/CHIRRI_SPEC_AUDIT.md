# CHIRRI SPEC AUDIT — Completeness & Gap Analysis

**Date:** 2026-03-24  
**Auditor:** Claude Opus  
**Documents Reviewed:** 10 specification documents (~35,000+ lines)  
**Bible Version:** 2.2 (March 24 Pentest v2 Applied)

---

## Executive Summary

The Chirri spec is **impressively comprehensive** — one of the most thorough pre-build specifications I've seen. The Bible (v2.2) resolved many issues from earlier iterations. However, significant gaps remain that would block or confuse a developer starting today.

**Overall Readiness: 75% — PARTIAL. Could start core backend work, but would hit blockers within the first week.**

**The 3 biggest problems:**
1. **The Architecture doc (CHIRRI_ARCHITECTURE.md) is a stale v1.0 from March 23** — it contradicts the Bible on auth (JWT vs sessions), IDs (UUID vs nanoid), plan names (indie/pro vs personal/team), severity levels (breaking/warning vs high/medium), and base URL (/delta/v1 vs /v1). A developer reading it first would build the wrong thing.
2. **Supporting specs define tables and systems that aren't reconciled with the Bible** — `monitored_sources`, `signal_evidence`, `alert_engagement` tables referenced but never defined in the Bible's schema. The Verification Architecture doc (itself a prior audit) identified 47 findings; many remain unresolved.
3. **No error handling patterns, retry logic, logging standards, testing strategy, or deployment pipeline** are specified beyond scattered mentions.

---

## Part 1: Feature Completeness — MVP List (Bible §9.1)

### Core Monitoring

| Feature | Rating | Notes |
|---------|--------|-------|
| URL/domain input with SSRF validation | **COMPLETE** | Bible §2.1 + §5.5 fully specified. URL validation rules, SSRF prevention with 8-vector coverage, safeFetch() with DNS pinning, IP blocklist complete with IPv6. |
| Auto-classification (3-phase pipeline) | **COMPLETE** | Bible §2.4, §D.18 content-type detection heuristics fully specified. Phase 1 (domain patterns), Phase 2 (response analysis), Phase 3 (fallback). Monitoring method selection table provided. |
| Learning period (10min rapid + 7-day calibrating) | **COMPLETE** | Bible §2.7 fully specified. 30 checks at 20s intervals, volatile field detection at >50% threshold, baseline creation order specified, calibrating hidden from UI. |
| JSON structural diffing (jsondiffpatch) | **COMPLETE** | Bible §2.9 with tiered strategy (<100KB full diff, 100KB-1MB no LCS, >1MB hash-only). 500ms timeout. Prototype pollution prevention. |
| HTML text extraction and diffing | **COMPLETE** | Bible §2.9 pipeline: cheerio → readability → turndown → jsdiff. Fuzzy paragraph dedup with Jaccard similarity. |
| 4-fingerprint change detection | **COMPLETE** | Bible §2.8 Step 6: fullHash, stableHash, schemaHash, headerHash. Clear comparison logic in Step 7. |
| Confirmation recheck (5s + 30min) | **COMPLETE** | Bible §2.8 Step 9. Stage 1 (5s) and Stage 2 (30min) with critical override. ConfirmationCheckJob schema defined. |
| Response size anomaly detection | **PARTIAL** | Bible §2.9 mentions ">50% deviation" and ">200% = warning". But `baseline_size_bytes` IS in baselines table. Missing: the actual comparison logic isn't specified as a discrete pipeline step — where exactly does it run? |

### Provider Intelligence

| Feature | Rating | Notes |
|---------|--------|-------|
| 15-20 hardcoded provider profiles | **COMPLETE** | Bible §5.10 ProviderProfile TypeScript interface defined. MVP provider list given. |
| Provider search and quick-add | **COMPLETE** | Bible §6.2 Providers endpoints: GET /v1/providers, GET /v1/providers/search, GET /v1/providers/:slug. |
| Bundled bonus sources | **COMPLETE** | Bible §2.5-2.6. Source types, check intervals, slot counting, shared monitoring lifecycle all specified. |
| Discovery service (15-path probe) | **COMPLETE** | Bible §2.3. Three phases, HTTPS only, rate-limited, abort >1MB, no redirect following. |
| Shared monitoring deduplication | **COMPLETE** | Bible §5.2 shared_urls table + creation logic with advisory lock. Retention model follows highest subscriber. |

### Early Warning

| Feature | Rating | Notes |
|---------|--------|-------|
| Sunset/Deprecation header parsing | **COMPLETE** | Bible §3.2 + EARLY_WARNING_IMPLEMENTATION.md §2. RFC 8594/9745 parsing, structured-headers library, first-detection logic. Full code provided. |
| API version header tracking | **COMPLETE** | EARLY_WARNING_IMPLEMENTATION.md §4. Known headers list, version change detection, forecast creation. |
| Changelog keyword scanning | **COMPLETE** | Bible §3.2 + EARLY_WARNING_IMPLEMENTATION.md §3. 25+ keywords grouped by strength, added-content-only scanning, date extraction with chrono-node. |
| LLM chirp summarization | **PARTIAL** | Bible §3.6 specifies GPT-4o-mini, $0.003/call, cached per signal, template-based fallback. **Missing: prompt template, output format constraints, caching key strategy, retry queue configuration.** |
| Confidence scoring | **COMPLETE** | Bible §3.7. Factor breakdown, threshold actions (≥60 full chirp, 40-59 dashboard+webhook, <40 dashboard only). Human-readable reasoning mandatory. |
| Deadline countdown and reminder system | **COMPLETE** | Bible §3.8. Adaptive milestones based on deadline distance. Database-polled (daily cron), not delayed jobs. |

### Workflow

| Feature | Rating | Notes |
|---------|--------|-------|
| 4-level severity | **COMPLETE** | Bible §2.12. Critical/High/Medium/Low with clear definitions. Rule-based assignment for MVP. |
| 5-state workflow | **COMPLETE** | Bible §2.11. New/Tracked/Ignored/Snoozed/Resolved with state diagram. Transition endpoints specified (§6.2). |
| Notes field per change | **COMPLETE** | Bible §6.2 all workflow endpoints accept optional `{ "note": "..." }`. |
| Copy-as-markdown | **COMPLETE** | Bible §D.2 full markdown format specified. |
| Snooze with date picker | **COMPLETE** | Bible §2.11 snooze options listed. §6.2 POST /v1/changes/:id/snooze with `{ "until": "..." }`. |

### Notifications

| Feature | Rating | Notes |
|---------|--------|-------|
| Email (Resend) | **COMPLETE** | Bible §7.1 + Appendix C. Resend API, React Email templates, 5 onboarding emails + recurring. |
| Discord (incoming webhooks) | **COMPLETE** | Bible §7.1 + §D.11. Full embed format specified with severity colors. Free tier included. |
| Slack (incoming webhooks) | **COMPLETE** | Bible §7.1 + §D.10. Full Block Kit format specified. Personal+ tier. |
| Notification rate limiting per plan | **COMPLETE** | Bible §7.1 rate limit table per plan per severity. |

### Integrations

| Feature | Rating | Notes |
|---------|--------|-------|
| MCP server (8 tools) | **COMPLETE** | Bible §7.3 + §D.7. All 8 tools with input/output schemas. Deployment as npm package specified. |
| Jira Cloud (ADF conversion) | **PARTIAL** | Bible §7.2 mentions ADF conversion, priority mapping, Arctic for OAuth. **Missing: exact OAuth flow steps, callback URL configuration, token refresh logic, ADF template for change description.** The `integrations` and `oauth_tokens` tables are defined but the actual HTTP calls to Jira REST API are not specified. |
| Linear | **PARTIAL** | Bible §7.2 mentions OAuth 2.0 + native Markdown. **Missing: same gaps as Jira — OAuth flow, GraphQL mutation for issue creation, field mapping.** |
| GitHub Issues | **PARTIAL** | Bible §7.2 mentions GitHub App OAuth + GFM. **Missing: GitHub App setup, installation flow, REST API call for issue creation.** |
| Generic webhook | **COMPLETE** | Bible §6.2 Webhooks endpoints fully specified. §8.6 HMAC-SHA256 signing. §D.4 payload format. §8.10 webhook URL security. |

### Dashboard

| Feature | Rating | Notes |
|---------|--------|-------|
| Tree-view layout | **COMPLETE** | Frontend Bible Part 5. Visual structure, node types, status dot logic, expand/collapse, mute/hide. |
| Change feed | **COMPLETE** | Frontend Bible §3.4. Filters, sort, inline triage, batch actions, mobile gestures. |
| Change detail (Monaco DiffEditor) | **COMPLETE** | Frontend Bible Part 4. Monaco config, custom themes, content-type rendering, action bar, responsive. |
| URL detail with check log, TTFB stats | **COMPLETE** | Frontend Bible §3.3. Tabs, metric cards, TTFB sparkline, action buttons. |
| Provider detail with source management | **COMPLETE** | Frontend Bible §3.3 + §3.12. Sources inline on overview, alert toggles. |
| Settings | **COMPLETE** | Frontend Bible §3.8-3.11. Sub-navigation, API keys, webhooks, integrations, billing. |
| Dark mode | **COMPLETE** | Frontend Bible §1.8. System preference detection, class strategy, CSS variables. |
| Real data only | **COMPLETE** | Frontend Bible §6.1-6.3. Public API feed for new users, learning progress view. |

### Account

| Feature | Rating | Notes |
|---------|--------|-------|
| Email/password auth (better-auth) | **COMPLETE** | Bible §6.2 Auth endpoints. §8.5 security details (Argon2id, lockout, CSRF, email verification flow). |
| API keys (ck_live_, ck_test_) | **COMPLETE** | Bible §6.2 API Keys endpoints. §D.12 test mode behavior. |
| Free + Personal plans | **COMPLETE** | Bible §4.1 pricing table. §5.9 PLAN_LIMITS TypeScript config with all features. |
| Stripe billing | **COMPLETE** | Bible §4.1 Stripe implementation (checkout, upgrade, downgrade, dunning, webhook events). |
| GDPR account deletion | **COMPLETE** | Bible §8.9 full cascade table with every table's deletion action. 7-day grace period. |
| Data export | **PARTIAL** | Bible §6.2 lists `GET /v1/account/export` and mentions "async for large accounts." **Missing: export format, what's included, R2 signed URL generation, expiry, notification when ready.** |
| Onboarding email sequence | **COMPLETE** | Frontend Bible §6.6. 5 emails with timing, triggers, subjects, CTAs. |
| Weekly stability report | **COMPLETE** | Bible §D.3. Full template with content, conditions, timezone handling. |

---

## Part 2: Cross-Spec Contradictions

### 2.1 Architecture Doc vs Bible — MAJOR DRIFT

The Architecture doc (`CHIRRI_ARCHITECTURE.md`) is dated **2026-03-23** (one day before Bible v2.2) and was **never updated** to match the Bible. Critical contradictions:

| Area | Architecture Doc | Bible (v2.2) | Severity |
|------|-----------------|--------------|----------|
| **Auth** | JWT with refresh tokens, `POST /v1/auth/refresh` | Session cookies via better-auth, no refresh endpoint | 🔴 CRITICAL |
| **IDs** | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | `TEXT PRIMARY KEY` with prefixed nanoid (`usr_`, `url_`, etc.) | 🔴 CRITICAL |
| **Plan names** | `free, indie, pro, business` | `free, personal, team, business` | 🔴 CRITICAL |
| **Severity levels** | `critical, breaking, warning, info` | `critical, high, medium, low` | 🔴 CRITICAL |
| **Base URL** | `api.chirri.io/delta/v1` | `api.chirri.io/v1` | 🔴 CRITICAL |
| **API key prefix** | `dk_live_`, `dk_test_` | `ck_live_`, `ck_test_` | 🟡 |
| **User-Agent** | `Delta-Monitor/1.0` | `Chirri-Monitor/1.0` | 🟡 |
| **Webhook headers** | `X-Delta-Signature` | `X-Chirri-Signature` | 🟡 |
| **Password hashing** | bcrypt | Argon2id | 🟡 |
| **Email sender** | `Delta API <alerts@chirri.io>` | `Chirri <chirp@chirri.io>` | 🟡 |
| **Partitioning** | pg_partman | Native Postgres declarative partitioning | 🟡 |
| **Rate limits** | Per-minute sliding window | Per-hour sliding window | 🟡 |
| **Free plan webhooks** | 1 webhook | 0 webhooks | 🟡 |
| **Free plan API access** | `apiAccess: false` | `apiAccess: true` (10 req/hr) | 🟡 |
| **Webhook signing** | `X-Delta-Signature` format | `X-Chirri-Signature` with different format | 🟡 |
| **check_results PK** | UUID only | Composite PK `(id, checked_at)` for partitioning | 🟡 |

**Verdict: The Architecture doc should NOT be used for implementation. The Bible is authoritative.**

### 2.2 Severity System: CHIRRI_ESCALATION vs Bible

| Area | Escalation Doc | Bible |
|------|---------------|-------|
| **Severity enum** | `critical, breaking, warning, info` | `critical, high, medium, low` |
| **Escalation levels** | `info, advisory, warning, urgent, critical` (5 levels) | Not in Bible — Bible uses 4-level severity only |
| **Alert level (forecasts)** | `forecast, deadline, breaking, notable, info` | Bible §3.4 doesn't define alert_level; forecasts table has it but mapped differently |

The Escalation doc uses the OLD severity names from before Bible v2.2. The Bible standardized to `critical/high/medium/low` (Decision #15), but the Escalation doc still uses `critical/breaking/warning/info`.

The 5-level escalation system (`info → advisory → warning → urgent → critical`) in the Escalation doc is a SEPARATE axis from the 4-level change severity. This distinction is valid but **never explicitly reconciled** in the Bible. The Bible's forecasts table has `alert_level` but uses different values.

### 2.3 Rate Limiting: CHIRRI_RATE_LIMITING vs Bible §6.2

| Area | Rate Limiting Doc | Bible |
|------|------------------|-------|
| **Window** | Per-minute sliding window | Per-hour sliding window (Sorted Set with 3700s TTL) |
| **Plan names** | Free, Starter, Pro, Enterprise | Free, Personal, Team, Business |
| **Free plan** | 60 RPM / 1,000 RPH | 10 req/hour |
| **Paid tier 1** | "Starter" 120 RPM | "Personal" 60 req/hour |
| **Read/Write split** | YES (2x for reads) | Not mentioned in Bible |
| **Burst allowance** | Token bucket consideration | Not mentioned |
| **Per-URL bonus** | +0.5 to +2 RPM per URL | Not mentioned |
| **Concurrency limiter** | Max 3 concurrent manual checks | Not mentioned |

**Verdict:** The Rate Limiting doc was written for an older pricing model. The Bible's per-hour rates (§6.2) are authoritative but much simpler. The Read/Write split, per-URL bonus, burst allowance, and concurrency limiter from the Rate Limiting doc are interesting but NOT in the Bible. **A developer would not know these exist.**

### 2.4 Early Warning: Implementation Doc vs Bible §3

Generally well-aligned. The implementation doc provides the HOW for the Bible's WHAT. Minor issues:

| Area | Implementation Doc | Bible |
|------|-------------------|-------|
| **forecasts.severity** | `critical, breaking, warning, info` | Bible forecasts table uses `critical, high, medium, low` |
| **IDs** | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Bible uses TEXT + nanoid |
| **forecasts table** | Full SQL with UUID PKs, 11 signal_types | Bible has abbreviated schema with TEXT PKs, fewer signal_types listed |
| **Emoji in titles** | `"🔮 Sunset detected..."` | Bible §1.7: "No emojis anywhere in the product" |

### 2.5 Source Preferences vs Bible

| Area | Source Preferences Doc | Bible |
|------|----------------------|-------|
| **Severity levels** | `info, warning, notable, breaking, critical` (5 levels) | `critical, high, medium, low` (4 levels) |
| **Plan names** | Free, Indie ($9), Pro ($29), Business ($79) | Free, Personal ($5), Team ($19), Business ($49) |
| **`monitored_sources` table** | Referenced as FK target, never defined | Not in Bible schema either — **table doesn't exist** |
| **`alert_engagement` table** | Defined for adaptive suggestions | Not in Bible — appears to be V2 |

### 2.6 Relevance Intelligence vs Bible

| Area | Relevance Doc | Bible |
|------|--------------|-------|
| **shared_sources table** | Full SQL with UUID PKs, `INTERVAL` type for check_interval | Bible §5.2 has abbreviated shared_sources with TEXT PKs, TEXT check_interval |
| **signals table** | Full SQL defined | Not in Bible schema (Bible has forecasts but not signals) |
| **signal_evidence table** | Defined | Not in Bible |
| **signal_matches table** | Defined | In Bible schema but abbreviated |
| **domain_user_counts** | Full SQL defined | In Bible schema (abbreviated) |

---

## Part 3: Implementation Readiness

### 3.1 Database Tables

**Fully defined with columns, types, indexes in the Bible:** ✅
- users, urls, shared_urls, baselines, check_results, changes, user_changes, webhooks, webhook_deliveries, notifications, forecasts, user_forecasts, header_snapshots, shared_sources, url_secrets, oauth_tokens, integrations, tickets, feedback, learning_samples, domain_patterns, package_versions, spec_snapshots, source_alert_preferences, domain_user_counts, discovery_results

**Referenced but NOT defined in the Bible:**
- `signal_evidence` — only in Relevance Intelligence doc
- `alert_engagement` — only in Source Preferences doc  
- `signals` — only in Relevance Intelligence doc (Bible uses `forecasts` instead)

**Verdict:** Bible schema is ~90% complete. A developer can create most tables. The 3 missing tables are for V1.1+ features.

### 3.2 API Endpoints

**Fully defined with request/response shapes:** ✅ (in Bible §6.2)
- Auth (7 endpoints)
- API Keys (4 endpoints)
- URLs (7 endpoints)
- Changes (10 endpoints including workflow transitions)
- Forecasts (5 endpoints)
- Check History (2 endpoints)
- Sources (4 endpoints)
- Webhooks (7 endpoints)
- Providers (3 endpoints)
- Notifications (3 endpoints)
- Account (8 endpoints)
- Health/Internal (4 endpoints)

**Missing request/response shapes:**
- `POST /v1/account/email-preferences` — mentioned but no request body defined
- `POST /v1/account/export` — mentioned but export format/delivery not specified
- `POST /v1/urls/bulk` — max 100, partial success mentioned, but exact response shape not in Bible
- `DELETE /v1/urls/bulk` — mentioned but no request body (how to specify which URLs?)
- `GET /v1/urls/export` — mentioned but format not specified
- SSE `/v1/events` — event types listed but no formal event schema

**Verdict:** ~85% of endpoints have sufficient detail to implement. Bulk operations and export need more spec.

### 3.3 Background Jobs

**Fully defined with input/output:**
- url-checks (UrlCheckJob interface)
- confirmation-checks (ConfirmationCheckJob interface)
- notifications (NotificationPayload interface)

**Partially defined:**
- learning-checks — mentioned but no job schema in Bible (only in Architecture doc with old UUID format)
- classification — Bible says merged into url-checks but no details on how
- shared-source-checks — mentioned in Bible §5.7 cron table but no job schema
- signal-fanout — mentioned in Bible §5.3 queue table but no job schema
- package-checks — mentioned in Bible §5.3 but no job schema
- maintenance — mentioned but no job schemas

**Verdict:** Core check/notification jobs are well-defined. Supporting jobs need schemas.

### 3.4 Environment Variables

**Listed in Bible §D.20:** ✅
- Shared: DATABASE_URL, DATABASE_POOL_SIZE, REDIS_URL, R2_*, NODE_ENV, LOG_LEVEL, INTERNAL_API_TOKEN, ENCRYPTION_MASTER_KEY
- API Server: PORT, STRIPE_*, DASHBOARD_ORIGIN, SENTRY_DSN
- Worker: RESEND_API_KEY, EMAIL_FROM, WORKER_ID

**Missing:**
- `OPENAI_API_KEY` — needed for LLM chirp summarization (Bible §3.6)
- `TWITTER_*` — needed for Twitter/X automation (Bible §7.4)
- `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` — needed for Jira OAuth (Bible §7.2)
- `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` — needed for Linear OAuth
- `GITHUB_APP_*` — needed for GitHub Issues integration
- `BETTER_AUTH_SECRET` — needed for better-auth session signing
- `COOKIE_DOMAIN` — `.chirri.io` as specified in Bible §8.5
- `MCP_SERVER_*` — deployment config for MCP server

### 3.5 Third-Party API Integrations

| Integration | Keys/Config Needed | Specced? |
|------------|-------------------|----------|
| Stripe | Secret key, webhook secret, price IDs | ✅ Yes |
| Resend | API key | ✅ Yes |
| Cloudflare R2 | Account ID, access key, secret key, bucket | ✅ Yes |
| Sentry | DSN | ✅ Yes (briefly) |
| OpenAI (GPT-4o-mini) | API key, model name | ❌ Only mentioned as "$0.003/call" |
| Twitter/X | API credentials | ❌ Only mentioned as "twitter-api-v2 npm" |
| Jira | OAuth 2.0 (3LO) client ID/secret | ❌ Only mentioned as "Arctic library" |
| Linear | OAuth 2.0 client ID/secret | ❌ Same |
| GitHub | App ID, private key, installation flow | ❌ Same |
| npm Registry | None (public API) | ✅ Implicitly |
| PyPI | None (public API) | ✅ Implicitly |
| UptimeRobot | External health check | ✅ Yes |

---

## Part 4: Missing Specs

### 4.1 Error Handling Patterns

**Status: PARTIALLY COVERED**

The Bible defines error response format (§6.1): `{ "error": { "code": "...", "message": "...", "status": 400 } }` and lists error code categories (§6.6). But missing:

- **No global error handler specification** — how do unhandled errors propagate?
- **No error categorization for background jobs** — what happens when a BullMQ job throws?
- **No circuit breaker behavior specified for PostgreSQL** — only R2 and Resend get circuit breaker configs
- **No error response for SSE connection failures**
- **No error handling for Stripe webhook signature verification failures**

### 4.2 Retry Logic

**Status: PARTIALLY COVERED**

- Webhook retries: ✅ `1m, 5m, 30m, 2h, 12h` (Bible §7.1)
- URL check retries: ✅ `3, exponential` (Bible §5.3)
- Notification retries: ✅ `5 (1m,5m,30m,2h,12h)` (Bible §5.3)
- LLM call retries: ✅ `3 with exponential backoff, 10s timeout` (Bible §3.6)

**Missing:**
- Database connection retry on transient failures (mentioned briefly in §D.17 startup but not for runtime)
- Redis reconnection strategy beyond "auto-reconnect every 5s"
- R2 upload retry when circuit breaker is open (queued? dropped?)
- OAuth token refresh retry on failure
- Stripe webhook processing retry (what if our handler crashes mid-processing?)

### 4.3 Logging Standards

**Status: PARTIALLY COVERED**

Bible §D.16 defines Pino configuration with:
- Structured JSON logging
- Log level configuration
- Redaction of sensitive fields
- Service/version metadata

**Missing:**
- **No log taxonomy** — what gets logged at each level?
- **No request ID/correlation ID strategy** for tracing requests across services
- **No structured log schema** for key events (check completed, change detected, notification sent)
- **No log rotation/retention policy** (Railway streams logs but what about long-term?)

### 4.4 Testing Strategy

**Status: MOSTLY MISSING**

Bible §5.4 lists `vitest + supertest` for testing. The Early Warning Implementation doc (§12) has test examples. But:

- **No unit test requirements or coverage targets**
- **No integration test strategy** (which flows need end-to-end tests?)
- **No load/performance testing plan** (what's the expected check throughput?)
- **No test data strategy** (how to seed providers, URLs, baselines for tests?)
- **No mock strategy** (how to mock external APIs: Stripe, Resend, R2, npm, OpenAI?)
- **No CI pipeline definition** (GitHub Actions mentioned but no workflow file or steps)
- **No pre-commit hooks or linting configuration**

### 4.5 Deployment/CI Pipeline

**Status: MOSTLY MISSING**

Bible §5.11 mentions:
- Railway auto-deploy with "Wait for CI"
- Migrations run in prestart script
- GitHub Actions (2K min/mo free)

**Missing:**
- **No GitHub Actions workflow definition** (steps, triggers, test/lint/build commands)
- **No branch strategy** (main only? feature branches? staging environment?)
- **No rollback procedure** (beyond "database snapshots")
- **No blue-green or canary deployment strategy**
- **No staging/preview environment spec**
- **No database migration CI check** (verify migrations are safe before deploying)
- **No secret management strategy** (Railway env vars mentioned but no rotation plan)

### 4.6 Monitoring/Alerting for Chirri Itself

**Status: PARTIALLY COVERED**

Bible §D.14 defines self-monitoring:
- External canary (httpbin.org)
- Health endpoint (/health)
- Queue depth alerting (>500 warning, >2000 critical)
- Worker heartbeat (Redis key every 60s)
- Daily digest validation

**Missing:**
- **No alerting channel for self-monitoring** (Telegram mentioned once but no bot setup)
- **No on-call / escalation for Chirri itself**
- **No SLA definition** (what uptime does Chirri promise?)
- **No capacity planning** (at what user count do we need to scale workers?)
- **No database monitoring** (connection pool exhaustion, slow queries, table bloat)
- **No Redis memory monitoring** (noeviction policy means writes fail when full)
- **No R2 storage monitoring** (approaching free tier limits?)
- **No cost alerting** (Railway usage approaching budget?)

---

## Part 5: Top 10 Priority Gaps — MUST Resolve Before Coding

### 1. 🔴 Retire or Rewrite CHIRRI_ARCHITECTURE.md

**Why:** It contradicts the Bible on auth (JWT vs sessions), IDs (UUID vs nanoid), plan names, severity levels, base URL, and dozens of other details. A developer reading it will build the wrong system. Either delete it and point everything to the Bible, or do a complete rewrite synchronized with Bible v2.2.

**Effort:** 4-8 hours to rewrite, or 0 hours to delete + add a "deprecated" header.

### 2. 🔴 Define the Canonical Database Migration File

**Why:** The Bible has all table definitions but scattered across §5.2. A developer needs ONE `migrations/001_initial.sql` file (as Bible §D.15 references but doesn't provide). The schema uses TEXT PKs with nanoid — Drizzle can handle most tables, but check_results (partitioned) needs raw SQL.

**Effort:** 2-4 hours to compile all CREATE TABLE statements into one file.

### 3. 🔴 Specify PM Integration OAuth Flows

**Why:** Jira, Linear, and GitHub Issues are listed as MVP but the OAuth flows (callback URLs, token exchange, refresh, scope requirements) are not specified beyond "use Arctic library." A developer would need to research each provider's OAuth docs independently.

**Effort:** 4-6 hours to spec each flow (12-18 hours total).

### 4. 🔴 Define the LLM Summarization Contract

**Why:** Bible §3.6 says "LLM chirp summarization is MVP" with GPT-4o-mini at $0.003/call. But there's no prompt template, output constraints, caching strategy, or fallback format beyond a brief mention. The developer needs: system prompt, user prompt template, max tokens, temperature, response parsing, cache key generation.

**Effort:** 2-3 hours.

### 5. 🔴 Write a GitHub Actions CI Workflow

**Why:** No CI/CD pipeline is defined. Bible says "GitHub Actions, 2K min/mo free" and "Railway auto-deploy with Wait for CI" — but there's no workflow file. A developer needs: trigger rules, test step, lint step, build step, migration safety check.

**Effort:** 2-3 hours.

### 6. 🟡 Reconcile Severity Enums Across All Docs

**Why:** The Bible uses `critical/high/medium/low`. Supporting docs use `critical/breaking/warning/info` or add `notable`. The forecasts table has both `alert_level` and `severity` with different enums. A developer seeing both will be confused about which enum to implement.

**Effort:** 1-2 hours of doc updates.

### 7. 🟡 Spec the Bulk Operations

**Why:** `POST /v1/urls/bulk`, `DELETE /v1/urls/bulk`, and `GET /v1/urls/export` are in the MVP feature list but have no request/response shapes. The Migration & Import doc covers import flows but these endpoints aren't fully specced in the Bible.

**Effort:** 2-3 hours.

### 8. 🟡 Define Error Handling Patterns for Background Jobs

**Why:** When a BullMQ job fails (DNS timeout, R2 down, LLM timeout), the retry behavior is specified per-queue but the error categorization, logging, and user-visible impact are not. Which errors mark a URL as `error` status? Which are silently retried?

**Effort:** 2-3 hours.

### 9. 🟡 Spec Test Data & Mock Strategy

**Why:** No testing infrastructure is defined. Bible lists Vitest + Supertest but no mock strategy for Stripe, Resend, R2, better-auth, OpenAI. No test database setup. No fixture strategy.

**Effort:** 3-4 hours.

### 10. 🟡 Clarify What's Actually MVP for Early Warning

**Why:** The Bible lists early warning as MVP (§9.1), the implementation doc estimates 37 hours for MVP signals + 59 hours for relevance intelligence. The full pipeline (shared sources → signal extraction → relevance matching → fan-out → notifications) is a 2-3 week project alone. For actual MVP launch, only header parsing (zero extra HTTP requests) + basic forecast creation is feasible. The Bible should explicitly say: "MVP = header signals only. Changelog scanning + relevance matching = V1.1."

**Effort:** 1 hour of doc clarification. Saves weeks of scope confusion.

---

## Appendix: Verification Architecture Findings Status

The CHIRRI_VERIFICATION_ARCHITECTURE.md (a prior audit) found 47 issues. Status of the critical ones against Bible v2.2:

| Finding | Status in Bible v2.2 |
|---------|---------------------|
| #1 Table count chaos | ✅ RESOLVED — Bible §5.2 lists all tables clearly |
| #2 Queue count contradiction | ✅ RESOLVED — Bible §5.3 lists 10 queues |
| #5 Base URL confusion | ✅ RESOLVED — Bible uses `api.chirri.io/v1` consistently |
| #12 JWT vs Sessions | ✅ RESOLVED — Bible §8.5 specifies sessions via better-auth |
| #17 URL status states | ✅ RESOLVED — Bible §5.2 urls table has 10 states |
| #19 Severity levels | ✅ RESOLVED — Bible uses critical/high/medium/low |
| #20 `monitored_sources` undefined | ❌ UNRESOLVED — Source Preferences doc still references it |
| #23 API key prefix | ✅ RESOLVED — Bible uses ck_ prefix |
| #29 nanoid vs UUID | ✅ RESOLVED — Bible uses TEXT + nanoid |
| #10 Timeline feasibility | ❌ UNRESOLVED — Bible §9.9 says 750-870 hours (19-22 weeks). This is more realistic than the old 8-week plan but still ambitious for MVP scope. |

**30+ of the 47 findings were addressed by Bible v2.2. The remaining gaps are mostly in supporting docs that were never updated to match.**

---

## Final Verdict

| Category | Readiness |
|----------|-----------|
| **Product vision & positioning** | 🟢 COMPLETE — Crystal clear |
| **Database schema** | 🟢 95% COMPLETE — Ready to generate migrations |
| **API contract** | 🟢 90% COMPLETE — A few endpoints need response shapes |
| **Business logic** | 🟢 90% COMPLETE — Check pipeline, change detection, notifications all specced |
| **Security** | 🟢 95% COMPLETE — SSRF, auth, XSS, CSRF, webhook signing all thorough |
| **Frontend/UI** | 🟢 90% COMPLETE — Comprehensive design system and page specs |
| **PM Integrations (Jira/Linear/GitHub)** | 🟡 50% — OAuth flows and API calls not specified |
| **Supporting docs alignment** | 🔴 30% — Architecture doc and supporting specs are stale |
| **DevOps/CI/CD** | 🔴 20% — Almost nothing defined |
| **Testing** | 🔴 15% — Strategy and infrastructure not defined |
| **Error handling & observability** | 🟡 40% — Partially covered, gaps in background jobs and alerting |

**A developer CAN start building the core backend (auth, URL management, check pipeline, change detection, notifications) today.** They will hit blockers on PM integrations, CI/CD, and any feature where they consult the stale Architecture doc.

**Recommended first action:** Add a prominent header to CHIRRI_ARCHITECTURE.md saying "⚠️ STALE — This document predates CHIRRI_BIBLE.md v2.2. The Bible is authoritative. This document is retained for reference only." This alone prevents the #1 source of confusion.

---

*Audit completed: 2026-03-24*
