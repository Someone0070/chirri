/**
 * MCP Impact Analyzer
 *
 * Classifies change severity for notifications and generates
 * human-readable impact reports.
 *
 * Severity rules:
 * - CRITICAL: any breaking change (tool removed, required param added, type changed)
 * - HIGH: many tools modified (>5)
 * - MEDIUM: tools added (informational)
 * - LOW: only description or optional param changes
 */

import type { McpDiffResult } from './types.js';

/**
 * Classify overall change severity for notification routing.
 */
export function classifyChangeSeverity(
  diff: McpDiffResult,
): 'critical' | 'high' | 'medium' | 'low' {
  if (diff.breakingChanges > 0) {
    return 'critical';
  }

  if (diff.removedTools.length > 0) {
    // Should already be marked breaking, but double-check
    return 'critical';
  }

  if (diff.modifiedTools.length > 5) {
    return 'high';
  }

  if (diff.addedTools.length > 0) {
    return 'medium';
  }

  // Only description changes
  return 'low';
}

/**
 * Generate a human-readable impact report for notifications.
 */
export function generateImpactReport(diff: McpDiffResult): string {
  const lines: string[] = [];

  lines.push(`## MCP Server Change Detected\n`);
  lines.push(`**Summary:** ${diff.summary}\n`);

  if (diff.breakingChanges > 0) {
    lines.push(`⚠️ **BREAKING CHANGES: ${diff.breakingChanges}**\n`);
  }

  // Breaking changes first
  const breaking = diff.changes.filter((c) => c.severity === 'breaking');
  if (breaking.length > 0) {
    lines.push(`### Breaking Changes\n`);
    for (const change of breaking) {
      lines.push(`- **${change.toolName}**: ${change.details}`);
      if (change.schemaPath) {
        lines.push(`  - Path: \`${change.schemaPath}\``);
      }
    }
    lines.push('');
  }

  // Added tools
  if (diff.addedTools.length > 0) {
    lines.push(`### Tools Added (${diff.addedTools.length})\n`);
    for (const tool of diff.addedTools) {
      lines.push(`- \`${tool}\``);
    }
    lines.push('');
  }

  // Removed tools
  if (diff.removedTools.length > 0) {
    lines.push(`### Tools Removed (${diff.removedTools.length})\n`);
    for (const tool of diff.removedTools) {
      lines.push(`- \`${tool}\``);
    }
    lines.push('');
  }

  // Non-breaking modifications
  const nonBreaking = diff.changes.filter(
    (c) => c.severity === 'non-breaking',
  );
  if (nonBreaking.length > 0) {
    lines.push(`### Non-Breaking Changes (${nonBreaking.length})\n`);
    for (const change of nonBreaking) {
      lines.push(`- **${change.toolName}**: ${change.details}`);
    }
    lines.push('');
  }

  lines.push(`### Action Required\n`);
  if (diff.breakingChanges > 0) {
    lines.push(
      `- Review your integrations that use the modified tools`,
    );
    lines.push(`- Update your code to handle schema changes`);
    lines.push(`- Test thoroughly before deploying`);
  } else {
    lines.push(`- Review changes for informational purposes`);
    lines.push(`- No immediate action required`);
  }

  return lines.join('\n');
}
