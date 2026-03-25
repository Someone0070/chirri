/**
 * Diff strategies - compare snapshots using different approaches
 *
 * Strategy selection (tuned from Wayback historical data analysis):
 * - readability: PRIMARY strategy for HTML pages (near-zero noise)
 * - text_only: SECONDARY/fallback (catches changes readability misses)
 * - raw_html: DIAGNOSTIC only, never triggers notifications
 * - structural: DIAGNOSTIC only
 *
 * A change is reported if:
 *   1. readability detects a change with diffSize > 2, OR
 *   2. text_only detects a change with noise < 0.3 AND diffSize >= 2
 *
 * This achieves ~0% FP rate (down from 29.4%) with minimal missed real changes.
 */

import { createPatch } from 'diff';
import { normalizeHtml, normalizeText } from './normalizer.js';

export type DiffStrategy = 'readability' | 'text_only' | 'raw_html' | 'structural';

export interface DiffResult {
  strategy: string;
  changed: boolean;
  diffSize: number;       // number of changed lines
  totalLines: number;     // total lines in the content
  noiseEstimate: number;  // 0-1 estimate of how "noisy" the diff is
  patch: string;          // unified diff output (truncated for reports)
  addedLines: number;
  removedLines: number;
  /** Whether this strategy's change should trigger a notification */
  reportable: boolean;
  /** Why this result is/isn't reportable */
  reportReason?: string;
}

/**
 * Count diff stats from a unified patch
 */
function analyzePatch(patch: string): { addedLines: number; removedLines: number; totalChangedLines: number } {
  const lines = patch.split('\n');
  let addedLines = 0;
  let removedLines = 0;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) addedLines++;
    if (line.startsWith('-') && !line.startsWith('---')) removedLines++;
  }

  return { addedLines, removedLines, totalChangedLines: addedLines + removedLines };
}

/**
 * Estimate noise level of a diff (0 = all signal, 1 = all noise)
 * Heuristic based on diff characteristics
 */
