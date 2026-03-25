# CHIRRI — THE FINAL DEBATE

**Is Chirri Ready to Build?**

**Date:** March 23, 2026  
**Moderator:** The Process  
**Duration:** 6 rounds, no holds barred  
**Output:** The definitive build plan. After this, we code.

---

## THE PANEL

🏛️ **MARCUS (Chief Architect)** — Designed the full architecture: 15 tables, 6 queues, 35 endpoints, 3 Railway services. Wants to build it right. Hates shortcuts.

🔓 **YUKI (Security Engineer)** — Found 34 attack vectors, only 9 addressed. Will fight for every mitigation before launch.

📈 **PRIYA (Product Strategist)** — Researched feature expansion. Wants uptime, TTFB, SSL, and headers in MVP. More features = more value = less churn.

🎯 **ALEX-PROXY (Founder Advocate)** — Represents Alex's priorities: ship fast, iterate, don't over-engineer. $100K ARR is fine. Quirky brand matters. Has final say.

---

## ROUND 1: IS THE ARCHITECTURE OVER-ENGINEERED?

**ALEX-PROXY:** Marcus, I love you, but you designed a spaceship when we need a bicycle. 15 database tables? 6 BullMQ queues? 35 API endpoints? We have ZERO users. I need 5 tables and 10 endpoints. Something I can ship and start learning from.

**MARCUS:** That's a great way to build something you throw away in 3 months. Let me quote the technical red team, §1.1: *"One process crash = everything dies. API goes down, checks stop, webhooks stop delivering."* The 3-service split isn't over-engineering — it's basic blast radius isolation. You cannot run the API server and outbound check workers in the same process. A malicious URL that returns a 100MB response or hangs for 30 seconds blocks your entire API. This is FATAL, not optional.

**ALEX-PROXY:** Fine, I'll give you 3 services. But 15 tables? You have `learning_samples`, `monitoring_packs`, `domain_patterns`, `webhook_deliveries` — half of these are V2 concerns.

**MARCUS:** Let me walk through what's actually necessary for launch:

| Table | Why It's Needed |
|-------|----------------|
| `users` | Obviously |
| `api_keys` | Auth for the API |
| `urls` | What we're monitoring |
| `shared_urls` | Deduplication — this is the CDN model, it's core architecture |
| `baselines` | Current known state per URL |
| `check_results` | History of checks (partitioned) |
| `changes` | Detected changes — this IS the product |
| `user_changes` | Per-user view of changes (feedback, acknowledgment) |
| `webhooks` | Notification delivery |
| `webhook_deliveries` | Debug log for webhooks — users WILL ask "did my webhook fire?" |
| `notifications` | Audit trail |

That's 11 tables. I can defer `integrations` (Slack/Discord are V2), `monitoring_packs` (V2), `domain_patterns` (can be a JSON config file), and `learning_samples` (can store in Redis or inline).

**ALEX-PROXY:** 11 tables. Down from 15. That's progress. What about the 35 endpoints?

**MARCUS:** The MVP API needs:

**Auth (4):** signup, login, refresh, revoke  
**API Keys (3):** create, list, delete  
**URLs (5):** create, list, get, update, delete  
**Changes (4):** list, get, acknowledge, feedback  
**Webhooks (5):** create, list, update, delete, test  
**Account (3):** get, usage, export  
**Health (2):** /health, /internal/metrics  
**OpenAPI (1):** /v1/openapi.json  

That's 27 endpoints. I can defer classification endpoints (3), monitoring packs (3), integrations (3), and snapshot viewer (1).

**PRIYA:** Hold on. If I'm adding uptime and response time tracking — which I'm going to argue for in Round 3 — those don't need NEW endpoints. They piggyback on existing data. The `GET /v1/urls/:id` response just includes `stats.avg_response_time_ms` and `stats.uptime_percentage`. Zero new endpoints.

**YUKI:** I don't care how many endpoints you have. I care that every one of them has input validation, rate limiting, and authorization checks. Cut endpoints if you want, but don't cut security from the ones that remain. The architecture document has `SSRF prevention`, `rate limiting`, `plan limit enforcement` — those aren't optional.

**ALEX-PROXY:** Fine. But the 6 queues, Marcus. Six.

**MARCUS:** I'll compromise. For MVP, we need 4:

1. **`url-checks`** — the main check queue. Non-negotiable.
2. **`learning-checks`** — rapid 20-second checks during learning. The red team called the learning period a FATAL flaw if not implemented (§3.4): *"The #1 differentiating feature is unimplemented and unvalidated."*
3. **`confirmation-checks`** — recheck after change detection. Two-stage: 5s + 30min.
4. **`notifications`** — webhook/email delivery with retries.

I can merge `classification` into `url-checks` (run classification as part of the first check). I can defer `maintenance` queue and use cron jobs directly from the scheduler.

### ROUND 1 RESOLUTION

| Component | Original | MVP | Cut |
|-----------|----------|-----|-----|
| Tables | 15 | 11 | `integrations`, `monitoring_packs`, `domain_patterns` (→ JSON file), `learning_samples` (→ Redis) |
| Endpoints | 35 | 27 | Classification (3), packs (3), integrations (3), snapshots (1) |
| Queues | 6 | 4 | `classification` (merged), `maintenance` (→ cron) |
| Services | 3 | 3 | Non-negotiable per red team |

---

## ROUND 2: SECURITY VS SPEED

**YUKI:** I found 34 attack vectors. 8 critical, 13 high, 10 medium, 3 low. The spec addresses 9 of 34. That's a 26% coverage rate. Let me be blunt: **this product is a sanctioned SSRF-as-a-Service.** Users submit URLs, we fetch them. Without comprehensive SSRF prevention, someone WILL use us to scan internal networks, hit cloud metadata endpoints, or DDoS targets.

**ALEX-PROXY:** Yuki, we'll have maybe 10 users at launch. Probably friends and beta testers. Nobody's going to SSRF attack a product with 10 users.

**YUKI:** You're wrong, and I can prove it with evidence. From my report, SSRF-01 through SSRF-08: DNS rebinding, IPv4-mapped IPv6 bypasses, octal IP notation, Railway internal network access, redirect chain attacks, webhook DNS rebinding. These aren't theoretical — they're automated attacks. Bots scan for SSRF endpoints constantly. The moment you're indexed or posted on HN, you're a target.

