# CHIRRI — Architecture Overview

**Version:** 2.0  
**Date:** 2026-03-24  
**Status:** High-Level Overview (read this first, then CHIRRI_BIBLE.md for details)

> ⚠️ **This document is a 10-minute overview.** The authoritative, complete specification is **CHIRRI_BIBLE.md v2.2**. When this document and the Bible disagree, the Bible wins. Every section includes pointers to the relevant Bible section for full details.

---

## 1. System Overview

Three Railway services, managed Postgres + Redis, Cloudflare R2 for storage:

```
                        Cloudflare CDN
                             |
               +-------------+-------------+
               |                           |
     SERVICE 1: API SERVER        SERVICE 3: CHECK WORKERS (x2)
     (Hono + better-auth)         (BullMQ consumers)
     - REST API (/v1/*)           - SSRF validation (safeFetch)
     - Dashboard SPA (Vite+React) - HTTP fetcher (undici + DNS pinning)
     - Session auth + API keys    - JSON/HTML diffing
     - Rate limiting (per-hour)   - Auto-classification (3-phase)
     - Stripe webhooks            - Baseline comparison
     - SSE real-time events       - Change detection + confirmation
     - Health (/health)           - Notification dispatch
              |                   - Early warning processing
              |                            |
     +--------+--------+                  |
     |                 |                   |
   PostgreSQL 16     Redis 7           Cloudflare R2
   (Neon/Railway)   (Upstash/Railway)  (snapshots, archives)
     |                 |
     SERVICE 2: SCHEDULER
     - Clock-aligned cron (1-min loop)
     - Enqueue check jobs (shared + private URLs)
     - Shared source scheduling
     - Missed-check recovery
     - Partition management
     - Retention purge (highest subscriber plan)
     - Weekly report generation
     - Deadline reminder scan
```

> **For details:** Bible §5.1 (system overview), §5.7 (scheduler cron jobs), §5.8 (failure modes)

---

## 2. Tech Stack Summary

| Layer | Choice | Version | Notes |
|---|---|---|---|
| **Runtime** | Node.js | ≥22.0.0 | ESM, TypeScript 5.4+ |
| **HTTP framework** | Hono | ^4.x | 13KB, native better-auth integration |
| **Auth** | better-auth | ^1.5.5 | Sessions (HttpOnly cookies) + API key plugin |
| **Password hashing** | Argon2id | via better-auth | OWASP recommended params |
| **ORM** | Drizzle ORM | ^0.36.0 (pinned 0.x) | Do NOT upgrade to v1.0 until stable |
| **Database** | PostgreSQL | 16 (managed) | Native declarative partitioning |
| **Cache/Queue** | Redis 7 + BullMQ 5 | Managed | noeviction policy, authenticated |
| **Object storage** | Cloudflare R2 | S3-compatible | Zero egress fees |
| **Email** | Resend | ^4.x | 3K emails/mo free, React Email templates |
| **Billing** | Stripe | ^17.x | Checkout, subscriptions, customer portal |
| **Dashboard** | Vite + React 19 + React Router 7 | — | TanStack Query 5, shadcn/ui, Tailwind 3 |
| **Diff viewer** | Monaco DiffEditor | ^4.7 | VS Code's diff engine |
| **Logging** | Pino | ^9.x | Structured JSON, Railway-compatible |
| **Error tracking** | Sentry | Free tier | 5K errors/mo |
| **CI** | GitHub Actions | — | 2K min/mo free |
| **CD** | Railway auto-deploy | — | "Wait for CI" enabled |
| **Testing** | Vitest + Supertest | — | Fast, native ESM/TS |
| **DNS/CDN** | Cloudflare | Free plan | DDoS protection, SSL |
| **Monitoring** | UptimeRobot | Free plan | External /health checks |

> **For details:** Bible §5.4 (tech stack), Appendix C (complete dependency list with versions)

---

## 3. Authentication Flow

