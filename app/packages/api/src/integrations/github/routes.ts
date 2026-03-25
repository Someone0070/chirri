import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth.js';
import { db, schema, githubConnectionId } from '@chirri/shared';
import { eq } from 'drizzle-orm';
import { getGitHubApp, getInstallationOctokit } from './app.js';

const { githubConnections } = schema;

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  stripeCustomerId: string | null;
};

type Variables = { user: AuthUser };

const github = new Hono<{ Variables: Variables }>();

/**
 * GET /install — redirect user to GitHub App installation page
 */
github.get('/install', requireAuth, async (c) => {
  const user = c.get('user');
  const app = getGitHubApp();
  if (!app) {
    return c.json(
      { error: { code: 'not_configured', message: 'GitHub integration is not configured', status: 503 } },
      503,
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  // state = user ID for the callback to know who installed
  const state = user.id;
  const installUrl = `https://github.com/apps/${process.env.GITHUB_APP_SLUG || 'chirri'}/installations/new?state=${encodeURIComponent(state)}`;

  return c.redirect(installUrl);
});

/**
 * GET /callback — GitHub App installation callback
 * Receives: installation_id, setup_action, state (user ID)
 */
github.get('/callback', async (c) => {
  const installationId = c.req.query('installation_id');
  const setupAction = c.req.query('setup_action');
  const state = c.req.query('state'); // user ID

  if (!installationId || !state) {
    return c.redirect(
      `${process.env.DASHBOARD_ORIGIN || 'http://localhost:5173'}/settings?github=error&reason=missing_params`,
    );
  }

  try {
    // Get installation details to store account info
    const app = getGitHubApp();
    if (!app) {
      return c.redirect(
        `${process.env.DASHBOARD_ORIGIN || 'http://localhost:5173'}/settings?github=error&reason=not_configured`,
      );
    }

    let accountLogin: string | null = null;
    let accountType: string | null = null;

    try {
      const octokit = await getInstallationOctokit(Number(installationId));
      const { data: installation } = await (octokit as any).rest.apps.getInstallation({
        installation_id: Number(installationId),
      });
      accountLogin = installation.account?.login ?? null;
      accountType = installation.account?.type ?? null;
    } catch {
      // Non-fatal: we can still store the connection without account info
    }

    // Check for existing connection for this user
    const existing = await db
      .select()
      .from(githubConnections)
      .where(eq(githubConnections.userId, state))
      .limit(1);

    if (existing.length > 0) {
      // Update existing connection
      await db
        .update(githubConnections)
        .set({
          installationId: installationId,
          accountLogin,
          accountType,
          updatedAt: new Date(),
        })
        .where(eq(githubConnections.userId, state));
    } else {
      // Create new connection
      await db.insert(githubConnections).values({
        id: githubConnectionId(),
        userId: state,
        installationId: installationId,
        accountLogin,
        accountType,
      });
    }

    return c.redirect(
      `${process.env.DASHBOARD_ORIGIN || 'http://localhost:5173'}/settings?github=connected`,
    );
  } catch (err: any) {
    console.error('GitHub callback error:', err);
    return c.redirect(
      `${process.env.DASHBOARD_ORIGIN || 'http://localhost:5173'}/settings?github=error&reason=callback_failed`,
    );
  }
});

/**
 * GET / — get GitHub connection status
 */
github.get('/', requireAuth, async (c) => {
  const user = c.get('user');

  const connections = await db
    .select()
    .from(githubConnections)
    .where(eq(githubConnections.userId, user.id))
    .limit(1);

  if (connections.length === 0) {
    return c.json({
      connected: false,
      installation_id: null,
      account_login: null,
      account_type: null,
      default_repo: null,
      connected_at: null,
    });
  }

  const conn = connections[0];
  return c.json({
    connected: true,
    installation_id: conn.installationId,
    account_login: conn.accountLogin,
    account_type: conn.accountType,
    default_repo: conn.defaultRepo,
    default_labels: conn.defaultLabels,
    default_assignee: conn.defaultAssignee,
    connected_at: conn.createdAt.toISOString(),
  });
});

/**
 * PATCH / — update default settings
 */
github.patch('/', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  const connection = await db
    .select()
    .from(githubConnections)
    .where(eq(githubConnections.userId, user.id))
    .limit(1);

  if (connection.length === 0) {
    return c.json(
      { error: { code: 'not_found', message: 'No GitHub connection found', status: 404 } },
      404,
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.default_repo !== undefined) updates.defaultRepo = body.default_repo;
  if (body.default_labels !== undefined) updates.defaultLabels = body.default_labels;
  if (body.default_assignee !== undefined) updates.defaultAssignee = body.default_assignee;

  await db
    .update(githubConnections)
    .set(updates)
    .where(eq(githubConnections.userId, user.id));

  return c.json({ success: true });
});

/**
 * DELETE / — disconnect GitHub (removes connection from DB, doesn't uninstall the App)
 */
github.delete('/', requireAuth, async (c) => {
  const user = c.get('user');

  await db
    .delete(githubConnections)
    .where(eq(githubConnections.userId, user.id));

  return c.json({ success: true });
});

/**
 * GET /repos — list repos accessible to the installation
 */
github.get('/repos', requireAuth, async (c) => {
  const user = c.get('user');

  const connections = await db
    .select()
    .from(githubConnections)
    .where(eq(githubConnections.userId, user.id))
    .limit(1);

  if (connections.length === 0) {
    return c.json(
      { error: { code: 'not_found', message: 'No GitHub connection found', status: 404 } },
      404,
    );
  }

  try {
    const octokit = await getInstallationOctokit(Number(connections[0].installationId));
    const { data } = await (octokit as any).rest.apps.listReposAccessibleToInstallation({
      per_page: 100,
    });

    const repos = data.repositories.map((r: any) => ({
      full_name: r.full_name,
      name: r.name,
      owner: r.owner.login,
      private: r.private,
      default_branch: r.default_branch,
    }));

    return c.json({ data: repos });
  } catch (err: any) {
    console.error('GitHub list repos error:', err);
    return c.json(
      { error: { code: 'github_error', message: 'Failed to fetch repos from GitHub', status: 502 } },
      502,
    );
  }
});

export { github as githubRoutes };
