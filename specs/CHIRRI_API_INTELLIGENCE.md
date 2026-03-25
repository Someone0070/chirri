# Chirri API Intelligence: Dependency Detection & Integration Impact Analysis

> **Status:** Design Document (Draft)
> **Date:** 2026-03-24
> **Author:** Research subagent

---

## 1. Feature Overview

Chirri already monitors web pages and API docs for changes. This feature upgrades that from "something changed" to **"here's what it means for YOU."**

Two capabilities, working together:

### Part 1: API Dependency Chain Detection
When a user monitors `api.mycompany.com/v1/payments`, Chirri automatically:
- Detects that the API wraps Stripe (via headers, error patterns, doc references)
- Auto-subscribes to Stripe's changelog/status page
- When Stripe changes something, alerts the user: "Your dependency changed"
- Shows the chain: `Stripe deprecated charges.source → your API uses Stripe → may affect /payments`

### Part 2: Integration Impact Analysis (LLM-powered)
When any monitored API's docs/contract change:
- Analyzes what the contract was BEFORE vs NOW
- Generates: what changed, how your integration breaks, what to do, sample code diff
- Personalized to the specific endpoints the user monitors

**Why this matters:** No other tool combines *external change monitoring* with *personalized impact analysis*. Existing tools (Optic, oasdiff, Bump.sh) work inside a team's CI pipeline on their own specs. Chirri watches *other people's APIs* and tells you when they break *your* code. That's a fundamentally different — and underserved — use case.

---

## 2. Research Findings: How Others Do It

### 2.1 OpenAPI Diff Tools (Spec-to-Spec Comparison)

| Tool | Approach | Strengths | Limitations |
|------|----------|-----------|-------------|
| **Optic** | CI-integrated OpenAPI linter + differ. Runs on PR, compares spec versions, detects breaking changes + governance rules. | Deep OpenAPI understanding, customizable rules, CI integration | Requires access to both spec versions; designed for API *producers*, not *consumers* |
| **oasdiff** | Open-source Go library/CLI. 300+ breaking change rules across 12 categories (endpoints, params, request body, response body, status codes, schemas, security, headers, etc.) | Most comprehensive rule set; open source; embeddable as a library | Structured specs only (OpenAPI 3.x); no HTML doc understanding |
| **Bump.sh** | API documentation platform with built-in diff. Auto-generates changelogs, comments on PRs with change digest. Has `api-diff.io` free tool. | Beautiful diff visualization, auto-changelog, PR integration | SaaS product for API producers; no consumer-side monitoring |
| **apicontract.dev** | Breaking change management + remediation. Focuses on detection and resolution workflows. | Remediation guidance | Newer, less established |

**Key insight:** All existing tools assume you *own* the API spec and run diffs in CI. None monitor third-party APIs from the *consumer's* perspective. That's Chirri's gap.

### 2.2 API Traffic Monitoring

| Tool | Approach |
|------|----------|
| **Akita Software** (acquired by Postman, 2023) | Uses eBPF to passively watch API traffic, auto-discovers endpoints, builds API models from actual traffic. `apidump` → `apispec` → `apidiff` pipeline. |
| **Postman API Monitoring** | Scheduled collection runs that hit endpoints and validate responses against expected schemas. |

**Key insight from Akita:** Learning API schemas from *actual traffic* (not just docs) is powerful. Chirri could track response shapes over time to detect "contract drift" — when the API's actual behavior changes even if the docs don't.

### 2.3 Contract Testing

| Tool | Approach |
|------|----------|
| **Pact** | Consumer-driven contract testing. Consumer tests generate contracts; provider verifies against them. Catches breaking changes before deployment. |
| **Treblle** | API observability with specification-based drift testing. |

**Key insight from Pact:** The concept of *consumer-driven* contracts is exactly what Chirri should think about. When a user tells us "I use endpoints X, Y, Z with these fields," that's essentially a consumer contract. We can check changes against it.

### 2.4 LLM-Powered Code Migration

