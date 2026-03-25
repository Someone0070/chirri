# Chirri Frontend UX Review

**Reviewer:** UX Research & Interaction Design  
**Date:** 2026-03-24  
**Document Reviewed:** CHIRRI_FRONTEND_BIBLE.md v1.0  
**Scope:** UX only — no visual design commentary (colors, fonts, spacing excluded)

---

## Executive Summary

The Frontend Bible is impressively thorough for a V1 spec. The page structure is logical, the Change Detail ("money screen") is well-conceived, and error states are better specified than most products at this stage. However, there are significant UX gaps in **provider discovery confusion**, **onboarding expectation management**, **forecast actionability**, and **mobile usability for the core diff experience**. The biggest risk is users adding a URL, seeing nothing happen for days, and churning before they ever get value.

---

## 1. Information Architecture

### 1.1 Sidebar Navigation Is Mostly Solid, With One Confusing Grouping

**Problem:** Settings sub-pages (API Keys, Webhooks, Integrations, Billing) are linked FROM settings but live at `/settings/api-keys`, `/settings/webhooks`, etc. The sidebar nav shows top-level items (Dashboard, URLs, Changes, Forecasts, Settings) but doesn't show these sub-pages. A user on `/settings/api-keys` has no sidebar indication of where they are — they're inside Settings, but there's no nested nav visible.

**Why it matters:** Users lose spatial orientation. "Where am I? How do I get back? How do I get to Webhooks from API Keys?" They have to go back to Settings, then click through again.

**Severity:** Frustrates users

**Fix:** Either (a) show Settings sub-items as collapsible children in the sidebar when Settings is expanded, or (b) add a secondary nav (tabs or vertical sub-nav) on the Settings page itself that persists across sub-pages. Linear and GitHub both handle this well.

### 1.2 Click Count Analysis — Common Tasks

| Task | Clicks | Assessment |
|---|---|---|
| Add URL | 2 (sidebar → /urls/new → submit) | ✅ Good |
| View a change | 2 (sidebar → changes → click card) | ✅ Good |
| Acknowledge/Track a change | 3 (sidebar → changes → card → Track button) | ✅ Acceptable |
| Create ticket from change | 4 (sidebar → changes → card → Create Ticket → fill modal → submit) | ✅ Acceptable |
| Toggle alerts on a source | 4-5 (sidebar → URLs → provider → Sources tab → find source → toggle) | ⚠️ Deep |
| Check webhook delivery logs | 4 (sidebar → Settings → Webhooks → specific webhook → deliveries) | ⚠️ Deep |
| See why a URL is erroring | 3 (sidebar → URLs → provider → read banner) | ✅ Good |

**Problem:** Managing individual source alert preferences is buried 4-5 clicks deep. For a product whose core value is "we alert you when things change," alert configuration is surprisingly hard to reach.

**Severity:** Frustrates users (for power users managing many sources)

**Fix:** Add a quick-action on the dashboard URL health table — a small settings icon per URL that opens a slide-out with source toggles, skipping the full provider detail page.

### 1.3 No Dedicated "URLs" List Page in Sidebar?

**Problem:** The sidebar has "Dashboard" as home, and URLs live at `/urls`. But the sidebar nav items listed in Section 2.6 are: Dashboard, URLs, Changes, Forecasts, Settings. The URL List page (3.2 calls it Provider Detail at `/urls/:id`) exists, but there's no explicit "URL List" page spec at `/urls` (only the route appears in the appendix). The Dashboard *contains* a URL health table, but limited to 20 items.

**Why it matters:** At 50+ URLs, users need a dedicated list view with search/filter/sort/bulk actions. The spec has this in the appendix route mapping but doesn't spec out the page behavior, states, filters, or bulk actions.

**Severity:** Blocks users (at scale)

**Fix:** Add a full `/urls` page specification with: search, status filter, sort (name, last check, most changes), bulk pause/resume/delete, and pagination. This is a critical gap.

---

## 2. User Flows

### Flow A: New User Signup → First Value

#### 2A.1 The Time-to-Value Gap Is the Biggest UX Risk

**Problem:** User signs up → adds URL → sees "Learning... 0/30 checks" → waits 10 minutes minimum for learning, then 7 days of hidden calibration. During calibration, only critical changes (5xx, 404) trigger alerts. The user may not see ANY change notification for days or weeks. They will think the product is broken or useless.

