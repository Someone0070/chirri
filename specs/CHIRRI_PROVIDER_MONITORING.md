# CHIRRI — Provider Monitoring: What We Actually Track

**Date:** March 24, 2026  
**Purpose:** When a user says "Monitor Stripe," what does Chirri actually do? This document defines every monitorable source per provider and the strategy for each.

---

## The Core Insight

An API provider isn't a single URL — it's an **ecosystem** of monitorable sources. When a user types "Monitor Stripe," Chirri should auto-discover and offer ALL relevant sources, not just one endpoint.

This is the product differentiation. Nobody else does this.

---

## Provider Source Taxonomy

Every API provider has some subset of these monitorable source types:

| Source Type | Description | Monitoring Strategy | Tier |
|------------|-------------|-------------------|------|
| **OpenAPI Spec** | Machine-readable API definition | Fetch raw spec, structural diff (oasdiff-style) | Tier 1 (MVP) |
| **Changelog Page** | Human-readable list of API changes | Fetch HTML/RSS, detect new entries | Tier 1 (MVP) |
| **Status Page** | Statuspage.io or custom status | Fetch JSON API (`/api/v2/summary.json`), track component status | Tier 1 (MVP) |
| **Documentation** | API reference docs | Fetch key pages, detect structural changes | Tier 1 (MVP) |
| **RSS/Atom Feed** | Machine-readable changelog | Standard RSS parsing, detect new items | Tier 1 (MVP) |
| **Public API Endpoint** | Actual API response (e.g., `/v1/models`) | JSON structural diff (our core engine) | Tier 1 (MVP) |
| **GitHub Releases** | SDK/spec version releases | GitHub API or Atom feed (`/releases.atom`) | Tier 2 (V1.1) |
| **npm/PyPI Package** | SDK package versions | Registry API (`registry.npmjs.org`, `pypi.org/pypi/PKG/json`) | Tier 2 (V1.1) |
| **GitHub Repo** | Source code changes (spec files, CHANGELOG.md) | GitHub API for commits on specific files | Tier 2 (V1.1) |
| **Blog** | Provider engineering/product blog | RSS or HTML scraping, filter API-related posts | Tier 3 (V2) |
| **Social Media** | Twitter/X status accounts | Unreliable — see analysis below | Tier 3 (V2) |

---

## Per-Provider Source Map

### 🟣 Stripe

| Source | URL | Public? | Strategy | Change Frequency |
|--------|-----|---------|----------|-----------------|
| **OpenAPI Spec (JSON)** | `https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json` | ✅ Yes | Structural diff of spec file | Weekly-monthly |
| **OpenAPI Spec (YAML)** | `https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.yaml` | ✅ Yes | Same, YAML variant | Weekly-monthly |
| **Changelog** | `https://docs.stripe.com/changelog` | ✅ Yes | HTML scraping for new entries | 2-5x/week |
| **Status Page** | `https://status.stripe.com` | ✅ Yes | Fetch HTML or subscribe to Atom feed | Real-time incidents |
| **Status Page API** | `https://status.stripe.com/api/v2/summary.json` | ✅ Yes | JSON diff on component statuses | Real-time incidents |
| **API Docs** | `https://docs.stripe.com/api` | ✅ Yes | HTML structural diff on key pages | Monthly |
| **GitHub: openapi repo** | `https://github.com/stripe/openapi` | ✅ Yes | Watch releases/tags via `/releases.atom` | Weekly-monthly |
| **GitHub: stripe-node** | `https://github.com/stripe/stripe-node` | ✅ Yes | Releases Atom feed | Weekly |
| **GitHub: stripe-python** | `https://github.com/stripe/stripe-python` | ✅ Yes | Releases Atom feed | Weekly |
| **GitHub: stripe-ruby** | `https://github.com/stripe/stripe-ruby` | ✅ Yes | Releases Atom feed | Weekly |
| **GitHub: stripe-go** | `https://github.com/stripe/stripe-go` | ✅ Yes | Releases Atom feed | Weekly |
| **GitHub: stripe-java** | `https://github.com/stripe/stripe-java` | ✅ Yes | Releases Atom feed | Weekly |
| **npm: stripe** | `https://registry.npmjs.org/stripe` | ✅ Yes | Track `dist-tags.latest` version | Weekly |
| **PyPI: stripe** | `https://pypi.org/pypi/stripe/json` | ✅ Yes | Track `info.version` | Weekly |
| **Blog** | `https://stripe.com/blog` | ✅ Yes | RSS if available, else HTML | Monthly |
| **Twitter** | `@stripe`, `@stripestatus` | ⚠️ Unreliable | See social media analysis | Variable |

