# Railway Deployment Guide — Chirri

## Architecture

Chirri runs as **3 services** from a single monorepo:

| Service       | Package              | Purpose                        | Port |
|---------------|----------------------|--------------------------------|------|
| **api**       | `@chirri/api`        | Hono HTTP API + auth + billing | ✅ `PORT` env |
| **worker**    | `@chirri/worker`     | BullMQ job processors          | ❌ none |
| **scheduler** | `@chirri/scheduler`  | BullMQ scheduled job dispatch  | ❌ none |

All three share the same `DATABASE_URL` (Postgres) and `REDIS_URL`.

---

## Step-by-Step Setup

### 1. Create a Railway Project

1. Go to [railway.app](https://railway.app) → **New Project**
2. Name it `chirri` (or whatever you prefer)

### 2. Add Postgres

1. Click **+ New** → **Database** → **PostgreSQL**
2. Railway auto-creates `DATABASE_URL` as a service variable
3. Note the reference variable: `${{Postgres.DATABASE_URL}}`

### 3. Add Redis

1. Click **+ New** → **Database** → **Redis**
2. Railway auto-creates `REDIS_URL`
3. Note the reference variable: `${{Redis.REDIS_URL}}`

### 4. Create the API Service

1. Click **+ New** → **GitHub Repo** → select the chirri-app repo
2. Rename the service to `api`
3. Go to **Settings**:
   - **Build Command**: (leave empty, uses Dockerfile)
   - **Builder**: Dockerfile
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Build Args**: `SERVICE=api`
4. Go to **Networking**:
   - Click **Generate Domain** (e.g., `api-chirri.up.railway.app`)
5. Add environment variables (see section below)

### 5. Create the Worker Service

1. Click **+ New** → **GitHub Repo** → same repo
2. Rename to `worker`
3. **Settings**:
   - **Builder**: Dockerfile
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Build Args**: `SERVICE=worker`
4. **No** networking/domain needed
5. Add environment variables

### 6. Create the Scheduler Service

1. Click **+ New** → **GitHub Repo** → same repo
2. Rename to `scheduler`
3. **Settings**:
   - **Builder**: Dockerfile
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Build Args**: `SERVICE=scheduler`
4. **No** networking/domain needed
5. Add environment variables

### 7. Run Migrations

Before deploying, run migrations using Railway's CLI or one-off command:

```bash
# Option A: Railway CLI (local machine)
railway run node scripts/migrate.mjs

# Option B: One-off command in Railway dashboard
# Go to any service → Settings → Deploy → add a deploy command:
node scripts/migrate.mjs && node packages/${SERVICE}/dist/index.js
# (Only needed for first deploy, then remove the migrate prefix)
```

### 8. Deploy

Push to your connected branch. Railway auto-deploys all 3 services.

---

## Environment Variables

### Shared (all 3 services)

Use Railway's **Shared Variables** feature to set these once:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `${{Postgres.DATABASE_URL}}` |
| `REDIS_URL` | Redis connection string | `${{Redis.REDIS_URL}}` |
| `NODE_ENV` | Runtime environment | `production` |
| `DASHBOARD_URL` | Dashboard frontend URL | `https://app.chirri.io` |
| `DASHBOARD_ORIGIN` | CORS origin for frontend | `https://app.chirri.io` |
| `ENCRYPTION_KEY` | Encryption key for secrets | (generate a 32-byte hex string) |

### API-only

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | HTTP port (Railway sets this) | Auto-set by Railway |
| `BETTER_AUTH_SECRET` | Auth session secret | ✅ |
| `BETTER_AUTH_URL` | Auth base URL | e.g. `https://api-chirri.up.railway.app` |
| `STRIPE_SECRET_KEY` | Stripe API key | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing | ✅ |
| `STRIPE_PRICE_PERSONAL_MONTHLY` | Stripe price ID | ✅ |
| `STRIPE_PRICE_PERSONAL_ANNUAL` | Stripe price ID | ✅ |
| `STRIPE_PRICE_TEAM_MONTHLY` | Stripe price ID | ✅ |
| `STRIPE_PRICE_TEAM_ANNUAL` | Stripe price ID | ✅ |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | Stripe price ID | ✅ |
| `STRIPE_PRICE_BUSINESS_ANNUAL` | Stripe price ID | ✅ |
| `GITHUB_APP_ID` | GitHub App ID | For GitHub integration |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key | For GitHub integration |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | For GitHub integration |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret | For GitHub integration |
| `GITHUB_APP_SLUG` | GitHub App slug | Default: `chirri` |

### Worker-only

| Variable | Description | Required |
|----------|-------------|----------|
| `BRAVE_API_KEY` | Brave Search API key | For URL discovery |
| `RESEND_API_KEY` | Resend email API key | For notifications |
| `FROM_EMAIL` | Sender email address | Default: `Chirri <notifications@chirri.io>` |

### Scheduler-only

No extra variables beyond the shared ones.

---

## Generating Secrets

```bash
# BETTER_AUTH_SECRET (32 bytes)
openssl rand -hex 32

# ENCRYPTION_KEY (32 bytes)
openssl rand -hex 32
```

---

## Custom Domain

1. In the **api** service → **Networking** → **Custom Domain**
2. Add `api.chirri.io` (or your domain)
3. Set the CNAME record as Railway instructs
4. Update `BETTER_AUTH_URL` and `DASHBOARD_ORIGIN` accordingly

---

## Monitoring

- Railway provides built-in logs for each service
- Worker and scheduler log to stdout via `pino`
- Set `LOG_LEVEL=info` (or `debug`) as needed

---

## Docker Build (Local Testing)

```bash
# Build for API
docker build --build-arg SERVICE=api -t chirri-api .

# Build for Worker
docker build --build-arg SERVICE=worker -t chirri-worker .

# Build for Scheduler
docker build --build-arg SERVICE=scheduler -t chirri-scheduler .

# Run locally
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://... \
  -e REDIS_URL=redis://... \
  chirri-api
```

---

## Troubleshooting

### "Cannot find module '@chirri/shared'"
The Dockerfile patches shared package exports from `.ts` to `.js` during build. If you see this, the patching step may have failed. Check the build logs.

### Migrations fail
Ensure `DATABASE_URL` is accessible from the Railway network. Use `${{Postgres.DATABASE_URL}}` reference variable.

### Worker not processing jobs
Ensure `REDIS_URL` is set and the worker service is running. Check logs for BullMQ connection errors.
