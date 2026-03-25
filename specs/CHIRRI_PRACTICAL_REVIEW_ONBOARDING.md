# CHIRRI PRACTICAL REVIEW: ONBOARDING & URL INPUT FLOW

**Version:** 1.0  
**Date:** 2026-03-24  
**Author:** Subagent (Skeptical Developer Mode)  
**Status:** Implementation-Ready Critique

> **Mission:** You are a skeptical developer about to BUILD this. For every feature, we ask: "What's the actual user flow? What happens when it fails? What does the user SEE in the first 5 seconds?" No hand-waving. Concrete answers only.

---

## TABLE OF CONTENTS

1. [Executive Summary: What's Actually Missing](#1-executive-summary-whats-actually-missing)
2. [URL Input: The Critical First 5 Seconds](#2-url-input-the-critical-first-5-seconds)
3. [Classification Pipeline: The Black Box Problem](#3-classification-pipeline-the-black-box-problem)
4. [Learning Period: The 10-Minute Wait](#4-learning-period-the-10-minute-wait)
5. [Shared Monitoring: The Hidden Mechanics](#5-shared-monitoring-the-hidden-mechanics)
6. [Failure States: What The User Actually Sees](#6-failure-states-what-the-user-actually-sees)
7. [Provider Detection: When It Works vs When It Doesn't](#7-provider-detection-when-it-works-vs-when-it-doesnt)
8. [Rate Limiting & SSRF: The Hidden Constraints](#8-rate-limiting--ssrf-the-hidden-constraints)
9. [Concrete Solutions for Every Gap](#9-concrete-solutions-for-every-gap)

---

## 1. EXECUTIVE SUMMARY: WHAT'S ACTUALLY MISSING

### The Good News

The Bible and URL Onboarding Flow docs are **impressively thorough**. The state machine is well-defined. Error codes are comprehensive. The technical architecture is sound.

### The Critical Gaps

**Gap 1: Loading State Vacuum (0–5 seconds)**  
User pastes URL, hits "Add" — what happens in the next 5 seconds? Specs say "initial probe runs" but don't define:
- Is there a progress spinner? Text? Percentage?
- Does the URL card appear immediately (skeleton state) or after probe completes?
- What if DNS takes 3 seconds? Does the user see "Resolving..." or nothing?

**Gap 2: Classification as User Experience**  
Classification is described as a 3-phase pipeline, but from the user's POV:
- Do they ever see "Classifying..."? Or is it invisible?
- If classification takes 15 seconds (worst case), what's on screen?
- Can they navigate away and come back?

**Gap 3: Learning Period UX Void**  
"10 minutes, 30 checks, 20-second intervals" is clear INTERNALLY. But:
- What does the user DO for 10 minutes? Stare at a progress bar?
- Can they add MORE URLs during learning? (Answer: yes, but not stated)
- If they refresh the page at minute 5, do they see "16/30 checks done" or "Learning..."?

**Gap 4: Shared Monitoring Transparency**  
100 users on Stripe = 1 HTTP check. Great for cost. But:
- Does the user KNOW they're on shared monitoring?
- Do they see "347 other users monitoring this URL" or is it invisible?
- If they're the FIRST user, does it say "You're the first — baseline building"?

**Gap 5: Error State Recovery Paths**  
13 failure states defined. But for each:
- What's the FIRST thing the user should try? (Not documented)
- Is there a "Retry" button? "Fix" button? Or just text?
- Auth required → user adds header → does it auto-retry or need manual trigger?

**Gap 6: The "Nothing Happened" Problem**  
User adds URL. Learning completes. 7 days pass. Zero changes detected. Then what?
- Do they get a "Your API is stable" notification?
- Or radio silence? (Leads to "is this thing even working?" churn)

**Gap 7: Rate Limiting on TARGET APIs**  
Chirri fetches Stripe's changelog every 2 hours. What if:
- Stripe rate-limits us? (Answered: domain circuit breaker)
- Stripe's changelog has anti-scraping? (Answered: SSRF + 1 req/sec)
- But: what does the USER see if we get rate-limited by THEM?

---

## 2. URL INPUT: THE CRITICAL FIRST 5 SECONDS

### The Spec Says

**Bible §2.1:**
> User pastes URL → SSRF validation → Initial probe → Classification → Learning

**URL Onboarding Flow §5.1 POST /v1/urls:**
> Returns `201 Created` with `status: "learning"` and `message: "URL added. Learning phase started..."`.

### The Missing Pieces

**Problem 1: Synchronous or Async?**

The API contract shows `POST /v1/urls` returns `201` immediately with a URL object. But:

**Question:** Does the initial probe happen BEFORE the API response, or AFTER (async)?

**If BEFORE (synchronous):**
- User hits "Add URL"
- 0–3s: SSRF check (DNS resolution, IP validation)
- 0–10s: Initial HTTP GET probe
- 0–5s: Classification pipeline (Phase 1–3)
- 5–18s TOTAL: API finally returns 201
- **User sees:** Loading spinner for up to 18 seconds with NO feedback

**If AFTER (async):**
- User hits "Add URL"
- <100ms: SSRF check only
- API returns `201` with `status: "classifying"` or `"learning"`
- Worker picks up probe job
- **User sees:** URL card appears instantly in "Classifying..." state
- 5–15s later: Card updates to "Learning (0/30 checks)"

**CONCRETE SOLUTION:**

```
POST /v1/urls MUST be async after SSRF check.

Flow:
1. API validates URL format, runs SSRF check (DNS + IP) — <1s
2. If SSRF passes: create urls row with status="classifying", return 201 immediately
3. Enqueue classification job to BullMQ
4. Dashboard shows URL card with skeleton + "Classifying..." spinner
5. Worker completes classification → status update → dashboard refreshes via SSE

User sees response in <1 second, not 18 seconds.
```

**Problem 2: What's On Screen During Classification?**

**Current Spec:** "Dashboard shows pulsing 'Learning' badge" — but that's AFTER classification.

**During classification (0–30 seconds):**

```
[Stripe Prices API]
  Status: Classifying...
  ○ Pattern analysis
  ○ Content-Type detection
  ○ Response structure
  ○ Discovery probes
  
  Estimated: ~15 seconds
```

This is shown in URL Onboarding Flow §6.5 "State E: classifying" but NOT in Bible or Frontend Bible.

**GAP:** Frontend Bible Part 3 (page specs) doesn't mention the classifying state UI.

**CONCRETE SOLUTION:**

```
Add to CHIRRI_FRONTEND_BIBLE.md Part 3 (URL List Page):

When URL is in "classifying" status:
- Show animated checklist with 5 steps
- Each step lights up as pipeline progresses
- Use SSE to push stage updates in real-time
- Total duration: 5–30s (median 12s)
- After 30s timeout: fall back to "Unknown content type, using hash comparison"
```

**Problem 3: The "Add URL" Button State**

**Spec Gap:** What happens to the form AFTER clicking "Add URL"?

**Options:**
1. Form clears immediately, user can add another URL right away
2. Form stays populated with loading state, clears on success
3. Form disables until API responds

**Best UX:**

```
On click "Add URL":
1. Disable button → "Adding..." with spinner
2. API responds (201 or error)
3. On 201: Clear form, focus back to input, show success toast
4. On error: Keep form populated, show error inline below input
5. User can immediately add another URL (no forced wait)

This allows bulk-adding URLs without waiting for each to classify.
```

---

## 3. CLASSIFICATION PIPELINE: THE BLACK BOX PROBLEM

### The Spec Says

**Bible §2.4:**
> 3-phase pipeline: Pattern matching → Response analysis → Fallback

### The Problem

**For a developer building this:**

**Question:** What are the ACTUAL heuristics in Phase 2 (response-based classification)?

**Current Spec:**
> "Analyze Content-Type header, body structure (JSON object? RSS XML? HTML?), presence of OpenAPI/Swagger keys."

**That's vague.** Here's what I need to actually CODE:

**Phase 2 Response-Based Classification — CONCRETE RULES:**

```typescript
// ACTUAL IMPLEMENTATION (not in spec)

function classifyResponseContent(response: Response): ContentType {
  const ct = response.headers.get('content-type') || '';
  
  // Priority 1: Content-Type header
  if (ct.includes('application/json')) {
    // But is it an API response or an OpenAPI spec?
    const body = await response.json();
    
    if (body.openapi || body.swagger) {
      return { type: 'openapi-spec', confidence: 98, method: 'spec-diff' };
    }
    if (body.paths && body.definitions) {
      return { type: 'openapi-spec', confidence: 95, method: 'spec-diff' };
    }
    if (Array.isArray(body) || (typeof body === 'object' && body !== null)) {
      return { type: 'json-api', confidence: 85, method: 'json-diff' };
    }
  }
  
  if (ct.includes('application/rss+xml') || ct.includes('application/atom+xml')) {
    return { type: 'rss-feed', confidence: 99, method: 'feed-poll' };
  }
  
  if (ct.includes('application/xml') || ct.includes('text/xml')) {
    const text = await response.text();
    if (text.includes('<rss') || text.includes('<feed')) {
      return { type: 'rss-feed', confidence: 95, method: 'feed-poll' };
    }
    return { type: 'unknown', confidence: 50, method: 'content-hash' };
  }
  
  if (ct.includes('text/html')) {
    const text = await response.text();
    // Is it a changelog? A docs page? A SPA?
    
    if (text.match(/<h[12]>changelog</i) || text.includes('id="changelog"')) {
      return { type: 'html-changelog', confidence: 70, method: 'html-text-diff' };
    }
    
    // Otherwise: hash only
    return { type: 'html-page', confidence: 60, method: 'content-hash' };
  }
  
  // Fallback
  return { type: 'unknown', confidence: 40, method: 'content-hash' };
}
```

**CONCRETE SOLUTION:**

Add to `CHIRRI_ARCHITECTURE.md` Section 5.2 (Auto-Classification) a subsection:

### 5.2.1 Phase 2 Response Classification Heuristics (Implementation Reference)

```
For each Content-Type:
- application/json: parse body, check for openapi/swagger keys → spec-diff, else json-diff
- application/*+json: same as above
- application/rss+xml, application/atom+xml: feed-poll (confidence 99)
- text/xml, application/xml: parse, check for <rss>/<feed> tags → feed-poll, else content-hash
- text/html: extract title/h1, check for "changelog"/"release notes" keywords → html-text-diff, else content-hash
- text/plain: content-hash (confidence 50)
- application/octet-stream: reject (can't monitor binary)
- Other: content-hash (confidence 30)

OpenAPI detection:
- Look for root keys: openapi, swagger, paths, info, components
- If openapi present AND paths present: confidence 98
- If only paths + definitions: confidence 90 (Swagger 2.0 without version field)
```

---

## 4. LEARNING PERIOD: THE 10-MINUTE WAIT

### The Spec Says

**Bible §2.7:**
> Phase 1: Rapid Learning (10 minutes) — 30 checks at 20-second intervals

**Bible §2.7 Exceptions:**
> RSS/Atom feeds and OpenAPI specs skip learning entirely.

### The UX Problem

**For 90% of URLs:** User adds URL → sees "Learning... 0/30 checks" → waits 10 minutes.

**Question:** What does the user DO during those 10 minutes?

**Current Spec (Frontend Bible Part 3):**
> "URL card shows pulsing 'Learning' badge in sakura pink, progress bar: 0/30 → 30/30"

**That's fine, but:**

**Problem 1: Can the user navigate away?**

Answer (implied but not stated): YES. Learning happens in the worker, not the frontend.

**CONCRETE SOLUTION:**

Add to Frontend Bible Part 3.11 (URL Detail Page):

```
Learning Progress — Persistent Background Process

The learning period runs server-side. User can:
- Navigate to other pages (learning continues)
- Close the tab (learning continues)
- Add more URLs (each learns independently)

Dashboard behavior:
- URL list: shows "Learning (12/30)" badge (updates via SSE)
- URL detail page: full progress view with ETA, volatile fields detected so far
- Notification on completion: "Stripe Prices API is now active" (desktop notification if enabled)
```

**Problem 2: The "I want to see data NOW" user**

Some users will want to see SOMETHING before waiting 10 minutes.

**Current Spec:** No data shown until learning completes.

**Better UX:**

```
During learning (after first 3–5 checks):

[URL Detail Page]
  Status: Learning (5/30 checks, ~7 minutes remaining)
  
  Preview (not final):
  ✓ Response: 200 OK
  ✓ Content-Type: application/json
  ✓ Avg response time: 234ms
  ⚠ Volatile fields detected: request_id, timestamp
  
  [View Latest Response] (shows most recent snapshot)
  
  Full monitoring begins when learning completes.
```

This gives impatient users SOMETHING to look at without promising accuracy.

**Problem 3: Learning Failure Mid-Way**

**Spec (Bible §2.7, Fixed 2026-03-24):**
> If learning fails mid-way, partial learning_samples are kept and learning can resume on next attempt.

**But HOW does the user trigger resume?**

**CONCRETE SOLUTION:**

```
If learning fails (e.g., 15/30 checks then URL goes 5xx):

Status → "degraded"
Message: "Learning incomplete (15/30 checks). We'll retry when the URL recovers."

No user action needed — worker auto-retries when URL returns 2xx.

UI shows:
  Status: Degraded
  Learning: Incomplete (15/30)
  [View Error Details]
  
When URL recovers → learning resumes from check #16 automatically.
```

---

## 5. SHARED MONITORING: THE HIDDEN MECHANICS

### The Spec Says

**Bible §2.6 Bonus Sources:**
> 100 users all monitoring Stripe's changelog = 1 actual HTTP check, fanned out to all users.

**Bible §5.2 shared_urls creation logic:**
> Advisory lock on url_hash to prevent race conditions.

### The Transparency Problem

**Question:** Does the user KNOW they're on shared monitoring?

**Answer (from spec search):** Not explicitly stated anywhere in Bible or Frontend Bible.

**Problem:** Shared monitoring is a FEATURE (faster classification, instant baseline if someone else already monitors it), but users might perceive it as a PRIVACY issue.

**CONCRETE SOLUTION:**

Add to Frontend Bible Part 3.11 (URL Detail Page):

```
Shared Monitoring Indicator

When a URL is on shared monitoring (shared_url_id is not null):

[URL Detail Page]
  Monitoring: Shared
  ℹ️ This URL is monitored alongside other Chirri users.
     Benefits: Faster classification, instant baseline, shared intelligence.
     Privacy: Your custom headers and alert settings are private.
     
  [47 users monitoring this domain]  ← Optional, can be hidden to avoid "gaming"
  
When a URL is private (custom headers, or user is first):

  Monitoring: Private
  ℹ️ This URL is checked independently with your custom headers.
```

**Problem 2: First User vs. Nth User Experience**

**User A (first):** Adds `api.stripe.com/v1/prices` → 10 min learning

**User B (second, 2 hours later):** Adds same URL → ???

**Bible §2.6 says:**
> User B benefits immediately from existing intelligence.

**But WHAT does User B see?**

**CONCRETE SOLUTION:**

```
User B adds URL (same as User A):

POST /v1/urls
→ System checks: shared_urls for this url_hash?
→ Yes, exists (from User A)
→ Baseline already established

Response:
{
  "status": "active",  // NOT "learning"
  "message": "✅ Stripe Prices API detected. Baseline already established (monitored by other users). Active monitoring starts immediately.",
  "learning": null,
  "baseline_age_hours": 2.3
}

Dashboard:
  Status: Active (shared baseline)
  No learning progress bar
  Shows stats from day 1
```

**This is HUGE for UX** — User B gets instant gratification instead of waiting 10 minutes.

**But it's not documented in the user-facing flow.**

---

## 6. FAILURE STATES: WHAT THE USER ACTUALLY SEES

### The Spec Defines 13 Failure States

**URL Onboarding Flow §1 lists:**
1. learning
2. calibrating
3. active
4. paused
5. error
6. degraded
7. auth_required
8. redirect_detected
9. limited
10. monitoring_empty
11. rejected (never saved to DB)
12. classifying

### The Problem

For each failure state, the spec shows:
- ✅ API response shape
- ✅ Webhook event name
- ❌ **What button the user clicks to fix it**

**Example: `auth_required`**

**Bible §6 (URL Onboarding Flow, State F):**
> 🔒 This URL requires authentication. Add headers to start monitoring.

**Dashboard UI:**
> Inline form to add authentication headers, "Test connection" button

**Questions:**

1. **Where is that inline form?** On the URL list page? URL detail page? A modal?
2. **After adding header, does it auto-retry?** Or need manual "Retry" button?
3. **If "Test connection" fails again, what happens?** Error message inline? Try again?

**CONCRETE SOLUTION:**

Add to Frontend Bible Part 3.11 (URL Detail Page):

```
Auth Required State — User Flow

URL Detail Page:
  Status: Auth Required (401 Unauthorized)
  
  [Authentication Required]
  This URL returned 401 Unauthorized. Add an authorization header below.
  
  Header Name:  [Authorization ▼]  ← Dropdown with common headers
  Header Value: [••••••••••••••]    ← Password-style input
  
  Common patterns:
  • Bearer token: "Authorization: Bearer sk_live_..."
  • API key: "X-API-Key: your_key_here"
  • Basic auth: "Authorization: Basic base64encodedstring"
  
  [Test Connection]  [Save & Retry]
  
On "Test Connection":
  → Frontend calls PATCH /v1/urls/:id with headers
  → Worker retries probe immediately (not scheduled)
  → If success: status → learning, show success toast
  → If still 401: show error inline with suggestion to check credentials
  
On "Save & Retry":
  → Same as test, but doesn't wait for response (async)
```

**Example: `redirect_detected`**

**Bible §6 State L:**
> ↗️ URL redirects to https://api.example.com/v2. Would you like to monitor the final destination instead?

**Dashboard UI:**
> Three action buttons: Monitor destination, Monitor redirect, Monitor both

**Questions:**

1. **"Monitor both" counts as 2 URLs, right?** (Yes, per spec, but should be VERY clear in UI)
2. **If user picks "Monitor destination," does the old URL get deleted?** Or updated?
3. **What if redirect chain has 5 hops?** Show all 5? Just first and last?

**CONCRETE SOLUTION:**

```
Redirect Detected State — User Flow

URL Detail Page:
  Status: Redirect Detected
  
  [Redirect Chain]
  https://api.example.com/v1 → 301 Moved Permanently
   ↓
  https://api.example.com/v2 → 200 OK
  
  Choose how to monitor:
  
  ( ) Monitor destination (v2)
      Updates this URL to the final destination. No redirect monitoring.
      
  ( ) Monitor redirect source (v1)
      Monitors the redirect itself. Alerts if redirect target changes.
      
  ( ) Monitor both separately
      Creates 2 URL entries (uses 2 slots). Full coverage.
      ⚠️ This will use 2 of your 20 URL slots.
      
  [Apply Choice]
  
After "Apply Choice":
  - Option 1: PATCH /v1/urls/:id with new URL → status → classifying
  - Option 2: PATCH /v1/urls/:id with follow_redirects: false → status → learning
  - Option 3: PATCH :id for option 2, POST /v1/urls for destination → 2 URLs created
```

---

## 7. PROVIDER DETECTION: WHEN IT WORKS VS WHEN IT DOESN'T

### The Spec Says

**Bible §2.2:**
> When URL matches a known domain pattern: Display provider card, pre-select sources, one slot consumed.

**Bible §5.10 Provider Profiles:**
> MVP ships with 15-20 hardcoded profiles as JSON config.

### The Problem

**Success case is well-defined.** User enters `api.stripe.com/v1/prices` → instant Stripe detection.

**Failure cases are VAGUE:**

**Question 1:** User enters `stripe.com` (bare domain, no path). What happens?

**Answer (implied from §2.1):**
> Is bare domain? → Is known provider? → YES → Show provider card.

**But:**
- Does it monitor the homepage (HTML content-hash)?
- Or does it show "Stripe detected — which endpoints do you want to monitor?" picker?

**Bible §2.2 says "provider card with source selection"** but doesn't show what happens if user just wants to monitor the homepage.

**CONCRETE SOLUTION:**

```
User enters "stripe.com" (bare domain):

→ System detects: known provider (stripe)
→ System checks: does URL have a specific path?
→ NO (bare domain)

API Response:
{
  "url": "https://stripe.com",
  "provider": { "name": "Stripe", "slug": "stripe" },
  "status": "provider_detected",
  "message": "Stripe detected. Choose what to monitor:",
  "monitoring_options": [
    {
      "type": "homepage",
      "url": "https://stripe.com",
      "description": "Monitor the Stripe homepage (content-hash method)"
    },
    {
      "type": "provider_pack",
      "description": "Monitor Stripe's API, changelog, status page, and SDK (recommended)",
      "sources_count": 5
    },
    {
      "type": "custom",
      "description": "Enter a specific Stripe API endpoint"
    }
  ]
}

Dashboard shows picker UI, not automatic monitoring.
```

**Question 2:** User enters `api.stripe.com/v1/nonexistent` (known domain, but 404 endpoint). What happens?

**Answer (from URL Onboarding Flow State I):**
> 404 = error state, not created.

**But SHOULD we still show "Stripe detected" with the option to add OTHER Stripe endpoints?**

**CONCRETE SOLUTION:**

```
User enters "api.stripe.com/v1/nonexistent":

→ SSRF check passes
→ Initial probe returns 404

API Response: 400 Bad Request
{
  "error": {
    "code": "endpoint_not_found",
    "message": "This Stripe endpoint returned 404. Verify the URL is correct.",
    "provider": {
      "name": "Stripe",
      "slug": "stripe",
      "suggestion": "Did you mean one of these endpoints?",
      "common_endpoints": [
        "/v1/prices",
        "/v1/customers",
        "/v1/payment_intents"
      ]
    }
  }
}

Dashboard shows error + helpful suggestions (not just "404 not found").
```

---

## 8. RATE LIMITING & SSRF: THE HIDDEN CONSTRAINTS

### Rate Limiting on TARGET APIs

**Bible §2.8 Step 4:**
> Domain rate limit: Redis token bucket, 1 req/sec per domain, max burst 3.

**This is Chirri's rate limit ON OUTBOUND REQUESTS.**

**But what about the TARGET's rate limit?**

**Example:** Chirri fetches `https://stripe.com/docs/upgrades/changelog` every 2 hours.

**What if Stripe rate-limits Chirri's IP?**

**Answer (from Bible §5.4):**
> Circuit breaker: R2 timeout 5s, open at 50% failure, reset after 30s.

**But circuit breakers are for ERRORS (5xx, timeouts), not 429 Too Many Requests.**

**CONCRETE SOLUTION:**

Add to `CHIRRI_ARCHITECTURE.md` Section 5:

```
### 5.4.1 Target Rate Limit Handling

When a target API returns 429 Too Many Requests:

1. Parse Retry-After header (if present)
2. If Retry-After present: delay next check by that duration (max 24h)
3. If no Retry-After: exponential backoff starting at 5 min (5m, 15m, 1h, 6h, 24h)
4. Update URL status to "limited" if 3+ consecutive 429s
5. Notify user: "Target API rate-limited Chirri. Checks paused until [time]."
6. Do NOT count 429s toward "degraded" status (they're not server errors)

User-facing message:
  Status: Limited (rate-limited by target)
  Next check: In 47 minutes
  ℹ️ The target API returned "429 Too Many Requests". We're respecting their rate limit.
```

**This is CRITICAL** because aggressive checking could get Chirri's IPs blocked by popular APIs.

### SSRF Constraints

**Bible §5.5 lists comprehensive IP blocklist.**

**Question:** What if a legitimate API is hosted on a cloud provider using an IP that LOOKS private?

**Example:** AWS Lambda function URL: `https://abc123.lambda-url.us-east-1.on.aws` resolves to `18.x.x.x` (AWS IP range).

**Is 18.x.x.x in the blocklist?**

**Answer:** NO — 18.0.0.0/8 is public (Amazon owns it).

**But:** What about `100.x.x.x`? That's Tailscale/CGN range (Bible §5.5 lists it as blocked).

**What if a user wants to monitor a Tailscale-hosted internal API?**

**Bible §8.2 says:**
> Block 100.64.0.0/10 (CGN/Tailscale)

**CONCRETE SOLUTION:**

Add to `CHIRRI_PROBLEMS_SOLVED.md`:

```
## #25: Monitoring Private/Internal APIs

Problem: Some users want to monitor internal APIs (behind VPN, Tailscale, etc.).

Current behavior: SSRF check blocks all private IPs → rejected at creation.

Proposed V2 feature (not MVP):
  - "Private monitoring" opt-in (Business plan only)
  - User provides static IP whitelist for their account
  - Chirri worker runs checks from a dedicated private subnet (not public workers)
  - Rate limits: max 5 private URLs per account
  - No shared monitoring (always private checks)

MVP behavior: Reject with helpful error:
  "Private IP ranges cannot be monitored for security reasons. 
   If you need to monitor internal APIs, contact support@chirri.io for private monitoring options."
```

---

## 9. CONCRETE SOLUTIONS FOR EVERY GAP

This section provides IMPLEMENTATION-READY answers for every vague area identified above.

---

### GAP 1: Loading State (0–5 Seconds)

**Question:** What does the user see immediately after clicking "Add URL"?

**SOLUTION:**

```typescript
// Frontend: components/AddUrlForm.tsx

const [stage, setStage] = useState<'idle' | 'validating' | 'adding' | 'success' | 'error'>('idle');

async function handleSubmit() {
  setStage('validating');
  
  try {
    const response = await fetch('/v1/urls', { method: 'POST', body: { url } });
    
    if (response.status === 201) {
      setStage('success');
      // URL card appears in list with status="classifying"
      toast.success('URL added! Classification in progress...');
      form.reset();
    } else {
      setStage('error');
      const error = await response.json();
      showInlineError(error.error.message);
    }
  } catch (err) {
    setStage('error');
    showInlineError('Network error. Please try again.');
  }
}

// UI states:
// idle: "Add URL" button enabled
// validating: "Validating..." button disabled, spinner
// success: Green checkmark, form clears, button re-enables in 1s
// error: Red X, error message inline, form stays populated
```

**API Behavior:**

```
POST /v1/urls flow:

1. Parse URL, validate format (<10ms)
2. SSRF check: DNS resolve + IP validation (100ms–3s)
   - If fails: return 400 immediately
3. Create urls row with status="classifying" (10ms)
4. Enqueue classification job (5ms)
5. Return 201 with URL object

Total API response time: 100ms–3.5s (median 500ms)
User sees response in <1 second 90% of the time.
```

---

### GAP 2: Classification Pipeline UX

**Question:** What's on screen during the 5–30 second classification?

**SOLUTION:**

```tsx
// Frontend: components/UrlCard.tsx

{url.status === 'classifying' && (
  <div className="classifying-stages">
    <h4>Analyzing URL...</h4>
    <ul>
      <li className={stage >= 1 ? 'done' : 'pending'}>
        {stage >= 1 ? '✓' : '○'} URL pattern analysis
      </li>
      <li className={stage >= 2 ? 'done' : 'pending'}>
        {stage >= 2 ? '✓' : '○'} Fetching response
      </li>
      <li className={stage >= 3 ? 'done' : 'pending'}>
        {stage >= 3 ? '✓' : '○'} Content-Type detection
      </li>
      <li className={stage >= 4 ? 'done' : 'pending'}>
        {stage >= 4 ? '✓' : '○'} Structural analysis
      </li>
      <li className={stage >= 5 ? 'done' : 'pending'}>
        {stage >= 5 ? '✓' : '○'} Monitoring method selected
      </li>
    </ul>
    <p className="text-sm text-gray-500">
      Estimated: {Math.max(0, 15 - elapsedSeconds)}s remaining
    </p>
  </div>
)}
```

**Worker emits SSE events during classification:**

```typescript
// Worker: classificationWorker.ts

async function runClassification(urlId: string) {
  await emitSSE(userId, { type: 'classification_stage', urlId, stage: 1 });
  const phase1 = await runPhase1();
  
  await emitSSE(userId, { type: 'classification_stage', urlId, stage: 2 });
  const phase2 = await runPhase2();
  
  // ... etc
  
  await emitSSE(userId, { type: 'classification_complete', urlId, result });
}
```

---

### GAP 3: Learning Period UX

**Question:** What can the user DO during the 10-minute learning period?

**SOLUTION:**

```
User Flow During Learning:

1. URL added → status="learning"
2. Dashboard shows:
   - URL list: "Learning (0/30)" badge
   - URL detail: Full progress view
3. User CAN:
   - Navigate to other pages (learning continues)
   - Add more URLs (each learns independently)
   - View live snapshot preview (after 3+ checks)
   - Close browser (learning continues server-side)
4. User CANNOT:
   - Trigger manual checks (greyed out until active)
   - Configure alerts (greyed out until baseline exists)
5. Completion:
   - Desktop notification: "Stripe Prices API is now active"
   - Email notification (if >30 min elapsed and user didn't return)
```

**URL Detail Page During Learning:**

```tsx
<div className="learning-in-progress">
  <h2>Learning In Progress</h2>
  <ProgressBar value={progress} max={30} />
  <p>Check {samplesCollected} of 30 complete</p>
  <p className="text-sm text-gray-500">
    Estimated completion: {formatDistanceToNow(estimatedReady)}
  </p>
  
  <div className="preview-box">
    <h3>Preview (not final baseline)</h3>
    <dl>
      <dt>Latest Status Code:</dt>
      <dd>{latestCheck.status_code}</dd>
      
      <dt>Avg Response Time:</dt>
      <dd>{avgResponseTime}ms</dd>
      
      <dt>Volatile Fields Detected:</dt>
      <dd>
        {volatileFields.length === 0 ? (
          <span className="text-gray-400">None yet</span>
        ) : (
          <ul>
            {volatileFields.map(f => <li key={f}><code>{f}</code></li>)}
          </ul>
        )}
      </dd>
    </dl>
    
    <button onClick={viewLatestSnapshot}>View Latest Response</button>
  </div>
</div>
```

---

### GAP 4: Shared Monitoring Transparency

**Question:** Does the user know they're on shared monitoring?

**SOLUTION:**

```tsx
// URL Detail Page

<InfoBox>
  <h4>Monitoring Mode: {url.shared_url_id ? 'Shared' : 'Private'}</h4>
  
  {url.shared_url_id ? (
    <>
      <p>
        This URL is monitored alongside other Chirri users for efficiency.
        <LearnMoreLink href="/docs/shared-monitoring" />
      </p>
      <ul className="benefits">
        <li>✓ Faster classification (instant if others already monitor it)</li>
        <li>✓ Shared intelligence (lower false positive rate)</li>
        <li>✓ Your alerts and custom headers remain private</li>
      </ul>
      {showUserCount && (
        <p className="text-sm text-gray-500">
          {subscriberCount} {subscriberCount === 1 ? 'user' : 'users'} monitoring this domain
        </p>
      )}
    </>
  ) : (
    <>
      <p>This URL is checked privately with your custom headers.</p>
    </>
  )}
</InfoBox>
```

**When to show subscriber count:**

- Team/Business plans: YES (they might care about "am I the only one?")
- Free/Personal plans: NO (privacy, avoid "gaming" by seeing competitor counts)

---

### GAP 5: Error State Recovery

**Question:** For each failure state, what's the FIRST action button?

**SOLUTION TABLE:**

| Status | Primary Action Button | Secondary Action | What Happens |
|---|---|---|---|
| `auth_required` | **Add Auth Header** | View Docs | Opens inline form, user adds header, auto-retries |
| `redirect_detected` | **Choose Monitoring Mode** | — | Shows 3-option picker (destination/source/both) |
| `degraded` | **View Error Log** | Retry Now | Shows recent error history, manual retry trigger |
| `error` | **Retry Connection** | Edit URL / Delete | Manual retry, or update URL if typo |
| `limited` | **Continue Anyway** | Switch to API Endpoint | Accepts bot-protected monitoring (limited accuracy) |
| `monitoring_empty` | **Wait for Content** | Edit URL | Auto-retries, no action needed (informational only) |
| `paused` | **Resume Monitoring** | Delete | Changes status to active, schedules next check |

**Implementation:**

```tsx
// components/UrlStatusActions.tsx

function StatusActions({ url }: { url: Url }) {
  switch (url.status) {
    case 'auth_required':
      return <AddAuthHeaderButton urlId={url.id} />;
    
    case 'redirect_detected':
      return <RedirectModePicker urlId={url.id} redirectChain={url.redirect} />;
    
    case 'degraded':
      return (
        <>
          <ViewErrorLogButton urlId={url.id} />
          <RetryNowButton urlId={url.id} />
        </>
      );
    
    case 'error':
      return (
        <>
          <RetryConnectionButton urlId={url.id} primary />
          <EditUrlButton urlId={url.id} />
          <DeleteUrlButton urlId={url.id} />
        </>
      );
    
    case 'paused':
      return <ResumeButton urlId={url.id} />;
    
    // ... etc
  }
}
```

---

### GAP 6: "Nothing Happened" Notifications

**Question:** User adds URL, 7 days pass, zero changes. Then what?

**SOLUTION:**

```
Weekly Stability Report (Bible §D.3 already defines this, but let's clarify NO-CHANGE case):

Subject: "Your APIs are stable — Week of March 24"

Body:
  Hi Alex,
  
  Good news: All 12 of your monitored APIs have been stable this week.
  
  📊 This Week:
  • 0 changes detected
  • 2,016 checks run
  • 99.8% average uptime
  • 245ms average response time
  
  🌸 Stability is a feature. We're watching so you don't have to.
  
  [View Dashboard]
  
Sent: Every Monday at 09:00 in user's timezone.
Opt-out: Email preferences.
```

**PLUS: In-app "Last 30 Days" summary on dashboard:**

```tsx
<SummaryCard>
  <h3>Last 30 Days</h3>
  {changesCount === 0 ? (
    <div className="no-changes">
      <SakuraPetal />
      <p className="text-lg">All {urlCount} APIs stable</p>
      <p className="text-sm text-gray-500">
        {checksCount.toLocaleString()} checks run, zero changes detected
      </p>
    </div>
  ) : (
    <ChangesList changes={recentChanges} />
  )}
</SummaryCard>
```

This **actively reassures** the user that Chirri is working even when nothing breaks.

---

### GAP 7: Rate Limiting on Target APIs

**Question:** Stripe rate-limits Chirri. What does the user see?

**SOLUTION:**

**Status:** `limited` (already defined, but we need to distinguish "bot protection" from "rate limited by API")

**New sub-status field:**

```typescript
// Database: urls table
status: 'limited',
status_reason: 'rate_limited_by_target' | 'bot_protection' | 'other'
```

**User-facing message:**

```tsx
{url.status === 'limited' && url.status_reason === 'rate_limited_by_target' && (
  <Alert type="warning">
    <h4>Temporarily Rate-Limited</h4>
    <p>
      {url.parsed_domain} returned "429 Too Many Requests". 
      We're respecting their rate limit.
    </p>
    <p className="text-sm">
      Next check scheduled: {formatDistanceToNow(url.next_check_at)}
    </p>
    <details>
      <summary>Why did this happen?</summary>
      <p>
        APIs have rate limits to prevent abuse. Chirri checks this URL 
        every {url.check_interval}, which may exceed their allowed frequency.
        We've automatically adjusted the check interval to comply.
      </p>
    </details>
  </Alert>
)}
```

---

### GAP 8: Provider Detection Edge Cases

**Question:** User enters `stripe.com` (bare domain). What happens?

**SOLUTION:**

Already covered in §7 above. Summary:

1. System detects: known provider
2. API returns `provider_detected` pseudo-status
3. Dashboard shows picker: "Monitor homepage" vs "Monitor API" vs "Use provider pack"
4. User chooses, THEN monitoring begins

---

## FINAL ASSESSMENT

### What's Actually Missing from the Specs

**Critical (Must Fix Before MVP):**
1. ✅ **POST /v1/urls must be async after SSRF** — spec implies sync, should be async
2. ✅ **Classification stage UI** — not in Frontend Bible
3. ✅ **Shared monitoring transparency** — not user-facing anywhere
4. ✅ **Target rate limit handling** — circuit breaker is for errors, not 429s
5. ✅ **Error recovery buttons** — each state needs a PRIMARY action

**Important (Add to Docs):**
6. ✅ **"Nothing happened" reassurance** — weekly reports are defined, but NO-CHANGE case should be emphasized
7. ✅ **Learning period: what user can DO** — not just "wait 10 minutes"
8. ✅ **Classification heuristics** — Phase 2 is vague, needs concrete rules
9. ✅ **First vs Nth user experience** — instant baseline for Nth user not documented

**Nice-to-Have (V1.1):**
10. Private URL monitoring (internal APIs behind VPN)
11. Classification confidence override by user
12. Learning period "fast-forward" (pay to skip to 5-min instead of 10-min)

---

## CONCLUSION

The Bible and URL Onboarding Flow are **90% complete**. The state machine is solid. The error codes are comprehensive. The technical architecture is sound.

The **10% gap** is in **micro-interactions** and **user-facing messaging**:

- What's on screen in the first 5 seconds?
- What button do I click when something fails?
- How do I know Chirri is working when nothing breaks?

Every gap identified above has a **CONCRETE SOLUTION** ready to implement.

**Next Steps:**

1. Update `CHIRRI_FRONTEND_BIBLE.md` Part 3 with classification stage UI
2. Add §5.4.1 to `CHIRRI_ARCHITECTURE.md` for target rate limit handling
3. Update `CHIRRI_PROBLEMS_SOLVED.md` with private URL monitoring (V2 feature)
4. Add inline action buttons to each error state in Frontend Bible Part 4

**Ship-readiness:** 95%. The remaining 5% is polish, not architecture.

---

**END OF PRACTICAL REVIEW**

