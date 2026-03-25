# CHIRRI — FEATURE TEARDOWN: What's Complete, What's Missing, What Would Frustrate You

**Author:** QA Lead (Verification Pass)  
**Date:** March 24, 2026  
**Method:** Walked through every feature as a real user. Not checking docs for consistency — checking the PRODUCT for completeness.

---

## Summary Score Card

| Feature Area | Complete | Partially Designed | Missing | Unanswered |
|---|---|---|---|---|
| 1. URL Monitoring (Core) | 8 | 4 | 3 | 2 |
| 2. Change Detection & Viewing | 6 | 3 | 5 | 2 |
| 3. After Detection — What Now? | 2 | 1 | 5 | 1 |
| 4. Early Warning / Forecasts | 4 | 3 | 4 | 2 |
| 5. Provider / Source Management | 4 | 2 | 3 | 2 |
| 6. Teams / Collaboration | 0 | 1 | 5 | 3 |
| 7. Billing / Account | 4 | 2 | 4 | 2 |
| 8. API / MCP | 5 | 2 | 3 | 1 |
| 9. Empty States & Onboarding | 2 | 2 | 4 | 1 |
| 10. Error States & Edge Cases | 3 | 2 | 4 | 2 |
| 11. Things Nobody Mentioned | 1 | 1 | 10 | 3 |
| **TOTAL** | **39** | **23** | **50** | **21** |

**Bottom line: 50 missing items. The core detection engine is well-designed. Everything around the core — workflow, collaboration, post-detection actions, UX details — has significant gaps.**

---

## 1. URL Monitoring (Core)

### ✅ Complete and Well-Designed

- **Input → first alert flow**: URL → SSRF validation → auto-classification (3 phases) → learning period (10min, 30 rapid checks) → calibrating (7 days, invisible) → active. Clock-aligned checks. Confirmation recheck at 5s. Notification dispatch. This is extremely well thought out.
- **Learning period mechanics**: 20s intervals, ~30 checks, volatile field detection (>50% change rate), error responses never become baselines. Excellent.
- **Shared monitoring deduplication**: SHA-256(url + method + sorted headers). One fetch per unique URL at highest frequency. Smart.
- **Multi-layer fingerprinting**: fullHash → stableHash → schemaHash → headerHash. 90% of checks end at fullHash match. Efficient.
- **SSRF prevention**: DNS pinning, IP blocklist (all formats), hostname blocklist, manual redirect following, 5MB body limit. 18-case test suite. Best-in-class.
- **Clock-aligned scheduling**: Wall-clock boundaries with 0-10% jitter. Piggyback optimization. Good.
- **Per-domain rate limiting**: 1 req/sec Redis token bucket + circuit breaker at >50% failure rate. Solid.
- **Check pipeline**: 11 well-documented steps from schedule → result storage.

### ⚠️ Partially Designed (Needs More Detail)

- **Dashboard during learning state**: Spec says user sees "Setting up monitoring..." but doesn't specify: Is there a progress bar? A countdown? Do they see "Check 14/30 complete"? Do they see the volatile fields being discovered? A user staring at "Setting up..." for 10 minutes with no feedback will refresh the page, close the tab, or think it's broken.
  - **Recommendation**: Show a mini progress indicator. "Learning your endpoint... 7/30 checks complete. We've identified 3 volatile fields so far." Make the learning period feel like value, not waiting.

- **Dashboard during active state with no changes**: The spec mentions weekly stability reports and TTFB/uptime tracking to keep the dashboard "alive." But what EXACTLY does the dashboard show for a URL that's been active for 30 days with zero changes? Is there a "Last checked: 2 minutes ago ✓ No changes" indicator? A timeline view showing all-green checks? If the user sees a blank "Changes" tab, they'll think the product isn't working.
  - **Recommendation**: Explicit "All clear" state with check count, uptime %, avg TTFB, and "No changes detected in 30 days — your integration is stable." Make silence feel like a feature.

- **Noisy API handling**: The spec handles volatile fields (>50% change rate auto-excluded) and numeric drift (<1%). But what about an API that changes EVERY check with non-volatile structural changes? Example: an API that rotates between 3 response schemas based on A/B testing. The oscillation detection ("2-3 states stored, only alert on new state") is mentioned but not detailed.
  - **What's missing**: How many states do we store? 3? 10? What if it's 50? Is there a "this URL is too noisy to monitor meaningfully" state? Does the user get a notification saying "This endpoint changes too frequently for useful monitoring"?

- **Retry logic on check failure**: Spec mentions transient errors get "retry with exponential backoff" and permanent errors (404, 410) mark URL as `error`. But the EXACT retry schedule isn't specified for check failures. Is it: fail → retry in 1min → retry in 5min → retry in 30min → mark as degraded? How many retries before `error` state? The webhook retry schedule is detailed (1m, 5m, 30m, 2h, 12h) but check retry is vague.
  - **Recommendation**: Define explicit check retry: 3 retries with 1min/5min/15min backoff. If all fail, mark URL as `degraded`. If 24h of continuous failure, mark as `error` and notify user.

### ❌ Completely Missing

- **Pause/Resume behavior**: The spec mentions `paused` as a valid URL status and `PATCH /v1/urls/:id` can update settings, but:
  - When you pause a URL, does it keep the slot? (Critical for billing — if pausing frees the slot, users will game it by pausing/unpausing)
  - When you resume, does it restart learning? Or resume from the last baseline?
  - Is there a maximum pause duration before the baseline becomes stale?
  - **Recommendation**: Paused URLs keep the slot. Resume checks immediately against existing baseline (no re-learning). If paused >30 days, show a "baseline may be stale" warning and offer to re-learn.

- **Changing check interval on existing URL**: Can a user change from 24h to 1h on an active URL? The `PATCH /v1/urls/:id` endpoint exists, but what happens? Does the shared monitoring dedup key change? Does the next check fire at the new interval immediately, or at the next clock-aligned slot? If they downgrade from 1h to 24h, do they lose the interim check history?
  - **Recommendation**: Interval change takes effect at next clock-aligned slot for the new interval. Shared URL key doesn't change (interval isn't part of the key). History is preserved.

