# Chirri Visual Identity Exploration

> **Design team:** HANA (visual lead), REN (interaction), SORA (systems), YUKI (brand/copy)
> **Date:** 2026-03-24
> **Status:** Research complete — recommendation included

---

## The Core Tension

We've been ping-ponging between two bad options:
- **"Sakura Overload"** — too pink, too playful, reads as a lifestyle app
- **"Developer Grey"** — too cold, too corporate, could be any SaaS dashboard

Neither captures what Chirri actually is: a *warm, precise, Japanese-spirited developer tool*. The challenge is finding the identity that lives in the space between those poles — professional enough for enterprise, warm enough for a solo developer at 2am, and unmistakably *Chirri* in a screenshot.

---

## Direction A: "Sakura Zen" — Petals as the Identity

### The Premise
Cherry blossoms ARE the brand. Every surface, every state, every moment connects to sakura. But done the way luxury Japanese brands do it — not the way anime merchandise does it.

### Research: How Professionals Use Sakura

**Japan Airlines** names their premium lounges "Sakura Lounge" — the cherry blossom is their hospitality signature. But the lounges themselves are restrained: warm wood, clean lines, minimal decoration. The sakura is a *name* and a *feeling*, not a visual explosion.

**Shiseido** uses cherry blossom in their Ever Bloom Sakura line — but notice how: the packaging is predominantly white and rose-gold, with a single stylized petal rendered almost as calligraphy. It's not a field of flowers. It's one gesture.

**The Japanese ¥100 coin** has a cherry blossom on it. Government currency. The most "professional" use case imaginable. The blossom is rendered as a clean, geometric symbol — not a watercolor illustration.

**The key insight:** Professional sakura usage treats the blossom as a *symbol* (like a monogram) rather than an *illustration* (like a painting). It's reduced to its essence: five petals, a circle, a suggestion.

### Color Palette

| Role | Color | Hex | Japanese Name |
|------|-------|-----|---------------|
| Primary | Muted sakura | `#D4A0A0` | Sakura-nezumi (桜鼠) — "cherry grey" |
| Secondary | Warm cream | `#F5F0EB` | Shiro-neri (白練) — unbleached white |
| Accent | Deep rose | `#B5495B` | Enji (臙脂) — cochineal |
| Neutral dark | Charcoal brown | `#3C3A3A` | Keshizumi (消炭) — spent charcoal |
| Neutral mid | Warm grey | `#9B9595` | Nezumi (鼠) — mouse grey |
| Background | Paper white | `#FAF8F5` | Gofun (胡粉) — shell white |
| Success | Muted sage | `#7B9E7B` | Matcha (抹茶) |
| Warning | Warm amber | `#D4A843` | Kitsune (狐) — fox color |
| Error | Deep crimson | `#C04040` | Beni (紅) |
| Info | Dusty blue | `#7B8FA0` | Wasurenagusa (勿忘草) |

### Severity/Status
- **Dots** styled as simplified five-petal flowers at different fill levels: empty (info), quarter-filled (low), half (medium), full (high), glowing (critical)
- Risk: this could feel gimmicky in a data table with 200 rows

### Brand Moment
Petals are everywhere — background textures use a subtle sakura mon (family crest pattern), loading states show a petal unfurling, empty states show a branch.

### Form Controls
- Checkboxes: rounded squares with a single petal as the check mark
- Toggles: slide reveals a petal
- Radios: five-petal flower fills in

### Cards & Layout
- Cards have a very subtle sakura watermark at 3% opacity in the bottom-right
- Section dividers use a branch illustration instead of a line
- Risk: the watermark and branch illustration require custom artwork for every variant

### Navigation
- Sidebar has a branch motif running down the left edge
- Active state = petal icon + pink highlight
- Section headers use a small petal separator

### Diff View
- Added lines: very pale pink background (`#FDF0F0`)
- Removed lines: pale grey with line-through
- Changed tokens highlighted with sakura-pink underline
- Gutter uses petal icons for change markers

### Landing Page Hero
- Full-width illustration of a single cherry tree branch, minimal sumi-e style
- Petals drift slowly across the viewport
- Headline emerges from behind the branch

### Verdict from the Team

**HANA:** "It's beautiful in a mockup. But maintaining it is a nightmare — every component needs custom artwork. And in a dense dashboard with tables and diff views, the petal motifs compete with actual data."

**REN:** "The petal-as-checkbox-mark is clever exactly once. After 500 checkboxes, users will want a normal checkmark. Novelty ≠ usability."

**SORA:** "I need to ship a dark mode too. Every petal watermark, every branch divider, every custom illustration needs a dark variant. This multiplies the design surface by 3x."

**YUKI:** "The problem is semantic overload. When everything is a petal, nothing is a petal. The cherry blossom stops being special when it's also your checkbox, your loading spinner, your divider, and your background texture."

**Can petals work?** Yes, but not as the *whole identity*. They're too beautiful to waste on a checkbox.

---

## Direction B: "Ink & Stone" — Japanese Without Flowers

