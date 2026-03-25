# CHIRRI FRONTEND BIBLE

**Version:** 1.3
**Date:** 2026-03-24
**Status:** Single Source of Truth for Frontend/UI
**Companion:** CHIRRI_BIBLE.md (Product + Backend Bible v2.4)

> **v1.3 Changelog (2026-03-24 — New MVP Features):** Added UI specs for 8 new MVP features. Changes marked with *(Added 2026-03-24 -- New MVP Features)*. New pages/sections: Dependency Graph page (§3.21), Migration Checklist UI in change detail (§4.9), Impact Analysis panel in change detail (§4.10), Security Flag badges on changes (§4.11), Notification Rules configuration page (§3.22), GitHub Integration settings page (§3.23), SDK/Package monitoring settings (§3.24).

> **v1.2 Changelog (2026-03-24 — Practical Review):** Applied all frontend-relevant findings from 4 Practical Review documents. Changes marked with *(Fixed 2026-03-24 -- Practical Review)*. Key additions: classification stage UI with SSE progress, "Shared" badge for shared monitoring, primary action buttons for all 13 error states, learning period live preview UX, downgrade URL selection UX.

> **v1.1 Changelog (2026-03-24 — UX Review):** Applied all findings from CHIRRI_FRONTEND_UX_REVIEW.md. 52 fixes across: time-to-value onboarding, URL list page spec, mobile diff viewer, notification deep-links, inline triage, source discovery UX, actionable forecasts, undo support, contextual help, keyboard shortcuts, global search, settings sub-nav, integration health, payment clarity, and more. All changes marked with *(Fixed 2026-03-24 -- UX Review)*.

This document is the definitive specification for all Chirri frontend development. A frontend developer reads this top to bottom and can build the entire UI without referencing any other document except the API contracts in CHIRRI_BIBLE.md Part 6.

---

## TABLE OF CONTENTS

- Part 1: Design Language
- Part 2: Component Library
- Part 3: Pages
- Part 4: The Money Screen -- Change Detail View
- Part 5: The Tree Visualization
- Part 6: Onboarding / Empty States
- Part 7: Real-Time Updates
- Part 8: Responsive Design
- Part 9: Accessibility
- Part 10: Tech Stack
- Appendix: Page -> API Endpoint Mapping

---

# PART 1: DESIGN LANGUAGE

## 1.1 Brand Aesthetic

Japanese zen minimalism. The design is defined by what is NOT there. Generous whitespace, restrained color, single-weight line art, cherry blossom petals as the recurring visual motif.

**Inspiration references:**
- The restraint of Muji's packaging
- The whitespace of a Japanese rock garden (karesansui)
- Linear's landing page: dark, spacious, confident
- Stripe's documentation: precise, structured, breathable

**Core principle:** Sakura pink is the ONLY strong color. Everything else is intentionally restrained -- grays, near-whites, near-blacks. The pink earns its power by being rare.

**No emojis anywhere in the product.** Use colored dots, text markers, or Lucide icons for all status indicators.

## 1.2 Color Palette

### Primary Colors

| Name | Light Mode | Dark Mode | CSS Variable | Usage |
|---|---|---|---|---|
| **Sakura** | `#FFB7C5` | `#FFB7C5` | `--color-sakura` | Primary accent. Buttons, highlights, active states, logo |
| **Snow** | `#FAFAFA` | -- | `--color-snow` | Light mode background |
| **Night** | -- | `#0F0F0F` | `--color-night` | Dark mode background |
| **Ink** | `#1A1A1A` | -- | `--color-ink` | Light mode primary text |

### Secondary Colors

| Name | Hex | CSS Variable | Usage |
|---|---|---|---|
| **Blossom** | `#FFD4DE` | `--color-blossom` | Hover states, light accent backgrounds, card highlights |
| **Petal** | `#FF8FA3` | `--color-petal` | Stronger accent for CTAs, important alerts, active nav |
| **Stone** | `#6B7280` | `--color-stone` | Secondary text, muted elements, timestamps |
| **Mist** | `#F3F4F6` | `--color-mist` | Borders, dividers, subtle backgrounds (light mode) |
| **Charcoal** | `#1C1C1C` | `--color-charcoal` | Cards, elevated surfaces (dark mode) |
| **Ash** | `#2A2A2A` | `--color-ash` | Borders, dividers (dark mode) |

### Semantic Colors

| Name | Hex | CSS Variable | Usage |
|---|---|---|---|
| **Bamboo** | `#10B981` | `--color-bamboo` | Success, healthy, no changes, "all clear" |
| **Amber** | `#F59E0B` | `--color-amber` | Warnings, medium severity, schema drift |
| **Vermillion** | `#EF4444` | `--color-vermillion` | Errors, critical/high severity, breaking changes |
| **Sky** | `#3B82F6` | `--color-sky` | Info, links, active states, focus rings |
| **Orchid** | `#8B5CF6` | `--color-orchid` | Forecasts, early warning signals |

### Severity Color Mapping

| Severity | Dot Color | Badge Background | Badge Text |
|---|---|---|---|
| Critical | `#EF4444` (Vermillion) | `#FEE2E2` | `#991B1B` |
| High | `#F97316` (Orange-500) | `#FFEDD5` | `#9A3412` |
| Medium | `#F59E0B` (Amber) | `#FEF3C7` | `#92400E` |
| Low | `#10B981` (Bamboo) | `#D1FAE5` | `#065F46` |

### Dark Mode Severity Colors

| Severity | Dot Color | Badge Background | Badge Text |
|---|---|---|---|
| Critical | `#F87171` | `#450A0A` | `#FCA5A5` |
| High | `#FB923C` | `#431407` | `#FDBA74` |
| Medium | `#FBBF24` | `#451A03` | `#FCD34D` |
| Low | `#34D399` | `#022C22` | `#6EE7B7` |

## 1.3 Typography

### Font Families

| Role | Font | Fallback Stack |
|---|---|---|
| **Headings + Body** | Inter | system-ui, -apple-system, sans-serif |
| **Code + Monospace** | JetBrains Mono | ui-monospace, SFMono-Regular, monospace |
| **Japanese accent** | Noto Sans JP | sans-serif (decorative use only -- 404 page, about page) |

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|---|---|---|---|---|---|
| `display` | 48px / 3rem | 600 | 1.1 | -0.02em | Landing page hero heading |
| `h1` | 32px / 2rem | 600 | 1.2 | -0.015em | Page titles |
| `h2` | 24px / 1.5rem | 600 | 1.3 | -0.01em | Section headings |
| `h3` | 20px / 1.25rem | 500 | 1.4 | -0.005em | Card titles, subsections |
| `h4` | 16px / 1rem | 500 | 1.5 | 0 | Small headings |
| `body` | 14px / 0.875rem | 400 | 1.6 | 0 | Body text, descriptions |
| `body-sm` | 13px / 0.8125rem | 400 | 1.5 | 0 | Secondary text, metadata |
| `caption` | 12px / 0.75rem | 400 | 1.4 | 0.01em | Labels, timestamps, badges |
| `code` | 13px / 0.8125rem | 400 | 1.5 | 0 | Inline code, monospace |
| `code-sm` | 12px / 0.75rem | 400 | 1.4 | 0 | Diff viewer, small code |

**Rules:**
- Use weights 400 (regular) and 500 (medium) for body. 600 (semibold) for headings only.
- Never use bold (700) -- keep it light. Zen restraint.
- Large headings with small body creates visual hierarchy through size contrast, not weight.
- Generous line height (1.5-1.7 for body). Text breathes.
- Never all-caps except for very small labels (like "NEW" badges) at caption size.

## 1.4 Spacing Scale

Based on a 4px grid:

| Token | Value | Usage |
|---|---|---|
| `space-0` | 0px | -- |
| `space-1` | 4px | Tight gaps (icon-to-text, badge padding) |
| `space-2` | 8px | Compact spacing (form elements, small gaps) |
| `space-3` | 12px | Default inline spacing |
| `space-4` | 16px | Standard component padding |
| `space-5` | 20px | Card padding |
| `space-6` | 24px | Section gaps |
| `space-8` | 32px | Major section spacing |
| `space-10` | 40px | Large gaps |
| `space-12` | 48px | Page section dividers |
| `space-16` | 64px | Hero sections, major breaks |
| `space-20` | 80px | Landing page section spacing |

## 1.5 Border Radius

| Token | Value | Usage |
|---|---|---|
| `radius-sm` | 4px | Badges, pills, small elements |
| `radius-md` | 6px | Buttons, inputs, cards |
| `radius-lg` | 8px | Modals, large cards |
| `radius-xl` | 12px | Panels, sidebar sections |
| `radius-full` | 9999px | Avatars, status dots, circular elements |

## 1.6 Shadow System

| Token | Value | Usage |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation (cards in light mode) |
| `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | Dropdowns, popovers |
| `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals, dialogs |
| `shadow-glow` | `0 0 20px rgba(255,183,197,0.3)` | Sakura glow on focus/hover (dark mode) |

Dark mode shadows use higher opacity and a subtle sakura tint for elevated elements.

## 1.7 Icon System

**Library:** Lucide React (`lucide-react`)

**Default size:** 16px (body context), 20px (buttons/nav), 24px (page headers)
**Default stroke:** 1.5px (matches the light, line-art aesthetic)
**Color:** Inherits from text color (`currentColor`)

**Key icon mappings:**

| Concept | Lucide Icon | Notes |
|---|---|---|
| Dashboard/Home | `LayoutDashboard` | -- |
| URLs/Monitors | `Link2` | -- |
| Changes | `GitCompare` | -- |
| Forecasts | `CloudSun` | Early warning / weather metaphor |
| Settings | `Settings` | -- |
| API Keys | `Key` | -- |
| Webhooks | `Webhook` | -- |
| Billing | `CreditCard` | -- |
| Integrations | `Puzzle` | -- |
| Add/Create | `Plus` | -- |
| Search | `Search` | -- |
| Filter | `Filter` | -- |
| Severity Critical | `AlertTriangle` | With Vermillion color |
| Severity High | `AlertCircle` | With Orange color |
| Severity Medium | `Info` | With Amber color |
| Severity Low | `CheckCircle` | With Bamboo color |
| Healthy | `Circle` (filled) | Green dot |
| Change Detected | `Circle` (filled) | Yellow dot |
| Error/Down | `Circle` (filled) | Red dot |
| Silent/Muted | `Circle` (outline) | Grey |
| Learning | `Loader2` | Animated spin |
| External Link | `ExternalLink` | -- |
| Copy | `Copy` | -- |
| Check/Success | `Check` | -- |
| Close | `X` | -- |
| Menu | `Menu` | Mobile hamburger |
| ChevronRight | `ChevronRight` | Breadcrumbs, expand |
| Snooze | `Clock` | -- |
| Tracked | `Eye` | -- |
| Dismissed | `EyeOff` | -- |
| Resolved | `CheckCircle2` | -- |

## 1.8 Dark Mode Approach

**Strategy:** Tailwind CSS `class` strategy with system preference detection as default.

```typescript
// tailwind.config.ts
export default {
  darkMode: 'class',
  // ...
}
```

**Default behavior:**
1. On first visit: detect system preference via `prefers-color-scheme`
2. If no system preference: default to dark mode
3. User can override via toggle in settings
4. Preference stored in `localStorage` key `chirri-theme`

**Implementation:**
```typescript
// Theme initialization (runs before React hydration)
const theme = localStorage.getItem('chirri-theme') 
  || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.classList.toggle('dark', theme === 'dark');
```

**Color token mapping via CSS variables on `:root` and `.dark`:**

```css
:root {
  --bg-primary: #FAFAFA;
  --bg-secondary: #FFFFFF;
  --bg-tertiary: #F3F4F6;
  --text-primary: #1A1A1A;
  --text-secondary: #6B7280;
  --border: #E5E7EB;
}

.dark {
  --bg-primary: #0F0F0F;
  --bg-secondary: #1C1C1C;
  --bg-tertiary: #2A2A2A;
  --text-primary: #FAFAFA;
  --text-secondary: #9CA3AF;
  --border: #374151;
}
```

---

# PART 2: COMPONENT LIBRARY

All components use shadcn/ui as the base with Chirri theme overrides. Components are copied into the project (not imported from npm).

## 2.1 Buttons

### Variants

| Variant | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| **Primary** | Sakura bg `#FFB7C5`, Ink text | Sakura bg, Ink text | Main CTAs, submit actions |
| **Secondary** | Mist bg, Ink text | Ash bg, Snow text | Secondary actions |
| **Ghost** | Transparent, Stone text | Transparent, Stone text | Tertiary actions, icon buttons |
| **Danger** | Vermillion bg, white text | Vermillion bg, white text | Delete, destructive actions |
| **Disabled** | Mist bg, Stone text, 50% opacity | Ash bg, Stone text, 50% opacity | Inactive state |

### Sizes

| Size | Height | Padding | Font Size | Icon Size |
|---|---|---|---|---|
| `sm` | 32px | 12px 16px | 13px | 14px |
| `md` | 36px | 12px 20px | 14px | 16px |
| `lg` | 44px | 16px 24px | 16px | 20px |

### Glassmorphic Variant (Landing Page Only)

For hero section CTA buttons on the landing page:

```css
.btn-glass {
  background: rgba(255, 183, 197, 0.15);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 183, 197, 0.3);
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.btn-glass:hover {
  background: rgba(255, 183, 197, 0.25);
  border-color: rgba(255, 183, 197, 0.5);
  box-shadow: 0 0 20px rgba(255, 183, 197, 0.15);
}
```

Sakura petals animate behind these buttons, creating depth. Dashboard buttons use standard shadcn/ui -- glassmorphic is landing page only.

### Button States

| State | Visual | Cursor |
|---|---|---|
| Default | Normal colors | `pointer` |
| Hover | Slightly darker/lighter bg | `pointer` |
| Active/Pressed | Scale 0.98, darker bg | `pointer` |
| Focus | 2px focus ring (Sakura color, offset 2px) | `pointer` |
| Disabled | 50% opacity, muted colors | `not-allowed` |
| Loading | Spinner icon replaces text or icon, disabled interaction | `wait` |

## 2.2 Status Dots

Colored circles indicating health/status. Never emojis.

| Status | Color | CSS Class | Pulsing? |
|---|---|---|---|
| Healthy | `#10B981` (Bamboo) | `dot-healthy` | No |
| Change Detected | `#F59E0B` (Amber) | `dot-change` | No |
| Error/Down | `#EF4444` (Vermillion) | `dot-error` | No |
| Silent (muted source) | `#9CA3AF` (Gray-400) | `dot-silent` | No |
| Signal Detected | `#9CA3AF` (Gray-400) | `dot-signal` | Yes (pulse) |
| Learning | `#3B82F6` (Sky) | `dot-learning` | Yes (pulse) |
| Forecast Active | `#8B5CF6` (Orchid) | `dot-forecast` | No |
| Breaking | `#EF4444` (Vermillion) | `dot-breaking` | Yes (pulse) |

**Dot sizes:** 8px (inline with text), 10px (cards/lists), 12px (prominent indicators)

**Pulse animation:**
```css
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.dot-pulse {
  animation: pulse-dot 2s ease-in-out infinite;
}
```

## 2.3 Form Elements

### Text Input

