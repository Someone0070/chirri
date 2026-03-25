# Chirri: Severity Taxonomy & Post-Detection Workflow

Research compiled 2026-03-24.

---

## Part 1: Severity Taxonomy Research

### What Other Products Use

| Product | Levels | Scale |
|---------|--------|-------|
| **Sentry** (issue priority) | 3 | **High**, **Medium**, **Low** |
| **Sentry** (alert triggers) | 2+1 | **Critical**, **Warning**, Resolved |
| **PagerDuty** (incidents) | 5 | SEV-1 (critical) through SEV-5 (cosmetic) |
| **PagerDuty** (event severity) | 5 | critical, error, warning, info, unknown |
| **Datadog** (monitors) | 3+1 | **Alert** (critical), **Warn**, **OK**, No Data |
| **GitHub Security Advisories** | 4 | **Critical**, **High**, **Moderate**, **Low** (CVSS-based) |
| **npm audit** | 4 | **critical**, **high**, **moderate**, **low** |
| **Better Stack** | 2 | Critical alert (bypasses DND), regular alert |
| **Checkly** | 3 states | **Failing**, **Degraded**, **Passing** (not severity per se — state-based) |
| **Google Cloud** | 3 | **Critical**, **Warning**, **Info** |
| **LogicMonitor** | 3 | **Critical**, **Error**, **Warning** |
| **Syslog (RFC 5424)** | 8 | Emergency → Alert → Critical → Error → Warning → Notice → Info → Debug |

### Analysis: How Many Levels?

**The consensus across modern developer tools is 4 levels: Critical / High / Medium / Low.**

- **3 levels** (Sentry priority, Datadog, Google Cloud): Simple, but can feel too coarse. "Medium" becomes a dumping ground.
- **4 levels** (GitHub, npm audit, CVSS, the Bricklayer AI guide): The sweet spot for developer-facing tools. Matches the security industry standard (CVSS). Developers already understand this from `npm audit`.
- **5 levels** (PagerDuty SEV-1 through SEV-5): Designed for large ops teams with incident commanders. Overkill for solo devs or small teams. PagerDuty's own docs note that most action happens at SEV-1/2/3.
- **8 levels** (Syslog): Way too many for human decision-making. Designed for machine routing.

**Key insight:** The tools closest to Chirri's use case — npm audit and GitHub Security Advisories — both use 4 levels. Developers already have muscle memory for `low | moderate/medium | high | critical`.

### Chirri's Special Challenge: Forecasts vs. Detections

Chirri isn't Sentry (runtime errors) or PagerDuty (live incidents). Chirri watches for **changes over time** that progress through stages:

1. **Forecast**: "Stripe announced /v1/charges will be deprecated in 6 months"
2. **Deadline approaching**: "2 months until /v1/charges sunset"
3. **Breaking**: "/v1/charges is returning 410 Gone"

This is a **temporal progression**, not a severity scale. These are two separate axes:

| Axis | What it measures | Values |
|------|-----------------|--------|
| **Severity** | How bad is the impact? | low, medium, high, critical |
| **Urgency** (time) | How soon must you act? | forecast, upcoming, imminent, breaking |

**Recommendation: Keep them separate.** A deprecation might be **high severity** (it affects your payment flow) but **forecast urgency** (6 months away). Or **low severity** (cosmetic API change) but **imminent urgency** (deadline in 2 weeks).

However, for the MVP, urgency can be **derived from the data** (detected date vs. deadline date) rather than being a separate user-facing field. The user sees severity; the system calculates urgency for sorting and notification frequency.

### Recommended Taxonomy: 4 Levels

```
┌──────────┬──────────────────────────────────────────────────────────────┐
│ Level    │ Definition (for Chirri's context)                          │
├──────────┼──────────────────────────────────────────────────────────────┤
│ CRITICAL │ Breaking change detected. Something you depend on has      │
│          │ already changed or will change within days. Immediate       │
│          │ action required or your app is/will be broken.              │
│          │ Examples:                                                   │
│          │ - API endpoint returning errors now                        │
│          │ - Security vulnerability in a dependency (CVSS ≥ 9)        │
│          │ - Provider removing feature with < 1 week notice           │
├──────────┼──────────────────────────────────────────────────────────────┤
│ HIGH     │ Significant change that will require code modifications.   │
│          │ Not broken yet, but will be. Clear deadline exists.         │
│          │ Examples:                                                   │
│          │ - API version deprecated, sunset date announced            │
│          │ - Pricing tier changing (affects your costs)                │
│          │ - Major dependency releasing breaking major version        │
├──────────┼──────────────────────────────────────────────────────────────┤
│ MEDIUM   │ Notable change that may affect you. Requires evaluation    │
│          │ but not urgent action.                                      │
│          │ Examples:                                                   │
│          │ - New API version available (old one still works)           │
│          │ - Feature flagged for future deprecation (no date yet)      │
│          │ - Terms of service update with unclear impact               │
├──────────┼──────────────────────────────────────────────────────────────┤
│ LOW      │ Informational. Good to know, unlikely to require action.   │
│          │ Examples:                                                   │
│          │ - New optional feature added to an API you use              │
│          │ - Minor docs update                                        │
│          │ - Cosmetic changes to provider dashboard                   │
└──────────┴──────────────────────────────────────────────────────────────┘
```