### The Premise
The Japanese aesthetic comes from *texture, space, and proportion* — not cherry blossoms. Inspired by karesansui (rock gardens), sumi-e (ink wash painting), washi (handmade paper), and the zen principle that beauty emerges from what you *remove*, not what you add.

### Research: Texture-Based Japanese Design

**Wabi-sabi in digital design** (from UX Planet, WebFX, Creative Market research): The core translation is *organic textures* in a digital context — subtle paper grain on backgrounds, slightly irregular edges, the warmth of natural materials rendered in CSS. Not "broken" or "aged" but *alive*.

**Karesansui (dry landscape gardens):** The power of a zen garden is that it's almost entirely empty. Raked gravel, a few stones, and your imagination does the rest. In UI terms: aggressive whitespace, very few elements per screen, and the ones that exist are perfectly placed.

**Sumi-e (ink painting):** Uses exactly one color (black ink, diluted to various greys) and relies on the *quality of the stroke* — thick/thin, wet/dry, fast/slow. Translation: a monochrome UI where hierarchy comes from weight and size rather than color. One accent color maximum.

**The "48 browns, 100 greys" of Edo:** When sumptuary laws banned commoners from wearing bright colors, Japanese artisans developed an extraordinary range of browns and greys — each with a poetic name. This is the precedent for a warm grey palette that has *more* depth than a colorful one.

### Color Palette

| Role | Color | Hex | Japanese Name |
|------|-------|-----|---------------|
| Primary | Warm indigo | `#3D5A6E` | Ai-nezumi (藍鼠) — indigo grey |
| Secondary | Stone warm | `#E8E2D9` | Suna (砂) — sand |
| Accent | Terracotta | `#C07850` | Tobi (鳶) — kite bird brown |
| Neutral dark | Ink black | `#2B2B2B` | Sumi (墨) — ink |
| Neutral mid | River stone | `#8A8580` | Rikyū-nezumi (利休鼠) |
| Background | Washi cream | `#F7F4F0` | Torinoko (鳥の子) — eggshell |
| Success | Moss green | `#6B8E6B` | Koke (苔) — moss |
| Warning | Persimmon | `#D08040` | Kaki (柿) — persimmon |
| Error | Ox blood | `#A03030` | Ebi-cha (海老茶) — shrimp brown |
| Info | Slate blue | `#607080` | Onando (御納戸) |

### Severity/Status
- **Ink weight:** Status communicated through the "thickness" of a left border on cards — thin hairline (info), medium (low), thick (medium), heavy slab (high), heavy + color (critical)
- The metaphor: a calligrapher's brush pressing harder = more urgency
- Clean, scalable, no custom artwork needed

### Brand Moment
- No petals, no flowers. Instead: the *quality of space*
- Loading state: an ink drop slowly diffuses in water (CSS animation, no images)
- Empty states: a single rock in a field of raked gravel (SVG, very minimal)
- Transitions use an ink-wash dissolve effect