- **Google (2025 paper):** Uses LLMs at scale for internal code migrations. Context: before-code + migration rules → LLM generates migrated code. High success rate for pattern-based migrations.
- **Academic research (2025):** LLMs (GPT-4o-mini, Llama 3.1) tested on library migration tasks — comparing LLM output to developer-migrated code. Results: good for straightforward changes, struggles with complex semantic shifts.
- **GitHub Copilot / Cursor:** Handle API changes reactively — user pastes new docs + old code, AI suggests changes. No *proactive* monitoring.

**Key insight:** LLMs are good at "given this change, here's what to update" — but nobody is doing this *proactively* on monitored API changes. That's the killer combo.

---

## 3. Dependency Chain Detection

### 3.1 Detection Methods (ordered by reliability)

#### Tier 1: High Confidence (automated)

| Signal | Example | Accuracy |
|--------|---------|----------|
| **HTTP Response Headers** | `Server: cloudflare`, `X-Powered-By: Express`, `Via: kong/3.4`, `Stripe-Version: 2024-12-18` | ~90% for known APIs |
| **Error Response Patterns** | Stripe errors: `{"error": {"type": "card_error", "code": "..."}}` — distinctive JSON shape | ~85% for major APIs |
| **CORS Headers** | `Access-Control-Allow-Origin` pointing to known API domains | ~80% |
| **SSL/TLS Certificate** | Certificate issued to `*.stripe.com` on a custom domain (rare but definitive) | ~95% when present |
| **Known API Gateway Signatures** | AWS API Gateway: `x-amzn-requestid`, `x-amz-apigw-id`; Kong: `Via: kong`; Apigee: `X-Apigee-*` | ~90% |

#### Tier 2: Medium Confidence (requires doc analysis)

| Signal | Example | Accuracy |
|--------|---------|----------|
| **Documentation References** | "Built on Stripe", "Powered by Twilio", SDK import statements in code samples | ~80% |
| **OpenAPI Spec References** | `$ref` pointing to external schemas, `x-*` extensions referencing known APIs | ~85% |
| **SDK/Library Mentions** | npm package references (`stripe`, `@aws-sdk/*`), import statements | ~75% |
| **Terminology Patterns** | Stripe-specific terms like "PaymentIntent", "SetupIntent" in non-Stripe docs | ~70% |

#### Tier 3: Lower Confidence (heuristic)

| Signal | Example | Accuracy |
|--------|---------|----------|
| **URL Patterns in Docs** | Links to `dashboard.stripe.com`, `console.aws.amazon.com` | ~65% |
| **Error Code Overlap** | Error codes matching known API error taxonomies | ~60% |
| **Response Field Names** | Fields like `stripe_customer_id`, `twilio_sid` in responses | ~70% |

### 3.2 Fingerprint Database Design

Maintain a curated database of ~50-100 major APIs with fingerprint signatures:

```yaml
# Example: fingerprints/stripe.yaml
api: stripe
display_name: "Stripe"
changelog_url: "https://stripe.com/docs/changelog"
status_url: "https://status.stripe.com"
openapi_url: "https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json"

fingerprints:
  headers:
    - key: "Stripe-Version"
      confidence: 0.95
    - key: "Request-Id"
      pattern: "^req_[A-Za-z0-9]+"
      confidence: 0.85
  
  error_patterns:
    - json_path: "$.error.type"
      values: ["api_error", "card_error", "idempotency_error", "invalid_request_error"]
      confidence: 0.90
    - json_path: "$.error.request_log_url"
      pattern: "dashboard.stripe.com"
      confidence: 0.95
  
  doc_signals:
    - pattern: "PaymentIntent|SetupIntent|Stripe\\.js|stripe-node"
      confidence: 0.70
    - pattern: "pk_test_|sk_test_|pk_live_|sk_live_"
      confidence: 0.95
  
  response_fields:
    - pattern: "stripe_customer_id|stripe_subscription_id"
      confidence: 0.80
```

**Initial coverage target (MVP):** Top 20 APIs:
Stripe, Twilio, SendGrid, AWS (S3/Lambda/DynamoDB), Plaid, Shopify, GitHub, Slack, Firebase, Auth0, Okta, Braintree, Square, Mailchimp, HubSpot, Salesforce, Segment, Datadog, PagerDuty, Cloudflare