### Why This Works for Chirri

1. **Matches developer muscle memory** — same scale as `npm audit` and GitHub advisories
2. **4 levels, not 3** — "medium" vs "high" distinction matters ("evaluate this" vs "plan for this")
3. **Not 5** — PagerDuty's SEV-4/SEV-5 distinction is meaningless for a solo dev watching API changes
4. **Severity is about impact, not time** — time-based urgency is computed separately
5. **Maps to notification behavior:**
   - Critical → immediate push notification, bypasses quiet hours
   - High → push notification during business hours
   - Medium → daily digest
   - Low → weekly digest or in-app only

### How Severity Gets Assigned

For MVP, severity can be rule-based:

```
IF change matches "deprecated" AND has deadline within 30 days → HIGH
IF change matches "removed|sunset|breaking" → CRITICAL
IF change matches "deprecated" AND no deadline → MEDIUM
IF change matches "new feature|added|optional" → LOW
DEFAULT → MEDIUM (force user to triage unknowns)
```

Users should be able to override severity manually. Over time, learn from their overrides.

---

## Part 2: Post-Detection Workflow for Solo Developers

### How Solo Developers Actually Work

The solo developer workflow is fundamentally different from team incident response:

1. **No assignment** — it's always you
2. **No war room** — you're alone with your TODO list
3. **Context switching is expensive** — you might see the alert while doing something else entirely
4. **Memory is unreliable** — "I'll fix that later" means "I'll forget about that"
5. **The response is usually "not right now"** — most changes aren't emergencies

### What Happens After Detection (Real Workflow)

When a solo dev sees "Stripe deprecated /v1/charges", this is what actually happens:

```
1. See notification → "Oh shit" or "meh"
2. Open the change details → Skim for: what changed? when's the deadline?
3. Make a gut decision:
   a. "This is urgent" → Drop everything, start fixing
   b. "I need to deal with this but not now" → Need to save it somewhere
   c. "This doesn't affect me" → Dismiss it
   d. "I'm not sure if this affects me" → Need to investigate later
4. For (b): Create a task in their actual task system (Linear, GitHub Issues, Notion, sticky note)
5. Eventually fix it
6. Want confirmation that the fix worked
```

**The key insight:** For a solo dev, the change detection tool is a **triage point**, not a project management tool. They need to quickly decide what to do, then move the work into wherever they actually track tasks.

### Sentry's Workflow (for Reference)

Sentry uses 6 issue states: **New → Ongoing → Escalating → Regressed → Archived → Resolved**

For solo devs, the most-used flow is: **New → (look at it) → Resolved** or **New → (look at it) → Archived** (ignored). The Ongoing/Escalating/Regressed states matter more for teams.

### changedetection.io's Approach

changedetection.io is purely notification-based — detect change, send notification (email/Slack/Discord/85+ channels), done. No built-in workflow states at all. Users handle everything outside the tool. This works for simple price-watching but feels incomplete for developers managing technical debt.

### Recommended Workflow States

**Minimum viable: 4 states**

```
         ┌──────────┐
         │   NEW    │ ← Change detected
         └────┬─────┘
              │
    ┌─────────┼──────────┐
    ▼         ▼          ▼
┌────────┐ ┌────────┐ ┌──────────┐
│TRACKED │ │IGNORED │ │ SNOOZED  │
│        │ │        │ │(remind   │
│(I need │ │(doesn't│ │ me later)│
│to fix  │ │affect  │ │          │
│this)   │ │me)     │ └────┬─────┘
└───┬────┘ └────────┘      │
    │                       │
    │    (snooze expires) ──┘
    │    → returns to NEW
    ▼
┌────────┐
│RESOLVED│
│        │
│(fixed) │
└────────┘
```

### State Definitions

| State | Meaning | Solo Dev Translation |
|-------|---------|---------------------|
| **New** | Change detected, not yet triaged | "I haven't looked at this yet" |
| **Tracked** | Acknowledged, needs action | "I know about this and need to deal with it" |
| **Snoozed** | Remind me later (with date) | "Not now, but don't let me forget" |
| **Ignored** | Doesn't affect me / won't fix | "Stop bothering me about this" |
| **Resolved** | Fixed / migrated / no longer relevant | "Done" |

