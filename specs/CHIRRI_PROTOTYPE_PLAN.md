# Chirri Prototype Plan

> **Purpose:** Validate three critical systems before writing product code.
> **Timeline:** 2-3 weeks for all three prototypes.
> **Author:** Generated 2026-03-24 from research + design session.

---

## Table of Contents

1. [System 1: Diff Engine Prototype](#system-1-diff-engine-prototype)
2. [System 2: Discovery Service Prototype](#system-2-discovery-service-prototype)
3. [System 3: LLM Summarization Prototype](#system-3-llm-summarization-prototype)
4. [Test Corpus: 100 API URLs](#test-corpus-100-api-urls)
5. [Build Order](#build-order)
6. [Success Criteria](#success-criteria)

---

## System 1: Diff Engine Prototype

### Goal

Reliably detect **meaningful** changes on API doc/changelog pages while filtering noise (timestamps, session tokens, ads, CSRF tokens, cache-busters, random element IDs).

### Research Findings

**How changedetection.io works:**
- Fetches pages via HTTP or Playwright (headless Chrome) on a configurable schedule
- Compares text snapshots using line-by-line diff
- Filters: CSS/XPath selectors to target specific regions, "Ignore text" regex patterns, "Trigger text" to only alert on specific keywords, "Only trigger when unique lines appear" (compares against ALL history, not just previous snapshot)
- Supports JavaScript-rendered pages via Playwright driver
- No built-in semantic/AI filtering — relies on manual selector/regex configuration

**Noise filtering techniques from the industry:**
- **PageCrawl (2026):** AI importance scoring (0-100 scale), click-to-ignore specific changes, threshold-based filtering, "Content Only" mode strips headers/footers/nav automatically
- **Readability extraction:** Mozilla's `@mozilla/readability` library (used by Firefox Reader View) scores DOM nodes by text density, strips boilerplate (nav, ads, sidebars), extracts article content. Works via JSDOM in Node.js. Returns: `title`, `content` (HTML), `textContent` (plain text), `excerpt`, `byline`
- **CSS selector targeting:** Most reliable for API docs where the content div is predictable (e.g., `main`, `.content`, `#api-reference`)
- **Visual diff:** Pixel-level screenshot comparison using tools like pixelmatch/resemble.js. High precision but expensive (requires headless browser), slow, and brittle with responsive layouts
- **Structural diff:** Compare DOM tree structure, ignore text nodes. Good for detecting added/removed sections but misses content edits

**Headless browser vs. raw fetch:**

| Factor | `fetch` / HTTP client | Playwright / Puppeteer |
|--------|----------------------|----------------------|
| Speed | ~100-300ms per page | ~2-5s per page |
| Cost | Minimal (CPU/RAM) | Heavy (Chrome instance) |
| JS rendering | ❌ No | ✅ Yes |
| SPA support | ❌ No | ✅ Yes |
| Detection risk | None | Moderate (bot detection) |
| Scale | 1000s concurrent | 10s concurrent |

**Recommendation:** Use a **tiered approach**. Try `fetch` + Readability first. Fall back to Playwright only for pages that require JS rendering (detected by empty/minimal content from fetch).

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  URL Queue   │────▶│  Fetcher      │────▶│  Normalizer   │
│  (100 URLs)  │     │  (fetch/PW)   │     │  (5 strategies)│
└─────────────┘     └──────────────┘     └───────┬───────┘
                                                   │
                                          ┌────────▼────────┐
                                          │   Diff Engine    │
                                          │  (compare w/     │
                                          │   previous snap) │
                                          └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  Change Scorer   │
                                          │  (meaningful?)   │
                                          └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  Results DB      │
                                          │  (SQLite)        │
                                          └─────────────────┘
```

### Five Diff Strategies to Compare

#### Strategy 1: Raw HTML Diff (Baseline)
- **How:** `fetch` → store raw HTML → unified diff against previous
- **Library:** `diff` npm package (Kris Kowal's)
- **Expected:** Very noisy. Every CSRF token, cache-buster, timestamp triggers a diff.
- **Purpose:** Baseline false-positive rate to beat.

#### Strategy 2: Readability-Extracted Text Diff
- **How:** `fetch` → JSDOM → `@mozilla/readability` → extract `textContent` → diff
- **Library:** `@mozilla/readability`, `jsdom`, `diff`
- **Expected:** Strips nav, ads, sidebars. Should dramatically reduce false positives on article-style pages. May struggle with API reference pages that aren't "article" shaped.
- **Preprocessing:** Strip all whitespace normalization (collapse multiple spaces/newlines), remove common noise patterns via regex (copyright years, "Last updated: DATE")

#### Strategy 3: CSS Selector Targeted Diff
- **How:** `fetch` → JSDOM → `querySelector(selector)` → extract `textContent` → diff
- **Config:** Each URL gets a manually-curated CSS selector for its main content area
- **Expected:** Most accurate but requires per-URL configuration. Test with auto-detected selectors too (`main`, `article`, `[role="main"]`, `.content`, `.documentation`, `#content`)
- **Auto-detection heuristic:** Try selectors in priority order, pick the first that has >500 chars of text content

#### Strategy 4: Visual Diff (Screenshot Comparison)
- **How:** Playwright → `page.screenshot({fullPage: true})` → pixelmatch comparison
- **Library:** `playwright`, `pixelmatch`, `pngjs`
- **Expected:** Catches layout/visual changes that text diff misses. Very expensive. False positives from: font loading timing, lazy-loaded images, dark mode toggling.
- **Optimization:** Crop to content area only, use a 5% pixel tolerance threshold

#### Strategy 5: Structural DOM Diff
- **How:** `fetch` → JSDOM → serialize DOM tree (tag names + attributes, ignore text nodes and dynamic attrs) → diff
- **Implementation:** Walk the DOM, output a normalized tree like: `div > section > h2 + p + pre > code`
- **Ignore list:** `id`, `class` with hash suffixes, `data-*` attributes, `style`, `nonce`, `csrf`
- **Expected:** Detects added/removed API endpoints or sections. Misses content-only changes.

### Measurement Plan

Run all 5 strategies against the 100-URL corpus, taking 2 snapshots 48 hours apart.

**Metrics per strategy:**
- **False Positive Rate:** % of URLs flagged as changed that had NO meaningful change (human-verified on a sample of 30)
- **Detection Rate (Recall):** % of actual meaningful changes detected (verify by checking changelogs for known updates during the 48h window)
- **Latency:** p50/p95 time per URL
- **Resource Usage:** CPU/RAM per strategy

**Target:**
- False positive rate < 10%
- Detection rate > 90%
- Latency p95 < 5s per URL

### Implementation Notes

```bash
# Tech stack
npm init -y
npm install @mozilla/readability jsdom diff pixelmatch pngjs playwright better-sqlite3

# Prototype structure
prototype-diff/
├── src/
│   ├── fetcher.ts          # HTTP fetch + Playwright fallback
│   ├── strategies/
│   │   ├── raw-html.ts
│   │   ├── readability.ts
│   │   ├── css-selector.ts
│   │   ├── visual.ts
│   │   └── structural.ts
│   ├── normalizer.ts       # Whitespace, date, token stripping
│   ├── differ.ts           # Unified diff wrapper
│   ├── scorer.ts           # Change significance scoring
│   └── db.ts               # SQLite snapshot storage
├── corpus.json             # 100 URLs with metadata
├── run.ts                  # Main runner
└── analyze.ts              # Results analysis
```

**Key normalizations to apply before diffing (all strategies):**
1. Remove `<script>` and `<style>` tags entirely
2. Strip HTML comments
3. Collapse whitespace (multiple spaces → single, multiple newlines → double)
4. Remove ISO timestamps and common date patterns (`\d{4}-\d{2}-\d{2}`, "Updated X ago", "Last modified")
5. Remove known noise patterns: CSRF tokens (`<input[name*=csrf]>`), nonce attributes, cache-buster query params
6. Normalize URLs (strip query params that look like cache-busters: `?v=`, `?cb=`, `?_=`)

---

## System 2: Discovery Service Prototype

### Goal

Given a domain like `stripe.com`, automatically find their API docs, changelog, and status page URLs.

### Research Findings

**Pronovix Study (211 API companies):**
- 68.6% use subdomains for docs (`docs.domain.com`, `developer.domain.com`)
- 31.4% use paths on main domain (`domain.com/docs`, `domain.com/api`)
- Most common patterns: `domain.com/api` (7.84%), `docs.domain.com/api` (5.88%)

**Common documentation URL patterns:**
- Subdomains: `docs.`, `developer.`, `developers.`, `api.`, `dev.`, `reference.`
- Paths: `/docs`, `/documentation`, `/api`, `/api-docs`, `/developers`, `/developer`, `/reference`, `/api-reference`
- Platform-specific: `*.readme.io`, `*.gitbook.io`, `*.mintlify.dev`, `*.stoplight.io`

**Common changelog URL patterns:**
- `/changelog`, `/changes`, `/whats-new`, `/what-s-new`, `/release-notes`, `/releases`
- `/blog/changelog`, `/blog/engineering`, `/updates`, `/news`
- `/docs/changelog`, `/api/changelog`, `/developers/changelog`
- GitHub: `/releases` on the repo page

**Common status page patterns:**
- `status.domain.com` (Atlassian Statuspage, Instatus, etc.)
- `domain.statuspage.io` (hosted Statuspage)
- `domain.instatus.com`
- `/status`, `/system-status`, `/health`
- `status.io` hosted pages

**OpenAPI/Swagger discovery endpoints:**
- `/swagger.json`, `/openapi.json`, `/openapi.yaml`
- `/api-docs`, `/v2/api-docs`, `/v3/api-docs`
- `/.well-known/openapi` (proposed but not widely adopted)
- `/swagger-ui.html`, `/docs` (FastAPI convention)

**Documentation platform fingerprints:**
- **ReadMe:** `<meta name="generator" content="Readme.io">`, custom `X-Readme-*` headers, `.readme.io` CNAME
- **GitBook:** `<meta name="generator" content="GitBook">`, `.gitbook.io` CNAME, `app.gitbook.com` assets
- **Mintlify:** `mintlify` in asset URLs, `_next` directory structure (Next.js), `.mintlify.dev` CNAME
- **Docusaurus:** `<meta name="generator" content="Docusaurus">`, `/docs/` path convention
- **Redoc/Swagger UI:** Characteristic bundle names, `swagger-ui-bundle.js`, `redoc.standalone.js`

**Programmatic search options:**
- **Google Custom Search JSON API:** 100 free queries/day, $5 per 1000 after. Query: `site:domain.com changelog OR release-notes OR api-docs`. **Being deprecated Jan 2027 — not ideal for long-term.**
- **Brave Search API:** Alternative to Google CSE, more future-proof
- **Bing Web Search API:** 1000 free calls/month
- **Sitemap parsing:** Most sites have `/sitemap.xml` — grep for changelog/docs URLs

### Architecture

```
┌──────────────┐
│  Input:       │
│  domain.com   │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│         Discovery Pipeline               │
│                                          │
│  1. DNS/Subdomain probing                │
│  2. Common path probing                  │
│  3. Sitemap parsing                      │
│  4. robots.txt parsing                   │
│  5. Homepage link extraction             │
│  6. OpenAPI endpoint probing             │
│  7. Platform fingerprinting              │
│  8. Search engine query                  │
│  9. GitHub repo discovery                │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│         Classifier                       │
│  For each discovered URL:                │
│  - Type: docs | changelog | status |     │
│          openapi | blog | unknown        │
│  - Confidence: high | medium | low       │
│  - Method: which discovery method found  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│         Results                          │
│  {                                       │
│    "docs": [...],                        │
│    "changelog": [...],                   │
│    "status": [...],                      │
│    "openapi": [...]                      │
│  }                                       │
└──────────────────────────────────────────┘
```

### Nine Discovery Methods

#### Method 1: DNS/Subdomain Probing
```
Subdomains to check (HEAD request, follow redirects):
  docs.{domain}
  developer.{domain}
  developers.{domain}
  api.{domain}
  dev.{domain}
  reference.{domain}
  status.{domain}
  changelog.{domain}
```
- Check DNS resolution first (faster than HTTP)
- Only HTTP-probe if DNS resolves
- Timeout: 5s per subdomain

#### Method 2: Common Path Probing
```
Paths to check on main domain AND each resolved subdomain:
  /docs, /documentation, /api, /api-docs, /api-reference, /reference
  /developers, /developer, /dev
  /changelog, /changes, /whats-new, /release-notes, /releases, /updates
  /status, /health, /system-status
  /blog, /blog/changelog, /blog/engineering, /blog/updates
  /swagger, /swagger.json, /openapi.json, /openapi.yaml
  /v1/docs, /v2/docs, /v3/docs
```
- HEAD request first, follow redirects, check for 200
- If 200, GET the page and verify it's relevant (not a 404 page with 200 status)
- Parallelize: 10 concurrent requests per domain

#### Method 3: Sitemap Parsing
```
Check: /sitemap.xml, /sitemap_index.xml, /sitemap.txt
Parse XML, extract all URLs
Filter for URLs containing: changelog, release, update, docs, api, status, what-s-new
```
- Handle sitemap indexes (sitemaps of sitemaps)
- Limit to first 10,000 URLs (some sitemaps are massive)

#### Method 4: robots.txt Parsing
```
Check: /robots.txt
Extract Sitemap: directives
Look for Allow/Disallow patterns suggesting docs paths
```

#### Method 5: Homepage Link Extraction
```
GET homepage, parse HTML
Extract all <a> tags
Filter for links containing keywords:
  docs, documentation, api, developer, changelog, release, status, reference
Also check: <nav>, <footer>, <header> sections specifically
```

#### Method 6: OpenAPI/Swagger Endpoint Probing
```
Paths: /swagger.json, /openapi.json, /openapi.yaml, /api-docs,
       /v2/api-docs, /v3/api-docs, /.well-known/openapi,
       /swagger-ui.html, /docs (check for FastAPI)
```
- Parse JSON response to extract `info.description`, `externalDocs.url`
- These often link directly to human-readable docs

#### Method 7: Platform Fingerprinting
```
If homepage or docs page is found:
  Check <meta name="generator"> for: GitBook, Docusaurus, ReadMe
  Check asset URLs for: mintlify, gitbook, readme
  Check CNAME / DNS for: *.readme.io, *.gitbook.io, *.mintlify.dev
  Check response headers for: X-Readme-*, X-Gitbook-*
```
- Knowing the platform tells us the URL structure convention

#### Method 8: Search Engine Query
```
Brave Search API query: "site:{domain} changelog OR release-notes OR api-docs OR documentation"
Parse top 10 results
```
- Rate limit: 1 query per domain (batch)
- Fallback: also try `{company-name} API changelog`
- **Cost:** Brave Search API free tier = 2,000 queries/month. Sufficient for prototype.

#### Method 9: GitHub Repository Discovery
```
Check: github.com/{company-name}
If found: look for /releases page
Also check: GitHub API for repos with "api" or "docs" in name
Parse repo descriptions for links to docs
```
- Many companies publish changelogs as GitHub releases
- Check for `CHANGELOG.md` in the repo root

### Measurement Plan

Run all 9 methods against the 100-URL corpus (extracting the base domain from each).

**Metrics:**
- **Discovery Rate:** For what % of domains can we find at least one docs URL? Changelog? Status page?
- **Accuracy:** Of discovered URLs, what % are actually relevant? (Human-verified sample of 50)
- **Method Effectiveness:** Which methods find the most URLs? Which have the best precision?
- **Redundancy:** How many URLs are found by multiple methods?
- **Speed:** Total time per domain

**Target:**
- Discovery rate for docs: > 85%
- Discovery rate for changelog: > 60%
- Discovery rate for status page: > 50%
- Accuracy: > 80% of discovered URLs are relevant

### Implementation Notes

```bash
# Tech stack
npm install undici cheerio fast-xml-parser dns-promises

# Prototype structure
prototype-discovery/
├── src/
│   ├── methods/
│   │   ├── subdomain-probe.ts
│   │   ├── path-probe.ts
│   │   ├── sitemap.ts
│   │   ├── robots.ts
│   │   ├── homepage-links.ts
│   │   ├── openapi-probe.ts
│   │   ├── platform-fingerprint.ts
│   │   ├── search-engine.ts
│   │   └── github.ts
│   ├── classifier.ts        # Classify discovered URLs by type
│   ├── orchestrator.ts      # Run all methods, deduplicate
│   └── db.ts                # Store results
├── corpus.json              # Same 100 URLs
├── run.ts
└── analyze.ts
```

---

## System 3: LLM Summarization Prototype

### Goal

Can an LLM reliably summarize API changes into actionable developer notifications without hallucinating?

### Research Findings

**Key insights:**
- Structured JSON output (using Claude's/OpenAI's structured output modes) dramatically reduces hallucination
- Providing the raw diff alongside the context helps the model stay grounded
- Few-shot examples improve consistency significantly
- Smaller models (Haiku, GPT-4o-mini) work fine for well-formatted changelogs but struggle with ambiguous diffs
- RAG-style grounding (providing the exact source text and demanding citations) is the best hallucination prevention

**Anti-hallucination strategies:**
1. **Structured output schemas** — force JSON with explicit fields, model can't ramble
2. **Diff-grounded prompts** — "Only report changes that are explicitly visible in the diff below"
3. **Confidence scoring** — ask the model to rate its own confidence per claim
4. **Verification pass** — second LLM call to fact-check the first output against the raw diff
5. **Adversarial testing** — include cosmetic-only changes to ensure model outputs "no action needed"

### Three Prompt Strategies

#### Strategy 1: Basic Summary
```
You are a technical writer. Summarize the following API changelog entry 
for a developer audience. Be concise and factual.

---
{changelog_text}
```
- **Expected output:** Free-form paragraph
- **Pro:** Simple, fast
- **Con:** No structure, variable quality, may hallucinate implications

#### Strategy 2: Structured Analysis
```
You are an API change analyst. Analyze the following diff of an API 
documentation page. Answer these questions:

1. What specifically changed? (list each change)
2. Is any change breaking? (yes/no, with explanation)
3. What should an API consumer do in response?
4. What is the severity? (info/warning/critical)

Rules:
- Only report changes that are EXPLICITLY visible in the diff
- If a change is cosmetic only (formatting, typos), say "cosmetic only"
- If you're not sure if something is breaking, say "potentially breaking - verify"
- Do NOT infer changes that aren't in the diff

---
BEFORE:
{before_text}

AFTER:
{after_text}
```
- **Expected output:** Structured text with clear answers
- **Pro:** Guided output, explicit anti-hallucination instructions
- **Con:** Still free-form text, harder to parse programmatically

#### Strategy 3: Fully Structured JSON Output
```json
{
  "system": "You are an API change detection system. Analyze diffs and produce structured JSON. Rules: 1) Only report changes explicitly visible in the provided diff. 2) Never infer or speculate about changes not shown. 3) For cosmetic-only changes, set severity to 'none' and action_required to 'none'. 4) Rate your confidence for each change from 0.0 to 1.0.",
  
  "user": "Analyze this API documentation diff.\n\nBEFORE:\n{before_text}\n\nAFTER:\n{after_text}\n\nRespond with this JSON schema:\n{\n  \"summary\": \"one-line summary\",\n  \"severity\": \"none|info|warning|breaking\",\n  \"changes\": [\n    {\n      \"what_changed\": \"description\",\n      \"type\": \"addition|removal|modification|deprecation|cosmetic\",\n      \"breaking\": true/false,\n      \"who_affected\": \"which API consumers\",\n      \"action_required\": \"what to do\",\n      \"confidence\": 0.0-1.0\n    }\n  ],\n  \"cosmetic_only\": true/false\n}"
}
```
- **Expected output:** Parseable JSON with per-change confidence scores
- **Pro:** Machine-readable, confidence scoring enables filtering, explicit cosmetic flag
- **Con:** More tokens, higher cost per call

### Test Data: 30 Real Changelog Entries

Collect from these sources (10 each):

**Category A: Clean Structured Changelogs (easy)**
1. Stripe API changelog — `https://stripe.com/docs/changelog`
2. GitHub REST API changelog — `https://github.blog/changelog/`
3. Twilio changelog — `https://www.twilio.com/en-us/changelog`
4. OpenAI API changelog — `https://platform.openai.com/docs/changelog`
5. Cloudflare API changelog — `https://developers.cloudflare.com/changelog/`
6. Vercel changelog — `https://vercel.com/changelog`
7. Supabase changelog — `https://supabase.com/changelog`
8. PlanetScale changelog — (now defunct, use Wayback Machine)
9. Linear changelog — `https://linear.app/changelog`
10. Resend changelog — `https://resend.com/changelog`

**Category B: Diff-Based Changes (medium — requires before/after comparison)**
11-20. Capture actual before/after snapshots of API reference pages from: Stripe API Reference, GitHub API Reference, Twilio API Reference, AWS SDK docs, Cloudflare Workers docs, Vercel SDK docs, Auth0 docs, Plaid docs, SendGrid docs, Algolia docs

**Category C: Adversarial Test Cases (hard)**
21. Cosmetic-only change (typo fix, no functional change)
22. Date-only update ("Last updated: March 2026" → "Last updated: March 2026")
23. Formatting change (markdown restructuring, same content)
24. Ambiguous change (parameter description reworded — is it a behavior change?)
25. Multi-change diff (3 changes in one diff, one breaking, one cosmetic, one addition)
26. Deprecation notice buried in prose
27. Rate limit change hidden in a table
28. New required parameter added (clearly breaking)
29. Default value change (subtly breaking)
30. New optional parameter added (non-breaking but important)

### Model Comparison Matrix

| Model | Cost (per 1M input tokens) | Cost (per 1M output tokens) | Speed | Expected Quality |
|-------|---------------------------|---------------------------|-------|-----------------|
| Claude 3.5 Haiku | $0.80 | $4.00 | Fast | Good for structured changelogs |
| Claude 3.5 Sonnet | $3.00 | $15.00 | Medium | Best for ambiguous diffs |
| GPT-4o-mini | $0.15 | $0.60 | Fast | Good baseline |
| GPT-4o | $2.50 | $10.00 | Medium | Strong alternative |

### Measurement Plan

For each of the 30 test cases × 3 prompt strategies × 3 models = **270 test runs**.

**Metrics:**
- **Accuracy:** Does the output correctly identify all changes? (human-graded, 1-5 scale)
- **Hallucination Rate:** % of outputs that mention changes NOT in the diff
- **Cosmetic Detection Rate:** % of cosmetic-only changes correctly identified as cosmetic
- **Breaking Change Detection:** % of breaking changes correctly flagged
- **Latency:** p50/p95 time per call
- **Cost:** Average cost per changelog analysis
- **JSON Validity:** % of Strategy 3 outputs that are valid JSON (with structured output mode)

**Targets:**
- Hallucination rate < 5%
- Breaking change detection rate > 95%
- Cosmetic detection rate > 90%
- JSON validity > 99% (with structured output mode)
- Cost per analysis < $0.01 (at scale with Haiku/4o-mini)

### Implementation Notes

```bash
# Tech stack
npm install @anthropic-ai/sdk openai zod

# Prototype structure
prototype-llm/
├── src/
│   ├── prompts/
│   │   ├── basic.ts
│   │   ├── structured.ts
│   │   └── json-output.ts
│   ├── models/
│   │   ├── claude.ts
│   │   └── openai.ts
│   ├── evaluator.ts        # Human eval framework
│   └── runner.ts           # Run all combinations
├── test-data/
│   ├── changelogs/          # 30 real changelog entries
│   └── ground-truth/        # Expected outputs for evaluation
├── run.ts
└── analyze.ts
```

---

## Test Corpus: 100 API URLs

### Category 1: Major APIs — Documentation Pages (20)

| # | Company | URL | Type | Format | Update Frequency |
|---|---------|-----|------|--------|-----------------|
| 1 | Stripe | `https://stripe.com/docs/api` | docs | HTML | Weekly |
| 2 | GitHub | `https://docs.github.com/en/rest` | docs | HTML | Weekly |
| 3 | Twilio | `https://www.twilio.com/docs/usage/api` | docs | HTML | Weekly |
| 4 | AWS | `https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html` | docs | HTML | Monthly |
| 5 | Cloudflare | `https://developers.cloudflare.com/api/` | docs | HTML | Weekly |
| 6 | Vercel | `https://vercel.com/docs/rest-api` | docs | HTML | Biweekly |
| 7 | Shopify | `https://shopify.dev/docs/api/admin-rest` | docs | HTML | Monthly |
| 8 | Slack | `https://api.slack.com/methods` | docs | HTML | Monthly |
| 9 | Discord | `https://discord.com/developers/docs/intro` | docs | HTML | Monthly |
| 10 | Google Maps | `https://developers.google.com/maps/documentation` | docs | HTML | Monthly |
| 11 | OpenAI | `https://platform.openai.com/docs/api-reference` | docs | HTML (SPA) | Weekly |
| 12 | Anthropic | `https://docs.anthropic.com/en/api/getting-started` | docs | HTML | Weekly |
| 13 | Datadog | `https://docs.datadoghq.com/api/latest/` | docs | HTML | Biweekly |
| 14 | Salesforce | `https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest.htm` | docs | HTML | Quarterly |
| 15 | Microsoft Graph | `https://learn.microsoft.com/en-us/graph/api/overview` | docs | HTML | Monthly |
| 16 | Docker | `https://docs.docker.com/engine/api/` | docs | HTML | Monthly |
| 17 | Figma | `https://www.figma.com/developers/api` | docs | HTML | Monthly |
| 18 | Notion | `https://developers.notion.com/reference/intro` | docs | HTML | Biweekly |
| 19 | Linear | `https://developers.linear.app/docs` | docs | HTML | Biweekly |
| 20 | Supabase | `https://supabase.com/docs/guides/api` | docs | HTML | Weekly |

### Category 2: Mid-Tier APIs — Documentation Pages (20)

| # | Company | URL | Type | Format | Update Frequency |
|---|---------|-----|------|--------|-----------------|
| 21 | SendGrid | `https://docs.sendgrid.com/api-reference` | docs | HTML | Monthly |
| 22 | Plaid | `https://plaid.com/docs/api/` | docs | HTML | Monthly |
| 23 | Algolia | `https://www.algolia.com/doc/rest-api/search/` | docs | HTML | Monthly |
| 24 | Auth0 | `https://auth0.com/docs/api` | docs | HTML | Monthly |
| 25 | Contentful | `https://www.contentful.com/developers/docs/references/content-delivery-api/` | docs | HTML | Quarterly |
| 26 | Mailchimp | `https://mailchimp.com/developer/marketing/api/` | docs | HTML | Quarterly |
| 27 | Brex | `https://developer.brex.com/openapi/onboarding_api/` | docs | HTML | Monthly |
| 28 | Square | `https://developer.squareup.com/reference/square` | docs | HTML | Monthly |
| 29 | Sentry | `https://docs.sentry.io/api/` | docs | HTML | Monthly |
| 30 | Mixpanel | `https://developer.mixpanel.com/reference/overview` | docs | HTML | Monthly |
| 31 | Lob | `https://docs.lob.com/` | docs | HTML | Quarterly |
| 32 | Postmark | `https://postmarkapp.com/developer/api/overview` | docs | HTML | Quarterly |
| 33 | Airtable | `https://airtable.com/developers/web/api/introduction` | docs | HTML | Monthly |
| 34 | Mapbox | `https://docs.mapbox.com/api/` | docs | HTML | Monthly |
| 35 | CircleCI | `https://circleci.com/docs/api/v2/` | docs | HTML | Monthly |
| 36 | PagerDuty | `https://developer.pagerduty.com/api-reference/` | docs | HTML | Quarterly |
| 37 | Zendesk | `https://developer.zendesk.com/api-reference/` | docs | HTML | Monthly |
| 38 | HubSpot | `https://developers.hubspot.com/docs/api/overview` | docs | HTML | Monthly |
| 39 | Intercom | `https://developers.intercom.com/docs/references/rest-api/api.intercom.io/` | docs | HTML | Monthly |
| 40 | LaunchDarkly | `https://apidocs.launchdarkly.com/` | docs | HTML | Monthly |

### Category 3: Smaller/Niche APIs (20)

| # | Company | URL | Type | Format | Update Frequency |
|---|---------|-----|------|--------|-----------------|
| 41 | Resend | `https://resend.com/docs/api-reference/introduction` | docs | HTML | Biweekly |
| 42 | Upstash | `https://upstash.com/docs/redis/overall/getstarted` | docs | HTML | Monthly |
| 43 | Neon | `https://api-docs.neon.tech/reference/getting-started` | docs | HTML | Biweekly |
| 44 | Knock | `https://docs.knock.app/reference` | docs | HTML | Monthly |
| 45 | Loops | `https://loops.so/docs/api-reference` | docs | HTML | Monthly |
| 46 | Inngest | `https://www.inngest.com/docs/reference/api` | docs | HTML | Biweekly |
| 47 | Trigger.dev | `https://trigger.dev/docs/apiref/introduction` | docs | HTML | Biweekly |
| 48 | Svix | `https://api.svix.com/docs` | docs | HTML | Monthly |
| 49 | Clerk | `https://clerk.com/docs/reference/backend-api` | docs | HTML | Weekly |
| 50 | Axiom | `https://axiom.co/docs/restapi/introduction` | docs | HTML | Monthly |
| 51 | Tinybird | `https://www.tinybird.co/docs/api-reference` | docs | HTML | Monthly |
| 52 | Dub | `https://dub.co/docs/api-reference/introduction` | docs | HTML | Biweekly |
| 53 | Cal.com | `https://cal.com/docs/api-reference/v2/introduction` | docs | HTML | Monthly |
| 54 | Unkey | `https://www.unkey.com/docs/api-reference/overview` | docs | HTML | Monthly |
| 55 | Polar | `https://docs.polar.sh/api/` | docs | HTML | Monthly |
| 56 | WorkOS | `https://workos.com/docs/reference` | docs | HTML | Monthly |
| 57 | Stytch | `https://stytch.com/docs/api` | docs | HTML | Monthly |
| 58 | Pinecone | `https://docs.pinecone.io/reference/api/introduction` | docs | HTML | Biweekly |
| 59 | Weaviate | `https://weaviate.io/developers/weaviate/api/rest` | docs | HTML | Monthly |
| 60 | Qdrant | `https://api.qdrant.tech/api-reference` | docs | HTML | Monthly |

### Category 4: Changelogs / Release Notes Pages (20)

| # | Company | URL | Type | Format | Update Frequency |
|---|---------|-----|------|--------|-----------------|
| 61 | Stripe | `https://stripe.com/docs/changelog` | changelog | HTML | Weekly |
| 62 | GitHub | `https://github.blog/changelog/` | changelog | HTML (blog) | Daily |
| 63 | Twilio | `https://www.twilio.com/en-us/changelog` | changelog | HTML | Weekly |
| 64 | Cloudflare | `https://developers.cloudflare.com/changelog/` | changelog | HTML | Weekly |
| 65 | Vercel | `https://vercel.com/changelog` | changelog | HTML | Weekly |
| 66 | OpenAI | `https://platform.openai.com/docs/changelog` | changelog | HTML | Weekly |
| 67 | Supabase | `https://supabase.com/changelog` | changelog | HTML | Biweekly |
| 68 | Linear | `https://linear.app/changelog` | changelog | HTML | Biweekly |
| 69 | Resend | `https://resend.com/changelog` | changelog | HTML | Biweekly |
| 70 | Clerk | `https://clerk.com/changelog` | changelog | HTML | Weekly |
| 71 | Shopify | `https://shopify.dev/changelog` | changelog | HTML | Weekly |
| 72 | Notion | `https://developers.notion.com/changelog` | changelog | HTML | Monthly |
| 73 | Figma | `https://www.figma.com/release-notes/` | changelog | HTML | Monthly |
| 74 | Docker | `https://docs.docker.com/engine/release-notes/` | changelog | HTML | Monthly |
| 75 | Sentry | `https://github.com/getsentry/sentry/releases` | changelog | GitHub releases | Biweekly |
| 76 | Next.js | `https://github.com/vercel/next.js/releases` | changelog | GitHub releases | Weekly |
| 77 | Prisma | `https://github.com/prisma/prisma/releases` | changelog | GitHub releases | Biweekly |
| 78 | Tailwind CSS | `https://github.com/tailwindlabs/tailwindcss/releases` | changelog | GitHub releases | Monthly |
| 79 | Deno | `https://github.com/denoland/deno/releases` | changelog | GitHub releases | Biweekly |
| 80 | Bun | `https://bun.sh/blog` | changelog | Blog | Monthly |

### Category 5: Status Pages (20)

| # | Company | URL | Type | Format | Update Frequency |
|---|---------|-----|------|--------|-----------------|
| 81 | Stripe | `https://status.stripe.com/` | status | Statuspage | Real-time |
| 82 | GitHub | `https://www.githubstatus.com/` | status | Statuspage | Real-time |
| 83 | Twilio | `https://status.twilio.com/` | status | Statuspage | Real-time |
| 84 | Cloudflare | `https://www.cloudflarestatus.com/` | status | Statuspage | Real-time |
| 85 | Vercel | `https://www.vercel-status.com/` | status | Statuspage | Real-time |
| 86 | AWS | `https://health.aws.amazon.com/health/status` | status | Custom | Real-time |
| 87 | OpenAI | `https://status.openai.com/` | status | Statuspage | Real-time |
| 88 | Slack | `https://status.slack.com/` | status | Custom | Real-time |
| 89 | Discord | `https://discordstatus.com/` | status | Statuspage | Real-time |
| 90 | Datadog | `https://status.datadoghq.com/` | status | Statuspage | Real-time |
| 91 | PagerDuty | `https://status.pagerduty.com/` | status | Statuspage | Real-time |
| 92 | Sentry | `https://status.sentry.io/` | status | Statuspage | Real-time |
| 93 | Auth0 | `https://status.auth0.com/` | status | Statuspage | Real-time |
| 94 | Supabase | `https://status.supabase.com/` | status | Instatus | Real-time |
| 95 | Linear | `https://status.linear.app/` | status | Custom | Real-time |
| 96 | Notion | `https://status.notion.so/` | status | Statuspage | Real-time |
| 97 | Shopify | `https://status.shopify.com/` | status | Custom | Real-time |
| 98 | HubSpot | `https://status.hubspot.com/` | status | Statuspage | Real-time |
| 99 | Zendesk | `https://status.zendesk.com/` | status | Statuspage | Real-time |
| 100 | Intercom | `https://status.intercom.com/` | status | Statuspage | Real-time |

---

## Build Order

### Phase 1: Diff Engine (Week 1) — BUILD FIRST
**Why first:** Everything depends on reliable change detection. If we can't detect meaningful changes with low false positives, the whole product doesn't work.

**Day 1-2:** Set up infrastructure
- Fetch + Playwright fallback fetcher
- SQLite snapshot storage
- Basic runner that snapshots all 100 URLs

**Day 3-4:** Implement all 5 diff strategies
- Start with Strategy 2 (Readability) and Strategy 3 (CSS selector) — most likely winners
- Implement normalizer (strip dates, tokens, whitespace)

**Day 5-7:** Run comparison, measure, iterate
- Take snapshot 1 of all 100 URLs
- Wait 48 hours
- Take snapshot 2
- Run all strategies, compare results
- Human-evaluate a sample of 30 flagged changes

### Phase 2: Discovery Service (Week 2)
**Why second:** We need this to be able to onboard APIs automatically, but we can use the hand-curated URL list from Phase 1 in the meantime.

**Day 8-9:** Implement methods 1-5 (subdomain probe, path probe, sitemap, robots, homepage links)
**Day 10-11:** Implement methods 6-9 (OpenAPI, platform fingerprinting, search, GitHub)
**Day 12-14:** Run against all 100 domains, measure, compare method effectiveness

### Phase 3: LLM Summarization (Week 3)
**Why third:** Depends on having real change data from Phase 1. Also the least technically risky — LLMs are good at summarization, we just need to tune prompts and verify quality.

**Day 15-16:** Collect 30 real changelog entries + create adversarial test cases
**Day 17-18:** Implement 3 prompt strategies × 3 models
**Day 19-21:** Run 270 test combinations, evaluate, analyze cost/quality tradeoff

---

## Success Criteria

### Go Criteria (all must pass)

| System | Metric | Go Threshold | Pivot Threshold |
|--------|--------|-------------|-----------------|
| Diff Engine | False positive rate (best strategy) | < 15% | > 30% = pivot |
| Diff Engine | Detection rate (recall) | > 80% | < 50% = pivot |
| Diff Engine | p95 latency per URL | < 10s | > 30s = pivot |
| Discovery | Docs discovery rate | > 70% | < 40% = pivot |
| Discovery | Changelog discovery rate | > 50% | < 25% = pivot |
| Discovery | URL accuracy | > 70% | < 50% = pivot |
| LLM Summary | Hallucination rate | < 10% | > 25% = pivot |
| LLM Summary | Breaking change detection | > 90% | < 70% = pivot |
| LLM Summary | Cost per analysis | < $0.02 | > $0.10 = pivot |

### Pivot Strategies (if thresholds fail)

**Diff Engine pivots:**
- If false positive rate too high → Invest in AI/LLM-based change scoring (like PageCrawl's approach). Have the LLM classify each diff as meaningful vs. noise.
- If detection rate too low → Add more diff strategies, or switch to visual diff as primary for SPA-heavy sites
- If latency too high → Drop visual diff, optimize to fetch-only with smart caching

**Discovery Service pivots:**
- If discovery rate too low → Lean into search engine integration as primary method (accept the API cost)
- If accuracy too low → Add LLM-based URL classification ("Is this URL an API changelog? Yes/No")
- If too slow → Cache results aggressively, discovery only needs to run once per domain

**LLM Summarization pivots:**
- If hallucination rate too high → Add verification pass (second LLM call to fact-check)
- If cost too high → Fine-tune a smaller model, or use embedding-based classification for severity instead of full LLM
- If breaking change detection too low → Add few-shot examples of breaking changes, or use chain-of-thought prompting

### Overall Go/No-Go

**Ship it:** If at least 2 of 3 systems meet Go thresholds, and the third is above Pivot threshold → proceed to production code

**Iterate:** If 1 system hits Pivot threshold → apply pivot strategy, re-test that system only

**Hard pivot:** If 2+ systems hit Pivot thresholds → reconsider the approach entirely. Possibly:
- Pivot to manual curation + alerting (less automation, more human-in-the-loop)
- Partner with changedetection.io instead of building our own diff engine
- Focus on changelog-only monitoring (skip the harder docs-diff problem)

---

## Appendix: Key Libraries & Tools

| Purpose | Library | Language | Notes |
|---------|---------|----------|-------|
| HTML fetch | `undici` | Node.js | Fast, built into Node 18+ |
| JS rendering | `playwright` | Node.js | Better than Puppeteer for this use case |
| Content extraction | `@mozilla/readability` + `jsdom` | Node.js | Powers Firefox Reader View |
| HTML parsing | `cheerio` | Node.js | jQuery-like, fast for server-side |
| Text diffing | `diff` | Node.js | Kris Kowal's, supports unified diff |
| Visual diff | `pixelmatch` + `pngjs` | Node.js | Lightweight pixel comparison |
| XML parsing | `fast-xml-parser` | Node.js | For sitemaps |
| Database | `better-sqlite3` | Node.js | Synchronous SQLite, perfect for prototypes |
| LLM (Claude) | `@anthropic-ai/sdk` | Node.js | Structured output support |
| LLM (OpenAI) | `openai` | Node.js | Structured output support |
| Schema validation | `zod` | Node.js | For validating LLM JSON output |
| Search | Brave Search API | REST | 2,000 free queries/month |

---

*This plan is designed to be specific enough to start building tomorrow. Each prototype can be built independently by different developers if needed. The 100-URL corpus is shared across all three systems.*
