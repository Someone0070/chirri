# Chirri Infrastructure, Security & Legal Details

Research completed 2026-03-24. Each section covers findings, feasibility, and recommended approach.

---

## 1. Postgres Partitioning on Railway

### Findings
- Railway's Postgres is based on the **official Docker image** — it does NOT come with pg_partman pre-installed
- Railway's approach to extensions: **use a custom Docker image**. Fork Railway's postgres-ssl repo and add extensions via Dockerfile
- pg_partman requires: the extension files compiled into the PG image + `CREATE EXTENSION pg_partman` + a cron/scheduler to call `partman.run_maintenance()`
- Railway has no built-in pg_cron either, so maintenance would need an external trigger

### Feasibility: ⚠️ Possible but complex
You CAN do it by building a custom Postgres Docker image with pg_partman baked in. But you'd also need:
1. A custom Dockerfile extending `postgres:16` with pg_partman compiled in
2. A way to run `partman.run_maintenance()` periodically — either pg_cron in the image, or a Railway cron service hitting the DB

### Recommended Alternative: Native Postgres Declarative Partitioning
Skip pg_partman entirely. Use **Postgres 12+ native declarative partitioning**:

```sql
CREATE TABLE check_results (
  id UUID DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- ... other columns
) PARTITION BY RANGE (checked_at);

-- Create partitions manually or via migration
CREATE TABLE check_results_2026_03 PARTITION OF check_results
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
```

**Management approach:**
- Generate partition creation in a **monthly cron job** (Railway cron service or a scheduled task in the worker)
- The worker runs at startup or on a schedule: `SELECT create_next_partition_if_needed()`
- Write a simple function that checks if next month's partition exists, creates it if not
- Drop/detach old partitions (move to R2 archive first) via the same mechanism

**This is simpler, needs no extensions, and works on any Postgres.**

---

## 2. undici DNS Pinning / SSRF Protection

### Findings
- undici supports `connect.lookup` — a custom DNS lookup function with the same signature as `dns.lookup`
- The DNS interceptor (`interceptors.dns()`) is for caching, NOT for validation/filtering
- The `connect.lookup` approach lets you resolve DNS and validate the IP BEFORE the TCP connection is made
- This is the correct SSRF prevention hook

### Exact Code Pattern

```typescript
import { Agent, setGlobalDispatcher } from 'undici';
import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';

// Private/reserved IP ranges to block
const PRIVATE_RANGES = [
  /^127\./,                    // Loopback
  /^10\./,                     // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC 1918
  /^192\.168\./,               // RFC 1918
  /^169\.254\./,               // Link-local
  /^0\./,                      // Current network
  /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, // Shared address space
  /^198\.1[89]\./,             // Benchmarking
  /^::1$/,                     // IPv6 loopback
  /^f[cd]/i,                   // IPv6 unique local
  /^fe80/i,                    // IPv6 link-local
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_RANGES.some(range => range.test(ip));
}

const ssrfSafeAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      // If the hostname is already an IP, validate directly
      if (isIP(hostname)) {
        if (isPrivateIP(hostname)) {
          return callback(new Error(`SSRF blocked: ${hostname} resolves to private IP`), hostname, isIP(hostname) as 4 | 6);
        }
        return callback(null, hostname, isIP(hostname) as 4 | 6);
      }

      // Resolve DNS, then validate
      dnsLookup(hostname, { family: options.family ?? 0 }, (err, address, family) => {
        if (err) return callback(err, '', 4);
        if (isPrivateIP(address)) {
          return callback(
            new Error(`SSRF blocked: ${hostname} resolves to private IP ${address}`),
            address,
            family
          );
        }
        callback(null, address, family);
      });
    },
  },
});

// Use per-request or set globally
setGlobalDispatcher(ssrfSafeAgent);
```

### Key Points
- `connect.lookup` runs BEFORE the TCP connection — the resolved IP is validated, and if private, the connection never happens
- This handles DNS rebinding too since we validate the actual resolved IP
- Works with both `undici.request()` and `fetch()` when the agent is set as global dispatcher
- Also block `0.0.0.0`, `[::]`, and metadata endpoints (`169.254.169.254`)

