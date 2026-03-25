export * from './enums.js';

export interface PlanLimits {
  maxUrls: number;
  minInterval: string;
  historyDays: number;
  maxWebhooks: number;
  apiRateLimit: number;
  features: {
    apiAccess: boolean;
    mcpAccess: boolean;
    discordIntegration: boolean;
    slackIntegration: boolean;
    webhookIntegration: boolean;
    schemaDiffDetail: boolean;
    perSourceSeverity: boolean;
    perSourceChannelRouting: boolean;
    digestMode: boolean;
  };
}

export interface NotificationConfig {
  email: boolean;
  webhook_ids: string[];
  min_severity: string;
  slack_enabled?: boolean;
  discord_enabled?: boolean;
  digest_mode?: 'daily' | 'weekly' | null;
}

export interface NotificationDefaults {
  email?: boolean;
  min_severity?: string;
  quiet_hours?: {
    start: string;
    end: string;
    timezone: string;
  };
  digest_mode?: 'daily' | 'weekly' | null;
  slack_webhook_url?: string | null;
  discord_webhook_url?: string | null;
}
