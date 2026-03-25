# Chirri — Integration Implementation Details & Library Recommendations

> Research completed 2026-03-24. Exact payloads, library picks, and cost analysis for every integration.

---

## Table of Contents
1. [Notification Integrations](#1-notification-integrations)
2. [Libraries](#2-libraries)
3. [Stripe Billing](#3-stripe-billing)
4. [Dashboard Specifics](#4-dashboard-specifics)
5. [Marketing/Content Tools](#5-marketingcontent-tools)

---

## 1. Notification Integrations

### 1.1 Slack — Block Kit Webhooks

**Approach:** Use Block Kit (not plain text). Block Kit provides structured layouts with sections, fields, dividers, and context blocks — far better for an API change alert than a wall of text. Character limit: 3,000 per text block, 50 blocks per message.

**Setup:** User creates a Slack App → Incoming Webhook → gives us the URL. We POST JSON.

**Exact Payload for a Chirp Alert:**

```json
{
  "blocks": [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "🐦 API Change Detected",
        "emoji": true
      }
    },
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*API:*\nStripe Payments API"
        },
        {
          "type": "mrkdwn",
          "text": "*Severity:*\n🔴 Breaking Change"
        },
        {
          "type": "mrkdwn",
          "text": "*Source:*\nOpenAPI Spec"
        },
        {
          "type": "mrkdwn",
          "text": "*Detected:*\nMar 24, 2026 02:15 UTC"
        }
      ]
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*What changed:*\n• Removed field `source_type` from `/v1/charges` response\n• Added required parameter `payment_method` to `POST /v1/payment_intents`\n• Deprecated endpoint `POST /v1/charges` (sunset: 2026-06-01)"
      }
    },
    {
      "type": "divider"
    },
    {
      "type": "context",
      "elements": [
        {
          "type": "mrkdwn",
          "text": "<https://app.chirri.dev/chirps/abc123|View full diff in Chirri> · Monitoring `api.stripe.com/v1`"
        }
      ]
    }
  ]
}
```

**Implementation:**
```typescript
async function sendSlackNotification(webhookUrl: string, chirp: Chirp) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks: buildSlackBlocks(chirp) }),
  });
  if (!response.ok) throw new Error(`Slack webhook failed: ${response.status}`);
}
```

**Cost:** Free (Slack webhooks are free).

---

### 1.2 Discord — Embed Webhooks

**Approach:** Use embeds (not plain messages). Embeds support colored side-bars, fields, footers, timestamps, and thumbnails. Color is a decimal integer (not hex). Up to 10 embeds per message, 6,000 chars total across all embeds.

**Exact Payload:**

```json
{
  "username": "Chirri",
  "avatar_url": "https://chirri.dev/logo.png",
  "embeds": [
    {
      "title": "🐦 API Change Detected — Stripe Payments API",
      "url": "https://app.chirri.dev/chirps/abc123",
      "color": 15548997,
      "description": "**Breaking changes detected in OpenAPI spec**\n\n• Removed field `source_type` from `/v1/charges` response\n• Added required param `payment_method` to `POST /v1/payment_intents`\n• Deprecated `POST /v1/charges` (sunset: 2026-06-01)",
      "fields": [
        {
          "name": "Severity",
          "value": "🔴 Breaking",
          "inline": true
        },
        {
          "name": "Source",
          "value": "OpenAPI Spec",
          "inline": true
        },
        {
          "name": "Monitor",
          "value": "api.stripe.com/v1",
          "inline": true
        }
      ],
      "footer": {
        "text": "Chirri • chirri.dev",
        "icon_url": "https://chirri.dev/favicon.ico"
      },
      "timestamp": "2026-03-24T02:15:00.000Z"
    }
  ]
}
```

**Color mapping:**
- Breaking (critical): `15548997` (red, #ED4245)
- Warning (deprecation): `16776960` (yellow, #FFFF00)  
- Info (additive): `5763719` (green, #57F287)

**Cost:** Free.

---

### 1.3 Email — **Recommendation: Resend**

**Comparison:**

| Service | Free Tier | Paid Start | DX | Notes |
|---------|-----------|------------|-----|-------|
| **Resend** | 3,000 emails/month | $20/mo (50K) | ★★★★★ | Best DX, React Email templates, built for developers |
| SendGrid | Removed free tier (was 100/day) | $19.95/mo (50K) | ★★★ | Twilio-owned, bloated, free tier gone as of 2025 |
| Postmark | 100 emails/month (test) | $15/mo (10K) | ★★★★ | Great deliverability but more expensive per email |

**Winner: Resend** — 3,000 free emails/month is more than enough for early stage. Best developer experience with native TypeScript SDK, React Email for templates, and simple REST API. Chirri at <1,000 emails/month = **$0/month**.

**Implementation with React Email:**
```typescript
import { Resend } from 'resend';
import { ChirpEmail } from '@/emails/chirp-notification';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendChirpEmail(to: string, chirp: Chirp) {
  await resend.emails.send({
    from: 'Chirri <alerts@chirri.dev>',
    to,
    subject: `🐦 ${chirp.severity}: ${chirp.apiName} — API change detected`,
    react: ChirpEmail({ chirp }),
  });
}
```

**Email Template (React Email):**
```tsx
// emails/chirp-notification.tsx
import { Html, Head, Body, Container, Section, Text, Link, Hr } from '@react-email/components';

export function ChirpEmail({ chirp }: { chirp: Chirp }) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif', background: '#f6f6f6' }}>
        <Container style={{ background: '#fff', padding: '20px', borderRadius: '8px' }}>
          <Text style={{ fontSize: '20px', fontWeight: 'bold' }}>
            🐦 API Change Detected
          </Text>
          <Text><strong>{chirp.apiName}</strong> — {chirp.severity}</Text>
          <Section style={{ background: '#f9f9f9', padding: '16px', borderRadius: '4px' }}>
            <Text>{chirp.summary}</Text>
          </Section>
          <Hr />
          <Link href={`https://app.chirri.dev/chirps/${chirp.id}`}>
            View full diff →
          </Link>
        </Container>
      </Body>
    </Html>
  );
}
```

---

### 1.4 PagerDuty — Events API v2

**Endpoint:** `POST https://events.pagerduty.com/v2/enqueue`

**Severity mapping:**
| Chirri Severity | PagerDuty Severity |
|----------------|-------------------|
| Breaking change | `critical` |
| Deprecation | `warning` |
| Additive change | `info` |
| No change (resolved) | Use `resolve` event_action |

**Exact Payload:**

```json
{
  "routing_key": "USER_INTEGRATION_KEY_HERE",
  "event_action": "trigger",
  "dedup_key": "chirri-stripe-api-2026-03-24",
  "payload": {
    "summary": "Breaking API change: Stripe Payments API — removed field source_type from /v1/charges",
    "source": "chirri.dev",
    "severity": "critical",
    "component": "stripe-payments-api",
    "group": "api-monitoring",
    "class": "api-breaking-change",
    "custom_details": {
      "api_name": "Stripe Payments API",
      "monitor_url": "https://api.stripe.com/v1",
      "changes_count": 3,
      "chirp_url": "https://app.chirri.dev/chirps/abc123",
      "changes": [
        "Removed field source_type from /v1/charges response",
        "Added required parameter payment_method",
        "Deprecated POST /v1/charges"
      ]
    }
  },
  "links": [
    {
      "href": "https://app.chirri.dev/chirps/abc123",
      "text": "View in Chirri"
    }
  ]
}
```

**Key detail:** `dedup_key` prevents duplicate incidents. Use `{monitor_id}-{date}` or `{monitor_id}-{content_hash}` as the dedup key.

**Cost:** Free to send events. PagerDuty pricing is on the customer's side.

---

### 1.5 Outbound Webhooks — HMAC-SHA256 Signing

**Format:** Stripe-style signature header.

```
Chirri-Signature: t=1711238100,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

**Implementation:**

```typescript
import crypto from 'node:crypto';

// --- Signing (when sending) ---
function signWebhookPayload(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedContent = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

// --- Verification (in docs for customers) ---
function verifyWebhookSignature(
  payload: string, 
  signatureHeader: string, 
  secret: string, 
  toleranceSeconds = 300
): boolean {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(p => p.split('=') as [string, string])
  );
  
  const timestamp = parseInt(parts.t, 10);
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  
  // Timing-safe comparison
  const isValid = crypto.timingSafeEqual(
    Buffer.from(parts.v1),
    Buffer.from(expectedSig)
  );
  
  // Replay protection
  const age = Math.floor(Date.now() / 1000) - timestamp;
  return isValid && age <= toleranceSeconds;
}
```

**Retry Strategy:**
```typescript
const RETRY_SCHEDULE = [
  0,          // immediate
  60,         // 1 minute
  300,        // 5 minutes
  1800,       // 30 minutes
  7200,       // 2 hours
  28800,      // 8 hours
  86400,      // 24 hours
]; // 7 attempts total over ~24h

async function deliverWebhook(endpoint: string, payload: object, secret: string) {
  const body = JSON.stringify(payload);
  const signature = signWebhookPayload(body, secret);
  
  for (let attempt = 0; attempt < RETRY_SCHEDULE.length; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_SCHEDULE[attempt] * 1000);
    }
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Chirri-Signature': signature,
          'Chirri-Webhook-Id': crypto.randomUUID(),
          'Chirri-Webhook-Timestamp': String(Math.floor(Date.now() / 1000)),
        },
        body,
        signal: AbortSignal.timeout(30_000), // 30s timeout
      });
      
      if (response.ok) return { success: true, attempts: attempt + 1 };
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        // Don't retry 4xx (except 429)
        return { success: false, attempts: attempt + 1, status: response.status };
      }
    } catch (err) {
      // Network error — continue retrying
    }
  }
  
  return { success: false, attempts: RETRY_SCHEDULE.length };
}
```

**Best practices implemented:**
- HMAC-SHA256 with timestamp for replay protection
- 5-minute tolerance window
- Timing-safe comparison (prevents timing attacks)
- 7 retries over 24h with exponential backoff
- Don't retry 4xx errors (client-side, won't fix themselves)
- 30s request timeout
- Unique webhook ID for idempotency

---

## 2. Libraries

### 2.1 HTML Text Extraction & Diffing

**For changelog page scanning (extract meaningful text from HTML):**

| Library | Use Case | Notes |
|---------|----------|-------|
| **cheerio** | CSS-selector based extraction | jQuery for Node. Fast, no DOM needed. Use when you know the page structure |
| **@mozilla/readability** | Article content extraction | Firefox's Reader Mode algorithm. Great for extracting "the content" from a blog/changelog page. Requires JSDOM |
| **turndown** | HTML → Markdown | Converts HTML to markdown. Good for making diffs human-readable |

**Recommendation: Use all three for different stages:**

```
HTML Page → cheerio (strip nav/footer/ads) → @mozilla/readability (extract article content) → turndown (convert to markdown for clean diffing)
```

**For HTML diffing (detecting meaningful changes):**

Don't diff raw HTML — diff the extracted text/markdown instead. This avoids false positives from CSS class changes, layout shifts, etc.

```typescript
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { diffLines } from 'diff';

