# Chirri Early Warning System — Detecting Changes BEFORE They Happen

> **The Insight:** APIs don't break overnight. There's always a trail of signals — deprecation headers, changelog posts, migration guides, version bumps. Chirri should detect these signals and warn users BEFORE the break happens.

---

## Alert Taxonomy

Before diving into signal types, here's how we classify alerts:

| Icon | Level | Meaning | Example |
|------|-------|---------|---------|
| 🔮 | **Forecast** | Change is coming | Deprecation header detected, changelog announcement |
| ⏰ | **Deadline** | X days until sunset | Countdown from Sunset header date |
| 🔴 | **Breaking** | Something broke NOW | Schema change, 404, status code change |
| 🟡 | **Notable** | Changed, probably not breaking | New field added, response time shift |
| 🟢 | **Informational** | FYI | New SDK version, status page update |

---

## Signal Type 1: Deprecation & Sunset HTTP Headers

### What It Is
Two standardized HTTP headers that API providers send to warn consumers:

- **`Sunset` header** — [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594.html) (May 2019, Informational)
  - Indicates the date/time a resource will become unresponsive
  - Format: `Sunset: Sat, 31 Dec 2025 23:59:59 GMT` (HTTP-date, per RFC 7231 §7.1.1.1)
  - Also defines a `sunset` link relation for linking to sunset policy/docs

- **`Deprecation` header** — [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745.html) (March 2025, Standards Track)
  - Signals that a resource is or will be deprecated
  - Format: `Deprecation: @1688169599` (Structured Field Date, per RFC 9651) or `Deprecation: @1` (boolean true — already deprecated, no specific date)
  - Also defines a `deprecation` link relation for pointing to migration docs
  - Can include `Link` header with `rel="deprecation"` pointing to documentation

### Key Distinction
- **Deprecation** = "this is no longer recommended, please migrate"
- **Sunset** = "this will stop working on date X"
- They're complementary. Deprecation comes first, Sunset gives the hard deadline.

### How to Detect It

```typescript
interface DeprecationSignal {
  type: 'deprecation' | 'sunset';
  date: Date | null;        // null if Deprecation: @1 (just "true")
  documentationUrl?: string; // from Link header rel="deprecation" or rel="sunset"
  resource: string;          // the URL that returned this header
}

function parseDeprecationHeaders(response: Response): DeprecationSignal[] {
  const signals: DeprecationSignal[] = [];

  // Parse Sunset header (RFC 8594) — HTTP-date format
  const sunset = response.headers.get('Sunset');
  if (sunset) {
    signals.push({
      type: 'sunset',
      date: new Date(sunset), // HTTP-date is parseable by Date constructor
      resource: response.url,
    });
  }

  // Parse Deprecation header (RFC 9745) — Structured Field Date (@epoch)
  const deprecation = response.headers.get('Deprecation');
  if (deprecation) {
    const match = deprecation.match(/@(\d+)/);
    signals.push({
      type: 'deprecation',
      date: match ? new Date(parseInt(match[1]) * 1000) : null,
      resource: response.url,
    });
  }

  // Parse Link headers for deprecation/sunset documentation
  const link = response.headers.get('Link');
  if (link) {
    // Match: <URL>; rel="deprecation" or rel="sunset"
    const deprecationLink = link.match(/<([^>]+)>;\s*rel="deprecation"/);
    const sunsetLink = link.match(/<([^>]+)>;\s*rel="sunset"/);
    // Attach documentation URLs to respective signals
  }

  return signals;
}
```

**Detection method:** On every scheduled API probe, check response headers. Zero extra HTTP requests needed — it's free data from probes we're already making.

### Real-World APIs Using These Headers

Adoption is still growing (RFC 9745 only published March 2025), but notable adopters include:

| API | Header Used | Notes |
|-----|-------------|-------|
| **Azure API Management** | Sunset, Deprecation | Full RFC compliance in gateway policies |
| **Stripe** | Custom approach (`Stripe-Version`) | Not RFC headers, but version-based deprecation |
| **Twilio** | Sunset | On deprecated API versions |
| **Government APIs (UK, EU)** | Sunset | Several GDS/EU APIs adopted early |
| **Zuplo Gateway** | Both | Offers built-in policy for adding both headers |
| **Spring Framework** | Deprecation support | Built-in middleware for adding deprecation headers |

**Adoption reality:** Low-to-moderate as of 2026. Maybe 5-10% of APIs. But the ones that DO use it tend to be major providers. And adoption will grow as RFC 9745 is now a full Standards Track RFC.

### User-Facing Alert