But more importantly: **SSRF isn't retrofittable.** Marcus, back me up here.

**MARCUS:** She's right. SSRF prevention touches the HTTP client, DNS resolution, URL validation, redirect handling, and webhook delivery. If you build the check engine without SSRF guard rails, you're building ON TOP of a vulnerability. Every feature that touches outbound HTTP — checks, webhooks, confirmation rechecks, classification probes — needs to go through the same SSRF-safe fetch layer. Build it wrong and you rewrite everything.

**ALEX-PROXY:** OK, I hear you on SSRF. What about the other 26 vectors? You want all 34 fixed before we launch?

**YUKI:** No. I'm not unreasonable. Let me tier them:

### 🚫 LAUNCH BLOCKERS (Must fix before any user touches the product)

| ID | Attack | Why It's a Blocker |
|----|--------|--------------------|
| SSRF-01 | DNS Rebinding | Core SSRF bypass, automated |
| SSRF-02 | IPv4-Mapped IPv6 | SSRF bypass variant |
| SSRF-03 | Octal/Decimal/Hex IP | SSRF bypass variant |
| SSRF-04 | Redirect Chain SSRF | SSRF via open redirectors |
| SSRF-05 | Railway Internal Network | Access to our own DB/Redis |
| SSRF-07 | Webhook DNS Rebinding | SSRF at delivery time |
| DATA-01 | Cross-Tenant Leak via Shared Monitoring | Users seeing each other's data |
| INJ-01 | Stored XSS via API Response Display | Account takeover via diff viewer |
| ABUSE-01 | DDoS Amplification | We become a weapon |

That's 9. These are architectural — they're in the foundation layer.

### ⚠️ FIX WITHIN 2 WEEKS POST-LAUNCH

| ID | Attack | Why It Can Wait |
|----|--------|----------------|
| SSRF-06 | URL Parser Differentials | Edge case, defense-in-depth |
| SSRF-08 | Cloud Metadata via CNAME | Caught by IP check if DNS pinning works |
| DATA-02 | Snapshot IDOR | Use UUIDs + ownership check, straightforward |
| INJ-02 | CRLF Header Injection | Validate custom headers |
| INJ-04 | Webhook URL SSRF | Same SSRF module handles this |
| INJ-05 | Prototype Pollution | Sanitize JSON before jsondiffpatch |
| AUTH-01 | API Key in Query Params | Reject and educate |
| AUTH-02 | CSRF on Dashboard | SameSite=Strict cookies |
| AUTH-03 | JWT Theft via XSS | Store in HttpOnly cookie |
| SUPPLY-02 | Redis Unauthenticated | Railway Redis requires auth by default |
| BIZ-01 | Plan Limit Race Condition | Use DB transaction with FOR UPDATE |

### 📋 POST-LAUNCH (Month 2+)

Everything else: account enumeration, timing side-channels, test mode abuse, dependency confusion, competitive intelligence, interval downgrade bypass, pack abuse. These are real but low-priority with <100 users.

**ALEX-PROXY:** So 9 blockers, 11 quick-fixes, 14 deferred. How long do the 9 blockers take?

**YUKI:** The SSRF module is the big one. If Marcus builds it as a single `safeFetch()` function with DNS pinning, IP blocklist (using `ipaddr.js`), hostname blocklist, redirect chain validation, and response size limits — that's 2-3 days of focused work, including tests. The shared monitoring isolation (DATA-01) is a design decision: shared URL key MUST include headers hash, and baselines must be per-user. That's 1 day. XSS prevention (INJ-01) is framework-level: use React/Svelte auto-escaping, never use `dangerouslySetInnerHTML` on API response data, add CSP headers. Half a day. DDoS prevention (ABUSE-01) is per-domain rate limiting + global domain caps in Redis. 1 day.

**Total: 5 days of security work woven into the build.** Not 5 extra days — 5 days of doing it right the first time instead of wrong.

**MARCUS:** I can build the `safeFetch()` module in Week 2 when I build the check engine. SSRF validation is step 3 of the check flow — it's already in my pipeline design. This isn't extra work, it's correct work.

**PRIYA:** I just want to say: every day we spend on security that nobody sees is a day we're not shipping features. Users won't care about SSRF prevention. They'll care about whether the diff viewer looks good.

**YUKI:** Users won't care about SSRF prevention until someone uses your product to hit `169.254.169.254` and steals Railway credentials. Then they'll care a lot when the service goes down and their data leaks. You're asking to build a house without a foundation because "nobody sees the foundation."

**ALEX-PROXY:** Yuki wins this one. The 9 blockers are non-negotiable. But I'm holding you to 5 days of security work integrated into the build, not 5 days of security theater on top.

### ROUND 2 RESOLUTION

**Launch Blockers (9):** SSRF comprehensive module, cross-tenant isolation, XSS prevention, DDoS rate limiting. Built into the normal development flow.

**Quick-Fix Post-Launch (11):** CSRF, CRLF injection, IDOR checks, prototype pollution, JWT storage. Fix within 2 weeks of launch.

**Deferred (14):** Low-priority with small user base. Track in backlog.

**Timeline Impact:** ~0 extra days if built correctly from the start. SSRF module is part of Week 2 check engine build.

---

## ROUND 3: FEATURE SCOPE

**PRIYA:** I've done the research and I'm going to argue for 4 additions to MVP. Before you all groan, hear me out — these are nearly free because we already have the data.

**1. Response Time Tracking (TTFB)**  
We're already making HTTP requests. Recording `Date.now()` before and after is one line of code. Store p50/p95 per check window. Alert when deviation exceeds 2x baseline. The architecture doc already has `response_time_ms` in `check_results`. This is literally already in Marcus's schema. We just need to surface it.

**2. Lightweight Uptime**  
We already capture status codes. If we get a 500 or timeout, that's a "change" from 200. Uptime percentage is `COUNT(status=200) / COUNT(*)`. This is a SQL query on existing data. Zero new tables, zero new endpoints.

