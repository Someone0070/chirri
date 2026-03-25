# Chirri Bible — Product & Design Review

**Reviewer:** Senior developer perspective
**Date:** 2026-03-24
**Document reviewed:** CHIRRI_BIBLE.md v2.0
**Framing:** This is a product spec review, not a code review. The question is: "Does the design hold together? Are there logical impossibilities, hidden contradictions, or features that sound good but collapse under scrutiny?"

---

## Overall Assessment

This is an exceptionally thorough product Bible. The level of detail on edge cases (DNS rebinding, TOCTOU race conditions, signal polarity reversals) is rare in a spec document. The document is internally consistent to a degree that suggests careful contradiction-resolution work already happened.

That said, there are design-level issues worth surfacing. None are fatal, but several would force hard decisions during implementation that the Bible currently defers or doesn't acknowledge.

---

## 1. Issues That Would Force Design Rethinking

### 1.1 The Authentication Paradox for API Monitoring

**The problem the Bible doesn't address:** Most third-party APIs require authentication. Stripe's `/v1/charges` returns 401 without an API key. The Bible describes monitoring "any API you depend on" but the entire pipeline — learning period, fingerprinting, structural diffing — assumes Chirri can GET the endpoint and receive a meaningful response.

The `auth_required` status exists (Section 2.8, Step 10 in the URL table), and `headers` JSONB exists on the `urls` table, but the Bible never addresses:

- **How does a user provide credentials?** The URL table has a `headers` field, but the implications aren't discussed. If a user pastes their Stripe secret key into a `headers` field, Chirri is now storing third-party API credentials. That's a massive security surface the Security section (Part 8) never mentions.
- **Credential rotation:** When the user rotates their Stripe key, every monitor using it breaks silently. No mechanism described.
- **What percentage of real-world use cases need auth?** If it's >50%, the "paste a URL and go" value prop partially collapses. If it's <10% (public endpoints, OpenAPI specs, changelogs), then the `headers` field is a V1.1 concern and should be called out as such.

**Recommendation:** The Bible should explicitly state whether MVP monitors authenticated endpoints or only public ones. If authenticated: the security implications need a dedicated section. If public-only: say so, and explain why the value prop still works (most of the *interesting* monitoring is on public artifacts — OpenAPI specs, changelogs, status pages, not the endpoints themselves).

### 1.2 The "Monitor Any API" vs "Known Providers" Tension

The Bible describes two very different products:

1. **Generic URL monitor:** Paste any URL, Chirri figures it out via auto-classification, learns volatile fields, diffs responses. Works for unknown APIs.
2. **Provider intelligence platform:** Type "Stripe," get bundled monitoring of changelog + OpenAPI spec + status page + SDK. Smart chirp with relevance matching. Escalation with evidence accumulation.

Product #2 is dramatically more valuable and differentiated. Product #1 is a commodity (changedetection.io does this for $8.99/mo with 22K GitHub stars).

The tension: The Bible treats both as equal MVP features. But the generic monitor needs the learning period, volatile field detection, and confirmation pipeline — that's where 80% of the false-positive complexity lives. The provider intelligence system is where 80% of the *value* lives.