Chirri uses **session-based auth via better-auth** (NOT JWT). Two auth paths:

### Dashboard (Browser)
```
POST /v1/auth/login { email, password }
  → better-auth validates credentials (Argon2id)
  → Creates session
  → Sets HttpOnly cookie (SameSite=Lax, Secure, Domain=.chirri.io)
  → All subsequent requests use cookie automatically
  → No refresh tokens needed — sessions are server-side
```

### API / MCP (Programmatic)
```
Authorization: Bearer ck_live_<nanoid>
  → Hash with SHA-256
  → Lookup in api_keys table
  → Validate not revoked
  → Resolve user + plan
```

**Key details:**
- API key prefixes: `ck_live_` (production), `ck_test_` (test mode — mock data, no real HTTP)
- CSRF protection: SameSite=Lax + CSRF token + Origin/Referer verification
- Account lockout: 10 failed attempts → 15 min lockout
- Email verification: non-blocking (1 URL immediately, full quota after verification)

> **For details:** Bible §6.2 (auth endpoints), §8.5 (auth security), §6.1 (CORS config)

---

## 4. Data Flow

```
URL Input → Classification → Learning → Active Monitoring → Change Detection → Notification

Step by step:
1. USER ADDS URL          POST /v1/urls → SSRF validation → shared_url lookup/create (advisory lock)
2. CLASSIFICATION          3-phase pipeline: domain patterns → response analysis → fallback
3. LEARNING PERIOD         30 checks @ 20s intervals → volatile field detection (>50% threshold)
4. CALIBRATING             7 days at plan interval, 95% confidence threshold (hidden from UI)
5. ACTIVE MONITORING       Scheduler enqueues jobs → workers fetch → 4-fingerprint comparison
6. CHANGE DETECTED         fullHash → stableHash → schemaHash → jsondiffpatch diff
7. CONFIRMATION            Stage 1 (5s recheck) → Stage 2 (30min recheck) → confirmed
8. FAN-OUT                 Create changes row (shared) → user_changes rows (per subscriber)
9. NOTIFICATION            Check preferences → min_severity → quiet hours → digest mode → send
```

**The 4-Fingerprint System:**
| Fingerprint | What it catches | Match = |
|---|---|---|
| fullHash | SHA-256(entire body) | No change (90% of checks) |
| stableHash | SHA-256(body minus volatile fields) | Only volatile fields changed |
| schemaHash | SHA-256(JSON keys + types) | Structural change (significant) |
| headerHash | SHA-256(normalized headers) | Header changes, version/deprecation signals |

> **For details:** Bible §2.7 (learning), §2.8 (checking pipeline), §2.9 (diff engine), §2.4 (classification)

---

## 5. Infrastructure

| Component | Service | Est. Monthly Cost |
|---|---|---|
| API Server | Railway (Hono + better-auth) | ~$7 |
| Scheduler | Railway (cron loops) | ~$7 |
| Check Workers (x2) | Railway (BullMQ consumers) | ~$14 |
| PostgreSQL 16 | Railway managed (or Neon) | ~$7 |
| Redis 7 | Railway managed (or Upstash) | ~$3 |
| R2 Storage | Cloudflare | ~$1 |
| Email | Resend | ~$3 |
| DNS/CDN | Cloudflare Free | $0 |
| Monitoring | UptimeRobot Free | $0 |
| **Total** | | **~$42/mo** |

**Break-even:** 10 Personal subscribers ($50/mo) or 3 Team subscribers ($57/mo).

**Scaling notes:**
- Start on Railway Hobby ($5/mo + usage), upgrade to Pro when static IPs needed
- Workers expose minimal HTTP health check on secondary port (e.g., 3001)
- Graceful shutdown: SIGTERM → stop accepting work → wait 30s → flush → close connections
- Deploy: Railway watches main branch, migrations run in prestart script

> **For details:** Bible §5.11 (Railway requirements), §D.17 (startup sequence), §D.8 (graceful shutdown)

---

