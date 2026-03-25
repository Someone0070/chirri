# Chirri Feature Expansion Research

> What adjacent features make sense for an API change detection service?  
> Last updated: 2026-03-23

---

## 1. Feature Catalog

### 1.1 Performance/Speed Monitoring (Response Time Tracking)

**Does it make sense for Chirri?** YES — natural extension. We're already hitting endpoints; recording response time is nearly free. The key differentiator: we don't do full APM. We treat response time as **another dimension of change**. "Stripe API went from 120ms → 450ms this week" is a change worth knowing about.

**Who already does this?**
- Datadog Synthetics ($5/10k API checks/mo — gets expensive fast)
- Checkly (from $30/mo, monitoring-as-code oriented)
- New Relic Synthetics (consumption-based, complex pricing)
- Pingdom ($10/mo starter)

**How Chirri differentiates:** We don't do traces, spans, or APM. We track **Time to First Byte (TTFB) as a change signal**. Think of it as "is this API getting slower?" — not "where in your microservice architecture is the bottleneck?" This is monitoring *their* API, not *your* infrastructure.

**How hard to build?** EASY — Record `Date.now()` before/after fetch. Store p50/p95 per check window. Alert when deviation exceeds threshold (e.g., 2x baseline).

**Plan tier:** Free (basic — show response time), Indie+ (alerts on response time changes, historical graphs)

**Willingness to pay:** Medium. Solo devs care less. Teams who depend on external APIs care a lot — "why is our app slow? Oh, Twilio is 3x slower today."

**Verdict:** MVP feature. Almost zero additional cost to implement. Massive perceived value.

---

### 1.2 Uptime/Availability (Lightweight)

**Does it make sense for Chirri?** YES — we're literally already checking if URLs respond. If we get a 500 or timeout, that's already a "change" from 200. The question is whether to surface this as an explicit feature.

**Who already does this?**
- UptimeRobot (free tier: 50 monitors, 5min interval — but recently killed free for commercial use, raised prices 425% on legacy plans, causing mass exodus)
- Better Stack / Better Uptime (from $29/mo)
- Pingdom ($10/mo)
- Hundreds of uptime-only tools

**How Chirri differentiates:** We don't compete on uptime monitoring. We offer it as a **freebie** — "we're checking your URLs anyway, so here's uptime for free." This is a *wedge feature*, not a revenue driver. It gets people in the door and makes them realize they need change detection too.

**How hard to build?** EASY — We already have the data. Just need: status code history, uptime percentage calculation, and a simple status page view.

**Plan tier:** Free (basic uptime %, status code history), Pro+ (status pages, SLA reporting)

**Willingness to pay:** Low for uptime alone (commodity market). HIGH when bundled — "I get uptime + change detection + response time in one tool? Sold."

**Verdict:** MVP feature. Zero marginal cost. Killer for acquisition — "free uptime monitoring" is a great SEO/marketing hook while UptimeRobot users are fleeing.

---

### 1.3 SSL/Certificate Monitoring

**Does it make sense for Chirri?** YES — We're already making HTTPS requests. Certificate info is available in the TLS handshake. Cert expiry is genuinely useful and a natural extension of "watching URLs."

**Who already does this?**
- Dedicated tools: TrackSSL, SSLMate, Keychest
- Built into: Pingdom, Datadog, UptimeRobot (paid plans)
- DIY: cron + openssl s_client

**How Chirri differentiates:** Not a standalone cert tool — it's bundled. "You're monitoring this API for changes; we'll also tell you 30 days before its cert expires." Also: **certificate chain changes** are a security signal. If Stripe suddenly switches CAs, that could mean compromise or infrastructure change.

**How hard to build?** EASY-MEDIUM — Cert expiry: trivial (read from TLS handshake metadata). Chain diffing: medium (need to store and compare issuer chain). Certificate Transparency log monitoring: harder (out of scope for MVP).

**Plan tier:** Free (expiry alerts), Indie+ (chain change alerts, history)

**Willingness to pay:** Low standalone, but high as a bundled "we watch everything about your URLs" value prop.

**Verdict:** MVP feature. Low effort, strong "completeness" signal.

---

### 1.4 Header Change Tracking

**Does it make sense for Chirri?** HELL YES — This is the most natural extension possible. Headers ARE part of the API response. Tracking header changes is literally what Chirri does, just applied to a part of the response most tools ignore.

**Who already does this?** Almost nobody as a first-class feature. changedetection.io has a feature request for header-based monitoring. Most tools focus on body changes only.

