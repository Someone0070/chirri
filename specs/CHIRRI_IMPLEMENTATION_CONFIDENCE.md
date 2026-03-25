# CHIRRI — Implementation Confidence Audit

**Date:** 2026-03-24  
**Auditor:** Opus (Implementation Reality Check)  
**Source of Truth:** CHIRRI_BIBLE.md v2.2, Section 9.1 (MVP Feature List)  
**Question:** "If a developer sat down to build this tomorrow, where would they get stuck?"

---

## Executive Summary

Of 40+ discrete MVP features, **14 are GREEN** (high confidence, proven approaches), **17 are YELLOW** (specced but need prototyping or have unvalidated assumptions), and **7 are RED** (hand-wavy, could be much harder than the spec suggests).

**The three biggest risks:**
1. **Change Detection false positive rate** — the learning period + volatile field detection is well-designed in theory but completely unvalidated against real-world API diversity
2. **Discovery Service** — finding changelogs/status pages from an arbitrary URL is an unsolved problem with no evidence of prototyping
3. **LLM Chirp Summarization** — listed as MVP but has no prompt template, no output format, no caching strategy, and no fallback tested

---

## 🟢 GREEN — High Confidence (14 features)

### 1. URL/domain input with SSRF validation
- **What:** Accept user URLs, validate them, prevent SSRF attacks
- **How well specced:** FULLY SPECCED — Bible §2.1 + §5.5 has 8-vector SSRF coverage, safeFetch() with DNS pinning, IP blocklist including IPv6, manual redirect following
- **Validated:** Researched thoroughly. SSRF prevention is a well-understood problem. The spec covers DNS rebinding (the main bypass technique per 2025 research). DNS pinning with undici's `connect.lookup` is the industry-standard defense. CHIRRI_UNKNOWN_SOLUTIONS.md has concrete code.
- **What could go wrong:** DNS rebinding attacks with very low TTLs could theoretically slip through between resolve and connect. IPv6-mapped IPv4 addresses need careful handling (spec mentions ipaddr.js for this).
- **Confidence: HIGH** — Well-researched, standard approach, comprehensive edge case coverage
- **Biggest unknown:** Whether Railway's managed DNS resolver respects TTLs or caches aggressively (affects DNS pinning reliability)

### 2. Auto-classification (3-phase pipeline)
- **What:** Detect content type (JSON API, RSS, HTML, OpenAPI) from a URL response
- **How well specced:** FULLY SPECCED — Bible §2.4 has Phase 1 (domain patterns), Phase 2 (response analysis), Phase 3 (fallback)
- **Validated:** Standard content-type detection. Content-Type headers + body sniffing is how every browser and proxy works.
- **What could go wrong:** Low confidence on ambiguous content (e.g., HTML page that happens to contain JSON). Spec has confidence scores and user override as escape valve.
- **Confidence: HIGH** — Straightforward implementation, well-understood problem
- **Biggest unknown:** Accuracy rate for unknown domains (spec estimates ~80%, but untested)

### 3. JSON structural diffing (jsondiffpatch)
- **What:** Compare two JSON responses and identify structural changes
- **How well specced:** FULLY SPECCED — Bible §2.9 with tiered strategy (<100KB full diff, 100KB-1MB no LCS, >1MB hash-only), 500ms timeout, prototype pollution prevention
- **Validated:** jsondiffpatch is a mature library (5.5K+ GitHub stars, 500K+ weekly downloads). CHIRRI_UNKNOWN_SOLUTIONS.md T-01 has working code with timeout protection.
- **What could go wrong:** Array diffing on large arrays can be O(n²). Spec handles this with LCS disable for large payloads.
- **Confidence: HIGH** — Battle-tested library, sensible tiered approach
- **Biggest unknown:** Performance on deeply nested JSON (>10 levels) — unlikely in practice

### 4. 4-fingerprint change detection
- **What:** Use 4 hash levels (full, stable, schema, header) to classify change significance
- **How well specced:** FULLY SPECCED — Bible §2.8 Step 6-7 with clear comparison logic
- **Validated:** Designed from scratch but the concept is sound — multi-level hashing is a well-known technique in change detection systems
- **What could go wrong:** stableHash depends on correct volatile field identification (see Learning Period)
- **Confidence: HIGH** — Simple, deterministic algorithm
- **Biggest unknown:** Whether the hash hierarchy correctly maps to user-perceived severity

### 5. Confirmation recheck (5s + 30min)
- **What:** Re-check a URL after detecting change to confirm it's not transient
- **How well specced:** FULLY SPECCED — Bible §2.8 Step 9 with Stage 1 (5s) and Stage 2 (30min)
- **Validated:** Standard pattern in monitoring systems (e.g., Nagios check_interval + retry_interval)
- **What could go wrong:** If the API returns different content to different requests (load balancer inconsistency), confirmation could flip-flop
- **Confidence: HIGH** — Proven pattern, simple implementation
- **Biggest unknown:** Whether 5s is too fast (connection reuse may hit same server) or 30min too slow (change might revert)

### 6. 4-level severity system
- **What:** Classify changes as Critical/High/Medium/Low
- **How well specced:** FULLY SPECCED — Bible §2.12 with clear definitions
- **Validated:** Standard pattern in every alerting system
- **Confidence: HIGH**
- **Biggest unknown:** Getting the rule-based severity assignment right without LLM (MVP uses rules, not ML)

