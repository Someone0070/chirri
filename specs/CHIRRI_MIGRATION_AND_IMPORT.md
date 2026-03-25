# Chirri Migration & Import Design

> Research on rate limit edge cases and platform migration strategy for Chirri.

---

## Part 1: Rate Limit Edge Case Validation

### Edge Case 1: Bulk Import (`POST /v1/urls/bulk`)

**Question:** Should bulk import bypass individual rate limits?

**How others handle it:**

- **Stripe:** Does NOT offer bulk create endpoints. Bulk operations (e.g., mass refunds) are expected to respect rate limits. Their docs explicitly say: "limit background jobs, such as performing mass refunds, to a subset of the maximum." No special bypass — they just have high enough limits (100 req/s) that it usually doesn't matter.
- **GitHub:** No bulk mutation endpoints either. GraphQL helps reduce calls (batch reads), but mutations are still one-at-a-time. Their guidance: "Make requests serially instead of concurrently" and "wait at least one second between each request" for data-modifying operations.
- **Better Stack:** Supports bulk import via dashboard (paste URLs, one per line) and via API. The dashboard approach creates them in one operation server-side.
- **Site24x7:** Has a dedicated CSV bulk import feature in the admin panel that processes the whole file as one operation.

**Our approach — RECOMMENDED:**

Yes, `POST /v1/urls/bulk` should bypass the per-URL-creation endpoint limit (10/min) but NOT the overall write rate limit. Here's the design:

```
POST /v1/urls/bulk
Body: { urls: [ { url: "...", interval: 60, ... }, ... ] }
Max items per request: 100 (hard cap)
Rate limit: 5 bulk requests per hour (generous enough for setup, prevents abuse)
Counts as: 1 request against the write rate limit, NOT 100 individual creates
```

**Gotchas:**
- Must validate all URLs before creating any (atomic: all succeed or all fail with error details)
- Return partial success results: `{ created: 95, failed: 5, errors: [...] }`
- Actually, partial success is better UX than atomic — users don't want to re-upload 95 good URLs because 5 were bad
- Enforce the user's plan URL limit (can't bulk-import 200+ URLs on a plan with fewer slots) *(Aligned 2026-03-24 -- matches Bible v2.2: Free=3, Personal=10, Team=50, Business=200)*
- Queue the actual monitor setup jobs asynchronously — return 202 Accepted, not 201

**Verdict:** Our rate limiting doc doesn't mention bulk import. **Add it.** The bulk endpoint should have its own rate limit bucket separate from individual creates.

---

### Edge Case 2: Initial Setup Burst

**Question:** Should new users get relaxed rate limits during onboarding?

**How others handle it:**

- **OpenAI:** Free tier starts at very low limits (e.g., 500 RPD). Limits increase automatically as spend increases. No onboarding grace period — they just graduate you through tiers.
- **Stripe:** 100 req/s from day one. No special onboarding period. The base limit is generous enough that it doesn't matter.
- **Pipedrive:** Recently migrated to token-based rate limiting. New customers (after Dec 2024) get the new system from day one. No grace period — just clear documentation.
- **GitHub:** Same limits from account creation. No grace period.
- **Google Gemini:** Limits depend on usage tier and account status, update automatically over time.

**Key insight:** No major API offers an explicit "grace period" or "onboarding exemption." Instead, the pattern is:
1. Make base limits generous enough that onboarding isn't painful
2. Provide bulk operations for initial setup
3. Graduate limits automatically based on usage/spend

**Our approach — RECOMMENDED:**

Don't add a grace period. Instead:

1. **The bulk import endpoint (above) handles initial setup.** New user imports 50 URLs? One bulk request, done.
2. **Base limits are already generous enough.** Free plan: 10 write RPM = 600 URLs/hour if manually adding one by one. That's plenty for onboarding.
3. **If we ever need it:** Add a `setup_mode` flag that's auto-enabled for first 24 hours. During setup mode, endpoint-specific sub-limits (like 10 creates/min) are relaxed to 30/min. But honestly, with bulk import, this is unnecessary.

**Verdict:** Our current design is fine. Bulk import solves the onboarding burst problem. No grace period needed.

---

### Edge Case 3: MCP/Agent Burst Traffic

**Question:** How should we handle bursty agent/bot traffic?