**Why it matters:** This is a conversion killer. User signs up with excitement, adds their URL, and then... nothing. For days. The spec says calibration is "hidden from user — shows as Active." So the user sees "Active" but gets no alerts. They'll think "this thing doesn't work" and never come back.

**Severity:** Blocks users (churn risk during trial period)

**Fix:** 
1. **Show a "first change" simulation** during onboarding. When they add their first URL, show them what a change notification LOOKS like using sample data from the public API feed. "Here's what it looks like when Stripe changes their API. You'll get one of these for YOUR endpoint when something changes."
2. **Send a "baseline captured" email** after learning completes: "We've mapped your endpoint. Here's what we found: 47 fields, 3 we'll ignore (volatile), 44 we're watching. You're protected."
3. **Proactively surface the first check result** even if nothing changed: "First check complete! Everything looks stable. We'll keep watching."
4. **Consider a "test change" feature**: Let users manually trigger a diff against a modified version of their endpoint response, so they can see the product work immediately.

#### 2A.2 The "Plant a Seed" Metaphor — Charming But Risky

**Problem:** "Plant your first seed" is cute for a brand built on nature metaphors. But for a developer tool, "planting seeds" doesn't communicate what actually happens. A user who just wants to monitor an API for changes has to translate: seed = URL? plant = add? When does it grow?

**Why it matters:** Metaphors should clarify, not add a translation layer. Developers especially prefer direct language.

**Severity:** Minor annoyance

**Fix:** Keep the metaphor in the branding/marketing, but pair it with plain language in the UI. Instead of JUST "Plant your first seed," use: "Plant your first seed — Add a URL to start monitoring" where the second part is the subtitle in regular weight.

#### 2A.3 Public API Feed Is Smart But Needs Better Framing

**Problem:** The public API feed shows changes from 50 popular APIs. For a new user with 0 monitors, this could be confusing: "Why am I seeing Stripe changes? I didn't add Stripe." The spec says it "demonstrates product value immediately" — true, but only if the user understands it's a demo/preview.

**Why it matters:** Confusion at onboarding = abandonment.

**Severity:** Frustrates users

**Fix:** Frame it explicitly: "**Live from the API ecosystem** — These are real changes Chirri detected this week across popular APIs. Add your own URLs to get personalized alerts." Add a subtle visual distinction (different background, dashed border) so it's clearly "not your data."

### Flow B: Change Detected → User Acts On It

#### 2B.1 The Change Detail Page Is Well-Designed

The "money screen" spec is strong. Summary panel above diff, action bar with clear workflow states, Monaco diff viewer with appropriate responsive behavior. This is clearly where the most thought went. A few issues:

#### 2B.2 Workflow States Need Better Labeling

**Problem:** The states are Tracked / Ignored / Snoozed / Resolved. "Tracked" is ambiguous — does it mean "I'm aware of it" or "I'm actively working on it"? In issue trackers, "tracked" means logged/recorded. Here it seems to mean "acknowledged." And "Ignored" carries a judgmental tone — it implies the change doesn't matter, but the user might just not want to deal with it now (that's what Snooze is for... or is it?).

**Why it matters:** Ambiguous workflow states → users don't use them → the triage system fails → the changes feed becomes a wall of noise.

**Severity:** Frustrates users

**Fix:** Consider renaming: "Tracked" → "Acknowledged" (or keep "Tracked" but add a tooltip: "Mark as seen — you're aware of this change"). "Ignored" → "Dismissed" (less judgmental). Or add brief inline descriptions on first use.

#### 2B.3 Diff Viewer for Non-JSON-Experts

**Problem:** The diff viewer shows raw JSON/YAML/XML with Monaco syntax highlighting. For a developer who knows JSON, this is perfect. But the target audience includes "solo hobbyists" — some of whom may be frontend devs, mobile devs, or junior devs who don't regularly read API specs. A renamed field in a 500-line OpenAPI spec is a needle in a haystack.

**Why it matters:** If users can't quickly understand the diff, the entire product value collapses. The LLM summary helps, but it's above the fold — users might scroll past it to the diff and get lost.

