# Chirri — Additional Features & Integrations Research

> Deep research for chirri.io — API change detection service.
> Compiled: 2026-03-23

---

## Table of Contents

1. [API Latency & Performance Features](#1-api-latency--performance-features)
2. [Integration Research](#2-integration-research)
3. [Additional Features](#3-additional-features)
4. [MCP Server Design](#4-mcp-server-design)
5. [Webhook & Event System](#5-webhook--event-system)
6. [Priority Matrix](#6-priority-matrix)

---

## 1. API Latency & Performance Features

### 1.1 Metrics Developers Actually Care About

Based on industry research (Cloudflare, Datadog, Catchpoint, Zuplo, Last9), these are the latency metrics devs track:

| Metric | What It Measures | Who Cares |
|--------|-----------------|-----------|
| **TTFB** (Time to First Byte) | Server processing + network time until first byte received | Everyone — the single most-requested metric |
| **Total Response Time** | Full request lifecycle from send to last byte received | Backend devs, SREs |
| **DNS Resolution Time** | Time to resolve hostname to IP | Ops teams, multi-CDN setups |
| **TLS Handshake Time** | Time for SSL/TLS negotiation | Security teams, certificate monitoring |
| **TCP Connect Time** | Time to establish TCP connection | Network engineers |
| **Download Time** | Time from first byte to last byte (response body transfer) | Frontend devs, mobile devs |
| **Response Size** (bytes) | Size of response payload | Mobile devs, performance engineers |

**How Datadog Synthetics breaks it down:**
Datadog measures each phase separately: DNS → TCP → TLS → TTFB → Download. Their API test timing shows `synthetics.http.dns.time`, `synthetics.http.tcp.time`, `synthetics.http.ssl.time`, `synthetics.http.firstbyte.time`, `synthetics.http.download.time`. They test HTTP, gRPC, SSL, DNS, WebSocket, TCP, UDP, and ICMP from global locations.

**How Checkly does it:**
Checkly monitors API checks with alerting on failure, degradation, and recovery. They provide response time tracking with configurable thresholds. Alert on degraded performance (not just down/up). Retry strategies: fixed, linear, exponential backoff.

### 1.2 Percentile Thresholds & Alerting

Industry standard percentiles that matter:

| Percentile | Use Case | Typical Threshold |
|------------|----------|-------------------|
| **p50** (median) | "Normal" user experience | Baseline tracking |
| **p90** | Most users' worst experience | First warning tier |
| **p95** | The tail that matters for SLAs | **Most common alert threshold** |
| **p99** | Worst 1% — affects enterprise SLAs | Critical alert tier |
| **p99.9** | Edge cases in high-volume systems | Ultra-sensitive monitoring |

**Real-world alert thresholds (from dotcom-monitor.com, 2026):**
- Latency alert: "Trigger when p95 exceeds baseline by 30–50% for 10 minutes"
- Error rate: "500 errors spiking above 2%"
- Response time: "Exceeding 1,000ms"
- Common SLA targets: p95 < 100ms for real-time APIs, p99 < 300ms

### 1.3 Performance Degradation as a Change Event

**Chirri-specific opportunity: "API got 2x slower this week"**

This is a **differentiating feature**. Nobody does this well for third-party APIs. Here's how it would work:

- Track rolling p50/p95/p99 over configurable windows (1h, 24h, 7d)
- Detect when current window deviates from baseline by configurable % (e.g., >50% slower)
- Fire as a **change event**: `performance.degraded` with before/after metrics
- Include trend data: "Stripe API p95 latency increased from 120ms to 280ms over the past 7 days"

**Build estimate:** 1-2 weeks (statistics aggregation + alerting logic)
**Plan tier:** Pro (free tier gets basic TTFB only)
**MVP or later:** Later (v1.1) — core change detection first
**Willingness to pay:** HIGH — SREs and platform teams will pay for this

### 1.4 Response Size Change Detection (Payload Bloat)

**What:** Detect when an API response payload size changes significantly. Sentry already flags "Large HTTP Payload" issues (threshold-based). Chirri could track response size over time and alert on anomalies.

**Use cases:**
- API suddenly returns 10x more data (pagination broke, new fields added)
- Payload shrinks unexpectedly (data loss, missing fields)
- Gradual bloat over weeks (new nested objects added incrementally)

**Implementation:**
- Track `Content-Length` header and actual body size per check
- Alert when size deviates >X% from rolling average
- Fire as change event: `response.size_changed` with delta

**Build estimate:** 2-3 days (piggybacks on existing response capture)
**Plan tier:** All plans (it's cheap to compute)
**MVP or later:** MVP — easy win, very unique
**Willingness to pay:** MEDIUM — but great for marketing ("we caught the bloat before your mobile users did")

### 1.5 Recommended Chirri Performance Feature Set

**MVP (Free tier):**
- TTFB tracking (already planned)
- Response time history chart
- Response size tracking

**Pro tier:**
- Full timing breakdown: DNS, TLS, Connect, TTFB, Download
- p50/p95/p99 percentile calculations
- Performance degradation alerts (configurable thresholds)
- Response size anomaly detection
- "This API got slower" weekly digest

**Enterprise tier:**
- Custom percentile windows
- Multi-region latency comparison
- Performance SLA tracking (see Section 3.2)
- API performance reports (PDF/CSV export)

---

## 2. Integration Research

### 2.1 Notification Channels — What Competitors Support

| Channel | Checkly | Sentry | BetterStack | Datadog | **Chirri Priority** |
|---------|---------|--------|-------------|---------|-------------------|
| **Email** | ✅ | ✅ | ✅ | ✅ | **MVP** — trivial |
| **Slack** | ✅ | ✅ | ✅ | ✅ | **MVP** — #1 requested |
| **Webhook** | ✅ | ✅ | ✅ | ✅ | **MVP** — enables everything |
| **PagerDuty** | ✅ | ✅ | ✅ | ✅ | **v1.1** — enterprise must-have |
| **Opsgenie** | ✅ | ✅ | ✅ | ✅ | **v1.1** — Atlassian shops |
| **Discord** | ✅ (webhook) | ❌ | ❌ | ❌ | **MVP** — dev/indie teams |
| **Microsoft Teams** | ✅ (webhook) | ✅ | ✅ | ✅ | **v1.1** — enterprise |
| **Telegram** | ✅ (webhook) | ❌ | ❌ | ❌ | **Later** — niche |
| **SMS** | ✅ | ❌ | ✅ | ✅ | **Later** — expensive |
| **Phone Call** | ✅ | ❌ | ✅ | ✅ | **Later** — very expensive |

**Checkly's full integration list:** Slack, PagerDuty, Opsgenie, Incident.io, Microsoft Teams, GitLab Alerts, Discord, Spike.sh, Splunk On-Call, StatusPage, Prometheus, FireHydrant, Rootly, Coralogix + custom webhooks (Discord, Telegram, MS Teams via webhook types).

**BetterStack supports:** Email, Slack, MS Teams, phone/SMS, push notifications, plus importing from Datadog, New Relic, Grafana, Prometheus, Zabbix, AWS, Azure, Google Cloud.

**Sentry supports:** Slack, PagerDuty, Opsgenie, MS Teams, custom webhooks. Alert rules can route to different channels based on conditions.

### 2.2 Recommended Chirri Notification Priority

**MVP (Week 1-2):**
1. **Email** — trivial, everyone expects it
2. **Slack** — #1 developer communication tool, well-documented API, Incoming Webhooks are easy
3. **Generic Webhook** — this is the master key; enables any integration
4. **Discord** — identical to Slack webhook format, huge in indie/OSS community

**v1.1 (Month 2-3):**
5. **PagerDuty** — Events API v2 is straightforward, enterprise unlock
6. **Opsgenie** — Atlassian ecosystem, similar to PagerDuty API
7. **Microsoft Teams** — Incoming Webhook connector, enterprise requirement

**Later:**
8. Telegram Bot API
9. SMS (via Twilio — adds cost)
10. Phone calls (Twilio — expensive, enterprise only)

### 2.3 CI/CD Integrations

**How Chirri fits into CI/CD:**

| Integration | How It Works | Build Effort | Priority |
|-------------|-------------|-------------|----------|
| **GitHub Action** | `chirri/check-api@v1` — run API checks in CI, fail PR if breaking changes detected | 1-2 days | **MVP** |
| **GitLab CI** | Docker image or CLI that runs checks in pipeline | 1 day (reuse CLI) | v1.1 |
| **Bitbucket Pipelines** | Same CLI/Docker approach | 1 day | Later |
| **Pre-deploy check** | "Are all my dependencies healthy before I deploy?" | 2-3 days | **MVP** |
| **Post-deploy verify** | "Did my deploy break any API contracts?" | 1 day | v1.1 |

**The killer CI/CD use case for Chirri:**
```yaml
# .github/workflows/deploy.yml
- name: Check third-party API health
  uses: chirri/check-api@v1
  with:
    api-key: ${{ secrets.CHIRRI_API_KEY }}
    monitors: stripe,twilio,sendgrid
    fail-on: breaking-change
```

This lets teams **gate deployments** on third-party API status. Datadog already has `DataDog/synthetics-ci-github-action@v3` for this pattern.

**Build estimate:** GitHub Action: 1-2 days (wrapper around CLI/API)
**Plan tier:** Pro
**MVP or later:** GitHub Action = MVP, others = later
**Willingness to pay:** HIGH — CI/CD integration is table-stakes for Pro plans

### 2.4 Project Management Integrations

| Tool | How It Works | Who Wants It | Build Effort | Priority |
|------|-------------|-------------|-------------|----------|
| **Jira** | Auto-create issue when breaking change detected | Enterprise teams | 1 week (OAuth, field mapping) | v1.1 |
| **Linear** | Auto-create issue via API (simpler than Jira) | Startups, dev teams | 2-3 days | v1.1 |
| **Asana** | Create task in project | PM-heavy orgs | 3-4 days | Later |
| **GitHub Issues** | Create issue in repo | OSS teams | 1 day | v1.1 |

**Pattern:** All of these follow the same flow: webhook fires → middleware creates ticket with context (which API, what changed, severity, link to diff). Start with generic webhook (MVP), then add native integrations.

**Linear is especially interesting** — it's the project management tool of choice for startups (Chirri's target market). Linear's API is clean, GraphQL-based, and supports webhook subscriptions.

### 2.5 Incident Management

**Market landscape (2025-2026):**
- **PagerDuty** — market leader, 370+ integrations, $9-$21/user/month
- **Opsgenie** (Atlassian) — free for 5 users, strong for Jira shops
- **Better Stack** — modern alternative, clean UX, growing fast
- **Incident.io** — Slack-native, loved by startups
- **Rootly** — Slack-native, auto-creates Jira tickets

**Chirri's approach:** Don't build incident management. Integrate with it.
- PagerDuty Events API v2 (create/resolve incidents)
- Opsgenie Alert API
- Generic webhook covers Rootly, Incident.io, Better Stack

**Build estimate:** PagerDuty: 1-2 days. Opsgenie: 1-2 days.
**Plan tier:** Pro/Enterprise
**Willingness to pay:** HIGH — this is how enterprise teams justify the spend

### 2.6 Observability Integrations

| Tool | Integration Type | Build Effort | Priority |
|------|-----------------|-------------|----------|
| **Prometheus** | Expose `/metrics` endpoint for scraping | 2-3 days | v1.1 |
| **Grafana** | Prometheus + JSON API data source | 1 day (free with Prometheus) | v1.1 |
| **Datadog** | Push custom metrics via DogStatsD or API | 3-4 days | Later |
| **New Relic** | Events API / Metric API | 3-4 days | Later |
| **OpenTelemetry** | Export spans/metrics in OTLP format | 1 week | Later |

**Prometheus/Grafana is the sweet spot** — it's free, widely used, and lets Chirri data live alongside internal metrics. Expose metrics like:
```
chirri_api_response_time_seconds{monitor="stripe-api",percentile="p95"}
chirri_api_status{monitor="stripe-api"} 1
chirri_api_change_events_total{monitor="stripe-api",type="schema"}
```

### 2.7 API Platform Integrations

| Platform | Integration | Build Effort | Priority |
|----------|------------|-------------|----------|
| **Postman** | Import Postman collection as monitors | 1 week | v1.1 |
| **Insomnia** | Import from Insomnia export | 3-4 days | Later |
| **OpenAPI/Swagger** | Import spec, auto-create monitors for endpoints | 1-2 weeks | **MVP** |
| **RapidAPI** | Marketplace listing | 1 week | Later |

**OpenAPI import is the big one** — "Point Chirri at your OpenAPI spec and we'll monitor every endpoint automatically." This is a major onboarding accelerator.

---

## 3. Additional Features

### 3.1 API Deprecation Tracking

**What:** Automatically detect `Sunset` (RFC 8594) and `Deprecation` headers in API responses. Alert users when an API they depend on is being deprecated.

**Evidence of demand:**
- RFC 8594 (Sunset header) is now standard
- OneUptime published 3 blog posts on this in Jan-Feb 2026
- Zalando's API guidelines recommend monitoring Sunset headers
- GitHub, Stripe, Twilio all use deprecation headers
- Stack Overflow discussions show developers asking for automated detection

**How it works:**
1. On every API check, scan response headers for `Sunset`, `Deprecation`, `Link: rel="successor-version"`
2. Parse sunset dates and calculate days remaining
3. Alert: "Stripe API v2021-08-01 sunsets in 45 days — successor: v2024-06-01"
4. Create timeline of deprecation warnings

**Build estimate:** 3-5 days (header parsing + alerting)
**Plan tier:** All plans (it's a safety feature)
**MVP or later:** **MVP** — incredibly unique, almost nobody does this
**Willingness to pay:** HIGH — preventing outages from deprecated APIs is extremely valuable

### 3.2 SLA Monitoring

**What:** Track whether a third-party API meets its published SLA. Calculate uptime percentages over rolling windows (30d, 90d). Alert when SLA is at risk.

**Evidence of demand:**
- Postman blog (Feb 2026): "Alert at 50% of allowed degradation, not 100%"
- Uptrends, AlertSite, OneUptime all offer SLA tracking
- Enterprise customers need SLA compliance reports for vendor management
- Reddit r/sysadmin threads regularly ask for SLA monitoring tools

**How it works:**
1. User inputs: "Stripe SLA = 99.99% uptime, <200ms p95"
2. Chirri tracks actual uptime and latency
3. Dashboard shows: current SLA attainment vs target
4. Alert when trending toward breach: "Stripe at 99.93% this month (target: 99.99%)"
5. Generate SLA report (PDF/CSV) for vendor meetings

**Build estimate:** 1-2 weeks
**Plan tier:** Pro/Enterprise
**MVP or later:** v1.1
**Willingness to pay:** VERY HIGH — enterprise procurement teams love this

### 3.3 Documentation Change Tracking

**What:** Monitor API documentation pages for changes (separate from actual API response monitoring). Detect when docs are updated before the API changes.

**How it works:**
1. User provides doc URL (e.g., `https://stripe.com/docs/api/charges`)
2. Chirri periodically fetches page, extracts content, diffs against previous
3. Alert: "Stripe Charges API documentation changed — 3 new parameters documented"
4. Highlight what changed (added/removed/modified sections)

**Build estimate:** 1 week (web scraping + diff engine)
**Plan tier:** Pro
**MVP or later:** Later (v1.2) — nice to have, not core
**Willingness to pay:** MEDIUM — useful but niche

### 3.4 SDK Version Tracking

**What:** Monitor npm, PyPI, Maven, etc. for new versions of API SDKs. Alert when a new version is published.

**How it works:**
1. User specifies: `stripe` on npm, `stripe` on PyPI
2. Chirri polls registry APIs periodically
3. Alert: "stripe@14.0.0 published on npm — MAJOR version (breaking changes likely)"
4. Link to changelog if available

**Build estimate:** 3-5 days (registry API polling + semver parsing)
**Plan tier:** Pro
**MVP or later:** Later (v1.2)
**Willingness to pay:** MEDIUM — convenient but developers often have this via Dependabot/Renovate

### 3.5 Security Scanning

**What:** Detect changes in API security posture — TLS version, security headers (HSTS, CSP, X-Content-Type-Options), certificate changes, cipher suite changes.

**How it works:**
1. Track TLS version, certificate issuer/expiry, security headers per check
2. Alert on changes: "API downgraded from TLS 1.3 to TLS 1.2"
3. Alert on missing headers: "HSTS header removed from API response"
4. Certificate expiry warnings (30d, 14d, 7d)

**Build estimate:** 1 week (TLS inspection + header tracking, partially overlaps with existing header tracking)
**Plan tier:** Pro
**MVP or later:** v1.1 (certificate expiry = MVP, rest = v1.1)
**Willingness to pay:** HIGH for enterprise — compliance and security teams need this

### 3.6 Compliance Monitoring

**What:** Track GDPR-relevant headers, data residency indicators, privacy policy changes.

**How it works:**
- Monitor for `X-Data-Residency`, `X-Region`, `Server` header location changes
- Detect if API starts routing through different geographic regions
- Track `P3P`, privacy-related headers

**Build estimate:** 3-5 days (extension of header tracking)
**Plan tier:** Enterprise
**MVP or later:** Later (v2.0)
**Willingness to pay:** HIGH for regulated industries, LOW for startups

### 3.7 Contract Testing Integration

**What:** Integrate with Pact or similar contract testing tools. Chirri detects real-world API changes; Pact validates contracts in CI/CD.

**Evidence:**
- Pact is the dominant contract testing framework
- Used for consumer-driven contract testing in microservices
- `can-i-deploy` command checks if a service is safe to release
- CircleCI, GitHub Actions integrations already exist

**How Chirri integrates:**
1. **Don't rebuild Pact** — it's a different problem (internal contracts vs external monitoring)
2. **Complement Pact:** Chirri monitors live third-party APIs; Pact tests internal contracts
3. **Potential integration:** Export Chirri schema snapshots as Pact-compatible contracts
4. **CI/CD bridge:** "chirri verify --against-pact ./pacts/stripe.json"

**Build estimate:** 2-3 weeks for Pact contract export
**Plan tier:** Enterprise
**MVP or later:** Later (v2.0) — very niche
**Willingness to pay:** LOW-MEDIUM — Pact users are a specific audience

### 3.8 GraphQL Introspection Monitoring

**What:** Monitor GraphQL APIs by periodically running introspection queries and detecting schema changes (new types, removed fields, changed arguments).

**Evidence:**
- GraphQL Inspector (by The Guild) does this for internal schemas in CI
- GraphQL Hive provides schema registry + change detection
- No one does this for **third-party** GraphQL APIs you consume

**How it works:**
1. Run introspection query: `{ __schema { types { name fields { name type { name } } } } }`
2. Diff against previous schema snapshot
3. Categorize changes: breaking (removed field), dangerous (deprecated), safe (added field)
4. Alert with detailed diff: "GitHub GraphQL API: `Repository.isArchived` field removed (BREAKING)"

**Build estimate:** 1-2 weeks
**Plan tier:** Pro
**MVP or later:** v1.1 — GraphQL is huge and growing
**Willingness to pay:** HIGH — GraphQL teams desperately need this for external APIs

### 3.9 WebSocket Monitoring

**What:** Monitor WebSocket endpoints for availability, handshake time, and basic message exchange.

**Feasibility research:**
- Datadog Synthetics supports WebSocket tests
- Dotcom-Monitor supports WebSocket monitoring with scripted checks
- OneUptime published guide on WebSocket health monitoring (Jan 2026)
- Feasible but more complex than HTTP: requires maintaining connections, handling message protocols

**How it works:**
1. Connect to WebSocket endpoint
2. Measure: handshake time, connection success/failure
3. Optionally: send test message, validate response
4. Track connection stability over time

**Build estimate:** 2-3 weeks
**Plan tier:** Pro/Enterprise
**MVP or later:** Later (v2.0) — complex, niche
**Willingness to pay:** MEDIUM — important for real-time app teams but small market

### 3.10 Cost Tracking

**What:** Track API usage costs by estimating calls × per-call pricing.

**Reality check:** This is extremely hard to do well because:
- Pricing structures vary wildly (per-call, per-byte, tiered, monthly)
- Chirri doesn't see all API calls, only its monitoring checks
- Better suited as a feature of the user's own API gateway

**Recommendation:** Skip this entirely. It's a different product category (Moesif, API analytics).

**Build estimate:** N/A — don't build
**Willingness to pay:** LOW — solved by other tools

---

## 4. MCP Server Design

### 4.1 What Existing MCP Servers Do

**UptimeRobot MCP Server:**
- Hosted MCP endpoint: `https://mcp.uptimerobot.com/mcp`
- Auth: Bearer token via header
- Tools exposed: list monitors, get monitor status, view incidents, check alert contacts
- AI agents can: check status, create monitors, view downtime logs via natural language

**OneUptime MCP Server:**
- Fetches real-time data from OneUptime instance
- AI responds with context-aware insights
- Can take actions (acknowledge, resolve incidents)
- Focus: incident response acceleration

**Uptime Agent MCP:**
- Open source: `github.com/AVIMBU/uptime_agent_mcp`
- Tracks websites and API endpoints
- Provides monitoring data to Claude and other AI assistants

### 4.2 Chirri MCP Server Design

**Tools to expose:**

```typescript
// Read operations
tools: [
  {
    name: "chirri_list_monitors",
    description: "List all API monitors with current status",
    // Returns: monitor name, URL, status (up/down/changed), last check time
  },
  {
    name: "chirri_get_monitor_status",
    description: "Get detailed status for a specific API monitor",
    // Input: monitor_id
    // Returns: current status, latency, last change, uptime %
  },
  {
    name: "chirri_get_changes",
    description: "Get recent API changes detected",
    // Input: monitor_id (optional), since (datetime), type (schema/header/status/performance)
    // Returns: list of change events with diffs
  },
  {
    name: "chirri_get_change_diff",
    description: "Get detailed diff for a specific change event",
    // Input: change_id
    // Returns: before/after snapshots, diff, severity
  },
  {
    name: "chirri_get_performance",
    description: "Get performance metrics for a monitor",
    // Input: monitor_id, period (1h/24h/7d/30d)
    // Returns: p50/p95/p99 latency, uptime %, response size stats
  },
  {
    name: "chirri_get_sla_status",
    description: "Get SLA compliance status",
    // Input: monitor_id
    // Returns: current SLA attainment, target, trend
  },

  // Write operations
  {
    name: "chirri_create_monitor",
    description: "Create a new API monitor",
    // Input: url, method, headers, expected_status, check_interval
  },
  {
    name: "chirri_pause_monitor",
    description: "Pause/resume a monitor",
    // Input: monitor_id, paused (boolean)
  },
  {
    name: "chirri_acknowledge_change",
    description: "Acknowledge a detected change (mark as reviewed)",
    // Input: change_id, note (optional)
  },
]

// Resources
resources: [
  {
    uri: "chirri://monitors",
    description: "All monitors and their current state"
  },
  {
    uri: "chirri://changes/recent",
    description: "Recent API changes across all monitors"
  },
  {
    uri: "chirri://dashboard",
    description: "Overall system health dashboard data"
  }
]
```

**AI Agent Use Cases:**
1. "Are all my APIs healthy?" → `chirri_list_monitors`
2. "What changed in the Stripe API this week?" → `chirri_get_changes` + `chirri_get_change_diff`
3. "Is the Twilio API meeting its SLA?" → `chirri_get_sla_status`
4. "Set up monitoring for this new API" → `chirri_create_monitor`
5. "Why is my app slow?" → `chirri_get_performance` (check third-party latency)

**Build estimate:** 1-2 weeks for MCP server
**Plan tier:** Pro (API access required)
**MVP or later:** v1.1 — MCP is hot right now, great marketing
**Willingness to pay:** MEDIUM directly, but HIGH for positioning (AI-native tool)

---

## 5. Webhook & Event System

### 5.1 Event Types

Based on Stripe/GitHub webhook patterns and Chirri's domain:

**Core events (MVP):**

| Event Type | Description | Trigger |
|------------|------------|---------|
| `monitor.up` | API came back online | Status changes from non-2xx to 2xx |
| `monitor.down` | API went offline | Status changes to non-2xx or timeout |
| `change.schema` | Response schema changed | New/removed/modified fields detected |
| `change.header` | Response headers changed | Header added/removed/modified |
| `change.status_code` | Status code changed | e.g., 200 → 201, 200 → 301 |
| `change.performance` | Significant latency change | p95 exceeds threshold |
| `change.size` | Response size anomaly | Size deviates >X% from baseline |

**Extended events (v1.1):**

| Event Type | Description |
|------------|------------|
| `deprecation.detected` | Sunset/Deprecation header first seen |
| `deprecation.approaching` | Sunset date within configurable window |
| `certificate.expiring` | TLS cert expires within X days |
| `certificate.changed` | TLS certificate changed |
| `security.header_removed` | Security header disappeared |
| `sla.at_risk` | SLA attainment trending below target |
| `sla.breached` | SLA target missed for period |
| `graphql.schema_changed` | GraphQL introspection schema diff detected |

### 5.2 Webhook Payload Structure

Following Stripe/GitHub best practices — envelope pattern with HMAC-SHA256 signatures:

```json
{
  "id": "evt_2xK9j4mNpQ8r",
  "type": "change.schema",
  "created_at": "2026-03-23T21:00:00Z",
  "api_version": "2026-03-01",
  "data": {
    "monitor": {
      "id": "mon_abc123",
      "name": "Stripe Charges API",
      "url": "https://api.stripe.com/v1/charges"
    },
    "change": {
      "id": "chg_xyz789",
      "severity": "breaking",
      "summary": "Field 'source' removed from response",
      "diff": {
        "added": [],
        "removed": ["data[].source"],
        "modified": []
      },
      "previous_snapshot_id": "snap_001",
      "current_snapshot_id": "snap_002",
      "detected_at": "2026-03-23T21:00:00Z"
    }
  }
}
```

**Headers sent with webhook:**
```
X-Chirri-Event: change.schema
X-Chirri-Signature: sha256=5257a869e7ecebeda32affa62cdca3fa51cad7e77a...
X-Chirri-Delivery: dlv_abc123
X-Chirri-Timestamp: 1711227600
Content-Type: application/json
```

**Security best practices (from GitHub/Stripe patterns):**
1. **HMAC-SHA256 signatures** — user gets a webhook secret, signs every payload
2. **Timestamp validation** — reject payloads older than 5 minutes (replay attack prevention)
3. **HTTPS only** — reject HTTP endpoints
4. **Retry with exponential backoff** — retry on 5xx or timeout (1m, 5m, 30m, 2h, 24h)
5. **Delivery logs** — show recent deliveries with status codes for debugging
6. **Event filtering** — let users subscribe to specific event types only

### 5.3 Real-Time Event Stream (SSE/WebSocket)

**Should Chirri have a real-time stream?**

| Option | Pros | Cons | Build Effort |
|--------|------|------|-------------|
| **SSE (Server-Sent Events)** | Simple, HTTP-based, auto-reconnect, unidirectional | One-way only | 3-5 days |
| **WebSocket** | Bidirectional, lower latency | More complex, connection management | 1-2 weeks |
| **Neither (webhooks only)** | Simplest, proven pattern | Not real-time in dashboard | 0 days |

**Recommendation:** Start with **webhooks only** for external consumers. Use **SSE** for the Chirri dashboard itself (live updates). Don't build a public WebSocket API — it's overkill for change detection (events are infrequent).

**Build estimate:** SSE for dashboard: 3-5 days. Public SSE endpoint: 1 week.
**Plan tier:** Pro (SSE endpoint)
**MVP or later:** Dashboard SSE = MVP. Public SSE = v1.1.

---

## 6. Priority Matrix

### MVP (Launch)

| Feature | Build Effort | Revenue Impact | Notes |
|---------|-------------|---------------|-------|
| Email notifications | 1 day | Required | Table stakes |
| Slack notifications | 2-3 days | High | #1 developer channel |
| Discord notifications | 1 day | Medium | Reuse Slack webhook format |
| Generic webhook | 3-5 days | Very High | Enables all other integrations |
| Webhook HMAC signatures | 2 days | Required | Security best practice |
| Response size tracking | 2-3 days | Medium | Easy win, unique |
| TTFB + basic latency | Already planned | High | Core feature |
| Deprecation header tracking | 3-5 days | High | **Unique differentiator** |
| GitHub Action | 1-2 days | High | CI/CD unlock |
| OpenAPI import | 1-2 weeks | Very High | Onboarding accelerator |

**Total MVP additions: ~4-5 weeks**

### v1.1 (Month 2-3)

| Feature | Build Effort | Revenue Impact |
|---------|-------------|---------------|
| Performance degradation alerts | 1-2 weeks | Very High |
| Full timing breakdown (DNS/TLS/Connect) | 1 week | High |
| p50/p95/p99 percentiles | 1 week | High |
| PagerDuty integration | 1-2 days | High (enterprise) |
| Opsgenie integration | 1-2 days | Medium |
| Microsoft Teams | 2-3 days | Medium (enterprise) |
| SLA monitoring | 1-2 weeks | Very High |
| GraphQL introspection monitoring | 1-2 weeks | High |
| Prometheus metrics endpoint | 2-3 days | High |
| MCP Server | 1-2 weeks | Medium (positioning) |
| Jira integration | 1 week | Medium |
| Linear integration | 2-3 days | Medium |
| Certificate expiry alerts | 3-5 days | High |
| Security header monitoring | 1 week | Medium |

### v1.2+ (Month 4+)

| Feature | Build Effort | Revenue Impact |
|---------|-------------|---------------|
| Documentation change tracking | 1 week | Medium |
| SDK version tracking | 3-5 days | Low-Medium |
| Postman collection import | 1 week | Medium |
| Datadog/New Relic push | 1 week each | Low |
| WebSocket monitoring | 2-3 weeks | Low-Medium |
| Compliance monitoring | 3-5 days | High (enterprise niche) |
| Pact contract testing bridge | 2-3 weeks | Low |
| Public SSE event stream | 1 week | Low |
| Phone/SMS alerts | 1 week | Low |

### Don't Build

| Feature | Reason |
|---------|--------|
| Cost/spend tracking | Different product category (Moesif territory) |
| Full APM/tracing | Stay in your lane — Chirri is change detection |
| Built-in incident management | Integrate, don't compete with PagerDuty |
| Internal API monitoring agent | Focus on external/third-party APIs |

---

## Summary: Chirri's Competitive Moat

The features that make Chirri uniquely valuable (not just another uptime monitor):

1. **API Change Detection** — core product, nobody else does this well
2. **Deprecation Header Tracking** — automated, almost nobody does this
3. **Performance Degradation as Change Events** — "your API got 2x slower" is a change event
4. **Response Size Anomaly Detection** — payload bloat is a real problem
5. **GraphQL Schema Monitoring** — via introspection on third-party GraphQL APIs
6. **Third-party SLA Tracking** — prove your vendors aren't meeting their promises
7. **OpenAPI Import** — zero-friction onboarding
8. **MCP Server** — AI-native from day one

The integration strategy is: **Webhook-first, native integrations second.** A solid webhook system with HMAC signatures, retry logic, and event filtering covers 80% of integration needs. Then add Slack, PagerDuty, and GitHub Action as native integrations for the top use cases.