**"Monitor Stripe" auto-adds (MVP):**
1. OpenAPI spec (JSON from GitHub raw) — THE primary source
2. Changelog page
3. Status page JSON API
4. stripe-node releases (most popular SDK)

**Suggested additions (user-expandable):**
5. Additional SDK releases (Python, Ruby, Go, Java)
6. npm/PyPI version tracking
7. API docs pages

---

### 🟢 OpenAI

| Source | URL | Public? | Strategy | Change Frequency |
|--------|-----|---------|----------|-----------------|
| **OpenAPI Spec** | `https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml` | ✅ Yes | Structural diff | Frequent (weekly+) |
| **Changelog** | `https://developers.openai.com/changelog/` | ✅ Yes | HTML scraping or RSS | 3-10x/week |
| **Changelog RSS** | `https://developers.openai.com/changelog/rss.xml` (likely) | ✅ Likely | RSS feed parsing | 3-10x/week |
| **Status Page** | `https://status.openai.com` | ✅ Yes | Statuspage.io format | Real-time |
| **Status Page API** | `https://status.openai.com/api/v2/summary.json` | ✅ Yes | JSON diff on components | Real-time |
| **API Models Endpoint** | `https://api.openai.com/v1/models` | ⚠️ Needs API key | JSON diff — detect new models | Weekly |
| **API Docs** | `https://developers.openai.com/api/docs/` | ✅ Yes | HTML structural diff | Weekly |
| **GitHub: openai-openapi** | `https://github.com/openai/openai-openapi` | ✅ Yes | Releases/commits | Weekly+ |
| **GitHub: openai-python** | `https://github.com/openai/openai-python` | ✅ Yes | Releases Atom feed | Weekly |
| **GitHub: openai-node** | `https://github.com/openai/openai-node` | ✅ Yes | Releases Atom feed | Weekly |
| **npm: openai** | `https://registry.npmjs.org/openai` | ✅ Yes | Track latest version | Weekly |
| **PyPI: openai** | `https://pypi.org/pypi/openai/json` | ✅ Yes | Track latest version | Weekly |
| **Blog** | `https://openai.com/blog` | ✅ Yes | RSS/HTML | Weekly |

**"Monitor OpenAI" auto-adds (MVP):**
1. OpenAPI spec from GitHub
2. Changelog page/RSS
3. Status page JSON API
4. openai-python releases (most popular SDK)

---

### 🔵 Twilio

| Source | URL | Public? | Strategy | Change Frequency |
|--------|-----|---------|----------|-----------------|
| **OpenAPI Spec** | `https://github.com/twilio/twilio-oai` (multiple files in `spec/` folder) | ✅ Yes | Structural diff per service | Monthly |
| **Changelog** | `https://www.twilio.com/en-us/changelog` | ✅ Yes | HTML scraping | Weekly |
| **Status Page** | `https://status.twilio.com` | ✅ Yes | Statuspage.io format | Real-time |
| **Status Page API** | `https://status.twilio.com/api/v2/summary.json` | ✅ Yes | JSON diff | Real-time |
| **API Docs** | `https://www.twilio.com/docs/usage/api` | ✅ Yes | HTML diff | Monthly |
| **GitHub: twilio-node** | `https://github.com/twilio/twilio-node` | ✅ Yes | Releases Atom feed | Weekly |
| **GitHub: twilio-python** | `https://github.com/twilio/twilio-python` | ✅ Yes | Releases Atom feed | Weekly |
| **GitHub: twilio-ruby** | `https://github.com/twilio/twilio-ruby` | ✅ Yes | Releases Atom feed | Weekly |
| **GitHub: twilio-java** | `https://github.com/twilio/twilio-java` | ✅ Yes | Releases Atom feed | Weekly |
| **GitHub: twilio-csharp** | `https://github.com/twilio/twilio-csharp` | ✅ Yes | Releases Atom feed | Weekly |
| **npm: twilio** | `https://registry.npmjs.org/twilio` | ✅ Yes | Track latest version | Weekly |
| **PyPI: twilio** | `https://pypi.org/pypi/twilio/json` | ✅ Yes | Track latest version | Weekly |
| **Blog** | `https://www.twilio.com/blog` | ✅ Yes | RSS/HTML | Weekly |

