# CHIRRI PRACTICAL REVIEW: Notifications & Integration Pipeline

**Version:** 1.0  
**Date:** 2026-03-24  
**Reviewer:** Skeptical Developer About to Build This  
**Scope:** Sections 7.1-7.5 (Notifications, PM Integrations, MCP Server, Twitter, Accounts) + Section 3 (Chirp System)

---

## EXECUTIVE SUMMARY

I just read the spec for Chirri's notification and integration pipeline as if I'm about to implement it tomorrow. This review asks the hard questions: **What's the actual implementation?** For every feature, I'm asking about email templates, OAuth flows, retry logic, deduplication, configuration UI, and failure modes.

**Overall Assessment:** The Bible has strong conceptual coverage but **significant implementation gaps** in the notification pipeline. Many "how does this actually work?" questions are answered with hand-waving or deferred to "see implementation."

**Critical Gaps Found:** 20+  
**Concrete Solutions Proposed:** 20+  
**Implementation-Ready After This Review:** ~75%

---

## PART 1: EMAIL NOTIFICATIONS

### 1.1 What's the Actual Email?

**Spec Says:**
- Resend API with React Email templates
- 5 onboarding emails + recurring (weekly report, dunning)
- From: `chirp@chirri.io` (automated), `support@chirri.io` (human replies)

**Questions:**

#### Q1.1.1: What does the change notification email look like?

**SPEC STATUS:** ❌ NOT SPECIFIED

The Bible mentions "React Email templates" but shows no actual template structure. What does the user see in their inbox?

**PROPOSED SOLUTION:**

```
Subject: [Chirri] High severity change detected on Stripe Prices API

From: Chirri <chirp@chirri.io>
Reply-To: support@chirri.io

---

Hi Alex,

Chirri detected a HIGH severity change on your monitored API:

**Stripe Prices API**
https://api.stripe.com/v1/prices

**What changed:**
- Removed field `amount` from /v1/charges response
- Added required parameter `payment_method` to POST /v1/payment_intents

**Source:** OpenAPI Spec
**Detected:** Mar 24, 2026 at 02:15 UTC
**Confidence:** 95%

[View Full Diff →](https://chirri.io/changes/chg_abc123)
[Mark as Reviewed →](https://chirri.io/changes/chg_abc123/track)

---

This change was detected automatically. If this looks like a false positive:
[Report Issue](https://api.chirri.io/v1/feedback/fb_token_...)

You're receiving this because you're monitoring this URL with immediate notifications.
[Manage notification preferences](https://chirri.io/settings/notifications)

— Chirri
https://chirri.io
```

**HTML version:** Same content with severity badge (colored dot), monospace font for code, buttons styled with sakura pink (#FFB7C5) accent.

**Plain text version:** Identical structure, no styling (for email clients that don't support HTML).

**Implementation:** React Email component `ChangeDetectedEmail.tsx`:

```tsx
<Email>
  <Container>
    <Heading>High severity change detected</Heading>
    <Section>
      <Text weight="bold">{url.name}</Text>
      <Link href={url.url}>{url.url}</Link>
    </Section>
    <Section>
      <Text weight="bold">What changed:</Text>
      {change.summary.split('\n').map(line => <Text>• {line}</Text>)}
    </Section>
    <Button href={dashboardUrl}>View Full Diff</Button>
    <Hr />
    <Text fontSize="12px" color="#666">
      [standard footer with unsubscribe link]
    </Text>
  </Container>
</Email>
```

---

#### Q1.1.2: How do we prevent emails from going to spam?

**SPEC STATUS:** ❌ NOT SPECIFIED

**GAPS:**
- No SPF/DKIM/DMARC setup mentioned
- No domain authentication process specified
- No email deliverability testing plan

**PROPOSED SOLUTION:**

**DNS Records Required:**
```
# SPF (Sender Policy Framework)
chirri.io TXT "v=spf1 include:_spf.resend.com ~all"

# DKIM (Domain Keys)
resend._domainkey.chirri.io CNAME resend1._domainkey.resend.com
resend2._domainkey.chirri.io CNAME resend2._domainkey.resend.com

# DMARC (Policy)
_dmarc.chirri.io TXT "v=DMARC1; p=quarantine; rua=mailto:alex@chirri.io; pct=100; adkim=s; aspf=s"
```

**Resend Domain Setup:**
1. Add chirri.io domain to Resend dashboard
2. Copy provided DNS records to Cloudflare
3. Wait for verification (Resend checks DNS every 5 minutes)
4. Test with Resend's deliverability checker
5. Send test emails to Gmail/Outlook/ProtonMail and check spam folders

**Email Best Practices (Anti-Spam):**
- ✅ From address matches SPF record (`chirp@chirri.io` via Resend)
- ✅ Consistent sender name ("Chirri")
- ✅ Clear subject lines (no "RE:" or "FWD:", no all-caps, no excessive punctuation)
- ✅ Plain text + HTML versions (multipart MIME)
- ✅ Unsubscribe link in footer (CAN-SPAM compliance)
- ✅ List-Unsubscribe header (one-click unsubscribe for Gmail/Outlook)
- ✅ No URL shorteners
- ✅ No embedded images (logo hosted on CDN: https://cdn.chirri.io/logo.png)
- ✅ Low email volume per domain (rate-limited to prevent bulk sender classification)
- ✅ Authentication headers present (DKIM signature, SPF pass)

**Monitoring:**
- Track bounce rate via Resend webhooks (email.bounced, email.complained)
- If bounce rate >5%: investigate and clean list
- If spam complaint rate >0.1%: urgent review

---

#### Q1.1.3: What ESP do we use? Is it specced?

**SPEC STATUS:** ✅ SPECIFIED (Resend)

**Details from Bible:**
- Resend API (3K emails/mo free tier)
- React Email for templates

**IMPLEMENTATION CHECKLIST:**
- [ ] Resend account created
- [ ] API key generated and stored in `RESEND_API_KEY` env var
- [ ] Domain verification (chirri.io) completed
- [ ] Email templates built with `@react-email/components`
- [ ] Template previews working (`npm run email:dev`)
- [ ] Test emails sent successfully
- [ ] Bounce/complaint webhooks configured

**Resend API Integration:**

```typescript
import { Resend } from 'resend';
import ChangeDetectedEmail from './emails/ChangeDetected';

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendChangeNotification(user, change) {
  const { data, error } = await resend.emails.send({
    from: 'Chirri <chirp@chirri.io>',
    to: user.email,
    subject: `[Chirri] ${change.severity} severity change detected on ${change.url_name}`,
    react: ChangeDetectedEmail({ user, change }),
    headers: {
      'X-Entity-Ref-ID': change.id,  // For debugging/tracking
      'List-Unsubscribe': `<https://chirri.io/unsubscribe/${user.id}/${token}>`,
    },
    tags: [
      { name: 'event_type', value: 'change.detected' },
      { name: 'severity', value: change.severity },
    ],
  });

  if (error) {
    logger.error({ error, userId: user.id, changeId: change.id }, 'email send failed');
    throw error;  // BullMQ will retry
  }

  logger.info({ emailId: data.id, userId: user.id }, 'email sent');
  return data.id;
}
```

**Rate Limits:**
- Free: 3,000 emails/mo (~100/day)
- Paid: $20/mo for 50K emails
- Monitor usage via Resend dashboard

**When to Upgrade:**
- >2,500 emails/mo (leave headroom)
- Or when weekly report user count >400 (400 users × 4 weeks = 1,600 baseline + change notifications)

---

#### Q1.1.4: What about the onboarding email sequence?

**SPEC STATUS:** ⚠️ PARTIALLY SPECIFIED

**Bible says:** 5 emails:
1. Welcome (Day 0, immediate)
2. Nudge (Day 1, if 0 URLs)
3. First check report (after first URL completes learning)
4. Inactivity (Day 7, if no dashboard visits in 5 days)
5. Weekly stability report (every Monday at 09:00 in user's timezone)

**GAPS:**
- No email copy provided
- No trigger logic specified
- No timezone handling for #5
- No opt-out mechanism beyond account-level email preferences

**PROPOSED IMPLEMENTATION:**

**Email 1: Welcome (Immediate)**
```
Subject: Welcome to Chirri -- Let's monitor your first API

Hi Alex,

Thanks for signing up for Chirri! You're now ready to monitor any API you depend on.

**Get started in 3 steps:**
1. Add your first URL (paste an API endpoint or domain)
2. Wait ~10 minutes while Chirri learns what's normal
3. Get notified whenever something changes