**Severity:** Frustrates users

**Fix:** 
1. Keep the summary panel **sticky** or add a floating "Summary" toggle that persists while scrolling the diff.
2. Add **change annotations** in the diff gutter — small labels like "field renamed," "field added," "type changed" next to the relevant lines.
3. Consider a **"Simple view"** toggle that shows only changed lines with plain-English annotations, hiding unchanged context. Power users get the full diff; everyone else gets the curated view.

#### 2B.4 No Quick Triage From the Changes Feed

**Problem:** To act on a change (Track/Ignore/Resolve), you must click into the Change Detail page. You can't triage from the Changes Feed list.

**Why it matters:** A user with 15 new changes needs to click into each one, triage, go back, click the next one... This is 45+ clicks for basic triage. Gmail solved this years ago with inline actions.

**Severity:** Frustrates users (heavily, at scale)

**Fix:** Add inline triage actions on Change Cards in the feed. At minimum: a Track button and a "..." menu with Ignore/Snooze/Resolve. Let users triage without leaving the list. Consider swipe actions on mobile.

### Flow C: Managing Many URLs

#### 2C.1 No URL List Page Spec

**Problem:** As noted in 1.3, the `/urls` page isn't specified beyond a route in the appendix. At 50+ URLs, the dashboard's 20-item URL health table is insufficient. There's no spec for:
- Search by URL or provider name
- Filter by status (healthy/error/learning/paused)
- Sort (alphabetical, most changes, last checked, worst health)
- Bulk actions (pause all, resume all, delete selected)
- Grouping by provider/domain

**Why it matters:** This is a critical page for any user beyond the free tier. Without it, the product doesn't scale.

**Severity:** Blocks users

**Fix:** Spec out a full URL list page. Include: data table with search bar, status filter pills, sortable columns, checkbox selection with bulk action bar, and card view on mobile.

#### 2C.2 No Global Search

**Problem:** There's a search within the Changes Feed (full-text on summaries) and a provider search when adding URLs. But there's no global search. If a user wants to find "anything related to Stripe" — URLs, changes, forecasts — there's no single place to do that.

**Why it matters:** At scale, users think in terms of providers, not page types. "What's going on with Stripe?" shouldn't require checking 3 different pages.

**Severity:** Frustrates users (at scale)

**Fix:** Add a global search accessible via `Cmd+K` (already hinted at in the search input spec). Results grouped by type: URLs, Changes, Forecasts. This is a V1.1 feature at minimum, but the affordance (Cmd+K hint) should be in V1.

### Flow D: Provider Discovery

#### 2D.1 The Source Auto-Discovery Is the Biggest Confusion Risk

**Problem:** User adds `stripe.com/v1/prices`. Chirri auto-discovers 4 additional sources: changelog, OpenAPI spec, status page, SDK releases. The "Add URL" flow (Step 2a) shows these as checkboxes. BUT: the spec says these bonus sources are added with **alerts off by default** (grey/silent dots in the tree). 

So the user checks the boxes, clicks "Start Monitoring," and then... only gets alerts for the one URL they actually typed. The changelog, OpenAPI spec, etc. are being monitored but silently. The user has to go to Provider Detail → Sources tab → toggle alerts on for each source individually.

**Why it matters:** This is confusing in two ways: (1) "I checked the boxes, why aren't I getting alerts?" and (2) "I added one URL, why does my dashboard show a tree with 5 things?"

**Severity:** Frustrates users (high — this is a core flow)

**Fix:** 
1. In the Add URL flow, make the checkbox meaning explicit: "[x] Monitor Stripe Changelog — **Alerts: On** [toggle]" — let users enable alerts right there during setup, per source.
2. After adding, show a brief explanation: "We found 4 additional intelligence sources for Stripe. They're monitoring silently — toggle alerts on any source from your dashboard."
3. Consider defaulting to **alerts ON** for at least the most critical sources (OpenAPI spec changes, status page) and letting users opt out.

#### 2D.2 "Roots Can't Be Deleted" Will Frustrate Users

**Problem:** Bonus sources (roots) cannot be deleted, only muted. The metaphor is "you can't rip out the roots of a tree." This is poetic but will confuse and frustrate users who see 4 things they didn't add and can't remove.

