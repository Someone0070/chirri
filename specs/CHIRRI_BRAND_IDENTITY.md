# Chirri — Brand Identity & Positioning Guide

> **Product:** Chirri (chirri.io) — API change detection for developers
> **Name origin:** Japanese — the sound a cricket makes (チリチリ). A gentle warning chirp.
> **Core aesthetic:** Japanese zen minimalism

---

## 1. Positioning

### 1.1 Competitive Landscape Research

The best dev tool taglines share a pattern: they're short, opinionated, and make you *feel* something.

| Tool | Tagline | What it does |
|------|---------|-------------|
| **Linear** | "The product development system for teams and agents" | Issue tracking |
| **Vercel** | "Develop. Preview. Ship." | Deployment |
| **Raycast** | "Your shortcut to everything" | Launcher |
| **Resend** | "Email API for developers" | Email |
| **Neon** | "Ship faster" | Postgres |
| **Sentry** | "Your code is broken. Fix it." | Error tracking |
| **PostHog** | "We make dev tools for product engineers" | Analytics |
| **Better Stack** | "The AI SRE observability stack" | Monitoring |
| **Stripe** | "Financial infrastructure for the internet" | Payments |

**Patterns that work:**
- **Verb-driven imperatives:** "Develop. Preview. Ship." / "Ship faster" — action-oriented
- **Emotional positioning:** Linear's old tagline "The issue tracking tool you'll enjoy using" — addresses the pain (existing tools suck)
- **Identity claims:** "Your shortcut to everything" — makes the user the subject
- **Category creation:** "Financial infrastructure for the internet" — defines a new space

### 1.2 Chirri's Positioning Angles

**Angle A: Peace of mind (zen)**
> *APIs change. Chirri listens.*

This leans into the Japanese zen aesthetic. The cricket doesn't panic — it simply chirps when something stirs. Calm awareness.

**Angle B: Speed/alertness**
> *Know before it breaks.*

Addresses the core fear: a third-party API changes and your integration silently breaks in production.

**Angle C: Simplicity (anti-complexity)**
> *API monitoring that doesn't suck.*

Direct. Positions against changedetection.io's ugly complexity and UptimeRobot's enterprise bloat.

**Angle D: The cricket metaphor**
> *Your APIs' early warning system.*

Leverages the cricket = warning sound metaphor without requiring explanation.

**Angle E: Developer identity**
> *Sleep well. Ship confidently.*

Speaks to the indie dev / small team who can't afford a dedicated SRE.

### 1.3 Recommended Primary Tagline

> ## **Chirri — APIs change. We'll let you know.**

