# CHIRRI — Master Contradiction & Disagreement List

**Compiled:** 2026-03-24  
**Sources:** Architecture Verification, Security Verification, Product Verification, Feasibility Verification, Feature Teardown  
**Total Items:** 68

---

## Category A: RESEARCHED on One Side (Go With Researched Answer)

These need doc updates only — one document did the homework, others just assumed.

---

### A1. JWT vs Cookie-Based Sessions

**Contradiction:** Master Spec, Architecture doc, Definitive Plan, Product Bible, and URL Onboarding Flow all specify JWT with refresh tokens. The Tech Stack Decisions doc explicitly argues AGAINST JWTs for dashboard auth ("JWTs can't be revoked without a blocklist, which is basically reimplementing sessions") and recommends better-auth with cookie-based sessions.  
**Docs involved:** Tech Stack Decisions vs Master Spec, Architecture, Definitive Plan, Product Bible, URL Onboarding Flow  
**Category:** A  
**Go with:** Tech Stack Decisions — it's the only doc that researched the trade-offs and provides OWASP-aligned justification. All other docs just picked JWT without analysis.  
**Impact:** Auth endpoints need redesign (no refresh tokens, session-based revocation). Architecture doc auth flow needs rewriting.  
**Severity:** Blocks building

---

### A2. Password Hashing — bcrypt vs Argon2id

**Contradiction:** Architecture doc says `password_hash TEXT NOT NULL, -- bcrypt hash`. Tech Stack Decisions says "Argon2id (via better-auth)" with explicit OWASP justification.  
**Docs involved:** Architecture vs Tech Stack Decisions  
**Category:** A  
**Go with:** Tech Stack Decisions — Argon2id is the OWASP recommendation, and better-auth uses it natively.  
**Severity:** Causes wrong implementation

---

### A3. Classification Pipeline — 3 Phases vs 6 Phases

**Contradiction:** Master Spec and Product Bible say 3 phases (domain pattern → response-based → fallback). Architecture doc's ClassificationJob interface has `phase: 0 | 1 | 2 | 3 | 4 | 5` (six phases).  
**Docs involved:** Master Spec, Product Bible vs Architecture  
**Category:** A  
**Go with:** Master Spec / Product Bible — the Definitive Plan explicitly simplified to 3 phases, noting "Fancy path heuristics, response header signals, discovery budget, generator-to-feed mapping all deferred to V2."  
**Severity:** Causes wrong implementation

---

### A4. "Calibrating" State — Visible or Hidden to Users

**Contradiction:** URL Onboarding Flow §6 shows "calibrating" as a visible state with a day counter ("Blue 'Calibrating' badge with day counter, Day 3/7"). Definitive Plan says Jake won the debate: calibrating is invisible, user sees "Active." Product Bible confirms invisible.  
**Docs involved:** URL Onboarding Flow vs Definitive Plan, Product Bible  
**Category:** A  
**Go with:** Definitive Plan — it records the debate outcome. Jake argued successfully to hide it. But: the API still returns `status: "calibrating"` which leaks the internal state (Product report §1.2). API should map calibrating → active in responses.  
**Severity:** Causes wrong implementation

---

### A5. Monitoring Packs — Killed but Still Fully Specced