**Why it matters:** Users expect control over their dashboard. Undeletable items they didn't explicitly add feel like the product is overriding their agency. Some users will see this as bloat.

**Severity:** Frustrates users

**Fix:** 
1. Allow deletion (or at least "hiding") of individual roots. If the product really needs them for intelligence, keep monitoring them in the background but remove them from the UI entirely when "hidden."
2. If deletion truly isn't possible, reframe the UX: instead of "Mute," use "Hide" — removes from the tree visualization, stops ALL alerts, and adds a collapsed "4 hidden sources" link at the bottom of the tree for users who want to re-enable them.

### Flow E: Forecast / Early Warning

#### 2E.1 Users Won't Know What to DO With a Forecast

**Problem:** A forecast says "Stripe /v1/charges Deprecation — confidence 95 — 47 days remaining." The actions available are: Acknowledge (mutes reminders), Dismiss (mark as false positive / not relevant / already migrated). Neither of these helps the user actually RESPOND to the forecast.

**Why it matters:** A warning without a clear action path is just anxiety. "Great, Stripe is deprecating something. Now what?" The user needs to: check if they use that endpoint, plan a migration, maybe create a ticket. The forecast doesn't connect to any of those actions.

**Severity:** Frustrates users

**Fix:** Add actionable responses:
1. **"Create migration ticket"** — same as the Create Ticket modal, pre-filled with forecast info.
2. **"View affected endpoints"** — the spec mentions an "affected endpoints list" but it should be the PRIMARY action, not a detail buried in the page. Show it prominently: "This affects 3 of your monitored URLs: [links]."
3. **"Set reminder"** — instead of just "Acknowledge" (which mutes), let users set a specific reminder date: "Remind me 2 weeks before deadline."

#### 2E.2 Confidence Score Is Meaningless Without Context

**Problem:** "Confidence: 95" — 95 what? Percent? Out of 100? Compared to what? Is 60 good or bad? The spec shows a "confidence score bar (0-100)" but doesn't explain to the user what this number means or how to interpret it.

**Why it matters:** Unexplained numbers erode trust. Users will either ignore the score entirely or assign incorrect meaning to it.

**Severity:** Minor annoyance (but undermines trust in forecasts)

**Fix:** Add a tooltip or inline explanation: "Confidence: 95% — Based on 3 independent sources confirming this change. [What does this mean?]" Link to a brief help article explaining the scoring methodology. Consider replacing the number with a qualitative label: "Very likely" / "Likely" / "Possible" / "Uncertain."

---

## 3. Cognitive Load

### 3.1 Provider Detail Page Has Too Many Tabs

**Problem:** Provider Detail has 5 tabs: Overview, Changes, Check Log, Sources, Forecasts. Most users will only care about 2-3 of these regularly. The Overview tab itself contains metric cards, a TTFB sparkline, response size trend, AND action buttons. That's a lot for one tab.

**Why it matters:** Tab overload → users don't explore → they miss features → they don't get full value.

**Severity:** Minor annoyance

**Fix:** Consider combining: Overview + Sources (sources are part of "understanding this URL"), and showing Forecasts inline on Overview when they exist (rather than a separate tab). Check Log can be behind a "View all checks" link. This reduces to 3 tabs: Overview, Changes, Check Log — which covers 95% of use cases.

### 3.2 Settings Page Has a "Danger Zone" Pattern Without Enough Separation

**Problem:** Account settings (name, email, timezone) and Danger Zone (Export Data, Delete Account) are on the same page. One wrong scroll and a user is looking at "Delete Account" while they were trying to change their timezone.

**Why it matters:** Proximity to destructive actions creates anxiety, even subconsciously.

**Severity:** Minor annoyance

**Fix:** Move Danger Zone to a separate sub-page (`/settings/account/danger`) or put it behind an "Advanced" expandable section that's collapsed by default. Linear does this well.

### 3.3 Pricing Page Needs a 5-Second Scan Path

**Problem:** The spec mentions 4 plan cards (Free, Personal, Team, Business) with a feature comparison. But there's no mention of a "recommended" indicator, no quick-comparison mechanism, and no clear differentiation of what the KEY difference is between tiers.

**Why it matters:** Users spend ~5 seconds on pricing before deciding to scroll down or bounce. If they can't identify which plan is for them instantly, they leave.