```
Height: 36px
Padding: 8px 12px
Font: 14px Inter
Border: 1px solid var(--border)
Border radius: 6px (radius-md)
Focus: 2px ring in Sakura color
Placeholder: Stone color, italic
Error: Vermillion border, error text below
```

### URL Input

Same as text input with:
- `type="url"` for mobile keyboard
- Leading `https://` label (fixed, non-editable)
- Monospace font (JetBrains Mono) for the URL portion

### Search Input

Same as text input with:
- Leading Search icon (Lucide `Search`, 16px, Stone color)
- Clear button (X icon) appears when input has value
- Keyboard shortcut hint (`Cmd+K`)

### Global Search (Cmd+K) *(Fixed 2026-03-24 -- UX Review)*

A global search accessible from any page via `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux). Opens a centered command palette modal:

```
+--------------------------------------------------+
| [Search icon] Search Chirri...           [Esc]    |
|                                                    |
| Results grouped by type:                           |
|                                                    |
| URLs                                               |
|   [link icon] Stripe — /v1/prices                  |
|   [link icon] Stripe — /v1/customers               |
|                                                    |
| Changes                                            |
|   [yellow dot] Stripe: Field renamed — 2h ago      |
|                                                    |
| Forecasts                                          |
|   [orchid dot] Stripe /v1/charges Deprecation       |
+--------------------------------------------------+
```

- Searches across URLs, changes, and forecasts simultaneously
- Results grouped by type with type headers
- Navigate with arrow keys, Enter to select
- Recent searches shown when empty
- This is a V1 feature — the `Cmd+K` affordance is already in the search input spec

### Select / Dropdown

shadcn/ui Select component with:
- Same dimensions as text input
- Chevron-down indicator
- Options list with hover highlighting in Blossom

### Toggle / Switch

```
Width: 36px, Height: 20px
Track: Mist (off), Sakura (on)
Thumb: White circle, 16px
Transition: 0.15s ease
```

### Checkbox

```
Size: 16px square
Unchecked: Border in Stone
Checked: Sakura bg, white checkmark
Indeterminate: Sakura bg, white dash
```

### Radio

```
Size: 16px circle
Unselected: Border in Stone
Selected: Sakura border + Sakura filled inner circle (10px)
```

## 2.4 Cards

### Provider Card

Used on dashboard to show a monitored provider with its tree structure.

```
Border: 1px solid var(--border)
Border radius: 8px (radius-lg)
Padding: 20px
Background: var(--bg-secondary)
Hover: Subtle shadow-sm

Contents:
- Provider name + icon (h3, left-aligned)
- Status indicator (overall health dot)
- Tree structure (trunk/branches/roots -- see Part 5)
- Footer: "X sources | Last check: 5m ago"
```

### Change Card

Used in the changes feed.

```
Border: 1px solid var(--border)
Border radius: 6px (radius-md)
Padding: 16px
Background: var(--bg-secondary)
Left border: 3px solid [severity color]

Contents:
- Severity dot + badge (top-left)
- URL/provider name (h4)
- Change summary (body text, 2 lines max with ellipsis)
- Source type pill (e.g., "OpenAPI Spec", "Changelog")
- Detection time (relative, Stone color)
- Workflow state pill if not "new"
- Right: chevron-right for navigation
```

### Source Card

Used in provider detail to show individual sources.

```
Border: 1px solid var(--border)
Border radius: 6px (radius-md)
Padding: 16px
Background: var(--bg-secondary)

Contents:
- Source name + type icon
- URL (monospace, truncated)
- Status dot + "Active" / "Muted" / "Error"
- Last check time
- Changes in 30 days count
- Alert toggle (switch)
- Configure button (ghost, right-aligned)
```

### Pricing Card *(Fixed 2026-03-24 -- UX Review)*

Used on landing page and billing page.

```
Border: 1px solid var(--border)
Border radius: 12px (radius-xl)
Padding: 32px
Background: var(--bg-secondary)
Featured variant: Sakura border, subtle Blossom bg tint, "Most Popular" badge (top-right)

Contents:
- "Most Popular" badge (only on recommended plan — Personal or Team) — Sakura bg, white text, positioned top-right of card
- Plan name (h3)
- KEY differentiator in large text (h2): "5 URLs" / "20 URLs" / "100 URLs" / "Unlimited"
- "Best for:" one-liner (body-sm, Stone): "Best for: hobby projects" / "Best for: solo developers" / "Best for: small teams" / "Best for: companies"
- Price (display size for the number, body for "/mo")
- Feature list with check icons
- CTA button (Primary for featured, Secondary for others)
```

Users should identify which plan is for them within 5 seconds of seeing the pricing section.

### Metric Card

Used on dashboard for key stats.

```
Border: 1px solid var(--border)
Border radius: 6px
Padding: 16px
Background: var(--bg-secondary)

Contents:
- Label (caption, Stone)
- Value (h2 size, primary text)
- Trend indicator: up arrow (Vermillion), down arrow (Bamboo), or dash (Stone)
- Sparkline (optional, below value)
```

## 2.5 Badges / Pills

### Severity Badge

```
Height: 22px
Padding: 2px 8px
Border radius: 4px (radius-sm)
Font: 12px (caption), weight 500
Background + text color: per severity table in 1.2
```

| Severity | Text |
|---|---|
| Critical | "Critical" |
| High | "High" |
| Medium | "Medium" |
| Low | "Low" |

### Workflow State Badge *(Fixed 2026-03-24 -- UX Review)*

| State | Background | Text | Icon | Tooltip (shown on first use) |
|---|---|---|---|---|
| New | `#DBEAFE` / `#1E3A5F` | "New" | -- | "Unreviewed change" |
| Tracked | `#E0E7FF` / `#312E81` | "Tracked" | Eye | "You're aware of this change" |
| Snoozed | `#FEF3C7` / `#92400E` | "Snoozed" | Clock | "Remind me later" |
| Dismissed | `#F3F4F6` / `#6B7280` | "Dismissed" | EyeOff | "Not relevant right now" |
| Resolved | `#D1FAE5` / `#065F46` | "Resolved" | CheckCircle2 | "Handled — no action needed" |

**Note:** "Ignored" renamed to "Dismissed" (less judgmental). Each workflow state button shows a brief tooltip on first use explaining its meaning. Tooltips are shown once per user (tracked in localStorage `chirri-workflow-tooltips-shown`).

### Source Type Pill

```
Height: 20px
Padding: 2px 6px
Border radius: 4px
Font: 11px (caption)
Background: var(--bg-tertiary)
Text: var(--text-secondary)
```

Values: "OpenAPI Spec", "Changelog", "Status Page", "SDK Release", "RSS Feed", "Custom URL"

### Plan Badge

```
Height: 20px
Padding: 2px 8px
Border radius: 9999px (full)
Font: 11px, weight 500
```

| Plan | Background | Text |
|---|---|---|
| Free | `#F3F4F6` | `#6B7280` |
| Personal | `#FFD4DE` | `#9D174D` |
| Team | `#DBEAFE` | `#1E40AF` |
| Business | `#E0E7FF` | `#3730A3` |

## 2.6 Navigation

### Sidebar

```
Width: 240px (expanded), 64px (collapsed), 0px (mobile hidden)
Background: var(--bg-secondary)
Border-right: 1px solid var(--border)

Structure:
- Logo + "Chirri" wordmark (top, 48px height)
- Navigation items (icon + label)
- Divider
- Settings group
- Spacer
- Plan badge
- User menu (avatar initial + name + logout)
```

**Nav item states:**

| State | Background | Text | Left Border |
|---|---|---|---|
| Default | Transparent | var(--text-secondary) | None |
| Hover | var(--bg-tertiary) | var(--text-primary) | None |
| Active | var(--bg-tertiary) | Sakura | 2px Sakura |

**Collapse behavior:** On tablet, sidebar shows icons only. On mobile, sidebar is hidden behind a hamburger menu (slide-in overlay).

### Top Bar

Only visible on mobile (replaces sidebar):

```
Height: 48px
Background: var(--bg-secondary)
Border-bottom: 1px solid var(--border)

Contents:
- Hamburger menu button (left)
- Breadcrumb or page title (center)
- User avatar (right)
```

### Breadcrumbs *(Fixed 2026-03-24 -- UX Review)*

```
Font: 13px (body-sm)
Color: Stone for path segments, Ink for current
Separator: ChevronRight icon (12px, Stone)
Example: Dashboard > URLs > Stripe Prices API
```

**Breadcrumbs are required on every page below top-level nav.** Specific breadcrumb paths:
- Provider Detail: `URLs > [Provider Name] > [Tab Name]`
- Change Detail: `Changes > [Provider]: [Summary]` (critical for deep-link entry from notifications)
- Forecast Detail: `Forecasts > [Forecast Title]`
- Settings sub-pages: `Settings > [Sub-page Name]` (e.g., `Settings > API Keys`)
- Check History: `URLs > [Provider Name] > Check History`

### Tabs

Used for sub-navigation within pages (e.g., URL detail: Overview / Changes / Check Log / Sources).

```
Height: 40px
Font: 14px, weight 500
Border-bottom: 2px solid transparent (default), Sakura (active)
Text: Stone (default), var(--text-primary) (active)
Hover: var(--text-primary)
```

## 2.7 Modals / Dialogs

### Standard Modal

```
Max-width: 480px
Border radius: 12px (radius-xl)
Background: var(--bg-secondary)
Overlay: rgba(0,0,0,0.5) with backdrop-blur(4px)
Padding: 24px
Shadow: shadow-lg

Structure:
- Title (h3) + close button (X, top-right)
- Body content
- Footer: action buttons (right-aligned)
```

### Create Ticket Modal

Triggered from Change Detail page. Pre-filled from change data.

```
Width: 560px

Fields:
- Integration selector (Jira / Linear / GitHub Issues)
- Project/repo selector (dropdown, loaded from integration)
- Title (pre-filled: "[SEVERITY] Provider: Change summary")
- Description (pre-filled: markdown change summary, editable)
- Priority (pre-mapped from Chirri severity)
- [Create Ticket] button
```

### Confirmation Modal

For destructive actions (delete URL, delete account, revoke API key).

```
Width: 400px

Contents:
- Warning icon (AlertTriangle, Amber)
- Title: "Delete this URL?"
- Description: "This will stop monitoring and remove all configuration. Check history will be retained per your plan."
- Buttons: [Cancel] (Ghost) + [Delete] (Danger)
```

### Feedback Modal

Triggered from main nav or help button.

```
Width: 480px

Fields:
- Type selector: Bug / Feature / Complaint / Other (radio group)
- Description (textarea, 4 rows)
- Screenshot (optional file upload, drag-and-drop)
- [Submit Feedback] button
```

## 2.8 Toasts / Notifications

Position: top-right, stacked. Auto-dismiss after 5 seconds (success/info) or 10 seconds (warning/error).

| Type | Left Border | Icon | Background |
|---|---|---|---|
| Success | Bamboo | `CheckCircle` | var(--bg-secondary) |
| Warning | Amber | `AlertTriangle` | var(--bg-secondary) |
| Error | Vermillion | `XCircle` | var(--bg-secondary) |
| Info | Sky | `Info` | var(--bg-secondary) |

```
Width: 360px
Border radius: 8px
Padding: 12px 16px
Shadow: shadow-md

Contents:
- Icon (20px, colored)
- Title (14px, weight 500)
- Description (13px, Stone)
- Close button (X, top-right)
```

## 2.9 Data Display Components

### Diff Viewer

See Part 4 for full specification. Uses Monaco DiffEditor.

### Tree View

See Part 5 for full specification. Used on provider cards and provider detail.

### Timeline

Vertical timeline for forecast evidence and check history.

```
Left: vertical line (1px, var(--border))
Nodes: 10px dots on the line, colored by event type
Right: event description + timestamp

Node spacing: 24px between events
Connector: 1px solid var(--border) between dots
```

### Stats Bar

Horizontal bar of metric cards for dashboard overview.

```
Layout: flex row, gap 16px, scrollable on mobile
Each cell: Metric Card component (see 2.4)
Typically 4 cards: Active URLs, Changes This Week, Avg Uptime, Avg TTFB
```

### Empty State

Used when a page/section has no data.

```
Layout: centered, vertical stack
Max-width: 400px
Contents:
- Illustration (line art, 120px height) or icon (48px, Stone)
- Heading (h3)
- Description (body, Stone)
- CTA button (Primary or Secondary)
Padding: 64px vertical
```

### Data Table

Used for URL list, change feed, check history, notification history.

```
Header: caption font, Stone, uppercase, sticky
Rows: body font, alternating bg on hover
Pagination: cursor-based, "Load more" button or infinite scroll
Sorting: click column header, arrow indicator
Filters: above table, inline dropdowns/pills

Row height: 48px
Cell padding: 12px 16px
Border: bottom border on each row (var(--border))
```

## 2.10 Loading States

### Skeleton Screens

Used when page data is loading. Shows the layout structure with animated placeholder blocks.

```
Background: var(--bg-tertiary)
Animation: shimmer (left-to-right gradient sweep)
Border radius: matches the element being replaced
Duration: 1.5s loop
```

Skeleton variants:
- Text line: height 14px, varying widths (100%, 80%, 60%)
- Card: full card shape with skeleton lines inside
- Table row: rectangle blocks for each column
- Metric card: large number skeleton + small label skeleton

### Spinners

Used for inline loading (buttons, small sections).

```
Icon: Lucide Loader2 with CSS animation
Size: matches text size (14px body, 16px button)
Animation: rotate 360deg, 0.75s linear infinite
Color: Stone (default), Sakura (primary context)
```

### Page-Level Loading

Full page spinner with "Loading..." text. Used only for initial app load, not page transitions.

---

# PART 3: PAGES

For each page: URL route, API endpoints called, layout, components used, all states (loading, empty, populated, error), and responsive behavior.

Sidebar + main content layout applies to all authenticated pages. Landing page and auth pages use their own layouts.

## 3.1 Dashboard (Home)

**Route:** `/`
**API Endpoints:**
- `GET /v1/account/usage` -- stats
- `GET /v1/changes?limit=5&sort=detected_at:desc` -- recent changes
- `GET /v1/urls?status=active,calibrating,learning,error&limit=20` -- URL health
- `GET /v1/forecasts/summary` -- forecast widget
- SSE `/v1/events` -- real-time updates

**Layout:** Sidebar + main content. Main content: stats bar at top, two-column grid below (changes feed + URL health).

**Components:**
- Stats Bar (4 Metric Cards: Active URLs, Changes This Week, Avg Uptime %, Avg TTFB)
- Recent Changes list (Change Cards, max 5)
- URL Health table (mini table: name, status dot, last check, TTFB, settings icon) — the **settings icon** per URL row opens a slide-out panel with source alert toggles, skipping the full Provider Detail page *(Fixed 2026-03-24 -- UX Review)*
- Forecast widget (if active forecasts: count + nearest deadline)
- "View All" links to respective pages
- **Freshness indicator** (top-right of main content area): "Live" badge (green dot + text) when SSE connected, or "Updated Xs ago" with refresh icon when polling. *(Fixed 2026-03-24 -- UX Review)*

**States:**

| State | Display |
|---|---|
| Loading | Skeleton screens for all sections |
| Empty (0 URLs) | Full-page empty state with "Plant your first seed" CTA (see Part 6) |
| Populated (URLs, 0 changes) | Stats bar with real data, "All quiet" in changes section, URL health table |
| Populated (URLs + changes) | Full dashboard with all sections |
| Error (API failure) | Error banner at top: "Something went wrong. Refresh to try again." + retry button |

