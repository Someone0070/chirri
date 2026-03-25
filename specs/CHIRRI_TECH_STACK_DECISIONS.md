# Chirri Tech Stack Decisions

> Researched 2026-03-24. Definitive recommendations for each gap in the stack.

---

## 1. Dashboard Framework

### Do We Need SSR?

**No.** The dashboard is behind auth — there's no SEO benefit. Public pages (landing, docs, changelog) can be a separate static site (Astro, plain HTML, whatever). Shipping an SSR framework for an authenticated dashboard adds complexity for zero user benefit.

### Comparison

| Framework | Pros | Cons | Verdict |
|-----------|------|------|---------|
| **Next.js (App Router)** | Massive ecosystem, tons of UI libraries, server components | Overcomplicated for a SPA dashboard, Vercel lock-in pressure, bloated for our use case, App Router still has DX friction | ❌ Overkill |
| **SvelteKit** | Excellent DX, tiny bundles, fast, compiler-based reactivity | Smaller ecosystem, fewer component libraries for complex dashboards (diff viewers, tree views), hiring pool smaller | ❌ Ecosystem gap |
| **Remix** | Good data loading patterns, web standards focused | Merged into React Router v7, identity crisis, shrinking community | ❌ Uncertain future |
| **Vite + React (SPA)** | Simple mental model, huge React ecosystem, fast dev server, no SSR complexity, deploy as static files anywhere | No SSR (we don't need it), slightly more manual routing setup | ✅ Winner |

### What Do Industry Leaders Use?

- **Linear**: React SPA (custom sync engine, no SSR framework)
- **Vercel Dashboard**: Next.js (they built it, so obviously)
- **Stripe Dashboard**: React SPA
- **Grafana**: React SPA
- **Railway Dashboard**: React

The pattern is clear: **developer tool dashboards are SPAs.** They don't need SSR. They need fast client-side interactions, WebSocket/SSE for real-time updates, and rich component libraries.

### Recommendation: **Vite + React + React Router**

**Justification:**
- Our dashboard needs: side-by-side diffs (react-diff-viewer), tree views (react-arborist), real-time updates (SSE/WebSocket), syntax highlighting (Shiki). All are React libraries.
- No SSR complexity. Deploy as static files to Railway or any CDN.
- Vite gives instant HMR, fast builds, native TypeScript support.
- React Router v7 for client-side routing.
- TanStack Query for server state management (caching, refetching, optimistic updates).
- The entire React component ecosystem is available without framework adaptation layers.

**Key libraries:**
- `vite` + `@vitejs/plugin-react`
- `react-router` (v7)
- `@tanstack/react-query` (server state)
- `zustand` (client state, if needed)
- `tailwindcss` + `shadcn/ui` (component library)

---

## 2. Auth Implementation

### Architecture: Two Auth Paths

```
Dashboard Users → Email/Password → Session Cookie → Dashboard API
API Consumers  → API Key (header) → Validate → API/MCP endpoints
```

### Session Strategy: **Cookie-based sessions (NOT JWTs for dashboard auth)**

**Why not JWTs for dashboard auth:**
- JWTs can't be revoked without a blocklist (which is basically reimplementing sessions)
- Session cookies are simpler, more secure (HttpOnly, SameSite, Secure flags)
- No token refresh dance needed for the dashboard
- Smaller payload on every request

**JWTs are fine for:** Short-lived tokens if we ever need service-to-service auth. But for user-facing dashboard auth, sessions win.

### Auth Library: **better-auth**

**Why better-auth over alternatives:**

| Library | Status | Verdict |
|---------|--------|---------|
| **Lucia** | **Deprecated** (author announced deprecation in late 2024, recommends implementing from scratch or using better-auth) | ❌ Dead |
| **Passport.js** | Maintained but old-school, callback-heavy, docs are poor | ❌ Legacy |
| **Auth.js (NextAuth)** | Tied to Next.js ecosystem, session handling is opinionated and rigid | ❌ Wrong ecosystem |
| **better-auth** | Active development, v1.5.5 (March 2026), TypeScript-first, framework-agnostic | ✅ Winner |

**better-auth features we need:**
- ✅ Email/password auth (built-in)
- ✅ Session management (cookie-based, database-backed)
- ✅ API key plugin (built-in! — `better-auth/plugins/api-key`)
- ✅ Works with any Node.js framework (Express, Hono, Fastify)
- ✅ Drizzle ORM adapter (built-in)
- ✅ Email verification, password reset
- ✅ Rate limiting
- ✅ TypeScript-first with full type inference

This is almost too perfect. better-auth handles BOTH our auth paths (dashboard sessions + API keys) with built-in plugins. No need to build API key management from scratch.

### Password Hashing: **Argon2id**

- **Argon2id** is the winner of the Password Hashing Competition (PHC)
- OWASP recommends Argon2id as the first choice
- Memory-hard (resists GPU attacks), time-hard, and resistant to side-channel attacks
- Node.js library: `argon2` (uses native bindings, fast)
- better-auth uses Argon2id by default ✅

**Params (OWASP recommended):** `memoryCost: 19456` (19 MiB), `timeCost: 2`, `parallelism: 1`

### JWT Library (for API key signing/verification if needed): **jose**

- `jose` is the modern standard — zero dependencies, Web Crypto API, works in Node/Edge/Browser
- `jsonwebtoken` is legacy (no ESM, no Web Crypto, stale maintenance)
- better-auth uses `jose` internally ✅

### Refresh Token Strategy

Not needed for our primary flow. Cookie sessions auto-extend on activity. If we add OAuth flows later, better-auth handles refresh tokens internally.

### Recommendation Summary

```
Dashboard Auth:  better-auth (email/password → session cookie)
API Auth:        better-auth API key plugin (X-API-Key header → validate)
Password Hash:   Argon2id (via better-auth default)
JWT (if needed): jose (via better-auth)
```

---

## 3. Drizzle ORM Validation

### Can Drizzle Handle Our Schema?

| Requirement | Drizzle Support | Notes |
|-------------|----------------|-------|
| 11+ tables | ✅ Full | No table count limits |
| JSONB columns | ✅ Full | `jsonb()` type with type inference: `jsonb().$type<MyType>()` |
| PostgreSQL enums | ✅ Full | `pgEnum('status', ['active', 'paused', ...])` |
| Relations | ✅ Full | `relations()` API for type-safe joins |
| Partitioning (schema) | ⚠️ Partial | No first-class partition DDL — you define parent table in Drizzle, create partitions via raw SQL migration |
| Partitioning (query) | ✅ Full | Queries against partitioned tables work transparently — Postgres handles routing |
| Complex queries | ✅ Full | SQL-like query builder, `sql` template tag for raw SQL escape hatch |
| Transactions | ✅ Full | `db.transaction()` with proper isolation levels |

### Partitioning Strategy

Drizzle doesn't have `PARTITION BY` in its schema DSL (open feature request since 2024). **This is fine.** The recommended pattern:

1. Define the parent table in Drizzle schema (for type safety and queries)
2. Create partitions in a manual SQL migration file
3. Drizzle Kit manages the parent table; partition DDL lives in custom SQL migrations

```typescript
// schema.ts — define parent table normally
export const apiSnapshots = pgTable('api_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  endpointId: uuid('endpoint_id').notNull(),
  capturedAt: timestamp('captured_at').notNull(),
  responseBody: jsonb('response_body').$type<Record<string, unknown>>(),
  // ...
});

// migrations/0002_add_partitions.sql — manual partition DDL
-- Run via drizzle-kit custom migration or directly
ALTER TABLE api_snapshots RENAME TO api_snapshots_old;
CREATE TABLE api_snapshots (LIKE api_snapshots_old INCLUDING ALL) PARTITION BY RANGE (captured_at);
CREATE TABLE api_snapshots_2026_q1 PARTITION OF api_snapshots FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
-- etc.
```

### Migration Strategy: **Drizzle Kit + custom SQL**

- Use `drizzle-kit generate` for standard schema changes (new tables, columns, indexes)
- Use `drizzle-kit` custom SQL migrations for partitioning, complex DDL, data migrations
- `drizzle-kit push` for rapid dev iteration (schema → DB without migration files)
- `drizzle-kit migrate` for production (applies migration files in order)

### Drizzle vs Prisma

| Factor | Drizzle | Prisma |
|--------|---------|--------|
| Bundle size | ~50KB | ~10MB+ (engine binary) |
| Query style | SQL-like (you think in SQL) | Custom query language |
| Raw SQL escape | `sql` template tag (first class) | `$queryRaw` (second class) |
| Performance | Thin layer over driver | Query engine overhead |
| Type safety | Excellent (inferred from schema) | Excellent (generated client) |
| Serverless/Railway | ✅ No binary overhead | ⚠️ Binary engine issues in containers |
| JSONB | ✅ Native with type param | ✅ But less flexible |
| Enums | ✅ `pgEnum` | ✅ `enum` in schema |

### Verdict: **Drizzle ORM confirmed ✅**

Drizzle is the right choice. It's lightweight, SQL-native, excellent TypeScript inference, and the partitioning limitation is trivially worked around with custom SQL migrations. The SQL-like query builder means less abstraction leakage when we need complex queries for diff analysis.

**Driver:** Use `drizzle-orm/node-postgres` with `pg` driver (most stable for Railway's managed Postgres).

---

## 4. Logging Configuration (Pino)

### Railway-Specific Considerations

- Railway captures stdout/stderr — no file-based log rotation needed
- Railway's log viewer parses JSON — structured logging is essential
- Railway overrides Pino's numeric log levels — use the `formatters.level` fix
- Log retention on Railway: depends on plan (typically 7 days on Pro, configurable)

### Log Level Strategy

| Level | Use For | Examples |
|-------|---------|---------|
| `fatal` | Process cannot continue | DB connection lost permanently, OOM |
| `error` | Operation failed, needs attention | API call failed after retries, payment processing error |
| `warn` | Degraded but functioning | Rate limit approaching, retry succeeded, deprecated API usage |
| `info` | Normal operations worth recording | Request completed, job processed, snapshot captured, user signed up |
| `debug` | Development troubleshooting | Query parameters, intermediate state, cache hit/miss |
| `trace` | Very verbose, rarely used | Full request/response bodies, step-by-step algorithm flow |

**Production level:** `info` (set via `LOG_LEVEL` env var)
**Development level:** `debug`

### Complete Pino Configuration

```typescript
// src/lib/logger.ts
import pino from 'pino';
import { randomUUID } from 'node:crypto';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  // Fix Railway log level override
  formatters: {
    level(label) {
      return { level: label };
    },
    bindings(bindings) {
      return {
        pid: bindings.pid,
        hostname: bindings.hostname,
        service: 'chirri-api',
      };
    },
  },

  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),

  // ISO timestamps for Railway log viewer
  timestamp: pino.stdTimeFunctions.isoTime,

  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-api-key"]',
      'password',
      'apiKey',
      'token',
      'refreshToken',
    ],
    censor: '[REDACTED]',
  },

  // Base context on every log line
  base: {
    env: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    version: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
  },

  // Dev: pretty print via transport
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
});

// Request ID middleware (Express/Hono)
export function requestId() {
  return (req: any, res: any, next: any) => {
    const id = req.headers['x-request-id'] || randomUUID();
    req.id = id;
    res.setHeader('x-request-id', id);
    req.log = logger.child({ requestId: id });
    next();
  };
}

// Child logger for specific domains
export const createLogger = (domain: string) =>
  logger.child({ domain });

// Usage examples:
// const jobLogger = createLogger('queue-worker');
// jobLogger.info({ jobId, endpointId }, 'snapshot captured');
//
// req.log.info({ userId, endpoint }, 'API request completed');
```

### Dev dependency

```bash
npm install pino
npm install -D pino-pretty  # dev only, never in production
```

### Structured Logging Patterns

```typescript
// ✅ Good: structured context + message
logger.info({ userId, endpointId, duration: 1234 }, 'snapshot captured');

// ✅ Good: error with context
logger.error({ err, jobId, attempt: 3 }, 'snapshot capture failed');

// ❌ Bad: string interpolation
logger.info(`User ${userId} captured snapshot for ${endpointId}`);

// ✅ Good: child logger for request scope
const reqLog = logger.child({ requestId: req.id, userId: req.user?.id });
reqLog.info({ path: req.path, method: req.method }, 'request started');
```

---

## 5. Error Tracking

### Comparison

| Tool | Free Tier | Open Source | Verdict |
|------|-----------|-------------|---------|
| **Sentry** | 5,000 errors/mo, 10K perf units, 1 user | No (BSL license since 2024) | Good free tier but limited |
| **Highlight.io** | 500 sessions, 1K errors, 1M logs/mo free | Yes (Apache 2.0) | Full-stack but free tier is tiny |
| **GlitchTip** | Self-hosted: unlimited. Hosted: free tier with limits | Yes (MIT) | Sentry SDK compatible, lightweight |
| **BetterStack (Logtail)** | 1GB logs/mo free | No | Logging-focused, not error tracking per se |
| **LogSnag** | Event tracking/analytics, not error tracking | No | Wrong tool entirely |
| **Bugsink** | Self-hosted, unlimited | Yes | Very new, minimal features |

### Recommendation: **Sentry (free tier)**

**Justification:**

1. **5,000 errors/month is generous for a pre-launch and early-stage product.** You'll hit this only if something is seriously wrong.
2. **Best-in-class Node.js SDK** — auto-captures unhandled exceptions, promise rejections, request context
3. **Source maps support** — critical for debugging minified dashboard code
4. **Release tracking** — tag errors by deploy/commit
5. **Integrates with everything** — GitHub issues, Slack/Discord alerts
6. **If we outgrow free tier**, GlitchTip is a drop-in replacement (uses Sentry SDK protocol). Zero lock-in risk.

**Why not self-host GlitchTip now?** Extra infrastructure to maintain on Railway (Django + Postgres + Redis + Celery). Not worth it when Sentry's free tier covers us and migration is trivial later.

**Setup:**
```bash
npm install @sentry/node
```

```typescript
// src/lib/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.RAILWAY_ENVIRONMENT || 'development',
  release: process.env.RAILWAY_GIT_COMMIT_SHA,
  tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
  beforeSend(event) {
    // Scrub sensitive data if needed
    return event;
  },
});
```

**Escape hatch:** If Sentry changes pricing or we want self-hosted, swap DSN to GlitchTip. Same SDK, same code.

---

## 6. CI/CD Pipeline

### Architecture: **GitHub Actions (CI) → Railway auto-deploy (CD)**

**How it works:**
1. Push to `main` → GitHub Actions runs CI checks
2. Railway watches `main` branch with "Wait for CI" enabled
3. Only after CI passes does Railway build and deploy
4. Railway handles Nixpacks build, container deployment, health checks

**Why this split:**
- Railway's built-in CI is just "build and deploy" — no linting, testing, type checking
- GitHub Actions free tier: **2,000 minutes/month** for private repos (GitHub Free plan) — more than enough
- Railway's "Wait for CI" flag integrates natively with GitHub Actions status checks

### Complete Pipeline

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: chirri_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Run migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/chirri_test

      - name: Test
        run: npm test
        env:
          DATABASE_URL: postgres://test:test@localhost:5432/chirri_test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test

      - name: Build
        run: npm run build
```

### Database Migration Strategy During Deploy

```json
// package.json scripts
{
  "scripts": {
    "db:migrate": "drizzle-kit migrate",
    "db:generate": "drizzle-kit generate",
    "start": "node dist/server.js",
    "prestart": "npm run db:migrate"
  }
}
```

**Flow:**
1. Railway runs `npm run build` (Nixpacks detects Node.js)
2. Railway runs `npm run start` which triggers `prestart` → runs migrations
3. Migrations run before the server starts accepting traffic
4. Railway health check confirms the service is up before routing traffic

**For breaking migrations:** Use expand-contract pattern:
1. PR 1: Add new column (nullable), deploy
2. PR 2: Backfill data, update code to write to both, deploy
3. PR 3: Make new column non-nullable, drop old column, deploy

### PR Preview Environments

Railway supports PR preview environments natively. Enable in Railway dashboard → service settings. Each PR gets an isolated deployment with its own database (if configured).

---

## 7. Testing Strategy

### Framework: **Vitest**

**Why Vitest over Jest:**

| Factor | Vitest | Jest |
|--------|--------|------|
| Speed | 2-5x faster (native ESM, Vite's transform) | Slower (Babel/ts-jest transform overhead) |
| TypeScript | Native, zero config | Needs ts-jest or @swc/jest |
| ESM support | First-class | Still awkward in 2026 |
| Config | Shares vite.config.ts | Separate jest.config |
| API compatibility | Jest-compatible (describe, it, expect) | — |
| Watch mode | Instant (Vite HMR-based) | Slower |
| Active development | Very active, Vite ecosystem | Maintenance mode (Meta deprioritized) |

### Testing Layers

#### Layer 1: Unit Tests (fast, no I/O)

**What to test:** Pure functions, data transformations, diff algorithms, validation logic, URL parsing, cron expression handling.

```typescript
// src/lib/diff.test.ts
import { describe, it, expect } from 'vitest';
import { computeDiff } from './diff';

describe('computeDiff', () => {
  it('detects added fields', () => {
    const before = { name: 'foo' };
    const after = { name: 'foo', age: 42 };
    const diff = computeDiff(before, after);
    expect(diff.added).toContainEqual({ path: '$.age', value: 42 });
  });
});
```

#### Layer 2: Integration Tests (database + API)

**Test API routes end-to-end with real Postgres.**

```typescript
// src/routes/endpoints.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../app'; // Your Express/Hono app
import request from 'supertest';
import { db } from '../db';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './drizzle' });
});

