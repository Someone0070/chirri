# Chirri: User Feedback Learning System

> **Core Principle:** User feedback NEVER modifies shared detection behavior directly. Feedback affects only the submitting user's view. Improvements to shared detection happen exclusively through our internal review process.

---

## 1. How Other Products Learn From User Feedback

### Gmail Spam Filter
- **Mechanism:** Users click "Report Spam" or "Not Spam." Gmail aggregates these signals across its entire user base and feeds them into ML models that run server-side.
- **Key insight:** Individual user actions affect *their own* filtering immediately (personal model adjustments), but the *global* spam model is retrained in batch by Google's systems. A single user marking something as "not spam" won't change spam detection for all users — it takes aggregate signal + Google's own pipeline.
- **Relevance to Chirri:** Gmail's two-tier approach (immediate personal effect + batch global learning) is exactly our model. User marks FP → affects their view instantly. Aggregate FP data → feeds our review pipeline.

### Sentry (Error Tracking)
- **Mechanism:** Users can **resolve**, **ignore**, **merge**, and **archive** issues. These actions affect only that project's issue state.
- **Key insight:** Sentry does NOT auto-learn from user actions to change grouping algorithms globally. There's actually an open GitHub issue (#58815) requesting that merging issues should "teach the grouping algorithm" — but it hasn't been implemented. Sentry treats user workflow actions as organizational, not as training signals.
- **Relevance to Chirri:** Even a major product like Sentry keeps user feedback separate from detection logic. Our approach is aligned with industry practice.

### Datadog (Monitoring)
- **Mechanism:** Users mute, silence, or adjust thresholds on monitors. Datadog recommends periodic "alert tuning" where teams review which alerts are noisy and adjust thresholds.
- **Key insight:** Datadog does NOT auto-tune alerts based on dismiss patterns. They provide *tools* for humans to tune (anomaly detection, dynamic thresholds), but the human decides. Their approach is: surface data about alert quality → human makes the call.
- **Relevance to Chirri:** The "surface data, human decides" pattern is exactly our planned internal review workflow.

### Security SIEM Tools (Panther, Splunk, etc.)
- **Mechanism:** SOC analysts tag alerts as false positives. These tags feed into reports that detection engineers use to tune rules. The feedback loop is: analyst tags FP → report generated → detection engineer reviews → rule updated.
- **Key insight:** There is ALWAYS a human review step between "user says it's a false positive" and "detection rule changes." This is industry standard in security monitoring.
- **Relevance to Chirri:** Professional security teams with trained analysts still don't auto-modify detection rules from FP tags. We definitely shouldn't auto-modify from end-user feedback.

### Summary Table