## 6. Queue Architecture

10 BullMQ queues backed by Redis:

| Queue | Concurrency | Rate Limit | Retries | Purpose |
|---|---|---|---|---|
| url-checks | 10/worker | 1/sec/domain | 3, exponential | Main monitoring |
| learning-checks | 5/worker | 1/sec/domain | 1 | Rapid learning (20s intervals) |
| confirmation-checks | 5/worker | 1/sec/domain | 1 | 5s + 30min rechecks |
| notifications | 20/worker | 10/sec to Resend | 5 (1m→12h) | Email, webhook, Slack, Discord |
| classification | 3/worker | shared domain | 2 | Auto-classification pipeline |
| shared-source-checks | 5/worker | per-domain | 2 | Bonus source checks |
| signal-fanout | 10/worker | — | 2 | Relevance matching + delivery |
| package-checks | 5/worker | 10/min npm | 2 | npm/PyPI version checks |
| maintenance | 1 | — | 3 | Retention, archival, reports |
| failed-jobs (DLQ) | — | — | — | 7-day retention after max retries |

**Domain rate limiting:** Redis token bucket, 1 token/sec, max burst 3, per domain.

**Redis eviction policy:** `noeviction` (NOT allkeys-lru — BullMQ needs all job data preserved).

> **For details:** Bible §5.3 (queue architecture with job schemas), §5.7 (scheduler cron jobs)

---

## 7. Security Layers

| Layer | Implementation |
|---|---|
| **SSRF Prevention** | safeFetch() with 8-vector coverage: protocol check, hostname blocklist, DNS pinning, IP blocklist (RFC 1918, loopback, link-local, CGN, IPv6), IP normalization (ipaddr.js), manual redirect following (max 5, re-validate each hop), custom header stripping for blocked destinations, 5MB body limit |
| **Auth** | Sessions (HttpOnly, SameSite=Lax, Secure, Domain=.chirri.io), Argon2id, account lockout, CSRF tokens |
| **XSS** | CSP headers, React auto-escaping, jsondiffpatch programmatic delta (NOT HTML formatter — CVE-2025-9910), prototype pollution prevention |
| **Cross-Tenant** | Timing oracle normalization (~3s for all URL additions), discovered_by never exposed, subscriber_count hidden/bucketed |
| **Webhook Signing** | HMAC-SHA256: `X-Chirri-Signature: t=<timestamp>,v1=<hmac>`, 300s replay window, constant-time comparison |
| **ReDoS** | re2js (Google RE2, linear-time matching) for all regex against untrusted content |
| **Rate Limiting** | Per-hour sliding window (Redis Sorted Set, 3700s TTL), per-plan limits |
| **Secrets** | AES-256-GCM encryption for url_secrets and oauth_tokens, write-only API |
| **GDPR** | 7-day grace deletion, complete cascade across all 15+ tables |
| **False Positive Defense** | 6-layer system: volatile filtering, cross-source correlation, confirmation recheck, per-user feedback, stability scoring, proactive detection |

> **For details:** Bible §5.5 (SSRF), §8 (full security section), §8.9 (GDPR deletion cascade), §5.6 (FP defense)

---

## 8. API Structure

**Base URL:** `https://api.chirri.io/v1`

**IDs:** Prefixed nanoid (TEXT, not UUID). Examples: `usr_`, `url_`, `chg_`, `wh_`, `frc_`

**Pagination:** Cursor-based (opaque base64 of created_at + id), max 100 per page.

**Response format:**
- Single: `{ "id": "url_...", "url": "...", ... }`
- List: `{ "data": [...], "has_more": true, "next_cursor": "cur_..." }`
- Error: `{ "error": { "code": "...", "message": "...", "status": 400 } }`

### Endpoint Groups