**Responsive:**
- Desktop: 2-column grid (changes left, URL health right)
- Tablet: single column, stacked
- Mobile: single column, stats bar displays as **2x2 grid** (not horizontal scroll) so all 4 metric cards are visible without scrolling *(Fixed 2026-03-24 -- UX Review)*

## 3.2 URL List *(Fixed 2026-03-24 -- UX Review)*

**Route:** `/urls`
**API Endpoints:**
- `GET /v1/urls` -- paginated, filtered, sorted
- `PATCH /v1/urls/:id` -- pause/resume
- `DELETE /v1/urls/:id` -- delete URL

**Layout:** Sidebar + main content. Search bar + filters at top, data table below.

**Components:**

- **Search bar:** Full-text search on URL, provider name, domain. Debounced (300ms).
- **Filter pills:** Status (Healthy / Error / Learning / Paused), Provider, Severity (has critical/high/medium/low changes). Combinable.
- **Sort:** Sortable columns -- Name (alpha), Last Check (recency), Last Change (recency), Check Interval, Source Count. Default: Last Change desc.
- **Bulk action bar:** Appears when 1+ rows are selected via checkboxes. Actions: Pause Selected, Resume Selected, Delete Selected, Change Interval. Delete requires confirmation modal.
- **Select all checkbox:** In table header. Selects current page. "Select all X URLs" link for full selection.

**Data Table Columns:**

| Column | Content | Sortable? |
|---|---|---|
| Checkbox | Selection checkbox | No |
| URL | Truncated URL in monospace + provider icon | Yes (alpha) |
| Provider | Provider name | Yes (alpha) |
| Status | Status dot + label (Healthy / Error / Learning / Paused) | Yes |
| Last Check | Relative timestamp ("5m ago") | Yes |
| Last Change | Relative timestamp or "No changes" | Yes |
| Check Interval | "5m" / "1h" / "24h" etc. | Yes |
| Source Count | Number badge ("4 sources") | Yes |
| Actions | "..." menu: View, Pause/Resume, Check Now, Edit, Delete | No |

**States:**

| State | Display |
|---|---|
| Loading | Skeleton table rows |
| Empty (0 URLs) | Empty state: "No URLs yet. Monitor any API endpoint." + [Add URL] CTA |
| Populated | Data table with filters + bulk actions |
| Empty (filters active) | "No URLs match your filters." + clear filters link |
| Error | Error banner + retry |

**Responsive:**
- Desktop (>=1024px): Full data table with all columns
- Tablet (768-1023px): Table with URL, Status, Last Check, Last Change, Actions columns only
- Mobile (<768px): Card view. Each card shows: URL (truncated), provider icon + name, status dot + label, last check, last change, source count badge. Long-press to enter selection mode for bulk actions. Sort via dropdown selector above cards. Infinite scroll pagination.

**Pagination:** Cursor-based. "Load more" button at bottom. Shows "Showing X of Y URLs."

---

## 3.3 Provider Detail

**Route:** `/urls/:id`
**API Endpoints:**
- `GET /v1/urls/:id` -- URL details
- `GET /v1/urls/:id/sources` -- source list with preferences
- `GET /v1/changes?url_id=:id&limit=10` -- recent changes for this URL
- `GET /v1/urls/:id/checks?limit=20` -- check history
- `GET /v1/forecasts?url_id=:id` -- forecasts for this URL

**Layout:** Sidebar + main content. Main content: header with URL info, tab navigation below.

**Tabs:** Overview | Changes | Check Log *(Fixed 2026-03-24 -- UX Review)*

Reduced from 5 tabs to 3. Sources are now shown inline on Overview (sources are part of understanding this URL). Forecasts show inline on Overview when they exist. Check Log accessible as a tab for detailed history. This covers 95% of use cases without tab overload.

**Overview Tab Components:**
- URL info header (name, URL in monospace, status dot, plan interval)
- Metric cards (Uptime %, Avg TTFB, Changes 30d, Last Check)
- TTFB sparkline chart (recharts, 30-day)
- Response size trend
- Action buttons: Pause/Resume, Edit, Check Now, Delete
- **Sources section** (inline, below metrics): Source Cards for each source with tree view, alert toggles, "Configure" slide-out, quick actions (Mute All, Only Breaking, Reset Defaults) *(Fixed 2026-03-24 -- UX Review)*
- **Forecasts section** (inline, below sources, only shown when active forecasts exist): Forecast cards relevant to this URL with timeline of evidence *(Fixed 2026-03-24 -- UX Review)*

**"Check Now" interaction flow:** *(Fixed 2026-03-24 -- UX Review)*
1. User clicks "Check Now" → button shows spinner, text changes to "Checking..."
2. Toast appears: "Check started for [URL]"
3. SSE pushes `check.completed` event → toast updates: "Check complete: no changes detected" (green) or "Check complete: change detected! [View]" (links to change detail, amber/red based on severity)
4. Button re-enables with original text
5. If check takes >10s: show inline progress text below button: "Running... (12s)"
6. If check fails: error toast: "Check failed: [error message]. [Retry]"

**Changes Tab:**
- Filtered change feed (Change Cards) for this URL only
- Same filtering as Changes Feed page

**Check Log Tab:**
- Data table: Time, Status Code, Response Time, Size, Result (no change / change detected / error)
- Date range filter
- Status filter (success/error/change)

**Sources Tab:**
- Source Cards for each source (see Part 5 tree view)
- Toggle switches for alert enable/disable
- "Configure" slide-out panel per source
- Quick actions: Mute All Bundled, Only Breaking, Reset Defaults

**Forecasts Tab:**
- Forecast cards relevant to this URL
- Timeline of evidence

**States:**

| State | Display |
|---|---|
| Loading | Skeleton for header + tabs |
| URL not found | 404 page |
| Active, no changes | Overview with stats, "No changes detected" in Changes tab |
| Active, with changes | Full content |
| Classifying | *(Fixed 2026-03-24 -- Practical Review)* Overview shows animated classification checklist (5 stages, each lights up via SSE as pipeline progresses). See "Classification Stage UI" below. |
| Learning | Overview shows learning progress with live preview. See "Learning Period Live Preview" below. |
| Paused | Banner: "This URL is paused. Monitoring is stopped." + Resume button |
| Error | Banner: "This URL is experiencing errors. Last error: [message]" |
| Auth Required | Banner: "This endpoint returned 401/403. Check your authentication headers." |
| Redirect Detected | Banner: "This URL redirects to [target]. [Follow redirect] [Keep original] [Pause]" |
| High Variability | Banner: "High variability detected — This endpoint returns different content each time. Chirri identified X volatile fields but the response is still unstable. [Configure ignored fields manually] [View detected volatile fields]" *(Fixed 2026-03-24 -- UX Review)* |

**Responsive:** Tabs become a scrollable horizontal tab bar on mobile. Check Log table becomes card view.

### Classification Stage UI *(Fixed 2026-03-24 -- Practical Review)*

When a URL is in `classifying` status (immediately after creation, before learning starts):

```tsx
{url.status === 'classifying' && (
  <div className="classifying-stages">
    <h4>Analyzing URL...</h4>
    <ul>
      <li className={stage >= 1 ? 'done' : 'pending'}>
        {stage >= 1 ? '✓' : '○'} URL pattern analysis
      </li>
      <li className={stage >= 2 ? 'done' : 'pending'}>
        {stage >= 2 ? '✓' : '○'} Fetching response
      </li>
      <li className={stage >= 3 ? 'done' : 'pending'}>
        {stage >= 3 ? '✓' : '○'} Content-Type detection
      </li>
      <li className={stage >= 4 ? 'done' : 'pending'}>
        {stage >= 4 ? '✓' : '○'} Structural analysis
      </li>
      <li className={stage >= 5 ? 'done' : 'pending'}>
        {stage >= 5 ? '✓' : '○'} Monitoring method selected
      </li>
    </ul>
    <p className="text-sm text-stone">
      Estimated: {Math.max(0, 15 - elapsedSeconds)}s remaining
    </p>
  </div>
)}
```

Stage updates arrive via SSE `classification_stage` events. Total duration: 5-30s (median 12s). After 30s timeout: "Unknown content type, using hash comparison" displayed.

### Learning Period Live Preview *(Fixed 2026-03-24 -- Practical Review)*

During learning, after the first 3-5 checks are complete, the URL detail page shows a preview:

```
Learning In Progress (5/30 checks, ~7 minutes remaining)
[========================------] 16/30

Preview (not final baseline):
  Response: 200 OK
  Content-Type: application/json
  Avg response time: 234ms
  Volatile fields detected: request_id, timestamp

  [View Latest Response]

Full monitoring begins when learning completes.
```

Progress updates arrive via SSE. User can navigate away — learning continues server-side. On completion, desktop notification fires: "{url_name} is now active."

### Shared Monitoring Badge *(Fixed 2026-03-24 -- Practical Review)*

When a URL uses shared monitoring (`shared_url_id` is not null), the URL detail page shows:

```
Monitoring Mode: Shared
  This URL is monitored alongside other Chirri users.
  Benefits: Faster classification, instant baseline, shared intelligence.
  Privacy: Your custom headers and alert settings are private.
  [Learn more about shared monitoring →]
```

When a URL is private (custom headers, or user is the only monitor):
```
Monitoring Mode: Private
  This URL is checked independently with your custom headers.
```

The "Shared" badge also appears as a small pill on URL list cards: `[Shared]` in Stone color.

## 3.4 Changes Feed

**Route:** `/changes`
**API Endpoints:**
- `GET /v1/changes?limit=20` -- paginated, with filters
- `GET /v1/changes/summary` -- aggregate stats

**Layout:** Sidebar + main content. Filters at top, change cards below.

**Filter Bar:** *(Fixed 2026-03-24 -- UX Review)*

**Primary filters (always visible):**
- Severity filter (multi-select pills: Critical / High / Medium / Low)
- Workflow state filter (multi-select: New / Tracked / Snoozed / Dismissed / Resolved)
- Search (full-text on summaries)

**Secondary filters (behind "+ More filters" expandable):**
- URL/provider filter (dropdown search)
- Change type filter (Schema / Status Code / Header / Content / Timing)
- Date range picker

- Sort: Newest (default), Oldest, Most Severe, Unread First

**Filter persistence:** The user's last-used filter configuration is saved to localStorage (`chirri-changes-filters`) and restored on next visit. A "Clear all filters" link appears when any filter is active.

**Components:**
- Summary bar: "X changes need triage" (count of workflow_state=new, prominent)
- Change Cards list (see 2.4) with **inline triage actions** *(Fixed 2026-03-24 -- UX Review)*
- Cursor-based pagination ("Load more" button)

**Inline Triage (Batch Actions):** *(Fixed 2026-03-24 -- UX Review)*

Each Change Card has:
- **Checkbox** (left side) for batch selection
- **Quick Track button** (visible on hover, always visible on mobile) — one click to track
- **"..." overflow menu** — Dismiss / Snooze / Resolve without leaving the list

Batch mode:
- **"Select all"** checkbox in the summary bar. Selects all visible cards. "Select all X changes" link for full selection across pages.
- **Batch action bar** appears when 1+ cards are selected: [Track Selected] [Dismiss Selected] [Resolve Selected] + count badge ("3 selected")
- Batch actions apply to all selected changes in one API call.

Mobile gestures:
- **Swipe right** on a Change Card = Track (green confirmation flash)
- **Swipe left** on a Change Card = Dismiss (grey confirmation flash)
- Swipe reveals the action with icon + label before confirming. Requires full swipe to trigger (not partial).
- Long-press enters multi-select mode (checkboxes appear on all cards).

**States:**

| State | Display |
|---|---|
| Loading | Skeleton cards |
| Empty (0 changes ever) | Empty state: "All quiet. Your APIs haven't changed yet. That's a good thing." |
| Empty (has URLs, <7 days old) | "Still listening... Chirri has run X checks across Y URLs. No changes detected yet." |
| Empty (filters active, no results) | "No changes match your filters." + clear filters link |
| Populated | Change cards with filters |
| Error | Error banner + retry |

**Responsive:** Cards stack vertically. Filter bar wraps. On mobile, filters collapse behind a "Filters" button.

## 3.5 Change Detail (The Money Screen)

**Route:** `/changes/:id`
**API Endpoints:**
- `GET /v1/changes/:id` -- full change with diff
- `PATCH /v1/changes/:id/feedback` -- submit feedback
- `POST /v1/changes/:id/acknowledge` -- mark as tracked

See Part 4 for complete specification of this page.

## 3.6 Forecasts

**Route:** `/forecasts`
**API Endpoints:**
- `GET /v1/forecasts?status=active` -- active forecasts
- `GET /v1/forecasts/summary` -- summary stats

**Layout:** Sidebar + main content. Summary cards at top, forecast list below.

**Components:**
- Summary: Active forecasts count, nearest deadline with countdown, forecasts by severity
- Forecast cards (one per active forecast):
  - Title (provider + signal description)
  - Alert level badge (info / advisory / warning / urgent / critical)
  - Confidence score with qualitative label (e.g., "95% — Very likely") *(Fixed 2026-03-24 -- UX Review)*
  - Deadline countdown (if deadline exists): "47 days remaining"
  - Signal type pills (Sunset Header, Changelog, OpenAPI Spec, etc.)
  - Evidence count: "3 sources confirm"
  - **"What to do" summary** (1-2 lines): e.g., "Review the changelog. Consider migrating. Deadline: Sep 1." + link to source *(Fixed 2026-03-24 -- UX Review)*
  - Action buttons: Create Ticket, Set Reminder, Acknowledge, Dismiss, View Detail *(Fixed 2026-03-24 -- UX Review)*
- Filter: status (active/acknowledged/expired), signal type, severity, provider

**States:**

| State | Display |
|---|---|
| Loading | Skeleton cards |
| Empty (no forecasts) | "No early warnings. Your API dependencies are stable." |
| Populated | Forecast cards with filters |
| Error | Error banner + retry |

**Responsive:** Cards stack. Countdown becomes inline text instead of visual widget.

## 3.7 Forecast Detail

**Route:** `/forecasts/:id`
**API Endpoints:**
- `GET /v1/forecasts/:id` -- full forecast with evidence
- `POST /v1/forecasts/:id/acknowledge` -- acknowledge
- `POST /v1/forecasts/:id/dismiss` -- dismiss

**Layout:** Sidebar + main content. Header + two sections (summary + evidence timeline).

**Components:**
- Header: Title, provider, alert level badge, confidence bar
- Deadline panel: Countdown timer, deadline date, reminder schedule
- Evidence timeline (vertical timeline):
  - Each node: date, signal type icon, source name, description
  - Highlighted text snippets showing detected keywords
  - Link to source URL
