// Generate all 30 changelog entry fixtures
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const dir = new URL('./changelog-entries/', import.meta.url).pathname;

const entries = [
  // === STRIPE (5) ===
  // stripe-01 and stripe-02 already created
  {
    id: "stripe-03",
    source: "Stripe API Changelog",
    title: "Adds payment behavior control for subscription item deletion",
    date: "2026-02-25",
    raw_changelog: "Adds payment behavior control for subscription item deletion. When deleting a subscription item, you can now control the payment behavior via the payment_behavior parameter.",
    before_text: `## Delete a Subscription Item\n\nDELETE /v1/subscription_items/{id}\n\n### Parameters\n| Parameter | Type | Description |\n|-----------|------|-------------|\n| proration_behavior | enum | Determines proration behavior |\n| clear_usage | boolean | Clears usage data |`,
    after_text: `## Delete a Subscription Item\n\nDELETE /v1/subscription_items/{id}\n\n### Parameters\n| Parameter | Type | Description |\n|-----------|------|-------------|\n| proration_behavior | enum | Determines proration behavior |\n| clear_usage | boolean | Clears usage data |\n| payment_behavior | enum | Controls payment behavior. One of: default_incomplete, allow_incomplete, error_if_incomplete, pending_if_incomplete |`,
    diff_text: `--- before\n+++ after\n@@ -7,3 +7,4 @@\n | proration_behavior | enum | Determines proration behavior |\n | clear_usage | boolean | Clears usage data |\n+| payment_behavior | enum | Controls payment behavior. One of: default_incomplete, allow_incomplete, error_if_incomplete, pending_if_incomplete |`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["DELETE /v1/subscription_items/{id}"], action_required: "No action required. New optional parameter available for finer control over payment behavior when deleting subscription items.", cosmetic_only: false, confidence_notes: "New optional parameter addition" }
  },
  {
    id: "stripe-04",
    source: "Stripe API Changelog",
    title: "Adds Terminal reader and location to payment method details",
    date: "2026-02-25",
    raw_changelog: "Adds Terminal reader and location to payment method details. The payment method details for Terminal payments now include the reader ID and location ID.",
    before_text: `## Payment Method Details - Card Present\n\n\`\`\`json\n{\n  "card_present": {\n    "brand": "visa",\n    "last4": "4242",\n    "exp_month": 12,\n    "exp_year": 2027,\n    "fingerprint": "abc123"\n  }\n}\n\`\`\``,
    after_text: `## Payment Method Details - Card Present\n\n\`\`\`json\n{\n  "card_present": {\n    "brand": "visa",\n    "last4": "4242",\n    "exp_month": 12,\n    "exp_year": 2027,\n    "fingerprint": "abc123",\n    "reader": "tmr_xxx",\n    "location": "tml_xxx"\n  }\n}\n\`\`\``,
    diff_text: `--- before\n+++ after\n@@ -7,5 +7,7 @@\n     "exp_year": 2027,\n-    "fingerprint": "abc123"\n+    "fingerprint": "abc123",\n+    "reader": "tmr_xxx",\n+    "location": "tml_xxx"`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["Payment Method Details"], action_required: "No action required. New fields available in card_present payment method details for Terminal payments.", cosmetic_only: false, confidence_notes: "Additive change, new fields in response" }
  },
  {
    id: "stripe-05",
    source: "Stripe API Changelog",
    title: "Adds settlement type to Application Fee objects",
    date: "2026-02-25",
    raw_changelog: "Adds settlement type to Application Fee objects. A new settlement_type field is added to Application Fee objects to indicate the settlement type.",
    before_text: `## Application Fee Object\n\n\`\`\`json\n{\n  "id": "fee_xxx",\n  "object": "application_fee",\n  "amount": 100,\n  "currency": "usd",\n  "created": 1234567890,\n  "account": "acct_xxx",\n  "application": "ca_xxx"\n}\n\`\`\``,
    after_text: `## Application Fee Object\n\n\`\`\`json\n{\n  "id": "fee_xxx",\n  "object": "application_fee",\n  "amount": 100,\n  "currency": "usd",\n  "created": 1234567890,\n  "account": "acct_xxx",\n  "application": "ca_xxx",\n  "settlement_type": "standard"\n}\n\`\`\``,
    diff_text: `--- before\n+++ after\n@@ -8,5 +8,6 @@\n   "account": "acct_xxx",\n-  "application": "ca_xxx"\n+  "application": "ca_xxx",\n+  "settlement_type": "standard"`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["Application Fee API"], action_required: "No action required. New settlement_type field available on Application Fee objects.", cosmetic_only: false, confidence_notes: "Additive response field" }
  },

  // === GITHUB (5) ===
  {
    id: "github-01",
    source: "GitHub API Changelog",
    title: "REST API: Deprecation of the team discussions API",
    date: "2026-03-15",
    raw_changelog: "The team discussions API endpoints are deprecated and will be removed on March 1, 2027. Migrate to GitHub Discussions instead.",
    before_text: `## Team Discussions API\n\nList discussions for a team.\n\nGET /orgs/{org}/teams/{team_slug}/discussions\n\n### Response\nStatus: 200 OK\n\`\`\`json\n[\n  {\n    "number": 1,\n    "title": "Design meeting notes",\n    "body": "...",\n    "author": { "login": "octocat" }\n  }\n]\n\`\`\``,
    after_text: `## Team Discussions API (Deprecated)\n\n> **Deprecation Notice:** This API will be removed on March 1, 2027. Migrate to GitHub Discussions.\n\nList discussions for a team.\n\nGET /orgs/{org}/teams/{team_slug}/discussions\n\n### Response\nStatus: 200 OK\n\`\`\`json\n[\n  {\n    "number": 1,\n    "title": "Design meeting notes",\n    "body": "...",\n    "author": { "login": "octocat" }\n  }\n]\n\`\`\``,
    diff_text: `--- before\n+++ after\n@@ -1,4 +1,6 @@\n-## Team Discussions API\n+## Team Discussions API (Deprecated)\n \n-List discussions for a team.\n+> **Deprecation Notice:** This API will be removed on March 1, 2027. Migrate to GitHub Discussions.\n+\n+List discussions for a team.`,
    ground_truth: { severity: "high", is_breaking: false, breaking_reason: null, affected_endpoints: ["GET /orgs/{org}/teams/{team_slug}/discussions"], action_required: "Plan migration from Team Discussions API to GitHub Discussions before March 1, 2027 deadline.", cosmetic_only: false, confidence_notes: "Deprecation notice with clear removal date" }
  },
  {
    id: "github-02",
    source: "GitHub API Changelog",
    title: "New required permissions for GitHub App fine-grained tokens",
    date: "2026-03-10",
    raw_changelog: "Starting April 15, 2026, the contents:write permission is now required for the POST /repos/{owner}/{repo}/git/refs endpoint when using fine-grained personal access tokens or GitHub App tokens.",
    before_text: `## Create a reference\n\nPOST /repos/{owner}/{repo}/git/refs\n\n### Permissions\n- Fine-grained tokens: contents:read`,
    after_text: `## Create a reference\n\nPOST /repos/{owner}/{repo}/git/refs\n\n### Permissions\n- Fine-grained tokens: contents:write (changed from contents:read, effective April 15, 2026)`,
    diff_text: `--- before\n+++ after\n@@ -4,4 +4,4 @@\n ### Permissions\n-- Fine-grained tokens: contents:read\n+- Fine-grained tokens: contents:write (changed from contents:read, effective April 15, 2026)`,
    ground_truth: { severity: "critical", is_breaking: true, breaking_reason: "Permission requirement changed from read to write. Existing tokens with only read permission will fail.", affected_endpoints: ["POST /repos/{owner}/{repo}/git/refs"], action_required: "Update fine-grained tokens to include contents:write permission before April 15, 2026.", cosmetic_only: false, confidence_notes: "Breaking permission change with deadline" }
  },
  {
    id: "github-03",
    source: "GitHub API Changelog",
    title: "Code scanning API now returns severity field",
    date: "2026-03-05",
    raw_changelog: "The code scanning alerts API now includes a severity field in alert responses.",
    before_text: `## List code scanning alerts\n\nGET /repos/{owner}/{repo}/code-scanning/alerts\n\n### Response\n\`\`\`json\n{\n  "number": 42,\n  "state": "open",\n  "rule": {\n    "id": "js/xss",\n    "description": "Cross-site scripting"\n  },\n  "tool": { "name": "CodeQL" }\n}\n\`\`\``,
    after_text: `## List code scanning alerts\n\nGET /repos/{owner}/{repo}/code-scanning/alerts\n\n### Response\n\`\`\`json\n{\n  "number": 42,\n  "state": "open",\n  "severity": "high",\n  "rule": {\n    "id": "js/xss",\n    "severity": "high",\n    "description": "Cross-site scripting"\n  },\n  "tool": { "name": "CodeQL" }\n}\n\`\`\``,
    diff_text: `--- before\n+++ after\n@@ -7,6 +7,8 @@\n   "number": 42,\n   "state": "open",\n+  "severity": "high",\n   "rule": {\n     "id": "js/xss",\n+    "severity": "high",\n     "description": "Cross-site scripting"`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["GET /repos/{owner}/{repo}/code-scanning/alerts"], action_required: "No action required. New severity field available for enhanced filtering.", cosmetic_only: false, confidence_notes: "Additive field in response" }
  },
  {
    id: "github-04",
    source: "GitHub API Changelog",
    title: "Repository rename changes the API URL",
    date: "2026-02-28",
    raw_changelog: "When a repository is renamed, API calls to the old name will now return 301 redirects instead of 200 responses with the old name. This applies to all REST API endpoints.",
    before_text: `## Repository Renames\n\nWhen a repository is renamed, API calls using the old repository name will continue to work. The API transparently resolves the new name and returns the response as if the old name was used.\n\n### Behavior\n- GET /repos/{old_owner}/{old_name} → 200 OK (resolves to new name)\n- Response body contains the old name in the full_name field`,
    after_text: `## Repository Renames\n\nWhen a repository is renamed, API calls using the old repository name will receive a redirect.\n\n### Behavior\n- GET /repos/{old_owner}/{old_name} → 301 Moved Permanently\n- Location header points to the new URL\n- Clients must follow the redirect or update their stored repository references\n\n**Note:** This change takes effect on April 1, 2026. Update your integrations to handle 301 redirects.`,
    diff_text: `--- before\n+++ after\n@@ -1,8 +1,10 @@\n ## Repository Renames\n \n-When a repository is renamed, API calls using the old repository name will continue to work. The API transparently resolves the new name and returns the response as if the old name was used.\n+When a repository is renamed, API calls using the old repository name will receive a redirect.\n \n ### Behavior\n-- GET /repos/{old_owner}/{old_name} → 200 OK (resolves to new name)\n-- Response body contains the old name in the full_name field\n+- GET /repos/{old_owner}/{old_name} → 301 Moved Permanently\n+- Location header points to the new URL\n+- Clients must follow the redirect or update their stored repository references\n+\n+**Note:** This change takes effect on April 1, 2026. Update your integrations to handle 301 redirects.`,
    ground_truth: { severity: "critical", is_breaking: true, breaking_reason: "HTTP status code changed from 200 to 301. Clients not handling redirects will break.", affected_endpoints: ["All REST API endpoints using repository names"], action_required: "Ensure HTTP clients follow 301 redirects. Update any hardcoded repository URLs. Deadline: April 1, 2026.", cosmetic_only: false, confidence_notes: "Clear breaking change - HTTP status code change" }
  },
  {
    id: "github-05",
    source: "GitHub API Changelog",
    title: "Copilot usage metrics API now available",
    date: "2026-02-20",
    raw_changelog: "New API endpoints for accessing Copilot usage metrics within your organization.",
    before_text: `## Copilot API\n\n### Endpoints\n- GET /orgs/{org}/copilot/billing - Get Copilot billing information`,
    after_text: `## Copilot API\n\n### Endpoints\n- GET /orgs/{org}/copilot/billing - Get Copilot billing information\n- GET /orgs/{org}/copilot/usage - Get Copilot usage metrics\n- GET /orgs/{org}/copilot/usage/seats - Get seat assignment details\n\n### Usage Metrics Response\n\`\`\`json\n{\n  "total_active_users": 150,\n  "total_engaged_users": 120,\n  "day": "2026-02-20",\n  "breakdown": [\n    { "editor": "vscode", "active_users": 100, "suggestions_accepted": 5000 }\n  ]\n}\n\`\`\``,
    diff_text: `--- before\n+++ after\n@@ -3,3 +3,16 @@\n ### Endpoints\n - GET /orgs/{org}/copilot/billing - Get Copilot billing information\n+- GET /orgs/{org}/copilot/usage - Get Copilot usage metrics\n+- GET /orgs/{org}/copilot/usage/seats - Get seat assignment details\n+\n+### Usage Metrics Response\n+\`\`\`json\n+{\n+  "total_active_users": 150,\n+  "total_engaged_users": 120,\n+  ...`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["GET /orgs/{org}/copilot/usage", "GET /orgs/{org}/copilot/usage/seats"], action_required: "No action required. New endpoints available for Copilot usage tracking.", cosmetic_only: false, confidence_notes: "New endpoints added, purely additive" }
  },

  // === TWILIO (5) ===
  {
    id: "twilio-01",
    source: "Twilio Changelog",
    title: "Unified Opt-Outs across RCS, SMS, and MMS channels",
    date: "2026-03-15",
    raw_changelog: "Twilio Programmable Messaging automatically unifies opt-out management across RCS, SMS, and MMS channels. When an end-user opts out on one channel, it applies to all channels. Any attempt to message an opted-out user will fail with Error 21610.",
    before_text: `## Opt-Out Management\n\nOpt-outs are managed per channel:\n- SMS opt-outs only affect SMS messages\n- MMS opt-outs only affect MMS messages\n- RCS opt-outs only affect RCS messages\n\nSending to an opted-out user on one channel does not prevent sending on another channel.`,
    after_text: `## Opt-Out Management\n\nOpt-outs are now unified across all messaging channels:\n- When a user opts out on ANY channel (SMS, MMS, or RCS), all channels are blocked\n- Opt-out keywords: STOP, CANCEL, UNSUBSCRIBE\n- Error 21610 returned for any attempt to message an opted-out user on any channel\n\n**This is active by default and requires no code changes to implement.**`,
    diff_text: `--- before\n+++ after\n@@ -1,7 +1,8 @@\n ## Opt-Out Management\n \n-Opt-outs are managed per channel:\n-- SMS opt-outs only affect SMS messages\n-- MMS opt-outs only affect MMS messages\n-- RCS opt-outs only affect RCS messages\n-\n-Sending to an opted-out user on one channel does not prevent sending on another channel.\n+Opt-outs are now unified across all messaging channels:\n+- When a user opts out on ANY channel (SMS, MMS, or RCS), all channels are blocked\n+- Opt-out keywords: STOP, CANCEL, UNSUBSCRIBE\n+- Error 21610 returned for any attempt to message an opted-out user on any channel\n+\n+**This is active by default and requires no code changes to implement.**`,
    ground_truth: { severity: "high", is_breaking: true, breaking_reason: "Behavior change: opt-outs now cascade across channels. Messages that previously succeeded may now fail with Error 21610.", affected_endpoints: ["POST /Messages", "Programmable Messaging API"], action_required: "Review messaging logic. If you rely on channel-specific opt-outs, users who opt out of SMS will now also be blocked on RCS/MMS. Update opt-out recovery flows.", cosmetic_only: false, confidence_notes: "Significant behavior change, active by default" }
  },
  {
    id: "twilio-02",
    source: "Twilio Changelog",
    title: "Increased MMS rate limits for A2P 10DLC Phone Numbers",
    date: "2026-03-18",
    raw_changelog: "MMS rate limits for A2P 10DLC numbers are now determined by Brand Trust Score and Campaign use case, replacing the previous fixed 1 MPS cap.",
    before_text: `## MMS Rate Limits - A2P 10DLC\n\n| Phone Type | Rate Limit |\n|-----------|------------|\n| 10DLC | 1 MPS (fixed) |\n\nAll A2P 10DLC numbers share the same MMS rate limit regardless of brand trust score.`,
    after_text: `## MMS Rate Limits - A2P 10DLC\n\n| Brand Trust Score | Rate Limit |\n|------------------|------------|\n| High (75-100) | 10 MPS |\n| Medium (50-74) | 5 MPS |\n| Low (1-49) | 1 MPS |\n\nMMS rate limits are now determined by your Brand Trust Score and Campaign use case.`,
    diff_text: `--- before\n+++ after\n@@ -1,6 +1,8 @@\n ## MMS Rate Limits - A2P 10DLC\n \n-| Phone Type | Rate Limit |\n-|-----------|------------|\n-| 10DLC | 1 MPS (fixed) |\n-\n-All A2P 10DLC numbers share the same MMS rate limit regardless of brand trust score.\n+| Brand Trust Score | Rate Limit |\n+|------------------|------------|\n+| High (75-100) | 10 MPS |\n+| Medium (50-74) | 5 MPS |\n+| Low (1-49) | 1 MPS |\n+\n+MMS rate limits are now determined by your Brand Trust Score and Campaign use case.`,
    ground_truth: { severity: "medium", is_breaking: false, breaking_reason: null, affected_endpoints: ["MMS messaging via 10DLC numbers"], action_required: "Review your Brand Trust Score. High-trust brands benefit from higher limits. Low-trust brands retain 1 MPS.", cosmetic_only: false, confidence_notes: "Rate limit structure changed but default remains same for low-trust" }
  },
  {
    id: "twilio-03",
    source: "Twilio Changelog",
    title: "Certificate rotation for all REST API endpoints",
    date: "2026-03-04",
    raw_changelog: "The end-user certificate for all Twilio REST API endpoints will be rotated on April 8, 2026.",
    before_text: `## TLS Certificates\n\nTwilio REST API endpoints use TLS certificates issued by DigiCert.\n\nCurrent certificate:\n- Issuer: DigiCert SHA2 Extended Validation Server CA\n- Valid until: June 15, 2026\n- Serial: 0A:1B:2C:3D`,
    after_text: `## TLS Certificates\n\nTwilio REST API endpoints use TLS certificates issued by DigiCert.\n\nCurrent certificate (until April 8, 2026):\n- Issuer: DigiCert SHA2 Extended Validation Server CA\n- Valid until: June 15, 2026\n- Serial: 0A:1B:2C:3D\n\nNew certificate (effective April 8, 2026):\n- Issuer: DigiCert Global G2 TLS RSA SHA256 2020 CA1\n- Valid until: April 8, 2027\n- Serial: 4E:5F:6G:7H\n\n**Action Required:** If you pin certificates, update your pinned certificates before April 8, 2026.`,
    diff_text: `--- before\n+++ after\n@@ -3,5 +3,12 @@\n Twilio REST API endpoints use TLS certificates issued by DigiCert.\n \n-Current certificate:\n+Current certificate (until April 8, 2026):\n ...\n+\n+New certificate (effective April 8, 2026):\n+- Issuer: DigiCert Global G2 TLS RSA SHA256 2020 CA1\n+- Valid until: April 8, 2027\n+- Serial: 4E:5F:6G:7H\n+\n+**Action Required:** If you pin certificates, update your pinned certificates before April 8, 2026.`,
    ground_truth: { severity: "high", is_breaking: true, breaking_reason: "Certificate rotation will break clients that pin TLS certificates", affected_endpoints: ["All Twilio REST API endpoints"], action_required: "If you pin certificates, update pinned certs before April 8, 2026. If you don't pin, no action needed.", cosmetic_only: false, confidence_notes: "Breaking only for certificate-pinning clients" }
  },
  {
    id: "twilio-04",
    source: "Twilio Changelog",
    title: "Cipher suite list update for all REST API endpoints",
    date: "2026-03-03",
    raw_changelog: "Upcoming cipher suite list update. Legacy cipher suites will be removed on June 3, 2026.",
    before_text: `## Supported Cipher Suites\n\nThe following cipher suites are supported:\n- TLS_AES_256_GCM_SHA384\n- TLS_AES_128_GCM_SHA256\n- TLS_CHACHA20_POLY1305_SHA256\n- TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384 (legacy)\n- TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256 (legacy)\n- TLS_RSA_WITH_AES_256_CBC_SHA (legacy)`,
    after_text: `## Supported Cipher Suites\n\nThe following cipher suites are supported:\n- TLS_AES_256_GCM_SHA384\n- TLS_AES_128_GCM_SHA256\n- TLS_CHACHA20_POLY1305_SHA256\n\n**Removed (effective June 3, 2026):**\n- ~~TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384~~\n- ~~TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256~~\n- ~~TLS_RSA_WITH_AES_256_CBC_SHA~~\n\n**Action Required:** Ensure your TLS client supports at least one of the retained cipher suites.`,
    diff_text: `--- before\n+++ after\n@@ -4,6 +4,11 @@\n - TLS_AES_256_GCM_SHA384\n - TLS_AES_128_GCM_SHA256\n - TLS_CHACHA20_POLY1305_SHA256\n-- TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384 (legacy)\n-- TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256 (legacy)\n-- TLS_RSA_WITH_AES_256_CBC_SHA (legacy)\n+\n+**Removed (effective June 3, 2026):**\n+- ~~TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384~~\n+- ~~TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256~~\n+- ~~TLS_RSA_WITH_AES_256_CBC_SHA~~\n+\n+**Action Required:** Ensure your TLS client supports at least one of the retained cipher suites.`,
    ground_truth: { severity: "high", is_breaking: true, breaking_reason: "Legacy cipher suites being removed. Clients using only legacy ciphers will fail to connect.", affected_endpoints: ["All Twilio REST API endpoints"], action_required: "Verify your TLS client supports modern cipher suites (TLS 1.3 AES-GCM or ChaCha20). Update before June 3, 2026.", cosmetic_only: false, confidence_notes: "Breaking for clients using only legacy ciphers" }
  },
  {
    id: "twilio-05",
    source: "Twilio Changelog",
    title: "ConversationRelay widget now available in Studio",
    date: "2026-03-06",
    raw_changelog: "Studio now includes a ConversationRelay widget for connecting live voice calls to WebSocket servers.",
    before_text: `## Studio Widgets\n\n### Available Widgets\n- Say/Play\n- Gather Input\n- Send Message\n- HTTP Request\n- Split Based On\n- Connect Call\n- Enqueue Call\n- Set Variables`,
    after_text: `## Studio Widgets\n\n### Available Widgets\n- Say/Play\n- Gather Input\n- Send Message\n- HTTP Request\n- Split Based On\n- Connect Call\n- Enqueue Call\n- Set Variables\n- ConversationRelay (NEW)\n  - Connects voice calls to WebSocket servers\n  - Supports custom parameters and voice controls\n  - Provides Success and Failed transitions`,
    diff_text: `--- before\n+++ after\n@@ -9,3 +9,7 @@\n - Enqueue Call\n - Set Variables\n+- ConversationRelay (NEW)\n+  - Connects voice calls to WebSocket servers\n+  - Supports custom parameters and voice controls\n+  - Provides Success and Failed transitions`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["Twilio Studio"], action_required: "No action required. New widget available for connecting voice calls to WebSocket servers.", cosmetic_only: false, confidence_notes: "Purely additive new feature" }
  },

  // === AWS (3) ===
  {
    id: "aws-01",
    source: "AWS Service Announcements",
    title: "Amazon S3 now requires virtual-hosted-style requests",
    date: "2026-03-01",
    raw_changelog: "Amazon S3 will stop supporting path-style API requests on September 30, 2026. All requests must use virtual-hosted-style.",
    before_text: `## S3 Request Styles\n\n### Path Style (supported)\nhttps://s3.amazonaws.com/bucket-name/key-name\n\n### Virtual Hosted Style (supported)\nhttps://bucket-name.s3.amazonaws.com/key-name\n\nBoth styles are supported for all S3 operations.`,
    after_text: `## S3 Request Styles\n\n### Path Style (DEPRECATED - removed September 30, 2026)\nhttps://s3.amazonaws.com/bucket-name/key-name\n\n### Virtual Hosted Style (required)\nhttps://bucket-name.s3.amazonaws.com/key-name\n\n**Breaking Change:** Path-style requests will return 403 Forbidden after September 30, 2026. Migrate to virtual-hosted-style requests.`,
    diff_text: `--- before\n+++ after\n@@ -1,9 +1,9 @@\n ## S3 Request Styles\n \n-### Path Style (supported)\n+### Path Style (DEPRECATED - removed September 30, 2026)\n https://s3.amazonaws.com/bucket-name/key-name\n \n-### Virtual Hosted Style (supported)\n+### Virtual Hosted Style (required)\n https://bucket-name.s3.amazonaws.com/key-name\n \n-Both styles are supported for all S3 operations.\n+**Breaking Change:** Path-style requests will return 403 Forbidden after September 30, 2026.`,
    ground_truth: { severity: "critical", is_breaking: true, breaking_reason: "Path-style S3 requests will stop working. Applications using path-style URLs will receive 403 errors.", affected_endpoints: ["All S3 API endpoints"], action_required: "Migrate all S3 requests to virtual-hosted-style URLs. Update AWS SDK to latest version. Deadline: September 30, 2026.", cosmetic_only: false, confidence_notes: "Major breaking change with clear deadline" }
  },
  {
    id: "aws-02",
    source: "AWS Service Announcements",
    title: "Lambda adds support for Node.js 22 runtime",
    date: "2026-02-15",
    raw_changelog: "AWS Lambda now supports Node.js 22 as a managed runtime.",
    before_text: `## Lambda Runtimes\n\n### Supported Node.js Runtimes\n| Runtime | Identifier | End of Support |\n|---------|-----------|----------------|\n| Node.js 20 | nodejs20.x | March 2026 |\n| Node.js 18 | nodejs18.x | September 2025 (deprecated) |`,
    after_text: `## Lambda Runtimes\n\n### Supported Node.js Runtimes\n| Runtime | Identifier | End of Support |\n|---------|-----------|----------------|\n| Node.js 22 | nodejs22.x | April 2027 |\n| Node.js 20 | nodejs20.x | March 2026 |\n| Node.js 18 | nodejs18.x | September 2025 (deprecated) |`,
    diff_text: `--- before\n+++ after\n@@ -5,6 +5,7 @@\n |---------|-----------|----------------|\n+| Node.js 22 | nodejs22.x | April 2027 |\n | Node.js 20 | nodejs20.x | March 2026 |`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["AWS Lambda"], action_required: "Consider migrating to Node.js 22 runtime, especially since Node.js 20 support ends March 2026.", cosmetic_only: false, confidence_notes: "Additive new runtime option" }
  },
  {
    id: "aws-03",
    source: "AWS Service Announcements",
    title: "DynamoDB changes default read consistency for Global Tables",
    date: "2026-01-20",
    raw_changelog: "DynamoDB Global Tables now default to eventual consistency for cross-region reads. Previously, strong consistency was available but is now deprecated for Global Tables.",
    before_text: `## Global Tables - Read Consistency\n\n### ConsistentRead Parameter\nFor Global Tables, you can use ConsistentRead=true to get strongly consistent reads from any region.\n\n\`\`\`\nGET /dynamodb\n{\n  "TableName": "my-global-table",\n  "Key": {"id": {"S": "123"}},\n  "ConsistentRead": true\n}\n\`\`\`\n\nReturns the most recent data from any replica.`,
    after_text: `## Global Tables - Read Consistency\n\n### ConsistentRead Parameter\nFor Global Tables, ConsistentRead=true is only supported for reads from the table's home region. Cross-region reads always use eventual consistency.\n\n\`\`\`\nGET /dynamodb\n{\n  "TableName": "my-global-table",\n  "Key": {"id": {"S": "123"}},\n  "ConsistentRead": true  // Only works in home region\n}\n\`\`\`\n\n**Note:** Using ConsistentRead=true from a non-home region will return a ValidationException starting May 1, 2026.`,
    diff_text: `--- before\n+++ after\n@@ -3,7 +3,7 @@\n ### ConsistentRead Parameter\n-For Global Tables, you can use ConsistentRead=true to get strongly consistent reads from any region.\n+For Global Tables, ConsistentRead=true is only supported for reads from the table's home region. Cross-region reads always use eventual consistency.\n \n ... "ConsistentRead": true\n+  // Only works in home region\n \n-Returns the most recent data from any replica.\n+**Note:** Using ConsistentRead=true from a non-home region will return a ValidationException starting May 1, 2026.`,
    ground_truth: { severity: "critical", is_breaking: true, breaking_reason: "ConsistentRead=true from non-home regions will throw ValidationException. Applications relying on cross-region strong consistency will break.", affected_endpoints: ["DynamoDB GetItem", "DynamoDB Query", "DynamoDB Scan"], action_required: "Audit Global Table reads. If using ConsistentRead=true from non-home regions, either route reads to home region or handle eventual consistency. Deadline: May 1, 2026.", cosmetic_only: false, confidence_notes: "Significant breaking change for distributed applications" }
  },

  // === CLOUDFLARE (3) ===
  {
    id: "cloudflare-01",
    source: "Cloudflare Changelog",
    title: "Dynamic Workers now in open beta",
    date: "2026-03-24",
    raw_changelog: "Dynamic Workers are now in open beta. Workers can now spin up other Workers at runtime.",
    before_text: `## Workers API\n\n### Creating Workers\nWorkers are deployed via the Wrangler CLI or API.\n\n\`\`\`\nPUT /client/v4/accounts/{account_id}/workers/scripts/{script_name}\n\`\`\``,
    after_text: `## Workers API\n\n### Creating Workers\nWorkers are deployed via the Wrangler CLI or API.\n\n\`\`\`\nPUT /client/v4/accounts/{account_id}/workers/scripts/{script_name}\n\`\`\`\n\n### Dynamic Workers (Beta)\nWorkers can now create other Workers at runtime using the LOADER binding.\n\n\`\`\`javascript\nconst worker = env.LOADER.load({\n  compatibilityDate: "2026-01-01",\n  mainModule: "src/index.js",\n  modules: { "src/index.js": code }\n});\nreturn worker.getEntrypoint().fetch(request);\n\`\`\``,
    diff_text: `--- before\n+++ after\n@@ -6,3 +6,14 @@\n PUT /client/v4/accounts/{account_id}/workers/scripts/{script_name}\n \`\`\`\n+\n+### Dynamic Workers (Beta)\n+Workers can now create other Workers at runtime using the LOADER binding.\n+\n+\`\`\`javascript\n+const worker = env.LOADER.load({ ... });\n+return worker.getEntrypoint().fetch(request);\n+\`\`\``,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["Workers API"], action_required: "No action required. New feature available for dynamically creating Workers at runtime.", cosmetic_only: false, confidence_notes: "New additive feature in beta" }
  },
  {
    id: "cloudflare-02",
    source: "Cloudflare Changelog",
    title: "OIDC Claims filtering in Gateway policies",
    date: "2026-03-24",
    raw_changelog: "Gateway now supports OIDC Claims as a selector in Firewall, Resolver, and Egress policies.",
    before_text: `## Gateway Policy Selectors\n\n| Selector | Available In |\n|----------|-------------|\n| Application | Firewall, Resolver |\n| User Email | Firewall, Resolver, Egress |\n| User Group | Firewall, Resolver, Egress |\n| Device Posture | Firewall |`,
    after_text: `## Gateway Policy Selectors\n\n| Selector | Available In |\n|----------|-------------|\n| Application | Firewall, Resolver |\n| User Email | Firewall, Resolver, Egress |\n| User Group | Firewall, Resolver, Egress |\n| Device Posture | Firewall |\n| OIDC Claims | Firewall, Resolver, Egress |`,
    diff_text: `--- before\n+++ after\n@@ -6,3 +6,4 @@\n | User Group | Firewall, Resolver, Egress |\n | Device Posture | Firewall |\n+| OIDC Claims | Firewall, Resolver, Egress |`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["Gateway Firewall", "Gateway Resolver", "Gateway Egress"], action_required: "No action required. New OIDC Claims selector available for identity-based policies.", cosmetic_only: false, confidence_notes: "Additive new selector" }
  },
  {
    id: "cloudflare-03",
    source: "Cloudflare Changelog",
    title: "Containers now support Docker Hub images",
    date: "2026-03-24",
    raw_changelog: "Containers now support Docker Hub images directly in Wrangler configuration.",
    before_text: `## Containers Configuration\n\nContainers require images from Cloudflare Registry.\n\n\`\`\`toml\n[[containers]]\nimage = "registry.cloudflare.com/my-account/my-image:latest"\n\`\`\``,
    after_text: `## Containers Configuration\n\nContainers support images from Cloudflare Registry or Docker Hub.\n\n\`\`\`toml\n[[containers]]\nimage = "registry.cloudflare.com/my-account/my-image:latest"\n# OR\nimage = "docker.io/library/nginx:latest"\n\`\`\`\n\nPrivate Docker Hub images are also supported. See documentation for credential configuration.`,
    diff_text: `--- before\n+++ after\n@@ -1,5 +1,9 @@\n ## Containers Configuration\n \n-Containers require images from Cloudflare Registry.\n+Containers support images from Cloudflare Registry or Docker Hub.\n \n [[containers]]\n image = "registry.cloudflare.com/my-account/my-image:latest"\n+# OR\n+image = "docker.io/library/nginx:latest"\n+\n+Private Docker Hub images are also supported.`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["Containers API", "Wrangler config"], action_required: "No action required. Docker Hub images now available as alternative to Cloudflare Registry.", cosmetic_only: false, confidence_notes: "Additive feature, expands image source options" }
  },

  // === VERCEL (3) ===
  {
    id: "vercel-01",
    source: "Vercel Changelog",
    title: "End-to-end encryption for Vercel Workflow",
    date: "2026-03-17",
    raw_changelog: "Vercel Workflow now encrypts all user data end-to-end. No code changes required.",
    before_text: `## Workflow Data Handling\n\nWorkflow inputs, step arguments, and return values are stored in the event log as plaintext.\n\n**Security Note:** Do not pass sensitive data (API keys, tokens) through Workflow steps.`,
    after_text: `## Workflow Data Handling\n\nWorkflow inputs, step arguments, return values, hook payloads, and stream data are automatically encrypted end-to-end before being written to the event log.\n\nEach deployment receives a unique encryption key. The event log only stores ciphertext.\n\n**It is now safe to pass sensitive data through Workflow steps.** No code changes required.`,
    diff_text: `--- before\n+++ after\n@@ -1,5 +1,7 @@\n ## Workflow Data Handling\n \n-Workflow inputs, step arguments, and return values are stored in the event log as plaintext.\n+Workflow inputs, step arguments, return values, hook payloads, and stream data are automatically encrypted end-to-end.\n \n-**Security Note:** Do not pass sensitive data (API keys, tokens) through Workflow steps.\n+Each deployment receives a unique encryption key. The event log only stores ciphertext.\n+\n+**It is now safe to pass sensitive data through Workflow steps.** No code changes required.`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["Vercel Workflow"], action_required: "No action required. Data is now automatically encrypted. Previously restricted sensitive data can now be passed through Workflow.", cosmetic_only: false, confidence_notes: "Security improvement, no breaking changes" }
  },
  {
    id: "vercel-02",
    source: "Vercel Changelog",
    title: "Sandbox SDK adds file permission control",
    date: "2026-03-20",
    raw_changelog: "Vercel Sandbox SDK 1.9.0 supports setting file permissions when writing files via mode property.",
    before_text: `## Sandbox SDK - writeFiles\n\n\`\`\`javascript\nsandbox.writeFiles([\n  { path: 'run.sh', content: '#!/bin/bash\\necho "ready"' }\n]);\n\`\`\`\n\nNote: To make files executable, use a separate chmod call after writing.`,
    after_text: `## Sandbox SDK - writeFiles\n\n\`\`\`javascript\nsandbox.writeFiles([\n  { path: 'run.sh', content: '#!/bin/bash\\necho "ready"', mode: 0o755 }\n]);\n\`\`\`\n\nThe optional \`mode\` property sets file permissions directly, eliminating the need for a separate chmod call.`,
    diff_text: `--- before\n+++ after\n@@ -3,6 +3,6 @@\n sandbox.writeFiles([\n-  { path: 'run.sh', content: '#!/bin/bash\\necho "ready"' }\n+  { path: 'run.sh', content: '#!/bin/bash\\necho "ready"', mode: 0o755 }\n ]);\n \n-Note: To make files executable, use a separate chmod call after writing.\n+The optional \`mode\` property sets file permissions directly.`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["Sandbox SDK writeFiles"], action_required: "No action required. New optional mode property available for setting file permissions.", cosmetic_only: false, confidence_notes: "Additive optional parameter" }
  },
  {
    id: "vercel-03",
    source: "Vercel Changelog",
    title: "Elastic build machines available in Beta",
    date: "2026-03-24",
    raw_changelog: "Elastic build machines automatically assign the right machine for each project's needs.",
    before_text: `## Build Configuration\n\n### Build Machines\nAll projects use Standard build machines by default.\n\nTo upgrade, select Enhanced or Turbo in project settings.\n\n| Machine | vCPU | RAM | Cost |\n|---------|------|-----|------|\n| Standard | 2 | 4GB | Included |\n| Enhanced | 4 | 8GB | $0.02/min |\n| Turbo | 8 | 16GB | $0.04/min |`,
    after_text: `## Build Configuration\n\n### Build Machines\nProjects can use fixed or elastic build machines.\n\n**Elastic (Beta):** Automatically assigns the optimal machine per project.\n**Fixed:** Manually select Standard, Enhanced, or Turbo.\n\n| Machine | vCPU | RAM | Cost |\n|---------|------|-----|------|\n| Standard | 2 | 4GB | Included |\n| Enhanced | 4 | 8GB | $0.02/min |\n| Turbo | 8 | 16GB | $0.04/min |\n| Elastic | Auto | Auto | Varies |`,
    diff_text: `--- before\n+++ after\n@@ -2,5 +2,7 @@\n ### Build Machines\n-All projects use Standard build machines by default.\n-\n-To upgrade, select Enhanced or Turbo in project settings.\n+Projects can use fixed or elastic build machines.\n+\n+**Elastic (Beta):** Automatically assigns the optimal machine per project.\n+**Fixed:** Manually select Standard, Enhanced, or Turbo.\n@@ -9,3 +11,4 @@\n | Turbo | 8 | 16GB | $0.04/min |\n+| Elastic | Auto | Auto | Varies |`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["Build Configuration"], action_required: "No action required. New elastic build machine option available in beta.", cosmetic_only: false, confidence_notes: "New optional feature" }
  },

  // === OTHER APIS (6) ===
  {
    id: "openai-01",
    source: "OpenAI API Changelog",
    title: "Structured Outputs now support recursive schemas",
    date: "2026-03-10",
    raw_changelog: "Structured Outputs JSON schema now supports recursive type definitions.",
    before_text: `## Structured Outputs\n\n### Limitations\n- Maximum schema depth: 5 levels\n- No recursive types\n- No \`$ref\` to self\n- Maximum 100 properties per schema`,
    after_text: `## Structured Outputs\n\n### Limitations\n- Maximum schema depth: 10 levels\n- Recursive types supported (max depth: 5 recursions)\n- \`$ref\` to self allowed with recursion limit\n- Maximum 200 properties per schema`,
    diff_text: `--- before\n+++ after\n@@ -3,5 +3,5 @@\n ### Limitations\n-- Maximum schema depth: 5 levels\n-- No recursive types\n-- No \`$ref\` to self\n-- Maximum 100 properties per schema\n+- Maximum schema depth: 10 levels\n+- Recursive types supported (max depth: 5 recursions)\n+- \`$ref\` to self allowed with recursion limit\n+- Maximum 200 properties per schema`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["POST /v1/chat/completions"], action_required: "No action required. Structured Outputs now support more complex schemas.", cosmetic_only: false, confidence_notes: "Relaxation of constraints, non-breaking" }
  },
  {
    id: "sendgrid-01",
    source: "SendGrid Changelog",
    title: "Removal of legacy v2 Mail Send endpoint",
    date: "2026-02-01",
    raw_changelog: "The legacy v2 Mail Send endpoint (POST /api/mail.send.json) will be removed on June 1, 2026.",
    before_text: `## Mail Send Endpoints\n\n### v3 (Recommended)\nPOST /v3/mail/send\n\n### v2 (Legacy)\nPOST /api/mail.send.json\n\nBoth endpoints are fully supported.`,
    after_text: `## Mail Send Endpoints\n\n### v3 (Required)\nPOST /v3/mail/send\n\n### v2 (DEPRECATED - Removed June 1, 2026)\n~~POST /api/mail.send.json~~\n\n**Migration Required:** All users must migrate to v3 before June 1, 2026. The v2 endpoint will return 410 Gone after this date.`,
    diff_text: `--- before\n+++ after\n@@ -2,7 +2,8 @@\n-### v3 (Recommended)\n+### v3 (Required)\n POST /v3/mail/send\n \n-### v2 (Legacy)\n-POST /api/mail.send.json\n-\n-Both endpoints are fully supported.\n+### v2 (DEPRECATED - Removed June 1, 2026)\n+~~POST /api/mail.send.json~~\n+\n+**Migration Required:** All users must migrate to v3 before June 1, 2026.`,
    ground_truth: { severity: "critical", is_breaking: true, breaking_reason: "v2 endpoint being removed entirely. All v2 users will get 410 Gone responses.", affected_endpoints: ["POST /api/mail.send.json"], action_required: "Migrate from v2 to v3 Mail Send endpoint before June 1, 2026.", cosmetic_only: false, confidence_notes: "Clear removal of deprecated endpoint" }
  },
  {
    id: "auth0-01",
    source: "Auth0 Changelog",
    title: "Token endpoint now requires PKCE for public clients",
    date: "2026-02-10",
    raw_changelog: "Starting April 1, 2026, the /oauth/token endpoint requires PKCE (code_verifier) for all public clients.",
    before_text: `## Token Endpoint\n\nPOST /oauth/token\n\n### Public Clients\nPublic clients (no client_secret) can exchange authorization codes without PKCE.\n\n\`\`\`\nPOST /oauth/token\n{\n  "grant_type": "authorization_code",\n  "client_id": "xxx",\n  "code": "abc",\n  "redirect_uri": "https://app.example.com/callback"\n}\n\`\`\``,
    after_text: `## Token Endpoint\n\nPOST /oauth/token\n\n### Public Clients\nPublic clients (no client_secret) MUST include PKCE parameters when exchanging authorization codes.\n\n\`\`\`\nPOST /oauth/token\n{\n  "grant_type": "authorization_code",\n  "client_id": "xxx",\n  "code": "abc",\n  "redirect_uri": "https://app.example.com/callback",\n  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"\n}\n\`\`\`\n\n**Breaking Change (April 1, 2026):** Requests without code_verifier will return 400 Bad Request.`,
    diff_text: `--- before\n+++ after\n@@ -4,12 +4,15 @@\n ### Public Clients\n-Public clients (no client_secret) can exchange authorization codes without PKCE.\n+Public clients (no client_secret) MUST include PKCE parameters.\n \n POST /oauth/token\n {\n   ...\n-  "redirect_uri": "https://app.example.com/callback"\n+  "redirect_uri": "https://app.example.com/callback",\n+  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"\n }\n+\n+**Breaking Change (April 1, 2026):** Requests without code_verifier will return 400 Bad Request.`,
    ground_truth: { severity: "critical", is_breaking: true, breaking_reason: "code_verifier becomes required. Public clients not using PKCE will get 400 errors.", affected_endpoints: ["POST /oauth/token"], action_required: "Implement PKCE flow in all public clients. Add code_challenge to authorization requests and code_verifier to token requests. Deadline: April 1, 2026.", cosmetic_only: false, confidence_notes: "Clear breaking change with new required parameter" }
  },
  {
    id: "plaid-01",
    source: "Plaid Changelog",
    title: "Transactions sync endpoint pagination change",
    date: "2026-01-15",
    raw_changelog: "The /transactions/sync endpoint now returns a maximum of 100 transactions per page (down from 500).",
    before_text: `## Transactions Sync\n\nPOST /transactions/sync\n\n### Response\n- Maximum 500 transactions per page\n- Use \`cursor\` for pagination\n- \`has_more\`: boolean indicating more pages`,
    after_text: `## Transactions Sync\n\nPOST /transactions/sync\n\n### Response\n- Maximum 100 transactions per page (changed from 500)\n- Use \`cursor\` for pagination\n- \`has_more\`: boolean indicating more pages\n\n**Note:** You may need to make more pagination requests to retrieve all transactions.`,
    diff_text: `--- before\n+++ after\n@@ -4,4 +4,6 @@\n ### Response\n-- Maximum 500 transactions per page\n+- Maximum 100 transactions per page (changed from 500)\n - Use \`cursor\` for pagination\n - \`has_more\`: boolean indicating more pages\n+\n+**Note:** You may need to make more pagination requests.`,
    ground_truth: { severity: "medium", is_breaking: true, breaking_reason: "Page size reduced 5x. Code that assumes all transactions fit in one page may miss data.", affected_endpoints: ["POST /transactions/sync"], action_required: "Ensure pagination logic properly handles has_more flag and continues fetching. Test with accounts that have >100 recent transactions.", cosmetic_only: false, confidence_notes: "Subtle breaking change in pagination behavior" }
  },
  {
    id: "supabase-01",
    source: "Supabase Changelog",
    title: "PostgREST default row limit changed from 1000 to 100",
    date: "2026-02-05",
    raw_changelog: "The default max rows returned by PostgREST queries changed from 1000 to 100.",
    before_text: `## PostgREST Configuration\n\n### Row Limits\n- Default max rows: 1000\n- Configurable via \`db-max-rows\` setting\n- Use \`Range\` header for pagination`,
    after_text: `## PostgREST Configuration\n\n### Row Limits\n- Default max rows: 100 (changed from 1000)\n- Configurable via \`db-max-rows\` setting\n- Use \`Range\` header for pagination\n\n**Migration Note:** If your queries expect more than 100 rows, add explicit \`.limit()\` or update \`db-max-rows\`.`,
    diff_text: `--- before\n+++ after\n@@ -3,3 +3,5 @@\n ### Row Limits\n-- Default max rows: 1000\n+- Default max rows: 100 (changed from 1000)\n - Configurable via \`db-max-rows\` setting\n - Use \`Range\` header for pagination\n+\n+**Migration Note:** If your queries expect more than 100 rows, add explicit .limit() or update db-max-rows.`,
    ground_truth: { severity: "high", is_breaking: true, breaking_reason: "Default row limit reduced 10x. Queries that relied on getting up to 1000 rows will now silently return fewer rows.", affected_endpoints: ["PostgREST API", "Supabase client queries"], action_required: "Add explicit .limit() to queries that need more than 100 rows, or increase db-max-rows in your project configuration.", cosmetic_only: false, confidence_notes: "Silent breaking change - queries return fewer rows without error" }
  },
  {
    id: "linear-01",
    source: "Linear Changelog",
    title: "GraphQL API rate limit structure changed",
    date: "2026-03-01",
    raw_changelog: "Linear GraphQL API now uses complexity-based rate limiting instead of request count.",
    before_text: `## Rate Limits\n\n### GraphQL API\n- 1500 requests per hour\n- 250 requests per minute burst\n- Headers: X-RateLimit-Remaining, X-RateLimit-Reset`,
    after_text: `## Rate Limits\n\n### GraphQL API\n- 10,000 complexity points per hour\n- 1,000 complexity points per minute burst\n- Simple queries: ~1-5 points\n- Nested queries: ~10-50 points\n- Headers: X-RateLimit-Complexity-Remaining, X-RateLimit-Complexity-Reset\n\n**Note:** The old request-count headers are no longer returned.`,
    diff_text: `--- before\n+++ after\n@@ -3,4 +3,8 @@\n ### GraphQL API\n-- 1500 requests per hour\n-- 250 requests per minute burst\n-- Headers: X-RateLimit-Remaining, X-RateLimit-Reset\n+- 10,000 complexity points per hour\n+- 1,000 complexity points per minute burst\n+- Simple queries: ~1-5 points\n+- Nested queries: ~10-50 points\n+- Headers: X-RateLimit-Complexity-Remaining, X-RateLimit-Complexity-Reset\n+\n+**Note:** The old request-count headers are no longer returned.`,
    ground_truth: { severity: "high", is_breaking: true, breaking_reason: "Rate limit headers changed. Code parsing old headers will break. Complex queries may hit limits sooner.", affected_endpoints: ["GraphQL API"], action_required: "Update rate limit handling code to use new complexity-based headers. Review complex queries that may consume many points.", cosmetic_only: false, confidence_notes: "Breaking change in rate limit mechanism and headers" }
  },

  // === ADVERSARIAL (5) ===
  {
    id: "adversarial-01",
    source: "Adversarial Test",
    title: "Cosmetic-only change: whitespace and formatting",
    date: "2026-03-01",
    raw_changelog: "Documentation reformatted for consistency.",
    before_text: `## Create a Payment Intent\n\nPOST /v1/payment_intents\n\nCreates a PaymentIntent object.\n\n### Parameters\n\n|  Parameter  |  Type  |  Required  |\n|---|---|---|\n|  amount  |  integer  |  Yes  |\n|  currency  |  string  |  Yes  |\n|  description  |  string  |  No  |`,
    after_text: `## Create a Payment Intent\n\nPOST /v1/payment_intents\n\nCreates a PaymentIntent object.\n\n### Parameters\n\n| Parameter | Type | Required |\n|-----------|------|----------|\n| amount | integer | Yes |\n| currency | string | Yes |\n| description | string | No |`,
    diff_text: `--- before\n+++ after\n@@ -8,6 +8,6 @@\n-|  Parameter  |  Type  |  Required  |\n-|---|---|---|\n-|  amount  |  integer  |  Yes  |\n-|  currency  |  string  |  Yes  |\n-|  description  |  string  |  No  |\n+| Parameter | Type | Required |\n+|-----------|------|----------|\n+| amount | integer | Yes |\n+| currency | string | Yes |\n+| description | string | No |`,
    ground_truth: { severity: "none", is_breaking: false, breaking_reason: null, affected_endpoints: [], action_required: "No action needed. Whitespace and table formatting changes only.", cosmetic_only: true, confidence_notes: "Pure cosmetic change - whitespace normalization in markdown table" }
  },
  {
    id: "adversarial-02",
    source: "Adversarial Test",
    title: "Copyright year update only",
    date: "2026-01-02",
    raw_changelog: "Updated copyright year.",
    before_text: `## API Reference\n\nWelcome to our API documentation.\n\n---\n© 2025 Example Corp. All rights reserved.\nLast updated: December 15, 2025`,
    after_text: `## API Reference\n\nWelcome to our API documentation.\n\n---\n© 2026 Example Corp. All rights reserved.\nLast updated: January 2, 2026`,
    diff_text: `--- before\n+++ after\n@@ -5,3 +5,3 @@\n ---\n-© 2025 Example Corp. All rights reserved.\n-Last updated: December 15, 2025\n+© 2026 Example Corp. All rights reserved.\n+Last updated: January 2, 2026`,
    ground_truth: { severity: "none", is_breaking: false, breaking_reason: null, affected_endpoints: [], action_required: "No action needed. Copyright year and timestamp update only.", cosmetic_only: true, confidence_notes: "Pure metadata change - copyright year and date" }
  },
  {
    id: "adversarial-03",
    source: "Adversarial Test",
    title: "New optional field added to response",
    date: "2026-02-15",
    raw_changelog: "Added optional metadata field to user response.",
    before_text: `## Get User\n\nGET /v1/users/{id}\n\n### Response\n\`\`\`json\n{\n  "id": "usr_123",\n  "name": "John Doe",\n  "email": "john@example.com",\n  "created_at": "2025-01-01T00:00:00Z"\n}\n\`\`\``,
    after_text: `## Get User\n\nGET /v1/users/{id}\n\n### Response\n\`\`\`json\n{\n  "id": "usr_123",\n  "name": "John Doe",\n  "email": "john@example.com",\n  "created_at": "2025-01-01T00:00:00Z",\n  "metadata": {}  // optional, may be null\n}\n\`\`\``,
    diff_text: `--- before\n+++ after\n@@ -9,5 +9,6 @@\n   "email": "john@example.com",\n-  "created_at": "2025-01-01T00:00:00Z"\n+  "created_at": "2025-01-01T00:00:00Z",\n+  "metadata": {}  // optional, may be null`,
    ground_truth: { severity: "low", is_breaking: false, breaking_reason: null, affected_endpoints: ["GET /v1/users/{id}"], action_required: "No action required. New optional metadata field in response.", cosmetic_only: false, confidence_notes: "Additive optional field should be low severity" }
  },
  {
    id: "adversarial-04",
    source: "Adversarial Test",
    title: "Multi-change diff: one breaking, one cosmetic",
    date: "2026-03-01",
    raw_changelog: "Updated API endpoint with breaking change and cosmetic fixes.",
    before_text: `## List Items\n\nGET  /v1/items\n\n### Parameters\n|  name  |  type  |\n|---|---|\n|  limit  |  integer (default: 50)  |\n|  offset  |  integer  |\n\n### Authentication\nAPI Key via query parameter: ?api_key=xxx`,
    after_text: `## List Items\n\nGET /v1/items\n\n### Parameters\n| name | type |\n|------|------|\n| limit | integer (default: 25) |\n| offset | integer |\n\n### Authentication\nAPI Key via Authorization header: Authorization: Bearer xxx\n\n**Breaking:** Query parameter authentication removed. Use header-based auth.`,
    diff_text: `--- before\n+++ after\n@@ -1,12 +1,14 @@\n ## List Items\n \n-GET  /v1/items\n+GET /v1/items\n \n ### Parameters\n-|  name  |  type  |\n-|---|---|\n-|  limit  |  integer (default: 50)  |\n-|  offset  |  integer  |\n+| name | type |\n+|------|------|\n+| limit | integer (default: 25) |\n+| offset | integer |\n \n ### Authentication\n-API Key via query parameter: ?api_key=xxx\n+API Key via Authorization header: Authorization: Bearer xxx\n+\n+**Breaking:** Query parameter authentication removed. Use header-based auth.`,
    ground_truth: { severity: "critical", is_breaking: true, breaking_reason: "Authentication method changed from query parameter to header. Also default limit changed from 50 to 25.", affected_endpoints: ["GET /v1/items"], action_required: "Update authentication to use Authorization header instead of query parameter. Also check pagination - default limit reduced from 50 to 25.", cosmetic_only: false, confidence_notes: "Multiple changes: breaking auth change + default value change + cosmetic whitespace. Should identify breaking one." }
  },
  {
    id: "adversarial-05",
    source: "Adversarial Test",
    title: "Ambiguous parameter description rewording",
    date: "2026-02-20",
    raw_changelog: "Clarified description of the timeout parameter.",
    before_text: `## Execute Query\n\nPOST /v1/query\n\n### Parameters\n| name | type | description |\n|------|------|-------------|\n| query | string | SQL query to execute |\n| timeout | integer | Query timeout in seconds. The query will be terminated if it exceeds this limit. |`,
    after_text: `## Execute Query\n\nPOST /v1/query\n\n### Parameters\n| name | type | description |\n|------|------|-------------|\n| query | string | SQL query to execute |\n| timeout | integer | Maximum execution time in seconds. Queries exceeding this duration may be cancelled. Results are not guaranteed after timeout. |`,
    diff_text: `--- before\n+++ after\n@@ -7,4 +7,4 @@\n | query | string | SQL query to execute |\n-| timeout | integer | Query timeout in seconds. The query will be terminated if it exceeds this limit. |\n+| timeout | integer | Maximum execution time in seconds. Queries exceeding this duration may be cancelled. Results are not guaranteed after timeout. |`,
    ground_truth: { severity: "medium", is_breaking: false, breaking_reason: null, affected_endpoints: ["POST /v1/query"], action_required: "Review timeout handling. The rewording suggests queries 'may be cancelled' (not 'will be terminated') and results aren't guaranteed. This could indicate a behavior change.", cosmetic_only: false, confidence_notes: "Ambiguous - could be just a wording clarification or could indicate a behavior change from guaranteed termination to possible cancellation" }
  }
];

for (const entry of entries) {
  const path = join(dir, `${entry.id}.json`);
  writeFileSync(path, JSON.stringify(entry, null, 2));
  console.log(`Created: ${entry.id}`);
}

console.log(`\nTotal new entries created: ${entries.length}`);
console.log('Plus 2 already created (stripe-01, stripe-02) = 30 total');