**"Monitor Twilio" auto-adds (MVP):**
1. Changelog page
2. Status page JSON API
3. twilio-node releases
4. OpenAPI spec repo (main spec file)

---

### ⚫ GitHub (the API)

| Source | URL | Public? | Strategy | Change Frequency |
|--------|-----|---------|----------|-----------------|
| **OpenAPI Spec** | `https://github.com/github/rest-api-description` (bundled specs) | ✅ Yes | Structural diff | Monthly |
| **Changelog** | `https://github.blog/changelog/` | ✅ Yes | HTML/RSS | 5-15x/week |
| **Changelog RSS** | `https://github.blog/changelog/feed/` | ✅ Yes | RSS feed parsing | 5-15x/week |
| **Status Page** | `https://www.githubstatus.com` | ✅ Yes | Statuspage.io format | Real-time |
| **Status Page API** | `https://www.githubstatus.com/api/v2/summary.json` | ✅ Yes | JSON diff | Real-time |
| **API Docs** | `https://docs.github.com/en/rest` | ✅ Yes | HTML diff | Monthly |
| **GitHub: rest-api-description** | `https://github.com/github/rest-api-description` | ✅ Yes | Watch commits/releases | Monthly |
| **GitHub: octokit.js** | `https://github.com/octokit/octokit.js` | ✅ Yes | Releases Atom feed | Weekly |
| **GitHub: PyGithub** | `https://github.com/PyGithub/PyGithub` | ✅ Yes | Releases Atom feed | Monthly |
| **npm: @octokit/rest** | `https://registry.npmjs.org/@octokit/rest` | ✅ Yes | Track latest version | Weekly |
| **PyPI: PyGithub** | `https://pypi.org/pypi/PyGithub/json` | ✅ Yes | Track latest version | Monthly |
| **Blog** | `https://github.blog/` | ✅ Yes | RSS | Weekly |

**"Monitor GitHub" auto-adds (MVP):**
1. Changelog RSS
2. Status page JSON API
3. OpenAPI spec repo (bundled description)
4. octokit.js releases

---

### 🟠 Shopify

| Source | URL | Public? | Strategy | Change Frequency |
|--------|-----|---------|----------|-----------------|
| **OpenAPI Spec** | Community-maintained: `https://github.com/allengrant/shopify_openapi` | ⚠️ Unofficial | Limited value — prefer changelog | Irregular |
| **Developer Changelog** | `https://shopify.dev/changelog` | ✅ Yes | HTML scraping, filterable by `?filter=api` | 3-10x/week |
| **Developer Changelog RSS** | `https://shopify.dev/changelog/feed.atom` (likely) | ✅ Likely | Atom feed parsing | 3-10x/week |
| **Platform Changelog** | `https://changelog.shopify.com` | ✅ Yes | HTML scraping | Weekly |
| **Status Page** | `https://www.shopifystatus.com` | ✅ Yes | Custom format (store-specific now) | Real-time |
| **API Docs** | `https://shopify.dev/docs/api` | ✅ Yes | HTML diff | Monthly |
| **API Version Release Notes** | `https://shopify.dev/docs/api/release-notes` | ✅ Yes | Now redirects to changelog | Quarterly |
| **GitHub: shopify-api-ruby** | `https://github.com/Shopify/shopify-api-ruby` | ✅ Yes | Releases Atom feed | Monthly |
| **GitHub: shopify_python_api** | `https://github.com/Shopify/shopify_python_api` | ✅ Yes | Releases Atom feed | Monthly |
| **GitHub: shopify-api-js** | `https://github.com/Shopify/shopify-api-js` | ✅ Yes | Releases Atom feed | Monthly |
| **npm: @shopify/shopify-api** | `https://registry.npmjs.org/@shopify/shopify-api` | ✅ Yes | Track latest version | Monthly |
| **Blog** | `https://www.shopify.com/partners/blog` | ✅ Yes | RSS/HTML | Weekly |