**Severity:** Frustrates users (conversion impact)

**Fix:** 
1. Add a "Most Popular" badge on the recommended plan (Personal or Team).
2. Lead each card with the ONE key differentiator in large text: "5 URLs," "20 URLs," "100 URLs," "Unlimited."
3. Add a single-line "Best for:" descriptor: "Best for: hobby projects" / "Best for: solo developers" / "Best for: small teams" / "Best for: companies."

### 3.4 The Changes Feed Filter Bar Is Feature-Rich But Overwhelming

**Problem:** The filter bar has: severity multi-select, workflow state multi-select, URL/provider dropdown, change type filter, date range picker, search, and sort. That's 7 filter controls visible at once.

**Why it matters:** Filter overload → users don't filter → the feed becomes noise → they stop checking it.

**Severity:** Minor annoyance

**Fix:** Show 2-3 primary filters by default (severity, workflow state, search). Put the rest behind a "+ More filters" expandable. Save the user's last-used filter configuration so they don't have to re-set it every visit.

---

## 4. Error Recovery

### 4.1 SSRF-Blocked URLs Give No Useful Guidance

**Problem:** When a user enters a private network URL, they see: "This URL can't be monitored (private network)." That's it. No explanation of WHY, no guidance on what URLs ARE supported.

**Why it matters:** The user doesn't know what "private network" means in this context. They might be trying to monitor their staging server and not understand why it doesn't work.

**Severity:** Frustrates users

**Fix:** "This URL points to a private/internal network and can't be monitored for security reasons. Chirri can only monitor publicly accessible URLs. [Learn more about supported URLs]." If this is a common issue, consider a help article about monitoring internal APIs (e.g., via webhook/push-based approach).

### 4.2 No Recovery Path for Expired Integration Tokens

**Problem:** Integrations (Slack, Jira, etc.) use OAuth. OAuth tokens expire. There's no spec for what happens when a token expires mid-use. Does the integration card show "Expired"? Does the user get an alert? Can they re-auth without disconnecting and reconnecting?

**Why it matters:** Silent integration failures = missed notifications = the user thinks Chirri failed when actually Slack auth expired.

**Severity:** Blocks users (they miss critical alerts)

**Fix:** 
1. Add a "Reconnect" state to integration cards: icon, "Connection expired — Reconnect" button.
2. Send an email when an integration token fails: "Your Slack integration needs attention. Reconnect to keep receiving alerts."
3. Show a persistent banner on the dashboard when any integration is unhealthy.

### 4.3 Payment Failure Recovery Is Minimal

**Problem:** Payment failure shows: "Payment failed. Update your payment method." + link. But what happens to the user's monitors during payment failure? Are they paused? Downgraded? Still running with a grace period?

**Why it matters:** Payment failure + ambiguous state = panic. "Are my monitors still working? Am I going to miss a breaking change because my card expired?"

**Severity:** Frustrates users (high anxiety)

**Fix:** Be explicit: "Payment failed. Your monitors are still running — you have a 7-day grace period to update your payment method. After [date], your account will be downgraded to Free (5 URLs, checks every 24h). [Update payment method]"

### 4.4 No Error State for "URL Returns Different Content Each Time"

**Problem:** Some APIs return different content on each request (e.g., responses with timestamps, request IDs, pagination tokens). The learning phase should catch volatile fields, but there's no specified error state for "we can't establish a stable baseline." 

**Why it matters:** If the baseline never stabilizes, the user gets flooded with false positives or (during calibration) gets nothing and doesn't know why.

**Severity:** Frustrates users

**Fix:** Add a state for this: "High variability detected — This endpoint returns different content each time. Chirri identified X volatile fields but the response is still unstable. [Configure ignored fields manually] [View detected volatile fields]."

---

## 5. Onboarding

### 5.1 The Empty Dashboard Is Functional But Not Engaging Enough

**Problem:** Empty state is: heading + description + CTA + public API feed. It's fine, but it doesn't walk the user through WHAT they should do or WHY. The "Popular: [Stripe] [OpenAI] [GitHub] [Twilio]" quick-add buttons are good, but there's no explanation of what happens after they click one.

