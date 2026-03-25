# CHIRRI PINK DIET
## Where Sakura Pink Earns Its Place

**Author:** HANA — Lead Designer
**Date:** 2026-03-24
**Status:** Definitive. Apply to all existing and future components.

> *A single cherry blossom petal on a stone garden. That's the ratio.*

The current design system uses sakura pink (#FFB7C5) in **23+ elements**. That's not an accent color — that's wallpaper. When everything is pink, nothing is. This document cuts pink down to **7 approved uses** and replaces everything else with neutrals.

---

## THE RULE

> **Pink is reserved for primary actions, the brand mark, and one celebratory moment. Everything else is neutral.**

A developer's test: *"Would removing pink from this element reduce the user's ability to identify the primary action or recognize the brand?"* If no, use neutral.

---

## THE PINK MAP

### ✅ PINK — Approved Uses (7 elements)

| # | Element | Color | Why It Earns Pink |
|---|---------|-------|-------------------|
| 1 | **Primary CTA button** | `#FFB7C5` bg, `#1A1A1A` text | The single most important action on any screen. Pink means "do this." One pink button per view — no exceptions. |
| 2 | **Landing page glassmorphic CTA** | `rgba(255,183,197,0.15)` glass | Brand hero moment. This is the user's first impression. Pink here says "we're different." |
| 3 | **Landing page floating petals** | `#FFB7C5` / `#FFD4DE` | THE brand moment. Petals are Chirri's visual identity. They exist only on the landing page and the V2 Garden View chirp animation. Nowhere else. |
| 4 | **Logo / wordmark accent** | `#FFB7C5` | Brand identity. The chirri logo carries pink. Always. |
| 5 | **V2 Garden View — chirp petals** | `#FFB7C5` | When a chirp fires in Garden View, petals fall from that tree. Celebratory, rare, meaningful — pink earned through event significance. |
| 6 | **Empty state illustration accent** | `#FFB7C5` at 15% opacity | "Plant your first seed" — a whisper of pink in the onboarding illustration. Not a button, not a border. Just a blush of brand warmth in an otherwise empty space. |
| 7 | **Pricing "Most Popular" badge** | `#FFB7C5` bg, white text | One badge on one card. Draws the eye to the recommended plan. Small surface area, high intent. |

### ❌ NOT PINK — Use Neutral/Dark Instead (16 elements removed)

| # | Element | Old | New | Rationale |
|---|---------|-----|-----|-----------|
| 1 | **Secondary button** | — | Stays `--bg-tertiary` / neutral | Already correct. No change needed. |
| 2 | **Ghost button** | — | Stays transparent / Stone text | Already correct. No change needed. |
| 3 | **Checkbox checked state** | Sakura bg + white check | `#1A1A1A` (Ink) bg + white check (light mode), `#FAFAFA` bg + dark check (dark mode) | Checkboxes are utilitarian. A form full of pink checkboxes is visual noise. Dark checked state is cleaner (see: Linear, Vercel, Stripe — all use dark/brand-neutral for checks). |
| 4 | **Radio selected state** | Sakura border + Sakura fill | `#1A1A1A` border + `#1A1A1A` inner dot (light), inverse in dark | Same rationale as checkbox. Radios are infrastructure, not brand expression. |
| 5 | **Toggle on state** | Sakura track | `#1A1A1A` track (light), `#FAFAFA` track (dark) | Toggles appear in settings pages with 5-10 toggles visible at once. A column of pink switches looks like a candy store. Dark on-state is sophisticated. (Reference: Linear's toggles, iOS uses green — neither uses brand pink.) |
| 6 | **Focus ring** | Sakura glow | `rgba(0,0,0,0.15)` ring (light), `rgba(255,255,255,0.2)` ring (dark) | Focus rings appear on EVERY interactive element. Pink focus rings mean pink everywhere the user tabs. Use subtle neutral rings. The current grey approach was actually correct — formalize it. |
| 7 | **Button focus ring** | Sakura 2px ring | Same neutral ring as all focus states | Consistency. All focus rings are neutral. No exceptions. |
| 8 | **Select dropdown hover** | Blossom (`#FFD4DE`) highlight | `var(--bg-tertiary)` (light grey / dark grey) | Hover states are transient. They shouldn't carry brand weight. Grey hover is standard (Linear, Stripe). |
| 9 | **Active sidebar item** | Sakura text + Sakura left border | **Ink/Snow text (bold weight 500)** + `var(--bg-tertiary)` bg. No colored border. | Sidebar is persistent UI chrome. Pink in the sidebar means permanent pink on screen at all times. Use text weight and subtle background to indicate active state. (Reference: Linear uses bold text + subtle bg, no color accent.) |
| 10 | **Active tab underline** | Sakura 2px bottom border | `var(--text-primary)` (Ink/Snow) 2px bottom border | Tabs are navigation infrastructure. Dark underline is more sophisticated and doesn't compete with the primary CTA. (Reference: Stripe uses dark underlines.) |
| 11 | **Breadcrumb current** | — | Stays Ink (already correct) | No change needed. Already using dark text for current segment. |
| 12 | **Selected/active card** | Pink border or tint implied | `2px solid var(--border)` + `shadow-sm` elevation | Cards get selected constantly during triage workflows. Pink-bordered cards in a list of 20 changes creates a pink stripe. Use shadow lift + slightly stronger border for selection. |
| 13 | **Card hover state** | Blossom tint implied | `shadow-sm` + `var(--bg-tertiary)` subtle shift | Hover is the most transient state. Zero color. Just depth. |
| 14 | **Provider card accent** | Sakura implied | No accent color. Use shadow hierarchy only. | Provider cards are the most numerous element on the dashboard. Pink accents on every card = pink everywhere. |
| 15 | **Settings sub-nav active item** | Sakura left border | `var(--text-primary)` bold text + `var(--bg-tertiary)` bg | Same logic as sidebar. Persistent navigation shouldn't carry pink. |
| 16 | **Docs active nav** | Sakura accent | `var(--text-primary)` bold + subtle bg | Docs are reference material. Pink distracts from content. |

### ⚪ UNCHANGED — Already Correct

| Element | Current State | Verdict |
|---------|--------------|---------|
| **Status dots** | Semantic colors (red/orange/yellow/blue/green/grey) | ✅ Correct. Never pink. Status dots use severity colors exclusively. |
| **Signal detected pulse** | Grey dot pulsing | ✅ Correct. Pulse the dot's own color, not pink. |
| **Forecast dot** | Orchid (`#8B5CF6`) | ✅ Correct. Purple is the forecast color. Not pink. |
| **Severity badges** | Semantic color backgrounds | ✅ Correct. Severity = semantic colors only. |
| **Workflow state badges** | Neutral grey backgrounds | ✅ Correct. Keep neutral. |
| **Input borders** | Subtle grey `var(--border)` | ✅ Correct. Inputs are invisible until needed. |
| **Toast/notification colors** | Semantic (green/yellow/red/blue) | ✅ Correct. Notifications use meaning-colors, never brand-pink. |
| **Text links** | Should use `--color-sky` (`#3B82F6`) | ✅ Use sky blue for links. Blue is the universal "clickable" signal. Pink links would create confusion between brand accent and interactive affordance. |
| **Danger button** | Vermillion | ✅ Obviously stays red. |
| **Tree trunk/branches/roots** | `var(--border)` neutral lines | ✅ Correct. The tree is structural. Neutral lines, like a real tree's bark. |
| **Tree node dots** | Semantic status colors | ✅ Correct. The tree communicates health through its dots, not through pink. |
| **Change card left border** | Severity color (3px) | ✅ Correct. Severity-colored, not pink. |
| **Current plan badge** | Neutral approach | ✅ Keep as bold text or subtle bg. Not pink. The "Most Popular" badge on pricing already uses pink — the plan badge in sidebar should be neutral to avoid dilution. |

---

## ELEMENT-BY-ELEMENT SUMMARY

### Buttons
| Variant | Pink? | Color |
|---------|-------|-------|
| Primary CTA | **YES** | `#FFB7C5` bg |
| Secondary | No | `var(--bg-tertiary)` |
| Ghost | No | Transparent / Stone |
| Danger | No | Vermillion |
| Landing glassmorphic | **YES** | Sakura glass |

### Form Elements
| Element | Pink? | Color |
|---------|-------|-------|
| Checkbox checked | No | Ink bg, white check |
| Radio selected | No | Ink border + fill |
| Toggle on | No | Ink track |
| Focus ring (all) | No | Neutral subtle ring |
| Input borders | No | `var(--border)` grey |
| Select hover | No | `var(--bg-tertiary)` |

### Status & Severity
| Element | Pink? | Color |
|---------|-------|-------|
| All status dots | No | Semantic colors |
| Signal pulse | No | Own color pulsing |
| Forecast dot | No | Orchid purple |
| Severity badges | No | Semantic backgrounds |
| Workflow badges | No | Neutral grey |

### Navigation
| Element | Pink? | Color |
|---------|-------|-------|
| Active sidebar item | No | Bold text + subtle bg |
| Active tab | No | Dark underline |
| Breadcrumb current | No | Ink (bold) |
| Settings sub-nav | No | Bold text + subtle bg |

### Cards
| Element | Pink? | Color |
|---------|-------|-------|
| Selected card | No | Shadow lift + border |
| Hover state | No | Shadow + subtle bg |
| Provider accent | No | None (shadow hierarchy) |
| Pricing featured | **YES** | "Most Popular" badge only |

### Landing Page
| Element | Pink? | Color |
|---------|-------|-------|
| Hero CTA buttons | **YES** | Glassmorphic sakura |
| Floating petals | **YES** | Sakura / Blossom |
| Pricing highlight | No | Shadow elevation only (badge is pink, card border is not) |

### Other
| Element | Pink? | Color |
|---------|-------|-------|
| Logo/wordmark | **YES** | Brand pink |
| Text links | No | Sky blue |
| Toasts | No | Semantic colors |
| Tree structure | No | Neutral lines |
| Garden chirp petals (V2) | **YES** | Sakura petals |
| Empty state accent | **YES** | 15% opacity wash |

---

## CSS VARIABLE CHANGES

```css
/* REMOVE from active use in components: */
/* --color-blossom (#FFD4DE) — no longer used for hover states */
/* --color-petal (#FF8FA3) — no longer used for "active nav" or "stronger accent" */

/* KEEP but restrict: */
/* --color-sakura (#FFB7C5) — primary CTA + logo + landing + pricing badge ONLY */

/* ADD: */
--color-control-active: #1A1A1A;     /* Light mode: checked/on state for form controls */
--color-control-active-dark: #FAFAFA; /* Dark mode: checked/on state for form controls */

/* UPDATE descriptions in design tokens: */
/* --color-sakura: "Primary CTA buttons, logo, landing page brand moments only" */
/* --color-blossom: "Landing page petal animations only" */
/* --color-petal: "DEPRECATED — do not use in new components" */
```

---

## MIGRATION CHECKLIST

When implementing the Pink Diet, update these files/components:

- [ ] `Button` — keep Primary variant pink, confirm others neutral
- [ ] `Checkbox` — change checked bg from Sakura → Ink/Snow
- [ ] `Radio` — change selected state from Sakura → Ink/Snow
- [ ] `Toggle/Switch` — change on-track from Sakura → Ink/Snow
- [ ] `Sidebar NavItem` — remove Sakura text/border, use bold + bg
- [ ] `Tabs` — change active border from Sakura → text-primary
- [ ] `Select` — change hover highlight from Blossom → bg-tertiary
- [ ] `Settings sub-nav` — remove Sakura left border, use bold + bg
- [ ] `PricingCard` — remove Sakura border from featured card, keep badge only
- [ ] `Focus ring global styles` — confirm neutral ring, remove any Sakura references
- [ ] `design-system.html` — update component showcase to reflect new states
- [ ] `CHIRRI_FRONTEND_BIBLE.md` — update all color references per this document

---

## THE PHILOSOPHY

Before the diet: Sakura pink was the answer to every design question. *"How do we show this is active?"* Pink. *"How do we highlight this?"* Pink. *"How do we make this feel like Chirri?"* Pink.

After the diet: Pink is **earned**. It appears when the user needs to act (primary CTA), when we're making our first impression (landing page), and when something worth celebrating happens (chirp petals in Garden View). Everything else is the stone garden — quiet, grey, restrained — so that when pink appears, it's a petal landing on stone.

**The math:**
- Before: ~23 element types using pink = pink is background noise
- After: 7 approved uses = pink is a signal

**The feeling:**
A user scanning the dashboard sees calm greys, clear typography, semantic status colors. Their eye lands on exactly one pink element: the primary action button. They know what to do. That's the design working.

---

*If it doesn't need to be there, remove it.*
— HANA
