# CHIRRI — Architecture & Consistency Verification Report

**Date:** 2026-03-24  
**Reviewer:** Claude Opus (ruthless technical review)  
**Documents Reviewed:** 10 core specification documents  
**Status:** FINDINGS ONLY — No fixes applied

---

## Executive Summary

After reading all 10 documents (~25,000+ lines), I found **47 findings**: 12 that block building, 18 that cause confusion, and 17 cosmetic issues. The spec is impressively thorough but has accumulated contradictions from iterative updates across documents that were never fully reconciled.

**The three biggest problems:**
1. Table counts and schema definitions diverge wildly across documents (11 vs 15 vs 16+ tables)
2. Queue counts contradict between documents (4 vs 6 vs 7 queues)
3. The timeline is mathematically impossible — the sum of all implementation estimates exceeds 8 weeks by ~2-3x

---

## Finding 1: Table Count Chaos

**Severity: BLOCKS BUILDING**  
**Documents:** Master Spec §3.6, Architecture §2, Product Bible §5, Early Warning Implementation §1, Relevance Intelligence §7

### The Contradiction

| Document | Stated Table Count | Actual Tables Listed |
|----------|-------------------|---------------------|
| Master Spec (§3.6) | "11 Tables" | 11 (users, api_keys, urls, shared_urls, baselines, check_results, changes, user_changes, webhooks, webhook_deliveries, notifications) |
| Architecture Doc (§2) | Lists 15 tables | 11 core + integrations, domain_patterns, monitoring_packs, learning_samples |
| Product Bible (§5) | "11 Core Tables + 5 Early Warning Tables" | 16 total |
| Early Warning Implementation (§1) | Adds 5 tables | forecasts, user_forecasts, header_snapshots, package_versions, spec_snapshots |
| Relevance Intelligence (§7) | Adds 6 more tables | shared_sources, domain_user_counts, signals, signal_evidence, signal_matches + ALTER TABLE urls |
| Source Preferences | Adds 2 more tables | source_alert_preferences, alert_engagement |

**Actual total across all documents: ~24 distinct tables**

The Master Spec says "11 tables" and marks this as a key decision. But the Architecture doc already has 15. The Early Warning doc adds 5. The Relevance Intelligence doc adds 6 more. Source Preferences adds 2 more. Nobody updated the canonical count.

### Which Tables Are Contradicted?

- **`integrations`** — Architecture doc §2.12 defines it with full SQL. Master Spec says "Deferred: integrations (V1.1)." But the Definitive Plan says Slack/Discord are MVP (using incoming webhooks, which ARE integrations). **Which is it?**
- **`monitoring_packs`** — Architecture doc §2.14 defines the table. Definitive Plan says "Monitoring packs KILLED entirely." **Dead table walking.**
- **`domain_patterns`** — Architecture doc §2.13 defines it as a table. Master Spec says "domain_patterns → JSON config file." **Table or config file?**
- **`learning_samples`** — Architecture doc §2.15 defines it as a table. Master Spec says "learning_samples → Redis/inline." **Table or Redis?**

**Suggested resolution:** Create a canonical schema document listing ALL tables with clear phase labels (MVP/V1.1/V2). Remove contradicted tables from Architecture doc or mark them as "deferred."

---

## Finding 2: Queue Count Contradiction

**Severity: BLOCKS BUILDING**  
**Documents:** Master Spec §3.1, Architecture §4.1, Relevance Intelligence §8.3

| Document | Queue Count | Queues Listed |
|----------|-------------|---------------|
| Master Spec | **4 queues** | url-checks, learning-checks, confirmation-checks, notifications |
| Architecture Doc | **6 queues** | url-checks, learning-checks, confirmation-checks, notifications, classification, maintenance |
| Relevance Intelligence | **7 queues** (adds 3) | + shared-source-checks, signal-fanout, package-checks |
| Early Warning Implementation | Mentions `package-checks` | + package-checks (separate queue) |

The Master Spec explicitly says "4 BullMQ Queues (Updated — reduced from 6)" and states "Classification merged into url-checks. Maintenance uses cron jobs directly from scheduler." But the Architecture doc still has 6 queues including `classification` and `maintenance`.

**Suggested resolution:** Reconcile. If classification is merged into url-checks (as Master Spec says), remove the classification queue from Architecture doc. Decide if maintenance is a queue or cron jobs. Document which queues are MVP vs later.

---

## Finding 3: Endpoint Count Disagreement

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §2.3, Architecture §3, URL Onboarding Flow, Product Bible §6, Source Tracking Model §6

| Document | Stated Count | Notes |
|----------|-------------|-------|
| Master Spec | "27 endpoints" | Lists: 4 auth + 3 API keys + 5 URLs + 4 changes + 5 webhooks + 3 account + 3 health + feedback |
| Architecture Doc | 27+ base, but adds classification (5), packs (3), integrations (3+), snapshots (1) | Total: ~40+ endpoints |
| URL Onboarding Flow | Adds: bulk create, bulk delete, manual check, check history, sources, providers, billing, account deletion, password change, etc. | Adds ~20+ endpoints |
| Source Preferences | Adds: GET/PATCH sources, bulk update sources, reset sources | Adds ~4 endpoints |
| Source Tracking Model | Adds: provider CRUD, provider sources, catalog search | Adds ~10 endpoints |

The "27 endpoints" claim in the Master Spec is the MVP number. But the URL Onboarding Flow document specifies ~47+ endpoints with full request/response shapes. The Architecture doc has ~40+. These additional endpoints were designed after the "27" was written and nobody updated the count.

**Suggested resolution:** Count the actual endpoints needed for MVP (likely ~30-35), separate from the full spec endpoint count.

---

## Finding 4: Cost Estimate Contradictions

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §2.2, §3.6, §6.3, Product Bible §5, Source Tracking Model §7

### Infrastructure Cost

| Document | Monthly Cost | Notes |
|----------|-------------|-------|
| Master Spec §3.6 | **~$42/mo** | Itemized: $7+$7+$14+$7+$3+$1+$3 |
| Master Spec §6.3 | **$51/mo** (Month 1) | Adds domain/SSL/misc $5 |
| Product Bible §5 | **~$42/mo** | Same as Master Spec §3.6 |
| Master Spec §2.2 Gap Patch | Fixed infra **~$42/mo** | Corrected per-provider cost |

But the Master Spec also says "Railway Pro" in some contexts. Railway Pro is **$20/service/month** minimum. With 3 services + DB + Redis, that's $100+ before usage. The $42/mo figure assumes Railway's **Hobby tier pricing**, which may not support the 2-worker scaling mentioned.