**Why it matters:** First impression drives retention. An empty dashboard with a text box feels like work. A guided experience feels like discovery.

**Severity:** Frustrates users (missed opportunity)

**Fix:** Add a 3-step visual guide (not a blocking wizard, just inline guidance):
1. "**Step 1:** Add a URL — paste any API endpoint or pick a popular one" (with the input + quick-add)
2. "**Step 2:** We learn the baseline — takes about 10 minutes"  
3. "**Step 3:** Get alerted on changes — via email, Slack, or webhook"

This sets expectations for the time-to-value gap and makes the empty state feel like progress, not emptiness.

### 5.2 No Guided Tour or Contextual Help

**Problem:** There's no mention of tooltips, coach marks, or contextual help for first-time users. The product has several non-obvious concepts: sources vs. URLs, tree structure, workflow states, forecasts, learning phase. Users are expected to figure all of this out from the UI alone.

**Why it matters:** Developer tools often skip onboarding ("devs will figure it out"). But even developers appreciate contextual hints for domain-specific concepts.

**Severity:** Frustrates users

**Fix:** Add lightweight contextual help:
1. First-visit tooltips for non-obvious UI elements (the tree view, workflow state buttons, forecast confidence).
2. A "?" icon next to concepts like "Sources," "Learning," "Forecast" that opens a brief tooltip explanation.
3. A dismissible "New to Chirri?" banner on each major page for the first week, with a one-sentence explanation of the page's purpose.

### 5.3 Email Verification Creates a Dead Zone

**Problem:** After signup, the user is redirected to the dashboard with a verification banner. But can they DO anything before verifying? Can they add URLs? See the public API feed? The spec doesn't clarify what's available pre-verification.

**Why it matters:** If the user can't do anything before verifying email, and the verification email takes 2 minutes to arrive, that's 2 minutes of staring at a useless dashboard. They'll leave.

**Severity:** Frustrates users

**Fix:** Allow full product usage before email verification. Add a persistent but non-blocking banner: "Verify your email to enable notifications. [Resend verification]." Gate only notification delivery on verification, not the core product experience.

---

## 6. Missing UX Considerations

### 6.1 No Undo Support

**Problem:** No undo for any action. Delete a URL? Gone. Ignore a change? Can you un-ignore it? (The spec shows `DELETE /v1/changes/:id/acknowledge` for un-acknowledge, but no general undo pattern.)

**Why it matters:** Accidents happen. "Undo" is a fundamental UX safety net.

**Severity:** Frustrates users

**Fix:** 
1. For destructive actions (delete URL, revoke API key): confirmation modal already exists (good!). Consider adding a soft-delete with 30-day recovery window for URLs.
2. For workflow state changes: show a toast with "Undo" action link for 10 seconds. "Change marked as Ignored. [Undo]"
3. General principle: every action that changes state should be reversible for at least a brief window.

### 6.2 No "Last Updated" / Freshness Indicators on Dashboard

**Problem:** The dashboard shows stats and URL health, but there's no visible "last updated" timestamp or freshness indicator for the overall dashboard data. SSE provides real-time updates, but if the SSE connection drops (the spec handles this with a banner), the user doesn't know if their data is stale.

**Why it matters:** Trust. Users need to know "is this data current?" especially for a monitoring product where recency IS the value.

**Severity:** Minor annoyance

**Fix:** Add a subtle "Last updated: just now" or "Live" indicator near the dashboard header. When SSE is disconnected and polling takes over, show "Updated 30s ago" with a refresh icon.

### 6.3 No Breadcrumbs on Most Pages

**Problem:** Breadcrumbs are specified as a component (Section 2.6) and shown on the mobile top bar, but the page specs don't consistently mention them. Provider Detail at `/urls/:id` should show "URLs > Stripe > Overview" but this isn't specified.

**Why it matters:** Breadcrumbs prevent "where am I?" disorientation, especially after deep-linking from email notifications.

**Severity:** Minor annoyance

**Fix:** Add breadcrumbs to every page below the page title. Spec them explicitly for: Provider Detail, Change Detail, Forecast Detail, all Settings sub-pages. They're especially critical for the Change Detail page since users arrive from email notifications.

### 6.4 No Loading/Progress Indicator for "Check Now"

