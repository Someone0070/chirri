# CHIRRI — THE DEFINITIVE PLAN

### The Final Debate: Six Experts, One Room, No Bullshit

**Date:** March 23, 2026  
**Purpose:** Last planning document before code. Period.

---

## THE PANEL

- 🏛️ **MARCUS** (Architect) — Designed the system. Protective of technical decisions.
- 🔓 **YUKI** (Security) — Found 34 attack vectors. Won't let insecure code ship.
- 📈 **PRIYA** (Product) — Wants features that reduce churn and increase WTP.
- 🚀 **JAKE** (Growth) — Wants to ship fast, launch loud, iterate based on data.
- ✍️ **LUNA** (Content/Brand) — Owns the voice, positioning, SEO strategy.
- 🎯 **ALEX-PROXY** (Founder) — Ships fast, quirky brand, $100K ARR is fine. Has final say.

---

## ROUND 1: APIShift Is Real — How Do We Win?

**LUNA:** OK let's address the elephant. APIShift (apishift.site) is doing *nearly the same thing*. "Automatically detect API schema changes and breaking changes before they affect production. Monitor REST APIs, track field changes, and get instant alerts via Email, Slack, or Discord. Free plan available." That's our pitch verbatim.

**JAKE:** How much traction do they have? Stars? MRR? Twitter followers?

**LUNA:** Unknown. They rank for "detect API schema changes" which is one of our target keywords. But I couldn't find community, GitHub, reviews, or social proof beyond their own site. No HN launch, no Reddit threads, no dev.to articles. They're quiet.

**PRIYA:** That's either terrifying — they're heads down building — or a sign they haven't figured out distribution. Most dev tools die from obscurity, not competition.

**MARCUS:** I want to know their tech. Do they do auto-classification? Do they have a learning period? Schema-aware diffing? Or is it just "fetch URL, compare JSON, email if different"? Because if it's the latter, we're already differentiated.

**ALEX-PROXY:** We're not going to spend 2 weeks studying them. Here's what matters: they exist, they have a free plan, and they're ranking for at least one keyword we want. But they have zero visible community and zero buzz. Our advantages:

1. **Auto-classification** — nobody else does this, not APIShift, not changedetection.io, not anyone. You paste a URL and we figure out the best monitoring strategy. That's genuinely novel.
2. **TTFB + uptime + header tracking as free data** — we give you more than just "did the JSON change." Even when nothing breaks, the dashboard shows value.
3. **The brand** — Chirri has personality. Sakura pink, Japanese zen, calm cricket chirp. APIShift sounds like a Y Combinator reject name.
4. **Speed** — we ship in 8 weeks and launch loud on HN. If they haven't built buzz in however long they've been live, we outmaneuver on distribution.

**YUKI:** One more thing. The pentest found that security is a massive differentiator. If APIShift doesn't do DNS pinning, SSRF protection, or cross-tenant isolation — and I'd bet they don't — that's a real vulnerability. Enterprise customers will care.

**LUNA:** SEO strategy is simple: we must outrank them on "detect API schema changes," "API breaking change alert," and "monitor API for changes." Based on my SERP analysis, those keywords are LOW competition. We publish better content, we win. Their site has no blog, no guides, no case studies.

**JAKE:** So the plan is: don't study them, don't copy them, just be better on every axis — features, brand, content, community — and ship faster.

**ALEX-PROXY:** ✅ Correct. If they're a real threat, they'll force us to be better. If they're not, we wasted zero time worrying. Move on.

> **RESOLUTION:** Don't study APIShift's product. Out-execute on auto-classification, brand, content, and distribution speed. Outrank on SEO with better content and programmatic pages.

---

## ROUND 2: Feature Scope — What Actually Ships?

**PRIYA:** The features research identified 10+ new capabilities. Let me list what I want:

1. ✅ TTFB / response time tracking (already planned)
2. ✅ Uptime / availability tracking (already planned)
3. ✅ Header change tracking — rate limits, deprecation, CORS (already planned)
4. 🆕 Response size anomaly detection
5. 🆕 Deprecation header tracking (Sunset header RFC 8594)
6. 🆕 OpenAPI import (paste spec, auto-create monitors)
7. 🆕 GraphQL introspection monitoring
8. 🆕 SLA monitoring
9. 🆕 MCP server for AI agents
10. 🆕 Performance degradation alerts (p50/p95/p99)

I want ALL of them.

**MARCUS:** And I want a pony. Each of those is 3 days to 2 weeks. You just added 2-3 months to an 8-week timeline.

**PRIYA:** Not all for MVP! But we need to tier them correctly. The deprecation header tracking is 3-5 days and almost nobody does it. That's a huge differentiator for minimal effort.

**MARCUS:** I'll give you deprecation headers because it's just parsing one extra response header we're already capturing. That's a day, not a week. Response size tracking? Also cheap — we already measure the response body. But OpenAPI import is 1-2 weeks of real work. GraphQL introspection is another 1-2 weeks. SLA monitoring is 1-2 weeks. Each one pushes the launch.

**ALEX-PROXY:** Let me cut this short. Here's what ships at MVP, and I'm not debating it:

**MVP core** (already in the spec):
- URL monitoring with JSON structural diffing
- Silent learning period + calibration
- Auto-classification (3 phases, 10 domain patterns)
- Multi-layer fingerprinting
- Confirmation recheck (5s)
- Clock-aligned scheduling + shared monitoring
- Webhook + email notifications
- Dashboard with Change Detail View (the money screen)
- Free + Indie billing via Stripe

**MVP "free data" additions** (near-zero effort):
- TTFB tracking (we already make the HTTP request)
- Uptime % (we already check status codes)
- Header change tracking (we already capture headers)
- Response size tracking (we already read the body)
- Deprecation header detection (parse one more header)

**NOT MVP:**
- OpenAPI import → V1.1
- GraphQL introspection → V2
- SLA monitoring → V2
- MCP server → V1.1 (non-negotiable, per research)
- Performance percentiles (p50/p95/p99) → V1.1
- Full timing breakdown (DNS/TLS/Connect) → V1.1

**PRIYA:** I'll accept that IF we commit to MCP server in V1.1. The market analysis shows UptimeRobot and OneUptime already have MCP servers. If we don't have one within 4 weeks of launch, we lose the AI agent developer segment entirely.

**MARCUS:** MCP server is a week of work, max. It's just a thin wrapper around our API. V1.1 is fine.

**PRIYA:** And OpenAPI import? That's the single biggest onboarding accelerator. "Paste your OpenAPI spec, we create monitors for every endpoint." That's a demo moment.