- **Check history vs. change history**: The spec has `check_results` (every check) and `changes` (detected changes). But the API only exposes `GET /v1/changes`. There's no `GET /v1/urls/:id/checks` endpoint to see every individual check result (including the ones where nothing changed). The URL detail page mentions a "check log" but there's no API endpoint for it.
  - **Recommendation**: Add `GET /v1/urls/:id/checks` — paginated list of all check results with status, TTFB, response size, fingerprints. Essential for debugging and for users who want to see "yes, Chirri actually checked at 3am."

### ❓ Unanswered Questions

- **What happens to the slot when a URL is deleted?** The spec says "historical data retained per plan" on DELETE. But does the slot free up immediately? Can they add a new URL right away?
- **Can users add the same URL twice with different headers?** The shared URL key includes headers hash, so technically `GET /api/v1/users` with `Accept: application/json` and `GET /api/v1/users` with `Accept: text/xml` are different monitors. Is this intentional? Does each count as a separate slot?

---

## 2. Change Detection & Viewing

### ✅ Complete and Well-Designed

- **Side-by-side diff layout**: Left panel (before), right panel (after), scroll-synced, syntax highlighted with JetBrains Mono. Responsive: falls back to unified diff on mobile. This is THE money screen and it's well-designed.
- **Auto-generated summary**: "Field `amount` removed from response object" — plain English. Good.
- **Severity badges**: 🔴 Breaking / 🟡 Notable / 🟢 Info with clear criteria for each.
- **Feedback buttons**: ✅ Real | ❌ False Positive | 🤷 Not Sure — with one-click feedback from email (HMAC-signed token, no auth needed). Excellent UX.
- **Actionable recommendations**: "Update your integration to handle missing `amount` field." Goes beyond just showing the diff.
- **API equivalent**: `GET /v1/changes/:id` returns `previous_state`, `current_state`, `diff`, `summary`, `actions`, `severity`. Full parity.

### ⚠️ Partially Designed (Needs More Detail)

- **JSON diff rendering**: The spec says "JSON syntax highlighting" and "colored line backgrounds." But is it showing raw JSON or pretty-printed? What about deeply nested JSON (20 levels deep, per the max recursion)? Is there collapsing/expanding of nested objects? Without this, a diff of a large API response will be a wall of text.
  - **Recommendation**: Pretty-printed JSON with 2-space indentation. Collapsible nodes for nested objects deeper than 3 levels. Show diff context: 3 unchanged lines above/below each change, collapse the rest.

- **HTML diff rendering**: The spec mentions monitoring docs pages, changelogs, and HTML content. But the diff engine is designed for JSON. How do we show "this paragraph changed on the docs page"? The monitoring method for HTML is `content-hash` (SHA-256 of body) — so we detect that SOMETHING changed but can't show WHAT changed in HTML.
  - **What's missing**: HTML-aware diffing for documentation pages. Currently, if `stripe.com/docs/upgrades` changes a paragraph, the user sees "content hash changed" but no visual diff of the text. This is a significant gap for the ~20% of monitors that are docs/changelog pages.
  - **Recommendation**: For HTML content, extract text content (strip tags), then show a text diff. Not perfect but WAY better than "hash changed."

- **Status code change visualization**: The spec says status code changes are a change type (`status_code`), but the Change Detail View is designed around JSON diffs (left panel/right panel). How does a "200 → 500" change look in the diff viewer? Is it a special layout? Just text?
  - **Recommendation**: For non-JSON changes (status code, redirect, availability), show a simplified card layout instead of side-by-side: "Status Code: 200 → 500", "Response: [error body]", "Recommendation: Check if the endpoint is deprecated."

### ❌ Completely Missing

- **Full response viewing**: Can the user see the FULL previous and current response, not just the diff? The API returns `previous_state` and `current_state`, but can they expand to see the entire response body? For large responses (approaching 5MB limit), this is important context.
  - **Recommendation**: "View full response" expandable section below the diff. With a download option for large responses.

- **Diff sharing**: Can a user share a specific change with a teammate? Is there a permalink? A "Copy link" button? The change has an ID (`chg_xxx`), but:
  - Can a non-authenticated user view a shared diff? (Probably not, for security)
  - Can a team member (on Pro/Business) see it without the URL being in their account?
  - Is there a "Copy to clipboard" button that formats the change nicely for pasting into Slack/Jira?
  - **Recommendation**: Each change gets a permalink (`chirri.io/changes/chg_xxx`). "Copy summary" button that copies the auto-generated summary + diff URL in markdown format. For team plans, all team members can view.

- **Arbitrary snapshot comparison**: Can a user say "show me the state on March 1 vs March 15"? The spec stores snapshots in R2 and check results in Postgres, but there's no API endpoint or UI for comparing arbitrary historical snapshots. Only the most recent change is viewable in the Change Detail View.
  - **Recommendation**: Add "Compare snapshots" feature in URL detail page. Timeline view with snapshot dots — click any two to compare. V1.1 feature, but design the data model to support it now (snapshots need to be independently addressable, not just "before/after" of a change).

- **Header change visualization**: The spec says header changes are detected and displayed. But HOW? Headers aren't JSON. Is it a key-value table showing old → new? Is it a diff of the raw header block? What about headers that were added or removed?
  - **Recommendation**: Table format: Header Name | Previous Value | Current Value | Change Type (added/removed/modified). Highlight rate limit changes and deprecation headers specially.

- **Download/export of a single change**: Can a user download the diff as JSON? PDF? CSV? The account-level export exists (`GET /v1/account/export`) but there's no per-change export.
  - **Recommendation**: "Download as JSON" button on Change Detail View. Include `previous_state`, `current_state`, `diff`, `summary`, `metadata`.

### ❓ Unanswered Questions

