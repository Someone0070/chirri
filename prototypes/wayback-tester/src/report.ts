/**
 * Report generation
 */
import { getDb } from './db.js';
import { TARGET_URLS } from './targets.js';

export function generateReport(): string {
  const db = getDb();
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('   WAYBACK MACHINE HISTORICAL DIFF ANALYSIS REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  // Overall stats
  const totalSnapshots = (db.prepare('SELECT COUNT(*) as c FROM snapshots WHERE html IS NOT NULL').get() as any).c;
  const totalPairs = (db.prepare('SELECT COUNT(DISTINCT url || ts_old || ts_new) as c FROM diff_pairs').get() as any).c;
  const totalDiffs = (db.prepare('SELECT COUNT(*) as c FROM diff_pairs').get() as any).c;
  const changedDiffs = (db.prepare('SELECT COUNT(*) as c FROM diff_pairs WHERE has_change = 1').get() as any).c;
  const noisyDiffs = (db.prepare('SELECT COUNT(*) as c FROM diff_pairs WHERE has_change = 1 AND noise_estimate >= 0.9').get() as any).c;
  const realChanges = (db.prepare('SELECT COUNT(*) as c FROM diff_pairs WHERE has_change = 1 AND noise_estimate < 0.9').get() as any).c;
  const llmCount = (db.prepare('SELECT COUNT(*) as c FROM llm_results').get() as any).c;
  const totalCost = (db.prepare('SELECT COALESCE(SUM(cost), 0) as c FROM llm_results').get() as any).c;

  lines.push(`📊 OVERALL SUMMARY`);
  lines.push(`  Snapshots fetched:    ${totalSnapshots}`);
  lines.push(`  Unique pairs:         ${totalPairs}`);
  lines.push(`  Diff runs (all strats): ${totalDiffs}`);
  lines.push(`  Changes detected:     ${changedDiffs}`);
  lines.push(`  Pure noise (≥90%):    ${noisyDiffs}`);
  lines.push(`  Real changes (<90%):  ${realChanges}`);
  lines.push(`  LLM analyses:         ${llmCount}`);
  lines.push(`  Total LLM cost:       $${totalCost.toFixed(4)}`);
  lines.push(`  False positive rate:  ${changedDiffs > 0 ? ((noisyDiffs / changedDiffs) * 100).toFixed(1) : 0}%`);
  lines.push('');

  // Severity distribution
  if (llmCount > 0) {
    const severities = db.prepare(`
      SELECT severity, COUNT(*) as c, SUM(CASE WHEN is_breaking = 1 THEN 1 ELSE 0 END) as breaking
      FROM llm_results GROUP BY severity ORDER BY c DESC
    `).all() as any[];

    lines.push(`🎯 SEVERITY DISTRIBUTION (LLM)`);
    for (const s of severities) {
      lines.push(`  ${(s.severity || 'unknown').padEnd(12)} ${String(s.c).padStart(4)} (${s.breaking} breaking)`);
    }

    const totalBreaking = (db.prepare('SELECT COUNT(*) as c FROM llm_results WHERE is_breaking = 1').get() as any).c;
    lines.push(`  ────────────`);
    lines.push(`  Total breaking: ${totalBreaking}/${llmCount} (${((totalBreaking / llmCount) * 100).toFixed(1)}%)`);
    lines.push('');

    // Model distribution
    const models = db.prepare('SELECT model, COUNT(*) as c, SUM(cost) as cost FROM llm_results GROUP BY model').all() as any[];
    lines.push(`🤖 MODEL USAGE`);
    for (const m of models) {
      lines.push(`  ${m.model.padEnd(15)} ${String(m.c).padStart(4)} calls  $${m.cost.toFixed(4)}`);
    }
    lines.push('');
  }

  // Per-URL breakdown
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('   PER-URL BREAKDOWN');
  lines.push('───────────────────────────────────────────────────────────────');

  for (const target of TARGET_URLS) {
    const urlSnapshots = (db.prepare('SELECT COUNT(*) as c FROM snapshots WHERE url = ? AND html IS NOT NULL').get(target.url) as any).c;
    if (urlSnapshots === 0) {
      lines.push(`\n📄 ${target.name} (${target.category}) - ${target.url}`);
      lines.push(`  ⚠ No snapshots fetched`);
      continue;
    }

    const urlPairs = db.prepare(`
      SELECT COUNT(DISTINCT ts_old || ts_new) as pairs,
             SUM(CASE WHEN has_change = 1 THEN 1 ELSE 0 END) as changes,
             SUM(CASE WHEN has_change = 1 AND noise_estimate >= 0.9 THEN 1 ELSE 0 END) as noisy,
             SUM(CASE WHEN has_change = 1 AND noise_estimate < 0.9 THEN 1 ELSE 0 END) as real_changes
      FROM diff_pairs WHERE url = ?
    `).get(target.url) as any;

    lines.push(`\n📄 ${target.name} (${target.category}) - ${target.url}`);
    lines.push(`  Snapshots: ${urlSnapshots} | Pairs: ${urlPairs?.pairs || 0} | Changes: ${urlPairs?.changes || 0} | Real: ${urlPairs?.real_changes || 0} | Noise: ${urlPairs?.noisy || 0}`);

    // Strategy breakdown
    const strategies = db.prepare(`
      SELECT strategy,
             COUNT(*) as total,
             SUM(CASE WHEN has_change = 1 THEN 1 ELSE 0 END) as changed,
             AVG(noise_estimate) as avg_noise
      FROM diff_pairs WHERE url = ? GROUP BY strategy
    `).all(target.url) as any[];

    if (strategies.length > 0) {
      lines.push(`  Strategy breakdown:`);
      for (const s of strategies) {
        lines.push(`    ${s.strategy.padEnd(15)} ${s.changed}/${s.total} changed  avg_noise=${(s.avg_noise * 100).toFixed(0)}%`);
      }
    }

    // LLM results for this URL
    const urlLlm = db.prepare(`
      SELECT lr.severity, lr.is_breaking, lr.what_changed, lr.confidence, lr.model
      FROM llm_results lr
      JOIN diff_pairs dp ON lr.pair_id = dp.id
      WHERE dp.url = ?
      ORDER BY lr.id
      LIMIT 5
    `).all(target.url) as any[];

    if (urlLlm.length > 0) {
      lines.push(`  LLM classifications:`);
      for (const r of urlLlm) {
        const breaking = r.is_breaking ? '🔴 BREAKING' : '🟢';
        lines.push(`    ${breaking} [${r.severity}] ${r.what_changed?.substring(0, 80) || 'N/A'} (conf=${r.confidence}, ${r.model})`);
      }
    }

    // Sample diffs (first 3 real changes, text_only strategy)
    const sampleDiffs = db.prepare(`
      SELECT ts_old, ts_new, diff_text, noise_estimate, diff_size
      FROM diff_pairs
      WHERE url = ? AND strategy = 'text_only' AND has_change = 1 AND noise_estimate < 0.9
      ORDER BY ts_old
      LIMIT 3
    `).all(target.url) as any[];

    if (sampleDiffs.length > 0) {
      lines.push(`  Sample diffs (text_only, first ${sampleDiffs.length}):`);
      for (const d of sampleDiffs) {
        lines.push(`    ${d.ts_old} → ${d.ts_new} (${d.diff_size} lines, noise=${(d.noise_estimate * 100).toFixed(0)}%)`);
        // Show first few lines of the diff
        const diffLines = (d.diff_text || '').split('\n')
          .filter((l: string) => l.startsWith('+') || l.startsWith('-'))
          .filter((l: string) => !l.startsWith('+++') && !l.startsWith('---'))
          .slice(0, 5);
        for (const dl of diffLines) {
          lines.push(`      ${dl.substring(0, 100)}`);
        }
      }
    }
  }

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('   END OF REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