**This isn't a contradiction, but it's a strategic question the Bible sidesteps:** If you ship with 15-20 provider profiles and generic monitoring, will users primarily use the generic path (where the product is weakest) or the provider path (where it's strongest)? The onboarding UX should steer hard toward known providers.

### 1.3 The Shared Monitoring / Personal Baseline Contradiction

Section 2.8 describes shared monitoring: "One HTTP request at highest subscriber frequency." But the learning period (Section 2.7) produces per-URL volatile field lists, and baselines (Section 5.2) are keyed to `shared_url_id`.

**The logical issue:** If User A and User B both monitor `api.stripe.com/v1/charges`, they share one `shared_url` and one `baseline`. But what if User A sends custom headers that produce a different response shape than User B's plain GET? The `urls` table has per-user `headers` and `method` fields, but `shared_urls` has neither.

The shared URL key is `SHA-256(normalized URL)` (D.1) — method and headers are explicitly excluded for MVP. This means:
- Two users monitoring the same URL with different auth headers get the SAME shared check
- Only one set of headers can be used for the actual HTTP request
- The Bible doesn't specify whose headers "win"

**This is fine if MVP is public-only,** but the Bible doesn't say that. If custom headers are supported, the sharing model breaks.

### 1.4 POST Monitoring Is Underspecified

The `urls` table allows `method IN ('GET', 'POST')` and has a `body` field. But:

- POST requests are not idempotent. Sending a POST every hour to someone's API could create records, trigger side effects, or get the account banned.
- The learning period does 30 checks in 10 minutes. 30 POSTs in 10 minutes to a third-party API is aggressive.
- POST responses are often unique per request (created resource IDs, timestamps), making the volatile field problem much worse.

The Bible includes POST support in the schema but never discusses the implications. This feels like a schema field that was added for completeness but shouldn't ship in MVP.

**Recommendation:** Either remove POST from MVP (change the CHECK constraint to just 'GET') or add a section explaining the guardrails.

---

## 2. Features That Sound Good But Have Hidden Complexity

### 2.1 Smart Chirp Relevance Matching

The 3-layer relevance engine (Section 3.3) is the most ambitious feature in the spec. It extracts paths, versions, and products from signal text via regex, then matches against each user's monitored URLs.

**The design concern:** This works beautifully for the examples in the Bible (Stripe deprecating `/v1/charges`). But most real-world changelog entries don't mention specific paths:

- "We've updated our authentication flow" → Which endpoints?
- "Performance improvements to our core API" → Relevant to everyone or no one?
- "New rate limits for free tier accounts" → Path-independent

The Bible's relevance engine has a `service-wide` match (score 0.70) as the catch-all. In practice, most changelog entries will hit this bucket, meaning most bonus source alerts go to everyone — defeating the purpose of "smart" chirping.

**This isn't a design flaw,** but the Bible should acknowledge that relevance matching will be fuzzy for most providers and set expectations accordingly. The fallback behavior (service-wide = score 0.70) is reasonable; the spec just oversells the precision.

### 2.2 Forecast Deduplication Across Signal Types

Section 3.9 describes dedup keys: `SHA-256(provider_slug + ":" + direction + ":" + target_path + ":" + deadline_month)`.

**The problem:** `target_path` is extracted via regex from natural language text. A changelog saying "the Charges API" and a Sunset header on `/v1/charges` produce different `target_path` values unless the extraction is very smart. The dedup key is only as good as the path normalization.

If dedup fails, users get 3 separate forecasts for the same event — exactly what the feature is designed to prevent. If dedup is too aggressive, unrelated signals get merged.

**Recommendation:** The Bible should acknowledge that dedup will be imperfect at launch and describe the failure mode (duplicate forecasts are annoying but not dangerous; false merges could hide real signals). Conservative dedup (allow some duplicates) is the safer default.

### 2.3 The "Undeletable Roots" UX Question

"You can't rip out the roots of a tree." Bonus sources can be muted but not deleted (Section 1.6, Appendix A #27).

**The design concern:** This is philosophically elegant but practically frustrating. If a user monitors one Stripe endpoint and gets a changelog, OpenAPI spec, status page, and SDK source permanently attached, their dashboard has 5 items where they added 1. Multiply by 10 providers = 50 items, 40 of which they never asked for and can't remove.

Muting prevents notifications, but the visual clutter in the tree view remains. The UX of "things you can't delete" tends to breed resentment, even if the design rationale is sound.

**This isn't necessarily wrong,** but the dashboard design needs to handle it gracefully (collapsed by default, hidden behind a toggle, etc.). The Bible's tree view mockup (Section 11.1) shows roots as small `[link]` items, which is probably fine — but this should be explicitly called out as a UX risk to validate with real users.

### 2.4 Email Verification + Instant Value Tension

Section 8.5 says unverified users get 1 URL (to allow instant "aha moment"), but full Free tier (3 URLs) requires verification. After 72h without verification, monitoring pauses.

**The tension:** The learning period takes 10 minutes (rapid) + 7 days (calibrating). If a user signs up, adds 1 URL, and doesn't verify email within 72h, their monitor gets paused mid-calibration. When they verify on day 4, does calibration resume or restart? The Bible says paused <30 days resumes with existing baseline (Section 2.11), but calibration state is different from active monitoring state.

This is a minor edge case, but it touches three different systems (auth, learning period, pause/resume) and the interaction isn't specified.

---

## 3. Internal Consistency Issues

### 3.1 Free Tier: Bundled Sources Per Provider

Section 4.1 says Free tier gets "3 per provider" bundled sources. Section 2.5 says the default bundle is 4 sources (OpenAPI spec, changelog, status page, primary SDK). Section 4.1 also says Free tier gets "no status page monitoring."

**So the Free tier bundle is:** changelog + OpenAPI spec + SDK = 3? That's consistent, but it's implicit. The Bible should state which 3 sources Free users get, since status page is excluded.

### 3.2 Confirmation Recheck + Critical Severity

Section 2.8 Step 9 says: "Stage 1 (5 seconds): recheck URL. Critical = alert NOW."

But Section 2.7 says: "During calibration, if a high-severity change is detected (status code 5xx, endpoint returning 404), it OVERRIDES the 95 confidence threshold and alerts immediately."

**Question:** Does "critical = alert NOW" in confirmation recheck mean skipping Stage 2 entirely? Or does it mean sending a preliminary alert while Stage 2 runs? The difference matters: if you skip Stage 2, you might alert on a 5-second CDN glitch. If you alert immediately BUT also run Stage 2, what happens if Stage 2 shows reversion? Do you send a "never mind" notification?

The Bible describes confirmation states (pending → stage1_confirmed → stage2_confirmed → confirmed/reverted/unstable) but doesn't specify the notification behavior for the "critical, skip Stage 2" path.

### 3.3 Webhook Deliveries: "Don't Retry 4xx" vs Auto-Disable

Section 8.10 says "Don't retry 4xx errors (except 429)." Section 7.1 says "Auto-disable after 3 consecutive days of failures."

**Are 4xx responses counted as "failures" for auto-disable purposes?** If yes, a webhook endpoint returning 400 (bad request, maybe due to a payload format issue) gets auto-disabled after 3 days. If no, what's a "failure" — only 5xx and timeouts?

### 3.4 Two D.8 Sections

Appendix D has two sections numbered D.8 (Graceful Shutdown and Real-Time Dashboard Updates). Minor numbering issue.

---

## 4. Missing Design Decisions

### 4.1 Multi-Region / Geo Considerations

The Bible describes a single Railway deployment. But:

- Checking an API from US-East when the API has different behavior per region isn't discussed
- Users in different timezones get different check-from locations? Or all from one region?
- CDN-cached API responses may differ by edge location — this could cause false positives when Chirri's check hits a different edge than the user's app

This doesn't need to be solved for MVP, but it should be acknowledged as a known limitation.

### 4.2 What Happens When a Provider Profile Is Wrong?

The 15-20 hardcoded provider profiles include specific URLs (changelog URL, OpenAPI spec URL, status page URL). These URLs can change. When Stripe moves their changelog from `/docs/changelog` to `/changelog`, every Stripe provider profile breaks.

**Who fixes this?** How quickly? Is there a fallback? The Bible doesn't describe a provider profile update mechanism beyond "hardcoded JSON file."

### 4.3 Rate Limiting From Target APIs

Chirri makes outbound requests to third-party APIs. Those APIs have their own rate limits. If 1,000 users monitor different Stripe endpoints, shared monitoring dedup means 1 check per unique URL — but Stripe might have 50+ unique endpoints being monitored, meaning 50+ requests to api.stripe.com per check cycle.

The domain rate limit (1 req/sec, max burst 3) helps, but at 50 endpoints checked every hour, that's ~1 request/minute to a single domain, continuously. If Stripe's rate limit is more restrictive (or if they flag the behavior as scraping), there's no fallback described.

### 4.4 OpenAPI Spec Diffing Is Hash-Only in MVP

Section 2.4 says OpenAPI specs use `content-hash` in MVP, with `spec-diff` deferred to V1.1. But the Early Warning System (Part 3) says OpenAPI `deprecated:true` field detection is an MVP signal type.

**The tension:** Content-hash can tell you the spec CHANGED but can't tell you WHERE. To detect `deprecated:true` on a specific path, you need structural diffing — which is explicitly V1.1.

Either the OpenAPI `deprecated:true` signal is V1.1 (not MVP), or the monitoring method for OpenAPI specs needs to be more than hash-only even in MVP (at least JSON parse + field scanning, if not full structural diff).

### 4.5 Test Mode Scope

Section D.11 says `ck_test_` keys return "synthetic/mock responses" and don't make real HTTP requests. But the MCP server (D.7) uses API keys for auth.

**What does test mode mean for MCP?** If an AI agent uses a test key, `chirri_check_now` returns fake data. `chirri_get_changes` returns fake changes. Is that useful for anything? The Bible doesn't describe what test mode is *for* — is it for integration testing? Demo purposes? Staging environments?

---

## 5. Things That Are Surprisingly Well-Designed

Worth calling out what works, not just what doesn't:

1. **The shared monitoring dedup model** is elegant. One HTTP request per unique URL regardless of subscriber count, with fan-out per user. The cost analysis ($0.03/mo per provider) is credible.

2. **The 4-fingerprint system** (fullHash → stableHash → schemaHash → headerHash) is a clever cascade. 90% of checks short-circuit at fullHash with zero diffing cost.

3. **The confirmation recheck pipeline** (5s + 30min) is a pragmatic balance between speed and false-positive prevention. Most monitoring tools either alert instantly (noisy) or wait too long (slow).

4. **Signal polarity (reversals)** in the escalation system. Most specs wouldn't think to handle "provider reversed their deprecation." The 2x negative weight is a good heuristic.

5. **The "nothing happened" churn risk** acknowledgment (Section 10.1 #2). Most monitoring tools don't address the psychological problem of paying for silence. Weekly stability reports and tree health indicators are thoughtful solutions.

6. **Notification rate limiting per plan** with domain+severity granularity. This prevents the "100 alerts in 5 minutes" scenario that kills trust in monitoring tools.

7. **The copy-as-markdown feature** is a small thing but shows understanding of the workflow. Developers don't want to manually write Jira tickets about API changes.

---

## 6. What Would Take the Longest to Get Right (Design-Wise)

### 6.1 The Learning Period Tuning

The 50% threshold for volatile fields (Section 2.7) is a number that will need empirical validation. Too low = real changes get classified as volatile. Too high = volatile fields cause false positives. The Bible picks 50% and moves on, but this single parameter controls the entire false-positive rate for generic monitoring.

### 6.2 The Early Warning System End-to-End

Parts 3.1 through 3.9 describe a system with ~15 interacting components: signal detection, confidence scoring, relevance matching, deduplication, escalation, evidence accumulation, deadline tracking, reminder scheduling, forecast lifecycle, and re-notification rules. Each is well-specified in isolation, but the integration surface is enormous. This is where most of the "it sounded right in the spec" bugs will live.

### 6.3 The Provider Profile Maintenance Burden

15-20 profiles at launch is manageable. But each profile has specific URLs that need to remain accurate, source types that need to match reality, and domain patterns that need to stay current. This is ongoing operational work, not a build-once feature. The Bible doesn't discuss who maintains profiles or how often they're validated.

---

## 7. Summary of Recommended Clarifications

| # | Issue | Severity | Recommendation |
|---|---|---|---|
| 1 | Auth for monitored endpoints | **High** | Explicitly state whether MVP monitors authenticated endpoints |
| 2 | Shared URL + custom headers conflict | **High** | Define sharing behavior when users have different headers |
| 3 | POST monitoring implications | **Medium** | Remove from MVP or add guardrails section |
| 4 | OpenAPI deprecated:true vs hash-only | **Medium** | Clarify whether this signal is MVP or V1.1 |
| 5 | Critical severity + confirmation recheck flow | **Medium** | Specify notification behavior for critical-skip-Stage-2 path |
| 6 | Free tier bundled source list | **Low** | State which 3 of 4 default sources Free users get |
| 7 | Email verification + calibration interaction | **Low** | Specify resume behavior for paused-during-calibration |
| 8 | Provider profile maintenance | **Low** | Acknowledge as ongoing operational concern |
| 9 | 4xx webhook failure counting | **Low** | Clarify for auto-disable logic |
| 10 | Test mode purpose | **Low** | State the intended use case |
| 11 | Appendix D numbering | **Trivial** | Fix duplicate D.8 |

---

## Verdict

The Bible is internally consistent to an impressive degree. There are no logical impossibilities — every feature described *can* work. The five issues flagged as High/Medium severity are design ambiguities, not contradictions. They're the kind of thing that would surface in week 2 of implementation and force a decision that should have been made in the spec.

The document's greatest strength is its honesty about complexity (the Known Risks section, the compound failure scenarios, the explicit "accepted ambiguity" callouts). Its greatest risk is scope: this is an enormous amount of product for MVP, and the Early Warning System alone could consume months of iteration to get the signal-to-noise ratio right.

The spec is ready for implementation planning. The clarifications above should be resolved before writing the first line of code, but none of them require fundamental rethinking.
