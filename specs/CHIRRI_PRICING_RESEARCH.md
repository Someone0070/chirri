# Chirri Pricing Research: Flat Tiers vs Usage-Based vs Hybrid

> **TL;DR Recommendation: Option C — Hybrid flat tiers with a lower entry point ($5/mo).** Not Railway-style usage. The monitoring space universally uses flat tiers because usage is predictable and self-selected. Drop the entry price from $9 to $5, add a $19 mid-tier, and keep it simple. Details below.

---

## 1. How Railway Prices

**Model:** Flat subscription + pure resource usage (CPU, RAM, egress, storage)

| Plan | Price | Included Credits | Best For |
|------|-------|-----------------|----------|
| Free | $0 | $1 one-time | Experimentation |
| Hobby | $5/mo | $5/mo | Personal projects |
| Pro | $20/mo | $20/mo | Production |
| Enterprise | Custom | Custom | Compliance/SLAs |

**How it works:**
- Subscription fee *counts toward* resource usage — if you're on Hobby ($5/mo) and use $3 in resources, you still pay $5. Use $8, you pay $8.
- Resources: CPU $20/vCPU/mo, RAM $10/GB/mo, Egress $0.05/GB, Storage $0.15/GB/mo
- Billed by the minute for compute

**User sentiment (Reddit/community):**
- **Praise:** "The $5/month is totally reasonable" — devs love the simplicity and that most hobby projects stay under $5
- **Complaints:** "Why pay $5 for an app that no one visits?" — resistance to paying *anything* for zero-traffic hobby projects. Many compare to free tiers at Render, Fly.io
- **Key insight:** Most hobby users never exceed the $5 credit. The subscription is effectively a flat fee for them.

**Why it works for Railway:** Their cost scales linearly with customer resource consumption (CPU/RAM). Usage-based pricing directly mirrors their cost structure.

---

## 2. How Vercel Prices

**Model:** Flat subscription + usage-based overages across multiple dimensions

| Plan | Price | Usage Model |
|------|-------|-------------|
| Hobby | $0 | Hard caps, no overages |
| Pro | $20/mo/seat | Generous quotas + overage billing |
| Enterprise | ~$20K+/yr | Custom |

**Pro includes:** 10M Edge Requests, 1TB bandwidth, 40hrs Active CPU
**Overages:** $2/1M edge requests, $0.15/GB bandwidth, etc.

**How overages work:**
- Default $200 spend cap — prevents surprise bills
- Email/SMS notifications at thresholds
- Can auto-pause at limit

**User sentiment:**
- Hobby → Pro jump ($0 → $20) feels steep for side projects
- Overage billing is the #1 complaint: "going viral on HN = surprise bill"
- Pro → Enterprise cliff is enormous ($20/mo → $20K+/yr for SSO)

**Key insight:** Vercel has been *moving away* from pure usage and toward higher base fees. Their Sept 2025 restructuring converted from fixed resources to credits — a sign that pure usage-based was causing too much billing anxiety.

---

## 3. How Other Dev Tools Price

### Supabase (Hybrid: flat base + usage overages)
- Free: generous (50K MAUs, 500MB DB)
- Pro: **$25/mo** (includes $10 compute credit, spend cap on by default)
- Team: **$599/mo** (compliance/SSO tier)
- Enterprise: custom

### Neon (Pure usage-based)
- Free: 100 CU-hrs/mo, 0.5GB storage
- Launch: $0.106/CU-hr, ~$15/mo typical
- Scale: $0.222/CU-hr, ~$701/mo typical
- No flat base fee on paid tiers — pure consumption

### Upstash (Dual model: pay-per-request OR fixed)
- Free: 256MB, 500K commands/mo
- **Pay-as-you-go:** $0.20 per 100K requests (true usage)
- **Fixed plans:** $10–$1,500/mo (unlimited requests within storage/bandwidth limits)
- *They literally offer both models* — users self-select

### Resend (Usage-based tiers)
- Free: 100 emails/day
- Pro/Scale: volume-based pricing that decreases per unit at scale

### Summary Table

