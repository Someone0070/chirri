# CHIRRI — Category D Items: Research & Design From Scratch

**Compiled:** 2026-03-24  
**Scope:** All 28 Category D items from CHIRRI_CONTRADICTION_LIST.md  
**Purpose:** For each missing item: research, design, specify, estimate.

---

## Table of Contents

| # | Item | Priority | Effort |
|---|------|----------|--------|
| D1 | Dashboard Implementation Spec | MVP | 16-24h |
| D2 | Check History API Endpoint | MVP | 4-6h |
| D3 | Pause/Resume Behavior | MVP | 3-4h |
| D4 | HTML/Docs Page Diff Rendering | MVP | 8-12h |
| D5 | Bulk URL Operations | V1.1 | 6-8h |
| D6 | Onboarding Email Sequence | MVP | 6-8h |
| D7 | Weekly Stability Report Content | MVP | 4-6h |
| D8 | Notification Rate Limit Value | MVP | 2-3h |
| D9 | Smart Chirp Relevance Filter | V1.1 | 8-12h |
| D10 | `monitored_sources` Table Definition | MVP | 4-6h |
| D11 | Discovery Service Implementation | V1.1 | 12-16h |
| D12 | Provider Definition for Mega-Providers | MVP | 4-6h |
| D13 | Account Deletion Flow (GDPR) | MVP | 8-12h |
| D14 | Data Export — Async for Large Accounts | V1.1 | 6-8h |
| D15 | Dunning Emails (Payment Failure) | MVP | 4-6h |
| D16 | Dark Mode Decision | MVP | 1-2h |
| D17 | Timezone Handling in Dashboard | MVP | 3-4h |
| D18 | Error Budget / Partial Failure Modes | MVP | 6-8h |
| D19 | Notification Pipeline — Unified Contract | MVP | 4-6h |
| D20 | Team Features — Pricing Page Handling | MVP | 2-3h |
| D21 | 5-Layer Defense for Shared Sources | V1.1 | 8-12h |
| D22 | Path-Grouped Fan-Out Indexes | MVP | 2-3h |
| D23 | Crafted Changelog False Chirp Attack | V1.1 | 8-12h |
| D24 | extractAddedContent() Fragility | MVP | 6-8h |
| D25 | Source Preference null Inheritance | MVP | 2-3h |
| D26 | Forecast Deduplication Logic | V1.1 | 6-8h |
| D27 | Redirect Handling Email Notification | MVP | 2-3h |
| D28 | Response Size Anomaly Detection | MVP | 3-4h |
| | **TOTAL** | | **~148-210h** |

---

## D1. Dashboard Implementation Spec

### What's Missing
No wireframes, no page list, no component hierarchy, no state management, no responsive breakpoints. Definitive Plan says "Week 4" for the entire dashboard but never specifies what pages exist.

### Research: How Others Handle This

**Checkly (checkly.com):** Dashboard has: Home (overview cards), Checks list (table), Check detail (metrics + logs), Alerting, Settings. Clean sidebar nav. Dark mode default.

**BetterStack (betterstack.com/uptime):** Monitors list → Monitor detail (response time graph, incident history). Minimal sidebar: Monitors, Heartbeats, Incidents, Status Pages, Integrations, Settings.

**Sentry:** Left sidebar nav, breadcrumb header, content area. Heavy use of tabs within detail pages. Filterable tables everywhere.

**Common patterns:** Left sidebar navigation, overview/home page with key metrics, list→detail drill-down, settings as a separate section, responsive table → card layout on mobile.

### Design: Chirri Dashboard Pages

#### Page Map (11 pages for MVP)

```
/                          → Dashboard Home (overview)
/urls                      → URL List (table, filterable)
/urls/:id                  → URL Detail (metrics, checks, changes)
/urls/new                  → Add URL / Provider Search
/changes                   → Change Feed (all changes, filterable)
/changes/:id               → Change Detail (THE money screen — side-by-side diff)
/settings                  → Account Settings
/settings/api-keys         → API Key Management
/settings/webhooks         → Webhook Management
/settings/notifications    → Notification Preferences
/settings/billing          → Billing (Stripe portal link)
```

#### Component Hierarchy

```
AppShell
├── Sidebar (collapsible on mobile)
│   ├── Logo + "Chirri" wordmark
│   ├── NavItem: Dashboard (Home icon)
│   ├── NavItem: URLs (Link icon)
│   ├── NavItem: Changes (Bell icon)
│   ├── Divider
│   ├── NavItem: Settings (Gear icon)
│   ├── Spacer
│   ├── PlanBadge (Free / Indie)
│   └── UserMenu (avatar, name, logout)
├── TopBar (mobile only — hamburger + breadcrumb)
└── MainContent
    └── [Page Component]

Shared Components:
├── StatusBadge (learning | active | paused | error)
├── SeverityBadge (🔴 critical | 🟡 warning | 🟢 info)
├── ConfidenceBar (0-100 visual)
├── TimeAgo (relative time with absolute tooltip)
├── DiffViewer (side-by-side / unified toggle)
├── EmptyState (illustration + CTA)
├── DataTable (sortable, filterable, cursor-paginated)
├── MetricCard (number + label + trend arrow)
├── TTFBChart (sparkline or line chart)
└── FeedbackButtons (✅ Real | ❌ False Positive | 🤷 Not Sure)
```

#### Dashboard Home Page (`/`)

```
┌─────────────────────────────────────────────────────┐
│  Good morning, Alex                                  │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ 12       │ │ 2        │ │ 99.8%    │ │ 245ms  │ │
│  │ Active   │ │ Changes  │ │ Avg      │ │ Avg    │ │
│  │ URLs     │ │ This Week│ │ Uptime   │ │ TTFB   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                      │
│  Recent Changes                          View All →  │
│  ┌─────────────────────────────────────────────────┐│
│  │ 🔴 Stripe Prices API — Field removed  2h ago   ││
│  │ 🟢 OpenAI Models — New model added    1d ago   ││
│  │ 🟡 GitHub API — Header changed        3d ago   ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  URL Health                                          │
│  ┌─────────────────────────────────────────────────┐│
│  │ [Mini table: URL name, status, last check, TTFB]││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  What's New (Chirri updates)              See all →  │
│  │ v1.0.2 — Slack notifications now live            │
│  │ v1.0.1 — Improved JSON diff accuracy             │
└─────────────────────────────────────────────────────┘
```

#### Empty States

| Page | Empty State |
|------|-------------|
| Dashboard Home (0 URLs) | Illustration of a seed 🌱 + "Plant your first seed" + big CTA button → `/urls/new` + text: "Add a URL to start monitoring. It takes 10 seconds." |
| URL List (0 URLs) | Same seed illustration + "No URLs yet" + CTA |
| Change Feed (0 changes) | "All quiet 🦗" + "Your APIs haven't changed yet. That's a good thing." + subtle: "Chirri checks every [interval]. You'll see changes here when they happen." |
| Change Feed (has URLs, 0 changes, <7d old) | "Still listening..." + "Chirri has run X checks across Y URLs. No changes detected yet." |

#### Responsive Breakpoints

| Breakpoint | Layout |
|-----------|--------|
| ≥1280px (desktop) | Sidebar visible + full content |
| 768-1279px (tablet) | Collapsed sidebar (icons only) + full content |
| <768px (mobile) | Hidden sidebar (hamburger) + stacked cards, unified diff |

#### State Management
Use React Query (TanStack Query) or SWR for server state. No Redux/Zustand needed for MVP — all state comes from API. Local UI state (sidebar open, filters) via React useState or URL params.

### Implementation Notes

**Tech choice:** Next.js App Router (matches tech stack). Use shadcn/ui for components (Tailwind-based, customizable, dark mode built-in). Charts: recharts (lightweight).

**Key UI library dependencies:**
- `shadcn/ui` — buttons, tables, badges, cards, sheets, dialogs
- `recharts` — TTFB sparklines, uptime chart
- `diff2html` or custom — diff rendering (see D4)
- `date-fns` — relative time formatting

### Effort Estimate
**16-24 hours** (5-6 full days in Week 4 as planned)
- App shell + sidebar + routing: 3h
- Dashboard home + metric cards: 3h  
- URL list + detail pages: 6h
- Change detail (diff view): 6h (see D4)
- Settings pages: 4h
- Empty states + responsive: 2h

### Priority: **MVP** (blocks Week 4)

---

## D2. Check History API Endpoint

### What's Missing
Users can see changes but not individual check results. "Did Chirri actually check at 3am?" is unanswerable. No `GET /v1/urls/:id/checks` endpoint exists.

### Research: How Others Handle This

**UptimeRobot:** Shows full check log with response time, status code, timestamp. Filterable by date range. Paginated.

**Checkly:** "Check results" tab on each check — shows every run with response time, status, assertions passed/failed. Pagination + date filter.

**BetterStack:** "Response log" — table of timestamp, status code, response time. Downloadable.

**Common pattern:** Paginated table of check results, filterable by date range and status. Shows: timestamp, status code, response time, whether change was detected.

### Design: Chirri Check History

#### Endpoint: `GET /v1/urls/:id/checks`

```
Query params:
  ?since=2026-03-01T00:00:00Z    // ISO 8601, default: 7 days ago
  ?until=2026-03-24T00:00:00Z    // ISO 8601, default: now
  ?status=success|error|change    // filter
  ?cursor=cur_...                 // pagination
  ?limit=50                       // default 50, max 200

Response 200:
{
  "data": [
    {
      "id": "chk_abc123",
      "checked_at": "2026-03-24T03:00:00Z",
      "status_code": 200,
      "response_time_ms": 234,
      "body_size_bytes": 14523,
      "result": "no_change",        // no_change | change_detected | error | learning
      "change_id": null,            // populated if change_detected
      "error": null,                // populated if error
      "fingerprints": {
        "full_hash_changed": false,
        "stable_hash_changed": false,
        "schema_hash_changed": false,
        "header_hash_changed": false
      }
    }
  ],
  "summary": {
    "total_checks": 342,
    "period_checks": 48,
    "success_rate": 99.7,
    "avg_response_time_ms": 245,
    "changes_in_period": 1
  },
  "has_more": true,
  "next_cursor": "cur_..."
}
```

#### Dashboard UI: Check Log Tab

On the URL detail page (`/urls/:id`), add a "Check Log" tab:

```
┌─ Check Log ────────────────────────────────────────┐
│  Filter: [Date range picker] [Status: All ▼]       │
│                                                      │
│  Time              Status  Response  Size    Result  │
│  ─────────────────────────────────────────────────── │
│  Mar 24, 03:00    200     234ms     14KB   ✅ OK    │
│  Mar 24, 02:00    200     198ms     14KB   ✅ OK    │
│  Mar 24, 01:00    200     245ms     14KB   🔴 Change│
│  Mar 23, 24:00    200     201ms     14KB   ✅ OK    │
│  Mar 23, 23:00    503     —         —      ⚠️ Error │
│  ...                                                 │
│                                    [Load more]       │
└─────────────────────────────────────────────────────┘
```

### Implementation Notes

**Database query** (uses existing `check_results` table):
```sql
SELECT id, checked_at, status_code, response_time_ms, body_size_bytes,
       change_detected, change_id, error, error_category,
       full_hash, stable_hash, schema_hash, header_hash
FROM check_results
WHERE shared_url_id = (SELECT shared_url_id FROM urls WHERE id = $1 AND user_id = $2)
  AND checked_at BETWEEN $3 AND $4
ORDER BY checked_at DESC
LIMIT $5;
```

**Access control:** Ensure the URL belongs to the requesting user. Return 404 if not.

**Plan limit on history depth:** Free = 7 days, Indie = 30 days, Pro = 90 days, Business = 365 days. Return 403 if `since` is beyond retention.

### Effort Estimate
**4-6 hours**
- Endpoint + query + pagination: 2h
- Dashboard tab component: 2h
- Date range filter + status filter: 1h
- Tests: 1h

### Priority: **MVP** (essential for user trust)

---

## D3. Pause/Resume Behavior

### What's Missing
Total ambiguity: Does pausing free the URL slot? Does resume restart learning? Max pause duration before baseline is stale?

### Research: How Others Handle This

**UptimeRobot:** Pause = stop checking, keep slot. Resume = immediate check. No baseline concept.

**Checkly:** "Mute" = stop alerting but keep checking. "Deactivate" = stop checking but keep config. Both keep the slot.

**BetterStack:** Pause = stop checking, keep monitor. Resume = immediate. Warns if paused >60 days about potential data gaps.

**Common pattern:** Pausing keeps the slot, doesn't delete data, resume picks up where it left off. No re-learning.

### Design: Chirri Pause/Resume

#### Rules