**Key use cases:**
- **Rate limit headers changing:** `X-RateLimit-Limit` going from 1000 → 500 (your app is about to break)
- **Deprecation headers:** `Sunset: Sat, 01 Jan 2027` or `Deprecation: true` appearing (RFC 8594)
- **API version headers:** `X-API-Version` incrementing
- **Security headers:** CSP, CORS, X-Frame-Options changes (security posture shifts)
- **Cache control changes:** Affects your app's behavior

**How hard to build?** EASY — We already receive headers. Store them, diff them, alert on changes. The hard part is UX: which headers to track by default vs. opt-in (nobody wants alerts for `Date:` changing).

**Plan tier:** Free (basic — show header changes alongside body changes), Indie+ (specific header watches, regex filters)

**Willingness to pay:** HIGH for API-focused users. Rate limit and deprecation header tracking is genuinely underserved.

**Verdict:** MVP feature. This is core Chirri DNA. Nobody else does this well.

---

### 1.5 OpenAPI Spec Diffing

**Does it make sense for Chirri?** YES, but it's a bigger bet. This moves Chirri from "generic URL change detection" toward "API-specific intelligence." Deep spec diffing is where serious value lives for API-dependent teams.

**Who already does this?**
- **Bump.sh** — API documentation + change management. Pricing: free tier, then ~$149/mo for teams. Focuses on YOUR specs (design-first), not monitoring external APIs.
- **Optic** — OpenAPI diff + lint in CI. Open source CLI. Focused on YOUR spec in YOUR repo.
- **oasdiff** — Open source OpenAPI breaking change detection. CLI + GitHub Action. Free.
- **APIMatic, Readme.io** — Documentation-focused, not monitoring.

**How Chirri differentiates:** Existing tools diff YOUR spec in YOUR CI pipeline. Chirri would **monitor THEIR published spec and alert you when it changes.** Big difference:
- Bump.sh: "Here's a diff of your spec between deploys"
- Chirri: "Stripe just added 3 endpoints and deprecated 2 fields in their OpenAPI spec"

This is "watching external APIs" — which is exactly Chirri's lane.

**How hard to build?** MEDIUM-HARD
- Fetching and storing OpenAPI/Swagger JSON: Easy
- Structural diffing (new endpoints, removed fields): Medium (libraries exist: oasdiff, openapi-diff)
- Breaking change classification: Medium (added endpoint = safe, removed field = breaking)
- Visual diff UI: Hard (significant frontend work)

**Plan tier:** Pro/Business — This is high-value, specialized functionality

**Willingness to pay:** VERY HIGH for teams. "Alert me when any API I depend on makes a breaking change" is worth $50+/mo to any engineering team.

**Verdict:** V2 feature. High value but significant build effort. Start with basic "spec URL changed" detection in MVP, add deep diffing in V2.

---

### 1.6 Dependency/Package Monitoring

**Does it make sense for Chirri?** NO — This is scope creep. It's a different domain (source code dependencies vs. API endpoints) with massive, well-funded competitors.

**Who already does this?**
- **Dependabot** (free, built into GitHub)
- **Snyk** (free tier, then $25+/dev/mo)
- **Renovate** (free, open source)
- **Socket.dev, Sonatype** (enterprise)

**Why not:** These tools scan your `package.json` / `requirements.txt` — they need repo access. Chirri monitors URLs. The mental models are completely different. We'd be building a worse version of free tools (Dependabot).

**How hard to build?** HARD — Requires repo integration, multiple package registry APIs, vulnerability databases.

**Verdict:** AVOID. Classic scope creep. Not our lane.

---

### 1.7 Changelog Aggregation

**Does it make sense for Chirri?** YES — This is the "killer feature" vision. Chirri already detects changes; the next step is **making sense of them**. "The changelog for everything you depend on" is a powerful narrative.

**What this looks like:**
- Weekly digest email: "Here's everything that changed in your stack this week"
- Per-API changelog: "Stripe: 3 body changes, 1 header change, 2 spec updates"
- RSS/Atom feed of all changes across monitored URLs
- Public changelog pages (sharable: "here's what changed in the Twilio API this month")

**Who already does this?** Nobody does it well. Individual API providers publish changelogs (Stripe, Twilio). Some aggregation exists:
- **API Changelog** (apichangelog.com) — limited, manual
- **Apicurio, APIs.guru** — spec registries, not change tracking
- RSS feeds of individual changelogs exist but nobody aggregates them

**The gap:** Developers monitor 5-20 external APIs. No single tool gives them "here's what changed across ALL of them." This is genuinely unserved.

**How hard to build?** MEDIUM — The detection is already done. This is presentation/aggregation: 
- Digest emails: Easy
- Per-API changelog view: Medium (need good change summarization)
- Public changelog pages: Medium
- AI-powered change summaries ("Stripe added a new `payment_method` field to `/v1/charges`"): Medium-Hard

