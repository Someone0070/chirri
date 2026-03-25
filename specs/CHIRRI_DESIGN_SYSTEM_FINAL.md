# Chirri Design System — "Sakura Signal"

> **Version:** 1.0 Final
> **Design team:** HANA (visual), REN (interaction), SORA (systems), YUKI (brand/copy)
> **Date:** 2026-03-24
> **Preview:** `chirri-landing/design-system-final.html`

---

## 1. Design Philosophy

### The Sakura Signal Concept

**Pink is not a UI color. Pink is a signal color.**

It means "something alive happened." A chirp was received. A change was detected. A pulse came back. Pink appears in the 1–2% of moments that matter — and nowhere else. This makes every petal appearance an event, not decoration.

The insight comes from hanami (花見) itself: cherry blossoms are celebrated *because they're fleeting*. A petal that's always there is wallpaper. A petal that drifts through a warm stone-grey interface is *mono no aware* — the beauty of impermanence.

### Why This Is Professional

The best developer tools of this generation prove that personality and professionalism aren't opposites:

- **Linear** uses purple gradients, fluid animations, and aggressive visual polish — and is the standard for engineering teams at Vercel, Stripe, and OpenAI. They proved that "beautiful" doesn't mean "unserious."
- **Vercel/Geist** uses a restrained monochrome palette with surgical typography, but their landing pages have gradient flourishes and animated details. The *contrast* between restraint and expression is the design.
- **Stripe** uses color photography, playful gradient meshes, and generous whitespace on their marketing — then switches to a clean, data-dense dashboard. Two modes, one brand.
- **Raycast** uses warm colors and playful illustrations in their launcher, then drops to minimal UI in the actual tool. The delight is earned by the density elsewhere.

**The pattern:** Professional tools are 95% restrained, 5% expressive. The 5% is what makes them memorable. Chirri's 5% is sakura.

### Japanese Principles Driving Decisions

| Principle | Japanese | Application in Chirri |
|-----------|----------|----------------------|
| **Kanso** | 簡素 (simplicity) | Every element earns its place. No decorative UI chrome. |
| **Ma** | 間 (negative space) | 30-40% more whitespace than typical dev tools. Space IS content. |
| **Fukinsei** | 不均整 (asymmetry) | Bento grid layout, narrow sidebar vs. wide content. |
| **Shibui** | 渋い (understated elegance) | Controls are exactly what they need to be. No gradients, no glow. |
| **Mono no aware** | 物の哀れ (beauty of impermanence) | Petals appear and fade. The signal is transient. |
| **Yūgen** | 幽玄 (suggestion over revelation) | Progressive disclosure. Context collapsed by default. |
| **Wabi-sabi** | 侘寂 (beauty in imperfection) | Washi paper grain. Warm tones. Nothing is clinically perfect. |

---

## 2. Color System

### 2.1 Warm Neutrals — The Foundation

Every "grey" in Chirri has warm undertones. This is the difference between a concrete office and a paper-and-wood tea room.

| Token | Name | Japanese | Hex | Usage |
|-------|------|----------|-----|-------|
| `bg-primary` | Kinari | 生成 (raw silk) | `#FAF7F2` | Page background |
| `bg-secondary` | Shironeri | 白練 (refined white) | `#F3EEE8` | Sidebar, recessed areas |
| `bg-tertiary` | Torinoko | 鳥の子 (eggshell) | `#EBE5DC` | Hover backgrounds, zebra rows |
| `bg-elevated` | Gofun | 胡粉 (shell white) | `#FFFFFF` | Cards, modals, elevated surfaces |
| `border-subtle` | — | — | `#E8E2DA` | Dividers, card borders (resting) |
| `border-default` | — | — | `#D4CEC6` | Input borders, prominent dividers |
| `border-strong` | — | — | `#9E9890` | Active borders, emphasis |

### 2.2 Text Hierarchy

| Token | Name | Japanese | Hex | Contrast on Kinari | Usage |
|-------|------|----------|-----|---------------------|-------|
| `text-primary` | Kuro-cha | 黒茶 (black tea) | `#2C2825` | 13.67:1 ✅ AA | Headings, body text, primary labels |
| `text-secondary` | Nibi | 鈍 (muted) | `#6B6560` | 5.38:1 ✅ AA | Secondary descriptions, metadata |
| `text-tertiary` | Nezumi | 鼠 (mouse grey) | `#948E88` | 3.18:1 ⚠️ AA-large | Placeholders, timestamps, disabled labels |
| `text-muted` | Hai | 灰 (ash) | `#A6A09A` | 2.65:1 | Decorative text only, never functional |
| `text-disabled` | Usuzumi | 薄墨 (thin ink) | `#C4BEB8` | 1.67:1 | Disabled state (paired with opacity) |
| `text-inverse` | Kinari | 生成 | `#FAF7F2` | — | Text on dark/colored backgrounds |

> **Note on `text-tertiary`:** At 3.18:1 on kinari, this passes AA for large text (≥18px or ≥14px bold). For body-size tertiary text, use `text-secondary` instead. This is intentional — the lightest functional text should still be readable, so we constrain where `text-tertiary` appears.

### 2.3 Brand Colors — The Dual Accent System

Chirri uses **two warm accent paths** that work together, inspired by the materials of a Japanese tea room:

#### Path 1: Cha-nezumi — Everyday Controls (The Tea Ceremony)

| Token | Name | Japanese | Hex | Usage |
|-------|------|----------|-----|-------|
| `action-primary` | Cha-nezumi | 茶鼠 (tea-grey brown) | `#A28C73` | Button fills, active toggles, checked states |
| `action-primary-hover` | Kitsune-cha | 狐茶 (fox tea) | `#8A7461` | Button hover state |
| `action-primary-active` | Kobicha | 媚茶 (flattery tea) | `#7A6451` | Button pressed state |
| `action-primary-subtle` | Kinu-nezumi | 絹鼠 (silk grey) | `#F0EBE3` | Subtle backgrounds, selected row |
| `action-primary-border` | — | — | `#CFC6B8` | Resting control borders |