**Maintenance:** Community-contributed + automated validation. Run fingerprint checks against known API endpoints monthly.

### 3.3 Detection Flow

```
User adds: api.mycompany.com/v1/payments
                    │
                    ▼
        ┌─────────────────────┐
        │  Initial probe:     │
        │  HEAD/GET request   │
        │  Collect headers,   │
        │  error patterns     │
        └──────────┬──────────┘
                   │
                   ▼
        ┌─────────────────────┐
        │  Match against      │
        │  fingerprint DB     │
        │  Score: 0.0 - 1.0   │
        └──────────┬──────────┘
                   │
          ┌────────┴────────┐
          │                 │
    score ≥ 0.7       score < 0.7
          │                 │
          ▼                 ▼
    Auto-link         Ask user:
    dependency        "We think this
    + notify user     uses Stripe.
                      Confirm?"
```

### 3.4 Accuracy & False Positive Management

- **Threshold model:** Score ≥ 0.7 → auto-link (user can remove). Score 0.4-0.7 → suggest (user confirms). Score < 0.4 → ignore.
- **User feedback loop:** "Is this dependency correct?" → improves fingerprint DB over time.
- **Multiple signals compound:** Header match (0.6) + error pattern match (0.5) → combined score ~0.8.

---

## 4. Contract Understanding

### 4.1 Structured Specs (Best Case)

**OpenAPI / Swagger:**
- Parse and store the full spec as structured data
- Use oasdiff's 300+ rules (embed as a Go library or port key rules to TypeScript) for breaking change detection
- Track version changes: spec v1 → spec v2 → semantic diff

**GraphQL:**
- Introspection queries to fetch schema
- Schema diffing is well-defined: removed fields, changed types, deprecated fields
- Tools like `graphql-inspector` already handle this

**gRPC / Protobuf:**
- `.proto` file diffing
- `buf breaking` does this well

### 4.2 HTML Documentation (Common Case)

Most APIs Chirri monitors won't have machine-readable specs. Approach:

1. **Chirri already monitors HTML changes** — that's its core product
2. **Structured extraction layer:** Parse API doc pages to extract:
   - Endpoint paths and methods
   - Request/response parameters (from doc tables, code samples)
   - Authentication requirements
   - Rate limits
3. **LLM-assisted parsing:** For complex/unusual doc layouts, use LLM to extract structured contract from HTML
4. **Diff at the semantic level:** Don't just show "HTML changed" — show "the `amount` parameter in POST /charges changed from optional to required"

### 4.3 Response Shape Tracking (Novel Approach)

For private/internal APIs where docs aren't available:

1. **Optional probe endpoint:** If user provides an API key, Chirri periodically calls the endpoint with a test request
2. **Schema inference:** Build a JSON Schema from observed responses over time
3. **Drift detection:** Alert when response shape changes (new fields, removed fields, type changes)
4. **Privacy-first:** Never store actual response values, only the structural schema

```
Response tracking example:

Day 1: { "id": string, "amount": number, "currency": string }
Day 30: { "id": string, "amount": number, "currency": string, "metadata": object }
         → NEW FIELD: "metadata" (object) added — probably non-breaking

Day 45: { "id": string, "amount": string, "currency": string, "metadata": object }
         → TYPE CHANGE: "amount" changed from number to string — BREAKING
```

### 4.4 SDK Changelog Correlation

Many API changes are first visible in SDK updates:

- Monitor npm/PyPI/Maven packages for API SDKs (e.g., `stripe` npm package)
- Parse CHANGELOG.md for breaking changes, deprecations
- Correlate SDK version bumps with API doc changes
- This provides *early warning* — SDK updates often precede doc updates

---

## 5. Impact Analysis (LLM-Powered)

### 5.1 The Core Prompt

