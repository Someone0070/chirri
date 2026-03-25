/**
 * Layer 1: Volatile Field Filtering (Learning Period)
 *
 * After N snapshots, analyze which text segments change on EVERY check.
 * If a segment changes >90% of the time → mark as "volatile" → exclude from diffs.
 */

import { getDb, getSnapshotsForUrl, getAllUrls, type Snapshot } from './snapshot.js';
import { normalizeText } from './normalizer.js';

/** Configurable threshold for minimum snapshots before learning kicks in */
const DEFAULT_MIN_SNAPSHOTS = 3;
/** If a segment changes in more than this fraction of comparisons, it's volatile */
const VOLATILITY_THRESHOLD = 0.9;

/**
 * Known volatile patterns to seed — these are stripped proactively (Layer 4),
 * but also tracked here so the learning system can discover new ones.
 */
export const SEED_VOLATILE_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'request_id', regex: /(?:request[_-]?id|req[_-]?id|x-request-id)\s*[:=]\s*["']?[a-f0-9-]{8,}["']?/gi },
  { name: 'trace_id', regex: /(?:trace[_-]?id|span[_-]?id|correlation[_-]?id)\s*[:=]\s*["']?[a-f0-9-]{8,}["']?/gi },
  { name: 'csrf_token', regex: /(?:csrf|_token|authenticity_token)\s*[:=]\s*["']?[A-Za-z0-9+/=_-]{16,}["']?/gi },
  { name: 'generated_at', regex: /(?:generated|rendered|built)\s+(?:at|on)\s*:?\s*[^\n]{5,40}/gi },
  { name: 'build_hash', regex: /(?:build|commit|revision|sha|hash)\s*[:=]\s*["']?[a-f0-9]{7,40}["']?/gi },
  { name: 'cache_key', regex: /(?:cache[_-]?key|etag)\s*[:=]\s*["']?[A-Za-z0-9+/=_-]{8,}["']?/gi },
  { name: 'nonce', regex: /nonce=["'][A-Za-z0-9+/=]{8,}["']/gi },
  { name: 'session_id', regex: /(?:session[_-]?id|sid)\s*[:=]\s*["']?[A-Za-z0-9._-]{16,}["']?/gi },
];

/**
 * Split text into "segments" — lines or paragraphs.
 * Each segment is a diffable unit for volatility detection.
 */
function textToSegments(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Analyze snapshots for a single URL to discover volatile segments.
 * Compares consecutive snapshot pairs and tracks which segments change.
 */
export function analyzeVolatility(
  url: string,
  minSnapshots = DEFAULT_MIN_SNAPSHOTS
): { totalComparisons: number; volatileSegments: string[]; stableSegments: number } {
  const snapshots = getSnapshotsForUrl(url, 20); // get up to 20 recent snapshots

  if (snapshots.length < minSnapshots) {
    return { totalComparisons: 0, volatileSegments: [], stableSegments: 0 };
  }

  // Compare consecutive pairs (newest first, so reverse for chronological order)
  const ordered = [...snapshots].reverse();
  const segmentChangeCounts = new Map<string, number>();
  const segmentSeenCounts = new Map<string, number>();
  let totalComparisons = 0;

  for (let i = 0; i < ordered.length - 1; i++) {
    const before = normalizeText(ordered[i].readabilityText);
    const after = normalizeText(ordered[i + 1].readabilityText);

    const segsBefore = new Set(textToSegments(before));
    const segsAfter = new Set(textToSegments(after));

    // All segments seen in either snapshot
    const allSegs = new Set([...segsBefore, ...segsAfter]);

    for (const seg of allSegs) {
      segmentSeenCounts.set(seg, (segmentSeenCounts.get(seg) || 0) + 1);

      // A segment "changed" if it appears in one but not the other
      const inBefore = segsBefore.has(seg);
      const inAfter = segsAfter.has(seg);
      if (inBefore !== inAfter) {
        segmentChangeCounts.set(seg, (segmentChangeCounts.get(seg) || 0) + 1);
      }
    }

    totalComparisons++;
  }

  if (totalComparisons === 0) {
    return { totalComparisons: 0, volatileSegments: [], stableSegments: segmentSeenCounts.size };
  }

  // Identify volatile segments: change rate > threshold
  const volatileSegments: string[] = [];
  for (const [seg, changeCount] of segmentChangeCounts) {
    const seenCount = segmentSeenCounts.get(seg) || 1;
    const changeRate = changeCount / seenCount;
    if (changeRate >= VOLATILITY_THRESHOLD && seenCount >= 2) {
      volatileSegments.push(seg);
    }
  }

  return {
    totalComparisons,
    volatileSegments,
    stableSegments: segmentSeenCounts.size - volatileSegments.length,
  };
}

/**
 * Run the learning phase for all URLs and persist volatile fields to DB.
 */
export function runLearningPhase(minSnapshots = DEFAULT_MIN_SNAPSHOTS): {
  urlsAnalyzed: number;
  totalVolatileFields: number;
  results: Array<{ url: string; volatileCount: number; totalComparisons: number }>;
} {
  const db = getDb();
  const urls = getAllUrls();
  const results: Array<{ url: string; volatileCount: number; totalComparisons: number }> = [];
  let totalVolatileFields = 0;

  const upsert = db.prepare(`
    INSERT INTO volatile_fields (url, pattern, match_count, total_checks, is_volatile, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(url, pattern) DO UPDATE SET
      match_count = excluded.match_count,
      total_checks = excluded.total_checks,
      is_volatile = excluded.is_volatile,
      updated_at = datetime('now')
  `);

  const runAll = db.transaction(() => {
    for (const url of urls) {
      const analysis = analyzeVolatility(url, minSnapshots);

      if (analysis.totalComparisons === 0) {
        results.push({ url, volatileCount: 0, totalComparisons: 0 });
        continue;
      }

      // Store each volatile segment
      for (const seg of analysis.volatileSegments) {
        // Truncate very long segments for storage
        const pattern = seg.length > 200 ? seg.substring(0, 200) + '...' : seg;
        upsert.run(url, pattern, analysis.totalComparisons, analysis.totalComparisons, 1);
      }

      totalVolatileFields += analysis.volatileSegments.length;
      results.push({
        url,
        volatileCount: analysis.volatileSegments.length,
        totalComparisons: analysis.totalComparisons,
      });
    }
  });

  runAll();

  return { urlsAnalyzed: urls.length, totalVolatileFields, results };
}

/**
 * Get volatile patterns for a URL (used by differ to exclude them)
 */
export function getVolatilePatterns(url: string): string[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT pattern FROM volatile_fields WHERE url = ? AND is_volatile = 1'
  ).all(url) as any[];
  return rows.map(r => r.pattern);
}

/**
 * Strip volatile segments from text before diffing
 */
export function stripVolatileSegments(text: string, volatilePatterns: string[]): string {
  if (volatilePatterns.length === 0) return text;

  const volatileSet = new Set(volatilePatterns);
  const lines = text.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    return !volatileSet.has(trimmed);
  });
  return filtered.join('\n');
}

/**
 * Get volatile field stats for all URLs
 */
export function getVolatileStats(): Array<{ url: string; volatileCount: number; totalFields: number }> {
  const db = getDb();
  const rows = db.prepare(`
    SELECT url,
           SUM(CASE WHEN is_volatile = 1 THEN 1 ELSE 0 END) as volatile_count,
           COUNT(*) as total_fields
    FROM volatile_fields
    GROUP BY url
    ORDER BY volatile_count DESC
  `).all() as any[];
  return rows.map(r => ({
    url: r.url,
    volatileCount: r.volatile_count,
    totalFields: r.total_fields,
  }));
}