**"Monitor Shopify" auto-adds (MVP):**
1. Developer changelog (API-filtered)
2. Status page
3. shopify-api-js releases
4. API version release notes page

---

## Source Type Analysis

### Tier 1 Sources (MVP) — Public HTTP GET, High Signal

| Source Type | Monitorable via HTTP GET? | Signal-to-Noise | Detection Difficulty | Developer Impact |
|------------|--------------------------|-----------------|---------------------|-----------------|
| **OpenAPI Spec** | ✅ Raw GitHub URLs | 🟢 Very High | Easy — structural diff | **CRITICAL** — schema changes = breaking changes |
| **Changelog/RSS** | ✅ Public pages/feeds | 🟢 High | Medium — detect new entries, not just any HTML change | **HIGH** — announced changes, deprecations |
| **Status Page API** | ✅ JSON endpoint | 🟢 Very High | Easy — component status field changes | **HIGH** — outages affect production |
| **Documentation** | ✅ Public pages | 🟡 Medium | Hard — lots of noise (CSS, layout changes) | **MEDIUM** — docs changes signal API changes |
| **Public API Endpoints** | ✅ (some need auth) | 🟢 High | Easy — our core engine | **CRITICAL** — live API behavior changes |

### Tier 2 Sources (V1.1) — Structured APIs, Medium Effort

| Source Type | Monitorable via HTTP GET? | Signal-to-Noise | Detection Difficulty | Developer Impact |
|------------|--------------------------|-----------------|---------------------|-----------------|
| **GitHub Releases** | ✅ Atom feed at `/{owner}/{repo}/releases.atom` | 🟢 Very High | Easy — new entry = new release | **HIGH** — SDK updates often signal API changes |
| **npm Registry** | ✅ `registry.npmjs.org/{pkg}` | 🟢 Very High | Easy — version string comparison | **MEDIUM** — version bumps = potential breaking changes |
| **PyPI Registry** | ✅ `pypi.org/pypi/{pkg}/json` | 🟢 Very High | Easy — version string comparison | **MEDIUM** — same as npm |
| **GitHub Commits** | ✅ API (rate-limited) or Atom | 🟡 Medium | Medium — need to filter relevant files | **MEDIUM** — spec file changes are high signal |

### Tier 3 Sources (V2) — Low Reliability, High Noise

| Source Type | Monitorable via HTTP GET? | Signal-to-Noise | Detection Difficulty | Developer Impact |
|------------|--------------------------|-----------------|---------------------|-----------------|
| **Blog Posts** | ⚠️ Some have RSS | 🟡 Low-Medium | Hard — filter API-relevant from marketing | **LOW** — occasional breaking change announcements |
| **Twitter/X** | ❌ No reliable free method | 🔴 Very Low | Very Hard — Nitter dead, API costs $100+/mo | **LOW** — rarely the first place changes announced |
| **GitHub Issues/Discussions** | ✅ API (rate-limited) | 🟡 Medium | Hard — community noise vs signal | **MEDIUM** — breaking change reports from users |

---

## Social Media Monitoring — Verdict

### Twitter/X: NOT worth it for MVP (maybe ever)

**The situation as of 2026:**
- **Nitter is dead.** Most instances went offline after Twitter API changes in 2023-2024. Remaining instances are unreliable.
- **RSS Bridge** requires either paid Twitter API access or fragile scraping that breaks constantly.
- **Twitter API** costs $100+/month for Basic access — per Chirri account, this is uneconomical.
- **Signal-to-noise is terrible.** Status accounts like @stripestatus duplicate what's already on the status page. Product accounts tweet marketing fluff mixed with rare API announcements.

**Verdict:** Skip entirely. The same information is available from status pages (more structured) and changelogs (more detailed). Social media monitoring is Tier 3 at best, and likely never worth the engineering cost for Chirri's use case.

### GitHub Discussions/Issues: Moderate value for V2

- Can monitor specific repos for issues tagged "breaking change" or "bug"
- GitHub API has generous rate limits for authenticated requests
- Useful as a **community signal** — "did other developers notice this change?"
- But it's reactive (reports AFTER breakage), not proactive

**Verdict:** V2 feature. Nice-to-have. Not differentiation material.