```
System: You are an API integration analyst. Given a change in an API's 
contract, analyze the impact on a consumer's integration.

Be specific and actionable. Classify the severity accurately.
Do NOT speculate about impacts that aren't supported by the diff.

User: 
## API Change Detected
API: Stripe Payments API
Endpoint: POST /v1/charges

## What Changed (Diff)
- Parameter `source` has been REMOVED
- New required parameter `payment_method` (string) added
- Response field `source` deprecated (still present but will be removed)

## User's Monitored Context
- User monitors: POST /v1/charges, GET /v1/charges/{id}
- User's language preference: Node.js / TypeScript

## Generate:
1. **Summary** (1-2 sentences)
2. **Severity** (breaking | deprecation | additive | docs-only)
3. **Impact on your integration** (specific to monitored endpoints)
4. **Required action** (what the user needs to change)
5. **Code migration example** (before → after)
6. **Timeline** (if deprecation, when does it become breaking?)
```

### 5.2 Example Output

```markdown
## ⚠️ Breaking Change: Stripe Charges API

**Summary:** Stripe has replaced `source` with `payment_method` on 
POST /v1/charges. The `source` parameter is no longer accepted.

**Severity:** 🔴 Breaking

**Impact on your integration:**
Your monitored endpoint `POST /v1/charges` is directly affected. 
Any code passing `source` will start receiving 400 errors.

**Required action:**
Replace `source` with `payment_method` in all charge creation calls.
You'll also need to create PaymentMethod objects instead of using 
raw card tokens.

**Code migration (Node.js):**
```diff
- const charge = await stripe.charges.create({
-   amount: 2000,
-   currency: 'usd',
-   source: 'tok_visa',
- });
+ const charge = await stripe.charges.create({
+   amount: 2000,
+   currency: 'usd',
+   payment_method: 'pm_card_visa',
+ });
```

**Timeline:** Source parameter already removed. Migrate immediately.
```

### 5.3 Severity Classification

| Level | Icon | Meaning | Example |
|-------|------|---------|---------|
| **Breaking** | 🔴 | Your integration WILL fail | Required param added, endpoint removed, type changed |
| **Deprecation** | 🟡 | Works now, will break later | Parameter deprecated with sunset date |
| **Additive** | 🟢 | New capability, no action needed | New optional parameter, new endpoint |
| **Docs-only** | ⚪ | Documentation clarification | Typo fix, better examples |
| **Uncertain** | 🔵 | Might affect you, review recommended | Behavioral change in edge cases |

### 5.4 Confidence & Accuracy

**Problem:** LLMs can hallucinate impacts that don't exist.

**Mitigations:**
1. **Ground in the actual diff.** The prompt includes the raw change data; the LLM interprets, not invents.
2. **Structured output.** Use JSON mode / tool_use to force structured responses, reducing hallucination.
3. **Confidence scores.** LLM self-rates confidence. Low confidence → show with caveat.
4. **User feedback.** "Was this analysis helpful? 👍/👎" → fine-tune prompt over time.
5. **Diff-first UI.** Always show the raw diff alongside LLM analysis. User can verify.
6. **Conservative bias.** Prompt instructs: "When uncertain, say 'might affect' rather than 'will break'."

---

## 6. Data Model

### 6.1 New Tables

