/**
 * Report generation - output comparison results with 6-layer FP defense info
 */

import type { DiffResult } from './differ.js';
import type { StabilityResult } from './stability.js';
import type { ConfirmationResult } from './confirmation.js';

export interface UrlReport {
  url: string;
  company?: string;
  type?: string;
  hasHistory: boolean;
  fetchError?: string;
  fetchMethod: string;
  fetchTimeMs: number;
  diffs: DiffResult[];
  // Enhanced fields for 6-layer FP defense
  stabilityScore?: number;
  isUnstable?: boolean;
  volatileFieldCount?: number;
  confirmationStatus?: string;
  filteredAsNoise?: boolean;
  noiseEstimateOverall?: number;
}

export interface FullReport {
  timestamp: string;
  totalUrls: number;
  fetchedUrls: number;
  errorUrls: number;
  urlsWithHistory: number;
  changedUrls: number;
  results: UrlReport[];
  // Enhanced summary
  confirmedChanges?: number;
  filteredAsNoise?: number;
  avgStabilityScore?: number;
  totalVolatileFields?: number;
  fpEstimate?: number;
}

/**
 * Generate a text report from URL results (enhanced with 6-layer info)
 */
export function generateTextReport(report: FullReport): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  CHIRRI DIFF ENGINE - Snapshot Comparison Report');
  lines.push('  (with 6-Layer False Positive Defense)');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`  Timestamp: ${report.timestamp}`);
  lines.push(`  Total URLs: ${report.totalUrls}`);
  lines.push(`  Successfully fetched: ${report.fetchedUrls}`);
  lines.push(`  Errors: ${report.errorUrls}`);
  lines.push(`  URLs with history: ${report.urlsWithHistory}`);
  lines.push(`  URLs with changes detected: ${report.changedUrls}`);

  // Enhanced summary
  if (report.confirmedChanges !== undefined) {
    lines.push(`  Confirmed changes: ${report.confirmedChanges}`);
  }
  if (report.filteredAsNoise !== undefined) {
    lines.push(`  Filtered as noise: ${report.filteredAsNoise}`);
  }
  if (report.avgStabilityScore !== undefined) {
    lines.push(`  Avg stability score: ${report.avgStabilityScore.toFixed(2)}`);
  }
  if (report.totalVolatileFields !== undefined) {
    lines.push(`  Total volatile fields detected: ${report.totalVolatileFields}`);
  }
  if (report.fpEstimate !== undefined) {
    lines.push(`  Estimated false positive rate: ${(report.fpEstimate * 100).toFixed(1)}%`);
  }

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Pipeline summary line
  const checked = report.totalUrls;
  const detected = report.changedUrls;
  const confirmed = report.confirmedChanges ?? report.changedUrls;
  const noise = report.filteredAsNoise ?? 0;
  lines.push(`📋 Summary: ${checked} URLs checked, ${detected} changes detected, ${confirmed} confirmed, ${noise} filtered as noise`);
  lines.push('');

  // Summary table for URLs with changes
  const changed = report.results.filter(r => r.diffs.some(d => d.changed));
  if (changed.length > 0) {
    lines.push('📊 CHANGES DETECTED:');
    lines.push('─────────────────────────────────────────────────────────────');
    lines.push(
      padRight('URL', 40) +
      padRight('Stab.', 7) +
      padRight('Vol.', 6) +
      padRight('Confirm', 10) +
      padRight('raw', 6) +
      padRight('read', 6) +
      padRight('struct', 7) +
      padRight('text', 6)
    );
    lines.push('─────────────────────────────────────────────────────────────');

    for (const result of changed) {
      const shortUrl = result.url.length > 38 ? result.url.substring(0, 38) + '..' : result.url;
      const stability = result.stabilityScore !== undefined ? result.stabilityScore.toFixed(2) : ' - ';
      const volatile = result.volatileFieldCount !== undefined ? String(result.volatileFieldCount) : ' - ';
      const confirm = result.confirmationStatus || ' - ';
      const diffs = result.diffs;
      const cols = diffs.map(d => {
        if (!d.changed) return ' ·';
        const noise = d.noiseEstimate > 0.5 ? '🔇' : d.noiseEstimate > 0.2 ? '⚠️' : '✅';
        return `${noise}${d.diffSize}`;
      });
      lines.push(
        padRight(shortUrl, 40) +
        padRight(stability, 7) +
        padRight(volatile, 6) +
        padRight(confirm, 10) +
        cols.map(c => padRight(c, 6)).join(' ')
      );

      if (result.isUnstable) {
        lines.push(padRight('', 40) + '  ⚠️  UNSTABLE SOURCE');
      }
    }
    lines.push('');
    lines.push('Legend: Stab.=stability score, Vol.=volatile fields, Confirm=confirmation status');
    lines.push('       ✅=low noise, ⚠️=moderate noise, 🔇=high noise, ·=no change');
    lines.push('');
  }

  // Summary for first-time snapshots
  const firstTime = report.results.filter(r => !r.hasHistory && !r.fetchError);
  if (firstTime.length > 0) {
    lines.push(`📸 FIRST SNAPSHOT (${firstTime.length} URLs - no comparison yet):`);
    lines.push('─────────────────────────────────────────────────────────────');
    for (const result of firstTime) {
      const shortUrl = result.url.length > 60 ? result.url.substring(0, 60) + '..' : result.url;
      lines.push(`  ${shortUrl} (${result.fetchMethod}, ${result.fetchTimeMs}ms)`);
    }
    lines.push('');
  }

  // Errors
  const errors = report.results.filter(r => r.fetchError);
  if (errors.length > 0) {
    lines.push(`❌ ERRORS (${errors.length} URLs):`);
    lines.push('─────────────────────────────────────────────────────────────');
    for (const result of errors) {
      const shortUrl = result.url.length > 50 ? result.url.substring(0, 50) + '..' : result.url;
      lines.push(`  ${shortUrl}`);
      lines.push(`    Error: ${result.fetchError}`);
    }
    lines.push('');
  }

  // No changes
  const noChange = report.results.filter(r => r.hasHistory && r.diffs.every(d => !d.changed) && !r.fetchError);
  if (noChange.length > 0) {
    lines.push(`✨ NO CHANGES (${noChange.length} URLs):`);
    lines.push('─────────────────────────────────────────────────────────────');
    for (const result of noChange) {
      const shortUrl = result.url.length > 55 ? result.url.substring(0, 55) + '..' : result.url;
      const stability = result.stabilityScore !== undefined ? ` [stability: ${result.stabilityScore.toFixed(2)}]` : '';
      lines.push(`  ${shortUrl}${stability}`);
    }
    lines.push('');
  }

  // Detailed diffs for changed URLs
  if (changed.length > 0) {
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('  DETAILED DIFFS');
    lines.push('═══════════════════════════════════════════════════════════════');

    for (const result of changed) {
      lines.push('');
      lines.push(`🔍 ${result.url}`);
      lines.push(`   Company: ${result.company || 'unknown'} | Type: ${result.type || 'unknown'}`);
      lines.push(`   Fetch: ${result.fetchMethod} (${result.fetchTimeMs}ms)`);
      if (result.stabilityScore !== undefined) {
        lines.push(`   Stability: ${result.stabilityScore.toFixed(2)}${result.isUnstable ? ' ⚠️ UNSTABLE' : ''}`);
      }
      if (result.volatileFieldCount !== undefined && result.volatileFieldCount > 0) {
        lines.push(`   Volatile fields: ${result.volatileFieldCount} (excluded from diff)`);
      }
      if (result.confirmationStatus) {
        lines.push(`   Confirmation: ${result.confirmationStatus}`);
      }
      lines.push('');

      for (const diff of result.diffs) {
        if (!diff.changed) continue;
        lines.push(`   Strategy: ${diff.strategy}`);
        lines.push(`   Changed lines: +${diff.addedLines} -${diff.removedLines} (${diff.diffSize} total)`);
        lines.push(`   Noise estimate: ${(diff.noiseEstimate * 100).toFixed(0)}%`);
        lines.push('   ---');
        // Show first 20 lines of patch
        const patchLines = diff.patch.split('\n').slice(0, 20);
        for (const pl of patchLines) {
          lines.push(`   ${pl}`);
        }
        if (diff.patch.split('\n').length > 20) {
          lines.push('   ... [truncated]');
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length);
}

/**
 * Generate a JSON report
 */
export function generateJsonReport(report: FullReport): string {
  return JSON.stringify(report, null, 2);
}