---

## Provider Intelligence: How Auto-Discovery Works

### The APIs.guru Approach

APIs.guru maintains a directory of 2,700+ API specs at `https://api.apis.guru/v2/list.json`. Each entry includes:
- `x-providerName`: domain-based provider identifier (e.g., `stripe.com`)
- `x-serviceName`: sub-service identifier
- `swaggerUrl` / `openapiVer`: direct link to the spec
- `x-origin`: where the spec was found

**How Chirri uses this:**

1. User enters a URL like `https://api.stripe.com/v1/charges`
2. Chirri extracts the domain: `api.stripe.com` → `stripe.com`
3. Chirri looks up `stripe.com` in our provider database (seeded from APIs.guru + our own curated data)
4. Match found → we know:
   - OpenAPI spec location
   - Changelog URL
   - Status page URL
   - GitHub repos
   - npm/PyPI packages
5. Chirri offers: "We found 4 additional sources for Stripe. Add them?"

### Provider Database Structure

```typescript
interface ProviderProfile {
  id: string;                    // "stripe"
  displayName: string;           // "Stripe"
  domains: string[];             // ["stripe.com", "api.stripe.com"]
  
  sources: {
    openapi?: {
      url: string;               // GitHub raw URL
      format: "json" | "yaml";
    };
    changelog?: {
      url: string;
      type: "html" | "rss" | "atom";
    };
    statusPage?: {
      url: string;
      type: "statuspage_io" | "custom";
      apiUrl?: string;           // /api/v2/summary.json
    };
    docs?: {
      urls: string[];            // Key documentation pages
    };
    github?: {
      org: string;               // "stripe"
      repos: {
        name: string;            // "stripe-node"
        type: "sdk" | "spec" | "tool";
        language?: string;
      }[];
    };
    packages?: {
      npm?: string[];            // ["stripe"]
      pypi?: string[];           // ["stripe"]
      rubygems?: string[];       // ["stripe"]
      maven?: string[];
    };
  };
}
```

### MVP Implementation: Hardcoded First, Dynamic Later

**MVP (Week 4-5):** Ship with 15-20 hardcoded provider profiles (the most popular APIs). These are the same providers used for the programmatic SEO pages.

**V1.1:** Add APIs.guru lookup for dynamic discovery. When we see a domain we don't have a profile for, check APIs.guru. If found, we at least get the OpenAPI spec URL.

**V2:** Let users contribute provider profiles. Community-driven provider database.

---

## Monitoring Strategy Per Source Type