describe('POST /api/endpoints', () => {
  it('creates an endpoint', async () => {
    const res = await request(app)
      .post('/api/endpoints')
      .set('X-API-Key', testApiKey)
      .send({ url: 'https://api.example.com/users', method: 'GET' });

    expect(res.status).toBe(201);
    expect(res.body.endpoint.url).toBe('https://api.example.com/users');
  });
});
```

**Database for tests:** Use GitHub Actions Postgres service (see CI pipeline above). Locally, use Docker Compose or a test database.

#### Layer 3: Queue Worker Tests (BullMQ)

**Strategy:** Test the job processor function directly, not through BullMQ.

```typescript
// src/workers/snapshot.test.ts
import { describe, it, expect, vi } from 'vitest';
import { processSnapshotJob } from './snapshot-processor';

describe('processSnapshotJob', () => {
  it('captures a snapshot and detects changes', async () => {
    // Mock the HTTP call
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ users: [{ id: 1 }] }), { status: 200 })
    );

    const result = await processSnapshotJob({
      endpointId: 'test-endpoint',
      url: 'https://api.example.com/users',
      method: 'GET',
    });

    expect(result.status).toBe('captured');
    expect(fetch).toHaveBeenCalledWith('https://api.example.com/users', expect.any(Object));
  });
});
```

**For BullMQ integration tests (optional, for CI):**
- Use the Redis service in GitHub Actions
- Create a real queue, add a job, verify the worker picks it up
- Use `QueueEvents` to listen for completion

#### Layer 4: E2E Tests (optional, post-launch)

Not needed for MVP. When ready, use Playwright for dashboard E2E.

### Minimum Viable Test Coverage for Launch

| Area | Coverage Goal | Priority |
|------|---------------|----------|
| Diff engine | 90%+ | Critical — this IS the product |
| API routes (CRUD) | 80%+ | Critical — user-facing |
| Auth flows | 80%+ | Critical — security |
| Queue job processors | 70%+ | High — core functionality |
| Notification delivery | 50%+ | Medium — test formatting, mock delivery |
| Dashboard components | 30%+ | Low — test complex components only |

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['**/node_modules/**', '**/test/**', '**/*.d.ts'],
    },
    // Separate integration tests (need DB/Redis)
    poolOptions: {
      forks: {
        singleFork: true, // Serialize DB tests
      },
    },
  },
});
```

