#!/usr/bin/env node
/**
 * Wayback Machine Historical Diff Scraper + Testing Pipeline
 *
 * Commands:
 *   fetch    - Fetch CDX index + snapshot pairs for all 20 URLs
 *   diff     - Run diff engine on all pairs
 *   analyze  - Run LLM analysis on real changes
 *   report   - Generate summary report
 *   all      - Run everything end-to-end
 */

import { getDb, closeDb } from './db.js';
import { TARGET_URLS } from './targets.js';
import { fetchCdxIndex, selectPairs, fetchSnapshot, sleep } from './wayback.js';
import { extractReadability, extractTextOnly } from './extractor.js';
import { diffRawHtml, diffReadability, diffTextOnly } from './differ.js';
import { analyzeDiff } from './llm.js';
import { generateReport } from './report.js';

// ─── FETCH COMMAND ───────────────────────────────────────────────────────────

async function cmdFetch() {
  const db = getDb();
  console.log('📥 Fetching Wayback Machine snapshots for 20 URLs...\n');

  const insertCdx = db.prepare('INSERT OR IGNORE INTO cdx_index (url, timestamp, status_code) VALUES (?, ?, ?)');
  const insertSnap = db.prepare('INSERT OR IGNORE INTO snapshots (url, timestamp, html, readability_text, text_only) VALUES (?, ?, ?, ?, ?)');
  const checkSnap = db.prepare('SELECT 1 FROM snapshots WHERE url = ? AND timestamp = ? AND html IS NOT NULL');

  let totalFetched = 0;
  let totalErrors = 0;

  for (const target of TARGET_URLS) {
    console.log(`\n🔍 [${target.category}] ${target.name}: ${target.url}`);

    try {
      // Step 1: Fetch CDX index
      const timestamps = await fetchCdxIndex(target.url);
      console.log(`  Found ${timestamps.length} snapshots in CDX`);

      if (timestamps.length === 0) {
        console.log(`  ⚠ No snapshots available`);
        continue;
      }

      // Store CDX entries
      const insertMany = db.transaction((entries: [string, string][]) => {
        for (const [ts, _] of entries) {
          insertCdx.run(target.url, ts, '200');
        }
      });
      insertMany(timestamps.map(ts => [ts, '200'] as [string, string]));

      // Step 2: Select pairs
      const pairs = selectPairs(timestamps, 15);
      console.log(`  Selected ${pairs.length} pairs (2-4 week gaps)`);

      // Step 3: Fetch snapshot pairs
      const uniqueTimestamps = new Set<string>();
      for (const [old, newer] of pairs) {
        uniqueTimestamps.add(old);
        uniqueTimestamps.add(newer);
      }

      let fetched = 0;
      for (const ts of uniqueTimestamps) {
        // Skip if already fetched
        const existing = checkSnap.get(target.url, ts);
        if (existing) {
          fetched++;
          continue;
        }

        try {
          console.log(`  Fetching ${ts}...`);
          const html = await fetchSnapshot(ts, target.url);

          // Extract readability and text
          const readabilityText = extractReadability(html, target.url);
          const textOnly = extractTextOnly(html);

          insertSnap.run(target.url, ts, html, readabilityText, textOnly);
          fetched++;
          totalFetched++;

          // Rate limiting
          await sleep(1200);
        } catch (e: any) {
          console.log(`  ⚠ Error fetching ${ts}: ${e.message}`);
          insertSnap.run(target.url, ts, null, null, null);
          totalErrors++;
          await sleep(2000);
        }
      }

      console.log(`  ✅ ${fetched}/${uniqueTimestamps.size} snapshots ready`);
      await sleep(1000); // extra pause between URLs

    } catch (e: any) {
      console.log(`  ❌ Error: ${e.message}`);
      totalErrors++;
      await sleep(3000);
    }
  }

  console.log(`\n✅ Fetch complete: ${totalFetched} new snapshots fetched, ${totalErrors} errors`);
}

// ─── DIFF COMMAND ────────────────────────────────────────────────────────────