**How APIs handle bot/agent bursts:**

- **Token bucket algorithm** is designed exactly for this: it accumulates tokens during idle periods and allows spending them in bursts. A bucket with capacity 60 and refill rate of 1/sec allows a burst of 60 requests instantly, then sustains 1/sec.
- **Stripe's approach:** Allows brief bursts above the cap specifically for real-time events (like flash sales). Their blog post recommends token bucket for exactly this reason.
- **GitHub:** Does NOT allow bursts — fixed window means you can theoretically hit 2x the limit at window boundaries, but they have secondary limits to prevent this.
- **Cloudflare:** Punitive — exceeding the limit blocks ALL requests for 5 minutes. Very anti-burst.

**Key insight for MCP/agents:** MCP tools and AI agents tend to make rapid sequential calls (check status, get details, update, check again). This is fundamentally bursty — 10 requests in 2 seconds, then nothing for 5 minutes.

**Our approach — RECOMMENDED:**

Our sliding window counter already partially handles this, but we should enhance:

1. **Consider a token bucket for the MCP use case.** Sliding window doesn't allow bursts — it smooths them. Token bucket explicitly allows bursts up to the bucket capacity.
2. **Hybrid approach:** Use sliding window for general API access + a small burst allowance.

```
Burst allowance per API key: *(Aligned 2026-03-24 -- matches Bible v2.2)*
- Free: 10 requests burst (can make 10 requests instantly)
- Personal: 20 requests burst
- Team: 50 requests burst
- Business: 100 requests burst
- Enterprise: Custom

After burst is exhausted, falls back to sustained rate (RPM / 60 = per-second rate)
```

3. **Identify MCP/agent traffic:** If we add an `X-Client-Type: mcp` header convention, we could give agent traffic slightly different treatment (higher burst, same sustained rate). But this is gameable — probably not worth it for MVP.

**Verdict:** Our sliding window counter is fine for MVP. Add token bucket as a V1.1 enhancement if MCP usage patterns show issues. The current per-minute windows are already tolerant of sub-minute bursts.

---

### Edge Case 4: Webhook Retries

**Question:** Should retries from the user's system (or from Chirri's webhook delivery) be rate-limit exempt?

**How Stripe handles this:**

- Stripe's webhook deliveries to YOUR endpoint are NOT rate-limited on Stripe's side — they retry with exponential backoff (up to 3 days).
- However, if your webhook handler makes API calls BACK to Stripe (e.g., fetching event details), those calls DO count against your rate limit. This is a known pain point — the community built tools like Hookdeck specifically to throttle webhook-triggered API calls.
- Stripe recommends: use a queue, process webhooks asynchronously, deduplicate.

**How GitHub handles this:**

- GitHub webhook deliveries retry up to 3 times for failed deliveries (non-2xx response).
- The retries are from GitHub TO you — they don't count against any API rate limit.
- If your webhook handler calls the GitHub API, those calls count normally.

**For Chirri, there are two directions:**

**A) Chirri sending webhooks TO users:** Our webhook delivery system retries failed deliveries. These are outbound — they don't hit our API rate limits at all. No issue here.

**B) Users' systems making API calls triggered by our webhooks:** When we send a "site down" webhook, the user's system might call our API to get details, pause the monitor, etc. These calls DO hit rate limits.

**Our approach — RECOMMENDED:**

1. **Outbound webhook retries:** Not a rate limit concern (we control the delivery). Use exponential backoff: 30s, 5min, 30min, 2h, 8h. Give up after 24h.

2. **Inbound API calls triggered by webhooks:** Include a `X-Chirri-Webhook-ID` header that users can pass back in their API calls. Requests with a valid webhook ID get a small grace:
   - Don't count against endpoint-specific sub-limits (like 10 creates/min)
   - DO count against the overall write rate limit (prevent abuse)
   - Webhook IDs are single-use and expire after 5 minutes

   Actually, this is over-engineering. **Simpler approach:** Just make sure our rate limits are generous enough that webhook-triggered API calls aren't a problem. A Pro user gets 200 write RPM — even a cascade of alerts triggering API calls won't hit that unless something is very wrong.

3. **Idempotency:** More important than rate limit exemption. Include an `Idempotency-Key` header support so retried webhook handlers don't create duplicate side effects.