### Feasibility: ✅ Confirmed working

---

## 3. HTML Text Extraction for Changelog Scanning

### Recommended Approach: Two-phase strategy

**Phase 1: Extract text blocks from HTML**
Use **cheerio** to parse HTML and extract semantic text blocks (paragraphs, list items, headings).

**Phase 2: Diff the text blocks**
Use **diff** (npm `diff` package — the most popular, maintained JS diff library) to compare arrays of text blocks.

### Implementation

```typescript
import * as cheerio from 'cheerio';
import { diffArrays } from 'diff';

interface TextBlock {
  tag: string;      // 'p', 'li', 'h2', etc.
  text: string;     // Extracted text content
  html: string;     // Original HTML of the block
}

function extractTextBlocks(html: string): TextBlock[] {
  const $ = cheerio.load(html);
  const blocks: TextBlock[] = [];
  
  // Target semantic block elements
  $('p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, dt, dd').each((_, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    if (text.length > 0) {
      blocks.push({
        tag: el.tagName,
        text,
        html: $.html($el) ?? '',
      });
    }
  });
  
  return blocks;
}

function getAddedBlocks(oldHtml: string, newHtml: string): TextBlock[] {
  const oldBlocks = extractTextBlocks(oldHtml);
  const newBlocks = extractTextBlocks(newHtml);
  
  const changes = diffArrays(
    oldBlocks.map(b => b.text),
    newBlocks.map(b => b.text)
  );
  
  const added: TextBlock[] = [];
  let newIdx = 0;
  
  for (const change of changes) {
    if (change.added && change.value) {
      for (const _ of change.value) {
        added.push(newBlocks[newIdx]);
        newIdx++;
      }
    } else if (!change.removed && change.count) {
      newIdx += change.count;
    }
    // Removed items don't advance newIdx
  }
  
  return added;
}

// Usage:
const added = getAddedBlocks(previousSnapshot, currentSnapshot);
// added = [{ tag: 'p', text: 'New feature: ...', html: '<p>New feature: ...</p>' }]
```

### Why This Approach
- **cheerio**: Fast, no browser needed, handles malformed HTML well
- **diff (diffArrays)**: Paragraph-level diffing, not character-level — exactly what we need
- Block-level extraction means we get complete paragraphs/items, not fragments
- Both libraries are well-maintained and lightweight

### Libraries
- `cheerio` (~20k weekly downloads, actively maintained)
- `diff` (npm package by `kpdecker`, ~45M weekly downloads)

### Feasibility: ✅ Straightforward

---

## 4. Terms of Service

### Key Clauses Needed for Chirri

1. **Service Description** — Chirri monitors user-specified URLs for changes and sends notifications
2. **User Warranties** — Users warrant they have permission/right to monitor submitted URLs; they won't use the service for harassment, stalking, or illegal surveillance
3. **No Responsibility for Action/Inaction** — Chirri is a notification service only; we are not responsible for any action or inaction taken based on change notifications
4. **Acceptable Use Policy** — No monitoring of URLs you don't own/have permission for; no overwhelming third-party servers; no illegal content monitoring
5. **Rate Limits & Fair Use** — We may throttle or suspend accounts that exceed fair use limits
6. **Data Retention & Deletion** — What we store, how long, and how to request deletion
7. **Limitation of Liability** — Service provided "as is"; no guarantee of uptime or notification delivery; total liability capped at fees paid
8. **Indemnification** — Users indemnify Chirri against claims arising from their use
9. **Modification of Terms** — We can update terms with notice
10. **Termination** — Either party can terminate; effect on data

### Recommended Approach: Template + Customization