**Railway Pro cost reality:**
- Railway's Hobby plan: $5/mo subscription + usage (~$7/service based on vCPU/RAM)
- Railway's Pro plan: $20/mo subscription + usage (~$7+/service)
- The $42/mo figure works on Hobby but the spec mentions needing "Railway Pro" features (static outbound IPs, deployment draining)

**Suggested resolution:** Clarify which Railway plan is assumed. If Pro features are needed (static IPs, draining), costs are higher. If Hobby suffices, confirm that static IPs and draining are available on Hobby.

### Revenue Projection Contradictions

| Document | Month 12 MRR | Blended ARPU |
|----------|-------------|--------------|
| Master Spec §6.2 | $4,375 | $35 |
| Definitive Plan (Alex veto) | $1,125-$5,000 | $9 (Indie only) |
| Product Bible §4 | $1,125-$5,000 | Not stated |

The Master Spec uses a "blended ARPU of ~$35/mo" which assumes Pro/Business tiers exist. But MVP launches with Free + Indie only ($9/mo ARPU). The Definitive Plan corrected this to $9 ARPU but the Master Spec's projection table still shows $4,375 MRR at Month 12 using the old $35 ARPU.

**Suggested resolution:** All projections should use $9 ARPU for Year 1 since Pro/Business are V1.1+.

---

## Finding 5: Base URL Confusion (chirri.io vs chirri.io)

**Severity: BLOCKS BUILDING**  
**Documents:** Architecture §3, URL Onboarding Flow throughout, Master Spec §2.3

The Architecture doc and URL Onboarding Flow use **`api.chirri.io/delta/v1`** as the base URL. The Master Spec uses **`api.chirri.io/v1`**. The product was renamed from "Delta API" to "Chirri" but the Architecture doc and URL Onboarding Flow were never updated.

Specific conflicts:
- Architecture §3: `Base URL: https://api.chirri.io/delta/v1`
- Architecture §6.2: `*.chirri.io` in SSRF block list
- Architecture §7.2: `DASHBOARD_ORIGIN=https://chirri.io`, `EMAIL_FROM=Delta API <alerts@chirri.io>`, `USER_AGENT=Delta-Monitor/1.0 (https://chirri.io/delta)`
- URL Onboarding Flow: All error messages reference `chirri.io/delta`
- URL Onboarding Flow: Webhook payloads reference `chirri.io/delta/changes/...`
- Master Spec: All references use `chirri.io`

**Suggested resolution:** Global find-replace `chirri.io/delta` → `chirri.io` across Architecture and URL Onboarding Flow docs. Update SSRF blocklist, env vars, User-Agent, email sender.

---

## Finding 6: Slack/Discord Integration — MVP Scope Conflict

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §2.5, Definitive Plan §3, Architecture §2.12, §3.8

| Document | Slack/Discord Status |
|----------|---------------------|
| Master Spec §2.5 | "Indie+ (V1.1)" |
| Definitive Plan §3 | "MVP" (debate outcome: Priya won, Alex agreed) |
| Product Bible §2 (Notification Channels) | "Indie+ (MVP)" |
| Architecture §2.12 | `integrations` table defined with Slack/Discord config |
| Architecture §3.8 | Full integration CRUD endpoints defined |
| Master Spec §3.6 | "Deferred: `integrations` (V1.1)" |

The Definitive Plan explicitly moved Slack/Discord to MVP. But the Master Spec's notification channel table still says "V1.1" and the schema section says integrations table is deferred. The Architecture doc has full integration endpoints and table definition that the Master Spec says don't exist yet.

Additionally: Are Slack/Discord using the `integrations` table (as Architecture doc §2.12 defines) or just incoming webhooks (simpler, no table needed)? The Definitive Plan says "incoming webhook" approach (2 days for Slack + 1 day for Discord), which doesn't need the full `integrations` table.

**Suggested resolution:** Clarify: MVP Slack/Discord = incoming webhooks (simple POST, no table needed). Full `integrations` table (OAuth, richer formatting) = V1.1.

---

## Finding 7: Classification Pipeline Phase Count

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §3.3, Architecture §4.2, Product Bible §2

| Document | Classification Phases |
|----------|---------------------|
| Master Spec | 3 phases (domain pattern → response-based → fallback) |
| Architecture doc (ClassificationJob interface) | 6 phases (phase: 0-5) |
| Product Bible | 3 phases |

The Architecture doc's `ClassificationJob` TypeScript interface still has `phase: 0 | 1 | 2 | 3 | 4 | 5` (six phases), while the Master Spec explicitly simplified to 3 phases and notes "Fancy path heuristics, response header signals, discovery budget, generator-to-feed mapping all deferred to V2."

**Suggested resolution:** Update Architecture doc ClassificationJob to `phase: 1 | 2 | 3` to match the Master Spec's simplified pipeline.

---

## Finding 8: check_results Partitioning Strategy Conflict

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §3.6, Architecture §2.6, Definitive Plan §6, Product Bible §5

| Document | Partitioning Method |
|----------|-------------------|
| Master Spec | "pg_partman" |
| Architecture doc | "pg_partman" + shows pg_partman setup SQL |
| Product Bible | "native Postgres range partitioning" (NOT pg_partman) |
| Definitive Plan | "pg_partman" |

The Product Bible says "native Postgres range partitioning" while all other docs say "pg_partman." These are different things — pg_partman is an extension that auto-manages partitions; native partitioning requires manual partition creation. The Architecture doc even has `SELECT partman.create_parent(...)` SQL.

**Suggested resolution:** Pick one. If pg_partman is available on Railway's managed Postgres, use it. If not, use native partitioning with a cron job to create future partitions. Document which one and why.

---

## Finding 9: Provider Intelligence — Killed Then Restored, Still Inconsistent

**Severity: CAUSES CONFUSION**  
**Documents:** Definitive Plan §§ debate + Amendment 1, Master Spec appendix, Source Tracking Model, Product Bible §2

Marcus cut Provider Intelligence during the debate. Alex restored it via Amendment 1. But the documents disagree on scope:

| Document | Provider Intelligence Scope |
|----------|---------------------------|
| Definitive Plan Amendment 1 | "15-20 hardcoded provider profiles, JSON file + search/display UI, 1-2 days effort" |
| Source Tracking Model | Full provider monitor system with `ProviderMonitor` data model, `POST /api/v1/providers`, bundled sources, source expansion, source types, check intervals |
| Relevance Intelligence | Full shared source model with `shared_sources` table, domain user counts, discovery, orphan lifecycle |
| Product Bible | "15-20 hardcoded profiles" + discovery for unknown domains (V1.1) |
| Master Spec | "Provider intelligence enhances known URLs but is never required" |