**Verdict:** No special exemption needed. Our limits are generous enough. Add idempotency key support instead — that's what actually prevents problems from retries.

---

## Part 2: Platform Migration Research

### Competitor Export Capabilities

#### 1. UptimeRobot (PRIMARY TARGET — 425% price increase driving exodus)

| Feature | Details |
|---------|---------|
| **CSV Export** | Yes — event logs per monitor. Columns: `ID, Type, Status, Friendly Name, URL/IP, Keyword Type, Keyword Value, Port` |
| **API** | Yes — `POST /v2/getMonitors` returns JSON with full monitor details. Read-only API key available. Pagination supported (offset parameter). |
| **API Data Available** | URL, friendly name, type (HTTP/HTTPS/keyword/ping/port), interval, status, keyword value, port, HTTP method, custom headers, alert contacts, maintenance windows |
| **Rate Limits** | Free: 10 req/min, Pro: `monitor_count × 2` req/min |
| **Ease of Migration** | ⭐⭐⭐⭐⭐ Excellent — rich API, CSV export, well-documented |

**Key detail:** UptimeRobot's CSV export is for LOG data, not monitor configuration. To export monitor CONFIGURATION, you must use the API. However, Uptime Kuma and others have already shown the `getMonitors` API works perfectly for migration scripts.

#### 2. changedetection.io

| Feature | Details |
|---------|---------|
| **Export** | CSV/XLSX export of watches from the web UI. Also supports full backup as ZIP file (includes all data + snapshots). |
| **API** | Yes — REST API available. Can list and manage watches. |
| **Data Available** | URL, title, check interval, CSS/XPath selectors, notification URLs, tags, last checked |
| **Relevance to Chirri** | LOW — changedetection.io monitors content changes, not uptime. Their users are watching for page changes, not checking if a site is up. |
| **Ease of Migration** | ⭐⭐⭐ Medium — has export, but data model doesn't map well to uptime monitoring |

#### 3. Better Stack / Better Uptime

| Feature | Details |
|---------|---------|
| **Export** | No built-in export. Dashboard supports bulk import (paste URLs) but not export. |
| **API** | Yes — full REST API with API token. Can list all monitors with details. |
| **Data Available** | URL, monitor type, check frequency, regions, escalation policy, on-call schedules |
| **Migration FROM Better Stack** | They make it easy to import, hard to export (classic vendor lock-in). Must use API to extract. |
| **Ease of Migration** | ⭐⭐⭐ Medium — API works but requires coding |

#### 4. Checkly

| Feature | Details |
|---------|---------|
| **Export** | No CSV export. Monitors defined as code (Monitoring-as-Code with Terraform/Pulumi). |
| **API** | Yes — REST API. 300 req/60s limit. |
| **Data Available** | Check name, URL, frequency, locations, assertions, alert channels, scripts |
| **Migration Scripts** | Checkly built `pingdom-2-checkly` — a Node script to import from Pingdom. Shows the pattern. |
| **Ease of Migration** | ⭐⭐ Low — Checkly users are more technical (code-defined monitors), less likely to switch to a simpler tool |

#### 5. Pingdom

| Feature | Details |
|---------|---------|
| **Export** | No native CSV export. API 3.1 supports data export. Third-party tools exist (e.g., `pingdomexport` on GitHub). |
| **API** | Yes — REST API with API token. Full CRUD on checks. |
| **Data Available** | Check name, hostname, type, resolution (interval), contact IDs, tags, probe filters, custom headers |
| **Ease of Migration** | ⭐⭐⭐ Medium — API available, but Pingdom is owned by SolarWinds/Sematext now, user base is declining |

#### 6. StatusCake

| Feature | Details |
|---------|---------|
| **Export** | Yes — "Export Settings" button in test overview. CSV format (semicolon-separated). |
| **API** | Yes — REST API with full CRUD. |
| **Data Available** | Test name, URL, check rate, test type, contact groups, tags, status codes, custom headers |
| **Ease of Migration** | ⭐⭐⭐⭐ Good — CSV export + API |

---

### How Competitors Handle Migration (Inbound)

