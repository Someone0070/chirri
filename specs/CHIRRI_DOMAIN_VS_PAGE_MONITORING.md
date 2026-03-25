# Chirri: Domain vs Page Monitoring — Research & Recommendation

## The Problem

When a user enters a URL into Chirri, what do they actually want?

| Input | Likely Intent |
|-------|--------------|
| `stripe.com` | Ambiguous — homepage? provider? everything? |
| `myblog.com` | Probably just that page |
| `competitor.com/pricing` | That specific page |
| `api.stripe.com` | Probably an API endpoint |

---

## 1. How Existing Tools Handle This

### changedetection.io
- **Model: One URL = one watch.** Each watch monitors a single URL.
- No whole-site crawling. Users manually add each URL they want to track.
- API confirms: "Each watch represents a single URL being monitored for changes."
- Users with hundreds of watches manage them individually (people report 300+ watches).
- This is the simplest and most common approach in the space.

### Visualping
- **Model: One URL = one job.** You enter a URL and optionally select a region of the page.
- "You can either choose to monitor the whole website or just an area of a website" — this means whole *page* vs. a CSS-selected area, NOT whole *site*.
- To monitor multiple pages, you add multiple jobs from the dashboard.
- No auto-discovery or sitemap crawling.

### Distill.io
- **Model: One URL = one monitor, BUT has a separate Sitemap Monitor feature.**
- Standard monitors: one URL per watch (full page or selected elements).
- **Sitemap Monitor (Professional plan+):** Crawls a domain to discover all pages, then alerts when URLs are added or removed. Two-step workflow:
  1. Crawl: discovers links starting from a URL
  2. Import: user picks discovered URLs to add to their watchlist
- This is a premium, separate feature — not the default behavior.
- Key detail: the sitemap monitor tracks *URL additions/removals*, not content changes on each page.

### Sken.io
- **Model: One URL = one job.** "Enter the URL address of website, select any part of page, set a checking interval, and get notifications."
- No whole-site feature found.

### ChangeTower
- **Has explicit "Monitor Entire Website" feature.**
- User chooses "monitor an entire website" → enters homepage URL → system auto-crawls and indexes subpages → picks a monitoring level (depth).
- This is a **distinct workflow** from single-page monitoring — users explicitly opt in.

### Versionista
- **Can monitor subpages on a domain** — auto-discovers pages within a site.
- One of the few tools that does whole-site monitoring as a core feature.

### Hexowatch
- **One URL = one watch.** Select a part of the screen or whole page.
- No auto-discovery.

### Summary Table

| Tool | Default Behavior | Whole-Site Option |
|------|-----------------|-------------------|
| changedetection.io | Single page | ❌ No |
| Visualping | Single page | ❌ No |
| Distill.io | Single page | ✅ Separate "Sitemap Monitor" (premium) |
| Sken.io | Single page | ❌ No |
| ChangeTower | Single page | ✅ Explicit "Monitor Entire Website" flow |
| Versionista | Single page | ✅ Subpage discovery |
| Hexowatch | Single page | ❌ No |

**Key finding: The overwhelming industry standard is single-page-per-watch. Whole-site is always a separate, explicit feature when it exists.**

---

## 2. User Intent: What Do People Actually Monitor?

### Real-World Use Cases (from Reddit, forums, product descriptions)

The most commonly reported monitoring use cases:

1. **Price tracking** — specific product pages on e-commerce sites
2. **Restock alerts** — "notify me when this product is back in stock" (e.g., Raspberry Pi, shoes)
3. **Competitor pricing pages** — `competitor.com/pricing`
4. **Job postings** — specific job board pages or company career pages
5. **Government/legal pages** — regulation changes, legislation updates
6. **Product changelogs** — `/changelog` or `/releases` pages
7. **Blog/news** — specific RSS feeds or blog index pages
8. **Registration pages** — "tell me when site X opens registration"
9. **Defacement detection** — monitoring own website for unauthorized changes

### Key Insight: Users Almost Always Mean a Specific Page