**Problem:** Provider Detail has a "Check Now" button. The spec doesn't describe what happens after clicking it. Does the button spin? Is there a toast? How long does the check take? What if it fails?

**Why it matters:** "Check Now" with no feedback = "did it work?" Users will click it multiple times.

**Severity:** Frustrates users

**Fix:** Specify the full interaction: Button shows spinner → toast "Check started" → SSE pushes `check.completed` → toast "Check complete: no changes" or "Check complete: change detected! [View]" → button re-enables. If check takes >10s, show inline progress.

### 6.5 No Notification Preview/Test

**Problem:** Users configure notifications (email, Slack, Discord, webhooks) but can't preview or test them. Webhook has a "test" endpoint (`POST /v1/webhooks/:id/test`), but Slack/Discord/email don't.

**Why it matters:** "I set up Slack notifications. Will they actually work? What will they look like?" Uncertainty → distrust → users create manual monitoring as backup.

**Severity:** Frustrates users

**Fix:** Add a "Send test notification" button for every notification channel. Show a preview of what the notification will look like before sending.

### 6.6 No Keyboard Shortcuts Beyond Future j/k Navigation

**Problem:** The spec mentions `j/k` navigation for changes feed as "V1.1" and `/` for search focus. But the core triage workflow has no keyboard shortcuts. For a developer tool where users may process many changes, keyboard-driven triage is essential.

**Why it matters:** Power users want to fly through triage. Mouse-only triage at scale is slow and frustrating.

**Severity:** Minor annoyance (but grows with usage)

**Fix:** Add keyboard shortcuts for V1:
- `t` = Track, `i` = Ignore, `s` = Snooze, `r` = Resolve (on Change Detail page)
- `j/k` = navigate changes (bring forward from V1.1)
- `Enter` = open selected change
- `Escape` = back to list
- `?` = show keyboard shortcut overlay

---

## 7. Mobile UX

### 7.1 The Diff Viewer on Mobile Is the Core Problem

**Problem:** Monaco Editor in unified mode on a phone screen. Even in unified mode, a JSON diff with long lines requires horizontal scrolling. Word-wrap is on, but wrapped JSON is harder to read than normal JSON. And the diff is the ENTIRE product value — if it's unusable on mobile, the mobile experience is fundamentally broken.

**Why it matters:** The primary mobile use case is: notification arrives → user checks what changed on their phone. If the diff is unreadable, they can't act on it. They'll make a mental note to check it on desktop later. They'll forget.

**Severity:** Blocks users (on mobile)

**Fix:** 
1. **Mobile-first change view**: On mobile, lead with the LLM summary (make it more prominent, full-width), followed by a simplified "change list" view (not Monaco):
   - "**Removed:** `amount` (integer)"
   - "**Added:** `amount_in_cents` (integer)"  
   - "**Added:** `metadata` (object)"
   - "**Changed:** `active` (boolean) → `status` (string)"
2. Put the full Monaco diff behind a "View full diff" toggle for users who really want it on mobile.
3. Make the action bar (Track/Ignore/Snooze/Resolve) a **sticky bottom bar** on mobile for quick triage.

### 7.2 Horizontal Scrolling Stats Bar Is Awkward

**Problem:** Dashboard stats bar (4 metric cards) scrolls horizontally on mobile. Horizontal scrolling is a weak affordance — many users won't discover that there are more cards to the right.

**Why it matters:** Users miss key metrics. They see 2 cards and think that's all there is.

**Severity:** Minor annoyance

**Fix:** Either (a) stack the metric cards in a 2x2 grid on mobile, or (b) add scroll indicators (dots or a subtle "→" hint) to signal horizontal overflow.

### 7.3 Table-to-Card Transformation Needs Spec for Interactions

**Problem:** The spec says tables become cards on mobile, but doesn't specify how interactions work in card mode. Can you sort cards? Can you select cards for bulk actions? How does pagination work in card mode?

**Why it matters:** Without this, the mobile card view is read-only — users can view but can't manage.

**Severity:** Frustrates users

**Fix:** Spec out mobile card interactions:
- Sort: dropdown selector above cards (replacing sortable column headers)
- Filter: same filter bar, collapsed behind "Filters" button (already specified — good)
- Bulk select: long-press to enter selection mode, checkbox appears on each card
- Pagination: infinite scroll with "Loading more..." indicator