| Question | Answer | Rationale |
|----------|--------|-----------|
| Does pausing free the slot? | **No** | Prevents gaming (pause 3 URLs to add a 4th). Consistent with all competitors. |
| Does resume restart learning? | **No** — uses existing baseline | Re-learning would mean 10 min of silence + 7 day calibration. Terrible UX. |
| Is there a stale baseline warning? | **Yes** — warn at >30 days paused | After 30 days, API may have changed significantly. Show amber warning. |
| What about >90 days? | **Force re-learn option** | Offer "Resume" (use old baseline) or "Re-learn" (start fresh). Default: resume. |
| Does pausing stop billing? | **No** | Slot is still reserved. Same as UptimeRobot, Checkly, etc. |
| Can you pause individual URLs? | **Yes** | `PATCH /v1/urls/:id { "status": "paused" }` |
| Can you bulk pause? | **V1.1** | Part of bulk operations (D5) |

#### API Behavior

**Pause:** `PATCH /v1/urls/:id { "status": "paused" }`
- Sets `status = 'paused'`, `paused_at = now()`
- Cancels scheduled checks (remove from scheduler queue)
- Keeps baseline, check history, change history
- Decrements `shared_urls.subscriber_count` — if 0, stop checking that shared URL too

**Resume:** `PATCH /v1/urls/:id { "status": "active" }`
- If paused <30 days: set `status = 'active'`, `next_check_at = now()` (immediate check)
- If paused 30-90 days: set status active, add `stale_baseline_warning: true` to response
- If paused >90 days: return `200` with `"warning": "baseline_may_be_stale"` and `"options": ["resume", "relearn"]`
  - Default behavior is resume. Client must explicitly POST to `/v1/urls/:id/relearn` to restart learning.
- Increments `shared_urls.subscriber_count`

**Relearn:** `POST /v1/urls/:id/relearn`
- Resets status to `learning`, clears baseline, starts fresh learning period
- Keeps historical check_results and changes

#### Database Change

Add column to `urls`:
```sql
ALTER TABLE urls ADD COLUMN paused_at TIMESTAMPTZ;
```

#### Dashboard UI

On URL detail, the "Pause" button changes to "Resume" when paused. Show warning banner:
- 30-90 days: "⚠️ This URL has been paused for X days. The baseline may be outdated. Resume will use the existing baseline."
- >90 days: "⚠️ This URL has been paused for X days. You can Resume (use old baseline) or Re-learn (start fresh)." + two buttons.

### Effort Estimate
**3-4 hours**
- API logic for pause/resume/relearn: 2h
- Dashboard UI (pause button, warnings): 1h
- Tests: 1h

### Priority: **MVP**

---

## D4. HTML/Docs Page Diff Rendering

### What's Missing
~20% of monitors are docs/changelog pages. For HTML, monitoring method is `content-hash` — detects THAT something changed but can't show WHAT. Users monitoring `stripe.com/docs/upgrades` get "content hash changed" with no visual diff.

### Research: How Others Handle This

**changedetection.io:** Uses multiple approaches:
- Text extraction via `inscriptis` (Python) — strips HTML, preserves structure
- Visual diffing via headless browser screenshot comparison
- Text-level diff with jsdiff-style output

**Diffbot:** AI-powered content extraction from arbitrary HTML.

**diff-match-patch (Google):** Word-level and character-level diffing of plain text. Battle-tested.

**Libraries available:**
- **cheerio** (npm, 27K+ stars): Parse HTML, extract text with structure
- **@mozilla/readability** (npm): Firefox Reader View algorithm — extracts article content
- **jsdiff** (npm, 8K+ stars): Text diffing — word diff, line diff, sentence diff
- **diff2html** (npm, 2.8K+ stars): Renders unified/side-by-side diffs as HTML
- **html-to-text** (npm): Converts HTML to formatted plain text preserving structure

### Design: Chirri HTML Diff Pipeline

#### Pipeline: HTML → Structured Text → Text Diff → Rendered Diff

```
Step 1: HTML → Structured Text
  ├── Use cheerio to parse HTML
  ├── Remove: <script>, <style>, <nav>, <footer>, <header> (boilerplate)
  ├── Extract: <main>, <article>, or <body> content
  ├── Convert to structured text preserving:
  │   ├── Headings (## H2, ### H3)
  │   ├── Paragraphs (blank line separated)
  │   ├── Lists (- item)
  │   ├── Code blocks (``` wrapped)
  │   └── Links ([text](url))
  └── Output: clean markdown-like text

Step 2: Text Diff
  ├── Use jsdiff.diffLines() for line-level comparison
  ├── For changed lines: jsdiff.diffWords() for word-level detail
  └── Output: array of {added, removed, value} hunks

Step 3: Render Diff
  ├── Use diff2html for side-by-side rendering
  ├── Or custom component matching Chirri's diff viewer style
  └── Word-level highlighting within changed lines
```

#### Implementation

```typescript
import * as cheerio from 'cheerio';
import { diffLines, diffWords } from 'diff';