function estimateNoise(patch: string, _strategy: string): number {
  if (!patch || patch.trim() === '') return 0;

  const lines = patch.split('\n');
  let noiseLines = 0;
  let totalDiffLines = 0;

  const noisePatterns = [
    /\[TIMESTAMP\]/,
    /\[DATE\]/,
    /\[UNIX_TS\]/,
    /\[RELATIVE_TIME\]/,
    /\[LAST_UPDATED\]/,
    /^\s*$/,              // whitespace-only changes
    /^\s*[+-]\s*$/,       // empty diff lines
  ];

  for (const line of lines) {
    if ((line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---'))) {
      totalDiffLines++;
      for (const pattern of noisePatterns) {
        if (pattern.test(line)) {
          noiseLines++;
          break;
        }
      }
    }
  }

  if (totalDiffLines === 0) return 0;
  return noiseLines / totalDiffLines;
}

/**
 * Strategy 1: Raw HTML diff (with normalization)
 * DIAGNOSTIC ONLY - never triggers notifications
 */
export function diffRawHtml(before: string, after: string): DiffResult {
  const normBefore = normalizeHtml(before);
  const normAfter = normalizeHtml(after);

  const patch = createPatch('page.html', normBefore, normAfter, '', '', { context: 3 });
  const stats = analyzePatch(patch);
  const totalLines = normAfter.split('\n').length;

  return {
    strategy: 'raw_html',
    changed: stats.totalChangedLines > 0,
    diffSize: stats.totalChangedLines,
    totalLines,
    noiseEstimate: estimateNoise(patch, 'raw_html'),
    patch: patch.length > 5000 ? patch.substring(0, 5000) + '\n... [truncated]' : patch,
    addedLines: stats.addedLines,
    removedLines: stats.removedLines,
    reportable: false,
    reportReason: 'raw_html is diagnostic only (too noisy for notifications)',
  };
}

/**
 * Strategy 2: Readability-extracted text diff
 * PRIMARY strategy - near-zero noise from Wayback analysis
 */
export function diffReadability(before: string, after: string): DiffResult {
  const normBefore = normalizeText(before);
  const normAfter = normalizeText(after);

  const patch = createPatch('readability.txt', normBefore, normAfter, '', '', { context: 3 });
  const stats = analyzePatch(patch);
  const totalLines = normAfter.split('\n').length;
  const noise = estimateNoise(patch, 'readability');

  // Reportable: changed AND diffSize > 2 (filters single-line nav/sidebar noise)
  const reportable = stats.totalChangedLines > 2;
  let reportReason: string | undefined;
  if (!reportable && stats.totalChangedLines > 0) {
    reportReason = `readability change too small (diffSize=${stats.totalChangedLines} <= 2, likely nav/sidebar noise)`;
  } else if (reportable) {
    reportReason = 'readability primary: significant content change detected';
  }

  return {
    strategy: 'readability',
    changed: stats.totalChangedLines > 0,
    diffSize: stats.totalChangedLines,
    totalLines,
    noiseEstimate: noise,
    patch: patch.length > 5000 ? patch.substring(0, 5000) + '\n... [truncated]' : patch,
    addedLines: stats.addedLines,
    removedLines: stats.removedLines,
    reportable,
    reportReason,
  };
}

/**
 * Strategy 3: Structural DOM diff
 * DIAGNOSTIC ONLY
 */
export function diffStructural(before: string, after: string): DiffResult {
  const normBefore = normalizeText(before);
  const normAfter = normalizeText(after);

  const patch = createPatch('structure.dom', normBefore, normAfter, '', '', { context: 3 });
  const stats = analyzePatch(patch);
  const totalLines = normAfter.split('\n').length;

  return {
    strategy: 'structural',
    changed: stats.totalChangedLines > 0,
    diffSize: stats.totalChangedLines,
    totalLines,
    noiseEstimate: estimateNoise(patch, 'structural'),
    patch: patch.length > 5000 ? patch.substring(0, 5000) + '\n... [truncated]' : patch,
    addedLines: stats.addedLines,
    removedLines: stats.removedLines,
    reportable: false,
    reportReason: 'structural is diagnostic only',
  };
}

/**
 * Strategy 4: Text-only diff
 * SECONDARY/fallback - catches real changes readability misses
 */
export function diffTextOnly(before: string, after: string): DiffResult {
  const normBefore = normalizeText(before);
  const normAfter = normalizeText(after);

  const patch = createPatch('text.txt', normBefore, normAfter, '', '', { context: 3 });
  const stats = analyzePatch(patch);
  const totalLines = normAfter.split('\n').length;
  const noise = estimateNoise(patch, 'text_only');

  // Reportable as fallback: low noise AND meaningful diff size
  const reportable = stats.totalChangedLines >= 2 && noise < 0.3;
  let reportReason: string | undefined;
  if (!reportable && stats.totalChangedLines > 0) {
    if (noise >= 0.3) {
      reportReason = `text_only noise too high (${(noise * 100).toFixed(0)}% >= 30%)`;
    } else {
      reportReason = `text_only change too small (diffSize=${stats.totalChangedLines} < 2)`;
    }
  } else if (reportable) {
    reportReason = 'text_only fallback: low-noise content change detected';
  }

  return {
    strategy: 'text_only',
    changed: stats.totalChangedLines > 0,
    diffSize: stats.totalChangedLines,
    totalLines,
    noiseEstimate: noise,
    patch: patch.length > 5000 ? patch.substring(0, 5000) + '\n... [truncated]' : patch,
    addedLines: stats.addedLines,
    removedLines: stats.removedLines,
    reportable,
    reportReason,
  };
}

/**
 * Run all 4 diff strategies and determine which are reportable
 */
export function diffAll(
  before: { rawHtml: string; readabilityText: string; structuralDom: string; textOnly: string },
  after: { rawHtml: string; readabilityText: string; structuralDom: string; textOnly: string },
  options?: { strategy?: DiffStrategy }
): DiffResult[] {
  // If a specific strategy is forced, only run that one
  if (options?.strategy) {
    switch (options.strategy) {
      case 'raw_html': return [diffRawHtml(before.rawHtml, after.rawHtml)];
      case 'readability': return [diffReadability(before.readabilityText, after.readabilityText)];
      case 'structural': return [diffStructural(before.structuralDom, after.structuralDom)];
      case 'text_only': return [diffTextOnly(before.textOnly, after.textOnly)];
    }
  }

  return [
    diffRawHtml(before.rawHtml, after.rawHtml),
    diffReadability(before.readabilityText, after.readabilityText),
    diffStructural(before.structuralDom, after.structuralDom),
    diffTextOnly(before.textOnly, after.textOnly),
  ];
}

/**
 * Determine if ANY strategy's change should trigger a notification.
 * Uses the tuned decision logic:
 *   - readability changed with diffSize > 2, OR
 *   - text_only changed with noise < 0.3 AND diffSize >= 2
 */
export function shouldReport(diffs: DiffResult[]): { report: boolean; reasons: string[] } {
  const reasons: string[] = [];

  for (const diff of diffs) {
    if (diff.reportable) {
      reasons.push(`[${diff.strategy}] ${diff.reportReason}`);
    }
  }

  return { report: reasons.length > 0, reasons };
}

/**
 * Get the best diff result for reporting (prefer readability, then text_only)
 */
export function getBestDiff(diffs: DiffResult[]): DiffResult | null {
  const reportable = diffs.filter(d => d.reportable);
  if (reportable.length === 0) return null;

  // Prefer readability over text_only
  const readability = reportable.find(d => d.strategy === 'readability');
  if (readability) return readability;

  return reportable[0];
}