- **What if the response body is binary (images, protobuf)?** The spec assumes JSON/HTML/XML. What does a user see if they monitor a URL that returns a binary response? Just "content hash changed"?
- **What if the change is ONLY in response time (TTFB regression)?** Is that shown in the Change Detail View? Or only on the URL detail TTFB graph? The severity table says "TTFB regression >2x baseline" is `warning`, but how is it shown in the change feed?

---

## 3. After Detection — What Now?

### ✅ Complete and Well-Designed

- **Acknowledge with note**: `POST /v1/changes/:id/acknowledge` with optional note. User can mark a change as reviewed.
- **Feedback loop**: Mark as `real`, `false_positive`, or `not_sure`. System learns from feedback. One-click from email.

### ⚠️ Partially Designed

- **"Mark as Reviewed" semantics**: The spec has both "acknowledge" (POST endpoint) and "Mark as Reviewed" (button in UI). Are these the same action? Is there a status progression? The `user_changes` table tracks feedback and acknowledgment, but there's no defined lifecycle for a change beyond "detected → acknowledged."
  - **What's missing**: A clear status model for changes. Is it: `new` → `acknowledged` → `resolved`? Or just `new` → `reviewed`? Can you re-open a reviewed change?

### ❌ Completely Missing

- **No workflow after detection**: User sees a breaking change. Then what? There's no:
  - "Create Jira/Linear ticket" button (deferred to V2, per integration priority)
  - "Copy to clipboard" formatted for Slack/Teams/email
  - Status progression beyond "acknowledged" (no "in progress" or "resolved" states)
  - Assignment to a team member
  - Due date or SLA tracking ("fix this by Friday")
  - **This is the biggest product gap.** Detection is useless if users can't ACT on what they find. The product stops at "here's what changed" and doesn't help with "here's what to do about it."

- **No change snoozing**: "Remind me about this change in 2 weeks" — not designed. Users who can't fix a change immediately need a way to come back to it.

- **No change notes/comments**: Beyond the acknowledge note, there's no way to add ongoing commentary. "We decided to ignore this because our wrapper handles it" — where does that go? The acknowledge endpoint takes a note, but is it a single note or a thread?

- **No change grouping**: If an API makes 5 related changes in one deploy, they show as 5 separate changes in the feed. There's no way to group them as "Stripe March 15 deploy" and track them as one unit of work.

- **No "ignore this type of change" rule**: User gets a change they don't care about (e.g., new optional field added). They can mark it as "not sure" but there's no way to say "never alert me when a new field is ADDED, only when fields are REMOVED." The source preferences system handles severity thresholds but not change-type filtering at this granularity.
  - **Recommendation**: Add per-URL "ignore rules" — e.g., "ignore field additions," "ignore header-only changes." Starts with a few presets, evolves based on usage patterns.

### ❓ Unanswered Questions

- **What's the notification → action conversion rate assumption?** The product is designed to detect and notify but doesn't track whether users actually DO anything with the information. Should there be a "time to acknowledge" metric? An "unacknowledged changes" count that drives re-notification?

---

## 4. Early Warning / Forecasts

### ✅ Complete and Well-Designed

- **8 signal types**: Deprecation headers, changelog keywords, API version headers, OpenAPI spec diffing, SDK monitoring, GitHub releases, migration guides, status page maintenance. Comprehensive.
- **Escalating reminders**: Countdown at 90, 60, 30, 14, 7, 3, 1, 0 days. Daily cron job (not BullMQ delayed jobs). Smart design choice.
- **Database model**: `forecasts` + `user_forecasts` tables. Dedup key prevents duplicate signals. Per-user acknowledgment and mute state.
- **Alert taxonomy**: 🔮 Forecast → ⏰ Deadline → 🔴 Breaking. Clear escalation path.

### ⚠️ Partially Designed (Needs More Detail)

- **Forecast UI in dashboard**: Where do forecasts appear? In the same change feed? A separate "Early Warnings" tab? The spec defines the data model and the API events (`forecast.new`, `forecast.deadline`) but doesn't describe the dashboard UI for forecasts.
  - **Recommendation**: Dedicated "Early Warnings" section on the dashboard. Card-based layout showing: provider, signal type, evidence summary, countdown (if deadline exists), confidence score, action buttons (acknowledge, dismiss, snooze).

- **Evidence display**: The spec says forecasts track source (which signal type detected it). But can the user see the ACTUAL evidence? "We found the word 'deprecated' in the Stripe changelog, specifically this paragraph: [text]." The `forecasts` table has `raw_signal` and `source_url` but the UI for displaying evidence isn't described.
  - **Recommendation**: Expandable "Evidence" section on each forecast card. Show: source URL (clickable), relevant text snippet (highlighted keywords), confidence breakdown, detection timestamp.

- **Forecast lifecycle**: The spec has `status` on forecasts (presumably new/acknowledged/resolved) and `user_forecasts` has acknowledgment tracking. But:
  - How does a user mark a forecast as "resolved" (they migrated)?
  - Does a resolved forecast stop sending reminders?
  - If a forecast is dismissed, does it come back if MORE evidence appears?
  - **Recommendation**: Forecast statuses: `active` → `acknowledged` → `resolved` / `dismissed` / `superseded`. Dismissed forecasts reactivate if confidence increases by >20 points. Resolved forecasts stop all reminders.

### ❌ Completely Missing

- **Forecast sharing**: Can a user share a forecast with a teammate? "Hey, Stripe is deprecating /v1/charges, FYI." No share/export mechanism designed.

- **Forecast → action bridge**: Same gap as changes. User sees "Stripe may deprecate /v1/charges." Now what? No "create migration task" button, no "notify team" action, no integration with project management tools.

- **Forecast accuracy tracking**: After a forecast deadline passes, was the forecast accurate? Did the deprecation actually happen? There's no mechanism to validate forecast accuracy or display a track record ("Chirri's forecasts have been 87% accurate").
  - **Recommendation**: Post-deadline check. After a Sunset date passes, automatically check if the endpoint is still alive. Update forecast with outcome. Build accuracy metrics over time.

