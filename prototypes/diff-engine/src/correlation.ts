/**
 * Layer 5: Cross-Source Correlation (stub)
 *
 * In production, this checks if multiple sources (changelog + header + docs) agree on a change.
 * For the prototype, just interfaces + mock returning "single source".
 */

import { getDb } from './snapshot.js';

export type SourceType = 'primary' | 'changelog' | 'header' | 'docs' | 'rss' | 'github_release' | 'npm_registry';

export interface ChangeSignal {
  id?: number;
  url: string;
  sourceType: SourceType;
  detectedAt: string;
  diffHash: string;
  confirmed: boolean;
}

export interface CorrelationResult {
  url: string;
  signals: ChangeSignal[];
  sourceCount: number;
  correlationConfidence: 'high' | 'medium' | 'low' | 'single_source';
  message: string;
}

/**
 * Record a change signal from a source
 */
export function recordChangeSignal(signal: Omit<ChangeSignal, 'id' | 'detectedAt'>): number {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO change_signals (url, source_type, diff_hash, confirmed)
    VALUES (?, ?, ?, ?)
  `).run(signal.url, signal.sourceType, signal.diffHash, signal.confirmed ? 1 : 0);
  return result.lastInsertRowid as number;
}

/**
 * Get recent signals for a URL (last 24 hours)
 */
export function getRecentSignals(url: string): ChangeSignal[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, url, source_type, detected_at, diff_hash, confirmed
    FROM change_signals
    WHERE url = ? AND detected_at >= datetime('now', '-24 hours')
    ORDER BY detected_at DESC
  `).all(url) as any[];

  return rows.map(r => ({
    id: r.id,
    url: r.url,
    sourceType: r.source_type as SourceType,
    detectedAt: r.detected_at,
    diffHash: r.diff_hash,
    confirmed: !!r.confirmed,
  }));
}

/**
 * Correlate signals for a URL.
 * STUB: In production, would check if changelog + header + docs agree.
 * For prototype, always returns "single_source".
 */
export function correlateSignals(url: string, diffHash: string): CorrelationResult {
  // Record the primary signal
  recordChangeSignal({
    url,
    sourceType: 'primary',
    diffHash,
    confirmed: false,
  });

  const signals = getRecentSignals(url);

  // Stub logic: count distinct source types
  const sourceTypes = new Set(signals.map(s => s.sourceType));
  const sourceCount = sourceTypes.size;

  let confidence: CorrelationResult['correlationConfidence'];
  let message: string;

  if (sourceCount >= 3) {
    confidence = 'high';
    message = `${sourceCount} sources agree on change`;
  } else if (sourceCount === 2) {
    confidence = 'medium';
    message = `2 sources detected change: ${[...sourceTypes].join(', ')}`;
  } else {
    confidence = 'single_source';
    message = 'Single source only — prototype stub (cross-source not yet implemented)';
  }

  return { url, signals, sourceCount, correlationConfidence: confidence, message };
}