| Group | Key Endpoints | Auth |
|---|---|---|
| **Auth** | signup, login, logout, verify-email, forgot/reset-password | Per-IP rate limits |
| **API Keys** | create (session only), list, rename, revoke | Session |
| **URLs** | CRUD, bulk create/delete, export | Session or API key |
| **Changes** | feed, detail, track/ignore/snooze/resolve, feedback | Session or API key |
| **Forecasts** | list, detail, acknowledge, dismiss, summary | Session or API key |
| **Check History** | paginated results, trigger immediate check | Session or API key |
| **Sources** | list per URL, update preferences, bulk update, reset | Session or API key |
| **Webhooks** | CRUD, test, rotate-secret, delivery log | Session or API key |
| **Providers** | list, search, detail (read-only) | Session or API key |
| **Notifications** | history, preferences get/update | Session or API key |
| **Account** | profile, usage, billing, export, delete | Session or API key |
| **Health** | /health (public), /internal/metrics (INTERNAL_API_TOKEN) | Varies |

### Rate Limits by Plan

| Plan | API Requests/Hour |
|---|---|
| Unauthenticated | 20/IP |
| Free | 10 |
| Personal ($5/mo) | 60 |
| Team ($19/mo) | 200 |
| Business ($49/mo) | 500 |

### Pricing Tiers

| | Free | Personal ($5) | Team ($19) | Business ($49) |
|---|---|---|---|---|
| URL slots | 3 | 10 | 50 | 200 |
| Min interval | Daily | 1 hour | 15 min | 5 min |
| History | 7 days | 30 days | 90 days | 365 days |
| Webhooks | 0 | 3 | 10 | Unlimited |
| Notifications | Email + Discord | + Slack, Webhooks | All | All |

> **For details:** Bible §6.1-6.6 (API overview, all endpoints, error codes), §4.1 (pricing), §5.9 (PLAN_LIMITS TypeScript config)

---

## 9. Database Schema

The Bible (§5.2) defines the complete schema. Key tables:

**Core:** users, urls, shared_urls, baselines, check_results (partitioned), changes, user_changes

**Notifications:** webhooks, webhook_deliveries, notifications

**Early Warning:** forecasts, user_forecasts, header_snapshots

**Shared Intelligence:** shared_sources, signals, signal_matches, domain_user_counts

**Security/Secrets:** url_secrets, oauth_tokens, integrations, tickets, feedback

**Supporting:** learning_samples, domain_patterns, package_versions, spec_snapshots, source_alert_preferences, discovery_results

All tables use `TEXT PRIMARY KEY` with prefixed nanoid IDs generated app-side (e.g., `usr_V1StGXR8_Z5jdHi6B`).

The `check_results` table uses native Postgres declarative partitioning by month (NOT pg_partman). Partition creation/drops handled by scheduler cron, not Drizzle Kit.

> **For details:** Bible §5.2 (complete schema with all columns, types, indexes, constraints), §D.15 (migration strategy)

---

## 10. Key Reference Pointers

| Topic | Where to Find It |
|---|---|
| Complete database schema | Bible §5.2 |
| All API endpoints with request/response | Bible §6.2 |
| Queue job schemas (TypeScript interfaces) | Bible §5.3 |
| Checking pipeline (11-step flow) | Bible §2.8 |
| Early warning signal types | Bible §3.2 |
| Notification channel formats (Slack, Discord, webhook) | Bible §D.10, §D.11, §D.4 |
| MCP server tools (8 tools) | Bible §7.3, §D.7 |
| Provider profile structure | Bible §5.10 |
| Environment variables | Bible §D.20 |
| Startup sequence | Bible §D.17 |
| GDPR deletion cascade | Bible §8.9 |
| Severity enum | Bible §2.12: `critical \| high \| medium \| low` |
| Workflow states | Bible §2.11, §6.4: `new \| tracked \| ignored \| snoozed \| resolved` |
| Plan limits (TypeScript) | Bible §5.9 |

---

*This architecture overview is synchronized with CHIRRI_BIBLE.md v2.2 (2026-03-24). For implementation details, always refer to the Bible.*

*Version 2.0 — 2026-03-24*
