# CHIRRI — Category B Research Results

**Researched:** 2026-03-24  
**Researcher:** Claude Opus (subagent)  
**Items:** 16 (all Category B from CHIRRI_CONTRADICTION_LIST.md)

---

## B1. API Framework — Hono vs Fastify

### The Contradiction
Every document says "Hono or Fastify" without deciding.

### Research Findings

| Factor | Hono | Fastify |
|--------|------|---------|
| Bundle size | ~13KB minified | ~500KB with deps |
| Node.js perf | Good (~30K rps) | Excellent (~40K+ rps) |
| TypeScript | First-class, built-in type inference | Supported via plugins |
| better-auth | **Native integration** — dedicated docs page, direct `auth.handler(c.req.raw)` | Supported via `toNodeHandler` adapter |
| BullMQ compat | Works fine — BullMQ is framework-agnostic (runs in separate worker process) | Same — framework-agnostic |
| Middleware | Lightweight, composable, Web Standards-based | Rich plugin ecosystem, Fastify-specific patterns |
| Railway deploy | Via `@hono/node-server` — standard Node.js process | Native Node.js — zero adapters needed |
| Validation | Built-in Zod integration | JSON Schema (AJV) built-in |
| Ecosystem maturity | Growing (newer) | Mature, large plugin ecosystem |

### Definitive Recommendation: **Hono**

**Justification:**
1. **better-auth has a dedicated Hono integration page** with native handler support (`auth.handler(c.req.raw)`). Fastify requires the `toNodeHandler` adapter — an extra layer.
2. **TypeScript-first design** aligns with Chirri's all-TypeScript stack. Type inference from validation schemas means less boilerplate.
3. **Lighter weight** — 13KB vs 500KB. For a monitoring service where the API layer is relatively thin (most work happens in BullMQ workers), Hono's simplicity is an advantage.
4. **Web Standards alignment** — uses `Request`/`Response` natively, which is the direction Node.js is heading.
5. **BullMQ integration is a non-issue** — BullMQ workers are separate processes that connect to Redis directly. The HTTP framework doesn't matter for background jobs.

**Caveats:**
- Fastify's mature plugin ecosystem (database plugins, rate limiting, swagger) is larger. Hono's is growing but smaller.
- Fastify has slightly better raw Node.js throughput, but the difference (~10-20%) is irrelevant for Chirri's scale (thousands of URLs, not millions of concurrent API requests).
- If Chirri ever needs HTTP/2 or native WebSocket support, Fastify has it built-in. Hono uses adapters.

---

## B2. ID Strategy — UUID vs nanoid with Prefixes

### The Contradiction
Architecture uses UUID PKs. Source Preferences uses nanoid with `sap_` prefix. URL Onboarding Flow lists display prefixes.

### Research Findings

**better-auth ID requirements:**
- better-auth generates IDs as **random 32-character alphanumeric strings** by default (NOT UUIDs).
- Supports `advanced.database.generateId` option to customize: can return `"uuid"` for crypto.randomUUID(), or a **custom function** per model.
- Per-model `generateId(options)` allows different ID strategies per table.
- better-auth does **NOT require UUID type** — it uses `TEXT` for its own tables by default.

**Performance comparison:**
- Postgres UUID type is 16 bytes (binary), indexed efficiently with B-tree.
- TEXT with nanoid prefix (`usr_abc123...`) is variable-length, slightly less efficient for indexing.
- At Chirri's scale (tens of thousands of rows), the difference is **negligible** — measurable only at millions+ rows.

**nanoid in Postgres:**
- Can be generated app-side (Node.js `nanoid` package — 3.7M ops/sec) or via a PL/pgSQL function (`nanoid-postgres`).
- App-side generation is simpler and more portable.

### Definitive Recommendation: **Prefixed nanoid, generated app-side**

**Strategy:**
```
User IDs:       usr_  + nanoid(21)  → usr_V1StGXR8_Z5jdHi6B-myT
URL IDs:        url_  + nanoid(21)
Change IDs:     chg_  + nanoid(21)
API Key IDs:    (handled by better-auth's API key plugin)
Session IDs:    (handled by better-auth internally)
```

**Implementation:**
- Use `TEXT PRIMARY KEY` for all app tables.
- Configure better-auth's `generateId` to use prefixed nanoid for user/account tables.
- Generate IDs in the application layer, not in Postgres.

**Justification:**
1. **DX is excellent** — seeing `usr_V1StGXR8_Z5jdHi6B` in logs/URLs instantly tells you the entity type. This is the Stripe model and it's proven.
2. **better-auth supports custom IDs** — the `generateId` function can prepend prefixes per model.
3. **No Postgres extension needed** — app-side generation.
4. **Performance at Chirri's scale is not a concern** — TEXT vs UUID difference is negligible under 1M rows.

