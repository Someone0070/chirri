# CHIRRI OPS & TESTING SPEC

**Version:** 1.0
**Date:** 2026-03-24
**Status:** New specification for 5 previously unspecified systems
**Companion to:** CHIRRI_BIBLE.md (Bible v2.4)

This document specifies 5 operational systems that had zero specification in the Bible:
1. CI/CD Pipeline
2. Testing Strategy
3. Admin Panel
4. Error Monitoring & Alerting
5. Analytics & Metrics

---

## TABLE OF CONTENTS

- [1. CI/CD Pipeline](#1-cicd-pipeline)
- [2. Testing Strategy](#2-testing-strategy)
- [3. Admin Panel](#3-admin-panel)
- [4. Error Monitoring & Alerting](#4-error-monitoring--alerting)
- [5. Analytics & Metrics](#5-analytics--metrics)
- [Appendix: Effort Estimates](#appendix-effort-estimates)

---

# 1. CI/CD PIPELINE

## 1.1 System Choice

**GitHub Actions** — aligns with GitHub hosting, 2K free minutes/month for private repos, native integration with Railway's "Wait for CI" feature.

## 1.2 Repository Structure

Chirri is a **multi-service monorepo** with 4 deployable units:

```
chirri/
├── packages/
│   ├── api/              # Hono API server (Service 1)
│   ├── scheduler/        # Scheduler service (Service 2)
│   ├── worker/           # Check workers (Service 3)
│   ├── mcp-server/       # @chirri/mcp-server (npm package)
│   ├── shared/           # Shared types, utils, DB schema
│   └── landing/          # Astro landing page (chirri.io)
├── migrations/           # Raw SQL migrations (partitioned tables)
├── .github/workflows/    # CI/CD definitions
├── drizzle.config.ts
├── vitest.config.ts
├── tsconfig.base.json
└── package.json          # Workspace root (pnpm workspaces)
```

**Package manager:** pnpm (workspace support, strict dependency resolution, fast installs with store caching).

## 1.3 Branch Strategy

| Branch | Purpose | Deploys To | Auto-deploy? |
|---|---|---|---|
| `main` | Production | Railway production services | Yes (after CI passes) |
| `dev` | Staging/integration | Railway staging environment (when needed) | Yes |
| `feat/*`, `fix/*` | Feature branches | — (CI only) | No |

**MVP simplification:** Start with `main` only (no staging environment). Add `dev` → staging when the first paid customer arrives or when the team grows beyond 1. Staging costs ~$15/mo extra on Railway.

## 1.4 Pipeline Stages

### PR Pipeline (on pull_request to main)

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint          # ESLint across all packages
      - run: pnpm format:check  # Prettier check (no write)

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck     # tsc --noEmit across all packages

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: chirri_test
          POSTGRES_PASSWORD: chirri_test
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
    env:
      DATABASE_URL: postgresql://chirri_test:chirri_test@localhost:5432/chirri_test
      REDIS_URL: redis://localhost:6379
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate:test  # Apply migrations to test DB
      - run: pnpm test             # Vitest across all packages
      - run: pnpm test:coverage     # Coverage report
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/
```

### Deploy Pipeline (on push to main)

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  # CI runs first (same lint/typecheck/test as PR pipeline)
  ci:
    uses: ./.github/workflows/ci.yml

  # Deploy runs after CI passes
  # Railway's "Wait for CI" handles this natively:
  # Railway watches the main branch AND waits for the
  # GitHub Actions check to pass before triggering deploy.
  # No explicit deploy step needed in GitHub Actions.
```

**Railway "Wait for CI" is the deploy mechanism.** Railway's GitHub integration watches the `main` branch. When "Wait for CI" is enabled in Railway service settings, it waits for all GitHub Actions checks to pass before triggering a new deployment. This means:

- No `railway` CLI needed in CI
- No RAILWAY_TOKEN secret needed
- Deploy is triggered by Railway, not by GitHub Actions
- Each Railway service (API, scheduler, worker) deploys independently using its own Dockerfile/build config

### Landing Page Deploy (separate)

```yaml
name: Deploy Landing
on:
  push:
    branches: [main]
    paths:
      - 'packages/landing/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter landing build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: pages deploy packages/landing/dist --project-name=chirri
```

### MCP Server Publish (on tag)

```yaml
name: Publish MCP Server
on:
  push:
    tags:
      - 'mcp-v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @chirri/mcp-server build
      - run: pnpm --filter @chirri/mcp-server publish --no-git-checks
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 1.5 Database Migrations in CI

**Strategy: `drizzle-kit migrate` for Drizzle-managed tables + raw SQL for partitioned tables.**

```
# Migration flow:
1. Developer modifies schema in packages/shared/src/db/schema.ts
2. Run: pnpm drizzle-kit generate    → creates SQL migration file in migrations/drizzle/
3. For partitioned tables: manually create migrations/sql/NNN_description.sql
4. Commit migration files to git
5. In CI test job: pnpm db:migrate:test applies all migrations to test DB
6. On deploy: Railway prestart script runs migrations before accepting traffic
```

**Railway prestart script (in each service's Dockerfile or railway.toml):**
```toml
[deploy]
startCommand = "pnpm db:migrate && node dist/index.js"
```

**Migration safety rules (from Bible D.15):**
- Add nullable column: safe, just add
- Add NOT NULL column: add nullable → backfill → ALTER to NOT NULL
- Drop column: remove from code first → deploy → drop column in next migration
- Always use `CREATE INDEX CONCURRENTLY`
- Drizzle Kit is forward-only (no rollback). Rollback via Railway snapshot restore.

**Only the API server runs migrations** (first to deploy). Workers and scheduler connect after migrations are applied. Railway deploy order: API → Scheduler → Workers.

## 1.6 Secrets Management

| Secret | Where Stored | Used By |
|---|---|---|
| DATABASE_URL | Railway env vars (auto-injected for managed Postgres) | All services |
| REDIS_URL | Railway env vars (auto-injected for managed Redis) | All services |
| STRIPE_SECRET_KEY | Railway env vars (API service only) | API |
| STRIPE_WEBHOOK_SECRET | Railway env vars (API service only) | API |
| ENCRYPTION_MASTER_KEY | Railway env vars (shared) | API, Worker |
| BETTER_AUTH_SECRET | Railway env vars (API service only) | API |
| OPENAI_API_KEY | Railway env vars (worker only) | Worker |
| RESEND_API_KEY | Railway env vars (worker only) | Worker |
| SENTRY_DSN | Railway env vars (shared) | All services |
| R2_* credentials | Railway env vars (shared) | Worker |
| NPM_TOKEN | GitHub repo secrets | MCP publish workflow |
| CLOUDFLARE_API_TOKEN | GitHub repo secrets | Landing page deploy |

**Railway environment separation:** Railway supports per-service and per-environment variables. Staging services get staging Stripe keys, staging DB, etc.

## 1.7 Rollback Strategy

| Scenario | Rollback Method | Time to Recovery |
|---|---|---|
| Bad code deploy | Railway "Rollback" button (instant previous image) | <1 minute |
| Bad migration (additive) | Deploy fix-forward migration | 5-10 minutes |
| Bad migration (destructive) | Restore from Railway DB snapshot (daily auto-snapshot) | 5-15 minutes |
| Complete disaster | Restore DB from R2 backup + Railway redeploy | 30-60 minutes |

**Railway auto-snapshots:** Railway takes automatic database snapshots. Additionally, Chirri's daily cron (04:00 UTC) creates a pg_dump → R2 backup as defense-in-depth.

## 1.8 Effort Estimate

~20 hours: GitHub Actions workflows (6h), pnpm workspace setup (3h), Railway service configuration (3h), migration scripts (3h), landing page deploy pipeline (2h), MCP publish pipeline (2h), documentation (1h).

---

# 2. TESTING STRATEGY

## 2.1 Framework

**Vitest** — native ESM/TypeScript support, fast watch mode, compatible with Hono ecosystem, same assertion API as Jest (easy migration if needed). Already listed in Bible Appendix C.

## 2.2 Test Database

**GitHub Actions service containers** (Postgres 16 + Redis 7) for CI. Locally: Docker Compose or local Postgres.

**Why not Neon branching?** Adds complexity and external dependency for tests. Local Postgres is faster, simpler, and free. Neon branching is useful for staging preview environments (V1.1 consideration).

**Why not SQLite in-memory?** Chirri uses Postgres-specific features (declarative partitioning, `pg_advisory_xact_lock`, `FOR UPDATE`, JSONB operators). SQLite would mask real behavior.

**Test DB setup:**
```typescript
// packages/shared/src/test/setup.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const testDb = drizzle(pool);

// Before all tests: apply migrations
beforeAll(async () => {
  await migrate(testDb, { migrationsFolder: './migrations/drizzle' });
  // Apply raw SQL migrations for partitioned tables
  await pool.query(fs.readFileSync('./migrations/sql/001_partitions.sql', 'utf-8'));
});

// After each test: truncate all tables (fast, preserves schema)
afterEach(async () => {
  await pool.query(`
    TRUNCATE users, urls, shared_urls, baselines, changes, user_changes,
    check_results, webhooks, webhook_deliveries, notifications,
    forecasts, user_forecasts, shared_sources, signals, signal_matches,
    feedback, url_secrets, oauth_tokens, integrations, tickets,
    api_dependencies, user_api_context, impact_analyses, user_impact_views,
    migration_checklists, monitored_packages, package_versions,
    simulations, notification_rules, github_connections, github_issues,
    provider_events, learning_samples, header_snapshots,
    source_alert_preferences, domain_user_counts, discovery_results
    CASCADE;
  `);
});

// After all tests: close pool
afterAll(async () => {
  await pool.end();
});
```

## 2.3 Test Layers

### Layer 1: Unit Tests (fast, no I/O)

**What to test:**
- Severity assignment logic (`assignSeverity()` — deterministic rules from §2.12)
- Content classification heuristics (`classifyResponseContent()`)
- Diff strategy selection (`chooseDiffStrategy()`)
- Soft error detection (`detectSoftError()`)
- URL normalization (`normalizeMonitorUrl()`)
- Volatile field detection
- Security flag detection patterns
- Dedup key computation
- Relevance matching engine (path, version, product matching)
- Semver comparison logic
- Notification rate limit logic
- Plan limit enforcement logic
- Retry-After header parsing
- Sunset/Deprecation header parsing

**Mocking strategy for unit tests:**
- Mock nothing — unit tests should test pure functions with no external dependencies
- If a function requires DB/Redis, it belongs in integration tests

**Example:**
```typescript
// packages/worker/src/severity.test.ts
import { describe, it, expect } from 'vitest';
import { assignSeverity } from './severity';

describe('assignSeverity', () => {
  it('returns critical for removed fields', () => {
    const change = {
      change_type: 'schema',
      diff: { removed: { amount: { type: 'number' } } },
    };
    expect(assignSeverity(change)).toBe('critical');
  });

  it('returns low for array reorder only', () => {
    const change = {
      change_type: 'schema',
      diff: { _t: 'a', _0: ['value', 2, 3] },  // move marker
    };
    expect(assignSeverity(change)).toBe('low');
  });

  it('returns critical for 5xx status code', () => {
    const change = {
      change_type: 'status_code',
      current_status_code: 503,
    };
    expect(assignSeverity(change)).toBe('critical');
  });
});
```

### Layer 2: Integration Tests (with DB + Redis)

**What to test:**
- API endpoints (full request/response cycle via Hono's `app.request()`)
- Database operations (CRUD, plan limit enforcement with `FOR UPDATE`)
- BullMQ job processing (enqueue → process → verify side effects)
- Webhook delivery (mock external endpoint with MSW or local HTTP server)
- SSE event delivery
- Rate limiting behavior (Redis counters)
- Authentication flows (session creation, API key validation)
- Stripe webhook handler (with Stripe's test webhook construction)

**Hono testing approach (from Hono docs):**
```typescript
// packages/api/src/routes/urls.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { testClient } from 'hono/testing';
import { app } from '../app';
import { createTestUser, createTestSession } from '../test/helpers';

describe('POST /v1/urls', () => {
  let sessionCookie: string;
  let userId: string;

  beforeEach(async () => {
    const user = await createTestUser({ plan: 'personal' });
    userId = user.id;
    sessionCookie = await createTestSession(user.id);
  });

  it('creates a URL and returns 201 with classifying status', async () => {
    const res = await app.request('/v1/urls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ url: 'https://httpbin.org/get' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('classifying');
    expect(body.id).toMatch(/^url_/);
  });

  it('rejects SSRF attempt with private IP', async () => {
    const res = await app.request('/v1/urls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data/' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('ssrf_blocked');
  });

  it('enforces plan URL limit', async () => {
    // Personal plan = 10 URLs
    // Create 10 URLs first
    for (let i = 0; i < 10; i++) {
      await createTestUrl(userId, `https://example.com/api/${i}`);
    }

    const res = await app.request('/v1/urls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie,
      },
      body: JSON.stringify({ url: 'https://example.com/api/11' }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('plan_limit_reached');
  });
});
```

### Layer 3: Worker/Queue Integration Tests

**BullMQ testing approach:** Test job processors directly (extract processor function, call with mock job data) + test full queue flow with real Redis.

```typescript
// packages/worker/src/check-worker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processUrlCheck } from './processors/url-check';
import { testDb } from '@chirri/shared/test/setup';

describe('URL Check Worker', () => {
  it('processes a check and stores result', async () => {
    // Setup: create shared_url + baseline in test DB
    const sharedUrl = await createTestSharedUrl('https://httpbin.org/get');
    const baseline = await createTestBaseline(sharedUrl.id, {
      full_hash: 'abc123',
      status_code: 200,
    });

    // Mock the HTTP fetch (don't hit real URLs in tests)
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    // Process the job
    const job = {
      data: {
        shared_url_id: sharedUrl.id,
        url: 'https://httpbin.org/get',
        method: 'GET',
        headers: {},
        subscriber_ids: ['url_test1'],
        baseline_id: baseline.id,
        is_learning: false,
        check_number: 50,
      },
    };

    await processUrlCheck(job as any);

    // Verify: check_result was inserted
    const results = await testDb.select().from(checkResults)
      .where(eq(checkResults.shared_url_id, sharedUrl.id));
    expect(results).toHaveLength(1);
    expect(results[0].status_code).toBe(200);
  });
});
```

### Layer 4: E2E Tests (deferred to post-MVP)

**MVP: No E2E tests.** The cost/benefit ratio doesn't justify Playwright/Cypress for a solo developer at launch. Integration tests cover API contracts. Manual testing covers UI flows.

**V1.1:** Add Playwright tests for critical user journeys:
- Signup → add first URL → see learning progress → first change notification
- Login → view change detail → triage (track/ignore/snooze)
- Settings → add webhook → test webhook → verify delivery

## 2.4 Mock Strategy

| External System | Mock Approach | Why |
|---|---|---|
| **Target URLs (httpbin, Stripe, etc.)** | `vi.spyOn(global, 'fetch')` or MSW (Mock Service Worker) | Never hit real APIs in tests |
| **Stripe API** | `stripe-mock` Docker container or manual mocks | Stripe provides official mock server |
| **Resend (email)** | Mock `resend.emails.send()` → verify payload | Don't send real emails |
| **Cloudflare R2** | Mock `@aws-sdk/client-s3` → in-memory map | Don't need real object storage |
| **OpenAI (LLM summarization)** | Mock → return canned summary | Expensive, non-deterministic |
| **GitHub App API** | MSW intercept `api.github.com` → canned responses | Don't create real issues |
| **BullMQ (in unit tests)** | Extract processor function, call directly | Test logic, not queue plumbing |
| **BullMQ (in integration tests)** | Real Redis + real BullMQ | Test actual queue behavior |
| **DNS resolution (SSRF)** | Mock `dns.resolve4/resolve6` | Control IP resolution |

**MSW (Mock Service Worker) for external APIs:**
```typescript
// packages/shared/src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock Stripe
  http.post('https://api.stripe.com/v1/*', () => {
    return HttpResponse.json({ id: 'sub_test', status: 'active' });
  }),

  // Mock Resend
  http.post('https://api.resend.com/emails', () => {
    return HttpResponse.json({ id: 'email_test' });
  }),

  // Mock OpenAI
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [{ message: { content: 'Test summary of API change' } }],
    });
  }),
];
```

## 2.5 Fixture Strategy

**Factory functions for test data creation:**

```typescript
// packages/shared/src/test/factories.ts
import { nanoid } from 'nanoid';

export async function createTestUser(overrides: Partial<User> = {}) {
  const defaults = {
    id: `usr_${nanoid(21)}`,
    email: `test-${nanoid(8)}@chirri.test`,
    password_hash: '$argon2id$...testHash...',
    plan: 'free' as const,
    email_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const user = { ...defaults, ...overrides };
  await testDb.insert(users).values(user);
  return user;
}

export async function createTestUrl(userId: string, url: string, overrides = {}) {
  const urlHash = createHash('sha256').update(normalizeMonitorUrl(url)).digest('hex');
  const sharedUrl = await createTestSharedUrl(url);
  const defaults = {
    id: `url_${nanoid(21)}`,
    user_id: userId,
    url,
    url_hash: urlHash,
    status: 'active' as const,
    check_interval: '1h',
    shared_url_id: sharedUrl.id,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const urlRecord = { ...defaults, ...overrides };
  await testDb.insert(urls).values(urlRecord);
  return urlRecord;
}

export async function createTestChange(sharedUrlId: string, overrides = {}) {
  // ... similar pattern
}
```

## 2.6 Coverage Targets

| Category | Target | Rationale |
|---|---|---|
| **Severity assignment** | 100% | Deterministic rules, no excuse not to cover all paths |
| **SSRF prevention** | 100% | Security-critical, every bypass vector must be tested |
| **Content classification** | 90%+ | Core detection logic |
| **API endpoints** | 80%+ | All happy paths + key error paths |
| **Worker processors** | 80%+ | All job types + failure modes |
| **Overall** | 70%+ | Reasonable for MVP, increase to 80%+ over time |

## 2.7 What MUST Be Tested vs What Can Wait

**MUST test before launch:**
- [ ] SSRF prevention (ALL bypass vectors from §5.5, §8.2)
- [ ] Plan limit enforcement (race condition prevention with `FOR UPDATE`)
- [ ] Severity assignment (every rule from §2.12)
- [ ] Authentication (session, API key, email verification)
- [ ] Webhook HMAC signing + verification
- [ ] Content classification (at least JSON, HTML, RSS, OpenAPI detection)
- [ ] Change detection pipeline (fingerprint comparison, diff generation)
- [ ] Stripe webhook handlers (checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted)
- [ ] GDPR account deletion cascade
- [ ] Rate limiting (API + notification + domain throttling)

**Can wait for V1.1:**
- E2E browser tests
- SSE integration tests
- PM integration tests (Jira ADF conversion, Linear GraphQL, GitHub Issues)
- Discovery service probe tests
- Early warning keyword scanning accuracy tests
- LLM summarization prompt tests
- Notification template rendering tests

## 2.8 Running Tests

```json
// package.json scripts
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:unit": "vitest run --config vitest.unit.config.ts",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "db:migrate:test": "drizzle-kit migrate && psql $DATABASE_URL -f migrations/sql/partitions.sql"
}
```

**Vitest configuration:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./packages/shared/src/test/setup.ts'],
    include: ['packages/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: ['**/test/**', '**/migrations/**', '**/*.d.ts'],
    },
    // Separate unit and integration by file naming convention
    // *.unit.test.ts = unit tests (no DB/Redis)
    // *.test.ts = integration tests (need DB/Redis)
    testTimeout: 30000,  // 30s for integration tests
  },
});
```

## 2.9 Effort Estimate

~35 hours: Vitest setup + config (3h), test DB setup + factories (6h), MSW mock setup (4h), unit tests for core logic (10h), integration tests for API endpoints (8h), CI pipeline integration (2h), documentation (2h).

---

# 3. ADMIN PANEL

## 3.1 MVP Approach: Internal API + Minimal React Page

**NOT AdminJS.** AdminJS auto-generates CRUD from ORM models, but Chirri needs specialized views (queue health, shared monitoring stats, aggregate feedback). AdminJS adds complexity and a large dependency tree for something we'd mostly override.

**MVP: Internal API endpoints + a single-page admin dashboard (React).**

The admin panel lives at `https://app.chirri.io/admin` (same SPA, protected route). Only users with `is_admin: true` flag can access it. This avoids deploying a separate app.

## 3.2 Data Model Addition

Add `is_admin` flag to users table:

```sql
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
```

Admin auth: same session auth as regular users. The admin panel is a set of React routes that check `user.is_admin` before rendering. API endpoints under `/internal/admin/*` check the flag server-side.

## 3.3 Admin Dashboard Sections

### 3.3.1 System Health (landing page of admin panel)

```
╭─────────────────────────────────────────╮
│ CHIRRI ADMIN — System Health            │
│                                          │
│ Services: API ✅  Scheduler ✅  Workers ✅│
│ DB Connections: 23/97                    │
│ Redis Memory: 48MB / 256MB              │
│                                          │
│ Queue Depths:                            │
│   url-checks: 12 waiting, 8 active      │
│   notifications: 3 waiting, 2 active    │
│   confirmation: 0 waiting               │
│   classification: 1 waiting             │
│   failed-jobs (DLQ): 0                  │
│                                          │
│ Last 24h:                                │
│   Checks run: 14,231                    │
│   Changes detected: 47                   │
│   Notifications sent: 182               │
│   Errors: 3 (0.02%)                     │
│                                          │
│ Worker Status:                           │
│   worker-1: active, last heartbeat 12s  │
│   worker-2: active, last heartbeat 8s   │
╰─────────────────────────────────────────╯
```

### 3.3.2 Users

| Column | What It Shows |
|---|---|
| Email | User email |
| Plan | free/personal/team/business |
| URLs | Count of active URLs |
| Changes (30d) | Changes detected in last 30 days |
| Last Active | Last dashboard visit or API call |
| Status | Active / Locked / Pending Deletion |
| Actions | View Details, Impersonate, Reset Password |

**User detail view:** Full user record, their URLs, changes, billing info, notification preferences, feedback history.

**Impersonation:** Admin logs in as user (read-only mode) to debug issues. Creates an impersonation session with audit log entry. All actions during impersonation are logged with `impersonated_by: admin_user_id`.

### 3.3.3 URL Monitoring Overview

| View | Description |
|---|---|
| All URLs | Searchable, filterable list of all monitored URLs across all users |
| Shared URLs | Shared monitoring dedup stats (subscriber count, effective interval) |
| Error URLs | URLs in error/degraded/limited status |
| Learning URLs | URLs currently in learning period |

### 3.3.4 Shared Monitoring Stats

- Top 20 most-subscribed shared URLs (subscriber_count)
- Shared source status across all domains
- Orphaned sources (no active subscribers)
- Discovery results pending review

### 3.3.5 Feedback Review

| Column | Description |
|---|---|
| User | Who submitted |
| Type | bug/feature/complaint/other |
| Text | Feedback content |
| URL Context | If related to a specific URL |
| Status | new/reviewed/resolved/archived |
| Actions | Reply (via support@chirri.io), Archive, Add Admin Note |

**Aggregate feedback:** Group by URL + field pattern. If 5+ users report false positive on the same field pattern, surface for admin review of system volatile list.

### 3.3.6 Billing Overview

- Total MRR (sum of active subscriptions)
- Plan distribution (pie chart: free/personal/team/business)
- Churn rate (cancellations in last 30 days / active subscriptions)
- Free → Paid conversion rate
- Failed payments in dunning
- Revenue trend (line chart, last 12 months)

### 3.3.7 Feature Flags

Simple key-value store in a `feature_flags` table:

```sql
CREATE TABLE feature_flags (
    key         TEXT PRIMARY KEY,
    value       BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  TEXT REFERENCES users(id)
);
```

Flags checked at runtime via Redis cache (5-minute TTL). Admin panel provides toggle UI.

**Initial flags:**
- `mcp_enabled` (default: true)
- `pm_integrations_enabled` (default: false)
- `impact_analysis_enabled` (default: false)
- `simulation_enabled` (default: false)
- `twitter_automation_enabled` (default: false)

## 3.4 Admin API Endpoints

All under `/internal/admin/*`, require `is_admin: true`:

| Method | Path | Description |
|---|---|---|
| GET | /internal/admin/health | System health dashboard data |
| GET | /internal/admin/users | List users (paginated, searchable) |
| GET | /internal/admin/users/:id | User detail |
| POST | /internal/admin/users/:id/impersonate | Start impersonation session |
| POST | /internal/admin/users/:id/reset-password | Force password reset |
| GET | /internal/admin/urls | All URLs (filterable) |
| GET | /internal/admin/shared-urls | Shared monitoring stats |
| GET | /internal/admin/feedback | Feedback list (filterable) |
| PATCH | /internal/admin/feedback/:id | Update feedback status/note |
| GET | /internal/admin/billing | Billing overview |
| GET | /internal/admin/queues | Queue depths and job stats |
| GET | /internal/admin/feature-flags | List flags |
| PATCH | /internal/admin/feature-flags/:key | Toggle flag |
| GET | /internal/admin/errors | Recent errors from Sentry (proxy) |

## 3.5 BullBoard Integration

**Mount Bull Board on the admin panel for queue visualization:**

```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { HonoAdapter } from '@bull-board/hono';  // or custom adapter

const serverAdapter = new HonoAdapter();
serverAdapter.setBasePath('/internal/admin/queues/board');

createBullBoard({
  queues: [
    new BullMQAdapter(urlChecksQueue),
    new BullMQAdapter(notificationsQueue),
    new BullMQAdapter(confirmationQueue),
    new BullMQAdapter(classificationQueue),
    new BullMQAdapter(sharedSourceQueue),
    new BullMQAdapter(signalFanoutQueue),
    new BullMQAdapter(packageChecksQueue),
    new BullMQAdapter(maintenanceQueue),
    new BullMQAdapter(failedJobsQueue),
  ],
  serverAdapter,
});
```

**Note:** Bull Board has a Hono adapter (`@bull-board/hono`). If not available, use the Express adapter with Hono's `express()` middleware compatibility layer. Protected behind admin auth.

## 3.6 Effort Estimate

~40 hours: DB changes + feature_flags table (2h), admin API endpoints (10h), admin React pages — health dashboard (6h), users list + detail (6h), feedback review (4h), billing overview (4h), feature flag toggle (2h), Bull Board integration (3h), impersonation (3h).

---

# 4. ERROR MONITORING & ALERTING

## 4.1 Error Tracking: Sentry

**Already in Bible (§5.4, Appendix C).** This section adds concrete configuration.

**Sentry free tier:** 5,000 errors/month, 10,000 performance transactions/month, 1 GB attachments. More than sufficient for MVP.

### 4.1.1 Sentry SDK Setup

```typescript
// packages/shared/src/monitoring/sentry.ts
import * as Sentry from '@sentry/node';

export function initSentry(service: 'api' | 'scheduler' | 'worker') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV,
    release: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    serverName: `chirri-${service}`,

    // Performance monitoring
    tracesSampleRate: service === 'api' ? 0.1 : 0.05,  // 10% API, 5% workers

    // Filter noisy errors
    ignoreErrors: [
      'ECONNRESET',           // Network resets (expected for URL monitoring)
      'ETIMEDOUT',            // Timeouts (expected for URL monitoring)
      'UND_ERR_CONNECT_TIMEOUT', // undici timeouts
    ],

    // Tag every event with service name
    initialScope: {
      tags: { service },
    },

    // Before sending: strip sensitive data
    beforeSend(event) {
      // Strip any API keys from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(b => {
          if (b.data?.url) {
            b.data.url = redactApiKeys(b.data.url);
          }
          return b;
        });
      }
      return event;
    },
  });
}
```

### 4.1.2 Hono Integration

```typescript
// packages/api/src/middleware/sentry.ts
import * as Sentry from '@sentry/node';

export const sentryMiddleware = async (c, next) => {
  const transaction = Sentry.startTransaction({
    op: 'http.server',
    name: `${c.req.method} ${c.req.routePath}`,
  });
  Sentry.getCurrentScope().setSpan(transaction);

  try {
    await next();
  } catch (err) {
    Sentry.captureException(err, {
      extra: {
        path: c.req.path,
        method: c.req.method,
        userId: c.get('user')?.id,
      },
    });
    throw err;
  } finally {
    transaction.setHttpStatus(c.res.status);
    transaction.finish();
  }
};
```

### 4.1.3 BullMQ Worker Integration

```typescript
// In each worker processor
import * as Sentry from '@sentry/node';

const worker = new Worker('url-checks', async (job) => {
  const transaction = Sentry.startTransaction({
    op: 'queue.process',
    name: `url-checks.${job.name}`,
  });

  try {
    await processUrlCheck(job);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { queue: 'url-checks', jobName: job.name },
      extra: {
        jobId: job.id,
        attempt: job.attemptsMade,
        data: { shared_url_id: job.data.shared_url_id },
      },
    });
    throw err;  // Let BullMQ handle retry
  } finally {
    transaction.finish();
  }
});

// Track failed jobs that exhaust retries
worker.on('failed', (job, err) => {
  if (job && job.attemptsMade >= job.opts.attempts) {
    Sentry.captureException(err, {
      level: 'error',
      tags: { queue: 'url-checks', exhausted: 'true' },
      extra: { jobId: job.id, data: job.data },
    });
  }
});
```

## 4.2 What to Track

| Category | Events | Sentry Level |
|---|---|---|
| Uncaught exceptions | `process.on('uncaughtException')` | Fatal |
| Unhandled rejections | `process.on('unhandledRejection')` | Error |
| Failed jobs (exhausted retries) | BullMQ `failed` event where attempts exhausted | Error |
| SSRF bypass attempt | safeFetch blocked private IP | Warning |
| Slow DB queries (>1s) | Drizzle query hook or pg pool events | Warning |
| Authentication failures (>10/min from same IP) | Rate limit exceeded on auth endpoints | Warning |
| External API failures (Stripe, Resend, OpenAI) | HTTP errors from external services | Warning |
| Redis connection errors | ioredis error events | Error |
| R2 upload failures | S3 client errors | Warning |

**Sentry alert rules (configured in Sentry dashboard):**

| Alert | Condition | Action |
|---|---|---|
| High error rate | >50 errors in 1 hour | Email + Slack |
| Fatal error | Any fatal-level event | Email immediately |
| New issue spike | >10 events of new issue in 5 min | Slack |
| Performance degradation | p95 response time >5s for 10 min | Slack |

## 4.3 Custom Alerting (Beyond Sentry)

Sentry tracks errors. We also need operational alerts for things that aren't "errors" but are problems:

### 4.3.1 Alert Definitions

| Alert | Detection | Severity | Channel |
|---|---|---|---|
| Queue backing up | `url-checks` waiting >100 jobs | Warning | Slack/Email |
| Queue critical | `url-checks` waiting >500 jobs | Critical | Slack/Email/Telegram |
| DLQ not empty | `failed-jobs` count >0 | Warning | Slack |
| DLQ growing | `failed-jobs` count >20 | Critical | Slack/Email |
| Worker missing | No heartbeat from worker for >2 min | Critical | Slack/Email |
| Scheduler died | No checks scheduled for >5 min | Critical | Slack/Email/Telegram |
| Error rate spike | >5% of checks failing in 15 min window | Warning | Slack |
| DB connection pool exhausted | Active connections >90 of 97 | Critical | Slack/Email |
| Redis memory high | >200MB of 256MB | Warning | Slack |
| Zero checks running | No check_results in last 10 min | Critical | Slack/Email/Telegram |
| Stripe webhook backlog | >10 unprocessed Stripe events | Warning | Email |
| Email bounce rate | >5% in 24 hours | Warning | Email |

### 4.3.2 Implementation: Health Check Cron

A lightweight monitoring loop in the Scheduler service (runs every 60 seconds):

```typescript
// packages/scheduler/src/health-monitor.ts
import { Queue } from 'bullmq';

interface AlertState {
  lastAlertedAt: Record<string, number>;  // Dedup: don't spam same alert
  COOLDOWN_MS: 300_000;  // 5 min between same alerts
}

async function checkSystemHealth() {
  const alerts: Alert[] = [];

  // 1. Queue depths
  const urlChecksWaiting = await urlChecksQueue.getWaitingCount();
  if (urlChecksWaiting > 500) {
    alerts.push({ name: 'queue_critical', severity: 'critical',
      message: `url-checks queue has ${urlChecksWaiting} waiting jobs` });
  } else if (urlChecksWaiting > 100) {
    alerts.push({ name: 'queue_warning', severity: 'warning',
      message: `url-checks queue has ${urlChecksWaiting} waiting jobs` });
  }

  // 2. DLQ
  const dlqCount = await failedJobsQueue.getWaitingCount();
  if (dlqCount > 0) {
    alerts.push({ name: 'dlq_not_empty', severity: dlqCount > 20 ? 'critical' : 'warning',
      message: `Dead letter queue has ${dlqCount} failed jobs` });
  }

  // 3. Worker heartbeats
  for (const workerId of ['worker-1', 'worker-2']) {
    const lastHeartbeat = await redis.get(`worker_heartbeat:${workerId}`);
    if (!lastHeartbeat || Date.now() - parseInt(lastHeartbeat) > 120_000) {
      alerts.push({ name: `worker_missing_${workerId}`, severity: 'critical',
        message: `Worker ${workerId} has not sent heartbeat in >2 minutes` });
    }
  }

  // 4. Zero checks
  const recentChecks = await db.select({ count: sql`count(*)` })
    .from(checkResults)
    .where(gt(checkResults.checked_at, sql`now() - interval '10 minutes'`));
  if (recentChecks[0].count === 0) {
    alerts.push({ name: 'zero_checks', severity: 'critical',
      message: 'No checks have run in the last 10 minutes' });
  }

  // 5. DB connections
  const pgConns = await db.execute(sql`SELECT count(*) FROM pg_stat_activity`);
  if (pgConns[0].count > 87) {  // 90% of 97
    alerts.push({ name: 'db_connections', severity: 'critical',
      message: `DB connections at ${pgConns[0].count}/97` });
  }

  // Dispatch alerts (with dedup cooldown)
  for (const alert of alerts) {
    await dispatchAlert(alert);
  }
}
```

### 4.3.3 Alert Channels

**MVP: Email + Slack webhook to a #chirri-alerts channel.**

```typescript
async function dispatchAlert(alert: Alert) {
  // Email (always)
  await resend.emails.send({
    from: 'Chirri Alerts <chirp@chirri.io>',
    to: 'alex@chirri.io',
    subject: `[${alert.severity.toUpperCase()}] Chirri: ${alert.name}`,
    text: alert.message,
  });

  // Slack (if configured)
  if (process.env.SLACK_ALERTS_WEBHOOK_URL) {
    await fetch(process.env.SLACK_ALERTS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `*[${alert.severity.toUpperCase()}]* ${alert.message}`,
      }),
    });
  }
}
```

**V1.1:** Add PagerDuty for critical alerts (on-call rotation when team grows).

## 4.4 Queue Visualization: Bull Board

**Bull Board mounted on admin panel** (see §3.5 above). Provides:
- Real-time queue status (waiting, active, completed, failed, delayed)
- Job details (data, stacktrace on failure, attempt count)
- Manual retry/remove/promote actions
- Completed job history

## 4.5 Logging: Where Do Logs Go?

**Railway logs** — Railway captures stdout/stderr automatically. Logs are searchable in Railway dashboard with 7-day retention.

**MVP: Railway logs are sufficient.** Pino outputs structured JSON to stdout → Railway captures everything.

**When to add a log aggregator (V1.1):**
- When log volume exceeds Railway's search capability
- When we need >7 day log retention
- When we need cross-service log correlation

**Options for V1.1:**
| Service | Free Tier | Monthly Cost | Notes |
|---|---|---|---|
| Axiom | 500MB/day, 30d retention | $25/mo for more | Best DX, native Pino support |
| Better Stack (Logtail) | 1GB/mo | $24/mo for 30GB | Good UI, Pino integration |
| Grafana Cloud | 50GB logs, 14d retention | Free is generous | More complex setup |

**Recommendation for V1.1:** Axiom. Native Pino transport (`pino-axiom`), generous free tier, excellent query language.

## 4.6 Uptime Monitoring

**External: UptimeRobot (free tier, already in Bible)**
- Monitor `https://api.chirri.io/health` every 5 minutes
- Alert on downtime via email

**Internal: Chirri monitors Chirri (meta!)**
- Canary URL: `https://httpbin.org/get` monitored by Chirri itself
- If canary stops producing check_results, the pipeline is broken
- Self-monitoring validates the entire check pipeline end-to-end

## 4.7 Effort Estimate

~25 hours: Sentry SDK setup across all services (4h), Sentry Hono middleware (2h), BullMQ Sentry integration (3h), health monitor cron (6h), alert dispatch (3h), Bull Board admin mount (2h), logging configuration (2h), UptimeRobot setup (1h), documentation (2h).

---

# 5. ANALYTICS & METRICS

## 5.1 Tool Choice: PostHog

**PostHog Cloud (free tier)** — 1M events/month free, product analytics + session replay + feature flags. Ideal for a developer-focused SaaS:

| Feature | PostHog | Plausible | Mixpanel |
|---|---|---|---|
| Product analytics | ✅ Full | ❌ Web only | ✅ Full |
| Session replay | ✅ Free tier | ❌ | ❌ |
| Feature flags | ✅ Built-in | ❌ | ❌ |
| Self-hostable | ✅ | ✅ | ❌ |
| Backend event tracking | ✅ Node SDK | ❌ | ✅ |
| Free tier | 1M events/mo | $9/mo min | 10K MTU |
| Privacy-friendly | ✅ Cookieless option | ✅ | ❌ |

**Why PostHog over Plausible:** Plausible is excellent for web analytics but doesn't track product events (who clicked "Create Webhook"? how many users use MCP? what's the time-to-first-value?). PostHog does both.

**Landing page analytics: Umami or Plausible** (lightweight, privacy-first, no consent banner needed). Already specified in Bible Appendix C. PostHog is for the **product** (dashboard), not the marketing site.

## 5.2 Implementation

### 5.2.1 Frontend (Dashboard)

```typescript
// packages/api/src/dashboard/posthog.ts
import posthog from 'posthog-js';

// Initialize on dashboard load (NOT on landing page)
posthog.init(process.env.VITE_POSTHOG_KEY, {
  api_host: 'https://us.i.posthog.com',  // or eu.i.posthog.com for EU
  person_profiles: 'identified_only',
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: false,  // Manual events only (cleaner data)
  session_recording: {
    maskAllInputs: true,      // Don't record sensitive input values
    maskTextSelector: '.sensitive',  // Mask elements with .sensitive class
  },
  // Respect Do Not Track
  respect_dnt: true,
});

// Identify user after login
posthog.identify(user.id, {
  email: user.email,
  plan: user.plan,
  created_at: user.created_at,
});
```

**Frontend events to track:**

| Event | Properties | Why |
|---|---|---|
| `url_added` | `{ provider, content_type, method }` | Core activation metric |
| `url_deleted` | `{ provider, age_days }` | Churn signal |
| `change_viewed` | `{ severity, change_type }` | Engagement |
| `change_triaged` | `{ action: 'tracked'|'ignored'|'snoozed'|'resolved' }` | Workflow adoption |
| `webhook_created` | `{ events_count }` | Integration depth |
| `provider_searched` | `{ query, results_count }` | Discovery UX |
| `notification_preferences_updated` | `{ channels, digest_mode }` | Configuration depth |
| `diff_viewed` | `{ time_spent_seconds }` | Value delivery |
| `copy_as_markdown` | `{ destination_hint }` | Feature adoption |
| `feedback_submitted` | `{ type }` | User satisfaction signal |
| `plan_upgrade_clicked` | `{ from_plan, to_plan }` | Conversion funnel |
| `api_key_created` | `{}` | Developer adoption |
| `mcp_tool_used` | `{ tool_name }` | MCP adoption |
| `onboarding_step_completed` | `{ step }` | Activation funnel |

### 5.2.2 Backend

```typescript
// packages/shared/src/analytics/posthog.ts
import { PostHog } from 'posthog-node';

export const posthogClient = new PostHog(process.env.POSTHOG_API_KEY, {
  host: 'https://us.i.posthog.com',
  flushAt: 20,       // Batch 20 events before flushing
  flushInterval: 10000,  // Or flush every 10 seconds
});

// Shutdown hook
process.on('SIGTERM', async () => {
  await posthogClient.shutdown();
});
```

**Backend events to track:**

| Event | Properties | Where Emitted | Why |
|---|---|---|---|
| `check_completed` | `{ response_time_ms, change_detected, content_type }` | Check worker | Pipeline health |
| `change_detected` | `{ severity, change_type, provider, confidence }` | Check worker | Core product metric |
| `change_confirmed` | `{ severity, change_type, confirmation_stage }` | Confirmation worker | Confirmation rate |
| `notification_sent` | `{ channel, severity, latency_ms }` | Notification worker | Delivery metrics |
| `notification_failed` | `{ channel, error }` | Notification worker | Reliability |
| `learning_completed` | `{ duration_seconds, volatile_fields_count }` | Learning worker | Onboarding speed |
| `classification_completed` | `{ content_type, confidence, duration_ms }` | Classification worker | Detection quality |
| `false_positive_reported` | `{ url_id, field }` | API endpoint | FP rate |
| `account_created` | `{ referrer, utm_source }` | Auth handler | Acquisition |
| `account_upgraded` | `{ from_plan, to_plan }` | Stripe webhook | Revenue |
| `account_downgraded` | `{ from_plan, to_plan, reason }` | Stripe webhook | Churn |
| `account_deleted` | `{ plan, age_days, urls_count }` | Deletion handler | Churn analysis |
| `api_request` | `{ method, path, status, latency_ms, auth_type }` | API middleware | Usage patterns |
| `webhook_delivered` | `{ status_code, latency_ms }` | Notification worker | Webhook reliability |
| `impact_analysis_generated` | `{ provider, model, cost_usd }` | Impact worker | LLM cost tracking |
| `simulation_run` | `{ provider, method, risk_score }` | Simulation worker | Feature adoption |

### 5.2.3 User Properties (Set Once on Identify)

```typescript
posthogClient.identify({
  distinctId: user.id,
  properties: {
    email: user.email,
    plan: user.plan,
    created_at: user.created_at,
    url_count: urlCount,
    has_webhook: webhookCount > 0,
    has_api_key: apiKeyCount > 0,
    referrer: user.referrer,
  },
});
```

## 5.3 Key Metrics & Dashboards

### 5.3.1 Product Metrics (PostHog Dashboard)

| Metric | Calculation | Target |
|---|---|---|
| **Time to First Value (TTFV)** | signup → first `change_detected` event | <48 hours |
| **Activation Rate** | Users who add ≥1 URL within 24h of signup | >60% |
| **URLs Added per User per Week** | Count of `url_added` events / active users | >0.5 |
| **Changes Detected per Day** | Count of `change_confirmed` events | Growing (signal of product working) |
| **False Positive Rate** | `false_positive_reported` / `change_confirmed` | <5% |
| **Triage Completion** | Changes in non-new state / total changes | >70% |
| **Notification Open Rate** | (Email opens / emails sent) × 100 | >40% |
| **MCP Tool Usage** | Daily `mcp_tool_used` events | Growing |
| **Weekly Active Users** | Unique users with any dashboard/API activity in 7 days | Growing |
| **Feature Adoption** | % of paid users using webhooks, MCP, PM integrations | Track per feature |

### 5.3.2 Business Metrics

| Metric | Source | Dashboard |
|---|---|---|
| **MRR** | Stripe Dashboard (source of truth) | Stripe Dashboard |
| **Churn Rate** | `account_downgraded` + `account_deleted` / total paid | PostHog |
| **Free → Paid Conversion** | `account_upgraded` where from_plan=free / total free users | PostHog |
| **Plan Distribution** | Count users per plan | PostHog / Admin panel |
| **Revenue per User (ARPU)** | MRR / paid users | Calculated |
| **LTV** | ARPU / monthly churn rate | Calculated |
| **CAC** | Marketing spend / new signups (when applicable) | Manual |

**Note:** Stripe Dashboard is the source of truth for revenue metrics. PostHog tracks conversion funnels and user behavior leading to revenue events.

### 5.3.3 Technical Metrics

| Metric | Source | Alert Threshold |
|---|---|---|
| **Check latency p50/p95/p99** | `check_completed` events | p95 >10s |
| **API response time p50/p95** | `api_request` events | p95 >500ms |
| **Diff processing time** | `check_completed.diff_duration_ms` | p95 >1s |
| **LLM call latency** | `impact_analysis_generated.latency_ms` | p95 >5s |
| **LLM cost/day** | Sum of `cost_usd` across LLM events | >$5/day |
| **Queue depth** | Health monitor (§4.3) | >100 waiting |
| **Error rate by type** | Sentry + `notification_failed` + check errors | >1% |
| **Redis memory** | Health monitor | >80% |
| **DB connection count** | Health monitor | >90% |

## 5.4 Privacy

**Landing page (chirri.io):**
- Umami or Plausible only (cookieless, no consent banner needed)
- No PostHog, no session replay, no tracking pixels
- GDPR-compliant by default

**Dashboard (app.chirri.io):**
- PostHog with `respect_dnt: true`
- First-party analytics only (PostHog Cloud, data in US or EU)
- Session replay masks all input fields by default
- No tracking of API response content (only metadata: status codes, sizes, timing)
- Users can opt out via Settings → Privacy
- GDPR deletion removes all PostHog data via PostHog's deletion API

**Privacy policy requirements:**
- Disclose PostHog usage in Privacy Policy
- Explain what's tracked and why
- Provide opt-out mechanism
- Delete analytics data on account deletion

## 5.5 Event Volume Estimation

| Source | Events/Day (100 users) | Events/Day (1K users) | Events/Day (10K users) |
|---|---|---|---|
| `check_completed` | 7,200 | 72,000 | 720,000 |
| `api_request` | 2,000 | 20,000 | 200,000 |
| `change_detected` | 50 | 500 | 5,000 |
| Frontend events | 500 | 5,000 | 50,000 |
| Other backend events | 200 | 2,000 | 20,000 |
| **Total** | **~10K/day** | **~100K/day** | **~1M/day** |

**PostHog free tier: 1M events/month ≈ 33K/day.** At 100 users, we're well within limits. At 1K users (~100K/day = 3M/month), we'll need PostHog's paid tier ($0.00031/event beyond 1M). Cost at 1K users: ~$620/month. 

**Optimization:** Don't send `check_completed` to PostHog for every check. Instead, aggregate: emit a daily summary event per shared_url (`checks_summary: { total, changes, errors, avg_latency }`). This reduces events by ~90% while keeping the analytics useful.

**With optimization:**
| Users | Events/Month | PostHog Cost |
|---|---|---|
| 100 | ~300K | Free |
| 1,000 | ~1M | Free (just within limit) |
| 10,000 | ~3M | ~$620/mo |

## 5.6 Environment Variables

```
# PostHog
POSTHOG_API_KEY=phc_...          # Backend (Node SDK)
VITE_POSTHOG_KEY=phc_...         # Frontend (same key, different SDK)
POSTHOG_HOST=https://us.i.posthog.com

# Landing page analytics (separate)
UMAMI_WEBSITE_ID=...             # Or Plausible site ID
```

## 5.7 Effort Estimate

~25 hours: PostHog Cloud setup + API keys (1h), frontend SDK integration (4h), backend SDK integration (4h), event instrumentation — frontend (4h), event instrumentation — backend (4h), PostHog dashboards creation (4h), privacy opt-out mechanism (2h), documentation (2h).

---

# APPENDIX: EFFORT ESTIMATES

| System | Hours | Priority |
|---|---|---|
| CI/CD Pipeline | ~20h | P0 (needed before first deploy) |
| Testing Strategy | ~35h | P0 (needed before first deploy) |
| Error Monitoring & Alerting | ~25h | P1 (needed at launch) |
| Admin Panel | ~40h | P2 (needed shortly after launch) |
| Analytics & Metrics | ~25h | P2 (needed at launch but can be minimal) |
| **Total** | **~145h** | **~3.5 weeks solo** |

**Implementation order:**
1. **CI/CD Pipeline** — can't deploy without it
2. **Testing Strategy** — can't deploy safely without it
3. **Error Monitoring** — must have before launch (catch issues early)
4. **Analytics** — instrument early to capture day-1 data (minimal setup: PostHog init + key events)
5. **Admin Panel** — build iteratively after launch (start with CLI/DB queries, add UI as needed)

---

*This document is a companion to CHIRRI_BIBLE.md. When in conflict, the Bible wins. This spec should be integrated into the Bible as part of a version bump.*