### OpenAPI Specs — The Gold Standard
- **Fetch:** HTTP GET on raw GitHub URL (or published URL)
- **Diff:** Structural comparison — new endpoints, removed fields, type changes, deprecated operations
- **Frequency:** Every 6-24 hours (specs don't change faster than daily)
- **Alert on:** New endpoints (info), removed endpoints (breaking), field type changes (breaking), new required fields (breaking), deprecation annotations (warning)
- **Noise filtering:** Ignore description-only changes, whitespace changes, example value changes

### Status Pages — Universal Pattern
Most major providers use Atlassian Statuspage.io, which has a **standard public JSON API**:
- `https://{status-domain}/api/v2/summary.json` — current status of all components
- `https://{status-domain}/api/v2/incidents/unresolved.json` — active incidents
- `https://{status-domain}/api/v2/scheduled-maintenances/upcoming.json` — planned maintenance

This is incredibly valuable because it's **structured, public, and standard**. One monitoring strategy covers Stripe, OpenAI, GitHub, Twilio, and hundreds of other providers.

**Strategy:** Fetch summary.json, diff component statuses. Alert on any component going non-operational.

### Changelogs — The Tricky One
- **HTML changelogs:** Must detect new entries without alerting on CSS/layout changes. Strategy: extract changelog entries using CSS selectors (provider-specific), hash entry list.
- **RSS/Atom feeds:** Standard parsing. Alert on new items. Much cleaner signal.
- **Frequency:** Every 1-6 hours
- **Alert on:** New entry published
- **Noise filtering:** Deduplicate by entry URL/GUID. Ignore feed metadata changes.

### GitHub Releases — High Signal, Low Effort
- **Atom feed:** Every GitHub repo has `/releases.atom` — public, no auth needed
- **Strategy:** Standard RSS/Atom parsing. New item = new release.
- **Frequency:** Every 6-24 hours
- **Alert on:** New release, especially major version bumps (semver parsing)
- **Noise filtering:** Filter pre-releases if user prefers stable-only

### npm/PyPI Registries — Simple Version Tracking
- **npm:** `GET https://registry.npmjs.org/{package}` → check `dist-tags.latest`
- **PyPI:** `GET https://pypi.org/pypi/{package}/json` → check `info.version`
- **Strategy:** Compare version strings. Alert on version bump. Parse semver to classify severity.
- **Frequency:** Every 6-24 hours
- **Alert on:** Major version bump (breaking!), minor bump (new features), patch (fixes)

---

## The "Monitor Stripe" User Flow

### MVP Version (Week 4-5)

1. User clicks "Monitor Stripe" quick-add button (or types "stripe" in search)
2. Chirri shows provider card:
   ```
   🟣 Stripe
   
   We'll monitor these sources for you:
   ✅ OpenAPI Spec — detect schema changes, new/removed endpoints
   ✅ Changelog — new entries published at docs.stripe.com/changelog
   ✅ Status Page — outages and incidents at status.stripe.com
   ✅ stripe-node SDK — new releases on GitHub
   
   Also available:
   ☐ stripe-python SDK releases
   ☐ stripe-ruby SDK releases
   ☐ npm package version changes
   ☐ PyPI package version changes
   ☐ API documentation page changes
   
   [Add Selected Sources]
   ```
3. User clicks "Add Selected Sources" → 4 URLs added to their account
4. Each source has appropriate monitoring strategy (not all are JSON diff)

### V1.1 Version

- User can type any provider name → we search our database + APIs.guru
- Dynamic source discovery for providers we don't have hardcoded profiles for
- "Suggest a provider" button for missing providers

---

## Status Page Providers (Standard JSON API)

These providers all use Statuspage.io (Atlassian), meaning they share the same JSON API structure. **One monitoring strategy covers all of them:**

| Provider | Status Domain |
|----------|--------------|
| Stripe | `status.stripe.com` |
| OpenAI | `status.openai.com` |
| Twilio | `status.twilio.com` |
| GitHub | `www.githubstatus.com` |
| Cloudflare | `www.cloudflarestatus.com` |
| Datadog | `status.datadoghq.com` |
| PagerDuty | `status.pagerduty.com` |
| Vercel | `www.vercel-status.com` |
| Heroku | `status.heroku.com` |
| Slack | `status.slack.com` |
| Atlassian | `status.atlassian.com` |
| npm | `status.npmjs.org` |

**This is a massive win.** We can monitor 50+ providers' status pages with the same code.

---

## Implementation Priority

### MVP (Weeks 4-5)
1. **15-20 hardcoded provider profiles** — Stripe, OpenAI, Twilio, GitHub, Shopify, Cloudflare, AWS, Google Cloud, Vercel, Heroku, Datadog, PagerDuty, Slack, npm, Auth0
2. **Status page JSON monitoring** — one strategy for all Statuspage.io providers
3. **Quick-add buttons** for top 5 providers
4. **Provider search** — match user input to our database

### V1.1 (Weeks 9-12)
5. **APIs.guru integration** — dynamic OpenAPI spec discovery
6. **GitHub release monitoring** via Atom feeds
7. **npm/PyPI version tracking**
8. **RSS/Atom changelog parsing**
9. **Expand to 50+ provider profiles**

### V2 (Months 3-6)
10. **Community provider profiles** — user submissions
11. **Blog monitoring** with relevance filtering
12. **GitHub Issues/Discussions** for breaking change community signals
13. **200+ provider profiles**

---

## What Makes This Differentiation

**Nobody else does this.** Existing tools let you paste a URL and monitor it. Chirri understands that `api.stripe.com` is part of the Stripe ecosystem and offers to monitor the OpenAPI spec, changelog, status page, and SDK releases — all from typing one word.

This turns a 5-URL-at-a-time manual setup into a one-click "I depend on Stripe, keep me informed" action. That's the product.

---

*Created: March 24, 2026*  
*This document informs the provider intelligence feature in CHIRRI_DEFINITIVE_PLAN.md*