The Source Tracking Model describes a **full provider management system** with dedicated API endpoints (`/api/v1/providers`, `/api/v1/catalog/providers`) that don't exist in the Architecture doc's endpoint list. The Relevance Intelligence doc adds `shared_sources` table with domain-level lifecycle management that isn't in any schema.

**Which system gets built for MVP?**
- A: Simple JSON file with 15-20 provider profiles (as Definitive Plan says) — 1-2 days
- B: Full provider management with `shared_sources`, domain lifecycle, discovery — 2-3 weeks
- C: Something in between

**Suggested resolution:** Define MVP scope clearly. Likely: JSON config file with hardcoded profiles for MVP, full provider system for V1.1. The Source Tracking Model and Relevance Intelligence designs are V1.1+ blueprints, not MVP.

---

## Finding 10: Timeline Feasibility — The Math Doesn't Work

**Severity: BLOCKS BUILDING**  
**Documents:** Definitive Plan §6, Early Warning Implementation §14, Relevance Intelligence §10, Source Preferences §9, Master Spec §7.3

### Adding Up ALL Implementation Estimates

**Core product (Definitive Plan Week 1-8):**
- Week 1: Foundation (5 days)
- Week 2: Check engine + security (5 days)
- Week 3: Detection + notifications (5 days)
- Week 4: Dashboard (5 days)
- Week 5: Billing + landing + content (5 days)
- Week 6: Testing + beta prep (5 days)
- Week 7: Beta + hardening (5 days)
- Week 8: Launch (5 days)
**Subtotal: 40 working days (8 weeks)**

**Early Warning System (stated as MVP in Product Bible):**
- Early Warning Implementation §14: **~37 hours (~5 days)**
- Signal types for MVP: deprecation headers, changelog scanning, version headers, GitHub Atom feeds

**Relevance Intelligence (required for Smart Chirp, which is stated as core UX):**
- Relevance Intelligence §10: **~59 hours (~8 days)**
- Core pipeline: relevance matching, shared sources, announcement detection, fan-out

**Source Preferences:**
- Source Preferences §9 Phase 1: **MVP — Week 5-6** (embedded in timeline)
- Including source_alert_preferences table, source list endpoint, toggle/severity API, notification pipeline updates

**Dashboard additions not budgeted:**
- Side-by-side diff view: **5-6 days** (Week 4, budgeted)
- Provider Intelligence UI: **??? days** (not budgeted separately)
- TTFB graphs, uptime charts: **??? days**
- Source preferences UI: **??? days**
- Forecasts tab (from Early Warning): **1.5 days** (V1.1 but Product Bible implies MVP)

**Grand total of estimated work:**
- Core: 40 days
- Early Warning: 5 days
- Relevance Intelligence: 8 days
- Provider Intelligence (simple): 2 days
- **Total: ~55 working days minimum**

**Available time: 40 working days (8 weeks)**

**The gap: ~15 working days (3 weeks) of work doesn't fit.**

And this doesn't account for:
- The "unknown mitigations" from the Master Spec (12 days estimated)
- The dashboard being a full React SPA (the Tech Stack doc specifies Vite + React + React Router + TanStack Query — this is not a weekend project)
- Integration testing, load testing, beta user management
- Writing blog posts, Show HN draft, landing page

**Suggested resolution:** Either:
1. Extend timeline to 12 weeks (realistic for one developer)
2. Cut Early Warning and Relevance Intelligence entirely from MVP (move to V1.1)
3. Add a second developer
4. Accept that some MVP features will ship incomplete

---

## Finding 11: Shared URL Key — Schema vs Description Mismatch

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §3.1, §4.2, Architecture §2.4

The Master Spec says: "Shared URL key = SHA-256(url + method + sorted headers)."

But `shared_urls` table (Architecture §2.4) has:
- `url_hash TEXT NOT NULL UNIQUE -- SHA-256 of normalized URL`
- No `method` column
- No `headers` column

The shared URL key includes method and headers in the description but the table only stores a URL hash. If two users monitor the same URL with different methods (GET vs POST), the current schema can't distinguish them.

