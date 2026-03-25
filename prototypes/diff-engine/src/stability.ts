/**
 * Layer 3: Content Stability Scoring
 *
 * For each URL, maintain a rolling window of the last N checks.
 * Calculate a "stability score" (0-1): what % of checks produced NO changes?
 * Score 1.0 = perfectly stable. Score 0.3 = changes 70% of the time (noisy).
 */

import { getDb, getSnapshotsForUrl, getAllUrls } from './snapshot.js';
import { normalizeText } from './normalizer.js';

const DEFAULT_WINDOW_SIZE = 10;
const UNSTABLE_THRESHOLD = 0.5;

export interface StabilityResult {
  url: string;
  windowSize: number;
  totalChecks: number;
  changesInWindow: number;
  score: number;
  isUnstable: boolean;
}

/**
 * Calculate stability score for a single URL based on its snapshot history.
 * Compares consecutive readability text snapshots in the rolling window.
 */
export function calculateStability(url: string, windowSize = DEFAULT_WINDOW_SIZE): StabilityResult {
  const snapshots = getSnapshotsForUrl(url, windowSize + 1); // +1 to have windowSize comparisons

  if (snapshots.length < 2) {
    return {
      url,
      windowSize,
      totalChecks: snapshots.length,
      changesInWindow: 0,
      score: 1.0, // Not enough data, assume stable
      isUnstable: false,
    };
  }

  // Snapshots come newest-first, reverse for chronological order
  const ordered = [...snapshots].reverse();
  let changesDetected = 0;
  const comparisons = Math.min(ordered.length - 1, windowSize);

  for (let i = ordered.length - comparisons - 1; i < ordered.length - 1; i++) {
    if (i < 0) continue;
    const before = normalizeText(ordered[i].readabilityText);
    const after = normalizeText(ordered[i + 1].readabilityText);

    if (before !== after) {
      changesDetected++;
    }
  }

  const score = comparisons > 0 ? 1 - (changesDetected / comparisons) : 1.0;

  return {
    url,
    windowSize,
    totalChecks: snapshots.length,
    changesInWindow: changesDetected,
    score: Math.round(score * 1000) / 1000, // 3 decimal places
    isUnstable: score < UNSTABLE_THRESHOLD,
  };
}

/**
 * Calculate and persist stability scores for all URLs
 */
export function updateAllStabilityScores(windowSize = DEFAULT_WINDOW_SIZE): StabilityResult[] {
  const db = getDb();
  const urls = getAllUrls();
  const results: StabilityResult[] = [];

  const upsert = db.prepare(`
    INSERT INTO stability_scores (url, window_size, changes_in_window, score, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(url) DO UPDATE SET
      window_size = excluded.window_size,
      changes_in_window = excluded.changes_in_window,
      score = excluded.score,
      updated_at = datetime('now')
  `);

  const runAll = db.transaction(() => {
    for (const url of urls) {
      const result = calculateStability(url, windowSize);
      upsert.run(url, result.windowSize, result.changesInWindow, result.score);
      results.push(result);
    }
  });

  runAll();

  return results;
}

/**
 * Get persisted stability score for a URL
 */
export function getStabilityScore(url: string): StabilityResult | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT url, window_size, changes_in_window, score, updated_at FROM stability_scores WHERE url = ?'
  ).get(url) as any;

  if (!row) return null;

  return {
    url: row.url,
    windowSize: row.window_size,
    totalChecks: row.window_size, // approximation from stored data
    changesInWindow: row.changes_in_window,
    score: row.score,
    isUnstable: row.score < UNSTABLE_THRESHOLD,
  };
}

/**
 * Get all stability scores, sorted by score ascending (most unstable first)
 */
export function getAllStabilityScores(): StabilityResult[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT url, window_size, changes_in_window, score FROM stability_scores ORDER BY score ASC'
  ).all() as any[];

  return rows.map(r => ({
    url: r.url,
    windowSize: r.window_size,
    totalChecks: r.window_size,
    changesInWindow: r.changes_in_window,
    score: r.score,
    isUnstable: r.score < UNSTABLE_THRESHOLD,
  }));
}

/**
 * Print a formatted stability report
 */
export function formatStabilityReport(scores: StabilityResult[]): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  CONTENT STABILITY SCORES');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  const unstable = scores.filter(s => s.isUnstable);
  const stable = scores.filter(s => !s.isUnstable);

  if (unstable.length > 0) {
    lines.push(`⚠️  UNSTABLE SOURCES (${unstable.length} URLs, score < 0.5):`);
    lines.push('─────────────────────────────────────────────────────────────');
    for (const s of unstable) {
      const bar = stabilityBar(s.score);
      const shortUrl = s.url.length > 55 ? s.url.substring(0, 55) + '..' : s.url;
      lines.push(`  ${bar} ${s.score.toFixed(2)} | ${s.changesInWindow}/${s.windowSize} changed | ${shortUrl}`);
    }
    lines.push('');
  }

  if (stable.length > 0) {
    lines.push(`✅ STABLE SOURCES (${stable.length} URLs, score >= 0.5):`);
    lines.push('─────────────────────────────────────────────────────────────');
    for (const s of stable) {
      const bar = stabilityBar(s.score);
      const shortUrl = s.url.length > 55 ? s.url.substring(0, 55) + '..' : s.url;
      lines.push(`  ${bar} ${s.score.toFixed(2)} | ${s.changesInWindow}/${s.windowSize} changed | ${shortUrl}`);
    }
    lines.push('');
  }

  const avgScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
    : 1.0;

  lines.push(`📊 Summary: ${scores.length} URLs analyzed, ${unstable.length} unstable, avg score ${avgScore.toFixed(2)}`);

  return lines.join('\n');
}

function stabilityBar(score: number): string {
  const filled = Math.round(score * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