- Escalation history: level changes over time
- Affected endpoints list (which of the user's URLs this forecast is relevant to)
- **"What to do" section** (mandatory on every forecast): *(Fixed 2026-03-24 -- UX Review)*
  - Actionable recommendations, even if generic. Example: "Review the changelog entry. Consider migrating to the recommended alternative. Set a reminder for 30 days before the deadline."
  - Link to the original source (e.g., changelog URL, deprecation notice)
  - Affected endpoints prominently displayed: "This affects 3 of your monitored URLs: [link] [link] [link]" — this is the PRIMARY content, not buried as a detail.
- Action bar (expanded): *(Fixed 2026-03-24 -- UX Review)*
  - **Create migration ticket** — opens Create Ticket modal, pre-filled with forecast info (title, description, affected endpoints, deadline)
  - **Set reminder** — instead of just "Acknowledge" (which mutes), users can set a specific reminder date: "Remind me 2 weeks before deadline" / "Remind me on [date picker]"
  - **View affected endpoints** — scrolls to/highlights the affected endpoints list
  - **Acknowledge** (mute reminders) — with tooltip: "You're aware of this. Reminders will stop."
  - **Dismiss** (mark as false positive / not relevant / already migrated)

**Confidence score display:** *(Fixed 2026-03-24 -- UX Review)*
Show qualitative label alongside the number: "Confidence: 95% — Very likely" with a tooltip: "Based on 3 independent sources confirming this change. [What does this mean?]" linking to a help article explaining the scoring methodology.

| Score Range | Label |
|---|---|
| 80-100 | Very likely |
| 60-79 | Likely |
| 40-59 | Possible |
| 0-39 | Uncertain |

**States:**

| State | Display |
|---|---|
| Loading | Skeleton |
| Not found | 404 |
| Active | Full content with actions + "What to do" section |
| Acknowledged | Content with "Acknowledged" badge, reminders muted note |
| Expired | Content with "Expired" badge, outcome note if available |

**Responsive:** Timeline collapses to compact list on mobile.

## 3.8 Settings

**Route:** `/settings`
**API Endpoints:**
- `GET /v1/account` -- account details

**Layout:** Sidebar + main content. Settings organized in sections.

**Sections:**
- **Account:** Name, email, timezone selector, password change
- **Notifications:** Default notification preferences (email toggle, min severity, quiet hours, **digest mode**) *(Fixed 2026-03-24 -- UX Review)*
  - **Digest mode option:** Instead of real-time notifications, batch changes into a daily or weekly summary email. "3 changes detected overnight: 1 Critical, 2 Low. [View all]" Configurable: Real-time (default) / Daily digest (sent at user's preferred time) / Weekly digest (sent Monday at 09:00 user TZ).
  - **After quiet hours:** Queued notifications are sent as a single digest when quiet hours end, not as individual messages.
- **Email Preferences:** Onboarding emails, weekly report, product updates (toggles)

**Sub-pages linked from Settings:**
- API Keys (`/settings/api-keys`)
- Webhooks (`/settings/webhooks`)
- Integrations (`/settings/integrations`)
- Billing (`/settings/billing`)

**Settings sub-navigation:** *(Fixed 2026-03-24 -- UX Review)*
Settings sub-pages use a **persistent vertical sub-nav** on the left side of the settings content area (not the sidebar). Tabs: Account, API Keys, Webhooks, Integrations, Billing. Active tab highlighted with Sakura left border. This sub-nav persists across all `/settings/*` pages so users can navigate between sub-pages without returning to the main Settings page. On mobile, the sub-nav becomes horizontal scrollable tabs at the top of the settings content.

**Danger Zone:** *(Fixed 2026-03-24 -- UX Review)*
Separated from main settings behind a collapsed "Advanced" section at the bottom. Collapsed by default — user must click "Advanced" to expand. Contains:
- Export Data button
- Delete Account button (opens confirmation modal)

**States:**

| State | Display |
|---|---|
| Loading | Skeleton form fields |
| Populated | Forms with current values |
| Saving | Button shows spinner, form disabled |
| Error | Inline error messages per field |

**Responsive:** Single column. Sections stack vertically.

## 3.9 Integrations

**Route:** `/settings/integrations`
**API Endpoints:**
- `GET /v1/integrations` -- list configured integrations
- `POST /v1/integrations/:type/connect` -- initiate OAuth
- `DELETE /v1/integrations/:id` -- disconnect

**Layout:** Grid of integration cards.

**Integration Cards:**
- Icon + name (Slack, Discord, Jira, Linear, GitHub)
- Status: Connected / Not Connected / **Expired** *(Fixed 2026-03-24 -- UX Review)*
- Connected: shows workspace/project name, disconnect button
- Not Connected: "Connect" button (starts OAuth flow)
- **Expired/Disconnected:** Shows warning icon + "Connection expired — Reconnect" button. One-click re-auth via OAuth without needing to disconnect first. *(Fixed 2026-03-24 -- UX Review)*
- **"Send test notification" button** on every connected integration card. Sends a sample change notification to the connected channel. Shows a preview of what the notification looks like before sending. *(Fixed 2026-03-24 -- UX Review)*

**Integration health alerts:** *(Fixed 2026-03-24 -- UX Review)*
- When an integration token fails/expires: send an email notification: "Your Slack integration needs attention. Reconnect to keep receiving alerts. [Reconnect now]"
- Show a **persistent banner on the dashboard** when any integration is unhealthy: "⚠ Your [Slack] integration needs reconnecting. [Fix now]" (banner uses Amber left border, links to `/settings/integrations`)

**States:**

| State | Display |
|---|---|
| Loading | Skeleton cards |
| No integrations | Cards all showing "Not Connected" |
| Some connected | Mixed state cards |
| OAuth in progress | Loading spinner on the card being connected |
| Error | Toast with error message |

**Responsive:** Grid becomes single column on mobile.

## 3.10 API Keys

**Route:** `/settings/api-keys`
**API Endpoints:**
- `GET /v1/api-keys` -- list keys
- `POST /v1/api-keys` -- create key
- `DELETE /v1/api-keys/:id` -- revoke key

**Layout:** Key list table + create button.

**Components:**
- Data table: Name, Key prefix + suffix (never full key), Created date, Last used, Actions (revoke)
- Create button -> modal: Name input -> shows full key ONCE -> "Copy to clipboard" -> key never shown again
- Revoke confirmation modal

**States:**

| State | Display |
|---|---|
| Loading | Skeleton table |
| Empty | "No API keys yet. Create one to use the Chirri API or MCP server." + Create button |
| Populated | Table with keys |
| Key just created | Success toast + highlighted new row with full key visible (one time only) |

**Responsive:** Table becomes card view on mobile.

## 3.11 Billing

**Route:** `/settings/billing`
**API Endpoints:**
- `GET /v1/account/billing` -- plan info, usage
- `POST /v1/account/billing/checkout` -- create Stripe checkout session

**Layout:** Plan info card + usage stats + plan comparison.

**Components:**
- Current plan card: plan name, price, renewal date, payment method (last 4 digits)
- Usage stats: URL slots (X/Y with progress bar), checks this month, webhooks (X/Y)
- Plan comparison table (all plans with features)
- Upgrade/downgrade buttons -> Stripe Checkout or Stripe Billing Portal
- "Manage billing" link -> Stripe Customer Portal

**States:**

| State | Display |
|---|---|
| Loading | Skeleton |
| Free plan | Plan card showing "Free", upgrade CTA prominent |
| Paid plan | Full billing info, manage button |
| Pending downgrade | Banner: "Your plan will change to [plan] on [date]" |
| Payment failed | Warning banner: "Payment failed. Your monitors are still running — you have a 7-day grace period to update your payment method. After [date], your account will be downgraded to Free (5 URLs, checks every 24h). [Update payment method]" *(Fixed 2026-03-24 -- UX Review)* |

**Responsive:** Plan comparison becomes vertical cards instead of table on mobile.

## 3.12 Add URL / Provider ("Plant a Seed")

**Route:** `/urls/new`
**API Endpoints:**
- `GET /v1/providers/search?q=...` -- provider search
- `POST /v1/urls` -- add URL

**Layout:** Centered content, no sidebar distractions for focused flow.

**Flow:**

Step 1: Input
```
+--------------------------------------------------+
| What do you want to monitor?                      |
|                                                    |
| [https://________________________________]  [Add] |
|                                                    |
| Popular:  [Stripe] [OpenAI] [GitHub] [Twilio]     |
+--------------------------------------------------+
```

Step 2a: Known Provider Detected *(Fixed 2026-03-24 -- UX Review)*
```
+--------------------------------------------------+
| [stripe icon] Stripe                               |
|                                                    |
| We'll monitor your endpoint plus these             |
| intelligence sources we discovered:                |
|                                                    |
| [info banner, dismissable, shows once per provider]|
| "Chirri discovered additional sources for this     |
|  domain that help detect upcoming changes. They're |
|  silent unless something affects your monitored    |
|  endpoints."                                       |
|                                                    |
| [x] OpenAPI Spec -- schema changes     Alerts: [ON]|
|     (checked at your plan interval)                |
| [x] Changelog -- new entries           Alerts: [OFF]|
|     (checked every 2 hours)                        |
| [x] Status Page -- outages             Alerts: [ON]|
|     (checked every 10 minutes)                     |
| [x] stripe-node SDK -- new releases    Alerts: [OFF]|
|     (checked every 6 hours)                        |
|                                                    |
| URL slots used: 1 of 20                           |
|                                                    |
| [Start Monitoring]                                 |
+--------------------------------------------------+
```

Each source checkbox now includes an **alert toggle** (ON/OFF) visible during setup, so users can enable alerts per-source right here — no need to dig through Provider Detail later. **OpenAPI Spec and Status Page default to Alerts: ON** (most critical sources). Changelog and SDK default to Alerts: OFF (bonus intelligence, users opt in).

After adding, show a brief explanation if bonus sources were included: "We found 4 additional intelligence sources for Stripe. Sources with alerts OFF are monitoring silently — toggle alerts on any source from your dashboard."

**Source discovery tooltip:** The info banner shown in Step 2a is a **one-time tooltip/banner per provider** — once dismissed, it doesn't appear again for that provider. Stored in `localStorage` key `chirri-source-discovery-dismissed-{provider_id}`. *(Fixed 2026-03-24 -- UX Review)*

Step 2b: Unknown URL -> Processing
```
+--------------------------------------------------+
| Analyzing https://api.example.com/v1/users...      |
|                                                    |
| [spinner] Detecting content type...                |
| [check] JSON API detected                          |
| [spinner] Running discovery...                     |
+--------------------------------------------------+
```

Step 3: Success
```
+--------------------------------------------------+
| [check] Monitoring started!                        |
|                                                    |
| Chirri is learning this endpoint's behavior.       |
| You'll be notified when anything changes.          |
|                                                    |
| [View Dashboard] [Add Another]                     |
+--------------------------------------------------+
```

**States:**

| State | Display |
|---|---|
| Loading | Skeleton |
| Input (ready) | Clean input + popular provider buttons |
| Searching | Input with loading spinner |
| Provider detected | Provider card with source checkboxes |
| Processing URL | Progress steps with spinners/checks |
| Success | Success message with navigation |
| Error: SSRF blocked | "This URL points to a private/internal network and can't be monitored for security reasons. Chirri can only monitor publicly accessible URLs. [Learn more about supported URLs]" *(Fixed 2026-03-24 -- UX Review)* |
| Error: Plan limit | "You've reached your URL limit (X/Y). Upgrade to add more." + upgrade CTA |
| Error: Duplicate | "You're already monitoring this URL." + link to existing |
| Error: Auth required | "This endpoint returned 401. Add authentication headers." + header input fields |
| Error: Redirect | "This URL redirects to [target]. Monitor the redirect target instead?" |

**Responsive:** Full width on mobile, input and provider card stack.

## 3.13 Check History

**Route:** `/urls/:id/checks` (also accessible as tab on Provider Detail)
**API Endpoints:**
- `GET /v1/urls/:id/checks?since=...&until=...&limit=50`

**Layout:** Sidebar + main content. Data table with filters.

**Components:**
- Date range picker
- Status filter (success / error / change)
- Data table: Time, Status Code, Response Time, Body Size, Result
- Result column: green check (no change), yellow dot (change, links to change detail), red X (error with message)

**States:**

| State | Display |
|---|---|
| Loading | Skeleton table |
| Empty | "No checks yet. Chirri will start checking shortly." |
| Populated | Table with check results |
| Beyond retention | "Check history older than X days is not available on your plan." + upgrade hint |

**Responsive:** Table becomes card view.

## 3.14 Notification History

**Route:** `/settings/notifications/history`
**API Endpoints:**
- `GET /v1/notifications?limit=20` -- paginated notification log

**Layout:** Sidebar + main content. Data table.

**Components:**
- Data table: Time, Channel icon, Subject/Summary, Status (sent/delivered/failed), linked Change
- Channel filter (email/webhook/Slack/Discord)
- Status filter (sent/failed)

**States:**

| State | Display |
|---|---|
| Loading | Skeleton table |
| Empty | "No notifications sent yet." |
| Populated | Table with delivery log |
| Error | Error banner |

**Responsive:** Table becomes card view.

## 3.15 Feedback Modal

Not a full page -- a modal accessible from a help button in the sidebar or top nav.

See Section 2.7 for modal specification.

## 3.16 Login / Signup / Password Reset

**Route:** `/login`, `/signup`, `/forgot-password`, `/reset-password`
**API Endpoints:**
- `POST /v1/auth/login`
- `POST /v1/auth/signup`
- `POST /v1/auth/forgot-password`
- `POST /v1/auth/reset-password`

**Layout:** Centered card, no sidebar. Chirri logo + wordmark at top.

**Login:**
```
[Chirri logo]

Log in to Chirri

[Email input]
[Password input]

[Log in] (Primary button, full width)

Forgot password? (link)
Don't have an account? Sign up (link)
```

**Signup:**
```
[Chirri logo]

Create your Chirri account

[Name input]
[Email input]
[Password input]
[Confirm password input]

[Create account] (Primary button, full width)

Already have an account? Log in (link)
```

**Forgot Password:**
```
[Chirri logo]

Reset your password

Enter your email and we'll send you a reset link.

[Email input]
[Send reset link] (Primary button)

Back to log in (link)
```

**States:**

| State | Display |
|---|---|
| Default | Clean form |
| Submitting | Button shows spinner |
| Error (invalid credentials) | "Invalid email or password." (same message for both -- no email enumeration) |
| Error (account locked) | "Account locked. Try again in 15 minutes." |
| Success (signup) | Redirect to dashboard with verification banner |
| Success (forgot) | "Check your email for a reset link." |
| Email not verified | Persistent but non-blocking banner: "Verify your email to enable notifications. [Resend verification]" — user can use the full product (add URLs, view changes) before verifying. Only notification delivery is gated on verification. *(Fixed 2026-03-24 -- UX Review)* |

**Responsive:** Card becomes full-width on mobile with padding.

## 3.17 Notification Deep-Link Flow *(Fixed 2026-03-24 -- UX Review)*

Every notification (email, Slack, Discord, webhook) includes a direct link to the relevant Change Detail page. This is the #1 user entry flow — notification arrives → user clicks → sees the change.

**Link format:** `https://chirri.io/changes/{change_id}`

**Flow:**

1. **User clicks link in notification (email, Slack, Discord)**
2. **If logged in (valid session):** Go directly to `/changes/{change_id}`. Show breadcrumbs: "Changes > [Provider]: [Summary]". Full Change Detail page with all actions available.
3. **If session expired / not logged in:** Show login page. After successful login, redirect back to `/changes/{change_id}` (preserve the original URL via `?redirect=/changes/{change_id}` query param).
4. **If change_id not found:** Show 404 page with "This change may have been deleted or doesn't exist. [View all changes]" link.

**Notification content requirements:**
- **Email subject:** `[SEVERITY] Provider: Change summary` (e.g., "[Critical] Stripe: Field 'amount' renamed to 'amount_in_cents'")
- **Email body:** Include the LLM summary (first 2-3 sentences) so users can triage low-severity changes without clicking through.
- **Slack/Discord:** Summary text + severity badge + direct link. Users can triage simple changes from the notification itself.
- **All channels:** Include the direct `chirri.io/changes/{change_id}` link.

**The Change Detail page MUST work as a standalone entry point.** No required prior navigation state. Breadcrumbs, sidebar, and all context loaded fresh from the API. Users arriving from a notification should have the same full experience as users navigating from the changes feed.

---

## 3.18 Landing Page

**Route:** `chirri.io` (separate Astro deployment, NOT the SPA)
**API Endpoints:** None (static site)

**Layout:** Full-width, no sidebar. Distinct from the dashboard.

**Sections:**

1. **Hero**
   - Animated sakura tree (WebGL/Three.js or Lottie)
   - Heading: "APIs change. We'll let you know." (display font size)
   - Subheading: "Monitor any API endpoint for response changes, schema drift, and breaking updates. Get notified before your users do."
   - CTA buttons: [Start watching -- free] [See how it works] (glassmorphic style)

2. **How It Works** (3-step)
   - "Add an endpoint" -- paste any URL
   - "Chirri watches" -- we check on schedule and compare
   - "Get notified" -- Slack, email, webhook with clean diff

3. **Features Grid**
   - Auto-classification
   - Provider intelligence (tree metaphor visual)
   - Side-by-side diffs (Monaco screenshot)
   - Early warnings
   - 8+ integrations

4. **Pricing Table**
   - 4 plan cards (Free, Personal, Team, Business)
   - Feature comparison
   - "No credit card required" note

5. **Why Chirri?**
   - Problem statement
   - Competitor positioning
   - "The cricket chirps" brand story

6. **Footer**
   - Links: Docs, API, Status, Blog, GitHub
   - Legal: Privacy, Terms
   - Social: Twitter @chirri_io
   - "Chirri -- APIs change. We'll let you know."

**Responsive:** Fully responsive. Hero becomes stacked. Pricing cards become vertical carousel. Features become single column.

## 3.19 Docs / API Reference

**Route:** `docs.chirri.io` or `chirri.io/docs`
**Implementation:** Scalar (OpenAPI-powered) served from `/v1/openapi.json`

**Layout:** Standard API documentation layout. Sidebar with endpoint groups, main content with request/response examples.

**Style:** Match Chirri design tokens -- Snow/Night backgrounds, Inter font, Sakura accent for active nav.

## 3.20 Internal Admin

**Route:** `/admin` (protected, internal only)
**Auth:** `INTERNAL_API_TOKEN` header

**Pages:**
- **Feedback Dashboard:** Filter by type/status/plan, search by keyword, quick reply via support@chirri.io
- **Metrics:** Queue depths, error rates, entity counts, check volumes
- **User list:** Basic user info, plan, URL count, last active

Not part of the public product. Minimal styling -- functional over beautiful.

## 3.21 Dependency Graph Page *(Added 2026-03-24 -- New MVP Features)*

**Route:** `/dependencies`
**API Endpoint:** `GET /v1/dependency-graph`

**Layout:** Full-page interactive graph using React Flow (`@xyflow/react`) with dagre hierarchical layout.

**Elements:**
- **Center node:** User's application (labeled "Your App")
- **Provider nodes:** Grouped API providers (Stripe, OpenAI, etc.) with health status color
- **API endpoint nodes:** Individual monitored URLs, color-coded by status
- **SDK nodes:** Monitored packages (npm, PyPI), linked to providers
- **Upstream nodes:** Auto-detected upstream dependencies (from §2.16)

**Node styling:** Custom React components. Border color indicates health:
- Healthy: gray-200 border, white background
- Warning (deprecation active): amber-400 border, amber-50 background, slow pulse animation
- Breaking change (<24h): red-500 border, red-50 background, fast pulse animation
- New change (<24h): sakura (#FFB7C5) border, sakura-50 background, petal animation

**Interactions:**
- **Click node:** Open sidebar panel with: node name, status, recent changes (5), health timeline (30 days), linked issues. "View changes" button → filtered changes list.
- **Drag:** Reposition nodes (positions saved in localStorage)
- **Zoom/pan:** React Flow built-in controls
- **Minimap:** Bottom-right corner for large graphs

**Dashboard tab:** Also accessible from Dashboard as "Dependency Map" tab alongside URL list and changes feed.

**Mobile (<768px):** Fall back to a simplified list/tree view. Show providers as expandable cards with health badges, not an interactive graph.

**Empty state:** When 0-1 URLs monitored, show a demo graph with placeholder nodes and CTA: "Add more APIs to build your dependency map."

## 3.22 Notification Rules Configuration *(Added 2026-03-24 -- New MVP Features)*

**Route:** `/settings/notification-rules`
**API Endpoints:** `GET /v1/notification-rules`, `POST /v1/notification-rules`, `PUT /v1/notification-rules/:id`, `DELETE /v1/notification-rules/:id`, `POST /v1/notification-rules/test`, `GET /v1/notification-rules/templates`, `POST /v1/notification-rules/from-template`

**Plan gate:** Business tier only. Show upgrade prompt for Free/Personal/Team users.

**Layout:**
- **Quick Setup section (top):** 5 preset template cards. Each shows name, description, "Install" button. Installed templates convert to editable rules.
- **Rules list (below):** Ordered by priority (drag to reorder via `POST /v1/notification-rules/reorder`). Each rule is a card showing:
  - Rule name + enabled/disabled toggle
  - Conditions summary (e.g., "severity = critical AND provider = stripe")
  - Actions summary (e.g., "→ Slack #payments-urgent, bypass quiet hours")
  - "Edit" and "Delete" buttons
  - Match stats: "Matched 12 times, last: 2h ago"

**Rule editor (modal or inline form):**
- **Conditions:** Form-based. Dropdowns for fact (severity, change_type, provider, path_pattern, security_flag, source_type). Operator dropdown (equals, in, contains, greater_than). Value input (text, multi-select, number).
- **AND/OR grouping:** Tabs or radio to switch between "ALL conditions must match" and "ANY condition must match"
- **Actions:** Channel checkboxes (email, Slack, Discord, webhook), severity override dropdown, suppress toggle, bypass quiet hours toggle, bypass digest toggle, "Create GitHub Issue" toggle
- **Test button:** "Test this rule" shows which of user's last 20 changes would have matched

**Empty state:** "No notification rules configured. Set up rules to route the right changes to the right channels." + preset template cards.

## 3.23 GitHub Integration Settings *(Added 2026-03-24 -- New MVP Features)*

**Route:** `/settings/integrations/github`
**API Endpoints:** `GET /v1/integrations/github`, `POST /v1/integrations/github/install`, `DELETE /v1/integrations/github/:id`, `PATCH /v1/integrations/github/:id`, `GET /v1/integrations/github/repos`

**Layout:**
- **Connection card:** Shows GitHub account login, account type (user/org), status badge (active/suspended), connected date.
- **Default settings:** Default repo (dropdown from accessible repos), default labels (tag input), auto-assign (GitHub username input).
- **"Connect GitHub" button:** Initiates GitHub App installation flow. Opens GitHub in new tab/popup.
- **"Disconnect" button:** Confirmation modal. Warning: "Existing issues will remain on GitHub but won't be linked from Chirri."

**Repo picker:** When user clicks "Create Issue" on a change detail page, show a compact modal:
- Repo dropdown (from `GET /v1/integrations/github/repos`)
- Labels multi-select (pre-filled from default + auto-labels)
- Assignee text input (pre-filled from default)
- "Create Issue" primary action button

**Disconnected state:** "Connect your GitHub account to create issues directly from API changes." + "Connect GitHub" button with GitHub icon.

## 3.24 SDK/Package Monitoring Settings *(Added 2026-03-24 -- New MVP Features)*

**Route:** `/settings/packages` (or inline on Provider Detail page)
**API Endpoints:** `GET /v1/packages`, `POST /v1/packages`, `DELETE /v1/packages/:id`, `GET /v1/packages/:id/versions`, `POST /v1/packages/scan`

**Layout:**
- **Package list:** Table with columns: Package name, Registry (npm/pypi/rubygems badge), Linked provider, Latest version, Last checked, Status.
- **Add package:** Form with registry dropdown, package name text input, optional URL link.
- **Upload package.json:** "Scan package.json" button → file upload → auto-detect and suggest packages to monitor from known provider SDK mappings.
- **Version history:** Expand a package row to see version timeline. Major versions highlighted in red (breaking), minor in amber, patch in gray.

**Provider Detail page integration:** On Provider Detail, show an "SDK Versions" tab with:
- Current monitored SDK packages for this provider
- Version timeline with breaking change markers
- "Add SDK package" button

---

# PART 4: THE MONEY SCREEN -- CHANGE DETAIL VIEW

This is the most important page in the product. Where users see exactly what changed.

**Route:** `/changes/:id`

**API Endpoints:**
- `GET /v1/changes/:id` -- full change with diff, previous/current bodies, summary, actions
- `POST /v1/changes/:id/acknowledge` -- mark as tracked
- `DELETE /v1/changes/:id/acknowledge` -- un-acknowledge
- `POST /v1/changes/:id/feedback` -- submit feedback
- `PATCH /v1/changes/:id` -- update workflow state, note, snooze

## 4.1 Page Layout

```
+------------------------------------------------------------+
| [< Back to Changes]                      [Prev] [Next]      |
|                                                              |
| [Severity Badge] Provider Name: Change Summary               |
| Source: OpenAPI Spec  |  Detected: 2h ago  |  Confidence: 95 |
|                                                              |
+------------------------------------------------------------+
| ACTION BAR                                                   |
| [Track] [Dismiss] [Snooze v] [Resolve]  |  [Copy MD] [Ticket]|
+------------------------------------------------------------+
|                                                              |
| SUMMARY PANEL                                                |
| LLM-generated summary text describing the change in plain    |
| English. Lists affected endpoints and recommended actions.    |
|                                                              |
+------------------------------------------------------------+
|                                                              |
| DIFF VIEWER (Monaco DiffEditor)                              |
|                                                              |
| [Side-by-side | Unified]  [Expand All | Collapse Unchanged]  |
|                                                              |
| LEFT (Before)              | RIGHT (After)                   |
| {                          | {                                |
|   "id": "price_123",      |   "id": "price_123",            |
| - "amount": 1000,         | + "amount_in_cents": 1000,      |
|   "currency": "usd",      |   "currency": "usd",            |
| - "active": true           | + "status": "active",           |
|   ...                      | + "metadata": {},               |
| }                          | }                                |
|                                                              |
+------------------------------------------------------------+
|                                                              |
| NOTES                                                        |
| [Textarea: Add a note about this change...]                  |
|                                                              |
+------------------------------------------------------------+
|                                                              |
| FEEDBACK                                                     |
| Was this a real change?                                      |
| [Real Change] [False Positive] [Not Sure]                    |
|                                                              |
+------------------------------------------------------------+
```

## 4.2 Monaco DiffEditor Configuration

```typescript
import { DiffEditor } from '@monaco-editor/react';

const diffEditorOptions = {
  // Layout
  renderSideBySide: true,          // false on mobile (unified mode)
  enableSplitViewResizing: true,
  
  // Display
  readOnly: true,
  minimap: { enabled: true },
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  
  // Diff-specific
  renderIndicators: true,          // +/- indicators in gutter
  ignoreTrimWhitespace: false,     // Show whitespace changes
  
  // Theme
  theme: isDark ? 'chirri-dark' : 'chirri-light',
  
  // Font
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 13,
  lineHeight: 20,
  
  // Folding
  folding: true,
  foldingStrategy: 'indentation',
};
```

**Custom themes:**

```typescript
// chirri-dark theme
monaco.editor.defineTheme('chirri-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#1C1C1C',
    'diffEditor.insertedTextBackground': '#10B98120',  // Bamboo with opacity
    'diffEditor.removedTextBackground': '#EF444420',   // Vermillion with opacity
    'diffEditor.insertedLineBackground': '#10B98110',
    'diffEditor.removedLineBackground': '#EF444410',
  },
});

// chirri-light theme
monaco.editor.defineTheme('chirri-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#FFFFFF',
    'diffEditor.insertedTextBackground': '#10B98130',
    'diffEditor.removedTextBackground': '#EF444430',
    'diffEditor.insertedLineBackground': '#10B98115',
    'diffEditor.removedLineBackground': '#EF444415',
  },
});
```

## 4.3 Content Type Rendering

| Content Type | Diff Language | Notes |
|---|---|---|
| JSON API | `json` | Pretty-printed, 2-space indent |
| OpenAPI Spec | `json` or `yaml` | Based on original format |
| HTML (changelog) | `markdown` | Shows extracted text, NOT raw HTML |
| XML / RSS | `xml` | Standard XML highlighting |
| Plain text | `plaintext` | For unknown content types |
| Headers | Custom | Table view, not diff editor (see below) |

**HTML content rendering:** For HTML sources (changelogs, docs), the diff viewer shows the extracted markdown text (via cheerio + readability + turndown pipeline), NOT raw HTML. Word-level highlighting within changed paragraphs. Summary: "3 paragraphs added, 1 modified in the Stripe API Upgrades changelog."

**Header changes:** Rendered as a key-value table instead of Monaco editor:

```
+------------------+--------------------+-------------------+
| Header           | Previous           | Current           |
+------------------+--------------------+-------------------+
| X-API-Version    | 2026-01-15         | 2026-03-31        |
| Deprecation      | --                 | @1727740800       |
| Content-Length    | 14523              | 15201             |
+------------------+--------------------+-------------------+
```

Changed values highlighted. Added headers get green background. Removed headers get red.

**Status code changes:** Simplified card layout:

```
Status Code: 200 -> 500
Response body: [error JSON shown below]
Recommendation: "Check if the endpoint is deprecated or experiencing issues."
```

## 4.4 Summary Panel *(Fixed 2026-03-24 -- UX Review)*

Positioned above the diff viewer. **Sticky on scroll** — the summary panel remains visible (pinned to top of viewport with subtle shadow) as the user scrolls through the diff. Also accessible via a floating "Summary" toggle button (bottom-right, pill-shaped) that scrolls back to the summary panel.

Contains:

- **LLM-generated summary:** One-paragraph plain English description of what changed. Generated per-signal, cached. Example: "Stripe has renamed the `amount` field to `amount_in_cents` and replaced the boolean `active` field with a string `status` field. A new `metadata` object has been added."
- **Severity badge:** With colored dot
- **Affected endpoints:** Which of the user's monitored URLs this change affects
- **Recommended actions:** Bullet list. "Update your integration to use `amount_in_cents` instead of `amount`."
- **Source link:** "Detected in: [OpenAPI Spec]" with link to source URL
- **View toggle:** "Detailed diff" (default Monaco) | "Simple view" *(Fixed 2026-03-24 -- UX Review)*

**Simple View mode:** An alternative to the full Monaco diff that shows only changed lines with plain-English annotations. Designed for non-JSON-experts:
```
Changes (4):
- Removed: `amount` (integer, line 5)
- Added: `amount_in_cents` (integer, line 5)
- Added: `metadata` (object, line 8)
- Changed: `active` (boolean) → `status` (string, line 12)
```
Power users get the full Monaco diff by default. Simple View is a toggle, not a replacement.

**Diff gutter annotations:** In the Monaco diff viewer, add small labels in the gutter next to changed lines: "field renamed", "field added", "type changed", "field removed". These annotations come from the LLM classification and help users quickly understand changes without reading raw JSON.

## 4.5 Action Bar

Horizontal bar with one-click triage actions.

**Left group (workflow):**
- **Track** button (primary variant if current state is New)
- **Dismiss** button (ghost)
- **Snooze** dropdown: 1 week / 1 month / 3 months / Specific date / 30 days before deadline
- **Resolve** button (ghost, green tint)

**Right group (actions):**
- **Copy as Markdown** button (ghost, Copy icon) -- copies formatted summary (see CHIRRI_BIBLE.md D.2 for format)
- **Create Ticket** button (ghost, ExternalLink icon) -- opens Create Ticket modal
- If ticket already exists: "[PROJ-42]" badge linking to the external ticket

**State behavior:**
- Current state is highlighted/active
- Transitioning between states shows an **undo toast** for 10 seconds: "Change marked as [State]. [Undo]" — clicking Undo reverts to the previous state. After 10 seconds, the toast auto-dismisses and the action is permanent. *(Fixed 2026-03-24 -- UX Review)*
- Snooze shows the snooze date after selection
- Resolve triggers optional feedback prompt if not already given
- **Undo toast spec:** Uses the standard toast component (Section 2.8) with an additional "Undo" text button (Sakura color) right-aligned. Auto-dismiss timer: 10 seconds (shown as a shrinking progress bar at the bottom of the toast). Clicking "Undo" immediately reverts the state change via the appropriate API call (`PATCH /v1/changes/:id` with previous state).

## 4.6 Evidence Panel (for Forecasts)

When viewing a change that is linked to a forecast, an additional evidence panel appears:

```
FORECAST EVIDENCE
This change is part of a broader signal:
"Stripe /v1/charges Deprecation" (confidence: 95)

Timeline:
[dot] Mar 15: Changelog -- "v1/charges deprecated September 1, 2026"
[dot] Mar 16: Sunset Header -- Sunset: Mon, 01 Sep 2026
[dot] Mar 17: OpenAPI Spec -- /v1/charges marked deprecated:true  <-- you are here

[View Full Forecast]
```

## 4.7 Navigation Between Changes

Top-right of the page: [Prev] and [Next] buttons for navigating the change feed without going back to the list. Navigation follows the current filter/sort order from the changes feed.

## 4.8 States

| State | Display |
|---|---|
| Loading | Skeleton for all panels, Monaco not mounted yet |
| Populated | Full page with all panels |
| Not found | 404 page |
| Pending confirmation | Banner: "This change is being confirmed. It may be reverted." Status dot: pulsing |
| Reverted | Banner: "This change was detected but reverted within 30 minutes." Diff still visible. |
| Error loading diff | Summary visible, diff area shows: "Could not load diff data." |

**Responsive:** *(Fixed 2026-03-24 -- UX Review)*
- Desktop (>=1024px): side-by-side diff (Monaco renderSideBySide: true)
- Tablet (768-1023px): unified diff (Monaco renderSideBySide: false)
- Mobile (<768px): **NO Monaco.** Lightweight text diff with expandable sections (see Section 8.4). Page order: sticky bottom action bar → summary panel → lightweight diff → "View full diff" toggle → notes/feedback. Summary + actions are ABOVE the diff so users see the most important content first.

## 4.9 Migration Checklist Panel *(Added 2026-03-24 -- New MVP Features)*

Displayed on the Change Detail page when a migration checklist exists or can be generated (change is deprecation/breaking).

**Location:** Below the diff viewer, above notes/feedback section.

**API:** `GET /v1/changes/:id/migration-checklist`, `POST /v1/changes/:id/migration-checklist` (generate), `PATCH /v1/migration-checklists/:id` (update step)

**Layout:**
```
┌─ Migration Checklist ────────────────────────┐
│ ⚙ Generated for your monitored endpoints     │
│                                               │
│ Summary: Replace source with payment_method   │
│ Risk: Medium | Estimated effort: 2-3 hours    │
│ Deadline: September 1, 2026 (162 days)        │
│                                               │
│ ☑ Step 1: Replace POST /v1/charges params     │
│   - source → payment_method                   │
│   [code before/after toggle]                  │
│                                               │
│ ☐ Step 2: Update webhook handlers             │
│   - charge.succeeded → payment_intent...      │
│   [code before/after toggle]                  │
│                                               │
│ ☐ Step 3: Update response parsing             │
│   [code before/after toggle]                  │
│                                               │
│ Progress: 1/3 steps completed                 │
│                                               │
│ ⚠ AI-generated — verify steps against docs    │
│ Source: stripe.com/docs/payments/migration     │
└───────────────────────────────────────────────┘
```

**States:**
- **Not available:** No button shown (change is not deprecation/breaking)
- **Generating:** Skeleton with spinner: "Generating migration plan..."
- **Generated:** Full checklist with interactive checkboxes
- **In progress:** Progress bar (completed_steps / total_steps)
- **Completed:** All steps checked, "Completed" badge
- **Dismissed:** Hidden, with "Restore checklist" link in notes area

**Free tier:** "Generate Migration Plan" button (rate-limited to 3/month). Paid tiers: auto-generated.

**Code toggle:** Each step with `code_before`/`code_after` has a toggle showing before → after code in monospace, diff-highlighted.

## 4.10 Impact Analysis Panel *(Added 2026-03-24 -- New MVP Features)*

Displayed on the Change Detail page below the summary panel.

**API:** `GET /v1/changes/:id/impact`, `POST /v1/changes/:id/impact` (generate), `POST /v1/changes/:id/impact/feedback`

**Layout:**
```
┌─ Impact Analysis ────────────────────────────┐
│ 🔴 Breaking Change                           │
│                                               │
│ The `source` parameter has been replaced      │
│ with `payment_method` on POST /v1/charges.    │
│                                               │
│ ▸ What changed (2 items)         [expandable] │
│ ▸ How your integration breaks    [expandable] │
│ ▸ What to do                     [expandable] │
│ ▸ Code example (Node.js)         [expandable] │
│                                               │
│ Was this helpful? [👍] [👎]                    │
│                                               │
│ ⚠ AI-generated analysis                      │
└───────────────────────────────────────────────┘
```

**States:**
- **Loading:** "Analyzing impact..." spinner (2-5s async)
- **Available:** Full analysis with expandable sections
- **Error:** "Could not generate analysis. View raw diff above."
- **Free tier (no auto):** "Analyze Impact" button (rate-limited 5/month)

**Severity badges in analysis:** Use the same severity badge component as change severity but with impact-specific labels (Breaking, Deprecation, Additive, Docs-only, Uncertain).

**Feedback:** "Was this helpful?" with thumbs up/down. Persisted to `user_impact_views.feedback`.

## 4.11 Security Flag Badges *(Added 2026-03-24 -- New MVP Features)*

When a change has `security_flags` (from §2.20), display security indicators throughout the UI.

**Change Detail page:**
- **Security badge:** Red shield icon + "SECURITY" text badge, displayed next to the severity badge in the header area
- **Security flags section:** Below summary panel, expandable. Lists each security flag:
  ```
  ┌─ Security Flags ──────────────────────────┐
  │ 🛡 TLS Configuration Change                │
  │   HSTS max-age reduced: 31536000 → 86400   │
  │   Severity boost: +1 level                 │
  │                                             │
  │ 🛡 Auth Method Change                       │
  │   WWW-Authenticate header modified          │
  │   Old: Bearer, New: Bearer realm="api"      │
  └─────────────────────────────────────────────┘
  ```
- **Compliance tags:** If present, show as small pills: `PCI-DSS`, `SOC2`, `GDPR`

**Changes Feed (list):**
- Security-flagged changes show a small red shield icon next to the severity dot
- Filter toggle: "Security changes only" checkbox in the filter bar

**Notifications:**
- Email subject prefix: `[SECURITY]` before severity
- Slack: Shield emoji in header
- Discord: Security field added to embed

---

# PART 5: THE TREE VISUALIZATION

## 5.1 Provider Card Tree Structure

Each monitored provider is displayed as a tree on the dashboard and provider detail page.

**Visual structure:**

```
stripe.com
|-- /v1/charges (your endpoint) ----------- [green dot] healthy
|-- /v1/customers (your endpoint) --------- [green dot] healthy
|
|-- [link icon] changelog ------------------ [grey dot] silent
|-- [link icon] openapi spec --------------- [grey dot] silent
|-- [link icon] status page ---------------- [grey dot] silent
+-- [link icon] npm: stripe ---------------- [grey dot] silent
```

**Elements:**
- **Trunk line:** Vertical line from provider name, 1px, var(--border) color
- **Branch connectors:** Horizontal lines from trunk to each node, 1px
- **Node dots:** Status dots (see 2.2) at the end of each branch
- **Branch labels:** URL path (monospace for endpoints, regular for sources)
- **Source icon:** Lucide icons -- ExternalLink for bonus sources, Link2 for user endpoints

## 5.2 Tree Node Types

| Node Type | Display | Dot Color | Deletable? | Mutable? |
|---|---|---|---|---|
| Trunk (domain) | Provider name + icon | Composite (worst child status) | Yes (deletes whole provider) | -- |
| Branch (user endpoint) | URL path in monospace | Per-endpoint status | Yes | Yes (edit interval, headers) |
| Root (bonus source) | Source name + type | Grey (silent) or colored (signal) | No | Yes (toggle alerts, preferences) |

## 5.3 Status Dot Logic

| Condition | Dot | Pulsing? |
|---|---|---|
| Active, no recent changes | Green | No |
| Change detected (new, untriaged) | Yellow | No |
| Breaking/critical change | Red | Yes |
| Error state | Red | No |
| Learning | Blue | Yes |
| Calibrating | Green | No (hidden from user -- shows as Active) |
| Paused | Grey | No |
| Bonus source: silent (no signals) | Grey outline | No |
| Bonus source: signal detected | Grey | Yes (pulse) |
| Bonus source: muted by user | Grey outline, dimmed | No |

## 5.4 Expand / Collapse Behavior

- **Default:** Trunk expanded, showing branches (user endpoints). Roots collapsed under a "[N] sources" label.
- **Click trunk:** Toggle all branches visible/hidden
- **Click "[N] sources":** Expand/collapse roots section
- **Expand animation:** 150ms ease-out, height transition

## 5.5 Roots: Mute or Hide *(Fixed 2026-03-24 -- UX Review)*

Bonus sources (roots) can be **muted** or **hidden**. They cannot be fully deleted because they feed intelligence, but users should never feel the product overrides their agency.

- **Active roots:** grey dot (or pulsing if signal detected), "[Mute]" and "[Hide]" actions
- **Muted roots:** grey outline dot, dimmed text, "[Unmute]" and "[Hide]" actions — still visible in the tree but no alerts
- **Hidden roots:** Removed entirely from the tree visualization. Monitoring continues in the background silently. A collapsed link appears at the bottom of the tree: "4 hidden sources [Show]" — clicking reveals the hidden sources with "[Unhide]" action on each.
- Roots feed intelligence upward -- always sensing, even when hidden. But the UI respects user preference to not see them.

## 5.6 V2: Chirri Garden View

Premium/paid users can toggle an animated garden dashboard:
- Each domain is a living tree (WebGL or CSS animations)
- Trees grow over time (more data = bigger tree)
- Health reflected in tree state (blooming = healthy, wilting = errors)
- Sakura petals fall when chirps fire
- Full interactive garden of all monitored providers

Toggle in dashboard header: "Switch to Garden View" (desktop only).

This is a V2 feature. Not part of MVP.

---

# PART 6: ONBOARDING / EMPTY STATES

## 6.1 First-Time User Experience

Immediately after signup and email verification:

1. **Dashboard shows empty state** with "Plant your first seed — Add a URL to start monitoring" CTA (plain language subtitle below the metaphor) *(Fixed 2026-03-24 -- UX Review)*
2. **3-step inline guide** (not a blocking wizard, just visual guidance on the empty dashboard): *(Fixed 2026-03-24 -- UX Review)*
   - "**Step 1:** Add a URL — paste any API endpoint or pick a popular one" (with the input + quick-add)
   - "**Step 2:** We learn the baseline — takes about 10 minutes"
   - "**Step 3:** Get alerted on changes — via email, Slack, or webhook"
3. **Public API feed widget:** "**Live from the API ecosystem** — These are real changes Chirri detected this week across popular APIs. Add your own URLs to get personalized alerts." Visual distinction: dashed border, subtle different background tint (`var(--bg-tertiary)`) so it's clearly "not your data." *(Fixed 2026-03-24 -- UX Review)*
4. **Quick-add buttons:** [Monitor Stripe] [Monitor OpenAI] [Monitor GitHub] [Monitor Twilio] -- one click starts monitoring a known provider
5. **URL input:** "Or paste any URL" with large, prominent input field
6. **First Check Progress (Time-to-Value):** *(Fixed 2026-03-24 -- UX Review)*

After adding the first URL, the dashboard immediately transitions to a **real-time progress view** instead of a dead screen. The first check MUST begin within 30 seconds of adding the URL. Results are shown as they arrive:

```
+-----------------------------------------------------------+
| [spinner] Learning your endpoint...                        |
|                                                            |
| Progress: 5/30 checks complete                             |
| [===========                              ] 17%            |
| Estimated ready: ~8 minutes                                |
|                                                            |
| Live results:                                              |
| [check] Check 1 — 200 OK — TTFB: 142ms — 14.2KB          |
| [check] Check 2 — 200 OK — TTFB: 138ms — 14.2KB          |
| [check] Check 3 — 200 OK — TTFB: 156ms — 14.3KB          |
| [check] Check 4 — 200 OK — TTFB: 141ms — 14.2KB          |
| [check] Check 5 — 200 OK — TTFB: 144ms — 14.2KB          |
| [spinner] Check 6 running...                               |
|                                                            |
| Volatile fields identified: 3 (timestamps, request IDs)   |
| Stable fields watching: 44                                 |
+-----------------------------------------------------------+
```

Each check result appears via SSE (`check.completed` event) as it happens. The user sees real data flowing in — response codes, TTFB, body size. Progress bar updates with each check. Volatile field count updates as the learning algorithm identifies them.

After learning completes, show a **baseline captured summary:**
```
+-----------------------------------------------------------+
| [check] Learning complete!                                 |
|                                                            |
| We've mapped your endpoint. Here's what we found:          |
| — 47 fields detected                                      |
| — 3 volatile fields (will be ignored): timestamp,          |
|   request_id, trace_id                                     |
| — 44 fields being watched for changes                     |
|                                                            |
| You're protected. We'll alert you when anything changes.   |
|                                                            |
| [View Dashboard] [Add Another URL]                         |
+-----------------------------------------------------------+
```

Send a **"baseline captured" email** when learning completes: "We've mapped your endpoint. Here's what we found: 47 fields, 3 volatile (ignored), 44 watched. You're protected."

**Sample change preview:** During the learning wait, show a sample change notification using real data from the public API feed: "Here's what it looks like when Stripe changes their API. You'll get one of these for YOUR endpoint when something changes." — with a miniature Change Card linking to the public feed entry.

## 6.2 Contextual Onboarding & Guided Help *(Fixed 2026-03-24 -- UX Review)*

Lightweight contextual help for first-time users. Not a blocking wizard — just inline guidance that disappears after first use.

**First-visit tooltips:** On first visit to any major page, show a brief tooltip on non-obvious UI elements:
- Tree view (Provider Detail): "This shows all sources Chirri monitors for this provider. Your endpoints are branches; discovered sources are roots."
- Workflow state buttons (Change Detail): "Use these to triage changes. Track = you're aware. Dismiss = not relevant. Resolve = handled."
- Forecast confidence (Forecasts): "Higher confidence means more sources confirm this prediction."
- Learning status (Provider Detail): "Chirri is learning your endpoint's normal behavior. This takes about 10 minutes."

Tooltips are shown once per element per user (tracked in localStorage `chirri-onboarding-tooltips`). Small "?" icon next to concepts like "Sources," "Learning," "Forecast" opens the same tooltip on demand.

**"New to Chirri?" page banner:** On each major page (Dashboard, Changes, Forecasts, Provider Detail), show a dismissable banner for the first week after signup: one sentence explaining the page's purpose. Example on Changes page: "This is your changes feed — every API change Chirri detects appears here. Use the workflow buttons to triage." Dismissed banners don't return (tracked in localStorage).

---

## 6.3 Public API Feed

For users with no monitors or whose monitors are still in learning phase:

```
+-----------------------------------------------------------+
| What's happening in the API world                          |
|                                                            |
| [yellow dot] Stripe -- New API version 2026-03-31.basil   |
|              3 hours ago                                   |
|                                                            |
| [green dot] OpenAI -- New model gpt-5-mini available      |
|             1 day ago                                      |
|                                                            |
| [red dot] GitHub API -- Rate limit headers changed         |
|           2 days ago                                       |
|                                                            |
| [Plant a seed to get YOUR API changes here]                |
+-----------------------------------------------------------+
```

This widget disappears once the user has active monitors producing data.

## 6.4 Progressive Disclosure During Learning/Calibrating

| Phase | Duration | What User Sees |
|---|---|---|
| Learning | 10 minutes | "Learning... X/30 checks. Identifying volatile fields." Progress bar. |
| Calibrating | 7 days | "Active" status. No mention of calibration (it's an internal state). |
| Active | Ongoing | Full dashboard with all features. |

During calibrating: if a high-severity change is detected (5xx, 404), it bypasses the calibration threshold and alerts immediately. The user never knows about the elevated threshold.

## 6.5 Empty States Per Page

| Page | Empty State Heading | Description | CTA |
|---|---|---|---|
| Dashboard (0 URLs) | "Plant your first seed" | "Add a URL to start monitoring. It takes 10 seconds." + public API feed | [Add URL] |
| URL List (0 URLs) | "No URLs yet" | "Monitor any API endpoint. We'll watch it for changes." | [Add URL] |
| Changes (0 changes ever) | "All quiet" | "Your APIs haven't changed yet. That's a good thing." | -- |
| Changes (recent, no changes) | "Still listening..." | "Chirri has run X checks across Y URLs. No changes detected yet." | -- |
| Forecasts (0 forecasts) | "No early warnings" | "Your API dependencies look stable. We'll alert you at the first sign of change." | -- |
| Check History (0 checks) | "No checks yet" | "Chirri will start checking shortly." | -- |
| Webhooks (0 webhooks) | "No webhooks configured" | "Send change notifications to your own endpoints." | [Add Webhook] |
| API Keys (0 keys) | "No API keys" | "Create one to use the Chirri API or MCP server." | [Create Key] |
| Integrations (0) | "No integrations yet" | "Connect Slack, Jira, Linear, or GitHub." | -- |
| Notification History (0) | "No notifications sent" | "Notifications will appear here once changes are detected." | -- |

## 6.6 Onboarding Email Sequence

| Email | Timing | Trigger | Subject | CTA |
|---|---|---|---|---|
| 1. Welcome | Day 0, immediate | Account created | "Welcome to Chirri" | "Plant your first seed" -> /urls/new |
| 2. Nudge | Day 1 (skip if URLs exist) | 24h + 0 URLs | "Your APIs are waiting" | "Add your first URL" -> /urls/new |
| 3. First check report | After first URL completes learning | learning -> active | "Your first seed is planted" | "View your dashboard" -> / |
| 4. Inactivity | Day 7 (skip if active) | 7d + no dashboard visit in 5d | "All quiet on the API front" | "View your dashboard" -> / |
| 5. Weekly report | Day 7+ | Weekly cron (Monday 09:00 user TZ) | "Your API stability report" | "View full dashboard" -> / |

All emails: plain text first, HTML version with single Sakura accent line at top. Footer: "Chirri -- APIs change. We'll let you know." One-click unsubscribe link.

## 6.7 Primary Action Buttons for All Error States *(Fixed 2026-03-24 -- Practical Review)*

Every URL error state must have a clear primary action button. This table defines the first action the user should take for each state:

| Status | Primary Action Button | Secondary Action | What Happens on Click |
|---|---|---|---|
| `auth_required` | **Add Auth Header** | View Docs | Opens inline form: dropdown for common header names (Authorization, X-API-Key) + password-style value input. On submit: PATCH /v1/urls/:id with headers → auto-retries probe. |
| `redirect_detected` | **Choose Monitoring Mode** | — | Shows 3-option picker: (1) Monitor destination, (2) Monitor redirect source, (3) Monitor both separately (uses 2 URL slots, shows warning). |
| `degraded` | **View Error Log** | Retry Now | Opens Check Log tab filtered to errors. "Retry Now" triggers immediate check. |
| `error` | **Retry Connection** | Edit URL / Delete | Triggers `POST /v1/urls/:id/check`. If still failing: show error details inline. |
| `limited` (bot protection) | **View Details** | Switch to API Endpoint | Shows explanation of bot protection detection. Suggests using a direct API endpoint instead. |
| `limited` (rate-limited by target) | **View Schedule** | — | Shows next check time and explanation: "Target API returned 429. We're respecting their rate limit." |
| `monitoring_empty` | **Wait for Content** | Edit URL | Informational: "Response body was empty. We'll check again on schedule." No user action needed. |
| `paused` | **Resume Monitoring** | Delete | Changes status to active, schedules next check immediately. |
| `classifying` | — (no action) | — | Shows animated classification progress (see §3.3). No user action available. |
| `learning` | — (no action) | View Progress | Shows learning progress with live preview. "Check Now" greyed out. |
| `calibrating` | — (hidden, shows as "Active") | — | No user-visible state. Internally using higher confidence threshold. |

**Auth Required inline form (expanded spec):**

```
[Authentication Required]
This URL returned 401 Unauthorized. Add an authorization header below.

Header Name:  [Authorization ▼]  ← Dropdown: Authorization, X-API-Key, X-Auth-Token, Custom
Header Value: [••••••••••••••]    ← Password-style input

Common patterns:
 Bearer token: "Authorization: Bearer sk_live_..."
 API key: "X-API-Key: your_key_here"

[Test Connection]  [Save & Retry]

On "Test Connection": PATCH /v1/urls/:id with headers → worker retries probe immediately
  → Success: status → learning, show success toast
  → Still 401: show error inline with suggestion to check credentials
```

**Redirect Detected expanded flow:**

```
[Redirect Chain]
https://api.example.com/v1 → 301 Moved Permanently
  ↓
https://api.example.com/v2 → 200 OK

Choose how to monitor:
  ( ) Monitor destination (v2) — updates this URL to final destination
  ( ) Monitor redirect source (v1) — monitors the redirect itself
  ( ) Monitor both separately — creates 2 URL entries
      Warning: This will use 2 of your {limit} URL slots.

[Apply Choice]
```

## 6.8 Downgrade URL Selection UX *(Fixed 2026-03-24 -- Practical Review)*

When a user downgrades to a plan with fewer URL slots than their current active URLs:

**Email notification:**
```
Subject: Action required: Choose URLs to keep after downgrade

Hi {name},

Your plan is changing from {old_plan} to {new_plan}. Your new plan supports {new_limit} URLs,
but you currently have {current_count} active URLs.

Please choose which URLs to keep within the next 72 hours:

[Choose URLs to Keep →]({dashboard_url}/settings/downgrade)

If you don't choose, we'll automatically pause the most recently added URLs on {deadline_date}.

— Chirri
```

**Dashboard: Downgrade URL Selection Page** (`/settings/downgrade`)

```
+------------------------------------------------------------------+
| Choose URLs to Keep                                                |
|                                                                    |
| Your new plan ({new_plan}) supports {new_limit} URLs.             |
| Select the {new_limit} URLs you want to keep monitoring.          |
| The rest will be paused (not deleted — resume anytime by          |
| upgrading).                                                       |
|                                                                    |
| Selected: {selected_count} / {new_limit}                         |
|                                                                    |
| [x] Stripe Prices API — 12 changes detected, last check 5m ago   |
| [x] OpenAI Completions — 3 changes detected, last check 1h ago   |
| [ ] GitHub REST API — 0 changes detected, last check 2h ago      |
| [ ] Twilio Messages — 1 change detected, last check 3h ago       |
|                                                                    |
| Auto-pause deadline: {deadline_date} (72 hours)                   |
|                                                                    |
| [Confirm Selection]  [Cancel Downgrade]                           |
+------------------------------------------------------------------+
```

URLs are sorted by activity (most changes first) to help users choose. If deadline passes without selection, most-recently-created URLs beyond the limit are auto-paused.

---

# PART 7: REAL-TIME UPDATES

## 7.1 SSE Connection

The dashboard maintains a Server-Sent Events connection for live updates.

**Endpoint:** `GET /v1/events` (requires session auth)

**Events pushed:**

| Event Type | Data | Dashboard Action |
|---|---|---|
| `change.detected` | change_id, url_id, severity, summary | Add to changes feed, update URL status dot |
| `change.confirmed` | change_id, confirmation_status | Update change card (remove "unconfirmed" label) |
| `change.reverted` | change_id | Remove from feed or mark as reverted |
| `url.status_changed` | url_id, old_status, new_status | Update URL status dot and health table |
| `check.completed` | url_id, result, response_time_ms | Update "Last check" timestamp, TTFB |
| `forecast.new` | forecast_id, title, severity | Add to forecast widget |
| `forecast.escalated` | forecast_id, new_level | Update forecast card |

## 7.2 Client Implementation

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

function useSSE() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const eventSource = new EventSource('/v1/events', {
      withCredentials: true,
    });

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'change.detected':
          queryClient.invalidateQueries({ queryKey: ['changes'] });
          queryClient.invalidateQueries({ queryKey: ['urls', data.url_id] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          break;
        case 'url.status_changed':
          queryClient.invalidateQueries({ queryKey: ['urls', data.url_id] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          break;
        case 'check.completed':
          queryClient.invalidateQueries({ queryKey: ['checks', data.url_id] });
          break;
        case 'forecast.new':
        case 'forecast.escalated':
          queryClient.invalidateQueries({ queryKey: ['forecasts'] });
          break;
      }
    };

    eventSource.onerror = () => {
      // Browser auto-reconnects. Log for debugging.
      console.warn('SSE connection lost. Reconnecting...');
    };

    return () => eventSource.close();
  }, [queryClient]);
}
```

## 7.3 Reconnection Strategy

- Browser `EventSource` auto-reconnects on disconnect (built-in)
- Server sends heartbeat comment every 30 seconds to keep connection alive
- If reconnection fails 3 times: show subtle banner "Live updates unavailable. Refreshing data every 30s." + fall back to polling
- On reconnect: refetch all stale queries (TanStack Query handles this)

## 7.4 Optimistic UI Updates

For workflow state changes (Track, Dismiss, Snooze, Resolve):
- Immediately update the UI on button click
- Show **undo toast** with 10-second countdown (see Section 4.5) *(Fixed 2026-03-24 -- UX Review)*
- Send API request in background (after undo window expires, or immediately with undo reverting)
- If request fails: revert UI state + show error toast
- TanStack Query's `useMutation` with `onMutate` / `onError` / `onSettled` pattern

## 7.5 Undo Pattern *(Fixed 2026-03-24 -- UX Review)*

Every action that changes state should be reversible for at least a brief window. This is a core UX safety net.

| Action Type | Undo Mechanism | Duration |
|---|---|---|
| Workflow state change (Track/Dismiss/Snooze/Resolve) | Toast with "Undo" button | 10 seconds |
| Delete URL | Confirmation modal (pre-action) + **soft-delete with 30-day recovery** | 30 days |
| Revoke API key | Confirmation modal (pre-action) | Not reversible after confirm |
| Delete account | Confirmation modal + 7-day grace period | 7 days |

**Soft-delete for URLs:** When a user deletes a URL, it enters a "deleted" state. For 30 days, the URL can be recovered from Settings > Account > "Recently Deleted" section. After 30 days, permanently removed. Check history is retained per plan regardless.

---

# PART 8: RESPONSIVE DESIGN

## 8.1 Breakpoints

| Breakpoint | Name | Behavior |
|---|---|---|
| >= 1280px | Desktop | Full sidebar (240px) + main content |
| 768px - 1279px | Tablet | Collapsed sidebar (64px, icons only) + full content |
| < 768px | Mobile | Hidden sidebar (hamburger menu) + stacked content |

## 8.2 Sidebar Behavior

| Breakpoint | Sidebar State | Trigger |
|---|---|---|
| Desktop | Expanded (240px), always visible | -- |
| Tablet | Collapsed (64px), icons + tooltips | Auto on window resize |
| Mobile | Hidden, overlay when open | Hamburger button in top bar |

Mobile sidebar: slides in from left as overlay, 280px wide, with backdrop. Close on backdrop click, nav item click, or X button. **Auto-closes on nav item click** with a page transition animation so the user sees the page change through the overlay dismissal. Active page indicator (Sakura left border) visible in the overlay. *(Fixed 2026-03-24 -- UX Review)*

## 8.3 Table -> Card Transformation *(Fixed 2026-03-24 -- UX Review)*

All data tables (URL list, check history, notification history) transform to card view on mobile:

**Desktop table row:**
```
| Time | Status | Response | Size | Result |
| Mar 24, 03:00 | 200 | 234ms | 14KB | No change |
```

**Mobile card:**
```
+----------------------------------+
| Mar 24, 03:00                    |
| Status: 200  |  234ms  |  14KB  |
| [green dot] No change            |
+----------------------------------+
```

**Mobile card interactions:**
- **Sort:** Dropdown selector above cards (replacing sortable column headers). Shows current sort + direction.
- **Filter:** Same filter bar, collapsed behind "Filters" button (already specified).
- **Bulk select:** Long-press any card to enter selection mode. Checkboxes appear on all cards. Floating action bar at bottom for batch actions.
- **Pagination:** Infinite scroll with "Loading more..." indicator at the bottom. Pull-to-refresh at top.

## 8.4 Diff Viewer Responsive *(Fixed 2026-03-24 -- UX Review)*

| Breakpoint | Mode | Layout |
|---|---|---|
| >= 1024px | Side-by-side | Monaco DiffEditor with `renderSideBySide: true` |
| 768px - 1023px | Unified | Monaco DiffEditor with `renderSideBySide: false` |
| < 768px | **Lightweight text diff** | NO Monaco on mobile. Simple highlighted diff (see below) |

**Mobile diff viewer (<768px):**

Do NOT load Monaco on mobile. Instead, render a lightweight text-based diff component:

- **Red background** (`--color-vermillion` at 15% opacity) for removed lines, with strikethrough text
- **Green background** (`--color-bamboo` at 15% opacity) for added lines
- **Collapsible unchanged context:** Show 2 lines of context around each change. Remaining unchanged lines collapsed behind a "Show X unchanged lines" toggle.
- **Expandable sections:** Each change block (hunk) is an expandable card. Tap to expand/collapse.
- **Word-level highlighting** within changed lines for precise change identification.
- No horizontal scrolling — long lines word-wrap with indentation preserved.
- Font: JetBrains Mono, 12px (`code-sm`).

**Mobile page order (most important first):**
1. **Action bar** (Track / Dismiss / Snooze / Resolve) — **sticky bottom bar**, always visible for quick triage
2. **Summary panel** — LLM-generated summary, full-width, prominent
3. **Lightweight diff** — expandable text diff as described above
4. **"View full diff" toggle** — loads Monaco in unified mode for users who really want it
5. **Notes + Feedback** — below the diff

This ensures the user can read the summary and triage the change without ever scrolling past an unreadable diff.

On desktop/tablet: diff viewer takes full width, minimap shown on desktop only, line numbers visible.

## 8.5 Touch-Friendly Targets

- Minimum tap target: 44px x 44px (Apple HIG guideline)
- Button minimum height: 44px on mobile (override sm/md sizes)
- Status dots: surrounded by 44px touch area even if visually smaller
- Spacing between interactive elements: minimum 8px

---

# PART 9: ACCESSIBILITY

## 9.1 ARIA Labels

All interactive elements must have accessible labels:

```html
<!-- Status dots -->
<span role="status" aria-label="Healthy, no changes">
  <span class="dot-healthy" aria-hidden="true"></span>
</span>

<!-- Severity badges -->
<span role="img" aria-label="High severity">
  <span class="badge-high">High</span>
</span>

<!-- Icon buttons -->
<button aria-label="Copy change summary as markdown">
  <CopyIcon aria-hidden="true" />
</button>

<!-- Toggle switches -->
<button role="switch" aria-checked="true" aria-label="Enable alerts for Stripe Changelog">
```

## 9.2 Keyboard Navigation *(Fixed 2026-03-24 -- UX Review)*

| Key | Action | Context |
|---|---|---|
| `Tab` | Move focus to next interactive element | Global |
| `Shift+Tab` | Move focus to previous interactive element | Global |
| `Enter` / `Space` | Activate focused button/link | Global |
| `Escape` | Close modal/dropdown/slideout, or back to list | Global |
| `Arrow Up/Down` | Navigate list items, dropdown options | Dropdowns |
| `/` | Focus search input (when not in a text field) | Global |
| `j` / `k` | Navigate changes up/down in the feed | Changes Feed (V1) |
| `Enter` | Open selected change | Changes Feed |
| `t` | Track current change | Change Detail |
| `d` | Dismiss current change | Change Detail |
| `s` | Snooze current change | Change Detail |
| `r` | Resolve current change | Change Detail |
| `c` | Copy as Markdown | Change Detail |
| `?` | Show keyboard shortcut overlay | Global |

**Keyboard shortcut overlay:** Pressing `?` from any page shows a modal listing all available keyboard shortcuts for the current context. Dismissable with Escape.

## 9.3 Focus Management in Modals

- When modal opens: focus moves to first focusable element inside
- Tab cycles within modal (focus trap)
- When modal closes: focus returns to the trigger element
- Modal is `role="dialog"` with `aria-modal="true"` and `aria-labelledby` pointing to the title

## 9.4 Screen Reader Considerations for Diff Viewer

Monaco Editor has built-in accessibility support. Additional considerations:

- Above the diff viewer: provide a plain-text summary of changes accessible to screen readers
- Use `aria-live="polite"` on the summary panel so screen readers announce when change data loads
- Provide an alternative to the visual diff: "View as text" button that shows a simplified plain-text diff list:
  - "Removed: field `amount` (line 5)"
  - "Added: field `amount_in_cents` (line 5)"
  - "Added: field `metadata` (line 8)"

## 9.5 Color Contrast Compliance

All text must meet WCAG 2.1 AA contrast ratios:
- Normal text (< 18px): minimum 4.5:1 contrast ratio
- Large text (>= 18px or >= 14px bold): minimum 3:1
- Interactive components and graphical objects: minimum 3:1

**Verified contrasts:**

| Combination | Contrast | Passes? |
|---|---|---|
| Ink (#1A1A1A) on Snow (#FAFAFA) | 16.1:1 | Yes (AAA) |
| Snow (#FAFAFA) on Night (#0F0F0F) | 18.1:1 | Yes (AAA) |
| Stone (#6B7280) on Snow (#FAFAFA) | 5.3:1 | Yes (AA) |
| Sakura (#FFB7C5) on Night (#0F0F0F) | 9.8:1 | Yes (AAA) |
| Sakura (#FFB7C5) on Snow (#FAFAFA) | 1.8:1 | No -- never use Sakura as text on light bg |

**Rule:** Sakura is used for backgrounds, borders, and decorative elements -- never as text color on light backgrounds. On dark backgrounds, Sakura text is accessible.

---

# PART 10: TECH STACK

## 10.1 Core Framework

| Tool | Version | Purpose |
|---|---|---|
| **Vite** | ^5.x | Build tool, dev server, HMR |
| **React** | ^19.x | UI framework |
| **React Router** | ^7.x | Client-side routing |
| **TypeScript** | ^5.4 | Type safety |

## 10.2 Styling

| Tool | Version | Purpose |
|---|---|---|
| **Tailwind CSS** | ^3.x | Utility-first CSS with Chirri custom config |
| **shadcn/ui** | CLI-installed | Component primitives (buttons, dialogs, tables, etc.) |

Tailwind config extends with Chirri color tokens, font families, and spacing scale.

## 10.3 State Management

| Tool | Version | Purpose |
|---|---|---|
| **TanStack Query** | ^5.x | Server state (API calls, caching, invalidation) |
| **Zustand** or **Jotai** | latest | Client state (sidebar open/closed, theme, local preferences) |

**Rule:** All data from the API is managed by TanStack Query. Zustand/Jotai is only for UI state that doesn't come from the server.

## 10.4 Data Display

| Tool | Version | Purpose |
|---|---|---|
| **@monaco-editor/react** | ^4.7 | Diff viewer (the money screen) |
| **recharts** | ^2.x | TTFB sparklines, uptime charts, response size trends |
| **date-fns** | ^3.x | Date formatting, relative time |

## 10.5 Icons

| Tool | Version | Purpose |
|---|---|---|
| **lucide-react** | latest | Icon system (1000+ icons, tree-shakeable) |

## 10.6 Real-Time

| Tool | Purpose |
|---|---|
| **EventSource API** (browser native) | SSE connection for live dashboard updates |

No additional library needed. Browser `EventSource` handles connection, reconnection, and message parsing.

## 10.7 Forms and Validation

| Tool | Version | Purpose |
|---|---|---|
| **zod** | ^3.x | Schema validation (shared with backend) |
| **react-hook-form** | ^7.x | Form state management (optional -- plain React state works for simple forms) |

## 10.8 Testing

| Tool | Version | Purpose |
|---|---|---|
| **Vitest** | ^2.x | Unit tests for utilities and hooks |
| **Testing Library** | ^16.x | Component testing |
| **Playwright** | latest | E2E tests (V1.1) |

## 10.9 Build and Deploy

- **Build:** `vite build` produces static assets
- **Deploy:** Served by the API server (Hono serves static files from `/dist`)
- **CDN:** Cloudflare caches static assets
- **Code splitting:** React.lazy for heavy components (Monaco Editor, recharts)
- **Bundle target:** Chrome 90+, Firefox 90+, Safari 15+, Edge 90+

## 10.10 Tailwind Configuration

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sakura: '#FFB7C5',
        blossom: '#FFD4DE',
        petal: '#FF8FA3',
        snow: '#FAFAFA',
        ink: '#1A1A1A',
        night: '#0F0F0F',
        charcoal: '#1C1C1C',
        ash: '#2A2A2A',
        stone: '#6B7280',
        mist: '#F3F4F6',
        bamboo: '#10B981',
        amber: '#F59E0B',
        vermillion: '#EF4444',
        sky: '#3B82F6',
        orchid: '#8B5CF6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

---

## 10.11 Team/Multi-User Readiness (V2 Note) *(Fixed 2026-03-24 -- UX Review)*

The "Team" plan tier implies collaboration features. While full team UX is V2, the V1 single-user UX should NOT use hard-coded "my account" language that precludes teams later. Avoid assumptions like "your URLs" where "monitored URLs" works. Use generic language: "account" instead of "your personal account."

**V2 team features to plan for:**
- Invite teammates flow (email invite → accept → join workspace)
- Shared vs. personal views (team dashboard vs. "my triage" filter)
- Activity audit log: "John marked the Stripe change as Resolved — 2h ago"
- Who-triaged-what attribution on change cards in the feed
- Role-based access (admin, member, viewer)

---

# APPENDIX: PAGE -> API ENDPOINT MAPPING

Every page and every API call it makes.

## Authenticated Pages

| Page | Route | API Calls |
|---|---|---|
| **Dashboard** | `/` | `GET /v1/account/usage`, `GET /v1/changes?limit=5`, `GET /v1/urls?limit=20`, `GET /v1/forecasts/summary`, SSE `/v1/events` |
| **URL List** | `/urls` | `GET /v1/urls` (paginated, filtered) |
| **Add URL** | `/urls/new` | `GET /v1/providers/search?q=...`, `POST /v1/urls` |
| **Provider Detail** | `/urls/:id` | `GET /v1/urls/:id`, `GET /v1/urls/:id/sources`, `GET /v1/changes?url_id=:id`, `GET /v1/urls/:id/checks`, `GET /v1/forecasts?url_id=:id` |
| **Provider Actions** | `/urls/:id` | `PATCH /v1/urls/:id` (pause/resume/edit), `DELETE /v1/urls/:id`, `POST /v1/urls/:id/check`, `POST /v1/urls/:id/relearn` |
| **Source Config** | `/urls/:id` (panel) | `PATCH /v1/urls/:id/sources/:source_id`, `POST /v1/urls/:id/sources/:source_id/reset` |
| **Changes Feed** | `/changes` | `GET /v1/changes` (paginated, filtered), `GET /v1/changes/summary` |
| **Change Detail** | `/changes/:id` | `GET /v1/changes/:id`, `POST /v1/changes/:id/acknowledge`, `DELETE /v1/changes/:id/acknowledge`, `POST /v1/changes/:id/feedback`, `PATCH /v1/changes/:id/feedback` |
| **Forecasts** | `/forecasts` | `GET /v1/forecasts`, `GET /v1/forecasts/summary` |
| **Forecast Detail** | `/forecasts/:id` | `GET /v1/forecasts/:id`, `POST /v1/forecasts/:id/acknowledge`, `POST /v1/forecasts/:id/dismiss` |
| **Settings** | `/settings` | `GET /v1/account`, `PATCH /v1/account`, `POST /v1/account/email-preferences` |
| **API Keys** | `/settings/api-keys` | `GET /v1/api-keys`, `POST /v1/api-keys`, `PATCH /v1/api-keys/:id`, `DELETE /v1/api-keys/:id` |
| **Webhooks** | `/settings/webhooks` | `GET /v1/webhooks`, `POST /v1/webhooks`, `PATCH /v1/webhooks/:id`, `DELETE /v1/webhooks/:id`, `POST /v1/webhooks/:id/test`, `GET /v1/webhooks/:id/deliveries` |
| **Integrations** | `/settings/integrations` | `GET /v1/integrations`, `POST /v1/integrations/:type/connect`, `DELETE /v1/integrations/:id` |
| **Billing** | `/settings/billing` | `GET /v1/account/billing`, `POST /v1/account/billing/checkout` |
| **Notification History** | `/settings/notifications/history` | `GET /v1/notifications` (paginated) |
| **Account Deletion** | `/settings` (modal) | `POST /v1/account/delete`, `POST /v1/account/cancel-deletion` |
| **Data Export** | `/settings` (action) | `POST /v1/account/export`, `GET /v1/account/exports/:id` |
| **Feedback** | (modal) | `POST /v1/feedback` |
| **Dependency Graph** | `/dependencies` | `GET /v1/dependency-graph` | *(Added 2026-03-24 -- New MVP Features)*
| **Notification Rules** | `/settings/notification-rules` | `GET /v1/notification-rules`, `POST /v1/notification-rules`, `PUT /v1/notification-rules/:id`, `DELETE /v1/notification-rules/:id`, `POST /v1/notification-rules/test`, `GET /v1/notification-rules/templates`, `POST /v1/notification-rules/from-template` | *(Added 2026-03-24 -- New MVP Features)*
| **GitHub Integration** | `/settings/integrations/github` | `GET /v1/integrations/github`, `POST /v1/integrations/github/install`, `DELETE /v1/integrations/github/:id`, `PATCH /v1/integrations/github/:id`, `GET /v1/integrations/github/repos` | *(Added 2026-03-24 -- New MVP Features)*
| **SDK Packages** | `/settings/packages` | `GET /v1/packages`, `POST /v1/packages`, `DELETE /v1/packages/:id`, `GET /v1/packages/:id/versions`, `POST /v1/packages/scan` | *(Added 2026-03-24 -- New MVP Features)*
| **Migration Checklists** | `/changes/:id` (section) | `GET /v1/changes/:id/migration-checklist`, `POST /v1/changes/:id/migration-checklist`, `PATCH /v1/migration-checklists/:id` | *(Added 2026-03-24 -- New MVP Features)*
| **Impact Analysis** | `/changes/:id` (section) | `GET /v1/changes/:id/impact`, `POST /v1/changes/:id/impact`, `POST /v1/changes/:id/impact/feedback` | *(Added 2026-03-24 -- New MVP Features)*
| **Simulations** | `/simulate` | `POST /v1/simulations`, `GET /v1/simulations/:id`, `GET /v1/simulations`, `GET /v1/providers/:slug/versions` | *(Added 2026-03-24 -- New MVP Features)*

## Unauthenticated Pages

| Page | Route | API Calls |
|---|---|---|
| **Login** | `/login` | `POST /v1/auth/login` |
| **Signup** | `/signup` | `POST /v1/auth/signup` |
| **Forgot Password** | `/forgot-password` | `POST /v1/auth/forgot-password` |
| **Reset Password** | `/reset-password` | `POST /v1/auth/reset-password` |
| **Verify Email** | `/verify-email` | `POST /v1/auth/verify-email` |
| **Landing Page** | `chirri.io` | None (static Astro site) |
| **Docs** | `docs.chirri.io` | `GET /v1/openapi.json` (for Scalar) |
| **Health** | -- | `GET /health`, `GET /v1/status` |

---

*This document is the single source of truth for all Chirri frontend development. For API contracts and backend architecture, see CHIRRI_BIBLE.md. When in doubt about design decisions, this Frontend Bible wins for UI/UX; the main Bible wins for product and backend.*

*(Created 2026-03-24 | Updated 2026-03-24 v1.3 — New MVP Features integrated)*