### 7. 5-state workflow
- **What:** Track changes through New/Tracked/Ignored/Snoozed/Resolved states
- **How well specced:** FULLY SPECCED — Bible §2.11 with state diagram and transition endpoints
- **Validated:** Standard issue-tracking pattern
- **Confidence: HIGH**
- **Biggest unknown:** None significant

### 8. Email notifications (Resend)
- **What:** Send change notification emails via Resend API
- **How well specced:** FULLY SPECCED — Bible §7.1, Appendix C, React Email templates, 5 onboarding emails
- **Validated:** Resend is production-proven, good docs, React Email is well-documented
- **Confidence: HIGH**
- **Biggest unknown:** Deliverability to corporate email (SPF/DKIM setup on chirri.io)

### 9. Discord notifications (incoming webhooks)
- **What:** Post change alerts to Discord channels via webhook URL
- **How well specced:** FULLY SPECCED — Bible §D.11 with full embed format and severity colors
- **Validated:** Discord webhook API is simple and well-documented. Incoming webhooks = POST a JSON body. No OAuth.
- **Confidence: HIGH**
- **Biggest unknown:** None — this is one of the simplest integrations

### 10. Slack notifications (incoming webhooks)
- **What:** Post change alerts to Slack channels via webhook URL
- **How well specced:** FULLY SPECCED — Bible §D.10 with full Block Kit format
- **Validated:** Slack Block Kit is well-documented. Incoming webhooks are trivial.
- **Confidence: HIGH**
- **Biggest unknown:** None significant

### 11. Generic webhook delivery
- **What:** POST change payloads to user-configured webhook endpoints with HMAC signing
- **How well specced:** FULLY SPECCED — Bible §6.2, §8.6 HMAC-SHA256 signing, §D.4 payload format, retry logic (1m, 5m, 30m, 2h, 12h)
- **Validated:** Standard webhook pattern. Well-understood.
- **Confidence: HIGH**
- **Biggest unknown:** None significant