```sql
-- Dependency chains between monitored URLs and known APIs
CREATE TABLE api_dependencies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id    UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  api_id        VARCHAR(100) NOT NULL,        -- e.g., "stripe", "twilio"
  confidence    DECIMAL(3,2) NOT NULL,         -- 0.00-1.00
  detection_method VARCHAR(50) NOT NULL,       -- "header", "error_pattern", "doc_reference", "user_confirmed"
  user_confirmed BOOLEAN DEFAULT FALSE,
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed_at  TIMESTAMPTZ,                   -- user said "not a dependency"
  
  UNIQUE(monitor_id, api_id)
);

-- Known API registry (the fingerprint database)
CREATE TABLE known_apis (
  id            VARCHAR(100) PRIMARY KEY,      -- "stripe", "twilio"
  display_name  VARCHAR(200) NOT NULL,
  changelog_url TEXT,
  status_url    TEXT,
  openapi_url   TEXT,
  fingerprints  JSONB NOT NULL DEFAULT '{}',   -- the fingerprint rules
  last_checked  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User's monitored endpoint context (what they actually use)
CREATE TABLE user_api_context (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  monitor_id    UUID NOT NULL REFERENCES monitors(id),
  endpoints     JSONB NOT NULL DEFAULT '[]',   -- ["POST /v1/charges", "GET /v1/customers/{id}"]
  language      VARCHAR(50),                   -- "nodejs", "python", "go"
  sdk_version   VARCHAR(50),                   -- "stripe@14.0.0"
  notes         TEXT,                          -- free-form user context
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Impact analyses (cached, shareable)
CREATE TABLE impact_analyses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id     UUID NOT NULL REFERENCES changes(id),  -- the detected change
  api_id        VARCHAR(100) REFERENCES known_apis(id),
  
  -- Cached LLM analysis (shared across users with same change)
  raw_diff      TEXT NOT NULL,
  severity      VARCHAR(20) NOT NULL,          -- "breaking", "deprecation", "additive", "docs_only", "uncertain"
  summary       TEXT NOT NULL,
  impact_detail TEXT NOT NULL,
  action_items  JSONB NOT NULL DEFAULT '[]',
  code_examples JSONB DEFAULT '{}',            -- { "nodejs": "...", "python": "..." }
  confidence    DECIMAL(3,2) NOT NULL,
  
  -- LLM metadata
  model_used    VARCHAR(100) NOT NULL,
  prompt_tokens INT,
  output_tokens INT,
  cost_usd      DECIMAL(10,6),
  
  -- Feedback
  upvotes       INT DEFAULT 0,
  downvotes     INT DEFAULT 0,
  
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One analysis per change per API
  UNIQUE(change_id, api_id)
);

-- Per-user personalized impact (references shared analysis + user context)
CREATE TABLE user_impact_views (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  analysis_id     UUID NOT NULL REFERENCES impact_analyses(id),
  user_context_id UUID REFERENCES user_api_context(id),
  
  -- Personalized additions (if user has specific endpoint context)
  personalized_impact TEXT,
  personalized_code   JSONB,
  
  read_at         TIMESTAMPTZ,
  feedback        VARCHAR(10),                 -- "helpful", "unhelpful", null
  
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, analysis_id)
);

-- Changelog tracking for known APIs
CREATE TABLE api_changelog_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id        VARCHAR(100) NOT NULL REFERENCES known_apis(id),
  entry_date    DATE,
  title         TEXT,
  content       TEXT,
  url           TEXT,
  severity      VARCHAR(20),                   -- classified severity
  raw_html      TEXT,
  change_id     UUID REFERENCES changes(id),   -- links to Chirri's change detection
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(api_id, url)
);
```

### 6.2 Entity Relationships

```
monitors ──1:N──► api_dependencies ──N:1──► known_apis
    │                                           │
    │                                           │
    ▼                                           ▼
 changes ──1:N──► impact_analyses         api_changelog_entries
                      │
                      │
              user_impact_views ◄──── user_api_context
                      │
                   users
```

---

## 7. UI/UX Design

### 7.1 Change Detail View (Enhanced)

When viewing a detected change, add a new section below the diff:

```
┌─────────────────────────────────────────────┐
│ 📄 Change Detected: Stripe API Docs         │
│ Page: stripe.com/docs/api/charges            │
│ Detected: March 24, 2026 at 14:32 UTC        │
├─────────────────────────────────────────────┤
│                                              │
│ 📝 Raw Diff                      [Expand ▼] │
│ ┌──────────────────────────────────────────┐ │
│ │ - source (string, required)              │ │
│ │ + payment_method (string, required)      │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ 🧠 Impact Analysis              [Loading...] │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔴 Breaking Change                       │ │
│ │                                          │ │
│ │ The `source` parameter has been replaced │ │
│ │ with `payment_method` on POST /charges.  │ │
│ │                                          │ │
│ │ ▸ What changed (2 items)                 │ │
│ │ ▸ How your integration breaks            │ │
│ │ ▸ What to do                             │ │
│ │ ▸ Code example (Node.js)                 │ │
│ │                                          │ │
│ │ Was this helpful? 👍  👎                  │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ 🔗 Dependency Chain                          │
│ ┌──────────────────────────────────────────┐ │
│ │ Stripe ──► api.mycompany.com/v1/payments │ │
│ │ (auto-detected, confidence: 92%)         │ │
│ │                          [Remove link]   │ │
│ └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 7.2 Dashboard: Dependency Overview

New section on the user's dashboard:

```
┌─────────────────────────────────────────────┐
│ 🔗 API Dependencies                         │
│                                              │
│ Your monitored APIs depend on:               │
│                                              │
│ Stripe ─── 3 monitors          [2 changes]  │
│   ├ api.mysite.com/payments    (confirmed)   │
│   ├ api.mysite.com/billing     (confirmed)   │
│   └ api.mysite.com/checkout    (auto, 87%)   │
│                                              │
│ Twilio ─── 1 monitor           [0 changes]  │
│   └ api.mysite.com/sms         (confirmed)   │
│                                              │
│ + Add dependency manually                    │
└─────────────────────────────────────────────┘
```

### 7.3 Notification Flow

Change detected → standard Chirri notification, BUT enhanced:

```
📢 Stripe API docs changed
   stripe.com/docs/api/charges

   🔴 Breaking: `source` parameter removed
   
   Affects: api.mycompany.com/v1/payments
   
   [View Impact Analysis →]
```

### 7.4 Interaction Flow

1. **Passive:** User adds a monitor → Chirri probes for dependencies (background) → shows suggestions
2. **Active:** User goes to Settings → API Dependencies → manually adds "I use Stripe" → selects specific endpoints
3. **On change:** Diff shown immediately → "Analyzing impact..." → LLM result appears (2-5s async)
4. **Opt-in analysis:** For free-tier users, show "🧠 Analyze Impact" button instead of auto-running

---

## 8. Cost Analysis

### 8.1 Per-Analysis LLM Cost

Typical analysis context:
- **Input:** ~3,000-5,000 tokens (diff: 500-2,000 + user context: 500-1,000 + system prompt: 1,000-2,000)
- **Output:** ~500-1,000 tokens (structured analysis)

| Model | Input Cost | Output Cost | **Total per Analysis** |
|-------|-----------|-------------|----------------------|
| Claude Haiku 3.5 | $0.003-0.004 | $0.002-0.004 | **$0.005-0.008** |
| Claude Haiku 4.5 | $0.004-0.005 | $0.003-0.005 | **$0.007-0.010** |
| GPT-4o-mini (legacy) | $0.001-0.002 | $0.002-0.005 | **$0.003-0.007** |
| GPT-5.4-nano | $0.001-0.001 | $0.001-0.001 | **$0.001-0.002** |
| GPT-5.4-mini | $0.003-0.004 | $0.002-0.005 | **$0.005-0.009** |
| Claude Sonnet 4 | $0.012-0.015 | $0.008-0.015 | **$0.020-0.030** |
| GPT-5.4 | $0.010-0.013 | $0.008-0.015 | **$0.018-0.028** |

### 8.2 Recommended Model Strategy

- **Default (good enough):** GPT-5.4-nano or Claude Haiku 3.5 — $0.002-0.008/analysis
- **Quality tier:** Claude Sonnet 4 or GPT-5.4 — $0.02-0.03/analysis
- **Use quality tier for:** Breaking changes (severity matters), complex multi-endpoint impacts, code generation

### 8.3 Monthly Cost Projections

| Scenario | APIs monitored | Changes/month | Analyses/month | Cost (nano) | Cost (Haiku) | Cost (Sonnet) |
|----------|---------------|---------------|----------------|-------------|-------------|---------------|
| Small user | 5 | 10 | 10 | $0.02 | $0.08 | $0.30 |
| Medium user | 20 | 40 | 40 | $0.08 | $0.32 | $1.20 |
| Power user | 50 | 100 | 100 | $0.20 | $0.80 | $3.00 |
| **1,000 users avg** | — | — | 20,000 | **$4** | **$16** | **$60** |

**Conclusion:** Even at Sonnet quality for every analysis, 1,000 users cost ~$60/month. With caching (section 9), this drops 50-80%. **LLM costs are trivially viable.**

### 8.4 Pricing to Users

Options:
- **Include in paid plans:** At $0.01-0.03/analysis, even 100 analyses/month = $1-3. Easily included in a $15-50/month plan.
- **Per-analysis pricing:** Not worth the billing complexity. Just include it.
- **Free tier:** 5 impact analyses/month (with "Analyze Impact" button). Paid = unlimited + automatic.

---

## 9. Caching Strategy

### 9.1 The Key Insight

If 100 users monitor `stripe.com/docs/api/charges`, and Stripe changes something, we should analyze once and serve to all 100.

### 9.2 Cache Layers

```
Layer 1: Change-level cache (shared)
  Key: (change_id, api_id)
  Value: generic impact analysis
  Hit rate: ~70-80% (many users monitor same popular APIs)