- **Forecast deduplication across signals**: If the changelog says "v1 deprecated," AND the Sunset header appears, AND the OpenAPI spec marks endpoints deprecated — that's 3 signals about the same event. The `dedup_key` field exists but the dedup LOGIC isn't specified. How are these three signals merged into one forecast?
  - **Recommendation**: Define dedup rules per signal type combination. Same provider + same endpoint + same direction (deprecation) = same forecast. Multiple signals increase confidence score rather than creating multiple forecasts.

### ❓ Unanswered Questions

- **What does the countdown look like?** Is there a visual countdown widget? A progress bar? Just text saying "47 days until Sunset"? The reminder schedule is defined but the visual presentation isn't.
- **Can users add their OWN forecasts?** "I know from a conference talk that AWS is deprecating this service in Q4." Can they manually create a forecast? Or is it system-generated only?

---

## 5. Provider / Source Management

### ✅ Complete and Well-Designed

- **Provider detection**: Domain-based matching from 15-20 hardcoded profiles. Type "stripe.com" → see all sources. Clean.
- **Source bundling**: Provider = 1 URL slot. Bundled sources (changelog, status page, SDK) are free with system-controlled intervals. Good economics.
- **Lightweight domain discovery**: For unknown domains, probe ~15 common paths (/changelog, /openapi.json, etc.). Smart.
- **Smart Chirp**: Bonus sources are silent unless change is RELEVANT to the user's primary URL. Relevance filtering by path/version/service. This is genuinely innovative.

### ⚠️ Partially Designed

- **Source management UI**: The spec describes source preferences (per-source alert toggling, severity thresholds, channel routing, digest mode) with plan-based gating. But the actual UI for managing sources isn't described. Is it:
  - A list under each URL detail page?
  - A separate "Sources" tab?
  - Inline toggles next to each source?
  - **Recommendation**: On the URL detail page, show a "Sources" panel listing all discovered sources with toggle switches, severity dropdown, and channel routing dropdown. For provider URLs, show the full source map. For unknown domains, show discovered paths.