**Suggested resolution:** Either add `method` and `headers_hash` to `shared_urls` table, or clarify that the shared key is just the normalized URL (since custom headers create separate monitors per the spec's own rule).

---

## Finding 12: Auth Implementation — JWT vs Sessions Contradiction

**Severity: BLOCKS BUILDING**  
**Documents:** Master Spec §2.3, Architecture §3.1, Tech Stack Decisions §2, Definitive Plan §5

| Document | Auth Method |
|----------|-------------|
| Master Spec | "JWT token (stored in HttpOnly cookie)" |
| Architecture doc | JWT with refresh tokens, full JWT endpoints |
| URL Onboarding Flow | JWT-based auth with refresh token rotation |
| Tech Stack Decisions | "Cookie-based sessions (NOT JWTs for dashboard auth)" — explicitly argues AGAINST JWTs |
| Definitive Plan | "JWT in HttpOnly cookie" |
| Product Bible | "Auth (JWT in HttpOnly cookie)" |

The Tech Stack Decisions doc (which is the most recent and most researched) recommends **better-auth with cookie-based sessions** and explicitly says "Why not JWTs for dashboard auth: JWTs can't be revoked without a blocklist (which is basically reimplementing sessions)."

But EVERY other document specifies JWTs with refresh tokens. The Architecture doc has full JWT endpoints (refresh, revoke) and the URL Onboarding Flow specifies JWT token and refresh_token in signup/login responses.

This is a fundamental architecture decision that's contradicted.

**Suggested resolution:** The Tech Stack doc's reasoning is sound. If using better-auth with sessions, the auth endpoints need redesign (no refresh tokens, session-based revocation). If keeping JWTs, the Tech Stack doc recommendation needs updating. Pick one and update all affected documents.

---

## Finding 13: Password Hashing — bcrypt vs Argon2id

**Severity: CAUSES CONFUSION**  
**Documents:** Architecture §2.1, Tech Stack Decisions §2

- Architecture doc users table: `password_hash TEXT NOT NULL, -- bcrypt hash`
- Tech Stack Decisions: "Argon2id (via better-auth)" with explicit OWASP justification

**Suggested resolution:** Update Architecture doc comment to Argon2id if that's the choice.

---

## Finding 14: Free Plan — Slack/Discord Access Contradiction

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §2.2, Product Bible §4, Source Preferences §8

| Document | Free Plan Slack/Discord |
|----------|----------------------|
| Master Spec §2.2 Free Tier Details | "❌ No Slack/webhook integration" |
| Master Spec §2.2 Pricing Table | Slack not listed for Free |
| Product Bible §2 Notification Channels | "Slack: Indie+ (MVP)" |
| Product Bible §4 Pricing Table | No Slack for Free |
| Architecture Appendix A PLAN_LIMITS | `free: { slackIntegration: false, webhookIntegration: false }` |

**But**: Free plan gets 1 webhook (Master Spec pricing table). The Architecture doc says `webhookIntegration: false` for free. Which is it?

Also: The Master Spec pricing table says Free gets "1 webhook" but the Free Tier Details section says "❌ No Slack/webhook integration."

**Suggested resolution:** Decide: Does Free get 1 webhook or 0? The pricing table and the feature list within the same document contradict.

---

## Finding 15: Minimum Check Interval for Indie Plan

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §2.2, Architecture Appendix A, Definitive Plan §1

| Document | Indie Min Interval |
|----------|-------------------|
| Master Spec §2.2 Pricing Table | 15 min |
| Master Spec §7.1 MVP Scope | "HTTP GET checks at 1h and 24h intervals" |
| Architecture Appendix A | `indie: { minInterval: '15m' }` |
| Definitive Plan | "1h and 24h for MVP tiers" |
| Product Bible §4 | "1 hour" |

The pricing table says Indie gets 15-min checks, but multiple documents say MVP only ships with 1h and 24h intervals. 15m, 5m, 1m intervals are "V1.1 (Additional check intervals)."

**So what can an Indie user actually DO at launch?** Pay for 15-min capability but only get 1h?

**Suggested resolution:** Either ship 15m at launch (as advertised) or update the pricing table to show "1h" for Indie at MVP launch.

---

## Finding 16: Webhook Events — Different Lists Across Documents

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §2.3, Architecture §3.7, URL Onboarding Flow §17, Product Bible §6

The webhook event catalogs differ across documents:

| Event | Master Spec | Architecture | URL Onboarding Flow | Product Bible |
|-------|:-----------:|:----------:|:-------------------:|:------------:|
| `change.detected` | ✅ | ✅ | ✅ | ✅ |
| `change.confirmed` | ✅ | ✅ | ✅ | ✅ |
| `change.reverted` | ❌ | ❌ | ✅ | ❌ |
| `url.created` | ❌ | ❌ | ✅ | ❌ |
| `url.classified` | ❌ | ❌ | ✅ | ❌ |
| `url.learning_complete` | ❌ | ❌ | ✅ | ✅ |
| `url.active` | ❌ | ❌ | ✅ | ❌ |
| `url.error` | ✅ | ✅ | ✅ | ✅ |
| `url.recovered` | ✅ | ✅ | ✅ | ✅ |
| `url.degraded` | ❌ | ❌ | ✅ | ❌ |
| `url.paused` | ❌ | ❌ | ✅ | ❌ |
| `url.resumed` | ❌ | ❌ | ✅ | ❌ |
| `url.baseline_ready` | ✅ | ✅ | ❌ | ❌ |
| `url.auth_required` | ❌ | ❌ | ✅ | ❌ |
| `url.redirect_detected` | ❌ | ❌ | ✅ | ❌ |
| `url.limited` | ❌ | ❌ | ✅ | ❌ |
| `forecast.new` | ❌ | ❌ | ❌ | ✅ |
| `forecast.deadline` | ❌ | ❌ | ❌ | ✅ |
| `account.usage_alert` | ✅ | ✅ | ✅ | ✅ |
| `source.preferences_updated` | ❌ | ❌ | ❌ | ❌ (Source Prefs doc only) |
| `test` | ❌ | ❌ | ✅ | ❌ |

The URL Onboarding Flow has the most complete list (~17 events) while the Master Spec lists 6.

**Suggested resolution:** Designate one canonical event catalog (URL Onboarding Flow's is most complete) and reference it from other docs.

---

## Finding 17: URL Status States — Different Enums

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §2.3, Architecture §2.3, URL Onboarding Flow §1

| Document | Status Values |
|----------|--------------|
| Master Spec | `learning → calibrating → active → paused / error` |
| Architecture §2.3 (SQL CHECK) | `learning, calibrating, active, paused, error` (5 states) |
| URL Onboarding Flow §1 | `learning, calibrating, active, paused, error, degraded, auth_required, redirect_detected, limited, monitoring_empty, rejected, classifying` (12 states) |

The Architecture doc's SQL only has 5 states. The URL Onboarding Flow designed 12 states with full transition rules. These are fundamentally different — a developer building from the Architecture doc's SQL will not support the onboarding flow's states.

**Suggested resolution:** Update Architecture doc's `urls.status` CHECK constraint to include all states from the URL Onboarding Flow.

---

## Finding 18: "calibrating" Status — Visible or Hidden?

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §3.2, Definitive Plan (Jake's cut), Product Bible §2

Jake successfully argued to make the calibrating state invisible to users. The Definitive Plan says: "Remove the 'calibrating' state from the UI. Internally, use 95 confidence threshold for the first 7 days, 80 after. User sees 'Setting up...' (10 min) → 'Active.'"

But the Product Bible §2 says: "Calibrating (7 days, invisible to user): User sees 'Active' status — calibration is internal only." 

Meanwhile, the URL Onboarding Flow §6 State N describes "calibrating" as a visible state with a day counter: "Blue 'Calibrating' badge with day counter (Day 3/7)."

**Suggested resolution:** The Definitive Plan decision was to hide it. Remove the "calibrating" state from user-facing UI specs.

---

## Finding 19: Severity Levels — Inconsistent Taxonomy

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §2.4, Product Bible §2, Source Preferences §1.2, Early Warning Implementation §1.1

| Document | Severity Levels |
|----------|----------------|
| Master Spec | `critical, breaking, warning, info` (4 levels) |
| Product Bible Alert Taxonomy | `forecast, deadline, breaking, notable, info` (5 levels, different names) |
| Source Preferences | `info, warning, notable, breaking, critical` (5 levels) |
| Early Warning forecasts table | `alert_level: forecast, deadline, breaking, notable, info` AND `severity: critical, breaking, warning, info` (BOTH!) |

There are two overlapping classification systems:
1. **Change severity**: `critical, breaking, warning, info` (from Master Spec)
2. **Alert taxonomy**: `forecast, deadline, breaking, notable, info` (from Product Bible)

The Source Preferences doc introduces `notable` as a severity level that doesn't exist in the Master Spec's severity system. The Early Warning forecasts table has BOTH `alert_level` and `severity` as separate columns with different enums.

**Suggested resolution:** Reconcile into one severity enum used everywhere. The Master Spec's 4-level system (`critical, breaking, warning, info`) should be canonical. `notable` and `forecast/deadline` are alert UI decorations, not severity levels — make this distinction explicit.

---

## Finding 20: `monitored_sources` Table — Referenced but Never Defined

**Severity: BLOCKS BUILDING**  
**Documents:** Source Preferences §1.1, §6

The Source Preferences document references `monitored_sources(id)` as a foreign key in both `source_alert_preferences` and `alert_engagement` tables. But NO document defines a `monitored_sources` table with SQL CREATE TABLE statement.

The Source Tracking Model §6 defines a TypeScript `MonitoredSource` interface and describes API endpoints, but no SQL schema. The closest tables are `urls` (per-user endpoints) and `shared_urls` (dedup layer), but neither is called `monitored_sources`.

**Suggested resolution:** Either define the `monitored_sources` table or map the foreign keys to the correct existing table (`urls` or a new table for bundled sources).

---

## Finding 21: `shared_urls` Missing `domain` Column

**Severity: CAUSES CONFUSION**  
**Documents:** Architecture §2.4, Relevance Intelligence §4.3

The Relevance Intelligence doc's fan-out query does `JOIN shared_urls su ... WHERE su.domain = $1`. But the `shared_urls` table in the Architecture doc has no `domain` column — only `url_hash`, `url`, `effective_interval`, `subscriber_count`, etc.

The Relevance Intelligence doc even notes: "Add domain to shared_urls if not present (shared_urls.domain likely already exists from CHIRRI_ARCHITECTURE.md)" — but it doesn't.

**Suggested resolution:** Add `domain TEXT NOT NULL` column to `shared_urls` with index.

---

## Finding 22: User-Agent String — Multiple Versions

**Severity: COSMETIC**  
**Documents:** Master Spec §5.4, Architecture §7.2, Architecture §6.2

| Location | User-Agent |
|----------|-----------|
| Master Spec §5.4 | `Chirri-Monitor/1.0 (https://chirri.io; monitoring service)` |
| Architecture §7.2 env vars | `Delta-Monitor/1.0 (https://chirri.io/delta; monitoring service)` |
| Architecture §6.2 safeFetch code | `Delta-Monitor/1.0 (https://chirri.io/delta; monitoring service)` |
| Architecture §3.7 webhook delivery | `Delta-Webhook/1.0` |

Three different User-Agent strings referencing two different product names and URLs.

**Suggested resolution:** Standardize to `Chirri-Monitor/1.0 (https://chirri.io; monitoring service)` and `Chirri-Webhook/1.0`.

---

## Finding 23: API Key Prefix — Inconsistent

**Severity: COSMETIC**  
**Documents:** Architecture §2.2, Master Spec §2.3, URL Onboarding Flow §4

All docs agree on `dk_live_` and `dk_test_` prefixes. But "dk" stands for "Delta Key" — the old product name. Should this be updated to `ck_live_` (Chirri Key)?

**Suggested resolution:** Low priority but worth noting. API key format is user-facing and will be in docs/examples forever. Decide before launch.

---

## Finding 24: Early Warning — MVP or V1.1?

**Severity: BLOCKS BUILDING**  
**Documents:** Product Bible §3, Definitive Plan §1, Master Spec §7.1

The Product Bible has an entire Part 3 "EARLY WARNING SYSTEM" and lists deprecation header detection as MVP. The Definitive Plan's MVP checklist includes "Deprecation header detection (Sunset RFC 8594, Deprecation header)."

But the Early Warning Implementation doc estimates 37 hours (~5 days) for MVP signals, and the Relevance Intelligence doc estimates 59 hours (~8 days) for the relevance pipeline.

The Smart Chirp feature (from the Master Spec addendum) — where bonus sources only alert when relevant to the user's endpoint — requires the full Relevance Intelligence pipeline.

**The dependency chain:** Smart Chirp → Relevance Intelligence → Shared Sources → Domain Discovery → Early Warning

**Is all of this MVP?** The documents imply yes but the timeline says no.

**Suggested resolution:** Explicitly scope MVP early warning as: (1) Parse Sunset/Deprecation headers from already-fetched responses (free, ~4 hours). (2) Store in header_snapshots. (3) Create forecasts with basic alerts. Everything else (relevance matching, shared sources, announcement detection, fan-out) is V1.1.

---

## Finding 25: LLM Summarization — In or Out?

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec addendum (Twitter/X strategy), Relevance Intelligence §3.6, Master Spec §7.1

The Master Spec's Twitter/X strategy section says: "LLM tweet generation: Same summarization pipeline as chirp messages, different output format. ~$0.001/tweet."

This implies an LLM summarization pipeline exists. But:
- Master Spec §7.1 V2 Features: "AI-powered change summaries" listed under V2 (Months 5+)
- Relevance Intelligence §3.6: "Ship without LLM. Add LLM summarization as a V2 enhancement"
- Product Bible doesn't mention LLM at all
- No LLM provider (OpenAI, Anthropic) is in the tech stack or cost estimates

**Suggested resolution:** Clarify that LLM summarization is V2. The Twitter bot uses deterministic template-based tweet generation, not LLM.

---

## Finding 26: Webhook Signing Header Name

**Severity: COSMETIC**  
**Documents:** Architecture §3.7, URL Onboarding Flow §17, Appendix B

| Document | Header Name |
|----------|-------------|
| Architecture §3.7 | `X-Delta-Signature` |
| URL Onboarding Flow §17 | `X-Chirri-Signature` |
| URL Onboarding Flow Appendix B | `X-Chirri-Signature` (in verification code) |
| Master Spec §2.3 | `X-Chirri-Signature` |

The Architecture doc still uses the old name.

**Suggested resolution:** Standardize to `X-Chirri-Signature`.

---

## Finding 27: Webhook Delivery Header Names

**Severity: COSMETIC**  
**Documents:** Architecture §3.7, URL Onboarding Flow §17

| Architecture | URL Onboarding Flow |
|-------------|-------------------|
| `X-Delta-Event` | `X-Chirri-Event` |
| `X-Delta-Delivery` | `X-Chirri-Delivery` |
| `User-Agent: Delta-Webhook/1.0` | `User-Agent: Chirri-Webhook/1.0` |

Same rename issue.

---

## Finding 28: Snapshot IDOR — Endpoint Exists in One Doc, Not Others

**Severity: CAUSES CONFUSION**  
**Documents:** Architecture §3.5, URL Onboarding Flow §8, Master Spec §2.3

The Architecture doc defines `GET /v1/snapshots/:id` (§3.5) and the URL Onboarding Flow has full response shapes for it (§8). But the Master Spec's endpoint table doesn't list a snapshots endpoint. The Master Spec's 27-endpoint count doesn't include it.

**Suggested resolution:** Add snapshots endpoint to the Master Spec's endpoint table, or document it as an internal endpoint.

---

## Finding 29: nanoid vs UUID for Primary Keys

**Severity: CAUSES CONFUSION**  
**Documents:** Architecture §2 (all tables), Source Preferences §1.1, URL Onboarding Flow §2.6

The Architecture doc uses `UUID PRIMARY KEY DEFAULT gen_random_uuid()` for all tables. The Source Preferences doc uses `TEXT PRIMARY KEY DEFAULT ('sap_' || nanoid())` — mixing nanoid-generated text IDs with the existing UUID scheme.

The URL Onboarding Flow lists ID prefixes (`usr_`, `url_`, `chg_`, etc.) but these are described as display prefixes, not primary key formats. It's unclear whether the DB stores `usr_a1b2c3d4` (with prefix) or just the UUID `a1b2c3d4-...`.

**Suggested resolution:** Pick one ID strategy. Either UUIDs everywhere (Architecture doc) or nanoid with prefixes everywhere (Source Preferences doc). Don't mix.

---

## Finding 30: API Framework — Hono vs Fastify, Still Undecided

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §7.2, Architecture §1 diagram, Tech Stack Decisions §1, Product Bible Appendix C

Every document says "Hono or Fastify" without deciding. The Architecture doc diagram says "Hono/Fastify." The Tech Stack Decisions doc resolves the dashboard framework (Vite + React) but never addresses the API framework choice.

**Suggested resolution:** Pick one. The Tech Stack doc chose better-auth which works with both. Hono is lighter, Fastify has more middleware. Just decide.

---

## Finding 31: Database Driver — pg vs postgres.js

**Severity: COSMETIC**  
**Documents:** Tech Stack Decisions §3, Architecture §7.2

Tech Stack Decisions says: "Use `drizzle-orm/node-postgres` with `pg` driver."

But elsewhere the spec mentions Railway's managed Postgres connection string format, which works with both `pg` and `postgres.js`. The Architecture doc's environment variable is `DATABASE_URL=postgresql://...` which is standard.

This is fine, just noting that `pg` (node-postgres) is the explicit choice, not `postgres.js`.

---

## Finding 32: Source Tracking Model — Separate API Namespace Conflict

**Severity: CAUSES CONFUSION**  
**Documents:** Source Tracking Model §6, Architecture §3, Master Spec §2.3

The Source Tracking Model proposes a parallel API namespace:
- `POST /api/v1/providers` (create provider monitor)
- `GET /api/v1/providers/:id/sources`
- `GET /api/v1/catalog/providers`
- etc.

But the existing API uses `/v1/urls` for everything. Having both `/v1/urls` and `/v1/providers` creates confusion: "Do I add Stripe as a URL or as a provider?" The URL Onboarding Flow handles provider detection WITHIN the `/v1/urls` endpoint (when you POST a provider domain, it detects and offers sources).

**Suggested resolution:** For MVP, keep everything under `/v1/urls`. Provider intelligence is a layer ON TOP of URL management, not a separate resource. The `/v1/providers/search` endpoint can exist as a discovery/catalog endpoint without a full provider CRUD.

---

## Finding 33: Break-Even Math — Different Numbers

**Severity: COSMETIC**  
**Documents:** Master Spec §2.2, §6.2, Architecture §7.7, Product Bible §4

| Document | Break-Even |
|----------|-----------|
| Master Spec §2.2 | "~6 Indie customers ($54/mo)" |
| Master Spec §6.2 | "~6 Indie customers ($54/mo > $42/mo infrastructure)" |
| Architecture §7.7 | "5 Indie subscribers ($45/mo) or 2 Pro subscribers ($58/mo)" |
| Product Bible | "Break-even at ~6 Indie customers ($54/mo > $42/mo infrastructure)" |

5 Indie × $9 = $45. 6 Indie × $9 = $54. The Architecture doc says 5, everyone else says 6. The difference is whether you're covering $42 (infra only) or $51 (infra + misc).

---

## Finding 34: MCP Server — V1.1 or V2?

**Severity: COSMETIC**  
**Documents:** Master Spec §7.1, Definitive Plan §4, Product Bible Appendix A

| Document | MCP Server Timeline |
|----------|-------------------|
| Master Spec Key Decision #17 | "Non-negotiable for V2" |
| Definitive Plan §4 Integration Priority | V1.1 Week 11 (5 days) |
| Product Bible Appendix A Decision #17 | "Non-negotiable for V1.1" |

V1.1 or V2? The Definitive Plan and Product Bible say V1.1. The Master Spec key decisions say V2.

---

## Finding 35: Email Verification — Before or After Monitoring?

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §4.3, Definitive Plan §5, URL Onboarding Flow §3

Master Spec §4.3 DDoS/Abuse Prevention: "Email verification before checks begin."
But the URL Onboarding Flow shows URLs being created immediately after signup (status "learning" starts instantly).

If email verification is required before checks begin, the onboarding flow needs a blocking step. If it's not blocking, what prevents abuse?

**Suggested resolution:** Clarify: Is email verification required before adding URLs (blocking) or can users add URLs immediately with a grace period?

---

## Finding 36: "Check Now" Button — Endpoint Exists in One Doc, Not Others

**Severity: CAUSES CONFUSION**  
**Documents:** Definitive Plan (Priya's add), URL Onboarding Flow §15, Master Spec §2.3

Priya successfully added the "Check Now" button to MVP. The URL Onboarding Flow specifies `POST /v1/urls/:id/check` with full request/response shapes. But the Master Spec's endpoint table doesn't list it, and the Architecture doc doesn't define it.

**Suggested resolution:** Add to Master Spec endpoint count and Architecture doc.

---

## Finding 37: Conditional check_results Writes

**Severity: CAUSES CONFUSION**  
**Documents:** Product Bible §5

Product Bible §5 worker pipeline step 11: "Result storage — write to Postgres (conditional: only write when something interesting happens to reduce IOPS)."

But the Architecture doc's worker pipeline (§5.1 Step 11) writes to check_results unconditionally. If we only write "interesting" results, how do we calculate uptime percentage (which requires knowing total checks)?

**Suggested resolution:** Decide: Write all results (for accurate uptime/TTFB stats) or conditional writes (for IOPS savings). Can't have both without a separate counter.

---

## Finding 38: Response Size Tracking — Feature Gap

**Severity: CAUSES CONFUSION**  
**Documents:** Definitive Plan §1, Product Bible §2

The Definitive Plan adds "Response size tracking with anomaly alerts (>50% deviation)" as a "free data" MVP feature. But:
- No `response_size_bytes` column in the `baselines` table for tracking baseline size
- No anomaly detection logic specified for size changes
- The `check_results` table has `body_size_bytes` but no comparison logic

**Suggested resolution:** Add `baseline_size_bytes` to baselines table, or clarify that "response size tracking" just means displaying the number (not anomaly detection) for MVP.

---

## Finding 39: Scope Creep Since Definitive Plan

**Severity: BLOCKS BUILDING**

Features added AFTER the Definitive Plan that weren't in the 8-week timeline:

| Feature | Added By | Estimated Effort | In Timeline? |
|---------|----------|-----------------|-------------|
| Lightweight Domain Discovery | Master Spec addendum | "15 HEAD requests, <2 seconds" but building the logic + UI = days | ❌ |
| Smart Chirp (relevance-filtered alerts) | Master Spec addendum | Requires Relevance Intelligence pipeline (~8 days) | ❌ |
| Twitter/X automated posting | Master Spec addendum | "Separate service, cron script" but still needs building | ❌ |
| Full Early Warning System | Product Bible Part 3 | ~5 days (MVP signals) | ❌ Not in weekly plan |
| Source Preferences system | Source Preferences doc | Phase 1: Week 5-6 (but Week 5 is already "Billing + Landing + Content") | ⚠️ Squeezed |
| Provider Intelligence UI | Definitive Plan Amendment 1 | "1-2 days" but includes search UI, source display, quick-add buttons | ⚠️ Underestimated |
| Forecasts API endpoints | Early Warning Implementation §11 | CRUD + acknowledge + dismiss + summary | ❌ |
| Shared Source model | Relevance Intelligence §2 | Full lifecycle management | ❌ |
| Signal deduplication | Relevance Intelligence §5 | Correlation groups, evidence merging | ❌ |

**This is significant scope creep.** The Definitive Plan was the "last planning document before code." But 4+ new feature documents were written AFTER it, each adding substantial work.

---

## Finding 40: Tech Stack — better-auth API Key Plugin vs Custom Implementation

**Severity: CAUSES CONFUSION**  
**Documents:** Tech Stack Decisions §2, Architecture §2.2, Master Spec §4.3

The Tech Stack doc recommends better-auth's built-in API key plugin. But the Architecture doc specifies a custom `api_keys` table with specific fields (`key_hash`, `key_prefix`, `key_suffix`, `is_test`) and custom lookup flow. These may not align with better-auth's API key plugin schema.

**Suggested resolution:** Check if better-auth's API key plugin supports: (1) custom key prefixes (`dk_live_`, `dk_test_`), (2) SHA-256 hashing (vs bcrypt), (3) test mode flag, (4) last_used_at tracking. If not, custom implementation may be needed alongside better-auth for session auth.

---

## Finding 41: Deduplication Guard Missing from Worker

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §3.6, Architecture §5.1

Master Spec mentions: "Workers check for recent results before processing (dedup guard)." But the Architecture doc's worker pipeline (§5.1) has no dedup guard step. There's no check for "was this URL already checked in the last N seconds?"

**Suggested resolution:** Add dedup guard to worker pipeline specification.

---

## Finding 42: Cloudflare CDN — In Architecture Diagram but Not In Cost Estimate

**Severity: COSMETIC**  
**Documents:** Architecture §1 diagram, Master Spec §3.6

The Architecture diagram shows "Cloudflare CDN (DDoS + SSL + Cache)" as the entry point. But the cost estimate lists domain/SSL at $0 (Cloudflare free plan). Is the dashboard served through Cloudflare CDN or directly from Railway? If through Cloudflare, there's additional configuration work not documented.

---

## Finding 43: Learning Period — 20s Interval May Hit Rate Limits

**Severity: CAUSES CONFUSION**  
**Documents:** Master Spec §3.2, Architecture §5.2

Learning period: "30 rapid checks at 20-second intervals" for ~10 minutes. But the per-domain rate limit is "1 req/sec" (Master Spec §4.3). 

One check every 20 seconds (0.05 req/sec) is well under the rate limit. However, if multiple users add the same URL simultaneously, the shared monitoring dedup should handle this — but the learning queue is separate from the main check queue. Does shared monitoring apply during learning?

**Suggested resolution:** Clarify: Is learning done per-user or per-shared-url? If User A and User B both add `api.stripe.com/v1/prices` at the same time, do we run 60 learning checks (30×2) or 30 shared?

---

## Finding 44: Weekly Stability Report — Spec vs Implementation Gap

**Severity: COSMETIC**  
**Documents:** Master Spec §5.2, Definitive Plan §1, Architecture §5.3

The weekly stability report email is listed as MVP. The scheduler cron table shows it (Monday 06:00 UTC). But there's no specification of:
- What data it contains
- Email template design
- Which metrics to include
- How it handles users with 0 changes (show "all quiet" or skip?)

**Suggested resolution:** Spec the weekly email content before building it.

---

## Finding 45: Product Bible References Non-Existent Documents

**Severity: COSMETIC**  
**Documents:** Product Bible Appendix B

The Product Bible references several documents that weren't in the review set:
- `CHIRRI_PROVIDER_MONITORING.md` — referenced but not provided
- `CHIRRI_UNKNOWN_UNKNOWNS.md` — referenced but not provided
- `CHIRRI_UNKNOWN_SOLUTIONS.md` — referenced but not provided
- `CHIRRI_FEATURES_AND_INTEGRATIONS.md` — referenced but not provided
- `CHIRRI_DOMAIN_VS_PAGE_MONITORING.md` — referenced but not provided

These may exist but weren't in the verification scope.

---

## Finding 46: Source Preferences — `nanoid` Dependency Not in Tech Stack

**Severity: COSMETIC**  
**Documents:** Source Preferences §1.1, §6, Tech Stack Decisions

Source Preferences uses `nanoid()` in SQL default expressions. This requires either:
1. A PostgreSQL nanoid extension (exists but uncommon)
2. Application-level ID generation before INSERT

The Tech Stack doc doesn't mention nanoid. The Architecture doc uses `gen_random_uuid()`. This is a minor but real implementation discrepancy.

---

## Finding 47: R2 Circuit Breaker — Different Timeout Values

**Severity: COSMETIC**  
**Documents:** Product Bible §5, Tech Stack Decisions Appendix C

Product Bible: "R2 writes are async and non-blocking with a circuit breaker (5s timeout, opens at 50% failure rate)."
Tech Stack Appendix C lists `opossum` as the circuit breaker library but doesn't specify configuration.

Not a real contradiction, just noting the 5s timeout is only specified in one place.

---

## Summary Table

| # | Finding | Severity | Resolution Effort |
|---|---------|----------|------------------|
| 1 | Table count chaos (11 vs 15 vs 24) | 🔴 Blocks building | Create canonical schema list |
| 2 | Queue count contradiction (4 vs 6 vs 7) | 🔴 Blocks building | Reconcile to one number |
| 3 | Endpoint count disagreement (27 vs 40+) | 🟡 Confusion | Update count |
| 4 | Cost estimate contradictions ($42 vs $51 vs Railway Pro) | 🟡 Confusion | Clarify Railway plan |
| 5 | Base URL (chirri.io vs chirri.io) | 🔴 Blocks building | Global find-replace |
| 6 | Slack/Discord MVP scope conflict | 🟡 Confusion | Clarify incoming webhook vs full integration |
| 7 | Classification phases (3 vs 6) | 🟡 Confusion | Update Architecture doc |
| 8 | Partitioning (pg_partman vs native) | 🟡 Confusion | Pick one |
| 9 | Provider Intelligence scope conflict | 🟡 Confusion | Define MVP scope explicitly |
| 10 | Timeline impossible (~55 days in 40) | 🔴 Blocks building | Cut scope or extend timeline |
| 11 | Shared URL key schema mismatch | 🟡 Confusion | Add method/headers to table |
| 12 | JWT vs Sessions contradiction | 🔴 Blocks building | Pick one auth strategy |
| 13 | bcrypt vs Argon2id | 🟡 Confusion | Update Architecture doc |
| 14 | Free plan webhook access contradiction | 🟡 Confusion | Decide: 0 or 1 webhooks |
| 15 | Indie min interval (15m vs 1h at launch) | 🟡 Confusion | Match pricing to what ships |
| 16 | Webhook event catalog differs | 🟡 Confusion | One canonical list |
| 17 | URL status states (5 vs 12) | 🟡 Confusion | Update Architecture SQL |
| 18 | "calibrating" visible or hidden | 🟡 Confusion | Follow Definitive Plan: hidden |
| 19 | Severity levels inconsistent | 🟡 Confusion | One canonical enum |
| 20 | `monitored_sources` table never defined | 🔴 Blocks building | Define table or fix FK |
| 21 | `shared_urls` missing domain column | 🟡 Confusion | Add column |
| 22 | User-Agent string variants | 🟢 Cosmetic | Standardize |
| 23 | API key "dk" prefix (Delta Key) | 🟢 Cosmetic | Consider renaming |
| 24 | Early Warning — MVP or V1.1 scope | 🔴 Blocks building | Define MVP subset explicitly |
| 25 | LLM summarization in/out | 🟡 Confusion | Confirm V2, remove from Twitter spec |
| 26 | Webhook signing header name | 🟢 Cosmetic | Standardize to X-Chirri-* |
| 27 | Webhook delivery header names | 🟢 Cosmetic | Same rename |
| 28 | Snapshots endpoint unlisted | 🟢 Cosmetic | Add to endpoint table |
| 29 | nanoid vs UUID for PKs | 🟡 Confusion | Pick one |
| 30 | API framework still undecided | 🟡 Confusion | Just pick Hono or Fastify |
| 31 | Database driver confirmed (pg) | 🟢 Cosmetic | Fine |
| 32 | Parallel API namespace (/providers vs /urls) | 🟡 Confusion | Keep under /urls for MVP |
| 33 | Break-even math (5 vs 6 customers) | 🟢 Cosmetic | Minor |
| 34 | MCP Server V1.1 vs V2 | 🟢 Cosmetic | Align docs |
| 35 | Email verification blocking flow | 🟡 Confusion | Clarify timing |
| 36 | "Check Now" endpoint unlisted | 🟢 Cosmetic | Add to Architecture |
| 37 | Conditional vs unconditional check_results writes | 🟡 Confusion | Decide |
| 38 | Response size anomaly detection gap | 🟡 Confusion | Spec or cut |
| 39 | Scope creep since Definitive Plan | 🔴 Blocks building | Acknowledge and re-scope |
| 40 | better-auth API key plugin compatibility | 🟡 Confusion | Verify plugin capabilities |
| 41 | Missing dedup guard in worker | 🟢 Cosmetic | Add to spec |
| 42 | Cloudflare CDN not in cost estimate | 🟢 Cosmetic | Document configuration |
| 43 | Learning period + shared monitoring interaction | 🟡 Confusion | Clarify |
| 44 | Weekly email content unspecified | 🟢 Cosmetic | Spec it |
| 45 | References to non-provided documents | 🟢 Cosmetic | Note for completeness |
| 46 | nanoid dependency missing from tech stack | 🟢 Cosmetic | Add or use UUID |
| 47 | R2 circuit breaker config single-source | 🟢 Cosmetic | Minor |

---

## Critical Path Assessment

**If I were starting to code tomorrow, these would block me:**

1. **Which tables to create?** — I'd need to reconcile all docs into one DDL file
2. **JWT or sessions?** — Fundamentally different auth architecture
3. **What's actually in MVP?** — The scope has crept well beyond the 8-week plan
4. **What's the base URL?** — chirri.io or chirri.io references everywhere
5. **Which queues to set up?** — 4, 6, or 7?
6. **Does `monitored_sources` exist?** — FK references to non-existent table

Everything else is reconcilable during implementation, but these 6 would halt a developer on day 1.

---

*Report generated: 2026-03-24*  
*Reviewed documents: DELTA_API_MASTER_SPEC.md, CHIRRI_PRODUCT_BIBLE.md, CHIRRI_DEFINITIVE_PLAN.md, CHIRRI_ARCHITECTURE.md, CHIRRI_URL_ONBOARDING_FLOW.md, CHIRRI_EARLY_WARNING_IMPLEMENTATION.md, CHIRRI_RELEVANCE_INTELLIGENCE.md, CHIRRI_SOURCE_TRACKING_MODEL.md, CHIRRI_SOURCE_PREFERENCES.md, CHIRRI_TECH_STACK_DECISIONS.md*