function htmlToStructuredText(html: string): string {
  const $ = cheerio.load(html);
  
  // Remove boilerplate
  $('script, style, nav, footer, header, aside, [role="navigation"], [role="banner"]').remove();
  
  // Try to find main content
  const main = $('main, article, [role="main"], .content, .docs-content, #content').first();
  const root = main.length ? main : $('body');
  
  const lines: string[] = [];
  
  root.find('h1,h2,h3,h4,h5,h6,p,li,pre,code,td,th,blockquote').each((_, el) => {
    const $el = $(el);
    const tag = el.tagName?.toLowerCase();
    const text = $el.text().trim();
    if (!text) return;
    
    if (tag?.startsWith('h')) {
      const level = parseInt(tag[1]);
      lines.push('');
      lines.push('#'.repeat(level) + ' ' + text);
      lines.push('');
    } else if (tag === 'li') {
      lines.push('- ' + text);
    } else if (tag === 'pre' || tag === 'code') {
      lines.push('```');
      lines.push(text);
      lines.push('```');
    } else if (tag === 'blockquote') {
      lines.push('> ' + text);
    } else {
      lines.push(text);
      lines.push('');
    }
  });
  
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function computeHtmlDiff(oldHtml: string, newHtml: string) {
  const oldText = htmlToStructuredText(oldHtml);
  const newText = htmlToStructuredText(newHtml);
  
  const lineDiff = diffLines(oldText, newText);
  
  // Generate summary
  const added = lineDiff.filter(d => d.added).map(d => d.value).join('');
  const removed = lineDiff.filter(d => d.removed).map(d => d.value).join('');
  
  return {
    oldText,
    newText,
    diff: lineDiff,
    summary: generateHtmlDiffSummary(added, removed),
    addedLineCount: added.split('\n').filter(Boolean).length,
    removedLineCount: removed.split('\n').filter(Boolean).length,
  };
}
```

#### Monitoring Method Upgrade

For HTML content, change monitoring method from `content-hash` to `html-text-diff`:
1. On first check: extract structured text, store as baseline text (in addition to full HTML in R2)
2. On subsequent checks: extract text, compare text (not HTML hash)
3. If text changed: compute diff, create change with text-level diff
4. If text didn't change but HTML hash changed: it's a template/CSS change — log but don't alert

#### Database Impact

Add to `baselines`:
```sql
ALTER TABLE baselines ADD COLUMN extracted_text_hash TEXT;
-- The extracted text itself is stored alongside body in R2: {r2_key}.text
```

#### Dashboard Diff View for HTML

For HTML sources, the Change Detail page shows:
- **Left panel:** Old extracted text (markdown-formatted)
- **Right panel:** New extracted text (markdown-formatted)
- **Word-level highlighting** within changed paragraphs
- **Summary:** "3 paragraphs added, 1 paragraph modified in the Stripe API Upgrades changelog"

### Effort Estimate
**8-12 hours**
- HTML text extraction function: 3h
- Integration with check pipeline: 2h
- Text diff computation + summary: 2h
- Dashboard diff rendering for text: 3h
- Tests with real HTML pages: 2h

### Priority: **MVP** (20% of monitors need this)

---

## D5. Bulk URL Operations

### What's Missing
No `POST /v1/urls/bulk`. Users migrating from UptimeRobot with 50+ URLs must POST 50 times. No export for backup.

### Research: How Others Handle This

**Stripe:** Bulk-style operations not via dedicated endpoint — clients use their SDKs with loops. But has CSV import in dashboard.

**UptimeRobot:** Has CSV import in dashboard. Format: URL, name, interval, alert contacts.

**Checkly:** API-first with Terraform provider for bulk config. No dedicated bulk endpoint but supports `checks.create()` in a loop.

**BetterStack:** CSV import + API.

**Common pattern:** CSV/JSON import in dashboard UI + bulk create API endpoint. Partial success with per-item error reporting.

### Design: Chirri Bulk Operations

#### `POST /v1/urls/bulk`

```
Request:
{
  "urls": [
    {
      "url": "https://api.stripe.com/v1/prices",
      "name": "Stripe Prices",
      "interval": "1h"
    },
    {
      "url": "https://api.openai.com/v1/models",
      "name": "OpenAI Models",
      "interval": "1h"
    }
    // ... max 100 items
  ]
}

Response 200 (partial success):
{
  "created": [
    { "index": 0, "id": "url_abc", "url": "https://api.stripe.com/v1/prices", "status": "learning" },
    { "index": 1, "id": "url_def", "url": "https://api.openai.com/v1/models", "status": "learning" }
  ],
  "failed": [
    { "index": 5, "url": "http://localhost/admin", "error": { "code": "ssrf_blocked", "message": "..." } },
    { "index": 12, "url": "https://api.stripe.com/v1/charges", "error": { "code": "duplicate_url", "message": "..." } }
  ],
  "summary": {
    "total": 50,
    "created": 47,
    "failed": 3,
    "slots_remaining": 3
  }
}
```

**Rules:**
- Max 100 URLs per request
- Stops creating after plan limit reached (remaining items fail with `plan_limit_reached`)
- Each URL validated independently (SSRF, format, dedup)
- Transaction: NOT atomic — partial success is OK
- Rate limit: 5 bulk requests per hour

#### `GET /v1/urls/export`

```
Response 200:
{
  "urls": [
    {
      "url": "https://api.stripe.com/v1/prices",
      "name": "Stripe Prices",
      "interval": "1h",
      "method": "GET",
      "headers": { "Accept": "application/json" },
      "tags": ["payments"],
      "status": "active",
      "created_at": "2026-03-01T00:00:00Z"
    }
  ],
  "exported_at": "2026-03-24T12:00:00Z",
  "format_version": "1.0"
}
```

This format is designed to be re-importable via `/v1/urls/bulk`.

#### Dashboard UI: Import Page

```
┌─ Import URLs ──────────────────────────────────────┐
│                                                      │
│  [Paste JSON]  or  [Upload CSV]  or  [Import file]  │
│                                                      │
│  CSV format: url, name, interval                     │
│  (Download template CSV)                             │
│                                                      │
│  Preview:                                            │
│  ┌─────────────────────────────────────────────────┐│
│  │ ✅ api.stripe.com/v1/prices    Stripe Prices    ││
│  │ ✅ api.openai.com/v1/models    OpenAI Models    ││
│  │ ❌ localhost/admin             SSRF blocked      ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  47 of 50 URLs will be imported (3 slots remaining)  │
│                                                      │
│  [Import 47 URLs]                                    │
└─────────────────────────────────────────────────────┘
```

### Effort Estimate
**6-8 hours**
- Bulk create endpoint: 3h
- Export endpoint: 1h
- Dashboard import UI + CSV parsing: 3h
- Tests: 1h

### Priority: **V1.1** (migration users need this; not blocking MVP launch)

---

## D6. Onboarding Email Sequence

### What's Missing
Zero onboarding emails. No welcome, no "your first URL is being monitored," no "you haven't added URLs yet" nudge.

### Research: How Others Handle This

**Best practices from SaaS email research:**
1. **Welcome email (Day 0):** Immediate. Confirm signup, single CTA to first action. Keep short.
2. **Activation nudge (Day 1-2):** If user hasn't completed key action, remind them.
3. **Value delivery (Day 3-7):** Show what the product does, even if they haven't set it up.
4. **Social proof (Day 7-14):** Testimonials, case studies.

**Sentry:** Welcome → "Set up your first project" (Day 1) → "Here's what Sentry found" (Day 3) → Weekly digest.

**Checkly:** Welcome → "Create your first check" → "Your first results are in" → Tips email.

**Key insight:** The activation metric for Chirri is "add first URL." Every email before that should push toward adding a URL. Every email after should reinforce value.

### Design: Chirri Onboarding Sequence (5 emails)

#### Email 1: Welcome (Day 0, immediate)

**Subject:** "Welcome to Chirri 🦗"  
**Trigger:** Account created  
**CTA:** "Plant your first seed" → dashboard /urls/new

```
Hi {name},

You're in. Chirri is ready to watch your APIs.

Here's the fastest way to start:

1. Go to your dashboard
2. Enter a URL you depend on (or click "Monitor Stripe" to try it instantly)
3. Chirri starts learning it in 10 seconds

That's it. You'll get notified the moment anything changes.

[Plant your first seed →]

Quick links:
• API docs: docs.chirri.io
• Your API key: dashboard → Settings → API Keys
• Help: support@chirri.io

— Chirri
```

#### Email 2: Nudge (Day 1, if 0 URLs added)

**Subject:** "Your APIs are waiting"  
**Trigger:** 24h after signup AND url_count = 0  
**CTA:** "Add your first URL" → dashboard /urls/new  
**Skip if:** User has added ≥1 URL

```
Hi {name},

You signed up for Chirri but haven't added any URLs yet.

Here are 3 popular ones to start with:
• https://api.openai.com/v1/models — OpenAI API
• https://api.stripe.com/v1/prices — Stripe API  
• https://status.github.com/api/v2/summary.json — GitHub Status

Just paste any URL and Chirri figures out the best way to monitor it.

[Add your first URL →]

— Chirri
```

#### Email 3: First Check Report (after first URL completes learning)

**Subject:** "Your first seed is planted 🌱"  
**Trigger:** First URL transitions from learning → calibrating/active  
**Skip if:** Never — always send for first URL

```
Hi {name},

Chirri has learned {url_name}'s behavior:
• Content type: {content_type}
• Response time: {avg_ttfb}ms
• Status: {status_code}

You'll get notified if anything changes. In the meantime, 
your dashboard shows response times and availability.

[View your dashboard →]

Tip: Add more URLs to monitor your entire API dependency stack.

— Chirri
```

#### Email 4: Inactivity Re-engagement (Day 7, if no dashboard visits in 5 days)

**Subject:** "All quiet on the API front"  
**Trigger:** 7 days after signup AND no dashboard visit in 5 days AND has ≥1 URL  
**Skip if:** User has visited dashboard in last 5 days

```
Hi {name},

Good news: your {url_count} monitored URL(s) are stable. 
Chirri has run {check_count} checks with no changes detected.

Stability is valuable information — it means your dependencies are reliable.

Want to monitor more? You have {slots_remaining} URL slots remaining on your {plan} plan.

[View your dashboard →]

— Chirri
```

#### Email 5: First Weekly Report (Day 7)

See D7 for weekly report content. This IS the weekly stability report, sent on the 7th day regardless of what's happened. After this, it runs weekly on schedule.

### Implementation Notes

**Email infrastructure:** Resend (already chosen). Use Resend's batch API.

**Trigger mechanism:** BullMQ delayed jobs:
- On signup: enqueue Email 2 with 24h delay (cancel if URL added)
- On first URL learning complete: enqueue Email 3
- On Day 7: enqueue Email 4 (cancel if dashboard visited) + Email 5

**Tracking:** Add to `users` table:
```sql
ALTER TABLE users ADD COLUMN onboarding_step INT DEFAULT 0;
ALTER TABLE users ADD COLUMN last_dashboard_visit_at TIMESTAMPTZ;
```

**Unsubscribe:** Every email includes one-click unsubscribe link (CAN-SPAM requirement). Use Resend's built-in unsubscribe handling. Store preference:
```sql
ALTER TABLE users ADD COLUMN email_preferences JSONB DEFAULT '{"onboarding": true, "weekly_report": true, "product_updates": true, "marketing": true}';
```

### Effort Estimate
**6-8 hours**
- Email templates (5 emails, Resend): 3h
- Trigger logic (BullMQ delayed jobs): 2h
- Onboarding state tracking: 1h
- Unsubscribe handling: 1h
- Tests: 1h

### Priority: **MVP** (critical for activation and reducing churn)

---

## D7. Weekly Stability Report Content

### What's Missing
No specification of what data the weekly email contains, no template design, no opt-out mechanism, no handling for users with 0 changes.

### Research: How Others Handle This

**Checkly:** Weekly summary: checks passed/failed, response time trends, incidents list. Clean HTML email.

**BetterStack:** "Last 7 days" summary: uptime %, incidents, response time graph (as image).

**UptimeRobot:** Monthly report: uptime stats per monitor, response time, incidents.

**Common pattern:** Keep it short. Lead with "everything's fine" or "X things happened." Include numbers. Make it scannable.

### Design: Chirri Weekly Stability Report

**Subject:** "Your API stability report — Week of {date}"  
(or if changes detected: "Your API stability report — {n} changes detected")

**Send schedule:** Every Monday at 09:00 in user's timezone (default UTC).

#### Template

```
┌─────────────────────────────────────────────────────┐
│  [Chirri logo]                                       │
│                                                      │
│  Weekly Stability Report                             │
│  {start_date} — {end_date}                          │
│                                                      │
│  ┌─────────────────────────────────────────────────┐│
│  │  {n} URLs monitored  •  {checks} checks run     ││
│  │  {changes} changes detected  •  {uptime}% avg   ││
│  └─────────────────────────────────────────────────┘│
│                                                      │
│  ── Changes This Week ──                            │
│  (if 0: "No changes detected. Your APIs are        │
│   stable. ✅")                                       │
│                                                      │
│  (if >0:)                                            │
│  🔴 Stripe Prices API — Field `amount` removed      │
│     Detected: Mar 22 at 14:32 UTC                    │
│     [View diff →]                                    │
│                                                      │
│  🟢 OpenAI Models — New model `gpt-4o-mini` added   │
│     Detected: Mar 20 at 09:15 UTC                    │
│     [View diff →]                                    │
│                                                      │
│  ── Response Time Trends ──                          │
│  (Top 3 URLs by response time change)                │
│  ⬆️ Stripe Prices: 245ms → 380ms (+55%)             │
│  ⬇️ OpenAI Models: 890ms → 450ms (-49%)             │
│  ➡️ GitHub API: 120ms → 125ms (stable)               │
│                                                      │
│  ── URL Health Summary ──                            │
│  ✅ 10 Active  ⏸️ 2 Paused  ⚠️ 0 Errors             │
│                                                      │
│  [View full dashboard →]                             │
│                                                      │
│  ────────────────────────────────────                │
│  You're on the {plan} plan ({url_count}/{max_urls}   │
│  URLs used).                                         │
│  [Manage preferences] · [Unsubscribe from weekly     │
│  reports]                                            │
└─────────────────────────────────────────────────────┘
```

#### Edge Cases

| Scenario | Handling |
|----------|----------|
| User has 0 URLs | Don't send. OR send "You haven't added any URLs yet — [Plant your first seed →]" |
| User has URLs but 0 checks (all paused) | "All your URLs are paused. Nothing to report." |
| Massive week (>10 changes) | Show top 5 by severity, link to dashboard for rest: "+ 7 more changes" |
| User unsubscribed | Don't send. Respect `email_preferences.weekly_report` |

#### Data Query

```sql
-- Weekly report data for user
WITH user_url_ids AS (
  SELECT id, url, name, status, shared_url_id
  FROM urls WHERE user_id = $1
),
week_checks AS (
  SELECT cr.shared_url_id, COUNT(*) as check_count,
         AVG(cr.response_time_ms) as avg_ttfb,
         SUM(CASE WHEN cr.error IS NOT NULL THEN 1 ELSE 0 END) as error_count
  FROM check_results cr
  JOIN user_url_ids u ON cr.shared_url_id = u.shared_url_id
  WHERE cr.checked_at >= NOW() - INTERVAL '7 days'
  GROUP BY cr.shared_url_id
),
week_changes AS (
  SELECT uc.url_id, c.id, c.severity, c.summary, c.change_type, c.detected_at
  FROM user_changes uc
  JOIN changes c ON uc.change_id = c.id
  WHERE uc.user_id = $1 AND c.detected_at >= NOW() - INTERVAL '7 days'
  ORDER BY c.severity DESC, c.detected_at DESC
  LIMIT 10
)
SELECT ...;
```

#### Opt-out

- One-click unsubscribe link in email footer (CAN-SPAM/GDPR requirement)
- `POST /v1/account/email-preferences` endpoint
- Dashboard: Settings → Notifications → "Weekly stability report" toggle

### Effort Estimate
**4-6 hours**
- Data aggregation query: 1h
- Email template (Resend/React Email): 2h
- Cron job + scheduling (timezone-aware): 1h
- Opt-out mechanism: 1h
- Tests: 1h

### Priority: **MVP** (Definitive Plan says it ships with MVP)

---

## D8. Notification Rate Limit Value

### What's Missing
"Max N alerts per provider per hour" never specifies N. This is a critical tuning parameter.

### Research: How Others Handle This

**Alertmanager (Prometheus):**
- Critical: repeat every 1 hour
- Warning: repeat every 4 hours
- Group wait: 30 seconds, group interval: 5 minutes

**Courier.com research:** Recommends max 3 push notifications per hour to avoid fatigue.

**PagerDuty:** Configurable per-service, default is no limit for critical, 1/hour for warnings.

**OneUptime:** Alert throttling: configurable per monitor. Default: 1 alert per 5 minutes per monitor.

**Sentry:** Issue rate limiting: configurable per-project. Default: 100 events/hour before throttling.

### Design: Chirri Notification Rate Limits

#### Rate Limit Matrix

| Plan | Critical/Breaking alerts/provider/hour | Warning/Info alerts/provider/hour | Total alerts/hour (all providers) |
|------|---------------------------------------|----------------------------------|----------------------------------|
| Free | 3 | 2 | 10 |
| Indie | 10 | 5 | 30 |
| Pro | 20 | 10 | 100 |
| Business | 50 | 25 | 500 |

#### Logic

```typescript
const NOTIFICATION_RATE_LIMITS = {
  free:     { criticalPerProviderPerHour: 3,  warningPerProviderPerHour: 2,  totalPerHour: 10 },
  indie:    { criticalPerProviderPerHour: 10, warningPerProviderPerHour: 5,  totalPerHour: 30 },
  pro:      { criticalPerProviderPerHour: 20, warningPerProviderPerHour: 10, totalPerHour: 100 },
  business: { criticalPerProviderPerHour: 50, warningPerProviderPerHour: 25, totalPerHour: 500 },
};
```

**Redis keys:**
```
notif_rate:{user_id}:{provider_domain}:{severity_bucket}:{hour} → counter (TTL 2h)
notif_rate:{user_id}:total:{hour} → counter (TTL 2h)
```

**Severity buckets:** `critical` = critical + breaking. `warning` = warning + info.

**When rate limited:** Don't drop the notification — queue it and deliver in the next window. Add a note: "This alert was delayed due to rate limiting. You received {N} alerts in the last hour."

**Dashboard indicator:** Show rate-limited notifications in the notification log with a clock icon.

### Effort Estimate
**2-3 hours**
- Redis rate limit check in notification worker: 1h
- Plan-based configuration: 30m
- Rate limit queueing logic: 1h
- Tests: 30m

### Priority: **MVP**

---

## D9. Smart Chirp Relevance Filter Implementation

### What's Missing
The relevance filter for bonus sources ("Does the change text mention the user's monitored path/endpoint?") has no implementation detail. No matching algorithm defined.

### Research: Relevance Matching Approaches

**Options:**
1. **Exact path matching:** Does "v1/prices" appear in the changelog text? Simple but brittle.
2. **Fuzzy keyword matching:** Does the change mention "price" or "payment" or "billing"? Too broad.
3. **Semantic matching:** Use NLP/embeddings. Way overkill for MVP.
4. **Structured matching:** Extract API paths/endpoints from changelog, match against user's monitored URLs.

### Design: Chirri Relevance Filter

#### Matching Algorithm (3 tiers)

```typescript
interface RelevanceMatch {
  score: number;       // 0-100
  matchType: 'exact_path' | 'path_segment' | 'keyword' | 'version' | 'none';
  matchedText: string; // what matched
}

function computeRelevance(
  changeText: string,           // the changelog/signal text
  userUrls: { url: string; name: string }[]  // user's monitored URLs for this provider
): RelevanceMatch {
  
  // Tier 1: Exact path match (score: 90-100)
  // Extract paths from user URLs, look for them in change text
  for (const { url } of userUrls) {
    const path = new URL(url).pathname;  // e.g., "/v1/prices"
    if (changeText.toLowerCase().includes(path.toLowerCase())) {
      return { score: 95, matchType: 'exact_path', matchedText: path };
    }
  }
  
  // Tier 2: Path segment match (score: 60-80)
  // Match significant path segments: "prices", "invoices", "models"
  for (const { url } of userUrls) {
    const segments = new URL(url).pathname.split('/').filter(s => 
      s.length > 2 && !/^v\d+$/.test(s)  // skip version segments
    );
    for (const segment of segments) {
      if (changeText.toLowerCase().includes(segment.toLowerCase())) {
        return { score: 70, matchType: 'path_segment', matchedText: segment };
      }
    }
  }
  
  // Tier 3: Version match (score: 50-70)
  // If user monitors /v1/* and changelog mentions "v1" deprecation
  for (const { url } of userUrls) {
    const versionMatch = new URL(url).pathname.match(/\/v(\d+)/);
    if (versionMatch) {
      const versionPattern = new RegExp(`\\bv${versionMatch[1]}\\b`, 'i');
      if (versionPattern.test(changeText)) {
        return { score: 60, matchType: 'version', matchedText: `v${versionMatch[1]}` };
      }
    }
  }
  
  return { score: 0, matchType: 'none', matchedText: '' };
}
```

#### Threshold Configuration

| Scenario | Threshold | Action |
|----------|-----------|--------|
| Score ≥ 80 | High relevance | Notify via configured channels |
| Score 50-79 | Medium relevance | Dashboard only + digest email |
| Score < 50 | Low relevance | Dashboard only, collapsed in feed |
| Score 0 | No match | Still visible in provider's "all signals" view, not in main feed |

#### Source Preference Integration

Users can override the relevance filter per source:
- "Show all signals from this source" (bypass filter)
- "Only show high-relevance signals" (threshold 80)
- "Mute this source" (hide everything)

### Effort Estimate
**8-12 hours**
- Matching algorithm: 3h
- Integration with notification pipeline: 3h
- Per-source preference override: 2h
- Dashboard relevance indicators: 2h
- Tests with real changelog data: 2h

### Priority: **V1.1** (bonus sources are V1.1; filter needed when they ship)

---

## D10. `monitored_sources` Table Definition

### What's Missing
Source Preferences references `monitored_sources(id)` as FK in two tables. No document defines this table. It's unclear whether this maps to `urls` or is a separate concept.

### Research: What Is a "Monitored Source"?

From context:
- A **URL** is what the user explicitly adds (1 slot)
- A **source** is a monitorable endpoint for a provider (OpenAPI spec, changelog, status page, SDK releases)
- A **monitored source** is a source that's actively being checked — could be a user's URL or a bundled source

The distinction: when a user adds "Stripe" as a provider, they get:
1. OpenAPI spec (uses 1 URL slot → this is a `urls` row)
2. Changelog (bundled, free → this needs a different tracking mechanism)
3. Status page (bundled, free → same)
4. SDK releases (bundled, free → same)

**Sources #2-4 don't have `urls` rows** because they don't count as URL slots. But they need:
- Tracking of what's being monitored
- Per-source alert preferences
- Change history linkage

### Design: `monitored_sources` Table

```sql
CREATE TABLE monitored_sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- What provider this belongs to
    provider_slug   TEXT NOT NULL,           -- "stripe", "openai", etc.
    
    -- Source definition
    source_type     TEXT NOT NULL
                    CHECK (source_type IN (
                        'primary',          -- user's main URL (links to urls table)
                        'changelog',        -- bundled changelog
                        'status_page',      -- bundled status page
                        'sdk_release',      -- bundled SDK release feed
                        'docs',             -- bundled docs page
                        'custom'            -- user-added additional source
                    )),
    
    -- Link to urls table (for primary and custom sources that use URL slots)
    url_id          UUID REFERENCES urls(id) ON DELETE CASCADE,
    
    -- For bundled sources (no url_id): what to monitor
    source_url      TEXT,                    -- the actual URL for bundled sources
    source_name     TEXT NOT NULL,           -- "Stripe Changelog", "Stripe Status Page"
    
    -- Link to shared monitoring
    shared_url_id   UUID REFERENCES shared_urls(id),
    
    -- Alert preferences (overrides per-source)
    alerts_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    min_severity    TEXT DEFAULT 'info'
                    CHECK (min_severity IN ('critical', 'breaking', 'warning', 'info')),
    
    -- State
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- One source type per provider per user
    UNIQUE (user_id, provider_slug, source_type, source_url)
);