**Caveats:**
- Prefixed IDs are slightly longer in URLs/payloads than bare UUIDs.
- If a future migration to a system requiring UUID PKs is needed, it would require a migration. Unlikely for a standalone SaaS.

---

## B3. Railway Plan — Hobby vs Pro

### The Contradiction
Cost estimate assumes ~$42/mo. Spec mentions needing Pro features (static outbound IPs, deployment draining).

### Research Findings (current Railway pricing as of March 2026)

| Feature | Hobby ($5/mo) | Pro ($20/mo) |
|---------|---------------|--------------|
| Subscription | $5/mo (includes $5 usage) | $20/mo (includes $20 usage) |
| RAM | Up to 48 GB | Up to 1 TB |
| CPU | Up to 48 vCPU | Up to 1,000 vCPU |
| Replicas | 6 | 42 |
| Volume Storage | 5 GB | 1 TB |
| Static Outbound IPs | **❌ NOT available** | **✅ Available** |
| Image Retention | 72 hours | 120 hours |

**Resource pricing (both plans):**
- RAM: $10/GB/month
- CPU: $20/vCPU/month
- Egress: $0.05/GB
- Volume: $0.15/GB/month

**Chirri MVP cost estimate (3 services + DB + Redis):**
- API server: ~0.5 vCPU, 512MB RAM → ~$15/mo
- Worker: ~0.5 vCPU, 512MB RAM → ~$15/mo
- Scheduler (lightweight): ~0.25 vCPU, 256MB RAM → ~$7.50/mo
- Postgres: ~0.5 vCPU, 1GB RAM, 5GB volume → ~$20.75/mo
- Redis: ~0.25 vCPU, 256MB RAM → ~$7.50/mo
- **Total resource usage: ~$65/mo**

**Does Chirri need static outbound IPs?**
- For MVP: **No.** Chirri monitors public URLs — it doesn't need IP whitelisting.
- Static IPs would only matter if customers need to whitelist Chirri's IP in their firewall, which is a V2/Enterprise feature.

**Does Chirri need deployment draining?**
- Railway Pro doesn't explicitly list "deployment draining" as a feature. Both plans support zero-downtime deployments via Railway's built-in deployment system.

### Definitive Recommendation: **Start on Hobby, upgrade to Pro when needed**

**Justification:**
1. **Static outbound IPs are NOT needed for MVP** — Chirri fetches public URLs.
2. **Hobby plan supports up to 48 vCPU and 48 GB RAM** — more than enough for MVP.
3. **Cost with Hobby:** $5 subscription + ~$60 usage overage = **~$65/mo total**.
4. **Cost with Pro:** $20 subscription + ~$45 usage overage = **~$65/mo total** (similar because Pro includes $20 credit).
5. Pro becomes worth it when: (a) you need static IPs, (b) you need >5GB volume storage, (c) you need >6 replicas, or (d) the included $20 credit offsets subscription cost.

**Practical advice:** Start Hobby. Switch to Pro when you hit 6+ replicas or need static IPs. The cost difference at MVP scale is minimal (~$0-5/mo).

**Caveats:**
- If Chirri stores check results in Postgres, volume storage could exceed 5GB quickly. Budget for $0.15/GB/mo beyond that (Pro gets up to 1TB).
- Redis on Railway is also container-based — no managed Redis with persistence guarantees. Consider Railway's Redis template with AOF enabled.

---

## B4. pg_partman Availability on Railway

### The Contradiction
Multiple docs specify pg_partman. Railway may not support this extension.

### Research Findings

**Railway's Postgres extension policy (from official docs):**
> "In an effort to maintain simplicity in the default templates, we do not plan to add extensions to the PostgreSQL templates."

Railway provides templates for PostGIS, TimescaleDB, and pgvector — but **pg_partman is NOT in any listed template or supported extension**. Railway's Postgres is deployed from a standard Postgres Docker image. You'd need to fork their postgres-ssl repo and build a custom image with pg_partman installed.

Railway added extension support in Aug 2025, but only for extensions that are pre-installed in the Postgres image. pg_partman requires separate installation (`apt-get install postgresql-XX-partman`).

### Definitive Recommendation: **Use native Postgres declarative partitioning + app-level cron**