**Plan tier:** Free (basic changelog view), Indie+ (digests, RSS), Pro+ (AI summaries, public pages)

**Willingness to pay:** HIGH — "I open one dashboard Monday morning and see everything that changed in my API dependencies" is extremely valuable.

**Verdict:** MVP (basic) → V2 (AI summaries, digests). This should be a core narrative for Chirri. "The changelog for your entire stack."

---

### 1.8 Change Impact Analysis

**Does it make sense for Chirri?** Conceptually yes, practically hard. "This field was removed and you use it in 3 integrations" is the dream, but requires deep integration with user codebases.

**Who already does this?** Nobody, really. This is the holy grail of API monitoring.

**Why it's hard:**
- Needs GitHub/GitLab integration
- Needs to understand codebases (which fields/endpoints are used where)
- Static analysis across languages is a massive undertaking
- Privacy/security concerns with code access

**How hard to build?** VERY HARD

**Plan tier:** Business/Enterprise only (if ever)

**Willingness to pay:** Astronomical if it worked. But building it well is a company-sized effort.

**Verdict:** V3+ / Future vision. Not practical now. Could do a lightweight version: "tag which integrations use which monitored URLs" (manual, but useful).

---

### 1.9 Historical Trends & Stability Scores

**Does it make sense for Chirri?** YES — We're accumulating historical data anyway. Surfacing trends is pure value extraction from existing data.

**What this looks like:**
- "Stripe changes their API every 2.3 weeks on average"
- Change frequency graphs per API
- Stability scores: "Twilio: 98% stable / GitHub API: 73% stable"
- "Most stable" and "most volatile" API rankings (public — great for SEO)
- Trend detection: "This API is changing more frequently than usual"

**Who already does this?** Nobody for external API changes. APM tools track internal performance trends, but nobody publishes "how often do third-party APIs change?"

**How hard to build?** EASY-MEDIUM — Basic stats (change frequency, last changed): Easy. Graphs: Medium (charting library). Public rankings/scores: Medium (need good scoring methodology).

**Plan tier:** Free (basic history), Indie+ (graphs, export), Pro+ (stability scores, trend alerts)

**Willingness to pay:** Medium standalone, but great for positioning Chirri as the "authority on API stability."

**Verdict:** V2 feature. The public rankings ("API Stability Index") could be a massive marketing asset. Imagine: "According to Chirri's stability index, here are the most reliable APIs of 2026."

---

### 1.10 Team Features

**Does it make sense for Chirri?** YES — This is table stakes for moving from indie/solo to team/business pricing.

**What this looks like:**
- Shared monitoring (team members see same monitors)
- Assign changes to team members for review
- Per-channel notifications (Slack channel per API, or per team)
- Review workflows: acknowledge/dismiss/flag changes
- Audit log: who reviewed what

**Who already does this?** Every B2B SaaS eventually. For monitoring specifically: Datadog, PagerDuty, Better Stack all have team features.

**How hard to build?** MEDIUM — Auth/org/team models: Medium. Assignment/workflows: Medium. This is standard SaaS team infrastructure, not novel technology.

**Plan tier:** Pro (basic teams: 3-5 members), Business (unlimited members, workflows, audit)

**Willingness to pay:** HIGH — Teams are where the money is. A solo dev pays $9/mo. A team of 5 pays $49-99/mo.

**Verdict:** V2 feature. Not MVP, but critical for revenue growth. Build the simplest version (shared org, multiple users) first.

---

### 1.11 Competitive Intelligence

**Does it make sense for Chirri?** Technically yes (monitoring pricing pages is just URL monitoring), but positioning this way is ethically gray and invites scrutiny.

**The reality:**
- Monitoring competitor pricing pages = legal (public info)
- Monitoring competitor API changes = legal and useful
- **But marketing it as "competitive intelligence"** attracts a different crowd and creates brand risk
- Also: pricing pages often require JS rendering (harder to monitor)

**Who already does this?**
- Visualping, Distill.io (general web monitoring, some users use for CI)
- Klue, Crayon (dedicated competitive intelligence platforms, $20k+/yr)
- People already use changedetection.io for this

**Verdict:** AVOID as a marketed feature. Users will do this themselves with Chirri's core URL monitoring. Don't build features specifically for it. Don't market it. Let it happen organically.

---

### 1.12 Webhook Testing/Debugging

**Does it make sense for Chirri?** Marginally. We send webhooks for notifications, so letting users test their webhook receivers makes sense as a DX feature, not a product.

