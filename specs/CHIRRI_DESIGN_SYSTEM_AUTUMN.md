# Chirri Design System — "Autumn Garden" (秋の庭)

> **Direction:** Alternative to "Kyoto Studio" — exploring warm browns & Japanese reds
> **Team:** Design Team B
> **Date:** 2026-03-24
> **Status:** Complete spec + preview page

---

## 1. Philosophy

### The Concept

Chirri is a bird. Birds chirp in gardens. In autumn, Japanese gardens transform — brown leaves carpet the moss, red temple gates glow against grey stone, warm earth holds the memory of summer, and the occasional pink blossom holds on, refusing to let go.

**"Autumn Garden" is the Kyoto Studio direction warmed by fire.**

Where Kyoto Studio uses cool indigo (Ai-iro) as its primary, Autumn Garden replaces it with the warm red-brown spectrum of Japanese autumn. The result is a design system that feels like lacquerware, aged wood, and temple architecture — grounded, warm, and unmistakably Japanese.

### The Red-Brown Question: Resolved

The key design question was: *Where do browns end and reds begin?*

**Our answer: They exist on a spectrum, like autumn leaves.**

- **Warm browns** (Cha-nezumi, Kitsune-iro) → everyday UI: borders, secondary text, navigation, disabled states
- **Red-browns** (Tobi-iro, Bengara) → action & emphasis: primary buttons, active states, links
- **True reds** (Enji, Aka) → alarm & destruction: error states, destructive actions, critical severity
- **Sakura pink** → the 1-2% signal: a blossom that hasn't fallen yet

This mirrors the actual color progression of a Japanese maple leaf — green → gold → brown → red → crimson. Each stage has a role.

### Japanese Precedent

**Bengara (弁柄)** — iron oxide red — is the color of traditional Japanese buildings in Fukiya, Okayama. It was used because it was both beautiful AND functional: iron oxide repels insects, preserves wood, and ages gracefully. This dual purpose (aesthetic + practical) is exactly what a primary UI color should be.

**Torii gates** use a vermillion-red that sits between orange and crimson. It's not "generic red" — it's a specific, culturally meaningful warm red that commands attention without screaming. We use this same principle: our primary actions are warm, commanding, and specific.

---

## 2. Color System

### 2.1 Foundation — Warm Creams & Whites

| Token | Name | Japanese | Hex | Usage |
|-------|------|----------|-----|-------|
| `bg-primary` | Gofun-iro | 胡粉色 — shell white | `#FAF6F0` | Page background |
| `bg-secondary` | Kinari | 生成 — raw silk, unbleached | `#F3ECE2` | Sidebar, secondary surfaces |
| `bg-tertiary` | Torinoko | 鳥の子 — eggshell | `#E8DFD2` | Hover states, recessive panels |
| `bg-elevated` | Shiro | 白 — white | `#FFFDF9` | Cards, elevated surfaces |

### 2.2 Text Colors

| Token | Name | Japanese | Hex | Usage |
|-------|------|----------|-----|-------|
| `text-primary` | Kuro-cha | 黒茶 — black tea | `#2A2320` | Primary text, headings |
| `text-secondary` | Kuri-nezumi | 栗鼠 — chestnut mouse | `#6B5E54` | Secondary text, descriptions |
| `text-tertiary` | Cha-nezumi | 茶鼠 — tea grey | `#9B8E82` | Placeholders, hints, timestamps |
| `text-inverse` | Gofun | 胡粉 — shell white | `#FAF6F0` | Text on dark/colored backgrounds |

### 2.3 Primary — Bengara Red-Brown (Action & Emphasis)

| Token | Name | Japanese | Hex | Usage |
|-------|------|----------|-----|-------|
| `primary` | Bengara | 弁柄 — iron oxide red | `#8B3A2A` | Primary buttons, active states, links |
| `primary-hover` | Tobi-iro | 鳶色 — kite bird brown | `#6C3524` | Primary hover/pressed |
| `primary-subtle` | Bengara-usui | 弁柄薄 — pale bengara | `#F5E8E4` | Primary backgrounds, selected rows |
| `primary-muted` | Aka-cha | 赤茶 — red tea | `#A0584A` | Primary at reduced intensity |