| Platform | Migration Approach |
|----------|-------------------|
| **Better Stack** | Dashboard: paste URLs (one per line). API: programmatic creation. Manual migration support via email. No automated import from competitors. |
| **Xitoring** | **Best-in-class:** "Migrating from a Competitor?" flow. User provides API key from UptimeRobot/Pingdom/BetterStack → Xitoring fetches all monitors automatically. One-click migration. |
| **HetrixTools** | CSV import that explicitly supports UptimeRobot and StatusCake CSV formats natively. |
| **Checkly** | Built `pingdom-2-checkly` open-source Node script. Enterprise customers get dedicated migration assistance. |
| **Uptime Kuma** | Community-built migration scripts. GitHub issue requesting UptimeRobot CSV import has 50+ upvotes. |
| **Site24x7** | Full CSV bulk import with documented column format. Admin → Inventory → Import Monitors. |

**Winner: Xitoring's API-to-API approach.** User provides their old platform's API key, Xitoring fetches everything. Minimal user effort, maximum data fidelity.

---

### Import Approach Analysis

#### Option A: CSV/JSON Upload

| Aspect | Assessment |
|--------|------------|
| **Build Effort** | LOW — parse CSV, validate, create monitors |
| **UX Quality** | ⭐⭐⭐ Good — familiar pattern, users know CSV |
| **Data Richness** | Medium — gets URLs, names, types. May lose notification settings, custom headers. Depends on source format. |
| **Legal/ToS Issues** | NONE — user exports their own data |
| **MVP?** | ✅ YES — build this first |

