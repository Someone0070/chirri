/**
 * Diff strategies - compare snapshots using different approaches
 *
 * Strategy selection (tuned from historical data analysis):
 * - readability: PRIMARY strategy for HTML pages (near-zero noise)
 * - text_only: SECONDARY/fallback (catches changes readability misses)
 * - raw_html: DIAGNOSTIC only, never triggers notifications
 * - structural: DIAGNOSTIC only
 */

import { createPatch } from 'diff';
import { normalizeHtml, normalizeText } from './normalizer.js';

export type DiffStrategy = 'readability' | 'text_only' | 'raw_html' | 'structural';

export interface DiffResult {
  strategy: string;
  changed: boolean;
  diffSize: number;
  totalLines: number;
  noiseEstimate: number;
  patch: string;
  addedLines: number;
  removedLines: number;
  reportable: boolean;
  reportReason?: string;
}

function analyzePatch(patch: string): {
  addedLines: number;
  removedLines: number;
  totalChangedLines: number;
} {
  const lines = patch.split('\n');
  let addedLines = 0;
  let removedLines = 0;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) addedLines++;
    if (line.startsWith('-') && !line.startsWith('---')) removedLines++;
  }

  return { addedLines, removedLines, totalChangedLines: addedLines + removedLines };
}

function estimateNoise(patch: string): number {
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
    /^\s*$/,
    /^\s*[+-]\s*$/,
  ];

  for (const line of lines) {
    if (
      (line.startsWith('+') && !line.startsWith('+++')) ||
      (line.startsWith('-') && !line.startsWith('---'))
    ) {
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
    noiseEstimate: estimateNoise(patch),
    patch: patch.length > 5000 ? patch.substring(0, 5000) + '\n... [truncated]' : patch,
    addedLines: stats.addedLines,
    removedLines: stats.removedLines,
    reportable: false,
    reportReason: 'raw_html is diagnostic only (too noisy for notifications)',
  };
}

export function diffReadability(before: string, after: string): DiffResult {
  const normBefore = normalizeText(before);
  const normAfter = normalizeText(after);

  const patch = createPatch('readability.txt', normBefore, normAfter, '', '', { context: 3 });
  const stats = analyzePatch(patch);
  const totalLines = normAfter.split('\n').length;
  const noise = estimateNoise(patch);

  const reportable = stats.totalChangedLines > 2;
  let reportReason: string | undefined;
  if (!reportable && stats.totalChangedLines > 0) {
    reportReason = `readability change too small (diffSize=${stats.totalChangedLines} <= 2)`;
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
    noiseEstimate: estimateNoise(patch),
    patch: patch.length > 5000 ? patch.substring(0, 5000) + '\n... [truncated]' : patch,
    addedLines: stats.addedLines,
    removedLines: stats.removedLines,
    reportable: false,
    reportReason: 'structural is diagnostic only',
  };
}

export function diffTextOnly(before: string, after: string): DiffResult {
  const normBefore = normalizeText(before);
  const normAfter = normalizeText(after);

  const patch = createPatch('text.txt', normBefore, normAfter, '', '', { context: 3 });
  const stats = analyzePatch(patch);
  const totalLines = normAfter.split('\n').length;
  const noise = estimateNoise(patch);

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

export function diffAll(
  before: { rawHtml: string; readabilityText: string; structuralDom: string; textOnly: string },
  after: { rawHtml: string; readabilityText: string; structuralDom: string; textOnly: string },
): DiffResult[] {
  return [
    diffRawHtml(before.rawHtml, after.rawHtml),
    diffReadability(before.readabilityText, after.readabilityText),
    diffStructural(before.structuralDom, after.structuralDom),
    diffTextOnly(before.textOnly, after.textOnly),
  ];
}

export function shouldReport(diffs: DiffResult[]): { report: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const diff of diffs) {
    if (diff.reportable) {
      reasons.push(`[${diff.strategy}] ${diff.reportReason}`);
    }
  }
  return { report: reasons.length > 0, reasons };
}

export function getBestDiff(diffs: DiffResult[]): DiffResult | null {
  const reportable = diffs.filter((d) => d.reportable);
  if (reportable.length === 0) return null;

  const readability = reportable.find((d) => d.strategy === 'readability');
  if (readability) return readability;

  return reportable[0];
}