### 12. Email/password auth (better-auth)
- **What:** User registration and login via email/password with session cookies
- **How well specced:** FULLY SPECCED — Bible §6.2 auth endpoints, §8.5 security details
- **Validated:** better-auth is actively maintained (v1.5.5), has native Hono integration, built-in Drizzle adapter. Official Hono docs show better-auth + Cloudflare + Neon example.
- **What could go wrong:** Known Drizzle adapter compatibility issue (GitHub #6766 — Drizzle v1.0 new query syntax). Also known `@neondatabase/serverless` incompatibility (GitHub #3678 — tagged-template syntax issue).
- **Confidence: HIGH** (with version pinning) — Pin Drizzle to 0.x, use `pg` driver not `@neondatabase/serverless`, test adapter before committing
- **Biggest unknown:** Whether better-auth's API key plugin supports custom prefixes (ck_live_, ck_test_) and SHA-256 hashing

### 13. API keys (ck_live_, ck_test_)
- **What:** Create and manage API keys for programmatic access
- **How well specced:** FULLY SPECCED — Bible §6.2, §D.12 test mode behavior
- **Validated:** Standard pattern. If better-auth's plugin doesn't support custom prefixes, building custom is ~2 days.
- **Confidence: HIGH**
- **Biggest unknown:** better-auth API key plugin feature coverage vs custom implementation

### 14. Stripe billing
- **What:** Checkout, subscriptions, customer portal, dunning emails
- **How well specced:** FULLY SPECCED — Bible §4.1 with Stripe implementation details
- **Validated:** Stripe is the most well-documented payment API. Thousands of production implementations.
- **Confidence: HIGH**
- **Biggest unknown:** None — Stripe integration is well-trodden ground

---

## 🟡 YELLOW — Needs Prototyping / Unvalidated Assumptions (17 features)

### 15. Learning period (10min rapid + 7-day calibrating)
- **What:** 30 checks at 20s intervals to detect volatile fields, then 7-day calibration period
- **How well specced:** FULLY SPECCED — Bible §2.7 with volatile field detection at >50% threshold
- **Validated:** Designed from scratch. The concept of baseline learning is used by IDS systems, but the specific implementation (30 rapid checks → volatile field detection → stableHash construction) has NOT been prototyped.
- **What could go wrong:**
  - APIs that rate-limit the 30 rapid checks (429 during learning → baseline includes error responses)
  - Fields that change hourly but not every 20 seconds (missed by 10-minute learning window)
  - Nested fields that are partially volatile (e.g., `data.items[*].last_updated` but `data.items[*].name` is stable)
  - Breaking changes during learning silently baked into baseline
- **Confidence: MEDIUM** — Sound design but unvalidated. The 10-minute window catches per-request volatility but NOT time-based volatility (hourly/daily patterns).
- **Biggest unknown:** What percentage of real-world APIs have volatile fields that DON'T change every 20 seconds but DO change hourly/daily? These would be false positive generators that the learning period misses.

### 16. HTML text extraction and diffing
- **What:** Pipeline: cheerio → readability → turndown → jsdiff with fuzzy paragraph dedup
- **How well specced:** FULLY SPECCED — Bible §2.9 with Jaccard similarity for dedup
- **Validated:** Each library individually is proven. The pipeline combination has NOT been tested against real changelog pages.
- **What could go wrong:**
  - Readability strips content that matters (sidebars with version info)
  - Turndown produces different markdown for structurally identical HTML
  - False positives from CSS class changes, ad injections, cookie banners
  - Jaccard similarity threshold (not specified — what value?)
- **Confidence: MEDIUM** — Each piece works individually but the pipeline is untested end-to-end
- **Biggest unknown:** False positive rate on real HTML pages. changedetection.io's users consistently report noise from dynamic content. Their solution: conditional actions (user defines what kind of change matters). Chirri's approach (readability extraction + Jaccard dedup) is different and unproven.

### 17. Response size anomaly detection
- **What:** Alert when response body size deviates >50% from baseline
- **How well specced:** PARTIALLY SPECCED — Bible §2.9 mentions the thresholds but the comparison logic isn't specified as a discrete pipeline step
- **Validated:** Simple concept but the baseline_size_bytes handling during learning period needs definition
- **What could go wrong:** Paginated APIs where page 1 is always 50KB but page 2 varies. Compressed vs uncompressed responses.
- **Confidence: MEDIUM** — Simple to implement but spec gaps in where this runs in the pipeline
- **Biggest unknown:** Whether response size is measured before or after decompression

### 18. 15-20 hardcoded provider profiles
- **What:** JSON config file with curated profiles for major API providers (Stripe, OpenAI, etc.)
- **How well specced:** FULLY SPECCED — Bible §5.10 has ProviderProfile TypeScript interface
- **Validated:** This is just a JSON file with URLs. Simple.
- **What could go wrong:** Providers change their URL structures. Changelog URLs move. Status page providers switch (e.g., from Statuspage to Instatus).
- **Confidence: MEDIUM** — Easy to build, but the data goes stale and maintenance burden is ongoing
- **Biggest unknown:** How often provider URLs change and who maintains the profiles

### 19. Provider search and quick-add
- **What:** Fuzzy search across provider profiles, one-click setup
- **How well specced:** FULLY SPECCED — Bible §6.2 has search endpoint
- **Validated:** Standard fuzzy search over a small dataset (<20 items for MVP). Trivial.
- **Confidence: MEDIUM-HIGH** — Simple but depends on provider profiles being correct
- **Biggest unknown:** UX quality of the "quick-add" flow — needs user testing

### 20. Shared monitoring deduplication
- **What:** Multiple users monitoring the same URL share one physical check
- **How well specced:** FULLY SPECCED — Bible §5.2 shared_urls table, advisory lock for creation, retention model follows highest subscriber
- **Validated:** Standard database-level dedup pattern. Advisory locks are well-understood in Postgres.
- **What could go wrong:** URL normalization edge cases (query param order, trailing slashes, www vs non-www). CHIRRI_UNKNOWN_SOLUTIONS.md T-10 addresses this with `normalize-url`.
- **Confidence: MEDIUM-HIGH** — Well-specced, standard pattern, but URL normalization edge cases need testing
- **Biggest unknown:** Whether `normalize-url` library handles all edge cases (e.g., IDN domains, unusual port numbers)

### 21. Sunset/Deprecation header parsing
- **What:** Parse RFC 8594 Sunset and RFC 9745 Deprecation headers from HTTP responses
- **How well specced:** FULLY SPECCED — Early Warning Implementation §2 has complete code with structured-headers library
- **Validated:** RFC standards exist. The `structured-headers` npm library parses them. Working code provided in the doc.
- **What could go wrong:** Very few APIs actually send these headers today. Adoption is growing but still rare.
- **Confidence: MEDIUM-HIGH** — Implementation is straightforward, but the feature may produce zero signals for most users because so few APIs send these headers
- **Biggest unknown:** How many of the top 100 APIs actually send Sunset/Deprecation headers? (Likely <5%)

### 22. API version header tracking
- **What:** Detect when API-Version, X-API-Version, or similar headers change between checks
- **How well specced:** FULLY SPECCED — Early Warning Implementation §4 has header list and detection logic
- **Validated:** Simple string comparison. Well-documented in spec.
- **What could go wrong:** Headers that include request-specific data (e.g., `X-Request-Version: 2.3.1-canary-abc123`)
- **Confidence: MEDIUM-HIGH** — Simple implementation, well-specced
- **Biggest unknown:** False positives from version headers that include build hashes

### 23. Confidence scoring with human-readable reasoning
- **What:** Score each signal 0-100 with factors, threshold-based actions
- **How well specced:** FULLY SPECCED — Bible §3.7 with factor breakdown and thresholds
- **Validated:** Designed from scratch. The scoring algorithm is rule-based (not ML) which is predictable but may not capture nuance.
- **What could go wrong:** Scoring weights are arbitrary — no data to calibrate them
- **Confidence: MEDIUM** — Will produce numbers but the numbers may not be meaningful without real-world calibration
- **Biggest unknown:** Whether the confidence thresholds (60 for full chirp, 40-59 for dashboard) actually correlate with signal quality

### 24. Deadline countdown and reminder system
- **What:** Track sunset deadlines and send reminders at adaptive milestones
- **How well specced:** FULLY SPECCED — Bible §3.8 with milestone scheduling, database-polled via daily cron
- **Validated:** Calendar/reminder systems are well-understood. Simple cron + date comparison.
- **Confidence: MEDIUM-HIGH** — Straightforward, but depends on accurate deadline extraction
- **Biggest unknown:** Date parsing accuracy from changelog text (chrono-node handles standard formats but Q-notation like "Q3 2026" needs custom parser — spec acknowledges this)

### 25. Notes field, Copy-as-markdown, Snooze
- **What:** Standard workflow features for change management
- **How well specced:** FULLY SPECCED
- **Validated:** Standard CRUD operations
- **Confidence: MEDIUM-HIGH** — Trivial features, just need to build them
- **Biggest unknown:** None

### 26. Notification rate limiting per plan
- **What:** Cap notifications by plan tier and severity
- **How well specced:** FULLY SPECCED — Bible §7.1 rate limit table
- **Validated:** Standard rate limiting pattern
- **Confidence: MEDIUM-HIGH**
- **Biggest unknown:** Whether the limits feel right to users (too restrictive on free tier?)

### 27. MCP server (8 tools)
- **What:** Model Context Protocol server for AI agent integration
- **How well specced:** FULLY SPECCED — Bible §7.3, §D.7 with all 8 tools and schemas
- **Validated:** MCP is a defined standard. Building an MCP server is well-documented. Deployment as npm package is standard.
- **What could go wrong:** MCP spec is still evolving. Client compatibility across different AI agents.
- **Confidence: MEDIUM** — Well-specced but MCP ecosystem is young. Testing across multiple AI clients needed.
- **Biggest unknown:** Which MCP clients will actually be used by Chirri's target users

### 28. Dashboard (Tree-view, Change feed, Monaco DiffEditor, etc.)
- **What:** Full React SPA dashboard with diff viewer, tree layout, settings
- **How well specced:** FULLY SPECCED in CHIRRI_FRONTEND_BIBLE.md — comprehensive design system
- **Validated:** Each component technology is proven (React, Monaco, shadcn/ui, TanStack Query). However, the COMBINATION hasn't been built.
- **What could go wrong:**
  - Monaco Editor is ~2MB — lazy loading critical or initial load times suffer
  - Tree-view with status dots at scale (200 URLs × source trees) — performance
  - Dark mode with Monaco themes — integration complexity
  - Responsive diff view on mobile — spec says "unified diff fallback" but this is additional work
- **Confidence: MEDIUM** — Each piece is proven but assembling them is 60-70 hours of work (Feasibility doc estimate). The Feasibility doc says this is "2 weeks crammed into 1."
- **Biggest unknown:** Monaco Editor + Vite integration with proper lazy loading and dark mode theming

### 29. Dark mode
- **What:** System-preference-based dark mode with CSS variables
- **How well specced:** FULLY SPECCED — Frontend Bible §1.8
- **Validated:** Standard CSS variable approach. `prefers-color-scheme` is well-supported.
- **Confidence: MEDIUM-HIGH** — Straightforward but requires touching every component
- **Biggest unknown:** Monaco Editor dark theme integration

### 30. Free + Personal plans with GDPR deletion
- **What:** Two pricing tiers, account deletion with 7-day grace period, full cascade
- **How well specced:** FULLY SPECCED — Bible §4.1, §8.9
- **Validated:** CHIRRI_UNKNOWN_SOLUTIONS.md O-04 has working deleteUserData() function with 12+ table cascade
- **What could go wrong:** Missing a table in the cascade. R2 objects not cleaned up.
- **Confidence: MEDIUM-HIGH** — Well-specced but needs thorough testing
- **Biggest unknown:** Whether the cascade handles all edge cases (shared URLs with multiple subscribers)

### 31. Weekly stability report
- **What:** Weekly email summarizing monitoring activity
- **How well specced:** PARTIALLY SPECCED — Bible §D.3 has template with content and conditions. Missing: exact data aggregation queries.
- **Validated:** Standard email generation + cron
- **Confidence: MEDIUM** — Design is clear, implementation is straightforward, but data aggregation queries need writing
- **Biggest unknown:** What to show users with zero changes (spec says "all quiet" message but template needs design)

---

## 🔴 RED — Hand-Wavy / Much Harder Than Spec Suggests (7 features)

### 32. 🔴 Discovery Service (15-path probe)
- **What:** Automatically find a provider's changelog, status page, OpenAPI spec, and RSS feed by probing 15 well-known paths
- **How well specced:** PARTIALLY SPECCED — Bible §2.3 has three phases, HTTPS only, rate-limited, but the actual 15 paths are not listed. No success rate data.
- **Validated:** NOT VALIDATED. No prototype. No research on what percentage of APIs have discoverable changelogs at well-known paths.
- **What could go wrong:**
  - **Most APIs don't have changelogs at predictable paths.** A search for "API changelog discovery" turns up zero tools that solve this automatically. The closest is Theneo, which works from OpenAPI specs (not URL probing).
  - **Changelog URL patterns vary wildly:** `/changelog`, `/docs/changelog`, `/blog/tag/changelog`, `/developer/release-notes`, `/what-s-new`, GitHub releases page, Notion page, etc.
  - **Status pages are hosted externally:** Most use Statuspage.io, Instatus, or custom domains (status.stripe.com, not stripe.com/status)
  - **OpenAPI specs are rarely at well-known paths:** Some are at `/openapi.json`, most are behind documentation portals or not public at all
  - **15 HEAD requests per new domain is cheap, but the FALSE DISCOVERY rate could be high** — a `/changelog` path that exists but returns a product changelog (not API changelog) produces noise
  - **No one else has solved this.** Not changedetection.io, not Postman, not any tool I can find.
- **Confidence: LOW** — This is an unsolved problem being treated as a "15 HEAD requests" implementation task. Reality: most probes will return 404, and the ones that return 200 will often be wrong pages.
- **Biggest unknown:** What's the actual success rate? My estimate: <30% of arbitrary APIs will have a discoverable changelog at a well-known path. For the hardcoded 15-20 providers, this is irrelevant (profiles already include the URLs). For unknown domains, this feature will mostly fail silently.
- **Recommendation:** For MVP, skip discovery for unknown domains. Only use it for known providers where you've verified the URLs. Add discovery as V1.1 after collecting real user data on which URLs they monitor.

### 33. 🔴 Changelog keyword scanning
- **What:** Scan changelog HTML for breaking change keywords (50+ regex patterns) to generate early warning signals
- **How well specced:** PARTIALLY SPECCED — Bible §3.2 mentions it, Early Warning Implementation §3 has detailed keyword patterns. CHIRRI_REGEX_STRESS_TEST_V2 tested patterns against 55 real examples.
- **Validated:** PARTIALLY. The regex stress test achieved **82% accuracy** after improvements (from 56% in V1). But:
  - 82% means **~1 in 5 classifications is wrong**
  - The stress test used hand-picked examples. Real-world changelogs are messier.
  - "Action required" detection is consistently weak (many examples show ⚠️ Partial)
  - The regex approach fundamentally can't understand context — "we deprecated the old API" vs "we un-deprecated the old API" look the same to regex
- **What could go wrong:**
  - **False positives from non-API changelogs** — a product changelog mentioning "we removed the old pricing page" triggers "removal" patterns
  - **False negatives from subtle language** — "we've made some adjustments to the response format" doesn't match any urgency patterns
  - **HTML parsing inconsistency** — readability extraction may strip context needed for keyword scanning
  - **Added-content-only scanning requirement** — reliably detecting which sections are "new" in a changelog requires diffing the PREVIOUS version, which means storing changelog snapshots
  - **Date extraction** — chrono-node handles standard dates but many changelogs use relative dates ("next quarter", "later this year", "in the coming weeks") that are ambiguous
- **Confidence: LOW-MEDIUM** — The spec is detailed but 82% accuracy is not production-ready for a feature that generates user-facing alerts. 1 in 5 wrong alerts will destroy trust.
- **Biggest unknown:** Real-world false positive rate across diverse changelogs. The stress test used curated examples; actual changelogs include product updates, marketing copy, and non-technical content mixed with API changes.
- **Recommendation:** Ship as V1.1 with the LLM summarization that can provide context-aware analysis. Regex-only changelog scanning will generate too many false positives.

### 34. 🔴 LLM chirp summarization
- **What:** Use GPT-4o-mini to generate human-readable summaries of detected changes
- **How well specced:** HAND-WAVY — Bible §3.6 says "GPT-4o-mini, $0.003/call, cached per signal, template-based fallback." That's it.
- **Validated:** NOT VALIDATED. No prompt template. No output format constraints. No caching key strategy. No retry logic designed. No test results.
- **What could go wrong:**
  - **Hallucinations:** LLM says "this is a breaking change to the payments API" when it's actually a minor documentation update. Vectara's hallucination leaderboard shows even GPT-4o-mini hallucinates on summarization tasks.
  - **Cost at scale:** GPT-4o-mini is $0.15/1M input tokens, $0.60/1M output tokens. $0.003/call estimate assumes ~2K input + 500 output tokens. At 1000 changes/day = $3/day = $90/month. Fine for MVP but grows linearly.
  - **Latency:** GPT-4o-mini typically 1-3 seconds per call. If summarization is in the notification critical path, it adds seconds to alert delivery.
  - **No prompt engineering done.** Good prompts for API change summarization require iteration — what context to include, what output format to enforce, how to prevent hallucination on ambiguous changes.
  - **Caching key is undefined.** Cache by what — change_id? signal_type + content hash?
  - **Fallback behavior:** Spec says "template-based fallback" but no template is defined.
- **Confidence: LOW** — This is listed as MVP but has zero implementation detail. A developer would need to spend 2-3 days on prompt engineering alone.
- **Biggest unknown:** Whether LLM-generated summaries are actually better than template-based summaries for structured changes (JSON diffs). For "field X was removed," a template is perfect. LLM adds value only for unstructured content like changelog text.
- **Recommendation:** Ship MVP with template-based summaries only. Add LLM enhancement as V1.1 after testing prompts.

### 35. 🔴 Bundled bonus sources (changelog, status page, SDK)
- **What:** When user adds a known provider, automatically monitor its changelog, status page, and SDK in the background
- **How well specced:** FULLY SPECCED in concept — Bible §2.5-2.6, source types, check intervals, slot counting
- **Validated:** The DATABASE and API design is solid. The MONITORING of these sources is the problem:
  - **Changelog monitoring = HTML change detection** (see item 16, YELLOW) with all its false positive problems
  - **Status page monitoring** requires parsing diverse status page formats (Statuspage.io, Instatus, custom)
  - **SDK monitoring** requires npm/PyPI registry polling (straightforward but adds complexity)
- **What could go wrong:**
  - Bonus sources generate noise that drowns out actual API change signals
  - Status page "maintenance completed" events are not filtered from "maintenance starting" events
  - SDK major version bumps may not indicate breaking changes (some packages bump major for marketing)
  - Users get alerts about changelog updates that are irrelevant to their specific endpoints (the "relevance matching" that solves this is V1.1)
- **Confidence: LOW-MEDIUM** — The concept is the product's key differentiator, but the implementation of each source type is a mini-project. Without relevance matching (V1.1), bonus source alerts will be noisy.
- **Biggest unknown:** Signal-to-noise ratio of unfiltered bonus source alerts. Without relevance intelligence, a user monitoring `api.stripe.com/v1/charges` gets alerts about every Stripe changelog entry, even ones about Stripe Atlas.
- **Recommendation:** Ship known provider profiles with bonus source URLs populated but MUTED by default. Users opt-in to each source. Don't auto-alert on bonus sources until relevance matching ships.

### 36. 🔴 Jira Cloud / Linear / GitHub Issues integrations
- **What:** Create issues in project management tools when API changes are detected
- **How well specced:** HAND-WAVY — Bible §7.2 mentions "ADF conversion", "Arctic library", "OAuth 2.0" but provides NO OAuth flow steps, NO callback URL config, NO token refresh logic, NO API call specifications.
- **Validated:** NOT VALIDATED. No prototype. Each integration is a significant project:
  - **Jira:** OAuth 2.0 (3LO) with Atlassian → requires app registration, callback handling, token refresh, ADF document format for issue description
  - **Linear:** OAuth 2.0 + GraphQL API → requires GraphQL mutation knowledge, field mapping
  - **GitHub:** GitHub App installation → requires app creation, installation flow, REST API for issue creation
- **What could go wrong:**
  - OAuth token expiry and refresh failures → silent integration breakage
  - ADF (Atlassian Document Format) is complex — converting a change diff to ADF is non-trivial
  - Linear's GraphQL API has rate limits and pagination that differ from REST patterns
  - GitHub App installation flow requires organization-level permissions
  - Each integration is 4-6 days of work (Spec Audit estimate: 12-18 hours TOTAL for all three — this is significantly underestimated)
- **Confidence: LOW** — Three separate OAuth integrations with three different APIs, none of which are specced beyond one-line mentions. A developer would need to read Atlassian/Linear/GitHub docs independently.
- **Biggest unknown:** Whether the "Arctic" OAuth library actually supports all three providers cleanly, and whether token refresh works reliably long-term
- **Recommendation:** Cut from MVP entirely. Ship generic webhook (which works) and add PM integrations in V1.1. Users can use Zapier/Make as a bridge in the meantime.

### 37. 🔴 Data export
- **What:** Allow users to export their data (GDPR right of access)
- **How well specced:** HAND-WAVY — Bible §6.2 lists `GET /v1/account/export` and mentions "async for large accounts." Missing: export format, what's included, R2 signed URL generation, expiry, notification when ready.
- **Validated:** NOT VALIDATED. No format defined.
- **What could go wrong:** Large accounts with thousands of check results → export could be gigabytes → needs async processing, R2 storage, signed URL delivery
- **Confidence: LOW-MEDIUM** — Simple concept but no spec. A developer would have to design the entire feature.
- **Biggest unknown:** Export format (JSON? CSV? ZIP of both?) and what data to include
- **Recommendation:** Spec it (2 hours) or cut from MVP (offer manual export via support email for GDPR compliance)

### 38. 🔴 Real data only (public API feed for new users while monitors learn)
- **What:** Show new users real change data from a public API feed instead of empty states
- **How well specced:** PARTIALLY SPECCED — Frontend Bible §6.1-6.3 mentions it
- **Validated:** NOT VALIDATED. Requires:
  - A curated public feed of real API changes (who maintains this?)
  - API endpoint to serve this feed
  - UI logic to switch from public feed to user's own data once learning completes
  - Privacy considerations (showing other users' data patterns)
- **Confidence: LOW-MEDIUM** — Nice UX idea but adds complexity. Empty states with good copy work fine for MVP.
- **Biggest unknown:** Where the public feed data comes from and who curates it
- **Recommendation:** Ship with good empty state design and a learning progress indicator instead. Add public feed in V1.1.

---

## Critical Cross-Cutting Concerns

### SSE (Real-time) — 🟡 YELLOW
- **What:** Server-Sent Events for live dashboard updates
- **How well specced:** PARTIALLY — Bible mentions SSE `/v1/events` with event types but no auth strategy for SSE connections
- **Validated:** SSE is a proven technology but has scaling concerns:
  - HTTP/1.1 limits browsers to 6 concurrent connections per domain — SSE consumes one permanently
  - SSE connections are stateful and tied to a specific server instance — with multiple API server instances, needs Redis pub/sub for cross-instance delivery
  - One Node.js process can handle ~10K-28K concurrent SSE connections (per benchmarks), but Railway's single-instance hobby plan may not sustain this
  - Dev.to article from Feb 2025 argues "SSE is still not production ready after a decade" — specifically around connection management and error recovery
- **Confidence: MEDIUM** — Works fine at MVP scale (<1000 users). At scale, needs architectural attention.
- **Biggest unknown:** Railway's connection limit per service instance and whether SSE connections count against it

### SSRF Prevention — 🟢 GREEN (with caveat)
- **What:** Prevent malicious URLs from accessing internal infrastructure
- **Validated:** Well-researched in spec with 8-vector coverage. DNS pinning is the industry-standard defense.
- **Caveat:** DNS rebinding remains the primary bypass technique (multiple 2025 research papers confirm). The spec's approach (resolve DNS → validate IP → connect using resolved IP) is correct but requires the DNS resolution and connection to use the SAME resolved IP (DNS pinning). This is implemented via undici's `connect.lookup`.
- **Confidence: HIGH** — The approach is sound. The spec explicitly addresses DNS rebinding. But it should be pentested.
- **Biggest unknown:** Edge cases with IPv6-mapped IPv4 addresses and CGN (Carrier-Grade NAT) ranges

### Baseline Learning / False Positive Prevention — 🟡 YELLOW
- **How it works:** 30 checks at 20s intervals → fields changing in >50% of samples marked volatile → stableHash excludes volatile fields → 7-day calibration at normal interval → confidence threshold
- **What's the baseline?** Multiple snapshots during learning, distilled into a baseline with volatile field mask
- **What about daily-changing pages?** The 10-minute learning window catches per-request volatility (timestamps, request IDs) but NOT daily patterns (version numbers that update daily, "last updated" dates). The 7-day calibration period is supposed to catch these, but the spec doesn't define how calibration updates the volatile field mask.
- **False positive rate estimate:** Unknown. The spec claims the 6-layer FP defense system will handle it, but no layer has been tested against real API responses. CHIRRI_UNKNOWN_SOLUTIONS.md T-03 recommends a 14-day, 200+ URL extended test before claiming any FP rate.
- **Confidence: MEDIUM** — Sound design in theory. Completely unvalidated in practice. This is the make-or-break feature for the entire product.

### Webhook delivery (retry, DLQ) — 🟡 YELLOW  
- **Retry logic:** Specified (1m, 5m, 30m, 2h, 12h) in Bible §7.1
- **Dead letter:** `failed-jobs` queue with 7-day retention after max retries
- **If endpoint is down for 3 days:** After 5 retries over ~14.5 hours, delivery moves to DLQ. User is NOT notified that their webhook is failing. The spec mentions a `webhook_deliveries` table that tracks status, but there's no "your webhook is broken" notification.
- **Confidence: MEDIUM** — Retry logic is standard. Missing: notification to user when webhook delivery consistently fails.

### Better-auth + Hono + Drizzle + Neon — 🟡 YELLOW
- **Known issues:**
  - GitHub #3678 (Jul 2025): `@neondatabase/serverless` requires tagged-template syntax, breaking Drizzle integration with better-auth
  - GitHub #1163 (Jan 2025): `TypeError: undefined is not an object` with Drizzle adapter
  - GitHub #6766 (Dec 2025): Drizzle v1.0 new query syntax incompatible with better-auth
- **Mitigation:** Use `pg` driver (not `@neondatabase/serverless`), pin Drizzle to 0.x, test adapter during Week 1
- **Confidence: MEDIUM** — The combo is increasingly popular but has documented compatibility issues. Version pinning is critical.
- **Recommendation:** Build a minimal auth proof-of-concept in Week 1 Day 1 before committing to the full stack

### Provider Detection / Auto-Classification — 🟡 YELLOW
- **How it works for known providers:** Domain pattern matching (exact + wildcard). Reliable for the 15-20 hardcoded providers.
- **How it works for unknown providers:** Can't detect hosting provider (AWS/Vercel/Cloudflare) from HTTP headers reliably. Cloudflare proxies hide everything. Server headers can be spoofed.
- **What the spec actually does:** The spec doesn't try to detect hosting providers — it classifies CONTENT TYPE (JSON, HTML, RSS). This is much more feasible.
- **Confidence: MEDIUM** — Content-type classification is doable. Provider detection is limited to hardcoded profiles.

---

## Summary Table

| # | Feature | Confidence | Status |
|---|---------|-----------|--------|
| 1 | URL input + SSRF validation | 🟢 HIGH | Fully specced, well-researched |
| 2 | Auto-classification | 🟢 HIGH | Standard problem |
| 3 | JSON structural diffing | 🟢 HIGH | Mature library |
| 4 | 4-fingerprint detection | 🟢 HIGH | Simple algorithm |
| 5 | Confirmation recheck | 🟢 HIGH | Proven pattern |
| 6 | 4-level severity | 🟢 HIGH | Standard |
| 7 | 5-state workflow | 🟢 HIGH | Standard |
| 8 | Email (Resend) | 🟢 HIGH | Production-proven |
| 9 | Discord webhooks | 🟢 HIGH | Trivial integration |
| 10 | Slack webhooks | 🟢 HIGH | Trivial integration |
| 11 | Generic webhooks | 🟢 HIGH | Standard pattern |
| 12 | Email/password auth | 🟢 HIGH | With version pinning |
| 13 | API keys | 🟢 HIGH | Standard or plugin |
| 14 | Stripe billing | 🟢 HIGH | Well-trodden ground |
| 15 | Learning period | 🟡 MEDIUM | Unvalidated against real APIs |
| 16 | HTML diffing pipeline | 🟡 MEDIUM | Untested end-to-end |
| 17 | Response size anomaly | 🟡 MEDIUM | Spec gaps |
| 18 | Provider profiles (JSON) | 🟡 MEDIUM | Maintenance burden |
| 19 | Provider search | 🟡 MEDIUM-HIGH | Simple |
| 20 | Shared monitoring dedup | 🟡 MEDIUM-HIGH | URL normalization edge cases |
| 21 | Sunset/Deprecation headers | 🟡 MEDIUM-HIGH | Few APIs send these |
| 22 | Version header tracking | 🟡 MEDIUM-HIGH | Simple implementation |
| 23 | Confidence scoring | 🟡 MEDIUM | Arbitrary weights |
| 24 | Deadline countdown | 🟡 MEDIUM-HIGH | Depends on date parsing |
| 25 | Notes/Copy/Snooze | 🟡 MEDIUM-HIGH | Trivial |
| 26 | Notification rate limiting | 🟡 MEDIUM-HIGH | Standard |
| 27 | MCP server | 🟡 MEDIUM | Young ecosystem |
| 28 | Dashboard (full SPA) | 🟡 MEDIUM | 60-70h of work |
| 29 | Dark mode | 🟡 MEDIUM-HIGH | Touches everything |
| 30 | Plans + GDPR deletion | 🟡 MEDIUM-HIGH | Needs testing |
| 31 | Weekly stability report | 🟡 MEDIUM | Partially specced |
| 32 | **Discovery Service** | 🔴 **LOW** | **Unsolved problem** |
| 33 | **Changelog keyword scanning** | 🔴 **LOW-MEDIUM** | **82% accuracy not production-ready** |
| 34 | **LLM chirp summarization** | 🔴 **LOW** | **No implementation detail** |
| 35 | **Bundled bonus sources** | 🔴 **LOW-MEDIUM** | **Noisy without relevance matching** |
| 36 | **Jira/Linear/GitHub** | 🔴 **LOW** | **3 unspecced OAuth integrations** |
| 37 | **Data export** | 🔴 **LOW-MEDIUM** | **No format defined** |
| 38 | **Real data for new users** | 🔴 **LOW-MEDIUM** | **Who curates the feed?** |

---

## Where a Developer Would Get Stuck (Day by Day)

### Day 1: Foundation
- ✅ Can set up Hono + Drizzle + better-auth (if version-pinned and tested)
- ⚠️ Might hit better-auth + Drizzle adapter issue immediately
- ✅ Can create database tables from Bible §5.2

### Day 3: Check Engine
- ✅ Can build safeFetch with SSRF protection
- ✅ Can implement BullMQ queues
- ⚠️ Learning period: will build it to spec but can't validate FP rate

### Week 2: Change Detection
- ✅ JSON diffing works (jsondiffpatch)
- ⚠️ HTML diffing: will build pipeline but FP rate unknown
- 🛑 Discovery service: "probe 15 paths" — what 15 paths? No list in spec
- 🛑 Changelog scanning: 82% accuracy — ship it? or redesign?

### Week 3: Early Warning + Notifications
- ✅ Header parsing is straightforward
- 🛑 LLM summarization: no prompt, no template, no caching strategy — stuck for 2-3 days
- ✅ Email/Discord/Slack webhooks are simple

### Week 4: Dashboard
- ⚠️ Monaco DiffEditor + Vite: 2-3 days of integration work
- ⚠️ Tree view at scale: needs performance testing
- 🛑 "Real data for new users" — where does this data come from?

### Week 5: Integrations + Billing
- ✅ Stripe is well-documented
- 🛑 Jira OAuth: needs to read Atlassian docs from scratch, 4-6 days per integration
- 🛑 Linear OAuth: same
- 🛑 GitHub App: same
- 🛑 Data export: no format defined

---

## Top 5 Recommendations

1. **Cut Jira/Linear/GitHub from MVP.** Save 2-3 weeks. Ship generic webhook. Users can bridge with Zapier.

2. **Cut LLM summarization from MVP.** Ship template-based summaries. Add LLM in V1.1 after prompt engineering.

3. **Cut Discovery Service for unknown domains from MVP.** Only use pre-verified URLs in provider profiles. Add auto-discovery in V1.1.

4. **Mute bonus sources by default.** Don't auto-alert on changelogs/status pages until relevance matching ships. Let users opt-in.

5. **Prototype the learning period against 50+ real APIs before committing.** This is the core product — if the FP rate is >5%, nothing else matters.

---

*Audit complete: 2026-03-24*  
*The spec is impressively thorough. The risks are concentrated in the intelligence layer (changelog scanning, LLM, discovery) and the PM integrations. The core monitoring engine (JSON diff, fingerprinting, notifications) is solid and buildable.*
