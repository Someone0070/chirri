# CHIRRI — Source Tracking Model

**Date:** March 24, 2026  
**Purpose:** Define exactly how monitored sources map to URL slots, check intervals, pricing, and infrastructure costs.

---

## 1. Research Findings: How Often Do Sources Actually Change?

### Real-World Change Frequency by Source Type

| Source Type | Change Frequency (Real Data) | Evidence |
|------------|------------------------------|----------|
| **OpenAPI Spec** | 1-4x/week for active APIs | Stripe's `stripe/openapi` repo: releases on Mar 23 and Mar 17 (weekly cadence). OpenAI's spec: weekly+ updates. Most enterprise APIs: monthly. |
| **Changelog/RSS** | 2-10x/week | Stripe: "monthly updates" officially but individual changelog entries 2-5x/week. OpenAI: 3-10x/week (one of the most active). GitHub blog/changelog: 5-15x/week. Shopify: 3-10x/week. |
| **Status Page** | Changes during incidents only | Typical provider: 2-8 incidents/month. Between incidents: ZERO changes to `summary.json`. Most days, nothing changes at all. |
| **GitHub Releases (SDKs)** | Weekly for active SDKs | stripe-node: weekly releases. openai-python: weekly. Slower SDKs (Ruby, Go): biweekly to monthly. |
| **npm/PyPI Versions** | Same as GitHub releases | Mirrors release cadence exactly. stripe npm: ~weekly. openai PyPI: ~weekly. |
| **Documentation Pages** | Monthly (with noise) | API docs pages change infrequently for content. Layout/CSS changes are noise. Meaningful doc changes: monthly or less. |
| **Blog Posts** | Weekly (low signal for API changes) | Most posts are marketing, not API changes. 1-2 API-relevant posts per month. |

### Key Insight: 95% of Source Types Don't Need 5-Minute Checks

A changelog that updates 3x/week doesn't need checking every 5 minutes (that's 2,016 wasted checks per week). An OpenAPI spec that changes weekly doesn't need 288 daily checks. Status pages are the exception — during incidents they update rapidly, but between incidents they're static.

**The only source that genuinely benefits from sub-hourly checks is the status page** (and even then, only during active incidents).

---

## 2. Recommended Model: Option C+D Hybrid ("Smart Sources")

### The Model in One Sentence