**Supported formats:**
1. **Generic CSV:** Columns: `url, name, interval, type` (minimum: just `url`)
2. **UptimeRobot CSV:** Auto-detect their column format: `ID, Type, Status, Friendly Name, URL/IP, Keyword Type, Keyword Value, Port`
3. **StatusCake CSV:** Auto-detect semicolon-separated format
4. **JSON array:** `[{ "url": "https://...", "name": "...", "interval": 60 }]`
5. **Plain text:** One URL per line (like Better Stack's approach)

#### Option B: API-to-API Import (UptimeRobot focus)

| Aspect | Assessment |
|--------|------------|
| **Build Effort** | MEDIUM — need to build API client for each competitor, handle pagination, map data models |
| **UX Quality** | ⭐⭐⭐⭐⭐ Excellent — paste API key, click import, done |
| **Data Richness** | HIGH — gets everything: URLs, intervals, notification contacts, keywords, custom headers, maintenance windows |
| **Legal/ToS Issues** | LOW RISK — user is authorizing access to their own data via their own API key. UptimeRobot's API is public and documented. No ToS clause prohibiting read-only API access. Similar to how Xitoring does it openly. |
| **MVP?** | V1.1 — build for UptimeRobot first (biggest migration source), add others later |

**UptimeRobot API-to-API flow:**
```
1. User enters their UptimeRobot Read-Only API key
2. Chirri calls POST https://api.uptimerobot.com/v2/getMonitors
3. Paginate through all monitors (50 per page)
4. Show preview: "Found 87 monitors. Import all? Select which ones?"
5. Map UptimeRobot monitor types to Chirri URL slots
6. Create monitors in Chirri (via internal bulk operation, bypassing rate limits)
7. Show results: "Imported 85/87. 2 skipped (port monitors not supported)."
```

#### Option C: Manual Entry (Paste URLs)

| Aspect | Assessment |
|--------|------------|
| **Build Effort** | ZERO — already part of normal URL creation |
| **UX Quality** | ⭐ Terrible for 50+ URLs |
| **Data Richness** | Minimal — just URLs |
| **MVP?** | Already exists (single URL add). Enhance with "paste multiple URLs" textarea. |

#### Option D: Browser Extension

| Aspect | Assessment |
|--------|------------|
| **Build Effort** | HIGH — browser extension development, maintenance, review process |
| **UX Quality** | ⭐⭐ Novel but niche |
| **Legal/ToS Issues** | HIGH — scraping competitor dashboards could violate CFAA or ToS |
| **MVP?** | ❌ NO — over-engineered, legally risky |

---

### RECOMMENDED STRATEGY

**Phase 1 (MVP — Week 1-2):**
- Plain text URL paste (one per line) — like Better Stack
- Generic CSV upload with auto-detection of UptimeRobot/StatusCake formats
- JSON array upload

**Phase 2 (V1.1 — Week 3-4):**
- UptimeRobot API-to-API import (biggest migration opportunity)
- Migration landing page targeting UptimeRobot's 425% price increase

**Phase 3 (V1.2+):**
- Pingdom API import
- StatusCake API import
- Better Stack API import

---

## Part 3: Import Flow Design

### Import Page: `/import` (or `/settings/import`)

**Recommendation:** Dedicated `/import` page, ALSO accessible as an onboarding step during signup.

```
┌──────────────────────────────────────────────────┐
│  Import Your Monitors                            │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ 📋 Paste URLs                            │    │
│  │ One URL per line                         │    │
│  │ ┌──────────────────────────────────────┐ │    │
│  │ │ https://example.com                  │ │    │
│  │ │ https://api.example.com/health       │ │    │
│  │ │ https://shop.example.com             │ │    │
│  │ └──────────────────────────────────────┘ │    │
│  │ [Import URLs]                            │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ── OR ──                                        │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ 📁 Upload CSV/JSON                       │    │
│  │ Supports UptimeRobot, StatusCake, and    │    │
│  │ generic CSV/JSON formats                 │    │
│  │                                          │    │
│  │ [Choose File] or drag & drop             │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ── OR ──                                        │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ 🔑 Import from UptimeRobot (V1.1)       │    │
│  │ Paste your UptimeRobot Read-Only API key │    │
│  │ ┌──────────────────────────────────────┐ │    │
│  │ │ ur123456-abcdef...                   │ │    │
│  │ └──────────────────────────────────────┘ │    │
│  │ [Connect & Import]                       │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

### Data Mapping: Their Model → Chirri's Model

*(Aligned 2026-03-24 -- matches Bible v2.2)*

| Source Field | Chirri Field | Notes |
|-------------|-------------|-------|
| URL/IP | `url` | Direct map. Prefix `http://` if missing. |
| Friendly Name | `name` | Direct map |
| Type (HTTP/HTTPS/Keyword/Ping/Port) | `type` | Chirri only supports HTTP/HTTPS initially. Ping/Port monitors → skip with warning. |
| Interval (seconds) | `check_interval` | Map to nearest supported interval: 1m, 5m, 15m, 1h, 6h, 24h. UptimeRobot uses seconds. |
| Keyword Value | `expected_keyword` | Direct map if Chirri supports keyword checks |
| Custom Headers | `headers` | Direct map as JSON |
| HTTP Method | `method` | GET/POST/HEAD — direct map |
| Alert Contacts | ⚠️ CANNOT MAP | Different notification systems. Prompt user to set up notifications after import. |
| Maintenance Windows | ⚠️ CANNOT MAP | Different models. Skip. |
| Status Pages | ⚠️ CANNOT MAP | Skip. |
| Tags/Groups | `tags` | Map if Chirri supports tags, otherwise skip |

### Handling Unmappable Data

After import, show a clear summary:

```
✅ Imported: 85 monitors
⚠️ Skipped: 2 (port monitors not supported)
ℹ️ Action needed:
   - Set up notification channels (alert contacts couldn't be imported)
   - Review check intervals (3 monitors had 30s intervals, mapped to 60s minimum)
   - 12 monitors had keyword checks — verify keywords are correct
```

### Rate Limit Interaction

**Critical:** Importing 200 URLs should NOT throttle the user.

Design:
1. Import operations use an **internal service path** that bypasses per-API-key rate limits
2. The import is initiated by an authenticated user action (not API call), so it's server-side
3. Alternatively, the bulk import API endpoint has its own generous limits:
   - `POST /v1/urls/bulk`: 5 requests/hour, 100 URLs per request → 500 URLs/hour max
   - Internally processes as a batch job, not 200 individual API calls
4. Import jobs are queued and processed at a controlled rate (e.g., 10 URL validations/second) to protect our checking infrastructure

```typescript
// Import bypasses normal rate limiting
async function handleImport(userId: string, urls: ImportURL[]) {
  // Validate against plan limits
  const plan = await getPlan(userId);
  const currentCount = await getUrlCount(userId);
  if (currentCount + urls.length > plan.maxUrls) {
    throw new PlanLimitError(
      `Import would exceed your plan limit of ${plan.maxUrls} URLs. ` +
      `You have ${currentCount} monitors. Trying to import ${urls.length}.`
    );
  }

  // Process in batches, no rate limiting
  const results = await processBulkImport(userId, urls, {
    rateLimit: false, // Internal operation
    validateDns: true, // Still validate URLs
    batchSize: 50,
    delayBetweenBatches: 1000 // 1s between batches to be gentle on infra
  });

  return results;
}
```

---

## Part 4: MVP vs V1.1 Prioritization

### MVP (Launch)

| Feature | Effort | Impact |
|---------|--------|--------|
| Plain text URL paste (one per line) | 2 hours | HIGH — covers 80% of use cases |
| Generic CSV upload | 4 hours | MEDIUM — useful for spreadsheet users |
| UptimeRobot CSV format auto-detection | 2 hours | HIGH — biggest migration source |
| JSON array upload | 1 hour | LOW — developer convenience |
| Bulk import API endpoint (`POST /v1/urls/bulk`) | 4 hours | HIGH — needed for API users and internal use |
| Import results summary page | 3 hours | HIGH — user needs to know what happened |
| **Total** | **~16 hours** | |

### V1.1 (Week 3-4)

| Feature | Effort | Impact |
|---------|--------|--------|
| UptimeRobot API-to-API import | 8 hours | VERY HIGH — killer feature for migration |
| Migration landing page (SEO: "uptimerobot alternative") | 4 hours | HIGH — captures search traffic |
| StatusCake CSV auto-detection | 2 hours | LOW-MEDIUM |
| Import during onboarding flow | 4 hours | MEDIUM — smoother first experience |
| **Total** | **~18 hours** | |

### V1.2+

| Feature | Effort | Impact |
|---------|--------|--------|
| Pingdom API import | 6 hours | LOW — declining user base |
| Better Stack API import | 6 hours | LOW-MEDIUM |
| StatusCake API import | 6 hours | LOW |
| Import history / re-import detection | 4 hours | LOW |

---

## Part 5: Updates Needed to Rate Limiting Doc

Based on this research, the following should be added to `CHIRRI_RATE_LIMITING.md`:

### 1. Bulk Import Endpoint

```
POST /v1/urls/bulk
- Max 100 URLs per request
- Rate limit: 5 requests/hour (separate bucket)
- Counts as 1 write request against overall write limit
- Returns 202 Accepted with job ID for large imports
- Plan URL limit enforced (can't exceed plan max)
```

### 2. Import Rate Limit Bypass

```
Server-side import operations (CSV upload, API-to-API import):
- Bypass per-API-key rate limits
- Process at controlled internal rate (10 validations/sec)
- Still enforce plan URL limits
- Logged and auditable
```

### 3. Idempotency Keys

```
Header: Idempotency-Key: <uuid>
- Supported on all POST/PUT endpoints
- Cached for 24 hours
- Prevents duplicate operations from webhook retries
- Returns cached response for duplicate keys
```

### 4. Burst Allowance (V1.1)

```
Consider adding token bucket burst allowance:
- Allows short bursts for MCP/agent traffic patterns
- Free: 10 req burst, Personal: 20, Team: 50, Business: 100 *(Aligned 2026-03-24 -- matches Bible v2.2)*
- Falls back to sustained rate after burst exhausted
```

---

## Summary

### Rate Limit Edge Cases

| Edge Case | Verdict | Action |
|-----------|---------|--------|
| Bulk import | Add dedicated endpoint with own limits | Add to rate limit design |
| Initial setup burst | Not needed — bulk import solves it | No change |
| MCP/Agent burst | Sliding window is fine for MVP; token bucket for V1.1 | Note for future |
| Webhook retries | No exemption needed; add idempotency keys instead | Add idempotency support |

### Migration Strategy

| Priority | What | Why |
|----------|------|-----|
| MVP | CSV/JSON/text upload with UptimeRobot format detection | Covers 80% of migrations, low effort |
| V1.1 | UptimeRobot API-to-API import | Killer feature, captures exodus from their 425% price increase |
| V1.2+ | Other platform API imports | Diminishing returns, add based on demand |

### Key Competitive Insight

Xitoring is the only monitoring tool doing API-to-API migration well. Everyone else either does manual migration (Better Stack: "email us"), CSV import (HetrixTools), or open-source scripts (Checkly). **If Chirri launches with UptimeRobot API import + a landing page targeting their price increase, that's a significant acquisition channel.**
