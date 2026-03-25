/**
 * Layer 6: Feedback Loop (stub)
 *
 * In production, users mark changes as false positives.
 * Feedback is per-user only — never auto-modifies shared detection.
 */

import { getDb } from './snapshot.js';

export interface FeedbackEntry {
  id: number;
  changeId: number;
  userId: string;
  isFalsePositive: boolean;
  createdAt: string;
}

/**
 * Mark a change as a false positive (per-user feedback)
 */
export function markFalsePositive(changeId: number, userId: string): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO feedback (change_id, user_id, is_false_positive, created_at)
    VALUES (?, ?, 1, datetime('now'))
  `).run(changeId, userId);
  return result.lastInsertRowid as number;
}

/**
 * Mark a change as NOT a false positive (confirm it's real)
 */
export function markTruePositive(changeId: number, userId: string): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO feedback (change_id, user_id, is_false_positive, created_at)
    VALUES (?, ?, 0, datetime('now'))
  `).run(changeId, userId);
  return result.lastInsertRowid as number;
}

/**
 * Get false positive rate for a URL.
 * Looks at all feedback for changes associated with this URL.
 */
export function getFPRate(url: string): { totalFeedback: number; falsePositives: number; rate: number } {
  const db = getDb();

  // Since we don't have a direct URL→change mapping in feedback table,
  // we join through pending_confirmations or change_signals.
  // For the stub, we do a simple count from feedback table.
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_false_positive = 1 THEN 1 ELSE 0 END) as fp_count
    FROM feedback f
    JOIN pending_confirmations pc ON f.change_id = pc.id
    WHERE pc.url = ?
  `).get(url) as any;

  const total = row?.total || 0;
  const fpCount = row?.fp_count || 0;

  return {
    totalFeedback: total,
    falsePositives: fpCount,
    rate: total > 0 ? fpCount / total : 0,
  };
}

/**
 * Get all feedback entries for a change
 */
export function getFeedbackForChange(changeId: number): FeedbackEntry[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT id, change_id, user_id, is_false_positive, created_at FROM feedback WHERE change_id = ?'
  ).all(changeId) as any[];

  return rows.map(r => ({
    id: r.id,
    changeId: r.change_id,
    userId: r.user_id,
    isFalsePositive: !!r.is_false_positive,
    createdAt: r.created_at,
  }));
}

/**
 * Get overall FP statistics
 */
export function getOverallFPStats(): { totalFeedback: number; falsePositives: number; rate: number } {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_false_positive = 1 THEN 1 ELSE 0 END) as fp_count
    FROM feedback
  `).get() as any;

  const total = row?.total || 0;
  const fpCount = row?.fp_count || 0;

  return {
    totalFeedback: total,
    falsePositives: fpCount,
    rate: total > 0 ? fpCount / total : 0,
  };
}