**Implementation:**
```sql
-- Native Postgres range partitioning (no extension needed)
CREATE TABLE check_results (
    id TEXT NOT NULL,
    url_id TEXT NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL,
    -- ... other columns
) PARTITION BY RANGE (checked_at);

-- Create partitions manually or via app-level cron
CREATE TABLE check_results_2026_03 PARTITION OF check_results
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

**Auto-create partitions via BullMQ scheduled job:**
- Run daily: check if next month's partition exists, create if not.
- Run monthly: drop partitions older than retention period (90 days for Free, 365 for Pro).
- This is ~20 lines of code in a BullMQ repeatable job.

**Justification:**
1. pg_partman is **NOT available on Railway** without a custom Docker image.
2. Native partitioning has been in Postgres since v10 and is production-ready.
3. The only thing pg_partman adds is auto-creation/dropping of partitions — easily replicated with a ~20-line cron job.
4. Avoids operational complexity of maintaining a custom Postgres Docker image.

**Caveats:**
- Must ensure the cron job creates partitions BEFORE they're needed (create 1-2 months ahead).
- If the cron job fails, inserts to non-existent partitions will fail. Add monitoring for this.

---

## B5. better-auth API Key Plugin Compatibility

### The Contradiction
Tech Stack recommends better-auth's API key plugin. Architecture spec custom `api_keys` table with `key_hash`, `key_prefix`, `key_suffix`, `is_test`.

### Research Findings

**better-auth API Key Plugin features (from official docs, March 2026):**

| Feature Needed | Plugin Support | Details |
|---------------|---------------|---------|
| Custom key prefixes (`dk_live_`, `dk_test_`) | ✅ **YES** | `defaultPrefix` option per config, or `prefix` per key at creation. Supports multiple configs with different prefixes. |
| Key hashing | ✅ **YES** | Keys are hashed before storage. The `key` column stores the hash. |
| Test mode flag | ✅ **YES (via multiple configs)** | Use two configs: `configId: "live"` with prefix `ck_live_` and `configId: "test"` with prefix `ck_test_`. |
| `last_used_at` tracking | ✅ **YES** | Built-in — `lastUsedAt` field in schema. |
| Rate limiting | ✅ **YES** | Built-in per-config rate limiting. |
| Session mocking | ✅ **YES** | `enableSessionForAPIKeys` creates a mock session from API key, allowing dual auth paths. |
| Custom metadata | ✅ **YES** | `enableMetadata` option — arbitrary JSONB. |
| Key suffix for identification | ✅ **YES** | Plugin stores a `start` field (first N characters) for identification without exposing full key. |

### Definitive Recommendation: **Use better-auth's API key plugin. Do NOT build a custom system.**

**Configuration:**
```typescript
apiKey([
  {
    configId: "live",
    defaultPrefix: "ck_live_",
    rateLimit: { enabled: true, maxRequests: 1000, timeWindow: 3600000 },
    enableMetadata: true,
  },
  {
    configId: "test",
    defaultPrefix: "ck_test_",
    rateLimit: { enabled: true, maxRequests: 100, timeWindow: 3600000 },
    enableMetadata: true,
  },
])
```

**Justification:**
1. The plugin covers **every requirement** in the Architecture doc: custom prefixes, hashing, test/live separation (via multiple configs), last_used_at tracking.
2. The `enableSessionForAPIKeys` feature solves the dual auth path problem — API requests with a valid API key get a mock session, so all downstream code can use `session.user` regardless of whether auth came via cookie or API key.
3. Building custom is 2-3 days of work that the plugin provides for free, with built-in rate limiting and security best practices.

**Caveats:**
- The hash algorithm used by better-auth's plugin may differ from SHA-256 (likely uses the same approach as session tokens). For Chirri's purposes, this is fine — the plugin handles it securely.
- The `start` field (key prefix for identification) replaces the Architecture doc's `key_suffix` concept. Same purpose, slightly different implementation.

---

## B6. better-auth + Drizzle ORM Version Compatibility

### The Contradiction
Feasibility report found GitHub issues about better-auth's Drizzle adapter not supporting Drizzle ORM v1.0.

### Research Findings

**Current state (March 2026):**
- **better-auth latest:** v1.5.5 (includes `@better-auth/drizzle-adapter` v1.5.5, published 7 days ago)
- **Drizzle ORM v1.0:** Still in beta (`drizzle-orm@beta`). The stable release channel is still 0.x.
- **GitHub Issue #6766** (Dec 2025): "Update Drizzle ORM Adapter to support drizzle-orm@beta (v1.0)" — **OPEN, not yet resolved**.
- **GitHub Issue #1163** (Jan 2025): TypeError with `e._.fullSchema` — this was related to schema not being passed correctly, fixed in later versions.
- **better-auth Drizzle adapter since v1.4.0:** Supports joins out of the box for 2-3x performance improvements.

**Key insight:** Drizzle ORM v1.0 has NOT reached stable release. The current stable Drizzle ORM is 0.x (likely 0.36+). better-auth's adapter works fine with the stable 0.x line.

### Definitive Recommendation: **Pin Drizzle ORM to stable 0.x (e.g., `drizzle-orm@^0.36.0`). Do NOT use v1.0 beta.**

**Specific version pins:**
```json
{
  "better-auth": "^1.5.5",
  "drizzle-orm": "^0.36.0",
  "drizzle-kit": "^0.30.0"
}
```

**Justification:**
1. Drizzle ORM v1.0 is **still in beta** — using beta dependencies in production is unnecessary risk.
2. better-auth's adapter **works with stable Drizzle 0.x** and has since v1.4.0 with join support.
3. By the time Drizzle v1.0 reaches stable, better-auth will likely have updated their adapter (the issue is tracked).
4. The TypeError bugs from issue #1163 are resolved in current better-auth versions — just ensure schema is passed to the adapter.

**Caveats:**
- When Drizzle v1.0 goes stable, both packages will need a coordinated upgrade. Plan for this in V1.1.
- Always pass the Drizzle schema explicitly to the adapter: `drizzleAdapter(db, { provider: "pg", schema })`.

---

## B7. Free Plan Webhooks — 0 or 1?

### The Contradiction
Master Spec pricing table says Free gets "1 webhook." Free Tier Details says "❌ No Slack/webhook integration." Architecture says `webhookIntegration: false`.

### Research Findings

This is a **product decision**, not a research question. However, analyzing competitor behavior:

- **UptimeRobot Free:** No webhook integration.
- **Better Uptime Free:** Email only.
- **Cronitor Free:** Email + Slack (basic).

The contradiction exists because "webhook" in the pricing table likely referred to email notifications (which Free does get), while "Slack/webhook integration" refers to custom outbound webhooks to user-specified URLs.

### Definitive Recommendation: **Free gets 0 custom webhooks. Email notifications only.**

**Justification:**
1. Two out of three sources agree: no webhooks on Free (`webhookIntegration: false` and "❌ No Slack/webhook integration").
2. Custom webhooks are a significant abuse vector — Free users could use Chirri as a free webhook relay.
3. Email notifications are sufficient for Free tier. Webhooks are a natural upsell to Indie.
4. The pricing table's "1 webhook" was likely an error or referred to a different concept.

**Action:** Update the pricing table to say "Email only" for Free. Webhooks start at Indie.

---

## B8. Indie Plan Minimum Interval at Launch — 15m or 1h?

### The Contradiction
Pricing table says Indie gets 15-min checks. Multiple docs say MVP only ships 1h and 24h intervals.

### Research Findings

This is also a product decision, but there's a clear technical constraint:

**What MVP ships:** The Definitive Plan and multiple docs agree that MVP ships with **1h and 24h intervals only**. 15m/5m/1m require more scheduler complexity and significantly more infrastructure load.

**The math:**
- 1h intervals: 5,000 URLs × 24 checks/day = 120K checks/day
- 15m intervals: Each Indie URL checked 96×/day instead of 24×. If 1,000 URLs are on 15m, that's 96K extra checks/day — nearly doubling the load.

### Definitive Recommendation: **Indie launches with 1h minimum. Update pricing table.**

**Justification:**
1. The Definitive Plan explicitly says 15m is V1.1 scope.
2. Advertising 15m and delivering 1h is worse than advertising 1h and over-delivering later.
3. 15m intervals can be added as a fast-follow (V1.0.1) since it's purely a scheduler change.

**Action:** Update pricing table. Indie MVP = 1h minimum. Add 15m in V1.1 (the scheduler code is the same, just different cron schedules). When 15m ships, it's a marketing moment: "We just upgraded all Indie plans!"

**Caveats:**
- If the competitive landscape requires 15m at launch, the scheduler work is ~1-2 days additional. But it increases infrastructure costs.

---

## B9. Conditional vs Unconditional check_results Writes

### The Contradiction
Product Bible says "conditional: only write when something interesting happens." Architecture writes unconditionally.

### Research Findings

**The IOPS analysis:**
- 5,000 URLs × 24 checks/day = 120K writes/day = **~1.4 writes/second average**
- Even at peak (if checks are batched): ~50 writes/second burst
- Railway Postgres on standard volumes: **3,000+ IOPS easily** (SSD-backed)
- 120K writes/day is **trivially low** for any Postgres instance

**What breaks with conditional writes:**
- Uptime calculation requires knowing EVERY check result (up/down/timeout)
- TTFB tracking requires every response time measurement
- "Last checked at" accuracy breaks
- Users can't verify "Did Chirri actually check at 3am?"
- Debugging becomes impossible without the check history

### Definitive Recommendation: **Write unconditionally. The IOPS concern is unfounded.**

**Justification:**
1. 1.4 writes/second is **nothing** for Postgres. This is not even close to a real concern.
2. Conditional writes break core features (uptime stats, TTFB graphs, check history).
3. Storage cost at $0.15/GB/mo: 120K rows/day × 500 bytes average = 60MB/day = 1.8GB/month. At $0.15/GB, that's **$0.27/month**.
4. Use partitioning (B4) and retention policies to manage table size, not write avoidance.

**Caveats:**
- At much larger scale (100K+ URLs with 1m intervals), revisit. But that's a V2 problem with a V2 budget.

---

## B10. Email Verification — Blocking or Non-Blocking?

### The Contradiction
Master Spec says "Email verification before checks begin." URL Onboarding Flow shows URLs being created immediately.

### Research Findings

**Competitor analysis:**
- **UptimeRobot:** Non-blocking — can add monitors immediately, email verification required for notifications.
- **Better Uptime:** Blocking — must verify email before using the platform.
- **Pingdom:** Non-blocking — can use trial features immediately.

**Abuse risk analysis:**
- Without email verification, users can trigger HTTP requests to arbitrary URLs with no accountability.
- The main abuse vector: someone signs up with fake email and uses Chirri as a DDoS amplifier (24h intervals make this impractical).
- Mitigation: rate-limit URL additions for unverified accounts (max 1 URL).

### Definitive Recommendation: **Non-blocking, but limit unverified accounts to 1 URL**

**Flow:**
1. Signup → email verification sent → user can immediately add **1 URL** and it starts monitoring
2. Email verification completes → unlock full Free tier quota (3 URLs)
3. After 72h without verification → pause all monitoring, show "verify email to continue" banner

**Justification:**
1. Blocking verification kills conversion — users want to see the product work immediately.
2. Allowing 1 URL gives the "aha moment" while limiting abuse surface.
3. 72-hour grace period balances UX with accountability.
4. better-auth has built-in email verification flow — just need to check `emailVerified` before allowing URL 2+.

**Caveats:**
- Must implement the "1 URL for unverified" guard in the API layer, not just the UI.

---

## B11. Shared URL Key — Does It Include Method and Headers?

### The Contradiction
Master Spec says "Shared URL key = SHA-256(url + method + sorted headers)." But `shared_urls` table has only `url_hash TEXT`.

### Research Findings

**Practical analysis:**
- Do users ever monitor the same URL with different HTTP methods? **Extremely rare.** GET is 99%+ of monitoring. HEAD is occasionally used as an optimization.
- Do users monitor the same URL with different headers? **Almost never for MVP.** Custom headers are a Pro feature.
- If Method or headers differ, it's essentially a different monitor, and they should NOT share the same polling result.

### Definitive Recommendation: **Hash = SHA-256(normalized_url). Don't include method/headers for MVP.**

**Implementation:**
```typescript
// Normalize URL before hashing
function sharedUrlKey(url: string): string {
  const normalized = new URL(url);
  normalized.hash = ''; // strip fragment
  // lowercase scheme + host, sort query params
  return sha256(normalized.toString());
}
```

**Table change:**
- `shared_urls.url_hash` is sufficient for MVP
- Add `method` and `headers_hash` columns only when custom methods/headers ship (V1.1+)

**Justification:**
1. MVP only supports GET requests with no custom headers → method and headers are constant → including them in the hash adds no information.
2. When custom headers ship later, add a migration to include them in the hash.
3. Keeping it simple avoids premature complexity in the shared monitoring system.

**Caveats:**
- If a user adds the same URL twice (same normalized URL), they should get the shared result. The hash ensures this.
- When custom headers ship, existing shared URLs will need re-evaluation. Plan for a migration.

---

## B12. fast-xml-parser — Use or Replace?

### The Contradiction
Docs recommend fast-xml-parser for RSS/XML. Feasibility report found multiple CVEs.

### Research Findings

**CVE history (2026):**
1. **CVE-2026-25128** (Jan 2026): RangeError via numeric entity expansion. Fixed in v5.3.4.
2. **CVE-2026-26278** (Feb 2026): XML Entity Expansion bypassing limits. Fixed in v5.5.0+.
3. **CVE-2026-33036** (Mar 2026, ~1 week ago): Numeric entity expansion **bypassing the fix for CVE-2026-26278**. Incomplete fix.

**Current status:** v5.5.8 is latest (3 days old). The CVE-2026-33036 fix is presumably in this version, but the pattern of incomplete fixes is concerning — three entity expansion CVEs in 3 months suggests the security model is fragile.

**Alternatives:**
- **txml:** Pure JavaScript, claims 3x faster than fast-xml-parser, secure by design (doesn't interpret entities/external refs). But smaller ecosystem, less RSS-specific.
- **@rgrove/parse-xml:** Secure, well-tested, but slower.
- **Built-in DOMParser (via linkedom/jsdom):** Full DOM, heavy but standards-compliant.

**For RSS specifically:** Consider using a dedicated RSS parser like `rss-parser` (which internally uses `xml2js` or `sax`) rather than a raw XML parser.

### Definitive Recommendation: **Use fast-xml-parser v5.5.8+ with hardened configuration. Monitor for CVEs.**

**Hardened configuration:**
```typescript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  // Disable all entity processing
  processEntities: false,
  // Or if entities needed, set strict limits:
  maxTotalExpansions: 100,
  maxExpandedLength: 10_000,
  maxEntityCount: 20,
  maxEntitySize: 1_000,
  // Don't process external entities
  htmlEntities: false,
});
```

**Justification:**
1. fast-xml-parser has 32M downloads/week — it IS the ecosystem for Node.js XML parsing. The alternatives are either unmaintained or significantly less capable.
2. The CVEs are all entity expansion attacks. Setting `processEntities: false` **eliminates the entire attack class**. Chirri is parsing RSS feeds — it doesn't need entity expansion.
3. Active maintenance (commit 2 days ago, release 3 days ago) means fixes come quickly.
4. Switching to txml is possible but would require more integration work for RSS parsing.

**Caveats:**
- Must disable entity processing (`processEntities: false`) — this is the single most important security config.
- Add a wrapper function that enforces configuration and input size limits (max 5MB XML input).
- Set up Dependabot/Snyk alerts for this specific package.

---

## B13. Discovery Pipeline SSRF Protection

### The Contradiction
Discovery pipeline probes 15 paths on arbitrary domains with NO documented SSRF protection.

### Research Findings

**OWASP SSRF Prevention recommendations for Node.js:**
1. **URL validation:** Parse and validate URL before any request. Block private IP ranges.
2. **DNS resolution pinning:** Resolve hostname → IP, validate IP, then connect directly to the validated IP (avoids DNS rebinding).
3. **Block private ranges:** 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, ::1, fc00::/7, fe80::/10, etc.
4. **Use a dedicated library:** `ssrf-req-filter` or custom `dns.lookup` override.

**For Chirri's discovery pipeline specifically:**
- Discovery probes constructed URLs like `https://{domain}/status`, `https://{domain}/api/v1/health`, etc.
- The domain comes from user input (the URL they're monitoring).
- DNS rebinding: attacker's domain resolves to public IP during URL-add validation, then resolves to 169.254.169.254 (cloud metadata) during discovery.

### Definitive Recommendation: **Implement a `safeFetch()` function that ALL outbound requests use**

**Design:**
```typescript
import { isIP } from 'net';
import dns from 'dns/promises';

const BLOCKED_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, // CGN
  /^::1$/, /^fe80:/i, /^fc00:/i, /^fd/i,
];

async function safeFetch(url: string, options?: RequestInit): Promise<Response> {
  const parsed = new URL(url);
  
  // 1. Only allow http/https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('SSRF: blocked protocol');
  }
  
  // 2. Resolve DNS and validate IP
  const { address } = await dns.lookup(parsed.hostname);
  if (BLOCKED_RANGES.some(r => r.test(address))) {
    throw new Error('SSRF: blocked IP range');
  }
  
  // 3. Connect directly to resolved IP (prevents DNS rebinding)
  // Use the resolved IP in the request, set Host header manually
  const targetUrl = new URL(url);
  targetUrl.hostname = address;
  
  return fetch(targetUrl.toString(), {
    ...options,
    headers: {
      ...options?.headers,
      Host: parsed.host,
    },
    redirect: 'manual', // Don't follow redirects to internal IPs
    signal: AbortSignal.timeout(10_000), // 10s timeout
  });
}
```

**Key principles:**
1. **ALL outbound HTTP** goes through `safeFetch()` — monitoring checks, discovery probes, webhook verification.
2. **DNS resolution + IP validation happens atomically** — resolve hostname, check IP, connect to that specific IP.
3. **Redirects are NOT auto-followed** — each redirect target must be re-validated through `safeFetch()`.
4. **Cloud metadata protection:** Block 169.254.169.254 and equivalent IPv6 addresses explicitly.

**Caveats:**
- Direct IP connection with Host header may break some CDNs/load balancers that route by SNI. In those cases, validate the IP after DNS resolution but before connecting, and use the original hostname for the connection — accept the small TOCTOU window.
- Consider using the `agent-fetch` npm package which handles this with Rust-level guarantees, though it adds a native dependency.

---

## B14. Cross-Tenant Leakage via Shared Source Model

### The Contradiction
Shared source model creates timing oracles. `discovered_by` could expose who first monitored a domain.

### Research Findings

**Timing oracle analysis:**
- Adding a URL on an already-monitored domain: immediate response (shared URL exists, link user)
- Adding a URL on a fresh domain: slower response (DNS validation, first fetch, baseline creation)
- Timing difference: ~50-500ms vs ~2-5 seconds
- **This IS exploitable** — an attacker can determine which domains are being monitored by measuring response times.

**`discovered_by` field:**
- If exposed in API responses, directly leaks which user first added a domain.
- Even if not exposed, JOINs or debug logs could leak it.

### Definitive Recommendation: **Normalize timing + strip metadata**

**Implementation:**
1. **Normalize URL-add response time:** Add artificial delay to make fresh and shared domain adds take the same time (~3 seconds). Do the actual work asynchronously.
   ```typescript
   // Always return in ~3 seconds regardless of cache hit
   const STANDARD_RESPONSE_TIME = 3000;
   const startTime = Date.now();
   const result = await addUrl(url);
   const elapsed = Date.now() - startTime;
   await sleep(Math.max(0, STANDARD_RESPONSE_TIME - elapsed));
   return result;
   ```

2. **Never expose `discovered_by` in any API response.** This field is for internal analytics only.

3. **Privacy-filter shared source metadata:**
   - API responses should never include other users' data
   - Shared source `subscriber_count` should be hidden or bucketed ("used by many" vs exact count)

**Justification:**
1. Timing normalization is cheap (~3s delay is acceptable for a "add URL" action).
2. The privacy risk is real but bounded — an attacker learns "someone monitors stripe.com" which is... obvious.
3. For less obvious domains, the timing oracle could reveal competitive intelligence.

**Caveats:**
- Perfect timing normalization is hard (network jitter exists). The goal is to make the difference non-exploitable, not zero.
- For V2, consider processing all URL additions asynchronously (return 202 Accepted, deliver result via webhook/polling).

---

## B15. ReDoS Risk in Regex-Heavy Relevance Matching

### The Contradiction
PATH_PATTERNS and FUTURE_INTENT_PATTERNS run against attacker-controlled content with no timeout. Nested quantifiers can cause catastrophic backtracking.

### Research Findings

**Specific vulnerable patterns identified:**
- `(?:\/[\w\-\.]+)+` — nested quantifier on a repeating character class. Input like `/a/a/a/a/a/a/a/a/a/a/a/a!` causes exponential backtracking.
- `matchGlob()` converting user input to regex — user-controlled patterns become regex, classic ReDoS vector.

**Available solutions:**
1. **`re2` npm package** (node-re2): Node.js bindings for Google's RE2 engine. Guarantees linear-time matching. ~4M downloads/week, actively maintained.
   - **Caveat:** Native C++ addon — requires compilation or prebuild binaries. May complicate deployment.
2. **`re2js`**: Pure JavaScript port of RE2. No native dependencies. Slower than native RE2 but still linear-time.
   - Better for deployment simplicity.
3. **Timeout wrapper:** Run regex in a Worker thread with a timeout. Doesn't prevent the CPU spike but limits its impact.

### Definitive Recommendation: **Use `re2js` for all pattern matching against untrusted content + hard timeout**

**Implementation:**
```typescript
import RE2 from 're2js';

// All relevance matching patterns compiled with RE2
const PATH_PATTERN = RE2.compile('(?:/[\\w\\-\\.]+)+');

// For matchGlob() — convert glob to RE2-safe regex
function matchGlob(pattern: string, input: string): boolean {
  const regexStr = globToRegex(pattern); // convert * → .*, ? → .
  try {
    const re = RE2.compile(regexStr);
    return re.matches(input);
  } catch {
    return false; // invalid pattern = no match
  }
}
```

**Additional safeguards:**
1. **Input size limits:** Truncate content to 100KB before regex matching. No changelog is larger than this.
2. **Pattern audit:** Review all regex patterns and rewrite any with nested quantifiers. Replace `(?:\/[\w\-\.]+)+` with `(?:\/[\w\-\.]{1,100}){1,20}` (bounded repetition).
3. **Per-operation timeout:** 5 second timeout per relevance analysis operation (across all patterns for one document).

**Justification:**
1. `re2js` guarantees linear-time matching — **eliminates ReDoS entirely** regardless of input.
2. Pure JavaScript — no native compilation issues on Railway deployment.
3. RE2 doesn't support some advanced regex features (backreferences, lookahead) but none of Chirri's patterns need them.
4. `matchGlob()` is the most dangerous vector — user input becomes regex. RE2 makes this safe.

**Caveats:**
- `re2js` is ~2-5x slower than native regex for non-pathological inputs. For Chirri's use case (matching patterns against changelog text), this is negligible.
- Some regex features not supported by RE2: backreferences (`\1`), lookahead/lookbehind (`(?=...)`, `(?<=...)`). Audit patterns for these.

---

## B16. chrono-node Forward Date Bias

### The Contradiction
`chrono.parse(section, new Date(), { forwardDate: true })` misinterprets past dates in changelogs. "On March 15, we deprecated v1" becomes March 15 of next year.

### Research Findings

**How chrono-node's `forwardDate` works:**
- When `forwardDate: true`, ambiguous dates (day names, month-day without year) are resolved to the **next occurrence** in the future.
- "Friday" → next Friday (not last Friday)
- "March 15" → next March 15 (even if 11 months away)
- This is designed for scheduling ("remind me Friday") not for changelog parsing.

**The problem for Chirri:**
- Changelogs contain BOTH past events and future deadlines.
- "On March 15, we deprecated v1 API" → past event, should NOT be treated as future forecast.
- "v1 API will be removed on June 30, 2026" → future deadline, IS a forecast.
- `forwardDate: true` makes BOTH forward-biased, producing false forecasts for past events.

### Definitive Recommendation: **Parse WITHOUT `forwardDate`. Use contextual heuristics to determine past vs future.**

**Implementation:**
```typescript
import * as chrono from 'chrono-node';

function parseChangelogDates(text: string, publishDate?: Date): ParsedDate[] {
  const refDate = publishDate || new Date();
  
  // Parse WITHOUT forwardDate
  const results = chrono.parse(text, refDate);
  
  return results.map(r => {
    const date = r.start.date();
    const isFuture = date > refDate;
    
    // Context clues for classification
    const surroundingText = text.substring(
      Math.max(0, r.index - 100), 
      r.index + r.text.length + 100
    );
    
    const futureIndicators = /\b(will|upcoming|planned|scheduled|deadline|by|until|before|end of life|sunset|removal date|deprecated? on)\b/i;
    const pastIndicators = /\b(was|were|released|shipped|launched|fixed|resolved|completed|deprecated|removed|announced)\b/i;
    
    const hasFutureContext = futureIndicators.test(surroundingText);
    const hasPastContext = pastIndicators.test(surroundingText);
    
    return {
      date,
      text: r.text,
      type: isFuture || hasFutureContext ? 'forecast' : 'event',
      confidence: (isFuture && hasFutureContext) ? 'high' : 
                  (!isFuture && hasPastContext) ? 'high' : 'low',
    };
  });
}
```

**Key principles:**
1. **Never use `forwardDate: true`** for changelog parsing.
2. **Use the changelog's publish date as reference**, not `new Date()`. If parsing a changelog entry from January, dates should be resolved relative to January.
3. **Only dates explicitly in the future (relative to publish date) with future-tense context words are forecasts.** Everything else is a historical event.
4. **The post-filter `r.start.date() > new Date()` is correct for forecasts** — but only AFTER properly classifying the date as a forecast.

**Caveats:**
- Dates without year AND without clear context (e.g., "March 15") remain ambiguous. Default to the year of the changelog entry's publish date.
- Some changelogs use dates in headers without tense context. For these, if the date has a full year (e.g., "March 15, 2026"), chrono-node parses it correctly regardless of `forwardDate`.
- Only ambiguous dates (month + day, no year) are affected by this bug. Fully specified dates parse correctly.

---

## Summary of All Recommendations

| Item | Decision | One-Line Summary |
|------|----------|-----------------|
| **B1** | Hono | Native better-auth integration, TypeScript-first, lightweight |
| **B2** | Prefixed nanoid | `usr_`, `url_`, `chg_` + nanoid(21). App-side generation. TEXT PKs. |
| **B3** | Start Hobby | ~$65/mo either way. Pro when you need static IPs or >5GB storage. |
| **B4** | Native partitioning | pg_partman NOT on Railway. Use native + BullMQ cron job. |
| **B5** | Use better-auth plugin | Covers all requirements: custom prefixes, test/live configs, session mocking. |
| **B6** | Pin Drizzle 0.x | Drizzle v1.0 still beta. Pin `drizzle-orm@^0.36.0`. Upgrade later. |
| **B7** | 0 webhooks on Free | Email only. Two of three sources agree. Webhooks = Indie+. |
| **B8** | 1h minimum at launch | 15m is V1.1. Don't advertise what you can't deliver. |
| **B9** | Write unconditionally | 1.4 writes/sec is trivial. Conditional breaks uptime/TTFB stats. |
| **B10** | Non-blocking (1 URL limit) | Unverified: 1 URL. Verified: full quota. 72h grace period. |
| **B11** | Hash URL only (MVP) | Method/headers constant in MVP (GET only). Add when custom headers ship. |
| **B12** | fast-xml-parser + hardened config | Disable entity processing. Set limits. Monitor CVEs. |
| **B13** | safeFetch() everywhere | DNS-resolve → validate IP → connect to IP. Block private ranges. |
| **B14** | Normalize timing + strip metadata | 3s standard response. Never expose `discovered_by`. |
| **B15** | re2js for all pattern matching | Linear-time regex. Eliminates ReDoS entirely. Pure JS. |
| **B16** | No forwardDate. Context heuristics. | Parse dates relative to publish date. Classify via tense keywords. |

---

*All recommendations based on research conducted 2026-03-24 with real data from official documentation, GitHub issues, and npm registries.*