function extractContent(html: string, url: string): string {
  // Strip navigation, headers, footers
  const $ = cheerio.load(html);
  $('nav, header, footer, script, style, .sidebar, .menu').remove();
  
  // Use Readability to extract article content
  const dom = new JSDOM($.html(), { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  
  if (!article) return $.text().trim();
  
  // Convert to markdown for clean diffing
  const turndown = new TurndownService();
  return turndown.turndown(article.content);
}

function diffContent(oldHtml: string, newHtml: string, url: string) {
  const oldContent = extractContent(oldHtml, url);
  const newContent = extractContent(newHtml, url);
  return diffLines(oldContent, newContent);
}
```

**NPM packages needed:**
- `cheerio` — 28M weekly downloads, actively maintained
- `@mozilla/readability` + `jsdom` — Firefox's algorithm
- `turndown` — 600K weekly downloads
- `diff` — 40M weekly downloads (the actual diff engine behind everything)

---

### 2.2 Diff Viewer (Frontend) — **Recommendation: Monaco Editor DiffEditor**

**Comparison:**

| Library | JSON | HTML | Syntax Highlighting | Line Numbers | Bundle Size | Maintained |
|---------|------|------|---------------------|-------------|-------------|------------|
| `react-diff-viewer` | Text only | Text only | No (custom CSS) | Yes | 15KB | Last publish 2021 😬 |
| `react-diff-viewer-continued` | Text only | Text only | No | Yes | 15KB | Fork, more recent |
| `@monaco-editor/react` | ★★★★★ | ★★★★★ | Full (100+ languages) | Yes | ~2MB | VS Code team |
| `json-diff-kit` | ★★★★★ | No | JSON only | Yes | 30KB | Active |
| `diff2html` | Text only | Text only | Yes (Prism) | Yes | 50KB | Active |

**Winner: `@monaco-editor/react` with `DiffEditor` component.**

**Why Monaco:**
- It's literally the VS Code diff viewer — users already know it
- Built-in syntax highlighting for JSON, YAML, HTML, XML, and 100+ languages
- Side-by-side AND inline diff modes
- Collapsible unchanged sections
- Minimap navigation
- The "money screen" needs to look professional — Monaco looks professional
- Handles massive files (it's VS Code's engine)

**The bundle size trade-off:** Monaco is ~2MB, but it lazy-loads. For a SaaS dashboard where the diff viewer IS the product, this is worth it.

**Implementation:**

```tsx
import { DiffEditor } from '@monaco-editor/react';

function ChirpDiffViewer({ oldContent, newContent, language }: {
  oldContent: string;
  newContent: string;
  language: 'json' | 'yaml' | 'html' | 'xml' | 'markdown' | 'plaintext';
}) {
  return (
    <DiffEditor
      original={oldContent}
      modified={newContent}
      language={language}
      theme="vs-dark"
      options={{
        readOnly: true,
        renderSideBySide: true,
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        diffWordWrap: 'on',
        renderOverviewRuler: true,
        originalEditable: false,
      }}
      height="600px"
    />
  );
}
```

**For JSON specifically:** Pre-process with `JSON.stringify(obj, null, 2)` before diffing. Monaco will then highlight the structural differences beautifully.

**For OpenAPI spec diffs:** Use `api-smart-diff` (see §2.5) to generate a structured diff, then display the raw YAML side-by-side in Monaco AND show a summary table of breaking/non-breaking changes above it.

---

### 2.3 RSS/XML Parsing — **Recommendation: `fast-xml-parser`**

**Comparison:**

| Library | Weekly Downloads | Speed | Maintained | Notes |
|---------|-----------------|-------|------------|-------|
| **fast-xml-parser** | 25M+ | Fastest (no regex) | ★★★★★ Active | Handles 100MB files, XML entities, configurable |
| `rss-parser` | 600K | Moderate | ★★★ OK | Higher-level RSS abstraction, wraps xml2js |
| `xml2js` | 20M+ | Slow | ★★ Stale | Battle-tested but slower, callback-based |

**Winner: `fast-xml-parser`** — fastest, most actively maintained, handles edge cases. Use it for both RSS feed parsing and general XML handling.

For RSS specifically, build a thin wrapper:

```typescript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
}

function parseRSSFeed(xml: string): RSSItem[] {
  const result = parser.parse(xml);
  const channel = result.rss?.channel || result.feed; // RSS 2.0 or Atom
  const items = channel?.item || channel?.entry || [];
  return (Array.isArray(items) ? items : [items]).map(item => ({
    title: item.title || '',
    link: item.link?.['@_href'] || item.link || '',
    description: item.description || item.summary || item.content || '',
    pubDate: item.pubDate || item.published || item.updated || '',
    guid: item.guid || item.id || item.link || '',
  }));
}
```

---

### 2.4 URL Normalization — **Confirmed: `normalize-url`**

**Package:** `normalize-url` by sindresorhus — 15M+ weekly downloads.

**What it handles:**
- Removes trailing slashes
- Removes default ports (`:80`, `:443`)
- Sorts query parameters
- Removes `www.` (configurable)
- Resolves `/../` path segments
- Normalizes protocol (`HTTP` → `http`)
- Removes hash fragments (configurable)
- Removes common tracking parameters (`utm_*`)
- URL-encodes unicode

**Edge cases to be aware of:**
- ESM-only (v7+) — need `import`, not `require`
- `stripWWW: true` is default — may want to disable if monitoring `www.` vs non-`www.` as separate endpoints
- Does NOT normalize API versioning paths (`/v1/` vs `/v2/`)
- Does NOT handle case-sensitive paths (some APIs are case-sensitive)

**Our usage:**
```typescript
import normalizeUrl from 'normalize-url';

function normalizeMonitorUrl(url: string): string {
  return normalizeUrl(url, {
    stripWWW: false,         // Keep www distinction
    removeTrailingSlash: true,
    sortQueryParameters: true,
    stripHash: true,
    removeQueryParameters: [/^utm_/i], // Remove tracking params
  });
}
```

**No alternatives needed** — this is the standard.

---

### 2.5 OpenAPI Diff — **Recommendation: `api-smart-diff`**

**Comparison:**

| Library | NPM Native | OpenAPI 3.x | Breaking Detection | Maintained |
|---------|-----------|-------------|-------------------|------------|
| **api-smart-diff** | ✅ Yes | ✅ Yes | ✅ Yes | Active (last publish: 2024) |
| `openapi-diff` (npm) | ✅ Yes | ✅ Swagger 2 + OA3 | ✅ Breaking/non-breaking | Atlassian, last active 2022 |
| `oasdiff` | ❌ Go CLI only | ✅ Yes | ✅ Best classification | Very active but not JS |
| OpenAPITools/openapi-diff | ❌ Java CLI | ✅ Yes | ✅ Yes | Active but Java |

**Winner: `api-smart-diff`**

**Why:**
- Pure JavaScript/TypeScript — works natively in Node.js
- Supports OpenAPI 3.x, AsyncAPI, JSON Schema, and GraphQL
- Classifies changes as breaking, non-breaking, or annotation
- Same author (`udamir`) also built `api-diff-viewer` React component
- Lightweight (no Go/Java binary to manage)

**Implementation:**

```typescript
import { apiDiff } from 'api-smart-diff';

function diffOpenAPISpecs(oldSpec: object, newSpec: object) {
  const diff = apiDiff(oldSpec, newSpec, { 
    rules: 'openapi3' // or 'swagger', 'asyncapi2', 'jsonSchema'
  });
  
  const breaking = diff.filter(d => d.type === 'breaking');
  const nonBreaking = diff.filter(d => d.type === 'non-breaking');
  const annotation = diff.filter(d => d.type === 'annotation');
  
  return {
    hasBreakingChanges: breaking.length > 0,
    breaking,
    nonBreaking,
    annotation,
    summary: `${breaking.length} breaking, ${nonBreaking.length} non-breaking, ${annotation.length} annotations`,
  };
}
```

**Bonus:** The `api-diff-viewer` package from the same author provides a React component specifically designed to visualize these diffs — could complement Monaco for OpenAPI-specific views.

**Fallback plan:** If `api-smart-diff` proves insufficient for edge cases, shell out to `oasdiff` Go binary (downloadable, no Go installation needed).

---

## 3. Stripe Billing Implementation

### 3.1 Architecture Overview

```
User clicks "Upgrade" → Stripe Checkout Session → Stripe hosted page → 
  → Success redirect → Webhook: checkout.session.completed → Provision plan
```

### 3.2 Products & Prices Setup

Create in Stripe Dashboard (or via API on first deploy):

```typescript
// One-time setup script
const products = {
  free: null, // No Stripe product needed
  pro: await stripe.products.create({
    name: 'Chirri Pro',
    metadata: { chirri_plan: 'pro' },
  }),
  team: await stripe.products.create({
    name: 'Chirri Team', 
    metadata: { chirri_plan: 'team' },
  }),
};

// Monthly prices
const prices = {
  pro_monthly: await stripe.prices.create({
    product: products.pro.id,
    unit_amount: 2900, // $29/mo
    currency: 'usd',
    recurring: { interval: 'month' },
  }),
  pro_yearly: await stripe.prices.create({
    product: products.pro.id,
    unit_amount: 29000, // $290/yr (~$24/mo)
    currency: 'usd',
    recurring: { interval: 'year' },
  }),
  team_monthly: await stripe.prices.create({
    product: products.team.id,
    unit_amount: 7900, // $79/mo
    currency: 'usd',
    recurring: { interval: 'month' },
  }),
  team_yearly: await stripe.prices.create({
    product: products.team.id,
    unit_amount: 79000, // $790/yr (~$66/mo)
    currency: 'usd',
    recurring: { interval: 'year' },
  }),
};
```

### 3.3 Checkout Flow

```typescript
// Create checkout session for new subscription
async function createCheckoutSession(userId: string, priceId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  
  const session = await stripe.checkout.sessions.create({
    customer: user.stripeCustomerId || undefined,
    customer_email: !user.stripeCustomerId ? user.email : undefined,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/settings/billing?canceled=true`,
    subscription_data: {
      metadata: { userId },
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: true },
  });
  
  return session.url;
}
```

### 3.4 Upgrade/Downgrade (Proration)

```typescript
async function changeSubscription(userId: string, newPriceId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
  
  // Determine if upgrade or downgrade
  const currentPrice = subscription.items.data[0].price.unit_amount;
  const newPrice = await stripe.prices.retrieve(newPriceId);
  const isUpgrade = newPrice.unit_amount > currentPrice;
  
  await stripe.subscriptions.update(subscription.id, {
    items: [{
      id: subscription.items.data[0].id,
      price: newPriceId,
    }],
    proration_behavior: isUpgrade 
      ? 'always_invoice'        // Upgrade: charge difference immediately
      : 'create_prorations',    // Downgrade: credit applied to next invoice
    // For downgrades, optionally delay to end of period:
    // ...(isUpgrade ? {} : { proration_behavior: 'none', billing_cycle_anchor: 'unchanged' })
  });
}
```

**Proration strategy:**
- **Upgrade:** `always_invoice` — charge the prorated difference immediately. User gets access right away.
- **Downgrade:** `create_prorations` — creates a credit on the next invoice. User keeps current plan until period ends. Alternative: use subscription schedules to defer the change.

### 3.5 Dunning & Payment Failure

**Configure in Stripe Dashboard → Settings → Billing → Subscriptions:**
- Enable **Smart Retries** (Stripe's ML-based retry timing)
- Retry schedule: 3 attempts over 2 weeks
- After final failure: mark subscription `past_due` → send one more email → cancel after 30 days

**Webhook handling for payment failures:**

```typescript
// In webhook handler
switch (event.type) {
  case 'invoice.paid':
    // ✅ Payment successful — ensure access is active
    await db.user.update({
      where: { stripeCustomerId: invoice.customer },
      data: { subscriptionStatus: 'active' },
    });
    break;

  case 'invoice.payment_failed':
    // ⚠️ Payment failed — send warning, restrict features after grace period
    const invoice = event.data.object;
    if (invoice.attempt_count >= 2) {
      await db.user.update({
        where: { stripeCustomerId: invoice.customer },
        data: { subscriptionStatus: 'past_due' },
      });
      // Send email: "Your payment failed, please update your card"
    }
    break;

  case 'customer.subscription.updated':
    // Plan changed, or status changed
    const sub = event.data.object;
    await db.user.update({
      where: { stripeCustomerId: sub.customer },
      data: {
        plan: sub.metadata.chirri_plan || getPlanFromPriceId(sub.items.data[0].price.id),
        subscriptionStatus: sub.status, // 'active', 'past_due', 'canceled', etc.
      },
    });
    break;

  case 'customer.subscription.deleted':
    // Subscription canceled or expired
    await db.user.update({
      where: { stripeCustomerId: event.data.object.customer },
      data: { plan: 'free', subscriptionStatus: 'canceled' },
    });
    break;
}
```

### 3.6 Complete Webhook Events to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/link Stripe customer, provision plan |
| `invoice.paid` | Confirm payment, ensure active access |
| `invoice.payment_failed` | Warn user, potentially restrict after N failures |
| `customer.subscription.updated` | Sync plan & status to DB |
| `customer.subscription.deleted` | Downgrade to free |
| `customer.subscription.paused` | Restrict access (if using pause feature) |
| `customer.subscription.resumed` | Restore access |

### 3.7 Customer Portal

Don't build billing management UI — use Stripe's Customer Portal:

```typescript
async function createPortalSession(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${APP_URL}/settings/billing`,
  });
  return session.url;
}
```

This gives users: invoice history, plan changes, payment method updates, cancellation — all handled by Stripe.

---

## 4. Dashboard Specifics

### 4.1 Real-time Updates — **Recommendation: SSE (Server-Sent Events)**

**Why SSE over WebSocket:**
- Chirri's dashboard is **server → client** only (monitoring results pushed to user)
- SSE works over standard HTTP — no special infrastructure, works with HTTP/2 multiplexing
- Automatic reconnection built into browser's `EventSource` API
- Works through proxies, load balancers, CDNs without special config
- Simpler server implementation (it's just HTTP streaming)
- Used by: GitHub (notifications), Vercel (deployment logs), Linear (real-time updates)

**When you'd need WebSocket instead:** If users could interact in real-time (collaborative editing, chat). Chirri doesn't need this.

**Server Implementation (Next.js Route Handler):**

```typescript
// app/api/events/route.ts
export async function GET(request: Request) {
  const encoder = new TextEncoder();
  const userId = await getUserFromRequest(request);
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));
      
      // Subscribe to user's events (Redis pub/sub, or DB polling)
      const unsubscribe = eventBus.subscribe(userId, (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      });
      
      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: heartbeat\n\n`));
      }, 30000);
      
      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Client:**
```typescript
function useChirriEvents() {
  useEffect(() => {
    const source = new EventSource('/api/events');
    
    source.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Update React Query cache, or dispatch to state
      queryClient.invalidateQueries({ queryKey: ['chirps'] });
    };
    
    source.onerror = () => {
      // EventSource auto-reconnects — just log
      console.warn('SSE connection lost, reconnecting...');
    };
    
    return () => source.close();
  }, []);
}
```

### 4.2 Side-by-Side Diff Viewer (The Money Screen)

**Already covered in §2.2** — Use `@monaco-editor/react` `DiffEditor`.

**Additional UI around it:**

```
┌─────────────────────────────────────────────────────┐
│ 🐦 Chirp: Stripe API — 3 breaking changes           │
│ Detected: Mar 24, 2026 02:15 UTC                    │
│ Source: OpenAPI Spec                                  │
├─────────────────────────────────────────────────────┤
│ [Summary Tab] [Raw Diff Tab] [Timeline Tab]          │
├─────────────────────────────────────────────────────┤
│ ⚠️ BREAKING CHANGES                                  │
│ • DELETE /v1/charges — Removed field: source_type    │
│ • POST /v1/payment_intents — New required param      │
│ • POST /v1/charges — Deprecated (sunset: 2026-06-01) │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─── Before ───────┐  ┌─── After ────────┐         │
│  │ (Monaco Diff     │  │  (Monaco Diff     │         │
│  │  Editor - left)  │  │   Editor - right) │         │
│  │                  │  │                   │         │
│  │  Line numbers    │  │  Line numbers     │         │
│  │  Syntax colored  │  │  Syntax colored   │         │
│  │  Red = removed   │  │  Green = added    │         │
│  │                  │  │                   │         │
│  └──────────────────┘  └───────────────────┘         │
│                                                       │
│ [Toggle: Side-by-Side / Inline]  [Copy] [Share]      │
└─────────────────────────────────────────────────────┘
```

**Content type detection for language:**
```typescript
function detectLanguage(content: string, sourceType: string): string {
  if (sourceType === 'openapi') return 'yaml'; // or 'json'
  if (sourceType === 'graphql') return 'graphql';
  try { JSON.parse(content); return 'json'; } catch {}
  if (content.startsWith('<!DOCTYPE') || content.startsWith('<html')) return 'html';
  if (content.includes('openapi:') || content.includes('swagger:')) return 'yaml';
  return 'plaintext';
}
```

---

## 5. Marketing/Content Tools

### 5.1 Blog Platform — **Recommendation: Astro (with MDX)**

**Why Astro:**
- Ships zero JS by default (static HTML) — fastest possible page loads
- Native MDX support with interactive React components when needed
- Content Collections API with type-safe frontmatter schemas
- Built-in sitemap, RSS feed generation
- Deploy anywhere (Vercel, Cloudflare, Netlify — all free tier)
- Can use the same Tailwind/design system as the main app
- SEO-friendly: static HTML, structured data, fast loading
- Lives in the same monorepo (`apps/blog/`) — shared types, components

**Why not others:**
- Ghost: Separate service to host, doesn't share design system
- WordPress: Overkill, security maintenance burden
- Hashnode: Hosted, less control over design
- Next.js blog: Heavier than needed for static content

**Setup:** `apps/blog/` in the monorepo, deployed to `chirri.dev/blog` via path rewriting or separate subdomain `blog.chirri.dev`.

**Cost:** $0 (Vercel/Cloudflare free tier).

---

### 5.2 Newsletter — **Recommendation: Buttondown**

**Why Buttondown:**
- Free tier: 100 subscribers (enough for launch)
- $9/mo for up to 1,000 subscribers (Basic)
- Markdown-native — write in the same format as blog posts
- Excellent API for programmatic sending
- Native Stripe integration (if we ever do paid newsletter)
- RSS-to-email automation (auto-send blog posts as newsletter)
- No Buttondown branding on free tier
- Developer-friendly, indie-built

**Why not Resend for newsletter too?** Resend is transactional email. Newsletters need: subscriber management, unsubscribe handling, list management, open/click tracking, archives. Buttondown handles all of this. Resend doesn't.

**Cost:** $0 → $9/mo at 100+ subscribers.

---

### 5.3 Analytics — **Recommendation: Plausible Analytics (Cloud)**

**Comparison:**

| Tool | Free Tier | Self-Host | Privacy | Events | Funnels |
|------|-----------|-----------|---------|--------|---------|
| **Plausible** | No (€9/mo) | Yes (free) | ★★★★★ | ✅ | ✅ |
| Umami | Cloud free (10K/mo) | Yes (free) | ★★★★★ | ✅ | ❌ |
| PostHog | 1M events free | Yes | ★★★★ | ✅ | ✅ |
| Fathom | No ($15/mo) | Deprecated | ★★★★★ | Limited | ❌ |

**Winner: Plausible (self-hosted) or Umami (cloud free tier)**

**If you want zero cost:** Use **Umami Cloud** — free for 10K events/month, privacy-friendly, open source. Enough for early stage.

**If you want the best product:** Use **Plausible self-hosted** — deploy via Docker alongside other services, €0/month. Has funnels, custom events, goals, email reports, Slack integration.

**If you'll hit scale:** Use **PostHog** — 1M events free/month, plus session replay, feature flags, A/B testing. Heavier but more capable. Best if you want a single tool for everything.

**Recommendation for Chirri:** Start with **Umami Cloud** (free), migrate to Plausible self-hosted when you care about funnels.

**Cost:** $0 (Umami Cloud or Plausible self-hosted).

---

### 5.4 Twitter/X Automation — @ChirriChangelog

**X API Pricing (as of 2025/2026):**

| Tier | Cost | Tweet Limit | Read Limit |
|------|------|-------------|------------|
| Free | $0 | 1,500 tweets/month | 0 reads |
| Basic | $100/month | 3,000 tweets/month | 10,000 reads |
| Pro | $5,000/month | Don't need this | 1M reads |

**The Free tier is enough.** 1,500 tweets/month = ~50/day. For a changelog bot posting a few times per week, this is overkill.

**Approach: Use the Free tier X API directly.**

```typescript
import { TwitterApi } from 'twitter-api-v2';

