# Chirri New Features — Implementation Guide

**Version:** 1.0
**Date:** 2026-03-24
**Status:** Implementation Research (Pre-Build)
**Depends on:** CHIRRI_BIBLE.md v2.2, CHIRRI_API_INTELLIGENCE.md, CHIRRI_PRODUCT_OPPORTUNITIES.md

This document provides concrete implementation details for the 7 MVP-adjacent features identified in CHIRRI_PRODUCT_OPPORTUNITIES.md. Each section covers architecture, libraries, data model, API surface, UI placement, effort, dependencies, and risks.

---

## Table of Contents

1. [Auto-Generated Migration Checklists](#1-auto-generated-migration-checklists)
2. [Workflow Routing (Notification Rules)](#2-workflow-routing-notification-rules)
3. [SDK/Package Version Intelligence](#3-sdkpackage-version-intelligence)
4. ["What Breaks If..." Impact Simulator](#4-what-breaks-if-impact-simulator)
5. [Security & Compliance Change Flagging](#5-security--compliance-change-flagging)
6. [GitHub Issue Auto-Creation](#6-github-issue-auto-creation)
7. [Dependency Graph Visualization](#7-dependency-graph-visualization)

---

## 1. Auto-Generated Migration Checklists

### 1.1 How It Works (Architecture)

When the early warning system or change detection pipeline detects a **deprecation or breaking change** with an identifiable migration path, Chirri generates a personalized step-by-step migration checklist.

**Trigger flow:**

```
Change detected (change_type: 'deprecation' | 'breaking')
  │
  ▼
Is there a migration guide URL? (from changelog scan, provider profile, or LLM extraction)
  │
  ├── YES → Fetch guide content, feed to LLM with user context
  ├── NO  → Use raw diff + known provider patterns, feed to LLM
  │
  ▼
LLM generates structured checklist (JSON)
  │
  ▼
Store in migration_checklists table (cached per change + user path set)
  │
  ▼
Display on Change Detail page + include in notification
```

**Two trigger modes:**
- **Automatic (paid users):** Generated when a deprecation/breaking change is confirmed (Step 9 of checking pipeline). Runs as a background BullMQ job on `migration-checklists` queue.
- **On-demand (free users):** "Generate migration plan" button on Change Detail page. Rate-limited to 3/month on free tier.

**Personalization:** The checklist is personalized using data from `urls` table — specifically `parsed_path`, `parsed_version`, and any `user_api_context` if the user has provided endpoint details. If the user monitors `/v1/charges` and `/v1/customers`, only steps relevant to those endpoints are included.

**Stripe's migration guide structure (studied as gold standard):**
1. **What changed** — one-sentence summary
2. **Who is affected** — which API versions, endpoints, SDKs
3. **Step-by-step migration** — numbered checklist with before/after code
4. **Testing guidance** — how to verify in sandbox/test mode
5. **Deadline** — when the old behavior stops working
6. **Resources** — links to docs, migration guide, SDK changelogs

Chirri's generated checklists follow this same structure.

### 1.2 Libraries/APIs Needed

| Library | Purpose | Notes |
|---------|---------|-------|
| **LLM (Claude Haiku 3.5 / GPT-5.4-nano)** | Checklist generation | ~$0.005-0.01 per generation |
| **Claude Sonnet 4 / GPT-5.4** | Complex migrations with code generation | Escalate for breaking changes |
| Existing `web_fetch` capability | Fetch migration guide content | Already in the check worker |
| `turndown` | Convert HTML migration guides to markdown for LLM context | Already a dependency |
| `@mozilla/readability` | Extract article content from migration guide pages | Already a dependency |

**No new dependencies required.** The LLM integration service from CHIRRI_API_INTELLIGENCE.md handles the API calls.

### 1.3 LLM Prompt Design

```
System: You are an API migration analyst. Generate a structured migration 
checklist based on the detected change and user's specific endpoints.

Be specific and actionable. Include code snippets for the user's language.
Only include steps relevant to the user's monitored endpoints.
Use checkbox format (- [ ] Step N: ...).

User:
## Detected Change
Provider: {provider_name}
Change Type: {deprecation|breaking}
Diff Summary: {diff_summary}
Deadline: {deadline or "unknown"}

## Migration Guide Content (if available)
{migration_guide_markdown}

## User's Monitored Context
Endpoints: {user_monitored_paths}
Language: {user_language_preference or "unknown"}
Current SDK Version: {sdk_version or "unknown"}

## Generate:
1. summary (1-2 sentences)
2. affected_endpoints (array of user's endpoints that are impacted)
3. steps (array of {title, description, code_before?, code_after?, effort_minutes})
4. testing_notes (how to verify the migration)
5. deadline_info (deadline + days remaining)
6. total_effort_estimate (minutes)
7. risk_level ("low" | "medium" | "high")

Output as JSON.
```

**Code snippet generation:** For known providers (Stripe, Twilio, etc.), the prompt includes SDK-specific context. Code snippets are generated for Node.js by default; Python and Go are supported when the user specifies their language in `user_api_context`.

### 1.4 Data Model

```sql
CREATE TABLE migration_checklists (
    id              TEXT PRIMARY KEY,         -- mcl_ + nanoid(21)
    change_id       TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Cache key: same change + same endpoints = same checklist
    context_hash    TEXT NOT NULL,            -- SHA-256(change_id + sorted user endpoint paths)
    
    -- Generated content
    summary         TEXT NOT NULL,
    affected_endpoints JSONB NOT NULL DEFAULT '[]',
    steps           JSONB NOT NULL DEFAULT '[]',
    -- steps schema: [{title, description, code_before?, code_after?, effort_minutes, completed: bool}]
    testing_notes   TEXT,
    deadline        TIMESTAMPTZ,
    total_effort_minutes INT,
    risk_level      TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
    
    -- User progress
    completed_steps INT NOT NULL DEFAULT 0,
    total_steps     INT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'generated'
                    CHECK (status IN ('generating', 'generated', 'in_progress', 'completed', 'dismissed')),
    
    -- LLM metadata
    model_used      TEXT NOT NULL,
    prompt_tokens   INT,
    output_tokens   INT,
    cost_usd        DECIMAL(10,6),
    source_guide_url TEXT,                    -- URL of migration guide if one was found
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (change_id, user_id, context_hash)
);

CREATE INDEX idx_migration_checklists_user ON migration_checklists (user_id, status);
CREATE INDEX idx_migration_checklists_change ON migration_checklists (change_id);
```

**Caching strategy:** Checklists with the same `context_hash` (same change + same endpoint set) are shared. If User A and User B both monitor `/v1/charges`, they get the same cached checklist. The `user_id` column still exists for progress tracking (completed_steps) which is per-user.

### 1.5 API Endpoints

**REST:**
```
POST   /v1/changes/{change_id}/migration-checklist   -- Generate (or return cached)
GET    /v1/changes/{change_id}/migration-checklist   -- Retrieve
PATCH  /v1/migration-checklists/{id}                 -- Update step completion
DELETE /v1/migration-checklists/{id}                 -- Dismiss
GET    /v1/migration-checklists                      -- List all active checklists for user
```

**MCP:**
```
chirri_generate_migration_checklist(change_id)
chirri_get_migration_checklist(change_id)
chirri_list_migration_checklists(status?)
chirri_update_checklist_step(checklist_id, step_index, completed)
```

### 1.6 UI Location

- **Change Detail page:** New "Migration Checklist" section below the Impact Analysis section. Shows the checklist with interactive checkboxes.
- **Dashboard sidebar:** "X migrations in progress" counter with link to filtered list.
- **Notification email:** Summary included at the bottom of breaking change notifications with "View full checklist →" link.

### 1.7 Effort Estimate

| Task | Hours |
|------|-------|
| Data model + migration | 3 |
| LLM prompt engineering + testing | 12 |
| Background job (BullMQ queue) | 6 |
| REST API endpoints | 6 |
| MCP tool definitions | 3 |
| Frontend: checklist component | 10 |
| Frontend: progress tracking | 5 |
| Caching layer | 4 |
| Testing (10+ real migration guides) | 8 |
| **Total** | **~57 hours** |

### 1.8 Dependencies

- Core change detection pipeline (MVP)
- LLM integration service (from API Intelligence feature)
- Early warning system (for deadline extraction)
- `user_api_context` table (from API Intelligence — optional, degrades gracefully without it)

### 1.9 Risks/Gotchas

- **LLM hallucination:** May generate incorrect migration steps. Mitigation: always link to the original migration guide; add "AI-generated — verify steps" disclaimer. Show raw diff alongside.
- **Migration guide fetch failures:** Some guides are behind auth or paywalls. Fallback: generate from diff alone (lower quality but still useful).
- **Stale checklists:** If the API provider updates their migration guide, the cached checklist becomes stale. Mitigation: re-generate if the migration guide page changes (detected by Chirri's own monitoring).
- **Checklist completion tracking isn't verification:** A user marking "done" doesn't mean their code actually works. This is a TODO list, not a test suite.

---

## 2. Workflow Routing (Notification Rules)

### 2.1 How It Works (Architecture)

Users define rules that route specific types of changes to specific notification channels. This sits between Step 9 (Change Detection) and Step 10 (Notification Dispatch) in the checking pipeline.

**Evaluation flow:**

```
Change confirmed (Step 9)
  │
  ▼
Load user's notification rules (ordered by priority)
  │
  ▼
For each rule (first match wins, unless "continue" flag):
  │
  ├── Evaluate conditions against change facts
  │   (severity, provider, change_type, path pattern, tags, security_flag)
  │
  ├── MATCH → Apply actions (route to channel, set severity override, suppress)
  └── NO MATCH → Try next rule
  │
  ▼
No rules matched → Fall through to user's default notification_config
```

**Rule model (inspired by PagerDuty Event Orchestration):**

PagerDuty uses a cascading rule model: Global Rules → Service Rules → individual alert routing. Their rules have conditions (if event matches X) and actions (route to Y, set severity, suppress, etc.).

Chirri simplifies this to a flat ordered list with optional "continue processing" flag. No need for PagerDuty's complexity — Chirri has fewer event types and simpler routing needs.

### 2.2 Libraries/APIs Needed

| Library | Purpose | Notes |
|---------|---------|-------|
| **`json-rules-engine`** | Rule evaluation | 17kb gzipped, zero heavy deps, JSON-serializable rules. Perfect for storing rules in DB and evaluating in workers. |
| No new notification libraries | Existing notification dispatch handles Slack/Discord/email/webhooks | Already built in MVP |

**Why `json-rules-engine`:** Rules are stored as JSON in the database and evaluated at runtime. The library supports nested AND/OR conditions, custom operators, and is fast (<1ms per evaluation). Alternative: hand-rolled if/else — but `json-rules-engine` is battle-tested (5M+ weekly downloads) and saves 20+ hours of reinventing condition evaluation.

**Why NOT a full rules engine (Drools, etc.):** Overkill. Chirri needs "if severity = critical AND provider = stripe, then route to #payments-urgent". Not "evaluate 10,000 rules across 50 fact dimensions."

### 2.3 Data Model

```sql
CREATE TABLE notification_rules (
    id              TEXT PRIMARY KEY,         -- nrl_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    name            TEXT NOT NULL,            -- "Security changes to #security"
    description     TEXT,
    priority        INT NOT NULL DEFAULT 0,   -- Lower = evaluated first
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Conditions (json-rules-engine format)
    conditions      JSONB NOT NULL,
    -- Example: {"all": [
    --   {"fact": "severity", "operator": "in", "value": ["critical", "high"]},
    --   {"fact": "provider", "operator": "equal", "value": "stripe"}
    -- ]}
    
    -- Actions
    actions         JSONB NOT NULL,
    -- Example: {
    --   "channels": ["slack:#payments-urgent", "email"],
    --   "severity_override": null,
    --   "suppress": false,
    --   "add_tags": ["urgent"],
    --   "create_github_issue": false,
    --   "bypass_quiet_hours": true,
    --   "bypass_digest": true
    -- }
    
    continue_processing BOOLEAN NOT NULL DEFAULT FALSE,  -- If true, evaluate next rule too
    
    -- Stats
    times_matched   INT NOT NULL DEFAULT 0,
    last_matched_at TIMESTAMPTZ,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_rules_user ON notification_rules (user_id, enabled, priority);
```

**Available condition facts:**

| Fact | Type | Example |
|------|------|---------|
| `severity` | string | "critical", "high", "medium", "low" |
| `change_type` | string | "schema", "status_code", "header", "content", "deprecation" |
| `provider` | string | "stripe", "openai", "twilio" |
| `path_pattern` | string | "/v1/charges/*" (glob matching) |
| `tags` | string[] | ["payment", "auth"] |
| `security_flag` | boolean | true/false |
| `has_deadline` | boolean | true/false |
| `days_until_deadline` | number | 30 |
| `source_type` | string | "api", "changelog", "status_page", "sdk" |

### 2.4 Preset Templates

Ship with 5 ready-made rule templates users can one-click install:

1. **"Breaking changes → immediate"** — severity in [critical, high] → bypass digest, bypass quiet hours, all channels
2. **"Security changes → #security"** — security_flag = true → route to security Slack/Discord channel
3. **"Deprecations → weekly digest"** — change_type = deprecation → digest mode, no push
4. **"Status page → email only"** — source_type = status_page → email channel only
5. **"Low severity → suppress"** — severity = low → suppress notifications (dashboard only)

### 2.5 API Endpoints

**REST:**
```
GET    /v1/notification-rules                 -- List rules (ordered by priority)
POST   /v1/notification-rules                 -- Create rule
PUT    /v1/notification-rules/{id}            -- Update rule
DELETE /v1/notification-rules/{id}            -- Delete rule
POST   /v1/notification-rules/reorder         -- Reorder priorities
POST   /v1/notification-rules/test            -- Dry-run: "what would happen to this change?"
GET    /v1/notification-rules/templates        -- List preset templates
POST   /v1/notification-rules/from-template    -- Install a preset template
```

**MCP:**
```
chirri_list_notification_rules()
chirri_create_notification_rule(name, conditions, actions)
chirri_test_notification_rule(rule_id, change_id)  -- dry-run
```

### 2.6 UI Location

- **Settings → Notification Rules:** Full rule management page. Form-based UI (not drag-and-drop — too complex for V1.1). Each rule is a card with conditions (dropdowns/selects) and actions (channel checkboxes).
- **Preset templates** shown as a "Quick Setup" section at the top of the page.
- **Rule test:** "Test this rule" button that shows which of your recent changes would have matched.

### 2.7 Effort Estimate

| Task | Hours |
|------|-------|
| Data model + migration | 2 |
| `json-rules-engine` integration + custom operators (glob, etc.) | 8 |
| Rule evaluation in notification dispatch pipeline | 6 |
| REST API endpoints | 6 |
| MCP tool definitions | 2 |
| Frontend: rule builder form | 14 |
| Frontend: preset templates UI | 4 |
| Frontend: test/dry-run UI | 4 |
| Testing (edge cases: overlapping rules, empty rules) | 6 |
| **Total** | **~52 hours** |

### 2.8 Dependencies

- Core notification system (MVP)
- Notification channels (Slack, Discord, email, webhooks — MVP)

### 2.9 Risks/Gotchas

- **Rule conflicts:** Two rules matching the same change with contradictory actions (one says "suppress", one says "send"). Mitigation: first-match-wins by default. `continue_processing` flag for explicit fan-out.
- **Performance:** Loading and evaluating rules on every change. Mitigation: rules are small, cached in Redis per user (invalidate on rule update). `json-rules-engine` evaluates in <1ms.
- **Complexity creep:** Users may create overly complex rules. Mitigation: limit to 25 rules per user. Preset templates handle 80% of cases.
- **Integration with existing notification_config:** Rules OVERRIDE the per-URL `notification_config` when they match. If no rule matches, fall through to existing config. Document clearly.

---

## 3. SDK/Package Version Intelligence

### 3.1 How It Works (Architecture)

Chirri monitors npm/PyPI/RubyGems package registries for SDK version changes and cross-references them with the user's monitored API endpoints.

**Data flow:**

```
User monitors api.stripe.com/v1/charges
  │
  ▼
Provider profile for Stripe includes: primary_sdk = "stripe" (npm)
  │
  ▼
Scheduler enqueues package check job (every 6 hours for primary SDKs)
  │
  ▼
Worker fetches: https://registry.npmjs.org/stripe
  │
  ▼
Compare latest version against stored last_known_version
  │
  ├── No change → skip
  ├── Patch bump → log only (dashboard, no notification)
  ├── Minor bump → check changelog for relevant changes
  └── Major bump → ALWAYS notify, generate impact analysis
  │
  ▼
For major/minor: fetch CHANGELOG.md from GitHub repo
  │
  ▼
LLM cross-references changelog with user's monitored endpoints
  │
  ▼
Generate personalized "what this SDK update means for YOU"
```

**API-to-SDK mapping:** Maintained in the provider profiles (same YAML files used for dependency detection). MVP maps the top 20 providers to their primary SDKs. User can also manually add packages.

### 3.2 Libraries/APIs Needed

| Library/API | Purpose | Notes |
|-------------|---------|-------|
| **npm Registry API** | `GET https://registry.npmjs.org/{package}` | Returns all versions + metadata. Use abbreviated metadata header: `Accept: application/vnd.npm.install-v1+json` for smaller responses |
| **PyPI JSON API** | `GET https://pypi.org/pypi/{package}/json` | Returns all versions. Large responses (~300KB for Django). Use `GET https://pypi.org/pypi/{package}/{version}/json` for specific version |
| **RubyGems API** | `GET https://rubygems.org/api/v1/versions/{gem}.json` | Returns version list |
| **deps.dev API** | `GET https://api.deps.dev/v3/systems/{system}/packages/{package}` | Google's free API. Returns versions, dependencies, advisories, security scorecards. Covers npm, PyPI, Go, Maven, Cargo, NuGet. CC-BY 4.0 license. **Use this as primary enrichment source.** |
| **GitHub API** | Fetch CHANGELOG.md, release notes | Use existing GitHub integration |
| `semver` (npm package) | Parse and compare semantic versions | Already common in Node.js projects |

**Key insight from deps.dev:** Google's deps.dev API is free, comprehensive, and covers all major package registries. It provides:
- Version history with timestamps
- Dependency graphs (transitive)
- Security advisories per version
- OpenSSF Scorecard data
- License information

Use deps.dev as the **primary** source, with direct registry APIs as fallback.

### 3.3 Data Model

```sql
CREATE TABLE monitored_packages (
    id              TEXT PRIMARY KEY,         -- pkg_ + nanoid(21)
    user_id         TEXT REFERENCES users(id) ON DELETE CASCADE,  -- NULL = system-level (shared)
    
    registry        TEXT NOT NULL CHECK (registry IN ('npm', 'pypi', 'rubygems', 'go', 'maven', 'nuget')),
    package_name    TEXT NOT NULL,            -- "stripe", "django", "rails"
    
    -- Link to provider (if auto-detected from provider profile)
    provider_slug   TEXT,                     -- "stripe", "twilio" -- links to provider profiles
    
    -- Link to user's URL (if manually associated)
    url_id          TEXT REFERENCES urls(id) ON DELETE SET NULL,
    
    -- State
    last_known_version TEXT,
    latest_version  TEXT,
    last_checked_at TIMESTAMPTZ,
    check_interval  TEXT NOT NULL DEFAULT '6h',
    
    -- Source detection
    source          TEXT NOT NULL DEFAULT 'provider_profile'
                    CHECK (source IN ('provider_profile', 'user_manual', 'package_json_scan')),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (user_id, registry, package_name)
);

CREATE TABLE package_versions (
    id              TEXT PRIMARY KEY,         -- pkv_ + nanoid(21)
    package_id      TEXT NOT NULL REFERENCES monitored_packages(id) ON DELETE CASCADE,
    
    version         TEXT NOT NULL,
    version_major   INT,
    version_minor   INT,
    version_patch   INT,
    is_prerelease   BOOLEAN NOT NULL DEFAULT FALSE,
    
    published_at    TIMESTAMPTZ,
    changelog_url   TEXT,
    changelog_content TEXT,                   -- Fetched and stored
    
    -- Analysis
    breaking_changes JSONB,                   -- Extracted from changelog
    deprecations    JSONB,
    security_advisories JSONB,                -- From deps.dev
    
    -- LLM analysis (cross-referenced with user endpoints)
    impact_analysis TEXT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_package_versions_package ON package_versions (package_id, published_at DESC);
CREATE INDEX idx_monitored_packages_user ON monitored_packages (user_id);
CREATE INDEX idx_monitored_packages_provider ON monitored_packages (provider_slug);
```

**Shared monitoring:** Like URL monitoring, package checks are deduplicated. If 100 users monitor the `stripe` npm package, one check serves all. Package checks use the same `shared_urls` pattern — a `shared_packages` table could work, but for MVP, just use a single system-level `monitored_packages` row (user_id = NULL) per package.

### 3.4 API-to-SDK Mapping

Stored in provider profile YAML files (already exist for fingerprint detection):

```yaml
# providers/stripe.yaml
api: stripe
sdks:
  - registry: npm
    package: stripe
    primary: true
  - registry: pypi
    package: stripe
    primary: false
  - registry: rubygems
    package: stripe
    primary: false
  - registry: go
    package: github.com/stripe/stripe-go
    primary: false
```

**For APIs without known SDK mapping:** User can manually link a package via Settings. Or, deps.dev's dependency graph can help: if a user's `package.json` references `stripe`, and they monitor `api.stripe.com`, the connection is obvious.

### 3.5 API Endpoints

**REST:**
```
GET    /v1/packages                           -- List monitored packages
POST   /v1/packages                           -- Add package to monitor
DELETE /v1/packages/{id}                      -- Remove
GET    /v1/packages/{id}/versions             -- Version history
GET    /v1/packages/{id}/versions/{version}   -- Version detail with analysis
POST   /v1/packages/scan                       -- Upload package.json for auto-detection
```

**MCP:**
```
chirri_list_packages()
chirri_add_package(registry, package_name, url_id?)
chirri_get_package_versions(package_id, limit?)
chirri_scan_package_json(content)             -- Parse and auto-add packages
```

### 3.6 UI Location

- **Provider detail page:** "SDK Versions" tab showing version timeline with breaking change markers.
- **Dashboard:** "SDK Updates" section showing recent version bumps across all monitored packages.
- **Settings → Packages:** Manage monitored packages, upload `package.json`.

### 3.7 Effort Estimate

| Task | Hours |
|------|-------|
| Data model + migration | 4 |
| Registry API integration (npm, PyPI, RubyGems) | 10 |
| deps.dev API integration | 6 |
| Version comparison + semver logic | 4 |
| Changelog fetching + parsing | 8 |
| LLM cross-reference with user endpoints | 8 |
| BullMQ job for periodic checks | 4 |
| REST API endpoints | 6 |
| MCP tool definitions | 3 |
| Frontend: packages UI | 10 |
| package.json scan feature | 4 |
| Testing | 6 |
| **Total** | **~73 hours** |

### 3.8 Dependencies

- Provider profiles with SDK mappings (extend existing provider YAML)
- LLM integration service (from API Intelligence)
- `user_api_context` for personalized cross-referencing (optional)

### 3.9 Risks/Gotchas

- **Changelog format inconsistency:** npm packages have no standardized changelog format. Some use CHANGELOG.md, some use GitHub releases, some use neither. Mitigation: try GitHub Releases API first, then CHANGELOG.md in repo, then fall back to deps.dev advisory data.
- **Package → API mapping is imperfect:** `@aws-sdk/client-s3` maps to AWS S3, but `axios` doesn't map to any specific API. Only map known SDK packages, not generic utility libraries.
- **npm Registry API rate limits:** Unauthenticated: variable, roughly ~100 req/min. Authenticated (with token): higher. Use deps.dev as primary to reduce npm API load.
- **Large responses:** `GET https://registry.npmjs.org/stripe` returns ~500KB. Use abbreviated metadata endpoint for version checks, full endpoint only for changelog info.
- **Version notification fatigue:** Stripe publishes minor SDK versions frequently. Only notify on major versions by default; let users configure threshold.

---

## 4. "What Breaks If..." Impact Simulator

### 4.1 How It Works (Architecture)

Users ask: "What happens if I upgrade from Stripe API version X to Y?" Chirri compares the two API versions and generates a personalized impact report.

**Three approaches depending on data availability:**

```
Approach 1: OpenAPI Spec Diff (best quality)
  Provider has OpenAPI specs for both versions
  → Fetch both specs → Run structural diff → LLM summarizes

Approach 2: Changelog Analysis (good quality)
  Provider has detailed changelog
  → Collect all changelog entries between version X and Y
  → LLM analyzes cumulative changes

Approach 3: Snapshot Diff (decent quality)
  Chirri has historical snapshots of the API docs/spec
  → Compare snapshots closest to each version date
  → LLM analyzes diff
```

**Input sources for version-specific specs:**

| Provider | Source | Quality |
|----------|--------|---------|
| Stripe | GitHub: `stripe/openapi` repo, tagged by version | Excellent — full OpenAPI spec per version |
| Twilio | GitHub: `twilio/twilio-oai` repo | Good |
| GitHub | Official OpenAPI spec (`github/rest-api-description`) | Excellent |
| OpenAI | API reference page diffs (no versioned OpenAPI) | Medium |
| Most others | Chirri's own historical snapshots | Variable |

**For APIs without version-specific specs:** Fall back to Chirri's historical snapshots. The check_results table stores body_r2_key for every check — we can retrieve historical responses and diff them. Combine with changelog entries between the two dates.

### 4.2 Libraries/APIs Needed

| Library/API | Purpose | Notes |
|-------------|---------|-------|
| **oasdiff** (Go CLI) | OpenAPI spec structural diff with 300+ breaking change rules | Can't embed as a Go library in Node.js. **Use as a CLI subprocess** via `child_process.execFile()`. Install binary in Docker image. |
| **openapi-diff** (npm) | TypeScript alternative to oasdiff | Fewer rules than oasdiff (~50 vs 300+). Use as fallback if oasdiff binary unavailable. |
| **LLM** | Summarize diff, generate impact report | Same service as migration checklists |
| `yaml` / `js-yaml` | Parse OpenAPI specs | Already available |

**oasdiff integration strategy:** oasdiff is the gold standard (300+ breaking change rules, Go binary). Since Chirri runs on Node.js:

1. **Install oasdiff binary** in the Docker image (`RUN curl -sSfL ... | sh`)
2. **Call via `child_process.execFile`** with JSON output format
3. **Parse JSON output** in Node.js
4. **Timeout:** 30 seconds max per diff operation (large specs can be slow)

```typescript
import { execFile } from 'child_process';

async function runOasdiff(baseSpec: string, revisionSpec: string): Promise<OasdiffResult> {
  const result = await execFilePromise('oasdiff', [
    'breaking',
    '--format', 'json',
    '--base', baseSpec,     // path to temp file
    '--revision', revisionSpec
  ], { timeout: 30000 });
  return JSON.parse(result.stdout);
}
```

### 4.3 Data Model

```sql
CREATE TABLE simulations (
    id              TEXT PRIMARY KEY,         -- sim_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    provider_slug   TEXT NOT NULL,
    from_version    TEXT NOT NULL,            -- "2023-10-16" or "v17"
    to_version      TEXT NOT NULL,            -- "2024-12-18" or "v18"
    
    -- Analysis method
    method          TEXT NOT NULL CHECK (method IN ('openapi_diff', 'changelog_analysis', 'snapshot_diff')),
    
    -- Results
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    breaking_changes JSONB,                   -- [{endpoint, field, description, severity}]
    warnings        JSONB,
    safe_endpoints  JSONB,                    -- User's endpoints that are unaffected
    
    summary         TEXT,                     -- LLM-generated natural language summary
    risk_score      INT,                      -- 0-10
    estimated_effort_hours DECIMAL(5,1),
    
    -- Personalization
    user_endpoints  JSONB,                    -- Snapshot of user's monitored paths at simulation time
    
    -- Source data
    base_spec_r2_key TEXT,                    -- R2 key for base spec (if OpenAPI)
    revision_spec_r2_key TEXT,
    oasdiff_output  JSONB,                    -- Raw oasdiff JSON output
    
    -- LLM metadata
    model_used      TEXT,
    cost_usd        DECIMAL(10,6),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_simulations_user ON simulations (user_id, created_at DESC);
CREATE INDEX idx_simulations_provider ON simulations (provider_slug, from_version, to_version);
```

**Caching:** Same provider + from_version + to_version = same base analysis. Personalization (filtering to user's endpoints) is cheap and can be layered on top.

### 4.4 API Endpoints

**REST:**
```
POST   /v1/simulations                        -- Create simulation
GET    /v1/simulations/{id}                    -- Get result
GET    /v1/simulations                         -- List user's simulations
GET    /v1/providers/{slug}/versions           -- List available versions for a provider
```

**MCP:**
```
chirri_simulate_upgrade(provider, from_version, to_version)
chirri_get_simulation(simulation_id)
chirri_list_provider_versions(provider_slug)
```

### 4.5 UI Location

- **Provider detail page:** "Simulate Upgrade" button. Shows a dropdown with available versions.
- **Change Detail page:** When a new API version is detected, "What breaks if I upgrade?" button.
- **Dedicated page:** `/simulate` — pick provider, from/to version, see results.

### 4.6 Effort Estimate

| Task | Hours |
|------|-------|
| Data model + migration | 3 |
| oasdiff binary integration + wrapper | 8 |
| Version-specific spec fetching (GitHub repos) | 10 |
| Changelog aggregation between versions | 6 |
| Snapshot diff (from R2 historical data) | 8 |
| LLM summarization + personalization | 8 |
| REST API endpoints | 6 |
| MCP tool definitions | 3 |
| Frontend: simulation UI | 12 |
| Frontend: results display | 8 |
| Provider version catalog | 6 |
| Testing | 8 |
| **Total** | **~86 hours** |

### 4.7 Dependencies

- OpenAPI spec monitoring (from MVP bonus sources)
- Historical snapshots in R2 (from MVP check pipeline)
- LLM integration service
- Provider profiles with version catalog URLs
- oasdiff binary in Docker image

### 4.8 Risks/Gotchas

- **Version discovery is hard:** Not all providers publish versioned OpenAPI specs. Stripe is the gold standard; most providers are worse. Mitigation: gracefully degrade from OpenAPI diff → changelog analysis → snapshot diff.
- **oasdiff as subprocess:** Adds a Go binary to the Node.js Docker image (~20MB). Acceptable. Alternative: port key oasdiff rules to TypeScript (huge effort, not worth it).
- **User's current version detection:** We often don't know which API version the user is on. Options: (a) user tells us in settings, (b) detect from `Stripe-Version` header in their API responses (if they're proxying through us — they're not), (c) infer from their SDK version. Simplest: **user selects from dropdown**.
- **Spec fetch failures:** External repos may be down. Cache fetched specs in R2.
- **Large specs:** Stripe's OpenAPI spec is 1.5MB+. oasdiff handles this fine (it's Go), but transferring to/from subprocess needs temp files, not stdin.

---

## 5. Security & Compliance Change Flagging

### 5.1 How It Works (Architecture)

A **classification layer** that runs on top of the existing diff engine. Every detected change passes through a security analyzer that checks for security-relevant patterns and flags them.

**This is NOT a separate system.** It's a post-processor in Step 8 (Change Detection):

```
Step 8: Change Detection
  │
  ▼
  jsondiffpatch.diff(baseline, new)
  │
  ▼
  Classify: schema/status_code/header/content/redirect
  │
  ▼
  ★ NEW: Security Analyzer ★
  │
  ├── Pattern matching on headers (TLS, auth, CORS, security headers)
  ├── Pattern matching on response body (OAuth scopes, auth fields)
  ├── Keyword matching on changelog content (security, auth, encryption)
  │
  ▼
  If security-relevant:
    - Add security_flags to change record
    - Boost severity (medium → high, low → medium)
    - Flag for bypass_quiet_hours
  │
  ▼
  Proceed to Step 9 (Confirmation Recheck)
```

### 5.2 Security Change Categories

All detectable from HTTP response headers and body changes:

| Category | Detection Method | From Headers? | Severity Boost |
|----------|-----------------|---------------|----------------|
| **TLS version change** | `Strict-Transport-Security` max-age change, TLS version in response | Yes | +1 level |
| **Auth method change** | `WWW-Authenticate` header changes, new auth-related fields in body | Yes | +1 level |
| **OAuth scope change** | Body field changes mentioning scope/permission | Partial | +1 level |
| **CORS policy change** | `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` changes | Yes | +1 level if more restrictive |
| **Rate limit change** | `X-RateLimit-*`, `Retry-After` header changes | Yes | No boost (informational) |
| **Security header removal** | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy removed | Yes | +1 level |
| **Certificate change** | Detected via TLS handshake info (if tracked) | Separate | +1 level if unexpected |
| **Deprecation of secure endpoint** | Secure endpoint deprecated, replacement is less secure | Body/changelog | +2 levels |
| **Data format change on sensitive fields** | Type change on fields containing "password", "token", "key", "secret", "ssn", "credit_card" | Body | +1 level |
| **API key format change** | Key prefix/format changes (e.g., Stripe `sk_test_` → new format) | Body | +1 level |

### 5.3 Implementation: Pattern Matching

```typescript
interface SecurityAnalyzerResult {
  is_security_relevant: boolean;
  security_flags: SecurityFlag[];
  severity_boost: number;  // 0, 1, or 2 levels
  bypass_quiet_hours: boolean;
  compliance_tags: string[];  // ["PCI-DSS", "SOC2", "GDPR"]
}

interface SecurityFlag {
  category: string;  // "tls", "auth", "cors", "rate_limit", "security_header", "sensitive_field"
  description: string;
  severity: "info" | "warning" | "critical";
  header_or_field: string;
  old_value?: string;
  new_value?: string;
}

// Header patterns to watch
const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'x-xss-protection',
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'www-authenticate',
];

// Sensitive field name patterns
const SENSITIVE_FIELD_PATTERNS = [
  /password/i, /token/i, /secret/i, /key/i, /auth/i,
  /credit.?card/i, /ssn/i, /social.?security/i,
  /account.?number/i, /routing.?number/i, /cvv/i, /cvc/i,
  /pin/i, /otp/i, /mfa/i, /2fa/i,
];
```

**No LLM needed for MVP.** Pure pattern matching on headers + field names. LLM-based compliance classification (mapping changes to PCI-DSS/SOC2/GDPR requirements) is V2.

### 5.4 Data Model Changes

No new table needed. Add columns to `changes` table:

```sql
ALTER TABLE changes ADD COLUMN security_flags JSONB DEFAULT NULL;
-- Schema: [{category, description, severity, header_or_field, old_value, new_value}]

ALTER TABLE changes ADD COLUMN security_severity_boost INT DEFAULT 0;

ALTER TABLE changes ADD COLUMN compliance_tags TEXT[] DEFAULT '{}';
-- e.g., {"PCI-DSS", "SOC2"}

ALTER TABLE changes ADD COLUMN bypass_quiet_hours BOOLEAN DEFAULT FALSE;
```

**Why not a separate table?** Security flags are metadata on the change, not a separate entity. They're always read alongside the change record. JSONB column is sufficient and avoids a join.

### 5.5 API Endpoints

**REST:**
```
GET /v1/changes?security_flag=true            -- Filter changes by security relevance
GET /v1/changes/{id}                          -- Already returns security_flags in response
```

No new endpoints needed. Security data is returned as part of the existing change response.

**MCP:**
```
chirri_list_changes(security_only: true)      -- Filter parameter on existing tool
```

### 5.6 Notification Behavior

- **Security-flagged changes always bypass quiet hours** (configurable via notification rules).
- **Security-flagged changes get a "SECURITY" badge** in notifications (email subject prefix, Slack emoji, Discord embed color).
- **Severity boost** applies BEFORE notification rule evaluation, so a "medium" change boosted to "high" will trigger high-severity rules.

### 5.7 UI Location

- **Change Detail page:** "Security" badge next to severity badge. Expandable section showing security flags.
- **Dashboard:** Security-flagged changes have a distinct icon/color (red shield).
- **Filters:** "Security changes only" toggle in the changes list.

### 5.8 Effort Estimate

| Task | Hours |
|------|-------|
| Security analyzer module (pattern matching) | 8 |
| Header analysis patterns | 4 |
| Sensitive field detection | 3 |
| Changes table migration (new columns) | 2 |
| Integration into check pipeline (Step 8) | 4 |
| Notification bypass logic | 3 |
| Frontend: security badges + section | 4 |
| Frontend: security filter | 2 |
| Testing (real-world header changes) | 4 |
| **Total** | **~34 hours** |

### 5.9 Dependencies

- Core change detection pipeline (MVP)
- Header tracking (already in MVP — headerHash comparison)

### 5.10 Risks/Gotchas

- **False positives:** `X-RateLimit-Remaining` changes on every request — this is volatile, not a security change. Mitigation: rate limit headers are checked against the BASELINE rate limit, not per-request values. Only alert if the limit itself changes (e.g., 1000 → 500), not the remaining count.
- **CORS changes may be intentional:** A more restrictive CORS policy could be a security improvement, not a threat. Mitigation: flag as "info" severity, let the user assess.
- **Compliance tag accuracy:** Automatically tagging changes as "PCI-DSS relevant" has legal implications. Mitigation: disclaimer: "Chirri detects potential compliance-relevant changes. This is not a compliance audit. Consult your compliance team."
- **Limited to observable signals:** Chirri can only see what's in HTTP headers and response bodies. Internal auth changes, server-side encryption changes, etc., are invisible. This is expected — it's a monitoring tool, not a security scanner.

---

## 6. GitHub Issue Auto-Creation

### 6.1 How It Works (Architecture)

Users connect their GitHub account, configure a default repo, and Chirri can create rich, contextual issues from detected changes.

**Auth flow:**

```
User clicks "Connect GitHub" in Settings
  │
  ▼
GitHub OAuth flow (GitHub App preferred over OAuth App)
  │
  ▼
User installs Chirri GitHub App on their repo(s)
  │
  ▼
Chirri stores installation_id + access token
  │
  ▼
User configures default repo in Settings
  │
  ▼
On change: "Create Issue" button OR automatic (via notification rules)
```

**GitHub App vs OAuth App:**

| Factor | GitHub App | OAuth App |
|--------|-----------|-----------|
| **Permissions** | Fine-grained (per-repo) | Broad (all repos user has access to) |
| **Rate limits** | 5,000 req/hr per installation | 5,000 req/hr per user |
| **Token refresh** | Installation tokens (1hr), auto-refreshed | User token doesn't expire |
| **User experience** | "Install app" flow — familiar to developers | "Authorize" flow |
| **Acting as** | Bot account (issues show as "chirri-bot") | User account (issues show as the user) |

**Recommendation: GitHub App.** Better permission model, better UX, and issues created as "chirri-bot" are clearly automated (not confusing "why did I create this issue?"). GitHub's own documentation recommends Apps over OAuth Apps for new integrations.

### 6.2 Libraries/APIs Needed

| Library | Purpose | Notes |
|---------|---------|-------|
| **`@octokit/app`** | GitHub App SDK — handles JWT, installation tokens, API calls | Official SDK from GitHub |
| **`@octokit/rest`** | REST API client | Used by `@octokit/app` internally |
| **`@octokit/webhooks`** | Handle GitHub webhooks (optional, for future features like PR tracking) | Not needed for MVP issue creation |

### 6.3 Issue Template

```markdown
## {change_emoji} {change_summary}

**Provider:** {provider_name}
**Detected:** {detected_date}
**Severity:** {severity_badge}
{deadline ? "**Deadline:** " + deadline + " (" + days_remaining + " days)" : ""}

---

### What Changed
{diff_summary}

### Impact on Your Integration
{impact_analysis or "Run impact analysis on Chirri for details."}

### Migration Steps
{migration_checklist or "No migration checklist available yet."}

### References
- [View on Chirri]({change_url})
- [Provider Changelog]({changelog_url})
{migration_guide_url ? "- [Migration Guide](" + migration_guide_url + ")" : ""}

---
*Created by [Chirri](https://chirri.io) — API change detection*
```

### 6.4 Data Model

```sql
CREATE TABLE github_connections (
    id              TEXT PRIMARY KEY,         -- ghc_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- GitHub App installation
    installation_id BIGINT NOT NULL,
    account_login   TEXT NOT NULL,            -- GitHub username or org
    account_type    TEXT NOT NULL CHECK (account_type IN ('user', 'organization')),
    
    -- Default settings
    default_repo    TEXT,                     -- "owner/repo"
    default_labels  TEXT[] DEFAULT '{}',      -- ["api-change", "chirri"]
    auto_assign     TEXT,                     -- GitHub username to auto-assign
    
    -- Token management (installation tokens are short-lived, refreshed on demand)
    -- No long-lived tokens stored — tokens generated from App JWT + installation_id
    
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'revoked')),
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (user_id, installation_id)
);

CREATE TABLE github_issues (
    id              TEXT PRIMARY KEY,         -- ghi_ + nanoid(21)
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    connection_id   TEXT NOT NULL REFERENCES github_connections(id) ON DELETE CASCADE,
    change_id       TEXT NOT NULL REFERENCES changes(id) ON DELETE CASCADE,
    
    repo            TEXT NOT NULL,            -- "owner/repo"
    issue_number    INT NOT NULL,
    issue_url       TEXT NOT NULL,
    
    labels          TEXT[] DEFAULT '{}',
    assignee        TEXT,
    
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE (change_id, repo)                  -- One issue per change per repo
);

CREATE INDEX idx_github_issues_user ON github_issues (user_id, created_at DESC);
CREATE INDEX idx_github_issues_change ON github_issues (change_id);
```

**No long-lived access tokens stored.** GitHub App installation tokens are generated on demand from the App's private key + installation_id. They expire after 1 hour. This is more secure than storing OAuth tokens.

### 6.5 API Endpoints

**REST:**
```
GET    /v1/integrations/github                -- List GitHub connections
POST   /v1/integrations/github/install        -- Initiate GitHub App installation
DELETE /v1/integrations/github/{id}           -- Disconnect
PATCH  /v1/integrations/github/{id}           -- Update default repo/labels
GET    /v1/integrations/github/repos          -- List accessible repos
POST   /v1/changes/{change_id}/github-issue   -- Create issue for a change
GET    /v1/github-issues                      -- List created issues
```

**MCP:**
```
chirri_create_github_issue(change_id, repo?, labels?, assignee?)
chirri_list_github_issues(change_id?)
```

### 6.6 Auto-Created Labels

Chirri creates labels on the repo if they don't exist:

| Label | Color | Applied When |
|-------|-------|-------------|
| `chirri` | #FFB7C5 (sakura pink) | Always |
| `api-change` | #1D76DB | Always |
| `breaking-change` | #B60205 | severity = critical |
| `deprecation` | #FBCA04 | change_type = deprecation |
| `security` | #D93F0B | security_flags present |
| `migration` | #0E8A16 | migration checklist attached |

### 6.7 GitLab/Bitbucket Support (V1.1+)

The issue creation logic should be abstracted behind an interface:

```typescript
interface IssueTracker {
  createIssue(params: CreateIssueParams): Promise<CreatedIssue>;
  listRepos(): Promise<Repo[]>;
  getConnection(): Promise<Connection>;
}

// Implementations:
class GitHubIssueTracker implements IssueTracker { ... }
class GitLabIssueTracker implements IssueTracker { ... }  // V1.1
class BitbucketIssueTracker implements IssueTracker { ... }  // V1.1
```

### 6.8 UI Location

- **Change Detail page:** "Create GitHub Issue" button in the action bar (next to Track/Ignore/Snooze).
- **Settings → Integrations:** GitHub connection management, default repo selection.
- **Notification rules:** "Create GitHub Issue" as an action option.

### 6.9 Effort Estimate

| Task | Hours |
|------|-------|
| GitHub App registration + configuration | 2 |
| OAuth/installation flow backend | 8 |
| Token management (JWT generation, installation tokens) | 4 |
| Issue creation API | 6 |
| Issue template rendering | 4 |
| Label management | 2 |
| Data model + migration | 3 |
| REST API endpoints | 6 |
| MCP tool definitions | 2 |
| Frontend: GitHub connection UI | 6 |
| Frontend: "Create Issue" button + repo picker | 4 |
| Frontend: Settings page | 4 |
| Testing | 4 |
| **Total** | **~55 hours** |

### 6.10 Dependencies

- Core change detection (MVP)
- Migration checklists (Feature 1 — optional, enhances issue content)
- Impact analysis (from API Intelligence — optional, enhances issue content)

### 6.11 Risks/Gotchas

- **GitHub App approval:** If Chirri wants to be listed on the GitHub Marketplace, there's an approval process. For MVP, the app can be used without Marketplace listing.
- **Rate limits:** 5,000 req/hr per installation is generous. But bulk issue creation (e.g., 50 breaking changes at once) should be queued, not burst.
- **Repo permissions:** Users might connect GitHub but not grant access to the right repo. Clear error messaging needed.
- **Issue duplication:** Same change → multiple clicks → multiple issues. Prevented by `UNIQUE (change_id, repo)` constraint. "Create Issue" button changes to "View Issue" once created.
- **Token security:** App private key must be stored securely (environment variable, not DB). Installation tokens are short-lived (1hr) and never stored.
- **Issue staleness:** If a change is resolved but the GitHub issue is still open, they can drift. V2: webhook listener to sync issue state back to Chirri.

---

## 7. Dependency Graph Visualization

### 7.1 How It Works (Architecture)

An interactive visual map showing the user's monitored APIs, their dependencies, SDKs, and health status. Nodes represent entities; edges represent relationships.

**Data model for the graph:**

```
Node types:
  - "app"       → The user's application (center node)
  - "api"       → Monitored API endpoint (e.g., api.stripe.com/v1/charges)
  - "provider"  → API provider (e.g., Stripe)
  - "sdk"       → SDK package (e.g., stripe@18.0.0)
  - "upstream"  → Detected upstream dependency (e.g., Stripe depends on Plaid)

Edge types:
  - "monitors"   → User's app → API endpoint
  - "provides"   → Provider → API endpoint
  - "wraps"      → SDK → Provider
  - "depends_on" → Provider → upstream provider (from dependency detection)
```

**Graph data is computed from existing tables:**

```sql
-- Nodes: monitored URLs
SELECT url, parsed_domain, status FROM urls WHERE user_id = $user_id;

-- Nodes: providers
SELECT DISTINCT provider_slug FROM urls WHERE user_id = $user_id AND provider_slug IS NOT NULL;

-- Nodes: SDKs
SELECT * FROM monitored_packages WHERE user_id = $user_id;

-- Edges: dependencies
SELECT * FROM api_dependencies WHERE monitor_id IN (user's url ids);

-- Node health: recent changes
SELECT url_id, severity, created_at FROM user_changes 
WHERE user_id = $user_id AND created_at > now() - interval '30 days';
```

### 7.2 Libraries/APIs Needed

| Library | Purpose | Notes |
|---------|---------|-------|
| **React Flow** (`@xyflow/react`) | Interactive graph rendering | Best React integration. DOM-based nodes (not Canvas), so Chirri can render custom node components with health badges, sakura styling. 25K+ GitHub stars, actively maintained. MIT license. |
| **dagre** | Graph layout algorithm | Hierarchical layout with the user's app at the top. Works well with React Flow. |
| `elkjs` (alternative) | More advanced layout (optional) | Better for complex graphs, but heavier. Use dagre for MVP, consider elkjs if layout quality is insufficient. |

**Why React Flow over alternatives:**

| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| **React Flow** | Native React, DOM nodes (custom HTML), great DX, huge community | Not ideal for >1000 nodes | ✅ Best for Chirri (custom node styling, <100 nodes typically) |
| **Cytoscape.js** | Canvas-based, handles 10K+ nodes, great algorithms | Not React-native, custom rendering harder | Too heavy for Chirri's scale |
| **D3.js force layout** | Maximum flexibility, beautiful animations | Low-level, lots of code, React integration is manual | Too much effort for the result |
| **vis.js** | Good network graphs, decent React wrapper | Dated UX, less actively maintained | Not recommended |
| **Sigma.js** | WebGL, millions of nodes | Overkill, not React-native | Wrong tool |

React Flow is the clear winner: Chirri's graphs will have 5-50 nodes, and the ability to render custom React components as nodes (with sakura-styled health badges, change counts, etc.) is worth more than raw performance.

### 7.3 Data Model

No new tables needed. The graph is computed from existing data:

- `urls` → API endpoint nodes
- `monitored_packages` → SDK nodes
- `api_dependencies` → dependency edges
- `changes` → health status (color of nodes)
- Provider profiles → provider metadata nodes

**Computed graph endpoint returns:**

```typescript
interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  id: string;
  type: "app" | "api" | "provider" | "sdk" | "upstream";
  label: string;
  url?: string;
  status: "healthy" | "warning" | "breaking" | "unknown";
  change_count_30d: number;
  last_change_at?: string;
  metadata: Record<string, any>;
}

interface GraphEdge {
  source: string;
  target: string;
  type: "monitors" | "provides" | "wraps" | "depends_on";
  confidence?: number;
}
```

### 7.4 Node Styling

Following Chirri's brand (white + sakura pink, minimal):

| Status | Node Border | Background | Pulse Animation |
|--------|-------------|------------|-----------------|
| Healthy | #E5E7EB (gray-200) | white | None |
| Warning (deprecation) | #FBBF24 (amber-400) | #FFFBEB | Slow pulse |
| Breaking change | #EF4444 (red-500) | #FEF2F2 | Fast pulse |
| New change (< 24h) | #FFB7C5 (sakura) | #FFF0F3 | Sakura petal animation |
| Unknown/no data | #D1D5DB (gray-300) | #F9FAFB | None |

### 7.5 API Endpoints

**REST:**
```
GET /v1/dependency-graph                      -- Computed graph for current user
```

Single endpoint. The graph is assembled server-side from multiple tables and returned as a flat node/edge structure.

**MCP:**
```
chirri_get_dependency_graph()                 -- Returns same structure
```

### 7.6 UI Location

- **Dashboard:** "Dependency Map" tab (alongside the existing URL list and changes list).
- **Standalone page:** `/dependencies` — full-page interactive graph.
- **Click interactions:** Click a node → sidebar panel with details (recent changes, health timeline, linked issues). Click "View changes" → filtered changes list.

### 7.7 Effort Estimate

| Task | Hours |
|------|-------|
| Graph data assembly API endpoint | 6 |
| React Flow setup + configuration | 4 |
| Custom node components (5 types) | 10 |
| dagre layout integration | 4 |
| Node health status calculation | 4 |
| Click interaction (sidebar panel) | 8 |
| Animations (pulse, sakura petal) | 4 |
| Responsive design (mobile: simplified list view) | 4 |
| MCP tool | 2 |
| Testing | 4 |
| **Total** | **~50 hours** |

### 7.8 Dependencies

- Core monitoring with provider detection (MVP)
- API dependency detection (from CHIRRI_API_INTELLIGENCE.md)
- SDK/Package monitoring (Feature 3 — optional, adds SDK nodes)

### 7.9 Risks/Gotchas

- **Empty graph problem:** New users with 1-2 URLs see a sad, empty graph. Mitigation: show a compelling preview/demo graph on the empty state, with "Add more APIs to see your dependency map."
- **Layout quality:** dagre produces decent hierarchical layouts, but complex dependency chains may look messy. Mitigation: allow manual node positioning (React Flow supports drag), save positions in localStorage.
- **Performance with many nodes:** Users with 200 URLs could have 500+ nodes. React Flow handles this fine (DOM-based, but virtualizes off-screen nodes). Only a concern at 1000+.
- **Stale health status:** Nodes might show "healthy" when a recent change hasn't been processed yet. Health is computed from the `changes` table with a 30-day lookback — this is inherently slightly delayed.
- **Mobile experience:** Interactive graphs are painful on mobile. Fall back to a simplified list/tree view on screens <768px.
- **Real-time updates:** "Node pulses when a new change is detected" requires SSE or polling. Use the existing SSE endpoint (§6.11 in Bible). When a change is detected, push an SSE event with the node ID → React Flow animates the node.

---

## Cross-Feature Summary

### Priority Order (recommended build sequence)

| Order | Feature | Effort | Rationale |
|-------|---------|--------|-----------|
| 1 | **Security & Compliance Flagging** | 34h | Lowest effort, highest differentiation, enhances every other feature |
| 2 | **GitHub Issue Auto-Creation** | 55h | Enables workflow integration, moderate effort |
| 3 | **Workflow Routing** | 52h | Multiplies value of all notifications, including security flags |
| 4 | **Migration Checklists** | 57h | Flagship feature, biggest conversion driver |
| 5 | **SDK/Package Intelligence** | 73h | Cross-references with existing monitoring |
| 6 | **Dependency Graph** | 50h | Visual differentiation, marketing value |
| 7 | **Impact Simulator** | 86h | Most complex, needs OpenAPI diffing infrastructure |

**Total estimated effort: ~407 hours (~10 weeks for one full-time developer)**

### Shared Infrastructure

These features share common infrastructure:

1. **LLM integration service** — Used by features 1, 3, 4. Build once, reuse.
2. **Provider profiles** — Extended by features 1, 3, 4, 5. Already exists in MVP.
3. **Notification dispatch pipeline** — Extended by features 2, 5, 6. Already exists in MVP.
4. **Change detail page** — UI enhanced by features 1, 4, 5, 6. Already exists in MVP.

### New Dependencies to Add

| Package | Used By | Size |
|---------|---------|------|
| `json-rules-engine` | Feature 2 | 17kb gzip |
| `@octokit/app` | Feature 6 | ~50kb gzip |
| `@xyflow/react` | Feature 7 | ~150kb gzip |
| `dagre` | Feature 7 | ~25kb gzip |
| `semver` | Feature 3 | ~5kb gzip |
| `oasdiff` (binary) | Feature 4 | ~20MB binary |

### Database Migrations Summary

| Table | Feature | Type |
|-------|---------|------|
| `migration_checklists` | 1 | New table |
| `notification_rules` | 2 | New table |
| `monitored_packages` | 3 | New table |
| `package_versions` | 3 | New table |
| `simulations` | 4 | New table |
| `changes` (add columns) | 5 | Alter table |
| `github_connections` | 6 | New table |
| `github_issues` | 6 | New table |

---

*Research completed: 2026-03-24*
*Sources: CHIRRI_BIBLE v2.2, CHIRRI_API_INTELLIGENCE.md, CHIRRI_PRODUCT_OPPORTUNITIES.md, oasdiff docs, GitHub Apps docs, npm Registry API, deps.dev API, json-rules-engine docs, React Flow docs, PagerDuty Event Orchestration, Stripe migration guides*