**Accessibility for Cha-nezumi buttons:**
- `#A28C73` on white: **3.21:1** → Passes AA for large text (button labels ≥14px semi-bold qualify)
- `#8A7461` on white: **4.42:1** → Passes AA for large text with margin
- `#7A6451` on white: **5.57:1** → Passes AA for all text sizes
- White text on `#A28C73` bg: **3.21:1** → Passes AA-large
- **Rule:** Primary buttons use `#A28C73` fill with white text at ≥14px/600 weight. For small text labels on this color, darken to `#7A6451`.

#### Path 2: Tobi-iro — Emphasis & Danger (The Temple Gate)

| Token | Name | Japanese | Hex | Usage |
|-------|------|----------|-----|-------|
| `action-danger` | Tobi-iro | 鳶色 (kite bird brown) | `#6C3524` | Destructive buttons, delete confirmations |
| `action-danger-hover` | Kuri-ume | 栗梅 (chestnut plum) | `#5A2B1D` | Danger hover |
| `action-danger-active` | Kuriiro | 栗色 (chestnut) | `#4A2318` | Danger pressed |
| `action-danger-subtle` | — | — | `#F5EEEB` | Danger background tint |
| `action-emphasis` | Enji | 臙脂 (cochineal) | `#B94047` | Important badges, critical counts |
| `action-emphasis-subtle` | — | — | `#FDF2F2` | Critical card background |

