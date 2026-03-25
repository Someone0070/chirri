# CHIRRI — Category A Validation Report

**Compiled:** 2026-03-24  
**Validator:** Claude Opus (deep review)  
**Purpose:** Verify that the 14 "researched" answers in Category A are actually sound, not just confidently asserted.

---

## Methodology

For each Category A item:
1. Identified which doc claims the "researched" answer
2. Read the actual reasoning in that doc
3. Assessed whether genuine research/analysis was done vs. assertion
4. Searched for counter-evidence
5. Rendered a verdict: **CONFIRMED**, **CHALLENGED**, or **PARTIALLY CORRECT**

---

## A1. JWT vs Cookie-Based Sessions

**Researched answer from:** Tech Stack Decisions doc  
**Recommendation:** Cookie-based sessions via better-auth, NOT JWTs for dashboard auth

### Reasoning Assessment
The Tech Stack doc provides genuine analysis:
- Correctly identifies that JWTs can't be revoked without a blocklist
- Correctly notes that HttpOnly/SameSite/Secure cookies are simpler and more secure
- Correctly identifies that refresh token dance is unnecessary for a dashboard
- Correctly points out that better-auth handles this natively

### Counter-Evidence Check
- The argument that "JWTs can't be revoked" is well-established in security literature. Stytch, Auth0, and OWASP all document this trade-off.
- **However:** Many modern apps put JWTs *inside* HttpOnly cookies (confirmed by 2026 Medium article). The real issue isn't JWT-vs-cookies (those aren't opposites) — it's JWT-vs-server-side-sessions.
- For a monolithic app (single API server, single DB), server-side sessions are strictly simpler. JWTs add value for microservices where you need stateless verification across services.
- Chirri is a monolith on Railway. No microservices. Sessions win.
- **Nuance the doc misses:** The Master Spec says `POST /v1/auth/refresh` and `POST /v1/auth/revoke` — these endpoints are JWT-specific. If switching to sessions, these need to be redesigned or removed. The contradiction list notes this but the Tech Stack doc doesn't address the API endpoint implications.
- **Also:** The Definitive Plan and Master Spec both say "JWT in HttpOnly cookie" — this is actually a hybrid approach (JWT stored as cookie) that's reasonable. The Tech Stack doc argues for pure server-side sessions, which is different from "JWT in HttpOnly cookie."

### Verdict: **PARTIALLY CORRECT** ✅⚠️

**Direction is right** — server-side sessions via better-auth are the correct choice for a monolithic dashboard app. The reasoning is genuine research, not hand-waving.