**Why this works:**
- States the problem plainly (APIs change — everyone knows this)
- Promises the solution casually (we'll let you know — not "we'll alert you" or "we'll notify you")
- Conversational, not corporate
- Works at every touchpoint: homepage, Twitter bio, email footer, Slack notification
- Mirrors the cricket metaphor without being precious about it

**Short variant (for tight spaces):**
> **Know when APIs change.**

**Meta description / SEO:**
> Chirri watches your APIs so you don't have to. Get notified when endpoints change their response, schema, or behavior. Free tier available.

---

## 2. Competitive Positioning Map

### 2.1 Axis: Simple ↔ Complex

```
Simple                                                    Complex
  |                                                          |
  ●──── Chirri                                               |
  |         ● UptimeRobot                                    |
  |                          ● Visualping                    |
  |                                    ● changedetection.io  |
  |                                              ● Datadog   |
```

### 2.2 Axis: Developer-first ↔ Business/Enterprise

```
Developer-first                                     Enterprise
  |                                                      |
  ●──── Chirri                                           |
  |      ● changedetection.io                            |
  |                    ● Better Stack                    |
  |                              ● UptimeRobot           |
  |                                        ● Datadog     |
```

### 2.3 Axis: Cheap ↔ Expensive

```
Free/Cheap                                          Expensive
  |                                                      |
  ●── Chirri ($0-79)                                     |
  |   ● changedetection.io (self-hosted free)            |
  |              ● UptimeRobot ($7+)                     |
  |                       ● Better Stack ($29+)          |
  |                                     ● Datadog ($$$)  |
```

### 2.4 Chirri's Unique Quadrant

**Simple + Developer-first + Affordable + API-specific**

No one else owns this quadrant:
- **changedetection.io** is developer-ish but complex, ugly, and general-purpose (websites, not APIs)
- **UptimeRobot** is simple but checks uptime, not API *changes* — and it's enterprise-bland
- **Datadog** / **Better Stack** do API monitoring but they're expensive SRE tools, not dev tools
- **Visualping** / **Hexowatch** are for marketers watching competitor websites, not developers watching APIs

**Chirri's moat:** The only tool purpose-built for developers who depend on third-party APIs and need to know when those APIs change — not go down, but *change*.

---

## 3. Voice & Tone Guide

### 3.1 Brand Voice Research

| Brand | Voice | Key trait |
|-------|-------|-----------|
| **Stripe** | Precise, neutral, confident | Never wastes a word. Docs feel like engineering specs. |
| **Linear** | Minimal, sharp, opinionated | Says less than everyone else. Every word earned. |
| **Vercel** | Bold, declarative, future-facing | Speaks in imperatives. "Ship." Not "you can ship." |
| **Raycast** | Warm, snappy, developer-peer | Talks like a coworker, not a company. |
| **PostHog** | Irreverent, playful, transparent | Hedgehog mascot. Self-deprecating humor. Open source energy. |
| **Sentry** | Direct, slightly edgy, developer-empathetic | Leans into developer pain. "Your code is broken." |

### 3.2 Chirri's Voice

**Chirri speaks like a calm, observant friend who happens to be technically sharp.**

Think: the developer who notices things others miss, but doesn't make a big deal about it. A quiet confidence. The cricket chirps — it doesn't scream.

**Voice attributes:**

| Attribute | Description | Example |
|-----------|-------------|---------|
| **Calm** | Never panicky, even about breaking changes | "The Stripe API response changed. Here's what's different." |
| **Precise** | Says exactly what changed, nothing more | Not "Something might have changed!" |
| **Warm** | Friendly but not cutesy | "Welcome to Chirri" not "Welcome to Chirri! 🎉🎊🥳" |
| **Minimal** | Every word earns its place | Inspired by Linear's restraint |
| **Observant** | Notices small things | Fits the cricket metaphor — alert to subtle shifts |

**Chirri is NOT:**
- ❌ Corporate ("We are pleased to inform you...")
- ❌ Panicky ("URGENT: API CHANGE DETECTED!")
- ❌ Cute ("Oopsie! Something changed! 🙈")
- ❌ Verbose ("In order to better serve your monitoring needs, we have...")
- ❌ Cold ("Alert #4829 triggered at 14:02:33 UTC")

### 3.3 Tone by Context

**Marketing / Landing page:**
Confident and inviting. Slightly poetic. Let the zen aesthetic breathe.
> "APIs evolve. Schemas drift. Fields vanish. Chirri watches, so you can build."

**Documentation:**
Clear, neutral, precise. Like Stripe — the ego disappears. Just the facts.
> "To monitor a new endpoint, add the URL and select a check interval. Chirri will compare each response against the previous one and notify you of any differences."

**Notifications / Alerts:**
Calm and factual. The cricket chirps, it doesn't scream.
> "**Stripe /v1/charges** — Response schema changed. `payment_method_details.type` now includes `cashapp`. [View diff →]"

**Error messages:**
Helpful, never blaming. Brief.
> "We couldn't reach that endpoint. We'll try again in 5 minutes."
> "That API key doesn't look right. Double-check and try again."

**Onboarding:**
Warm, minimal, fast. Developers hate onboarding — make it nearly invisible.
> "Add your first endpoint. We'll check it every 5 minutes and let you know if anything changes."
> "That's it. Chirri is watching."

**Email (weekly digest):**
Subject: "Your APIs this week"
> "3 endpoints checked. 1 change detected. Everything else held steady."

**Empty states:**
> "Nothing here yet. Add an endpoint to start watching."
> "No changes detected. Quiet is good."

---

## 4. Visual Identity Direction

### 4.1 Logo Concepts

**Concept A: The Cricket Mark**
A minimal, geometric cricket silhouette — reduced to its essence. Two angular wings forming a subtle "C" shape. Single-weight line work. Think: if Muji designed an insect icon.

**Concept B: The Chirp Wave**
A single sound wave emanating from a point — like a sonar ping or a cricket's chirp visualized. Clean, geometric, one continuous line. Works as both a logomark and a subtle animation on the site (a gentle pulse).

**Concept C: The Petal Dot**
A single cherry blossom petal (sakura) stylized into a notification dot. Minimal — just the shape, no detail. Communicates both the Japanese origin and the "alert" function.

**Recommended:** Concept B (Chirp Wave) as primary mark, with a custom wordmark. The wave can animate subtly on hover/load states, creating a signature interaction. Concept C (Petal Dot) as the favicon/notification icon.

### 4.2 Color Palette

**Primary:**

| Name | Hex | Usage |
|------|-----|-------|
| **Sakura** | `#FFB7C5` | Primary accent. Buttons, highlights, logo |
| **Snow** | `#FAFAFA` | Background. Not pure white — warmer, softer |
| **Ink** | `#1A1A1A` | Primary text. Deep, not pure black |

**Secondary:**

| Name | Hex | Usage |
|------|-----|-------|
| **Blossom** | `#FFD4DE` | Hover states, light backgrounds, cards |
| **Petal** | `#FF8FA3` | Stronger accent for CTAs, important alerts |
| **Stone** | `#6B7280` | Secondary text, muted elements |
| **Mist** | `#F3F4F6` | Borders, dividers, subtle backgrounds |
| **Bamboo** | `#10B981` | Success states, "no changes" indicators |
| **Amber** | `#F59E0B` | Warnings, schema drift alerts |
| **Vermillion** | `#EF4444` | Breaking changes, errors |

**Dark mode (important for dev tools):**

| Name | Hex | Usage |
|------|-----|-------|
| **Night** | `#0F0F0F` | Dark background |
| **Charcoal** | `#1C1C1C` | Cards, elevated surfaces |
| **Ash** | `#2A2A2A` | Borders, dividers |
| **Sakura (dark)** | `#FFB7C5` | Accent carries over — pops beautifully on dark |

**Principle:** Sakura pink is the *only* strong color. Everything else is intentionally restrained — grays, near-whites, near-blacks. The pink earns its power by being rare.

### 4.3 Typography

**Headings: Inter**
- The standard for modern dev tools (used by Linear, Vercel, Raycast)
- Clean, geometric, highly legible
- Use weights 500 (medium) and 600 (semibold) only — avoid bold, keep it light

**Body: Inter or Satoshi**
- Satoshi (by Indian Type Foundry) as an alternative — slightly warmer, more character
- Good for body copy where Inter might feel too clinical

**Code / Monospace: JetBrains Mono or Berkeley Mono**
- JetBrains Mono: free, excellent ligatures, developer-standard
- Berkeley Mono: premium, more distinctive, great for a brand that wants to stand out

**Japanese accent font (for decorative use only):**
- Noto Sans JP (for any Japanese text)
- Used sparingly — a kanji character in the 404 page, the word チリチリ on the about page

**Typography rules:**
- Large headings, small body. High contrast in size.
- Generous line height (1.6–1.7 for body)
- Letter-spacing: slightly loose on headings, normal on body
- Never all-caps except for very small labels (like "NEW" badges)

### 4.4 Illustration Style

**Ma (間) — the Japanese concept of negative space**

Chirri's illustration style is defined by what's *not* there.

- **Line art only.** Single-weight strokes. No fills, no gradients.
- **Cherry blossom petals** as the recurring motif — floating, drifting. Used as section dividers, loading states, empty states.
- **Minimal isometric** for technical diagrams — show API request/response flows with clean lines
- **No illustrations of people.** Keep it abstract. The product is the hero.
- **Subtle animation:** Petals drift slowly. Waves pulse gently. Nothing bounces or shakes.

**Inspiration references:**
- The restraint of Muji's packaging
- The whitespace of a Japanese rock garden (枯山水)
- Linear's landing page: dark, spacious, confident
- Stripe's documentation: precise, structured, breathable

### 4.5 Extending the Aesthetic

**Dashboard:**
- Dark mode default (developers prefer it)
- Sakura pink for active/selected states — the only color that pops
- Diff views with subtle pink/green highlighting
- API change timeline as a clean vertical line with dots — like a zen scroll

**Documentation:**
- White background, generous margins
- Code examples front and center
- Sidebar navigation — minimal, no icons
- A single cherry blossom petal watermark, very faint, in the corner

**Emails:**
- Plain text first. HTML version is white + one sakura accent line at the top.
- No header images, no big logos. Just the mark and the message.
- Footer: "Chirri — APIs change. We'll let you know."

**Social / Twitter:**
- Profile: Chirp Wave mark in sakura pink on white
- Banner: Negative space. Maybe a single falling petal. The tagline.
- Tweets in brand voice: calm, observant, occasionally witty

---

## 5. Landing Page Copy

### 5.1 Hero Section — 5 Options

**Option 1: The Calm Statement**
> # APIs change. We'll let you know.
> Monitor any API endpoint for response changes, schema drift, and breaking updates. Get notified before your users do.
> `[Start watching — free] [See how it works]`

**Option 2: The Problem-First**
> # That API you depend on? It just changed.
> Third-party APIs break without warning. Chirri watches your endpoints and alerts you when responses change — so you can fix it before your users notice.
> `[Start free] [View docs]`

**Option 3: The Verb Stack (à la Vercel)**
> # Watch. Detect. Adapt.
> API change detection for developers who ship fast and sleep well.
> `[Get started — free]`

**Option 4: The Emotional**
> # Sleep well. Your APIs are watched.
> Chirri monitors your API dependencies and chirps when something changes. Simple. Precise. Calm.
> `[Start monitoring — free]`

**Option 5: The Direct**
> # Know when APIs change.
> Add an endpoint. We'll check it every minute. If the response changes, you'll know.
> `[Try free]`

**Recommended: Option 1.** It's the most distinctively Chirri — calm, factual, slightly poetic. Option 5 as the fallback if testing shows developers prefer ultra-direct.

### 5.2 How It Works

> ## Three steps. One minute.
>
> **1. Add an endpoint**
> Paste any API URL. Set your check interval — every minute, every hour, whatever you need.
>
> **2. Chirri watches**
> We call your endpoint on schedule and compare each response to the last. Schema changes, new fields, removed fields, value shifts — we catch it all.
>
> **3. Get notified**
> Slack, email, webhook — your choice. See exactly what changed with a clean diff view. No noise, just signal.

### 5.3 Pricing Page

> ## Simple pricing. No surprises.
>
> Every plan includes the same features. You're only paying for scale.

| | **Hobby** | **Pro** | **Team** |
|---|---|---|---|
| Price | **Free** | **$9/mo** | **$29/mo** |
| Endpoints | 3 | 25 | 100 |
| Check interval | Every 30 min | Every 1 min | Every 1 min |
| Notifications | Email | Email, Slack, Webhooks | Email, Slack, Webhooks, PagerDuty |
| History | 7 days | 90 days | Unlimited |
| Team members | 1 | 1 | 10 |
| | [Start free] | [Start trial] | [Start trial] |

> **Need more?** Enterprise plans with custom SLAs, SSO, and unlimited endpoints. [Talk to us →]

**Below pricing:**
> No credit card required for free tier. Upgrade or cancel anytime. We don't do annual lock-ins.

### 5.4 Why Chirri?

> ## Why Chirri?
>
> **You depend on APIs you don't control.**
> Stripe, Twilio, OpenAI, GitHub — your product is built on their APIs. When they change a response field, deprecate an endpoint, or shift their schema, your integration breaks. Usually silently.
>
> **Existing tools weren't built for this.**
> Uptime monitors check if an API is *up*. Chirri checks if an API has *changed*. That's a different problem — and one that's caused you production incidents before.
>
> **Simple by design.**
> No 47-tab dashboard. No YAML configuration files. No "contact sales." Paste a URL, pick an interval, choose where to get notified. Done.
>
> **Built for developers, priced for humans.**
> Free tier that's actually useful. Paid plans starting at $9/mo. This is a tool, not a platform — it does one thing and does it well.
>
> **The cricket chirps.**
> In Japan, crickets are kept for their song — a gentle, persistent alert that something has changed in the environment. Chirri does the same for your APIs. Not a siren. Not a klaxon. A chirp.

### 5.5 Social Proof Section (future)

> ## Developers who sleep better.
>
> [Testimonial cards — aim for recognizable indie devs, open source maintainers, small team leads]

### 5.6 Final CTA

> ## Start watching your APIs.
> Free. No credit card. Takes 30 seconds.
> `[Create your first monitor →]`

---

## 6. Brand Summary

| Element | Decision |
|---------|----------|
| **Tagline** | APIs change. We'll let you know. |
| **Short tagline** | Know when APIs change. |
| **Voice** | Calm, precise, warm, minimal, observant |
| **Primary color** | Sakura pink `#FFB7C5` |
| **Background** | Snow `#FAFAFA` / Night `#0F0F0F` |
| **Text** | Ink `#1A1A1A` |
| **Font** | Inter (headings + body), JetBrains Mono (code) |
| **Logo** | Chirp Wave — single sound wave mark |
| **Illustration** | Line art, cherry blossom petals, generous whitespace |
| **Positioning** | Simple, developer-first, affordable, API-specific |
| **Competitors** | changedetection.io (complex/ugly), UptimeRobot (wrong problem), Datadog (expensive/enterprise) |
| **Unique angle** | Only tool purpose-built for API *change* detection (not uptime) |

---

## Appendix: Name Pronunciation Guide

**Chirri** — pronounced "CHEE-ree" (チリ)
Rhymes with "cheery." Two syllables. Easy for English speakers.

The name comes from the Japanese onomatopoeia for a cricket's chirp (チリチリ / chiriri). In Japanese culture, crickets are appreciated for their song — a natural, gentle alert system. The cricket doesn't panic. It simply lets you know.

---

*Last updated: March 2026*
*Document owner: Brand & Marketing*

---

## Dashboard & Visual Metaphor — The Chirri Garden *(Added 2026-03-24 — Alex Direction)*

### The Tree Metaphor

Each monitored domain/provider is visualized as a tree:
- **Trunk** = the domain/provider (stripe.com)
- **Branches** = user's monitored endpoints (/v1/charges, /v1/customers)  
- **Roots** = discovered bonus sources (changelog, OpenAPI spec, status page, SDK) — hidden underground, feeding intelligence upward
- **Blossoms/Chirps** = alerts (sakura petals appearing when something needs attention)

### MVP Dashboard (Clean & Functional)

NOT the animated tree. Clean tree-view layout:
```
stripe.com
├── /v1/charges (your endpoint) ── ● healthy
├── /v1/customers (your endpoint) ── ● healthy  
│
├─ 🔗 changelog ──────── ○ silent
├─ 🔗 openapi spec ───── ○ silent  
├─ 🔗 status page ────── ○ silent
└─ 🔗 npm: stripe ────── ○ silent
```

**Status dots:**
- ● green = healthy, no changes
- ● yellow = change detected  
- ● red = breaking change / down
- ○ grey = silent bonus source (no alerts)
- ○ pulsing = bonus source detected something relevant (smart chirp)

**Lines subtly pulse** when data flows — minimal liquid/signal animation. NOT a full WebGL tree.

**The zen is in the restraint.** Linear doesn't animate. Stripe doesn't animate. Whitespace, pink accents, simplicity.

### Roots Are Undeletable
Bonus sources (roots) can be MUTED (go grey) but not deleted. "You can't rip out the roots of a tree." They're structural — they feed the early warning intelligence. Always sensing, even when silent.

### Landing Page Hero — Animated Japanese Tree

**Save the full animated sakura tree for the LANDING PAGE hero, not the dashboard.**

Concept: A blooming Japanese cherry tree that represents your API dependencies.
- Starts healthy and full of blossoms
- As breaking changes approach, petals start falling
- Deprecation signals make branches yellow/bare
- If nothing is done, the tree fades and wilts
- When the user migrates/fixes → tree blooms again

This is a MARKETING animation, not a dashboard feature. Shows the product story in 5 seconds without reading anything. Could be:
- Landing page hero (WebGL/Three.js or Lottie animation)
- Social media promo video
- Product Hunt launch GIF

### V2+ Skin: "Chirri Garden View" 🌸

Premium/paid users can toggle an animated garden dashboard:
- Each domain is a living tree
- Trees grow over time (more data = bigger tree)
- Health reflected in tree state (blooming vs wilting)
- Sakura petals fall when chirps fire
- Full interactive garden of all their monitored providers

This is a fun easter egg / premium feature, NOT the default dashboard. Toggle: "Switch to Garden View 🌸"