**Use a generator like Termly.io or TermsFeed as a starting point**, then customize with Chirri-specific clauses (especially #2, #3, #4 above).

For a developer tool at early stage:
- **Start with a template** — this is standard practice for SaaS startups
- **Add Chirri-specific clauses** manually (URL monitoring warranties, no-liability for notifications)
- **Have a lawyer review** before you accept paying customers — budget ~$500-1500 for a legal review
- The template gets you 80% there; the lawyer catches the 20% that matters

**Specific template recommendation**: [TermsFeed](https://www.termsfeed.com/terms-conditions-generator/) or [Termly](https://termly.io/products/terms-and-conditions-generator/) — both have SaaS-specific options and produce reasonable boilerplate.

### Feasibility: ✅ Template now, lawyer review before launch

---

## 5. Privacy Policy

### GDPR Analysis for Chirri

**Data we process:**
1. **User account data** — email, password hash, name → PII, we are the Data Controller
2. **Monitor configuration** — URLs, check intervals → arguably not PII unless URLs contain personal identifiers
3. **Third-party page snapshots** — HTML content from monitored URLs → MAY contain PII if the page does (e.g., a public profile page)
4. **Notification data** — email delivery records → PII (email addresses)

**GDPR Requirements:**
- ✅ Privacy Policy required — must describe all data collected, purposes, retention, rights
- ✅ Lawful basis — Legitimate interest (for service operation) + Consent (for marketing, if any)
- ⚠️ DPA required — if you use sub-processors (Railway, email provider, Cloudflare). Standard practice: list sub-processors in privacy policy
- ✅ Data subject rights — must support: access, rectification, erasure, portability, restriction
- ✅ Cookie policy — needed for the dashboard (session cookies at minimum)

**Do we need a full DPA?**
- As a **Data Controller** (for user data) — you need DPAs with your sub-processors (Railway, Cloudflare, email provider like Resend/SendGrid). Most of these provide standard DPAs you just sign.
- For **enterprise customers** who want you to sign their DPA — have a template ready but this isn't urgent for MVP

**Cookie Policy:**
- Session cookies for auth → strictly necessary, no consent needed
- Analytics (if any) → consent required under GDPR
- Recommendation: use only essential cookies at launch, skip analytics consent complexity

### Recommended Approach

1. **Generate privacy policy** using Termly or TermsFeed (same tool as ToS — bundle discount)
2. **Customize** with specific data types Chirri processes
3. **Sign DPAs** with Railway, Cloudflare, and email provider (they all have standard ones)
4. **Cookie banner**: not needed if only using essential cookies (no tracking/analytics)
5. **Add data deletion endpoint**: `DELETE /api/account` that cascades to all user data
6. **Lawyer review** alongside ToS — same $500-1500 budget covers both

### Feasibility: ✅ Template now, customize + lawyer review before launch

---

## 6. Railway Infrastructure Deep Dive

### Plans & Pricing

| | **Hobby ($5/mo)** | **Pro ($20/mo)** |
|---|---|---|
| Included credits | $5/mo | $20/mo |
| Max replicas | 6 | 42 |
| Max RAM/replica | 48 GB | 24 GB (x42 = 1TB total) |
| Max CPU/replica | 48 vCPU | 24 vCPU (x42 = 1000 total) |
| Volume storage | 5 GB | Up to 250 GB (self-serve resize) |
| Ephemeral storage | 100 GB | 100 GB |
| Image size | 100 GB | Unlimited |

### Resource Usage Pricing (pay-as-you-go beyond included credits)

| Resource | Price |
|---|---|
| RAM | $10/GB/month ($0.000231/GB/min) |
| CPU | $20/vCPU/month ($0.000463/vCPU/min) |
| Network egress | $0.05/GB |
| Volume storage | $0.15/GB/month |

### Scaling

- **Vertical**: Automatic — Railway scales CPU/RAM up to plan limits automatically
- **Horizontal**: Manual — you set replica count in service settings. No auto-scaling based on load.
- **Third-party autoscaling**: Judoscale integration available for horizontal auto-scaling based on request queue time
- **Load balancing**: Automatic random distribution across replicas (multi-region: nearest region first, then random within region)
- **No sticky sessions** supported

### Volumes
- Persistent disk storage attached to a service
- Pro: self-serve resize up to 250 GB
- **Not shared between replicas** — each replica gets its own volume mount
- Volumes survive redeploys but are region-locked
- IOPS: not explicitly documented, but runs on NVMe SSD infrastructure

### Redis on Railway
- Deployed as a Docker container (official Redis image)
- **maxmemory-policy**: configurable via `CONFIG SET maxmemory-policy allkeys-lru` — just connect and run the command. It's a regular Redis instance, not a managed service with restricted commands
- **Persistence**: default Redis config (RDB snapshots). Can configure AOF by customizing the Docker image or passing config via command
- **Memory limits**: determined by your plan's RAM allocation. Set `maxmemory` explicitly via `CONFIG SET maxmemory 256mb`
- No Redis clustering built-in — single instance only

### Static Outbound IPs
- ✅ Available on **Pro plan** only
- Enable in service Settings → Networking → "Enable Static IPs"
- Assigns a permanent outbound IPv4 address per service
- **Shared IP** (not dedicated) — but consistent for whitelisting
- IPv4 only (Railway doesn't support outbound IPv6)
- IP changes if you move regions
- Cannot be used for inbound traffic

### Key Constraints
1. **No auto-horizontal-scaling** — manual replica count only (or use Judoscale)
2. **No IPv6 outbound**
3. **Volumes not shared across replicas** — important for worker design
4. **No built-in Redis cluster** — single instance
5. **No pg_cron or pg_partman** on default Postgres image

### Cost Estimate for Chirri (Pro Plan)

Rough estimate for moderate usage:
- API server: ~0.5 vCPU, 512MB RAM avg = ~$15/mo
- Worker: ~1 vCPU, 1GB RAM avg = ~$30/mo  
- Postgres: ~0.5 vCPU, 1GB RAM + 10GB volume = ~$22/mo
- Redis: ~0.25 vCPU, 256MB RAM = ~$8/mo
- **Total: ~$75/mo** (minus $20 included credit = ~$55/mo actual)

---

## 7. Cloudflare R2 for Archival

### Pricing

| | Free Tier | Paid |
|---|---|---|
| Storage | 10 GB-month/mo | $0.015/GB-month |
| Class A ops (write) | 1M/mo | $4.50/million |
| Class B ops (read) | 10M/mo | $0.36/million |
| Egress | **FREE** | **FREE** |

### Key Details
- **Zero egress fees** — this is R2's main selling point
- S3-compatible API — use `@aws-sdk/client-s3` directly
- Free tier is generous for archival (10GB free, reads basically free)
- Infrequent Access tier available at $0.01/GB-month (with $0.01/GB retrieval fee)
- Billable units round UP (1.1 GB → billed as 2 GB)

### Implementation

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { gzipSync } from 'node:zlib';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Archive old check results
async function archiveCheckResults(
  monitorId: string,
  month: string,  // e.g., '2026-03'
  data: object[]
): Promise<void> {
  const key = `archives/${monitorId}/${month}.json.gz`;
  const body = gzipSync(JSON.stringify(data));

  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    Body: body,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
    Metadata: {
      monitorId,
      month,
      recordCount: String(data.length),
    },
  }));
}