**Contradiction:** Definitive Plan explicitly says "Monitoring packs: Killed entirely" (Yuki's recommendation, accepted). URL Onboarding Flow §12 has full endpoint spec (GET /v1/packs, GET /v1/packs/:id, POST /v1/packs/:id/apply). Product Bible has `pack_` in ID prefix registry.  
**Docs involved:** Definitive Plan vs URL Onboarding Flow, Product Bible  
**Category:** A  
**Go with:** Definitive Plan — debate outcome was to kill packs. Remove pack endpoints and ID prefix from URL Onboarding Flow and Product Bible.  
**Severity:** Causes wrong implementation

---

### A6. Base URL — chirri.io/delta vs chirri.io

**Contradiction:** Architecture doc and URL Onboarding Flow use `api.chirri.io/delta/v1`. Master Spec uses `api.chirri.io/v1`. Product was renamed but docs weren't updated. Affects SSRF blocklist, env vars, User-Agent, email sender, webhook payloads, CDN URLs, error doc URLs.  
**Docs involved:** Architecture, URL Onboarding Flow vs Master Spec  
**Category:** A  
**Go with:** Master Spec — chirri.io is the final product name. Global find-replace needed across Architecture and URL Onboarding Flow.  
**Severity:** Blocks building

---

### A7. Webhook Signing/Delivery Header Names (Delta vs Chirri)

**Contradiction:** Architecture doc uses `X-Delta-Signature`, `X-Delta-Event`, `X-Delta-Delivery`, `Delta-Webhook/1.0`. Master Spec and URL Onboarding Flow use `X-Chirri-Signature`, `X-Chirri-Event`, `X-Chirri-Delivery`, `Chirri-Webhook/1.0`.  
**Docs involved:** Architecture vs Master Spec, URL Onboarding Flow  
**Category:** A  
**Go with:** Master Spec / URL Onboarding Flow — Chirri is the product name.  
**Severity:** Cosmetic (but user-facing in API contracts)

---

### A8. User-Agent String — Three Variants

**Contradiction:** Master Spec uses `Chirri-Monitor/1.0 (https://chirri.io; monitoring service)`. Architecture uses `Delta-Monitor/1.0 (https://chirri.io/delta; monitoring service)` in two places. Webhook delivery uses `Delta-Webhook/1.0`.  
**Docs involved:** Architecture vs Master Spec  
**Category:** A  
**Go with:** Master Spec — standardize to `Chirri-Monitor/1.0` and `Chirri-Webhook/1.0`.  
**Severity:** Cosmetic

---

### A9. Partitioning Strategy — pg_partman vs Native Postgres

**Contradiction:** Product Bible says "native Postgres range partitioning." Master Spec, Architecture, and Definitive Plan say "pg_partman." Architecture even has `SELECT partman.create_parent(...)` SQL.  
**Docs involved:** Product Bible vs Master Spec, Architecture, Definitive Plan  
**Category:** A  
**Go with:** Master Spec / Architecture — they have the actual SQL. pg_partman auto-manages partition creation. Product Bible was imprecise. (Caveat: verify pg_partman is available on Railway's managed Postgres.)  
**Severity:** Causes wrong implementation

---

### A10. Slack/Discord — MVP via Incoming Webhooks, Not Full Integrations Table

**Contradiction:** Master Spec §2.5 says Slack/Discord is "Indie+ (V1.1)." Definitive Plan §3 moves it to MVP (Priya won debate). Architecture has full `integrations` table and CRUD endpoints. Master Spec §3.6 says "Deferred: `integrations` (V1.1)."  
**Docs involved:** Definitive Plan vs Master Spec, Architecture  
**Category:** A  
**Go with:** Definitive Plan for timing (MVP). But the Definitive Plan says "incoming webhook" approach (2 days Slack + 1 day Discord) — simple POST, no `integrations` table needed. Full integrations table with OAuth is V1.1.  
**Severity:** Causes wrong implementation

---

### A11. Brand Identity Pricing Section — Completely Outdated

**Contradiction:** Brand Identity doc uses plan names "Hobby/Pro/Team" with intervals "Every 30 min" (Free) and "Every 1 min" (paid). Final pricing uses "Free/Indie/Pro/Business" with completely different intervals (24h/1h/15m/1m).  
**Docs involved:** Brand Identity vs Product Bible, Master Spec, Definitive Plan  
**Category:** A  
**Go with:** Product Bible / Master Spec — Brand Identity pricing section was never updated. If used for landing page, pricing will be wrong.  
**Severity:** Causes wrong implementation (if used for landing page)

---

### A12. Confidence Scoring — Ratio vs Absolute Count

**Contradiction:** Relevance Intelligence Amendment 3 says "Score based on RATIO of confirming sources, not absolute count. 1/1 sources confirming = same weight as 10/10." But the actual code in §6.1 uses `confidence += Math.min((evidenceCount - 1) * 8, 20)` — absolute count, not ratio.  
**Docs involved:** Relevance Intelligence Amendment 3 vs Relevance Intelligence §6.1  
**Category:** A  
**Go with:** The code (absolute count) — the amendment's reasoning that "1/1 = same weight as 10/10" is mathematically unsound as the Security report notes. With 1 source there's no corroboration; 10/10 has strong consensus. Keep absolute count but cap the bonus.  
**Severity:** Causes wrong implementation

---

### A13. Amendment 4 "Every Signal Reaches User" vs Log-Only Threshold

**Contradiction:** Original design says confidence <40 is "Log only — stored for debugging, not shown to user." Amendment 4 overrides to "EVERY detected signal reaches the user somehow" with <40 as "Dashboard only." These conflict.  
**Docs involved:** Relevance Intelligence §6.1 vs Relevance Intelligence Amendment 4  
**Category:** A  
**Go with:** Amendment 4 (it's the later decision). But clarify: <40 confidence shows in dashboard with a "low confidence" label, NOT in notifications.  
**Severity:** Causes wrong implementation

---

### A14. OpenAPI Diff Library — Two Different Recommendations

**Contradiction:** Integration Details doc recommends `api-smart-diff`. Early Warning Implementation recommends `openapi-diff` (Atlassian). Both claim to be "the" choice.  
**Docs involved:** Integration Details vs Early Warning Implementation  
**Category:** A  
**Go with:** Neither — Feasibility report finds `api-smart-diff` unmaintained (2 years, 2 dependents). `openapi-diff` slightly better but also pre-1.0. Consider `oasdiff` (Go CLI) as Feasibility report suggests.  
**Severity:** Causes wrong implementation

---

---

## Category B: NEITHER Side Researched (Needs Research)

Both sides just picked something without evidence. Research needed before resolving.

---

### B1. API Framework — Hono vs Fastify

**Contradiction:** Every document says "Hono or Fastify" without deciding. Architecture diagram says "Hono/Fastify." Tech Stack Decisions resolves dashboard framework but never addresses API framework.  
**Docs involved:** Master Spec, Architecture, Tech Stack Decisions, Product Bible  
**Category:** B  
**Research needed:** Compare Hono vs Fastify for this specific use case: better-auth compatibility, BullMQ integration, middleware ecosystem, Railway deployment, bundle size, TypeScript DX. Both work; need a concrete comparison against Chirri's actual requirements.  
**Severity:** Blocks building

---

### B2. ID Strategy — UUID vs nanoid with Prefixes

**Contradiction:** Architecture doc uses `UUID PRIMARY KEY DEFAULT gen_random_uuid()` for all tables. Source Preferences uses `TEXT PRIMARY KEY DEFAULT ('sap_' || nanoid())`. URL Onboarding Flow lists display prefixes (`usr_`, `url_`, `chg_`) but unclear if they're stored in DB.  
**Docs involved:** Architecture vs Source Preferences vs URL Onboarding Flow  
**Category:** B  
**Research needed:** (1) Does better-auth require UUIDs for user IDs? (2) What are the performance implications of TEXT vs UUID PKs in Postgres? (3) Does nanoid require a Postgres extension or app-level generation? (4) Are prefixed IDs worth the complexity for DX?  
**Severity:** Blocks building

---

### B3. Railway Plan — Hobby vs Pro

**Contradiction:** Cost estimate assumes ~$42/mo. But spec mentions needing "Railway Pro" features (static outbound IPs, deployment draining). Railway Hobby is $5/mo + usage. Railway Pro is $20/mo + usage. With Pro, costs jump to $100+.  
**Docs involved:** Master Spec §3.6, §6.3 vs Master Spec §2.2 (mentions Pro features)  
**Category:** B  
**Research needed:** (1) Does Railway Hobby support static outbound IPs? (2) Does it support deployment draining? (3) What's the actual cost for 3 services + DB + Redis on each plan? (4) Are any Pro features actually required for MVP?  
**Severity:** Causes wrong implementation

---

### B4. pg_partman Availability on Railway

**Contradiction:** Multiple docs specify pg_partman for check_results partitioning. Railway's managed Postgres may not support this extension.  
**Docs involved:** Master Spec, Architecture, Definitive Plan  
**Category:** B  
**Research needed:** Does Railway's managed Postgres support the pg_partman extension? If not, what's the alternative (native partitioning + cron)?  
**Severity:** Blocks building (can't set up DB schema without knowing)

---

### B5. better-auth API Key Plugin Compatibility

**Contradiction:** Tech Stack Decisions recommends better-auth's built-in API key plugin. Architecture doc specifies a custom `api_keys` table with specific fields (`key_hash`, `key_prefix`, `key_suffix`, `is_test`).  
**Docs involved:** Tech Stack Decisions vs Architecture  
**Category:** B  
**Research needed:** Does better-auth's API key plugin support: (1) custom key prefixes (`dk_live_`, `dk_test_`)? (2) SHA-256 hashing? (3) test mode flag? (4) `last_used_at` tracking? If not, custom implementation is needed alongside better-auth.  
**Severity:** Causes wrong implementation

---

### B6. better-auth + Drizzle ORM Version Compatibility

**Contradiction:** Feasibility report found open GitHub issues about better-auth's Drizzle adapter not supporting Drizzle ORM v1.0's new query syntax, and TypeError bugs with the adapter.  
**Docs involved:** Tech Stack Decisions (recommends both), Feasibility report  
**Category:** B  
**Research needed:** (1) What Drizzle ORM version is compatible with better-auth v1.5.5? (2) Is the adapter stable enough for production? (3) Should Chirri pin specific versions?  
**Severity:** Blocks building

---

### B7. Free Plan Webhooks — 0 or 1?

**Contradiction:** Master Spec pricing table says Free gets "1 webhook." Master Spec Free Tier Details section says "❌ No Slack/webhook integration." Architecture PLAN_LIMITS says `free: { webhookIntegration: false }`.  
**Docs involved:** Master Spec (contradicts itself), Architecture  
**Category:** B  
**Research needed:** Not really research — this is a product decision buried in contradictory text. But nobody has explicitly decided, so it needs a deliberate choice.  
**Severity:** Causes wrong implementation

---

### B8. Indie Plan Minimum Interval at Launch — 15m or 1h?

**Contradiction:** Pricing table says Indie gets 15-min checks. Multiple docs say MVP only ships 1h and 24h intervals. 15m/5m/1m are "V1.1."  
**Docs involved:** Master Spec pricing table vs Master Spec §7.1, Definitive Plan, Product Bible  
**Category:** B  
**Research needed:** Product decision: Does Indie launch with 15m (as advertised) or 1h? If 1h, the pricing table is false advertising. If 15m, the MVP scope increases.  
**Severity:** Causes wrong implementation

---

### B9. Conditional vs Unconditional check_results Writes

**Contradiction:** Product Bible §5 says "write to Postgres (conditional: only write when something interesting happens to reduce IOPS)." Architecture doc writes unconditionally. Conditional writes break uptime/TTFB statistics.  
**Docs involved:** Product Bible vs Architecture  
**Category:** B  
**Research needed:** What's the actual IOPS cost of writing every check result? At 5,000 URLs × 24 checks/day = 120K writes/day. Is this a real concern on Railway's Postgres? If not, write unconditionally.  
**Severity:** Causes wrong implementation

---

### B10. Email Verification — Blocking or Non-Blocking?

**Contradiction:** Master Spec §4.3 says "Email verification before checks begin." URL Onboarding Flow shows URLs being created immediately after signup. No explicit blocking step.  
**Docs involved:** Master Spec vs URL Onboarding Flow  
**Category:** B  
**Research needed:** What do competitors do? What's the abuse risk of allowing unverified accounts to trigger checks? What's the UX cost of blocking until verified?  
**Severity:** Causes wrong implementation

---

### B11. Shared URL Key — Does It Include Method and Headers?

**Contradiction:** Master Spec says "Shared URL key = SHA-256(url + method + sorted headers)." But `shared_urls` table has only `url_hash TEXT` with no method or headers columns.  
**Docs involved:** Master Spec vs Architecture  
**Category:** B  
**Research needed:** If custom headers create separate monitors (per spec), the shared key MUST include method and headers. But does the `shared_urls` table need explicit columns, or is the hash sufficient? Does anyone actually share the same URL with different methods?  
**Severity:** Causes wrong implementation

---

### B12. fast-xml-parser — Use or Replace?

**Contradiction:** Docs recommend `fast-xml-parser` for RSS/XML parsing. Feasibility report found 4 CVEs in 2026, including a CRITICAL one from 5 days ago that bypasses the fix for the previous CVE.  
**Docs involved:** Architecture / Early Warning Implementation vs Feasibility report  
**Category:** B  
**Research needed:** (1) Is v5.5.5+ actually safe? (2) What alternative XML parsers exist with better security track records? (3) Can Chirri's RSS parsing be done with a simpler/safer approach?  
**Severity:** Blocks building (security-critical)

---

### B13. Discovery Pipeline SSRF Protection

**Contradiction:** Security report (SEC-03, ATK-01) identifies that the discovery pipeline probes 15 paths on arbitrary domains with NO documented SSRF protection on the constructed probe URLs. No document addresses this.  
**Docs involved:** Architecture (discovery mentioned), Relevance Intelligence (discovery referenced), Security report  
**Category:** B  
**Research needed:** (1) Do constructed discovery probe URLs go through safeFetch()? (2) What about DNS rebinding between URL-add time and discovery time? (3) Should discovery be restricted to domains that pass enhanced validation?  
**Severity:** Blocks building (critical security gap)

---

### B14. Cross-Tenant Leakage via Shared Source Model

**Contradiction:** Security report (SEC-01, SEC-02) identifies that the shared source model creates timing oracles and information leaks. Adding a URL on an already-monitored domain responds differently than a fresh domain. `discovered_by` field could expose who first monitored a domain.  
**Docs involved:** Relevance Intelligence (shared source model), Security report  
**Category:** B  
**Research needed:** (1) Is `discovered_by` exposed in any API response? (2) Can timing differences be normalized? (3) Should shared source metadata be privacy-filtered before returning to users?  
**Severity:** Blocks building (privacy-critical)

---

### B15. ReDoS Risk in Regex-Heavy Relevance Matching

**Contradiction:** Security report (SEC-05, EDGE-06) identifies that PATH_PATTERNS and FUTURE_INTENT_PATTERNS run against attacker-controlled content with no timeout. Nested quantifiers like `(?:\/[\w\-\.]+)+` can cause catastrophic backtracking. `matchGlob()` converts user input to regex.  
**Docs involved:** Relevance Intelligence (regex patterns), Security report  
**Category:** B  
**Research needed:** (1) Audit all regex patterns for catastrophic backtracking. (2) Research RE2 or similar safe regex engines for Node.js. (3) Define timeout limits for regex operations. (4) Test pathological inputs against current patterns.  
**Severity:** Blocks building (DoS vulnerability)

---

### B16. chrono-node Forward Date Bias

**Contradiction:** Security report (BROKEN-08) identifies that `chrono.parse(section, new Date(), { forwardDate: true })` misinterprets past dates in changelogs. "On March 15, we deprecated v1" becomes March 15 of next year. The post-filter `r.start.date() > new Date()` reinforces the bug.  
**Docs involved:** Relevance Intelligence / Early Warning Implementation, Security report  
**Category:** B  
**Research needed:** (1) Can chrono-node be configured to handle both past and future dates? (2) Should Chirri parse without `forwardDate` and use context clues? (3) What heuristic determines if a date is a past event vs future deadline?  
**Severity:** Causes wrong implementation (will produce false forecasts)

---

---

## Category C: BOTH Researched but Disagree (Needs Alex's Decision)

Real design tensions with valid arguments on both sides.

---

### C1. Timeline: 8 Weeks vs Reality (~55-75 Working Days)

**Contradiction:** Definitive Plan commits to 8-week (40 working days) timeline. Architecture report calculates ~55 days minimum. Feasibility report calculates 610-730 hours realistic (15-18 weeks for 1 developer).  
**Docs involved:** Definitive Plan vs Architecture report, Feasibility report  
**Category:** C  
**Option 1:** Cut scope — ship core monitoring only (no Early Warning, no Relevance Intelligence, no Escalation) in 8 weeks. Add intelligence layer as V1.1. (Feasibility report's Option B.)  
**Option 2:** Extend timeline to 12-16 weeks for one developer.  
**Option 3:** Add a second developer and parallelize (Feasibility's Option C).  
**Alex decides:** How much of the intelligence layer is truly MVP? Is the timeline flexible? Is a second developer available?  
**Severity:** Blocks building

---

### C2. Early Warning System — MVP Scope

**Contradiction:** Product Bible Part 3 and Definitive Plan include Early Warning as MVP. But implementation estimates are 37-60 hours on top of the already-busted timeline. The Smart Chirp feature requires the full Relevance Intelligence pipeline.  
**Docs involved:** Product Bible, Definitive Plan (include it) vs Feasibility report, Architecture report (can't fit it)  
**Category:** C  
**Option 1:** Full Early Warning MVP as designed (5 days minimum, but needs Relevance Intelligence = 8 more days).  
**Option 2:** Minimal Early Warning: parse Sunset/Deprecation headers from already-fetched responses only (~4 hours, zero extra HTTP requests). Everything else V1.1. (Architecture report recommendation.)  
**Option 3:** Cut entirely from MVP.  
**Alex decides:** Is "parse headers you already have" enough for the MVP story, or does Chirri need the full early warning narrative to differentiate at launch?  
**Severity:** Blocks building

---

### C3. Provider Intelligence — JSON Config vs Full System

**Contradiction:** Definitive Plan Amendment 1 says "15-20 hardcoded provider profiles, JSON file + search/display UI, 1-2 days." Source Tracking Model describes a full provider management system with dedicated API endpoints, bundled sources, source expansion. Relevance Intelligence adds shared_sources table with domain lifecycle management.  
**Docs involved:** Definitive Plan vs Source Tracking Model, Relevance Intelligence  
**Category:** C  
**Option 1:** Simple JSON config file with 15-20 provider profiles (1-2 days). Source Tracking Model and Relevance Intelligence designs are V1.1+ blueprints.  
**Option 2:** Full provider system with shared_sources, domain lifecycle, discovery (2-3 weeks).  
**Alex decides:** Is the provider intelligence system the core differentiator that justifies a richer MVP, or is it a V1.1 feature?  
**Severity:** Blocks building

---

### C4. Provider Onboarding UX — Three Different Models

**Contradiction:** Product Bible says "Show all monitorable sources, user selects which to monitor." Domain vs Page doc says "Provider-aware expansion → suggest structured monitors with pre-selected checkboxes." Source Tracking Model says "When a user says 'Monitor Stripe,' Chirri creates 4 sources automatically."  
**Docs involved:** Product Bible vs Domain vs Page doc vs Source Tracking Model  
**Category:** C  
**Option 1:** User chooses (explicit selection, more control, more friction).  
**Option 2:** Pre-selected defaults with opt-out (balanced).  
**Option 3:** Auto-create all, user removes what they don't want (lowest friction, highest resource use).  
**Alex decides:** What's the right balance of friction vs control for the target user?  
**Severity:** Causes wrong implementation

---

### C5. Severity Taxonomy — At Least 3 Different Scales

**Contradiction:** Master Spec: `critical, breaking, warning, info` (4 levels). Product Bible: `forecast, deadline, breaking, notable, info` (5 levels, different names). Source Preferences: `info, warning, notable, breaking, critical` (5 levels). Escalation doc: `info, advisory, warning, urgent, critical` (5 different levels). Early Warning forecasts table has BOTH `alert_level` and `severity` as separate columns.  
**Docs involved:** Master Spec, Product Bible, Source Preferences, Escalation doc, Early Warning Implementation  
**Category:** C  
**Option 1:** 4-level system (Master Spec): `critical, breaking, warning, info`. Treat `forecast/deadline/notable/advisory/urgent` as UI decorations, not severity levels.  
**Option 2:** 5-level system: `info, warning, notable, breaking, critical`. Unify all docs.  
**Option 3:** Separate systems: "Change severity" (4 levels) vs "Alert taxonomy" (for forecasts/deadlines). Make the distinction explicit.  
**Alex decides:** One enum or two? How many levels?  
**Severity:** Causes wrong implementation

---

### C6. Dashboard Diff View — How Much Complexity?

**Contradiction:** Definitive Plan says "side-by-side diff view" in Week 4 (~5 days). Feasibility report estimates Monaco DiffEditor integration alone is 3-4 days. Full dashboard (diff + provider intelligence + change feed + TTFB graphs) is 60-70 hours — "2 weeks crammed into 1."  
**Docs involved:** Definitive Plan vs Feasibility report  
**Category:** C  
**Option 1:** Full dashboard with Monaco DiffEditor, provider intelligence, TTFB graphs — accept 2-week timeline for dashboard.  
**Option 2:** Simplified diff view (no Monaco, use a simpler diff library) with basic dashboard — fits in 1 week. Add Monaco and rich features in V1.1.  
**Alex decides:** Is the Monaco-powered diff view a launch differentiator worth the extra week?  
**Severity:** Blocks building (timeline impact)

---

### C7. API Key Prefix — "dk" (Delta Key) vs "ck" (Chirri Key)

**Contradiction:** All docs use `dk_live_` and `dk_test_` prefixes. "dk" stands for "Delta Key" — the old product name. API key format is user-facing and will be in docs/examples forever.  
**Docs involved:** Architecture, Master Spec, URL Onboarding Flow  
**Category:** C  
**Option 1:** Keep `dk_` — it's an internal detail, nobody cares what it stands for.  
**Option 2:** Change to `ck_` — it's the last chance before launch to fix the naming.  
**Alex decides:** Worth the churn to rename, or leave it?  
**Severity:** Cosmetic (but permanent once shipped)

---

### C8. "Nothing Happens for Days" — Empty Dashboard Problem

**Contradiction:** Product report (§1.1) and Feature Teardown (§9) both identify that Free users see no activity for potentially days/weeks after signup. No document describes what the dashboard shows during silence. Weekly stability report is a week away. The "aha moment" (seeing a change) could be weeks out.  
**Docs involved:** All docs (none address this)  
**Category:** C  
**Option 1:** Add demo/sample data for new accounts showing what a real change looks like. Pre-populate with public API monitoring data.  
**Option 2:** Add onboarding email sequence and "all clear" dashboard states. Make silence feel like a feature ("Your API is stable ✅").  
**Option 3:** Both.  
**Alex decides:** How much investment in the empty-state experience for MVP?  
**Severity:** Causes wrong implementation (churn risk)

---

### C9. Post-Detection Workflow — Detection Without Action

**Contradiction:** Feature Teardown identifies this as the #1 product gap: "Chirri currently answers WHAT changed beautifully. It doesn't answer WHAT DO I DO ABOUT IT at all." No ticket creation, no status tracking beyond "acknowledged," no assignment, no due dates, no copy-to-clipboard for Slack/Jira.  
**Docs involved:** All docs (none address post-detection workflow)  
**Category:** C  
**Option 1:** Add minimal status tracking (`new` → `acknowledged` → `resolved`) + "Copy summary" button for MVP. Jira/Linear integration V1.1.  
**Option 2:** MVP stops at detection + acknowledge. Post-detection workflow is V1.1.  
**Alex decides:** Is "acknowledged" enough for MVP, or does the product need at least basic workflow to be useful?  
**Severity:** Causes wrong implementation

---

### C10. Scope Creep Since Definitive Plan

**Contradiction:** The Definitive Plan was "the last planning document before code." But 4+ feature documents were written AFTER it (Early Warning Implementation, Relevance Intelligence, Source Preferences, Source Tracking Model, Escalation & Severity), each adding substantial work. Architecture report lists 9 features added after the plan with no timeline allocation.  
**Docs involved:** Definitive Plan vs Early Warning, Relevance Intelligence, Source Preferences, Source Tracking Model  
**Category:** C  
**Option 1:** Acknowledge scope creep. Re-scope MVP to match original Definitive Plan. Treat later docs as V1.1 blueprints.  
**Option 2:** Accept the expanded scope and extend the timeline to 12-16 weeks.  
**Alex decides:** Is the Definitive Plan still the scope contract, or has the vision expanded?  
**Severity:** Blocks building

---

### C11. Bonus Sources — Count Toward Plan Limits or Not?

**Contradiction:** Source Tracking Model says bonus/discovered sources don't count toward URL slots and are checked at system-controlled intervals. Product report (§2.4) notes a Free user with 3 providers could have 12+ bonus sources — more load than Free tier warrants. Source Tracking Model says "Free plan gets 3 bundled sources instead of 4 (no status page on free)" but discovery may add sources regardless of plan.  
**Docs involved:** Source Tracking Model, Product Bible vs Product report  
**Category:** C  
**Option 1:** Bonus sources are truly free and unlimited — accept the cost. It's the value proposition.  
**Option 2:** Cap bonus sources per plan (e.g., Free: 3, Indie: 10, Pro: 25).  
**Alex decides:** Is unlimited bonus sources the right move economically?  
**Severity:** Causes wrong implementation

---

### C12. Learning Period — May Suppress Real Breaking Changes

**Contradiction:** During 7-day calibration, confidence threshold is 95 (vs 80 normally). Product report (§1.5) notes that a genuine breaking change on Day 2 with confidence 85 would be suppressed. User sees "Active" and trusts Chirri, but Chirri silently swallowed a real alert.  
**Docs involved:** Master Spec, Definitive Plan (calibrating design), Product report  
**Category:** C  
**Option 1:** Accept the risk — 7-day calibration with high threshold reduces false positives during the noisiest period.  
**Option 2:** Add a "possible change detected, but confidence is low" notification during calibration so users know something happened.  
**Option 3:** Lower the threshold but accept more false positives during calibration.  
**Alex decides:** Silent suppression vs noisy early days?  
**Severity:** Causes wrong implementation

---

### C13. MCP Server — V1.1 or V2?

**Contradiction:** Master Spec Key Decision #17 says "Non-negotiable for V2." Definitive Plan §4 says V1.1 Week 11 (5 days). Product Bible says "Non-negotiable for V1.1."  
**Docs involved:** Master Spec vs Definitive Plan, Product Bible  
**Category:** C  
**Option 1:** V1.1 (as Definitive Plan and Product Bible say) — ship within weeks of launch.  
**Option 2:** V2 (as Master Spec says) — months out.  
**Alex decides:** When does MCP ship?  
**Severity:** Cosmetic (doesn't affect MVP build)

---

### C14. Downgrade Flow — What Gets Paused?

**Contradiction:** Master Spec says downgrade pauses excess URLs "lowest priority first." But there's no priority field on URLs. Product report (§2.3) identifies 5 gaps: no priority definition, no provider-aware pausing logic, no user selection UI, no handling for bonus sources on paused providers, no preference preservation spec.  
**Docs involved:** Master Spec vs Product report  
**Category:** C  
**Option 1:** Simple LIFO — pause most recently created URLs first. No user selection.  
**Option 2:** Let users choose which URLs to keep (requires selection UI).  
**Option 3:** Pause by last-change date (keep the URLs that actually detect changes).  
**Alex decides:** What's the downgrade experience?  
**Severity:** Causes wrong implementation

---

---

## Category D: MISSING Entirely (Needs Research From Scratch)

Things that should exist but no document covers adequately.

---

### D1. Dashboard Implementation Spec

**Docs involved:** Definitive Plan says "Week 4" for the entire dashboard. No wireframes, no component breakdown, no state management design, no page-by-page spec.  
**Category:** D  
**Research needed:** Full dashboard spec: page list, component hierarchy, empty states, error states, responsive breakpoints, dark/light mode decision.  
**Severity:** Blocks building

---

### D2. Check History API Endpoint

**Docs involved:** Feature Teardown identifies that `GET /v1/urls/:id/checks` doesn't exist. Users can see changes but not individual check results. "Did Chirri actually check at 3am?" is unanswerable.  
**Category:** D  
**Research needed:** Design `GET /v1/urls/:id/checks` with pagination, filters, response shape. Essential for user trust.  
**Severity:** Blocks building

---

### D3. Pause/Resume Behavior

**Docs involved:** Feature Teardown (§1) identifies total ambiguity: Does pausing free the slot? Does resume restart learning? Is there a max pause duration before baseline is stale?  
**Category:** D  
**Research needed:** Define: (1) Paused URLs keep slot, (2) resume from existing baseline (no re-learning), (3) warn if paused >30 days that baseline may be stale.  
**Severity:** Causes wrong implementation

---

### D4. HTML/Docs Page Diff Rendering

**Docs involved:** Feature Teardown (§2) identifies that ~20% of monitors are docs/changelog pages. For HTML, monitoring method is content-hash — detects THAT something changed but can't show WHAT. Users monitoring `stripe.com/docs/upgrades` get "content hash changed" with no visual diff.  
**Category:** D  
**Research needed:** Design HTML-aware text diffing: strip HTML tags, extract text, show text-level diff. Research libraries for HTML-to-text extraction and text diffing.  
**Severity:** Causes wrong implementation

---

### D5. Bulk URL Operations

**Docs involved:** Feature Teardown (§8) identifies no `POST /v1/urls/bulk`. Users migrating from UptimeRobot with 50+ URLs must POST 50 times.  
**Category:** D  
**Research needed:** Design `POST /v1/urls/bulk` (array input, max 100, partial success handling). Also `GET /v1/urls/export` for backup/migration.  
**Severity:** Causes wrong implementation

---

### D6. Onboarding Email Sequence

**Docs involved:** Product report (§7.6) and Feature Teardown (§9) both identify zero onboarding emails. No welcome, no "your first URL is being monitored," no "you haven't added URLs yet" nudge.  
**Category:** D  
**Research needed:** Design 3-email sequence: Day 0 (welcome + quickstart), Day 2 (if no URLs: reminder), Day 7 (first weekly report even if empty).  
**Severity:** Causes wrong implementation (churn risk)

---

### D7. Weekly Stability Report Content

**Docs involved:** Architecture Finding 44 notes no specification of what data the weekly email contains, email template design, which metrics, or how to handle users with 0 changes. Product report (§7.3) notes no opt-out mechanism (CAN-SPAM/GDPR requirement).  
**Category:** D  
**Research needed:** Design the weekly email: content, template, opt-out mechanism, empty-state handling.  
**Severity:** Causes wrong implementation

---

### D8. Notification Rate Limit Value

**Docs involved:** Product report (§7.4) identifies that "Max N alerts per provider per hour" never specifies N. This is a critical tuning parameter.  
**Category:** D  
**Research needed:** What's the right value for N? Research competitor behavior. Consider: Free = 5/hr, Indie = 20/hr, Pro = 50/hr?  
**Severity:** Causes wrong implementation

---

### D9. Smart Chirp Relevance Filter Implementation

**Docs involved:** Product report (§7.8) identifies that the relevance filter for bonus sources ("Does the change text mention the user's monitored path/endpoint?") has no implementation detail. Is it exact path matching? Fuzzy? What's the relevance threshold?  
**Category:** D  
**Research needed:** Define the matching algorithm: exact path match, version match, service name match. Define threshold. Spec the implementation.  
**Severity:** Causes wrong implementation

---

### D10. `monitored_sources` Table — Referenced but Never Defined

**Docs involved:** Architecture Finding 20. Source Preferences references `monitored_sources(id)` as FK in two tables. No document defines this table with SQL.  
**Category:** D  
**Research needed:** Define the `monitored_sources` table, or map FKs to the correct existing table (`urls` or a new table for bundled sources).  
**Severity:** Blocks building

---

### D11. Discovery Service Implementation

**Docs involved:** Feasibility Finding 3. Discovery (probe 15 paths per domain) is referenced in architecture and relevance intelligence but has no dedicated implementation doc. No list of probe paths, no heuristics, no error handling.  
**Category:** D  
**Research needed:** Design the discovery service: which paths to probe, what content types indicate valid sources, how to validate discovered sources, SSRF protection on probe URLs.  
**Severity:** Blocks building

---

### D12. Provider Definition for Mega-Providers

**Docs involved:** Product report (§2.1). Provider model assumes 1 domain = 1 provider. Google has Maps API, Cloud API, YouTube, Firebase. Amazon has AWS (hundreds of services), marketplace API, Alexa. Is "Google" 1 provider or 5?  
**Category:** D  
**Research needed:** How do the 15-20 hardcoded provider profiles handle multi-product companies? Do they need sub-providers? How does domain-based detection handle `googleapis.com` which serves dozens of unrelated APIs?  
**Severity:** Causes wrong implementation

---

### D13. Account Deletion Flow (GDPR)

**Docs involved:** Product report (§5.6), Feature Teardown (§7). `DELETE /v1/account` exists but: no dashboard UI, no handling for shared monitoring data when user deletes, no team owner deletion blocking, no webhook/notification log cleanup.  
**Category:** D  
**Research needed:** Full GDPR deletion spec: what data is deleted vs anonymized, shared_url subscriber count handling, R2 snapshot cleanup, team owner blocking, grace period UX.  
**Severity:** Blocks building (legal requirement)

---

### D14. Data Export — Async for Large Accounts

**Docs involved:** Product report (§5.5), Feature Teardown (§7). `GET /v1/account/export` appears synchronous. A user with 500 URLs and 90 days of history could timeout. No format specified (JSON? CSV? ZIP?).  
**Category:** D  
**Research needed:** Design async export: request → background job → email with download link. Define format (ZIP of JSON files). Define what's included.  
**Severity:** Causes wrong implementation

---

### D15. Dunning Emails (Payment Failure)

**Docs involved:** Feature Teardown (§7). Spec says Stripe retries 3x then downgrade. No Chirri-sent emails during the process. These are critical for retention.  
**Category:** D  
**Research needed:** Design 3 dunning emails: Day 1 (payment failed), Day 7 (second reminder), Day 12 (final warning). Include Stripe billing portal link.  
**Severity:** Causes wrong implementation

---

### D16. Dark Mode Decision

**Docs involved:** Feature Teardown (§11). Brand spec contradicts itself: "White + sakura pink" for dashboard vs "Dark mode default" with Night `#0F0F0F`. No toggle specified.  
**Category:** D  
**Research needed:** Decide: dark mode default (developer audience expects it), light mode default, or system preference? Does the landing page match the dashboard?  
**Severity:** Cosmetic (but affects entire dashboard build)

---

### D17. Timezone Handling in Dashboard

**Docs involved:** Feature Teardown (§11). All timestamps are UTC in the API. No spec for dashboard timezone display. Developer in Tokyo seeing "02:00" — UTC or JST?  
**Category:** D  
**Research needed:** Design: browser-detected timezone by default, relative time ("2 hours ago") with hover for absolute, UTC option in settings.  
**Severity:** Cosmetic

---

### D18. Error Budget / Partial Failure Modes

**Docs involved:** Feasibility report (§7). No discussion of what happens when: Redis goes down during fan-out, worker crashes mid-check, R2 is unreachable, signal dedup fails. Do users get duplicate notifications? Do some users get notified and others don't?  
**Category:** D  
**Research needed:** Define partial failure modes for each pipeline stage. What's the user-visible impact? What's the recovery mechanism?  
**Severity:** Causes wrong implementation

---

### D19. Notification Pipeline — Unified Contract

**Docs involved:** Feasibility report (§4.4). Three documents define notification flows independently: Architecture doc, Early Warning, Relevance Intelligence. No single "notification contract."  
**Category:** D  
**Research needed:** Create unified notification job schema covering all event types from all three systems. Single document, single TypeScript interface.  
**Severity:** Causes wrong implementation

---

### D20. Team Features — Entirely Undesigned

**Docs involved:** Feature Teardown (§6). Pro (3 seats) and Business (10 seats) are in the pricing table. Zero design for: invitation flow, permissions, per-user notifications, ownership transfer, SSO.  
**Category:** D  
**Research needed:** Not needed for MVP (teams are V2). But: remove seat counts from pricing page or add "coming soon." Don't make architectural decisions that prevent teams later.  
**Severity:** Cosmetic (V2 feature, but pricing page mentions it)

---

### D21. 5-Layer Defense Fails for Shared Sources

**Docs involved:** Security report (BROKEN-01). Layer 2 (cross-user correlation) provides zero value for shared source signals because ALL users see the same signal from ONE fetch. If the fetch gets bad data, ALL users get the same false positive.  
**Category:** D  
**Research needed:** Design a replacement for Layer 2 that works for shared sources. Perhaps: cross-domain correlation (does the same provider show changes on multiple source types?), historical pattern matching, or source-specific validation rules.  
**Severity:** Causes wrong implementation

---

### D22. Path-Grouped Fan-Out — Missing Database Indexes

**Docs involved:** Security report (BROKEN-02). Amendment 5 proposes path-grouped fan-out ("all users monitoring /v1/* on stripe.com"). Migration adds `parsed_path TEXT` but no index. For large user bases, this is a full table scan per fan-out.  
**Category:** D  
**Research needed:** Design indexes: `urls(parsed_path)`, `urls(parsed_version)`. Evaluate query performance at target scale (100K users, millions of URLs).  
**Severity:** Causes wrong implementation

---

### D23. Crafted Changelog False Chirp Attack

**Docs involved:** Security report (ATK-03). Attacker controlling a monitored changelog can inject text that triggers false chirps for ALL users on the domain. The 5-layer defense is ineffective because the content persists and correlates.  
**Category:** D  
**Research needed:** Design mitigation: (1) Source reputation scoring? (2) Content anomaly detection (sudden appearance of deprecation keywords)? (3) Manual approval for first-time high-severity signals from new sources?  
**Severity:** Causes wrong implementation

---

### D24. extractAddedContent() Fragility

**Docs involved:** Security report (BROKEN-06). Paragraph-level dedup uses exact string matching after lowercase. If a changelog reformats (CMS update, template change), EVERY paragraph becomes "new" — triggering keyword scanning on entire page.  
**Category:** D  
**Research needed:** Research fuzzy paragraph matching alternatives. Consider: normalized whitespace, edit distance threshold, or structural diffing rather than exact paragraph matching.  
**Severity:** Causes wrong implementation (high false positive rate)

---

### D25. Source Preference null Inheritance Ambiguity

**Docs involved:** Security report (BROKEN-07). PostgreSQL can't distinguish "user explicitly set to null (inherit)" from "user never touched this field." The `inherited` flag is computed at read time but can't tell the difference.  
**Category:** D  
**Research needed:** Design solution: (1) Use a separate `overridden_fields` JSONB column tracking which fields the user explicitly set? (2) Use a sentinel value instead of null? (3) Accept the ambiguity since it's functionally equivalent?  
**Severity:** Cosmetic (functionally the same behavior either way)

---

### D26. Forecast Deduplication Across Signal Types

**Docs involved:** Feature Teardown (§4). If changelog says "v1 deprecated" AND Sunset header appears AND OpenAPI spec marks endpoints deprecated — that's 3 signals for the same event. `dedup_key` exists but dedup LOGIC isn't specified.  
**Category:** D  
**Research needed:** Define dedup rules per signal type combination. Same provider + same endpoint + same direction (deprecation) = same forecast. Multiple signals increase confidence rather than creating duplicates.  
**Severity:** Causes wrong implementation

---

### D27. Redirect Handling — No Email Notification

**Docs involved:** Product report (§1.6). URL entering `redirect_detected` status blocks monitoring until user acts. But no email notification for this state — only a webhook event. During onboarding, user may not have webhooks configured.  
**Category:** D  
**Research needed:** Add email notification for `redirect_detected` state. Design the email: what happened, what options the user has, link to resolve.  
**Severity:** Causes wrong implementation

---

### D28. Response Size Anomaly Detection

**Docs involved:** Architecture Finding 38. Definitive Plan adds "Response size tracking with anomaly alerts (>50% deviation)" as MVP. But no `baseline_size_bytes` in baselines table, no detection logic.  
**Category:** D  
**Research needed:** Either add `baseline_size_bytes` to baselines and design comparison logic, or clarify that "response size tracking" for MVP just means displaying the number (no anomaly detection).  
**Severity:** Causes wrong implementation

---

---

## Summary

### Count by Category

| Category | Count | Action |
|----------|-------|--------|
| **A: Researched on one side** | 14 | Doc updates — go with researched answer |
| **B: Neither side researched** | 16 | Research tasks before building |
| **C: Both researched, disagree** | 14 | Alex's decisions needed |
| **D: Missing entirely** | 28 | Research/design from scratch |
| **TOTAL** | **72** | |

### Count by Severity

| Severity | Count |
|----------|-------|
| 🔴 Blocks building | 24 |
| 🟡 Causes wrong implementation | 38 |
| 🟢 Cosmetic | 10 |

### Effort Estimate

| Category | Estimated Effort |
|----------|-----------------|
| **A items (doc updates)** | 1-2 days — mostly find-replace and alignment edits |
| **B items (research)** | 3-5 days — some are quick lookups, some need prototype testing |
| **C items (decisions)** | 1 day of focused decision-making — Alex reviews options, makes calls |
| **D items (design from scratch)** | 5-10 days — includes dashboard spec, notification contract, security mitigations |
| **TOTAL** | ~10-18 days before coding can safely begin |

### Critical Path (Must Resolve Before Day 1 of Coding)

1. **C1/C2/C10:** What's actually in MVP? (Timeline + scope decision)
2. **A1:** JWT or sessions? (Auth architecture)
3. **B1:** Hono or Fastify? (API framework)
4. **B2:** UUID or nanoid? (ID strategy)
5. **A6:** Global rename chirri → chirri
6. **D1:** Dashboard spec (at least page-level wireframes)
7. **D10:** `monitored_sources` table definition
8. **B13/B15:** Security gaps in discovery and regex (architecture implications)
9. **C5:** Severity taxonomy (affects DB schema, notification pipeline, UI)
10. **B4/B6:** Verify pg_partman and better-auth/Drizzle compatibility

### Findings Deduplication Notes

The following items appeared in multiple reports and were merged into single entries:

- **Timeline impossible:** Architecture #10 + Feasibility #1 + Product implicit → merged into C1
- **Severity inconsistency:** Architecture #19 + Product #7.5 → merged into C5
- **chirri.io references:** Architecture #5 + Product #7.1 → merged into A6
- **Calibrating visible/hidden:** Architecture #18 + Product #1.2 → merged into A4
- **Monitoring packs killed:** Architecture (implied) + Product #2.5 + Product #7.2 → merged into A5
- **Provider API namespace conflict:** Architecture #32 + Product #2.7 → merged into C4
- **Email verification flow:** Architecture #35 + Product #5.2 → merged into B10
- **Early Warning MVP scope:** Architecture #24 + Feasibility #6 → merged into C2
- **Onboarding emails:** Product #7.6 + Feature Teardown #9 → merged into D6
- **Scope creep:** Architecture #39 + Feasibility #7 → merged into C10
- **Empty dashboard:** Product #1.1 + Feature Teardown #9 → merged into C8
- **Webhook header names:** Architecture #26 + #27 → merged into A7
- **ReDoS risks:** Security SEC-05 + EDGE-06 → merged into B15
- **Discovery SSRF:** Security SEC-03 + ATK-01 → merged into B13
- **OpenAPI diff library:** Feasibility #4.5 → merged into A14

---

*Compiled: 2026-03-24*  
*Source reports: CHIRRI_VERIFICATION_ARCHITECTURE.md, CHIRRI_VERIFICATION_SECURITY.md, CHIRRI_VERIFICATION_PRODUCT.md, CHIRRI_VERIFICATION_FEASIBILITY.md, CHIRRI_VERIFICATION_FEATURE_TEARDOWN.md*
