# Chirri — Project Management Integrations Research

> **Goal:** One-click "Create ticket" from any Chirri change alert → pre-filled ticket in the user's task tracker.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Jira Cloud](#2-jira-cloud)
3. [Linear](#3-linear)
4. [GitHub Issues](#4-github-issues)
5. [Asana](#5-asana)
6. [Generic Webhook](#6-generic-webhook)
7. [Shared OAuth Infrastructure](#7-shared-oauth-infrastructure)
8. [Field Mapping (All Tools)](#8-field-mapping-all-tools)
9. [UX Flow](#9-ux-flow)
10. [Sentry's Jira Integration (Gold Standard)](#10-sentrys-jira-integration-gold-standard)
11. [Implementation Priorities & Effort](#11-implementation-priorities--effort)

---

## 1. Architecture Overview

### Common Pattern
```
┌─────────────────────────────────┐
│  Chirri Dashboard               │
│  ┌───────────────────────────┐  │
│  │ Change Alert Card         │  │
│  │  [Create Ticket ▼]       │  │  ← dropdown: Jira / Linear / GitHub / Asana
│  │  (opens modal)            │  │
│  └───────────────────────────┘  │
└─────────┬───────────────────────┘
          │ POST /api/integrations/{tool}/create-issue
          ▼
┌─────────────────────────────────┐
│  Chirri Backend                 │
│  • Load user's stored OAuth     │
│    token for {tool}             │
│  • Build payload from change    │
│    data + user customizations   │
│  • Call external API            │
│  • Return ticket URL            │
└─────────────────────────────────┘
```

### Token Storage
- Encrypted OAuth tokens stored per-user per-integration in DB
- Refresh tokens stored separately, auto-refreshed on 401
- Integration settings (default project, labels, etc.) stored per-org

---

## 2. Jira Cloud

### Auth Flow: OAuth 2.0 (3LO)

**Setup:**
1. Register app in [Atlassian Developer Console](https://developer.atlassian.com/console/myapps/)
2. Enable OAuth 2.0 (3LO), set callback URL
3. Add permissions: `write:jira-work` (create issues), `read:jira-work` (read projects/issue types)

**Authorization URL:**
```
GET https://auth.atlassian.com/authorize?
  audience=api.atlassian.com&
  client_id=YOUR_CLIENT_ID&
  scope=write:jira-work read:jira-work read:me offline_access&
  redirect_uri=https://chirri.dev/oauth/jira/callback&
  state=CSRF_TOKEN&
  response_type=code&
  prompt=consent
```

**Token Exchange:**
```
POST https://auth.atlassian.com/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "code": "AUTH_CODE",
  "redirect_uri": "https://chirri.dev/oauth/jira/callback"
}
```
Returns `access_token` (1 hour) + `refresh_token`.

**Important:** After auth, must call `GET https://api.atlassian.com/oauth/token/accessible-resources` to get the `cloudId` for the user's Jira instance.

### API Endpoint: Create Issue

```
POST https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Payload Format

```json
{
  "fields": {
    "project": {
      "key": "PROJ"
    },
    "summary": "Breaking change detected: Stripe /v1/charges",
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Chirri detected a breaking API change.",
              "type": "text"
            }
          ]
        },
        {
          "type": "heading",
          "attrs": { "level": 3 },
          "content": [
            { "text": "Change Summary", "type": "text" }
          ]
        },
        {
          "type": "bulletList",
          "content": [
            {
              "type": "listItem",
              "content": [
                {
                  "type": "paragraph",
                  "content": [
                    { "text": "Field `amount` type changed from integer to string", "type": "text" }
                  ]
                }
              ]
            }
          ]
        },
        {
          "type": "paragraph",
          "content": [
            { "text": "View full diff: ", "type": "text" },
            {
              "text": "https://chirri.dev/changes/abc123",
              "type": "text",
              "marks": [{ "type": "link", "attrs": { "href": "https://chirri.dev/changes/abc123" } }]
            }
          ]
        }
      ]
    },
    "issuetype": {
      "name": "Task"
    },
    "priority": {
      "name": "High"
    },
    "labels": ["api-change", "chirri-detected", "severity-high"]
  }
}
```

**Response:**
```json
{
  "id": "10052",
  "key": "PROJ-42",
  "self": "https://your-instance.atlassian.net/rest/api/3/issue/10052"
}
```

### Key Details

| Aspect | Detail |
|--------|--------|
| **Description format** | **ADF (Atlassian Document Format)** — NOT markdown. Must convert markdown → ADF JSON tree. Libraries: `adf-builder` (npm), `md-to-adf` |
| **Pre-fillable fields** | summary, description, project, issuetype, priority, labels, assignee, components, fixVersions, custom fields |
| **Priority values** | Highest, High, Medium, Low, Lowest (configurable per instance) |
| **Labels** | Free-text array, auto-created on first use |
| **Cloud vs Server** | **Cloud only for MVP.** Server/Data Center uses different auth (personal access tokens or OAuth 1.0a). Jira Server is being deprecated by Atlassian. |
| **API pricing** | Free with any Jira Cloud plan. Rate limits: ~100 requests/min per user token |
| **Helper endpoints** | `GET /rest/api/3/project/search` (list projects), `GET /rest/api/3/issuetype` (list types), `GET /rest/api/3/issue/createmeta` (required fields) |

### Error Handling
- **401 Unauthorized** → Refresh token, retry. If refresh fails → prompt user to re-auth
- **404 Project not found** → Show error, let user pick different project in settings
- **400 Missing required field** → Fetch `createmeta` to discover required fields for that project/issuetype combo
- **429 Rate limit** → Respect `Retry-After` header

### Implementation Effort: **20-28 hours**
- OAuth flow + token management: 8h
- ADF conversion (markdown → ADF): 6h (this is the hardest part)
- Create issue API + error handling: 4h
- Settings UI (project picker, issue type, default labels): 6h
- Testing: 4h

### **MVP? V1.1** ⏳
Jira is the most complex due to ADF. Ship after Linear and GitHub.

---

## 3. Linear

### Auth Flow: OAuth 2.0

**Setup:**
1. Create OAuth2 Application at [Linear Settings](https://linear.app/settings/api/applications/new)
2. Configure redirect callback URL

**Authorization URL:**
```
GET https://linear.app/oauth/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://chirri.dev/oauth/linear/callback&
  response_type=code&
  scope=read,write,issues:create&
  state=CSRF_TOKEN&
  prompt=consent
```

**Token Exchange:**
```
POST https://api.linear.app/oauth/token
Content-Type: application/x-www-form-urlencoded

code=AUTH_CODE&
redirect_uri=https://chirri.dev/oauth/linear/callback&
client_id=YOUR_CLIENT_ID&
client_secret=YOUR_CLIENT_SECRET&
grant_type=authorization_code
```

Returns `access_token` (+ `refresh_token` for apps created after Oct 2025).

### API Endpoint: Create Issue (GraphQL)

```
POST https://api.linear.app/graphql
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Payload Format

```json
{
  "query": "mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title url } } }",
  "variables": {
    "input": {
      "title": "Breaking change detected: Stripe /v1/charges",
      "description": "## Change Summary\n\n- Field `amount` type changed from integer to string\n- Field `metadata` removed\n\n**Severity:** High\n**Provider:** Stripe\n**Endpoint:** `/v1/charges`\n\n[View full diff on Chirri](https://chirri.dev/changes/abc123)\n\n### Recommended Action\nUpdate charge amount parsing to handle string values. Remove references to metadata field.",
      "teamId": "team-uuid-here",
      "priority": 2,
      "labelIds": ["label-uuid-1", "label-uuid-2"]
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "issueCreate": {
      "success": true,
      "issue": {
        "id": "uuid",
        "identifier": "ENG-42",
        "title": "Breaking change detected: Stripe /v1/charges",
        "url": "https://linear.app/team/issue/ENG-42"
      }
    }
  }
}
```

### Key Details

| Aspect | Detail |
|--------|--------|
| **Description format** | **Native Markdown** ✅ — perfect fit for Chirri's change summaries |
| **Pre-fillable fields** | title, description, teamId (required), priority (0-4), labelIds, projectId, assigneeId, stateId, estimate, dueDate |
| **Priority values** | 0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low |
| **Labels** | Must use existing label UUIDs. Query `labels` first or create via `labelCreate` mutation |
| **PKCE support** | Yes — `code_challenge` + `code_challenge_method` params |
| **Rate limits** | 1500 requests/hour for OAuth apps (generous) |
| **Helper queries** | `teams { nodes { id name } }`, `labels { nodes { id name } }`, `projects { nodes { id name } }` |

### Error Handling
- **401** → Refresh token (if available), else re-auth
- **GraphQL errors** → Check `errors` array in response; surface to user
- **Team not found** → User picks team in settings; fetch team list on connect

### Implementation Effort: **12-16 hours**
- OAuth flow + token management: 6h
- GraphQL mutation + helper queries: 3h
- Settings UI (team picker, label config): 3h
- Testing: 2h

### **MVP? YES** ✅
Linear is the easiest integration. Markdown native, clean API, fast OAuth. Ship first.

---

## 4. GitHub Issues

### Auth Flow: GitHub App (recommended) or OAuth App

**Recommended: GitHub App** (more granular permissions, higher rate limits)

1. Register GitHub App at `https://github.com/settings/apps/new`
2. Set callback URL, request permissions: `Issues: Read & Write`
3. Users install the app on their repos

**Authorization URL (OAuth via GitHub App):**
```
GET https://github.com/login/oauth/authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://chirri.dev/oauth/github/callback&
  scope=repo&
  state=CSRF_TOKEN
```

**Token Exchange:**
```
POST https://github.com/login/oauth/access_token
Accept: application/json

{
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET",
  "code": "AUTH_CODE"
}
```

Returns `access_token` (no expiry for OAuth Apps; GitHub App installation tokens expire in 1 hour).

### API Endpoint: Create Issue

```
POST https://api.github.com/repos/{owner}/{repo}/issues
Authorization: Bearer {access_token}
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
```

### Payload Format

```json
{
  "title": "Breaking change detected: Stripe /v1/charges",
  "body": "## 🔔 API Change Detected by Chirri\n\n**Provider:** Stripe\n**Endpoint:** `/v1/charges`\n**Severity:** 🔴 High\n**Detected:** 2024-01-15T10:30:00Z\n\n### Changes\n\n- ❌ Field `amount` type changed from `integer` to `string`\n- ❌ Field `metadata` removed\n\n### Recommended Action\n\nUpdate charge amount parsing to handle string values. Remove references to metadata field.\n\n---\n\n[View full diff on Chirri](https://chirri.dev/changes/abc123) | [Chirri Dashboard](https://chirri.dev)",
  "labels": ["api-change", "chirri-detected", "severity-high"],
  "assignees": ["username"]
}
```

**Response:**
```json
{
  "id": 1,
  "number": 42,
  "html_url": "https://github.com/owner/repo/issues/42",
  "title": "Breaking change detected: Stripe /v1/charges",
  "state": "open"
}
```

### Key Details

| Aspect | Detail |
|--------|--------|
| **Description format** | **GitHub Flavored Markdown** ✅ — perfect fit |
| **Pre-fillable fields** | title (required), body, labels, assignees, milestone |
| **Labels** | Auto-created if they don't exist? **No** — labels must exist on the repo. Use `POST /repos/{owner}/{repo}/labels` to create them first, or check with `GET /repos/{owner}/{repo}/labels` |
| **Priority** | GitHub has no native priority field. Use labels: `priority: high`, `priority: critical`, etc. |
| **Rate limits** | 5000 requests/hour (authenticated), 15000/hour for GitHub App installations |
| **Helper endpoints** | `GET /repos/{owner}/{repo}/labels`, `GET /user/repos` (list repos), `GET /repos/{owner}/{repo}/milestones` |

### Auto-Label Setup
On first connection, Chirri should offer to create standard labels on the selected repo:
- `chirri-detected` (color: #7B61FF)
- `api-change` (color: #0075CA)
- `severity-critical` (color: #D73A49)
- `severity-high` (color: #E36209)
- `severity-medium` (color: #FBCA04)
- `severity-low` (color: #0E8A16)

### Error Handling
- **401** → Token invalid/revoked → re-auth
- **404** → Repo not found or no access → prompt user to check permissions
- **422** → Validation error (e.g., label doesn't exist) → create label first, retry
- **403 rate limit** → Check `X-RateLimit-Remaining`, back off

### Implementation Effort: **12-16 hours**
- OAuth flow + token management: 5h
- Create issue API + label management: 4h
- Settings UI (repo picker): 3h
- Testing: 2h

### **MVP? YES** ✅
GitHub Issues is very straightforward. Many Chirri users likely track work in GitHub. Ship alongside Linear.

---

## 5. Asana

### Auth Flow: OAuth 2.0

**Setup:**
1. Create app in [Asana Developer Console](https://app.asana.com/0/my-apps)
2. Set redirect URL, get client ID + secret
3. Required scope: `default` (full access) — Asana doesn't have granular scopes beyond `tasks:write`

**Authorization URL:**
```
GET https://app.asana.com/-/oauth_authorize?
  client_id=YOUR_CLIENT_ID&
  redirect_uri=https://chirri.dev/oauth/asana/callback&
  response_type=code&
  state=CSRF_TOKEN
```

**Token Exchange:**
```
POST https://app.asana.com/-/oauth_token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&
client_id=YOUR_CLIENT_ID&
client_secret=YOUR_CLIENT_SECRET&
redirect_uri=https://chirri.dev/oauth/asana/callback&
code=AUTH_CODE
```

Returns `access_token` (1 hour) + `refresh_token`.

### API Endpoint: Create Task

```
POST https://app.asana.com/api/1.0/tasks
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Payload Format

```json
{
  "data": {
    "name": "Breaking change detected: Stripe /v1/charges",
    "notes": "API Change Detected by Chirri\n\nProvider: Stripe\nEndpoint: /v1/charges\nSeverity: High\nDetected: 2024-01-15T10:30:00Z\n\nChanges:\n• Field `amount` type changed from integer to string\n• Field `metadata` removed\n\nRecommended Action:\nUpdate charge amount parsing to handle string values.\n\nView full diff: https://chirri.dev/changes/abc123",
    "html_notes": "<body><h3>API Change Detected by Chirri</h3><p><strong>Provider:</strong> Stripe<br><strong>Endpoint:</strong> /v1/charges<br><strong>Severity:</strong> 🔴 High</p><h3>Changes</h3><ul><li>Field <code>amount</code> type changed from integer to string</li><li>Field <code>metadata</code> removed</li></ul><h3>Recommended Action</h3><p>Update charge amount parsing to handle string values.</p><p><a href=\"https://chirri.dev/changes/abc123\">View full diff on Chirri</a></p></body>",
    "projects": ["PROJECT_GID"],
    "assignee": "USER_GID",
    "due_on": "2024-01-22",
    "tags": ["TAG_GID"]
  }
}
```

**Response:**
```json
{
  "data": {
    "gid": "12345",
    "name": "Breaking change detected: Stripe /v1/charges",
    "permalink_url": "https://app.asana.com/0/0/12345"
  }
}
```

### Key Details

| Aspect | Detail |
|--------|--------|
| **Description format** | `notes` = plain text, `html_notes` = limited HTML subset (no markdown). Use `html_notes` for rich formatting. Supported tags: `<body>`, `<h1>`-`<h3>`, `<p>`, `<strong>`, `<em>`, `<u>`, `<code>`, `<a>`, `<ul>`, `<ol>`, `<li>`, `<br>` |
| **Pre-fillable fields** | name (required), notes/html_notes, projects, assignee, due_on, due_at, tags, memberships (for section), custom_fields |
| **Priority** | No native priority field. Use custom fields or tags. |
| **Tags** | Must use existing tag GIDs. Create via `POST /tags` first. |
| **Rate limits** | 1500 requests/minute (very generous) |
| **Helper endpoints** | `GET /workspaces` (list workspaces), `GET /projects` (list projects), `GET /users/me` (current user), `GET /sections?project=GID` |

### Error Handling
- **401** → Refresh token, retry. If refresh fails → re-auth
- **403** → Insufficient permissions → check workspace/project access
- **400** → Invalid field → surface error message to user
- **404** → Project/task not found → prompt user to update settings

### Implementation Effort: **14-18 hours**
- OAuth flow + token management: 6h
- Create task API + HTML conversion: 4h
- Settings UI (workspace/project/section picker): 4h
- Testing: 2h

### **MVP? V1.1** ⏳
Less common in developer-heavy teams. Ship after Linear, GitHub, Jira.

---

## 6. Generic Webhook (Custom Action)

### Concept
For tools we don't natively support (Notion, ClickUp, Monday.com, Shortcut, Trello, etc.), users configure a webhook URL. When they click "Create Ticket," we POST the change data to their URL.

### No Auth Required (for Chirri)
User provides their webhook URL + optional secret for HMAC signature verification.

### Payload Format

```json
{
  "event": "ticket.create_request",
  "timestamp": "2024-01-15T10:30:00Z",
  "change": {
    "id": "abc123",
    "provider": "Stripe",
    "endpoint": "/v1/charges",
    "severity": "high",
    "summary": "Breaking change detected: Stripe /v1/charges",
    "changes": [
      {
        "type": "field_type_changed",
        "field": "amount",
        "from": "integer",
        "to": "string"
      },
      {
        "type": "field_removed",
        "field": "metadata"
      }
    ],
    "description_markdown": "## Change Summary\n\n- Field `amount` type changed...",
    "description_html": "<h2>Change Summary</h2><ul><li>Field <code>amount</code>...",
    "description_text": "Change Summary\n\n• Field `amount` type changed...",
    "diff_url": "https://chirri.dev/changes/abc123",
    "recommended_action": "Update charge amount parsing..."
  },
  "suggested_ticket": {
    "title": "Breaking change detected: Stripe /v1/charges",
    "priority": "high",
    "labels": ["api-change", "chirri-detected", "severity-high"]
  }
}
```

Headers:
```
X-Chirri-Signature: sha256=HMAC_HASH
X-Chirri-Event: ticket.create_request
Content-Type: application/json
```

### Integration with Zapier/Make/n8n
Provide docs + templates for:
- **Zapier:** "Catch Webhook" trigger → Notion/ClickUp/Trello action
- **Make:** HTTP webhook module → any tool
- **n8n:** Webhook node → any tool

### Implementation Effort: **4-6 hours**
- Webhook sender + HMAC signing: 2h
- Settings UI (URL + secret config): 2h
- Documentation + examples: 2h

### **MVP? YES** ✅
Quick to build, covers long tail of tools.

---

## 7. Shared OAuth Infrastructure

### Recommended Library: **Arctic** by Lucia

[Arctic](https://arctic.js.org/) — lightweight, zero-dependency OAuth 2.0 client for Node.js. Supports 50+ providers including Atlassian, GitHub, Linear. Created by the Lucia auth team.

**Why Arctic over Passport.js:**
- No middleware coupling (works with any framework)
- TypeScript-first
- Minimal API surface
- Built-in PKCE support
- Active maintenance

**Alternative:** `oslo/oauth2` (same team, even lower level)

### Shared OAuth Architecture

```typescript
// Unified integration service pattern
interface IntegrationProvider {
  name: string;
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  createTicket(token: string, data: TicketData): Promise<TicketResult>;
  getProjects(token: string): Promise<Project[]>;
}

// Token storage (encrypted)
interface StoredToken {
  userId: string;
  provider: 'jira' | 'linear' | 'github' | 'asana';
  accessToken: string;       // encrypted
  refreshToken?: string;     // encrypted
  expiresAt?: Date;
  metadata: {
    // Jira: cloudId, site name
    // Linear: team ID, workspace
    // GitHub: repos, installation ID
    // Asana: workspace GID
  };
}
```

### Token Refresh Strategy
```
On API call:
1. Check if token expires within 5 minutes
2. If yes → refresh before making the call
3. If refresh fails (invalid_grant) → mark integration as disconnected
4. Notify user to re-authenticate
```

---

## 8. Field Mapping (All Tools)

### Chirri Data → Ticket Fields

| Chirri Field | Jira | Linear | GitHub Issues | Asana |
|---|---|---|---|---|
| Change title | `summary` | `title` | `title` | `name` |
| Change description | `description` (ADF) | `description` (MD) | `body` (MD) | `html_notes` (HTML) |
| Severity: Critical | Priority: Highest | Priority: 1 (Urgent) | Label: `severity-critical` | Tag/Custom field |
| Severity: High | Priority: High | Priority: 2 (High) | Label: `severity-high` | Tag/Custom field |
| Severity: Medium | Priority: Medium | Priority: 3 (Medium) | Label: `severity-medium` | Tag/Custom field |
| Severity: Low | Priority: Low | Priority: 4 (Low) | Label: `severity-low` | Tag/Custom field |
| Provider name | Label | Label | Label | Tag |
| "chirri-detected" | Label | Label | Label | Tag |
| Diff URL | Link in description | Link in description | Link in body | Link in html_notes |
| Recommended action | In description | In description | In body | In html_notes |

### Title Template
```
Breaking change detected: {provider} {endpoint}
```
Example: `Breaking change detected: Stripe /v1/charges`

### Description Template (Markdown — for Linear & GitHub)
```markdown
## 🔔 API Change Detected by Chirri

**Provider:** {provider}
**Endpoint:** `{endpoint}`
**Severity:** {severity_emoji} {severity}
**Detected:** {detected_at}

### Changes

{changes_list}

### Recommended Action

{recommended_action}

---

[View full diff on Chirri]({diff_url}) | [Chirri Dashboard](https://chirri.dev)
```

---

## 9. UX Flow

### Recommended: Modal with Pre-filled Data

1. User sees change alert in Chirri dashboard
2. Clicks **"Create Ticket"** button (or dropdown arrow for tool selection)
3. **Modal opens** with pre-filled fields:
   - Title (editable)
   - Description preview (collapsible)
   - Target project/team/repo (dropdown, remembered from last use)
   - Priority (pre-selected from severity, editable)
   - Assignee (optional)
   - Labels/tags (pre-selected, editable)
4. User clicks **"Create"**
5. Ticket is created, modal shows link to new ticket
6. Change card in Chirri shows linked ticket badge

### Why a Modal (Not Pure One-Click)
- Users need to pick the right project/repo (especially first time)
- Lets them customize title/assignee before creating
- Prevents accidental duplicate tickets
- After first use, remember preferences → subsequent creates are faster

### Quick Create (V1.1)
After user has created 3+ tickets for same integration:
- "Quick Create" button creates with saved defaults, no modal
- Shows toast: "Created PROJ-42 in Jira" with link

---

## 10. Sentry's Jira Integration (Gold Standard)

### How Sentry Does It

1. **Installation:** Admin installs "Sentry for Jira" from Atlassian Marketplace (Atlassian Connect app)
2. **Configuration:** In Sentry org settings, click "Add Jira" → OAuth consent → select Jira site
3. **Usage:** On any Sentry issue, click "Create Jira Issue" → modal with pre-filled fields
4. **Bi-directional sync:** Issue status syncs between Sentry ↔ Jira (e.g., resolving in Jira resolves in Sentry)
5. **Auto-creation rules:** Can configure alert rules to auto-create Jira issues

### What Chirri Should Borrow
- ✅ **One-click from alert** → modal → create (we're doing this)
- ✅ **Pre-filled fields** from detection data
- ✅ **Project/issue type picker** in the modal
- ✅ **Link badge** on the alert after ticket is created
- 🔜 **Bi-directional sync** (V2 — update Chirri when ticket is resolved)
- 🔜 **Auto-creation rules** (V2 — auto-create tickets for Critical severity)

### What Sentry Does Differently (Heavier)
- Uses **Atlassian Connect** (iframe-based app in Jira) — overkill for Chirri
- Full **issue link sync** with assignee mapping — complex, defer to V2
- **Jira sidebar panel** showing Sentry data — not needed for Chirri

### Our Approach: Simpler
Use **OAuth 2.0 (3LO)** instead of Atlassian Connect. We just need to create issues, not embed in Jira's UI. Much simpler to build and maintain.

---

## 11. Implementation Priorities & Effort

### Phase 1: MVP (Sprint 1-2)

| Integration | Effort | Why First |
|---|---|---|
| **Linear** | 12-16h | Easiest API, markdown native, dev-favorite tool |
| **GitHub Issues** | 12-16h | Markdown native, many users already on GitHub |
| **Generic Webhook** | 4-6h | Covers long tail immediately |
| **OAuth Infrastructure** | 8-10h | Shared across all integrations |
| **Settings UI** | 6-8h | Connect/disconnect, default project, etc. |

**Total MVP: ~45-55 hours (~1.5 sprints)**

### Phase 2: V1.1 (Sprint 3-4)

| Integration | Effort | Why Deferred |
|---|---|---|
| **Jira Cloud** | 20-28h | Most complex (ADF format), but highest enterprise demand |
| **Asana** | 14-18h | Less common for dev teams |

**Total V1.1: ~35-45 hours (~1 sprint)**

### Phase 3: V2 (Future)

| Feature | Effort |
|---|---|
| Bi-directional sync (ticket resolved → Chirri updated) | 20-30h |
| Auto-create rules (severity-based) | 10-15h |
| Jira Server/Data Center support | 15-20h |
| Bulk ticket creation (multiple changes → one ticket) | 8-12h |
| Template customization per org | 10-15h |

---

## Quick Reference: API Cheat Sheet

| Tool | Auth | Endpoint | Format | Rate Limit |
|---|---|---|---|---|
| **Jira Cloud** | OAuth 2.0 (3LO) | `POST /ex/jira/{cloudId}/rest/api/3/issue` | ADF JSON | ~100/min |
| **Linear** | OAuth 2.0 | `POST /graphql` (mutation `issueCreate`) | Markdown | 1500/hr |
| **GitHub** | GitHub App OAuth | `POST /repos/{owner}/{repo}/issues` | GFM Markdown | 5000/hr |
| **Asana** | OAuth 2.0 | `POST /api/1.0/tasks` | HTML subset | 1500/min |
| **Webhook** | HMAC signature | User-provided URL | JSON (all formats included) | N/A |

---

## Open Questions

1. **Should we support Jira Server/Data Center?** — Recommend Cloud-only for now; Server is being deprecated.
2. **Do we need org-wide integrations or per-user?** — Start per-user, add org-wide admin setup later.
3. **Multiple integrations simultaneously?** — Yes, user should be able to create a Jira ticket AND a GitHub issue for the same change.
4. **Duplicate prevention?** — Track which changes have been ticketed (change_id ↔ ticket_url mapping). Show "Already ticketed: PROJ-42" badge.
5. **Should webhook include all three description formats?** — Yes (markdown, HTML, plain text) so users can pick what their downstream tool needs.