[Add Your First URL →](https://chirri.io/dashboard)

**What Chirri watches:**
✓ Response schema changes (fields added/removed)
✓ HTTP status codes
✓ Deprecation headers
✓ Changelog announcements
✓ Breaking changes in documentation

Need help? Reply to this email (goes to a human, not a robot).

— Chirri
```

**Trigger:** `INSERT` trigger on `users` table enqueues email job immediately.

**Email 2: Nudge (Day 1 if 0 URLs)**
```
Subject: Quick question -- what API are you monitoring?

Hi Alex,

I noticed you signed up for Chirri yesterday but haven't added any URLs yet.

Are you stuck? Here's what other users monitor:
- Stripe API (payments)
- OpenAI API (AI models)
- Twilio API (messaging)
- GitHub API (repos & actions)
- [Any HTTP endpoint]

[Add Your First URL in 30 Seconds →](https://chirri.io/dashboard)

Not interested anymore? No problem -- just ignore this email.

— Chirri
```

**Trigger:** Daily cron at 10:00 UTC checks `created_at = now() - 24h AND (SELECT COUNT(*) FROM urls WHERE user_id = users.id) = 0`.

**Email 3: First Check Complete (After Learning)**
```
Subject: Your first API is being monitored

Hi Alex,

Good news -- Chirri has established a baseline for:
**Stripe Prices API** (https://api.stripe.com/v1/prices)

Here's what we found:
✓ Response time: 180ms (p95)
✓ Schema: 23 fields detected
✓ Status: Healthy

Chirri will check this URL every hour and notify you of any changes.

[View Dashboard →](https://chirri.io/dashboard)

Tip: Add more URLs to increase coverage. Your Free plan supports up to 3 URLs.

— Chirri
```

**Trigger:** URL transitions from `calibrating` to `active` (first time only per user). Check `SELECT COUNT(*) FROM notifications WHERE user_id = ? AND event_type = 'onboarding.first_check'` to prevent duplicates.

**Email 4: Inactivity (Day 7 if no visits)**
```
Subject: Your APIs are being monitored (even if you're not watching)

Hi Alex,

You signed up for Chirri a week ago, but I noticed you haven't checked the dashboard recently.

**Current status:**
- 1 URL monitored
- 168 checks run
- 0 changes detected (your APIs are stable!)

Everything's working quietly in the background. You'll get an email if anything changes.

[Check Your Dashboard →](https://chirri.io/dashboard)

— Chirri
```

**Trigger:** Daily cron checks `created_at <= now() - 7 days AND last_dashboard_visit_at < now() - 5 days AND onboarding_step < 3`.

**Email 5: Weekly Stability Report**
See §1.1.5 below (complex enough to deserve its own section).

**Opt-Out Mechanism:**
- Per-email-type preferences in `users.email_preferences` JSONB:
  ```json
  {
    "onboarding": true,
    "weekly_report": true,
    "product_updates": true,
    "change_notifications": true
  }
  ```
- One-click unsubscribe link in footer (sets all to false except `change_notifications`)
- Account deletion stops all emails

---

#### Q1.1.5: Weekly Stability Report -- What's in it?

**SPEC STATUS:** ⚠️ PARTIALLY SPECIFIED (template in Appendix D.3)

**Bible provides rough template but missing:**
- Timezone handling implementation
- What if user has 0 URLs?
- What if 0 changes detected?
- Data aggregation queries

**PROPOSED IMPLEMENTATION:**

**Subject Line Logic:**
```typescript
function getReportSubject(stats) {
  if (stats.changes === 0) {
    return `Your API stability report -- All quiet this week`;
  }
  if (stats.changes === 1) {
    return `Your API stability report -- 1 change detected`;
  }
  return `Your API stability report -- ${stats.changes} changes detected`;
}
```

**Email Template (0 changes case):**
```
Subject: Your API stability report -- All quiet this week

Hi Alex,

Here's your weekly API monitoring summary:

**This Week:**
✓ 3 URLs monitored
✓ 504 checks run
✓ 0 changes detected
✓ 99.8% average uptime

**Response Time Trends:**
All monitored APIs are performing normally. No significant slowdowns detected.

**Keep your integrations secure:**
Your Free plan monitors 3 URLs. Upgrade to Personal ($5/mo) to monitor up to 10 URLs.

[View Dashboard →](https://chirri.io/dashboard)
[Manage Email Preferences →](https://chirri.io/settings/email)

— Chirri
```

**Email Template (with changes):**
```
Subject: Your API stability report -- 2 changes detected

Hi Alex,

Here's your weekly API monitoring summary:

**This Week:**
✓ 3 URLs monitored
✓ 504 checks run
✓ 2 changes detected
✓ 99.8% average uptime

**Changes Detected:**

🔴 **HIGH** -- Stripe Prices API
Removed field `amount` from /v1/charges response
Mar 24, 02:15 UTC  
[View Diff →](https://chirri.io/changes/chg_abc)

🟡 **MEDIUM** -- OpenAI Completions API  
Added optional parameter `temperature_2` to POST /v1/completions
Mar 26, 14:32 UTC  
[View Diff →](https://chirri.io/changes/chg_def)

**Response Time Trends:**
- Stripe Prices API: p95 went from 180ms to 220ms (+22%)
- OpenAI Completions: Stable at ~450ms

[View Full Dashboard →](https://chirri.io/dashboard)

— Chirri
```

**Timezone Handling:**

The Bible says "every Monday at 09:00 in user's timezone" but provides no implementation.

**PROPOSED SOLUTION:**

Cron runs every hour on Monday (`0 * * * 1`). For each hour (00:00-23:00 UTC):
1. Calculate which timezones are currently between 08:30-09:30 (30-minute window)
2. Query users in those timezones who haven't received this week's report yet
3. Enqueue report generation jobs

```typescript
// Monday cron (runs every hour on Monday)
const currentHourUTC = new Date().getUTCHours();

// Which timezones are currently 09:00 ± 30min?
const targetTimezones = getTimezonesForHour(currentHourUTC, 9);
// e.g., if current hour is 14:00 UTC, target = ['America/New_York'] (UTC-5 = 09:00 local)

const users = await db.select().from(users)
  .where(
    and(
      inArray(users.timezone, targetTimezones),
      eq(users.email_preferences->>'weekly_report', 'true'),
      or(
        isNull(users.last_weekly_report_sent_at),
        lt(users.last_weekly_report_sent_at, startOfWeek(new Date()))
      )
    )
  );

for (const user of users) {
  await queue.add('weekly-report', { userId: user.id });
}
```

**Data Aggregation Queries:**

```sql
-- Weekly stats for a user
WITH weekly_stats AS (
  SELECT
    COUNT(DISTINCT u.id) as urls_monitored,
    COUNT(cr.id) as checks_run,
    COUNT(DISTINCT c.id) as changes_detected,
    AVG(CASE WHEN cr.status_code BETWEEN 200 AND 299 THEN 1 ELSE 0 END) as uptime_pct
  FROM users usr
  LEFT JOIN urls u ON u.user_id = usr.id AND u.status = 'active'
  LEFT JOIN shared_urls su ON u.shared_url_id = su.id
  LEFT JOIN check_results cr ON cr.shared_url_id = su.id
    AND cr.checked_at >= NOW() - INTERVAL '7 days'
  LEFT JOIN user_changes uc ON uc.user_id = usr.id
    AND uc.created_at >= NOW() - INTERVAL '7 days'
  LEFT JOIN changes c ON uc.change_id = c.id
  WHERE usr.id = $1
)
SELECT * FROM weekly_stats;

-- Top changes this week (ordered by severity desc, detected_at desc)
SELECT c.*, uc.workflow_state, u.name as url_name
FROM user_changes uc
JOIN changes c ON uc.change_id = c.id
JOIN urls u ON uc.url_id = u.id
WHERE uc.user_id = $1
  AND uc.created_at >= NOW() - INTERVAL '7 days'
ORDER BY
  CASE c.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  c.detected_at DESC
LIMIT 5;

-- Response time trends (7-day vs 30-day avg)
SELECT
  u.id,
  u.name,
  AVG(CASE WHEN cr.checked_at >= NOW() - INTERVAL '7 days'
    THEN cr.response_time_ms END) as avg_7d,
  AVG(CASE WHEN cr.checked_at >= NOW() - INTERVAL '30 days'
    THEN cr.response_time_ms END) as avg_30d
FROM urls u
JOIN shared_urls su ON u.shared_url_id = su.id
JOIN check_results cr ON cr.shared_url_id = su.id
  AND cr.checked_at >= NOW() - INTERVAL '30 days'
WHERE u.user_id = $1 AND u.status = 'active'
GROUP BY u.id, u.name
HAVING AVG(CASE WHEN cr.checked_at >= NOW() - INTERVAL '7 days'
  THEN cr.response_time_ms END) IS NOT NULL;
```

**Deduplication:** Track `last_weekly_report_sent_at` on users table. Only send once per calendar week (Monday-Sunday).

---

### 1.2 Dunning Emails (Payment Failure)

**SPEC STATUS:** ⚠️ MENTIONED BUT NOT SPECIFIED

Bible says "Dunning: Stripe Smart Retries + 4-email sequence over 14 days + downgrade to Free after 14 days."

**GAPS:**
- No email copy
- No timeline (when does each email send?)
- No Stripe webhook event handling details

**PROPOSED IMPLEMENTATION:**

**Email Sequence:**

| Day | Trigger | Email |
|---|---|---|
| 0 | `invoice.payment_failed` | "Payment failed -- please update your payment method" |
| 3 | Still unpaid | "Reminder: Payment failed 3 days ago" |
| 7 | Still unpaid | "Final reminder: Update payment method within 7 days" |
| 14 | Still unpaid | "Account downgraded to Free plan" + downgrade action |

**Email 1 (Day 0):**
```
Subject: Payment failed for your Chirri subscription

Hi Alex,

We tried to charge your payment method for your Chirri Personal plan ($5/month) but the payment failed.

**Next steps:**
1. Update your payment method in the next 14 days
2. Your service will continue during this grace period
3. If not resolved, your account will be downgraded to the Free plan

[Update Payment Method →](https://billing.stripe.com/p/session/...)

**Payment failure reason:** Card declined

Need help? Reply to this email.

— Chirri
support@chirri.io
```

**Email 4 (Day 14 -- Downgrade Notice):**
```
Subject: Your Chirri account has been downgraded to Free

Hi Alex,

Your payment method could not be charged after multiple attempts. Your account has been automatically downgraded to the Free plan.

**What changed:**
- Monitoring interval: Every hour → Every 24 hours
- URLs paused: 7 URLs (exceeds Free plan limit of 3)

**To restore your Personal plan:**
1. Update your payment method
2. Your paused URLs will resume automatically

[Update Payment Method →](https://billing.stripe.com/p/session/...)

— Chirri
```

**Stripe Webhook Implementation:**

```typescript
// Stripe webhook handler
app.post('/webhooks/stripe', async (c) => {
  const sig = c.req.header('stripe-signature');
  const body = await c.req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  switch (event.type) {
    case 'invoice.payment_failed':
      const invoice = event.data.object;
      const customer = await stripe.customers.retrieve(invoice.customer);
      const user = await db.select().from(users)
        .where(eq(users.stripe_customer_id, customer.id)).get();

      // Send dunning email #1 immediately
      await queue.add('send-email', {
        template: 'payment-failed',
        userId: user.id,
        invoiceId: invoice.id,
        reason: invoice.last_payment_error?.message,
      });

      // Schedule reminder emails (BullMQ delayed jobs)
      await queue.add('send-email', {
        template: 'payment-failed-reminder-1',
        userId: user.id,
      }, { delay: 3 * 24 * 60 * 60 * 1000 });  // 3 days

      await queue.add('send-email', {
        template: 'payment-failed-reminder-2',
        userId: user.id,
      }, { delay: 7 * 24 * 60 * 60 * 1000 });  // 7 days

      await queue.add('downgrade-account', {
        userId: user.id,
      }, { delay: 14 * 24 * 60 * 60 * 1000 });  // 14 days

      break;

    case 'invoice.paid':
      // Cancel pending downgrade jobs
      // Reset dunning state
      break;

    case 'customer.subscription.deleted':
      // User manually cancelled
      // Downgrade immediately (no grace period)
      break;
  }

  return c.json({ received: true });
});
```

**Stripe Smart Retries:** Enabled by default (Stripe automatically retries failed payments on Days 3, 5, 7).

---

## PART 2: SLACK INTEGRATION

### 2.1 How Does the User Connect Slack?

**SPEC STATUS:** ⚠️ PARTIALLY SPECIFIED

Bible says:
- MVP: Incoming webhooks (user provides URL)
- V1.1: Full OAuth integration

**For MVP (Incoming Webhooks):**

**GAPS:**
- No UI mockup for webhook URL input
- No validation logic specified
- No test message implementation

**PROPOSED SOLUTION:**

**Settings Page UI:**

```
Notifications → Slack

┌─────────────────────────────────────────────────┐
│ Connect Slack via Incoming Webhook              │
│                                                  │
│ 1. Create webhook in Slack:                     │
│    [Slack Incoming Webhooks Guide →]            │
│                                                  │
│ 2. Paste your webhook URL:                      │
│    ┌──────────────────────────────────────┐    │
│    │ https://hooks.slack.com/services/... │    │
│    └──────────────────────────────────────┘    │
│                                                  │
│    [Send Test Message] [Save]                   │
│                                                  │
│ ✓ Connected to #api-alerts                      │
└─────────────────────────────────────────────────┘
```

**API Implementation:**

```typescript
PATCH /v1/notifications/preferences
{
  "slack_webhook_url": "https://hooks.slack.com/services/T00/B00/XXX",
  "slack_enabled": true
}
```

**Validation:**
```typescript
function validateSlackWebhook(url: string): void {
  // Must be HTTPS
  if (!url.startsWith('https://')) {
    throw new Error('Slack webhook URL must use HTTPS');
  }

  // Must match Slack's hostname
  const parsed = new URL(url);
  if (parsed.hostname !== 'hooks.slack.com') {
    throw new Error('Invalid Slack webhook URL (must be hooks.slack.com)');
  }

  // Must match expected path pattern
  if (!parsed.pathname.startsWith('/services/')) {
    throw new Error('Invalid Slack webhook path');
  }

  // SSRF check (even though it's hooks.slack.com, defense in depth)
  await safeFetch(url, { method: 'HEAD' });
}
```

**Test Message:**

```typescript
async function sendSlackTestMessage(webhookUrl: string) {
  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '✓ Chirri is connected!' }
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'This is a test message from Chirri. You\'ll receive notifications here when API changes are detected.'
        }
      },
      {
        type: 'context',
        elements: [{
          type: 'mrkdwn',
          text: 'Sent at ' + new Date().toISOString()
        }]
      }
    ]
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook test failed: ${response.statusText}`);
  }
}
```

**Storage:**
- Webhook URL stored in `users.notification_defaults` JSONB field
- Encrypted? **No** (Slack webhook URLs are designed to be shareable within workspace)
- Per-URL override supported via `urls.notification_config`

---

### 2.2 What Does the Slack Message Look Like?

**SPEC STATUS:** ✅ SPECIFIED (Appendix D.10)

Bible provides Block Kit structure. Looks good.

**IMPLEMENTATION CHECKLIST:**
- [ ] Block Kit message builder function
- [ ] Severity color mapping (not in blocks, but webhook supports `attachments` with colors)
- [ ] Link unfurling settings (disabled by default for Chirri dashboard links)
- [ ] Message truncation (Slack has 3,000 char limit for blocks)

**Refinement:**

The Bible's Block Kit structure is clean but missing color indicators. Slack doesn't support colored dots in Block Kit, but we can use **attachment color bars**:

```typescript
{
  "blocks": [ /* ... from Appendix D.10 ... */ ],
  "attachments": [{
    "color": getSeverityColor(change.severity),  // Red/yellow/green bar on left
    "fallback": `${change.severity} severity change on ${change.url_name}`
  }]
}

function getSeverityColor(severity: string): string {
  return {
    critical: '#DC2626',  // Red
    high: '#DC2626',      // Red
    medium: '#F59E0B',    // Yellow/orange
    low: '#10B981',       // Green
  }[severity];
}
```

**Message Truncation:**

If `change.summary` is >1,000 chars, truncate with "... [View full diff on Chirri]" link.

---

### 2.3 What Permissions Are Needed?

**SPEC STATUS:** ⚠️ NOT SPECIFIED (for OAuth v1.1)

For MVP (incoming webhooks): **No permissions needed.** User creates webhook in Slack, we just POST to it.

For V1.1 (full OAuth integration):

**REQUIRED SCOPES:**
- `incoming-webhook` -- Post messages to a channel
- `chat:write` -- Send messages as Chirri app

**OPTIONAL SCOPES (future):**
- `channels:read` -- List channels (for channel picker in UI)
- `users:read` -- Get user info (for @mentions)

**OAuth Flow (V1.1):**
1. User clicks "Connect Slack" in Chirri dashboard
2. Redirect to `https://slack.com/oauth/v2/authorize?client_id=...&scope=incoming-webhook,chat:write&redirect_uri=https://chirri.io/integrations/slack/callback`
3. User approves in Slack
4. Slack redirects back with `code`
5. Exchange code for access token + webhook URL
6. Store in `oauth_tokens` table (encrypted)

**Implementation deferred to V1.1.**

---

## PART 3: DISCORD INTEGRATION

### 3.1 Bot or Webhook?

**SPEC STATUS:** ✅ SPECIFIED (Incoming webhooks for MVP)

Same approach as Slack: user provides Discord webhook URL, Chirri posts to it.

**GAPS:**
- No UI mockup
- No validation logic
- No test message implementation

**PROPOSED SOLUTION:**

**Settings Page UI:**

```
Notifications → Discord

┌─────────────────────────────────────────────────┐
│ Connect Discord via Webhook                     │
│                                                  │
│ 1. Create webhook in your Discord server:       │
│    Server Settings → Integrations → Webhooks    │
│    [Discord Webhook Guide →]                    │
│                                                  │
│ 2. Copy webhook URL and paste here:             │
│    ┌──────────────────────────────────────┐    │
│    │ https://discord.com/api/webhooks/... │    │
│    └──────────────────────────────────────┘    │
│                                                  │
│    [Send Test Message] [Save]                   │
│                                                  │
│ ✓ Connected to #api-changes                     │
└─────────────────────────────────────────────────┘
```

**Validation:**

```typescript
function validateDiscordWebhook(url: string): void {
  if (!url.startsWith('https://')) {
    throw new Error('Discord webhook URL must use HTTPS');
  }

  const parsed = new URL(url);
  if (parsed.hostname !== 'discord.com' && parsed.hostname !== 'discordapp.com') {
    throw new Error('Invalid Discord webhook URL');
  }

  if (!parsed.pathname.startsWith('/api/webhooks/')) {
    throw new Error('Invalid Discord webhook path');
  }

  // SSRF check
  await safeFetch(url, { method: 'HEAD' });
}
```

**Test Message:**

```typescript
async function sendDiscordTestMessage(webhookUrl: string) {
  const payload = {
    username: 'Chirri',
    embeds: [{
      title: '✓ Chirri is connected!',
      description: 'This is a test message. You\'ll receive notifications here when API changes are detected.',
      color: 16761035,  // Sakura pink (#FFB7C5 as decimal)
      footer: { text: 'Chirri -- chirri.io' },
      timestamp: new Date().toISOString(),
    }]
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord webhook test failed: ${error}`);
  }
}
```

---

### 3.2 What Does the Discord Embed Look Like?

**SPEC STATUS:** ✅ SPECIFIED (Appendix D.11)

Bible provides embed structure. Looks clean.

**REFINEMENTS:**

The Bible's structure is good but missing:
- Thumbnail (Chirri logo)
- Author field (for branding consistency)

```typescript
{
  "username": "Chirri",
  "avatar_url": "https://cdn.chirri.io/logo-512.png",
  "embeds": [{
    "author": {
      "name": "Chirri API Monitor",
      "url": "https://chirri.io",
      "icon_url": "https://cdn.chirri.io/logo-64.png"
    },
    "title": "API Change Detected -- Stripe Prices API",
    "url": "https://chirri.io/changes/chg_abc",
    "color": 15548997,  // Red for critical/high
    "description": "**High severity changes in OpenAPI spec**\n\n- Removed field `amount` from /v1/charges\n- Added required param `payment_method`",
    "fields": [
      { "name": "Severity", "value": "High", "inline": true },
      { "name": "Source", "value": "OpenAPI Spec", "inline": true },
      { "name": "Confidence", "value": "95%", "inline": true }
    ],
    "footer": { "text": "Chirri -- chirri.io" },
    "timestamp": "2026-03-24T02:15:00.000Z"
  }]
}
```

**Severity Color Mapping:**
```typescript
function getDiscordColor(severity: string): number {
  // Colors as decimal (Discord doesn't use hex)
  return {
    critical: 15548997,  // Red (#ED4245)
    high: 15548997,      // Red
    medium: 16776960,    // Yellow (#FFFF00)
    low: 5763719,        // Green (#57F287)
  }[severity];
}
```

---

## PART 4: WEBHOOKS

### 4.1 What's the Retry Logic?

**SPEC STATUS:** ✅ SPECIFIED

Bible says: "1m, 5m, 30m, 2h, 12h (5 attempts). Auto-disable after 3 consecutive days of failures."

**IMPLEMENTATION:**

```typescript
// BullMQ retry configuration
const webhookQueue = new Queue('notifications', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 60_000,  // Start at 1 minute
    },
    removeOnComplete: 1000,  // Keep last 1K successful
    removeOnFail: 5000,      // Keep last 5K failed (for debugging)
  },
});

// Custom backoff calculation
function getWebhookRetryDelay(attemptsMade: number): number {
  const delays = [
    60_000,        // 1 minute
    5 * 60_000,    // 5 minutes
    30 * 60_000,   // 30 minutes
    2 * 60 * 60_000,   // 2 hours
    12 * 60 * 60_000,  // 12 hours
  ];
  return delays[attemptsMade - 1] || delays[delays.length - 1];
}
```

**Retry Decision Tree:**

```typescript
async function processWebhookDelivery(job) {
  const { webhookId, payload } = job.data;
  const webhook = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).get();

  if (!webhook.is_active) {
    logger.info({ webhookId }, 'webhook disabled, skipping delivery');
    return;  // Don't retry
  }

  try {
    const response = await deliverWebhook(webhook.url, payload, webhook.signing_secret);

    // Record success
    await db.insert(webhook_deliveries).values({
      webhook_id: webhookId,
      event_type: payload.type,
      status_code: response.status,
      response_body: await response.text(),
      attempt_number: job.attemptsMade,
    });

    // Reset consecutive failures
    await db.update(webhooks)
      .set({ consecutive_failures: 0 })
      .where(eq(webhooks.id, webhookId));

  } catch (error) {
    const statusCode = error.response?.status;

    // Don't retry 4xx errors (except 429 Too Many Requests)
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
      logger.warn({ webhookId, statusCode }, 'webhook delivery failed permanently (4xx)');
      await recordFailure(webhookId, error, job.attemptsMade, false);
      return;  // Fail without retry
    }

    // Retry 5xx, network errors, and 429
    logger.error({ webhookId, statusCode, attempt: job.attemptsMade }, 'webhook delivery failed, will retry');
    await recordFailure(webhookId, error, job.attemptsMade, true);

    // Increment consecutive failures
    const failures = await db.update(webhooks)
      .set({ consecutive_failures: sql`consecutive_failures + 1` })
      .where(eq(webhooks.id, webhookId))
      .returning({ count: webhooks.consecutive_failures });

    // Auto-disable after 3 days of consecutive failures
    // Assuming 1 attempt per event, ~10 events/day = ~30 failures over 3 days
    if (failures[0].count >= 30) {
      await db.update(webhooks)
        .set({ is_active: false, status_reason: 'Auto-disabled due to consecutive failures' })
        .where(eq(webhooks.id, webhookId));

      // Notify user
      await queue.add('send-email', {
        template: 'webhook-disabled',
        userId: webhook.user_id,
        webhookId: webhook.id,
      });
    }

    throw error;  // Let BullMQ retry
  }
}
```

---

### 4.2 How Does the User Know Their Webhook Failed?

**SPEC STATUS:** ❌ NOT SPECIFIED

**GAPS:**
- No failure notification mechanism
- No delivery log UI
- No webhook health dashboard

**PROPOSED SOLUTION:**

**1. Email Notification on Auto-Disable:**

```
Subject: Webhook disabled due to failures

Hi Alex,

Your webhook endpoint has been automatically disabled after 3 consecutive days of delivery failures:

**Webhook:** Production API Monitor
**URL:** https://api.yourcompany.com/chirri/webhook
**Last error:** Connection timeout (504 Gateway Timeout)

**What happened:**
We attempted to deliver 30+ notifications over the past 3 days, but your endpoint consistently returned errors or timed out.

**Next steps:**
1. Fix the endpoint and verify it's accepting requests
2. Re-enable the webhook in your [Chirri settings](https://chirri.io/settings/webhooks)
3. Test with a sample event before re-enabling

[View Delivery Log →](https://chirri.io/webhooks/wh_abc/deliveries)

— Chirri
```

**2. Delivery Log UI (Dashboard):**

```
Settings → Webhooks → [Webhook Name] → Delivery History

┌────────────────────────────────────────────────────────────┐
│ Last 100 Deliveries                                        │
│                                                             │
│ Mar 24, 14:32  change.confirmed  ✓ 200 OK       View       │
│ Mar 24, 13:15  forecast.new      ✗ 504 Timeout  View       │
│ Mar 24, 12:05  change.confirmed  ✗ 503 Unavail  Retry      │
│ Mar 23, 22:18  url.active        ✓ 200 OK       View       │
│                                                             │
│ [Load More]                                                 │
└────────────────────────────────────────────────────────────┘

Success Rate (Last 7 Days): 87% (26/30)
Average Response Time: 320ms
```

**3. Webhook Health Badge (Dashboard):**

On the main webhooks list, show health status:

```
My Webhooks

┌─────────────────────────────────────────────────┐
│ Production API Monitor          🟢 Healthy      │
│ https://api.yourcompany.com/... 98% success     │
│                                                  │
│ Staging Alerts                  🔴 Failing      │
│ https://staging.company.com/... 12% success     │
│ ⚠ Auto-disabled after 30 consecutive failures   │
│ [Re-enable] [View Log]                          │
└─────────────────────────────────────────────────┘
```

**4. Retry Button:**

Users can manually retry failed deliveries from the delivery log.

```typescript
POST /v1/webhooks/:id/deliveries/:delivery_id/retry

// Re-enqueue the same payload with same signing
await queue.add('webhook-delivery', {
  webhookId: webhook.id,
  payload: delivery.payload,
  isRetry: true,
  originalDeliveryId: delivery.id,
});
```

---

### 4.3 Dead Letter Queue for Failed Webhooks?

**SPEC STATUS:** ✅ IMPLIED (Bible mentions "failed-jobs (DLQ)")

**IMPLEMENTATION:**

BullMQ sends jobs to a `failed-jobs` queue after max retries exceeded. Retention: 7 days.

**Failed webhook handling:**

1. After 5 attempts over 12 hours, job moves to DLQ
2. Delivery marked `status: 'failed'` in `webhook_deliveries` table
3. User sees "Failed permanently" in delivery log
4. No automatic retry from DLQ
5. User can manually retry via UI

**Monitoring:**

```typescript
// Daily cron checks DLQ depth
const failedCount = await failedJobsQueue.count();
if (failedCount > 100) {
  logger.warn({ count: failedCount }, 'high failed job count in DLQ');
  // Alert via Telegram or PagerDuty
}
```

---

## PART 5: THE MCP SERVER

### 5.1 How Does a User Actually USE This?

**SPEC STATUS:** ⚠️ PARTIALLY SPECIFIED

Bible says:
- 8 tools (chirri_list_monitors, chirri_add_monitor, etc.)
- Authenticates via API key
- "MCP server is an npm package that users run locally"

**GAPS:**
- No installation instructions
- No configuration file format
- No example usage with Claude Desktop
- No testing instructions

**PROPOSED SOLUTION:**

**Installation:**

```bash
npm install -g @chirri/mcp-server
# or
npx @chirri/mcp-server
```

**Configuration (Claude Desktop):**

Users add this to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "chirri": {
      "command": "npx",
      "args": ["-y", "@chirri/mcp-server"],
      "env": {
        "CHIRRI_API_KEY": "ck_live_abc123..."
      }
    }
  }
}
```

**Or using a config file:**

```bash
# ~/.chirri/config.json
{
  "apiKey": "ck_live_abc123...",
  "apiUrl": "https://api.chirri.io"
}
```

Then in Claude config:
```json
{
  "mcpServers": {
    "chirri": {
      "command": "chirri-mcp",
      "args": []
    }
  }
}
```

**Usage Example (in Claude):**

```
User: "What APIs am I currently monitoring?"

Claude: [calls chirri_list_monitors]
You're monitoring 3 APIs:
- Stripe Prices API (active, checked 5 minutes ago)
- OpenAI Completions API (active, checked 1 hour ago)
- GitHub REST API (learning, 7/30 samples collected)

User: "Any recent changes?"

Claude: [calls chirri_get_changes with limit=5]
Yes, one change detected:
- Stripe Prices API: Field `amount` removed from /v1/charges response
  Severity: High, detected 2 hours ago
  [View diff: https://chirri.io/changes/chg_abc]

User: "Add monitoring for api.twilio.com/v1/messages"

Claude: [calls chirri_add_monitor with url="https://api.twilio.com/v1/messages"]
Added! Chirri is now learning the baseline for Twilio Messages API.
This will take about 10 minutes. I'll let you know when it's active.
```

---

### 5.2 What Tools Does It Expose? (Detailed Specs)

**SPEC STATUS:** ✅ SPECIFIED (Appendix D.7)

Bible provides tool names and schemas. Good.

**REFINEMENT NEEDED:**

Let's add **TypeScript type definitions** for each tool (for NPM package):

```typescript
// @chirri/mcp-server/src/types.ts

export interface ListMonitorsInput {
  status?: 'active' | 'paused' | 'learning' | 'all';
}

export interface ListMonitorsOutput {
  monitors: Array<{
    id: string;
    url: string;
    name: string | null;
    status: string;
    last_check_at: string | null;
    changes_count: number;
  }>;
}

export interface AddMonitorInput {
  url: string;
  name?: string;
  interval?: '1m' | '5m' | '15m' | '1h' | '6h' | '24h';
}

export interface AddMonitorOutput {
  id: string;
  url: string;
  name: string | null;
  status: 'learning';
  message: string;
}

export interface GetChangesInput {
  monitor_id?: string;
  since?: string;  // ISO 8601 date
  severity?: 'critical' | 'high' | 'medium' | 'low';
  limit?: number;
}

export interface GetChangesOutput {
  changes: Array<{
    id: string;
    url: string;
    url_name: string | null;
    change_type: string;
    severity: string;
    summary: string;
    detected_at: string;
    dashboard_url: string;
  }>;
}

// ... (continue for all 8 tools)
```

**MCP Tool Manifest (for registration):**

```json
{
  "name": "chirri",
  "version": "1.0.0",
  "description": "Monitor third-party APIs for breaking changes",
  "tools": [
    {
      "name": "chirri_list_monitors",
      "description": "List all monitored API endpoints",
      "inputSchema": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": ["active", "paused", "learning", "all"],
            "description": "Filter by status"
          }
        }
      }
    },
    {
      "name": "chirri_add_monitor",
      "description": "Add a new URL to monitor for changes",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": { "type": "string", "description": "Full URL to monitor" },
          "name": { "type": "string", "description": "Optional friendly name" },
          "interval": {
            "type": "string",
            "enum": ["1m", "5m", "15m", "1h", "6h", "24h"],
            "description": "Check interval (default: based on plan)"
          }
        },
        "required": ["url"]
      }
    }
    // ... (continue for all 8 tools)
  ]
}
```

---

### 5.3 Has Anyone Tested This with a Real MCP Client?

**SPEC STATUS:** ❌ NOT TESTED

**PROPOSED TESTING PLAN:**

**Phase 1: Local Testing**
1. Build MCP server package
2. Install in Claude Desktop (local npm link)
3. Test each tool manually in Claude chat
4. Document quirks and errors

**Phase 2: Error Handling**
- Test with invalid API key
- Test with rate-limited account
- Test with empty monitor list
- Test with malformed URLs
- Verify error messages are human-readable

**Phase 3: Integration Testing**
- Test with Cursor IDE
- Test with other MCP clients (if any emerge)
- Verify stdio transport reliability

**Pre-Launch Checklist:**
- [ ] Tested all 8 tools in Claude Desktop
- [ ] Error messages are clear and actionable
- [ ] Response times are acceptable (<2s per tool call)
- [ ] Rate limiting doesn't break chat flow
- [ ] Documentation includes troubleshooting section

---

## PART 6: NOTIFICATION DEDUPLICATION

### 6.1 How Does Deduplication Work?

**SPEC STATUS:** ⚠️ PARTIALLY SPECIFIED

Bible mentions:
- User gets one notification per change (not multiple for same change from different sources)
- Forecast dedup via `dedup_key` (Section 3.9)

**GAPS:**
- No specification for **change** deduplication across sources
- What if changelog AND OpenAPI spec AND header all detect the same deprecation?

**PROPOSED SOLUTION:**

**Change Deduplication:**

Currently, the Bible creates ONE `changes` row per `shared_url_id` (shared across all users). This handles basic dedup.

**Cross-Source Dedup (for bonus sources):**

When a bonus source (e.g., Stripe changelog) detects a deprecation, and later the OpenAPI spec also shows the same deprecation, we should:

1. **Link to existing change** (don't create a new one)
2. **Add corroborating evidence** (increase confidence)
3. **Don't re-notify** (user already knows)

**Implementation:**

```typescript
// When processing a signal from a bonus source
async function processSignalDetection(signal, sharedSourceId) {
  // Check if a related change already exists
  const existingChange = await db.select()
    .from(changes)
    .where(
      and(
        eq(changes.shared_url_id, signal.shared_url_id),
        sql`changes.diff->>'affected_field' = ${signal.affected_field}`,
        eq(changes.change_type, 'deprecation'),
        gte(changes.detected_at, sql`NOW() - INTERVAL '7 days'`)
      )
    )
    .get();

  if (existingChange) {
    // Corroborate existing change
    logger.info({ changeId: existingChange.id, sourceId: sharedSourceId },
      'corroborating existing change with new source');

    // Increase confidence
    const newConfidence = Math.min(existingChange.confidence + 10, 100);

    await db.update(changes)
      .set({
        confidence: newConfidence,
        summary: sql`summary || '\n\nAdditional evidence: ' || ${signal.source}`,
      })
      .where(eq(changes.id, existingChange.id));

    // Don't create user_changes or send notifications (already done)
    return { deduplicated: true, changeId: existingChange.id };
  }

  // New change, proceed normally
  return processNewChange(signal);
}
```

**Forecast Deduplication:**

Already specified via `dedup_key` (Section 3.9). Looks good.

---

### 6.2 Notification Rate Limiting

**SPEC STATUS:** ✅ SPECIFIED (Section 7.1)

Bible specifies per-plan rate limits:

| Plan | Critical/provider/hr | Other/provider/hr | Total/hr |
|---|---|---|---|
| Free | 3 | 2 | 10 |

**IMPLEMENTATION:**

```typescript
// Redis key: notif_rate:{user_id}:{domain}:{severity}:{hour}
async function checkNotificationRateLimit(userId, domain, severity) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = `notif_rate:${userId}:${domain}:${severity}:${hour}`;

  const count = await redis.incr(key);
  await redis.expire(key, 7200);  // 2 hours TTL

  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  const limits = PLAN_LIMITS[user.plan];

  const isCritical = ['critical', 'high'].includes(severity);
  const limit = isCritical ? limits.criticalAlertsPerProviderPerHour : limits.otherAlertsPerProviderPerHour;

  if (count > limit) {
    logger.warn({ userId, domain, severity, count }, 'notification rate limit exceeded');
    return { allowed: false, resetAt: (hour + 1) * 3_600_000 };
  }

  return { allowed: true, remaining: limit - count };
}
```

**User Experience When Rate-Limited:**

Notification is queued for next hour with a note:

```
⚠ This alert was delayed by 45 minutes due to rate limiting.
You've reached your hourly notification limit for Stripe (3 critical alerts/hour on Free plan).

[Upgrade to Personal for higher limits →]
```

---

## PART 7: QUIET HOURS

### 7.1 How Does the User Set Quiet Hours?

**SPEC STATUS:** ⚠️ IMPLIED BUT NOT SPECIFIED

Bible mentions "quiet hours" in notification config but provides no UI or API details.

**PROPOSED SOLUTION:**

**API:**

```typescript
PATCH /v1/notifications/preferences
{
  "quiet_hours": {
    "enabled": true,
    "start": "22:00",      // Local time in user's timezone
    "end": "08:00",
    "timezone": "America/New_York"
  }
}
```

**Stored in `users.notification_defaults` JSONB:**

```json
{
  "email": true,
  "min_severity": "medium",
  "quiet_hours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00",
    "timezone": "America/New_York"
  }
}
```

**UI (Settings Page):**

```
Notifications → Quiet Hours

┌─────────────────────────────────────────────────┐
│ ☑ Enable quiet hours                            │
│                                                  │
│ Don't send notifications between:               │
│   ┌──────┐      and      ┌──────┐              │
│   │ 22:00│              │ 08:00│              │
│   └──────┘              └──────┘              │
│                                                  │
│ Timezone: ┌─────────────────┐                   │
│           │ America/New_York│                   │
│           └─────────────────┘                   │
│                                                  │
│ ⚠ Critical alerts will still be sent            │
│   immediately (override quiet hours)             │
│                                                  │
│ [Save Changes]                                   │
└─────────────────────────────────────────────────┘
```

---

### 7.2 What Happens to Queued Notifications?

**SPEC STATUS:** ❌ NOT SPECIFIED

**PROPOSED SOLUTION:**

When a notification is generated during quiet hours:

1. **Critical severity:** Send immediately (override quiet hours)
2. **High/Medium/Low severity:** Delay until quiet hours end

**Implementation:**

```typescript
async function scheduleNotification(userId, change) {
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  const quietHours = user.notification_defaults?.quiet_hours;

  if (!quietHours?.enabled) {
    // No quiet hours, send immediately
    return await sendNotification(userId, change);
  }

  // Critical alerts override quiet hours
  if (change.severity === 'critical') {
    logger.info({ userId, changeId: change.id }, 'critical alert overrides quiet hours');
    return await sendNotification(userId, change);
  }

  // Check if we're currently in quiet hours
  const now = new Date();
  const userTime = zonedTimeToUtc(now, quietHours.timezone);
  const currentHour = format(userTime, 'HH:mm');

  const inQuietHours = isTimeInRange(currentHour, quietHours.start, quietHours.end);

  if (inQuietHours) {
    // Calculate when quiet hours end
    const endTime = parse(quietHours.end, 'HH:mm', new Date());
    const delayMs = differenceInMilliseconds(endTime, now);

    logger.info({ userId, changeId: change.id, delayMs }, 'delaying notification until quiet hours end');

    // Enqueue with delay
    await queue.add('send-notification', { userId, changeId: change.id }, {
      delay: delayMs,
      jobId: `notification:${userId}:${change.id}`,  // Prevent duplicates
    });

    return { delayed: true, sendAt: endTime.toISOString() };
  }

  // Not in quiet hours, send immediately
  return await sendNotification(userId, change);
}

function isTimeInRange(current, start, end) {
  // Handle overnight ranges (e.g., 22:00 to 08:00)
  if (start > end) {
    return current >= start || current < end;
  }
  return current >= start && current < end;
}
```

**Batching Delayed Notifications:**

If multiple notifications queue up during quiet hours, they're sent as individual notifications (NOT batched into a digest). The user wakes up to N notifications, not one combined email.

**Alternative (Better UX):** Morning digest option:

```json
{
  "quiet_hours": {
    "enabled": true,
    "start": "22:00",
    "end": "08:00",
    "batch_delayed": true  // Send one digest email at 08:00 instead of N individual emails
  }
}
```

Implementation: when `batch_delayed: true`, delayed notifications are collected and sent as a single "Morning Summary" email.

---

## PART 8: THE CHIRP SYSTEM

### 8.1 What Triggers a Chirp?

**SPEC STATUS:** ⚠️ AMBIGUOUS

Bible uses "chirp" throughout but doesn't clearly define when a chirp is sent vs. when a change is just logged.

**CLARIFICATION NEEDED:**

Does a "chirp" mean:
- Any notification to the user?
- Only notifications from the early warning system (forecasts)?
- Only high-severity alerts?

**PROPOSED DEFINITION:**

A **"chirp"** is any notification sent to the user (email, Slack, Discord, webhook, etc.).

**Triggers:**
1. Change confirmed (after Stage 2 recheck)
2. Forecast created or escalated
3. URL status change (error, degraded, recovered)
4. Weekly stability report
5. Dunning emails

**Not a chirp:**
- Change detected but not confirmed (internal only)
- Learning progress updates (dashboard-only)
- Calibration state (hidden from user)

---

### 8.2 Is Severity Configurable?

**SPEC STATUS:** ✅ YES

Bible specifies `min_severity` in notification config (account-level and per-source).

**Implementation:**

```typescript
// Check if change meets user's severity threshold
function shouldNotify(change, user, source) {
  const minSeverity = source?.alert_preferences?.min_severity
    || user.notification_defaults?.min_severity
    || 'medium';

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };

  return severityRank[change.severity] >= severityRank[minSeverity];
}
```

**UI (Per-Source Settings):**

```
Sources → Stripe Changelog → Alert Preferences

Minimum severity: ┌─────────┐
                  │ Notable │  ← "Notable" = High or Critical
                  └─────────┘
                  Options: All / Notable / Critical Only

[Save]
```

---

### 8.3 Chirp vs. Change Detection

**KEY DISTINCTION:**

- **Change Detection:** Always runs. Every check. Stores results in `check_results` and `changes` tables.
- **Chirp (Notification):** Conditional. Depends on user preferences, severity, quiet hours, rate limits, etc.

**Flow:**

```
Check detects change
  --> Create `changes` row (shared)
  --> Fan out to `user_changes` rows (per-user)
  --> For each user:
        Check alert preferences
        Check min_severity
        Check quiet hours
        Check rate limits
        Check digest mode
        --> If all pass: CHIRP (send notification)
        --> Else: Log (alerted=false, reason=...)
```

**This means:**
- A change can exist in the dashboard without ever triggering a notification
- Users can mark "new" changes they never got alerted about (because they were below threshold or in quiet hours)

---

## PART 9: PM INTEGRATIONS (JIRA, LINEAR, GITHUB)

### 9.1 How Does OAuth Work?

**SPEC STATUS:** ⚠️ CONCEPT MENTIONED, IMPLEMENTATION MISSING

Bible says:
- OAuth 2.0 for Jira, Linear, GitHub
- Arctic library for OAuth client
- Tokens stored encrypted in `oauth_tokens` table

**GAPS:**
- No OAuth flow UI mockups
- No redirect URI handling
- No error states (user denies access, expired token, etc.)

**PROPOSED IMPLEMENTATION:**

**OAuth Flow (Generic):**

1. User clicks "Connect Jira" in Chirri dashboard
2. Redirect to `https://auth.atlassian.com/authorize?...`
3. User approves in Jira
4. Jira redirects to `https://chirri.io/integrations/jira/callback?code=...`
5. Chirri exchanges code for access token
6. Store encrypted token in `oauth_tokens`
7. Redirect back to dashboard with success message

**Implementation (Jira Example):**

```typescript
// Step 1: Initiate OAuth
app.get('/integrations/jira/connect', auth, async (c) => {
  const state = nanoid();  // CSRF token
  await redis.setex(`oauth_state:${state}`, 600, c.get('user').id);  // 10 min expiry

  const authUrl = new URL('https://auth.atlassian.com/authorize');
  authUrl.searchParams.set('audience', 'api.atlassian.com');
  authUrl.searchParams.set('client_id', JIRA_CLIENT_ID);
  authUrl.searchParams.set('scope', 'read:jira-work write:jira-work');
  authUrl.searchParams.set('redirect_uri', 'https://chirri.io/integrations/jira/callback');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('prompt', 'consent');

  return c.redirect(authUrl.toString());
});

// Step 2: Handle callback
app.get('/integrations/jira/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  // Verify CSRF token
  const userId = await redis.get(`oauth_state:${state}`);
  if (!userId) {
    return c.json({ error: 'Invalid or expired state token' }, 400);
  }
  await redis.del(`oauth_state:${state}`);

  // Exchange code for tokens
  const tokenResponse = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: JIRA_CLIENT_ID,
      client_secret: JIRA_CLIENT_SECRET,
      code: code,
      redirect_uri: 'https://chirri.io/integrations/jira/callback',
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.json();
    logger.error({ error }, 'jira oauth token exchange failed');
    return c.redirect('/settings/integrations?error=oauth_failed');
  }

  const tokens = await tokenResponse.json();

  // Encrypt and store tokens
  const encryptedAccess = await encrypt(tokens.access_token, ENCRYPTION_MASTER_KEY);
  const encryptedRefresh = await encrypt(tokens.refresh_token, ENCRYPTION_MASTER_KEY);

  await db.insert(oauth_tokens).values({
    id: `oat_${nanoid(21)}`,
    user_id: userId,
    provider: 'jira',
    access_token_encrypted: encryptedAccess,
    refresh_token_encrypted: encryptedRefresh,
    token_type: 'Bearer',
    expires_at: new Date(Date.now() + tokens.expires_in * 1000),
    scopes: tokens.scope.split(' '),
    encryption_key_id: 'v1',  // For future key rotation
  }).onConflictDoUpdate({
    target: [oauth_tokens.user_id, oauth_tokens.provider],
    set: {
      access_token_encrypted: encryptedAccess,
      refresh_token_encrypted: encryptedRefresh,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000),
      updated_at: new Date(),
    },
  });

  // Fetch accessible Jira sites (for project picker)
  const sitesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` },
  });
  const sites = await sitesResponse.json();

  // Store site info in integrations table
  await db.insert(integrations).values({
    id: `int_${nanoid(21)}`,
    user_id: userId,
    provider: 'jira',
    oauth_token_id: `oat_...`,  // FK to oauth_tokens
    config: {
      site_url: sites[0].url,  // Default to first accessible site
      site_id: sites[0].id,
      available_sites: sites,  // For site picker in UI
    },
    is_active: true,
  });

  return c.redirect('/settings/integrations?success=jira_connected');
});
```

**Token Refresh (Automatic):**

```typescript
async function getValidJiraToken(userId) {
  const token = await db.select().from(oauth_tokens)
    .where(and(
      eq(oauth_tokens.user_id, userId),
      eq(oauth_tokens.provider, 'jira')
    )).get();

  if (!token) {
    throw new Error('No Jira integration found');
  }

  // Token expires within 5 minutes? Refresh it
  if (token.expires_at && token.expires_at < new Date(Date.now() + 5 * 60 * 1000)) {
    logger.info({ userId }, 'refreshing jira token');

    const refreshResponse = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: JIRA_CLIENT_ID,
        client_secret: JIRA_CLIENT_SECRET,
        refresh_token: await decrypt(token.refresh_token_encrypted, ENCRYPTION_MASTER_KEY),
      }),
    });

    if (!refreshResponse.ok) {
      // Refresh failed, mark token invalid
      await db.update(oauth_tokens)
        .set({ is_active: false, status_reason: 'Refresh failed' })
        .where(eq(oauth_tokens.id, token.id));

      throw new Error('Jira token refresh failed. Please re-authenticate.');
    }

    const newTokens = await refreshResponse.json();

    await db.update(oauth_tokens)
      .set({
        access_token_encrypted: await encrypt(newTokens.access_token, ENCRYPTION_MASTER_KEY),
        refresh_token_encrypted: await encrypt(newTokens.refresh_token, ENCRYPTION_MASTER_KEY),
        expires_at: new Date(Date.now() + newTokens.expires_in * 1000),
        updated_at: new Date(),
      })
      .where(eq(oauth_tokens.id, token.id));

    return newTokens.access_token;
  }

  return await decrypt(token.access_token_encrypted, ENCRYPTION_MASTER_KEY);
}
```

---

### 9.2 Jira: ADF Conversion

**SPEC STATUS:** ✅ MENTIONED (Bible says "requires markdown-to-ADF conversion")

**IMPLEMENTATION:**

Use `md-to-adf` npm package:

```typescript
import { markdownToAdf } from 'md-to-adf';