Layer 2: Personalized overlay (per-user)
  Key: (analysis_id, user_context_id)  
  Value: personalized additions (specific endpoints, language, code examples)
  Only generated when user has provided specific context
  
Layer 3: Prompt cache (LLM-level)
  Use Claude's prompt caching for the system prompt + API context
  Saves ~90% on cached input tokens
```

### 9.3 Cache Invalidation

- Change-level cache: never expires (a change is immutable)
- Personalized overlay: invalidated when user updates their API context
- LLM prompt cache: managed by the LLM provider (5-minute or 1-hour TTL)

### 9.4 Shared Analysis Flow

```
Change detected for Stripe docs
         │
         ▼
  Cache lookup: (change_id, "stripe")
         │
    ┌────┴────┐
    │         │
  HIT       MISS
    │         │
    │         ▼
    │    Run LLM analysis
    │    Store in impact_analyses
    │         │
    ▼         ▼
  Return shared analysis
         │
         ▼
  User has specific context?
    ┌────┴────┐
    │         │
   NO        YES
    │         │
    │    Generate personalized
    │    overlay (small LLM call)
    │         │
    ▼         ▼
  Show generic    Show personalized
  analysis        analysis
```

### 9.5 Cost Savings with Caching

Assuming top 20 APIs account for 80% of monitored endpoints, and each API averages 3 changes/month:
- Without caching: 20,000 analyses/month (1,000 users × 20 changes avg)
- With change-level caching: ~4,000 analyses/month (unique changes only) + ~5,000 small personalization calls
- **~75% cost reduction**

---

## 10. MVP vs V1.1 vs V2

### MVP (4-6 weeks)

**Goal:** Prove the concept, get user feedback.

| Feature | Details |
|---------|---------|
| **Basic impact analysis** | LLM analyzes any detected change when user clicks "Analyze Impact" button |
| **Severity classification** | Breaking / deprecation / additive / docs-only |
| **Simple dependency linking** | Manual only: user says "this monitor depends on Stripe" |
| **Cached shared analyses** | One analysis per change, shared across users |
| **Single model** | Claude Haiku 3.5 or GPT-5.4-nano |

**Not in MVP:**
- Auto-detection of dependencies
- Personalized code examples
- Response shape tracking
- SDK changelog monitoring

### V1.1 (2-3 months after MVP)

| Feature | Details |
|---------|---------|
| **Auto dependency detection** | Header + error pattern fingerprinting for top 20 APIs |
| **Automatic analysis** | Run LLM on every change for paid users (no button click needed) |
| **User context** | Users specify their endpoints + language → personalized impact + code |
| **Dependency dashboard** | View all detected dependencies, confirm/dismiss |
| **Smart notifications** | Breaking changes get 🔴 in notification, not just "something changed" |
| **Quality model escalation** | Use nano for triage, escalate to Sonnet for breaking changes |

### V2 (6-12 months)

| Feature | Details |
|---------|---------|
| **Response shape tracking** | Learn API schemas from periodic probing, detect contract drift |
| **SDK changelog correlation** | Monitor npm/PyPI for SDK changes, correlate with API changes |
| **Fingerprint DB expansion** | 100+ APIs, community-contributed |
| **GraphQL + gRPC support** | Schema introspection + diff |
| **Team features** | Share dependency maps across team members |
| **OpenAPI spec diffing** | Embed oasdiff rules for structured spec comparison |
| **Webhook on breaking change** | Send webhook/Slack alert when breaking change detected |
| **Consumer contract definition** | Users define "I expect these fields in this response" → alert on violation |

---

## 11. Implementation Plan

### MVP Sprint Breakdown

#### Sprint 1 (Week 1-2): Foundation
- [ ] Design and create database tables (`impact_analyses`, `api_dependencies`, `user_api_context`)
- [ ] Build LLM integration service (abstract over Claude/OpenAI, configurable model)
- [ ] Implement impact analysis prompt + structured output parsing
- [ ] Build caching layer for shared analyses

**Effort:** ~40 hours backend

#### Sprint 2 (Week 3-4): UI + Integration
- [ ] Add "Analyze Impact" button to change detail view
- [ ] Build impact analysis display component (severity badge, expandable sections)
- [ ] Add manual dependency linking UI (settings page)
- [ ] Wire up async loading (show diff immediately, load analysis in background)

**Effort:** ~40 hours frontend + 20 hours backend

#### Sprint 3 (Week 5-6): Polish + Launch
- [ ] Feedback mechanism (👍/👎 on analyses)
- [ ] Rate limiting + cost tracking per user
- [ ] Free tier limits (5 analyses/month)
- [ ] Testing with real API doc changes (Stripe, Twilio, GitHub changelogs)
- [ ] Documentation + launch announcement

**Effort:** ~30 hours full-stack

**Total MVP estimate:** ~130 hours (~3-4 weeks for one full-time dev)

### V1.1 Additional Effort
- Fingerprint database + detection engine: ~60 hours
- Auto-detection probe system: ~30 hours  
- User context + personalization: ~40 hours
- Enhanced notifications: ~20 hours

**Total V1.1 estimate:** ~150 hours additional

### Key Technical Decisions

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| **LLM provider** | Start with Claude Haiku 3.5 via Anthropic API | Best quality/cost ratio; prompt caching saves money |
| **Structured output** | Use tool_use/function calling for JSON output | Prevents hallucination, ensures parseable responses |
| **Fingerprint DB format** | YAML files in repo + JSONB in PostgreSQL | Easy to edit/contribute, fast to query |
| **Async analysis** | Background job (existing job queue) | Don't block page load; show diff first |
| **Cache store** | PostgreSQL (impact_analyses table) | No need for Redis; analyses are small, writes are rare |
| **Personalization** | Separate small LLM call | Keep shared analysis generic; personalize cheaply |

---

## Appendix A: Competitive Positioning

```
                    Monitors          Analyzes impact      Detects
                    external APIs?    for consumers?       dependencies?
                    