**Why Bengara?** It has 5.8:1 contrast ratio against white — exceeds WCAG AA for normal text. It's warm enough to feel like autumn, red enough to command attention, and brown enough to not conflict with danger states.

### 2.4 Secondary — Kitsune-iro (Warm Navigation)

| Token | Name | Japanese | Hex | Usage |
|-------|------|----------|-----|-------|
| `secondary` | Kitsune-iro | 狐色 — fox color | `#C78550` | Secondary buttons, accents |
| `secondary-hover` | Kuri-iro | 栗色 — chestnut | `#A06830` | Secondary hover |
| `secondary-subtle` | Kitsune-usui | 狐色薄 — pale fox | `#F8F0E5` | Secondary backgrounds |

### 2.5 Semantic — Severity from Nature

| Severity | Token | Name | Japanese | Hex | Bg Hex | Natural Source |
|----------|-------|------|----------|-----|--------|----------------|
| Critical | `severity-critical` | Enji | 臙脂 — cochineal crimson | `#B94047` | `#FDF0F0` | Temple curtains, alarm |
| High | `severity-high` | Kaki-iro | 柿色 — persimmon | `#D47A3D` | `#FDF5EE` | Autumn persimmon fruit |
| Medium | `severity-medium` | Karashi | 芥子 — mustard | `#C4A43D` | `#FDF9EE` | Spice, attention |
| Low | `severity-low` | Matsu | 松 — pine green | `#5B8A5B` | `#F0F5F0` | Evergreen, stability |
| Info | `severity-info` | Hanada | 縹 — light indigo | `#5B7B94` | `#EFF3F7` | Calm water |

### 2.6 Danger vs Primary: The Crucial Distinction

This is where "Autumn Garden" does something the task specifically asked about:

- **Bengara (#8B3A2A)** = primary action. "Do this." Warm red-brown. *The torii gate you walk through.*
- **Enji (#B94047)** = danger/destructive. "Are you sure?" Pure crimson. *The temple curtain that warns you.*

The visual difference is clear: Bengara leans brown (warm, inviting). Enji leans red (sharp, cautionary). Users intuitively feel the difference — one says "go" and the other says "stop."

| Context | Color | Example |
|---------|-------|---------|
| "Save changes" button | Bengara `#8B3A2A` | Warm, confident |
| "Delete provider" button | Enji `#B94047` | Sharp, warning |
| "Cancel" button | Cha-nezumi `#9B8E82` | Neutral, recessive |
| Error message border | Enji `#B94047` | Clearly an error |
| Active nav item | Bengara `#8B3A2A` | "You are here" |

### 2.7 The Sakura Signal — 1-2%

| Token | Name | Japanese | Hex | Usage |
|-------|------|----------|-----|-------|
| `sakura` | Sakura-nezumi | 桜鼠 — cherry grey | `#D4A0A7` | Chirp notifications, petal |
| `sakura-soft` | Usuzakura | 薄桜 — pale cherry | `#F0E0E3` | Sakura glow backgrounds |
| `sakura-deep` | Sakura-enji | 桜臙脂 | `#C47080` | Petal on dark mode |

**The sakura pink is the one blossom still holding on in autumn.** It appears:
- Chirp notification pulse
- Empty state fallen petal
- Logo accent
- *Nowhere else*

Against the brown-red palette, the pink stands out MORE than it does against the cool indigo of Kyoto Studio. The warm browns make pink feel like a natural companion rather than a foreign accent.

### 2.8 Borders & Surfaces

| Token | Name | Hex | Usage |
|-------|------|-----|-------|
| `border-subtle` | — | `#E8DDD0` | Barely visible dividers |
| `border-default` | — | `#D4C8BA` | Standard borders |
| `border-strong` | — | `#A0937F` | Emphasis borders |
| `border-focus` | — | `#8B3A2A` | Focus rings (Bengara) |

### 2.9 Shadows

All shadows are warm-tinted (brown undertone, never blue-grey):

```css
--shadow-sm:   0 1px 2px rgba(42, 35, 32, 0.06);
--shadow-md:   0 2px 8px rgba(42, 35, 32, 0.08);
--shadow-lg:   0 4px 16px rgba(42, 35, 32, 0.10);
--shadow-xl:   0 8px 32px rgba(42, 35, 32, 0.12);
```

### 2.10 Dark Mode — Urushi (漆 — Lacquerware)

Dark mode draws from **urushi** (Japanese lacquerware): deep warm blacks with a subtle red-brown undertone. Not space-black, not blue-dark — lacquer-dark.

| Token | Light | Dark | Notes |
|-------|-------|------|-------|
| `bg-primary` | `#FAF6F0` | `#1E1A17` | Very warm near-black |
| `bg-secondary` | `#F3ECE2` | `#262220` | Sidebar dark |
| `bg-elevated` | `#FFFDF9` | `#302B28` | Cards in dark |
| `text-primary` | `#2A2320` | `#E8E0D8` | Warm off-white text |
| `text-secondary` | `#6B5E54` | `#A09488` | Muted warm text |
| `primary` | `#8B3A2A` | `#C06B5A` | Lightened Bengara for dark |
| `border-default` | `#D4C8BA` | `#403830` | Warm dark borders |
| `sakura` | `#D4A0A7` | `#D4A0A7` | Stays the same |

The dark mode should feel like the inside of a lacquerware box — deep, rich, with warm reflections. Not the cold void of a code editor.

---

## 3. Typography

Same stack as Kyoto Studio — the typography is shared across all directions:

| Role | Family | Usage |
|------|--------|-------|
| UI | Inter (400, 500, 600) | All interface text, controls, labels |
| Display | Noto Serif JP (300, 400, 500) | Headlines, brand moments, empty states |
| Mono | JetBrains Mono (400, 500) | Code, diffs, API keys, technical values |

### Scale

```
--text-xs:    0.75rem    (12px)
--text-sm:    0.8125rem  (13px)
--text-base:  0.9375rem  (15px)  ← body default
--text-md:    1.0625rem  (17px)
--text-lg:    1.25rem    (20px)
--text-xl:    1.625rem   (26px)
--text-2xl:   2.25rem    (36px)
--text-3xl:   3.25rem    (52px)
```

### Line Heights

```
--leading-tight:    1.3     (headings)
--leading-normal:   1.6     (body — generous ma)
--leading-relaxed:  1.8     (code, diff views)
```

---

## 4. Components

### 4.1 Buttons

| Variant | Background | Text | Border | Usage |
|---------|-----------|------|--------|-------|
| **Primary** | Bengara `#8B3A2A` | White `#FFFDF9` | none | Main CTA: "Save", "Add URL" |
| **Secondary** | transparent | Bengara `#8B3A2A` | Bengara `#8B3A2A` | Secondary actions: "Cancel" |
| **Tertiary/Ghost** | transparent | Cha-nezumi `#9B8E82` | none | "Reset", "Skip" |
| **Destructive** | Enji `#B94047` | White | none | "Delete", "Remove" |
| **Warm** | Kitsune `#C78550` | White | none | Accent actions, special CTAs |

**Sizing:**
- Small: `px-3.5 py-1.5 text-xs` (badges, inline actions)
- Default: `px-5 py-2.5 text-sm` (standard buttons)
- Large: `px-7 py-3 text-base` (hero CTAs, modals)

**States:**
- Hover: darken 10% (e.g., Bengara → Tobi-iro)
- Active/Pressed: darken 15%
- Disabled: 40% opacity
- Focus: 3px offset ring in primary at 30% opacity

**Border radius:** 3px (chirri) — slightly softened, architectural

### 4.2 Checkboxes

- **Unchecked:** White bg, 2px border in `border-default`
- **Checked:** Bengara `#8B3A2A` bg, white checkmark stroke
- **Indeterminate:** Bengara bg, white dash
- **Disabled:** Torinoko bg, lighter border, 60% opacity
- **Focus:** 3px offset ring in Bengara at 30%

### 4.3 Radio Buttons

- **Unselected:** White bg, 2px border in `border-default`
- **Selected:** 2px border in Bengara, inner dot in Bengara (7px)
- **Disabled:** 60% opacity
- **Focus:** 3px offset ring in Bengara at 30%

### 4.4 Toggle Switches

- **Off:** Track in `#C4BAA8` (warm grey), white knob left
- **On:** Track in Bengara `#8B3A2A`, white knob right
- **Disabled:** 40% opacity, no cursor
- Shape: Rectangular track with 10px radius, 36×20px

### 4.5 Text Inputs

**Two styles:**

1. **Underline input** (default): Transparent bg, 2px bottom border. Focus → Bengara border.
2. **Boxed input** (for forms with many fields): White bg, full border, 3px radius. Focus → Bengara border + ring.

- Placeholder: Cha-nezumi `#9B8E82`
- Error: Enji border + error message below
- Disabled: Torinoko bg, 60% opacity

### 4.6 Custom Dropdowns

**NO native `<select>` elements.** All dropdowns are custom-built.

- **Trigger:** Matches boxed input style, chevron in Cha-nezumi
- **Panel:** White bg, warm shadow-lg, 6px radius
- **Options:** 12px vertical padding (generous), hover bg `#F5EDE4`
- **Selected:** Bengara checkmark, slightly tinted bg
- **Keyboard:** Arrow keys, Enter, Escape support

### 4.7 Cards

- **Background:** White `#FFFDF9`
- **Border:** 1px in `border-subtle`
- **Shadow:** warm-md
- **Padding:** 24px (generous ma)
- **Border radius:** 6px

**Severity cards** use left border weight system:
- Critical: 6px left border in Enji
- High: 5px in Kaki
- Medium: 4px in Karashi
- Low: 3px in Matsu
- Info: 3px in Hanada

### 4.8 Navigation Sidebar

- **Width:** 200px (narrow — fukinsei)
- **Background:** bg-secondary `#F3ECE2`
- **Items:** Text only, Inter Medium, wide tracking
- **Active:** Bengara text + 3px left border + subtle Bengara-tinted bg
- **Inactive:** Cha-nezumi text, transparent border
- **Logo:** Noto Serif JP, light weight, top of sidebar
- **Bottom:** Empty space (ma) + version number

### 4.9 Tabs

- **Active:** Kuro-cha text, 2px bottom border in Bengara
- **Inactive:** Cha-nezumi text, transparent border
- **Hover:** Darken text toward Kuri-nezumi
- **Gap:** 24px between tabs

### 4.10 Badges

Pill-shaped, small:
- **Default:** Kinari bg, Kuro-cha text, subtle border
- **Severity:** Colored dot (2px circle) + text label
- **Status:** Appropriate severity color dot + neutral text

### 4.11 Toasts / Notifications

- **Container:** White bg, warm shadow-lg, 6px radius
- **Position:** Top-right, 16px from edges
- **Animation:** Slide in from right, 400ms ease-out
- **Chirp toast:** Includes sakura petal SVG that pulses
- **Error toast:** Left border in Enji
- **Success toast:** Left border in Matsu
- **Auto-dismiss:** 5 seconds, with progress bar in border color

### 4.12 Modals

- **Overlay:** `rgba(42, 35, 32, 0.5)` — warm dark overlay
- **Container:** White bg, warm shadow-xl, 10px radius
- **Padding:** 32px
- **Header:** Noto Serif JP for title
- **Actions:** Right-aligned, primary + secondary buttons
- **Animation:** Fade in overlay, scale up modal from 95%

---

## 5. How Red-Brown Works as "Danger"

### The Problem

In most design systems, "red = danger." But in Autumn Garden, our primary color IS a red-brown. How do we differentiate?

### The Solution: Hue Shift + Context

| Color | Hue | Warmth | Meaning |
|-------|-----|--------|---------|
| Bengara `#8B3A2A` | 14° (orange-red) | Very warm | "Action, go, do this" |
| Enji `#B94047` | 355° (true crimson) | Cool-leaning red | "Warning, danger, stop" |

The ~20° hue difference is perceptible: Bengara has visible brown/orange warmth, Enji is a clean, sharp crimson. Users process this instinctively — warm = approach, cool-red = caution.

### Supporting Signals

Color alone doesn't carry danger. We layer:

1. **Icon:** Destructive actions get a warning icon (⚠️ or trash)
2. **Copy:** "Delete" vs "Save" — the word does the work
3. **Confirmation:** Destructive actions always require confirmation modal
4. **Position:** Destructive buttons sit away from primary actions (right side or below)
5. **Weight:** Destructive buttons are outlined by default, only filled in confirmation dialogs

### Specific Patterns

```
Primary button:     bg-bengara   text-white    → "Save Changes"
Destructive button: bg-enji      text-white    → "Delete Provider"  (only in modals)
Destructive link:   text-enji    underline     → "Remove" (inline)
Error border:       border-enji  3px left      → Form validation, error cards
Error text:         text-enji                  → "This field is required"
```

---

## 6. Accessibility

### Contrast Ratios (WCAG 2.1)

| Foreground | Background | Ratio | Grade |
|-----------|------------|-------|-------|
| Kuro-cha `#2A2320` | Gofun `#FAF6F0` | **14.2:1** | AAA ✅ |
| Bengara `#8B3A2A` | White `#FFFDF9` | **5.8:1** | AA ✅ (normal text) |
| Bengara `#8B3A2A` | Gofun `#FAF6F0` | **5.5:1** | AA ✅ (normal text) |
| Enji `#B94047` | White `#FFFDF9` | **4.6:1** | AA ✅ (large text), AA borderline |
| Kitsune `#C78550` | White `#FFFDF9` | **2.9:1** | Decorative only ⚠️ |
| Cha-nezumi `#9B8E82` | Gofun `#FAF6F0` | **3.1:1** | Large text only ⚠️ |
| Kuri-nezumi `#6B5E54` | Gofun `#FAF6F0` | **5.2:1** | AA ✅ |
| Matsu `#5B8A5B` | White `#FFFDF9` | **3.6:1** | Large text ⚠️ |
| Hanada `#5B7B94` | White `#FFFDF9` | **3.8:1** | Large text ⚠️ |

### Key Decisions

1. **Kitsune-iro** (`#C78550`) fails contrast for text — use ONLY as decoration (borders, fills, secondary button backgrounds with white text)
2. **Cha-nezumi** (`#9B8E82`) — use only for large text (timestamps, hints) or non-essential info
3. **Severity colors** on white backgrounds: always pair with text labels, never rely on color alone
4. **Focus rings:** 3px offset in Bengara at 30% — visible on all backgrounds
5. **Dark mode Bengara** lightened to `#C06B5A` for sufficient contrast on dark surfaces

### Non-Color Signals

Every piece of information conveyed by color is ALSO conveyed by:
- Text labels ("Critical", "Error", "Active")
- Icons (warning triangle, checkmark, cross)
- Position (critical items sort to top)
- Border weight (thicker = more urgent)

---

## 7. Design Tokens — Tailwind Configuration

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Foundation
        gofun:      '#FAF6F0',
        kinari:     '#F3ECE2',
        torinoko:   '#E8DFD2',
        kurocha:    '#2A2320',
        'kuri-nezumi': '#6B5E54',
        'cha-nezumi':  '#9B8E82',

        // Primary — Bengara spectrum
        bengara:    '#8B3A2A',
        tobi:       '#6C3524',
        'bengara-light': '#F5E8E4',
        'aka-cha':  '#A0584A',

        // Secondary — Kitsune
        kitsune:    '#C78550',
        kuri:       '#A06830',
        'kitsune-light': '#F8F0E5',

        // Danger/Destructive
        enji:       '#B94047',
        'enji-light': '#FDF0F0',

        // Sakura signal
        sakura:     '#D4A0A7',
        usuzakura:  '#F0E0E3',

        // Severity
        'sev-critical':    '#B94047',
        'sev-high':        '#D47A3D',
        'sev-medium':      '#C4A43D',
        'sev-low':         '#5B8A5B',
        'sev-info':        '#5B7B94',
        'sev-critical-bg': '#FDF0F0',
        'sev-high-bg':     '#FDF5EE',
        'sev-medium-bg':   '#FDF9EE',
        'sev-low-bg':      '#F0F5F0',
        'sev-info-bg':     '#EFF3F7',

        // Borders
        'border-subtle':   '#E8DDD0',
        'border-default':  '#D4C8BA',
        'border-strong':   '#A0937F',

        // Dark mode (Urushi)
        urushi:        '#1E1A17',
        'urushi-card': '#302B28',
        'urushi-border': '#403830',
      },
      fontFamily: {
        ui:      ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Noto Serif JP"', '"Noto Serif"', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'monospace'],
      },
      borderRadius: {
        chirri:      '3px',
        'chirri-md': '6px',
        'chirri-lg': '10px',
      },
      boxShadow: {
        'warm-sm': '0 1px 2px rgba(42, 35, 32, 0.06)',
        'warm-md': '0 2px 8px rgba(42, 35, 32, 0.08)',
        'warm-lg': '0 4px 16px rgba(42, 35, 32, 0.10)',
        'warm-xl': '0 8px 32px rgba(42, 35, 32, 0.12)',
      },
    }
  }
}
```

### CSS Custom Properties

```css
:root {
  /* Foundation */
  --autumn-bg-primary:       #FAF6F0;
  --autumn-bg-secondary:     #F3ECE2;
  --autumn-bg-tertiary:      #E8DFD2;
  --autumn-bg-elevated:      #FFFDF9;

  /* Text */
  --autumn-text-primary:     #2A2320;
  --autumn-text-secondary:   #6B5E54;
  --autumn-text-tertiary:    #9B8E82;

  /* Primary */
  --autumn-primary:          #8B3A2A;
  --autumn-primary-hover:    #6C3524;
  --autumn-primary-subtle:   #F5E8E4;

  /* Secondary */
  --autumn-secondary:        #C78550;
  --autumn-secondary-hover:  #A06830;

  /* Danger */
  --autumn-danger:           #B94047;
  --autumn-danger-subtle:    #FDF0F0;

  /* Sakura */
  --autumn-sakura:           #D4A0A7;
  --autumn-sakura-soft:      #F0E0E3;

  /* Shadows */
  --autumn-shadow-sm:   0 1px 2px rgba(42, 35, 32, 0.06);
  --autumn-shadow-md:   0 2px 8px rgba(42, 35, 32, 0.08);
  --autumn-shadow-lg:   0 4px 16px rgba(42, 35, 32, 0.10);

  /* Washi texture */
  --autumn-texture: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
}