function convertChangeToJiraDescription(change) {
  const markdown = `
**What changed:**
${change.summary}

**Source:** ${change.source}
**Detected:** ${new Date(change.detected_at).toLocaleString()}
**Confidence:** ${change.confidence}%

[View full diff on Chirri](https://chirri.io/changes/${change.id})

---

**Recommended Actions:**
${change.actions.map(a => `- ${a}`).join('\n')}
  `.trim();

  return markdownToAdf(markdown);
}

async function createJiraIssue(userId, change, integration) {
  const accessToken = await getValidJiraToken(userId);
  const config = integration.config;

  const payload = {
    fields: {
      project: { key: config.project_key },
      summary: `[Chirri] ${change.severity.toUpperCase()} change on ${change.url_name}`,
      description: convertChangeToJiraDescription(change),
      issuetype: { name: config.issue_type || 'Task' },
      priority: {
        name: {
          critical: 'Highest',
          high: 'High',
          medium: 'Medium',
          low: 'Low',
        }[change.severity]
      },
      labels: ['chirri', 'api-change', change.severity],
    }
  };

  const response = await fetch(`${config.site_url}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Jira API error: ${error.errorMessages?.join(', ')}`);
  }

  const issue = await response.json();
  return {
    ticket_key: issue.key,
    ticket_url: `${config.site_url}/browse/${issue.key}`,
  };
}
```

---

### 9.3 Linear: Native Markdown

**SPEC STATUS:** ✅ SPECIFIED (Bible says "Native Markdown")

**IMPLEMENTATION:**

Linear uses GraphQL API:

```typescript
async function createLinearIssue(userId, change, integration) {
  const accessToken = await getValidLinearToken(userId);
  const config = integration.config;

  const markdown = `
**What changed:**
${change.summary}

**Source:** ${change.source}  
**Detected:** ${new Date(change.detected_at).toLocaleString()}  
**Confidence:** ${change.confidence}%

[View full diff on Chirri →](https://chirri.io/changes/${change.id})

---

**Recommended Actions:**
${change.actions.map(a => `- ${a}`).join('\n')}
  `.trim();

  const mutation = `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          identifier
          url
        }
      }
    }
  `;

  const variables = {
    input: {
      teamId: config.team_id,
      title: `${change.severity.toUpperCase()}: ${change.url_name} API changed`,
      description: markdown,
      priority: {
        critical: 1,  // Urgent
        high: 2,      // High
        medium: 3,    // Medium
        low: 4,       // Low
      }[change.severity],
      labelIds: config.label_ids || [],  // User-configured labels
    }
  };

  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const result = await response.json();

  if (!result.data?.issueCreate?.success) {
    throw new Error(`Linear API error: ${JSON.stringify(result.errors)}`);
  }

  const issue = result.data.issueCreate.issue;
  return {
    ticket_key: issue.identifier,  // e.g., "LIN-123"
    ticket_url: issue.url,
  };
}
```

---

### 9.4 GitHub Issues

**SPEC STATUS:** ✅ SPECIFIED (Bible says "GitHub Flavored Markdown")

**IMPLEMENTATION:**

```typescript
async function createGitHubIssue(userId, change, integration) {
  const accessToken = await getValidGitHubToken(userId);
  const config = integration.config;

  const markdown = `
**What changed:**
${change.summary}

**Source:** ${change.source}  
**Detected:** ${new Date(change.detected_at).toLocaleString()}  
**Confidence:** ${change.confidence}%

[View full diff on Chirri →](https://chirri.io/changes/${change.id})

---

**Recommended Actions:**
${change.actions.map(a => `- ${a}`).join('\n')}
  `.trim();

  const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      title: `[Chirri] ${change.severity.toUpperCase()}: ${change.url_name} API changed`,
      body: markdown,
      labels: [
        ...config.labels,  // User-configured labels
        `severity-${change.severity}`,
        'api-change',
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GitHub API error: ${error.message}`);
  }

  const issue = await response.json();
  return {
    ticket_key: `#${issue.number}`,
    ticket_url: issue.html_url,
  };
}
```

---

## PART 10: TWITTER/X AUTOMATION

### 10.1 What's the Implementation?

**SPEC STATUS:** ✅ SPECIFIED

Bible says:
- @chirri_io account
- Monitor 50 popular APIs pre-launch
- Tweet every significant change
- X API Free tier (1,500 tweets/month)
- `twitter-api-v2` npm package

**IMPLEMENTATION:**

```typescript
import { TwitterApi } from 'twitter-api-v2';

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