CREATE INDEX idx_monitored_sources_user ON monitored_sources (user_id);
CREATE INDEX idx_monitored_sources_provider ON monitored_sources (user_id, provider_slug);
CREATE INDEX idx_monitored_sources_shared ON monitored_sources (shared_url_id) WHERE shared_url_id IS NOT NULL;
```

#### How It Connects

```
users ──1:N──> monitored_sources
                    │
                    ├── source_type = 'primary' → url_id → urls table (uses slot)
                    ├── source_type = 'changelog' → source_url (bundled, free)
                    ├── source_type = 'status_page' → source_url (bundled, free)
                    ├── source_type = 'sdk_release' → source_url (bundled, free)
                    └── source_type = 'custom' → url_id → urls table (uses slot)
                    
                    All types → shared_url_id → shared_urls (for actual check execution)
```

#### Migration from Source Preferences

The `source_alert_preferences` table from Source Preferences doc should FK to `monitored_sources.id`, NOT to a nonexistent table.

```sql
-- Fix the FK references
ALTER TABLE source_alert_preferences 
  ADD CONSTRAINT fk_source_alert_pref_source 
  FOREIGN KEY (monitored_source_id) REFERENCES monitored_sources(id) ON DELETE CASCADE;
```

### Effort Estimate
**4-6 hours**
- Table creation + migration: 1h
- Integration with provider onboarding flow: 2h
- API endpoints for listing sources per provider: 1h
- Tests: 1h
- Update FK references in source_alert_preferences: 1h

### Priority: **MVP** (blocks provider intelligence feature)

---

## D11. Discovery Service Implementation

### What's Missing
Discovery (probe paths per domain) is referenced but has no implementation: no list of probe paths, no heuristics, no error handling, no SSRF protection on probe URLs.

### Research: What to Probe

**Common API documentation/changelog locations:**
```
/changelog
/changelog.xml
/changelog.json
/docs/changelog
/blog/changelog
/api/changelog
/openapi.json
/openapi.yaml
/swagger.json
/swagger.yaml
/api-docs
/.well-known/openapi
/docs
/api/docs
/status
/status.json
/api/v2/summary.json          (Statuspage.io standard)
/api/v2/components.json       (Statuspage.io)
/feed
/feed.xml
/feed.rss
/atom.xml
/rss.xml
/releases.atom                (GitHub pattern)
/sitemap.xml
```

### Design: Discovery Service

#### Architecture

```
User adds URL → Extract domain → Check provider database
                                    │
                                    ├── Known provider → Return predefined sources (no probing)
                                    └── Unknown domain → Queue discovery job
                                    
Discovery Job:
  1. Probe paths (max 15, configurable per phase)
  2. Validate responses (content type, structure)
  3. Classify discovered sources
  4. Store results
  5. Suggest to user (don't auto-add)
```

#### Probe Path List (Prioritized)

```typescript
const DISCOVERY_PROBES = [
  // Phase 1: High-value, low-cost (always probe)
  { path: '/openapi.json', expect: 'json', source_type: 'openapi_spec' },
  { path: '/openapi.yaml', expect: 'yaml', source_type: 'openapi_spec' },
  { path: '/swagger.json', expect: 'json', source_type: 'openapi_spec' },
  { path: '/api/v2/summary.json', expect: 'json', source_type: 'status_page' },  // Statuspage.io
  { path: '/changelog', expect: 'html', source_type: 'changelog' },
  { path: '/feed.xml', expect: 'xml', source_type: 'rss_feed' },
  
  // Phase 2: Secondary (probe if Phase 1 found nothing useful)
  { path: '/atom.xml', expect: 'xml', source_type: 'rss_feed' },
  { path: '/rss.xml', expect: 'xml', source_type: 'rss_feed' },
  { path: '/docs/changelog', expect: 'html', source_type: 'changelog' },
  { path: '/blog/changelog', expect: 'html', source_type: 'changelog' },
  { path: '/.well-known/openapi', expect: 'json', source_type: 'openapi_spec' },
  
  // Phase 3: Speculative (only if budget allows)
  { path: '/status', expect: 'html', source_type: 'status_page' },
  { path: '/api-docs', expect: 'html', source_type: 'docs' },
  { path: '/docs', expect: 'html', source_type: 'docs' },
  { path: '/sitemap.xml', expect: 'xml', source_type: 'sitemap' },
];
```

#### Validation Heuristics

```typescript
function validateDiscoveredSource(response: Response, probe: Probe): DiscoveryResult | null {
  // Must be 200
  if (response.status !== 200) return null;
  
  const contentType = response.headers.get('content-type') || '';
  const body = await response.text();
  
  switch (probe.source_type) {
    case 'openapi_spec':
      // Must have "openapi" or "swagger" key in JSON
      try {
        const json = JSON.parse(body);
        if (json.openapi || json.swagger) {
          return { type: 'openapi_spec', confidence: 95, title: json.info?.title };
        }
      } catch { return null; }
      break;
      
    case 'status_page':
      // Statuspage.io: must have "page" and "components" or "status" keys
      try {
        const json = JSON.parse(body);
        if (json.page && (json.components || json.status)) {
          return { type: 'status_page', confidence: 90, title: json.page.name };
        }
      } catch { return null; }
      break;
      
    case 'rss_feed':
      // Must contain <rss or <feed or <channel
      if (body.includes('<rss') || body.includes('<feed') || body.includes('<channel')) {
        return { type: 'rss_feed', confidence: 85, title: extractFeedTitle(body) };
      }
      break;
      
    case 'changelog':
      // Must contain changelog-like keywords
      const keywords = ['changelog', 'release', 'what\'s new', 'update', 'version'];
      const hasKeyword = keywords.some(k => body.toLowerCase().includes(k));
      if (hasKeyword && body.length > 500) {
        return { type: 'changelog', confidence: 60, title: 'Changelog' };
      }
      break;
  }
  
  return null;
}
```

#### SSRF Protection

**CRITICAL:** All discovery probe URLs MUST go through `safeFetch()`. The probe constructs URLs by combining user-provided domain + probe paths:
```typescript
const probeUrl = new URL(probe.path, `https://${domain}`);
// This URL MUST pass through safeFetch() for SSRF validation
```

**Additional protections:**
- Only HTTPS (never HTTP for discovery)
- Total discovery budget: 15 requests per domain per day
- Rate limit: 1 probe per second per domain (shared with regular checks)
- Abort if any probe returns >1MB
- No following redirects during discovery (if 301/302, store the redirect target for manual review)

#### Storage

```sql
CREATE TABLE discovery_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain          TEXT NOT NULL,
    path            TEXT NOT NULL,
    source_type     TEXT NOT NULL,
    confidence      INT NOT NULL,
    title           TEXT,
    status_code     INT,
    content_type    TEXT,
    
    -- State
    state           TEXT NOT NULL DEFAULT 'discovered'
                    CHECK (state IN ('discovered', 'suggested', 'accepted', 'rejected')),
    
    discovered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
    
    UNIQUE (domain, path)
);

CREATE INDEX idx_discovery_domain ON discovery_results (domain);
```

### Effort Estimate
**12-16 hours**
- Probe pipeline + path list: 3h
- Validation heuristics: 3h
- SSRF integration: 2h
- Storage + API: 2h
- Integration with URL add flow: 2h
- Tests with real domains: 2h
- Rate limiting + budget management: 2h

### Priority: **V1.1** (MVP uses hardcoded provider profiles; discovery enhances unknown domains)

---

## D12. Provider Definition for Mega-Providers

### What's Missing
Provider model assumes 1 domain = 1 provider. Google has Maps API, Cloud API, YouTube, Firebase. Amazon has AWS (hundreds of services). Is "Google" 1 provider or 5?

### Research: How Others Handle This

**APIs.guru:** Treats each API as separate: `googleapis.com:calendar`, `googleapis.com:drive`, `googleapis.com:youtube`. They use provider + API name as composite key.

**Postman Collections:** Collections are per-API, not per-company. "Stripe Payments API" is separate from "Stripe Connect API."

### Design: Hierarchical Provider Model

#### Structure

```
Company (optional grouping)
└── Provider (domain-level, what user interacts with)
    └── Sources (monitorable endpoints)
```

For MVP's 15-20 hardcoded profiles:

```typescript
interface ProviderProfile {
  slug: string;                    // unique key: "stripe", "openai-api", "aws-s3"
  name: string;                    // display: "Stripe", "OpenAI API", "AWS S3"
  company?: string;                // grouping: "Google", "Amazon", "Microsoft"
  domains: string[];               // matching: ["api.stripe.com", "stripe.com"]
  icon?: string;                   // emoji or URL
  sources: ProviderSource[];
}

