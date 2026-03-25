# CHIRRI — Product & Business Logic Verification

**Reviewer:** Product Manager (subagent)  
**Date:** 2026-03-24  
**Scope:** UX gaps, business logic contradictions, pricing issues, missing flows, competitive risks  
**Rule:** Report only. No fixes.

---

## Severity Legend

| Tag | Meaning |
|-----|---------|
| 🔴 **BLOCKS LAUNCH** | Must resolve before any user touches the product |
| 🟡 **CONFUSING** | Will cause user confusion, support tickets, or churn |
| 🟢 **COSMETIC** | Inconsistency or minor issue; can ship with it |

---

## 1. User Experience Gaps

### 1.1 🔴 The "Nothing Happens for Days" Problem After First URL

**Finding:** User signs up → adds first URL → enters 10-minute learning phase → transitions to "calibrating" (invisible) → first scheduled check at plan interval (24h for Free, 1h for Indie). For a **Free user**, after the 10-minute learning burst, the next check is **24 hours later**. The dashboard will show an active URL with zero changes for potentially days or weeks (most APIs don't change daily).

**The gap:** No document describes what the dashboard actually SHOWS during this silence. The weekly stability report helps, but that's a week away. The "What's New" changelog shows Chirri product updates, not the user's data. TTFB/uptime graphs will have exactly 1-2 data points for days.

**Impact:** First-time user thinks the product is broken. "I signed up 3 days ago and nothing happened." This is the #1 reason for Day-1 churn in monitoring products.

### 1.2 🟡 16 URL States Are Overwhelming

**Finding:** The URL onboarding state machine defines 16 states: `learning`, `calibrating`, `active`, `paused`, `error`, `degraded`, `auth_required`, `redirect_detected`, `limited`, `monitoring_empty`, `rejected`, `classifying`, plus conceptual states like "recovered." The Product Bible says calibrating should be invisible (show as "Active"), reducing visible states. But the API spec (`CHIRRI_URL_ONBOARDING_FLOW.md`) still exposes `calibrating` as a distinct status in the enum and API responses.

**The gap:** If calibrating is supposed to be invisible to users, why does the API return `status: "calibrating"`? API consumers (including MCP agents) will see it. The dashboard may hide it but the API leaks the internal state. Either make calibrating truly invisible (map to `active` in API responses) or document it as a visible state. Currently contradictory.

### 1.3 🟡 Provider Detection + Discovery Flow: Two Conflicting Models

**Finding:** Three different documents describe what happens when a user enters `stripe.com`:

- **Product Bible §2:** "Show all monitorable sources... User selects which to monitor. Provider = 1 URL slot, bundled sources free."
- **Domain vs Page doc §5:** "Provider-aware expansion → suggest structured monitors" with pre-selected checkboxes
- **Source Tracking Model §2:** "When a user says 'Monitor Stripe,' Chirri creates [4 sources automatically]"

**The gap:** Does the user *choose* which sources to monitor (Product Bible), get *suggestions with pre-selected defaults* (Domain vs Page), or does Chirri *auto-create all bundled sources* (Source Tracking)? These are three different UX flows. The Source Preferences doc adds a fourth: dashboard shows smart defaults pre-selected, API creates everything ON by default.

The onboarding flow for the most important user action (adding a provider) is described inconsistently across docs.

### 1.4 🟡 "Plant a Seed" Metaphor vs Actual UI

**Finding:** The Brand Identity doc describes a garden metaphor with trees, roots, branches, blossoms. The Product Bible says "Plant a seed." But the actual dashboard UX described in Source Tracking Model §5 shows a standard tree-view with `├──` ASCII art. The Brand Identity Amendment adds a "Garden View" as a V2+ premium skin.

**The gap:** The landing page will say "Plant a seed" but the dashboard will show a standard monitoring tool UI with status dots. The metaphor is marketing-only and doesn't carry through the product experience. Users who were attracted by the zen/garden branding will find a standard dev tool dashboard.

### 1.5 🟡 Learning Period Communication

**Finding:** The 10-minute learning period shows "Setting up monitoring..." with a progress bar (0/30 → 30/30). Good. But what about the 7-day calibration? The Definitive Plan says Jake won the debate: calibrating is hidden, user sees "Active." But during those 7 days, the confidence threshold is 95 (vs 80 normally), meaning real changes MAY be suppressed.

**The gap:** If a genuine breaking change happens on Day 2 with confidence 85, it gets suppressed. The user sees "Active" and trusts Chirri is watching, but Chirri silently swallowed a real alert. No document addresses this scenario or proposes a notification like "We detected a possible change but aren't confident enough yet."

### 1.6 🟡 Redirect Handling Requires User Decision, Blocks Monitoring

**Finding:** If a URL returns 3xx, the URL enters `redirect_detected` status and **"No automatic checks until resolved."** The user must choose: monitor destination, monitor redirect source, or monitor both. Until they act, nothing happens.

**The gap:** If a user adds 20 URLs via bulk import and 5 have redirects, those 5 silently stop. The notification for this state exists as a webhook event (`url.redirect_detected`) but the user may not have webhooks configured yet (this is onboarding). There's no email notification for this state. The user discovers it only by checking the dashboard.

### 1.7 🟡 Inconsistent Interval Naming

**Finding:** The Product Bible pricing table says Free plan minimum interval is "Daily (24h)." The Definitive Plan says Free plan minimum interval is "24 hours." The Master Spec pricing table says "Daily (24h)." But interval values in the API are `24h`, `6h`, `1h`, `15m`, `5m`, `1m`.

However, the Brand Identity pricing section uses different plan names entirely: "Hobby" (not "Free"), "Pro" ($9, not "Indie"), "Team" ($29, not "Pro"). The intervals there are "Every 30 min" (Free) and "Every 1 min" (paid) — completely different from the Product Bible.

**The gap:** The Brand Identity pricing section was clearly written before the final pricing was decided and was never updated. If anyone uses it for the landing page, the pricing will be wrong.

### 1.8 🔴 "Check Now" Button During Learning/Calibrating

**Finding:** The Definitive Plan adds a "Check Now" button (manual check trigger). The API spec defines `POST /v1/urls/:id/check`. But the URL onboarding flow doc says `422 url_paused` is returned for paused URLs. What about URLs in `learning` or `calibrating` state?

**The gap:** Can users trigger manual checks during learning? During calibrating? The spec doesn't address this. If allowed during learning, it could interfere with baseline building. If blocked, users will be confused why they can't check their own URL.

---

## 2. Business Logic Contradictions

### 2.1 🔴 Provider = 1 Slot, But What IS a "Provider"?

**Finding:** The spec says "Provider = 1 URL slot" and uses Stripe as the example. But consider:
- **Google** has Maps API, Cloud API, YouTube API, Gmail API, Firebase — completely unrelated services under one domain umbrella. Is "Google" 1 provider or 5?
- **Amazon** has AWS (hundreds of services), Amazon marketplace API, Alexa API — is this 1 slot?
- **Microsoft** has Azure, Graph API, Office 365, Teams — 1 provider?

**The gap:** The provider model assumes 1 domain = 1 provider = 1 API ecosystem. This breaks for mega-providers. The hardcoded provider profiles may handle top 20, but the generic domain-based detection would treat all of `googleapis.com` as 1 provider. No document addresses how to handle sub-providers or multi-product companies.

### 2.2 🟡 Free Tier Fairness: Unequal Value Per Slot

**Finding:** Free tier gets 3 URL slots. User A adds `stripe.com` (1 slot, gets 4 sources: OpenAPI, changelog, status, SDK). User B adds 3 random API endpoints (3 slots, gets 3 sources). User A gets more monitoring for fewer slots.

**The gap:** This is acknowledged implicitly in the Source Tracking Model ("This IS the product") but never addressed as a fairness concern. It's actually fine strategically — it incentivizes using provider intelligence — but should be a conscious decision, not an oversight.

**Verdict:** This is a feature, not a bug. But it should be documented as an intentional design decision.

### 2.3 🔴 Downgrade Flow: What Gets Paused?

**Finding:** The Master Spec says downgrade "Takes effect at period end. If user has 50 URLs and downgrades to Indie (20 URLs), pause excess URLs (lowest priority first)." The Definitive Plan doesn't address downgrade.

**The gaps:**
1. What is "lowest priority"? There's no priority field on URLs. Is it by creation date? Last change detected? Tags?
2. Do provider bundled sources count toward the limit? If user has 10 providers (10 slots, 40 sources) and downgrades from Indie (20) to Free (3), which 7 providers get paused?
3. What happens to bonus/discovered sources on paused providers? Are they also paused?
4. Does the user get to CHOOSE which URLs to keep? The spec says "Email: '30 URLs were paused. Choose which to keep active.'" But there's no API endpoint for this selection flow. No dashboard UI described for it.
5. What about source preferences and alert configurations on paused URLs? Preserved or lost?

### 2.4 🟡 Bonus Sources and Plan Limits

**Finding:** Bonus sources (discovered via lightweight domain discovery) don't count toward URL slots per Source Tracking Model. They're checked at system-controlled intervals regardless of plan.

**The gap:** 
- Do bonus source checks count toward any operational limit? A Free user with 3 providers could have 12+ bonus sources being checked — potentially more server load than a Free tier warrants.
- Can a Free user have status page monitoring via bonus sources? The Source Tracking Model says "Free plan gets 3 bundled sources instead of 4 (no status page on free)" — but the lightweight domain discovery section (Master Spec) says discovered sources are added regardless of plan.
- What's the maximum number of bonus sources per provider? Unbounded? Could a user game this?

### 2.5 🟡 "Monitoring Packs" Are Simultaneously Killed and Alive

**Finding:** The Definitive Plan explicitly says "Monitoring packs: Killed entirely" (Yuki's recommendation, accepted). But the URL Onboarding Flow doc has a full section "§12 Monitoring Pack Endpoints" with 3 endpoints (`GET /v1/packs`, `GET /v1/packs/:id`, `POST /v1/packs/:id/apply`) and detailed response shapes. The Product Bible has `pack_` in the ID prefix registry.

**The gap:** The API spec wasn't updated to reflect the debate outcome. This will cause confusion during implementation — someone reading the API spec will build pack endpoints that the plan explicitly killed.

### 2.6 🟡 Source Preferences: When Are Defaults Created?

**Finding:** The Source Preferences doc says "Defaults are applied at creation time and stored in `source_alert_preferences`." But it also says "For custom URLs: `/* all null — inherit from account */`". 

**The gap:** If defaults are stored at creation time, changing account defaults after creating a provider won't affect existing sources. This is stated as intentional. But what if a user creates a provider on Free (no digest mode) and upgrades to Indie (digest available)? Their existing sources have `digest_mode: null` (inherit from account), which is fine. But the account default for digest was `false` at creation... wait, it inherits, so it should work. Actually this is OK — the inheritance model handles it. But the doc's claim that "they are NOT hardcoded in the resolution logic" contradicts "defaults are applied at creation time." If they're applied at creation time AND inheritance works, you're storing non-null values that prevent inheritance. This needs clarification.

### 2.7 🟡 Two Different API Endpoint Structures

**Finding:** The Product Bible and Master Spec define endpoints under `/v1/urls/...` for everything. But the Source Tracking Model §6 introduces a completely separate endpoint structure under `/api/v1/providers/...` with different CRUD operations. These are two incompatible API designs for the same feature.

**Endpoints in Product Bible:** `POST /v1/urls`, `GET /v1/urls/:id/sources`  
**Endpoints in Source Tracking Model:** `POST /api/v1/providers`, `GET /api/v1/providers/:id`, `POST /api/v1/providers/:id/sources`

**The gap:** Are providers a separate top-level resource or are they metadata on URLs? The two models have different implications for API design, database schema, and user mental model.

---

## 3. Pricing Issues

### 3.1 🟡 Infrastructure Cost Inconsistency

**Finding:** The Product Bible says infrastructure is "~$42/mo." The Source Tracking Model does break-even analysis based on this. But the Master Spec's "Corrected Per-Provider Cost Math" section also says $42/mo. However, the task description mentions Railway costs were "corrected to $55-75/mo" — this correction doesn't appear in any document I read. All documents consistently say $42/mo.

**The gap:** If actual Railway costs are $55-75/mo (as the task hints), then:
- Break-even changes from 6 Indie customers ($54/mo) to 7-9 customers ($63-81/mo)
- The Source Tracking Model's margin analysis for Business tier shows -$6.50 at $42/mo base — at $75/mo base it's -$39/mo, a significant loss
- Revenue projections may need adjustment

### 3.2 🟡 Business Tier Margin Is Negative at Scale

**Finding:** Source Tracking Model §7 explicitly acknowledges: "Business tier at scale with heavy usage is tight on margins... $79/mo revenue vs $85.50/mo cost = -$6.50." The note says "80/20 rule applies — most won't max out."

**The gap:** This is a known risk, but there's no mechanism to prevent a Business user from maxing out 500 URLs at 1-minute intervals. No overage charges, no throttling, no fair-use policy. One power user could cost $85+/mo while paying $79. With higher infrastructure costs ($55-75/mo base), this gets worse.

### 3.3 🟡 Bonus Source Checks Not Counted in Cost Projections

**Finding:** The Source Tracking Model calculates per-provider costs including bundled sources. But the lightweight domain discovery (added later in the Master Spec) can add additional bonus sources beyond the 4 bundled ones. These discovered sources (changelog, docs, OpenAPI spec found via probing) are not in the original cost model.

**The gap:** If discovery finds 3 additional sources per provider beyond the 4 bundled, the per-provider cost increases ~50%. At scale (5,000 providers), that's $225/mo instead of $150/mo for bundled checks alone. Still manageable, but not modeled.

### 3.4 🟡 Annual Pricing Not Fully Specified

**Finding:** Annual discount is "20% off (2 months free)" = $7.20/mo for Indie billed annually. But:
- No document specifies what happens when an annual subscriber wants to downgrade mid-year
- No document specifies refund policy for annual subscriptions
- No document specifies whether annual subscribers can switch to monthly mid-cycle

---

## 4. Competitor Response

### 4.1 🟡 APIShift Speed Threat

**Finding:** Market Analysis flags APIShift as 🔴 HIGH threat with "nearly identical positioning." The strategy is "don't study them, out-execute." 

**The gap:** No contingency plan if APIShift ships auto-classification, provider intelligence, or MCP server first. The "out-execute" strategy is fine as a starting position, but there should be a defined response for specific competitive moves. What if they launch on HN before Chirri?

### 4.2 🟡 changedetection.io's Potential Evolution

**Finding:** changedetection.io has 22K+ GitHub stars and active development. If they add JSON schema-aware diffing or severity levels (both relatively simple features), Chirri loses a key differentiator.

**The gap:** No monitoring strategy for competitor feature development. Not suggesting spying, but a monthly check of competitor changelogs would be wise.

### 4.3 🟡 Defensibility of Differentiators

**Finding:** The claimed moat includes:
1. Auto-classification — useful but not hard to replicate (it's domain patterns + content-type detection)
2. Historical baseline data — only valuable after months of operation; at launch, zero moat
3. Aggregate intelligence — requires 1,000+ users, deferred. Zero moat at launch
4. Provider intelligence — APIs.guru is public data; anyone can build this
5. Brand — subjective, takes years to build

**The gap:** At launch, Chirri has essentially zero moat. The only real barrier is execution speed and marketing. All technical differentiators are replicable within weeks by a funded competitor. This is acknowledged ("speed to market") but the kill criteria don't include a "competitor ships identical feature" response beyond "evaluate."

---

## 5. Missing User Flows

### 5.1 🔴 Password Reset Flow

**Finding:** The URL Onboarding Flow doc includes `POST /v1/auth/forgot-password` and `POST /v1/auth/reset-password` endpoints with full request/response shapes. **This IS designed.** However, no dashboard UI flow is described (what does the "Forgot Password?" page look like? Where is the link?).

### 5.2 🔴 Email Verification Flow

**Finding:** The Product Bible says "Email verification before checks begin" (security requirement #4). The URL Onboarding Flow doc includes `POST /v1/auth/verify-email`. But:
- What happens if a user adds URLs before verifying email? Are checks queued? Rejected?
- What if verification email doesn't arrive? Is there a resend button? (No `POST /v1/auth/resend-verification` endpoint exists)
- How long is the verification token valid? The spec says "24h" for the token but doesn't specify what happens to the account after 24h without verification.

### 5.3 🟡 Team Invite Flow

**Finding:** Not designed for MVP. Pro tier mentions "3 seats" and Business "10 seats" but these are V1.1/V2. The Definitive Plan confirms team features are V2. **Acceptable for launch but the pricing page already mentions seats — remove seat counts from Free/Indie pricing table or note "coming soon."**

### 5.4 🟡 Billing Management Flow

**Finding:** Partially designed. The URL Onboarding Flow doc includes:
- `GET /v1/account/billing` — returns plan info, payment method, Stripe portal URL
- `POST /v1/account/billing/checkout` — creates Stripe Checkout session

**Missing:** No endpoint or flow for:
- Changing payment method (relies on Stripe portal link)
- Viewing invoices (relies on Stripe portal link)
- Applying promo codes / coupons
- Tax handling / VAT for EU customers

The Stripe portal handles most of this, so it's probably fine for MVP. But the UX of bouncing to Stripe's portal is jarring.

### 5.5 🔴 Data Export Flow

**Finding:** `GET /v1/account/export` is designed and returns all user data as JSON. Good for GDPR. But:
- No dashboard UI for triggering export
- No email notification when export is ready (it appears to be synchronous — what if a user has 500 URLs with 90 days of history? That's a lot of data to generate in a single request)
- Rate limited to "once per hour" but large exports may time out
- No async export + download link pattern

### 5.6 🔴 Account Deletion Flow (GDPR)

**Finding:** `DELETE /v1/account` IS designed with:
- Confirmation text required ("DELETE MY ACCOUNT")
- Password verification
- 72-hour grace period with undo
- `POST /v1/account/cancel-deletion` to undo

**Gaps:**
- No dashboard UI described for this flow
- The operational requirements mention `deleteUserData(userId)` covering "all 11+ tables + R2 snapshots" but no document specifies what happens to shared monitoring data. If User A and User B both monitor the same Stripe URL, and User A deletes their account, does the shared_url subscriber count decrement? (Probably yes, but not specified)
- What about webhook delivery logs? Notification logs? These contain user data.

### 5.7 🟡 API Key Rotation Flow

**Finding:** The URL Onboarding Flow doc has `PATCH /v1/api-keys/:id` (rename only) and `DELETE /v1/api-keys/:id` (revoke). To "rotate," a user must create a new key then delete the old one. There's also `POST /v1/webhooks/:id/rotate-secret` for webhook signing secrets.

**The gap:** No single "rotate" endpoint for API keys. The user must create-then-delete, and there's a window where both old and new keys are active. This is fine for most cases but should be documented as the rotation procedure.

---

## 6. Dashboard vs API Consistency

### 6.1 🟡 API Key Management Is Dashboard-Only

**Finding:** The API spec explicitly says API keys can only be managed via JWT (dashboard) auth: "API keys cannot create API keys" (`403 jwt_required`). This means:
- CI/CD systems can't programmatically create/rotate API keys
- Automation around key management requires dashboard login
- MCP agents can't manage keys

**The gap:** This is a deliberate security decision (prevents key escalation) but it means some account management operations are dashboard-only. Should be documented clearly.

### 6.2 🟡 Account Signup Is Dashboard-Only

**Finding:** The Master Spec says "Account creation: Dashboard only for V1. No API-based registration initially." This means:
- No programmatic account creation for testing
- No self-service provisioning by enterprise admins
- B2B scenarios (company buys Chirri for team) have no API path

Fine for MVP but limits automation.

### 6.3 🟡 MCP Server Functionality Undefined

**Finding:** MCP server is "non-negotiable for V1.1" but no document specifies what operations it should expose. The Source Preferences doc mentions "MCP: Everything ON by default" for alert behavior, but there's no MCP API design, no tool definitions, no capability list.

**The gap:** Without a spec, the MCP server could be anything from "read-only list changes" to "full CRUD on all resources." This needs scoping before V1.1 development begins.

### 6.4 🟡 Classification Override Is API-Only

**Finding:** `PATCH /v1/urls/:id/monitoring` allows overriding the auto-detected monitoring method. `POST /v1/urls/:id/classify` re-runs classification. But no dashboard UI is described for either of these. Power users who want to force a different monitoring strategy can only do it via API.

---

## 7. Additional Findings

### 7.1 🟡 Inconsistent Domain References

**Finding:** Documents alternate between `chirri.io` (the final domain) and `chirri.io/delta` (appears to be an older domain). Examples:
- URL Onboarding Flow: `https://chirri.io/delta/billing`, `https://chirri.io/delta/settings`
- Digest emails reference `https://chirri.io/delta/settings`
- Webhook headers: `X-Chirri-Signature` (correct)
- CDN URLs: `https://cdn.chirri.io/providers/stripe.svg`
- Error doc URLs: `https://docs.chirri.io/errors#...`

**The gap:** `chirri.io` references need to be updated to `chirri.io` before launch. This is in the API response contract — it will be in production responses.

### 7.2 🟡 "Monitoring Packs" in API Spec vs Provider Intelligence

**Finding:** The killed "Monitoring Packs" concept still lives in:
- URL Onboarding Flow §12 (full endpoint spec)
- Product Bible ID prefix registry (`pack_` prefix)  
- Provider search response includes `monitoring_pack_id`
- Pack application endpoint (`POST /v1/packs/:id/apply`)

Meanwhile, the Provider Intelligence feature (which replaced packs) uses a different API surface (`GET /v1/providers/search`, `GET /v1/providers/:slug`). Both exist simultaneously in the spec.

### 7.3 🟡 Weekly Stability Report — No Opt-Out

**Finding:** The weekly stability report email is described as automatic for all users. No document mentions an unsubscribe/opt-out mechanism.

**The gap:** CAN-SPAM and GDPR require opt-out for marketing emails. Transactional emails (change alerts) don't need it, but a "weekly summary" is arguably marketing/engagement, not transactional. Need an unsubscribe link.

### 7.4 🟡 Notification Rate Limiting Details Missing

**Finding:** The Five-Layer False Positive Cascade mentions "Layer 3: Rate Limiting on Notifications — Max N alerts per provider per hour." The value of N is never specified anywhere. This is a critical tuning parameter.

### 7.5 🟡 Severity Terminology Inconsistency

**Finding:** Different documents use different severity taxonomies:

- **Product Bible:** 🔮 Forecast, ⏰ Deadline, 🔴 Breaking, 🟡 Notable, 🟢 Info
- **Change Detail View:** 🔴 Breaking, 🟡 Warning, 🟢 Info  
- **Source Preferences:** `info`, `warning`, `notable`, `breaking`, `critical` (5 levels)
- **Escalation doc:** `info`, `advisory`, `warning`, `urgent`, `critical` (5 different levels)
- **API change types:** `critical`, `breaking`, `warning`, `info` (4 levels)

**The gap:** There are at least 3 different severity scales across the spec. Source Preferences defines 5 levels (info/warning/notable/breaking/critical). The Escalation doc defines 5 different levels (info/advisory/warning/urgent/critical). The Product Bible uses 5 levels with different names (forecast/deadline/breaking/notable/info). These need to be unified into one canonical scale before implementation.

### 7.6 🟡 No Onboarding Email Sequence

**Finding:** The spec describes a weekly stability report and change notification emails. But there's no onboarding email sequence designed:
- Welcome email after signup
- "Your first URL is being monitored" email
- "Your baseline is ready" email (after learning)
- "It's been 7 days, here's what we've seen" email
- "You haven't added a URL yet" nudge email

These are critical for activation and reducing the "nothing happened" churn.

### 7.7 🟢 Brand Identity Pricing Section Outdated

**Finding:** As noted in 1.7, the Brand Identity doc's pricing section uses plan names (Hobby/Pro/Team) and intervals (30min/1min) that don't match the final pricing. This is cosmetic since it's a brand guide, not implementation spec, but could cause confusion.

### 7.8 🟡 "Smart Chirp" Relevance Filter Has No Spec

**Finding:** The Master Spec's "Bonus Source Alert Logic" section describes a relevance filter for bonus sources: "Does the change text mention the user's monitored path/endpoint?" This is a text-matching algorithm that needs implementation detail. Is it exact path matching? Fuzzy? Does "v1" in a changelog match `/v1/users`? What's the relevance score threshold?

No implementation detail is provided. This is a significant UX-impacting feature with no spec.

---

## Summary: Launch Blockers

| # | Finding | Section |
|---|---------|---------|
| 1 | No designed experience for "nothing happens for days" after first URL | 1.1 |
| 2 | Provider definition breaks for mega-providers (Google, Amazon, Microsoft) | 2.1 |
| 3 | Downgrade flow incompletely specified (no selection UI, no priority system) | 2.3 |
| 4 | "Check Now" behavior during learning/calibrating undefined | 1.8 |
| 5 | Email verification flow incomplete (no resend, no post-expiry behavior) | 5.2 |
| 6 | Data export may timeout for large accounts (synchronous endpoint) | 5.5 |
| 7 | `chirri.io` domain references throughout API response contract | 7.1 |

## Summary: High-Priority Confusing Issues

| # | Finding | Section |
|---|---------|---------|
| 1 | Calibrating state visible in API but supposed to be invisible | 1.2 |
| 2 | Provider onboarding flow described 3 different ways | 1.3 |
| 3 | Monitoring Packs killed in debate but fully specced in API doc | 2.5 / 7.2 |
| 4 | Two incompatible API structures (URLs vs Providers) | 2.7 |
| 5 | At least 3 different severity taxonomies across docs | 7.5 |
| 6 | Business tier negative margins at scale, no fair-use protection | 3.2 |
| 7 | Smart Chirp relevance filter has no implementation spec | 7.8 |
| 8 | No onboarding email sequence designed | 7.6 |
| 9 | Weekly stability report has no opt-out mechanism | 7.3 |
| 10 | Notification rate limit value (N per hour) never defined | 7.4 |
| 11 | Bonus sources not in cost model | 3.3 |
| 12 | Learning period may suppress real breaking changes silently | 1.5 |
| 13 | Redirect state blocks monitoring with no email notification | 1.6 |

---

*End of Product & Business Logic Verification*