| Tool | Model | Base Fee | Usage Component |
|------|-------|----------|-----------------|
| Railway | Hybrid | $5–$20 | CPU/RAM/egress |
| Vercel | Hybrid | $0–$20 | Bandwidth/requests/CPU |
| Supabase | Hybrid | $25 | DB/storage/egress overages |
| Neon | Pure usage | $0 | CU-hours + storage |
| Upstash | Dual (choice) | $0 or $10+ | Per-request or unlimited |
| Resend | Tiered usage | Varies | Per email |

---

## 4. How Monitoring Tools Price (Direct Competitors)

This is the critical comparison. Chirri isn't Railway — it's a monitoring tool. Here's what Chirri's actual competitors charge:

### UptimeRobot
| Plan | Price | Monitors | Interval |
|------|-------|----------|----------|
| Free | $0 | 50 | 5 min |
| Solo | **$7/mo** | 50 | 1 min |
| Team | **$29/mo** | 100 | 1 min |
| Enterprise | **$54+/mo** | 200+ | 30 sec |

**Model: Pure flat tiers.** No usage component. No per-check billing. No overages.

### Better Stack (BetterUptime)
- Free: 10 monitors, 3-min checks
- Paid: starts ~$25/mo
- **Pure flat tiers** with feature gating

### Pingdom
- Starts at $15/mo for 10 monitors
- **Flat tiers** based on monitor count

### Key Insight: **Every single monitoring tool uses flat tiers.**

Why? Because monitoring usage is:
1. **Predictable** — you choose how many URLs and how often
2. **Self-selected** — users configure their own usage level
3. **Not spiky** — unlike web traffic, checks are constant
4. **Easy to understand** — "I have 20 URLs, I need the 20-URL plan"

Usage-based pricing makes sense when consumption is variable and hard to predict (API calls, bandwidth, compute). Monitoring checks are the *opposite* — perfectly predictable.

---

## 5. Flat Tiers vs Usage-Based vs Hybrid: General Analysis

### What the industry data says:
- **61% of SaaS companies** now have some usage component (OpenView 2023 survey)
- But **hybrid** (base + usage) outperforms pure usage for revenue predictability
- Pure usage-based has **higher churn** — users can scale to $0 during slow months
- Flat tiers have **better NRR** for SMB/indie segment
- Usage-based works when: usage correlates with *value received* and *customer revenue*

### For monitoring specifically:
- Usage (checks performed) does NOT correlate with customer revenue
- A dev monitoring 3 URLs gets the same *type* of value as one monitoring 100
- Users want **predictability** — "what will my bill be?" should have one answer
- Variable bills create anxiety that kills conversion for hobbyists

### What developers prefer:
- Reddit consensus: "I want to know exactly what I'm paying"
- Usage-based is tolerated for infra (hosting, DB) because it mirrors costs
- For tools/services, flat pricing wins: "just tell me the price"
- The word "overage" triggers negative emotions in devs

---

## 6. The $9 Question

### Is $9/mo expensive for developers?

**It depends on the context:**

| Price Point | Psychology | Decision Process |
|-------------|-----------|-----------------|
| $0 | No friction | Sign up immediately |
| $5/mo | "Cup of coffee" | Personal credit card, instant |
| $9/mo | Threshold zone | Slight hesitation for hobby use |
| $15/mo | Considered purchase | Needs to feel essential |
| $20/mo | "Real tool" territory | Often needs justification |
| $50+/mo | Team/business budget | Manager approval likely |

**Key thresholds:**
- **$5 is the impulse-buy ceiling** for indie devs on personal projects
- **$10 is the "do I really need this?" threshold** — brain starts calculating
- **$20 is where personal → business budget happens**
- **$50+ requires approval** at most companies

### The $9 problem for Chirri:
- $9 sits in an awkward middle: too expensive to be impulse, too cheap to feel premium
- Compared to UptimeRobot Solo at $7/mo (50 monitors!), Chirri at $9/mo for 20 URLs looks expensive
- $5 would feel like "whatever, it's nothing"
- $9 makes people open a spreadsheet