### 7.4 Sidebar Overlay on Mobile Needs "Current Page" Indicator

**Problem:** Mobile sidebar is a slide-in overlay. The spec describes nav item states (active = Sakura color + left border), which should work. But there's no mention of whether the overlay auto-closes on navigation.

**Why it matters:** If the sidebar stays open after tapping a nav item, users have to manually close it. Extra tap, broken flow.

**Severity:** Minor annoyance

**Fix:** Auto-close sidebar overlay on nav item click (the spec mentions "Close on nav item click" — good, it's there). Also add a page transition animation so the user sees the page change through the overlay dismissal.

---

## 8. Additional Findings

### 8.1 No Multi-User/Team Collaboration UX

**Problem:** The pricing page mentions a "Team" plan, but there's no spec for team features. How do multiple users see the same dashboard? Are there roles? Can one user triage a change and another see it was triaged? Is there an activity feed ("John marked the Stripe change as Resolved")?

**Why it matters:** "Team" as a plan tier implies collaboration features. If the UX is single-user-only with a shared login, that's frustrating and insecure.

**Severity:** Frustrates users (for team tier) — may be V2

**Fix:** At minimum, spec out: (a) invite teammates flow, (b) shared vs. personal views, (c) activity audit log, (d) who-triaged-what attribution on changes. Even if V2, the single-user UX should not have hard-coded "my account" language that precludes teams later.

### 8.2 Notification → Change Detail Deep-Link Flow Not Specified

**Problem:** The most common user entry point will be: email/Slack notification → click → Change Detail page. But the spec doesn't describe this deep-link experience. Does the user need to be logged in? What if their session expired? Does the notification link include enough context, or do they land on a page with no surrounding navigation context?

**Why it matters:** This is arguably the #1 user flow. If the deep-link experience is broken, the entire notification system loses value.

**Severity:** Blocks users

**Fix:** Spec out the notification deep-link flow:
1. Link format: `https://app.chirri.io/changes/:id`
2. If logged in: go directly to Change Detail with breadcrumbs showing "Changes > [this change]"
3. If session expired: show login page with redirect back to the change after auth
4. Include summary in the notification itself (subject line, first 2 lines) so users can triage without clicking through for low-severity changes

### 8.3 No "Quiet Mode" or Notification Batching UX

**Problem:** Settings mention "quiet hours" and "min severity" for notifications. But there's no spec for what happens AFTER quiet hours end. Do queued notifications arrive all at once? Is there a digest/batch option? A user monitoring 20 URLs might wake up to 15 individual emails.

**Why it matters:** Notification flooding = users disable notifications = they miss the one critical alert.

**Severity:** Frustrates users

**Fix:** Add a "Digest" notification mode: batch changes into a single daily/weekly summary email. "3 changes detected overnight: 1 Critical, 2 Low. [View all]." This should be configurable alongside the real-time notification preferences.

---

## Summary: Top 10 Issues by Severity

| # | Issue | Severity | Section |
|---|---|---|---|
| 1 | Time-to-value gap during learning/calibration | Blocks users | 2A.1 |
| 2 | No URL list page specification | Blocks users | 1.3 / 2C.1 |
| 3 | No inline triage from Changes Feed | Frustrates users | 2B.4 |
| 4 | Diff viewer unusable on mobile | Blocks users (mobile) | 7.1 |
| 5 | Source auto-discovery confusion + silent alerts | Frustrates users | 2D.1 |
| 6 | Notification deep-link flow unspecified | Blocks users | 8.2 |
| 7 | Expired integration tokens — no recovery UX | Blocks users | 4.2 |
| 8 | Forecasts lack actionable response options | Frustrates users | 2E.1 |
| 9 | No undo for workflow state changes | Frustrates users | 6.1 |
| 10 | No contextual onboarding / guided help | Frustrates users | 5.2 |

---

*Review complete. The bones of this product are strong — the information architecture is sound, the money screen is well-thought-out, and the error states are more comprehensive than most V1 specs. The biggest risks are in the onboarding time-to-value gap and the assumption that all users will "just get" concepts like sources, trees, and forecasts without guidance. Fix the top 5 and this ships solid.*
