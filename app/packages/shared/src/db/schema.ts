import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  real,
  customType,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom bytea type for encrypted columns
const bytea = customType<{ data: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// ============================================================================
// 1. CORE TABLES
// ============================================================================

// 1.1 users
export const users = pgTable('users', {
  id: text('id').primaryKey(), // usr_ + nanoid(21)
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  plan: text('plan').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  subscriptionStatus: text('subscription_status').default('active'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  emailVerified: boolean('email_verified').notNull().default(false),
  loginFailures: integer('login_failures').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  timezone: text('timezone').default('UTC'),
  notificationDefaults: jsonb('notification_defaults').default({}),
  onboardingStep: integer('onboarding_step').default(0),
  lastDashboardVisitAt: timestamp('last_dashboard_visit_at', { withTimezone: true }),
  emailPreferences: jsonb('email_preferences').default({
    onboarding: true,
    weekly_report: true,
    product_updates: true,
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// better-auth session table (usePlural: true)
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// better-auth account table (usePlural: true)
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// better-auth verification table (usePlural: true)
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 1.2 shared_urls
export const sharedUrls = pgTable('shared_urls', {
  id: text('id').primaryKey(),
  urlHash: text('url_hash').notNull().unique(),
  url: text('url').notNull(),
  domain: text('domain').notNull(),
  effectiveInterval: text('effective_interval').notNull().default('24h'),
  subscriberCount: integer('subscriber_count').notNull().default(1),
  contentType: text('content_type'),
  monitoringMethod: text('monitoring_method'),
  lastCheckAt: timestamp('last_check_at', { withTimezone: true }),
  nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 1.3 urls
export const urls = pgTable(
  'urls',
  {
    id: text('id').primaryKey(), // url_ + nanoid(21)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    urlHash: text('url_hash').notNull(),
    name: text('name'),
    sourceType: text('source_type').notNull().default('http'),
    // Values: 'http' | 'mcp_server'
    mcpConfig: jsonb('mcp_config').default({}),
    // MCP-specific config: { transport, endpoint, authHeader, serverInfo }
    method: text('method').notNull().default('GET'),
    postConsent: boolean('post_consent').notNull().default(false),
    postConsentAt: timestamp('post_consent_at', { withTimezone: true }),
    headers: jsonb('headers').default({}),
    body: text('body'),
    checkInterval: text('check_interval').notNull().default('24h'),
    status: text('status').notNull().default('learning'),
    statusReason: text('status_reason'),
    contentType: text('content_type'),
    monitoringMethod: text('monitoring_method'),
    classificationConfidence: integer('classification_confidence'),
    confidenceThreshold: integer('confidence_threshold').notNull().default(80),
    volatileFields: jsonb('volatile_fields').default([]),
    notificationConfig: jsonb('notification_config').default({
      email: true,
      webhook_ids: [],
      min_severity: 'medium',
    }),
    tags: text('tags')
      .array()
      .default(sql`'{}'`),
    sharedUrlId: text('shared_url_id').references(() => sharedUrls.id),
    parsedDomain: text('parsed_domain'),
    parsedPath: text('parsed_path'),
    parsedVersion: text('parsed_version'),
    pausedAt: timestamp('paused_at', { withTimezone: true }),
    learningStartedAt: timestamp('learning_started_at', { withTimezone: true }),
    calibratingSince: timestamp('calibrating_since', { withTimezone: true }),
    lastCheckAt: timestamp('last_check_at', { withTimezone: true }),
    nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('urls_user_url_hash_unique').on(table.userId, table.urlHash),
    index('idx_urls_user').on(table.userId),
    index('idx_urls_next_check').on(table.nextCheckAt),
    index('idx_urls_domain_path').on(table.parsedDomain, table.parsedPath),
    index('idx_urls_domain_active').on(table.parsedDomain),
    index('idx_urls_source_type').on(table.sourceType, table.nextCheckAt),
  ],
);

// 1.4 baselines
export const baselines = pgTable('baselines', {
  id: text('id').primaryKey(),
  sharedUrlId: text('shared_url_id')
    .notNull()
    .unique()
    .references(() => sharedUrls.id, { onDelete: 'cascade' }),
  fullHash: text('full_hash').notNull(),
  stableHash: text('stable_hash').notNull(),
  schemaHash: text('schema_hash').notNull(),
  headerHash: text('header_hash').notNull(),
  statusCode: integer('status_code').notNull(),
  responseHeaders: jsonb('response_headers').notNull(),
  contentType: text('content_type'),
  responseTimeMs: integer('response_time_ms'),
  bodyR2Key: text('body_r2_key').notNull(),
  bodySizeBytes: integer('body_size_bytes').notNull(),
  baselineSizeBytes: integer('baseline_size_bytes'),
  sizeVariancePct: real('size_variance_pct').default(0),
  schemaSnapshot: jsonb('schema_snapshot'),
  fieldStats: jsonb('field_stats').default({}),
  extractedTextHash: text('extracted_text_hash'),
  baselineStatus: text('baseline_status').notNull().default('provisional'),
  baselineContributors: integer('baseline_contributors').notNull().default(1),
  quorumThreshold: integer('quorum_threshold').notNull().default(2),
  establishedAt: timestamp('established_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// NOTE: check_results is PARTITIONED — managed via raw SQL, not Drizzle.
// See migrations/sql/001_partitions.sql

// 1.6 changes
export const changes = pgTable(
  'changes',
  {
    id: text('id').primaryKey(), // chg_ + nanoid(21)
    sharedUrlId: text('shared_url_id')
      .notNull()
      .references(() => sharedUrls.id),
    changeType: text('change_type').notNull(),
    severity: text('severity').notNull(),
    confidence: integer('confidence').notNull(),
    summary: text('summary').notNull(),
    diff: jsonb('diff').notNull(),
    actions: jsonb('actions').default([]),
    previousBodyR2Key: text('previous_body_r2_key').notNull(),
    currentBodyR2Key: text('current_body_r2_key').notNull(),
    previousSchema: jsonb('previous_schema'),
    currentSchema: jsonb('current_schema'),
    previousStatusCode: integer('previous_status_code'),
    currentStatusCode: integer('current_status_code'),
    previousHeaders: jsonb('previous_headers'),
    currentHeaders: jsonb('current_headers'),
    confirmationStatus: text('confirmation_status').notNull().default('pending'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    detectedAt: timestamp('detected_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_changes_shared_url').on(table.sharedUrlId, table.detectedAt),
    index('idx_changes_severity').on(table.severity, table.detectedAt),
  ],
);

// 1.7 user_changes
export const userChanges = pgTable(
  'user_changes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    changeId: text('change_id')
      .notNull()
      .references(() => changes.id, { onDelete: 'cascade' }),
    urlId: text('url_id')
      .notNull()
      .references(() => urls.id, { onDelete: 'cascade' }),
    sourceId: text('source_id'),
    workflowState: text('workflow_state').notNull().default('new'),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    note: text('note'),
    feedback: text('feedback'),
    feedbackComment: text('feedback_comment'),
    feedbackAt: timestamp('feedback_at', { withTimezone: true }),
    notified: boolean('notified').notNull().default(false),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    alerted: boolean('alerted').notNull().default(true),
    alertSuppressedReason: text('alert_suppressed_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_changes_user_change_unique').on(table.userId, table.changeId),
    index('idx_user_changes_user').on(table.userId, table.createdAt),
    index('idx_user_changes_unacked').on(table.userId),
  ],
);

// 1.8 api_keys
export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey(), // apk_ + nanoid(21)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Default'),
    keyHash: text('key_hash').notNull().unique(), // SHA-256 hash of the full key
    keyPrefix: text('key_prefix').notNull(), // ck_live_ or ck_test_
    keyLastFour: text('key_last_four').notNull(), // last 4 chars for display
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_api_keys_user').on(table.userId)],
);

// ============================================================================
// 2. NOTIFICATION TABLES
// ============================================================================

// 2.1 webhooks
export const webhooks = pgTable(
  'webhooks',
  {
    id: text('id').primaryKey(), // wh_ + nanoid(21)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    name: text('name').default('Default Webhook'),
    signingSecret: text('signing_secret').notNull(),
    events: text('events')
      .array()
      .notNull()
      .default(sql`'{change.confirmed}'`),
    isActive: boolean('is_active').notNull().default(true),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    lastFailureReason: text('last_failure_reason'),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_webhooks_user').on(table.userId),
    index('idx_webhooks_active').on(table.userId),
  ],
);

// 2.2 webhook_deliveries
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    webhookId: text('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    statusCode: integer('status_code'),
    responseBody: text('response_body'),
    error: text('error'),
    attemptNumber: integer('attempt_number').notNull().default(1),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_webhook_deliveries_webhook').on(table.webhookId, table.deliveredAt)],
);

// 2.3 notifications
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    changeId: text('change_id').references(() => changes.id),
    channel: text('channel').notNull(),
    recipient: text('recipient').notNull(),
    subject: text('subject'),
    status: text('status').notNull().default('pending'),
    error: text('error'),
    feedbackToken: text('feedback_token').unique(),
    feedbackExpiresAt: timestamp('feedback_expires_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_notifications_user').on(table.userId, table.createdAt),
    index('idx_notifications_change').on(table.changeId),
    index('idx_notifications_feedback').on(table.feedbackToken),
  ],
);

// ============================================================================
// 3. EARLY WARNING TABLES
// ============================================================================

// 3.1 forecasts
export const forecasts = pgTable(
  'forecasts',
  {
    id: text('id').primaryKey(), // frc_ + nanoid(21)
    sharedUrlId: text('shared_url_id').references(() => sharedUrls.id, { onDelete: 'cascade' }),
    signalType: text('signal_type').notNull(),
    alertLevel: text('alert_level').notNull().default('forecast'),
    severity: text('severity').notNull().default('medium'),
    title: text('title').notNull(),
    description: text('description').notNull(),
    deadline: timestamp('deadline', { withTimezone: true }),
    deadlineSource: text('deadline_source'),
    affectedEndpoints: jsonb('affected_endpoints').default([]),
    source: text('source').notNull(),
    sourceUrl: text('source_url'),
    sourceText: text('source_text'),
    documentationUrl: text('documentation_url'),
    confidence: integer('confidence').notNull().default(80),
    dedupKey: text('dedup_key').notNull().unique(),
    status: text('status').notNull().default('active'),
    changeId: text('change_id').references(() => changes.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_forecasts_shared_url').on(table.sharedUrlId, table.createdAt),
    index('idx_forecasts_status').on(table.status),
    index('idx_forecasts_deadline').on(table.deadline),
    index('idx_forecasts_signal_type').on(table.signalType, table.createdAt),
  ],
);

// 3.2 user_forecasts
export const userForecasts = pgTable(
  'user_forecasts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    forecastId: text('forecast_id')
      .notNull()
      .references(() => forecasts.id, { onDelete: 'cascade' }),
    urlId: text('url_id')
      .notNull()
      .references(() => urls.id, { onDelete: 'cascade' }),
    acknowledged: boolean('acknowledged').notNull().default(false),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgeNote: text('acknowledge_note'),
    lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
    lastReminderDays: integer('last_reminder_days'),
    remindersMuted: boolean('reminders_muted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_forecasts_user_forecast_unique').on(table.userId, table.forecastId),
    index('idx_user_forecasts_user').on(table.userId, table.createdAt),
    index('idx_user_forecasts_unacked').on(table.userId),
  ],
);

// 3.3 header_snapshots
export const headerSnapshots = pgTable(
  'header_snapshots',
  {
    id: text('id').primaryKey(),
    sharedUrlId: text('shared_url_id').notNull(),
    checkResultId: text('check_result_id').notNull(),
    headers: jsonb('headers').notNull(),
    sunsetDate: timestamp('sunset_date', { withTimezone: true }),
    deprecationDate: timestamp('deprecation_date', { withTimezone: true }),
    deprecationLink: text('deprecation_link'),
    sunsetLink: text('sunset_link'),
    apiVersion: text('api_version'),
    apiVersionHeader: text('api_version_header'),
    warningText: text('warning_text'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_header_snapshots_url').on(table.sharedUrlId, table.capturedAt),
    index('idx_header_snapshots_sunset').on(table.sharedUrlId),
    index('idx_header_snapshots_deprecation').on(table.sharedUrlId),
    index('idx_header_snapshots_version').on(table.sharedUrlId, table.apiVersion),
  ],
);

// ============================================================================
// 4. SHARED INTELLIGENCE TABLES
// ============================================================================

// 4.1 shared_sources
export const sharedSources = pgTable(
  'shared_sources',
  {
    id: text('id').primaryKey(),
    domain: text('domain').notNull(),
    sourceType: text('source_type').notNull(),
    url: text('url').notNull(),
    discoveredBy: text('discovered_by').references(() => users.id, { onDelete: 'set null' }),
    discoveryMethod: text('discovery_method').notNull().default('auto'),
    checkInterval: text('check_interval').notNull().default('2h'),
    currentBodyHash: text('current_body_hash'),
    status: text('status').notNull().default('active'),
    lastCheckAt: timestamp('last_check_at', { withTimezone: true }),
    nextCheckAt: timestamp('next_check_at', { withTimezone: true }),
    subscriberCount: integer('subscriber_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_shared_sources_domain').on(table.domain),
    index('idx_shared_sources_schedule').on(table.nextCheckAt),
  ],
);

// 4.2 signals
export const signals = pgTable(
  'signals',
  {
    id: text('id').primaryKey(),
    sharedSourceId: text('shared_source_id').references(() => sharedSources.id, {
      onDelete: 'set null',
    }),
    domain: text('domain').notNull(),
    signalType: text('signal_type').notNull(),
    actionType: text('action_type').notNull(),
    scope: text('scope').notNull().default('unknown'),
    title: text('title').notNull(),
    description: text('description').notNull(),
    affectedPaths: jsonb('affected_paths').default([]),
    affectedVersions: jsonb('affected_versions').default([]),
    affectedProducts: jsonb('affected_products').default([]),
    deadline: timestamp('deadline', { withTimezone: true }),
    migrationTarget: text('migration_target'),
    confidence: integer('confidence').notNull().default(70),
    correlationKey: text('correlation_key').notNull(),
    dedupKey: text('dedup_key').notNull().unique(),
    evidenceCount: integer('evidence_count').notNull().default(1),
    totalUsers: integer('total_users').default(0),
    matchedUsers: integer('matched_users').default(0),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_signals_domain').on(table.domain, table.createdAt),
    index('idx_signals_correlation').on(table.correlationKey),
    index('idx_signals_status').on(table.status),
  ],
);

// 4.3 signal_matches
export const signalMatches = pgTable(
  'signal_matches',
  {
    id: text('id').primaryKey(),
    signalId: text('signal_id')
      .notNull()
      .references(() => signals.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    urlId: text('url_id')
      .notNull()
      .references(() => urls.id, { onDelete: 'cascade' }),
    isRelevant: boolean('is_relevant').notNull(),
    relevanceScore: real('relevance_score').notNull().default(0),
    matchType: text('match_type'),
    reasons: jsonb('reasons').default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('signal_matches_unique').on(table.signalId, table.userId, table.urlId),
    index('idx_signal_matches_user').on(table.userId, table.createdAt),
    index('idx_signal_matches_signal').on(table.signalId),
  ],
);

// 4.4 domain_user_counts
export const domainUserCounts = pgTable('domain_user_counts', {
  domain: text('domain').primaryKey(),
  userCount: integer('user_count').notNull().default(0),
  refreshedAt: timestamp('refreshed_at', { withTimezone: true }).notNull().defaultNow(),
});

// 4.5 discovery_results
export const discoveryResults = pgTable(
  'discovery_results',
  {
    id: text('id').primaryKey(),
    domain: text('domain').notNull(),
    probeUrl: text('probe_url').notNull(),
    statusCode: integer('status_code'),
    contentType: text('content_type'),
    isUseful: boolean('is_useful').notNull().default(false),
    suggestedSourceType: text('suggested_source_type'),
    probedAt: timestamp('probed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_discovery_results_domain').on(table.domain)],
);

// ============================================================================
// 5. SECURITY & SECRETS TABLES
// ============================================================================

// 5.1 url_secrets
export const urlSecrets = pgTable(
  'url_secrets',
  {
    id: text('id').primaryKey(), // sec_ + nanoid(21)
    urlId: text('url_id')
      .notNull()
      .references(() => urls.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    headerName: text('header_name').notNull(),
    headerValueEncrypted: bytea('header_value_encrypted').notNull(),
    encryptionKeyId: text('encryption_key_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('url_secrets_url_header_unique').on(table.urlId, table.headerName),
    index('idx_url_secrets_url').on(table.urlId),
  ],
);

// 5.2 oauth_tokens
export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: text('id').primaryKey(), // oat_ + nanoid(21)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    accessTokenEncrypted: bytea('access_token_encrypted').notNull(),
    refreshTokenEncrypted: bytea('refresh_token_encrypted'),
    tokenType: text('token_type').default('Bearer'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    scopes: text('scopes').array(),
    encryptionKeyId: text('encryption_key_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('oauth_tokens_user_provider_unique').on(table.userId, table.provider)],
);

// 5.3 integrations
export const integrations = pgTable(
  'integrations',
  {
    id: text('id').primaryKey(), // int_ + nanoid(21)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    oauthTokenId: text('oauth_token_id').references(() => oauthTokens.id, {
      onDelete: 'set null',
    }),
    config: jsonb('config').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('integrations_user_provider_unique').on(table.userId, table.provider),
  ],
);

// 5.4 tickets
export const tickets = pgTable(
  'tickets',
  {
    id: text('id').primaryKey(), // tkt_ + nanoid(21)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    changeId: text('change_id')
      .notNull()
      .references(() => changes.id, { onDelete: 'cascade' }),
    integrationId: text('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    ticketKey: text('ticket_key').notNull(),
    ticketUrl: text('ticket_url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tickets_change_integration_unique').on(table.changeId, table.integrationId),
    index('idx_tickets_change').on(table.changeId),
    index('idx_tickets_user').on(table.userId),
  ],
);

// 5.5 feedback
export const feedback = pgTable(
  'feedback',
  {
    id: text('id').primaryKey(), // fb_ + nanoid(21)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    text: text('text').notNull(),
    screenshotR2Key: text('screenshot_r2_key'),
    urlId: text('url_id').references(() => urls.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('new'),
    adminNote: text('admin_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_feedback_user').on(table.userId),
    index('idx_feedback_status').on(table.status, table.createdAt),
  ],
);

// ============================================================================
// 6. SUPPORTING TABLES
// ============================================================================

// 6.1 learning_samples
export const learningSamples = pgTable(
  'learning_samples',
  {
    id: text('id').primaryKey(),
    sharedUrlId: text('shared_url_id')
      .notNull()
      .references(() => sharedUrls.id, { onDelete: 'cascade' }),
    statusCode: integer('status_code'),
    headers: jsonb('headers'),
    bodyHash: text('body_hash'),
    schemaSnapshot: jsonb('schema_snapshot'),
    fieldValues: jsonb('field_values'),
    sampledAt: timestamp('sampled_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_learning_samples_url').on(table.sharedUrlId, table.sampledAt)],
);

// 6.2 domain_patterns
export const domainPatterns = pgTable(
  'domain_patterns',
  {
    id: text('id').primaryKey(),
    domain: text('domain').notNull(),
    pathPattern: text('path_pattern'),
    contentType: text('content_type').notNull(),
    monitoringMethod: text('monitoring_method').notNull(),
    confidence: integer('confidence').notNull().default(90),
    rewriteUrl: text('rewrite_url'),
    discoveryHints: jsonb('discovery_hints').default([]),
    isBuiltin: boolean('is_builtin').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_domain_patterns_domain').on(table.domain)],
);

// 6.3 package_versions
export const packageVersions = pgTable(
  'package_versions',
  {
    id: text('id').primaryKey(),
    packageName: text('package_name').notNull(),
    registry: text('registry').notNull(),
    sharedUrlId: text('shared_url_id').references(() => sharedUrls.id, { onDelete: 'set null' }),
    latestVersion: text('latest_version').notNull(),
    previousVersion: text('previous_version'),
    changelogUrl: text('changelog_url'),
    releaseDate: timestamp('release_date', { withTimezone: true }),
    isMajorBump: boolean('is_major_bump').notNull().default(false),
    breakingChanges: jsonb('breaking_changes').default([]),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }).notNull().defaultNow(),
    checkInterval: text('check_interval').notNull().default('6h'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('package_versions_name_registry_unique').on(table.packageName, table.registry),
    index('idx_package_versions_url').on(table.sharedUrlId),
    index('idx_package_versions_check').on(table.lastCheckedAt),
  ],
);

// 6.4 spec_snapshots
export const specSnapshots = pgTable(
  'spec_snapshots',
  {
    id: text('id').primaryKey(),
    sharedUrlId: text('shared_url_id')
      .notNull()
      .references(() => sharedUrls.id, { onDelete: 'cascade' }),
    specHash: text('spec_hash').notNull(),
    specR2Key: text('spec_r2_key').notNull(),
    specFormat: text('spec_format').notNull(),
    specVersion: text('spec_version'),
    endpointCount: integer('endpoint_count'),
    deprecatedEndpoints: jsonb('deprecated_endpoints').default([]),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_spec_snapshots_url').on(table.sharedUrlId, table.capturedAt)],
);

// 6.5 mcp_tool_snapshots
export const mcpToolSnapshots = pgTable(
  'mcp_tool_snapshots',
  {
    id: text('id').primaryKey(), // mts_ + nanoid(21)
    sharedUrlId: text('shared_url_id')
      .notNull()
      .references(() => sharedUrls.id, { onDelete: 'cascade' }),
    toolsJson: jsonb('tools_json').notNull(),
    // Structure: { tools: McpToolDefinition[] }
    toolsHash: text('tools_hash').notNull(),
    // SHA-256 of canonical JSON (sorted keys)
    toolHashes: jsonb('tool_hashes').notNull(),
    // Structure: { [toolName]: sha256(canonicalJson(tool)) }
    serverInfo: jsonb('server_info'),
    // Structure: { name, version, vendor, capabilities }
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_mcp_tool_snapshots_url').on(table.sharedUrlId, table.capturedAt),
    index('idx_mcp_tool_snapshots_hash').on(table.sharedUrlId, table.toolsHash),
  ],
);

// 6.6 source_alert_preferences
export const sourceAlertPreferences = pgTable(
  'source_alert_preferences',
  {
    id: text('id').primaryKey(), // sap_ + nanoid(21)
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceId: text('source_id').notNull(),
    alertEnabled: boolean('alert_enabled').notNull().default(true),
    minSeverity: text('min_severity').notNull().default('low'),
    emailEnabled: boolean('email_enabled'),
    webhookIds: text('webhook_ids').array(),
    integrationIds: text('integration_ids').array(),
    digestMode: boolean('digest_mode'),
    digestSchedule: text('digest_schedule'),
    quietHoursStart: text('quiet_hours_start'),
    quietHoursEnd: text('quiet_hours_end'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sap_user_source_unique').on(table.userId, table.sourceId),
    index('idx_sap_user_id').on(table.userId),
    index('idx_sap_source_id').on(table.sourceId),
  ],
);

// ============================================================================
// 7. GITHUB INTEGRATION TABLES (for Item 8)
// ============================================================================

export const githubConnections = pgTable('github_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  installationId: text('installation_id').notNull(),
  accountLogin: text('account_login'),
  accountType: text('account_type'), // 'User' | 'Organization'
  defaultRepo: text('default_repo'),
  defaultLabels: text('default_labels').array(),
  defaultAssignee: text('default_assignee'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const githubIssues = pgTable(
  'github_issues',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    changeId: text('change_id')
      .notNull()
      .references(() => changes.id, { onDelete: 'cascade' }),
    repo: text('repo').notNull(),
    issueNumber: integer('issue_number').notNull(),
    issueUrl: text('issue_url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('github_issues_change_repo_unique').on(table.changeId, table.repo),
  ],
);

// ============================================================================
// 8. FEATURE FLAGS & MISC
// ============================================================================

export const featureFlags = pgTable('feature_flags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  enabled: boolean('enabled').notNull().default(false),
  description: text('description'),
  allowedPlans: text('allowed_plans').array(),
  allowedUserIds: text('allowed_user_ids').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationRules = pgTable('notification_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  conditions: jsonb('conditions').notNull(),
  actions: jsonb('actions').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const monitoredPackages = pgTable('monitored_packages', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  packageName: text('package_name').notNull(),
  registry: text('registry').notNull().default('npm'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const simulations = pgTable('simulations', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  urlId: text('url_id').references(() => urls.id, { onDelete: 'set null' }),
  simulationType: text('simulation_type').notNull(),
  config: jsonb('config').notNull(),
  result: jsonb('result'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const providerEvents = pgTable(
  'provider_events',
  {
    id: text('id').primaryKey(),
    domain: text('domain').notNull(),
    eventType: text('event_type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    sourceUrl: text('source_url'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_provider_events_domain').on(table.domain, table.createdAt)],
);

// API dependency tracking tables
export const apiDependencies = pgTable('api_dependencies', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  urlId: text('url_id')
    .notNull()
    .references(() => urls.id, { onDelete: 'cascade' }),
  dependsOnUrlId: text('depends_on_url_id').references(() => urls.id, { onDelete: 'set null' }),
  relationshipType: text('relationship_type').notNull().default('depends_on'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userApiContext = pgTable('user_api_context', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  urlId: text('url_id')
    .notNull()
    .references(() => urls.id, { onDelete: 'cascade' }),
  context: jsonb('context').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const impactAnalyses = pgTable('impact_analyses', {
  id: text('id').primaryKey(),
  changeId: text('change_id')
    .notNull()
    .references(() => changes.id, { onDelete: 'cascade' }),
  analysis: jsonb('analysis').notNull(),
  affectedDependencies: jsonb('affected_dependencies').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userImpactViews = pgTable('user_impact_views', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  impactAnalysisId: text('impact_analysis_id')
    .notNull()
    .references(() => impactAnalyses.id, { onDelete: 'cascade' }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const migrationChecklists = pgTable('migration_checklists', {
  id: text('id').primaryKey(),
  changeId: text('change_id')
    .notNull()
    .references(() => changes.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  steps: jsonb('steps').notNull().default([]),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