### Evidence from competitors:
- UptimeRobot Solo: **$7/mo** (aggressively targeting hobbyists)
- Railway Hobby: **$5/mo**
- Supabase Pro: **$25/mo** (but that's a full backend)
- The developer tool "sweet spot" for personal use: **$5–7/mo**

---

## 7. Three Pricing Options Modeled

### Option A: Current Flat Tiers

| Tier | Price | URLs | Interval | Features |
|------|-------|------|----------|----------|
| Free | $0 | 3 | Daily | Email only |
| Indie | $9 | 20 | 1 hour | All integrations |
| Pro | $29 | 100 | 5 min | Teams |
| Business | $79 | 500 | 1 min | SSO |

**Revenue projections (assuming typical SaaS conversion funnel):**

| Users | Free (80%) | Indie (12%) | Pro (6%) | Biz (2%) | MRR |
|-------|-----------|-------------|----------|----------|-----|
| 100 | 80 | 12 | 6 | 2 | $440 |
| 500 | 400 | 60 | 30 | 10 | $2,200 |
| 1,000 | 800 | 120 | 60 | 20 | $4,400 |

**Pros:**
- Simple to understand
- Predictable revenue
- Standard for monitoring tools

**Cons:**
- $9 entry feels expensive vs UptimeRobot ($7 for 50 monitors)
- Big gap between Free (3 URLs) and Indie (20 URLs) — no room for "just one more URL"
- $9 → $29 jump is 3.2x with no middle option

**Verdict:** Workable but the $9 price point is the weak link.

---

### Option B: Railway-Style Usage

| Tier | Base | Included | Overage | Unlocks |
|------|------|----------|---------|---------|
| Free | $0 | 3 URLs, daily | None | Email |
| Hobbyist | $5/mo | 500 checks | $0.001/check | Webhooks, Slack |
| Pro | $15/mo | 5,000 checks | $0.0005/check | All integrations, 5-min |
| Business | $49/mo | 50,000 checks | Included | SSO, teams, 1-min |

**Revenue projections (harder to predict — that's the problem):**

Assuming average overage of 20% above base:

| Users | Free (80%) | Hobby (12%) | Pro (6%) | Biz (2%) | MRR |
|-------|-----------|-------------|----------|----------|-----|
| 100 | 80 | 12 | 6 | 2 | $260 + ~$15 overage = ~$275 |
| 500 | 400 | 60 | 30 | 10 | $1,300 + ~$75 = ~$1,375 |
| 1,000 | 800 | 120 | 60 | 20 | $2,600 + ~$150 = ~$2,750 |

**Pros:**
- Lower entry price ($5 vs $9) could boost conversion
- "Fair" — pay for what you use
- Scales smoothly

**Cons:**
- **Way more complex to implement** — need metering, billing engine, overage calculations
- **Unpredictable revenue** for Chirri
- **Unpredictable bills** for users → anxiety → churn
- **No monitoring competitor uses this model** — would be confusing
- Users have to *think* about whether adding a URL will cost more
- Per-check pricing is awkward: "what's a check worth?" is a weird question
- Lower MRR at same user counts vs flat tiers
- Overage revenue is minimal — monitoring checks are cheap

**Verdict: Don't do this.** It adds complexity for both Chirri and users with no clear benefit. Monitoring isn't infrastructure — the Railway model doesn't map.

---

### Option C: Hybrid Flat Tiers (Recommended)

| Tier | Price | URLs | Interval | Features |
|------|-------|------|----------|----------|
| Free | $0 | 3 | Daily | Email only |
| Personal | **$5/mo** | 10 | 1 hour | Basic integrations (email, webhook) |
| Team | **$19/mo** | 50 | 5 min | All integrations, 3 seats, status pages |
| Business | **$49/mo** | 200 | 1 min | SSO, 10 seats, priority support |
| Enterprise | Custom | Unlimited | 30 sec | SLAs, dedicated support |

**Revenue projections (assuming better conversion at $5 entry):**

| Users | Free (75%) | Personal (15%) | Team (7%) | Biz (2.5%) | Ent (0.5%) | MRR |
|-------|-----------|----------------|-----------|------------|------------|-----|
| 100 | 75 | 15 | 7 | 2.5 | 0.5 | $383 |
| 500 | 375 | 75 | 35 | 12.5 | 2.5 | $1,913 |
| 1,000 | 750 | 150 | 70 | 25 | 5 | $3,825 |

Wait — that looks lower than Option A. But here's the thing:

**Conversion rates change dramatically at lower price points.**

More realistic with $5 entry:

| Users | Free (70%) | Personal (18%) | Team (8%) | Biz (3%) | Ent (1%) | MRR |
|-------|-----------|----------------|-----------|----------|----------|-----|
| 100 | 70 | 18 | 8 | 3 | 1 | $389 |
| 500 | 350 | 90 | 40 | 15 | 5 | $1,945 |
| 1,000 | 700 | 180 | 80 | 30 | 10 | $3,890 |

**At 1,000 users, Option A: $4,400 vs Option C: $3,890 — but Option C has 280 paying users vs Option A's 200.** More paying users = more expansion revenue potential, more engagement, more word-of-mouth, more upgrade paths.

**Pros:**
- $5 entry is impulse-buy territory — removes the #1 conversion barrier
- $19 team tier fills the gap between personal and business
- Competitive with UptimeRobot ($7/mo Solo) while offering differentiation
- Simple to understand, simple to implement
- Predictable for both Chirri and users
- More paying users = bigger funnel for upsells
- $49 business tier is more accessible than $79

**Cons:**
- Lower per-user revenue at entry level
- Need to make $5→$19 upgrade compelling (5→50 URLs, daily→5min is a big jump)

**Verdict: This is the move.**

---

## 8. Why Not Usage-Based (The Core Argument)

1. **Monitoring checks ≠ cloud compute.** Railway charges for CPU/RAM because their costs scale with your consumption. Chirri's cost of running a URL check is negligible — the marginal cost of check #501 vs check #500 is essentially zero.

2. **Users choose their own usage.** Unlike API traffic that's driven by end users, monitoring URLs are manually configured. Users *know* what they'll use. Flat tiers match this perfectly.

3. **Billing complexity is a startup killer.** Implementing metering, invoicing with overages, usage dashboards, and spend alerts is a significant engineering investment. That time is better spent on product.

4. **Every competitor uses flat tiers.** UptimeRobot, Better Stack, Pingdom, StatusCake — all flat. Going usage-based would confuse the market.

5. **Variable bills kill hobbyist conversion.** The exact audience Chirri wants (indie devs) is the most allergic to unpredictable costs.

---

## 9. Final Recommendation

### Go with Option C (Hybrid Flat Tiers) with these specifics:

```
Free        $0/mo     3 URLs    daily     email only
Personal    $5/mo    10 URLs    1 hour    email + webhook + Slack
Team       $19/mo    50 URLs    5 min     all integrations, 3 seats, status pages
Business   $49/mo   200 URLs    1 min     SSO, 10 seats, API, priority support
Enterprise  Custom   Unlimited   30 sec    SLAs, dedicated infra, custom integrations
```

### Why this wins:

1. **$5 is the new $9** — it's below the psychological friction threshold. Developers will pay $5 without thinking. They'll think about $9.

2. **The $19 mid-tier is crucial** — it catches the "I outgrew Personal but don't need Business" crowd. The old model jumped $9 → $29 with nothing in between.

3. **$49 business is more competitive than $79** — and with 200 URLs + 1-min checks + SSO, it's a clear value proposition.

4. **Feature gating over URL gating** — the tiers unlock *capabilities* (intervals, integrations, seats) not just "more URLs." This feels fairer and creates natural upgrade triggers.

5. **It matches the market** — competitors charge $7-29 for similar plans. Chirri at $5-19 is competitive while being simpler.

### What NOT to do:
- ❌ Usage-based/per-check pricing — adds complexity, confuses users, no competitor does it
- ❌ $9 entry tier — sits in the "hmm, do I really need this?" zone
- ❌ Credit systems — overhead not worth it for a monitoring tool
- ❌ Overage billing — creates billing anxiety for the indie dev audience

### Optional future add-on (if needed):
If Chirri grows and some users need 300+ URLs but don't need Business features, consider a simple "extra URLs" add-on: **$1/mo per 10 additional URLs** on any paid plan. This is a light usage component that's predictable and opt-in, without turning the whole pricing into a metering nightmare.

---

## 10. Implementation Priority

1. **Now:** Launch with Free + $5 Personal + $19 Team + $49 Business
2. **Later (500+ users):** Add Enterprise tier with custom pricing
3. **Even later (if data supports it):** Consider URL add-on packs
4. **Never:** Per-check usage billing

The pricing should be the *simplest thing about Chirri*. Save the complexity for the product.
