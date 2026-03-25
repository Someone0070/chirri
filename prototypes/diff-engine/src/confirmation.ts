/**
 * Layer 2: Confirmation Recheck
 *
 * When a diff is detected, don't immediately flag it.
 * Stage 1: Refetch after 5 seconds. If diff disappears → discard.
 * Stage 2: If diff persists after 5s, schedule check in 30 minutes. If still there → confirmed.
 */

import { createHash } from 'crypto';
import { getDb } from './snapshot.js';
import { fetchUrl, type FetchResult } from './fetcher.js';
import { normalizeText } from './normalizer.js';
import type { DiffResult } from './differ.js';

export interface ConfirmationResult {
  url: string;
  diffHash: string;
  stage: number;
  confirmed: boolean;
  discarded: boolean;
  message: string;
}

/**
 * Compute a hash of the diff to track across rechecks
 */
export function computeDiffHash(diffs: DiffResult[]): string {
  const significant = diffs
    .filter(d => d.changed)
    .map(d => `${d.strategy}:${d.addedLines}:${d.removedLines}`)
    .join('|');
  return createHash('sha256').update(significant).digest('hex').substring(0, 16);
}

/**
 * Stage 1: Quick recheck after delay (default 5 seconds).
 * Fetches the URL again, compares readability text to detect if diff was transient.
 */
export async function quickRecheck(
  url: string,
  originalReadabilityText: string,
  delayMs = 5000,
  usePlaywright = false
): Promise<{ stillChanged: boolean; newText: string }> {
  // Wait the delay
  await new Promise(resolve => setTimeout(resolve, delayMs));

  let fetchResult: FetchResult;
  try {
    fetchResult = await fetchUrl(url, usePlaywright);
  } catch {
    // If fetch fails, assume still changed (can't confirm either way)
    return { stillChanged: true, newText: '' };
  }

  if (fetchResult.error) {
    return { stillChanged: true, newText: '' };
  }

  const normalizedOriginal = normalizeText(originalReadabilityText);
  const normalizedNew = normalizeText(fetchResult.readabilityText);

  return {
    stillChanged: normalizedOriginal !== normalizedNew,
    newText: fetchResult.readabilityText,
  };
}

/**
 * Record a pending confirmation in the DB
 */
export function recordPendingConfirmation(
  url: string,
  diffHash: string,
  stage: number
): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO pending_confirmations (url, diff_hash, stage, first_detected_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(url, diffHash, stage);
  return result.lastInsertRowid as number;
}

/**
 * Mark a pending confirmation as confirmed
 */
export function markConfirmed(url: string, diffHash: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE pending_confirmations
    SET confirmed_at = datetime('now'), stage = 2
    WHERE url = ? AND diff_hash = ? AND confirmed_at IS NULL
  `).run(url, diffHash);
}

/**
 * Mark a pending confirmation as discarded (transient change)
 */
export function markDiscarded(url: string, diffHash: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE pending_confirmations
    SET discarded = 1
    WHERE url = ? AND diff_hash = ? AND confirmed_at IS NULL
  `).run(url, diffHash);
}

/**
 * Run Stage 1 confirmation for a detected change.
 * Returns whether the change was confirmed or discarded.
 */
export async function confirmStage1(
  url: string,
  originalReadabilityText: string,
  diffs: DiffResult[],
  usePlaywright = false
): Promise<ConfirmationResult> {
  const diffHash = computeDiffHash(diffs);

  console.log(`  🔄 Confirmation Stage 1: Rechecking ${url} in 5s...`);

  const { stillChanged } = await quickRecheck(url, originalReadabilityText, 5000, usePlaywright);

  if (!stillChanged) {
    markDiscarded(url, diffHash);
    return {
      url,
      diffHash,
      stage: 1,
      confirmed: false,
      discarded: true,
      message: 'Change disappeared after 5s recheck — likely CDN edge difference or glitch',
    };
  }

  // Stage 1 passed — record as pending Stage 2
  recordPendingConfirmation(url, diffHash, 1);

  return {
    url,
    diffHash,
    stage: 1,
    confirmed: false,
    discarded: false,
    message: 'Change persists after 5s — scheduled for Stage 2 (30min recheck)',
  };
}

/**
 * Get pending confirmations that are due for Stage 2 recheck
 * (first_detected_at is > 30 minutes ago and not yet confirmed/discarded)
 */
export function getPendingStage2Rechecks(): Array<{
  id: number;
  url: string;
  diffHash: string;
  firstDetectedAt: string;
}> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, url, diff_hash, first_detected_at
    FROM pending_confirmations
    WHERE stage = 1
      AND confirmed_at IS NULL
      AND discarded = 0
      AND datetime(first_detected_at, '+30 minutes') <= datetime('now')
  `).all() as any[];

  return rows.map(r => ({
    id: r.id,
    url: r.url,
    diffHash: r.diff_hash,
    firstDetectedAt: r.first_detected_at,
  }));
}

/**
 * Get confirmation stats
 */
export function getConfirmationStats(): {
  pending: number;
  confirmed: number;
  discarded: number;
} {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN confirmed_at IS NULL AND discarded = 0 THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN confirmed_at IS NOT NULL THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN discarded = 1 THEN 1 ELSE 0 END) as discarded
    FROM pending_confirmations
  `).get() as any;

  return {
    pending: row?.pending || 0,
    confirmed: row?.confirmed || 0,
    discarded: row?.discarded || 0,
  };
}