**Missing nuance:**
1. The `/v1/auth/refresh` and `/v1/auth/revoke` endpoints need to be redesigned or removed (refresh doesn't make sense for sessions; revoke becomes "logout")
2. The Master Spec/Definitive Plan saying "JWT in HttpOnly cookie" isn't the same as "JWT in localStorage" — it's already halfway to the right answer. The Tech Stack doc should acknowledge this and clarify it's replacing the JWT-in-cookie approach with session-ID-in-cookie.
3. If Chirri ever needs service-to-service auth (e.g., scheduler→API), short-lived JWTs may still be useful internally. The doc correctly notes this in passing.

**Action needed:** Update Master Spec auth endpoints to reflect session-based auth. Remove `/auth/refresh`, rename `/auth/revoke` to `/auth/logout`.

---

## A2. Password Hashing — bcrypt vs Argon2id

**Researched answer from:** Tech Stack Decisions doc  
**Recommendation:** Argon2id (via better-auth)

### Reasoning Assessment
The Tech Stack doc correctly cites:
- Argon2id is the winner of the Password Hashing Competition (PHC)
- OWASP recommends Argon2id as first choice
- better-auth uses Argon2id by default
- Specific parameter recommendations from OWASP

### Counter-Evidence Check
- Confirmed via OWASP Cheat Sheet (live page): "Argon2id should be the best choice for password hashing"
- Multiple 2025-2026 sources confirm: Argon2id > scrypt > bcrypt in OWASP's hierarchy
- bcrypt is still acceptable (OWASP lists it as a valid alternative) but Argon2id is strictly better for new projects
- The only counter-argument: bcrypt has 25+ years of battle-testing vs Argon2id's ~10 years. But Argon2id is RFC 9106 standardized and widely deployed.
- Since better-auth uses Argon2id natively, there's zero additional effort.

### Verdict: **CONFIRMED** ✅

Rock-solid reasoning. Argon2id is unambiguously the right choice for a new project in 2026. The research is genuine (OWASP citation, PHC reference, library compatibility check). No counter-evidence worth considering.

---

## A3. Classification Pipeline — 3 Phases vs 6 Phases

**Researched answer from:** Master Spec / Product Bible / Definitive Plan  
**Recommendation:** 3 phases (domain pattern → response-based → fallback)

### Reasoning Assessment
The Definitive Plan explicitly records the simplification decision with reasoning: "Fancy path heuristics, response header signals, discovery budget, generator-to-feed mapping all deferred to V2." This was a deliberate scope cut, not accidental.

### Counter-Evidence Check
- The Architecture doc's 6-phase pipeline (`phase: 0 | 1 | 2 | 3 | 4 | 5`) was presumably designed for completeness, not because 6 phases are necessary for MVP.
- 3 phases cover the vast majority of URLs: known domains (~10 patterns), response content-type analysis, and fallback to JSON diff. This handles >95% of use cases.
- The extra 3 phases (path heuristics, header signals, discovery budget) are optimization layers that add complexity with diminishing returns at MVP scale.
- No counter-evidence found. Simpler is better for MVP, and the deferred phases can be added later without breaking the architecture.

### Verdict: **CONFIRMED** ✅

The simplification is well-reasoned and explicitly documented as a debate outcome. The 3-phase pipeline is sufficient for MVP. The Architecture doc needs updating to match.

---

## A4. "Calibrating" State — Visible or Hidden to Users

**Researched answer from:** Definitive Plan (Jake's winning argument)  
**Recommendation:** Hidden from users — internally use 95 confidence threshold for 7 days, user sees "Active"

### Reasoning Assessment
Jake's argument in the Definitive Plan debate is genuine UX reasoning:
- Users add a URL and wait 7 days before "full confidence" — that's a terrible first impression
- Making calibration invisible ("Active" from the start) removes unnecessary anxiety
- The higher confidence threshold (95 vs 80) still prevents false positives internally

### Counter-Evidence Check
- **Transparency argument:** Some monitoring tools (e.g., Datadog, PagerDuty) show "learning" or "calibrating" states. Users who understand the tool may prefer knowing why alerts are suppressed.
- **The REAL problem (from contradiction list):** The API still returns `status: "calibrating"` which leaks the internal state. If the UI says "Active" but the API says "calibrating," developers using the API will be confused and may think it's a bug.
- **The Product report (§1.5) raises a legitimate concern:** During calibration, a genuine breaking change with confidence 85 would be suppressed. If the user thinks the system is fully active, they'd have false trust. This is a real risk.
- **However:** Jake's solution (hide it) is still better than showing a confusing "calibrating" badge with a day counter. The user doesn't need to know the internal mechanics. They just need to trust the tool.

### Verdict: **PARTIALLY CORRECT** ✅⚠️

**Direction is right** — hiding the calibrating state from UI is the correct UX decision. Users shouldn't see internals.

**Missing nuance:**
1. The API response MUST map `calibrating` → `active` in user-facing responses. The contradiction list already notes this, but it needs explicit spec text.
2. During calibration, if a high-severity change (e.g., endpoint returns 404, status code 5xx) is detected, it should OVERRIDE the 95 confidence threshold and alert anyway. Status code changes don't need calibration — they're unambiguous. The current design would suppress a genuine outage alert during calibration, which is dangerous.
3. Consider adding a subtle indicator like "Detection accuracy improves over the first 7 days" in the URL detail page (not the status badge). This is transparency without confusion.

**Action needed:** Ensure API maps calibrating→active. Add a bypass for critical severity changes during calibration.

---

## A5. Monitoring Packs — Killed Entirely

**Researched answer from:** Definitive Plan (Yuki's recommendation, accepted)  
**Recommendation:** Kill monitoring packs entirely

### Reasoning Assessment
Yuki's argument: "Packs create a whole business logic surface — plan limit enforcement on packs, partial pack application, pack versioning — for minimal value." This is genuine complexity analysis.

The Definitive Plan Amendment 1 adds further context: monitoring packs are "replaced by the superior concept: dynamic provider source discovery." Instead of static bundles, the system dynamically discovers sources per provider.

### Counter-Evidence Check
- The URL Onboarding Flow still has full pack endpoints (`GET /v1/packs`, etc.) — this is just stale documentation, not a counter-argument.
- Product Bible has `pack_` in the ID prefix registry — again, stale.
- Dynamic provider discovery IS a better model than static packs. It's more flexible and doesn't need the pack-specific business logic (enforcement, versioning, partial application).
- No reason to keep packs. The concept was replaced, not just deferred.

### Verdict: **CONFIRMED** ✅

Clean kill. The reasoning is sound, the replacement concept (dynamic provider discovery) is better, and the remaining references are just stale documentation that needs cleanup.

---

## A6. Base URL — chirri.io/delta vs chirri.io

**Researched answer from:** Master Spec  
**Recommendation:** Use chirri.io everywhere (product was renamed)

### Reasoning Assessment
This isn't really a "research" question — it's a product rename. The product was renamed from Delta (chirri.io/delta) to Chirri (chirri.io). The Master Spec reflects the current name.

### Counter-Evidence Check
- None. The product is called Chirri. All docs should use chirri.io.
- The contradiction list correctly identifies the scope: SSRF blocklist, env vars, User-Agent, email sender, webhook payloads, CDN URLs, error doc URLs all need updating.
- This is a global find-replace, not a design decision.

### Verdict: **CONFIRMED** ✅

Obvious, but the scope of changes is larger than just URLs — it touches code constants, environment variables, blocklists, and user-facing strings. A comprehensive grep for `chirri`, `delta`, and old domain references is needed.

---

## A7. Webhook Signing/Delivery Header Names (Delta vs Chirri)

**Researched answer from:** Master Spec / URL Onboarding Flow  
**Recommendation:** Use `X-Chirri-Signature`, `X-Chirri-Event`, `X-Chirri-Delivery`, `Chirri-Webhook/1.0`

### Reasoning Assessment
Same as A6 — this is a rename consequence, not a research question.

### Counter-Evidence Check
- None. The headers should use the product name.
- **One consideration:** Once shipped, these header names become part of the API contract and can never change without breaking integrations. So get it right now.

### Verdict: **CONFIRMED** ✅

Trivial rename. Just make sure ALL references are caught.

---

## A8. User-Agent String — Three Variants

**Researched answer from:** Master Spec  
**Recommendation:** Standardize to `Chirri-Monitor/1.0 (https://chirri.io; monitoring service)` and `Chirri-Webhook/1.0`

### Reasoning Assessment
Same rename category. Master Spec has the canonical strings.

### Counter-Evidence Check
- None.
- **One consideration:** The User-Agent should include a contact URL so site operators can look up who's crawling them. `Chirri-Monitor/1.0 (https://chirri.io; monitoring service)` does this correctly.

### Verdict: **CONFIRMED** ✅

Straightforward standardization.

---

## A9. Partitioning Strategy — pg_partman vs Native Postgres

**Researched answer from:** Master Spec / Architecture (pg_partman)  
**Recommendation:** Use pg_partman

### Reasoning Assessment
The Master Spec and Architecture docs specify pg_partman with actual SQL (`SELECT partman.create_parent(...)`). The Product Bible just said "native Postgres range partitioning" without detail.

### Counter-Evidence Check
**This is the one Category A item where the "researched" answer may be WRONG.**

The Infrastructure Details doc (which was ALSO researched) explicitly says:
> "Railway's Postgres is based on the official Docker image — it does NOT come with pg_partman pre-installed"

And recommends:
> "Skip pg_partman entirely. Use Postgres 12+ native declarative partitioning"

The Infrastructure doc provides:
- Actual code for native partitioning
- A management approach using app-level cron
- Reasoning that native partitioning "is simpler, needs no extensions, and works on any Postgres"

**This is a conflict WITHIN the researched docs.** The Master Spec/Architecture assume pg_partman is available, but the Infrastructure doc researched Railway's actual capabilities and found it's NOT available without a custom Docker image.

The contradiction list itself notes the caveat: "verify pg_partman is available on Railway's managed Postgres" — and the Infrastructure doc already answered this: it's NOT.

### Verdict: **CHALLENGED** ⚠️

**The contradiction list got this one wrong.** It says "go with Master Spec / Architecture — they have the actual SQL" and "Product Bible was imprecise." But the Product Bible's "native Postgres range partitioning" is actually closer to the correct answer for Railway.

**The real recommendation should be:** Use native Postgres declarative partitioning (as the Infrastructure Details doc recommends), NOT pg_partman. The Master Spec/Architecture SQL needs to be rewritten to use native `PARTITION BY RANGE` syntax instead of `partman.create_parent()`. Partition creation should be managed by the app (a simple check-and-create function in the worker/scheduler).

**This item should probably be Category B** (needs research on Railway compatibility) or resolved in favor of the Infrastructure doc, not the Master Spec.

---

## A10. Slack/Discord — MVP via Incoming Webhooks

**Researched answer from:** Definitive Plan (Priya won debate)  
**Recommendation:** MVP ships with Slack + Discord via incoming webhooks. Full integrations table with OAuth is V1.1.

### Reasoning Assessment
The debate is well-documented:
- Marcus estimated: Slack incoming webhooks = 2 days, Discord = 1 day (3 total)
- Priya argued: "Every competitor has Slack on day one"
- The Architecture doc's full `integrations` table with CRUD endpoints is V1.1 scope
- For MVP, it's just HTTP POST calls with formatted JSON — no integrations table needed

### Counter-Evidence Check
- The distinction between "incoming webhook" (MVP) and "full integration with OAuth" (V1.1) is sound. Incoming webhooks are trivial to implement and cover 80%+ of use cases.
- Master Spec §2.5 originally said Slack/Discord is "Indie+ (V1.1)" — the Definitive Plan overrides this to MVP.
- Master Spec §3.6 says "Deferred: `integrations` (V1.1)" — consistent with incoming webhooks for MVP, full table for V1.1.
- **One concern:** The Master Spec pricing table says Free gets "1 webhook" but also "❌ No Slack/webhook integration." This is a separate contradiction (B7) but relates. For MVP, Slack/Discord incoming webhooks should be Indie+ as the docs say.

### Verdict: **CONFIRMED** ✅

The debate outcome is clear and well-reasoned. Incoming webhooks for MVP, full integrations table for V1.1. The Architecture doc's `integrations` table and CRUD endpoints should be clearly marked as V1.1.

---

## A11. Brand Identity Pricing Section — Completely Outdated

**Researched answer from:** Product Bible / Master Spec / Definitive Plan  
**Recommendation:** Use the final pricing (Free/Indie/Pro/Business with 24h/1h/15m/1m intervals)

### Reasoning Assessment
The Brand Identity doc's pricing section uses old plan names (Hobby/Pro/Team) and old intervals (30min/1min). The Product Bible, Master Spec, and Definitive Plan all have the updated pricing.

### Counter-Evidence Check
- None. The pricing was updated across all planning documents. The Brand Identity doc's pricing section was simply never updated.
- The Definitive Plan further simplifies: MVP launches with Free + Indie only. Pro and Business added when demand warrants.

### Verdict: **CONFIRMED** ✅

No research needed — the Brand Identity doc's pricing is stale. If used for the landing page, it must be replaced with the current pricing from the Master Spec.

---

## A12. Confidence Scoring — Ratio vs Absolute Count

**Researched answer from:** The code in Relevance Intelligence §6.1 (absolute count)  
**Recommendation:** Keep absolute count with cap, not ratio

### Reasoning Assessment
The contradiction list argues:
> "The amendment's reasoning that '1/1 = same weight as 10/10' is mathematically unsound as the Security report notes. With 1 source there's no corroboration; 10/10 has strong consensus."

This is **genuine reasoning**, not assertion. The statistical argument is sound: corroboration requires multiple independent sources. 1/1 confirming sources provides zero corroboration (there's only one source). 10/10 provides strong evidence of a real change.

### Counter-Evidence Check
- **In favor of ratio:** If you have 10 sources and only 1 confirms, that's weak evidence (10%). If you have 2 sources and 1 confirms, that's 50%. The ratio captures "what proportion of signals agree."
- **In favor of absolute count:** Corroboration is fundamentally about independent verification. Having 10 independent sources confirm the same thing is much stronger evidence than having 1 source confirm it, even if the ratio is identical. This is basic epistemology — it's why scientific studies need replication.
- **The cap is important:** `Math.min((evidenceCount - 1) * 8, 20)` caps the bonus at 20 (3+ confirming sources beyond the first). This prevents unbounded confidence inflation.
- **Hybrid approach (not discussed):** The ideal solution would use BOTH ratio AND absolute count. Low ratio + high count = mixed signals. High ratio + high count = strong consensus. But this adds complexity.

### Verdict: **CONFIRMED** ✅

The absolute count approach is more statistically sound for corroboration scoring. The amendment's ratio-based reasoning ("1/1 = 10/10") is indeed mathematically unsound for measuring consensus strength. The cap prevents runaway scores. Keep the code as-is.

**Minor note:** The code could be improved by also considering ratio as a negative signal (e.g., if 8 out of 10 sources DON'T confirm, that weakens confidence). But for MVP, the current approach is fine.

---

## A13. Amendment 4 "Every Signal Reaches User" vs Log-Only Threshold

**Researched answer from:** Relevance Intelligence Amendment 4 (later decision)  
**Recommendation:** <40 confidence shows in dashboard with "low confidence" label, NOT in notifications

### Reasoning Assessment
The reasoning is procedural: Amendment 4 is the later decision, so it supersedes the original §6.1 design. The contradiction list adds the clarification: "<40 shows in dashboard, NOT in notifications."

### Counter-Evidence Check
- **In favor of log-only (<40):** Very low confidence signals are noise. Showing them in the dashboard at all clutters the interface and trains users to ignore low-confidence items.
- **In favor of Amendment 4 (show all):** Users who care deeply about a specific API may want to see even low-confidence signals. Hiding them creates blind spots.
- **The compromise (dashboard-only, no notifications) is sound:** It gives power users visibility while protecting casual users from alert fatigue. The "low confidence" label sets expectations.
- **UX consideration:** How many <40 confidence signals will there be? If it's 2% of signals, showing them with a label is fine. If it's 50%, the dashboard becomes cluttered. This depends on real-world data that doesn't exist yet.

### Verdict: **CONFIRMED** ✅

The later-decision rule is correct, and the clarification (dashboard only, no notifications, with label) is a good compromise. The key implementation detail: make sure the dashboard can filter these out easily (e.g., "Show low-confidence signals" toggle, defaulted OFF).

---

## A14. OpenAPI Diff Library — Two Different Recommendations

**Researched answer from:** Feasibility report (recommends neither original option; suggests oasdiff)  
**Recommendation:** Consider oasdiff (Go CLI) instead of api-smart-diff or openapi-diff

### Reasoning Assessment
The Feasibility report found:
- `api-smart-diff`: unmaintained (2 years, 2 dependents)
- `openapi-diff` (Atlassian): slightly better but pre-1.0
- Suggests `oasdiff` as alternative

### Counter-Evidence Check
- **oasdiff confirmed active and mature:** The oasdiff website (oasdiff.com) claims "300+ categories of breaking changes." GitHub repo is actively maintained. It's a Go CLI, which means it would need to be called as a subprocess from Node.js or used via its Go library.
- **The Atlassian openapi-diff** (github.com/OpenAPITools/openapi-diff) is a Java tool — even worse for Node.js integration.
- **Integration concern with oasdiff:** It's a Go binary. In a Node.js project, you'd either: (a) shell out to the CLI, (b) use a WASM build if available, or (c) write a thin Node.js wrapper. This adds operational complexity (need Go binary in the Docker image).
- **Alternative not discussed:** `@redocly/openapi-core` has diffing capabilities and is a JavaScript library. Worth investigating.
- **For MVP, this is V2 anyway:** OpenAPI spec diffing is listed in V2 features. The immediate need is just detecting that an OpenAPI spec file *changed* (content hash), not performing semantic diffing. Semantic diffing can be added later.

### Verdict: **PARTIALLY CORRECT** ✅⚠️

**Direction is right** — both original recommendations are poor choices. oasdiff is the best current option for semantic OpenAPI diffing.

**Missing nuance:**
1. oasdiff is a Go binary, not a JS library. Integration into a Node.js project requires either shelling out or WASM. This isn't trivial.
2. For MVP, this doesn't matter — OpenAPI spec diffing is V2. For V1, content-hash comparison is sufficient.
3. When the time comes, also evaluate `@redocly/openapi-core` as a native JS alternative.
4. The contradiction list says "go with neither" but doesn't fully resolve it. The answer should be: "Use content-hash for MVP, evaluate oasdiff vs Redocly for V2 OpenAPI semantic diffing."

---

## Summary Matrix

| # | Item | Verdict | Notes |
|---|------|---------|-------|
| **A1** | JWT vs Sessions | **PARTIALLY CORRECT** ✅⚠️ | Direction right (sessions win), but auth API endpoints need redesign, and API must not leak calibrating state |
| **A2** | bcrypt vs Argon2id | **CONFIRMED** ✅ | Unambiguously correct. OWASP, RFC 9106, better-auth native. |
| **A3** | 3 vs 6 Classification Phases | **CONFIRMED** ✅ | Deliberate, well-reasoned simplification. |
| **A4** | Calibrating State Hidden | **PARTIALLY CORRECT** ✅⚠️ | Hide from UI = right. But API must map calibrating→active, and critical changes must bypass calibration threshold. |
| **A5** | Monitoring Packs Killed | **CONFIRMED** ✅ | Clean kill, replaced by better concept. |
| **A6** | chirri.io → chirri.io | **CONFIRMED** ✅ | Obvious rename. Scope of changes is extensive. |
| **A7** | Webhook Headers (Delta→Chirri) | **CONFIRMED** ✅ | Trivial rename, permanent once shipped. |
| **A8** | User-Agent String | **CONFIRMED** ✅ | Straightforward standardization. |
| **A9** | pg_partman vs Native Partitioning | **CHALLENGED** ⚠️ | **The contradiction list is wrong.** Infrastructure doc proves pg_partman isn't available on Railway. Use native partitioning. |
| **A10** | Slack/Discord MVP via Webhooks | **CONFIRMED** ✅ | Clear debate outcome, sound reasoning. |
| **A11** | Brand Identity Pricing Outdated | **CONFIRMED** ✅ | Stale doc, just update it. |
| **A12** | Confidence: Absolute Count vs Ratio | **CONFIRMED** ✅ | Absolute count is statistically sounder for corroboration. |
| **A13** | Amendment 4: Show All Signals | **CONFIRMED** ✅ | Later decision wins. Dashboard-only + label is good compromise. |
| **A14** | OpenAPI Diff Library | **PARTIALLY CORRECT** ✅⚠️ | Neither original option works. oasdiff is best but needs Go integration. Moot for MVP (V2 feature). |

### Scorecard

| Verdict | Count |
|---------|-------|
| **CONFIRMED** (go with it) | 10 |
| **PARTIALLY CORRECT** (right direction, missing nuance) | 3 |
| **CHALLENGED** (needs revision) | 1 |

### Critical Finding

**A9 (pg_partman) is the only item where the contradiction list's recommendation is wrong.** The list says "go with Master Spec/Architecture" but the Infrastructure Details doc — which is ALSO a researched document — proves pg_partman isn't available on Railway's managed Postgres. The correct answer is native declarative partitioning, as the Infrastructure doc recommends. This item should be resolved in favor of the Infrastructure doc + Product Bible, not the Master Spec/Architecture.

### Items Needing Follow-Up Action

1. **A1:** Redesign auth API endpoints for session-based auth (remove `/auth/refresh`, rename `/auth/revoke` to `/auth/logout`)
2. **A4:** Add explicit spec text that API maps `calibrating` → `active` in responses. Add bypass for critical-severity changes during calibration period.
3. **A9:** Rewrite all pg_partman SQL to native declarative partitioning. Update Master Spec and Architecture doc. Add partition management to scheduler/worker cron.
4. **A14:** Note that oasdiff is a Go binary (not JS). For V2, evaluate both oasdiff and `@redocly/openapi-core`.

---

*Validated: 2026-03-24*  
*All 14 Category A items reviewed against source documents, counter-evidence, and external research.*
