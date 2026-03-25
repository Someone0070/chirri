export const Plan = {
  FREE: 'free',
  PERSONAL: 'personal',
  TEAM: 'team',
  BUSINESS: 'business',
} as const;
export type Plan = (typeof Plan)[keyof typeof Plan];

export const Severity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const WorkflowState = {
  NEW: 'new',
  TRACKED: 'tracked',
  DISMISSED: 'dismissed',
  SNOOZED: 'snoozed',
  RESOLVED: 'resolved',
} as const;
export type WorkflowState = (typeof WorkflowState)[keyof typeof WorkflowState];

export const UrlStatus = {
  LEARNING: 'learning',
  CALIBRATING: 'calibrating',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ERROR: 'error',
  DEGRADED: 'degraded',
  AUTH_REQUIRED: 'auth_required',
  REDIRECT_DETECTED: 'redirect_detected',
  LIMITED: 'limited',
  MONITORING_EMPTY: 'monitoring_empty',
} as const;
export type UrlStatus = (typeof UrlStatus)[keyof typeof UrlStatus];

export const CheckInterval = {
  ONE_MINUTE: '1m',
  FIVE_MINUTES: '5m',
  FIFTEEN_MINUTES: '15m',
  ONE_HOUR: '1h',
  SIX_HOURS: '6h',
  TWENTY_FOUR_HOURS: '24h',
} as const;
export type CheckInterval = (typeof CheckInterval)[keyof typeof CheckInterval];

export const ChangeType = {
  SCHEMA: 'schema',
  STATUS_CODE: 'status_code',
  HEADER: 'header',
  CONTENT: 'content',
  REDIRECT: 'redirect',
  TIMING: 'timing',
  TLS: 'tls',
  ERROR_FORMAT: 'error_format',
  AVAILABILITY: 'availability',
  RATE_LIMIT: 'rate_limit',
} as const;
export type ChangeType = (typeof ChangeType)[keyof typeof ChangeType];

export const ConfirmationStatus = {
  PENDING: 'pending',
  STAGE1_CONFIRMED: 'stage1_confirmed',
  STAGE2_CONFIRMED: 'stage2_confirmed',
  CONFIRMED: 'confirmed',
  REVERTED: 'reverted',
  UNSTABLE: 'unstable',
} as const;
export type ConfirmationStatus = (typeof ConfirmationStatus)[keyof typeof ConfirmationStatus];

export const NotificationChannel = {
  EMAIL: 'email',
  WEBHOOK: 'webhook',
  SLACK: 'slack',
  DISCORD: 'discord',
  TELEGRAM: 'telegram',
  PAGERDUTY: 'pagerduty',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];