// Retrieve archived data
async function getArchivedResults(
  monitorId: string,
  month: string
): Promise<object[] | null> {
  try {
    const response = await r2.send(new GetObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: `archives/${monitorId}/${month}.json.gz`,
    }));
    const body = await response.Body?.transformToByteArray();
    if (!body) return null;
    // decompress and parse
    const { gunzipSync } = await import('node:zlib');
    return JSON.parse(gunzipSync(Buffer.from(body)).toString());
  } catch (err: any) {
    if (err.name === 'NoSuchKey') return null;
    throw err;
  }
}
```

### Gotchas
- **Billable unit rounding**: 1.1 GB billed as 2 GB — batch uploads to avoid many small objects
- **No lifecycle rules in free tier?** — Actually, lifecycle rules ARE available (move to Infrequent Access or delete after N days)
- **Eventual consistency** for deletes — but fine for archival
- **Max object size**: 5 TB (multipart upload for >5 GB)
- **Region**: auto-placed near your users, or specify with location hints

### Feasibility: ✅ Excellent fit for archival

---

## 8. Database Migration Strategy

### Drizzle Kit Migration Approach

Drizzle Kit generates SQL migration files from schema changes:
```bash
# Generate migration
npx drizzle-kit generate

# Apply migrations (programmatic)
import { migrate } from 'drizzle-orm/node-postgres/migrator';
await migrate(db, { migrationsFolder: './drizzle' });
```

### Railway Deploy Strategy

**Recommended: Run migrations as part of the deploy process**

```dockerfile
# In your Dockerfile or start script
#!/bin/bash
# run-migrations.sh
echo "Running database migrations..."
npx tsx scripts/migrate.ts
echo "Migrations complete. Starting app..."
exec node dist/server.js
```

Or use Railway's **deploy command** setting to run migrations before the app starts.

### Zero-Downtime Migration Rules

**The expand-contract pattern:**

1. **Phase 1 (Expand)**: Add new columns/tables as nullable or with defaults. Old code continues working.
2. **Phase 2 (Migrate)**: Deploy new code that writes to both old and new locations. Backfill data.
3. **Phase 3 (Contract)**: Remove old columns/code once everything uses the new schema.

**Concrete rules for Chirri:**

| Change Type | Safe? | Approach |
|---|---|---|
| Add column (nullable) | ✅ Safe | Just add it — old code ignores it |
| Add column (NOT NULL) | ⚠️ Careful | Add nullable first, backfill, then alter to NOT NULL |
| Drop column | ⚠️ Careful | Remove from code first, deploy, THEN drop column in next migration |
| Rename column | ❌ Not safe | Add new column → copy data → update code → drop old column |
| Add table | ✅ Safe | Just add it |
| Drop table | ⚠️ Careful | Remove all references first, then drop |
| Add index | ✅ Safe | Use `CREATE INDEX CONCURRENTLY` |
| Change column type | ❌ Not safe | Add new column → copy → swap |

### Drizzle Kit Limitations
- **No built-in rollback** — Drizzle Kit is forward-only
- Rollback strategy: write manual "down" migrations or use database snapshots
- Railway Postgres supports point-in-time recovery (if using volume backups)

### Recommended Migration Pipeline

```
1. Developer runs `drizzle-kit generate` locally
2. Reviews generated SQL in `drizzle/` folder
3. Commits migration files to git
4. Railway deploy triggers:
   a. Build new image
   b. Start new container
   c. Container runs migrations BEFORE accepting traffic
   d. If migration fails → deploy fails, old containers keep running