interface ProviderSource {
  type: 'openapi_spec' | 'changelog' | 'status_page' | 'sdk_release' | 'docs';
  name: string;
  url: string;
  monitoring_method: string;
  default_interval: string;
  bundled: boolean;                // true = free, doesn't use slot
}
```

#### Mega-Provider Handling

```typescript
const PROVIDER_PROFILES: ProviderProfile[] = [
  // Simple: 1 company = 1 provider
  {
    slug: 'stripe',
    name: 'Stripe',
    domains: ['api.stripe.com', 'stripe.com'],
    sources: [
      { type: 'openapi_spec', name: 'Stripe OpenAPI', url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json', monitoring_method: 'spec-diff', default_interval: '6h', bundled: false },
      { type: 'changelog', name: 'Stripe Changelog', url: 'https://stripe.com/blog/changelog', monitoring_method: 'html-text-diff', default_interval: '2h', bundled: true },
      { type: 'status_page', name: 'Stripe Status', url: 'https://status.stripe.com/api/v2/summary.json', monitoring_method: 'status-page', default_interval: '10m', bundled: true },
      { type: 'sdk_release', name: 'stripe-node releases', url: 'https://github.com/stripe/stripe-node/releases.atom', monitoring_method: 'feed-poll', default_interval: '6h', bundled: true },
    ]
  },
  
  // Mega-provider: split by product
  {
    slug: 'google-maps',
    name: 'Google Maps Platform',
    company: 'Google',
    domains: ['maps.googleapis.com'],
    sources: [ /* Maps-specific sources */ ]
  },
  {
    slug: 'google-cloud',
    name: 'Google Cloud APIs',
    company: 'Google',
    domains: ['cloud.google.com', '*.googleapis.com'],
    sources: [ /* Cloud-specific sources */ ]
  },
  
  // AWS: too many to enumerate, treat as umbrella
  {
    slug: 'aws',
    name: 'AWS',
    company: 'Amazon',
    domains: ['*.amazonaws.com'],
    sources: [
      { type: 'status_page', name: 'AWS Health', url: 'https://health.aws.amazon.com/health/status', monitoring_method: 'html-text-diff', default_interval: '10m', bundled: true },
      { type: 'changelog', name: 'AWS Updates', url: 'https://aws.amazon.com/new/feed/', monitoring_method: 'feed-poll', default_interval: '1h', bundled: true },
    ]
  },
];
```

#### Domain Matching Logic

```typescript
function matchProvider(url: string): ProviderProfile | null {
  const hostname = new URL(url).hostname;
  
  for (const provider of PROVIDER_PROFILES) {
    for (const domain of provider.domains) {
      if (domain.startsWith('*.')) {
        // Wildcard match: *.googleapis.com matches maps.googleapis.com
        const suffix = domain.slice(2);
        if (hostname.endsWith(suffix)) return provider;
      } else {
        if (hostname === domain) return provider;
      }
    }
  }
  
  return null;
}
```

#### UI: Provider Search

When user types in the "Add URL" field:
1. If input matches a provider domain → show provider card with sources
2. If input is a provider name (fuzzy search) → show matching providers
3. Otherwise → treat as URL, proceed with normal add flow

```
User types: "stripe"
→ Shows: 
┌─────────────────────────────────────────────┐
│ 🟣 Stripe                                   │
│ Monitor OpenAPI spec, changelog, status page │
│ [Add Stripe →]                               │
├─────────────────────────────────────────────┤
│ Or enter a specific URL:                     │
│ [https://api.stripe.com/v1/...          ]   │
└─────────────────────────────────────────────┘
```

### Effort Estimate
**4-6 hours**
- Provider profile JSON file (15-20 providers): 2h
- Domain matching logic: 1h
- Provider search in dashboard: 2h
- Tests: 1h

### Priority: **MVP** (needed for "Monitor Stripe" flow)

---

## D13. Account Deletion Flow (GDPR)

### What's Missing
`DELETE /v1/account` exists but: no dashboard UI, no shared data handling, no team owner blocking, no R2 cleanup, no grace period.

### Research: How Others Handle This

**Getaround (detailed implementation):** 
- 30-day grace period before actual deletion
- Archive phase → Delete phase
- Email notification at each stage
- Separate model tracking the deletion flow state

**Stripe:** Account deletion requests processed within 30 days. Download data first. Confirmation email.

**GDPR requirements:**
- Right to erasure (Art. 17): Must delete personal data "without undue delay"
- Exceptions: legal obligations (tax records), legitimate interests
- Must handle shared data: anonymize rather than delete if other users depend on it

### Design: Chirri Account Deletion Flow

#### Flow

```
User clicks "Delete Account" in Settings
    │
    ├── Show confirmation dialog:
    │   "This will permanently delete your account and all monitoring data.
    │    This action cannot be undone."
    │   [Download your data first] [Cancel] [Delete my account]
    │
    ├── User confirms → API: POST /v1/account/delete
    │
    ├── Grace period: 7 days
    │   ├── Account status → "pending_deletion"
    │   ├── All monitoring paused immediately
    │   ├── User can still log in and cancel deletion
    │   ├── Email sent: "Your account will be deleted on {date}"
    │   └── Dashboard shows: "Account scheduled for deletion. [Cancel deletion]"
    │
    ├── Day 7: Deletion job runs
    │   ├── Cancel Stripe subscription (if any)
    │   ├── Delete user data (see table below)
    │   ├── Anonymize shared data
    │   ├── Send final email: "Your account has been deleted"
    │   └── Mark user record as deleted (soft delete)
    │
    └── Done
```

#### Data Handling Matrix

| Table | Action | Rationale |
|-------|--------|-----------|
| `users` | Anonymize: set email → `deleted_{hash}@chirri.io`, clear name, clear password_hash | Keep row for referential integrity; anonymize PII |
| `api_keys` | Hard delete | No longer needed |
| `urls` | Hard delete | User's monitoring config |
| `monitored_sources` | Hard delete | User's source preferences |
| `user_changes` | Hard delete | Per-user change views |
| `webhooks` | Hard delete | User's webhook configs |
| `webhook_deliveries` | Hard delete | Delivery logs |
| `notifications` | Hard delete | Notification history |
| `check_results` | Keep (shared_url_id based) | Shared monitoring data; not personal |
| `changes` | Keep | Shared detection data; not personal |
| `shared_urls` | Decrement subscriber_count; delete if 0 | Shared resource |
| `baselines` | Keep (linked to shared_urls) | Shared resource |
| R2 snapshots | Keep (linked to shared_urls) | Shared resource; not personal |
| Stripe customer | Cancel subscription via API | Required for billing cleanup |

#### API

```
POST /v1/account/delete
Request:
{
  "confirmation": "DELETE MY ACCOUNT",  // must type exactly
  "reason": "switching_tools"            // optional, for analytics
}

Response 200:
{
  "status": "pending_deletion",
  "deletion_date": "2026-03-31T00:00:00Z",
  "message": "Your account will be deleted on March 31, 2026. You can cancel this in Settings."
}

POST /v1/account/cancel-deletion
Response 200:
{
  "status": "active",
  "message": "Account deletion cancelled. Your monitoring has been resumed."
}
```

#### Implementation

```typescript
async function deleteUserData(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Cancel Stripe subscription
    const user = await tx.query('SELECT stripe_subscription_id FROM users WHERE id = $1', [userId]);
    if (user.stripe_subscription_id) {
      await stripe.subscriptions.cancel(user.stripe_subscription_id);
    }
    
    // 2. Delete user-specific data
    await tx.query('DELETE FROM webhook_deliveries WHERE webhook_id IN (SELECT id FROM webhooks WHERE user_id = $1)', [userId]);
    await tx.query('DELETE FROM webhooks WHERE user_id = $1', [userId]);
    await tx.query('DELETE FROM notifications WHERE user_id = $1', [userId]);
    await tx.query('DELETE FROM user_changes WHERE user_id = $1', [userId]);
    await tx.query('DELETE FROM monitored_sources WHERE user_id = $1', [userId]);
    await tx.query('DELETE FROM api_keys WHERE user_id = $1', [userId]);
    
    // 3. Handle URLs and shared monitoring
    const urls = await tx.query('SELECT id, shared_url_id FROM urls WHERE user_id = $1', [userId]);
    for (const url of urls.rows) {
      // Decrement shared subscriber count
      const result = await tx.query(
        'UPDATE shared_urls SET subscriber_count = subscriber_count - 1 WHERE id = $1 RETURNING subscriber_count',
        [url.shared_url_id]
      );
      // If no more subscribers, clean up shared URL
      if (result.rows[0]?.subscriber_count <= 0) {
        await tx.query('DELETE FROM baselines WHERE shared_url_id = $1', [url.shared_url_id]);
        await tx.query('DELETE FROM learning_samples WHERE shared_url_id = $1', [url.shared_url_id]);
        await tx.query('DELETE FROM shared_urls WHERE id = $1', [url.shared_url_id]);
        // Note: R2 snapshot cleanup handled async (separate maintenance job)
      }
    }
    await tx.query('DELETE FROM urls WHERE user_id = $1', [userId]);
    
    // 4. Anonymize user record
    await tx.query(`
      UPDATE users SET
        email = 'deleted_' || encode(sha256(email::bytea), 'hex') || '@chirri.io',
        password_hash = 'DELETED',
        name = NULL,
        stripe_customer_id = NULL,
        stripe_subscription_id = NULL,
        subscription_status = 'canceled',
        notification_defaults = '{}',
        updated_at = now()
      WHERE id = $1
    `, [userId]);
  });
}
```

### Effort Estimate
**8-12 hours**
- Deletion flow logic + grace period: 3h
- Data cleanup function: 3h
- Dashboard UI (confirmation dialog, pending state): 2h
- Emails (scheduled deletion, completed deletion, cancellation): 1h
- Cron job for processing pending deletions: 1h
- Tests: 2h

### Priority: **MVP** (legal requirement for EU users)

---

## D14. Data Export — Async for Large Accounts

### What's Missing
`GET /v1/account/export` appears synchronous. Large accounts could timeout. No format specified.

### Design: Async Export

#### Flow

```
POST /v1/account/export
  → Returns 202: { "export_id": "exp_...", "status": "processing" }
  → Enqueues background job

Background job:
  → Queries all user data
  → Creates ZIP file with JSON files
  → Uploads to R2 with signed URL (24h expiry)
  → Sends email: "Your data export is ready [Download →]"

GET /v1/account/exports/:id
  → Returns status + download URL when ready
```

#### Export Format (ZIP containing JSON files)

```
chirri-export-2026-03-24/
├── account.json          (user profile, plan, settings)
├── urls.json             (all monitored URLs with config)
├── changes.json          (all detected changes with diffs)
├── check_history.json    (last 90 days of check results)
├── webhooks.json         (webhook configs, no secrets)
├── notifications.json    (notification log)
└── metadata.json         (export date, format version, plan info)
```

#### API

```
POST /v1/account/export
Response 202:
{
  "export_id": "exp_abc123",
  "status": "processing",
  "estimated_time_seconds": 30,
  "message": "We'll email you when your export is ready."
}

GET /v1/account/exports/exp_abc123
Response 200:
{
  "export_id": "exp_abc123",
  "status": "completed",          // processing | completed | failed
  "download_url": "https://r2.chirri.io/exports/...",  // signed, 24h expiry
  "size_bytes": 1245678,
  "expires_at": "2026-03-25T12:00:00Z",
  "created_at": "2026-03-24T12:00:00Z"
}
```

**Rate limit:** 1 export per 24 hours per account.

### Effort Estimate
**6-8 hours**
- Export job + data queries: 3h
- ZIP creation + R2 upload: 2h
- Email notification: 1h
- API endpoints + polling: 1h
- Tests: 1h

### Priority: **V1.1** (GDPR technically requires it, but for MVP the synchronous version works for small accounts)

---

## D15. Dunning Emails (Payment Failure)

### What's Missing
Stripe retries 3x then downgrade. No Chirri-sent emails during the process.

### Research: Best Practices

**Industry standard (from MRRSaver, Kinde, Baremetrics benchmarks):**
- 4-email sequence over 14 days
- Day 0: Friendly notification
- Day 3: Reminder with urgency
- Day 7: "We'll have to downgrade you"
- Day 12: "Last chance" — final warning before downgrade
- Stop sequence immediately if payment succeeds

**Key principle:** Don't blame the user. Cards expire, banks flag transactions, it's rarely intentional.

### Design: Chirri Dunning Sequence (4 emails)

#### Email 1: Payment Failed (Day 0, on `invoice.payment_failed` webhook)

**Subject:** "Your Chirri payment didn't go through"

```
Hi {name},

Your payment of ${amount} for Chirri {plan} couldn't be processed.
This usually happens when a card expires or your bank flags the charge.

Your monitoring is still active — nothing has changed yet.

[Update payment method →]  (link to Stripe billing portal)

If you have questions, just reply to this email.

— Chirri
```

#### Email 2: Reminder (Day 3)

**Subject:** "Quick reminder: update your payment for Chirri"

```
Hi {name},

Just a reminder — your last payment of ${amount} didn't go through.

Your {plan} plan is still active, but we'll need a valid payment 
method to keep it running.

[Update payment method →]

— Chirri
```

#### Email 3: Warning (Day 7)

**Subject:** "Your Chirri {plan} plan will be downgraded in 7 days"

```
Hi {name},