From Reddit threads about changedetection.io and similar tools:
- Users describe monitoring in terms of specific URLs: "I monitor this Ubiquiti product page," "I watch competitor's blog"
- Nobody says "I monitor stripe.com" — they say "I monitor Stripe's pricing page" or "I watch the Stripe changelog"
- The mental model is **page-level**, not domain-level
- When users want multiple pages on the same site, they add them individually

### When Users Enter a Bare Domain

When someone enters `stripe.com` (no path), the most likely intents in order:
1. **They mean the homepage** — they want to know when Stripe's homepage content changes
2. **They're being lazy** — they want a specific page (pricing, changelog) but typed the domain
3. **They want "everything"** — rare, and they probably don't know what they mean by this

---

## 3. Sitemap/Crawl Feasibility

### Sitemap Availability

- **~84% of websites** have a robots.txt that returns 200 (Web Almanac 2024)
- Of those, the `Sitemap:` directive is commonly included but exact percentages vary
- CMS-powered sites (WordPress = 35%+ of the web) almost always auto-generate sitemaps
- Estimated **50-70% of websites** have a working sitemap.xml (higher for commercial sites, lower for small/personal)
- Sitemaps can be massive (50,000 URLs per file, sites can have thousands of files)

### Crawling Challenges

- **Scope explosion:** Even a modest site might have thousands of pages. stripe.com probably has 10,000+
- **Most pages are irrelevant:** Legal pages, duplicate content, parameter URLs, etc.
- **Performance cost:** Crawling adds significant server load and latency
- **Rate limiting:** Sites may block or rate-limit crawlers
- **Maintenance burden:** Discovered pages change — the list goes stale

### Verdict: Full-site crawling is scope creep for Chirri's MVP

The value proposition of Chirri is monitoring *things that matter* — not being a generic web crawler. If someone wants to monitor an entire site, tools like changedetection.io + Distill.io already exist.

---

## 4. Design Options Analysis

### Option A: Always Single Page ⭐ (Recommended Default)

`stripe.com` → monitors just the homepage at `https://stripe.com/`

**Pros:**
- Simple, predictable, fast
- Matches industry standard (every tool does this)
- No ambiguity
- Works for 90%+ of use cases

**Cons:**
- Misses intent when user means "track this provider"
- Homepage changes are often noisy (marketing, A/B tests)

### Option B: Smart Expansion

Bare domain → auto-discover and suggest pages

**Pros:** More useful for power users
**Cons:** Complex, slow, unreliable, scope creep. Rejected.

### Option C: Provider Detection First ⭐ (Recommended for Known Providers)

Known provider (`stripe.com`) → treat as API provider, expand to structured monitoring (API changelog, docs, status page).
Unknown domain → treat as single page.

**Pros:**
- Handles the most valuable use case (API provider monitoring) correctly
- Graceful degradation to single-page for unknown domains
- Leverages Chirri's unique value (it knows about API providers)

**Cons:**
- Only works for providers in the database
- Might surprise users who literally want the homepage

### Option D: Ask the User

"What do you want to monitor?" with options.

**Pros:** Removes ambiguity
**Cons:** Adds friction. Users want to paste a URL and go.

### Option E: Monitor + Offer to Expand

Start monitoring the page, then suggest related pages.

**Pros:** Progressive, non-blocking
**Cons:** Complex to implement, discovery is unreliable

---

## 5. Recommendation

### The Chirri Approach: Provider-Aware Smart Defaults

**Decision tree when user enters a URL:**

```
Input: user enters URL
│
├─ Has specific path? (e.g., /pricing, /docs/api, /changelog)
│   └─ YES → Monitor that specific page for content changes
│       (This is always unambiguous)
│
├─ Is bare domain or homepage? (e.g., stripe.com, stripe.com/)
│   ├─ Is it a KNOWN PROVIDER in Chirri's database?
│   │   └─ YES → "Stripe is an API provider we track.
│   │            Want to monitor: [✓ API Changes] [✓ Changelog]
│   │            [□ Status Page] [□ Docs] [□ Homepage]"
│   │            (Pre-select the most useful monitors)
│   │
│   └─ Is it an UNKNOWN domain?
│       └─ YES → Monitor the homepage for content changes
│           Optional: "We also found /changelog, /pricing on this site.
│           Want to add them?" (only if easily discoverable)
│
└─ Is it an API endpoint? (e.g., api.stripe.com/v1/charges)
    └─ Treat as API monitoring (different flow entirely)
```

