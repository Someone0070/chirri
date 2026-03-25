# Chirri Rate Limiting Design

> **Note:** Canonical rate limits are in CHIRRI_BIBLE.md Section 5.9 and 6.2. This document provides research and design rationale. When values here conflict with the Bible, the Bible wins. *(Aligned 2026-03-24 -- matches Bible v2.2)*

> Research-backed rate limiting strategy for the Chirri API change detection service.

---

## Part 1: Research — How Top APIs Handle Rate Limiting

### 1. Stripe

| Aspect | Details |
|--------|---------|
| **Limits** | 100 req/s live mode, 25 req/s sandbox. Per-endpoint limits on top (e.g., Files: 20 r/w per sec, Search: 20 read/s, Payouts: 15 req/s) |
| **Scoping** | Per-account (API key). Not per-IP for authenticated requests |
| **Read vs Write** | Separate allocation for reads (500 req/transaction, min 10k/month). Writes have no allocation limit |
| **Strategy** | Request rate limiter + concurrent request limiter (max 20 concurrent). Four limiter types in production |
| **Burst** | Allows brief bursts above cap for real-time events (flash sales) |
| **429 response** | Returns `429` with `Stripe-Rate-Limited-Reason` header (values: `global-concurrency`, `global-rate`, `endpoint-concurrency`, `endpoint-rate`, `resource-specific`) |
| **Headers** | No standard X-RateLimit headers. Uses custom `Stripe-Rate-Limited-Reason` |
| **Scaling** | Can request limit increases via support. Enterprise gets custom limits |
| **Key insight** | Uses **4 limiter types in concert**: request rate, concurrent requests, fleet-wide load shedder, worker utilization load shedder |

### 2. GitHub

