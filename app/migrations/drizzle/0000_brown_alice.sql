CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_dependencies" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url_id" text NOT NULL,
	"depends_on_url_id" text,
	"relationship_type" text DEFAULT 'depends_on' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baselines" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_url_id" text NOT NULL,
	"full_hash" text NOT NULL,
	"stable_hash" text NOT NULL,
	"schema_hash" text NOT NULL,
	"header_hash" text NOT NULL,
	"status_code" integer NOT NULL,
	"response_headers" jsonb NOT NULL,
	"content_type" text,
	"response_time_ms" integer,
	"body_r2_key" text NOT NULL,
	"body_size_bytes" integer NOT NULL,
	"baseline_size_bytes" integer,
	"size_variance_pct" real DEFAULT 0,
	"schema_snapshot" jsonb,
	"field_stats" jsonb DEFAULT '{}'::jsonb,
	"extracted_text_hash" text,
	"baseline_status" text DEFAULT 'provisional' NOT NULL,
	"baseline_contributors" integer DEFAULT 1 NOT NULL,
	"quorum_threshold" integer DEFAULT 2 NOT NULL,
	"established_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "baselines_shared_url_id_unique" UNIQUE("shared_url_id")
);
--> statement-breakpoint
CREATE TABLE "changes" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_url_id" text NOT NULL,
	"change_type" text NOT NULL,
	"severity" text NOT NULL,
	"confidence" integer NOT NULL,
	"summary" text NOT NULL,
	"diff" jsonb NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb,
	"previous_body_r2_key" text NOT NULL,
	"current_body_r2_key" text NOT NULL,
	"previous_schema" jsonb,
	"current_schema" jsonb,
	"previous_status_code" integer,
	"current_status_code" integer,
	"previous_headers" jsonb,
	"current_headers" jsonb,
	"confirmation_status" text DEFAULT 'pending' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discovery_results" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"probe_url" text NOT NULL,
	"status_code" integer,
	"content_type" text,
	"is_useful" boolean DEFAULT false NOT NULL,
	"suggested_source_type" text,
	"probed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_patterns" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"path_pattern" text,
	"content_type" text NOT NULL,
	"monitoring_method" text NOT NULL,
	"confidence" integer DEFAULT 90 NOT NULL,
	"rewrite_url" text,
	"discovery_hints" jsonb DEFAULT '[]'::jsonb,
	"is_builtin" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_user_counts" (
	"domain" text PRIMARY KEY NOT NULL,
	"user_count" integer DEFAULT 0 NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"description" text,
	"allowed_plans" text[],
	"allowed_user_ids" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"screenshot_r2_key" text,
	"url_id" text,
	"status" text DEFAULT 'new' NOT NULL,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_url_id" text,
	"signal_type" text NOT NULL,
	"alert_level" text DEFAULT 'forecast' NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"deadline" timestamp with time zone,
	"deadline_source" text,
	"affected_endpoints" jsonb DEFAULT '[]'::jsonb,
	"source" text NOT NULL,
	"source_url" text,
	"source_text" text,
	"documentation_url" text,
	"confidence" integer DEFAULT 80 NOT NULL,
	"dedup_key" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"change_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forecasts_dedup_key_unique" UNIQUE("dedup_key")
);
--> statement-breakpoint
CREATE TABLE "github_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"installation_id" text NOT NULL,
	"account_login" text,
	"account_type" text,
	"default_repo" text,
	"default_labels" text[],
	"default_assignee" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_issues" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"change_id" text NOT NULL,
	"repo" text NOT NULL,
	"issue_number" integer NOT NULL,
	"issue_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "header_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_url_id" text NOT NULL,
	"check_result_id" text NOT NULL,
	"headers" jsonb NOT NULL,
	"sunset_date" timestamp with time zone,
	"deprecation_date" timestamp with time zone,
	"deprecation_link" text,
	"sunset_link" text,
	"api_version" text,
	"api_version_header" text,
	"warning_text" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impact_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"change_id" text NOT NULL,
	"analysis" jsonb NOT NULL,
	"affected_dependencies" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"oauth_token_id" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_samples" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_url_id" text NOT NULL,
	"status_code" integer,
	"headers" jsonb,
	"body_hash" text,
	"schema_snapshot" jsonb,
	"field_values" jsonb,
	"sampled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_checklists" (
	"id" text PRIMARY KEY NOT NULL,
	"change_id" text NOT NULL,
	"user_id" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitored_packages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"package_name" text NOT NULL,
	"registry" text DEFAULT 'npm' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"conditions" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"change_id" text,
	"channel" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"feedback_token" text,
	"feedback_expires_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_feedback_token_unique" UNIQUE("feedback_token")
);
--> statement-breakpoint
CREATE TABLE "oauth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"access_token_encrypted" "bytea" NOT NULL,
	"refresh_token_encrypted" "bytea",
	"token_type" text DEFAULT 'Bearer',
	"expires_at" timestamp with time zone,
	"scopes" text[],
	"encryption_key_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "package_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"package_name" text NOT NULL,
	"registry" text NOT NULL,
	"shared_url_id" text,
	"latest_version" text NOT NULL,
	"previous_version" text,
	"changelog_url" text,
	"release_date" timestamp with time zone,
	"is_major_bump" boolean DEFAULT false NOT NULL,
	"breaking_changes" jsonb DEFAULT '[]'::jsonb,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"check_interval" text DEFAULT '6h' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_events" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"source_url" text,
	"started_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "shared_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"source_type" text NOT NULL,
	"url" text NOT NULL,
	"discovered_by" text,
	"discovery_method" text DEFAULT 'auto' NOT NULL,
	"check_interval" text DEFAULT '2h' NOT NULL,
	"current_body_hash" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_check_at" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_urls" (
	"id" text PRIMARY KEY NOT NULL,
	"url_hash" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"effective_interval" text DEFAULT '24h' NOT NULL,
	"subscriber_count" integer DEFAULT 1 NOT NULL,
	"content_type" text,
	"monitoring_method" text,
	"last_check_at" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_urls_url_hash_unique" UNIQUE("url_hash")
);
--> statement-breakpoint
CREATE TABLE "signal_matches" (
	"id" text PRIMARY KEY NOT NULL,
	"signal_id" text NOT NULL,
	"user_id" text NOT NULL,
	"url_id" text NOT NULL,
	"is_relevant" boolean NOT NULL,
	"relevance_score" real DEFAULT 0 NOT NULL,
	"match_type" text,
	"reasons" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_source_id" text,
	"domain" text NOT NULL,
	"signal_type" text NOT NULL,
	"action_type" text NOT NULL,
	"scope" text DEFAULT 'unknown' NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"affected_paths" jsonb DEFAULT '[]'::jsonb,
	"affected_versions" jsonb DEFAULT '[]'::jsonb,
	"affected_products" jsonb DEFAULT '[]'::jsonb,
	"deadline" timestamp with time zone,
	"migration_target" text,
	"confidence" integer DEFAULT 70 NOT NULL,
	"correlation_key" text NOT NULL,
	"dedup_key" text NOT NULL,
	"evidence_count" integer DEFAULT 1 NOT NULL,
	"total_users" integer DEFAULT 0,
	"matched_users" integer DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signals_dedup_key_unique" UNIQUE("dedup_key")
);
--> statement-breakpoint
CREATE TABLE "simulations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url_id" text,
	"simulation_type" text NOT NULL,
	"config" jsonb NOT NULL,
	"result" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "source_alert_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_id" text NOT NULL,
	"alert_enabled" boolean DEFAULT true NOT NULL,
	"min_severity" text DEFAULT 'low' NOT NULL,
	"email_enabled" boolean,
	"webhook_ids" text[],
	"integration_ids" text[],
	"digest_mode" boolean,
	"digest_schedule" text,
	"quiet_hours_start" text,
	"quiet_hours_end" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spec_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"shared_url_id" text NOT NULL,
	"spec_hash" text NOT NULL,
	"spec_r2_key" text NOT NULL,
	"spec_format" text NOT NULL,
	"spec_version" text,
	"endpoint_count" integer,
	"deprecated_endpoints" jsonb DEFAULT '[]'::jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"change_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"provider" text NOT NULL,
	"ticket_key" text NOT NULL,
	"ticket_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "url_secrets" (
	"id" text PRIMARY KEY NOT NULL,
	"url_id" text NOT NULL,
	"user_id" text NOT NULL,
	"header_name" text NOT NULL,
	"header_value_encrypted" "bytea" NOT NULL,
	"encryption_key_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "urls" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"url_hash" text NOT NULL,
	"name" text,
	"method" text DEFAULT 'GET' NOT NULL,
	"post_consent" boolean DEFAULT false NOT NULL,
	"post_consent_at" timestamp with time zone,
	"headers" jsonb DEFAULT '{}'::jsonb,
	"body" text,
	"check_interval" text DEFAULT '24h' NOT NULL,
	"status" text DEFAULT 'learning' NOT NULL,
	"status_reason" text,
	"content_type" text,
	"monitoring_method" text,
	"classification_confidence" integer,
	"confidence_threshold" integer DEFAULT 80 NOT NULL,
	"volatile_fields" jsonb DEFAULT '[]'::jsonb,
	"notification_config" jsonb DEFAULT '{"email":true,"webhook_ids":[],"min_severity":"medium"}'::jsonb,
	"tags" text[] DEFAULT '{}',
	"shared_url_id" text,
	"parsed_domain" text,
	"parsed_path" text,
	"parsed_version" text,
	"paused_at" timestamp with time zone,
	"learning_started_at" timestamp with time zone,
	"calibrating_since" timestamp with time zone,
	"last_check_at" timestamp with time zone,
	"next_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_api_context" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url_id" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"change_id" text NOT NULL,
	"url_id" text NOT NULL,
	"source_id" text,
	"workflow_state" text DEFAULT 'new' NOT NULL,
	"snoozed_until" timestamp with time zone,
	"note" text,
	"feedback" text,
	"feedback_comment" text,
	"feedback_at" timestamp with time zone,
	"notified" boolean DEFAULT false NOT NULL,
	"notified_at" timestamp with time zone,
	"alerted" boolean DEFAULT true NOT NULL,
	"alert_suppressed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_forecasts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"forecast_id" text NOT NULL,
	"url_id" text NOT NULL,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledge_note" text,
	"last_reminder_at" timestamp with time zone,
	"last_reminder_days" integer,
	"reminders_muted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_impact_views" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"impact_analysis_id" text NOT NULL,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text DEFAULT 'active',
	"current_period_end" timestamp with time zone,
	"email_verified" boolean DEFAULT false NOT NULL,
	"login_failures" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"timezone" text DEFAULT 'UTC',
	"notification_defaults" jsonb DEFAULT '{}'::jsonb,
	"onboarding_step" integer DEFAULT 0,
	"last_dashboard_visit_at" timestamp with time zone,
	"email_preferences" jsonb DEFAULT '{"onboarding":true,"weekly_report":true,"product_updates":true}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "users_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status_code" integer,
	"response_body" text,
	"error" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"url" text NOT NULL,
	"name" text DEFAULT 'Default Webhook',
	"signing_secret" text NOT NULL,
	"events" text[] DEFAULT '{change.confirmed}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_failure_reason" text,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_dependencies" ADD CONSTRAINT "api_dependencies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_dependencies" ADD CONSTRAINT "api_dependencies_url_id_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_dependencies" ADD CONSTRAINT "api_dependencies_depends_on_url_id_urls_id_fk" FOREIGN KEY ("depends_on_url_id") REFERENCES "public"."urls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_shared_url_id_shared_urls_id_fk" FOREIGN KEY ("shared_url_id") REFERENCES "public"."shared_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_shared_url_id_shared_urls_id_fk" FOREIGN KEY ("shared_url_id") REFERENCES "public"."shared_urls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_url_id_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."urls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_shared_url_id_shared_urls_id_fk" FOREIGN KEY ("shared_url_id") REFERENCES "public"."shared_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forecasts" ADD CONSTRAINT "forecasts_change_id_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."changes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_issues" ADD CONSTRAINT "github_issues_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_issues" ADD CONSTRAINT "github_issues_change_id_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_change_id_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_oauth_token_id_oauth_tokens_id_fk" FOREIGN KEY ("oauth_token_id") REFERENCES "public"."oauth_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_samples" ADD CONSTRAINT "learning_samples_shared_url_id_shared_urls_id_fk" FOREIGN KEY ("shared_url_id") REFERENCES "public"."shared_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_checklists" ADD CONSTRAINT "migration_checklists_change_id_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_checklists" ADD CONSTRAINT "migration_checklists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_packages" ADD CONSTRAINT "monitored_packages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_rules" ADD CONSTRAINT "notification_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_change_id_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."changes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "package_versions" ADD CONSTRAINT "package_versions_shared_url_id_shared_urls_id_fk" FOREIGN KEY ("shared_url_id") REFERENCES "public"."shared_urls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_sources" ADD CONSTRAINT "shared_sources_discovered_by_users_id_fk" FOREIGN KEY ("discovered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_matches" ADD CONSTRAINT "signal_matches_signal_id_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_matches" ADD CONSTRAINT "signal_matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_matches" ADD CONSTRAINT "signal_matches_url_id_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_shared_source_id_shared_sources_id_fk" FOREIGN KEY ("shared_source_id") REFERENCES "public"."shared_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_url_id_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."urls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_alert_preferences" ADD CONSTRAINT "source_alert_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spec_snapshots" ADD CONSTRAINT "spec_snapshots_shared_url_id_shared_urls_id_fk" FOREIGN KEY ("shared_url_id") REFERENCES "public"."shared_urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_change_id_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "url_secrets" ADD CONSTRAINT "url_secrets_url_id_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "url_secrets" ADD CONSTRAINT "url_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urls" ADD CONSTRAINT "urls_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "urls" ADD CONSTRAINT "urls_shared_url_id_shared_urls_id_fk" FOREIGN KEY ("shared_url_id") REFERENCES "public"."shared_urls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_api_context" ADD CONSTRAINT "user_api_context_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_api_context" ADD CONSTRAINT "user_api_context_url_id_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_changes" ADD CONSTRAINT "user_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_changes" ADD CONSTRAINT "user_changes_change_id_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_changes" ADD CONSTRAINT "user_changes_url_id_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_forecasts" ADD CONSTRAINT "user_forecasts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_forecasts" ADD CONSTRAINT "user_forecasts_forecast_id_forecasts_id_fk" FOREIGN KEY ("forecast_id") REFERENCES "public"."forecasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_forecasts" ADD CONSTRAINT "user_forecasts_url_id_urls_id_fk" FOREIGN KEY ("url_id") REFERENCES "public"."urls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_impact_views" ADD CONSTRAINT "user_impact_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_impact_views" ADD CONSTRAINT "user_impact_views_impact_analysis_id_impact_analyses_id_fk" FOREIGN KEY ("impact_analysis_id") REFERENCES "public"."impact_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_changes_shared_url" ON "changes" USING btree ("shared_url_id","detected_at");--> statement-breakpoint