### Why These States and Not Others

**Why "Tracked" instead of "Acknowledged"?**
"Acknowledged" is incident-response language ("I see the alert, I'm working on it"). For a solo dev dealing with deprecations, "Tracked" better captures "I've added this to my list of things to do."

**Why "Ignored" instead of "Won't Fix"?**
"Won't fix" implies a conscious technical decision. Often the solo dev just knows "this change is about a feature I don't use." "Ignored" is simpler and less loaded.

**Why "Snoozed"?**
This is essential for solo devs. The #1 response to a non-urgent change is "I'll deal with this later." Without snooze, they either:
- Leave it as "new" forever (inbox grows, alert fatigue)
- Mark it "tracked" and forget about it
- Mark it "ignored" and miss the deadline

Snooze options:
- Snooze for 1 week / 1 month / 3 months
- Snooze until [specific date]
- Snooze until 30 days before deadline (if deadline is known)

**Why NOT "In Progress"?**
A solo dev knows if they're working on something. An "in progress" state just creates busywork. The tool isn't their project manager.

### Actions on Each Change

When viewing a change, the solo dev needs:

#### Must Have (MVP)
- **Quick-triage buttons**: Track / Ignore / Snooze (one click each)
- **View diff**: What actually changed? Show before/after.
- **View source**: Link to the original changelog/docs page
- **Deadline display**: If there's a known deadline, show it prominently with countdown
- **Notes field**: One text box to jot down "affects payment-service, need to update stripe-node to v15"
- **Copy as markdown**: One-click copy of the change summary for pasting into Linear/Jira/Slack/GitHub Issues

#### Should Have (v1.1)
- **Suggested actions**: "Consider migrating to /v2/charges" — AI-generated based on the change content
- **Related changes**: Group related changes (e.g., "3 other Stripe changes detected this month")
- **Resolution verification**: After marking resolved, optionally re-check the source to confirm the migration was successful

#### Nice to Have (Later)
- **Create GitHub Issue**: One-click integration
- **Create Linear ticket**: One-click integration
- **Webhook on state change**: For custom integrations
- **Export change report**: Markdown/PDF summary of all tracked changes (useful for stakeholders or your future self)

### Copy-to-Clipboard Format

This is surprisingly important. When a solo dev triages a change, their next action is often "paste this into my task tracker." The clipboard format should be:

```markdown
## [HIGH] Stripe: /v1/charges deprecated

**Source:** https://stripe.com/docs/changelog#2026-03-15
**Detected:** 2026-03-20
**Deadline:** 2026-09-15 (178 days)

Stripe has deprecated the /v1/charges endpoint. All integrations
should migrate to /v2/payment_intents by September 15, 2026.

**Affects:** payment-service (based on your monitors)
```

### Notification Strategy by Severity + State

| Severity | New (untriaged) | Tracked | Snoozed |
|----------|----------------|---------|---------|
| Critical | Immediate push | Daily reminder | N/A (can't snooze critical) |
| High | Push notification | Weekly reminder | Reminder on snooze date |
| Medium | Daily digest | No reminder | Reminder on snooze date |
| Low | Weekly digest | No reminder | Reminder on snooze date |

### The "Inbox Zero" Goal

The workflow should drive toward **inbox zero for the New state**. Every change should be triaged into Tracked, Ignored, or Snoozed. The "New" count is the thing that matters — it's the number of unprocessed changes.

Display prominently: **"3 changes need triage"** (not "47 total changes")

---

## Summary: Recommendations

### Severity
- **4 levels**: Critical, High, Medium, Low
- Matches npm audit / GitHub advisory conventions
- Keep severity (impact) separate from urgency (time) internally
- Urgency is computed from deadlines, not user-assigned
- Maps directly to notification behavior

### Workflow
- **5 states**: New → Tracked / Ignored / Snoozed → Resolved
- Optimized for solo dev "triage and punt" pattern
- Snooze is essential (not a nice-to-have)
- Copy-to-clipboard is essential (the bridge to their real task tracker)
- Drive toward inbox zero for New items
- No "in progress" state — we're a detection tool, not a project manager

### MVP Feature Checklist
- [ ] 4-level severity display (Critical/High/Medium/Low)
- [ ] 5 workflow states with one-click transitions
- [ ] Snooze with date picker
- [ ] Notes field per change
- [ ] Copy-as-markdown button
- [ ] Deadline countdown display
- [ ] Notification routing based on severity
- [ ] "X changes need triage" prominent counter
- [ ] Diff view (before/after)
- [ ] Link to source

### Post-MVP
- [ ] AI-suggested actions
- [ ] GitHub/Linear integration (create ticket)
- [ ] Resolution verification
- [ ] Related change grouping
- [ ] Webhook on state change
- [ ] Change report export