| Aspect | Details |
|--------|---------|
| **Limits** | Unauthenticated: 60 req/hour. Authenticated: 5,000 req/hour. Enterprise: 15,000 req/hour. GitHub Actions: 1,000 req/hour per repo |
| **Scoping** | Per-user (authenticated) or per-IP (unauthenticated). App installations scale with repos/users (+50 req/hr per repo/user over 20) |
| **Secondary limits** | Point-based system: max 900 points/min (REST), 100 concurrent requests, 80 content-generating req/min, 500/hour |
| **Read vs Write** | **YES** — content-generating (write) requests have stricter secondary limits (80/min, 500/hr) vs read requests |
| **Strategy** | Fixed window (per hour) for primary. Point-based for secondary |
| **Cost-based** | GET requests cost 1 point, mutating requests cost higher points in secondary limits |
| **429 response** | Returns `429` with `Retry-After` header |
| **Headers** | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` (Unix epoch), `X-RateLimit-Used`, `X-RateLimit-Resource` |
| **Key insight** | **Two-tier system**: generous primary limits + strict secondary limits for abuse prevention. Separate buckets for different resource types (core, search, graphql, code_scanning) |

### 3. OpenAI

| Aspect | Details |
|--------|---------|
| **Limits** | RPM (requests/min), RPD (requests/day), TPM (tokens/min), TPD (tokens/day), IPM (images/min) — whichever hits first |
| **Scoping** | Per-organization AND per-project. Not per-user |
| **Per-model** | Different limits per model. Shared limits for model families |
| **Tiered scaling** | 5 tiers based on spend: Free ($100/mo), Tier 1 ($5 paid → $100/mo), Tier 2 ($50 → $500/mo), Tier 3 ($100 → $1K/mo), Tier 4 ($250 → $5K/mo), Tier 5 ($1K → $200K/mo) |
| **Strategy** | Fixed window (per minute/day). Dual-dimension: both request count AND token count enforced simultaneously |
| **429 response** | Returns `429` |
| **Headers** | `x-ratelimit-limit-requests`, `x-ratelimit-limit-tokens`, `x-ratelimit-remaining-requests`, `x-ratelimit-remaining-tokens`, `x-ratelimit-reset-requests`, `x-ratelimit-reset-tokens` |
| **Key insight** | **Automatic tier graduation** based on spend. Dual-dimension limiting (requests + tokens). Per-model differentiation |

### 4. Vercel

| Aspect | Details |
|--------|---------|
| **Limits** | Platform limits vary by plan (Hobby/Pro/Enterprise). Deployments: 100/day hobby, 6000/day pro |
| **Scoping** | Per-team for API, per-IP for WAF rate limiting |
| **Strategy** | Offers rate limiting SDK (sliding window via `@vercel/ratelimit` backed by Upstash Redis) |
| **Plan-based** | Hobby vs Pro vs Enterprise with different limits across all resources |
| **Key insight** | Uses **sliding window** algorithm in their rate limiting SDK. Promotes plan-based differentiation |

### 5. Cloudflare

| Aspect | Details |
|--------|---------|
| **Limits** | Global: 1,200 req/5 min per user. Per-IP: 200/sec. GraphQL: max 320/5 min (varies by query cost) |
| **Scoping** | Per-user (cumulative across dashboard + API key + API token) AND per-IP |
| **Endpoint-specific** | Cache Purge, GraphQL, Rulesets, Lists APIs all have separate documented limits |
| **429 response** | Returns `429 Too Many Requests`. Blocks ALL calls for next 5 minutes if exceeded |
| **Headers** | `Ratelimit` (remaining + reset), `Ratelimit-Policy` (quota + window), `Retry-After` (seconds, only on 429) |
| **Enterprise** | Can request higher limits via support |
| **Key insight** | Uses **modern RFC 9110 Ratelimit headers** (`Ratelimit`, `Ratelimit-Policy`). Punitive: exceeding blocks everything for 5 min. GraphQL cost-based limiting |

### 6. Twilio

| Aspect | Details |
|--------|---------|
| **Limits** | REST API concurrency limit per account. Messaging: per-sender queuing. MMS: per-phone-number AND per-account-SID level |
| **Scoping** | Per-account (concurrency) + per-resource (per phone number) |
| **Strategy** | **Concurrency-based** rather than rate-based. Queuing model — messages queue at per-sender level |
| **429 response** | Returns `429 Too Many Requests` (Error code 20429) |
| **Key insight** | **Concurrency limiter** model. Queues requests rather than rejecting them outright. Multi-level: account + resource |

### 7. Railway

| Aspect | Details |
|--------|---------|
| **Limits** | Free: 100 RPH, Hobby: 1,000 RPH, Pro: 10,000 RPH, Enterprise: custom |
| **Scoping** | Per-token |
| **Headers** | `x-ratelimit-limit: 1000` seen in responses |
| **Strategy** | Simple per-hour window, scales 10x per plan tier |
| **Key insight** | **Clean 10x scaling between tiers**. Simple, easy to understand. GraphQL API so query cost isn't differentiated |

### 8. UptimeRobot (Monitoring-specific)

| Aspect | Details |
|--------|---------|
| **Limits** | Free: 10 req/min. Pro: `monitor_count × 2` req/min (max 5,000 req/min) |
| **Scoping** | Per-account (API key) |
| **Plan-based** | Scales with number of monitors — **usage-proportional limiting** |
| **Key insight** | **Limits scale with what you're paying for**. If you have 200 monitors, you get 400 req/min. This is the most relevant model for Chirri — monitoring tool API limits should scale with monitored resources |

### 9. Checkly (Monitoring-specific)

| Aspect | Details |
|--------|---------|
| **Limits** | Most routes: 300 req/60 sec. Some routes have lower limits |
| **Scoping** | Per-account |
| **Endpoint-specific** | Different routes have different limits |
| **Key insight** | **Per-route differentiation** — expensive operations have lower limits |

---

## Part 2: Key Findings

### 1. Per-key vs per-IP vs per-plan vs per-endpoint

**Best practice: Per-key (primary) + per-IP (unauthenticated/abuse protection) + per-plan (scaling) + per-endpoint (cost-based)**

- Every API uses per-key/per-account as the primary dimension
- Per-IP is used as a secondary defense (Cloudflare, GitHub unauthenticated)
- Per-plan scaling is universal (Railway 10x, OpenAI tiers, UptimeRobot proportional)
- Per-endpoint differentiation is common for expensive operations (Stripe, GitHub, Checkly)

### 2. Read vs Write Differentiation

**YES — most mature APIs differentiate.**

- GitHub: Strictest — 80 content-generating (write) req/min vs 900 points/min for reads
- Stripe: Separate read allocation (500 per transaction), writes unlimited allocation
- OpenAI: Different per model/endpoint
- **Recommendation**: Chirri should have higher read limits, lower write limits

### 3. Burst vs Sustained — Algorithm Choice

| API | Algorithm |
|-----|-----------|
| Stripe | Token bucket (recommended in their blog post) + concurrency limiter |
| GitHub | Fixed window (hourly) + point-based secondary |
| OpenAI | Fixed window (per minute/day) |
| Cloudflare | Fixed window (5 min) |
| Vercel SDK | Sliding window (via Upstash Redis) |
| Railway | Fixed window (hourly) |

**Recommendation**: **Sliding window** is the best balance. Fixed windows have the "boundary burst" problem (2x burst at window edges). Token bucket is ideal but more complex. Sliding window counters (Redis ZSET or dual-counter approach) are simple and effective.

### 4. Cost-based Limiting

- **GitHub**: Point system (GET=1pt, mutations=higher)
- **Cloudflare GraphQL**: Query cost calculation
- **Stripe**: Endpoint-specific limits (Files, Search, Payouts have their own)
- **Checkly**: Per-route limits
- **Recommendation**: Chirri should weight expensive endpoints higher

### 5. Rate Limit Headers — Industry Standard

**The standard headers** (used by GitHub, OpenAI, Railway, and most APIs):

```
X-RateLimit-Limit: 1000          # max allowed in window
X-RateLimit-Remaining: 999       # remaining in current window
X-RateLimit-Reset: 1703289600    # Unix epoch when window resets
Retry-After: 30                  # seconds until retry (only on 429)
```

**Modern alternative** (Cloudflare uses RFC draft):
```
Ratelimit: "default";r=50;t=30
Ratelimit-Policy: "default";q=100;w=60
```

**Recommendation**: Use the `X-RateLimit-*` convention — it's the most widely understood. Include `Retry-After` on 429 responses.

### 6. Standard 429 Response

Every API uses `429 Too Many Requests`. Standard response body:

```json
{
  "error": {
    "type": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Retry after 30 seconds.",
    "retry_after": 30
  }
}
```

### 7. Plan Scaling

| API | Scaling Pattern |
|-----|----------------|
| Railway | 10x between tiers (100 → 1K → 10K) |
| OpenAI | Graduated tiers based on spend |
| UptimeRobot | Proportional to monitored resources |
| GitHub | 60 → 5K → 15K (auth-based) |

**Recommendation**: Combine Railway's clean tier multiplier with UptimeRobot's proportional model — base limit per plan, with bonus for number of monitored URLs.

### 8. Handling Legitimate Heavy Users

- **UptimeRobot**: Limits = monitor_count × 2 (scales with usage)
- **Stripe**: Request limit increases via support
- **GitHub**: App installations scale with repos (+50/hr per repo)
- **OpenAI**: Automatic tier graduation with spend
- **Recommendation**: Chirri should scale API limits with URL count. Someone with 200 URLs legitimately needs more API calls than someone with 5.

---

## Part 3: Chirri Rate Limiting Design

### Strategy: Sliding Window Counter

Use **sliding window counter** in Redis. It's the sweet spot between:
- Fixed window (too simple, boundary burst problem)
- Token bucket (ideal but more complex state management)
- Sliding window log (accurate but memory-heavy)

The sliding window counter approximates a true sliding window using two fixed windows and a weighted average. Simple, accurate enough, and memory-efficient.

### Scoping: Per-Key + Per-IP (layered)

```
Layer 1: Per-API-Key (primary) — tied to plan limits
Layer 2: Per-IP (secondary) — abuse protection for unauthenticated/public endpoints
Layer 3: Per-Endpoint (tertiary) — cost-based differentiation
```

### Plan-Based Limits

Inspired by UptimeRobot's proportional model + Railway's tier multipliers:

| Plan | API Requests/Hour | Notes |
|------|-------------------|-------|
| **Unauthenticated** | 20/IP | Per-IP sliding window |
| **Free** | 10 | Per API key/session |
| **Personal** ($5/mo) | 60 | Per API key/session |
| **Team** ($19/mo) | 200 | Per API key/session |
| **Business** ($49/mo) | 500 | Per API key/session |
| **Enterprise** | Custom | Custom |

*(Aligned 2026-03-24 -- matches Bible v2.2)*

**Window:** Per-hour sliding window using Redis Sorted Set with 3700s TTL, as specified in Bible §5.3. *(Aligned 2026-03-24 -- matches Bible v2.2)*

**Note:** The read/write split, per-URL bonus, burst allowance, and concurrency limiter described in the research sections below are design considerations NOT yet adopted in the Bible. They remain valid research for future enhancement.

### Read vs Write Differentiation

**Read endpoints** (2x multiplier on base limit):
- `GET /v1/urls` — list monitors
- `GET /v1/urls/:id` — get monitor details
- `GET /v1/urls/:id/history` — get check history
- `GET /v1/urls/:id/status` — current status
- `GET /v1/account` — account info

**Write endpoints** (base limit):
- `POST /v1/urls` — create monitor (expensive: triggers validation, DNS lookup)
- `PUT /v1/urls/:id` — update monitor
- `DELETE /v1/urls/:id` — delete monitor
- `POST /v1/urls/:id/check` — trigger manual check (most expensive)
- `POST /v1/urls/:id/pause` / `POST /v1/urls/:id/resume`

**Expensive endpoints** (stricter sub-limits):
- `POST /v1/urls` — max 10/min regardless of plan (creates infrastructure)
- `POST /v1/urls/:id/check` — max 5/min per URL (triggers actual HTTP check)

### Headers — Every Response

Include on **every** API response, not just 429s:

```http
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 195
X-RateLimit-Reset: 1703289660
X-RateLimit-Resource: read
```

On 429 responses, add:

```http
Retry-After: 12
```

### 429 Response Format

```json
{
  "error": {
    "type": "rate_limit_exceeded",
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded for write operations. You can make 200 write requests per minute on the Pro plan.",
    "retry_after": 12,
    "limit": {
      "resource": "write",
      "limit": 200,
      "remaining": 0,
      "reset": 1703289660,
      "reset_iso": "2024-12-23T10:01:00Z"
    },
    "docs": "https://docs.chirri.co/api/rate-limits"
  }
}
```

### Redis Implementation

#### Data Structure

Use **two Redis keys per window** for the sliding window counter approach:

```
Key pattern: rl:{api_key}:{resource}:{window_timestamp}
TTL: 2 × window_size (auto-cleanup)
```

#### Lua Script (Atomic Sliding Window Counter)

```lua
-- KEYS[1] = current window key (e.g., rl:key123:write:17032896)
-- KEYS[2] = previous window key (e.g., rl:key123:write:17032895)
-- ARGV[1] = limit
-- ARGV[2] = window_size_seconds (60)
-- ARGV[3] = current_timestamp