| Product | User Action | Affects Own View? | Auto-Modifies Global Detection? | Human Review Required? |
|---------|------------|-------------------|-------------------------------|----------------------|
| Gmail | Mark spam/not spam | Yes (immediately) | No (batch ML retraining) | Yes (Google's pipeline) |
| Sentry | Resolve/ignore/merge | Yes (project-level) | No | N/A |
| Datadog | Mute/silence/adjust | Yes (per-monitor) | No | Yes (alert tuning reviews) |
| Panther/SIEM | Tag as FP | Yes (workflow) | No | Yes (detection engineering) |
| **Chirri** | Mark as FP | Yes (user's view) | **No** | **Yes (internal review)** |

**Conclusion:** We are aligned with every major product. None of them auto-modify shared detection from user feedback without human review.

---

## 2. Aggregate Feedback Pipeline Design

### Data Collection (Per Feedback Event)

```
feedback_event {
  id: uuid
  user_id: uuid
  timestamp: datetime
  
  # What was flagged
  monitor_id: uuid
  url: string (normalized)
  domain: string
  change_type: enum (header_added, header_removed, header_changed, 
                      body_field_added, body_field_removed, body_field_changed,
                      status_code_changed, body_structure_changed)
  field_path: string (e.g., "response.headers.x-request-id", "body.data.updated_at")
  
  # Feedback details
  feedback_type: enum (false_positive, expected_change, not_relevant)
  feedback_reason: string (optional, free-text)
  
  # Context
  user_plan: enum (free, pro, team, enterprise)
  check_frequency: interval
  consecutive_fps: int (how many times this user flagged same field)
}
```

### Aggregation Pipeline

```
┌─────────────────────────────────────────────────────────┐
│ USER ACTION                                              │
│ User marks change as false positive                      │
│ → Stored in user_feedback table                          │
│ → User's view updated immediately (suppressed for them)  │
│ → No other user affected                                 │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ DAILY AGGREGATION JOB (cron, runs at 03:00 UTC)         │
│                                                          │
│ GROUP BY: normalized_url + field_path + change_type      │
│ COMPUTE:                                                 │
│   - unique_users_flagging: COUNT(DISTINCT user_id)       │
│   - total_users_monitoring: COUNT(DISTINCT monitors.url) │
│   - flag_rate: unique_users_flagging / total_monitoring  │
│   - first_flagged: MIN(timestamp)                        │
│   - last_flagged: MAX(timestamp)                         │
│   - avg_consecutive_fps: AVG(consecutive_fps)            │
│   - feedback_reasons: ARRAY_AGG(feedback_reason)         │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ THRESHOLD CHECK                                          │
│                                                          │
│ Create review item IF ANY of:                            │
│   - unique_users_flagging >= 5 AND flag_rate >= 60%      │
│   - unique_users_flagging >= 10 (regardless of rate)     │
│   - flag_rate >= 80% AND unique_users >= 3               │
│   - domain has > 20% overall FP rate                     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│ REVIEW QUEUE                                             │
│ Created in admin dashboard for internal review           │
│ (See Section 3)                                          │
└─────────────────────────────────────────────────────────┘
```

### Why These Thresholds?

- **5 users + 60% rate:** Meaningful signal from a reasonable sample. If 3 of 5 users monitoring the same URL flag the same field, that's worth looking at.
- **10 users absolute:** Even if only 10 out of 100 users flag it (10%), ten independent reports is enough to warrant review.
- **80% rate + 3 users:** Very high agreement from a small sample — likely a clear volatile field.
- **Domain-level 20%:** If a whole domain generates lots of FPs, our detection approach may not work well for that type of API.

These thresholds should be configurable and will be tuned over time based on review outcomes.

---

## 3. Internal Review Workflow

### Review Item Structure

```
review_item {
  id: uuid
  created_at: datetime
  status: enum (pending, in_review, approved, dismissed, deferred)
  
  # Aggregated data
  url_pattern: string (may be wildcard: "api.stripe.com/v1/*")
  field_path: string
  change_type: string
  
  # Evidence
  unique_users: int
  total_users_monitoring: int
  flag_rate: float
  sample_feedback_reasons: string[]
  first_reported: datetime
  
  # Review outcome
  reviewed_by: string (admin user)
  reviewed_at: datetime
  action_taken: enum (add_to_volatile_list, dismiss, create_docs, adjust_detection)
  review_notes: string
}
```

### Review Actions

| Action | What It Does | When To Use |
|--------|-------------|-------------|
| **Add to System Volatile List** | Field added to global volatile field list. All users benefit going forward. Existing monitors re-evaluate. | Field genuinely changes every request (e.g., `x-request-id`, `date`, `nonce`) |
| **Dismiss** | Mark as reviewed, no action. Users' individual suppressions remain. | Field IS a real change that users misunderstand. Maybe API versioned something. |
| **Create Documentation** | Create/update help article explaining why this field changes and why it matters (or doesn't). | Common confusion point. Users need education, not suppression. |
| **Adjust Detection Logic** | Modify how we detect/report this type of change (e.g., ignore header ordering, normalize timestamps). | Systemic detection issue, not a single field problem. |
| **Defer** | Come back to this later when we have more data. | Not enough evidence yet but trending. |

### Review Dashboard Mockup

```
╔══════════════════════════════════════════════════════════════════╗
║ FEEDBACK REVIEW QUEUE                              5 pending    ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║ 🔴 HIGH  Field 'x-request-id' on api.stripe.com/v1/*           ║
║          47 users flagged (89% of monitors) — Body Header       ║
║          First reported: 2026-01-15                              ║
║          [Review] [Quick Add to Volatile] [Dismiss]              ║
║                                                                  ║
║ 🟡 MED   Field 'server-timing' on *.cloudflare.com             ║
║          12 users flagged (34% of monitors) — Header Changed    ║
║          First reported: 2026-02-20                              ║
║          [Review] [Dismiss]                                      ║
║                                                                  ║
║ 🟡 MED   Field 'data.updated_at' on api.github.com/repos/*     ║
║          8 users flagged (72% of monitors) — Body Field Changed ║
║          First reported: 2026-03-01                              ║
║          [Review] [Dismiss]                                      ║
║                                                                  ║
║ 🟢 LOW   Domain: randomapi.example.com                          ║
║          Overall FP rate: 23% across 15 monitors                 ║
║          [Review Domain] [Defer]                                 ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

### Review SLA

- **High priority** (>20 users or >80% flag rate): Review within 48 hours
- **Medium priority** (5-20 users or 50-80% flag rate): Review within 1 week
- **Low priority** (domain-level or trending): Review within 2 weeks

---

## 4. Proactive FP Detection (Auto-Flagging Noisy Fields)

Beyond waiting for user reports, we can detect likely FP sources ourselves:

### Heuristic-Based Auto-Flagging

| Signal | Threshold | Action |
|--------|-----------|--------|
| Field changes on >90% of checks across all monitors for a URL | 90% change rate | Auto-create review item (likely volatile) |
| URL has >30% FP rate across all users | 30% FP/total alerts | Flag domain for investigation |
| Field name matches known volatile patterns | Regex: `*request.id*`, `*nonce*`, `*timestamp*`, `*trace*`, `*token*` | Pre-populate volatile list + flag for verification |
| Header value changes but name doesn't | Every check | Lower confidence for header-value-only changes |
| Response time field present | Any numeric field like `took`, `elapsed`, `duration` | Likely volatile, flag for review |

### Implementation: Volatility Score

Calculate a per-field volatility score based on observed behavior:

```
volatility_score(field) = (
  times_changed / times_checked * 0.4 +
  unique_values_ratio * 0.3 +
  pattern_match_score * 0.2 +
  fp_report_rate * 0.1
)

If volatility_score > 0.7:
  → Auto-create review item
  → Label: "Proactively detected — likely volatile field"
```

### Benefits of Proactive Detection

1. **Catches FPs before users get annoyed** — we fix it before they even see it
2. **Reduces review queue noise** — proactive fixes mean fewer user reports
3. **Improves onboarding experience** — new users don't get spammed with FPs on their first check
4. **Builds our volatile field knowledge base** over time

### Proactive vs Reactive Comparison

```
REACTIVE (user-driven):
  User sees FP → marks it → aggregated → review → fix
  Time to fix: days to weeks
  User experience: frustrating until fixed

PROACTIVE (system-driven):
  System detects likely volatile field → review → fix
  Time to fix: hours to days (no user report needed)
  User experience: never sees the FP (ideally)

COMBINED (best):
  Proactive catches ~70% of volatile fields before users see them
  Reactive catches the remaining ~30% that slip through
  Feedback data validates/improves proactive detection
```

---

## 5. Feedback Analytics Metrics

### User-Facing Metrics (Per User)
- Fields they've suppressed (count, list)
- FP rate on their monitors (are we getting better for them?)

### Internal Metrics Dashboard

#### Detection Quality
| Metric | Formula | Target |
|--------|---------|--------|
| Global FP Rate | total FP reports / total alerts sent | <10% |
| FP Rate by Domain | FP reports per domain / alerts per domain | Track top 20 |
| FP Rate by Change Type | FPs per change type / alerts per change type | Headers < Body |
| FP Rate Trend | Week-over-week change in global FP rate | Decreasing |
| Mean Time to Resolve FP | Avg time from first FP report to volatile list addition | <7 days |

#### Feedback Health
| Metric | What It Tells Us |
|--------|-----------------|
| Feedback submission rate | Are users bothering to report, or just churning? |
| Feedback per user (distribution) | Power users vs. casual reporters |
| Feedback agreement rate | When multiple users monitor same URL, do they agree on FPs? |
| Time between FP and suppression | How fast do users act on FP alerts? |
| Repeat FP rate | Same user, same field, still getting alerts (broken suppression?) |

#### Proactive Detection Effectiveness
| Metric | What It Tells Us |
|--------|-----------------|
| Proactive catches vs user reports | Ratio of system-detected vs user-reported volatile fields |
| Volatile list growth rate | How fast is our knowledge base growing? |
| False negative rate on volatile list | Fields on volatile list that actually DO have real changes |
| Review queue size trend | Are we keeping up with review items? |

#### Domain/URL Patterns
| Pattern | Track |
|---------|-------|
| CDN-backed URLs (Cloudflare, Fastly, Akamai) | Higher FP rate expected (server headers change) |
| API versioned URLs (*/v1/*, */v2/*) | Should have lower FP rate |
| Dynamic content (search results, feeds) | Very high FP rate → may need special handling |
| Static resources (JSON configs, schema files) | Should have near-zero FP rate |

---

## 6. User Feedback UX

### Design Principles
1. **One click to suppress** — don't make users work to fix our mistakes
2. **Optional reason** — capture it if offered, don't require it
3. **No friction** — feedback should feel like a relief, not a chore
4. **Transparent** — tell users what their feedback does (and doesn't do)

### FP Marking Flow

```
Alert: "Field 'x-request-id' changed in api.stripe.com/v1/charges"

[Mark as Expected]  [View Details]  [Ignore This Field]
```

**"Mark as Expected"** = This field always changes, it's not meaningful.
- Immediate effect: This field suppressed for THIS user on THIS monitor
- Optional follow-up: "Want to tell us more?" (expandable, not blocking)

**"Ignore This Field"** = I don't care about this field regardless.
- Immediate effect: Field suppressed for this user across all their monitors for this URL
- More aggressive than "Mark as Expected"

### Optional Reason (Expandable)

When user clicks "Mark as Expected," show optional expandable:

```
Thanks! This won't bother you again.

Why does this change? (optional, helps us improve)
○ This field always changes (timestamps, IDs, tokens)
○ This is expected behavior (I made this change)  
○ This field isn't relevant to what I'm monitoring
○ Other: [___________]

[Submit]  [Skip]
```

### Why These Categories?

| Reason | What It Tells Us | System Value |
|--------|-----------------|-------------|
| "Always changes" | Strong volatile field signal | High — should be on volatile list |
| "Expected behavior" | User made a change, not a FP | Low — not a detection problem |
| "Not relevant" | Detection is correct but not useful to user | Medium — might need field filtering |
| "Other" | Free text for edge cases | Variable — manual review |

### What We Show Users

In settings or a "suppressed fields" page:

```
Your Suppressed Fields (3)

• x-request-id on api.stripe.com/v1/charges
  Suppressed Mar 15, 2026 — "always changes"
  [Unsuppress]

• server-timing on cdn.example.com
  Suppressed Mar 20, 2026
  [Unsuppress]

• data.nonce on auth.example.com/token
  Suppressed Mar 22, 2026 — "always changes"
  [Unsuppress]
```

### What We DON'T Show Users
- How many other users flagged the same field
- Whether the field is on the system volatile list
- Aggregate feedback data
- Anything that reveals other users' monitoring activity

---

## 7. Privacy Considerations

### What Data We Collect

| Data Point | Personal Data? | Justification |
|-----------|---------------|---------------|
| User ID + feedback action | Yes (linked to account) | Required for user's own suppression to work |
| URL being monitored | Potentially (reveals user interests) | Core product function |
| Field path | No (technical metadata) | Detection improvement |
| Feedback reason | No (categorical) | Detection improvement |
| Timestamp | Yes (linked to user activity) | Required for aggregation |

### Aggregation Privacy Analysis

**Risk:** By aggregating feedback across users monitoring the same URL, could we inadvertently reveal that User A monitors the same endpoint as User B?

**Mitigation:**
- Aggregation happens **server-side only** — no user ever sees aggregate data
- Review dashboard is **internal-only** (Chirri team access)
- Aggregate data shows counts, not individual user identifiers
- Review items display "47 users" not "users alice@, bob@, carol@..."

**No cross-user information leakage because:**
1. Users never see each other's feedback
2. Users never see aggregate feedback counts
3. Users cannot infer how many others monitor the same URL
4. The system volatile list (output of review) reveals nothing about who reported what

### GDPR Considerations

| Aspect | Assessment |
|--------|-----------|
| **Is feedback personal data?** | Yes — it's linked to a user account and constitutes "processing of personal data" |
| **Lawful basis for collection** | Contract performance (feedback is part of product functionality) |
| **Lawful basis for aggregation** | Legitimate interest (improving service quality). Low risk — aggregated data used internally only |
| **Data minimization** | Collect only what's needed: field path, change type, reason. No extra profiling. |
| **Right to erasure** | User deletes account → all their feedback events deleted → aggregate counts decremented |
| **Right to access** | Users can export their feedback history (what they suppressed, when, why) |
| **Data retention** | Raw feedback: retain while account active + 30 days. Aggregate stats: anonymized, retained indefinitely. |
| **Cross-border** | Same rules as rest of product data. Feedback stays in same infrastructure. |

### Privacy-By-Design Measures

1. **Aggregate before storing in review queue** — review items contain counts, not user lists
2. **No user identifiers in volatile list** — the system volatile list is a pure technical artifact
3. **Feedback deletion cascades** — deleting account removes all feedback traces
4. **Internal access logging** — track who views the review dashboard (audit trail)
5. **Anonymize after threshold** — once aggregate data is created, individual feedback links aren't needed for the review item

---

## 8. MVP vs V1.1 vs V2 Breakdown

### MVP (Launch)

**Goal:** Users can suppress FPs for themselves. We collect the data.

| Feature | Description | Effort |
|---------|------------|--------|
| FP marking (one-click) | User marks a change as false positive → suppressed for them | 2-3 days |
| Feedback storage | Store feedback events in database | 1 day |
| User suppression list | Show users what they've suppressed, allow unsuppression | 1-2 days |
| Known volatile fields | Ship with a manually curated initial volatile field list | 1 day |
| Basic regex volatile detection | Match common patterns (request-id, nonce, timestamp, date, trace-id) | 1 day |

**MVP Total: ~6-8 days**

**What's NOT in MVP:**
- No aggregation pipeline
- No internal review dashboard  
- No optional feedback reasons
- No proactive detection
- No analytics

**Why:** MVP validates the core product. The data we collect will inform everything else. We don't need aggregation until we have enough users generating enough feedback.

### V1.1 (After ~500 users or ~3 months)

**Goal:** Start learning from feedback. Build internal tooling.

| Feature | Description | Effort |
|---------|------------|--------|
| Optional feedback reason | Add expandable reason selector when marking FP | 1 day |
| Daily aggregation job | Cron job that aggregates feedback by URL + field + type | 2-3 days |
| Threshold-based flagging | Create review items when thresholds are crossed | 1-2 days |
| Internal review dashboard | Simple admin page showing review queue with actions | 3-5 days |
| Review actions | Add to volatile list / dismiss / defer from dashboard | 2-3 days |
| Basic analytics | FP rate by domain, change type, trend over time | 2-3 days |
| Proactive volatility scoring | Auto-flag fields that change on >90% of checks | 2-3 days |

**V1.1 Total: ~13-20 days**

### V2 (After ~2000 users or ~6 months)

**Goal:** Sophisticated learning. Predictive detection improvement.

| Feature | Description | Effort |
|---------|------------|--------|
| Volatility classifier | ML model: given field name + URL pattern + domain, predict volatility | 2-3 weeks |
| Batch retraining pipeline | Monthly retraining of classifier from feedback data | 1-2 weeks |
| Advanced proactive detection | Auto-flag fields based on classifier + behavioral analysis | 1 week |
| Feedback analytics dashboard | Full internal dashboard with all metrics from Section 5 | 1-2 weeks |
| Domain-level intelligence | "This domain type (CDN, API gateway) tends to have these volatile fields" | 1 week |
| Review workflow automation | Auto-suggest volatile list additions with confidence scores | 1 week |
| Feedback-driven onboarding | New user adds URL → pre-suppress likely volatile fields based on our data | 3-5 days |

**V2 Total: ~7-10 weeks**

### V3+ (Future / Maybe Never)

| Feature | Why Maybe Never |
|---------|----------------|
| Real-time ML inference | Overkill — batch is fine for our use case |
| User-facing aggregate stats | Privacy concerns outweigh value |
| Automated volatile list updates (no human review) | Violates our core principle |
| Cross-user collaborative filtering | Privacy nightmare, marginal value |
| Public API for feedback data | Who would use this? |

---

## 9. Implementation Effort Estimate

### Architecture Components

```
┌──────────────────────────────────────────────────────────┐
│                    CHIRRI BACKEND                          │
│                                                            │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ Feedback API │  │ Aggregation  │  │ Review Dashboard │  │
│  │ (MVP)        │  │ Worker (V1.1)│  │ (V1.1)          │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                │                     │           │
│         ▼                ▼                     ▼           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              PostgreSQL                              │  │
│  │  ┌──────────────┐ ┌───────────────┐ ┌────────────┐  │  │
│  │  │user_feedback  │ │feedback_agg   │ │review_items│  │  │
│  │  │(MVP)          │ │(V1.1)         │ │(V1.1)      │  │  │
│  │  └──────────────┘ └───────────────┘ └────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────┐  ┌──────────────────────────────┐   │
│  │ Volatile Field    │  │ Volatility Classifier (V2)   │   │
│  │ Registry (MVP)    │  │ (Python, scikit-learn)       │   │
│  └──────────────────┘  └──────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Database Schema (MVP)

```sql
-- User feedback events
CREATE TABLE user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  field_path TEXT NOT NULL,
  change_type TEXT NOT NULL,
  feedback_type TEXT NOT NULL DEFAULT 'false_positive',
  feedback_reason TEXT, -- optional, added in V1.1
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate feedback for same field
  UNIQUE(user_id, monitor_id, field_path, change_type)
);

-- User's suppressed fields (derived from feedback, but separate for fast lookups)
CREATE TABLE user_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url_pattern TEXT NOT NULL, -- exact URL or wildcard
  field_path TEXT NOT NULL,
  change_type TEXT, -- NULL means all change types
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, url_pattern, field_path)
);

-- System volatile field list (curated by us)
CREATE TABLE system_volatile_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url_pattern TEXT NOT NULL, -- wildcard supported: "*.stripe.com/*"
  field_path TEXT NOT NULL,
  change_type TEXT, -- NULL means all
  source TEXT NOT NULL, -- 'manual', 'review', 'proactive'
  review_item_id UUID, -- link to review item if from review
  added_by TEXT NOT NULL, -- admin user
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

CREATE INDEX idx_feedback_aggregation 
  ON user_feedback(domain, field_path, change_type);
CREATE INDEX idx_suppressions_lookup 
  ON user_suppressions(user_id, url_pattern);
CREATE INDEX idx_volatile_lookup 
  ON system_volatile_fields(url_pattern, field_path);
```

### Total Effort Summary

| Phase | Calendar Time | Dev Days | Prerequisite |
|-------|-------------|----------|-------------|
| MVP | 1-2 weeks | 6-8 days | None (ship with product) |
| V1.1 | 3-4 weeks | 13-20 days | ~500 users, ~3 months of feedback data |
| V2 | 2-3 months | 35-50 days | ~2000 users, ~6 months of data, data science capacity |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Users don't submit feedback | Medium | High — no data to learn from | Make FP marking extremely easy. Track suppression rates. |
| Too many review items, team can't keep up | Medium | Medium — queue grows, FP rate stays high | Aggressive proactive detection to reduce queue. Prioritize by impact. |
| Volatile list grows too large | Low | Low — more entries = fewer FPs | Periodic review of volatile list for stale entries. |
| Feedback gaming (user marks everything as FP) | Low | Low — only affects their own view | Rate-limit feedback submissions. Flag outlier users internally. |
| Privacy incident (aggregate data leaked) | Very Low | High | Aggregate data never exposed to users. Access logging on admin dashboard. |

---

## Appendix: Initial Volatile Field Seed List

Ship MVP with these pre-populated in `system_volatile_fields`:

### Headers (Common Across Most APIs)
- `date` / `Date`
- `x-request-id` / `x-req-id` / `request-id`
- `x-trace-id` / `trace-id` / `traceparent`
- `x-correlation-id` / `correlation-id`
- `server-timing`
- `x-runtime` / `x-response-time`
- `x-ratelimit-remaining`
- `x-ratelimit-reset`
- `cf-ray` (Cloudflare)
- `x-amz-request-id` (AWS)
- `x-cache` / `x-cache-hits`
- `age` (cache age)
- `etag` (changes with content)
- `set-cookie` (session cookies)
- `strict-transport-security` (max-age counter)

### Body Fields (Pattern-Based)
- `*.request_id` / `*.requestId`
- `*.timestamp` / `*.created_at` / `*.updated_at`
- `*.nonce`
- `*.token` (session/CSRF tokens)
- `*.elapsed` / `*.took` / `*.duration`
- `*.server_time` / `*.serverTime`