async function cmdDiff() {
  const db = getDb();
  console.log('🔄 Running diff engine on all pairs...\n');

  const insertDiff = db.prepare(`
    INSERT OR IGNORE INTO diff_pairs (url, ts_old, ts_new, strategy, has_change, noise_estimate, diff_size, added_lines, removed_lines, diff_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalPairs = 0;
  let totalChanges = 0;

  for (const target of TARGET_URLS) {
    // Get all pairs from CDX index
    const cdxTimestamps = (db.prepare('SELECT timestamp FROM cdx_index WHERE url = ? ORDER BY timestamp').all(target.url) as any[]).map(r => r.timestamp);
    const pairs = selectPairs(cdxTimestamps, 15);

    if (pairs.length === 0) continue;

    console.log(`📄 ${target.name}: ${pairs.length} pairs`);

    for (const [tsOld, tsNew] of pairs) {
      const oldSnap = db.prepare('SELECT html, readability_text, text_only FROM snapshots WHERE url = ? AND timestamp = ? AND html IS NOT NULL').get(target.url, tsOld) as any;
      const newSnap = db.prepare('SELECT html, readability_text, text_only FROM snapshots WHERE url = ? AND timestamp = ? AND html IS NOT NULL').get(target.url, tsNew) as any;

      if (!oldSnap || !newSnap) continue;

      totalPairs++;

      // Run 3 strategies
      const strategies = [
        () => diffRawHtml(oldSnap.html, newSnap.html),
        () => diffReadability(oldSnap.readability_text || '', newSnap.readability_text || ''),
        () => diffTextOnly(oldSnap.text_only || '', newSnap.text_only || ''),
      ];

      for (const runStrategy of strategies) {
        const result = runStrategy();
        if (result.changed) totalChanges++;

        insertDiff.run(
          target.url, tsOld, tsNew, result.strategy,
          result.changed ? 1 : 0, result.noiseEstimate,
          result.diffSize, result.addedLines, result.removedLines,
          result.changed ? result.patch : null
        );
      }
    }
  }

  console.log(`\n✅ Diff complete: ${totalPairs} pairs processed, ${totalChanges} changes detected`);
}

// ─── ANALYZE COMMAND ─────────────────────────────────────────────────────────

async function cmdAnalyze() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not set');
    process.exit(1);
  }

  const db = getDb();
  console.log('🧠 Running LLM analysis on real changes...\n');

  // Get diff pairs with real changes (noise < 90%), text_only strategy preferred
  const realChanges = db.prepare(`
    SELECT dp.id, dp.url, dp.ts_old, dp.ts_new, dp.diff_text, dp.noise_estimate
    FROM diff_pairs dp
    WHERE dp.has_change = 1 AND dp.noise_estimate < 0.9 AND dp.strategy = 'text_only'
    AND NOT EXISTS (SELECT 1 FROM llm_results lr WHERE lr.pair_id = dp.id)
    ORDER BY dp.url, dp.ts_old
  `).all() as any[];

  console.log(`Found ${realChanges.length} pairs needing LLM analysis\n`);

  const insertLlm = db.prepare(`
    INSERT INTO llm_results (pair_id, model, severity, is_breaking, what_changed, confidence, action_required, raw_response, cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalCost = 0;
  let analyzed = 0;

  for (const change of realChanges) {
    console.log(`  Analyzing ${change.url} ${change.ts_old} → ${change.ts_new} (noise=${(change.noise_estimate * 100).toFixed(0)}%)...`);

    // Get before/after text
    const oldSnap = db.prepare('SELECT text_only FROM snapshots WHERE url = ? AND timestamp = ?').get(change.url, change.ts_old) as any;
    const newSnap = db.prepare('SELECT text_only FROM snapshots WHERE url = ? AND timestamp = ?').get(change.url, change.ts_new) as any;

    try {
      const result = await analyzeDiff(
        apiKey,
        change.diff_text || '',
        oldSnap?.text_only || '',
        newSnap?.text_only || '',
      );

      insertLlm.run(
        change.id, result.model, result.severity,
        result.is_breaking ? 1 : 0, result.what_changed,
        result.confidence, result.action_required,
        result.raw_response, result.cost
      );

      totalCost += result.cost;
      analyzed++;

      const breaking = result.is_breaking ? '🔴 BREAKING' : '🟢';
      console.log(`    ${breaking} [${result.severity}] ${result.what_changed.substring(0, 80)} (${result.model}, $${result.cost.toFixed(4)})`);

      // Small delay between API calls
      await sleep(500);
    } catch (e: any) {
      console.log(`    ⚠ LLM error: ${e.message}`);
      await sleep(2000);
    }
  }

  console.log(`\n✅ Analysis complete: ${analyzed} pairs analyzed, total cost $${totalCost.toFixed(4)}`);
}

// ─── REPORT COMMAND ──────────────────────────────────────────────────────────

async function cmdReport() {
  getDb(); // ensure initialized
  const report = generateReport();
  console.log(report);

  // Also save to file
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const reportPath = path.resolve(__dirname, '..', 'report.txt');
  fs.writeFileSync(reportPath, report);
  console.log(`\n📝 Report saved to ${reportPath}`);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  const command = process.argv[2] || 'all';

  try {
    switch (command) {
      case 'fetch':
        await cmdFetch();
        break;
      case 'diff':
        await cmdDiff();
        break;
      case 'analyze':
        await cmdAnalyze();
        break;
      case 'report':
        await cmdReport();
        break;
      case 'all':
        await cmdFetch();
        await cmdDiff();
        await cmdAnalyze();
        await cmdReport();
        break;
      default:
        console.log(`Unknown command: ${command}`);
        console.log('Usage: npx tsx src/index.ts [fetch|diff|analyze|report|all]');
        process.exit(1);
    }
  } finally {
    closeDb();
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
