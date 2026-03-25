import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { db, schema, githubIssueId, buildIssueBody, buildIssueTitle } from '@chirri/shared';
import { eq, and } from 'drizzle-orm';
import { getInstallationOctokit } from '../integrations/github/app.js';
import { ensureLabels, CHIRRI_LABELS, SEVERITY_LABELS } from '../integrations/github/labels.js';
import { z } from 'zod';

const { githubConnections, githubIssues, changes, impactAnalyses, migrationChecklists } = schema;

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  stripeCustomerId: string | null;
};

type Variables = { user: AuthUser };

const githubIssuesRoute = new Hono<{ Variables: Variables }>();

const createIssueSchema = z.object({
  repo: z.string().regex(/^[^/]+\/[^/]+$/, 'Must be owner/repo format'),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
});

/**
 * POST /api/v1/changes/:changeId/github-issue — create a GitHub issue from a change
 */
githubIssuesRoute.post('/:changeId/github-issue', requireAuth, async (c) => {
  const user = c.get('user');
  const changeId = c.req.param('changeId')!;

  // Parse body
  const rawBody = await c.req.json();
  const parsed = createIssueSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'invalid_input',
          message: 'Invalid request body',
          status: 422,
          details: parsed.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      422,
    );
  }

  const { repo, labels: extraLabels, assignees } = parsed.data;
  const [owner, repoName] = repo.split('/');

  // Check user has GitHub connected
  const connections = await db
    .select()
    .from(githubConnections)
    .where(eq(githubConnections.userId, user.id))
    .limit(1);

  if (connections.length === 0) {
    return c.json(
      { error: { code: 'not_found', message: 'No GitHub connection. Install the Chirri GitHub App first.', status: 404 } },
      404,
    );
  }

  // Check for duplicate (same change + same repo)
  const existingIssue = await db
    .select()
    .from(githubIssues)
    .where(and(eq(githubIssues.changeId, changeId), eq(githubIssues.repo, repo)))
    .limit(1);

  if (existingIssue.length > 0) {
    return c.json({
      issue_url: existingIssue[0].issueUrl,
      issue_number: existingIssue[0].issueNumber,
      already_existed: true,
    });
  }

  // Get the change
  const changeRows = await db
    .select()
    .from(changes)
    .where(eq(changes.id, changeId))
    .limit(1);

  if (changeRows.length === 0) {
    return c.json(
      { error: { code: 'not_found', message: 'Change not found', status: 404 } },
      404,
    );
  }

  const change = changeRows[0];

  // Get optional impact analysis and migration checklist
  const [impactRows, migrationRows] = await Promise.all([
    db
      .select()
      .from(impactAnalyses)
      .where(eq(impactAnalyses.changeId, changeId))
      .limit(1),
    db
      .select()
      .from(migrationChecklists)
      .where(
        and(
          eq(migrationChecklists.changeId, changeId),
          eq(migrationChecklists.userId, user.id),
        ),
      )
      .limit(1),
  ]);

  const impactAnalysis = impactRows.length > 0
    ? (impactRows[0] as any)
    : null;
  const migrationChecklist = migrationRows.length > 0
    ? (migrationRows[0] as any)
    : null;

  const dashboardUrl = process.env.DASHBOARD_ORIGIN || 'https://chirri.io';

  // Build issue content
  const title = buildIssueTitle({
    id: change.id,
    changeType: change.changeType,
    severity: change.severity,
    summary: change.summary,
    diff: change.diff,
    previousStatusCode: change.previousStatusCode,
    currentStatusCode: change.currentStatusCode,
    detectedAt: change.detectedAt,
  });

  const body = buildIssueBody(
    {
      id: change.id,
      changeType: change.changeType,
      severity: change.severity,
      summary: change.summary,
      diff: change.diff,
      previousStatusCode: change.previousStatusCode,
      currentStatusCode: change.currentStatusCode,
      detectedAt: change.detectedAt,
    },
    dashboardUrl,
    impactAnalysis,
    migrationChecklist,
  );

  // Build labels
  const issueLabels = ['chirri', 'api-change'];
  const severityLabel = SEVERITY_LABELS[change.severity];
  if (severityLabel) issueLabels.push(severityLabel.name);
  if (change.changeType === 'schema' || change.changeType === 'status_code') {
    issueLabels.push('breaking-change');
  }
  if (extraLabels) issueLabels.push(...extraLabels);

  try {
    const octokit = await getInstallationOctokit(Number(connections[0].installationId));

    // Ensure Chirri labels exist in repo
    const labelsToEnsure = [
      ...CHIRRI_LABELS,
      ...(severityLabel ? [severityLabel] : []),
    ];
    await ensureLabels(octokit as any, owner, repoName, labelsToEnsure);

    // Create issue
    const { data: issue } = await (octokit as any).rest.issues.create({
      owner,
      repo: repoName,
      title,
      body,
      labels: issueLabels,
      assignees: assignees || [],
    });

    // Store in DB
    await db.insert(githubIssues).values({
      id: githubIssueId(),
      userId: user.id,
      changeId,
      repo,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    });

    return c.json(
      {
        issue_url: issue.html_url,
        issue_number: issue.number,
        already_existed: false,
      },
      201,
    );
  } catch (err: any) {
    console.error('GitHub issue creation error:', err);
    return c.json(
      {
        error: {
          code: 'github_error',
          message: err.message || 'Failed to create GitHub issue',
          status: 502,
        },
      },
      502,
    );
  }
});

export { githubIssuesRoute };
