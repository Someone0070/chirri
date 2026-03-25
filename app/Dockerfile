# ── Stage 1: builder ──────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json   packages/shared/package.json
COPY packages/api/package.json      packages/api/package.json
COPY packages/worker/package.json   packages/worker/package.json
COPY packages/scheduler/package.json packages/scheduler/package.json

# Install ALL dependencies (including devDependencies for tsc)
RUN pnpm install --frozen-lockfile

# Copy source code & configs
COPY tsconfig.base.json ./
COPY packages/shared/     packages/shared/
COPY packages/api/        packages/api/
COPY packages/worker/     packages/worker/
COPY packages/scheduler/  packages/scheduler/

# Build all packages
RUN pnpm -r --filter @chirri/shared  run build && \
    pnpm -r --filter @chirri/api     run build && \
    pnpm -r --filter @chirri/worker  run build && \
    pnpm -r --filter @chirri/scheduler run build

# Patch shared package exports to point to compiled JS for production.
# In dev, exports resolve to .ts source files; in prod we need .js from dist/.
RUN node -e " \
  const fs = require('fs'); \
  const pkg = JSON.parse(fs.readFileSync('packages/shared/package.json','utf8')); \
  const newExports = {}; \
  for (const [key, val] of Object.entries(pkg.exports)) { \
    newExports[key] = val.replace(/^\.\/src\/(.*)\.ts$/, './dist/\$1.js').replace(/^\.\/src\/index\.ts$/, './dist/index.js'); \
  } \
  pkg.exports = newExports; \
  fs.writeFileSync('packages/shared/package.json', JSON.stringify(pkg, null, 2)); \
"

# Prune devDependencies
RUN pnpm prune --prod

# Copy migrations (needed for migration runner)
COPY migrations/ migrations/
COPY drizzle.config.ts ./

# ── Stage 2: runner ──────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN addgroup -S chirri && adduser -S chirri -G chirri

WORKDIR /app

# Copy production node_modules, built output, and workspace config
COPY --from=builder /app/node_modules        node_modules/
COPY --from=builder /app/package.json         package.json
COPY --from=builder /app/pnpm-workspace.yaml  pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml       pnpm-lock.yaml

# Copy each package (dist + production deps + package.json)
COPY --from=builder /app/packages/shared/dist          packages/shared/dist/
COPY --from=builder /app/packages/shared/package.json   packages/shared/package.json
COPY --from=builder /app/packages/shared/node_modules   packages/shared/node_modules/

COPY --from=builder /app/packages/api/dist              packages/api/dist/
COPY --from=builder /app/packages/api/package.json       packages/api/package.json
COPY --from=builder /app/packages/api/node_modules       packages/api/node_modules/

COPY --from=builder /app/packages/worker/dist            packages/worker/dist/
COPY --from=builder /app/packages/worker/package.json     packages/worker/package.json
COPY --from=builder /app/packages/worker/node_modules     packages/worker/node_modules/

COPY --from=builder /app/packages/scheduler/dist          packages/scheduler/dist/
COPY --from=builder /app/packages/scheduler/package.json   packages/scheduler/package.json
COPY --from=builder /app/packages/scheduler/node_modules   packages/scheduler/node_modules/

# Copy migrations for runtime migration commands
COPY --from=builder /app/migrations  migrations/

# Copy migration script
COPY scripts/migrate.mjs scripts/migrate.mjs

USER chirri

ARG SERVICE
ENV SERVICE=${SERVICE}

CMD node packages/${SERVICE}/dist/index.js