**3. SSL Certificate Monitoring**  
We're making HTTPS requests. TLS handshake metadata includes cert expiry and issuer. Node.js `tls.TLSSocket` exposes `getPeerCertificate()`. Store cert expiry date, alert 30 days before. One extra column in `baselines`.

**4. Header Change Tracking**  
From my research: *"This is the most natural extension possible. Headers ARE part of the API response."* The architecture doc already has `headerHash` as one of the four fingerprints. Rate limit headers changing, deprecation headers appearing — this is gold that nobody else monitors. We just need to surface header diffs in the change detail view.

**MARCUS:** Let me respond to each:

**TTFB:** I already have `response_time_ms` in `check_results` and the worker pipeline. Surfacing it costs me... nothing. It's already captured. Adding a "latency regression" change type to the severity engine: half a day.

**Uptime:** Same. Status code is already captured. Computing uptime percentage is a query. Adding it to `GET /v1/urls/:id` response: trivial. Adding a "status_code changed" alert: already in the change detection logic.

**SSL:** This is more work than Priya thinks. `undici` (our HTTP client) doesn't expose cert details the same way `tls.TLSSocket` does. We'd need to either use Node's built-in `https` module for cert checks or add a separate TLS probe. It's not one line of code — it's probably a day of work plus edge cases (cert chains, self-signed, expired certs that still work).

**Headers:** Already in the architecture. `headerHash` is fingerprint #4. Header diffing is part of the change detection engine. The question is UX: which headers to highlight, how to filter noise. Half a day to add header diff to the change detail view.

**YUKI:** Every feature is attack surface. TTFB and uptime: negligible new attack surface, since we're just capturing data we already have. SSL cert monitoring: adds a TLS connection concern, but we're already doing TLS. Acceptable. Header tracking: no new attack surface, we already receive headers. I'm OK with all four IF — and this is non-negotiable — the header display is HTML-escaped to prevent XSS from malicious header values. Some servers return executable content in custom headers.

**ALEX-PROXY:** Wait, Priya. Your research doc also proposes different plan limits than the master spec. You want 5 free URLs instead of 3, and 25 Indie URLs instead of 20. The business red team specifically said the free tier is already too generous (§1.1): *"3 is enough to prove value. 5 was too generous — many small users would never convert."* And you want to make it MORE generous?

**PRIYA:** I was wrong about the plan limits. The master spec's pricing is already locked in. I'm not trying to change pricing. I'm trying to add features that make the VALUE PROP stronger. Here's why these 4 features matter for churn:

The business red team identified the "Nothing Happened" churn problem as FATAL (§1.2): *"If Delta works perfectly, the user gets zero alerts for months. They open their credit card statement: '$9 for Delta API... what does that even do again? Cancel.'"*

My features address this directly:
- **TTFB tracking** → "Your APIs stayed fast this week. Average response time: 245ms." That's visible value even when nothing breaks.
- **Uptime tracking** → "99.98% uptime across your 12 monitored APIs." More visible value.
- **SSL monitoring** → "3 certificates expiring in the next 60 days." Proactive value.
- **Headers** → "2 rate limit changes detected this month." Change detection beyond body changes.

These transform Chirri from "fire-and-forget insurance" into "continuous API health dashboard." That's the difference between 7% monthly churn and 4% monthly churn.

**MARCUS:** I'm going to agree with Priya, with caveats. TTFB, uptime, and header tracking add maybe 2 days of total work because the infrastructure already supports them. SSL is another 1-1.5 days. For 3-3.5 days of work, we get a significantly more compelling product.

**But I draw the line here.** Priya's research also mentions changelog aggregation, historical trends, stability scores, OpenAPI spec diffing, team features. Those are all V2. Each one adds real complexity.

**ALEX-PROXY:** Let me decide.

✅ **TTFB tracking** — Free. Already in the schema. Ship it.  
✅ **Uptime/availability** — Free. Already in the data. Ship it.  
⏳ **SSL cert monitoring** — 1.5 days of real work. Defer to Week 9 (first week post-launch). It's nice but not core.  
✅ **Header change tracking** — Already in the architecture. Surface it in the diff viewer.  

Three features in. One deferred. Net cost: ~2 days of work.

### ROUND 3 RESOLUTION

**MVP Features:**
- Core change detection (body structure, content, status code)
- Response time tracking (TTFB) with regression alerts
- Uptime/availability tracking (status code history, uptime %)
- Header change tracking with diff display
- Webhooks + email notifications
- Dashboard with change detail view (side-by-side diff)
- Stripe billing (Free/Indie/Pro/Business)

**V1.1 (Weeks 9-12):**
- SSL certificate monitoring
- Slack + Discord integrations
- RSS/Atom feed monitoring
- All check intervals (1m, 5m, 15m, 6h)
- Tag-based filtering
- Monitoring packs (lean: 3-4 URLs per pack)

**V2 (Months 3-4):**
- OpenAPI spec diffing (via oasdiff)
- Weekly changelog digest emails
- Historical trends + stability scores
- Basic team/org features
- Telegram/Teams/PagerDuty integrations

**V3 (Months 5+):**
- AI-powered change summaries
- Public API Stability Index
- Customer-hosted agent
- GraphQL schema monitoring
- MCP tool server for AI agents

---

## ROUND 4: THE TIMELINE

**ALEX-PROXY:** The master spec says 8 weeks. Marcus's architecture is 6-8 weeks. Priya added 2 days of features. Yuki's security is baked in. I want 6 weeks.

**MARCUS:** The technical red team was explicit (§9): *"The MVP is realistically a 6-8 week build for one developer."* Their component-by-component estimate was 35-50 person-days. Let me rebuild the timeline with our reduced scope:

| Week | Focus | Deliverables |
|------|-------|-------------|
| **Week 1** | Foundation | Railway setup (3 services). PostgreSQL + Redis. Drizzle ORM + migrations. 11-table schema with `pg_partman` partitioning on `check_results`. API skeleton (Hono). Auth (email/password → JWT in HttpOnly cookie). API key generation + SHA-256 hash storage. Rate limiting middleware (Redis sliding window). Health endpoint. Structured logging (pino). |
| **Week 2** | Check Engine | BullMQ queue setup (4 queues). `safeFetch()` module with complete SSRF prevention (DNS pinning, IP blocklist via `ipaddr.js`, hostname blocklist, redirect chain validation, response size limit). Check worker: HTTP GET → capture response + TTFB + status code. JSON diff engine (jsondiffpatch with array sort fix). Multi-layer fingerprinting (4 hashes). Volatile field detection. Per-domain outbound rate limiting (Redis token bucket). Circuit breaker per domain. Shared monitoring deduplication. Cross-tenant isolation (shared URL key includes headers hash). |
| **Week 3** | Detection + Notifications | Silent learning period: rapid 20s checks → state machine (learning → calibrating → active). Confirmation recheck (5s immediate + 30min delayed for non-critical). Full CRUD API for URLs (5 endpoints). Changes API (4 endpoints). Webhook delivery with HMAC signing + timestamp + per-webhook secrets. Email notifications via Resend. Error handling (transient/permanent/internal). Input validation (all zod schemas). Plan limit enforcement middleware. OpenAPI spec generation (zod-to-openapi). Graceful shutdown (SIGTERM handler). |
| **Week 4** | Dashboard | Next.js/SvelteKit dashboard. Auth UI (signup, login). URL management (add/remove/pause). **Change detail view** — side-by-side diff with auto-generated summary + actionable recommendations. This is THE product screen. Change feed with severity filters. URL detail with uptime %, avg response time, header history. Activity dashboard. Account settings. |
| **Week 5** | Billing + Polish | Stripe Checkout integration. Stripe webhook handling (checkout.completed, subscription.updated/deleted, invoice.payment_failed). Billing UI (plan display, upgrade button). Landing page. Privacy policy + ToS (Termly template). Security hardening: CSP headers, CORS config, credential detection in URLs, self-referential blocking (*.chirri.io). Outbound abuse prevention (per-domain caps, velocity limits, email verification before checks). Daily DB backups to R2. UptimeRobot setup. Canary URL (httpbin.org/get). Scalar API docs. |
| **Week 6** | Testing + Beta | Unit tests: diff engine, SSRF module, classification, rate limiting, plan limits. Integration tests: full check cycle (add URL → learn → check → detect → alert), Stripe webhooks, auth flows. Mock API server for testing. Invite 10-20 beta users. Bug fixing. k6 load test: simulate 500 URLs at mixed intervals. |
| **Week 7** | Hardening | Fix beta bugs. Performance tuning based on load test results. Error handling edge cases. /internal/metrics endpoint. Missed-check recovery on startup. 48-hour zero-false-positive validation against 50+ real URLs. Quick-fix security items from Yuki's post-launch list (CSRF, CRLF, IDOR, prototype pollution). |
| **Week 8** | **LAUNCH** | Write Show HN post. Final security review. Production deploy. Launch: HN + Product Hunt + Reddit + Twitter. Monitor closely for 48 hours. Daily standby for bug fixes. |

**YUKI:** I need Week 6 to include security testing, not just functional testing. Specifically: SSRF bypass attempts with all 8 techniques from my report, XSS injection via mock API responses, authorization checks on every endpoint (IDOR), rate limiting validation under load.

**MARCUS:** That's in the unit tests — "SSRF module" testing covers all bypass techniques. But yes, I'll add explicit SSRF integration tests that try DNS rebinding, octal IPs, IPv6-mapped addresses, Railway internal hostnames, and redirect chains to metadata endpoints.

**PRIYA:** Where's the pre-launch monitoring? The master spec says: *"Start monitoring 50 popular APIs internally — accumulate change data."* If we don't have pre-computed change data at launch, new users see an empty dashboard. That's the onboarding dead zone the business red team warned about (§7.1).

**MARCUS:** We can start internal monitoring in Week 5 or 6, once the check engine is stable. 50 popular APIs running at daily frequency. By launch day, we have 2-3 weeks of change data to show: "Here's what changed in Stripe/OpenAI/Shopify this month."

**ALEX-PROXY:** 8 weeks. I wanted 6, but Marcus's breakdown is honest. The 2-week sprint plan in the original spec was fantasy — the technical red team called it FATAL. I'd rather launch in 8 weeks with something solid than in 6 weeks with something broken.

But I'm adding a constraint: **Week 4 is demo day.** By end of Week 4, I want to see: add a URL via API, watch it go through learning, see a detected change in the dashboard with a side-by-side diff. If that doesn't work by Week 4, we have a problem.

### ROUND 4 RESOLUTION

**Total Timeline: 8 weeks to public launch.**

- Weeks 1-3: Core engine (foundation, check engine, detection + notifications)
- Week 4: Dashboard (DEMO DAY — full flow must work)
- Week 5: Billing + polish + start internal monitoring
- Week 6: Testing + beta (including security tests)
- Week 7: Hardening + bug fixes + post-launch security items
- Week 8: LAUNCH

**Post-Launch: Weeks 9-12** → V1.1 features (SSL, Slack/Discord, RSS monitoring, faster intervals)

---

## ROUND 5: THE HARD QUESTIONS

### Q1: Is the auto-classification pipeline actually buildable in the timeline?

**MARCUS:** The full 6-phase pipeline from the spec? No. The technical red team tested it against 10 common URL patterns and it failed for 8 of them (§4.1). The path pattern `/api/` matching documentation pages at 85% confidence is dangerous.

For MVP, I'm simplifying to 3 phases:
1. **Domain pattern match** — known domains (GitHub, npm, Stripe, etc.) from a JSON config file. ~30 patterns. This covers the highest-value URLs with near-zero false classification.
2. **Response-based classification** — fetch the URL, check Content-Type header, parse body, determine if it's JSON/RSS/HTML/XML. No path heuristics (too error-prone).
3. **Fallback** — JSON diff with learning period for everything else.

The fancy stuff (path pattern heuristics, response header signals, discovery budget, generator-to-feed mapping) is all V2. The red team was right: premature classification sophistication causes more problems than it solves.

**YUKI:** Agreed. Simpler classification = smaller attack surface.

### Q2: Will the diff engine produce usable results or just noise?

**MARCUS:** The technical red team identified real issues with jsondiffpatch: array reordering false positives (§2.1), no response size backpressure (§2.2), recursion depth risks (§2.3). My fixes:

1. **Array handling:** Sort primitive arrays before diffing. For object arrays, use `id`/`_id`/`name` for identity, and for arrays without ID fields, use order-insensitive comparison (sort by JSON.stringify of each element).
2. **Response size:** Hard 5MB limit enforced at the HTTP client level (abort if Content-Length exceeds or streaming byte counter hits limit). For responses >1MB, fall back to hash-only comparison.
3. **Recursion depth:** Max 20 levels. If exceeded, hash the subtree.
4. **Global ignore list trimmed:** The red team caught that ignoring `url` and `headers` globally was too aggressive (§8.4). Only ignore truly universal volatile fields: `timestamp`, `*_at`, `request_id`, `trace_id`, `nonce`, `csrf_token`, `session_id`, `cursor`, `etag`. Everything else is learned per-URL.

The diff engine will work. But the quality depends entirely on the learning period.

### Q3: Is the "change detail view" (side-by-side diff) the real product or is it the alerts?

**ALEX-PROXY:** This is the most important question. The master spec says: *"This view is what makes Chirri 10x better than 'your API changed' email notifications. The diff IS the product."*

I agree. The alert gets you to the door. The diff view is the room. If someone gets an alert, clicks through, and sees a beautiful side-by-side diff with:
- Left panel: previous state (red strikethrough on removed)
- Right panel: current state (green highlight on added)
- Auto-generated summary: "Field `amount` removed from response"
- Recommended action: "Update your integration to handle missing `amount` field"
- One-click feedback: ✅ Real | ❌ False Positive | 🤷 Not Sure

...that's the moment they upgrade from free to paid. That's the "holy shit, this is useful" moment.

**PRIYA:** And that's exactly why TTFB and uptime matter. When you add response time graphs and uptime percentage to the URL detail page, even when nothing has changed, the user sees a live, active dashboard. The change detail view is for the WOW moment. The URL detail page with health metrics is for the STAY moment.

**MARCUS:** The change detail view is Week 4's deliverable. It's the centerpiece of the dashboard sprint. I'll make sure it gets the most design attention.

### Q4: Should we launch with a waitlist first to validate demand?

**ALEX-PROXY:** The business red team said (§2.2): *"Before building, run a smoke test: landing page with pricing, 'Join waitlist' button, measure signups."* And (§2.3): *"Nobody buys fire insurance after the neighbor's house burns down."*

Here's my take: We're already 8 weeks deep in planning docs. We have the architecture, security review, feature research, red teams. If I add a 2-week waitlist validation phase, that's 10 weeks before I write a line of code.

**No waitlist.** But I'm stealing the idea of pre-launch monitoring. Starting Week 5, we monitor 50 popular APIs internally. We tweet real changes as we find them. By launch, we have:
1. Proof the detection works
2. Content for the launch blog post ("We found 12 API changes in 3 weeks of monitoring")
3. Pre-computed data for new users

That's our validation. Real changes detected, shared publicly.

**PRIYA:** That's smart. "We found that Stripe quietly changed their pricing API response structure on March 28" is a better launch tweet than "We built an API monitoring tool."

### Q5: What's the ONE thing that must work perfectly at launch?

**Everyone, simultaneously:**

**MARCUS:** The check → detect → diff → notify pipeline. If a URL changes and we don't detect it, or we detect it wrong, or the notification doesn't fire — we're dead.

**YUKI:** SSRF prevention. If someone uses us to hit internal services on day 1 and it makes HN, we're done.

**PRIYA:** The change detail view. It's the conversion moment. A beautiful diff turns a free user into a paying user.

**ALEX-PROXY:** All three. But if I had to pick ONE: **zero false positives for the first 100 beta users.** The business red team said it: *"If 2 false positives happen: 'This tool is useless.' Unsubscribe."* We get one shot at first impressions.

The learning period, confirmation recheck, volatile field detection — all of it exists to serve this one goal. If a change fires and it's wrong, we've lost that user forever.

### ROUND 5 RESOLUTION

1. **Auto-classification:** Simplified to 3 phases (domain patterns, response-based, fallback). Fancy heuristics deferred.
2. **Diff engine:** Usable with array sort fix, response size limits, depth limits, trimmed global ignore list.
3. **Core product:** The change detail view IS the product. Alerts are the hook. Health dashboard is retention.
4. **No waitlist.** Pre-launch monitoring of 50 APIs starting Week 5 is our validation.
5. **ONE thing:** Zero false positives for first users. Learning period + confirmation recheck + volatile detection must work perfectly.

---

## ROUND 6: FINAL CONSENSUS

### 🏛️ MARCUS (Chief Architect)

**Top 3 Concerns:**
1. The 7-day calibration period means users don't get full-quality detection for a week. We need to communicate this clearly ("Detection accuracy improves over the first 7 days") or users will think it's broken.
2. The diff engine with jsondiffpatch is good but not perfect. We'll see edge cases we haven't predicted. We need to ship with aggressive feedback collection (one-click false positive reporting) and iterate the engine weekly.
3. The shared monitoring deduplication adds complexity. If we get the shared URL key wrong, we either leak data across tenants or miss dedup opportunities. I want explicit integration tests for this.

**What I'd cut:** Monitoring packs entirely (they're marketing, not product). Domain pattern knowledge base beyond 10 essential domains (start with GitHub, npm, Stripe, OpenAI, Shopify, Twilio, AWS, Statuspage.io, PyPI, Docker Hub). The 30-minute Stage 2 confirmation recheck for non-critical changes (launch with 5-second recheck only, add 30-minute delayed recheck in Week 9 based on false positive data).

**What I'd add:** A "debug mode" for the check engine that logs every step of the check pipeline for a specific URL. When a user reports a false positive, we can replay exactly what happened. This is 1 day of work and saves weeks of debugging.

**Go/No-Go:** ✅ GO — with the 8-week timeline and reduced scope.

**Confidence:** 7/10 — The architecture is solid. My concern is that we'll hit unexpected edge cases in real-world API responses that our test suite doesn't cover. The first month post-launch will be intense.

---

### 🔓 YUKI (Security Engineer)