**Who already does this?**
- Webhook.site (free, dominant)
- RequestBin/Pipedream
- Hookdeck (webhook infrastructure)
- Beeceptor

**This market is saturated with free tools.** Building our own adds minimal value.

**How hard to build?** EASY for basic "test your webhook" feature. Medium for replay/debugging.

**Plan tier:** Free (test webhook button), Indie+ (payload history, replay)

**Willingness to pay:** Near zero — this is a DX quality-of-life feature, not a product.

**Verdict:** MVP — but only as a small "Test webhook" button in settings. NOT as a feature to market. Just good UX.

---

## 2. Recommended Additions (Ranked by Value/Effort)

### Tier 1: Build Now (MVP) — High Value, Low Effort

| Rank | Feature | Effort | Value | Why Now |
|------|---------|--------|-------|---------|
| 1 | **Header Change Tracking** | Easy | Very High | Core DNA. Nobody does this. Deprecation + rate limit headers are gold. |
| 2 | **Lightweight Uptime** | Easy | High | Free data. Great acquisition hook. UptimeRobot refugees. |
| 3 | **Response Time Tracking** | Easy | High | Already have the data. "Your API is 3x slower" is a killer alert. |
| 4 | **SSL/Cert Monitoring** | Easy | Medium | Completes the "we watch everything about your URL" story. |
| 5 | **Basic Changelog View** | Easy-Med | High | Per-URL change history timeline. Foundation for aggregation later. |

### Tier 2: Build Next (V2) — High Value, Medium Effort

| Rank | Feature | Effort | Value | Why V2 |
|------|---------|--------|-------|--------|
| 6 | **Changelog Aggregation + Digests** | Medium | Very High | Weekly digest = retention machine. "Monday morning API briefing." |
| 7 | **Historical Trends + Stability Scores** | Medium | High | Marketing goldmine. "API Stability Index" gets press + SEO. |
| 8 | **Team Features (basic)** | Medium | High | Unlock business pricing tier. |
| 9 | **OpenAPI Spec Diffing** | Med-Hard | Very High | Deep value for API-heavy teams. Start with basic spec change detection. |

### Tier 3: Future Vision (V3+)

| Rank | Feature | Effort | Value | Why Later |
|------|---------|--------|-------|-----------|
| 10 | **Change Impact Analysis (lite)** | Hard | Very High | Manual tagging first ("this URL is used by payment service"). |
| 11 | **AI Change Summaries** | Medium | High | "Stripe added a payment_method field" vs raw JSON diff. |
| 12 | **Public API Stability Rankings** | Medium | Very High (marketing) | Content marketing + authority building. |

---

## 3. Plan Distribution

### Free Tier
- Up to 5 monitored URLs
- Basic change detection (body)
- Uptime monitoring (status code + up/down)
- Response time display (no alerts)
- SSL cert expiry alerts (30-day warning)
- Basic header visibility (shown in change details)
- Email notifications only

### Indie ($9/mo)
- Up to 25 monitored URLs
- Header change alerts (configurable: which headers to watch)
- Response time change alerts
- SSL cert chain change alerts
- Per-URL changelog timeline
- Webhook + Slack notifications
- 90-day history

### Pro ($29/mo)
- Up to 100 monitored URLs
- Weekly changelog digest emails
- Historical trend graphs
- Stability scores per URL
- OpenAPI spec change detection (basic)
- Team features (up to 5 members)
- RSS feed of changes
- 1-year history
- Custom check intervals (down to 1 min)

### Business ($79/mo)
- Unlimited monitored URLs
- Deep OpenAPI spec diffing (breaking change detection)
- AI-powered change summaries
- Team features (unlimited members + workflows)
- Change assignment + review workflows
- Audit log
- API access (full)
- SLA reporting
- Unlimited history
- Priority support
- Custom integrations (PagerDuty, Opsgenie, etc.)

---

## 4. MVP Features vs V2 Features

### MVP (Launch / Next 2-3 Months)
1. ✅ Core change detection (body) — already exists
2. 🆕 Header change tracking (configurable)
3. 🆕 Response time recording + basic display
4. 🆕 Uptime/status code tracking (free)
5. 🆕 SSL cert expiry alerts
6. 🆕 Per-URL changelog timeline view
7. 🆕 "Test webhook" button in notification settings

### V2 (3-6 Months Post-Launch)
1. Response time anomaly alerts
2. Weekly/daily changelog digest emails
3. Historical trends + graphs
4. Basic team/org features (shared monitors)
5. RSS feed of changes
6. Basic OpenAPI spec change detection ("this spec URL changed")
7. API Stability Scores (per monitored URL)