const client = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

async function postChirpTweet(chirp: Chirp) {
  const tweet = [
    `🐦 ${chirp.apiName} — API change detected`,
    '',
    chirp.changes.slice(0, 3).map(c => `• ${c}`).join('\n'),
    chirp.changes.length > 3 ? `...and ${chirp.changes.length - 3} more` : '',
    '',
    `🔗 ${chirp.url}`,
    '',
    '#APIChanges #DevTools',
  ].filter(Boolean).join('\n');
  
  // Twitter/X has 280 char limit — truncate if needed
  const truncated = tweet.length > 280 
    ? tweet.slice(0, 277) + '...' 
    : tweet;
  
  await client.v2.tweet(truncated);
}
```

**Alternatives considered:**
- Zapier/IFTTT: $20+/month for automation — more expensive than just using the free API
- Buffer/Hootsuite: Overkill for a single bot account
- Typefully: Good but not programmatic

**Cost:** $0 (Free tier). If free tier ever gets killed entirely, the `twitter-api-v2` npm package works the same on the $100/mo Basic tier.

---

## Summary: Complete Dependency List

### Backend (npm packages)
```json
{
  "dependencies": {
    "stripe": "^17.0.0",
    "resend": "^4.0.0",
    "@react-email/components": "^0.0.30",
    "fast-xml-parser": "^5.0.0",
    "cheerio": "^1.0.0",
    "@mozilla/readability": "^0.5.0",
    "jsdom": "^25.0.0",
    "turndown": "^7.0.0",
    "diff": "^7.0.0",
    "normalize-url": "^8.0.0",
    "api-smart-diff": "^1.0.0",
    "twitter-api-v2": "^1.18.0"
  }
}
```

### Frontend (npm packages)
```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.7.0"
  }
}
```

### External Services

| Service | Cost (Launch) | Cost (Growth) |
|---------|--------------|---------------|
| Slack webhooks | Free | Free |
| Discord webhooks | Free | Free |
| Resend (email) | Free (3K/mo) | $20/mo (50K) |
| PagerDuty Events API | Free (to send) | Free (to send) |
| Stripe | 2.9% + 30¢ per tx | Same |
| Buttondown (newsletter) | Free (100 subs) | $9/mo |
| Umami (analytics) | Free (10K events) | Self-host free |
| X/Twitter API | Free (1,500 tweets) | $100/mo if needed |
| Astro blog hosting | Free (Vercel) | Free |

**Total monthly cost at launch: $0** (plus Stripe transaction fees on actual revenue).
