# CHIRRI — Research Gaps Audit

**Author:** Opus (Research Gap Auditor)  
**Date:** 2026-03-24  
**Scope:** All 21 spec documents reviewed  
**Excluded:** Escalation & severity (amendments 6 & 7) — researched separately

> For each topic, classified as: ✅ Fully Researched, ⚠️ Partially Researched, ❌ Not Researched.
> Ranked by: Would it block building? Cause a production incident? Waste developer time?

---

## ✅ Fully Researched (No Action Needed)

These topics have real data, validated implementation approaches, edge cases documented, and libraries identified.

- **SSRF Prevention (`safeFetch()`)**: 34-vector pentest, complete IP blocklist with ipaddr.js, DNS pinning via undici, redirect chain validation, 18-case automated test suite, Railway-specific `.railway.internal` blocking. Code samples provided. *Most thoroughly researched component.*

- **Auto-classification pipeline (3 phases)**: Domain pattern match → response-based → fallback. 10 domain patterns specified. Fallback to json-diff with learning period handles unknown URLs. Quality tracking and user override documented. Phase 1 regex is simple domain matching (not URL path regex), which is reliable.

- **jsondiffpatch diffing strategy**: Tiered approach (fast path 90%, normal <100KB, large >100KB disable LCS, huge >1MB hash-only). 500ms timeout. Array handling with ID-based matching. Prototype pollution prevention. Benchmarking approach documented in Unknown Solutions T-01.

- **Silent learning period**: 30 checks at 20-second intervals. Volatile field detection (>50% change rate). Numeric proximity detection for drifting numbers. Error responses never become baselines (429, bot protection discarded). State machine: learning → calibrating (invisible) → active. Edge cases for mid-learning changes documented.

- **Confirmation recheck pattern**: 5-second Stage 1 (MVP), 30-minute Stage 2 (V1.1). Critical changes skip Stage 2. Three outcomes: confirmed, reverted, unstable. Implementation code provided.

- **Five-layer false positive cascade**: Recheck → cross-user correlation → notification rate limiting → canary check → human review queue. Layer-by-layer implementation in Unknown Solutions CF-01. The #1 engineering priority — extensively documented.

- **Security pentest (34 vectors)**: 8 critical, 13 high, 10 medium, 3 low. Every vector has exploitation steps and mitigation code. SSRF bypass chains, DDoS amplification, cross-tenant isolation, XSS, CRLF injection, prototype pollution, JWT storage, CSRF — all addressed.

- **Webhook HMAC signing**: Per-webhook signing secrets, timestamp in signature (`t={ts},v1={hmac}`), replay protection (reject >5 min old), delivery retry schedule (1m, 5m, 30m, 2h, 12h), re-validate IP at delivery time. Stripe pattern followed. Code in architecture doc.

- **API key security**: `crypto.randomBytes(32)`, SHA-256 hash storage, shown once, `timingSafeEqual` for comparison, reject keys in query params. Prefix format `dk_live_`/`dk_test_`. Implementation code provided.

- **Rate limiting (Redis sliding window)**: Per-plan limits documented (60-600 RPM). Per-IP for unauthenticated (20/min). Domain throttling (1 req/sec token bucket in Redis). Circuit breaker per domain. Redis key patterns documented.