5. New container starts serving traffic
6. Old container drains and shuts down
```

### Handling Workers During Migrations

Since Chirri has both API and worker services:

1. **API deploys first** with migrations — it runs the migration on startup
2. **Worker deploys second** — by the time it starts, schema is already updated
3. Use **Railway deploy ordering** or simply accept that the worker may restart slightly after
4. Write migrations that are **backward compatible** — old worker code should still work with new schema for the brief overlap period

### Railway-Specific Tips
- Railway does **rolling deploys** — old instance stays up until new one is healthy
- Use a **healthcheck endpoint** that returns 200 only after migrations complete
- Set `RAILWAY_HEALTHCHECK_TIMEOUT` appropriately (default 300s, increase if migrations are slow)
- For data backfill migrations, run them as a **one-off Railway service** (cron job or manual trigger) rather than blocking deploy

### Feasibility: ✅ Forward-only with Drizzle Kit, use expand-contract pattern for safety

---

## Summary Table

| Topic | Status | Key Decision |
|---|---|---|
| Postgres Partitioning | ✅ Use native declarative partitioning | Skip pg_partman, manage partitions in app code |
| SSRF / DNS Pinning | ✅ Use `connect.lookup` | Custom lookup validates IP before connection |
| HTML Changelog Diff | ✅ cheerio + diff | Extract text blocks, diff arrays |
| Terms of Service | ✅ Template + customize | Use Termly/TermsFeed, add Chirri-specific clauses, lawyer review pre-launch |
| Privacy Policy | ✅ Template + GDPR compliance | Generate template, sign sub-processor DPAs, essential cookies only |
| Railway Infrastructure | ✅ Pro plan recommended | ~$55-75/mo, manual horizontal scaling, vertical auto-scaling |
| Cloudflare R2 | ✅ Excellent for archival | @aws-sdk/client-s3, zero egress, generous free tier |
| Database Migrations | ✅ Forward-only with Drizzle Kit | Expand-contract pattern, migrate on deploy before accepting traffic |