- **Adding manual sources**: "Can they add a Stripe blog URL we didn't discover?" The spec's domain discovery probes common paths, but what if the user knows about a source we didn't find? There's `POST /v1/urls` to add any URL, but adding a source to an EXISTING provider isn't described.
  - **Recommendation**: "Add custom source" button on the provider/URL detail page. Lets user add any URL as a source linked to that provider/URL. Counts as 1 additional URL slot (or free if it's a common source type like RSS).

### ❌ Completely Missing

- **Source removal**: The spec mentions roots are "undeletable" but what if discovery finds something wrong? Example: Chirri discovers `/blog` on `stripe.com` and adds it as a source, but it's actually Stripe's corporate blog, not their API changelog. Can the user remove it? Can they say "this isn't relevant"?
  - **Recommendation**: Users can disable or dismiss any discovered source. Dismissed sources don't come back unless the user re-runs discovery. Root sources (the primary URL) can be paused but not deleted without deleting the entire monitor.

- **False discovery handling**: "What if our discovery finds something that ISN'T related to the provider?" The lightweight discovery probes `/changelog`, `/docs`, etc. But `example.com/blog` might be a personal blog, not an API changelog. There's no validation that discovered sources are actually relevant.
  - **Recommendation**: Discovered sources are presented as suggestions ("We found these — want to add them?"), not auto-added. User confirms each one. Show a preview (first 200 chars of content) so they can judge relevance.

- **Source health/status**: For each source, what's its current status? Last checked? Last changed? Error rate? The URL detail page shows this for the primary URL but not for bundled sources.

### ❓ Unanswered Questions

- **How do discovered sources appear in the UI?** Are they shown immediately after adding a URL? Or does discovery run in the background and sources appear later? If later, is there a notification?
- **What happens when a source that was 200 goes to 404?** (e.g., provider removes their changelog page). Is the source automatically disabled? Does the user get notified?

---

## 6. Teams / Collaboration

### ✅ Complete and Well-Designed

- Nothing. Teams are almost entirely undesigned for the product.

### ⚠️ Partially Designed

- **Seat counts by plan**: Pro (3 seats), Business (10 seats). That's it. The pricing table defines how many people, but nothing about what those people can do.

### ❌ Completely Missing

- **Invitation flow**: How do you invite a teammate? Email invite? Link? Do they create their own account? Is there an "invite" page? An API endpoint?
  - **Recommendation**: `POST /v1/team/invites` with email. Invitee receives email, clicks link, creates account (or links existing). Dashboard: "Team" page with invite form and member list.

- **Permissions/visibility model**: What can team members see? Everything in the account? Only URLs they created? Can they delete URLs added by others? Can they change billing?
  - **Recommendation**: Simple model for MVP: team members see all URLs and changes. Only the owner can manage billing. All members can add/remove URLs within plan limits. Per-URL ownership is tracked for audit.

- **Per-user notification preferences**: Can each team member configure their own notification channels? Or does the account owner set notifications for everyone?
  - **Recommendation**: Account-wide defaults set by owner. Each member can override for their own notification channels (e.g., "send MY alerts to my Slack DM, not the team channel").

- **Ownership and transfer**: Who is the "owner"? Can ownership transfer? What happens if the owner's account is deleted?
  - **Recommendation**: Account creator is owner. Ownership can transfer to another team member via settings. Owner deletion is blocked until ownership transfers.

- **SSO for Business**: The pricing table says Business gets SSO. Zero design for how SSO works — SAML? OIDC? Which providers? Configuration UI?
  - **Recommendation**: OIDC with Google Workspace and Okta as launch providers. Configuration: Business admin enters OIDC discovery URL + client credentials. Team members authenticate via SSO instead of email/password. V2 feature — don't design it now, but don't make architectural decisions that prevent it.

### ❓ Unanswered Questions

- **Can team members create API keys?** Are API keys per-user or per-account?
- **Are webhooks per-user or per-account?** If user A sets up a webhook, does user B's URL changes also go to it?
- **What does the audit log look like for team actions?** Who added this URL? Who acknowledged this change?

---

## 7. Billing / Account

### ✅ Complete and Well-Designed

- **Stripe Checkout flow**: User clicks "Upgrade" → Stripe Checkout session → webhook `checkout.session.completed` → plan updated immediately. Standard and correct.
- **Downgrade behavior**: Takes effect at period end. Excess URLs paused (lowest priority first). Email notification. Thoughtful.
- **Payment failure**: Stripe retries 3x, 14 days past_due → downgrade to Free. Never delete data during billing issues. Good.
- **Break-even math**: 6 Indie customers = profitable. Clear-eyed.

### ⚠️ Partially Designed

- **Upgrade flow details**: "New limits active immediately" but what does the user experience? Do they see a success page? A confetti animation? A "you now have 20 URL slots" message? The Stripe redirect back isn't described in terms of UX.
  - **Recommendation**: Redirect to dashboard with a success banner: "Welcome to Indie! You now have 20 URL slots, hourly checks, and webhook access." Show the newly unlocked features.

- **Usage stats**: `GET /v1/account/usage` exists but the response shape isn't fully specified. What exactly is returned? URL count by status? Checks run today/this month? Storage used? The dashboard mentions "activity dashboard" but what's on it?
  - **Recommendation**: Usage endpoint returns: `{ urls: { active: 17, paused: 2, error: 1, limit: 20 }, checks: { today: 408, this_month: 12240 }, storage: { snapshots_mb: 45.2 }, webhooks: { active: 2, limit: 3, deliveries_today: 89 } }`. Dashboard shows this with visual progress bars.

### ❌ Completely Missing

- **Data export format**: `GET /v1/account/export` exists for GDPR compliance. But what FORMAT? JSON? CSV? ZIP of multiple files? How long does the export take? Is it async (request export → get email when ready)?
  - **Recommendation**: Async export. User requests → background job generates ZIP containing: `urls.json`, `changes.json`, `check_history.json`, `forecasts.json`, `account.json`. Email with download link when ready (expires in 7 days).

- **Account deletion flow**: The spec mentions `deleteUserData(userId)` covering all 11+ tables + R2 snapshots. But the USER flow isn't designed:
  - Where is the "Delete account" button? (Settings? Danger zone?)
  - Is there a confirmation step? ("Type DELETE to confirm")
  - Grace period? ("Your data will be deleted in 30 days. Cancel anytime before then.")
  - What email do they get?
  - What happens to their team if they're the owner?
  - **Recommendation**: Settings → Account → Danger Zone → "Delete Account." Type account email to confirm. 30-day grace period with cancellation option. Email confirmation on request and on deletion. Block if they're a team owner (must transfer first).

- **Dunning emails**: Spec says "Stripe retries 3 times" and then downgrade. But does Chirri send ANY emails during this process? "Your payment failed. Please update your card." → "Second attempt failed." → "Final notice: your account will be downgraded in 3 days." These are critical for retention.
  - **Recommendation**: 3 dunning emails: Day 1 (payment failed, update card link), Day 7 (second reminder, what you'll lose), Day 12 (final warning, 2 days until downgrade). Each includes a direct link to Stripe billing portal.

- **Proration display**: When upgrading mid-cycle, Stripe prorates automatically. But does the user see the prorated amount BEFORE confirming? "You'll be charged $6.30 for the remaining 21 days of this billing cycle, then $9/mo starting April 15."

### ❓ Unanswered Questions

- **Annual billing UX**: 20% discount ($7.20/mo billed annually = $86.40/year). Is there a toggle on the pricing page? Can they switch from monthly to annual mid-subscription?
- **What happens to scheduled checks during a downgrade grace period?** If they have 50 URLs and downgrade to Indie (20), the downgrade takes effect at period end. But which 30 URLs get paused? "Lowest priority first" — but how is priority determined? Who decides?

---

## 8. API / MCP

### ✅ Complete and Well-Designed

- **27 endpoints**: Auth (4), API Keys (3), URLs (5+2), Changes (4), Webhooks (5), Account (3), Health (3), Feedback (1). Comprehensive for MVP.
- **Consistent patterns**: Cursor-based pagination, rate limit headers on every response, error format with `doc_url` and `suggestion`. Stripe-quality.
- **Webhook event catalog**: 8 event types covering the full lifecycle. Per-webhook signing secrets with timestamp. Excellent.
- **OpenAPI spec**: Auto-generated via zod-to-openapi, served at `/v1/openapi.json`, interactive docs via Scalar. Self-documenting. ✓
- **Test mode**: `dk_test_` keys return mock data, no real requests. Safe for development.

### ⚠️ Partially Designed

- **API parity with dashboard**: The spec says "every dashboard action maps to an API call." But some dashboard features don't have clear API endpoints:
  - "Check Now" button → Is this `POST /v1/urls/:id/check`? (Yes, mentioned but not in the main endpoint table)
  - "What's New" changelog → Is this served via API? Or just a static dashboard feature?
  - Provider search → No `GET /v1/providers` or `GET /v1/providers/search` endpoint
  - **Recommendation**: Add `GET /v1/providers` (list known providers), `GET /v1/providers/:slug` (get provider detail with source map). Ensure every dashboard action has an API equivalent.

- **Webhook delivery visibility**: `webhook_deliveries` table exists with 30-day retention. But is there a `GET /v1/webhooks/:id/deliveries` endpoint? Can users see delivery attempts, statuses, response codes? The dashboard mentions a "delivery log" in the Integrations page but the API endpoint isn't listed.
  - **Recommendation**: Add `GET /v1/webhooks/:id/deliveries` — paginated list of delivery attempts with timestamp, status code, response body (truncated), retry count.

### ❌ Completely Missing

- **Bulk operations**: There's no bulk import/export for URLs. A user migrating from another tool with 50 URLs has to `POST /v1/urls` 50 times. No `POST /v1/urls/bulk` endpoint.
  - **Recommendation**: Add `POST /v1/urls/bulk` (accepts array of URL objects, max 100). Add `GET /v1/urls/export` (returns all URLs as JSON for backup/migration). Essential for the "UptimeRobot migration" use case.

- **MCP server design**: Listed as V1.1 (non-negotiable). But zero design exists. What MCP tools does Chirri expose? Read-only (list URLs, get changes, get forecasts) or read-write (add URLs, acknowledge changes)? What's the MCP server URL? How does auth work for MCP?
  - **Recommendation**: MCP tools: `list_urls`, `get_url`, `add_url`, `list_changes`, `get_change`, `acknowledge_change`, `list_forecasts`, `check_now`. Auth via API key in MCP config. Read-write from day 1 — agents need to manage monitors, not just view them.

- **Rate limit granularity**: Rate limits are per-plan and per-minute/per-hour. But is there per-endpoint rate limiting? A user making 120 requests/min to `GET /v1/changes` while a webhook delivery needs to call back — do they share the same limit?
  - **Recommendation**: Global per-key limit (as designed) is fine for MVP. Add per-endpoint limits only if abuse patterns emerge.

### ❓ Unanswered Questions

- **Is there an API versioning strategy?** The spec uses `/v1/` but doesn't discuss what happens when `/v2/` ships. Are breaking changes to the API detected by... Chirri itself? (Meta-monitoring.)

---

## 9. Empty States & Onboarding

### ✅ Complete and Well-Designed

- **"Plant a Seed" metaphor**: Japanese garden metaphor is unique and memorable. Plant → Grow → Chirp. Good brand alignment.
- **Quick-add provider buttons**: "Monitor OpenAI" / "Monitor Stripe" / "Monitor GitHub" — one-click adds for top 5 providers. Great for first-time experience.

### ⚠️ Partially Designed

- **Zero-URL dashboard**: What does a brand new user see? The spec mentions "Overview" with "Total URLs, active/paused/error counts, changes in last 7/30 days, quick-add form." But with zero URLs, all those counts are 0. Is there a welcome screen? A getting-started guide?
  - **Recommendation**: Empty state with: (1) Welcome message using "Plant a Seed" metaphor, (2) Quick-add buttons for popular providers, (3) "Or paste any URL" input field prominently displayed, (4) Brief explanation of what Chirri does with a 30-second animated demo.

- **Time to "aha moment"**: The spec identifies the Change Detail View as the conversion screen. But the fastest path to seeing a change is: add URL → wait for learning (10 min) → wait for first check → wait for something to change (could be days/weeks). The "aha moment" is potentially VERY far from signup.
  - **Recommendation**: Show a DEMO change immediately. "Here's what it looks like when Stripe changes their API" — a pre-populated Change Detail View with real data from pre-launch monitoring. Let users experience the value before their own monitoring produces results.

### ❌ Completely Missing

- **Guided onboarding tour**: No guided tour or step-by-step walkthrough described. First-time users land on the dashboard and have to figure out what to do.
  - **Recommendation**: Simple 3-step onboarding: (1) "Plant your first seed" — add a URL with big input field, (2) "Set your preferences" — choose notification channel, (3) "You're done!" — what to expect next. Not a product tour — just a focused first-run experience.

- **Try before signup**: "What if they just want to TRY it without signing up?" The spec requires account creation before anything. The CLI (`npx chirri check <url>`) is V1.1.
  - **Recommendation**: Landing page interactive demo: "Paste a URL and see what we'd monitor." Show the auto-classification result (content type, monitoring method, estimated check count) without requiring signup. No actual monitoring — just the classification preview.

- **Example/demo data**: No pre-populated demo data for new accounts. User signs up, sees empty dashboard. The pre-launch monitoring of 50 APIs generates data, but it's not exposed to new users.
  - **Recommendation**: "Explore" section on dashboard showing recent changes detected across popular APIs (anonymized/public data). "Stripe changed 3 times this week — see what changed." Drives curiosity and demonstrates value.

- **Onboarding email sequence**: No post-signup email flow described. User signs up → email verification → then what? No "welcome" email, no "here's how to get started" email, no "you haven't added any URLs yet" nudge email.
  - **Recommendation**: 3-email onboarding sequence: Day 0 (welcome + quick start), Day 2 (if no URLs added: "Plant your first seed" reminder), Day 7 (weekly stability report even if it says "No URLs monitored yet — here's what you're missing").

### ❓ Unanswered Questions

- **What does the free plan limitation look like in-dashboard?** When a Free user tries to add a 4th URL, what happens? An error message? An upgrade prompt? A soft gate with "upgrade to unlock more"?

---

## 10. Error States & Edge Cases

### ✅ Complete and Well-Designed

- **Circuit breaker per domain**: >50% failures → 5-minute backoff. Prevents resource waste.
- **Canary check**: >50% of ALL checks detect changes → something wrong with US → auto-pause alerting. Brilliant self-protection.
- **Graceful degradation**: R2 outage → checks continue with hash-only. Redis → Postgres as source of truth. Well-designed resilience.

### ⚠️ Partially Designed

- **Chirri service outage**: What does the USER see if our service is down? The spec mentions UptimeRobot monitoring /health and Instatus for a status page. But:
  - Does the dashboard show a banner? "We're experiencing issues. Monitoring may be delayed."
  - Do users get an email? "Some of your scheduled checks may have been delayed."
  - Is there a public status page (status.chirri.io)?
  - **Recommendation**: Public status page at status.chirri.io (Instatus free tier, mentioned in spec). Dashboard banner that reads from status page API. Post-incident email to affected users: "We experienced a 23-minute outage. All missed checks have been recovered."

- **Webhook endpoint failure**: "Do we show delivery failures?" The `webhook_deliveries` table logs delivery attempts. But:
  - Is there a dashboard indicator showing "3 of your last 10 webhook deliveries failed"?
  - The spec says "disable after 3 days consecutive failures" — does the user get warned before disabling?
  - **Recommendation**: Dashboard badge on Integrations page: "⚠️ Webhook failing" when >3 consecutive failures. Email after 24h of failures: "Your webhook is failing. We'll disable it in 2 days if not fixed." Show delivery log with response codes.

### ❌ Completely Missing

- **All endpoints down at once**: What if every URL a user monitors goes down simultaneously? Mass failure scenario. Do they get 20 separate "endpoint down" notifications? Or one aggregated "Multiple endpoints are unreachable"?
  - **Recommendation**: Aggregate notifications when >3 URLs from the same domain fail simultaneously. Single notification: "5 Stripe endpoints are unreachable. This may be a provider-wide outage." Link to provider's status page if known.

- **Plan limit hit mid-month**: User is on Indie (20 URLs). They have 20 URLs. They try to add #21. The error message exists (`url_limit_exceeded`). But:
  - Is there a pre-emptive warning? "You've used 19/20 URL slots."
  - Is there an `account.usage_alert` event? (Yes, mentioned in webhook events but not defined when it fires)
  - Does the dashboard show usage clearly? (Not described)
  - **Recommendation**: Dashboard header shows "17/20 URLs" with progress bar. Warning notification at 80% (16/20). Alert at 100%. Usage prominently visible, not buried in settings.

- **Shared monitoring edge cases**: "What if they try to add a URL that another user is already monitoring?" The shared monitoring system handles this cleanly (one fetch, fan-out per user). But:
  - Does the user know their URL is being shared? (Probably shouldn't for privacy)
  - What if User A adds `api.stripe.com/v1/prices` with custom header `X-Custom: foo` and User B adds the same URL without headers? Different shared_url keys → different monitors. Fine. But what if User A later REMOVES their custom header? Does the monitor merge with User B's? Or stay separate?
  - **Recommendation**: Shared monitoring is invisible to users (by design). If a user changes headers on their URL, create a new shared_url entry and delete the old one (if no other users reference it). Don't merge.

- **URL returns completely different content**: User monitors an API endpoint. The provider does a major redesign and the endpoint now returns a completely different schema. Is this detected as a single massive change? Does it reset the baseline? Does the learning period restart?
  - **Recommendation**: Major schema changes (>50% of fields changed) trigger a special "major restructuring" alert type with a recommendation: "This endpoint's response has fundamentally changed. You may want to review your integration thoroughly." Don't restart learning — the new response becomes the baseline after confirmation.

### ❓ Unanswered Questions

- **What happens during a provider's maintenance window?** Statuspage.io shows "scheduled maintenance." Does Chirri suppress change detection during announced maintenance? Or does it alert and then correlate with the status page?
- **What if a URL starts returning a Cloudflare challenge page?** The spec mentions "detect Cloudflare challenge pages" but doesn't specify what happens. Is it treated as an error? Does the user get notified?

---

## 11. Things Nobody Has Mentioned Yet

### ✅ Exists

- **Filtering by severity/type/date**: `GET /v1/changes` is filterable by URL, severity, type, date. Basic filtering exists.

### ⚠️ Partially Designed

- **Search**: No search functionality mentioned anywhere. Can users search their changes? Search across URLs? Search for a specific field name across all changes? This is essential at scale (50+ URLs, hundreds of changes).
  - **Recommendation**: Add full-text search on change summaries and URL names. `GET /v1/changes?q=deprecated`. Dashboard search bar that searches across URLs, changes, and forecasts.

### ❌ Completely Missing

- **Sorting options**: The change feed is "chronological." Can users sort by severity (most severe first)? By provider? By acknowledgment status (unacknowledged first)?
  - **Recommendation**: Sort options: newest first (default), oldest first, most severe first, unacknowledged first. Add `sort` parameter to `GET /v1/changes`.

- **Bulk actions**: No bulk acknowledge, bulk dismiss, bulk export. If a user has 50 unacknowledged changes from a provider's routine update, they have to acknowledge each one individually.
  - **Recommendation**: Checkbox selection + "Acknowledge selected" / "Dismiss selected" / "Export selected" buttons. Also: "Acknowledge all from [provider]" shortcut.

- **Keyboard shortcuts**: Zero keyboard navigation mentioned. Power users (developers!) expect: `j`/`k` to navigate changes, `a` to acknowledge, `f` to mark false positive, `/` to search.
  - **Recommendation**: V1.1 feature. Start with `j`/`k` navigation and `?` for shortcut reference.

- **Dark mode**: The brand spec says "Dark mode default" for the dashboard with Night `#0F0F0F` background. But the landing page says "Snow `#FAFAFA`." Is the dashboard dark-only? Does the user have a choice? Is there a toggle? The spec contradicts itself — one place says "White + sakura pink" for the dashboard, another says "Dark mode default."
  - **Recommendation**: Clarify. Dashboard: dark mode default with light mode toggle. Landing page: light mode. Respect system preference. This is a developer tool — dark mode is expected.

- **Mobile experience**: The spec mentions "responsive: falls back to unified diff on mobile" for the Change Detail View. But is the DASHBOARD responsive? Is URL management usable on a phone? Change feed? The landing page? None of this is specified.
  - **Recommendation**: Dashboard should be usable on tablet. Phone: read-only experience (view changes, acknowledge, mark feedback). URL management on phone is probably bad UX — don't optimize for it, but don't break it.

- **Notifications history page**: Where can a user see ALL past notifications? The `notifications` table logs everything, but is there a "Notification History" page in the dashboard? Can they see: what was sent, when, to which channel, delivery status?
  - **Recommendation**: "Notifications" page in dashboard. Chronological list of all notifications sent, with: timestamp, channel (email/webhook/Slack/Discord), delivery status (sent/delivered/failed), linked change. Filter by channel and status.

- **API key management details**: Users can create and revoke API keys. But:
  - Can they NAME their keys? ("Production key," "CI/CD key," "Testing key")
  - Can they see usage stats per key? (Requests today, last used timestamp)
  - Can they set per-key permissions? (Read-only key for monitoring dashboards)
  - **Recommendation**: Named keys (MVP). Usage stats per key (V1.1). Per-key permissions (V2).

- **Audit log for teams**: The spec mentions team features in V2. But even for solo users, an activity log is useful: "API key created," "URL added," "Plan upgraded," "Webhook configured." Not designed.
  - **Recommendation**: Simple activity log on Account page. For team plans: who did what, when. Stored in a `audit_log` table.

- **Timezone handling**: All timestamps are ISO 8601 UTC. But the dashboard — does it show UTC? Local time? Is there a timezone setting? A developer in Tokyo seeing "Change detected at 02:00" — is that 02:00 UTC or 02:00 JST?
  - **Recommendation**: Dashboard converts to user's local timezone (detected from browser). Show relative time by default ("2 hours ago") with hover for absolute time in local timezone. UTC option in settings for purists.

- **Data visualization**: TTFB graph and uptime % are mentioned. But what charting library? What time ranges? Can users zoom in? Is it a simple sparkline or a full interactive chart? Are there any other visualizations (change frequency over time, checks per day)?
  - **Recommendation**: Simple sparkline for TTFB (last 7/30/90 days depending on plan). Uptime % as a number with a small bar chart. Change frequency as a histogram. Don't over-invest in visualization for MVP — basic charts are fine.

### ❓ Unanswered Questions

- **Email deliverability**: Resend is the email provider. But has deliverability been considered? SPF/DKIM/DMARC setup? Will emails from `chirri.io` land in inbox or spam? Domain warming?
- **Accessibility**: No mention of WCAG compliance, screen reader support, or keyboard navigation (beyond shortcuts). Is this a consideration?
- **Internationalization**: The product is English-only. Is i18n a future consideration? The Japanese brand name might confuse users expecting Japanese language support.

---

## 🔴 Top 10 Most Critical Gaps (Prioritized)

These are the items that would most frustrate a real user, ordered by impact:

### 1. **No workflow after detection** (Section 3)
The product detects a change and then... nothing. No ticket creation, no status tracking beyond "acknowledged," no assignment, no due dates. Detection without action is a notification, not a tool. Users will screenshot the diff and paste it into Slack/Jira manually — every time.

**Fix:** Add change statuses (`new` → `acknowledged` → `in_progress` → `resolved`), copy-to-clipboard button (formatted markdown), and a "Create issue" integration framework (Linear/Jira/GitHub Issues in V1.1).

### 2. **No check history API endpoint** (Section 1)
Users can see changes but not individual checks. "Did Chirri actually check my URL at 3am?" — unanswerable without `GET /v1/urls/:id/checks`. This undermines trust, especially for paid users.

**Fix:** Add `GET /v1/urls/:id/checks` — essential for MVP.

### 3. **Empty dashboard for new users** (Section 9)
User signs up, sees zeros everywhere, doesn't know what to do. The "aha moment" is days or weeks away. No demo data, no guided tour, no interactive preview.

**Fix:** Empty state with demo change, quick-add buttons (already planned), and 3-step onboarding flow.

### 4. **No search functionality** (Section 11)
At 20+ URLs with weeks of history, users need to search. "Find all changes mentioning 'deprecated'" — impossible without search.

**Fix:** Full-text search on change summaries, URL names, and forecasts. MVP feature.

### 5. **Pause/Resume behavior undefined** (Section 1)
Users WILL want to pause monitoring. Does it free the slot? Does it reset the baseline? Total ambiguity.

**Fix:** Define clearly: paused URLs keep the slot, resume from existing baseline, warn if paused >30 days.

### 6. **HTML diff is just a hash comparison** (Section 2)
~20% of monitors will be docs/changelog pages. Users monitoring `stripe.com/docs/upgrades` get told "content hash changed" with no visual diff. Useless for their most important use case.

**Fix:** Extract text content from HTML, show text-level diff. Not perfect but dramatically more useful.

### 7. **No bulk operations** (Section 8)
UptimeRobot migration users have 50+ URLs. Adding them one at a time via `POST /v1/urls` is painful. No bulk import.

**Fix:** Add `POST /v1/urls/bulk`. Essential for the migration capture strategy.

### 8. **No onboarding email sequence** (Section 9)
User signs up, verifies email, and then... silence until their first change (which might be weeks). No nurturing, no guidance, no re-engagement.

**Fix:** 3-email onboarding sequence: welcome, reminder if no URLs, first weekly report.

### 9. **No notification history page** (Section 11)
"Did Chirri send me a notification about that change?" — unanswerable from the dashboard. The data exists in the `notifications` table but there's no UI for it.

**Fix:** Notification history page with delivery status. Users need to trust that notifications are working.

### 10. **Dark mode inconsistency** (Section 11)
The brand spec contradicts itself: "White + sakura pink" vs "Dark mode default." Developers expect dark mode. This needs a clear decision.

**Fix:** Dashboard defaults to dark mode (brand says so). Landing page is light. User can toggle. Settle this before Week 4 (Dashboard week).

---

## Summary

The **detection engine** is brilliantly designed — learning periods, multi-layer fingerprinting, confirmation rechecks, SSRF prevention, shared monitoring. This is world-class engineering design.

The **gaps are all in the human layer** — what happens after detection, how users collaborate, how they manage their workflow, how they onboard, how they find things in their data. The product is designed as a detection engine with a viewer, not as a workflow tool.

**The fundamental question the spec doesn't answer:**

> A user's API just broke because of a detected change. They see the diff. Now what? Where do they track the fix? How do they tell their team? How do they know when it's resolved? How do they prevent it from being flagged again?

Chirri currently answers "WHAT changed" beautifully. It doesn't answer "WHAT DO I DO ABOUT IT" at all.

**Recommendation:** Before writing `package.json`, spend 2-4 hours designing the post-detection workflow. Even simple status tracking (`new` → `acknowledged` → `resolved`) with a copy-to-clipboard button would close the biggest gap. The rest can be V1.1.

---

*Teardown complete. 50 missing items identified. 23 items need more detail. 21 questions remain unanswered.*
*Reviewed against: CHIRRI_PRODUCT_BIBLE.md, DELTA_API_MASTER_SPEC.md, CHIRRI_DEFINITIVE_PLAN.md*