- **Brand identity**: Name origin (チリチリ), tagline, voice guide with examples, color palette (#FFB7C5 sakura pink), typography (Inter + JetBrains Mono), dark mode default, logo concept, illustration style. Complete brand guide with competitive positioning map.

- **Market analysis**: Deep competitor analysis (APIShift, changedetection.io, UptimeRobot, Postman, watchflow.io, etc.) with pricing, features, threat levels. TAM/SAM calculations. Real developer quotes from Reddit, HN, Stack Overflow, dev.to. IEEE study on API breaking changes. Demand validation with 14+ sourced data points.

- **Growth strategy**: HN-first launch playbook with specific Show HN format. Product Hunt, Reddit, Dev.to sequence. UptimeRobot migration wave tactical playbook. Beta program (20 users, 4 segments). Open-source distribution (CLI, GitHub Action, MCP server). All backed by real examples (Watermelon, Fly.io, Snyk).

- **Content/SEO strategy**: SERP analysis for 15+ keywords with actual competition levels. 20 blog post topics with target keywords. Programmatic SEO plan for provider pages. @ChirriChangelog automation strategy. Content-product flywheel documented.

- **Early warning system (research)**: 8 signal types researched with real-world examples. Deprecation/Sunset headers (RFC 8594, RFC 9745), changelog keyword scanning, API version tracking, OpenAPI spec diffing, SDK version monitoring, GitHub signals, migration guide detection, status page integration. Competitive analysis confirms nobody does this.

- **Early warning implementation**: Full SQL schemas (5 tables), parsing code for every signal type, integration points in check worker pipeline, reminder/countdown system, forecast API endpoints, dashboard UX wireframes, test fixtures from real deprecations. `structured-headers` and `chrono-node` libraries identified.

- **Source tracking model**: Provider = 1 URL slot with bundled free sources. Check intervals by source type (2h changelog, 10min status, 6h SDK). Cost analysis ($0.03/provider/month at scale). Pricing interaction per plan. Shared monitoring deduplication for bundled sources.

- **Source preferences**: Per-source alert toggling, severity thresholds, channel routing, digest mode. Data model, API endpoints, inheritance model (account → source), smart defaults by source type, dashboard UX wireframes. Plan restrictions documented.

- **Provider monitoring**: Per-provider source maps for Stripe, OpenAI, Twilio, GitHub, Shopify. Status page standardization (Statuspage.io JSON API). SDK monitoring strategy per language.

- **URL onboarding flow**: Complete state machine (12 statuses). Every API endpoint with every response shape, every error code, every edge case. Provider detection flow. Redirect handling. Bot protection detection. Empty response handling.

- **Unknown unknowns**: 31 blind spots identified across 8 categories. Each rated by likelihood and impact.

- **Unknown solutions**: Concrete fix for every blind spot with code patterns, library choices, and effort estimates. Prioritized implementation checklist (30 items pre-launch).

- **Relevance intelligence**: Three-layer matching engine (structural extraction → path matching → scope inference). Shared source model. Cross-user fan-out pipeline. Confidence scoring. Database schema. Full pipeline design.

- **Domain vs page monitoring**: Research on competitor behavior (changedetection.io, Visualping, Distill.io, etc.). Industry standard is single-page-per-watch. Decision: URL input always, provider intelligence enhances.

---

## ⚠️ Partially Researched (Needs More Work)

These have clear concepts but missing implementation details, unvalidated assumptions, or gaps in specific areas.

### Technical

- **Diff engine for HTML pages**: We say "content-hash" for HTML, and the changelog keyword scanner extracts text from HTML. But there's no specification of HOW we extract readable text from HTML. `extractReadableText()` is called in code but never defined. Do we use `cheerio`? `jsdom`? `@mozilla/readability`? HTML-to-text conversion is notoriously tricky (JavaScript-rendered content, dynamic elements, layout vs content). **Missing:** Library choice for HTML text extraction, handling of JavaScript-rendered pages (SPA shells).  
  **Effort:** 4 hours research + prototyping  
  **Priority:** HIGH — changelog keyword scanning depends on this, and it's an MVP feature

- **Diff engine for XML/RSS**: The `feed-poll` method is described at concept level — "detect new items in RSS/Atom feeds." But the actual XML parsing library isn't specified. The early warning doc uses `fast-xml-parser` for GitHub Atom feeds, but RSS parsing for general feeds (RSS 2.0, Atom 1.0, RSS 1.0, various namespace extensions) needs a dedicated library. **Missing:** RSS parsing library choice (e.g., `rss-parser`, `feedparser`, or `fast-xml-parser` with custom logic). How do we identify "new" items? By `guid`? By `pubDate`? What if the feed has no GUIDs?  
  **Effort:** 4 hours  
  **Priority:** MEDIUM — RSS/Atom feed monitoring is V1.1, but GitHub Atom feeds are MVP

- **Diff engine for OpenAPI specs**: The early warning doc recommends `openapi-diff` npm package (v0.24.x, pre-1.0) for V1.1. Also mentions `oasdiff` (Go CLI) as gold standard. But no validation that `openapi-diff` actually works well for our use case. It's a pre-1.0 library — stability unknown. **Missing:** Benchmarking `openapi-diff` against real specs (Stripe, OpenAI). Fallback plan if it's buggy. Decision on whether to shell out to `oasdiff` CLI instead.  
  **Effort:** 1-2 days  
  **Priority:** LOW — deferred to V1.1

- **BullMQ at expected job rates**: Redis memory management is thoroughly researched (T-07 in Unknown Solutions), but actual BullMQ behavior under load hasn't been tested. The spec says "handles 5,000-25,000 URLs at mixed intervals" but this is an estimate, not a benchmark. **Missing:** Load test with realistic job profiles. BullMQ stalled job behavior when Redis is under memory pressure. Queue priority behavior with 4 queues sharing workers.  
  **Effort:** 1 day (k6 load test planned for Week 7)  
  **Priority:** MEDIUM — planned for Week 7 but should be done earlier to catch architecture issues

- **Drizzle ORM validation**: Chosen in tech stack but never validated against the schema. The schema has 11+ core tables with complex relationships, JSONB columns, array types, partitioned tables, and `FOR UPDATE SKIP LOCKED`. **Missing:** Confirmation that Drizzle handles: native Postgres partitioning, `FOR UPDATE SKIP LOCKED`, JSONB operators, array columns, `gen_random_uuid()`, and pg-specific index types (GIN for tags). Migration tooling (Drizzle Kit) workflow not specified.  
  **Effort:** 4 hours (build a prototype with 3-4 tables)  
  **Priority:** HIGH — if Drizzle can't handle the schema, it blocks Week 1

- **pg_partman / native partitioning on Railway**: The Unknown Solutions doc correctly identifies this risk and provides native partitioning SQL as the solution. But nobody has confirmed Railway's Postgres version (needs 12+ for declarative partitioning to work well) or tested that partition management via cron works on Railway. **Missing:** Railway Postgres version verification. Test that `CREATE TABLE ... PARTITION OF` works. Test that dropping old partitions doesn't lock the parent table.  
  **Effort:** 2 hours (verify on Railway)  
  **Priority:** HIGH — blocks Week 1 DB setup

- **undici DNS pinning for SSRF prevention**: The SSRF code samples use `connect.hostname` override in undici to pin to resolved IP. This is the correct approach, but the exact undici API for this has changed across versions. **Missing:** Verification against the specific undici version bundled with our target Node.js version. The `connect` option behavior with TLS (SNI) needs testing.  
  **Effort:** 2 hours  
  **Priority:** HIGH — SSRF prevention is a launch blocker

- **Email sending (Resend)**: Resend is chosen and budgeted at ~$3/mo. But the actual implementation isn't specified beyond "send email via Resend." **Missing:** Resend API integration code pattern, email template system (how are transactional emails rendered?), weekly stability report template, change notification email template, dunning email templates. HTML email rendering library choice (React Email? MJML? Plain HTML?).  
  **Effort:** 1 day  
  **Priority:** MEDIUM — email is MVP but Resend's API is simple; template design is the real work

- **Slack integration (incoming webhook)**: Described as "2 days" of work and "just posting to an incoming webhook URL." The Slack Block Kit message format isn't specified. **Missing:** Slack message template (Block Kit JSON), how the diff is rendered in Slack (truncation strategy for large diffs), interactive buttons for feedback (requires Slack app, not just incoming webhook for interactivity).  
  **Effort:** 4 hours for basic webhook, 2 days for interactive buttons  
  **Priority:** MEDIUM — basic webhook is trivial, but interactive feedback buttons need a Slack app (OAuth flow), which is V1.1

- **Discord integration (webhook)**: Nearly identical to Slack webhooks. Discord webhook format is well-documented. **Missing:** Discord embed format for change notifications, character limits (2000 chars for content, 6000 for embeds), how to handle large diffs.  
  **Effort:** 2 hours  
  **Priority:** LOW — Discord webhooks are very well-documented

- **Authentication strategy (JWT + sessions)**: JWT in HttpOnly cookie for dashboard, API keys for programmatic access. Refresh token rotation. But the JWT implementation details are hand-wavy. **Missing:** JWT library choice (jose? jsonwebtoken?). Refresh token storage (Redis? Postgres?). Token revocation strategy (blocklist in Redis?). Session management for multiple devices. Password reset flow (tokens, expiry, email template).  
  **Effort:** 4 hours research, 1 day implementation  
  **Priority:** HIGH — authentication is Week 1

- **Password hashing**: The architecture doc says `bcrypt hash` in the schema comment but the security section doesn't specify bcrypt vs argon2. **Missing:** Explicit choice (bcrypt with cost factor 12 is industry standard; argon2id is newer/better but more complex). Library choice (`bcrypt` vs `bcryptjs` vs `argon2`).  
  **Effort:** 30 minutes  
  **Priority:** LOW — trivial decision, just needs to be made

- **Database migrations tooling**: Drizzle Kit is mentioned once. No migration workflow specified. **Missing:** How migrations are run (at deploy time? Manual?). How to handle failed migrations. Rollback strategy for migrations. How to test migrations before production.  
  **Effort:** 2 hours  
  **Priority:** MEDIUM — needed Week 1 but Drizzle Kit's workflow is well-documented

- **Stripe billing (subscription lifecycle)**: The spec describes Stripe Checkout flow, webhook handling, plan changes, and payment failure. This is well-covered conceptually. **Missing:** Stripe webhook event list to handle (beyond `checkout.session.completed`). Stripe Customer Portal for self-service billing management. Proration calculation for mid-cycle upgrades. Annual billing implementation (separate prices in Stripe). Stripe test mode integration with Chirri's test mode.  
  **Effort:** 4 hours deep dive into Stripe docs  
  **Priority:** MEDIUM — billing is Week 5

- **PagerDuty integration**: Mentioned as V1.1, "Events API v2." **Missing:** PagerDuty Events API v2 payload format, routing key setup, severity mapping (Chirri severity → PagerDuty severity), resolve events when issues clear.  
  **Effort:** 2 hours  
  **Priority:** LOW — V1.1

### Product/UX

- **Dashboard framework**: "Next.js or SvelteKit" — the decision hasn't been made. **Missing:** Framework choice with rationale. If Next.js: App Router or Pages Router? Server Components for the diff viewer? If SvelteKit: SSR strategy? Either way: component library choice (shadcn/ui? Tailwind UI? Custom?), state management, data fetching pattern (SWR? TanStack Query? built-in).  
  **Effort:** 4 hours to decide, affects entire frontend architecture  
  **Priority:** 🔴 CRITICAL — blocks Week 4 (Dashboard/Demo Day). This decision should be made in Week 1.

- **Side-by-side diff viewer**: The spec says "side-by-side diff view, scroll-synced, syntax highlighting, JetBrains Mono font." The Definitive Plan budgets 5-6 days. **Missing:** Which diff rendering library? `react-diff-viewer`? `monaco-editor` diff? Custom implementation using jsondiffpatch delta? How to render the jsondiffpatch delta as visual side-by-side diff? The delta format and the display format are different things.  
  **Effort:** 1 day research + 4-5 days implementation  
  **Priority:** HIGH — this is THE money screen, budgeted for Week 4

- **Real-time updates in dashboard**: The features doc recommends "SSE for dashboard" and "webhooks only for external." **Missing:** SSE implementation (which events? Connection management? Reconnection? Auth for SSE endpoint?). Whether to use SSE at all for MVP or just polling with SWR/TanStack Query revalidation intervals.  
  **Effort:** 4 hours for polling approach, 1-2 days for SSE  
  **Priority:** MEDIUM — polling is fine for MVP. SSE is V1.1.

- **Onboarding flow (first-time UX)**: "Plant a Seed" metaphor documented. Provider detection flow specified in onboarding doc. But the actual first-run dashboard UX isn't designed. **Missing:** What does a new user see on first login? Empty state designs. Guided tour / tooltips? "Add your first URL" CTA placement. How the "Monitor Stripe" quick-add buttons work in the UI.  
  **Effort:** 4 hours UX design  
  **Priority:** MEDIUM — important for conversion but can iterate post-launch

- **Settings pages**: Account, billing, integrations UX mentioned but not designed. **Missing:** Settings page layout, billing portal integration (Stripe Customer Portal or custom?), integration management UI, notification preference UI.  
  **Effort:** 1 day design + 2 days implementation  
  **Priority:** MEDIUM — functional but ugly is fine for MVP

- **Mobile responsiveness**: The spec says "responsive: falls back to unified diff on mobile." **Missing:** Responsive breakpoints, mobile navigation pattern, touch-friendly diff interaction. Whether the dashboard works on mobile at all or is desktop-only for MVP.  
  **Effort:** 1 day  
  **Priority:** LOW — most developers use desktop. Can add mobile in V1.1.

### Business

- **Stripe Checkout flow (upgrade/downgrade details)**: Described conceptually. **Missing:** Proration behavior on mid-cycle upgrade. What happens to in-flight checks during plan change. How the "excess URLs paused" logic works in practice (which URLs get paused? User choice or automatic?). Stripe Customer Portal integration for self-service plan management.  
  **Effort:** 4 hours  
  **Priority:** MEDIUM — Week 5

- **GDPR compliance**: Data export endpoint planned (`GET /v1/account/export`). `deleteUserData()` function specified in Unknown Solutions. Privacy policy outline in the spec. **Missing:** Data Processing Agreement (DPA) template for EU customers. Sub-processor list documentation (Railway, Stripe, Resend, Cloudflare). Cookie consent (if dashboard uses analytics). Data retention documentation for privacy policy.  
  **Effort:** 1 day + $500-1000 legal review  
  **Priority:** MEDIUM — privacy policy is Week 5, DPA can wait for first EU customer

- **Domain registration**: chirri.io is mentioned throughout but **nobody has confirmed it's actually purchased**. The architecture doc still references `chirri.io/delta` in some places (the old name).  
  **Effort:** 30 minutes  
  **Priority:** 🔴 CRITICAL — if chirri.io isn't available, the entire brand needs adjustment. CHECK THIS IMMEDIATELY.

---

## ❌ Not Researched (Needs Full Research)

These are things we said we'd do but never researched HOW, or pure assumptions without validation.

### Technical

- **CI/CD pipeline**: Zero specification of how code gets tested and deployed. **Assumed:** "Railway deploys from GitHub." **Reality:** No CI config, no test runner config, no deploy trigger specification. What runs tests? GitHub Actions? What's the test command? How are environment variables managed across environments? Is there a staging environment? How do database migrations run during deploy?  
  **Why it matters:** Without CI/CD, deploys are manual and error-prone. Tests don't run automatically. Bad code reaches production.  
  **Effort:** 1 day to set up GitHub Actions + Railway deploy  
  **Priority:** HIGH — should be set up Week 1

- **Testing strategy**: The sprint plan mentions "unit tests" in Week 6 and "integration tests" but there's no testing specification. **Missing everything:** Test framework choice (Vitest? Jest? Node test runner?). Test file organization. What gets unit tested vs integration tested. Mock strategy for external services (Stripe, Resend, target URLs). Test database setup (separate DB? Transactions that rollback?). E2E testing (Playwright? Cypress? None?). Coverage targets. How to test the SSRF module (the 18-case test suite is described but not the test framework).  
  **Why it matters:** Without a testing plan, Week 6 "testing" will be ad-hoc and incomplete. Critical paths (SSRF, diffing, billing) may ship untested.  
  **Effort:** 4 hours to plan, ongoing to implement  
  **Priority:** HIGH — should be decided Week 1 so tests are written alongside code

- **Logging strategy**: Pino is chosen. That's it. **Missing:** Log level configuration per environment. Structured log format. What gets logged vs what doesn't (never log API keys, custom headers, response bodies). Log aggregation — where do logs go? Railway's built-in? BetterStack? Logtail? How to search logs for debugging. Log retention policy. Request ID propagation across services.  
  **Why it matters:** Without structured logging from day 1, debugging production issues is guesswork.  
  **Effort:** 4 hours  
  **Priority:** HIGH — should be configured Week 1

- **Error tracking**: Mentioned once as "Sentry? BetterStack? LogSnag?" with no decision. **Missing:** Error tracking tool choice. Integration pattern. Alert thresholds. How to distinguish between "our bug" errors and "target API returned error" errors. Source maps for dashboard frontend errors.  
  **Why it matters:** Without error tracking, you find bugs when users report them, not when they happen.  
  **Effort:** 2 hours to decide + 2 hours to integrate  
  **Priority:** MEDIUM — Pino structured logging is a reasonable substitute for Week 1-4. Add Sentry by Week 5.

- **Monitoring our own service ("who watches the watcher?")**: UptimeRobot free tier monitors `/health`. Canary URL (httpbin.org). `/internal/metrics` endpoint. But this is a collection of ideas, not a monitoring system. **Missing:** What specific metrics are tracked? What are the alert thresholds? How does the BetterStack/PagerDuty alert chain work? How do we detect silent failures (checks running but not detecting changes)? How do we detect queue backup before it becomes critical?  
  **Why it matters:** If Chirri goes down silently, users lose trust. The canary check and health endpoint are necessary but insufficient.  
  **Effort:** 4 hours  
  **Priority:** MEDIUM — basic monitoring (UptimeRobot + health check) is fine for launch. Deeper monitoring in first month.

- **Dashboard auth implementation**: JWT in HttpOnly cookie is specified. But the actual auth implementation is not researched. **Missing:** Session management library/pattern (custom? iron-session? next-auth?). CSRF token implementation for dashboard forms. HttpOnly cookie configuration (SameSite, Secure, Path, Domain). How the JWT and API key auth coexist in the same server. Middleware pattern for extracting auth from either cookie or Authorization header.  
  **Why it matters:** Auth bugs are security bugs. Getting this wrong means account takeover vulnerabilities.  
  **Effort:** 4 hours research + 1 day implementation  
  **Priority:** HIGH — blocks Week 1

### Product/UX

- **Dashboard framework choice**: NOT DECIDED. "Next.js or SvelteKit" is not a decision, it's a todo item. This is the single largest unresearched technical decision.  
  **Why it matters:** This choice affects every frontend file. Changing it later means rewriting the entire dashboard. It determines: component model, routing, SSR behavior, build tooling, deployment strategy, available UI libraries.  
  **Effort:** 2 hours to decide (both are well-understood)  
  **Priority:** 🔴 CRITICAL — must be decided before Week 4 starts. Ideally Week 1.

### Business

- **Payment failure handling (dunning)**: The Unknown Solutions doc (B-03) has a good design for the grace period and downgrade logic. But the actual Stripe dunning configuration hasn't been researched. **Missing:** Stripe Smart Retries configuration. Dunning email templates (Stripe sends automatic emails, but do we also send custom ones?). How to detect and handle chargeback disputes.  
  **Effort:** 2 hours  
  **Priority:** MEDIUM — Week 5

- **Terms of Service**: Not drafted. The spec says "ToS must cover: acceptable use, liability limitations, SLA, account termination." **Missing:** Actual ToS document. Whether to use a generator (Termly/Iubenda at $10-15/mo) or hire a lawyer ($500-1000). The acceptable use clause around monitoring third-party APIs is legally nuanced.  
  **Why it matters:** Launching without ToS exposes the business to legal liability.  
  **Effort:** $500-1000 + 4 hours to review  
  **Priority:** HIGH — must be done by Week 5 (landing page)

- **Privacy Policy**: Not drafted. Same situation as ToS. **Missing:** Actual document. Termly/Iubenda template + lawyer review.  
  **Effort:** Same as ToS (often bundled)  
  **Priority:** HIGH — must be done by Week 5

### Marketing/Launch

- **@ChirriChangelog Twitter automation**: The content strategy describes this in detail (tweet every detected change). **Missing:** How to actually automate it. Twitter/X API pricing (Basic plan: $100/month for 50K tweets! Or Free tier: 1,500 tweets/month with write-only access). Authentication (OAuth 2.0 or API key?). Tweet formatting. Rate limits. Whether the free tier is sufficient or if this costs $100/month.  
  **Why it matters:** If Twitter API costs $100/month, it may not be worth it at launch. Need to verify the free tier works for our use case.  
  **Effort:** 2 hours research + 4 hours implementation  
  **Priority:** MEDIUM — nice to have pre-launch but not blocking

- **Programmatic SEO pages**: `chirri.io/monitor/{provider}` with auto-populated data. **Missing:** How these pages are technically built. Are they statically generated at build time? Server-rendered on request? Populated from a CMS or JSON file? How do they get provider monitoring data before launch (no data yet)? SEO meta tags and schema.org markup.  
  **Why it matters:** Without technical implementation, these are just ideas on paper.  
  **Effort:** 1 day  
  **Priority:** MEDIUM — Week 5 landing page build

- **Blog platform**: "5 blog posts for launch month" but no specification of what powers the blog. **Missing:** Blog platform choice (built into Next.js/SvelteKit with MDX? Separate Hashnode/Ghost? Substack?). CMS or markdown files in repo? RSS feed for the blog itself?  
  **Effort:** 2 hours to decide  
  **Priority:** MEDIUM — Week 5

- **Newsletter tool**: The content strategy mentions newsletter but doesn't specify the tool. **Missing:** Newsletter platform choice (Resend for newsletters too? Buttondown? ConvertKit? Substack?). Signup form implementation. GDPR compliance for newsletter (double opt-in for EU).  
  **Effort:** 1 hour to decide  
  **Priority:** LOW — not needed for launch, first month

- **Analytics**: "PostHog (free tier)" mentioned once. **Missing:** PostHog integration plan. What events to track. Funnel definition (signup → add URL → detect change → upgrade). Whether PostHog's free tier (1M events/month) is sufficient. Alternative: Plausible for privacy-friendly analytics.  
  **Effort:** 2 hours  
  **Priority:** LOW — can add post-launch. Not blocking.

---

## Gap Ranking by Impact

### 🔴 Would Block Us From Building (Fix in Week 1)

| # | Gap | Current State | Action Required |
|---|-----|--------------|-----------------|
| 1 | **Dashboard framework choice** | "Next.js or SvelteKit" — undecided | Decide NOW. Recommendation: Next.js (App Router) — larger ecosystem, more hiring pool, shadcn/ui components. |
| 2 | **Domain chirri.io purchased?** | Referenced everywhere but never confirmed | Verify domain registration TODAY. If taken, need Plan B immediately. |
| 3 | **CI/CD pipeline** | Zero specification | Set up GitHub Actions + Railway deploy hook in Week 1. |
| 4 | **Testing strategy** | No test framework, no plan | Choose Vitest (fast, ESM-native). Set up in Week 1. |
| 5 | **Drizzle ORM validation** | Chosen but not validated | Prototype with 3-4 tables in Week 1 to confirm it handles our schema. |
| 6 | **Logging (Pino configuration)** | Library chosen, nothing else | Configure structured logging with request IDs in Week 1. |
| 7 | **Auth implementation details** | JWT concept, no library/pattern | Choose jose for JWT, implement auth middleware Week 1. |

### 🟡 Would Cause a Production Incident (Fix Before Launch)

| # | Gap | Risk | Action Required |
|---|-----|------|-----------------|
| 1 | **HTML text extraction** (for changelog scanning) | Broken keyword scanning → missed early warnings | Choose `@mozilla/readability` or `cheerio`. Test against 10 real changelogs. |
| 2 | **undici DNS pinning verification** | SSRF bypass if API doesn't work as expected | Test against target Node.js version in Week 2. |
| 3 | **Postgres partitioning on Railway** | Table locks, slow queries at scale | Verify Railway Postgres version + test native partitioning in Week 1. |
| 4 | **Error tracking tool** | Bugs discovered by users, not by us | Add Sentry free tier by Week 5. |
| 5 | **Terms of Service / Privacy Policy** | Legal liability | Draft via Termly + lawyer review by Week 5. |

### 🟠 Would Waste Developer Time (Fix First Month)

| # | Gap | Waste | Action Required |
|---|-----|-------|-----------------|
| 1 | **Diff viewer library** | Could spend 2 weeks on wrong approach | Research `react-diff-viewer-continued` or Monaco diff before Week 4. |
| 2 | **RSS/XML parsing library** | Reinventing XML parsing | Choose `rss-parser` for RSS, `fast-xml-parser` for Atom. |
| 3 | **Slack Block Kit format** | Back-and-forth on message formatting | Design Slack notification template once, reuse for Discord. |
| 4 | **Twitter API pricing** | May spend time building automation that costs $100/month | Research X API free tier limits before investing time. |
| 5 | **Blog platform** | Setting up infrastructure that doesn't matter yet | MDX files in Next.js repo. Simplest possible. |
| 6 | **Newsletter tool** | Premature optimization | Use Resend for launch announcements. Add Buttondown later. |

---

## Summary Statistics

| Category | Count |
|----------|-------|
| ✅ Fully Researched | 26 topics |
| ⚠️ Partially Researched | 24 topics |
| ❌ Not Researched | 13 topics |
| **Total gaps requiring action** | **37** |
| 🔴 Critical (blocks building) | 7 |
| 🟡 High (production incident risk) | 5 |
| 🟠 Medium (wastes time) | 6 |
| Low priority (can wait) | 19 |

## The Bottom Line

The spec is **remarkably thorough** for a pre-build document — 26 topics are fully researched with implementation-ready detail. The security, SSRF prevention, false positive cascade, and early warning system are better documented than most production systems.

The critical gaps are:
1. **Dashboard framework choice** — must decide before any frontend work starts
2. **Domain registration verification** — existential risk if chirri.io is taken
3. **CI/CD + testing** — the plumbing that everything else depends on
4. **Drizzle ORM validation** — verify it handles the schema before building on it

Everything else is either partially researched (needs 2-8 hours to close the gap) or can be deferred to first month post-launch.

---

*Created: 2026-03-24*  
*Author: Opus (Research Gap Auditor)*  
*Documents reviewed: 21 (all spec documents)*  
*Total content reviewed: ~25,000+ lines across all documents*