CREATE INDEX "idx_changes_severity" ON "changes" USING btree ("severity","detected_at");--> statement-breakpoint
CREATE INDEX "idx_discovery_results_domain" ON "discovery_results" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_domain_patterns_domain" ON "domain_patterns" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_feedback_user" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_status" ON "feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_forecasts_shared_url" ON "forecasts" USING btree ("shared_url_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_forecasts_status" ON "forecasts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_forecasts_deadline" ON "forecasts" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "idx_forecasts_signal_type" ON "forecasts" USING btree ("signal_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "github_issues_change_repo_unique" ON "github_issues" USING btree ("change_id","repo");--> statement-breakpoint
CREATE INDEX "idx_header_snapshots_url" ON "header_snapshots" USING btree ("shared_url_id","captured_at");--> statement-breakpoint
CREATE INDEX "idx_header_snapshots_sunset" ON "header_snapshots" USING btree ("shared_url_id");--> statement-breakpoint
CREATE INDEX "idx_header_snapshots_deprecation" ON "header_snapshots" USING btree ("shared_url_id");--> statement-breakpoint
CREATE INDEX "idx_header_snapshots_version" ON "header_snapshots" USING btree ("shared_url_id","api_version");--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_user_provider_unique" ON "integrations" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "idx_learning_samples_url" ON "learning_samples" USING btree ("shared_url_id","sampled_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_change" ON "notifications" USING btree ("change_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_feedback" ON "notifications" USING btree ("feedback_token");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_tokens_user_provider_unique" ON "oauth_tokens" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "package_versions_name_registry_unique" ON "package_versions" USING btree ("package_name","registry");--> statement-breakpoint
CREATE INDEX "idx_package_versions_url" ON "package_versions" USING btree ("shared_url_id");--> statement-breakpoint
CREATE INDEX "idx_package_versions_check" ON "package_versions" USING btree ("last_checked_at");--> statement-breakpoint
CREATE INDEX "idx_provider_events_domain" ON "provider_events" USING btree ("domain","created_at");--> statement-breakpoint
CREATE INDEX "idx_shared_sources_domain" ON "shared_sources" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_shared_sources_schedule" ON "shared_sources" USING btree ("next_check_at");--> statement-breakpoint
CREATE UNIQUE INDEX "signal_matches_unique" ON "signal_matches" USING btree ("signal_id","user_id","url_id");--> statement-breakpoint
CREATE INDEX "idx_signal_matches_user" ON "signal_matches" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_signal_matches_signal" ON "signal_matches" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "idx_signals_domain" ON "signals" USING btree ("domain","created_at");--> statement-breakpoint
CREATE INDEX "idx_signals_correlation" ON "signals" USING btree ("correlation_key");--> statement-breakpoint
CREATE INDEX "idx_signals_status" ON "signals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "sap_user_source_unique" ON "source_alert_preferences" USING btree ("user_id","source_id");--> statement-breakpoint
CREATE INDEX "idx_sap_user_id" ON "source_alert_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sap_source_id" ON "source_alert_preferences" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_spec_snapshots_url" ON "spec_snapshots" USING btree ("shared_url_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_change_integration_unique" ON "tickets" USING btree ("change_id","integration_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_change" ON "tickets" USING btree ("change_id");--> statement-breakpoint
CREATE INDEX "idx_tickets_user" ON "tickets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "url_secrets_url_header_unique" ON "url_secrets" USING btree ("url_id","header_name");--> statement-breakpoint
CREATE INDEX "idx_url_secrets_url" ON "url_secrets" USING btree ("url_id");--> statement-breakpoint
CREATE UNIQUE INDEX "urls_user_url_hash_unique" ON "urls" USING btree ("user_id","url_hash");--> statement-breakpoint
CREATE INDEX "idx_urls_user" ON "urls" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_urls_next_check" ON "urls" USING btree ("next_check_at");--> statement-breakpoint
CREATE INDEX "idx_urls_domain_path" ON "urls" USING btree ("parsed_domain","parsed_path");--> statement-breakpoint
CREATE INDEX "idx_urls_domain_active" ON "urls" USING btree ("parsed_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "user_changes_user_change_unique" ON "user_changes" USING btree ("user_id","change_id");--> statement-breakpoint
CREATE INDEX "idx_user_changes_user" ON "user_changes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_changes_unacked" ON "user_changes" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_forecasts_user_forecast_unique" ON "user_forecasts" USING btree ("user_id","forecast_id");--> statement-breakpoint
CREATE INDEX "idx_user_forecasts_user" ON "user_forecasts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_user_forecasts_unacked" ON "user_forecasts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_deliveries_webhook" ON "webhook_deliveries" USING btree ("webhook_id","delivered_at");--> statement-breakpoint
CREATE INDEX "idx_webhooks_user" ON "webhooks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_webhooks_active" ON "webhooks" USING btree ("user_id");