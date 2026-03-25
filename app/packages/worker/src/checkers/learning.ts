/**
 * Layer 1: Volatile Field Filtering (Learning Period)
 *
 * Adapted for production — uses in-memory volatile patterns from the URL record
 * (stored in the `volatile_fields` JSONB column) instead of SQLite.
 */

import { normalizeText } from './normalizer.js';

/**
 * Split text into segments (lines) for volatility analysis.
 */
function textToSegments(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Analyze a set of readability text snapshots to discover volatile segments.
 * Returns segments that change in more than 90% of consecutive comparisons.
 *
 * @param readabilityTexts Array of readability text snapshots (chronological order)
 * @param minSnapshots Minimum snapshots needed before learning kicks in
 */
export function analyzeVolatility(
  readabilityTexts: string[],
  minSnapshots = 3,
): { volatileSegments: string[]; totalComparisons: number } {
  if (readabilityTexts.length < minSnapshots) {
    return { volatileSegments: [], totalComparisons: 0 };
  }

  const segmentChangeCounts = new Map<string, number>();
  const segmentSeenCounts = new Map<string, number>();
  let totalComparisons = 0;

  for (let i = 0; i < readabilityTexts.length - 1; i++) {
    const before = normalizeText(readabilityTexts[i]);
    const after = normalizeText(readabilityTexts[i + 1]);

    const segsBefore = new Set(textToSegments(before));
    const segsAfter = new Set(textToSegments(after));
    const allSegs = new Set([...segsBefore, ...segsAfter]);

    for (const seg of allSegs) {
      segmentSeenCounts.set(seg, (segmentSeenCounts.get(seg) || 0) + 1);
      const inBefore = segsBefore.has(seg);
      const inAfter = segsAfter.has(seg);
      if (inBefore !== inAfter) {
        segmentChangeCounts.set(seg, (segmentChangeCounts.get(seg) || 0) + 1);
      }
    }

    totalComparisons++;
  }

  if (totalComparisons === 0) {
    return { volatileSegments: [], totalComparisons: 0 };
  }

  const VOLATILITY_THRESHOLD = 0.9;
  const volatileSegments: string[] = [];

  for (const [seg, changeCount] of segmentChangeCounts) {
    const seenCount = segmentSeenCounts.get(seg) || 1;
    const changeRate = changeCount / seenCount;
    if (changeRate >= VOLATILITY_THRESHOLD && seenCount >= 2) {
      volatileSegments.push(seg);
    }
  }

  return { volatileSegments, totalComparisons };
}

/**
 * Strip known volatile segments from text before diffing.
 */
export function stripVolatileSegments(text: string, volatilePatterns: string[]): string {
  if (volatilePatterns.length === 0) return text;

  const volatileSet = new Set(volatilePatterns);
  const lines = text.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    return !volatileSet.has(trimmed);
  });
  return filtered.join('\n');
}
