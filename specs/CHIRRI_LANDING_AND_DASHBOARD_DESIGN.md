# Chirri Landing Page & Dashboard Design

> **Version:** 2.0
> **Design team:** HANA (visual), REN (interaction), SORA (systems), YUKI (brand/copy)
> **Date:** 2026-03-25
> **Status:** Design review -- awaiting Alex approval before build
> **Design system:** Kyoto Studio (CHIRRI_DESIGN_SYSTEM_FINAL.md)
> **Copy rules:** CHIRRI_COPYWRITING_GUIDE.md -- no AI slop, no emojis

---

## Design Principles (Summary)

These guide every decision in this document:

1. **The calm is the statement.** Every other monitoring tool shouts. Chirri breathes.
2. **Ma (negative space) is content.** Sections are separated by silence. Generous space is not wasted space.
3. **Kanso (simplicity) structures the copy.** If it sounds like a pitch deck, it's wrong. Quiet confidence, not persuasion.
4. **Mono no aware (beauty of impermanence) drives emotion.** APIs change. That's the nature of software. Chirri helps you flow with it.
5. **Show late, not early.** The product reveals itself gradually. The page is a journey from stillness to detail.

---

# PART 1: LANDING PAGE

Total sections: 7 content sections + sticky nav + footer. Estimated page length: 5-6 viewport heights. Deployed as a static Astro site at `chirri.io`, separate from the dashboard SPA.

The page should feel like walking into a quiet Japanese garden. Not like opening a SaaS website.

---

## Section 1: Hero (Full Viewport)

### Layout

