/**
 * 20 target URLs for the training set
 */
export const TARGET_URLS: { url: string; category: string; name: string }[] = [
  // 5 Big APIs
  { url: 'docs.stripe.com/api/charges', category: 'big', name: 'Stripe Charges' },
  { url: 'docs.github.com/en/rest/repos', category: 'big', name: 'GitHub Repos' },
  { url: 'docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html', category: 'big', name: 'AWS S3 API' },
  { url: 'developers.cloudflare.com/api', category: 'big', name: 'Cloudflare API' },
  { url: 'cloud.google.com/storage/docs/json_api', category: 'big', name: 'GCS JSON API' },

  // 5 Mid APIs
  { url: 'docs.sendgrid.com/api-reference/mail-send/mail-send', category: 'mid', name: 'SendGrid Mail' },
  { url: 'www.twilio.com/docs/messaging/api/message-resource', category: 'mid', name: 'Twilio Messages' },
  { url: 'plaid.com/docs/api/transactions', category: 'mid', name: 'Plaid Transactions' },
  { url: 'docs.sentry.io/api', category: 'mid', name: 'Sentry API' },
  { url: 'docs.datadog.com/api/latest', category: 'mid', name: 'Datadog API' },

  // 5 Small APIs
  { url: 'docs.lemonsqueezy.com/api', category: 'small', name: 'LemonSqueezy' },
  { url: 'docs.buttondown.com/api-introduction', category: 'small', name: 'Buttondown' },
  { url: 'docs.cal.com/api-reference', category: 'small', name: 'Cal.com' },
  { url: 'docs.render.com/api', category: 'small', name: 'Render' },
  { url: 'docs.tinybird.co', category: 'small', name: 'Tinybird' },

  // 5 Ultra-Small APIs
  { url: 'docs.supersaas.com', category: 'ultra-small', name: 'SuperSaaS' },
  { url: 'docs.brieflyai.com', category: 'ultra-small', name: 'BrieflyAI' },
  { url: 'api.checklyhq.com/docs', category: 'ultra-small', name: 'Checkly' },
  { url: 'docs.posthog.com/api', category: 'ultra-small', name: 'PostHog' },
  { url: 'docs.hookdeck.com', category: 'ultra-small', name: 'Hookdeck' },
];