We still haven't been able to process your payment of ${amount}.

If we can't charge your account by {deadline_date}, your plan 
will be automatically downgraded to Free:
• URL limit drops from {plan_limit} to 3
• Check interval changes to every 24 hours
• {excess_urls} URLs will be paused

[Update payment method →]

We don't want this to happen — your monitoring setup is valuable.

— Chirri
```

#### Email 4: Final Warning (Day 12)

**Subject:** "⚠️ Last chance: your Chirri plan downgrades in 2 days"

```
Hi {name},

This is the final reminder. Your payment of ${amount} has failed 
and your plan will downgrade to Free on {deadline_date}.

When downgraded:
• {excess_urls} URLs will be paused
• Check intervals reset to 24h
• API access will be disabled
• Webhook and Slack notifications will stop

All your data and configurations will be preserved — you can 
re-upgrade anytime to restore everything.

[Update payment method →]

— Chirri
```

#### Implementation

**Trigger:** Stripe webhook `invoice.payment_failed`

```typescript
// On invoice.payment_failed:
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const user = await findUserByStripeCustomer(invoice.customer);
  if (!user) return;
  
  // Check attempt number
  const attemptCount = invoice.attempt_count;  // Stripe tracks this
  
  if (attemptCount === 1) {
    await sendDunningEmail(user, 'payment_failed_1');
    await scheduleDunningEmail(user, 'payment_failed_2', { delayDays: 3 });
    await scheduleDunningEmail(user, 'payment_failed_3', { delayDays: 7 });
    await scheduleDunningEmail(user, 'payment_failed_4', { delayDays: 12 });
    await scheduleDowngrade(user, { delayDays: 14 });
  }
}

// On invoice.paid (cancel dunning):
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const user = await findUserByStripeCustomer(invoice.customer);
  if (!user) return;
  
  await cancelPendingDunningEmails(user);
  await cancelPendingDowngrade(user);
}
```

**Downgrade logic:** After 14 days without payment:
1. Set plan to 'free'
2. Pause excess URLs (most recently created first — per D3 rules)
3. Send confirmation email: "Your plan has been downgraded"

### Effort Estimate
**4-6 hours**
- Email templates (4 emails): 2h
- Stripe webhook integration: 1h
- Scheduling + cancellation logic: 1h
- Downgrade execution: 1h
- Tests: 1h

### Priority: **MVP** (shipping with billing = must handle payment failures)

---

## D16. Dark Mode Decision

### What's Missing
Brand spec contradicts: "White + sakura pink" vs "Dark mode default" with Night `#0F0F0F`.

### Research

**Developer tool defaults in 2026:**
- GitHub: system preference (light by default, auto-detects)
- Vercel: dark default
- Linear: dark default
- Sentry: light default, dark option
- Tailwind: system preference

**The trend:** System preference detection with a toggle. Developers tend toward dark.

### Design Decision

**Default: System preference. Fallback: Dark mode.**

```typescript
const THEME_CONFIG = {
  default: 'system',                    // respect prefers-color-scheme
  fallback: 'dark',                     // if no preference, use dark
  colors: {
    dark: {
      background: '#0F0F0F',            // Night
      surface: '#1A1A1A',
      text: '#FAFAFA',
      textSecondary: '#888888',
      accent: '#FFB7C5',               // Sakura pink
      accentHover: '#FF9DB3',
    },
    light: {
      background: '#FAFAFA',            // Snow
      surface: '#FFFFFF',
      text: '#1A1A1A',                  // Ink
      textSecondary: '#666666',
      accent: '#FFB7C5',               // Sakura pink (same)
      accentHover: '#FF8DA3',
    }
  },
  toggle: true,                         // show toggle in settings
  persistKey: 'chirri-theme',           // localStorage key
};
```

**Landing page:** Matches dashboard theme (dark default, with system detect).

**Implementation:** Use Tailwind's `dark:` variant with `class` strategy. Toggle adds/removes `dark` class on `<html>`.

### Effort Estimate
**1-2 hours** (if using shadcn/ui, dark mode is built-in; just configure tokens)

### Priority: **MVP** (affects entire dashboard build)

---

## D17. Timezone Handling in Dashboard

### What's Missing
All timestamps are UTC in the API. No spec for dashboard timezone display.

### Design

**Strategy:** 
1. All API responses remain UTC (ISO 8601)
2. Dashboard converts to user's browser timezone by default
3. Settings allows override (UTC, specific timezone)
4. Use relative time as primary ("2 hours ago"), absolute on hover

#### Implementation

```typescript
// Display logic
function formatTimestamp(iso: string, userPreference: 'local' | 'utc' | string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  
  // Less than 24h: relative
  if (diffMs < 86400000) {
    return formatRelative(date, now);  // "2 hours ago", "just now"
  }
  
  // More than 24h: absolute in user's timezone
  const tz = userPreference === 'local' 
    ? Intl.DateTimeFormat().resolvedOptions().timeZone 
    : userPreference === 'utc' ? 'UTC' : userPreference;
    
  return date.toLocaleString('en-US', { 
    timeZone: tz,
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short'
  });
}

// Hover tooltip always shows: "Mar 24, 2026 03:26:00 UTC"
function formatTooltip(iso: string): string {
  return new Date(iso).toUTCString();
}
```

#### User Setting

Add to user preferences:
```sql
-- Already exists in users.timezone column
-- Default: 'UTC', set to Intl.DateTimeFormat().resolvedOptions().timeZone on first dashboard visit
```

Dashboard Settings → "Timezone: [Detected: America/New_York ▼] [Always show UTC ☐]"

### Effort Estimate
**3-4 hours**
- TimeAgo component: 1h
- Timezone preference setting: 1h
- Apply across all dashboard pages: 1h
- Tests: 1h

### Priority: **MVP**

---

## D18. Error Budget / Partial Failure Modes

### What's Missing
No discussion of what happens when Redis goes down, worker crashes mid-check, R2 is unreachable, or notifications partially fail.

### Design: Failure Mode Matrix

| Failure | User Impact | Recovery | Priority |
|---------|-------------|----------|----------|
| **Redis down (BullMQ)** | No new checks scheduled. Existing in-flight checks may complete. | Scheduler retries Redis connection every 5s. Missed checks caught on recovery. | Critical |
| **Redis down (rate limiting)** | API rate limits not enforced. Domain throttling not enforced. | Fail-open for API (allow requests). Fail-closed for outbound (skip check, re-enqueue). | High |
| **PostgreSQL down** | Entire system unusable — API returns 503, workers can't read baselines. | Auto-reconnect with exponential backoff. Health check fails → Railway restarts service. | Critical |
| **R2 unreachable** | Checks continue but snapshots not stored. Hash comparison still works. | Circuit breaker opens after 3 failures. Queue snapshots for retry. Store body in Postgres for small responses (<10KB). | Medium |
| **Worker crash mid-check** | That specific check is lost. BullMQ marks job as failed, retries. | BullMQ retry with backoff. Stale lock timeout (30s). At most 1 check is lost. | Medium |
| **Worker crash mid-notification** | User may not receive notification. Change is still recorded. | BullMQ retry. Notification has idempotency key (change_id + channel). Duplicate delivery is OK (users prefer duplicates over missed alerts). | Medium |
| **Email service (Resend) down** | Email notifications delayed. | Retry with backoff (BullMQ). Queue depth alert at >100 pending. Switch to backup if >1h outage. | Medium |
| **Stripe webhook missed** | User's plan change not reflected. | Stripe retries webhooks for up to 72h. On API request, verify subscription status with Stripe API as fallback. | Low |
| **Scheduler crash** | No new checks scheduled until restart. | Railway auto-restart. Missed-check recovery on startup. Single-scheduler lock prevents duplicates. | High |
| **Signal dedup fails** | Possible duplicate notifications. | Idempotency: check `notifications` table for (change_id, user_id, channel) before sending. Duplicates are annoying but safe. | Low |

#### Circuit Breaker Configuration

```typescript
const CIRCUIT_BREAKERS = {
  r2: {
    timeout: 5000,        // 5s per request
    errorThreshold: 50,   // % failures to open circuit
    resetTimeout: 30000,  // try again after 30s
    rollingWindow: 10,    // over last 10 requests
  },
  resend: {
    timeout: 10000,
    errorThreshold: 50,
    resetTimeout: 60000,
    rollingWindow: 20,
  },
  stripe: {
    timeout: 15000,
    errorThreshold: 30,
    resetTimeout: 120000,
    rollingWindow: 5,
  }
};
```

#### Monitoring Alerts

```typescript
const ALERT_THRESHOLDS = {
  redis_reconnect_failures: 3,         // alert if Redis can't reconnect after 3 attempts
  queue_depth_warning: 500,            // notification queue backing up
  queue_depth_critical: 2000,          // something is very wrong
  check_backlog_minutes: 30,           // checks are falling behind
  error_rate_percent: 5,              // >5% of checks failing
  worker_heartbeat_missing: 120,       // no heartbeat from worker in 2 min
};
```

### Effort Estimate
**6-8 hours**
- Circuit breaker setup (opossum): 2h
- Graceful degradation for each failure mode: 3h
- Monitoring alerts + thresholds: 1h
- Tests (simulate failures): 2h

### Priority: **MVP** (must handle failures from Day 1)

---

## D19. Notification Pipeline — Unified Contract

### What's Missing
Three documents define notification flows independently. No single TypeScript interface for notification jobs.

### Design: Unified Notification Contract

```typescript
// ============================================================
// UNIFIED NOTIFICATION CONTRACT
// Single interface for ALL notification types across ALL systems
// ============================================================

/**
 * Every notification in Chirri flows through this interface.
 * Produced by: check workers, early warning pipeline, system events
 * Consumed by: notification worker (BullMQ queue: 'notifications')
 */
interface NotificationPayload {
  // === Identity ===
  id: string;                              // Unique notification ID (generated by producer)
  idempotency_key: string;                 // Dedup key: `${event_type}:${change_id}:${user_id}:${channel}`
  
  // === Event ===
  event_type: NotificationEventType;
  severity: 'critical' | 'breaking' | 'warning' | 'info';
  
  // === Target ===
  user_id: string;
  channel: NotificationChannel;
  recipient: string;                       // email address, webhook URL, integration ID, etc.
  
  // === Content ===
  subject: string;                         // email subject or notification title
  summary: string;                         // one-line plain text summary
  body: NotificationBody;                  // channel-specific formatted content
  
  // === Context ===
  url_id?: string;                         // if related to a specific monitored URL
  change_id?: string;                      // if triggered by a change detection
  forecast_id?: string;                    // if triggered by an early warning
  provider_slug?: string;                  // if related to a provider
  
  // === Delivery Config ===
  webhook_id?: string;                     // for webhook channel: which webhook
  integration_id?: string;                 // for Slack/Discord: which integration
  feedback_token?: string;                 // HMAC token for one-click feedback
  
  // === Metadata ===
  created_at: string;                      // ISO 8601
  attempt: number;                         // retry attempt (1 = first try)
  priority: number;                        // BullMQ priority (1=highest)
}

type NotificationEventType =
  // Change events
  | 'change.detected'
  | 'change.confirmed'
  // URL events
  | 'url.error'
  | 'url.recovered'
  | 'url.baseline_ready'
  | 'url.redirect_detected'
  // Early warning events
  | 'forecast.new'
  | 'forecast.deadline'
  | 'forecast.deadline_imminent'           // <7 days out
  // Account events
  | 'account.usage_alert'
  | 'account.payment_failed'
  | 'account.downgraded'
  // System events
  | 'weekly_report'
  | 'onboarding';

type NotificationChannel = 
  | 'email' 
  | 'webhook' 
  | 'slack' 
  | 'discord' 
  | 'telegram' 
  | 'teams' 
  | 'pagerduty' 
  | 'opsgenie';

interface NotificationBody {
  // Plain text version (used for all channels as fallback)
  text: string;
  
  // HTML version (email)
  html?: string;
  
  // Structured data (for webhook, Slack, Discord formatting)
  data?: Record<string, any>;
  
  // Action URLs
  dashboard_url?: string;                  // link to relevant dashboard page
  feedback_url?: string;                   // one-click feedback URL
  billing_url?: string;                    // Stripe billing portal (for payment emails)
}
```

#### Event → Priority Mapping

```typescript
const EVENT_PRIORITY: Record<NotificationEventType, number> = {
  'change.confirmed': 1,                  // highest priority
  'change.detected': 2,
  'url.error': 2,
  'forecast.deadline_imminent': 2,
  'url.recovered': 3,
  'forecast.new': 3,
  'forecast.deadline': 3,
  'url.baseline_ready': 4,
  'url.redirect_detected': 3,
  'account.usage_alert': 4,
  'account.payment_failed': 1,
  'account.downgraded': 2,
  'weekly_report': 5,                     // lowest priority
  'onboarding': 5,
};
```