Full viewport height (100vh). Centered composition on Kinari (#FAF7F2) background with washi paper grain texture at 3% opacity. Content vertically and horizontally centered. Max content width: 640px.

3-5 sakura petals drift subtly across the viewport using the `petal-drift` animation from the design system. This is ONE of only TWO places petals appear on the entire page. Petals use `signal-petal` (#D4A0A7) at 40-70% randomized opacity, 16-24px size, 5-8s duration each. Respects `prefers-reduced-motion`.

The hero is almost empty. That emptiness is the design.

### Content

**Wordmark:**
- "chirri" in Noto Serif JP 400, text-3xl (52px), tracking-tight (-0.02em), text-primary (#2C2825)
- Lowercase. Centered.
- This is the first thing the eye finds. It sits in space.
- Margin-bottom: space-10 (40px)

**Descriptor:**
- Text: "your apis change. we tell you what happened and what to do."
- Font: Inter 400, text-md (17px), line-height 1.6, text-secondary (#6B6560)
- Lowercase. Centered. Max-width: 440px.
- This is not a sales pitch. It is a description. Like the sign outside a tea house.
- Why this line: It names the problem (APIs change), states what Chirri does (tells you what happened), and adds the differentiator (and what to do). Two sentences. No adjectives.
- Rejected alternatives:
  - "api change intelligence for developers" -- too category-label, sounds like a Gartner quadrant
  - "we watch your api dependencies so you don't get surprised" -- too many words, "surprised" is vaguely dramatic
  - "know when apis break" -- too punchy, too pitch-deck, implies only breakage not all changes

**CTA:**
- Text: "start monitoring"
- Cha-nezumi button: bg #A28C73, text white, 15px/600, radius-sm (3px), padding 12px 28px, height 44px
- Hover: #8A7461, Active: #7A6451
- Single button. Centered. No secondary CTA. No "see how it works." One path.
- Margin-top: space-8 (32px)

**Nothing else.** No product screenshot. No trust badges. No social proof. No eyebrow text. No subheadline below the subheadline. Just the wordmark, one sentence, one button, and petals drifting through warm white space.

### Responsive

- Desktop (>=1024px): As described. 100vh.
- Tablet (768-1023px): Same layout. Wordmark drops to text-2xl (36px).
- Mobile (<768px): Same layout. Wordmark drops to 32px. Descriptor max-width 100% with 24px horizontal padding. Petal count reduces to 2.

---

## Section 2: The Concept

### Layout

Background: Kinari (#FAF7F2). Max content width: 640px, centered. Vertical padding: space-24 (96px) top and bottom.

This section is brief. 2-3 sentences. It adds one layer of detail to the hero without overwhelming.

### Content

**Text block (no section label, no heading):**

"you depend on apis you don't control. when stripe changes a field name, or openai deprecates a model, or aws rotates an auth flow -- you find out when your code breaks. chirri watches the docs, changelogs, and specs for your dependencies. when something changes, you get the diff, a plain-english summary, and a checklist of what to update."

- Font: Inter 400, text-base (15px), line-height 1.7, text-primary (#2C2825)
- Max-width: 560px, centered
- Lowercase throughout.
- No heading above this. The text IS the section. It arrives after the emptiness of the hero like a quiet explanation.

**Simple flow diagram below the text:**

```
  [your api endpoint]  -->  [chirri]  -->  [what changed + what to do]
```

- Rendered as three text labels connected by thin arrows (1px, #D4CEC6)
- Labels: JetBrains Mono 400, text-sm (13px), text-secondary (#6B6560)
- Arrows: Simple right-pointing lines, not decorative
- Centered. Margin-top: space-10 (40px).
- This is a diagram, not an illustration. Minimal. Functional.

### Responsive

- Desktop/Tablet: As described
- Mobile: Flow diagram stacks vertically (top to bottom arrows instead of left to right). Text has 24px horizontal padding.

---

## Section 3: How It Works

### Layout

Background: Kinari (#FAF7F2). Max content width: 640px, centered. Vertical padding: space-24 (96px) top and bottom.

Three statements. Not "Step 1, Step 2, Step 3." Not numbered circles. Not a horizontal layout in cards. Just three quiet statements, each with generous vertical space between them.

### Content

**Statement 1:**
- Text: "add an api endpoint."
- Font: Noto Serif JP 400, text-xl (26px), text-primary (#2C2825)
- Subtext: "paste any url. chirri classifies it automatically -- rest, graphql, webhook, status page."
- Font: Inter 400, text-base (15px), text-secondary (#6B6560), margin-top space-2 (8px)
- Max-width: 480px. Left-aligned within the centered container.
- Margin-bottom: space-16 (64px)

**Statement 2:**
- Text: "we find the docs, changelog, and status page."
- Same typographic treatment as Statement 1.
- Subtext: "openapi specs, sdk releases, deprecation notices. discovered automatically for your dependency."
- Margin-bottom: space-16 (64px)

**Statement 3:**
- Text: "when something changes, you know first."
- Same typographic treatment.
- Subtext: "diff view, plain-english summary, impact analysis, and migration steps. delivered to slack, email, or webhook."
- No bottom margin (section padding handles it).

**No mini visuals, no mockups, no icons.** The statements stand alone. Each one occupies vertical space like a line of calligraphy with room to breathe. The product screenshots come later -- this section earns patience.

### Responsive

- All breakpoints: Same single-column layout. Statement headings drop to text-lg (20px) on mobile. 24px horizontal padding on mobile.

---

## Section 4: The Product (The Reveal)

### Layout

Full-width section. Background: Shironeri (#F3EEE8) for contrast. Vertical padding: space-24 (96px) top and bottom.

This is the first time the visitor sees what Chirri looks like. After three sections of text and space, the product appears. It should feel like a reveal -- the curtain drawing back.

### Content

**No section label. No heading above the screenshot.** The screenshot speaks for itself.

**Screenshot:**
- Full Change Detail View screenshot
- Shows a real-looking detected change: Stripe Prices API field rename (`amount` to `amount_in_cents`)
- The screenshot includes:
  - Severity dot (not word) -- the orange Kaki dot for "High"
  - Provider name and change summary
  - The diff view with green/red highlighting
  - The impact analysis panel (expanded, showing "what changed" and "what to do")
  - Part of the migration checklist
  - The action bar (Track / Dismiss / Snooze / Resolve)
- Screenshot sits in a Gofun white (#FFFFFF) card with border 1px #E8E2DA, radius-lg (10px), shadow-warm-xl
- Max-width: 1060px, centered

**Light/dark toggle:**
- Small toggle below the screenshot, centered: two small circles (one Kinari fill, one Kuro-cha fill) with a 1px border
- Clicking swaps the screenshot between light mode and dark mode versions
- Default: light mode
- The toggle is subtle -- almost missable. A detail for people who look closely.

**Caption below screenshot:**
- Text: "a real change chirri detected in the stripe api."
- Font: Inter 400, text-sm (13px), text-tertiary (#948E88)
- Centered, lowercase, margin-top space-6 (24px)
- One sentence. Not explaining the UI -- just stating what it is.

### Responsive

- Desktop: Full-width screenshot as described
- Tablet: Same, with 32px horizontal margin
- Mobile: Screenshot scrolls horizontally in a constrained container with subtle scroll indicator. Light/dark toggle hidden on mobile.

---

## Section 5: Features

### Layout

Background: Kinari (#FAF7F2). Max content width: 640px, centered. Vertical padding: space-24 (96px) top and bottom.

NOT a grid of cards with icons. A vertical list with generous spacing. Each feature is a name and one sentence. Nothing more. The detail lives in the product, not the landing page.

### Content

**Feature list:**

Each feature is a pair: name in serif, description in sans. Stacked vertically with space-12 (48px) between each pair.

**auto-discovery**
"paste a url. chirri finds the openapi spec, changelog, status page, and sdk releases for that dependency."
- Name: Noto Serif JP 400, text-lg (20px), text-primary (#2C2825), lowercase
- Description: Inter 400, text-base (15px), text-secondary (#6B6560), max-width 480px, margin-top space-2 (8px)

**impact analysis**
"not just 'field renamed.' what changed, how your integration breaks, and what to do about it."

**migration checklists**
"step-by-step fix guides for breaking changes. before/after code. check off steps as you go."

**dependency graph**
"see every api your app depends on and where the risk concentrates."

**mcp server**
"chirri exposes an mcp server. claude, cursor, and other ai tools can check for api changes mid-session."

**security flagging**
"tls changes, auth method switches, certificate rotations. flagged automatically, no configuration."

### Design Notes

- No cards, no borders, no backgrounds. Just text on the warm white page.
- The left-alignment within a centered narrow container creates an asymmetric, off-center feel (fukinsei).
- The generous vertical spacing (48px between features) is the ma principle -- the space IS content.
- A thin horizontal line (1px, #E8E2DA) separates each feature pair. The line extends the full width of the 640px container.

### Responsive

- All breakpoints: Same single-column layout. Feature names drop to text-md (17px) on mobile. 24px horizontal padding on mobile.

---

## Section 6: Pricing

### Layout

Background: Kinari (#FAF7F2). Max-width: 960px, centered. Vertical padding: space-24 (96px) top and bottom.

Four pricing cards in a row. Clean. No "Most Popular" badge. No annual/monthly toggle (show monthly only, with a note about annual). The simplicity IS the differentiator.

### Content

**Section heading:**
- Text: "pricing"
- Font: Noto Serif JP 400, text-xl (26px), text-primary (#2C2825), lowercase
- Centered. Margin-bottom: space-12 (48px).

**Pricing Cards:**

Four cards, equal width. Each card: Gofun white (#FFFFFF) bg, border 1px #E8E2DA, radius-md (6px), padding space-6 (24px), shadow-warm-sm.

No card gets special border treatment. No "recommended" highlighting. Let people choose.

| | Free | Solo | Team | Business |
|---|---|---|---|---|
| **Price** | $0 | $5/mo | $19/mo | $49/mo |
| **Endpoints** | 3 | 15 | 50 | 200 |
| **Check interval** | Every 24h | Every 6h | Every 1h | Every 15min |
| **Key features** | Basic diffs, email alerts | + Impact analysis, Slack | + Migration checklists, GitHub issues, priority support | + SSO, dedicated support, custom integrations |
| **CTA** | "start free" | "start trial" | "start trial" | "contact us" |

- Tier name: Inter 600, text-md (17px), text-primary, lowercase
- Price: Inter 600, text-2xl (36px), text-primary
- "/mo" suffix: Inter 400, text-sm (13px), text-tertiary
- Endpoints: Inter 500, text-base (15px), text-primary
- Check interval: Inter 400, text-sm (13px), text-secondary
- Features: Inter 400, text-sm (13px), text-secondary, one feature per line, space-1 (4px) gap
- CTA: All secondary (outlined) buttons except Free which uses the Cha-nezumi primary. All lowercase text.
- CTA dimensions: Full width of card, height 40px, Inter 600, 15px

**Note below cards:**
- Text: "14-day free trial on paid plans. no credit card required. annual billing saves 20%."
- Font: Inter 400, text-sm (13px), text-tertiary (#948E88)
- Centered, margin-top space-8 (32px). Lowercase.

### Responsive

- Desktop (>=1024px): 4-column row
- Tablet (768-1023px): 2x2 grid, space-4 (16px) gap
- Mobile (<768px): Vertical stack. Cards full width. 24px horizontal padding.

---

## Section 7: Final CTA

### Layout

Background: Kinari (#FAF7F2). Full width. Vertical padding: space-24 (96px) top and bottom. Centered content.

The page ends as it began -- with space and quiet.

### Content

**Wordmark:**
- "chirri" in Noto Serif JP 400, text-2xl (36px), text-primary (#2C2825)
- Centered. Lowercase. Echoes the hero. Full circle.
- Margin-bottom: space-6 (24px)

**CTA:**
- Text: "start monitoring"
- Cha-nezumi primary button (same as hero)
- Centered.
- Margin-bottom: space-4 (16px)

**Subtext:**
- Text: "free plan. no credit card. set up in 30 seconds."
- Font: Inter 400, text-sm (13px), text-tertiary (#948E88)
- Centered. Lowercase.

**Fallen petal:**
- A single fallen petal illustration. Static, not animated. 20px, #D4A0A7 at 40% opacity, rotated ~30 degrees.
- Position: 24px below the subtext, offset 16px left of center (fukinsei)
- This is the ONLY petal outside the hero. It has landed. The journey is complete.
- This is the mono no aware moment: the falling is over, the petal rests.

### Responsive

- All breakpoints: Same layout. Wordmark drops to text-xl (26px) on mobile.

---

## Footer

### Layout

Background: text-primary (#2C2825). The only dark section on the page. Vertical padding: space-8 (32px).

Minimal. Not a navigation hub. Just the essentials.

### Content

**Single row:**

Left: "chirri" wordmark in Noto Serif JP 400, 16px, text-inverse (#FAF7F2). Lowercase.

Center: Links in a single horizontal row, separated by middots.
- Links: docs / pricing / changelog / github / twitter / contact
- Style: Inter 400, text-sm (13px), Hai (#A6A09A), hover: #FAF7F2. Lowercase.

Right: (empty on desktop, or year)

**Bottom text:**
- Text: "made by developers."
- Font: Inter 400, text-xs (11px), text-tertiary dark mode (#7A756F)
- Centered, margin-top space-6 (24px)
- Three words. Not "Built with care by developers who got tired of checking APIs manually." Just: made by developers. Period.

**Divider:** 1px border-top #3D3935 between links and bottom text. Padding space-4 (16px).

### Responsive

- Desktop: Single-row links next to wordmark
- Tablet: Same
- Mobile: Wordmark centered top. Links wrap to 2 rows. Bottom text centered below.

---

## Sticky Navigation

### Layout

Fixed to top of viewport. Height: 48px (not 56 -- slimmer, less intrusive). Background: Kinari (#FAF7F2) with backdrop-filter blur(8px) when scrolled. Border-bottom: 1px #E8E2DA when scrolled (hidden at top of page).

Appears after user scrolls past the hero (intersection observer on hero section). Before that, the hero stands alone with no navigation visible.

### Content

- Left: "chirri" wordmark (Noto Serif JP 400, 15px, text-primary, lowercase)
- Right: "log in" (ghost text link, Inter 500, text-sm, text-secondary) + "start monitoring" (small Cha-nezumi button, Inter 600, 13px, padding 6px 16px, height 28px)

No center nav links. No "Features", "Pricing", "Docs" links. The page is short enough that people can scroll. Fewer elements = more calm.

### Responsive

- Desktop/Tablet: Wordmark left, buttons right
- Mobile: Wordmark left, single "start monitoring" button right (log in moves to hamburger overlay)

---

## Landing Page: Design Notes

### What this page does NOT have (and why)

| Omitted Element | Why |
|---|---|
| Product screenshot in hero | The calm IS the statement. The screenshot comes later as a reveal. |
| Trust bar / logo carousel | Pre-launch, we have no logos to show. Post-launch, add below Section 2 if needed. |
| "How it works" numbered steps | Three quiet statements replace the SaaS playbook layout. |
| Feature cards / bento grid | A vertical list with space says more than cards with icons. |
| Social proof / testimonials | Add when real. Never fake it. Reserved space: between Features and Pricing. |
| FAQ section | Save for docs. The landing page is not an information dump. |
| Annual/monthly pricing toggle | Show monthly. Note annual savings. One less interaction. |
| Two CTAs in hero | One path. One button. Simplicity. |
| Eyebrow text ("now in beta") | Unnecessary. If people ask, they'll find out. |

### What to add post-launch

When real data exists, insert these:

1. **Trust signal** (between Section 2 and Section 3): A single line -- "watching 12,847 api endpoints this week" -- in Inter 400, text-sm, text-tertiary. Centered. Nothing else. Specific numbers only.
2. **Testimonial** (between Section 5 and Section 6): One quote. One name. One company. In a clean card. When it's real, not before.
3. **Integrations row** (below Features): Small greyscale logos of Slack, Discord, GitHub, email. When integrations ship.

### Copy inventory (every word on the page)

Verify every piece of copy passes these checks:
- Read it aloud. Does it sound like a person talking, or a pitch deck?
- Is it lowercase? (Unless it looks wrong)
- No em dashes (use double hyphens or rewrite)
- No "unlock", "seamless", "powerful", "revolutionize", "leverage"
- No dramatic one-liner paragraphs
- Could you text this to a developer friend to explain Chirri? If not, rewrite.

### The emotional arc

```
Hero:         stillness. what is this?
Concept:      understanding. oh, it watches api dependencies.
How it works: clarity. three simple things happen.
Product:      revelation. this is what it looks like.
Features:     depth. here's what it can do specifically.
Pricing:      decision. what does it cost? (not much.)
Final CTA:    return to stillness. the wordmark again. a petal at rest.
```

The page breathes in (hero), expands (concept through features), and breathes out (pricing through final CTA). It's a single inhalation and exhalation.

---

# PART 2: DASHBOARD KEY SCREENS

All dashboard screens use the Kyoto Studio design system. The dashboard is a React SPA (Vite + React 19 + TanStack Query).

**Global Layout:** 200px sidebar (Shironeri #F3EEE8 bg, 1px #E8E2DA right border) + main content area (Kinari #FAF7F2 bg). Cards use Gofun white (#FFFFFF).

---

## Screen 1: Dashboard Home

### What It Is

The first thing a user sees after login. It should feel calm -- like opening a well-organized notebook, not a war room. The user should be able to answer "Is anything on fire?" in under 3 seconds, then "What changed recently?" in under 10.

### Layout

```
+--------+--------------------------------------------------+
|        |  STATS BAR                                        |
|  SIDE  |  [URLs] [Changes] [Forecasts] [Avg TTFB]         |
|  BAR   |                                                   |
|        +----------------------------+---------------------+
|        |  RECENT CHANGES            |  URL HEALTH          |
|  Logo  |                            |                      |
|  ---   |  [Change Card]             |  [URL row] [dot]     |
|  Dash  |  [Change Card]             |  [URL row] [dot]     |
|  URLs  |  [Change Card]             |  [URL row] [dot]     |
|  Chgs  |  [Change Card]             |  [URL row] [dot]     |
|  Fcast |  [Change Card]             |  [URL row] [dot]     |
|  Deps  |                            |                      |
|  ---   |  [View all changes ->]     |  [View all URLs ->]  |
|  Sett  |                            |                      |
|        +----------------------------+---------------------+
|        |                                                   |
|  (ma)  |  (empty space -- intentional breathing room)      |
|        |                                                   |
+--------+--------------------------------------------------+
```

### Sidebar

- Width: 200px
- Background: Shironeri (#F3EEE8)
- Border-right: 1px #E8E2DA
- Top: "Chirri" in Noto Serif JP 400, 18px, text-primary. Padding: 20px.
- Nav items: Inter 500, 15px, text-secondary (#6B6560), padding 10px 16px
- Active item: text-primary (#2C2825), 600 weight, 3px left border #A28C73, bg rgba(162,140,115,0.08)
- Hover: bg rgba(162,140,115,0.05), text text-primary
- Group labels: 11px, 600 weight, text-tertiary, tracking-wider, uppercase
- Group gap: 28px

**Nav structure:**
```
CHIRRI (logo)

MONITORING
  [o] Dashboard        (LayoutDashboard icon)
  [o] URLs             (Link2 icon)
  [o] Changes          (GitCompare icon)
  [o] Forecasts        (CloudSun icon)
  [o] Dependencies     (GitFork icon)

SETTINGS
  [o] Settings         (Settings icon)
  [o] Integrations     (Puzzle icon)

(empty space -- bottom 30% intentionally blank)

[Plan badge: "Free" or "Team"]
[User initial circle + name]
```

### Stats Bar

Four metric cards in a horizontal row. Each card:
- Background: Gofun white (#FFFFFF)
- Border: 1px #E8E2DA
- Radius: radius-md (6px)
- Padding: space-4 (16px)
- Shadow: warm-sm

Card contents:
- Label: Inter 400, text-xs (11px), text-tertiary (#948E88), tracking-wide
- Value: Inter 600, text-xl (26px), text-primary (#2C2825)
- Trend: Small arrow + percentage in text-sm (13px). Green (#4D7A4D Matsu) for down (fewer changes is good), red (#C43D3D Aka) for up

| Card | Label | Example Value | Trend |
|---|---|---|---|
| 1 | URLs Monitored | 23 | -- (no trend) |
| 2 | Changes This Week | 7 | +2 from last week (Kaki amber) |
| 3 | Active Forecasts | 2 | -- |
| 4 | Avg Response Time | 234ms | -12ms (Matsu green) |

Gap between cards: space-4 (16px). Full width of content area. Margin: space-8 (32px) bottom.

### Recent Changes Column (Left, ~60% width)

**Header:**
- Text: "Recent Changes"
- Font: Inter 600, text-lg (20px), text-primary
- "View all" link: Inter 500, text-sm, Kobicha (#7A6451), right-aligned
- Margin-bottom: space-4

**Change Cards (max 5):**

Each card:
- Background: Gofun white (#FFFFFF)
- Border: 1px #E8E2DA
- Left border: 3px solid [severity color from design system -- Aka/Kaki/Ukon/Matsu]
- Radius: radius-md (6px)
- Padding: space-4 (16px)
- Shadow: warm-sm
- Gap between cards: space-3 (12px)
- Hover: border shifts to #D4CEC6, shadow warm-md

Card contents:
```
[Severity dot 8px] [Severity badge] Provider Name: Change Summary (1 line, truncated)
[Source type pill]  Detected: 2h ago  [Workflow state badge if not "new"]
```

- Severity badge: 11px/600 Inter, pill shape, colors per design system severity
- Source type pill: 11px Inter 400, bg Torinoko (#EBE5DC), text Nibi (#6B6560), radius-sm
- Timestamp: Inter 400, text-xs (11px), text-tertiary
- Clicking a card navigates to `/changes/:id`

If a change has a chirp indicator (new, unread), show the signal-petal-deep (#C87680) 8px dot with the chirp-pulse animation. This is the ONLY animation on the dashboard.

### URL Health Column (Right, ~40% width)

**Header:**
- Text: "Monitored URLs"
- Same style as Recent Changes header
- "View all" link right-aligned

**URL Health List:**

Compact rows inside a single card (Gofun white, border, radius-md, padding space-4):

Each row:
```
[Status dot 8px] [Provider icon] URL name (truncated)    Last check: 5m ago
```

- Row height: 44px
- Border-bottom: 1px #E8E2DA between rows (not on last)
- Status dot: Per design system -- Matsu green (healthy), Ukon amber (change detected), Aka red (error), Hanada blue pulsing (learning)
- Provider name: Inter 500, text-base, text-primary
- Timestamp: Inter 400, text-xs, text-tertiary, right-aligned
- Hover: row bg shifts to Torinoko (#EBE5DC)
- Click: navigates to `/urls/:id`

### Freshness Indicator

Top-right of the content area, inline with the page:
- When SSE connected: Green 6px dot + "Live" text, Inter 500, text-xs, Matsu (#4D7A4D)
- When disconnected: "Updated 30s ago" + refresh icon, text-tertiary

### Empty State (0 URLs)

When the user has no URLs monitored, the entire content area shows:

```
(centered, max-width 400px)

"No changes detected.
Watch a path to begin."

(Noto Serif JP 400, 17px, text-secondary -- haiku-like cadence)

(Single fallen petal SVG, 20x20px, #D4A0A7 at 60%, offset 8px left of center)

[Start monitoring] (Cha-nezumi primary button)

---

Or try a popular API:
[Stripe] [OpenAI] [GitHub] [Twilio]
(Ghost buttons, inline, Inter 500, text-sm)
```

Below the empty state, the public API feed widget shows real recent changes across popular APIs, in a dashed-border card with Torinoko (#EBE5DC) background to visually distinguish "not your data."

### Responsive

- Desktop (>=1024px): 2-column layout as described
- Tablet (768-1023px): Sidebar collapses to 64px (icons only, tooltips on hover). Content fills remaining width. 2-column maintained.
- Mobile (<768px): Sidebar hidden (hamburger menu). Stats bar becomes 2x2 grid. Recent changes and URL health stack vertically. Change cards full width.

### Design Tokens Used

| Token | Usage |
|---|---|
| bg-primary (Kinari #FAF7F2) | Main content background |
| bg-secondary (Shironeri #F3EEE8) | Sidebar background |
| bg-elevated (Gofun #FFFFFF) | Cards |
| text-primary (Kuro-cha #2C2825) | Headings, primary labels |
| text-secondary (Nibi #6B6560) | Descriptions, nav items |
| text-tertiary (Nezumi #948E88) | Timestamps, labels |
| action-primary (Cha-nezumi #A28C73) | Active nav border, primary buttons |
| border-subtle (#E8E2DA) | Card borders, dividers |
| severity-* | Change card left borders, dots |
| signal-petal-deep (#C87680) | Chirp notification dot |
| warm-sm, warm-md shadows | Card elevation |
| radius-md (6px) | Cards |
| space-4 (16px) | Card gap, padding |
| space-8 (32px) | Section gaps |

---

## Screen 2: Change Detail View

### What It Is

THE most important screen in the product. A user arrives here from a notification link, the changes feed, or the dashboard. They need to answer: "What changed? How bad is it? What do I do?"

This screen must work as a standalone entry point -- users often arrive from an email or Slack notification with no prior navigation context.

### Layout

```
+--------+----------------------------------------------------------+
|        | [< Back to Changes]                     [< Prev] [Next >] |
| SIDE   |                                                           |
| BAR    | [Severity dot] [HIGH badge] Stripe Prices API:            |
|        | Field 'amount' renamed to 'amount_in_cents'               |
|        | Source: OpenAPI Spec | Detected: 2h ago | Conf: 95%       |
|        |                                                           |
|        +----------------------------------------------------------+
|        | ACTION BAR                                                 |
|        | [Track] [Dismiss] [Snooze v] [Resolve]  [Copy MD] [Issue] |
|        +----------------------------------------------------------+
|        |                                                           |
|        | IMPACT ANALYSIS (expandable)                               |
|        | [red dot] Breaking Change                                  |
|        | The `amount` field has been renamed to `amount_in_cents`   |
|        | on POST /v1/prices.                                        |
|        | > What changed (2 items)                                   |
|        | > How your integration breaks                              |
|        | > What to do                                               |
|        | > Code example (Node.js)                                   |
|        |                                                           |
|        +----------------------------------------------------------+
|        |                                                           |
|        | SUMMARY PANEL (sticky on scroll)                           |
|        | Stripe has renamed the `amount` field to                   |
|        | `amount_in_cents` and replaced the boolean `active`        |
|        | field with a string `status` field.                        |
|        |                                                           |
|        +----------------------------------------------------------+
|        |                                                           |
|        | DIFF VIEWER                                                |
|        | [Side-by-side | Unified]  [Expand All | Collapse]         |
|        |                                                           |
|        | LEFT (Before)           | RIGHT (After)                  |
|        | {                       | {                              |
|        |   "amount": 1000,      |   "amount_in_cents": 1000,    |
|        |   "active": true        |   "status": "active",         |
|        |                        |   "metadata": {},              |
|        | }                       | }                              |
|        |                                                           |
|        +----------------------------------------------------------+
|        |                                                           |
|        | SECURITY FLAGS (if applicable)                             |
|        | [shield] TLS Configuration Change                          |
|        | HSTS max-age reduced: 31536000 -> 86400                    |
|        |                                                           |
|        +----------------------------------------------------------+
|        |                                                           |
|        | MIGRATION CHECKLIST (if applicable)                        |
|        | [x] Step 1: Replace POST /v1/charges params                |
|        | [ ] Step 2: Update webhook handlers                        |
|        | [ ] Step 3: Update response parsing                        |
|        | Progress: 1/3 steps completed                              |
|        |                                                           |
|        +----------------------------------------------------------+
|        |                                                           |
|        | NOTES                                                      |
|        | [Textarea: Add a note...]                                  |
|        |                                                           |
|        | FEEDBACK                                                   |
|        | Was this a real change?                                    |
|        | [Real Change] [False Positive] [Not Sure]                  |
|        +----------------------------------------------------------+
```

### Header

- Back link: "< Back to Changes" -- Inter 500, text-sm, Kobicha (#7A6451). Goes to /changes with preserved filter state.
- Navigation: [Prev] [Next] ghost buttons in top-right for feed navigation
- Breadcrumbs: "Changes > Stripe: Field renamed" -- Inter 400, text-sm (13px), text-tertiary for path, text-primary for current

**Title area:**
- Severity dot: 8px, severity color per design system
- Severity badge: Design system severity badge component
- Title: Inter 600, text-xl (26px), text-primary
  - Format: "Provider Name: Change Summary"
- Metadata row: Inter 400, text-sm (13px), text-secondary
  - Source type pill + "Detected: 2h ago" + "Confidence: 95%"
  - Separator: " | " in text-tertiary

### Action Bar

Horizontal bar, bg Gofun white, border-top and border-bottom 1px #E8E2DA, padding 12px space-6 (24px). Sticky below the header when scrolling.

**Left group (workflow):**
- Track: Cha-nezumi primary button (if current state is "new"), otherwise secondary button
- Dismiss: Ghost button, Inter 500, text-secondary
- Snooze: Ghost button with dropdown chevron. Dropdown options: 1 week, 1 month, 3 months, specific date
- Resolve: Ghost button, text tinted Matsu green (#4D7A4D)

Active state (current workflow state) gets: bg Cha-nezumi subtle (#F0EBE3), text Kobicha (#7A6451), 600 weight

**Right group (actions):**
- Copy as Markdown: Ghost button with Copy icon
- Create Issue: Ghost button with ExternalLink icon. If issue exists: shows "[PROJ-42]" badge linking to external issue, bg #F0EBE3, text Kobicha

**Undo behavior:** On any workflow state change, show an undo toast for 10 seconds: "Change marked as Tracked. [Undo]" -- standard toast component with a shrinking progress bar and Undo text button in Kobicha.

### Impact Analysis Panel

Below the action bar. Card-style: Gofun white bg, border 1px #E8E2DA, radius-md, padding space-6.

- Impact level: Severity dot + "Breaking Change" (or "Deprecation", "Additive", "Docs-only") in Inter 600, text-md
- Summary text: Inter 400, text-base, text-primary, 2-3 lines
- Expandable sections (accordion, each with chevron-right rotating to chevron-down):
  - "What changed (2 items)"
  - "How your integration breaks"
  - "What to do"
  - "Code example (Node.js)"
- Each section: Inter 400, text-base, text-secondary when collapsed. Content uses text-primary.
- Code blocks in sections: JetBrains Mono, bg Torinoko (#EBE5DC), padding 16px, radius-sm
- Disclaimer: "AI-generated analysis" -- Inter 400, text-xs, text-tertiary, italic
- Feedback: "Was this helpful?" with thumbs up/down icons (ghost buttons)

**Free tier:** Shows "Analyze Impact" button instead of auto-generated analysis. Rate-limited to 5/month.

### Summary Panel

Below impact analysis. Sticky on scroll (pins to top of viewport with warm-md shadow when scrolled past).

- Background: Gofun white, border 1px #E8E2DA, radius-md, padding space-6
- LLM summary: Inter 400, text-base (15px), text-primary, max 3 paragraphs
- Affected endpoints: "Affects: /v1/prices, /v1/products" -- Inter 500, text-sm, as pills
- Recommended actions: Bullet list, Inter 400, text-base, text-primary
- Source link: "Detected in: OpenAPI Spec" with external link icon, Kobicha text
- View toggle: "Detailed diff" (default) | "Simple view" -- Kyoto Studio tab component

**Simple View mode** (alternative to Monaco diff):
```
Changes (4):
  [-] Removed: `amount` (integer, line 5)
  [+] Added: `amount_in_cents` (integer, line 5)
  [+] Added: `metadata` (object, line 8)
  [~] Changed: `active` (boolean) -> `status` (string, line 12)
```
JetBrains Mono, text-sm (13px). Removed lines: bg Aka (#C43D3D) at 10% opacity. Added: bg Matsu (#4D7A4D) at 10% opacity. Changed: bg Ukon (#A89030) at 10% opacity.

### Diff Viewer

The centerpiece. Uses Monaco DiffEditor.

- Container: Gofun white bg, border 1px #E8E2DA, radius-md, overflow hidden
- Controls above diff: Segmented toggle (Side-by-side | Unified) + (Expand All | Collapse Unchanged) -- both using Kyoto Studio tab/toggle components
- Monaco theme (light mode):
  - Editor background: #FFFFFF
  - Inserted text bg: Matsu (#4D7A4D) at 12% opacity
  - Removed text bg: Aka (#C43D3D) at 12% opacity
  - Inserted line bg: Matsu at 6% opacity
  - Removed line bg: Aka at 6% opacity
- Monaco theme (dark mode):
  - Editor background: Ro (#3A3632)
  - Same severity colors at adjusted opacity
- Font: JetBrains Mono 400, 13px, line-height 20px
- Minimap: enabled on desktop, disabled on tablet/mobile
- Gutter annotations: Small labels in text-tertiary next to changed lines: "field renamed", "field added", "type changed"

### Security Flags (conditional)

Only shown when the change has security_flags. Card-style, same as impact analysis.

- Red shield icon (Lucide Shield) + "SECURITY" badge: bg Aka at 10%, text Aka (#C43D3D), Inter 600, 11px
- Each flag:
  - Flag name: Inter 600, text-base, text-primary
  - Detail: Inter 400, text-sm, text-secondary
  - Compliance tags if present: Small pills "PCI-DSS", "SOC2" -- bg Torinoko, text Nibi

### Migration Checklist (conditional)

Only shown for deprecation/breaking changes. Card-style.

- Header: "Migration Checklist" -- Inter 600, text-lg
- Metadata: "Risk: Medium | Estimated effort: 2-3 hours | Deadline: September 1, 2026 (162 days)"
  - Inter 400, text-sm, text-secondary
  - Deadline in Kaki (#C47A3D) if < 90 days
- Steps: Interactive checkboxes (Kyoto Studio checkbox component)
  - Checked: Cha-nezumi fill
  - Step text: Inter 400, text-base, text-primary
  - Substep details: Inter 400, text-sm, text-secondary, indented
  - Code toggle per step: "Show code" expands before/after in JetBrains Mono, diff-highlighted
- Progress bar: thin (4px), bg Torinoko, fill Cha-nezumi, radius-full
- Disclaimer: "AI-generated -- verify steps against docs" -- Inter 400, text-xs, text-tertiary
- Source link: "Source: stripe.com/docs/payments/migration" -- Kobicha text with external link

### Notes Section

- Textarea: Kyoto Studio boxed input style, height 80px, font Inter 400, text-base
- Placeholder: "Add a note about this change..." in Hai (#A6A09A)
- Auto-saves on blur (debounced 500ms)

### Feedback Section

- Text: "Was this a real change?" -- Inter 500, text-sm, text-secondary
- Three ghost buttons inline: "Real Change" | "False Positive" | "Not Sure"
- Selected state: bg Cha-nezumi subtle (#F0EBE3), text Kobicha, 600 weight
- After selection: "Thanks for the feedback" replaces the buttons (fade transition)

### Responsive

- Desktop (>=1024px): Full layout as described. Side-by-side diff.
- Tablet (768-1023px): Sidebar collapsed. Unified diff (Monaco renderSideBySide: false). All panels full width.
- Mobile (<768px):
  - NO Monaco. Lightweight text diff (described above) with expandable hunks.
  - Page order: Action bar (sticky bottom) -> Summary -> Impact Analysis -> Lightweight diff -> "View full diff" toggle -> Security flags -> Migration checklist -> Notes/Feedback
  - Action bar becomes a sticky bottom bar (56px height, Gofun bg, border-top 1px #E8E2DA, shadow warm-md flipped): [Track] [Dismiss] [Snooze] [Resolve] as icon buttons with labels below

### Design Tokens Used

| Token | Usage |
|---|---|
| bg-primary (Kinari) | Page background |
| bg-elevated (Gofun) | All panels, cards |
| text-primary (Kuro-cha) | Titles, body text, code |
| text-secondary (Nibi) | Descriptions, metadata |
| text-tertiary (Nezumi) | Timestamps, disclaimers |
| action-primary (Cha-nezumi) | Active state buttons, checkboxes |
| action-primary-subtle (#F0EBE3) | Selected states, active workflow |
| action-primary-active (Kobicha #7A6451) | Text links, badges |
| severity-* | Left borders, dots, badges |
| severity backgrounds | Card tints for high/critical changes |
| action-danger (Tobi-iro) | Delete actions only |
| signal-petal-deep (#C87680) | Chirp dot if change is new/unread |
| border-subtle (#E8E2DA) | All borders |
| warm-sm, warm-md, warm-lg shadows | Card elevation hierarchy |
| radius-md (6px) | Cards, panels |
| radius-sm (3px) | Buttons, badges, inputs |
| JetBrains Mono | Diff viewer, code blocks, URLs |
| Noto Serif JP | Not used on this screen (it's functional, not brand) |

---

## Screen 3: Add URL Flow

### What It Is

The onboarding moment. A focused flow that takes the user from "I want to monitor this API" to "It's being watched" in under 30 seconds. The layout removes distractions -- no sidebar visible during this flow (centered, focused layout).

### Layout: Centered Flow

No sidebar during this flow (sidebar collapses to hidden). Content centered on the page, max-width 640px. Background: Kinari (#FAF7F2). Each step animates forward (slide-left transition, 200ms).

### Step 1: Paste URL

```
+----------------------------------------------------------+
|                                                           |
|  (64px top padding)                                       |
|                                                           |
|  What do you want to monitor?                             |
|                                                           |
|  +----------------------------------------------------+  |
|  | https:// [                                    ] [Add]|  |
|  +----------------------------------------------------+  |
|                                                           |
|  Or pick a popular API:                                   |
|  [Stripe] [OpenAI] [GitHub] [Twilio] [AWS] [Shopify]     |
|                                                           |
+----------------------------------------------------------+
```

**Heading:**
- Text: "What do you want to monitor?"
- Font: Noto Serif JP 400, text-2xl (36px), text-primary, centered
- Margin-bottom: space-8 (32px)

**URL Input:**
- Kyoto Studio boxed input style, full width of container
- Height: 48px (slightly larger than standard 40px for prominence)
- Leading label: "https://" in text-tertiary, fixed, non-editable
- Input: JetBrains Mono 400, 15px, text-primary
- Placeholder: "api.stripe.com/v1/prices" in Hai (#A6A09A)
- Focus: 2px border #A28C73
- Button: "Add" -- Cha-nezumi primary, integrated into the input field (right side)

**Quick-add buttons:**
- Label: "Or pick a popular API:" -- Inter 400, text-sm, text-secondary, margin-top space-6
- Buttons: Ghost/secondary style, Inter 500, text-sm, with greyscale provider icons (16px)
- Grid: flex-wrap, gap space-2 (8px)
- Clicking a quick-add fills the input and auto-submits

### Step 2: Classification Progress (animated)

Triggered immediately after URL submission. Shows real-time progress via SSE.

```
+----------------------------------------------------------+
|                                                           |
|  Analyzing api.stripe.com/v1/prices...                    |
|                                                           |
|  [*] URL pattern analysis                                 |
|  [*] Fetching response                                    |
|  [*] Content-Type detection                               |
|  [o] Structural analysis                (currently here)  |
|  [ ] Monitoring method selected                           |
|                                                           |
|  Estimated: 8s remaining                                  |
|                                                           |
+----------------------------------------------------------+
```

**Heading:**
- Text: "Analyzing [url]..."
- Font: Inter 600, text-lg (20px), text-primary
- URL portion in JetBrains Mono, text-secondary

**Checklist:**
- Each step is a row, height 36px
- Completed: Matsu green (#4D7A4D) filled check circle (16px) + Inter 500, text-base, text-primary
- In progress: Cha-nezumi (#A28C73) spinner (Lucide Loader2, animated rotate) + Inter 500, text-base, text-primary
- Pending: Circle outline in #D4CEC6, + Inter 400, text-base, text-tertiary
- Vertical connector: 1px #E8E2DA line between circles
- Transition: Each step fades from pending to in-progress to completed (300ms ease)

**Estimated time:**
- Text: "Estimated: Xs remaining" -- Inter 400, text-sm, text-tertiary
- Updates every second
- After 30s timeout: Show "Unknown content type, using hash comparison" and proceed

### Step 3: Discovered Sources

When classification completes and Chirri recognizes the provider:

```
+----------------------------------------------------------+
|                                                           |
|  [stripe icon] Stripe                                     |
|                                                           |
|  We found these intelligence sources:                     |
|                                                           |
|  [info banner, one-time, dismissable]                     |
|  "Chirri discovered additional sources that help detect   |
|   upcoming changes. They're silent unless something       |
|   affects your endpoint."                                 |
|                                                           |
|  [x] OpenAPI Spec -- schema changes        Alerts: [ON]  |
|      Checked at your plan interval                        |
|                                                           |
|  [x] Changelog -- new entries              Alerts: [OFF] |
|      Checked every 2 hours                                |
|                                                           |
|  [x] Status Page -- outages               Alerts: [ON]   |
|      Checked every 10 minutes                             |
|                                                           |
|  [x] stripe-node SDK -- new releases      Alerts: [OFF]  |
|      Checked every 6 hours                                |
|                                                           |
|  URL slots used: 1 of 25                                  |
|                                                           |
|  [Start Monitoring]                                       |
|                                                           |
+----------------------------------------------------------+
```

**Provider header:**
- Provider icon (greyscale, 24px) + name in Inter 600, text-xl, text-primary

**Info banner:**
- Gofun white bg, border 1px Hanada (#527090) left 3px, radius-md, padding space-4
- Text: Inter 400, text-sm, text-secondary
- Dismiss: X button, ghost, top-right
- Shows once per provider (localStorage `chirri-source-discovery-dismissed-{provider_id}`)

**Source rows:**
- Each source: Gofun white card, border 1px #E8E2DA, radius-md, padding space-4, margin-bottom space-3
- Checkbox: Kyoto Studio checkbox (Cha-nezumi checked state), all pre-checked
- Source name: Inter 500, text-base, text-primary
- Source description: Inter 400, text-sm, text-secondary
- Check frequency: Inter 400, text-xs, text-tertiary
- Alert toggle: Kyoto Studio toggle component (ON/OFF), right-aligned
  - OpenAPI Spec and Status Page default ON
  - Changelog and SDK default OFF

**URL slots indicator:**
- Text: "URL slots used: 1 of 25" -- Inter 400, text-sm, text-secondary
- If near limit: text turns Kaki (#C47A3D)
- If at limit: text turns Aka (#C43D3D) + "Upgrade to add more" link

**CTA:**
- "Start Monitoring" -- Cha-nezumi primary button, full width of container, height 48px, Inter 600, 15px

### Step 4: Success + Learning Progress

After clicking "Start Monitoring":

```
+----------------------------------------------------------+
|                                                           |
|  [check circle, Matsu green, 48px]                        |
|                                                           |
|  Monitoring started.                                      |
|                                                           |
|  Chirri is learning this endpoint's normal behavior.      |
|  Takes about 10 minutes.                                  |
|                                                           |
|  [==============--------------------------] 5/30 checks   |
|                                                           |
|  Live results:                                            |
|  [check] Check 1 -- 200 OK -- 142ms -- 14.2KB            |
|  [check] Check 2 -- 200 OK -- 138ms -- 14.2KB            |
|  [check] Check 3 -- 200 OK -- 156ms -- 14.3KB            |
|  [check] Check 4 -- 200 OK -- 141ms -- 14.2KB            |
|  [check] Check 5 -- 200 OK -- 144ms -- 14.2KB            |
|  [spin]  Check 6 running...                               |
|                                                           |
|  Volatile fields found: 3 (timestamps, request IDs)       |
|  Stable fields watching: 44                               |
|                                                           |
|  [View Dashboard]  [Add Another URL]                      |
|                                                           |
+----------------------------------------------------------+
```

**Success icon:** Matsu green (#4D7A4D) check circle, 48px, centered. Entrance: scale 0 -> 1, 300ms ease-enter.

**Heading:**
- "Monitoring started." -- Inter 600, text-xl (26px), text-primary
- Description: "Chirri is learning this endpoint's normal behavior. Takes about 10 minutes." -- Inter 400, text-base, text-secondary

**Progress bar:**
- Height: 8px, width 100%, bg Torinoko (#EBE5DC), fill Cha-nezumi (#A28C73), radius-full
- Text below: "5/30 checks" -- Inter 400, text-sm, text-tertiary
- Updates via SSE `check.completed` events

**Live results feed:**
- Each check result appears as a row (animated slide-in from bottom, 150ms)
- Completed: Matsu green check (14px) + "Check N -- [status] -- [TTFB] -- [size]"
  - Font: JetBrains Mono 400, text-sm (13px), text-secondary
- In progress: Cha-nezumi spinner + "Check N running..."
- Error: Aka red X + error message

**Volatile fields indicator:**
- "Volatile fields found: 3" -- Inter 400, text-sm, text-secondary
- "Stable fields watching: 44" -- Inter 400, text-sm, Matsu text

**CTAs:**
- "View Dashboard" -- Cha-nezumi primary button
- "Add Another URL" -- Secondary outlined button
- Side by side, centered, space-3 gap

**Post-learning completion:**

Progress bar fills to 100%. Feed stops. Summary replaces the live feed:

```
Learning complete.

47 fields detected.
3 volatile fields (ignored): timestamp, request_id, trace_id.
44 fields being watched for changes.

You're protected.

[View Dashboard]  [Add Another URL]
```

The first-chirp celebration (3 petals drifting across the viewport, 4 seconds) triggers the first time ANY user's monitor detects a change. Not here -- but the first time they view a detected change.

### Error States

| Error | Display |
|---|---|
| SSRF blocked | Red banner: "This URL points to a private network and can't be monitored. Chirri monitors publicly accessible URLs only." |
| Plan limit | Amber banner: "You've reached your URL limit (25/25). Upgrade to add more." + upgrade CTA |
| Duplicate | Info banner: "You're already monitoring this URL." + link to existing provider detail |
| Auth required | Inline form below URL input: header name dropdown + password-style value input + "Test Connection" button |
| Redirect | Inline options: "This URL redirects to [target]. Monitor the redirect target instead?" with 3-option picker |
| Classification timeout | Amber text: "Analysis took too long. Monitoring with basic hash comparison." + proceed to Step 4 |

### Responsive

- Desktop/Tablet: Centered flow, max-width 640px
- Mobile (<768px): Full width with 16px horizontal padding. Quick-add buttons wrap. Source cards stack. Progress feed scrolls. CTAs stack vertically, full width.

### Design Tokens Used

| Token | Usage |
|---|---|
| bg-primary (Kinari) | Page background |
| bg-elevated (Gofun) | Cards, source rows, info banner |
| text-primary (Kuro-cha) | Headings, checked steps |
| text-secondary (Nibi) | Descriptions, check details |
| text-tertiary (Nezumi) | Pending steps, estimates, frequencies |
| action-primary (Cha-nezumi) | Primary CTA, progress bar fill, checkboxes, spinners |
| action-primary-hover (Kitsune-cha #8A7461) | CTA hover |
| severity-low (Matsu #4D7A4D) | Success icon, completed check icons |
| severity-critical (Aka #C43D3D) | Error states |
| severity-high (Kaki #C47A3D) | Warning states, near-limit text |
| severity-info (Hanada #527090) | Info banner border |
| border-subtle (#E8E2DA) | Card borders |
| Noto Serif JP | Step 1 heading only |
| JetBrains Mono | URL input, live check results |
| radius-md (6px) | Cards |
| radius-sm (3px) | Buttons, inputs |
| warm-sm shadow | Cards |

---

# PART 3: DESIGN SYSTEM RECONCILIATION

## Note for Alex

The Frontend Bible (v1.3) and the Design System Final (Kyoto Studio, v1.0) have divergent token names and values. This design document uses **Kyoto Studio tokens exclusively**. Before Codex builds, the Frontend Bible's Part 1 (Design Language) should be updated to match Kyoto Studio. Key differences to reconcile:

| Aspect | Frontend Bible | Kyoto Studio (this doc) | Decision |
|---|---|---|---|
| Background | Snow #FAFAFA / Night #0F0F0F | Kinari #FAF7F2 / Kuro-nuri #2D2A26 | **Kyoto Studio.** Warm whites differentiate. |
| Primary accent | Sakura pink #FFB7C5 | Cha-nezumi brown #A28C73 | **Kyoto Studio.** Pink is signal only, not UI. |
| Danger color | Vermillion #EF4444 | Tobi-iro #6C3524 | **Kyoto Studio.** Warm red-brown, higher contrast. |
| Button style | Sakura bg, glassmorphic | Cha-nezumi bg, solid | **Kyoto Studio.** No glassmorphism in dashboard. |
| Text primary | Ink #1A1A1A | Kuro-cha #2C2825 | **Kyoto Studio.** Warm black. |
| Border radius | 4/6/8/12px | 3/6/10px | **Kyoto Studio.** Slightly tighter. |
| Type scale | 14px base | 15px base | **Kyoto Studio.** More breathing room. |
| Serif font | Noto Sans JP (decorative) | Noto Serif JP (display) | **Kyoto Studio.** Serif for headlines. |
| Dark mode | Cold blacks | Warm lacquer | **Kyoto Studio.** Warm dark always. |
| Severity colors | Standard web colors | Nature-derived (Aka, Kaki, Ukon, Matsu, Hanada) | **Kyoto Studio.** Cohesive palette. |

The Frontend Bible's Part 2-10 (component specs, pages, interactions, responsive, API mappings) remain valid and should be followed for behavior. Only Part 1 color/type tokens get replaced.

---

*"The stone garden is complete when there is nothing left to remove."*
*And then one petal falls.*