**MARCUS:** It's also a spec-parsing nightmare. OpenAPI 2.0, 3.0, 3.1 all have different structures. Parameter resolution, $ref handling, security schemes... it's not a weekend project.

**ALEX-PROXY:** V1.1. We launch with "paste a URL." OpenAPI import is a power feature for month 2.

**YUKI:** I need to flag something. Response size tracking — we need a hard cap. The pentest specified 5MB max response body. If we're now tracking response size as a feature, we need to handle the edge case where an API suddenly starts returning 500MB. That's a DoS vector against our own workers.

**MARCUS:** Already handled. We abort the connection at 5MB. For responses over 1MB, we fall back to hash-only comparison. Response size tracking just records the Content-Length header or actual bytes received before abort.

**YUKI:** Good. And the deprecation header parsing — make sure we're not trusting the header value blindly for display. HTML-escape everything. A malicious API could return `Sunset: <script>alert('xss')</script>`.

**MARCUS:** Everything goes through framework auto-escaping. No raw HTML rendering of external data. It's in the spec.

> **RESOLUTION:** MVP ships with core detection + TTFB + uptime + headers + response size + deprecation header parsing. OpenAPI import, MCP server, and Slack/Discord integrations are V1.1 (weeks 9-12). GraphQL, SLA monitoring, and performance percentiles are V2.

---

## ROUND 3: Integrations — What Do We Build First?

**JAKE:** The research says "webhook-first covers 80% of integration needs." I agree. Ship webhooks + email for MVP. Everything else is V1.1+.

**PRIYA:** No. Slack is the #1 developer communication tool. Every competitor — Checkly, Sentry, BetterStack, Datadog — has Slack on day one. If we launch without Slack, we look amateur.

**MARCUS:** Slack integration is 2-3 days. It's just posting to an incoming webhook URL. Same format as Discord, basically.

**PRIYA:** Then put it in MVP.

**ALEX-PROXY:** How much does it really cost us?

**MARCUS:** Slack incoming webhooks: 2 days. Discord webhooks: 1 day (nearly identical format). So 3 days total for both.

**ALEX-PROXY:** Here's the problem. Every "just 2 more days" adds up. We've already got an 8-week timeline. Adding Slack + Discord is 3 days. Adding deprecation headers is 1 day. Response size tracking is 1 day. That's already a week of "small" additions.

**MARCUS:** I budgeted Week 3 for notifications. The spec already has "webhook delivery (HMAC)" in that week. Adding Slack + Discord incoming webhooks to the same week is feasible — they're just HTTP POST calls with formatted JSON payloads. It's not a separate integration framework.

**JAKE:** Then do it. Webhook + Email + Slack + Discord for MVP. GitHub Action for V1.1.

**LUNA:** GitHub Action should be MVP. The growth strategy research shows it's the "single highest-leverage growth tactic" — every repo using the action is a distribution node. Snyk's CLI drives the majority of their signups.

**JAKE:** I hear you, but the GitHub Action needs the API to be stable first. If we ship a broken GitHub Action at launch, repos start failing CI and we get negative word-of-mouth. Let it bake for 2-4 weeks.

**MARCUS:** Agreed. GitHub Action V1.1. It's a wrapper around the API — needs the API to be solid first.

**ALEX-PROXY:** OK, final call on integrations:

| Priority | Integration | When |
|----------|------------|------|
| 1 | Email | MVP |
| 2 | Webhooks (HMAC-signed) | MVP |
| 3 | Slack (incoming webhook) | MVP |
| 4 | Discord (webhook) | MVP |
| 5 | GitHub Action | V1.1 (Week 10) |
| 6 | MCP Server | V1.1 (Week 11) |
| 7 | Open-source CLI | V1.1 (Week 11) |
| 8 | PagerDuty | V1.1 (Week 12) |
| 9 | Microsoft Teams | V2 |
| 10 | Telegram | V2 |
| 11 | Jira/Linear | V2 |
| 12 | Prometheus metrics | V2 |

**PRIYA:** I want PagerDuty sooner. Enterprise customers—

**ALEX-PROXY:** We don't have enterprise customers yet. We have zero customers. PagerDuty when someone asks for it.

> **RESOLUTION:** MVP ships with Email + Webhooks + Slack + Discord. GitHub Action, MCP server, and CLI are V1.1. Everything else waits for demand signals.

---

## ROUND 4: The Change Detail View

**ALEX-PROXY:** This is THE money screen. When a developer clicks through from an alert, they see a side-by-side diff with auto-generated summary and recommended actions. This is the "holy shit, this is useful" moment that converts free to paid. How hard is this?

**MARCUS:** Building a *good* diff viewer is hard. You need:
- Side-by-side panel layout (responsive!)
- Syntax highlighting for JSON
- Line-by-line diff with add/remove/modify coloring
- Scroll sync between panels
- Collapsible sections for large diffs
- Auto-generated plain-English summary
- Actionable recommendations

A production-quality diff viewer like GitHub's or VS Code's takes weeks. I estimated 2 weeks in the original spec.

**ALEX-PROXY:** Ship ugly, iterate pretty. What's the minimum viable diff view?

**MARCUS:** Minimum? A pre-formatted JSON block with green/red highlighting. Like `git diff` output but for JSON. No side-by-side, no scroll sync, no collapsible sections. Just:

```
- "source": "card"           ← REMOVED (red)
+ "payment_method": "card"   ← ADDED (green)
```

Plus a text summary: "Field `source` removed. Field `payment_method` added."

That's 3-4 days, not 2 weeks.

**PRIYA:** That's ugly but functional. The summary is the important part — developers want to know "what changed and what do I do about it" more than they want a pretty diff viewer.

**JAKE:** Ship the ugly version. If users love the summary but complain about the diff view, we invest in making it pretty. Data-driven.

**LUNA:** The brand guide says "clean, minimal, zen aesthetic." A `git diff` dump in a pink dashboard is not zen.

**MARCUS:** It can be zen AND simple. Use a monospace font (JetBrains Mono per brand guide), subtle background colors for added/removed lines, generous whitespace. It doesn't need to be GitHub's diff viewer to look good. Think of it like a terminal output, styled.

**ALEX-PROXY:** Here's what we ship:

**MVP Change Detail View:**
- **Side-by-side diff view** with colored line backgrounds (this IS the money screen — what converts free to paid)
- JSON syntax highlighting (JetBrains Mono)
- Scroll sync between panels
- Auto-generated text summary (plain English: "Field X removed", "Type changed from string to number")
- Severity badge (🔴 Breaking / 🟡 Warning / 🟢 Info)
- "Mark as Reviewed" button
- "False Positive" / "Real Change" feedback buttons
- Link back to URL detail page
- Responsive: falls back to unified diff on mobile