**Why Tobi-iro instead of generic red:**
- At **9.67:1** contrast on white, it's more accessible than most "danger reds"
- White text on Tobi-iro: **9.67:1** — exceptional
- It reads as "serious" and "important" without screaming — like a temple gate commands respect, not fear
- It's cohesive with Cha-nezumi (both are warm earth tones from the same Japanese palette family)
- The typical SaaS red (#EF4444 / #DC2626) would clash with the warm neutrals. Tobi-iro belongs here.

#### The Browns & Reds Family (Extended Palette)

These additional traditional colors are available for data visualization, illustrations, and special use cases:

| Name | Japanese | Hex | Contrast on White | Notes |
|------|----------|-----|-------------------|-------|
| Aka-cha | 赤茶 (red tea) | `#8F4B38` | 6.50:1 ✅ | Warm red-brown, good for secondary emphasis |
| Bengara | 弁柄 (iron oxide) | `#8B2500` | 8.89:1 ✅ | Traditional building red, strong statement |
| Kuri-iro | 栗色 (chestnut) | `#762F07` | 9.63:1 ✅ | Deep chestnut, darkest brown |
| Shitan | 紫檀 (rosewood) | `#5C2018` | 12.04:1 ✅ | Very dark, use for critical text on light bg |

**How the dual system works together:**

```
Everyday action:     Cha-nezumi button    → "Add URL" / "Save" / "Run Check"
Important action:    Cha-nezumi button    → Same, but context makes it important
Destructive action:  Tobi-iro button      → "Delete Monitor" / "Remove All"
Critical alert:      Enji badge/dot       → "5 critical changes"
```

The palette moves from warm-grey → warm-brown → warm-red as intensity increases. It's a *temperature gradient*, not a color switch.

### 2.4 Sakura Signal Colors

Pink exists in exactly these contexts and no others:

| Token | Name | Japanese | Hex | Context |
|-------|------|----------|-----|---------|
| `signal-petal` | Sakura-nezumi | 桜鼠 (cherry grey) | `#D4A0A7` | Petal animations, favicon dot |
| `signal-petal-soft` | Usuzakura | 薄桜 (pale cherry) | `#F0E0E3` | Petal glow halo, pulse background |
| `signal-petal-deep` | Enji-sakura | 臙脂桜 | `#C87680` | Chirp indicator dot (needs visibility) |
| `signal-glow` | — | — | `rgba(212,160,167,0.2)` | Pulse animation ring |

**Where pink appears (exhaustive list):**
1. Petal drift animation (landing page hero)
2. Chirp indicator dot (new change detected)
3. Signal pulse ring (when a check returns)
4. Favicon notification dot
5. Empty state illustration (single fallen petal)
6. First-chirp celebration (onboarding moment)

**Where pink NEVER appears:**
- Buttons, links, hover states, form controls, navigation
- Badges, tags, borders, backgrounds, text
- Loading spinners, progress bars, charts

### 2.5 Semantic / Severity Colors

Drawn from nature. Each severity has a Japanese name and a natural source.

| Severity | Token | Name | Japanese | Hex | Contrast | Natural Source |
|----------|-------|------|----------|-----|----------|----------------|
| Critical | `severity-critical` | Aka | 赤 (red) | `#C43D3D` | 5.14:1 ✅ | Autumn maple |
| High | `severity-high` | Kaki | 柿 (persimmon) | `#C47A3D` | 3.40:1 ⚠️ | Ripe persimmon |
| Medium | `severity-medium` | Ukon | 鬱金 (turmeric) | `#A89030` | 3.06:1 ⚠️ | Turmeric root |
| Low | `severity-low` | Matsu | 松 (pine) | `#4D7A4D` | 4.85:1 ✅ | Pine needles |
| Info | `severity-info` | Hanada | 縹 (pale indigo) | `#527090` | 4.86:1 ✅ | Mountain sky |

> **Note:** High and Medium severities are ⚠️ for small text. They pass AA-large (3:1+) and are used primarily for dots, borders, and badges with sufficient size. Text labels adjacent to these colors use `text-primary` for the actual words.

**Severity backgrounds (card tints):**

| Severity | Hex | Usage |
|----------|-----|-------|
| Critical | `#FDF2F2` | Card background tint |
| High | `#FDF6F0` | Card background tint |
| Medium | `#FBF8EE` | Card background tint |
| Low | `#F0F5F0` | Card background tint |
| Info | `#F0F4F7` | Card background tint |

**Severity dots:**
- **Size:** 8px circle
- **Style:** Filled circle, single color, no border
- **Critical:** Filled + subtle box-shadow glow (`0 0 0 3px rgba(196,61,61,0.15)`)
- **Other levels:** Filled, no glow

### 2.6 Dark Mode

Warm dark, not cold dark. Think lacquered wood, not obsidian.

| Token | Light | Dark | Dark Name |
|-------|-------|------|-----------|
| `bg-primary` | `#FAF7F2` | `#2D2A26` | Kuro-nuri (黒塗, black lacquer) |
| `bg-secondary` | `#F3EEE8` | `#252220` | Keshizumi (消炭, spent charcoal) |
| `bg-tertiary` | `#EBE5DC` | `#1E1C1A` | Sumi (墨, ink) |
| `bg-elevated` | `#FFFFFF` | `#3A3632` | Ro (炉, hearth) |
| `border-subtle` | `#E8E2DA` | `#3D3935` | — |
| `border-default` | `#D4CEC6` | `#504A44` | — |
| `text-primary` | `#2C2825` | `#F3EEE8` | — |
| `text-secondary` | `#6B6560` | `#A6A09A` | — |
| `text-tertiary` | `#948E88` | `#7A756F` | — |
| `action-primary` | `#A28C73` | `#C4B49D` | Lightened for dark bg |
| `action-danger` | `#6C3524` | `#D4785E` | Lightened Tobi-iro |

**Sakura signal in dark mode:**
The petal colors *stay the same* — `#D4A0A7` on `#2D2A26` has **6.38:1 contrast**, making petals MORE striking against the dark. This is intentional: in dark mode, the sakura signal becomes a warm glow in the darkness, like lanterns at a night temple.

**Dark mode shadow:** `rgba(0, 0, 0, 0.3)` — shadows go darker but remain warm because the surfaces themselves are warm.

---

## 3. Typography

### Font Stack

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| **UI** | Inter | 400, 500, 600 | All interface text, body copy, labels |
| **Display** | Noto Serif JP | 400, 500 | Headlines, empty states, brand moments |
| **Code** | JetBrains Mono | 400, 500 | Code blocks, diffs, monospace values |

### Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `text-xs` | 11px / 0.6875rem | 1.3 | 400–500 | Fine print, timestamps, auxiliary |
| `text-sm` | 13px / 0.8125rem | 1.5 | 400–500 | Secondary info, table cells, metadata |
| `text-base` | 15px / 0.9375rem | 1.6 | 400–500 | Body text, input values, nav items |
| `text-md` | 17px / 1.0625rem | 1.5 | 500 | Emphasized body, card titles |
| `text-lg` | 20px / 1.25rem | 1.3 | 600 | Section headers |
| `text-xl` | 26px / 1.625rem | 1.2 | 600 | Page titles |
| `text-2xl` | 36px / 2.25rem | 1.15 | 500–600 | Hero display (serif) |
| `text-3xl` | 52px / 3.25rem | 1.05 | 400 | Landing hero (serif) |

> **Base is 15px, not 14px.** This is a deliberate ma decision — slightly larger base text creates more breathing room and feels less cramped than the SaaS-standard 14px.

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `tracking-tight` | -0.02em | Display/hero text |
| `tracking-normal` | 0 | Body text |
| `tracking-wide` | 0.04em | Labels, small caps |
| `tracking-wider` | 0.08em | Uppercase nav, badges |

### When to Use Each Font

- **Inter:** Everything in the product. Forms, tables, navigation, descriptions, buttons.
- **Noto Serif JP:** Only for display moments — page hero headlines, empty state messages ("No chirps yet / The garden is still"), the "Chirri" wordmark, and section titles on the landing page. Never in a button. Never in a table.
- **JetBrains Mono:** Code blocks, diff views, URLs in monitors list, technical values (hashes, timestamps). Use sparingly outside code contexts.

---

## 4. Spacing & Layout

### Ma-Based Spacing Scale

Built on a 4px base grid, biased generous. "When in doubt, add more space."

| Token | Value | Usage |
|-------|-------|-------|
| `space-0` | 0px | — |
| `space-1` | 4px | Hairline gaps, icon-to-text |
| `space-2` | 8px | Tight groups, inline elements |
| `space-3` | 12px | Form field gaps, list items |
| `space-4` | 16px | Standard rhythm, card gap |
| `space-5` | 20px | Sidebar padding |
| `space-6` | 24px | Card internal padding |
| `space-8` | 32px | Section gaps, page margin |
| `space-10` | 40px | Major breaks |
| `space-12` | 48px | Page sections |
| `space-16` | 64px | Hero breathing room |
| `space-20` | 80px | Landing sections |
| `space-24` | 96px | Mega sections |

### Bento Grid Specifications

The dashboard uses CSS Grid with asymmetric cells:

```css
/* Main dashboard layout */
.dashboard-grid {
  display: grid;
  grid-template-columns: 200px 1fr;      /* Sidebar + content */
  grid-template-rows: auto 1fr;
  min-height: 100vh;
}

/* Content area — bento layout */
.content-bento {
  display: grid;
  grid-template-columns: 1fr 1fr 320px;  /* Asymmetric: main | secondary | sidebar info */
  grid-template-rows: auto auto 1fr;
  gap: 16px;
  padding: 32px;
}

/* Key bento cells */
.bento-main    { grid-column: 1 / 3; }   /* Spans 2 cols — diff/changelog */
.bento-sidebar { grid-column: 3; grid-row: 1 / -1; }  /* Full height right */
.bento-wide    { grid-column: 1 / -1; }  /* Full width — tables */
```

### Component Spacing Constants

| Element | Padding | Gap |
|---------|---------|-----|
| Card internal | 24px | — |
| Card-to-card | — | 16px |
| Sidebar width | — | 200px |
| Sidebar item padding | 10px 20px | 4px between items |
| Sidebar group gap | — | 32px |
| Form field gap | — | 16px |
| Page margin | 32px | — |
| Section gap | 48px | — |
| Table row height | 12px vert | — |
| Table cell padding | 12px 16px | — |
| Modal padding | 32px | — |
| Toast padding | 16px 20px | — |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-sm` | 3px | Buttons, inputs, badges |
| `radius-md` | 6px | Cards, dropdowns, modals |
| `radius-lg` | 10px | Large panels, popovers |
| `radius-full` | 9999px | Pills, avatar circles, dots |

> Not using large radii. The aesthetic is slightly softened edges — like sanded wood joinery. 3–6px communicates "precise craft," not "friendly SaaS bubble."

---

## 5. Components

### 5.1 Buttons

**No pink on any button. Ever.**

#### Primary Button (Cha-nezumi)
```
Background:    #A28C73 (Cha-nezumi)
Text:          #FFFFFF at 15px/600
Border:        none
Radius:        3px
Padding:       10px 24px
Height:        40px
```
| State | Background | Text | Border |
|-------|-----------|------|--------|
| Default | `#A28C73` | `#FFFFFF` | none |
| Hover | `#8A7461` | `#FFFFFF` | none |
| Active/Pressed | `#7A6451` | `#FFFFFF` | none |
| Disabled | `#D4CEC6` | `#A6A09A` | none |
| Focus | `#A28C73` | `#FFFFFF` | `0 0 0 3px rgba(162,140,115,0.3)` |

#### Secondary Button (Outlined)
```
Background:    transparent
Text:          #6B6560
Border:        1.5px solid #D4CEC6
```
| State | Background | Text | Border |
|-------|-----------|------|--------|
| Default | transparent | `#6B6560` | `#D4CEC6` |
| Hover | `#F3EEE8` | `#2C2825` | `#A28C73` |
| Active | `#EBE5DC` | `#2C2825` | `#8A7461` |
| Disabled | transparent | `#C4BEB8` | `#E8E2DA` |

#### Ghost Button (Text-only)
```
Background:    transparent
Text:          #6B6560
Border:        none
Padding:       10px 16px
```
| State | Background | Text |
|-------|-----------|------|
| Default | transparent | `#6B6560` |
| Hover | `#F3EEE8` | `#2C2825` |
| Active | `#EBE5DC` | `#2C2825` |

#### Danger Button (Tobi-iro)
```
Background:    #6C3524 (Tobi-iro)
Text:          #FFFFFF at 15px/600
Border:        none
```
| State | Background | Text |
|-------|-----------|------|
| Default | `#6C3524` | `#FFFFFF` |
| Hover | `#5A2B1D` | `#FFFFFF` |
| Active | `#4A2318` | `#FFFFFF` |
| Disabled | `#D4CEC6` | `#A6A09A` |

> **Why Tobi-iro for danger:** At 9.67:1 contrast, it's *more* accessible than Bootstrap's red. The warm red-brown reads as "this is serious" without the alarm-bell aggression of saturated red. It's the color of temple gate wood and iron oxide — authoritative, not panicky.

#### Danger Secondary (Outlined)
```
Background:    transparent
Text:          #6C3524
Border:        1.5px solid #6C3524
```

### 5.2 Checkboxes

Uses Cha-nezumi for checked state.

```
Size:          18×18px
Radius:        3px
Border:        1.5px solid #CFC6B8 (unchecked)
Check mark:    2px white stroke, rotated L-shape
```

| State | Background | Border | Check |
|-------|-----------|--------|-------|
| Unchecked | `#FFFFFF` | `#CFC6B8` | none |
| Checked | `#A28C73` | `#A28C73` | white stroke |
| Hover (unchecked) | `#FFFFFF` | `#A28C73` | none |
| Disabled unchecked | `#F0EBE3` | `#E8E2DA` | none |
| Disabled checked | `#C4BEB8` | `#C4BEB8` | `#E8E2DA` stroke |
| Focus ring | — | — | `0 0 0 3px rgba(162,140,115,0.3)` |

### 5.3 Radio Buttons

```
Size:          18×18px
Shape:         Circle
Border:        1.5px solid #CFC6B8 (unselected)
Inner dot:     7px circle
```

| State | Background | Border | Dot |
|-------|-----------|--------|-----|
| Unselected | `#FFFFFF` | `#CFC6B8` | none |
| Selected | `#FFFFFF` | `#A28C73` | `#A28C73` |
| Hover | `#FFFFFF` | `#A28C73` | none |
| Disabled | `#F0EBE3` | `#E8E2DA` | `#C4BEB8` |

### 5.4 Toggles

```
Track:         36×20px, radius 10px
Knob:          14×14px circle, white
Shadow:        0 1px 3px rgba(44,40,37,0.12) on knob
```

| State | Track | Knob Position |
|-------|-------|---------------|
| Off | `#D4CEC6` | left: 3px |
| On | `#A28C73` | left: 19px |
| Hover (off) | `#C4BEB8` | left: 3px |
| Hover (on) | `#8A7461` | left: 19px |
| Disabled off | `#E8E2DA` | left: 3px, 50% opacity |
| Disabled on | `#C4BEB8` | left: 19px, 50% opacity |

### 5.5 Text Inputs

Bottom-border style inspired by writing on paper.

```
Height:        40px
Font:          15px Inter 400
Padding:       10px 0 (bottom-border style) or 10px 14px (boxed style)
Border:        bottom 1.5px solid #CFC6B8 (or full box)
```

| State | Border | Text | Placeholder |
|-------|--------|------|-------------|
| Default | `#CFC6B8` | `#2C2825` | `#A6A09A` |
| Focus | `#A28C73` (2px) | `#2C2825` | `#A6A09A` |
| Error | `#C43D3D` | `#2C2825` | — |
| Disabled | `#E8E2DA` | `#C4BEB8` | `#D4CEC6` |

**Boxed variant** (for forms with multiple fields): full border `1.5px solid #CFC6B8`, radius 3px, padding `10px 14px`. Same state colors.

### 5.6 Custom Dropdowns

No native `<select>`. Always custom.

```
Trigger:       Same dimensions as text input (boxed)
                Right chevron: ▾ in text-secondary
Dropdown:      bg #FFFFFF, border 1px #E8E2DA, radius 6px
                Shadow: warm-lg
                Max-height: 280px (scrollable)
Item:          padding 10px 14px, font 15px/400
```

| State | Style |
|-------|-------|
| Trigger default | bg `#FFFFFF`, border `#CFC6B8` |
| Trigger open | border `#A28C73`, shadow warm-md |
| Item hover | bg `#F3EEE8` |
| Item selected | bg `#F0EBE3`, text `#2C2825` 500 weight, ✓ in `#A28C73` |
| Item disabled | text `#C4BEB8` |

### 5.7 Cards

```
Background:    #FFFFFF
Border:        1px solid #E8E2DA
Radius:        6px
Padding:       24px
Shadow:        warm-sm (default), warm-md (hover)
```

| State | Border | Shadow | Notes |
|-------|--------|--------|-------|
| Default | `#E8E2DA` | warm-sm | — |
| Hover | `#D4CEC6` | warm-md | Subtle lift |
| Selected | `#A28C73` (left 3px) | warm-md | Cha-nezumi left accent |
| Focused | — | `0 0 0 3px rgba(162,140,115,0.3)` | Keyboard focus |

**Severity card variants:**
Add a left border that increases in width with severity:

| Severity | Left Border | Background | Border Color |
|----------|-------------|------------|-------------|
| Info | 3px | white | `#527090` (Hanada) |
| Low | 3px | white | `#4D7A4D` (Matsu) |
| Medium | 4px | white | `#A89030` (Ukon) |
| High | 5px | `#FDF6F0` | `#C47A3D` (Kaki) |
| Critical | 6px | `#FDF2F2` | `#C43D3D` (Aka) |

The width increase is the "ink weight" metaphor — a calligrapher pressing harder for urgency.

### 5.8 Navigation Sidebar

```
Width:         200px
Background:    #F3EEE8 (Shironeri)
Padding:       20px
Border-right:  1px solid #E8E2DA
```

- **Logo:** "Chirri" in Noto Serif JP 400, 18px, `text-primary`. Top of sidebar.
- **Nav items:** Inter 500, 15px, `text-secondary`. Padding `10px 16px`.
- **Active item:** `text-primary` color, 600 weight, 3px left border in `#A28C73`, bg `rgba(162,140,115,0.08)`
- **Hover:** bg `rgba(162,140,115,0.05)`, text `text-primary`
- **Group labels:** 11px, 600 weight, `text-tertiary`, tracking-wider, uppercase
- **Group gap:** 28px between groups
- **Bottom 30%:** Empty. This is intentional ma.

### 5.9 Tabs

```
Style:         Underline tabs (not boxed)
Height:        40px
Font:          15px Inter 500
Gap:           24px between tabs
```

| State | Text | Border-bottom |
|-------|------|---------------|
| Default | `text-secondary` | none |
| Hover | `text-primary` | 2px `#D4CEC6` |
| Active | `text-primary` 600 | 2px `#A28C73` |

### 5.10 Badges & Tags

```
Font:          11px Inter 600
Padding:       3px 8px
Radius:        3px
```

**Filled badge:** bg `#A28C73`, text white
**Subtle badge:** bg `#F0EBE3`, text `#7A6451`
**Severity badges:** Use severity color as bg, white text. Radius-full (pill) for count badges.

| Variant | Background | Text |
|---------|-----------|------|
| Default | `#F0EBE3` | `#7A6451` |
| Critical | `#C43D3D` | `#FFFFFF` |
| High | `#C47A3D` | `#FFFFFF` |
| Medium | `#A89030` | `#FFFFFF` |
| Low | `#4D7A4D` | `#FFFFFF` |
| Info | `#527090` | `#FFFFFF` |

### 5.11 Status Dots

```
Default:       8px circle, filled with severity color
Chirp dot:     8px circle, #C87680 (signal-petal-deep), with pulse animation
```

**Chirp dot animation:**
```css
@keyframes chirp-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(200,118,128,0.4); }
  50% { box-shadow: 0 0 0 6px rgba(200,118,128,0); }
}
.dot-chirp {
  animation: chirp-pulse 2s ease-in-out infinite;
}
```

This is the ONLY pulsing animation in the entire UI. It draws the eye precisely because nothing else moves.

### 5.12 Toast Notifications

```
Position:      Bottom-right, 24px from edge
Width:         360px max
Background:    #FFFFFF
Border:        1px solid #E8E2DA
Radius:        6px
Shadow:        warm-lg
Padding:       16px 20px
```

**Structure:** Left severity bar (3px) + icon + message + optional action link + dismiss ×

| Type | Left Bar | Icon Color |
|------|----------|------------|
| Success | `#4D7A4D` | `#4D7A4D` |
| Error | `#C43D3D` | `#C43D3D` |
| Warning | `#C47A3D` | `#C47A3D` |
| Info | `#527090` | `#527090` |
| Chirp | `#C87680` | `#C87680` + pulse |

**Toast entrance:** Slide up 8px + fade in, 200ms ease-enter.
**Toast exit:** Fade out, 150ms ease-exit.

### 5.13 Modals

```
Overlay:       rgba(44, 40, 37, 0.4) — warm, not cold black
Panel:         bg #FFFFFF, radius 10px, shadow warm-xl
Width:         480px (small), 640px (medium), 800px (large)
Padding:       32px
```

- **Header:** `text-xl` (26px/600), no border, 24px margin-bottom
- **Body:** `text-base` (15px/400), `text-secondary` for descriptions
- **Footer:** Top border `#E8E2DA`, padding-top 24px, buttons right-aligned
- **Close button:** Top-right, ghost style, × icon in `text-tertiary`

### 5.14 Tables

```
Background:    #FFFFFF (card)
Header:        bg #F3EEE8, text 11px/600 uppercase tracking-wider, text-tertiary
Row:           height 48px, padding 12px 16px
Border:        bottom 1px #E8E2DA between rows
```

| State | Background | Notes |
|-------|-----------|-------|
| Default | `#FFFFFF` | — |
| Hover | `#FAF7F2` | Subtle kinari tint |
| Selected | `#F0EBE3` | Cha-nezumi subtle |
| Zebra (optional) | alternating `#FFFFFF` / `#FAF7F2` | — |

### 5.15 Empty States

Where poetry lives. This is a petal-appropriate zone.

```
Layout:        Centered, max-width 400px
Text:          Noto Serif JP 400, 17px, text-secondary
              Two lines, haiku-like cadence
Petal:         Single fallen petal SVG, 20×20px, #D4A0A7
              Positioned slightly off-center (fukinsei)
CTA:           Secondary button below text, 16px gap
```

**Example messages:**
- "No changes detected.\nWatch a path to begin."
- "No chirps yet.\nThe garden is still."
- "All clear.\nNothing requires attention."

---

## 6. Sakura Signal Moments — The 1-2%

### 6.1 Petal Drift Animation (Landing Page Hero)

```
Petal count:   3-5 simultaneously
Petal size:    16-24px (randomized)
Color:         #D4A0A7 at 40-70% opacity (randomized)
Duration:      5-8 seconds per petal (randomized)
Path:          Gentle sinusoidal drift, top-to-bottom + slight horizontal sway
Rotation:      0° → 90-180° over lifetime
Easing:        cubic-bezier(0.37, 0, 0.63, 1) — natural float
Stagger:       Each petal starts 1-3s after the previous
```

**CSS animation:**
```css
@keyframes petal-drift {
  0%   { transform: translate(0, -20px) rotate(0deg) scale(1);   opacity: 0; }
  8%   { opacity: 0.6; }
  50%  { transform: translate(30px, 40vh) rotate(60deg) scale(0.9);  opacity: 0.4; }
  100% { transform: translate(-10px, 90vh) rotate(140deg) scale(0.7); opacity: 0; }
}
```

**The petal SVG** (one reusable shape):
```svg
<svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 0C10 0 13 6 13 10C13 14 10 17 10 17C10 17 7 14 7 10C7 6 10 0 10 0Z"
        opacity="0.8"/>
  <path d="M10 3C10 3 15 7 15 10C15 13 10 14 10 14C10 14 5 13 5 10C5 7 10 3 10 3Z"
        opacity="0.5" transform="rotate(45 10 10)"/>
</svg>
```

### 6.2 Chirp Indicator Dot

When a new change is detected, a small pink dot appears next to the monitor name.

```
Size:          8px circle
Color:         #C87680 (signal-petal-deep)
Pulse:         chirp-pulse animation, 2s infinite
Entrance:      Scale from 0 → 1, 300ms ease-enter
Exit:          Fade out when user acknowledges, 200ms
```

This dot is the ONLY pulsing element. In a sea of warm stillness, the pulse says "something alive happened."

### 6.3 Signal Received Pulse

When a check completes and returns results:

```
Element:       The status dot for that monitor
Effect:        Single expanding ring, 600ms
Ring color:    rgba(212,160,167,0.3) → rgba(212,160,167,0) (fade out)
Ring max size: 24px diameter from 8px dot center
Trigger:       Once per check completion, does not repeat
```

### 6.4 Favicon Notification

```
Base favicon:  Simple "C" in Cha-nezumi on transparent
Notification:  8px circle in #C87680, positioned top-right of favicon
Trigger:       When unread chirps exist
Clear:         When user views the chirps
```

### 6.5 Empty State Petal

A single, static, fallen petal illustration. Not animated — it's *resting*.

```
Size:          20×20px
Color:         #D4A0A7 at 60% opacity
Position:      Below the empty state text, offset 8px left of center (fukinsei)
Rotation:      Slight random rotation (15-30°)
```

### 6.6 First-Chirp Celebration

The very first time a user's monitor detects a change:

```
Effect:        3 petals drift down across the viewport (like the landing page hero)
Duration:      4 seconds total
Trigger:       Once per user account, ever
Dismissal:     Petals naturally fade; clicking anywhere accelerates fade
```

This is a *datsuzoku* moment — a break from the professional norm that marks a milestone. The user will remember it.

### 6.7 Where Else? (Considered and Rejected)

| Idea | Verdict | Reason |
|------|---------|--------|
| Petal on successful deploy | ❌ Rejected | Too frequent, loses specialness |
| Petal loading spinner | ❌ Rejected | Loading is utilitarian, not magical |
| Petal in chart tooltips | ❌ Rejected | Data density zone, no decoration |
| Petal confetti on milestone (100 chirps) | ✅ Maybe | Rare enough to be special. TBD. |
| Petal watermark on PDF reports | ✅ Maybe | Subtle brand touch on exports. TBD. |

---

## 7. Accessibility

### Contrast Ratios — Complete Audit

#### Light Mode (on Kinari #FAF7F2)

| Element | Foreground | Ratio | WCAG | Notes |
|---------|-----------|-------|------|-------|
| Body text | `#2C2825` | 13.67:1 | ✅ AAA | — |
| Secondary text | `#6B6560` | 5.38:1 | ✅ AA | — |
| Tertiary text | `#948E88` | 3.18:1 | ⚠️ AA-large | Only for ≥18px or ≥14px bold |
| Cha-nezumi on kinari | `#A28C73` | 3.01:1 | ⚠️ AA-large | Buttons use ≥15px/600 |
| Cha-nezumi on white card | `#A28C73` | 3.21:1 | ⚠️ AA-large | — |
| White on Cha-nezumi btn | `#FFF` on `#A28C73` | 3.21:1 | ⚠️ AA-large | Button text is 15px/600 |
| White on Tobi-iro btn | `#FFF` on `#6C3524` | 9.67:1 | ✅ AAA | Excellent |
| Enji on white | `#B94047` | 5.40:1 | ✅ AA | — |
| Severity critical | `#C43D3D` | 5.14:1 | ✅ AA | — |
| Severity low | `#4D7A4D` | 4.85:1 | ✅ AA | — |
| Severity info | `#527090` | 4.86:1 | ✅ AA | — |

#### Cha-nezumi Accessibility Strategy

Raw Cha-nezumi (#A28C73) at 3.01–3.21:1 passes **AA-large** but not AA for normal text. Our approach:

1. **Buttons:** Text is always ≥15px and semi-bold (600), qualifying as "large text" under WCAG. ✅ Passes.
2. **Text labels in Cha-nezumi:** Not allowed. Never set text color to `#A28C73` at body size.
3. **Darkened text variant:** When referencing the primary color in text (e.g., active nav, link), use `#7A6451` (5.57:1 AA ✅).
4. **Focus rings:** 3px offset at 30% opacity — visible enough for focus, doesn't need text contrast ratio.
5. **Non-text elements** (checkboxes, toggles, borders): WCAG requires 3:1 for UI components. `#A28C73` at 3.21:1 on white ✅ passes.

#### Dark Mode (on #2D2A26)

| Element | Foreground | Ratio | WCAG |
|---------|-----------|-------|------|
| Primary text | `#F3EEE8` | 12.38:1 | ✅ AAA |
| Secondary text | `#A6A09A` | 4.44:1 | ✅ AA-large |
| Cha-nezumi lightened | `#C4B49D` | 7.05:1 | ✅ AA |
| Sakura signal | `#D4A0A7` | 6.38:1 | ✅ AA |

### Additional Accessibility Notes

- **Never use color alone** for severity. Every severity has: color + border width + text label.
- **Focus visible:** All interactive elements have a visible focus ring (3px offset, `rgba(162,140,115,0.3)` on light, `rgba(196,180,157,0.3)` on dark).
- **Motion:** Petal animations respect `prefers-reduced-motion: reduce` — replace with static petal or remove entirely.
- **Screen readers:** Severity dots include `aria-label` with severity name. Chirp pulse includes "New change detected" label.

---

## 8. Design Tokens (Tailwind Config)

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Warm Neutrals
        kinari:       '#FAF7F2',  // 生成 — raw silk (bg-primary)
        shironeri:    '#F3EEE8',  // 白練 — refined white (bg-secondary)
        torinoko:     '#EBE5DC',  // 鳥の子 — eggshell (bg-tertiary)

        // Text
        kurocha:      '#2C2825',  // 黒茶 — black tea (text-primary)
        nibi:         '#6B6560',  // 鈍 — muted (text-secondary)
        nezumi:       '#948E88',  // 鼠 — mouse grey (text-tertiary)
        hai:          '#A6A09A',  // 灰 — ash (text-muted)

        // Brand: Cha-nezumi Path
        cha: {
          DEFAULT:    '#A28C73',  // 茶鼠 — primary action
          hover:      '#8A7461',  // 狐茶 — hover
          active:     '#7A6451',  // 媚茶 — pressed/active
          subtle:     '#F0EBE3',  // 絹鼠 — subtle background
          border:     '#CFC6B8',  // Control borders
          text:       '#7A6451',  // AA-compliant text variant
        },

        // Brand: Tobi-iro Path (Emphasis/Danger)
        tobi: {
          DEFAULT:    '#6C3524',  // 鳶色 — kite bird brown
          hover:      '#5A2B1D',  // 栗梅 — hover
          active:     '#4A2318',  // 栗色 — pressed
          subtle:     '#F5EEEB',  // Subtle background
        },

        // Extended Browns & Reds
        enji:         '#B94047',  // 臙脂 — cochineal crimson
        akacha:       '#8F4B38',  // 赤茶 — red tea
        bengara:      '#8B2500',  // 弁柄 — iron oxide
        kuri:         '#762F07',  // 栗色 — chestnut

        // Sakura Signal (THE 1-2%)
        sakura: {
          DEFAULT:    '#D4A0A7',  // 桜鼠 — cherry grey
          soft:       '#F0E0E3',  // 薄桜 — pale cherry
          deep:       '#C87680',  // Chirp dot
          glow:       'rgba(212,160,167,0.2)',
        },

        // Severity (Nature-derived)
        severity: {
          critical:   '#C43D3D',  // 赤 aka — autumn maple
          high:       '#C47A3D',  // 柿 kaki — persimmon
          medium:     '#A89030',  // 鬱金 ukon — turmeric
          low:        '#4D7A4D',  // 松 matsu — pine
          info:       '#527090',  // 縹 hanada — mountain sky
        },

        // Severity Backgrounds
        'sev-bg': {
          critical:   '#FDF2F2',
          high:       '#FDF6F0',
          medium:     '#FBF8EE',
          low:        '#F0F5F0',
          info:       '#F0F4F7',
        },

        // Borders
        'b-subtle':   '#E8E2DA',
        'b-default':  '#D4CEC6',
        'b-strong':   '#9E9890',

        // Dark Mode
        dark: {
          bg:         '#2D2A26',  // 黒塗 kuro-nuri
          surface:    '#252220',  // 消炭 keshizumi
          deep:       '#1E1C1A',  // 墨 sumi
          elevated:   '#3A3632',  // 炉 ro
          border:     '#504A44',
          'border-subtle': '#3D3935',
        },
      },

      fontFamily: {
        ui:       ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display:  ['"Noto Serif JP"', '"Noto Serif"', 'Georgia', 'serif'],
        mono:     ['"JetBrains Mono"', '"Fira Code"', '"SF Mono"', 'monospace'],
      },

      fontSize: {
        'xs':     ['0.6875rem', { lineHeight: '1.3' }],   // 11px
        'sm':     ['0.8125rem', { lineHeight: '1.5' }],   // 13px
        'base':   ['0.9375rem', { lineHeight: '1.6' }],   // 15px
        'md':     ['1.0625rem', { lineHeight: '1.5' }],   // 17px
        'lg':     ['1.25rem',   { lineHeight: '1.3' }],   // 20px
        'xl':     ['1.625rem',  { lineHeight: '1.2' }],   // 26px
        '2xl':    ['2.25rem',   { lineHeight: '1.15' }],  // 36px
        '3xl':    ['3.25rem',   { lineHeight: '1.05' }],  // 52px
      },

      letterSpacing: {
        tighter:  '-0.02em',
        wide:     '0.04em',
        wider:    '0.08em',
      },

      borderRadius: {
        sm:       '3px',
        md:       '6px',
        lg:       '10px',
      },

      boxShadow: {
        'warm-sm': '0 1px 2px rgba(44, 40, 37, 0.06)',
        'warm-md': '0 2px 8px rgba(44, 40, 37, 0.08)',
        'warm-lg': '0 4px 16px rgba(44, 40, 37, 0.10)',
        'warm-xl': '0 8px 32px rgba(44, 40, 37, 0.12)',
      },

      spacing: {
        // Ma-biased additions
        '4.5':    '1.125rem',  // 18px
        '5.5':    '1.375rem',  // 22px
        '18':     '4.5rem',    // 72px
        '22':     '5.5rem',    // 88px
      },

      animation: {
        'petal-drift':  'petal-drift 6s cubic-bezier(0.37, 0, 0.63, 1) infinite',
        'chirp-pulse':  'chirp-pulse 2s ease-in-out infinite',
        'signal-ring':  'signal-ring 600ms ease-out forwards',
      },

      keyframes: {
        'petal-drift': {
          '0%':   { transform: 'translateY(-20px) rotate(0deg) scale(1)', opacity: '0' },
          '8%':   { opacity: '0.6' },
          '50%':  { transform: 'translateY(40vh) rotate(60deg) scale(0.9)', opacity: '0.4' },
          '100%': { transform: 'translateY(90vh) rotate(140deg) scale(0.7)', opacity: '0' },
        },
        'chirp-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(200,118,128,0.4)' },
          '50%':      { boxShadow: '0 0 0 6px rgba(200,118,128,0)' },
        },
        'signal-ring': {
          '0%':   { boxShadow: '0 0 0 0 rgba(212,160,167,0.3)' },
          '100%': { boxShadow: '0 0 0 12px rgba(212,160,167,0)' },
        },
      },
    },
  },
  plugins: [],
}
```

---

## 9. Do's and Don'ts

### ✅ DO

- **Use warm neutrals for everything.** If you're reaching for `#F5F5F5`, use `#FAF7F2` instead.
- **Leave generous space.** If something feels tight, add 8px more padding. Ma is content.
- **Use Cha-nezumi (#A28C73) for primary actions.** Buttons, checked controls, active states.
- **Use Tobi-iro (#6C3524) only for destructive actions.** Delete, remove, cancel subscription.
- **Let severity speak through border weight.** Thin line = calm, thick line = urgent.
- **Use Noto Serif JP sparingly.** Display text, empty states, the logo. That's it.
- **Respect the washi grain.** Apply at 3% opacity on primary backgrounds. It's felt, not seen.
- **Dark mode = warm dark.** `#2D2A26`, never `#000` or blue-black.

### ❌ DON'T

- **Never use pink for buttons, links, badges, borders, or any persistent UI.**
- **Never use Noto Serif JP for body text, table cells, or form labels.**
- **Never use cold greys.** No `#F5F5F5`, `#E5E7EB`, `#6B7280`. Always warm.
- **Never use saturated red (#EF4444) for danger.** Use Tobi-iro instead.
- **Never add a second pulsing animation.** The chirp dot is the ONLY pulse.
- **Never center everything.** Use fukinsei (asymmetry) — off-center, bento, weighted layouts.
- **Never use more than 5 petals at once.** The landing hero maximum is 5.
- **Never animate petals on dashboard screens.** Except the chirp notification.

### 🤔 When in Doubt

1. **"Should this be pink?"** — No. Unless it's in the Sakura Signal Moments list (Section 6), it's not pink.
2. **"Is this too much space?"** — Probably not. Chirri has 30-40% more whitespace than typical tools. That's the point.
3. **"Should I use serif here?"** — Only if it's a display/brand moment. If it's functional UI, use Inter.
4. **"Primary or secondary button?"** — One primary per visible context. Everything else is secondary or ghost.
5. **"Which severity color?"** — Border weight first, color second, background tint only for high/critical.
6. **"Do I need a custom dropdown?"** — Yes. Always. No native selects.
7. **"Tobi-iro or regular danger?"** — If the action destroys data, Tobi-iro. If it's just a warning, use Cha-nezumi secondary + warning icon.

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using sakura pink for active nav item | Use Cha-nezumi left border + weight change |
| Making dark mode #1A1A1A (cold) | Use #2D2A26 (warm lacquer) |
| Adding border-radius: 12px to cards | Use 6px. Craft, not bubbles. |
| Putting Noto Serif in a table header | Use Inter 600 + uppercase + wide tracking |
| Using opacity for disabled states only | Use muted colors + reduced opacity together |
| Adding pink hover glow to buttons | Cha-nezumi darkens on hover, no glow |
| Making severity dots > 10px | 8px. Small and meaningful. |

---

## Appendix A: The Browns & Reds Palette — Extended Exploration

Alex expressed interest in how traditional Japanese browns and reds integrate. Here's the full family:

### The Warmth Gradient

```
Cool ←———————————————————————————————————→ Warm
                                                  
Hanada    Matsu    Cha-nezumi    Tobi-iro    Enji    Bengara
#527090   #4D7A4D   #A28C73     #6C3524    #B94047  #8B2500
(sky)     (pine)    (tea)       (earth)    (gate)   (oxide)
```

This gradient maps to the emotional arc of Chirri interactions:

- **Calm monitoring** → Cha-nezumi (tea, patience, daily ritual)
- **Something changed** → Sakura signal (fleeting beauty)
- **Action needed** → Tobi-iro if destructive (temple authority)
- **Critical alert** → Enji or Aka (the red of autumn before winter)

### Dual Accent in Practice

```
╔══════════════════════════════════════╗
║  Monitor: api.example.com           ║
║  Status: ● Watching                 ║  ← Cha-nezumi dot
║                                     ║
║  [Run Check]  [Edit]  [Delete]      ║
║   ↑ Cha       ↑ Ghost  ↑ Tobi-iro  ║
║                                     ║
║  Last chirp: 2 changes detected     ║
║  ◉ ← chirp dot (sakura pulse)      ║
╚══════════════════════════════════════╝
```

The three systems never compete:
- **Cha-nezumi:** "Here's something you can do"
- **Tobi-iro:** "Here's something serious"
- **Sakura:** "Here's something alive"

---

*"The stone garden is complete when there is nothing left to remove."*
*— And then one petal falls.*