**A provider = 1 "provider slot" that includes a primary source (counts toward URL quota) plus bundled intelligence sources (checked at smart intervals, don't count toward quota).**

### How It Works

When a user says "Monitor Stripe," Chirri creates:

| Source | Counts as URL? | Check Interval | Controlled By |
|--------|---------------|----------------|---------------|
| **OpenAPI Spec** | ✅ YES (1 URL slot) | User's plan interval (1h/5min/etc.) | User's plan |
| **Changelog/RSS** | ❌ No (bundled) | Every 2 hours (fixed) | System |
| **Status Page JSON** | ❌ No (bundled) | Every 10 minutes (fixed) | System |
| **Primary SDK Release** | ❌ No (bundled) | Every 6 hours (fixed) | System |

**Total URL slots used: 1**  
**Total sources monitored: 4**

### Why This Model Wins

1. **User-friendly:** "Monitor Stripe" = 1 URL slot. Intuitive. No quota shock.
2. **Cost-efficient:** Bundled sources use smart intervals that match actual change frequency. We're not wasting checks.
3. **Differentiated:** Nobody else bundles provider intelligence into a single monitor. This IS the product.
4. **Honest pricing:** The URL quota applies to what the user explicitly adds. Bundled intelligence is the value-add that justifies the subscription.
5. **Scalable:** We control bundled source intervals, so we can optimize infrastructure costs.

### User-Added Custom URLs

Users can also paste raw URLs (the current core feature). These work as before:
- Each URL = 1 URL slot
- Checked at the user's plan interval
- Full JSON structural diffing, TTFB, uptime tracking

### Optional Source Expansion

Users can optionally add MORE sources from the provider profile, each consuming 1 additional URL slot:

| Additional Source | URL Slots | Check Interval |
|------------------|-----------|----------------|
| Additional SDK releases (Python, Ruby, Go, Java) | 1 each | User's plan interval |
| npm/PyPI version tracking | 1 each | User's plan interval |
| Additional docs pages | 1 each | User's plan interval |

**But the 4 bundled sources are always free with the provider slot.** This is the hook.

---

## 3. Source Type Definitions & Intervals

### Bundled Sources (Free with Provider Slot)

These are "provider intelligence" — they come free with every provider monitor and use fixed system intervals regardless of the user's plan.

| Source Type | System Interval | Rationale | Infra Cost per Check |
|------------|----------------|-----------|---------------------|
| **Changelog/RSS** | Every 2 hours | Changelogs update 2-10x/week. 2h catches changes within half a business day. | ~$0.000002 (tiny HTML/RSS fetch + parse) |
| **Status Page JSON** | Every 10 minutes | Status pages are critical during incidents. 10min is fast enough for awareness (not pager-level). | ~$0.000001 (tiny JSON, ~2KB response) |
| **Primary SDK Release** | Every 6 hours | SDKs release weekly at most. 6h catches same-day. | ~$0.000001 (Atom feed, ~5KB) |

**Why these specific intervals:**
- **2h for changelogs:** A new changelog entry at 9am gets detected by 11am. Acceptable for "awareness" monitoring. Checking every 5 min adds zero value (12x more checks, same detection day).
- **10min for status pages:** A major outage at 2:00pm is detected by 2:10pm. Fast enough to be useful without being a pager replacement (that's what PagerDuty/OpsGenie are for).
- **6h for SDK releases:** A release at 10am is detected by 4pm. SDK releases don't require instant action — you'll update on your next sprint.

### Primary Sources (Count Toward URL Quota)

These use the user's plan check interval.

| Source Type | Plan Interval | Rationale |
|------------|--------------|-----------|
| **OpenAPI Spec** | User's plan interval | This is the PRIMARY value — structural API changes. The reason users pay. |
| **Custom URL (API endpoint)** | User's plan interval | User's own monitored endpoints. Core product. |

### Extended Sources (Optional, 1 Slot Each)

Users can opt-in to these, each consuming 1 URL slot.

| Source Type | Default Interval | Rationale |
|------------|-----------------|-----------|
| **Additional SDK repos** | 6 hours (fixed) | Low change frequency doesn't justify faster checks |
| **npm/PyPI packages** | 6 hours (fixed) | Same as SDK repos — version bumps are infrequent |
| **Documentation pages** | 4 hours (fixed) | Docs change infrequently, high noise potential |

**Important:** Even when these use a URL slot, their check interval is FIXED (not tied to the user's plan interval). This is because checking npm every 5 minutes is wasteful — it adds cost with zero benefit. Users get a URL slot to track it, but Chirri is smart about when to check.

---

## 4. Pricing Interaction

### How Slots Work Per Plan

| Plan | URL Slots | Min Check Interval | Bundled Sources per Provider | Max Providers (theoretical) |
|------|-----------|-------------------|-----------------------------|-----------------------------|
| **Free** ($0) | 3 URLs | 24 hours | 3 bundled (no status page on free) | 3 providers |
| **Indie** ($9/mo) | 20 URLs | 1 hour | 4 bundled (full set) | 20 providers |
| **Pro** ($29/mo) | 100 URLs | 5 minutes | 4 bundled (full set) | 100 providers |
| **Business** ($79/mo) | 500 URLs | 1 minute | 4 bundled + 2 extra | 500 providers |

### The "Monitor Stripe on Pro" Example

User on Pro plan ($29/mo, 100 URL slots, 5-min checks):

**Step 1:** User clicks "Monitor Stripe"

**Step 2:** Chirri shows:
```
🟣 Stripe — Provider Monitor

PRIMARY (uses 1 URL slot):
  ✅ OpenAPI Spec — checked every 5 min (your plan interval)

INCLUDED FREE:
  ✅ Changelog — checked every 2 hours
  ✅ Status Page — checked every 10 minutes  
  ✅ stripe-node SDK — checked every 6 hours

OPTIONAL (1 URL slot each):
  ☐ stripe-python SDK releases
  ☐ stripe-ruby SDK releases
  ☐ stripe-go SDK releases
  ☐ stripe-java SDK releases
  ☐ npm: stripe package versions
  ☐ PyPI: stripe package versions
  ☐ API documentation pages

URL slots used: 1 of 100
```

**Step 3:** User adds Stripe → 1 URL slot consumed, 4 sources monitored.

**Step 4:** User also checks "stripe-python SDK" and "npm: stripe" → 3 URL slots total, 6 sources monitored.

### What About "Monitor 12 Providers"?

| Scenario | URL Slots Used | Sources Monitored |
|----------|---------------|-------------------|
| 12 providers, defaults only | 12 | 48 (12 × 4 bundled) |
| 12 providers + 2 extras each | 36 | 72 |
| 12 providers, all sources | ~84 | ~84 |

On Pro (100 slots): 12 providers with defaults = 12 slots used, 88 remaining for custom URLs. **This feels right.**

### Free Plan Limitation

Free plan gets 3 bundled sources instead of 4 (no status page monitoring — that's a high-frequency check we don't want to give away). This nudges free→Indie conversion.

| Free Plan Provider Bundle | Interval |
|--------------------------|----------|
| OpenAPI Spec (primary) | 24 hours |
| Changelog/RSS | Every 4 hours |
| Primary SDK Release | Every 12 hours |

---

## 5. Dashboard UX

### Provider View (Collapsed)

```
┌──────────────────────────────────────────────────────┐
│ 🟣 Stripe                              [1 URL slot]  │
│ ├── OpenAPI Spec        ✅ No changes      5m ago    │
│ ├── Changelog           🟡 2 new entries   1h ago    │
│ ├── Status Page         ✅ All operational  3m ago    │
│ └── stripe-node SDK     ✅ v15.2.0         4h ago    │
│                                                       │
│ 🟢 OpenAI                               [1 URL slot]  │
│ ├── OpenAPI Spec        🔴 Breaking change  12m ago  │
│ ├── Changelog           🟡 5 new entries   45m ago   │
│ ├── Status Page         🟡 Degraded perf   2m ago    │
│ └── openai-python SDK   ✅ v1.52.0         6h ago    │
└──────────────────────────────────────────────────────┘
```

### Provider View (Expanded)

Clicking a provider expands to show:
- **Primary source:** Full diff view (the money screen) with side-by-side comparison
- **Bundled sources:** Summary cards with latest changes
- **Optional sources:** "Add more sources" section showing unmonitored sources
- **Provider health timeline:** Combined view of all source changes on a timeline

### Change Feed (Global)

The global change feed shows ALL changes across ALL sources, tagged by source type:

```
🔴 [Breaking] OpenAI — OpenAPI Spec — Field `model` type changed (12 min ago)
🟡 [Info] Stripe — Changelog — "New Payment Links API v2" (1h ago)  
🟡 [Warning] OpenAI — Status Page — "Elevated error rates on GPT-4" (2 min ago)
🟢 [Info] Stripe — stripe-node — v15.2.0 released (4h ago)
```

### Source Type Icons

| Source Type | Icon | Color |
|------------|------|-------|
| OpenAPI Spec | 📋 | Blue |
| Changelog | 📝 | Purple |
| Status Page | 🚦 | Green/Yellow/Red |
| SDK Release | 📦 | Orange |
| npm/PyPI | 📦 | Orange |
| Documentation | 📖 | Gray |

---

## 6. API Design

### Data Model

```typescript
// A "provider monitor" is the top-level entity
interface ProviderMonitor {
  id: string;                        // uuid
  userId: string;
  providerId: string;                // "stripe", "openai"
  providerName: string;              // "Stripe"
  createdAt: Date;
  
  // The primary source (counts as 1 URL slot)
  primarySource: MonitoredSource;
  
  // Bundled sources (free, system-controlled intervals)
  bundledSources: MonitoredSource[];
  
  // Optional extended sources (each = 1 URL slot)
  extendedSources: MonitoredSource[];
}

interface MonitoredSource {
  id: string;                        // uuid
  providerMonitorId: string;
  type: SourceType;
  url: string;
  checkInterval: number;             // seconds
  intervalType: 'plan' | 'fixed';   // plan = user's plan interval, fixed = system
  status: 'learning' | 'active' | 'paused' | 'error';
  lastCheckedAt: Date | null;
  lastChangeAt: Date | null;
  countsAsUrlSlot: boolean;
  
  // Source-type-specific config
  config: SourceConfig;
}

type SourceType = 
  | 'openapi_spec'
  | 'changelog_html'
  | 'changelog_rss'
  | 'status_page_json'
  | 'github_releases'
  | 'npm_package'
  | 'pypi_package'
  | 'documentation'
  | 'custom_url';                    // User-pasted URL (not part of a provider)

interface SourceConfig {
  // For openapi_spec
  format?: 'json' | 'yaml';
  
  // For changelog_html
  entrySelector?: string;           // CSS selector for entries
  
  // For status_page_json
  statusPageType?: 'statuspage_io' | 'custom';
  
  // For github_releases
  repo?: string;                    // "stripe/stripe-node"
  includePreReleases?: boolean;
  
  // For npm_package / pypi_package
  packageName?: string;
  
  // For documentation
  pageUrls?: string[];
}
```

### API Endpoints

```
# Provider monitors
POST   /api/v1/providers                    # Create provider monitor
GET    /api/v1/providers                    # List provider monitors
GET    /api/v1/providers/:id                # Get provider monitor + all sources
DELETE /api/v1/providers/:id                # Delete provider monitor + all sources

# Sources within a provider
POST   /api/v1/providers/:id/sources        # Add extended source (uses URL slot)
DELETE /api/v1/providers/:id/sources/:sid    # Remove extended source (frees URL slot)
POST   /api/v1/providers/:id/sources/:sid/check  # "Check Now" for specific source

# Changes (across all sources)
GET    /api/v1/providers/:id/changes        # Changes for a provider (all sources)
GET    /api/v1/changes                       # Global change feed (all providers + custom URLs)
GET    /api/v1/changes/:changeId            # Change detail (diff view data)

# Custom URL monitors (not part of a provider)
POST   /api/v1/urls                         # Add custom URL monitor
GET    /api/v1/urls                         # List custom URL monitors
# ... existing URL CRUD ...

# Provider catalog
GET    /api/v1/catalog/providers            # List available provider profiles
GET    /api/v1/catalog/providers/:name      # Get provider profile (sources, URLs)
GET    /api/v1/catalog/search?q=stripe      # Search providers
```

### URL Slot Accounting

```typescript
function getUsedSlots(userId: string): number {
  const providerPrimary = count(providerMonitors.where({ userId }));
  const providerExtended = count(monitoredSources.where({ 
    userId, 
    countsAsUrlSlot: true, 
    type: not('custom_url'),
    intervalType: not('fixed')  // bundled sources don't count
  }));
  const customUrls = count(customUrlMonitors.where({ userId }));
  
  return providerPrimary + providerExtended + customUrls;
}
```

---

## 7. Cost Analysis

### Per-Source Infrastructure Cost

Assuming Railway workers + PostgreSQL + Redis on the current spec:

| Source Type | Response Size | Parse Cost | Storage/Check | Checks/Day | Cost/Day per Source |
|------------|--------------|------------|---------------|------------|-------------------|
| **OpenAPI Spec** (1h) | 100KB-5MB | Medium (JSON parse + diff) | ~500B metadata + R2 snapshot | 24 | ~$0.0005 |
| **OpenAPI Spec** (5min) | 100KB-5MB | Medium | ~500B + R2 | 288 | ~$0.006 |
| **Changelog HTML** (2h) | 50-200KB | Low (entry extraction) | ~200B metadata | 12 | ~$0.0001 |
| **Changelog RSS** (2h) | 5-50KB | Very low (XML parse) | ~200B metadata | 12 | ~$0.00005 |
| **Status Page JSON** (10min) | 1-5KB | Very low (JSON diff) | ~100B metadata | 144 | ~$0.0003 |
| **GitHub Releases Atom** (6h) | 5-20KB | Very low (XML parse) | ~100B metadata | 4 | ~$0.00002 |
| **npm Registry** (6h) | 2-50KB | Very low (version compare) | ~50B metadata | 4 | ~$0.00002 |
| **Custom URL** (5min) | Variable | Medium (full diff engine) | ~500B + R2 | 288 | ~$0.006 |

### Cost Per Provider Monitor (Bundled)

One provider with 4 bundled sources costs per day:

| Source | Checks/Day | Cost/Day |
|--------|-----------|----------|
| Primary (OpenAPI at 1h) | 24 | $0.0005 |
| Changelog (2h) | 12 | $0.0001 |
| Status page (10min) | 144 | $0.0003 |
| SDK release (6h) | 4 | $0.00002 |
| **Total** | **184** | **~$0.001/day** |

**Monthly cost per bundled provider: ~$0.03**

At scale (1,000 users × 5 providers each = 5,000 provider monitors):
- **5,000 × $0.03 = $150/month in bundled source checking costs**
- This is negligible compared to worker compute costs (~$42/mo base)

### Cost Comparison: Bundled vs Per-Slot

| Model | User monitors 10 providers | Daily checks | Monthly cost |
|-------|---------------------------|-------------|-------------|
| **Option A** (each source = 1 slot, 5min) | 80 sources × 288/day = 23,040 | $4.80/mo | Expensive, wasteful |
| **Bundled model** (smart intervals) | 10 primary + 30 bundled = 2,200/day | $0.30/mo | 16x cheaper |

**The bundled model is 16x more cost-efficient** because it checks low-frequency sources at appropriate intervals instead of hammering everything every 5 minutes.

### Break-Even Analysis

| Plan | Revenue/User | Provider monitors (avg) | Bundled cost | Custom URL cost | Total cost | Margin |
|------|-------------|------------------------|-------------|----------------|-----------|--------|
| Free | $0 | 2 | $0.06/mo | $0.05/mo (3 URLs × 24h) | $0.11/mo | -$0.11 |
| Indie ($9) | $9/mo | 5 | $0.15/mo | $0.90/mo (15 URLs × 1h) | $1.05/mo | $7.95 (88%) |
| Pro ($29) | $29/mo | 15 | $0.45/mo | $15.30/mo (85 URLs × 5min) | $15.75/mo | $13.25 (46%) |
| Business ($79) | $79/mo | 30 | $0.90/mo | $84.60/mo (470 URLs × 1min) | $85.50/mo | -$6.50 ⚠️ |

**Note:** Business tier at scale with heavy usage is tight on margins. This is normal for monitoring SaaS — the 80/20 rule applies (most Business users won't max out their 500 URLs at 1-min intervals).

---

## 8. How Competitors Handle This

### UptimeRobot
- **Model:** 1 monitor = 1 URL. Period.
- **No bundling, no provider intelligence.**
- Free: 50 monitors, 5-min. Solo ($7-10/mo): 10-50 monitors, 60s. Team ($29-34/mo): 100 monitors, 60s.
- Each URL is independent — no concept of "providers" or "source types."

### Checkly
- **Model:** Check runs, not monitors. Each execution counts.
- Hobby (free): 10 uptime monitors, 10K API checks/mo. Starter ($24/mo): 50 uptime, 25K API checks. Team ($64/mo): 75 uptime, 100K API checks.
- **Key insight:** Checkly charges for CHECK RUNS, not monitors. This means high-frequency monitors cost more implicitly.

### changedetection.io
- **Model:** "Watches" with per-watch configurable frequency.
- $8.99/mo: 5,000 URL watches included.
- Each watch has its own check interval (user-configured).
- No provider intelligence — just raw URL watching.
- **Key insight:** They're generous on watch count (5,000!) but the product is simpler (HTML diff, not structural API monitoring).

### What Chirri Learns from Competitors

1. **UptimeRobot's simplicity works** — 1 monitor = 1 thing is easy to understand.
2. **Checkly's run-based pricing is smart** — it naturally accounts for frequency differences.
3. **changedetection.io's generosity on count** — shows that URL count isn't the bottleneck; it's compute.
4. **Nobody does provider intelligence** — this is genuinely unoccupied territory.

Our hybrid model (1 provider slot + smart bundled sources) combines UptimeRobot's simplicity (1 click = 1 slot) with Checkly's efficiency awareness (different sources checked at appropriate frequencies).

---

## 9. What Users Actually Want

### Developer Mental Model

When a developer says "monitor Stripe," they mean:
> "Tell me if anything changes with Stripe that could affect my integration."

They do NOT mean:
> "Make exactly 1 HTTP request to exactly 1 URL every N minutes."

The provider-centric model aligns with how developers think. They think in terms of **dependencies**, not URLs.

### Potential Confusion Points

| Concern | Mitigation |
|---------|-----------|
| "I added 1 provider but it's doing 4 checks?" | Dashboard clearly shows bundled sources with "included free" badge |
| "Why is my changelog only checked every 2 hours?" | Tooltip: "Changelogs typically update 2-5x/week. Checking every 2 hours catches changes within half a business day." |
| "I want to check everything every 5 minutes" | Show cost comparison: "Checking changelog every 5 min = 288 checks/day for a source that changes 3x/week. Smart intervals save you quota and give the same detection speed." |
| "Why does the status page check cost me nothing?" | "Provider intelligence is included with your plan. It's our way of giving you complete API awareness." |

### User Research Signals

From Reddit/forum searches, developers primarily care about:
1. **Breaking changes** (schema changes, endpoint removals) → OpenAPI spec monitoring
2. **Deprecations** (sunset headers, changelog announcements) → Changelog + header monitoring
3. **Outages** (is the API down right now?) → Status page monitoring
4. **New features** (new endpoints, new models) → Changelog + spec monitoring

SDK releases and npm versions are secondary concerns — nice to know, but not urgent.

---

## 10. Implementation Notes

### Scheduling Architecture

The existing BullMQ queue system handles this naturally:

```
Queue: check-primary     → User plan intervals (1h, 5min, 1min)
Queue: check-changelog   → Fixed 2-hour cycle, bulk-scheduled
Queue: check-status      → Fixed 10-minute cycle, bulk-scheduled  
Queue: check-releases    → Fixed 6-hour cycle, bulk-scheduled
```

Bundled sources can be batch-scheduled efficiently:
- All status page checks at :00, :10, :20, :30, :40, :50 of each hour
- All changelog checks at :00 of even hours
- All release checks at 00:00, 06:00, 12:00, 18:00 UTC

This enables **efficient batching** — we can check all 500 status pages in a single worker sweep rather than spreading them randomly.

### Shared Monitoring for Bundled Sources

Bundled sources are PERFECT for shared monitoring deduplication:
- 100 users all monitoring Stripe's status page → 1 actual HTTP check, fanned out to 100 users
- The deduplication key is the source URL (all users monitor the same changelog URL)
- This means 1,000 users with 5 providers each = ~75 unique bundled source URLs checked (not 15,000)

**At scale, bundled source cost approaches zero** due to deduplication.

### Migration Path

1. **MVP (Week 4):** Provider monitors with hardcoded profiles. Bundled sources use fixed intervals. Primary source uses plan interval.
2. **V1.1:** Extended sources (optional, 1 slot each). APIs.guru integration for dynamic profiles.
3. **V2:** User-contributed provider profiles. Custom bundled source intervals for Business tier.

---

## Summary Decision Matrix

| Question | Answer |
|----------|--------|
| Provider = how many URL slots? | 1 slot (for the primary source) |
| How many bundled sources free? | 3-4 depending on plan |
| Who controls bundled intervals? | System (fixed, optimized intervals) |
| Can users add more sources? | Yes, 1 URL slot each |
| Does plan interval apply to bundled? | No — only to primary source |
| Can users customize bundled intervals? | No (V2 maybe for Business) |
| How does this affect pricing? | No change to existing plan structure |
| What's the infrastructure cost impact? | Negligible (~$0.03/provider/month, approaches $0 with dedup) |

---

*This document defines the source tracking model for Chirri. It should be read alongside `CHIRRI_PROVIDER_MONITORING.md` (source maps per provider) and `CHIRRI_DEFINITIVE_PLAN.md` (feature scope and timeline).*