Optic               ✗ (own API)      ✗                    ✗
oasdiff             ✗ (own API)      ✗                    ✗
Bump.sh             ✗ (own API)      ✗                    ✗
Postman Monitor     ✓ (with setup)   ✗                    ✗
Pact                ✗ (contract)     Partially            ✗
Chirri (current)    ✓                ✗                    ✗
Chirri (proposed)   ✓                ✓ (LLM-powered)      ✓ (auto-detect)
```

**Chirri's unique position:** The only tool that monitors third-party APIs from the consumer perspective AND tells you what the changes mean for your integration. Everyone else either works inside the producer's CI pipeline or just shows raw diffs.

## Appendix B: Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LLM gives wrong impact analysis | Medium | Medium | Always show raw diff alongside; feedback loop; conservative prompting |
| Dependency detection false positives | Medium | Low | Confidence thresholds; user confirmation for low scores; easy dismiss |
| LLM costs spike unexpectedly | Low | Low | Per-user rate limits; nano model by default; caching reduces 75% |
| Users don't understand/find the feature | Medium | High | Progressive disclosure; default to simple diff; opt-in analysis |
| API fingerprint DB maintenance burden | Medium | Medium | Start small (20 APIs); community contributions; automated validation |
| Private APIs can't be fingerprinted | High | Medium | Response tracking (V2); user-defined dependencies; still useful for public APIs |