### Why This Works

1. **Known providers** (the core Chirri use case) get the best experience — structured monitoring of what actually matters (API, changelog, status), not noisy homepage tracking.

2. **Unknown domains** get the safe, predictable default that matches every other tool in the market.

3. **Specific paths** always do exactly what the user expects.

4. **No crawling required** — for known providers, we already know what pages matter. For unknown domains, we just monitor what they gave us.

### UX Flow: Dashboard vs API

**Dashboard (interactive):**
```
[Enter URL: stripe.com                    ] [Add]

→ "We recognize Stripe as an API provider! 🎉
    What would you like to monitor?

    [✓] API Changelog (stripe.com/docs/changelog)
    [✓] Status Page (status.stripe.com)
    [ ] Documentation (stripe.com/docs/api)
    [ ] Pricing Page (stripe.com/pricing)
    [ ] Homepage (stripe.com)

    [Start Monitoring →]"
```

For unknown domain:
```
[Enter URL: myblog.com                    ] [Add]

→ Monitoring myblog.com for content changes.
   Check interval: Every 6 hours
   [Configure →]
```

**API (programmatic):**
```json
// User adds bare domain
POST /monitors
{ "url": "stripe.com" }

// Response: provider detected, suggestions returned
{
  "provider_detected": "stripe",
  "suggested_monitors": [
    { "type": "changelog", "url": "stripe.com/docs/changelog", "recommended": true },
    { "type": "status", "url": "status.stripe.com", "recommended": true },
    { "type": "page", "url": "stripe.com/docs/api" },
    { "type": "page", "url": "stripe.com/pricing" },
    { "type": "page", "url": "stripe.com" }
  ],
  "auto_created": false  // Requires user confirmation
}

// For unknown domains, just create the monitor directly
POST /monitors
{ "url": "myblog.com" }

// Response: monitor created
{
  "monitor_id": "...",
  "url": "https://myblog.com",
  "type": "page",
  "status": "active"
}
```

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| `stripe.com` (known provider) | Provider detection → suggest structured monitors |
| `stripe.com/pricing` (known provider, specific path) | Single page monitor (user was specific) |
| `myblog.com` (unknown domain) | Single page monitor of homepage |
| `myblog.com/about` (unknown, specific path) | Single page monitor |
| `status.stripe.com` (known subdomain) | Status page monitor (if recognized) |
| `github.com/user/repo` (known provider, specific path) | Could detect as repo → monitor releases, but OK to start as single page |

### What NOT to Build (for now)

1. **Full-site crawling** — Out of scope. Other tools do this.
2. **Sitemap-based discovery** — Adds complexity for uncertain value.
3. **Auto-expansion for unknown domains** — Unreliable; better to let users add pages manually.
4. **Visual/screenshot monitoring** — Different product category (Visualping territory).

### Phase 2 Ideas (future)

- "Discover more pages" button that checks sitemap.xml and common paths
- RSS/Atom feed auto-detection for blogs
- Common page heuristics (`/changelog`, `/pricing`, `/blog`, `/status`) as suggested additions

---

## Summary

| Design Decision | Choice | Rationale |
|----------------|--------|-----------|
| Default for bare domain | Single page (homepage) | Industry standard, simple, predictable |
| Known API provider | Provider-aware expansion | Core Chirri differentiator |
| Specific path | Always single page | User stated intent explicitly |
| Full-site crawling | No | Scope creep, other tools exist |
| Sitemap discovery | No (for MVP) | Complex, unreliable, uncertain value |
| Ask user? | Only for known providers | Reduce friction for unknown domains |

**The key insight: Chirri's unique value isn't being another changedetection.io. It's being smart about API providers. Lean into that for known providers, and fall back to simple page monitoring for everything else.**