**Top 3 Concerns:**
1. The `safeFetch()` module is the single most important piece of code in the entire product. If it has a bypass, everything else is irrelevant. I want a dedicated security review of this module by an external reviewer before launch (or at minimum, a bug bounty).
2. Webhook delivery is a second SSRF surface that's easy to forget. The same DNS pinning and IP validation must apply at delivery time, not just registration time.
3. We still haven't addressed test mode behavior (BIZ-04 from my report). If `dk_test_` keys trigger real HTTP requests, that's free monitoring AND a way to test SSRF bypasses without a paper trail. Test mode must return mock data only.

**What I'd cut:** Nothing. I already compromised on 14 deferred issues and 11 quick-fix post-launch items. The 9 launch blockers stay.

**What I'd add:** 
1. A security.txt file at `/.well-known/security.txt` with contact info for vulnerability reports.
2. Rate limiting on account creation: max 3 accounts per IP per day, block disposable email domains.
3. Request logging with anomaly detection: flag accounts that add 50+ URLs to the same domain.

**Go/No-Go:** ✅ GO — conditional on the 9 launch blockers being implemented and tested.

**Confidence:** 6/10 — The 9 blockers cover the critical surface, but security is never "done." I expect we'll discover new attack vectors in the first month. I need a commitment that security issues get same-day response.

---

### 📈 PRIYA (Product Strategist)

**Top 3 Concerns:**
1. The onboarding flow. The business red team nailed it (§7.1): *"New users add URLs → see nothing for weeks → forget → never convert."* We MUST have pre-computed change data for popular APIs at launch. When a new user signs up, they should immediately see: "In the last 30 days, we detected 47 changes across 50 popular APIs. Here are the highlights." That's the hook.
2. Churn. The "nothing happened" problem is real. TTFB, uptime, and header tracking help, but we also need the weekly stability report email from Week 1. Even a simple "This week: 168 checks run, 0 changes detected, all endpoints healthy" makes silence feel like value.
3. The landing page needs to show a REAL diff. Not a mockup — an actual detected change from our pre-launch monitoring. "Here's a real change we detected in the OpenAI API last week" with a screenshot of the diff view. Proof it works.

**What I'd cut:** The full Stripe billing integration for Week 5. At launch, just have Free and Indie ($9/mo). Add Pro ($29) and Business ($79) when we have users asking for more URLs/faster intervals. This simplifies billing by 60%.

**What I'd add:**
1. Weekly stability report email (cron job, Week 5)
2. "What should I monitor?" onboarding wizard (show popular APIs by category: payments, AI, auth, etc.)
3. Public changelog pages for top 10 monitored APIs (SEO play, starts accumulating Google juice from day 1)

**Go/No-Go:** ✅ GO — with the condition that pre-launch monitoring starts in Week 5 and the landing page shows real detected changes.

**Confidence:** 5/10 — I believe in the product. I don't believe in the growth projections. The business red team was right that organic-only growth is slow. We need to be prepared for $5K MRR at month 6, not $1.7K MRR (the spec's projection) and not $10K MRR (the dream). If $5K MRR isn't enough to keep going, we shouldn't start.

---

### 🎯 ALEX-PROXY (Founder Advocate)

**Top 3 Concerns:**
1. Scope creep killed this planning process once (the original 2-week plan ballooned to 8 weeks). I need discipline. The MVP is: add URLs, detect changes, show diffs, send alerts. Everything else is iteration.
2. The competitive threat is real but uncontrollable. Postman could ship this tomorrow. We can't out-engineer Postman. We can out-ship them, out-brand them, and build the data moat faster. Speed matters more than perfection.
3. I'm worried about the "insurance nobody needs until they need it" problem. The business red team called it FATAL. Pre-launch monitoring + the weekly stability email + TTFB/uptime tracking are our answer. But we won't know if it works until we have real users and real churn data.

**What I'd cut:** 
1. Pro and Business tiers at launch. Just Free and Indie. Add higher tiers when someone asks.
2. Domain pattern knowledge base beyond 10 entries. Start small, add patterns based on real user URLs.
3. The `PATCH /v1/urls/:id/monitoring` endpoint (manual classification override). Nobody will use this at launch.

**What I'd add:**
1. A personal touch: email every beta user individually. Ask what they're monitoring and why. This is customer development, not marketing.
2. Internal dogfooding: monitor our own dependencies (Railway status, Stripe status, Resend status, Cloudflare status). We're user #1.
3. The brand. Chirri needs personality. The error messages should be helpful and slightly charming (Stripe-style). The landing page should feel like a developer built it for developers, not a marketing team.

**Go/No-Go:** ✅ GO. Unanimous.

**Confidence:** 7/10 — The plan is sound. The architecture is solid. The security is covered. The timeline is realistic. The only thing I can't predict is whether developers will pay for this. We'll find out in 8 weeks.

---

## FINAL PLAN: WHAT'S IN MVP, WHAT'S OUT

### ✅ IN (MVP — Weeks 1-8)

**Core Detection:**
- Add URLs to monitor via API and dashboard
- HTTP GET checks at 1h and 24h intervals (more intervals in V1.1)
- Silent learning period: 20s rapid checks for 10 min → 7-day calibration → active
- Auto-classification: domain patterns (10 domains) + response-based + fallback
- JSON structural diffing (jsondiffpatch with array sort fix, depth limit, size limit)
- Multi-layer fingerprinting (fullHash, stableHash, schemaHash, headerHash)
- Volatile field auto-detection (per-URL learning, narrow global ignore list)
- Confirmation recheck: 5-second immediate recheck
- Clock-aligned scheduling with jitter (0-10%)
- Shared monitoring deduplication (shared URL key includes headers hash)