async function tweetAPIChange(change) {
  // Only tweet high/critical severity
  if (!['high', 'critical'].includes(change.severity)) {
    return;
  }

  // Character limit: 280
  const tweet = `
🚨 ${change.url_name} API changed

${truncate(change.summary, 150)}

Severity: ${change.severity.toUpperCase()}
Source: ${change.source}

Track it on Chirri: chirri.io/changes/${change.id}
  `.trim();

  try {
    const result = await twitterClient.v2.tweet(tweet);
    logger.info({ tweetId: result.data.id, changeId: change.id }, 'tweeted API change');
    return result.data.id;
  } catch (error) {
    logger.error({ error, changeId: change.id }, 'failed to tweet change');
    // Don't throw -- tweeting is nice-to-have, not critical
  }
}

// Triggered by BullMQ worker processing confirmed changes
async function processChangeForTwitter(change) {
  // Only tweet changes from pre-configured "popular APIs" list
  const popularAPIs = ['stripe.com', 'api.openai.com', 'api.twilio.com', /* ... */];

  if (!popularAPIs.includes(change.parsed_domain)) {
    return;
  }

  await tweetAPIChange(change);
}
```

**Rate Limiting:**

X Free tier: 1,500 tweets/month = ~50/day.

**Throttling:**
- Max 10 tweets/day from Chirri
- Queue tweets and batch-send daily
- Prioritize critical > high > medium

**Tweet Templates:**

```typescript
const templates = {
  deprecation: (change) => `
⚠️ ${change.url_name} deprecation detected

${change.summary}

Deadline: ${change.deadline ? format(change.deadline, 'MMM d, yyyy') : 'TBD'}

Track: chirri.io/changes/${change.id}
  `,

  breaking: (change) => `
🚨 BREAKING: ${change.url_name}

${change.summary}

Affected: ${change.affected_endpoints?.join(', ') || 'multiple endpoints'}

Details: chirri.io/changes/${change.id}
  `,

  outage: (change) => `
🔴 ${change.url_name} is down

Status: ${change.current_status_code || 'Unavailable'}
Detected: ${format(change.detected_at, 'HH:mm')} UTC

Monitor: chirri.io
  `,
};
```

---

## PART 11: ACCOUNTS CHIRRI NEEDS

### 11.1 Complete Checklist

**SPEC STATUS:** ✅ SPECIFIED (Section 7.5)

Bible lists accounts needed. Here's the **actionable checklist**:

**Pre-Launch (Required):**

- [ ] **Domain:** chirri.io (Cloudflare)
  - [ ] DNS configured
  - [ ] SSL certificate active
  - [ ] SPF/DKIM/DMARC records added
  - [ ] Subdomain: app.chirri.io (dashboard)
  - [ ] Subdomain: api.chirri.io (API server)

- [ ] **Railway:** Project created
  - [ ] 3 services deployed (API, Scheduler, Workers)
  - [ ] PostgreSQL add-on provisioned
  - [ ] Redis add-on provisioned
  - [ ] Environment variables set
  - [ ] Auto-deploy from GitHub configured

- [ ] **Cloudflare R2:** Bucket created
  - [ ] Bucket name: chirri-snapshots
  - [ ] Access keys generated
  - [ ] CORS configured for dashboard access

- [ ] **Stripe:** Account created
  - [ ] Products created (Personal $5, Team $19, Business $49)
  - [ ] Webhook endpoint configured
  - [ ] Customer portal enabled
  - [ ] Test mode keys vs production keys

- [ ] **Resend:** Account created
  - [ ] Domain verified (chirri.io)
  - [ ] API key generated
  - [ ] Bounce/complaint webhooks configured

- [ ] **Sentry:** Project created
  - [ ] DSN copied to env vars
  - [ ] Source maps upload configured (for frontend)
  - [ ] Alert rules configured (error rate >1%)

- [ ] **GitHub:**
  - [ ] Organization: chirri-io
  - [ ] Repo: chirri (monorepo)
  - [ ] Actions enabled (CI/CD)
  - [ ] Secrets configured (Railway deploy token, etc.)

**Post-Launch (Within 1 Week):**

- [ ] **Twitter/X:** @chirri_io
  - [ ] Bio: "APIs change. We'll let you know. Free monitoring for Stripe, OpenAI, Twilio, and more."
  - [ ] Profile pic: Chirri logo (sakura theme)
  - [ ] Header: Animated sakura tree (static for Twitter)
  - [ ] Pin tweet: Launch announcement

- [ ] **Atlassian Developer Console:** Jira OAuth app
  - [ ] App created
  - [ ] Redirect URI: https://chirri.io/integrations/jira/callback
  - [ ] Scopes: read:jira-work, write:jira-work
  - [ ] Client ID/secret stored in env vars

- [ ] **Linear:** OAuth application
  - [ ] App created at https://linear.app/settings/api/applications
  - [ ] Redirect URI: https://chirri.io/integrations/linear/callback
  - [ ] Client ID/secret stored

- [ ] **GitHub App:** (for GitHub Issues integration)
  - [ ] App created at https://github.com/settings/apps
  - [ ] Permissions: issues (read/write), metadata (read)
  - [ ] Webhook: disabled (not needed)
  - [ ] Redirect URI: https://chirri.io/integrations/github/callback

**Optional (V1.1+):**

- [ ] Newsletter: Buttondown account
- [ ] Analytics: Umami Cloud or Plausible
- [ ] Status page: Statuspage.io or self-hosted

---

## SUMMARY OF GAPS & SOLUTIONS

### Critical Gaps Found (20+)

1. ❌ Email template structure not specified → **SOLUTION PROVIDED** (Section 1.1.1)
2. ❌ SPF/DKIM/DMARC setup not documented → **SOLUTION PROVIDED** (Section 1.1.2)
3. ❌ Onboarding email copy missing → **SOLUTION PROVIDED** (Section 1.1.4)
4. ❌ Weekly report timezone handling not implemented → **SOLUTION PROVIDED** (Section 1.1.5)
5. ❌ Dunning email sequence not specified → **SOLUTION PROVIDED** (Section 1.2)
6. ❌ Slack webhook validation logic missing → **SOLUTION PROVIDED** (Section 2.1)
7. ❌ Slack test message not implemented → **SOLUTION PROVIDED** (Section 2.1)
8. ❌ Discord webhook validation logic missing → **SOLUTION PROVIDED** (Section 3.1)
9. ❌ Discord test message not implemented → **SOLUTION PROVIDED** (Section 3.1)
10. ❌ Webhook retry decision tree incomplete → **SOLUTION PROVIDED** (Section 4.1)
11. ❌ Webhook failure notifications not specified → **SOLUTION PROVIDED** (Section 4.2)
12. ❌ MCP server installation instructions missing → **SOLUTION PROVIDED** (Section 5.1)
13. ❌ MCP server not tested with real client → **TEST PLAN PROVIDED** (Section 5.3)
14. ❌ Cross-source change deduplication missing → **SOLUTION PROVIDED** (Section 6.1)
15. ❌ Notification rate limiting implementation incomplete → **SOLUTION PROVIDED** (Section 6.2)
16. ❌ Quiet hours UI not specified → **SOLUTION PROVIDED** (Section 7.1)
17. ❌ Quiet hours queuing logic missing → **SOLUTION PROVIDED** (Section 7.2)
18. ❌ "Chirp" definition ambiguous → **CLARIFIED** (Section 8.1)
19. ❌ OAuth flow implementation missing → **SOLUTION PROVIDED** (Section 9.1)
20. ❌ Jira ADF conversion not implemented → **SOLUTION PROVIDED** (Section 9.2)
21. ❌ Twitter automation incomplete → **SOLUTION PROVIDED** (Section 10.1)

### Implementation-Ready Score

**Before This Review:** ~50% (concepts clear, implementation fuzzy)  
**After This Review:** ~75% (actionable checklists, code samples, UI mockups)

### Remaining Work

1. **Build React Email templates** (5 onboarding + recurring)
2. **Implement OAuth flows** (Jira, Linear, GitHub)
3. **Test MCP server** with Claude Desktop
4. **Write integration tests** for notification pipeline
5. **Design UI** for webhook delivery log
6. **Create Twitter bot** service

---

## RECOMMENDATIONS

### For Implementation

1. **Start with email notifications** -- most critical path
2. **Use feature flags** for PM integrations (OAuth flows can fail in prod)
3. **Mock MCP server** for testing before npm publish
4. **Build admin dashboard** for webhook delivery debugging
5. **Monitor Resend bounce rate** daily during first week

### For Documentation

1. Add email template screenshots to Bible
2. Document OAuth redirect URIs in one place
3. Create troubleshooting guide for integrations
4. Write MCP server user guide (with examples)

### For Testing

1. **Email deliverability test** (Gmail, Outlook, ProtonMail)
2. **OAuth flow test** with real Jira/Linear/GitHub accounts
3. **MCP server integration test** with Claude Desktop
4. **Webhook retry simulation** (kill endpoint mid-delivery)
5. **Timezone edge case test** (quiet hours overnight)

---

**END OF REVIEW**

This document provides concrete, implementable solutions for every "how does this actually work?" question in Chirri's notification and integration pipeline. Ready to build.