/* Dark mode */
[data-theme="dark"] {
  --autumn-bg-primary:       #1E1A17;
  --autumn-bg-secondary:     #262220;
  --autumn-bg-tertiary:      #302B28;
  --autumn-bg-elevated:      #302B28;
  --autumn-text-primary:     #E8E0D8;
  --autumn-text-secondary:   #A09488;
  --autumn-text-tertiary:    #7A6E62;
  --autumn-primary:          #C06B5A;
  --autumn-primary-hover:    #D4806E;
  --autumn-primary-subtle:   rgba(192, 107, 90, 0.15);
  --autumn-danger:           #D46068;
  --autumn-border-default:   #403830;
}
```

---

## Comparison with Kyoto Studio

| Aspect | Kyoto Studio | Autumn Garden |
|--------|-------------|---------------|
| **Primary** | Ai-iro (indigo) `#3D5167` | Bengara (iron oxide) `#8B3A2A` |
| **Warmth** | Warm neutrals, cool accent | Warm everywhere |
| **Feeling** | Stone garden, intellectual | Autumn forest, emotional |
| **CTA** | Sakura pink button (one pink element) | Bengara button (warm red-brown) |
| **Danger** | Aka red (standard) | Enji crimson (temple curtain) |
| **Dark mode** | Warm grey | Urushi lacquer (warmer, redder) |
| **Sakura role** | Primary CTA pink | Signal-only (rarer, more precious) |
| **Japanese ref** | Karesansui (rock garden) | Momijigari (autumn leaf viewing) |
| **Best for** | Users who want restraint | Users who want warmth |

---

*"The autumn garden does not mourn the fallen leaves — it wears them."*