**Additional Signals (Priya's wins):**
- Response time (TTFB) tracking with regression alerts
- Uptime/availability tracking (status code history, uptime percentage)
- Header change tracking with diff display

**Notifications:**
- Webhook delivery (HMAC-signed, per-webhook secrets, retry with backoff)
- Email notifications (change detected, weekly stability report)

**Dashboard:**
- Auth UI (signup, login)
- URL management (add, remove, pause, resume)
- **Change detail view** (side-by-side diff + summary + actions + feedback)
- Change feed (chronological, filterable by severity)
- URL detail page (health status, TTFB graph, uptime %, header history)
- Account settings

**Billing:**
- Free tier: 3 URLs, 24h checks, email notifications
- Indie tier: $9/mo, 20 URLs, 1h checks, webhooks
- (Pro and Business added when demand warrants)

**Security (Yuki's blockers):**
- SSRF comprehensive module (DNS pinning, IP blocklist, hostname blocklist, redirect validation)
- Cross-tenant isolation in shared monitoring
- XSS prevention (CSP headers, framework auto-escaping)
- DDoS prevention (per-domain outbound rate limits, global domain caps)
- API key hashing (SHA-256), rate limiting, input validation
- Email verification before checks begin
- Credential detection/stripping in URLs
- Self-referential blocking (*.chirri.io)

**Infrastructure:**
- 3 Railway services (API, scheduler, workers ×2)
- PostgreSQL with `pg_partman` partitioning
- Redis (BullMQ queues, rate limiting, domain throttling)
- Cloudflare R2 (snapshots, backups)
- UptimeRobot (self-monitoring)
- Structured logging (pino)
- Graceful shutdown
- Missed-check recovery on startup

**API:**
- 27 endpoints (auth 4, keys 3, URLs 5, changes 4, webhooks 5, account 3, health 2, openapi 1)
- OpenAPI spec via zod-to-openapi
- Scalar interactive docs
- Cursor-based pagination
- Rate limit headers on every response

### ❌ OUT (Deferred)

**V1.1 (Weeks 9-12):**
- SSL certificate monitoring
- Slack + Discord integrations
- RSS/Atom feed monitoring (high-precision monitoring for feed-based APIs)
- Check intervals: 1m, 5m, 15m, 6h
- Tag-based filtering
- Monitoring packs (lean, 3-4 URLs per service)
- 30-minute delayed confirmation recheck (Stage 2)
- Pro ($29/mo) and Business ($79/mo) tiers

**V2 (Months 3-4):**
- OpenAPI spec diffing (via oasdiff library)
- Weekly changelog digest emails (automated)
- Historical trends + stability scores
- Basic team/org features (shared monitors, multiple users)
- Telegram + Teams + PagerDuty + Opsgenie integrations
- Multi-region checking (2 regions)
- Public changelog pages per API (SEO)

**V3 (Months 5+):**
- AI-powered change summaries
- Public API Stability Index
- Customer-hosted monitoring agent (open source)
- GraphQL schema monitoring
- MCP tool server for AI agents
- CLI tool
- Advanced team features (RBAC, audit log)

---

## FINAL TIMELINE: WEEK BY WEEK

| Week | Focus | Key Deliverable | Demo Checkpoint |
|------|-------|----------------|-----------------|
| 1 | Foundation | 3 Railway services, DB schema, auth, API skeleton | Can create account and API key |
| 2 | Check Engine | BullMQ, safeFetch (SSRF), diff engine, learning period | Can add URL and see it enter learning state |
| 3 | Detection + Notifications | Full detection pipeline, webhooks, email | Can detect a change and receive webhook |
| 4 | Dashboard | **DEMO DAY** — full UI with diff viewer | Full flow: add URL → detect change → see diff in dashboard |
| 5 | Billing + Polish | Stripe, landing page, legal, start pre-launch monitoring | Can subscribe to Indie plan |
| 6 | Testing + Beta | Test suite, 10-20 beta users, security tests | Beta users monitoring real URLs |
| 7 | Hardening | Bug fixes, load test, performance, post-launch security | 48h zero false positives on 50+ URLs |
| 8 | **LAUNCH** | HN, Product Hunt, Reddit, Twitter | 🚀 Live |

---

## FINAL ARCHITECTURE: SIMPLIFIED

```
                    ┌─────────────────────────────┐
                    │        Cloudflare CDN        │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────▼────────────────────┐
              │     SERVICE 1: API SERVER (Hono)     │
              │  • 27 REST endpoints                 │
              │  • Dashboard (Next.js/SvelteKit)     │
              │  • Auth (JWT in HttpOnly cookie)      │
              │  • Rate limiting (Redis)              │
              │  • Stripe webhooks                    │
              └────┬───────────────────┬────────────┘
                   │                   │
              ┌────▼──────┐      ┌────▼──────┐
              │ PostgreSQL │      │   Redis    │
              │ (11 tables)│      │ (4 queues) │
              └────▲──▲───┘      └──▲────▲───┘
                   │  │             │    │
              ┌────┴──┴─────────────┴──┐ │
              │  SERVICE 2: SCHEDULER   │ │
              │  • Clock-aligned cron   │ │
              │  • Enqueue check jobs   │ │
              │  • Dedup (shared mon)   │ │
              │  • Missed-check recovery│ │
              │  • Daily backup/purge   │ │
              └─────────────────────────┘ │
                                          │
              ┌───────────────────────────┴──┐
              │  SERVICE 3: WORKERS (×2)      │
              │  • BullMQ consumers           │──── outbound
              │  • safeFetch() (SSRF guard)   │     HTTP(S)
              │  • JSON diffing               │
              │  • Learning period checks     │
              │  • Confirmation rechecks      │
              │  • Webhook + email delivery   │
              └──────────────┬───────────────┘
                             │
                      ┌──────▼──────┐
                      │ Cloudflare  │
                      │     R2      │
                      │ (snapshots, │
                      │  backups)   │
                      └─────────────┘
```

**11 Tables:** users, api_keys, urls, shared_urls, baselines, check_results (partitioned), changes, user_changes, webhooks, webhook_deliveries, notifications

**4 Queues:** url-checks, learning-checks, confirmation-checks, notifications

**3 Services:** API server, scheduler, workers (×2 instances)

**Infrastructure Cost:** ~$42/mo (Railway $38 + R2 $1 + Resend $3)

---

## SECURITY MUST-HAVES: NON-NEGOTIABLE BEFORE LAUNCH

| # | Requirement | Implementation |
|---|------------|----------------|
| 1 | **SSRF Prevention** | `safeFetch()` module: DNS pinning (resolve once, connect to that IP), `ipaddr.js` for IP normalization (catches IPv4-mapped IPv6, octal, hex), hostname blocklist (`.internal`, `.local`, `.railway.internal`, `localhost`, `metadata.google.internal`), manual redirect following (re-validate IP at each hop, max 5), response size limit (5MB abort) |
| 2 | **Cross-Tenant Isolation** | Shared URL key = SHA-256(url + method + sorted headers). Users with different custom headers = different monitors. Baselines per-user for diff comparison. Fan-out strictly isolated. |
| 3 | **XSS Prevention** | CSP header: `default-src 'self'; script-src 'self'`. Framework auto-escaping for all API response data in diff viewer. Never use `dangerouslySetInnerHTML`/`{@html}` on external data. |
| 4 | **DDoS/Abuse Prevention** | Per-domain outbound rate: 1 req/sec (Redis token bucket). Per-account per-domain URL limit: 5. Global domain cap: 60 req/hour. Email verification before checks begin. New account velocity: max 5 URLs in first 24h. |
| 5 | **API Key Security** | Generate with `crypto.randomBytes(32)`. Store SHA-256 hash only. Show full key once at creation. Indexed hash column for O(1) lookup. `timingSafeEqual` for hash comparison. |
| 6 | **Rate Limiting** | Sliding window in Redis. Per-API-key limits by plan. Per-IP limits for unauthenticated endpoints (20/min for login/signup). Rate limit headers on every response. |
| 7 | **Input Validation** | Zod schemas on all request bodies. URL: http/https only, max 2048 chars, no userinfo, credential pattern warning. Headers: max 10, 1KB each, no CRLF, no Host override. |
| 8 | **Credential Protection** | Strip `user:pass@` from URLs (reject with error). Warn on query params matching credential patterns. Encrypted storage for custom headers. Never log full API keys or custom header values. |
| 9 | **Self-Referential Blocking** | Block `*.chirri.io` in URL validation. Prevents infinite monitoring loops. |
| 10 | **Test Mode** | `dk_test_` keys return mock data only. No real outbound HTTP requests. Same plan limits enforced. |

---

## POST-LAUNCH ROADMAP

### V1.1 — Weeks 9-12 (The "Real Product")
**Theme:** Platform coverage and monetization

- [ ] SSL certificate monitoring (expiry alerts, chain change detection)
- [ ] Slack + Discord integrations (webhook-based, straightforward)
- [ ] RSS/Atom feed monitoring (zero false positive monitoring for 80%+ of major APIs)
- [ ] All check intervals: 1m, 5m, 15m, 6h
- [ ] Pro tier ($29/mo, 100 URLs, 5min interval)
- [ ] Business tier ($79/mo, 500 URLs, 1min interval)
- [ ] Tag-based URL filtering
- [ ] Monitoring packs (lean: Stripe 4 URLs, OpenAI 3 URLs, Shopify 3 URLs)
- [ ] 30-minute delayed confirmation recheck (Stage 2 for non-critical changes)
- [ ] GitHub releases Atom feed monitoring
- [ ] npm/PyPI registry version monitoring

### V2 — Months 3-4 (The "Intelligence Layer")
**Theme:** Making sense of changes at scale

- [ ] OpenAPI spec diffing (oasdiff integration — breaking change detection)
- [ ] Weekly changelog digest emails ("Monday morning API briefing")
- [ ] Historical trends + graphs (change frequency, response time over time)
- [ ] Stability scores per URL (0-100 based on change frequency, FP rate)
- [ ] Basic team features (shared organization, multiple users)
- [ ] Multi-region checking (US-East + EU-West, require 2/2 agreement)
- [ ] Telegram + Teams integrations
- [ ] PagerDuty + Opsgenie integrations
- [ ] Public API changelog pages (SEO play — "Stripe API Changelog by Chirri")
- [ ] Aggregate intelligence feed ("Stripe changed 3 times this month")

### V3 — Months 5+ (The "Moat")
**Theme:** Data network effects and ecosystem

- [ ] AI-powered change summaries ("Stripe added a new `payment_method` field")
- [ ] Public API Stability Index (marketing + authority building)
- [ ] Customer-hosted monitoring agent (open source, for authenticated API monitoring)
- [ ] GraphQL schema monitoring (introspection query diffing)
- [ ] MCP tool server (AI agents can query Chirri for API change status)
- [ ] CLI tool (`chirri monitor add https://...`)
- [ ] Advanced team features (RBAC, audit log, change assignment)
- [ ] Correlation engine ("When Stripe changes X, Shopify usually changes Y")
- [ ] Zapier/Make integration
- [ ] Self-hosted Chirri (enterprise)

---

## FINAL VOTE

| Panelist | Vote | Confidence | Condition |
|----------|------|------------|-----------|
| 🏛️ Marcus | ✅ GO | 7/10 | 8-week timeline respected, reduced scope honored |
| 🔓 Yuki | ✅ GO | 6/10 | 9 security blockers implemented and tested |
| 📈 Priya | ✅ GO | 5/10 | Pre-launch monitoring starts Week 5, weekly stability emails from day 1 |
| 🎯 Alex-Proxy | ✅ GO | 7/10 | Demo day at Week 4, launch at Week 8, no scope creep |

**UNANIMOUS: GO.**

Average confidence: 6.25/10. That's honest. We're confident in the plan but humble about what we don't know. The first month post-launch will teach us more than these 6 documents combined.

---

## OPEN RISKS ACCEPTED

These are known risks we're choosing to accept, not ignore:

1. **Postman could ship this.** No mitigation except speed. We build the data moat while we can.
2. **Organic growth may be slower than projected.** Realistic Year 1 ARR: $25-50K, not $52.5K. We're OK with this as a profitable side project that grows.
3. **False positives will happen.** The learning period + confirmation recheck are good, not perfect. Aggressive feedback collection and rapid iteration on the diff engine are our insurance.
4. **changedetection.io is free.** Our differentiation: auto-classification, shared monitoring intelligence, managed service convenience, TTFB/uptime/headers as first-class signals. If that's not enough, we'll learn fast.
5. **API Drift Alert died and we don't know why.** We're priced at 1/15th their cost. If the market doesn't exist at $9/mo, it doesn't exist at all.

---

*This is the LAST planning document. The next file created in this workspace should be code.*

*Signed: The Panel — March 23, 2026*
