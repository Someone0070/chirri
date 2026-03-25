import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { corsMiddleware } from './middleware/cors.js';
import { loginRateLimit, signupRateLimit } from './middleware/rate-limit.js';
import { healthRoute } from './routes/health.js';
import { authRoute } from './routes/auth.js';
import { apiKeysRoute } from './routes/api-keys.js';
import { notificationsRoute } from './routes/notifications.js';
import { webhooksRoute } from './routes/webhooks.js';
import { urlsRoute } from './routes/urls.js';
import { billingRoute } from './routes/billing.js';
import { stripeWebhookRoute } from './routes/stripe-webhook.js';
import { githubRoutes } from './integrations/github/routes.js';
import { githubIssuesRoute } from './routes/github-issues.js';

export const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', corsMiddleware);

// Rate limiting for auth endpoints
app.use('/api/auth/sign-in/*', loginRateLimit);
app.use('/api/auth/sign-up/*', signupRateLimit);

// Stripe webhook — MUST be mounted before any global JSON body parsing middleware
// Needs raw body for signature verification
app.route('/api/webhooks/stripe', stripeWebhookRoute);

// Routes
app.route('/', healthRoute);
app.route('/', authRoute);
app.route('/api/v1/api-keys', apiKeysRoute);
app.route('/api/v1/urls', urlsRoute);
app.route('/api/v1/billing', billingRoute);
app.route('/api/v1/notifications', notificationsRoute);
app.route('/api/v1/webhooks', webhooksRoute);

// GitHub integration
app.route('/api/v1/integrations/github', githubRoutes);
app.route('/api/v1/changes', githubIssuesRoute);

// Route stubs for future items
app.get('/v1/changes', (c) => c.json({ data: [], cursor: null }));
app.get('/v1/forecasts', (c) => c.json({ data: [], cursor: null }));