```
🔮 FORECAST: Stripe API /v1/charges
   Deprecation detected! This endpoint is deprecated as of 2025-06-01.
   Sunset date: 2025-12-31 (281 days from now)
   Migration guide: https://stripe.com/docs/migration/charges-to-payment-intents
   
⏰ DEADLINE: Stripe API /v1/charges  
   ⚠️ 30 days until sunset (2025-12-31)
   Action needed: Migrate to /v2/payment_intents
```

### Effort & Priority

- **Effort:** 4-8 hours (header parsing + storage + alert logic)
- **Phase:** MVP ✅
- **Why MVP:** Zero extra cost, zero extra requests. Just read headers we already get. Massive value when present.

---

## Signal Type 2: Changelog / Blog Signal Detection

### What It Is
Most API providers publish changelogs or blog posts announcing upcoming changes weeks or months before they happen. These contain keywords and dates that predict breaking changes.

### Keyword Patterns to Detect

```typescript
const DEPRECATION_KEYWORDS = [
  // Strong signals (likely breaking)
  'deprecated', 'deprecating', 'deprecation',
  'sunset', 'sunsetting', 'sunsetted',
  'end of life', 'end-of-life', 'EOL',
  'breaking change', 'breaking changes',
  'removed', 'removing', 'will be removed',
  'no longer supported', 'no longer available',
  'migration required', 'upgrade required',
  'will stop working', 'will cease to function',
  'decommission', 'decommissioning',
  'shutdown', 'shutting down',

  // Medium signals (upcoming change)
  'migration guide', 'upgrade guide',
  'new version', 'v2', 'v3',  // version mentions
  'replacing', 'replacement',
  'legacy', 'superseded',
  'last day', 'final day',
  'action required', 'action needed',

  // Date-associated patterns
  /(?:by|before|until|on|after)\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
  /(?:Q[1-4])\s+\d{4}/i,
  /\d{4}-\d{2}-\d{2}/,  // ISO dates
];
```

### How to Detect It

**Approach: HTML page monitoring with keyword extraction**

```typescript
interface ChangelogEntry {
  title: string;
  date: Date;
  content: string;
  keywords: string[];       // which deprecation keywords matched
  extractedDates: Date[];   // dates mentioned in the text
  severity: 'breaking' | 'deprecation' | 'notable' | 'info';
  url: string;
}

async function monitorChangelog(url: string, previousHash: string): Promise<ChangelogEntry[]> {
  // 1. Fetch the changelog page
  const html = await fetch(url);
  const text = extractText(html); // strip HTML, get readable text
  
  // 2. Check if content changed (hash comparison)
  const currentHash = hash(text);
  if (currentHash === previousHash) return [];
  
  // 3. Split into individual entries (common patterns)
  const entries = splitChangelogEntries(text);
  // Patterns: date-headed sections, <h2>/<h3> with dates, 
  // reverse-chronological lists, RSS/Atom items
  
  // 4. For each NEW entry, scan for keywords
  for (const entry of newEntries) {
    const matched = DEPRECATION_KEYWORDS.filter(kw => 
      typeof kw === 'string' 
        ? entry.content.toLowerCase().includes(kw)
        : kw.test(entry.content)
    );
    
    if (matched.length > 0) {
      // 5. Extract dates from text (deadlines)
      const dates = extractDates(entry.content);
      // Use chrono-node or similar for natural language date parsing
      // "by June 1, 2026" → 2026-06-01
      // "Q3 2026" → 2026-07-01
      // "in 6 months" → relative date
      
      // 6. Classify severity
      entry.severity = classifySeverity(matched);
    }
  }
  
  return newEntries.filter(e => e.keywords.length > 0);
}
```

**Date extraction library:** Use `chrono-node` (npm) — excellent natural language date parser that handles "June 1, 2026", "by Q3 2026", "in 6 months", etc.

### Real-World Changelog URLs to Monitor

| Provider | Changelog URL | Format |
|----------|--------------|--------|
| **Stripe** | `https://stripe.com/docs/changelog` | HTML, date-headed sections |
| **Twilio** | `https://www.twilio.com/changelog` | HTML, card-based |
| **GitHub** | `https://github.blog/changelog/` | HTML blog |
| **Shopify** | `https://shopify.dev/changelog` | HTML, date-tagged |
| **Slack** | `https://api.slack.com/changelog` | HTML list |
| **Google Cloud** | `https://cloud.google.com/release-notes` | HTML, filterable |
| **AWS** | `https://aws.amazon.com/new/` | HTML, RSS available |
| **Cloudflare** | `https://developers.cloudflare.com/changelog/` | HTML |
| **OpenAI** | `https://platform.openai.com/docs/changelog` | HTML |
| **Anthropic** | `https://docs.anthropic.com/en/docs/about-claude/models` | HTML |

Many also offer RSS/Atom feeds, which are even easier to parse.

### User-Facing Alert

