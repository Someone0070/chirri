interface ChangeData {
  id: string;
  changeType: string;
  severity: string;
  summary: string;
  diff: unknown;
  previousStatusCode?: number | null;
  currentStatusCode?: number | null;
  detectedAt: string | Date;
}

interface ImpactAnalysis {
  analysis: {
    summary?: string;
    affectedAreas?: string[];
    recommendations?: string[];
  };
}

interface MigrationChecklist {
  steps: Array<{
    description: string;
    completed?: boolean;
  }>;
}

const SEVERITY_BADGES: Record<string, string> = {
  critical: '🔴 Critical',
  high: '🟠 High',
  medium: '🟡 Medium',
  low: '🟢 Low',
};

function formatDiff(diff: unknown): string {
  if (!diff) return '_No diff available_';

  const diffStr = typeof diff === 'string' ? diff : JSON.stringify(diff, null, 2);
  // Truncate to first ~80 lines for readability
  const lines = diffStr.split('\n');
  const truncated = lines.slice(0, 80).join('\n');
  const suffix = lines.length > 80 ? `\n... (${lines.length - 80} more lines)` : '';

  return '```diff\n' + truncated + suffix + '\n```';
}

/**
 * Build a GitHub issue body from a Chirri change.
 */
export function buildIssueBody(
  change: ChangeData,
  dashboardUrl?: string,
  impactAnalysis?: ImpactAnalysis | null,
  migrationChecklist?: MigrationChecklist | null,
): string {
  const badge = SEVERITY_BADGES[change.severity] || `⚪ ${change.severity}`;
  const detectedDate =
    change.detectedAt instanceof Date
      ? change.detectedAt.toISOString()
      : change.detectedAt;

  const sections: string[] = [];

  // Header
  sections.push(`> **Severity:** ${badge} · **Type:** \`${change.changeType}\` · **Detected:** ${detectedDate}`);
  sections.push('');
  sections.push('---');

  // What Changed
  sections.push('');
  sections.push('## What Changed');
  sections.push('');
  sections.push(change.summary);

  if (change.previousStatusCode != null && change.currentStatusCode != null) {
    sections.push('');
    sections.push(`**Status code:** \`${change.previousStatusCode}\` → \`${change.currentStatusCode}\``);
  }

  // Diff
  sections.push('');
  sections.push('## Diff Preview');
  sections.push('');
  sections.push(formatDiff(change.diff));

  // Impact Analysis
  if (impactAnalysis?.analysis) {
    const { summary, affectedAreas, recommendations } = impactAnalysis.analysis;
    sections.push('');
    sections.push('## Impact Analysis');
    sections.push('');

    if (summary) {
      sections.push(summary);
      sections.push('');
    }

    if (affectedAreas && affectedAreas.length > 0) {
      sections.push('**Affected areas:**');
      for (const area of affectedAreas) {
        sections.push(`- ${area}`);
      }
      sections.push('');
    }

    if (recommendations && recommendations.length > 0) {
      sections.push('**Recommendations:**');
      for (const rec of recommendations) {
        sections.push(`- ${rec}`);
      }
      sections.push('');
    }
  }

  // Migration Checklist
  if (migrationChecklist?.steps && migrationChecklist.steps.length > 0) {
    sections.push('');
    sections.push('## Migration Steps');
    sections.push('');
    for (const step of migrationChecklist.steps) {
      const checkbox = step.completed ? '[x]' : '[ ]';
      sections.push(`- ${checkbox} ${step.description}`);
    }
    sections.push('');
  }

  // Footer
  sections.push('');
  sections.push('---');
  sections.push('');

  if (dashboardUrl) {
    sections.push(`🔗 [View in Chirri Dashboard](${dashboardUrl}/changes/${change.id})`);
    sections.push('');
  }

  sections.push('_This issue was created automatically by [Chirri](https://chirri.io) — API change monitoring._');

  return sections.join('\n');
}

/**
 * Build issue title from change data.
 */
export function buildIssueTitle(change: ChangeData): string {
  const badge = SEVERITY_BADGES[change.severity] || '';
  const typeLabel = change.changeType.replace(/_/g, ' ');
  // Keep title under ~100 chars
  const summaryShort =
    change.summary.length > 80
      ? change.summary.slice(0, 77) + '...'
      : change.summary;
  return `${badge} [${typeLabel}] ${summaryShort}`;
}
