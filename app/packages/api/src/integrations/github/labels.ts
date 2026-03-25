import type { Octokit } from '@octokit/rest';

export interface LabelDef {
  name: string;
  color: string;
  description: string;
}

export const CHIRRI_LABELS: LabelDef[] = [
  { name: 'chirri', color: 'FFB7C5', description: 'Created by Chirri' },
  { name: 'api-change', color: '1D76DB', description: 'API change detected' },
  { name: 'breaking-change', color: 'B60205', description: 'Breaking API change' },
  { name: 'deprecation', color: 'FBCA04', description: 'API deprecation notice' },
  { name: 'security', color: 'D93F0B', description: 'Security-related change' },
  { name: 'migration', color: '0E8A16', description: 'Migration required' },
];

export const SEVERITY_LABELS: Record<string, LabelDef> = {
  critical: { name: 'severity: critical', color: 'B60205', description: 'Critical severity' },
  high: { name: 'severity: high', color: 'D93F0B', description: 'High severity' },
  medium: { name: 'severity: medium', color: 'FBCA04', description: 'Medium severity' },
  low: { name: 'severity: low', color: '0E8A16', description: 'Low severity' },
};

/**
 * Ensure Chirri labels exist in a repo. Creates missing ones, ignores existing.
 */
export async function ensureLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  labels: LabelDef[],
): Promise<void> {
  for (const label of labels) {
    try {
      await (octokit as any).rest.issues.createLabel({
        owner,
        repo,
        name: label.name,
        color: label.color,
        description: label.description,
      });
    } catch (err: any) {
      // 422 = label already exists, that's fine
      if (err.status !== 422) throw err;
    }
  }
}