**V1.1 upgrade:**
- Collapsible sections for large diffs
- Copy diff as JSON/text
- Inline commenting on changes

**YUKI:** Reminder: the diff viewer renders THIRD-PARTY API responses. XSS prevention is critical here. Framework auto-escaping, CSP headers, never use `dangerouslySetInnerHTML`. This is attack vector INJ-01 from my pentest — stored XSS via API response display. Severity: CRITICAL.

**MARCUS:** Understood. All response data goes through React/Svelte auto-escaping. JSON is rendered as syntax-highlighted text nodes, never as HTML. CSP blocks inline scripts as defense-in-depth.

> **RESOLUTION (UPDATED):** MVP ships with **side-by-side diff view** (THE money screen), auto-generated summary, severity badge, and feedback buttons. Budget: 5-6 days in Week 4. Falls back to unified diff on mobile. This is what makes developers say "holy shit, this is useful."

---

## ROUND 5: Marketing vs Building

**JAKE:** I want to start @ChirriChangelog on Twitter NOW. Pre-launch. And I want to start monitoring 50 popular APIs internally during Week 1 of development. The content strategy research proves this: "Start monitoring popular APIs BEFORE launch to build data."

**MARCUS:** We don't have a product yet. We don't even have a check worker.

**JAKE:** We don't need the product to monitor APIs. We can run changedetection.io internally, or write a simple cron script that fetches 50 URLs and stores responses. Then we diff manually and tweet the changes. The point isn't automation — it's building an audience and accumulating data.

**LUNA:** Jake's right. SEO takes 3-6 months to rank. If we wait until launch to publish our first blog post, we won't see organic traffic until month 9+. The content strategy identifies 5 blog posts for launch month:

1. "The Hidden Cost of Third-Party API Changes" — pain validation
2. "How We Built an API Change Detection System" — HN bait
3. "How to Detect Breaking Changes in the Stripe API" — provider SEO
4. "Monitor OpenAI API Changes with Chirri (5-Min Setup)" — tutorial
5. "UptimeRobot Monitors Uptime. Here's What It Doesn't Monitor." — migration wave

Posts 1 and 2 should be WRITTEN during Week 5-6. Published launch week.

**MARCUS:** Who's writing them? Are we hiring a content person?

**ALEX-PROXY:** I'm writing them. It's my product, my story. And here's the compromise:

**Pre-launch (Weeks 1-5, while Marcus builds):**
- Week 1: Set up @ChirriChangelog Twitter. Create GitHub org (chirri-io). Reserve npm package name `chirri`.
- Week 2: Start manually monitoring 20 popular APIs using a simple script (NOT the product). Tweet any detected changes.
- Week 3: Publish `awesome-api-changelogs` repo on GitHub (curated list of API changelog URLs). Zero-effort SEO.
- Week 4: Identify and contact 20 beta users.
- Week 5: Write blog posts 1 and 2. Draft Show HN post.

**This doesn't cost Marcus a single day.** It's parallel work.

**MARCUS:** Fine. As long as nobody asks me to build marketing features before the core engine works.

**LUNA:** One more thing. The programmatic SEO pages — `chirri.io/monitor/{provider}` and `chirri.io/changelog/{provider}` — should be in the landing page build during Week 5. They're just template pages. We start with 15 providers, using data from our manual monitoring.

**MARCUS:** The landing page is already budgeted in Week 5. Adding 15 templated pages is marginal work if the template exists.

**PRIYA:** Do we start the weekly stability report email during beta? The market analysis says "Nothing Happened" churn is the existential business risk. The weekly email — "This week: X checks run, Y changes detected" — makes silence feel like value.

**ALEX-PROXY:** Yes. The weekly email ships with MVP. It's a cron job that queries check_results and sends a summary. Half a day of work.

> **RESOLUTION:** Pre-launch marketing runs in parallel with building. Twitter account Week 1, manual API monitoring Week 2, blog posts written Weeks 5-6, launched Week 8. 15 programmatic SEO pages in the landing page build. Weekly stability report email ships with MVP.

---

## ROUND 6: The Hard Cuts

**Each panelist names ONE thing to cut, ONE thing to add, gives a timeline estimate, and rates confidence that Chirri hits $10K MRR in 12 months.**

---

### 🏛️ MARCUS (Architect)

**CUT:** Provider Intelligence / "Monitor Stripe" flow. The spec says "when a user types a provider name, Chirri suggests endpoints." That's a recommendation engine layered on top of APIs.guru data. It's a nice UX but it's 3-5 days of work for a feature that helps onboarding — not detection quality. Cut it. Users paste URLs. We classify them. Done.

**ADD:** Debug mode for specific URLs. When a user reports a false positive, I need to replay the entire check pipeline — fetch, diff, fingerprint, classification, confirmation — with full logging. Without this, debugging FP reports is guesswork. It's 1 day of work and saves us days of support later.

**TIMELINE:** 9 weeks (not 8). Week 8 is always compressed. Ship beta at Week 7, public at Week 9. Two weeks of real-world usage before HN launch.

**CONFIDENCE:** 3/10. $10K MRR in 12 months requires ~285 Indie subscribers or ~115 blended (some Pro/Business). At 2.5% conversion from 5,000 free users, that's 125 paid — possible but tight. The "nothing happened" churn is real. I give it a coin flip we even hit $5K MRR.

---

### 🔓 YUKI (Security)

**CUT:** Monitoring packs (deferred in spec but still lingering). Don't build curated bundles of URLs. Users add URLs individually. Packs create a whole business logic surface — plan limit enforcement on packs, partial pack application, pack versioning — for minimal value. Kill the concept entirely until Year 2.