### Form Controls
- Checkboxes: crisp squares with a bold ink stroke as the check (like a calligrapher's mark)
- Toggles: rectangular, sliding with an ink-stone-like knob
- Radios: enso (zen circle) fills in with ink

### Cards & Layout
- Cards sit on a background with very subtle washi paper grain (CSS noise at 2-3% opacity)
- Generous padding (the "ma" principle — negative space IS the content)
- No rounded corners — or very slight rounding (2px). Angular = architectural.
- Dividers are barely-visible hairlines or just space
- Layout uses asymmetric column widths (fukinsei) — sidebar isn't equal to content

### Navigation
- Vertical nav with bold, sparse items — lots of space between entries
- Active state = thick left border (like a brush mark on the edge)
- Typography-driven: the nav label IS the design element, no icons needed

### Diff View
- Added: warm cream background with indigo text
- Removed: slightly darker stone background with line-through
- Changed tokens: thick underline in terracotta accent
- Gutter: simple line numbers in lighter ink, clean hairline separator

### Landing Page Hero
- Full white/cream page with massive typography
- One accent element: a large enso circle, imperfect, brush-stroked
- Headline sits inside the negative space of the enso
- Minimal, typography-forward — the restraint IS the statement

### Verdict from the Team

**HANA:** "This is the most sophisticated direction. It photographs beautifully for case studies. But honestly — in a lineup of developer tools, would someone recognize this as Chirri? Or would they think it's any minimalist design system?"

**REN:** "The ink-weight severity system is genuinely good UX. I want to keep that regardless of which direction we go. But the no-color approach means colorblind accessibility is great... and everyone-else accessibility is harder (relying on thickness alone)."

**SORA:** "This is the most buildable direction. CSS noise texture, simple shapes, no custom artwork. Dark mode is straightforward — just shift the warm greys cooler slightly. But... it's *too* buildable. Where's the spark?"

**YUKI:** "When I write marketing copy for 'Ink & Stone' Chirri, I struggle. 'A beautiful minimalist developer tool' is every dev tool's pitch. Without the sakura, what's the story? What's the hook that makes someone click?"

**Can petals work here?** They'd feel alien. This direction actively avoids ornament. A petal would look like a bug.

---

## Direction C: "Modern Kyoto" — Actual Japanese Design Principles

### The Premise
Stop asking "how do we make a Western UI look Japanese" and instead ask "what would a developer tool designed in Kyoto actually look like?" Use real design principles — ma, kanso, fukinsei, shibui — as structural decisions, not decoration.

### Research: The Seven Principles Applied to UI

From Presentation Zen's analysis and traditional aesthetic sources:

1. **Kanso (簡素) — Simplicity:** Not "minimal because minimal is trendy" but "simple because simplicity reveals truth." Every element must *earn* its place. A Chirri dashboard should show exactly the data you need, with nothing else. No decorative elements, no "nice to have" widgets.

2. **Fukinsei (不均整) — Asymmetry:** Western dashboards love symmetric grids. Japanese design embraces intentional imbalance. A sidebar that's narrow (200px) against a wide content area (1200px). A hero section where the text sits in the bottom-left third, not centered. Cards that aren't all the same size.

3. **Shibui (渋い) — Understated elegance:** "Beautiful by being precisely what it was meant to be and not elaborated upon." A button that is just the right size, the right weight, the right color — and nothing more. No gradients, no shadows, no hover animations unless they serve a purpose.

4. **Shizen (自然) — Naturalness without artifice:** The design should feel effortless. No "look at me, I'm designed" moments. The most "designed" thing about it should be that it doesn't feel designed — it just feels right.

5. **Yūgen (幽玄) — Suggestion over revelation:** Show more by showing less. A dashboard that doesn't show all 47 metrics at once but reveals them as you navigate. A diff view where context is collapsed by default — you see the changes, not the unchanged code.

6. **Ma (間) — Negative space as content:** The space between elements isn't "empty" — it's active. It creates rhythm, hierarchy, and breath. A Chirri card with 32px padding tells you "this content is precious." One with 8px says "this is crammed."

7. **Datsuzoku (脱俗) — Freedom from habit:** Breaking from convention in a purposeful way. Maybe the navigation isn't a sidebar OR a top bar — maybe it's a command palette that appears on hover. Maybe severity isn't shown with dots OR colors — maybe it's shown with the *position* of the element.

### The "Bento Grid" — A Real Japanese UI Pattern

Research on modern Japanese web design (2024-2025) reveals the **bento grid** as a dominant pattern: content arranged in asymmetric, modular compartments like a bento box. Unlike Western card grids (same-sized rectangles), bento grids use varied cell sizes to create visual hierarchy. Apple adopted this for their product pages. It's inherently Japanese — organized, beautiful, and each compartment has exactly the right proportion for its content.

**For Chirri:** The dashboard could use bento-style layout — the main diff view gets a large cell, severity summary gets a narrow tall cell, recent activity gets a wide short cell. Not a 3-column grid. A composed layout.

### Color Palette

| Role | Color | Hex | Japanese Name |
|------|-------|-----|---------------|
| Primary | Deep navy | `#2D3748` | Kon (紺) — deep indigo |
| Secondary | Warm ivory | `#F5F1EC` | Kinari (生成) — raw silk |
| Accent | Burnt orange | `#C46A3C` | Kitsune-iro (狐色) — fox |
| Neutral dark | Night | `#1A1A2E` | Yoru (夜) |
| Neutral mid | Clay | `#8C8478` | Rikyu-cha (利休茶) |
| Background | Raw paper | `#FAF7F2` | Kinu (絹) — silk |
| Success | Pine | `#4A7C59` | Matsu (松) — pine |
| Warning | Turmeric | `#D4A017` | Ukon (鬱金) |
| Error | Vermillion | `#D14836` | Shu (朱) |
| Info | Storm blue | `#5B7B94` | Hanada (縹) |

### Severity/Status
- **Position + weight:** Critical items rise to the top (not just colored red). The visual system communicates urgency through *placement* (datsuzoku — break from the norm of static lists)
- Color is secondary: a subtle left-border color hints at severity, but the primary signal is prominence
- In dense tables: a single character glyph in a monospace cell — `·` `▪` `■` `▰` `█` — using density/weight rather than color

### Brand Moment
- The brand IS the layout philosophy. When you see a Chirri screenshot, you recognize it by its *composition* — the bento grid, the generous space, the asymmetric navigation
- Like recognizing a Muji product: it's not the logo, it's the entire approach

### Form Controls
- Shibui: controls are exactly what they need to be. A checkbox is a clean square with a clean check. A toggle is a rectangle that slides. No flair.
- But the *spacing* around controls is generous. A form with 24px between fields instead of 12px. The space says "this matters."
- Focus states use a warm glow rather than a sharp blue outline

### Cards & Layout
- Bento grid: cards are different sizes based on content importance
- Fukinsei: the grid is intentionally asymmetric
- Ma: generous internal padding (24-32px) and gap between cards (16-24px)
- Cards have a very subtle warm shadow (not grey, but a tinted shadow that matches the background warmth)

### Navigation
- Narrow sidebar (180-200px) with lots of vertical space between items
- Current section indicated by a weight change (medium → bold) + subtle background
- Top of sidebar: the Chirri logo (small, restrained) + a Japanese-style horizontal rule
- Bottom of sidebar: minimal controls, lots of empty space

### Diff View
- Clean monospace with generous line-height (1.7 instead of typical 1.4)
- Added: very subtle warm green left border, text at full weight
- Removed: text at reduced opacity (0.5) with hairline strikethrough
- Context: lighter text weight, collapsible
- The diff view has more vertical padding than any competitor — it *breathes*

### Landing Page Hero
- Asymmetric layout: large headline top-left, supporting text bottom-right
- Massive negative space in the center
- The space itself creates tension and interest
- One small, beautiful detail: the Chirri name rendered in a calligraphic style

### Verdict from the Team

**HANA:** "This is the smartest direction — it's Japanese at the *structural* level, not the decorative level. But I worry it's too subtle. A designer will appreciate the bento grid and the ma. A developer might just see 'clean UI with good spacing.'"

**REN:** "The interaction principles are excellent. Severity-by-position is innovative. But it needs one visual hook — one thing you can point to and say 'that's Chirri.' Right now it's an philosophy, not a brand."

**SORA:** "Technically elegant. Bento grids are CSS Grid, which we're using anyway. The spacing scale is just tokens. But 'the brand is the layout' means every new page needs careful composition, not just dropping components into a template."

**YUKI:** "I can write incredible copy for the *philosophy* — 'designed with ma, built with kanso.' But on a product hunt launch page, we need a screenshot that pops. Right now Direction C screenshots would look... good. Not remarkable."

**Can petals work here?** Actually, yes — but only as a *datsuzoku* moment. A break from restraint. One petal in one place, because you've earned it through all the restraint everywhere else.

---

## Direction D: "Kyoto Studio" — The Recommended Hybrid

### C + B + Petals as Earned Accent

**YUKI's framing:** *"The dashboard is the stone garden. The petal is the single cherry blossom that falls into it."*

This is Alex's instinct, and it's right. Here's why it works:

### The Philosophy

The product — dashboard, settings, tables, forms, diff views — is designed with **Modern Kyoto** principles (Direction C). Warm textures and space, not cold minimalism. Bento layouts. Generous ma. Fukinsei asymmetry. Every element earns its place (kanso). Controls are understated (shibui).

The *texture* comes from **Ink & Stone** (Direction B). Washi paper grain on backgrounds. Warm greys instead of cold ones. Ink-weight borders for severity. The feeling of natural materials in a digital space.

And **petals** are the *one* celebratory, magical moment. They appear:
- When a chirp fires (a single petal drifts across the notification)
- On the landing page hero (sparse, floating, atmospheric)
- In the loading state (one petal, slowly rotating)
- On the empty state (a single fallen petal at the bottom of the empty container)
- *Nowhere else*

Petals are NOT used for: checkboxes, backgrounds, watermarks, navigation, severity, dividers, borders, patterns, or any functional UI. They are reserved for *moments of delight*.

This means that when a petal appears, it *means something*. It's a reward. A breath. A tiny poetic moment in a professional tool.

### Why This Works

1. **The 95/5 rule:** 95% of the time, Chirri is a warm, professional, beautifully-spaced developer tool. 5% of the time, a petal drifts by and reminds you this isn't just another dashboard.

2. **Scarcity creates value:** A petal that only appears when a chirp fires becomes a Pavlovian moment of delight. Users will associate the petal with "something just worked." That's powerful.

3. **It's the Japanese way:** In actual Japanese design, cherry blossoms are celebrated *because they're fleeting*. Hanami (cherry blossom viewing) works because the blossoms last only 1-2 weeks. A petal that's always there is just wallpaper. A petal that appears and disappears is *mono no aware* — the beauty of impermanence.

4. **It's achievable:** The base system is warm CSS with good spacing. No custom illustrations needed for every component. The petal is ONE animation, used in a few carefully chosen spots. A solo developer (or a small team) can build this.

---

### Complete Design Token System

#### Color Tokens

```
/* ═══════════════════════════════════════════════
   CHIRRI DESIGN TOKENS — "Kyoto Studio"
   Grounded in traditional Japanese color names
   ═══════════════════════════════════════════════ */

/* ── Foundation: Warm Neutrals ─────────────── */
/* Named from Japanese traditional color families */

--chirri-bg-primary:       #FAF7F2;  /* Kinari (生成) — raw silk, unbleached */
--chirri-bg-secondary:     #F3EEE8;  /* Shironeri (白練) — refined white */
--chirri-bg-tertiary:      #EBE5DC;  /* Torinoko (鳥の子) — eggshell */
--chirri-bg-elevated:      #FFFFFF;  /* Pure white, for cards that "float" */

/* ── Text ──────────────────────────────────── */
--chirri-text-primary:     #2C2825;  /* Kuro-cha (黒茶) — black tea */
--chirri-text-secondary:   #6B6560;  /* Nibi (鈍) — dull/muted */
--chirri-text-tertiary:    #9B9590;  /* Nezumi (鼠) — mouse grey */
--chirri-text-inverse:     #FAF7F2;  /* Kinari on dark backgrounds */

/* ── Brand ─────────────────────────────────── */
--chirri-brand-primary:    #3D5167;  /* Ai-iro (藍色) — indigo, deep and warm */
--chirri-brand-hover:      #2E3E50;  /* Kachi (勝色) — victory indigo */
--chirri-brand-subtle:     #E8EDF2;  /* Ai-jiro (藍白) — indigo white */
--chirri-brand-accent:     #C07856;  /* Tobi-iro (鳶色) — kite brown/terracotta */

/* ── The Petal ─────────────────────────────── */
/* Reserved for celebratory/accent moments ONLY */
--chirri-petal:            #D4A0A7;  /* Sakura-nezumi (桜鼠) — cherry grey */
--chirri-petal-soft:       #F0E0E3;  /* Usuzakura (薄桜) — pale cherry */
--chirri-petal-deep:       #B5495B;  /* Enji (臙脂) — cochineal crimson */
--chirri-petal-glow:       rgba(212, 160, 167, 0.15); /* For halos/glows */

/* ── Severity / Status ─────────────────────── */
/* Drawn from nature: each severity has a Japanese name */
--chirri-severity-critical: #C43D3D; /* Aka (赤) — red, urgency */
--chirri-severity-high:     #D47A3D; /* Kaki (柿) — persimmon */
--chirri-severity-medium:   #C4A43D; /* Ukon (鬱金) — turmeric */
--chirri-severity-low:      #5B8A5B; /* Matsu (松) — pine green */
--chirri-severity-info:     #5B7B94; /* Hanada (縹) — light indigo */

/* Severity backgrounds (very subtle tints) */
--chirri-severity-critical-bg: #FDF2F2;
--chirri-severity-high-bg:     #FDF6F0;
--chirri-severity-medium-bg:   #FDFAF0;
--chirri-severity-low-bg:      #F0F7F0;
--chirri-severity-info-bg:     #F0F4F7;

/* ── Borders & Dividers ────────────────────── */
--chirri-border-subtle:    #E8E2DA;  /* Barely there, like pencil on washi */
--chirri-border-default:   #D4CEC6;  /* Visible but gentle */
--chirri-border-strong:    #A09A92;  /* For emphasis, like ink on paper */
--chirri-border-focus:     #3D5167;  /* Brand indigo for focus rings */

/* ── Shadows ───────────────────────────────── */
/* Warm-tinted shadows, never blue-grey */
--chirri-shadow-sm:   0 1px 2px rgba(44, 40, 37, 0.06);
--chirri-shadow-md:   0 2px 8px rgba(44, 40, 37, 0.08);
--chirri-shadow-lg:   0 4px 16px rgba(44, 40, 37, 0.10);
--chirri-shadow-xl:   0 8px 32px rgba(44, 40, 37, 0.12);

/* ── Diff View ─────────────────────────────── */
--chirri-diff-added-bg:    #F0F5F0;  /* Barely-green, like new growth */
--chirri-diff-added-text:  #2C5B2C;
--chirri-diff-added-border:#5B8A5B;
--chirri-diff-removed-bg:  #F7F0F0;  /* Barely-warm, like autumn */
--chirri-diff-removed-text:#8A5B5B;
--chirri-diff-removed-border:#C07856;
--chirri-diff-context-bg:  transparent;
--chirri-diff-context-text:#9B9590;
```

#### Typography Tokens

```
/* ── Typography ─────────────────────────────── */
/* Pairing: Inter for UI, Noto Serif JP for accent/display */
/* Inter: clean, readable, neutral — lets the design breathe */
/* Noto Serif JP: adds Japanese warmth for headlines/brand moments */

--chirri-font-ui:         'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--chirri-font-display:    'Noto Serif JP', 'Noto Serif', Georgia, serif;
--chirri-font-mono:        'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;

/* Scale — generous, airy, aligned with "ma" principle */
--chirri-text-xs:         0.75rem;    /* 12px — fine print */
--chirri-text-sm:         0.8125rem;  /* 13px — secondary info */
--chirri-text-base:       0.9375rem;  /* 15px — body (not 14! slightly larger = more ma) */
--chirri-text-md:         1.0625rem;  /* 17px — emphasized body */
--chirri-text-lg:         1.25rem;    /* 20px — section headers */
--chirri-text-xl:         1.625rem;   /* 26px — page titles */
--chirri-text-2xl:        2.25rem;    /* 36px — hero display */
--chirri-text-3xl:        3.25rem;    /* 52px — landing page hero */

/* Line heights — generous, never cramped */
--chirri-leading-tight:   1.3;
--chirri-leading-normal:  1.6;   /* More than typical 1.5 — ma in text */
--chirri-leading-relaxed: 1.8;   /* For code/diff views */

/* Letter spacing */
--chirri-tracking-tight:  -0.02em;   /* Display text */
--chirri-tracking-normal:  0;
--chirri-tracking-wide:    0.04em;    /* Labels, uppercase */
--chirri-tracking-wider:   0.08em;    /* Nav items, all-caps */

/* Font weights */
--chirri-weight-normal:   400;
--chirri-weight-medium:   500;  /* Primary UI weight */
--chirri-weight-semibold: 600;  /* Headers, emphasis */
--chirri-weight-bold:     700;  /* Rare — only for critical emphasis */
```

#### Spacing Tokens

```
/* ── Spacing ───────────────────────────────── */
/* Based on 4px grid, but with generous defaults */
/* "Ma" philosophy: when in doubt, add more space */

--chirri-space-0:    0;
--chirri-space-1:    0.25rem;   /* 4px — hairline gaps */
--chirri-space-2:    0.5rem;    /* 8px — tight groups */
--chirri-space-3:    0.75rem;   /* 12px — form field gaps */
--chirri-space-4:    1rem;      /* 16px — standard rhythm */
--chirri-space-5:    1.25rem;   /* 20px */
--chirri-space-6:    1.5rem;    /* 24px — card internal padding */
--chirri-space-8:    2rem;      /* 32px — section gaps */
--chirri-space-10:   2.5rem;    /* 40px */
--chirri-space-12:   3rem;      /* 48px — major section breaks */
--chirri-space-16:   4rem;      /* 64px — page sections */
--chirri-space-20:   5rem;      /* 80px — hero-level breathing room */
--chirri-space-24:   6rem;      /* 96px — landing page sections */

/* Component-specific spacing — codified "ma" */
--chirri-card-padding:        var(--chirri-space-6);   /* 24px — generous */
--chirri-card-gap:            var(--chirri-space-4);   /* 16px between cards */
--chirri-sidebar-width:       200px;                   /* Narrow — fukinsei */
--chirri-sidebar-padding:     var(--chirri-space-5);
--chirri-sidebar-item-gap:    var(--chirri-space-3);
--chirri-form-field-gap:      var(--chirri-space-4);
--chirri-page-margin:         var(--chirri-space-8);
--chirri-section-gap:         var(--chirri-space-12);
```

#### Radius & Shape Tokens

```
/* ── Radius ────────────────────────────────── */
/* Subtle rounding — architectural, not bubbly */
/* Inspired by: slightly softened wood joinery edges */

--chirri-radius-sm:   3px;    /* Buttons, inputs, badges */
--chirri-radius-md:   6px;    /* Cards, dropdowns */
--chirri-radius-lg:   10px;   /* Modals, large panels */
--chirri-radius-full: 9999px; /* Pills, avatar frames */

/* Note: NOT using large radii. The aesthetic is slightly
   softened edges, like sanded wood — not bouncy bubbles.
   3-6px communicates "precise craft" not "friendly SaaS." */
```

#### Texture Token (Washi Paper Grain)

```
/* ── Background Texture ────────────────────── */
/* Subtle washi paper grain via SVG noise filter */
/* Applied at very low opacity to bg-primary */

--chirri-texture-noise: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");

/* Usage:
   body {
     background-color: var(--chirri-bg-primary);
     background-image: var(--chirri-texture-noise);
   }

   This creates a barely-perceptible organic grain that
   prevents the "digital flatness" of pure solid colors.
   You can't quite see it — but you can FEEL the warmth.
*/
```

#### Animation Tokens

```
/* ── Animation & Motion ────────────────────── */
/* Gentle, natural-feeling. Inspired by: leaves in still air */

--chirri-duration-fast:     120ms;
--chirri-duration-normal:   200ms;
--chirri-duration-slow:     400ms;
--chirri-duration-petal:    6000ms;  /* Petal drift — slow and meditative */

--chirri-easing-default:    cubic-bezier(0.25, 0.1, 0.25, 1.0);
--chirri-easing-enter:      cubic-bezier(0.0, 0.0, 0.2, 1.0);
--chirri-easing-exit:       cubic-bezier(0.4, 0.0, 1.0, 1.0);
--chirri-easing-petal:      cubic-bezier(0.37, 0.0, 0.63, 1.0); /* Natural float */

/* The petal animation is the ONLY place we use long,
   organic easing. Everything else is snappy and functional.
   This contrast makes the petal feel magical. */
```

---

### How Each Screen Feels

#### Dashboard (Main View)
- **Layout:** Bento grid — large diff/changelog panel (60%), severity summary column (25%), recent activity strip (15%). Not equal columns.
- **Background:** Kinari (`#FAF7F2`) with washi grain texture at 3% opacity
- **Cards:** White (`#FFFFFF`) with warm shadow, 24px padding, 6px radius
- **Typography:** Inter Medium for all UI text. Section labels in uppercase with wide tracking.
- **Severity:** Left border on cards — 3px for info (hanada blue), stepping up in width to 6px for critical (aka red). The border is the primary signal; a small severity badge with text label is secondary.
- **Ma:** 32px between major sections. The dashboard doesn't fill every pixel — there's room to breathe.
- **Petal moment:** None on the dashboard by default. A single petal drifts across when a new chirp arrives (notification animation).

#### Diff View (The Money Screen)
- **Background:** White card, full width
- **Code font:** JetBrains Mono at 15px, line-height 1.8 (noticeably more airy than GitHub/GitLab)
- **Added lines:** Left border in matsu green (`#5B8A5B`), very pale green bg (`#F0F5F0`)
- **Removed lines:** Left border in tobi terracotta (`#C07856`), text at 60% opacity with subtle strikethrough
- **Context:** Collapsed by default, expandable. Text in nezumi grey. This is yūgen — reveal on demand.
- **Gutter:** Clean, simple line numbers in tertiary text. No icons, no clutter.
- **Header:** File path in mono, change summary in secondary text. Generous padding.
- **What makes it feel Japanese:** The *space*. Compare a Chirri diff to a GitHub diff: ours has 60% more line-height, 40% more padding, and context is hidden by default. It breathes. The added/removed colors are warm nature tones (green/terracotta), not the typical neon green/red.

#### Severity/Alert Cards
- **Layout:** Cards stack vertically, sorted by severity (critical first — datsuzoku, the position IS the message)
- **Card structure:** Left border (width scales with severity), icon (small, monochrome), title, description, metadata
- **Critical card:** 6px left border in aka red, slightly elevated shadow, background is white (NOT red-tinted — restraint)
- **Info card:** 3px left border in hanada blue, flat (no shadow), feels recessive
- **The hierarchy is architectural:** you see the critical items because they're visually heavier, not because they're screaming

#### Form Controls
- **Checkboxes:** Square, 3px radius, 2px border in default grey. Checked: filled with brand indigo, clean white check stroke. Simple. Shibui.
- **Toggle:** Rectangular track (not pill-shaped), 3px radius, smooth slide. Off: stone grey track, white knob. On: brand indigo track.
- **Select/Dropdown:** Clean, minimal. Chevron indicator. Dropdown has warm shadow, 6px radius. Items have generous 12px vertical padding.
- **Text input:** Bottom border only (not full box), 2px, transitions to brand indigo on focus. Inspired by: the simplicity of a line drawn on paper for someone to write above.
- **Focus state:** 3px offset ring in `--chirri-brand-primary` with 30% opacity. Warm, visible, not jarring.

#### Navigation (Sidebar)
- **Width:** 200px (narrow — content is king)
- **Background:** `--chirri-bg-secondary` (#F3EEE8) — one shade warmer than the main bg
- **Items:** Text only, no icons (radical kanso). Inter Medium, 15px, wide letter-spacing for labels.
- **Active state:** Text becomes semibold + brand indigo color. 3px left border appears (the "ink mark").
- **Spacing:** 12px between items, 32px between groups. The bottom 40% of the sidebar is empty space. *This is intentional.* Ma.
- **Logo:** Small Chirri wordmark at the top, Noto Serif JP, understated. No mascot, no icon. The name is enough.

#### Landing Page Hero
- **Layout:** Asymmetric. Headline top-left occupying 55% width. Supporting text bottom-right. Center is *empty* — pure ma.
- **Headline font:** Noto Serif JP, 52px, tracking tight. Something like: "Every change,\nheard." or just: "Chirri."
- **Background:** Kinari with washi grain. One horizontal line element — a single brush stroke — running across the page at ~60% height, barely visible.
- **The petal moment:** 3-5 petals drift lazily across the hero. They're rendered in `--chirri-petal-soft` (#F0E0E3) — almost invisible against the warm background. More felt than seen. On hover/interaction, one petal might drift slightly faster, as if disturbed by your cursor. This is the ONLY page where multiple petals appear at once.
- **Below the fold:** The product screenshots on kinari backgrounds, bento-grid layout. Each feature section has generous space. Typography-forward — the screenshots are almost secondary to the words.

#### Empty States
- **Illustration:** None. Instead: a haiku-like message in Noto Serif JP italic, centered.
  - "No changes detected.\n Watch a path to begin."
  - "No chirps yet.\n The garden is still."
- **Below the text:** A single fallen petal SVG, small (24x24), in `--chirri-petal` color, positioned slightly off-center (fukinsei). It's not decorative — it's poetic.

---

### What Makes It Feel Japanese (Without Petals)

This is the crucial question. If you strip away the petal moments, the dashboard should STILL feel Japanese. Here's how:

1. **Warm neutrals, not cold ones.** Every "grey" in the system has warm undertones. The background isn't `#F5F5F5` (cold), it's `#FAF7F2` (warm kinari). This is the difference between a concrete office and a paper-and-wood tea room.

2. **Washi texture grain.** A barely-perceptible noise overlay on backgrounds creates the feeling of natural material. You can't consciously see it, but the absence of clinical digital flatness registers subliminally.

3. **Extreme negative space.** A Chirri dashboard has 30-40% more whitespace than a typical developer tool. This isn't wasted space — it's ma. It makes every element that IS there feel more important.

4. **Asymmetric layouts.** The bento grid, the narrow sidebar against wide content, the off-center hero text. Western tools love symmetry. Chirri embraces fukinsei.

5. **Warm shadows.** Every shadow is tinted warm (rgba of warm-brown, not neutral grey or blue). This creates the feeling of natural light on paper, not a screen in a dark room.

6. **Typography restraint.** Two font weights used in most screens (medium + semibold). No bold festival. Hierarchy comes from size and space, not weight and color. This is kanso.

7. **Nature-derived severity colors.** Not traffic-light red/yellow/green but persimmon/turmeric/pine. Each color has a Japanese name and a natural source. The colors are slightly desaturated — shibui, not screaming.

8. **Serif moments.** The Noto Serif JP headlines and empty-state messages create a moment of traditional Japanese typographic warmth. Used sparingly (only for display/brand text), they signal "this is crafted" without being precious.

9. **Ink-weight borders.** The left border severity system from Direction B — brush-pressure as a metaphor for urgency. Thin line = calm. Thick line = pay attention. It's intuitive and very sumi-e.

10. **Collapsed context / yūgen.** Showing less by default (collapsed diff context, progressive disclosure) is a structural expression of yūgen — suggestion over revelation.

---

## Comparison Matrix

| Criterion | A: Sakura Zen | B: Ink & Stone | C: Modern Kyoto | D: Kyoto Studio (Rec.) |
|-----------|:---:|:---:|:---:|:---:|
| **Professional enough for enterprise** | ⚠️ Risky | ✅ Strong | ✅ Strong | ✅ Strong |
| **Warm enough for hobbyist** | ✅ Very warm | ⚠️ Can feel austere | ⚠️ Intellectual | ✅ Warm + human |
| **Distinctively "Chirri"** | ✅ Very distinctive | ❌ Generic minimalist | ⚠️ Subtle | ✅ Distinctive |
| **Unmistakably Japanese** | ✅ Obviously | ✅ To design-literate | ⚠️ Structurally | ✅ Both structural + visible |
| **Screenshot recognition** | ✅ Instant | ❌ Forgettable | ⚠️ Needs context | ✅ Recognizable |
| **Buildable by small team** | ❌ Custom art everywhere | ✅ Very buildable | ✅ Buildable | ✅ Buildable |
| **Dark mode feasibility** | ❌ Nightmare | ✅ Easy | ✅ Moderate | ✅ Moderate |
| **Scales to dense data** | ❌ Decorations compete | ✅ Clean data display | ✅ Clean data display | ✅ Clean data display |
| **Marketing hook** | ✅ "Sakura" | ⚠️ What's the story? | ⚠️ "Principles" (academic) | ✅ "Petals when magic happens" |
| **Avoids cliché** | ❌ "Japanese = pink flowers" | ✅ Yes | ✅ Yes | ✅ Yes |

---

## Team Recommendation

### Direction D: "Kyoto Studio" — Unanimously Recommended

**HANA (Visual):** "Direction D gives me a system I can design *within*, not a collection of decorative ideas I have to maintain. The warm neutral foundation is beautiful in every screen. And the petal constraint — only in moments of delight — means when I DO use a petal, it actually matters. It's the Japanese philosophy of restraint in practice."

**REN (Interaction):** "The severity-by-border-weight system from Direction B, the progressive disclosure from Direction C's yūgen principle, the generous spacing from the ma philosophy — these are real UX improvements, not just styling. And the petal-on-chirp moment is going to create genuine emotional response. It's a micro-interaction that tells a story."

**SORA (Systems):** "I can build this. The tokens are clean. The washi grain is one SVG filter. The bento grid is CSS Grid. The petal animation is one reusable component with 3-4 placement slots. Dark mode means shifting the warm neutral scale — kinari becomes a warm dark (`#1E1C1A`), cards become elevated dark (`#2A2725`), the petal colors stay the same. Achievable."

**YUKI (Brand/Copy):** "The narrative writes itself: *'Chirri watches your code with the patience of a stone garden — and celebrates changes with the beauty of a falling petal.'* That's not just marketing. That's a genuine design philosophy. And 'petals when magic happens' is a feature that users will tell their friends about. Nobody shares screenshots of good spacing. But they DO share a video of a petal drifting across their terminal."

### The One Risk

The main risk is that the *structural* Japanese qualities (ma, fukinsei, warm textures) are subtle enough that some users might just see "clean UI." But the petal moments serve as the visible brand anchor — the thing that says "this is Chirri" in a way that even someone who doesn't know about kanso can feel.

The deeper Japanese design principles make the product *feel right* even if the user can't articulate why. That's shibui — beautiful by being precisely what it was meant to be.

### Next Steps

1. **Prototype the petal animation** — a single CSS/JS component that renders one petal with natural float physics. Test it as a notification accent.
2. **Build a token file** — export the tokens above as CSS custom properties and/or a JSON token file for the design system.
3. **Mock the diff view** — this is the money screen. Show it side-by-side with GitHub's diff to demonstrate the "ma" difference.
4. **Design the landing page** — the asymmetric hero with drifting petals is the first thing investors/users see. It needs to be perfect.
5. **Test warm neutrals on actual content** — put real diff data, real severity cards, real table data against the kinari background. Make sure it reads well at scale.

---

*"The stone garden is complete when there is nothing left to remove."*
*— And then one petal falls.*