### V3 (6-12 Months)
1. Deep OpenAPI spec diffing (endpoint-level, field-level, breaking change classification)
2. AI-powered change summaries
3. Public API Stability Index (marketing feature)
4. Change review workflows (assign, acknowledge, dismiss)
5. Lightweight impact tagging ("this URL is used by: payment service, auth service")
6. Advanced team features (audit log, RBAC)

---

## 5. Features to AVOID

### ❌ Dependency/Package Monitoring
**Why:** Completely different domain. Dependabot is free and built into GitHub. Snyk has $1B+ in funding. We'd build a worse, more expensive version of free tools. Our users don't come to us for `package.json` scanning.

### ❌ Full APM / Distributed Tracing
**Why:** We track external URLs, not internal infrastructure. Datadog/New Relic own this space with 10+ years of investment. Response time tracking is fine; distributed traces are not our business.

### ❌ Competitive Intelligence (as marketed feature)
**Why:** Ethically gray positioning. Attracts problematic customers. Creates brand risk. Users can already use Chirri for this — just don't build features or marketing specifically for it.

### ❌ Webhook Infrastructure (à la Hookdeck/Svix)
**Why:** We send webhooks; we don't need to become a webhook platform. Webhook.site is free. This is a distraction from our core value.

### ❌ Status Page Hosting (à la Statuspage.io)
**Why:** Tempting because we have uptime data, but Atlassian Statuspage, Instatus, Better Stack, and dozens of others own this. Building and maintaining a status page product is a significant commitment for marginal revenue.

### ❌ General Website Monitoring (visual regression, screenshot diff)
**Why:** This is changedetection.io territory. We're API-focused. Visual regression testing is a different product (Percy, Chromatic). Stay in our lane: APIs and structured data.

### ❌ Log Aggregation / Error Tracking
**Why:** Sentry, LogRocket, Datadog Logs. Not adjacent — it's a different galaxy.

---

## 6. Developer Pain Points (From Research)

### What developers ask for that doesn't exist well:

1. **"One place to see all my external API dependencies"** — Developers use 5-20 external APIs. No single dashboard shows "here's the health and change status of everything you depend on." Chirri can be this.

2. **"Alert me before an API breaks my app"** — Deprecation headers, sunset headers, breaking spec changes. Proactive alerts before things break, not after.

3. **"How stable is this API I'm about to integrate?"** — Before choosing between two payment APIs, developers want to know which one changes less frequently. Nobody provides this data publicly.

4. **"Weekly summary of what changed"** — Developers don't want real-time alerts for every minor change. They want a Monday morning digest: "Here's what happened in your API stack this week."

5. **"Rate limit changes are killing us"** — Rate limit header changes (X-RateLimit going from 1000 to 500) break apps silently. Nobody monitors this.

6. **UptimeRobot refugees** — UptimeRobot killed free plans for commercial use and raised prices 425%. Thousands of developers are looking for alternatives RIGHT NOW. Offering free lightweight uptime is a massive acquisition opportunity.

---

## 7. The Narrative

Chirri's expanded feature set tells a coherent story:

> **"Chirri watches your API dependencies so you don't have to."**

- Body changed? We'll tell you.
- Headers changed? We'll tell you.
- Response time spiked? We'll tell you.
- Endpoint went down? We'll tell you.
- SSL cert expiring? We'll tell you.
- API spec updated? We'll tell you.

One tool. One dashboard. Everything about the external APIs your app depends on.

The key insight: **none of these features alone is a product.** Uptime monitoring alone is a commodity. Response time alone is table stakes. SSL monitoring alone is boring. **But all of them together, focused on external API dependencies, is genuinely new.** Nobody offers this unified view.

### Positioning
- Not an APM (we don't instrument your code)
- Not an uptime monitor (we do so much more)
- Not a spec tool (we watch their specs, not yours)
- **We're the dependency radar for your API stack**

---

## 8. Quick-Win Marketing Angles

1. **"Free uptime monitoring"** — SEO hook, catches UptimeRobot refugees
2. **"API Stability Index"** — Public rankings, gets press, establishes authority
3. **"The changelog for your entire stack"** — Unique positioning, memorable
4. **"Know before it breaks"** — Deprecation + sunset header monitoring
5. **"Rate limit alerts"** — Niche but high-intent keyword, nobody serves this

---

*Research compiled from: Reddit r/developers, r/devops, r/selfhosted, r/SaaS; GitHub issues on changedetection.io; competitive analysis of Bump.sh, Optic, oasdiff, UptimeRobot, Better Stack, Checkly, Datadog, Snyk, Dependabot, Webhook.site, and others.*