```
🔮 FORECAST: Stripe Changelog (March 15, 2026)
   "Charges API deprecation timeline announced"
   Stripe plans to remove /v1/charges by September 1, 2026.
   Migration guide: https://stripe.com/docs/payments/migration
   Keywords detected: "deprecated", "removed", "migration guide"
   Source: https://stripe.com/docs/changelog#2026-03-15
```

### Effort & Priority

- **Effort:** 2-3 days (page fetching + diff + keyword extraction + date parsing)
- **Phase:** MVP ✅
- **Why MVP:** This is literally just "changedetection.io but smart" — we already monitor pages, just add keyword scanning. The NLP/date extraction layer is the real value-add.

---

## Signal Type 3: API Version Header Tracking

### What It Is
Many APIs return version information in response headers. When a new version appears that the user isn't using, that's an early warning signal.

### Common Version Headers

| Header | Used By | Example |
|--------|---------|---------|
| `Stripe-Version` | Stripe | `2024-09-30.acacia` |
| `X-API-Version` | Various | `2.0`, `2024-01-15` |
| `API-Version` | Various | `3.1` |
| `X-RateLimit-*` + version | GitHub | API version in URL path |
| `X-Shopify-API-Version` | Shopify | `2024-07` |
| `Twilio-Version` | Twilio | `2010-04-01` |
| `anthropic-version` | Anthropic | `2024-10-22` |
| `openai-version` | OpenAI | In response headers |
| `X-API-Warn` | Various | Free-text deprecation warnings |

### How to Detect It

```typescript
interface VersionSignal {
  header: string;
  currentVersion: string;    // what the API returned
  previousVersion: string;   // what we saw last time
  userRequestedVersion?: string; // what the user sends in requests
  isNewer: boolean;
}

// Version tracking per endpoint
const VERSION_HEADERS = [
  'stripe-version', 'x-api-version', 'api-version',
  'x-shopify-api-version', 'anthropic-version',
  'x-api-warn', 'x-api-deprecated',
];

function detectVersionChanges(response: Response, stored: VersionStore): VersionSignal[] {
  const signals: VersionSignal[] = [];
  
  for (const header of VERSION_HEADERS) {
    const value = response.headers.get(header);
    if (!value) continue;
    
    const previous = stored.get(response.url, header);
    if (previous && previous !== value) {
      signals.push({
        header,
        currentVersion: value,
        previousVersion: previous,
        isNewer: isNewerVersion(value, previous),
      });
    }
    
    stored.set(response.url, header, value);
  }
  
  // Also check for X-API-Warn or similar warning headers
  const warn = response.headers.get('x-api-warn') || response.headers.get('warning');
  if (warn && /deprecat|sunset|obsolete|upgrade/i.test(warn)) {
    // Treat as deprecation warning
  }
  
  return signals;
}
```

**Key insight for Stripe-style versioning:** Stripe returns the version being used. If you detect through changelog monitoring that a newer version exists, and the user's probe uses an old version, that's a signal: "You're on 2024-09-30 but 2025-06-01 is available."

### User-Facing Alert

```
🟡 NOTABLE: Shopify API version change detected
   Header: X-Shopify-API-Version
   Previous: 2025-04 → Current: 2025-07
   You're using: 2025-01 (2 versions behind)
   Consider upgrading: https://shopify.dev/docs/api/release-notes
```

### Effort & Priority

- **Effort:** 4-8 hours (header tracking + version comparison logic)
- **Phase:** MVP ✅
- **Why MVP:** Zero extra requests — just read headers from existing probes. Simple storage comparison.

---

## Signal Type 4: OpenAPI Spec Diff for Upcoming Changes

### What It Is
When an API publishes an OpenAPI/Swagger spec, we can diff successive versions to detect:
- `deprecated: true` added to an operation or parameter
- New required parameters added (breaking!)
- Endpoints removed
- Response schema changes
- New endpoints appearing (signals new version)

### OpenAPI Deprecation Fields

```yaml
# Operation-level deprecation
paths:
  /v1/charges:
    post:
      deprecated: true        # ← This is the signal
      summary: "Create a charge"
      x-sunset: "2026-09-01"  # ← Vendor extension (proposed in OAI #5193)
      
# Parameter-level deprecation
parameters:
  - name: old_field
    in: query
    deprecated: true           # ← Individual field deprecated
    
# Schema property deprecation
components:
  schemas:
    Charge:
      properties:
        source:
          type: string
          deprecated: true     # ← Property deprecated
```

### Existing Tools We Can Leverage