### Effort Estimate
**4-6 hours**
- Define TypeScript interfaces: 1h
- Refactor existing notification code to use contract: 2h
- Channel-specific formatters (email, Slack, Discord, webhook): 2h
- Tests: 1h

### Priority: **MVP** (architectural decision needed before building notification pipeline)

---

## D20. Team Features — Pricing Page Handling

### What's Missing
Pro (3 seats) and Business (10 seats) mention team features that are completely undesigned. Team features are V2, but pricing page mentions seat counts now.

### Design Decision

**For MVP:**
- Remove seat counts from pricing page
- Show Pro and Business tiers as "Coming Soon" or simply don't show them (MVP is Free + Indie only per Definitive Plan)
- **Architecture note:** Use `user_id` as tenant key everywhere. When teams ship, add a `team_id` layer. Don't use multi-tenancy patterns prematurely.

**Pricing page copy (MVP):**

```
Free          Indie ($9/mo)         Pro              Business
$0/mo         $9/mo                 Coming Soon      Coming Soon
3 URLs        20 URLs               ───────────      ───────────
Daily checks  Hourly checks         Need more?       Enterprise needs?
Email alerts  All channels          Join waitlist →   Contact us →
```

**Future-proofing:** Ensure all database queries include `user_id` in WHERE clauses. When teams are added, these become `team_id` or `user_id IN (SELECT user_id FROM team_members WHERE team_id = ?)`.

### Effort Estimate
**2-3 hours**
- Pricing page design (hide Pro/Business or show "Coming Soon"): 1h
- Waitlist form for Pro/Business interest: 1h
- Verify all queries use user_id: 1h

### Priority: **MVP** (pricing page ships at launch)

---

## D21. 5-Layer Defense Fails for Shared Sources

### What's Missing
Layer 2 (cross-user correlation) provides zero value for shared sources because ALL users see the same signal from ONE fetch.

### Design: Replacement for Layer 2 on Shared Sources

#### Problem
If the single shared fetch returns bad data, ALL subscribers get the same false positive. Cross-user correlation can't help because every user got the same data.

#### Solution: Multi-Signal Correlation

Replace cross-user correlation with cross-source correlation for shared sources:

```typescript
interface SharedSourceValidation {
  // Instead of "did multiple users see this?", ask:
  // "do multiple SOURCES for this provider confirm this?"
  
  strategies: [
    // Strategy 1: Cross-source consistency
    // If changelog says "v1 deprecated" but OpenAPI spec hasn't changed → lower confidence
    // If both changelog AND OpenAPI spec show removal → high confidence
    {
      name: 'cross_source_consistency',
      logic: 'If change detected on source A, check if source B for same provider also changed',
      confidenceBoost: 15,  // if consistent
      confidencePenalty: -10, // if inconsistent
    },
    
    // Strategy 2: Historical pattern matching
    // Has this provider's source changed before? Does it match known patterns?
    {
      name: 'historical_pattern',
      logic: 'Compare detected change pattern against provider history',
      // e.g., Stripe changelog always changes on Tuesdays → higher confidence for Tuesday changes
    },
    
    // Strategy 3: Delayed re-fetch
    // For shared sources, re-fetch from a different IP/exit after 30 minutes
    // If still different → confirmed. If reverted → CDN edge difference.
    {
      name: 'delayed_refetch',
      logic: 'Re-fetch shared source after 30 min delay',
      // This is basically Stage 2 confirmation but specifically designed for shared sources
    },
    
    // Strategy 4: Content stability check
    // If response changes on every check (high entropy), it's not a real signal
    {
      name: 'content_stability',
      logic: 'Track response variance over rolling window. Flag unstable sources.',
      // Sources with >20% variance in content hash over 24h are marked "noisy"
    },
  ]
}
```

#### Implementation

```typescript
async function validateSharedSourceChange(
  sharedUrlId: string,
  changeId: string,
  providerSlug: string | null
): Promise<{ validated: boolean; adjustedConfidence: number }> {
  
  let confidenceAdjustment = 0;
  
  // Strategy 1: Cross-source check (if provider known)
  if (providerSlug) {
    const otherSources = await db.query(`
      SELECT ms.source_type, su.url_hash,
             (SELECT change_detected FROM check_results 
              WHERE shared_url_id = ms.shared_url_id 
              ORDER BY checked_at DESC LIMIT 1) as recent_change
      FROM monitored_sources ms
      JOIN shared_urls su ON ms.shared_url_id = su.id
      WHERE ms.provider_slug = $1 AND ms.shared_url_id != $2
    `, [providerSlug, sharedUrlId]);
    
    const corroboratingChanges = otherSources.filter(s => s.recent_change);
    if (corroboratingChanges.length > 0) {
      confidenceAdjustment += 15; // corroborated
    } else if (otherSources.length > 0) {
      confidenceAdjustment -= 10; // only this source changed
    }
  }
  
  // Strategy 4: Content stability
  const recentChecks = await db.query(`
    SELECT full_hash FROM check_results
    WHERE shared_url_id = $1 AND checked_at > NOW() - INTERVAL '24 hours'
    ORDER BY checked_at DESC
  `, [sharedUrlId]);
  
  const uniqueHashes = new Set(recentChecks.rows.map(r => r.full_hash));
  const stabilityRatio = 1 - (uniqueHashes.size / recentChecks.rows.length);
  if (stabilityRatio < 0.5) {
    confidenceAdjustment -= 20; // noisy source
  }
  
  return {
    validated: confidenceAdjustment >= 0,
    adjustedConfidence: confidenceAdjustment,
  };
}
```

### Effort Estimate
**8-12 hours**
- Cross-source correlation logic: 4h
- Historical pattern tracking: 3h
- Content stability scoring: 2h
- Integration with change detection pipeline: 2h
- Tests: 1h

### Priority: **V1.1** (shared source model ships fully in V1.1)

---

## D22. Path-Grouped Fan-Out Indexes

### What's Missing
Amendment 5 proposes path-grouped fan-out but no database indexes for `parsed_path` or `parsed_version`.

### Design

#### Required Indexes

```sql
-- For path-grouped fan-out queries
-- "Find all users monitoring /v1/* on stripe.com"
ALTER TABLE urls ADD COLUMN parsed_domain TEXT;
ALTER TABLE urls ADD COLUMN parsed_path TEXT;
ALTER TABLE urls ADD COLUMN parsed_version TEXT;

-- Populate from URL on insert/update
-- parsed_domain: new URL(url).hostname
-- parsed_path: new URL(url).pathname 
-- parsed_version: extract /v\d+/ from path

CREATE INDEX idx_urls_domain_path ON urls (parsed_domain, parsed_path);
CREATE INDEX idx_urls_domain_version ON urls (parsed_domain, parsed_version);

-- For fan-out: "all active URLs on this domain"
CREATE INDEX idx_urls_domain_active ON urls (parsed_domain) 
  WHERE status IN ('active', 'calibrating');
```

#### Populate Logic

```typescript
function parseUrlComponents(url: string) {
  const parsed = new URL(url);
  const versionMatch = parsed.pathname.match(/\/(v\d+)/);
  return {
    parsed_domain: parsed.hostname,
    parsed_path: parsed.pathname,
    parsed_version: versionMatch ? versionMatch[1] : null,
  };
}
```

### Effort Estimate
**2-3 hours**
- Migration + column population: 1h
- Index creation + query optimization: 1h
- Tests: 30m

### Priority: **MVP** (needed for efficient fan-out)

---

## D23. Crafted Changelog False Chirp Attack

### What's Missing
Attacker controlling a monitored changelog can inject text triggering false chirps for ALL subscribers.

### Design: Mitigation Strategy

#### Defense Layers

1. **Source reputation scoring:** New/unverified sources start with lower confidence cap (max 60). Established sources (30+ days, consistent behavior) can reach 100.

2. **Sudden keyword density detection:** If a changelog suddenly contains 5x the normal density of deprecation keywords, flag for review.

3. **First-time high-severity delay:** First time a source triggers a `critical` or `breaking` signal, delay notification by 1 hour. During delay:
   - Check if other sources for the same provider corroborate
   - Check if the source's content has historically contained similar patterns

4. **Admin review queue (V1.1+):** Flag first-time high-severity signals from sources with <30 days of history for manual review before notification dispatch.

```typescript
interface SourceReputation {
  source_id: string;
  first_seen: Date;
  total_checks: number;
  total_changes: number;
  false_positive_count: number;
  reputation_score: number;        // 0-100
  max_confidence_cap: number;      // limits outbound confidence
}

function calculateReputationCap(reputation: SourceReputation): number {
  const ageDays = (Date.now() - reputation.first_seen.getTime()) / 86400000;
  
  if (ageDays < 7) return 50;      // brand new: low cap
  if (ageDays < 30) return 70;     // establishing: medium cap
  if (reputation.false_positive_count / reputation.total_changes > 0.2) return 60;  // noisy source
  return 100;                       // established, clean history
}
```

### Effort Estimate
**8-12 hours**
- Source reputation tracking: 3h
- Keyword density anomaly detection: 2h
- First-time delay logic: 2h
- Integration with notification pipeline: 2h
- Tests: 1h

### Priority: **V1.1** (changelog monitoring ships in MVP, but attack requires scale to be impactful)

---

## D24. extractAddedContent() Fragility

### What's Missing
Paragraph-level dedup uses exact string matching. CMS template changes make EVERY paragraph "new."

### Design: Fuzzy Paragraph Matching

#### Replace Exact Match with Normalized Similarity

```typescript
import { diffWords } from 'diff';

function extractAddedContent(oldText: string, newText: string): string[] {
  const oldParagraphs = splitIntoParagraphs(oldText);
  const newParagraphs = splitIntoParagraphs(newText);
  
  // Build a set of normalized old paragraphs for fuzzy matching
  const oldNormalized = new Map<string, string>();  // normalized → original
  for (const p of oldParagraphs) {
    oldNormalized.set(normalizeParagraph(p), p);
  }
  
  const addedContent: string[] = [];
  
  for (const newPara of newParagraphs) {
    const newNorm = normalizeParagraph(newPara);
    
    // Exact match (after normalization)
    if (oldNormalized.has(newNorm)) continue;
    
    // Fuzzy match: find best match from old paragraphs
    let bestSimilarity = 0;
    for (const [oldNorm] of oldNormalized) {
      const similarity = computeSimilarity(oldNorm, newNorm);
      bestSimilarity = Math.max(bestSimilarity, similarity);
    }
    
    // If best match is >80% similar, it's a reformatted paragraph, not new content
    if (bestSimilarity > 0.8) continue;
    
    // Truly new content
    addedContent.push(newPara);
  }
  
  return addedContent;
}

function normalizeParagraph(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')              // collapse whitespace
    .replace(/[^\w\s]/g, '')            // remove punctuation
    .trim();
}

function computeSimilarity(a: string, b: string): number {
  // Jaccard similarity on word-level trigrams
  const trigramsA = wordTrigrams(a);
  const trigramsB = wordTrigrams(b);
  
  const intersection = trigramsA.filter(t => trigramsB.includes(t));
  const union = new Set([...trigramsA, ...trigramsB]);
  
  return intersection.length / union.size;
}

function wordTrigrams(text: string): string[] {
  const words = text.split(/\s+/);
  const trigrams: string[] = [];
  for (let i = 0; i <= words.length - 3; i++) {
    trigrams.push(words.slice(i, i + 3).join(' '));
  }
  return trigrams;
}

function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 20);
}
```

#### Key Improvements Over Exact Match

1. **Whitespace normalization:** CMS changes often alter whitespace
2. **Case normalization:** Heading case changes don't trigger false "new" detection
3. **Punctuation removal:** Minor formatting changes ignored
4. **Jaccard similarity with word trigrams:** Catches reformatted paragraphs where word order is preserved but formatting changed
5. **Threshold (0.8):** Tunable — start at 0.8, adjust based on false positive data

### Effort Estimate
**6-8 hours**
- Normalization functions: 1h
- Fuzzy matching algorithm: 2h
- Integration with changelog scanner: 2h
- Tests with real changelog data (before/after CMS changes): 2h
- Tuning threshold: 1h

### Priority: **MVP** (changelog scanning is MVP; fragile matching undermines it)

---

## D25. Source Preference null Inheritance Ambiguity

### What's Missing
Can't distinguish "user explicitly set to null (inherit)" from "user never touched this field."

### Design Decision

**Accept the ambiguity.** The behavior is functionally identical:
- null = inherit from parent → same result regardless of whether user explicitly set it or never touched it
- If user wants to stop inheriting, they set a non-null value
- If user wants to re-inherit, they set it back to null

**No separate `overridden_fields` tracking needed for MVP.**