**ADD:** Automated SSRF bypass test suite. Not a feature — an internal testing tool. 15-20 test cases covering DNS rebinding, IPv4-mapped IPv6, octal notation, redirect chains, Railway internal DNS, CNAME to metadata. Run this suite on every deploy. If any test passes (meaning SSRF wasn't blocked), the deploy fails. This is 2-3 days of work and it's the difference between "we think safeFetch() works" and "we prove it on every deploy."

**TIMELINE:** 8 weeks is fine IF security isn't compromised. The 9 launch-blocker security items must be in the Week 2 build, not deferred to "hardening" in Week 7. `safeFetch()` is the first function written, not the last.

**CONFIDENCE:** 5/10. The product is sound, the market is real, but distribution at $9/mo is grinding work. $10K MRR is achievable if the HN launch lands well and the content flywheel spins up. The risk is "feature, not product" — someone with distribution (Postman) builds it as a checkbox feature.

---

### 📈 PRIYA (Product)

**CUT:** The aggregate intelligence feed ("73% of users saw this Stripe change"). It sounds amazing in a pitch deck, but it requires significant user scale to be meaningful. With 200 free users in Month 1, the aggregate data is statistically useless. And it creates privacy implications — users might not want their monitoring patterns visible in aggregate. Kill it until we have 1,000+ users and a clear privacy policy for aggregate data.

**ADD:** A "Check Now" button on each URL in the dashboard. Let users trigger an immediate check outside the scheduled interval. It's the simplest possible engagement feature — user clicks, sees result in 5 seconds, feels in control. Zero false positives because the user initiated it. Great for demos and onboarding. It's literally one API endpoint and one button.

**TIMELINE:** 8 weeks if Marcus doesn't gold-plate. 10 weeks if he does.

**CONFIDENCE:** 4/10. $10K MRR is a stretch at $9/mo ARPU. The spec's own projections show $4,375 MRR at Month 12 with 125 paid users. Getting to $10K means either doubling the user base (250+ paid users) or raising ARPU. I think we hit $5-7K MRR in 12 months if everything goes well.

---

### 🚀 JAKE (Growth)

**CUT:** The 7-day calibration phase. I know Marcus will kill me, but hear me out. Users add a URL and then wait 7 DAYS before the system reaches "full confidence"? For a product where first impressions matter, that's death. The 10-minute learning period is brilliant — but 7 more days of "reduced alerting" makes users think the product is broken. Cut it to 48 hours max, or make it invisible to the user.

**MARCUS:** The calibration phase exists to suppress borderline false positives while the baseline strengthens. Without it, FP rate in the first week is 3-5x higher.

**JAKE:** Then make it invisible. Don't show "calibrating" status. Just show "active" and use the higher confidence threshold internally. The user never needs to know.

**MARCUS:** ...that actually works. Fine. Remove the "calibrating" state from the UI. Internally, use 95 confidence threshold for the first 7 days, 80 after. User sees "Setting up..." (10 min) → "Active." No "calibrating" status.

**ADD:** One-click "Monitor Stripe/OpenAI/GitHub" buttons on the dashboard. Not the full provider intelligence system Marcus cut — just 3-5 hardcoded buttons that add pre-configured monitoring URLs with one click. "Monitor OpenAI" → adds `https://api.openai.com/v1/models` + the changelog RSS. It's 2 hours of work and dramatically improves onboarding for the most common use case.

**TIMELINE:** 8 weeks. Non-negotiable. If it takes 9, something went wrong.

**CONFIDENCE:** 6/10. Here's why I'm more optimistic than Marcus: the UptimeRobot migration wave is real. Reddit threads with hundreds of upvotes, multiple "alternative" articles published in 2026. If we capture even 2% of migrating UptimeRobot users, that's significant. Plus the AI agent vertical is exploding. $10K MRR is a stretch but achievable with aggressive content + HN + the migration wave.

---

### ✍️ LUNA (Content/Brand)

**CUT:** The comparison pages (chirri.io/compare/*). At launch, we have zero data to compare against competitors meaningfully. "Chirri vs changedetection.io" written before we have real usage data is just marketing fluff. Write the comparison blog post (Post 8 in the content calendar) at Month 2, when we have real user testimonials and data.

**ADD:** A public "API Stability Index" page — chirri.io/stability — showing the most and least stable popular APIs based on our monitoring data. Updated weekly. This is the kind of original data that gets cited by tech blogs, linked by developers, and drives organic traffic. It's the content-product flywheel in its purest form. The data comes from our own monitoring, so the cost is just a templated page.

**TIMELINE:** 10 weeks. I know Jake says 8, but the content pieces need time to be good. The Show HN post needs to be PERFECT — not rushed. Let the product bake with beta users for 2 weeks before the public launch.

**CONFIDENCE:** 5/10. The brand is strong, the content strategy is solid, and the SEO opportunities are real. But "API change detection" is a new category — we're educating the market, not capturing existing demand. Category creation takes 18-24 months, not 12. I think $10K MRR is a 24-month goal, not a 12-month one.

---

### 🎯 ALEX-PROXY (Founder)

**CUT:** The Pro ($29/mo) and Business ($79/mo) tiers from MVP. I said this already but I'll say it louder: WE LAUNCH WITH FREE + INDIE ONLY. Two tiers. Two prices. $0 and $9. No tier logic complexity, no feature gating complexity, no "which plan has which features" decision tree. When someone actually asks for Pro features, we add it.

**ADD:** A "What's New" changelog on the dashboard itself. A simple feed of Chirri product updates visible to logged-in users. It costs nothing (it's a static JSON file we update), and it shows users the product is alive and evolving. Dead dashboards kill retention.

**TIMELINE:** 8 weeks to code-complete. 2 weeks of beta. Launch at Week 10.

Actually — no. Here's what I really think. **Marcus ships core engine by Week 4 (Demo Day). We do internal testing Weeks 5-6. Beta users Weeks 6-7. Public launch Week 8.** The spec's Week 8 is tight but doable if we don't scope-creep.

**CONFIDENCE:** 4/10 for $10K MRR in 12 months. Here's my honest math:

- HN launch: 100-200 signups (free)
- Month 1 total: 200 free, 5 paid = $45/mo MRR
- Month 6: 2,000 free, 50 paid = $450/mo MRR
- Month 12: 5,000 free, 125 paid = $1,125/mo MRR

Wait — that's $1,125, not $10K. The spec says blended ARPU of $35, but at launch we only have Indie ($9). Until Pro/Business exist, ARPU is $9.

**To hit $10K MRR at $9 ARPU, we need 1,111 paying users.** At 2.5% conversion, that's 44,444 free users. We're not getting 44K free users in Year 1. Not even close.

**Revised realistic target: $3-5K MRR at Month 12.** $10K MRR is an 18-24 month goal. I'm OK with that. Chirri is profitable at 6 customers ($54 MRR > $42 infra cost). This isn't a VC moonshot — it's a profitable indie product that compounds.

**Veto call:** I'm resetting the MRR target. **$5K MRR at 12 months, $10K MRR at 18-24 months.** This is more honest and doesn't require magical thinking about conversion rates.

---

## DEBATE OUTCOMES: What Changed

| Decision | Before Debate | After Debate | Who Won |
|----------|--------------|-------------|---------|
| APIShift response | Study them | Ignore them, out-execute | Alex |
| Provider Intelligence ("Monitor Stripe") | MVP | **RESTORED** — MVP with hardcoded profiles, dynamic discovery V1.1 | Alex (override) |
| Calibrating state | Visible to users | Hidden — internal only | Jake |
| Quick provider buttons | Not planned | 3-5 hardcoded buttons in MVP | Jake |
| Slack + Discord | V1.1 | MVP | Priya |
| Change Detail View | Side-by-side diff (2 weeks) | **Side-by-side diff for MVP** (THE money screen — worth the investment) | Alex (override) |
| Aggregate intelligence | MVP | Cut until 1,000+ users | Priya |
| Monitoring packs | Deferred | Killed entirely | Yuki |
| SSRF test suite | Not planned | Runs on every deploy | Yuki |
| Debug mode per URL | Not planned | MVP (1 day) | Marcus |
| "Check Now" button | Not planned | MVP (half day) | Priya |
| Comparison pages | Launch | Month 2+ | Luna |
| API Stability Index | Not planned | V1.1 (Month 2) | Luna |
| "What's New" changelog | Not planned | MVP (static JSON) | Alex |
| Pro/Business tiers | MVP | Cut from MVP; add when asked | Alex |
| MRR target | $10K in 12 months | $5K in 12 months | Alex (veto) |
| Pre-launch marketing | Not discussed | Parallel from Week 1 | Jake + Luna |
| Weekly stability email | V1.1 | MVP | Priya |

---

## THE DEFINITIVE PLAN

### 1. MVP Feature List (Exactly What Ships at Launch)

**Core Detection Engine:**
- [x] Add URLs to monitor (API + dashboard)
- [x] HTTP GET checks at configurable intervals (1h and 24h for MVP tiers)
- [x] Silent learning period: 20s rapid checks for 10 min → active (calibration is internal-only, invisible to user)
- [x] Auto-classification: domain patterns (10 domains) + response-based + fallback
- [x] JSON structural diffing (jsondiffpatch, array sort fix, 20-level depth limit, 5MB size limit)
- [x] Multi-layer fingerprinting (fullHash, stableHash, schemaHash, headerHash)
- [x] Volatile field auto-detection (per-URL learning + narrow global ignore list)
- [x] Confirmation recheck: 5-second immediate recheck
- [x] Clock-aligned scheduling with 0-10% jitter
- [x] Shared monitoring deduplication (key includes headers hash)

**"Free Data" Signals (near-zero marginal effort):**
- [x] TTFB (Time to First Byte) tracking with regression alerts (>2x baseline)
- [x] Uptime/availability tracking (status code history, uptime %)
- [x] Header change tracking and diffing (rate limits, deprecation, CORS, API version)
- [x] Response size tracking with anomaly alerts (>50% deviation)
- [x] Deprecation header detection (Sunset RFC 8594, Deprecation header)

**Notifications:**
- [x] Email notifications (change detected, weekly stability report)
- [x] Webhook delivery (HMAC-signed, per-webhook secrets, retry backoff)
- [x] Slack (incoming webhook — formatted message)
- [x] Discord (webhook — formatted message)

**Dashboard:**
- [x] Auth UI (signup with email verification, login — JWT in HttpOnly cookie)
- [x] URL management (add, remove, pause, resume, "Check Now" button)
- [x] Change Detail View — **side-by-side diff** with scroll sync, auto-generated summary, severity badge, feedback buttons (responsive: unified on mobile)
- [x] Change feed (chronological, filterable by severity/type)
- [x] URL detail page (TTFB graph, uptime %, header history, check log)
- [x] **Provider Intelligence:** "Monitor Stripe" flow — type a provider name, auto-discover all monitorable sources (OpenAPI spec, changelog, status page, SDK releases). 15-20 hardcoded provider profiles for MVP, APIs.guru integration for dynamic discovery in V1.1. See `CHIRRI_PROVIDER_MONITORING.md`.
- [x] Quick-add buttons: "Monitor OpenAI" / "Monitor Stripe" / "Monitor GitHub" (top 5 providers with full source profiles)
- [x] "What's New" product changelog (static JSON feed)
- [x] Activity dashboard

**Billing:**
- [x] Free: 3 URLs, 24h checks, email only, 7-day history
- [x] Indie ($9/mo): 20 URLs, 1h checks, all notification channels, 30-day history, API access
- [x] Stripe Checkout + webhooks (only 2 products/prices)
- [x] Annual discount: 20% off ($7.20/mo billed annually)

**API:**
- [x] 27 endpoints (auth, API keys, URLs, changes, webhooks, account, health)
- [x] OpenAPI spec via zod-to-openapi + Scalar interactive docs
- [x] Cursor-based pagination, rate limit headers on every response
- [x] Test mode: `dk_test_` keys return mock data, no real outbound requests

**Infrastructure:**
- [x] 3 Railway services (API, scheduler, workers ×2)
- [x] PostgreSQL with pg_partman monthly partitioning (11 tables)
- [x] Redis (4 BullMQ queues) — authenticated, TLS
- [x] Cloudflare R2 (snapshots, daily backups)
- [x] Structured logging (pino), graceful shutdown, missed-check recovery
- [x] UptimeRobot free tier (self-monitoring /health)
- [x] Debug mode: per-URL full pipeline logging for FP investigation

---

### 2. V1.1 Features (Weeks 9-12, First Month After Launch)

- [ ] GitHub Action: `chirri/api-change-check` — CI/CD integration
- [ ] Open-source CLI: `npx chirri check <url>`
- [ ] MCP server for AI agents (read/write operations)
- [ ] Slack app (OAuth, richer formatting) — upgrade from incoming webhook
- [ ] RSS/Atom feed monitoring method
- [ ] OpenAPI import (paste spec → auto-create monitors)
- [ ] Additional check intervals: 5m, 15m, 6h
- [ ] Pro tier ($29/mo): 100 URLs, 5m min, 90-day history, 3 seats
- [ ] Performance percentiles (p50/p95/p99) with degradation alerts
- [ ] API Stability Index public page (chirri.io/stability)
- [ ] ~~Side-by-side diff view~~ — **MOVED TO MVP** (it's the money screen)
- [ ] Dynamic provider discovery via APIs.guru integration (expand beyond hardcoded profiles)
- [ ] 30-minute delayed confirmation recheck (Stage 2, non-critical only)
- [ ] PagerDuty integration
- [ ] Tag-based URL filtering and organization
- [ ] Programmatic SEO pages expansion (50 → 200 providers)

---

### 3. V2 Features (Months 3-6)

- [ ] Business tier ($79/mo): 500 URLs, 1m min, 1-year history, 10 seats, SSO
- [ ] GraphQL introspection monitoring
- [ ] SLA monitoring (track vendor SLA compliance)
- [ ] OpenAPI spec diffing (oasdiff library)
- [ ] SSL/TLS certificate monitoring (expiry + chain changes)
- [ ] Full timing breakdown (DNS, TLS, Connect, TTFB, Download)
- [ ] Multi-region checking (2 regions)
- [ ] Public changelog pages per API (chirri.io/changelog/{provider})
- [ ] @ChirriChangelog automated Twitter (fully automated)
- [ ] Team features (invite members, shared monitors)
- [ ] Weekly changelog digest emails
- [ ] Telegram + Microsoft Teams integrations
- [ ] Historical trends + stability scores
- [ ] Customer-hosted monitoring agent (open source) for authenticated APIs

---

### 4. Integration Priority (Ordered)

| # | Integration | When | Effort | Why This Order |
|---|------------|------|--------|---------------|
| 1 | Email | MVP Week 3 | 1 day | Table stakes |
| 2 | Webhooks (HMAC-signed) | MVP Week 3 | 3 days | Enables everything else |
| 3 | Slack (incoming webhook) | MVP Week 3 | 2 days | #1 developer channel |
| 4 | Discord (webhook) | MVP Week 3 | 1 day | Nearly free after Slack |
| 5 | GitHub Action | V1.1 Week 10 | 2 days | Highest-leverage distribution |
| 6 | CLI (open source) | V1.1 Week 11 | 3 days | Top-of-funnel acquisition |
| 7 | MCP Server | V1.1 Week 11 | 5 days | AI agent segment, non-negotiable |
| 8 | PagerDuty | V1.1 Week 12 | 2 days | Enterprise unlock |
| 9 | Microsoft Teams | V2 | 2 days | Enterprise demand-driven |
| 10 | Telegram | V2 | 2 days | Niche but asked for |
| 11 | Linear/Jira | V2 | 1 week | Auto-create issues on change |
| 12 | Prometheus metrics | V2 | 3 days | Observability integration |

---

### 5. Security Must-Haves (Before Launch)

**9 Launch Blockers (all implemented in Weeks 1-3):**

| # | Item | Implementation |
|---|------|---------------|
| 1 | **SSRF Comprehensive Module (`safeFetch()`)** | DNS pinning via undici `connect.hostname`, IP blocklist via `ipaddr.js` (all formats: octal, hex, IPv4-mapped IPv6), hostname blocklist (`.railway.internal`, `.internal`, `.local`, `localhost`, `metadata.google.internal`), manual redirect following with re-validation, 5MB response limit, `user:pass@` rejection |
| 2 | **Cross-Tenant Isolation** | Shared URL key = SHA-256(url + method + sorted headers). Per-user baselines. Isolated fan-out. |
| 3 | **XSS Prevention** | CSP header, framework auto-escaping, never `dangerouslySetInnerHTML` on external data |
| 4 | **DDoS/Abuse Prevention** | Per-domain outbound rate (1 req/sec), per-account per-domain URL limit (5), global domain cap (60/hr), email verification before checks, new account velocity limit (5 URLs in first 24h) |
| 5 | **API Key Security** | `crypto.randomBytes(32)`, SHA-256 hash storage, shown once, `timingSafeEqual` for comparison, reject keys in query params |
| 6 | **Rate Limiting** | Sliding window in Redis, per-plan limits, per-IP for unauthenticated (20/min login/signup) |
| 7 | **Input Validation** | Zod schemas on all bodies, URL: http/https only, max 2048 chars, no userinfo, custom headers: max 10, 1KB each, no CRLF, no Host/Transfer-Encoding override |
| 8 | **Credential Protection** | Strip `user:pass@`, warn on credential patterns in query params, encrypted custom header storage |
| 9 | **Self-Referential Blocking + Test Mode** | Block `*.chirri.io`, `dk_test_` returns mock data only |

**Automated SSRF Bypass Test Suite (runs on every deploy):**

| Test Case | Input | Expected |
|-----------|-------|----------|
| Loopback | `http://127.0.0.1/` | BLOCKED |
| Loopback shorthand | `http://127.1/` | BLOCKED |
| Octal notation | `http://0177.0.0.1/` | BLOCKED |
| Hex notation | `http://0x7f000001/` | BLOCKED |
| Decimal notation | `http://2130706433/` | BLOCKED |
| IPv4-mapped IPv6 | `http://[::ffff:127.0.0.1]/` | BLOCKED |
| IPv4-mapped hex | `http://[::ffff:7f00:1]/` | BLOCKED |
| Railway internal | `http://api.railway.internal:3000/` | BLOCKED |
| Cloud metadata | `http://169.254.169.254/` | BLOCKED |
| Private range | `http://10.0.0.1/` | BLOCKED |
| Self-referential | `http://api.chirri.io/` | BLOCKED |
| Localhost alias | `http://localhost/` | BLOCKED |
| .internal TLD | `http://anything.internal/` | BLOCKED |
| .local TLD | `http://service.local/` | BLOCKED |
| Zero IP | `http://0.0.0.0/` | BLOCKED |
| ULA IPv6 | `http://[fd00::1]/` | BLOCKED |
| Link-local | `http://[fe80::1]/` | BLOCKED |
| Userinfo | `http://user:pass@example.com/` | REJECTED with error |

**Quick-Fix Post-Launch (Weeks 9-10):**
- URL parser differential sanitization (strip non-ASCII, canonical form)
- Snapshot IDOR (UUIDs + ownership check, return 404 not 403)
- CSRF on dashboard (SameSite=Strict + CSRF token + Origin check)
- JWT in HttpOnly cookie (NOT localStorage)
- Redis authentication verification + TLS
- Plan limit race condition (`SELECT ... FOR UPDATE`)
- Account enumeration prevention (same error for valid/invalid emails)
- Prototype pollution sanitization (filter `__proto__`, `constructor`, `prototype`)
- Webhook URL SSRF (re-validate IP at delivery time)

---

### 6. Timeline (Week by Week)

| Week | Focus | Key Deliverable | Exit Criteria |
|------|-------|----------------|---------------|
| **1** | **Foundation** | Railway 3 services deployed, DB schema (11 tables, pg_partman), auth (signup + login + JWT in HttpOnly cookie), API skeleton (health, auth, API key CRUD), rate limiting middleware, pino logging, email verification flow | Can create account, generate API key, and hit authenticated endpoints |
| **2** | **Check Engine + Security** | `safeFetch()` SSRF module (COMPLETE — all 18 test cases passing), BullMQ 4 queues, check worker pipeline, JSON diff engine (jsondiffpatch + array sort + depth limit + size limit), multi-layer fingerprinting, volatile field detection, silent learning period (10 min), per-domain rate limiting + circuit breaker, shared monitoring dedup with cross-tenant isolation, TTFB + response size capture, debug mode per URL | Can add a URL, watch it enter learning, and see it transition to active. SSRF test suite: 18/18 blocked. |
| **3** | **Detection + Notifications** | Full detection pipeline (schema/header/status/timing/size changes), deprecation header parsing, confirmation recheck (5s), CRUD API for URLs + changes + webhooks, webhook delivery (HMAC, per-webhook secrets, retry backoff), email notifications via Resend, Slack + Discord incoming webhooks, weekly stability report email (cron), error handling, input validation (zod), plan limit enforcement (with `FOR UPDATE`), OpenAPI spec generation | Can detect a change and receive webhook + email + Slack notification. Weekly email sends. |
| **4** | **Dashboard — DEMO DAY** 🎯 | Full dashboard UI: auth pages, URL management with "Check Now" button, Change Detail View (**side-by-side diff** + summary + severity + feedback), change feed, URL detail (TTFB graph, uptime %, header history), **"Monitor Stripe" provider flow** with 15-20 hardcoded profiles, quick-add provider buttons (top 5), "What's New" changelog, activity dashboard. Landing page draft. | **DEMO: Type "Stripe" → see all monitorable sources → add them → detect change → see side-by-side diff → get Slack notification → mark as reviewed.** Full end-to-end flow works. |
| **5** | **Billing + Landing + Content** | Stripe Checkout + webhooks (Free + Indie only), billing UI, landing page (sakura pink, dark mode), 15 programmatic SEO provider pages (`/monitor/{provider}`), legal (Termly privacy/ToS), CSP/CORS/CSRF hardening, daily R2 backups, Scalar API docs, blog posts 1+2 drafted. **Start internal monitoring of 50 popular APIs.** | Can subscribe to Indie. Landing page live. Legal pages live. |
| **6** | **Testing + Beta Prep** | Unit tests (diff engine, SSRF suite, classification, rate limiting, plan limits), integration tests (full check cycle, Stripe webhooks, notification delivery), mock API server for testing, beta user outreach (20 users contacted), blog posts finalized. | All critical paths tested. 15+ beta users confirmed. |
| **7** | **Beta + Hardening** | 10-20 beta users monitoring real URLs, fix beta bugs, k6 load test (500 URLs), performance tuning, /internal/metrics endpoint, missed-check recovery logic, quick-fix security items (CSRF, CRLF, IDOR, prototype pollution, JWT storage), 48-hour zero-false-positive validation. | Beta users active. **48 hours with zero false positives on 50+ real URLs.** |
| **8** | **🚀 LAUNCH** | Final security review, production hardening, Show HN post written, launch sequence executed. Publish blog posts 1+2. Monitor 48 hours post-launch. Respond to all HN/Reddit/PH comments within 2 hours. | **Live. Accepting signups. Processing payments.** |

---

### 7. Launch Sequence

**Pre-Launch (Weeks 1-7):**
| Week | Marketing Action |
|------|-----------------|
| 1 | Twitter @ChirriChangelog created. GitHub org created. npm `chirri` reserved. |
| 2 | Start manually monitoring 20 APIs. Tweet first detected changes. |
| 3 | Publish `awesome-api-changelogs` GitHub repo. |
| 4 | Identify 20 beta users (5 AI agent devs, 5 indie SaaS, 5 Shopify devs, 5 DevOps). |
| 5 | Contact beta users. Blog posts 1+2 drafted. Show HN post drafted. |
| 6 | Beta users onboarded. Collect 5+ testimonial quotes. |
| 7 | Beta feedback incorporated. Show HN post finalized. PH listing prepared. |

**Launch Week (Week 8):**
| Day | Action | Target |
|-----|--------|--------|
| **Monday** | **Show HN** — "Show HN: Chirri – Get notified when any API you depend on changes" (link to GitHub, not marketing site). Answer 50+ comments fast. Publish Blog Post 1. | 50-200 signups |
| **Tuesday** | **Product Hunt** launch. **Reddit**: r/programming, r/webdev, r/node, r/devops. Publish Blog Post 2 (technical deep dive). | 50-100 PH + 30-80 Reddit |
| **Wednesday** | **Dev.to / Hashnode** technical article (cross-post blog post 2). Twitter launch thread. | 20-40 signups |
| **Thursday** | **Indie Hackers** post (building in public story). | 10-20 signups |
| **Friday** | "UptimeRobot Alternative" blog post (Post 5) — SEO seed for migration wave. | Long-term SEO |

**Post-Launch (Weeks 9-12):**
| Week | Focus |
|------|-------|
| 9 | Respond to all feedback. Fix bugs. Start building GitHub Action. Quick-fix security items. |
| 10 | Ship GitHub Action to marketplace. Publish "API Changes This Week" blog (recurring series). |
| 11 | Ship CLI (`npx chirri check <url>`). Ship MCP server. Submit to awesome-* lists. |
| 12 | Ship PagerDuty. Ship Pro tier ($29/mo). First case study published. Ship OpenAPI import. |

---

### 8. Kill Criteria

**When do we stop if it's not working?**

| Signal | Threshold | Action |
|--------|-----------|--------|
| Zero paying customers | 60 days post-launch | Reassess pricing, pivot positioning, or kill |
| <10 free signups in first week | Launch week | Launch failed — try re-launch on different channel |
| False positive rate >5% | Any time | Halt new signups, fix detection engine |
| >50% Day-30 churn on paid | Month 3+ | Product-market fit not achieved — reassess core value prop |
| Infrastructure costs > 2x revenue | Month 6+ | Optimize or raise prices |
| No organic growth (all signups from paid channels) | Month 6+ | Content strategy isn't working — reassess SEO, consider different distribution |
| Postman ships identical feature | Any time | Evaluate if our niche (indie/small team) is still viable vs Postman's enterprise focus |
| <$1K MRR at Month 6 | Month 6 | Serious conversation about pivoting or winding down |

**The real kill signal:** If at Month 6 we have <$1K MRR AND no organic growth trajectory, we wind down gracefully. Open-source the core engine, let existing users export data, and move on.

**The "keep going" signal:** If at Month 6 we have $1K+ MRR with month-over-month growth (even 10-20%), we keep going. The compounding data moat + content flywheel means the trajectory matters more than the absolute number.

---

## SUCCESS METRICS

### End of Week 8 (Launch)
- [ ] 5+ URL types classified automatically
- [ ] Silent learning → active transition working (zero FP during learning)
- [ ] Clock-aligned scheduling with deduplication verified
- [ ] TTFB, uptime %, response size tracked per URL
- [ ] Header changes (including deprecation) detected and displayed
- [ ] Confirmation recheck filtering transient changes
- [ ] **0 false positives in 48 hours on 50+ real URLs**
- [ ] API p95 latency <200ms
- [ ] Change Detail View showing **side-by-side diff** + summary + feedback (unified on mobile)
- [ ] Weekly stability report email working
- [ ] Webhooks + Email + Slack + Discord all working
- [ ] OpenAPI spec served + Scalar docs live
- [ ] Stripe billing working (Free + Indie)
- [ ] SSRF test suite: 18/18 bypasses blocked
- [ ] 20+ beta users signed up
- [ ] Pre-launch monitoring data for 50+ popular APIs
- [ ] At least 1 real API change detected and reported to a real user
- [ ] Show HN post published and answered

### Month 3
- [ ] 800+ free users, 20+ paid ($180+ MRR)
- [ ] GitHub Action live in marketplace
- [ ] MCP server shipped
- [ ] CLI on npm
- [ ] 5+ blog posts published
- [ ] @ChirriChangelog posting automatically
- [ ] <2% false positive rate

### Month 6
- [ ] 2,000+ free users, 50+ paid ($450+ MRR)
- [ ] Pro tier launched
- [ ] 15+ provider changelog pages indexed
- [ ] First "State of API Changes" data report
- [ ] Month-over-month growth >20%

### Month 12
- [ ] 5,000+ free users, 125+ paid ($1,125-$5,000 MRR)
- [ ] Business tier launched if demand warrants
- [ ] Organic traffic: 10,000+ monthly blog visits
- [ ] API Stability Index published and cited

---

## CONFIDENCE RATINGS SUMMARY

| Panelist | Cut | Add | Timeline | $10K MRR in 12mo |
|----------|-----|-----|----------|-------------------|
| 🏛️ Marcus | Provider Intelligence | Debug mode | 9 weeks | 3/10 |
| 🔓 Yuki | Monitoring packs | SSRF test suite | 8 weeks | 5/10 |
| 📈 Priya | Aggregate intelligence | "Check Now" button | 8-10 weeks | 4/10 |
| 🚀 Jake | 7-day calibration UI | Quick-add buttons | 8 weeks | 6/10 |
| ✍️ Luna | Comparison pages | Stability Index | 10 weeks | 5/10 |
| 🎯 Alex | Pro/Business tiers | "What's New" changelog | 8 weeks | 4/10 |

**Average confidence for $10K MRR in 12 months: 4.5/10**

**Revised consensus target: $3-5K MRR at 12 months.** Break-even from Month 1 ($54 MRR covers $42 infra). Profitable indie project that compounds. Not a unicorn. A cockroach.

---

## FINAL WORDS

**ALEX-PROXY:** This is the last planning document. Every question has been asked. Every feature has been debated. Every risk has been identified. The spec is 1,000+ lines. The security pentest found 34 vectors and we've addressed them all. The market analysis confirmed our niche is empty. The content strategy is written. The brand is designed.

There is nothing left to plan.

The next file created in this workspace should be `package.json`.

**After this, code.**

---

*Debate conducted: March 23, 2026*  
*Participants: Marcus (Architect), Yuki (Security), Priya (Product), Jake (Growth), Luna (Content/Brand), Alex-Proxy (Founder)*  
*This document supersedes all previous debate documents.*

---

## AMENDMENT 1: Restored Features (March 24, 2026)

**Author:** Alex (Founder override)  
**Reason:** Three features were cut during the debate that are actually core to the product vision. Restoring them.

### RESTORED: Provider Intelligence ("Monitor Stripe" flow)

Marcus cut this as "a recommendation engine layered on APIs.guru data" that takes 3-5 days. He was wrong about the scope — it's actually simpler than he thinks AND it's the core product differentiation.

**What changed:**
- MVP ships with 15-20 **hardcoded provider profiles** (not a dynamic recommendation engine)
- Each profile maps a provider name to: OpenAPI spec URL, changelog URL, status page URL, key SDK repos
- User types "Stripe" → sees all monitorable sources → adds with one click
- This is NOT the killed "monitoring packs" concept (static bundles). This is dynamic, per-provider source discovery.
- V1.1 adds APIs.guru integration for providers we don't have hardcoded profiles for

**Effort:** 1-2 days (it's a JSON file of provider profiles + a search/display UI)  
**Value:** This IS the product. It's what makes Chirri different from "paste a URL and check if JSON changed."

**Reference:** See `CHIRRI_PROVIDER_MONITORING.md` for the complete source map per provider.

### RESTORED: Side-by-Side Diff (MVP, not V1.1)

The debate downgraded the diff view to "unified" (like `git diff`) to save time. But this is THE screen that converts free users to paid. It deserves the investment.

**What changed:**
- MVP ships with **side-by-side diff view** (not unified)
- Left panel: before. Right panel: after. Scroll-synced.
- Responsive: falls back to unified diff on mobile screens
- Budget increased from 4 days to 5-6 days in Week 4

**Effort:** +1-2 days over unified diff  
**Value:** This is what makes developers screenshot and share. "Look at what Chirri caught." Unified diff doesn't get shared. Side-by-side does.

### STILL KILLED: Monitoring Packs

Monitoring packs (prebuilt static lists of URLs) remain killed. They're replaced by the superior concept: **dynamic provider source discovery**. Instead of a static "Stripe Pack" with 10 URLs, we dynamically discover all sources for any provider.

### STILL DEFERRED: Aggregate Intelligence

Aggregate intelligence ("73% of users saw this Stripe change") remains deferred until 1,000+ users. The data isn't meaningful with 200 users, and the privacy implications need careful design.

### NEW UNDERSTANDING: Provider-Centric Monitoring

The key insight documented in `CHIRRI_PROVIDER_MONITORING.md`:

1. **An API provider isn't a single URL — it's an ecosystem of sources.** OpenAPI spec, changelog, status page, SDK releases, docs pages.
2. **Different source types need different monitoring strategies.** Status pages have JSON APIs. Changelogs need HTML scraping. OpenAPI specs need structural diffing. npm needs version comparison.
3. **Status pages are standardized.** Most major providers use Statuspage.io with a standard JSON API (`/api/v2/summary.json`). One strategy monitors 50+ providers.
4. **The Change Detail View shows changes across ALL sources for a provider.** Not just one URL — the full picture.

### Updated Debate Outcomes Table Entry

| Decision | Before | After Amendment |
|----------|--------|----------------|
| Provider Intelligence | Cut entirely (Marcus) | **Restored** — hardcoded profiles MVP, dynamic V1.1 |
| Change Detail View | Unified diff (4 days) | **Side-by-side diff** (5-6 days) — the money screen |
| Monitoring packs | Killed (Yuki) | Still killed — replaced by dynamic provider discovery |
| Aggregate intelligence | Cut until 1K users (Priya) | Still cut until 1K users |

*Amendment approved by: Alex (Founder)*  
*This amendment modifies the FINAL plan. Updated sections are marked inline.*