| Tool | Language | What It Does |
|------|----------|-------------|
| **[oasdiff](https://github.com/oasdiff/oasdiff)** | Go (CLI) | Breaking change detection, changelog generation, deprecation tracking |
| **[openapi-changes](https://github.com/pb33f/openapi-changes)** | Go | Visual diff, breaking change detection, customizable rules |
| **[openapi-diff](https://github.com/OpenAPITools/openapi-diff)** | Java | Breaking vs non-breaking classification |
| **Optic** | Node.js | API diff and governance |

**oasdiff is the gold standard** — it even supports graceful deprecation workflows and can generate structured changelogs.

### How to Detect It

```typescript
async function diffOpenAPISpecs(monitorId: string): Promise<SpecChange[]> {
  // 1. Fetch current spec (many APIs publish at known URLs)
  const currentSpec = await fetchSpec(specUrl);
  const previousSpec = await getStoredSpec(monitorId);
  
  if (!previousSpec) {
    await storeSpec(monitorId, currentSpec);
    return [];
  }
  
  // 2. Use oasdiff or similar to diff
  // Can shell out to oasdiff CLI or use a JS OpenAPI parser
  const diff = await oasdiff(previousSpec, currentSpec);
  
  // 3. Classify changes
  const changes: SpecChange[] = [];
  
  for (const change of diff) {
    if (change.type === 'endpoint-deprecated') {
      changes.push({
        severity: 'forecast',
        message: `Endpoint ${change.path} marked as deprecated`,
        deadline: change.extensions?.['x-sunset'], // if present
      });
    }
    if (change.type === 'required-param-added') {
      changes.push({
        severity: 'breaking',
        message: `New required parameter "${change.param}" added to ${change.path}`,
      });
    }
    if (change.type === 'endpoint-removed') {
      changes.push({
        severity: 'breaking',
        message: `Endpoint ${change.path} removed from spec`,
      });
    }
  }
  
  await storeSpec(monitorId, currentSpec);
  return changes;
}
```

### Where to Find OpenAPI Specs

| Provider | Spec URL Pattern |
|----------|-----------------|
| **Stripe** | `https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json` |
| **GitHub** | `https://github.com/github/rest-api-description` (repo with specs) |
| **Twilio** | `https://github.com/twilio/twilio-oai` |
| **Shopify** | Published in dev docs |
| **PetStore (demo)** | `https://petstore3.swagger.io/api/v3/openapi.json` |
| **APIs.guru** | `https://api.apis.guru/v2/list.json` — directory of 2000+ API specs |

### User-Facing Alert

```
🔮 FORECAST: GitHub API spec updated
   3 endpoints newly marked as deprecated:
   - POST /repos/{owner}/{repo}/git/refs (deprecated)
   - GET /teams/{team_id} (deprecated, use /orgs/{org}/teams/{team_slug})
   - GET /user/repository_invitations (deprecated)
   No sunset date specified yet.
   Spec diff: https://chirri.dev/diff/github-api/2026-03-20
```

### Effort & Priority

- **Effort:** 2-3 days (spec fetching + diffing + classification)
- **Phase:** v1.1 (post-MVP)
- **Why not MVP:** Requires users to configure spec URLs. Not all APIs publish specs. But incredibly powerful when available.

---

## Signal Type 5: SDK / Package Version Signals

### What It Is
When a SDK's major version bumps (e.g., `stripe@14.0.0` → `stripe@15.0.0`), that almost always means breaking changes. Detecting this early lets users prepare.

### How to Detect It

**npm Registry API:**
```bash
# Get all versions of a package
curl https://registry.npmjs.org/stripe | jq '.["dist-tags"].latest'

# Get specific version info
curl https://registry.npmjs.org/stripe/15.0.0
```

**PyPI API:**
```bash
curl https://pypi.org/pypi/stripe/json | jq '.info.version'
```

**GitHub Releases Atom Feed:**
```
https://github.com/stripe/stripe-node/releases.atom
https://github.com/stripe/stripe-python/releases.atom
```

```typescript
interface PackageVersionSignal {
  package: string;
  registry: 'npm' | 'pypi' | 'rubygems' | 'github';
  previousVersion: string;
  newVersion: string;
  isMajorBump: boolean;      // 14.x → 15.x
  changelogUrl?: string;
  breakingChanges?: string[]; // parsed from CHANGELOG.md
}

async function checkNpmPackage(packageName: string): Promise<PackageVersionSignal | null> {
  const resp = await fetch(`https://registry.npmjs.org/${packageName}`);
  const data = await resp.json();
  const latest = data['dist-tags'].latest;
  const stored = await getStoredVersion(packageName);
  
  if (stored && latest !== stored) {
    const [oldMajor] = stored.split('.');
    const [newMajor] = latest.split('.');
    
    return {
      package: packageName,
      registry: 'npm',
      previousVersion: stored,
      newVersion: latest,
      isMajorBump: parseInt(newMajor) > parseInt(oldMajor),
    };
  }
  
  await storeVersion(packageName, latest);
  return null;
}
```

**CHANGELOG.md parsing for breaking changes:**
```typescript
const BREAKING_CHANGE_PATTERNS = [
  /^#+\s*BREAKING\s*CHANGE/mi,
  /^#+\s*Breaking/mi,
  /^-\s*\*\*BREAKING\*\*/mi,
  /^###?\s*\d+\.\d+\.\d+.*breaking/mi,
  /⚠️.*breaking/i,
  /^\s*-\s*(?:BREAKING|Breaking):/m,
];

async function parseChangelogForBreaking(repoUrl: string): Promise<string[]> {
  // Fetch CHANGELOG.md from GitHub raw
  const changelogUrl = `${repoUrl}/raw/main/CHANGELOG.md`;
  const text = await fetch(changelogUrl).then(r => r.text());
  
  // Split by version headers, find latest version section
  const sections = text.split(/^##\s+/m);
  const latestSection = sections[1]; // first section after split
  
  // Extract breaking change lines
  return latestSection
    .split('\n')
    .filter(line => BREAKING_CHANGE_PATTERNS.some(p => p.test(line)));
}
```

### User-Facing Alert

```
🟢 INFO: stripe (npm) — New version 15.0.0 released
   ⚠️ MAJOR VERSION BUMP (was 14.21.0)
   Breaking changes detected in CHANGELOG.md:
   - Removed `charges.create()` — use `paymentIntents.create()` instead
   - Node.js 16 no longer supported
   - Default API version changed to 2026-03-01
   Changelog: https://github.com/stripe/stripe-node/blob/main/CHANGELOG.md
   
⏰ If you depend on stripe npm package, plan your upgrade.
```

### Effort & Priority

- **Effort:** 1-2 days (registry polling + semver comparison + CHANGELOG parsing)
- **Phase:** MVP ✅
- **Why MVP:** Simple API calls, valuable signal, most API providers have SDKs on npm/PyPI.

---

## Signal Type 6: GitHub Repository Signals

### What It Is
GitHub repos for API providers leak information about upcoming changes through:
- Issues/PRs labeled `breaking-change`, `deprecation`
- Release notes
- Commits to spec files
- New branches like `v2`, `next`

### How to Detect It

**GitHub Releases Atom Feed:**
```
https://github.com/{owner}/{repo}/releases.atom
```
Every GitHub repo with releases has this. Free, no auth needed, no rate limit concerns.

**GitHub API for labels:**
```bash
# Find issues with breaking-change labels
gh api repos/stripe/stripe-node/issues?labels=breaking-change&state=open

# Search for deprecation mentions in issues
gh api search/issues?q=repo:stripe/stripe-node+deprecation+is:open
```

**GitHub API for releases:**
```bash
# Get latest release with body (release notes)
gh api repos/stripe/stripe-node/releases/latest
```

```typescript
interface GitHubSignal {
  type: 'release' | 'issue' | 'pr' | 'branch';
  repo: string;
  title: string;
  body: string;
  labels: string[];
  url: string;
  breakingKeywords: string[];
}

async function monitorGitHubRepo(owner: string, repo: string): Promise<GitHubSignal[]> {
  const signals: GitHubSignal[] = [];
  
  // 1. Check releases atom feed (lightweight, no auth)
  const feed = await fetch(`https://github.com/${owner}/${repo}/releases.atom`);
  const entries = parseAtom(await feed.text());
  
  for (const entry of newEntries(entries)) {
    const keywords = scanForBreakingKeywords(entry.content);
    if (keywords.length > 0) {
      signals.push({
        type: 'release',
        repo: `${owner}/${repo}`,
        title: entry.title,
        body: entry.content,
        labels: [],
        url: entry.link,
        breakingKeywords: keywords,
      });
    }
  }
  
  // 2. Check issues with specific labels (needs GitHub token)
  const issues = await ghApi(`repos/${owner}/${repo}/issues`, {
    labels: 'breaking-change,deprecation,breaking',
    state: 'open',
    per_page: 10,
  });
  
  for (const issue of issues) {
    signals.push({
      type: 'issue',
      repo: `${owner}/${repo}`,
      title: issue.title,
      body: issue.body,
      labels: issue.labels.map(l => l.name),
      url: issue.html_url,
      breakingKeywords: scanForBreakingKeywords(issue.title + ' ' + issue.body),
    });
  }
  
  return signals;
}
```

### Common Deprecation Label Names

```typescript
const DEPRECATION_LABELS = [
  'breaking-change', 'breaking change', 'breaking',
  'deprecation', 'deprecated',
  'removal', 'to-be-removed',
  'migration', 'migration-needed',
  'api-change', 'api-breaking',
  'semver-major', 'semver:major',
];
```

### User-Facing Alert

```
🔮 FORECAST: stripe/stripe-node
   New issue #4521: "Deprecate legacy Card source creation"
   Labels: breaking-change, deprecation
   "Card sources via /v1/sources will be removed in API version 2026-09. 
    Please migrate to PaymentMethods."
   Source: https://github.com/stripe/stripe-node/issues/4521
```

### Effort & Priority

- **Effort:** 1-2 days (Atom feed parsing + GitHub API + keyword scanning)
- **Phase:** MVP ✅
- **Why MVP:** Atom feeds are free and lightweight. GitHub API adds depth. Most API providers have public repos.

---

## Signal Type 7: Migration Guide Detection

### What It Is
When a provider publishes a new migration/upgrade guide, that's a strong signal that a breaking change is imminent or in progress.

### Common URL Patterns

```typescript
const MIGRATION_URL_PATTERNS = [
  '/docs/migration',
  '/docs/migrate',
  '/docs/upgrade',
  '/docs/upgrade-guide',
  '/docs/upgrading',
  '/docs/v2-migration',
  '/docs/breaking-changes',
  '/migration-guide',
  '/docs/api/migration',
  '/guides/migration',
  '/docs/transition',
];

// Provider-specific known migration guide URLs
const KNOWN_MIGRATION_GUIDES = {
  stripe: [
    'https://stripe.com/docs/upgrades',
    'https://stripe.com/docs/payments/payment-intents/migration',
  ],
  twilio: [
    'https://www.twilio.com/docs/messaging/migration',
  ],
  github: [
    'https://docs.github.com/en/rest/overview/api-versions',
  ],
  shopify: [
    'https://shopify.dev/docs/api/release-notes',
    'https://shopify.dev/docs/apps/build/upgrade',
  ],
};
```

### How to Detect It

Two approaches:

**Approach A: Monitor known migration guide URLs for content changes**
```typescript
// Same as changelog monitoring — check if the page content changed
// If a migration guide page goes from 404 → 200, that's a STRONG signal
async function detectNewMigrationGuide(url: string): Promise<boolean> {
  const response = await fetch(url, { method: 'HEAD' });
  const previousStatus = await getStoredStatus(url);
  
  if (previousStatus === 404 && response.status === 200) {
    // New migration guide just appeared!
    return true;
  }
  
  // Also check for content changes on existing guides
  if (response.status === 200) {
    return await contentChanged(url);
  }
  
  return false;
}
```

**Approach B: Discover migration guides from sitemap.xml**
```typescript
// Many docs sites publish sitemaps
// Monitor sitemap for new URLs matching migration patterns
async function discoverMigrationGuides(sitemapUrl: string): Promise<string[]> {
  const sitemap = await fetch(sitemapUrl);
  const urls = parseSitemap(await sitemap.text());
  
  return urls.filter(url => 
    MIGRATION_URL_PATTERNS.some(pattern => url.includes(pattern))
  );
}
```

### User-Facing Alert

```
🔮 FORECAST: New migration guide detected!
   Stripe published: "Migrating from Charges to Payment Intents"
   URL: https://stripe.com/docs/payments/payment-intents/migration
   This page was not present in our last scan (24h ago).
   This strongly suggests upcoming breaking changes to the Charges API.
```

### Effort & Priority

- **Effort:** 1 day (URL monitoring + sitemap parsing)
- **Phase:** v1.1
- **Why not MVP:** Requires curating URL lists per provider. Good enhancement once we have provider profiles.

---

## Signal Type 8: Status Page Integration

### What It Is
API status pages (Statuspage.io, custom) sometimes announce planned maintenance, deprecations, and upcoming changes. These are usually machine-readable.

### How to Detect It

```typescript
// Many providers use Atlassian Statuspage — it has a public API
const STATUSPAGE_APIS = {
  stripe: 'https://status.stripe.com/api/v2/summary.json',
  github: 'https://www.githubstatus.com/api/v2/summary.json',
  twilio: 'https://status.twilio.com/api/v2/summary.json',
  cloudflare: 'https://www.cloudflarestatus.com/api/v2/summary.json',
};

// Scheduled maintenances often contain deprecation info
async function checkStatusPage(url: string): Promise<StatusSignal[]> {
  const data = await fetch(`${url.replace('/summary.json', '/scheduled-maintenances/upcoming.json')}`);
  const maintenances = await data.json();
  
  return maintenances.scheduled_maintenances
    .filter(m => scanForBreakingKeywords(m.name + ' ' + m.body).length > 0)
    .map(m => ({
      type: 'scheduled-maintenance',
      name: m.name,
      scheduledFor: m.scheduled_for,
      body: m.body,
      url: m.shortlink,
    }));
}
```

### Effort & Priority

- **Effort:** 4-8 hours
- **Phase:** v1.1
- **Why:** Nice to have but not core. Most deprecation info comes through changelogs, not status pages.

---

## Implementation Architecture

### Signal Processing Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                   Chirri Probe Engine                     │
│  (already making HTTP requests to monitored endpoints)   │
└─────────────┬───────────────────────────────┬───────────┘
              │                               │
              ▼                               ▼
┌─────────────────────┐         ┌─────────────────────────┐
│  Header Extractor    │         │  Response Analyzer       │
│  - Sunset            │         │  - Schema diff           │
│  - Deprecation       │         │  - Status code changes   │
│  - Version headers   │         │  - Body changes          │
│  - Link rels         │         │                          │
│  - Warning headers   │         │                          │
└─────────┬───────────┘         └──────────┬──────────────┘
          │                                │
          ▼                                ▼
┌──────────────────────────────────────────────────────────┐
│              Signal Aggregator & Classifier                │
│                                                            │
│  Inputs:                    Classification:                │
│  - Deprecation headers  →   🔮 Forecast                   │
│  - Sunset headers       →   ⏰ Deadline                   │
│  - Changelog keywords   →   🔮 Forecast / 🔴 Breaking     │
│  - Version changes      →   🟡 Notable                    │
│  - Spec diffs           →   🔮/🔴 depending on change     │
│  - SDK version bumps    →   🟢 Info / 🟡 Notable          │
│  - GitHub signals       →   🔮 Forecast                   │
│  - Migration guides     →   🔮 Forecast                   │
│                                                            │
│  Deduplication: Same signal from multiple sources          │
│  → merge into single alert with multiple evidence          │
└────────────────────┬─────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────┐
│              Notification Engine                           │
│                                                            │
│  Alert Rules:                                              │
│  - 🔮 Forecast  → Notify once when first detected          │
│  - ⏰ Deadline  → Notify at 90/60/30/14/7/1 days out      │
│  - 🔴 Breaking  → Immediate notification                  │
│  - 🟡 Notable   → Daily digest                            │
│  - 🟢 Info      → Weekly digest                           │
│                                                            │
│  Channels: Slack, Discord, Email, Webhook                  │
└──────────────────────────────────────────────────────────┘
```

### Data Model

```typescript
interface EarlyWarningSignal {
  id: string;
  monitorId: string;           // which Chirri monitor detected this
  signalType: 'deprecation-header' | 'sunset-header' | 'changelog-keyword' 
    | 'version-header' | 'spec-diff' | 'sdk-version' | 'github-signal' 
    | 'migration-guide' | 'status-page';
  alertLevel: 'forecast' | 'deadline' | 'breaking' | 'notable' | 'info';
  
  // What we found
  summary: string;             // human-readable summary
  details: string;             // full details
  evidence: Evidence[];        // raw data that triggered this
  
  // When it matters
  detectedAt: Date;
  deadlineDate?: Date;         // from Sunset header or extracted date
  daysUntilDeadline?: number;
  
  // Links
  sourceUrl: string;           // where we detected this
  documentationUrl?: string;   // migration guide, changelog entry
  affectedEndpoints?: string[];// which API endpoints are affected
  
  // Notification tracking
  lastNotifiedAt?: Date;
  notificationSchedule?: Date[]; // for deadline countdowns
  acknowledged: boolean;
}

interface Evidence {
  type: string;
  raw: string;                 // raw header value, text snippet, etc.
  source: string;              // URL or identifier
  timestamp: Date;
}
```

### Deadline Countdown Logic

```typescript
const COUNTDOWN_DAYS = [90, 60, 30, 14, 7, 3, 1, 0];

function shouldNotifyDeadline(signal: EarlyWarningSignal): boolean {
  if (!signal.deadlineDate) return false;
  
  const daysLeft = Math.ceil(
    (signal.deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  
  // Find the next notification threshold
  const threshold = COUNTDOWN_DAYS.find(d => d <= daysLeft);
  
  // Check if we already notified for this threshold
  if (signal.lastNotifiedThreshold === threshold) return false;
  
  signal.daysUntilDeadline = daysLeft;
  return true;
}
```

---

## Competitive Analysis

### Does Anyone Do This?

| Tool | Detects Upcoming Changes? | How? |
|------|--------------------------|------|
| **changedetection.io** | ❌ No | Detects page content changes, but no keyword intelligence or deadline extraction. Just "something changed." |
| **Postman Monitors** | ❌ No | Monitors uptime and response correctness. No deprecation detection. |
| **Datadog API Monitoring** | ❌ No | Performance monitoring only. |
| **Pingdom / UptimeRobot** | ❌ No | Uptime only. |
| **Optic** | 🟡 Partial | Detects breaking changes in OpenAPI specs during CI/CD. Not monitoring external APIs. |
| **oasdiff** | 🟡 Partial | CLI tool for spec diffing. No monitoring loop. |
| **APIMatic** | ❌ No | SDK generation, not monitoring. |
| **Akita Software** | ❌ No | API traffic analysis, not external monitoring. |
| **Moesif** | ❌ No | API analytics, not deprecation detection. |
| **ReadMe** | ❌ No | API docs platform. |
| **Theneo** | 🟡 Partial | Generates changelogs from spec diffs. Not external monitoring. |

### The Gap

**Nobody monitors external APIs for upcoming breaking changes.** The market is:
- **Uptime monitoring** (Pingdom, UptimeRobot) — "is it up?"
- **API testing** (Postman) — "does it still work?"
- **Spec governance** (Optic, oasdiff) — "did OUR spec break?"
- **Content monitoring** (changedetection.io) — "did this page change?"

**Nobody asks: "Is this API ABOUT TO break?"**

Chirri would be the first tool that:
1. Reads deprecation/sunset headers from live API responses
2. Scans changelogs for breaking change keywords and extracts deadlines
3. Monitors OpenAPI specs for newly-deprecated endpoints
4. Tracks SDK major version bumps
5. Watches GitHub repos for breaking-change signals
6. Combines all signals into a unified early warning system with countdown timers

**This is a genuine blue ocean feature.**

---

## MVP Roadmap

### Phase 1: MVP (Week 1-2)

| Signal | Effort | Value | Notes |
|--------|--------|-------|-------|
| Deprecation/Sunset headers | 4-8h | 🔥 High | Free — just parse existing probe responses |
| Version header tracking | 4-8h | 🔥 High | Free — same as above |
| Changelog keyword scanning | 2-3 days | 🔥🔥 Highest | The #1 differentiator |
| SDK version monitoring (npm) | 1-2 days | Medium | Simple registry API calls |
| GitHub Atom feeds | 1 day | Medium | Lightweight, no auth needed |
| Alert taxonomy + notifications | 1-2 days | Required | Framework for all signals |

**Total MVP: ~2 weeks**

### Phase 2: v1.1 (Week 3-4)

| Signal | Effort | Value | Notes |
|--------|--------|-------|-------|
| OpenAPI spec diffing | 2-3 days | 🔥 High | Powerful but needs spec URLs |
| Migration guide detection | 1 day | Medium | URL monitoring with intelligence |
| Status page integration | 4-8h | Low-Med | Nice to have |
| Deadline countdowns | 1 day | 🔥 High | Escalating alerts as deadlines approach |
| PyPI/RubyGems support | 1 day | Medium | Expand beyond npm |
| GitHub API (labels, issues) | 1 day | Medium | Deeper signals, needs auth |

### Phase 3: Intelligence (Month 2+)

- **Cross-signal correlation:** "Changelog mentioned deprecation AND Sunset header appeared AND GitHub issue opened = HIGH CONFIDENCE"
- **Provider profiles:** Pre-configured monitoring for top 50 APIs (Stripe, Twilio, GitHub, AWS, etc.)
- **AI-powered changelog analysis:** Use LLM to summarize breaking changes from long changelog entries
- **Severity auto-classification:** Learn from user feedback which signals matter most
- **Timeline visualization:** Show upcoming deadlines on a calendar/timeline view

---

## Key Technical Decisions

### Date Parsing
- **Sunset header:** HTTP-date format (RFC 7231 §7.1.1.1) — `Sat, 31 Dec 2025 23:59:59 GMT`. Use `new Date()` — it handles this natively.
- **Deprecation header:** Structured Field Date (RFC 9651) — `@1688169599` (Unix epoch seconds). Parse with `new Date(parseInt(match[1]) * 1000)`.
- **Changelog dates:** Use `chrono-node` npm package for natural language date extraction ("June 1, 2026", "Q3 2026", "in 6 months").

### Storage
Each signal needs:
- Signal ID (for deduplication)
- First detected timestamp
- Last seen timestamp  
- Deadline date (if any)
- Notification history (which thresholds we've alerted on)
- Acknowledgement status

### Deduplication
Same breaking change might be detected from multiple sources:
- Changelog says "removing /v1/charges"
- Sunset header appears on /v1/charges
- OpenAPI spec marks /v1/charges as deprecated
- GitHub issue discusses the removal

→ Merge into single signal with multiple evidence sources, strongest severity wins.

---

## The Pitch

> **Chirri doesn't just tell you when something broke. It tells you when something is ABOUT to break.**
> 
> While other monitoring tools wake you up at 3 AM when your integration is already failing, Chirri gives you weeks or months of advance warning. We read the tea leaves — deprecation headers, changelog announcements, spec changes, SDK bumps — and alert you before the break happens.
> 
> Think of it as a weather forecast for your API dependencies.

---

*Document created: 2026-03-24*
*Research depth: RFC specifications, real-world API analysis, competitive landscape, implementation architecture*