**If needed later:** Add `overridden_fields TEXT[]` column to `source_alert_preferences`:
```sql
ALTER TABLE source_alert_preferences ADD COLUMN overridden_fields TEXT[] DEFAULT '{}';
-- When user explicitly sets a field: add field name to array
-- When user clears a field: remove from array
```

### Effort Estimate
**2-3 hours**
- Document the decision: 30m
- Add `overridden_fields` column (optional, for V1.1): 1h
- Update preference read logic: 1h

### Priority: **MVP** (decision is "do nothing" — just document it)

---

## D26. Forecast Deduplication Logic

### What's Missing
If changelog says "v1 deprecated" AND Sunset header appears AND OpenAPI spec marks endpoints deprecated — that's 3 signals for the same event. `dedup_key` exists but dedup LOGIC isn't specified.

### Design: Dedup Rules

#### Dedup Key Construction

```typescript
function buildForecastDedupKey(signal: EarlyWarningSignal): string {
  // Core identity: provider + direction + target
  const parts = [
    signal.provider_slug || signal.domain,    // who
    signal.direction,                          // deprecation | breaking_change | sunset | migration
    signal.target_path || 'general',           // what endpoint/version
  ];
  
  return parts.join(':').toLowerCase();
}

// Examples:
// "stripe:deprecation:/v1/charges"
// "openai:sunset:general"
// "github:breaking_change:/v3/repos"
```

#### Dedup Logic

```typescript
async function processNewSignal(signal: EarlyWarningSignal): Promise<void> {
  const dedupKey = buildForecastDedupKey(signal);
  
  // Check for existing forecast with same dedup key
  const existing = await db.query(`
    SELECT id, confidence, signal_types, signal_count
    FROM forecasts
    WHERE dedup_key = $1 AND status IN ('active', 'confirmed')
    ORDER BY created_at DESC LIMIT 1
  `, [dedupKey]);
  
  if (existing.rows.length > 0) {
    const forecast = existing.rows[0];
    
    // MERGE: multiple signals strengthen existing forecast
    const newSignalTypes = [...new Set([...forecast.signal_types, signal.signal_type])];
    const confidenceBoost = SIGNAL_TYPE_WEIGHTS[signal.signal_type] || 5;
    
    await db.query(`
      UPDATE forecasts SET
        confidence = LEAST(confidence + $1, 100),
        signal_types = $2,
        signal_count = signal_count + 1,
        last_signal_at = NOW(),
        -- Update deadline if new signal has a more specific date
        deadline = CASE 
          WHEN $3 IS NOT NULL AND ($3 < deadline OR deadline IS NULL) THEN $3
          ELSE deadline
        END,
        updated_at = NOW()
      WHERE id = $4
    `, [confidenceBoost, newSignalTypes, signal.deadline, forecast.id]);
    
    // Don't create new notification — just update existing forecast
    // But DO notify if confidence crossed a threshold (e.g., went from 50 → 80)
    if (forecast.confidence < 80 && forecast.confidence + confidenceBoost >= 80) {
      await enqueueNotification({ type: 'forecast.confidence_upgraded', forecast_id: forecast.id });
    }
    
  } else {
    // NEW forecast — create and notify
    await db.query(`
      INSERT INTO forecasts (dedup_key, provider_slug, direction, target_path, 
                             confidence, deadline, signal_types, signal_count, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'active')
    `, [dedupKey, signal.provider_slug, signal.direction, signal.target_path,
        signal.confidence, signal.deadline, [signal.signal_type]]);
    
    await enqueueNotification({ type: 'forecast.new', ... });
  }
}

const SIGNAL_TYPE_WEIGHTS: Record<string, number> = {
  'sunset_header': 20,        // very strong signal (RFC standard)
  'deprecation_header': 15,   // strong signal
  'changelog_keyword': 10,    // moderate signal
  'openapi_deprecated': 15,   // strong structural signal
  'version_header_change': 8, // moderate signal
  'github_release': 8,        // moderate signal
  'sdk_major_version': 12,    // strong signal
  'migration_guide_appeared': 18, // very strong signal
};
```

#### Example

```
Signal 1: Sunset header detected on api.stripe.com/v1/charges (confidence: 70)
  → Create forecast: "stripe:sunset:/v1/charges", confidence 70
  → Notify users

Signal 2: Changelog says "v1/charges will be removed December 2026" (confidence: 60)
  → dedup_key matches existing forecast
  → Boost confidence: 70 + 10 = 80 (crossed threshold!)
  → Update signal_types: ['sunset_header', 'changelog_keyword']
  → Update deadline: 2026-12-31 (more specific)
  → Notify: "Confidence upgraded: Stripe /v1/charges deprecation now confirmed by 2 sources"

Signal 3: OpenAPI spec marks /v1/charges as deprecated
  → dedup_key matches existing forecast
  → Boost confidence: 80 + 15 = 95
  → Update signal_types: ['sunset_header', 'changelog_keyword', 'openapi_deprecated']
  → Don't notify (already above threshold, no new deadline info)
```

### Effort Estimate
**6-8 hours**
- Dedup key construction: 1h
- Merge vs create logic: 2h
- Confidence boosting + threshold notifications: 2h
- Tests with multi-signal scenarios: 2h
- Integration with early warning pipeline: 1h

### Priority: **V1.1** (early warning is MVP but forecast dedup is refinement)

---

## D27. Redirect Handling Email Notification

### What's Missing
URL entering `redirect_detected` status blocks monitoring. No email notification — only webhook event. During onboarding, user may not have webhooks.

### Design

#### Email Template

**Subject:** "🔀 Redirect detected on {url_name}"  
**Trigger:** URL status transitions to `redirect_detected`

```
Hi {name},

Chirri detected that {url_name} ({url}) is redirecting to a different URL:

Original: {original_url}
Redirects to: {redirect_target}

Monitoring is paused until you decide what to do:

[Follow the redirect] → Monitor the new URL instead
[Keep monitoring original] → Continue checking the original URL (it will keep returning redirects)
[Pause monitoring] → Stop checking this URL

[Go to dashboard →]

This often happens when an API version changes (e.g., /v1 → /v2) 
or when a provider migrates to a new domain.

— Chirri
```

#### API Addition

```
POST /v1/urls/:id/resolve-redirect
Request:
{
  "action": "follow" | "keep_original" | "pause"
}

Response 200:
{
  "url_id": "url_...",
  "status": "active",  // or "paused"
  "url": "https://new-url..."  // if followed
}
```

#### Dashboard UI

On the URL detail page, when status is `redirect_detected`:

```
┌─ ⚠️ Redirect Detected ──────────────────────────────┐
│                                                        │
│  This URL is redirecting to:                           │
│  https://api.stripe.com/v2/prices                     │
│                                                        │
│  [Follow redirect]  [Keep original]  [Pause]          │
└────────────────────────────────────────────────────────┘
```

### Effort Estimate
**2-3 hours**
- Email template: 30m
- Trigger on status change: 30m
- Resolve redirect endpoint: 1h
- Dashboard UI banner: 1h

### Priority: **MVP**

---

## D28. Response Size Anomaly Detection

### What's Missing
Definitive Plan adds "Response size tracking with anomaly alerts (>50% deviation)" as MVP. No `baseline_size_bytes` field, no detection logic.

### Design

#### Database Addition

```sql
ALTER TABLE baselines ADD COLUMN baseline_size_bytes INT;
ALTER TABLE baselines ADD COLUMN size_variance_pct FLOAT DEFAULT 0;
-- size_variance_pct: rolling average of (actual - baseline) / baseline
```

#### Detection Logic

```typescript
interface SizeAnomalyCheck {
  currentSize: number;
  baselineSize: number;
  threshold: number;          // 0.5 = 50% deviation
}

function checkSizeAnomaly(check: SizeAnomalyCheck): SizeAnomalyResult | null {
  if (!check.baselineSize || check.baselineSize === 0) return null;
  
  const deviation = Math.abs(check.currentSize - check.baselineSize) / check.baselineSize;
  
  if (deviation > check.threshold) {
    const direction = check.currentSize > check.baselineSize ? 'larger' : 'smaller';
    const pctChange = Math.round(deviation * 100);
    
    return {
      detected: true,
      severity: deviation > 2.0 ? 'warning' : 'info',  // >200% = warning, 50-200% = info
      summary: `Response size ${direction} by ${pctChange}% (${formatBytes(check.baselineSize)} → ${formatBytes(check.currentSize)})`,
      deviation,
    };
  }
  
  return null;
}
```

#### Integration with Check Pipeline

In Step 7 (Baseline Comparison), after hash comparison:

```typescript
// After normal change detection...
const sizeAnomaly = checkSizeAnomaly({
  currentSize: response.bodySize,
  baselineSize: baseline.baseline_size_bytes,
  threshold: 0.5,
});

if (sizeAnomaly) {
  // Create a change of type 'content' with severity from anomaly
  // This is SEPARATE from structural diff — it's a complementary signal
  await createChange({
    shared_url_id: sharedUrlId,
    change_type: 'content',
    severity: sizeAnomaly.severity,
    summary: sizeAnomaly.summary,
    // No diff data — just the size change
    diff: { size: { before: baseline.baseline_size_bytes, after: response.bodySize } },
  });
}

// Update baseline size (rolling average)
await db.query(`
  UPDATE baselines SET
    baseline_size_bytes = $1,
    size_variance_pct = (size_variance_pct * 0.9) + (ABS($1 - baseline_size_bytes)::float / NULLIF(baseline_size_bytes, 0) * 0.1)
  WHERE shared_url_id = $2
`, [response.bodySize, sharedUrlId]);
```

#### Dashboard Display

On URL detail page, add a "Response Size" metric card:
```
┌───────────────┐
│ 14.5 KB       │
│ Response Size  │
│ ↑ 2% from     │
│ baseline       │
└───────────────┘
```

And in the TTFB chart area, optionally overlay response size as a secondary axis.

### Effort Estimate
**3-4 hours**
- Baseline size tracking + migration: 1h
- Anomaly detection logic: 1h
- Integration with check pipeline: 1h
- Dashboard display: 30m
- Tests: 30m

### Priority: **MVP** (Definitive Plan lists it as MVP "free data" addition)

---

## Summary & Prioritization

### MVP Items (must ship at launch) — ~84-120h

| Item | Effort | Blocks |
|------|--------|--------|
| D1. Dashboard Spec | 16-24h | Week 4 build |
| D2. Check History Endpoint | 4-6h | User trust |
| D3. Pause/Resume | 3-4h | URL management |
| D4. HTML Diff | 8-12h | 20% of monitors |
| D6. Onboarding Emails | 6-8h | Activation/churn |
| D7. Weekly Report | 4-6h | "Nothing happened" churn |
| D8. Notification Rate Limits | 2-3h | Notification pipeline |
| D10. monitored_sources Table | 4-6h | Provider intelligence |
| D12. Mega-Provider Definitions | 4-6h | Provider profiles |
| D13. GDPR Deletion | 8-12h | Legal requirement |
| D15. Dunning Emails | 4-6h | Billing (must handle failures) |
| D16. Dark Mode | 1-2h | Dashboard build |
| D17. Timezone Handling | 3-4h | Dashboard build |
| D18. Partial Failure Modes | 6-8h | Production reliability |
| D19. Notification Contract | 4-6h | Architecture |
| D20. Team Pricing Page | 2-3h | Pricing page |
| D22. Fan-Out Indexes | 2-3h | Performance |
| D24. extractAddedContent Fix | 6-8h | Changelog scanning accuracy |
| D25. Source Preference null | 2-3h | Documentation |
| D27. Redirect Email | 2-3h | Onboarding UX |
| D28. Size Anomaly | 3-4h | MVP feature |

### V1.1 Items (Weeks 9-12) — ~64-90h

| Item | Effort |
|------|--------|
| D5. Bulk Operations | 6-8h |
| D9. Smart Chirp Relevance | 8-12h |
| D11. Discovery Service | 12-16h |
| D14. Async Data Export | 6-8h |
| D21. Shared Source Defense | 8-12h |
| D23. Changelog Attack Mitigation | 8-12h |
| D26. Forecast Deduplication | 6-8h |

### Combined Effort

| Category | Effort Range |
|----------|-------------|
| MVP D-items | 84-120h (~11-15 working days) |
| V1.1 D-items | 64-90h (~8-11 working days) |
| **Total** | **148-210h (~19-26 working days)** |

This aligns with the Contradiction List's estimate of "5-10 days" for D items — though that was optimistic. The true number is closer to **11-15 working days** for MVP items alone, because several items (D1, D4, D13, D18) are more substantial than initially estimated.

---

*Compiled: 2026-03-24*  
*Research sources: changedetection.io, Checkly, BetterStack, UptimeRobot, Sentry, Stripe, GDPR Art. 17, Courier.com alert research, MRRSaver dunning benchmarks, Alertmanager documentation, jsdiff/cheerio/diff2html libraries*