local current_window = tonumber(redis.call('GET', KEYS[1]) or '0')
local previous_window = tonumber(redis.call('GET', KEYS[2]) or '0')
local window_size = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local limit = tonumber(ARGV[1])

-- Calculate position in current window (0.0 to 1.0)
local window_start = math.floor(now / window_size) * window_size
local elapsed = now - window_start
local weight = elapsed / window_size

-- Weighted count: full current window + proportional previous window
local count = current_window + previous_window * (1 - weight)

if count >= limit then
  -- Calculate retry_after: time until enough capacity frees up
  local retry_after = math.ceil(window_size - elapsed)
  return {0, math.ceil(count), retry_after}  -- denied
end

-- Increment current window
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], window_size * 2)

return {1, math.ceil(count) + 1, 0}  -- allowed, new count, no retry needed
```

#### Redis Key Examples

```
rl:chirri_key_abc123:read:28388816     → "45"    (TTL: 120s)
rl:chirri_key_abc123:write:28388816    → "12"    (TTL: 120s)
rl:chirri_key_abc123:check:28388816    → "2"     (TTL: 120s)
rl:ip:192.168.1.1:global:28388816     → "30"    (TTL: 120s)
```

#### Memory Estimate

Per API key: ~6 keys active at any time (3 resources × 2 windows) × ~50 bytes = ~300 bytes/key
1,000 active API keys → ~300KB Redis memory. Negligible.

### IP-Based Fallback (Unauthenticated)

For requests without an API key (public status pages, etc.):

| Resource | Limit |
|----------|-------|
| Public endpoints | 30 req/min per IP |
| All endpoints | Blocked (401) |

### Implementation Middleware (Pseudocode)

```typescript
async function rateLimit(req: Request): Promise<RateLimitResult> {
  const apiKey = req.headers['x-api-key'];
  const plan = await getPlan(apiKey); // cached in Redis
  const urlCount = await getUrlCount(apiKey); // cached

  // Calculate limits based on plan + URL count
  const isWrite = ['POST', 'PUT', 'DELETE'].includes(req.method);
  const isExpensive = isExpensiveEndpoint(req.path, req.method);

  let limit: number;
  let resource: string;

  if (isExpensive) {
    limit = EXPENSIVE_LIMITS[req.path] ?? 10;
    resource = 'expensive';
  } else if (isWrite) {
    limit = plan.baseWriteRPM + (urlCount * plan.bonusPerUrl);
    limit = Math.min(limit, plan.maxWriteRPM);
    resource = 'write';
  } else {
    limit = (plan.baseWriteRPM + (urlCount * plan.bonusPerUrl)) * 2;
    limit = Math.min(limit, plan.maxReadRPM);
    resource = 'read';
  }

  // Check sliding window in Redis (Lua script)
  const [allowed, count, retryAfter] = await redis.evalsha(
    SLIDING_WINDOW_SHA,
    2,
    `rl:${apiKey}:${resource}:${currentWindow()}`,
    `rl:${apiKey}:${resource}:${previousWindow()}`,
    limit,
    60, // window size
    Date.now() / 1000
  );

  return {
    allowed: allowed === 1,
    limit,
    remaining: Math.max(0, limit - count),
    reset: nextWindowReset(),
    retryAfter,
    resource
  };
}
```

### Concurrency Limiter (For Manual Checks)

Inspired by Stripe's concurrent request limiter. For `POST /v1/urls/:id/check`:

```
Max concurrent manual checks per API key: 3
```

Redis implementation: Use a sorted set with timestamps, clean up completed/expired entries.

```
Key: rl:concurrent:{api_key}:check
Type: Sorted Set (score = timestamp, member = request_id)
```

---

## Part 4: Summary — Chirri's Rate Limiting Stack

```
┌─────────────────────────────────────────────────┐
│                  Request Arrives                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. IP Rate Limit (Layer 1)                     │
│     └─ 30 req/min per IP (unauthenticated)      │
│     └─ 200 req/min per IP (authenticated, abuse) │
│                                                 │
│  2. API Key Rate Limit (Layer 2)                │
│     └─ Sliding window counter in Redis          │
│     └─ Separate read/write buckets              │
│     └─ Plan-based + URL-count scaling           │
│                                                 │
│  3. Endpoint Rate Limit (Layer 3)               │
│     └─ POST /v1/urls: max 10/min               │
│     └─ POST /v1/urls/:id/check: max 5/min      │
│                                                 │
│  4. Concurrency Limit (Layer 4)                 │
│     └─ Manual checks: max 3 concurrent          │
│                                                 │
├─────────────────────────────────────────────────┤
│  Response Headers (always):                     │
│     X-RateLimit-Limit: 200                      │
│     X-RateLimit-Remaining: 195                  │
│     X-RateLimit-Reset: 1703289660               │
│     X-RateLimit-Resource: read                  │
│                                                 │
│  On 429 (add):                                  │
│     Retry-After: 12                             │
│     Body: { error, retry_after, limit details } │
└─────────────────────────────────────────────────┘
```

### Why This Design Works for Chirri

1. **UptimeRobot-inspired proportional scaling** — users with more URLs get higher limits automatically. No support tickets needed.

2. **Read/write split** — dashboards hammering GET endpoints won't eat into the budget for creating monitors.

3. **Expensive endpoint protection** — manual checks and URL creation have sub-limits so one user can't DoS the checking infrastructure.

4. **Simple to understand** — "Your plan gives you X writes/min and 2X reads/min, plus a bonus per monitored URL."

5. **Redis-efficient** — sliding window counters use ~300 bytes per active API key. No memory concerns even at scale.

6. **Standard headers** — any HTTP client or library can parse X-RateLimit headers. Retry-After makes automatic backoff trivial.

7. **Layered defense** — IP limits catch abuse before it even reaches the API key check. Concurrency limits prevent resource exhaustion from expensive operations.