```typescript
// src/test/setup.ts
import { beforeAll, afterAll } from 'vitest';
import { db, pool } from '../db';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './drizzle' });
});

afterAll(async () => {
  await pool.end();
});
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run --include 'src/**/*.test.ts' --exclude 'src/**/*.integration.test.ts'",
    "test:integration": "vitest run --include 'src/**/*.integration.test.ts'"
  }
}
```

---

## Summary: Complete Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Dashboard** | Vite + React + React Router + TanStack Query | SPA is right for auth'd dashboards; huge ecosystem |
| **Auth** | better-auth (sessions + API key plugin) | Handles both auth paths, Drizzle adapter, active development |
| **Password Hashing** | Argon2id (via better-auth) | OWASP/PHC recommended, memory-hard |
| **JWT** | jose (via better-auth) | Modern, zero-dep, Web Crypto |
| **ORM** | Drizzle ORM + node-postgres | Confirmed. Lightweight, SQL-native, full PostgreSQL support |
| **Migrations** | Drizzle Kit + custom SQL for partitions | Best of both: auto-generated + manual control |
| **Logging** | Pino (structured JSON) | Fast, Railway-compatible, structured |
| **Error Tracking** | Sentry (free tier) → GlitchTip escape hatch | 5K errors free, best SDK, zero lock-in risk |
| **CI** | GitHub Actions | 2K min/mo free, full control over pipeline |
| **CD** | Railway auto-deploy (Wait for CI) | Native integration, zero config |
| **Testing** | Vitest + Supertest | Fast, native ESM/TS, Jest-compatible API |

### Total New Dependencies

```
# Core
better-auth          # Auth (sessions + API keys)
drizzle-orm          # ORM
pg                   # Postgres driver
pino                 # Logging
@sentry/node         # Error tracking

# Dashboard
react, react-dom     # UI
react-router         # Routing
@tanstack/react-query # Server state
tailwindcss          # Styling

# Dev
vitest               # Testing
supertest            # HTTP testing
pino-pretty          # Dev log formatting
drizzle-kit          # Migration tooling
```

No bloat. Every dependency earns its place.
