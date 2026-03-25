import { App } from '@octokit/app';

const appId = process.env.GITHUB_APP_ID;
const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;

let githubApp: App | null = null;

/**
 * Get the GitHub App singleton. Returns null if not configured.
 */
export function getGitHubApp(): App | null {
  if (githubApp) return githubApp;
  if (!appId || !privateKey || !clientId || !clientSecret) return null;

  githubApp = new App({
    appId,
    privateKey,
    oauth: { clientId, clientSecret },
  });

  return githubApp;
}

/**
 * Get an authenticated Octokit instance for a specific installation.
 * Installation tokens are auto-cached and refreshed by @octokit/app.
 */
export async function getInstallationOctokit(installationId: number): Promise<any> {
  const app = getGitHubApp();
  if (!app) {
    throw new Error('GitHub App not configured');
  }
  return app.getInstallationOctokit(installationId);
}
