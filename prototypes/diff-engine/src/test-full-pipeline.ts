#!/usr/bin/env node
/**
 * Full End-to-End Pipeline Test
 *
 * Runs ALL layers against Wayback historical data:
 *   1. Voting pipeline (4 strategies)
 *   2. Confirmation simulation (check if change persists in next pair)
 *   3. Volatile field learning (after 3+ snapshots per URL)
 *   4. Section extraction (for URLs where we know the endpoint)
 *
 * Reports comparative FP rates for each layer combination.
 *
 * Usage:
 *   npx tsx src/test-full-pipeline.ts                           # Run on all available DBs
 *   npx tsx src/test-full-pipeline.ts --db <path>               # Use specific DB
 *   npx tsx src/test-full-pipeline.ts --verbose                 # Show per-pair details
 *   npx tsx src/test-full-pipeline.ts --url <filter>            # Filter by URL
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import {
  runVotingPipeline,
  simulateConfirmation,
  formatVotingResult,
  type VotingResult,
  type SnapshotData,
  type PipelineOptions,
} from './pipeline.js';
import { normalizeText } from './normalizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI Args ───────────────────────────────────────────────────────────────

interface TestArgs {
  dbPaths: string[];
  urlFilter?: string;
  verbose: boolean;
}

function parseArgs(): TestArgs {
  const args = process.argv.slice(2);
  const dbPaths: string[] = [];
  let urlFilter: string | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) {
      dbPaths.push(path.resolve(args[i + 1]));
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      urlFilter = args[i + 1];
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  // If no DBs specified, try all known locations
  if (dbPaths.length === 0) {
    const candidates = [
      path.resolve(__dirname, '../../wayback-tester/wayback.db'),
      path.resolve(__dirname, '..', 'wayback-new.db'),
      path.resolve(__dirname, '..', 'wayback-extended.db'),
    ];
    for (const p of candidates) {
      try {
        const db = new Database(p, { readonly: true });
        const cnt = db.prepare("SELECT COUNT(*) as cnt FROM snapshots").get() as any;
        if (cnt.cnt > 0) dbPaths.push(p);
        db.close();
      } catch {
        // DB doesn't exist or isn't valid
      }
    }
  }

  return { dbPaths, urlFilter, verbose };
}

// ─── Content Extraction (for DBs that may have raw HTML but missing fields) ─

function extractReadability(html: string, url: string): string {
  try {
    const dom = new JSDOM(html, { url: `https://${url}` });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    const text = article?.textContent?.trim() || '';
    dom.window.close();
    return text;
  } catch {
    return '';
  }
}

function extractTextOnly(html: string): string {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    doc.querySelectorAll('script, style, noscript, svg').forEach((el: Element) => el.remove());
    const text = doc.body?.textContent?.trim() || '';
    dom.window.close();
    return text;
  } catch {
    return '';
  }
}

function extractStructuralDom(html: string): string {
  if (html.length > 1_000_000) return '';
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    function walkNode(node: Node, depth: number): string {
      if (depth > 50) return '';
      if (node.nodeType === 3 || node.nodeType !== 1) return '';
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (['script', 'style', 'svg', 'noscript', 'link', 'meta'].includes(tag)) return '';
      const indent = '  '.repeat(depth);
      const children = Array.from(el.childNodes)
        .map(child => walkNode(child, depth + 1))
        .filter(Boolean)
        .join('\n');
      const attrs: string[] = [];
      for (const attr of ['role', 'aria-label', 'type', 'rel']) {
        if (el.hasAttribute(attr)) {
          let val = el.getAttribute(attr) || '';
          if (val.length > 50) val = val.substring(0, 50) + '...';
          attrs.push(`${attr}="${val}"`);
        }
      }
      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
      if (children) return `${indent}<${tag}${attrStr}>\n${children}\n${indent}</${tag}>`;
      return `${indent}<${tag}${attrStr}/>`;
    }

    const result = walkNode(doc.documentElement, 0);
    dom.window.close();
    return result;
  } catch {
    return '';
  }
}

// ─── Volatile Learning Simulation ───────────────────────────────────────────

/**
 * Analyze snapshots to discover volatile segments (segments that change >90% of the time).
 * This is a standalone implementation that works on raw snapshot arrays, not the DB.
 */
function analyzeVolatilityFromSnapshots(
  snapshots: Array<{ readabilityText: string }>,
  minSnapshots: number = 3,
): string[] {
  if (snapshots.length < minSnapshots) return [];

  const segmentChangeCounts = new Map<string, number>();
  const segmentSeenCounts = new Map<string, number>();
  let totalComparisons = 0;

  for (let i = 0; i < snapshots.length - 1; i++) {
    const before = normalizeText(snapshots[i].readabilityText);
    const after = normalizeText(snapshots[i + 1].readabilityText);

    const segsBefore = new Set(before.split('\n').map(l => l.trim()).filter(l => l.length > 0));
    const segsAfter = new Set(after.split('\n').map(l => l.trim()).filter(l => l.length > 0));
    const allSegs = new Set([...segsBefore, ...segsAfter]);

    for (const seg of allSegs) {
      segmentSeenCounts.set(seg, (segmentSeenCounts.get(seg) || 0) + 1);
      if (segsBefore.has(seg) !== segsAfter.has(seg)) {
        segmentChangeCounts.set(seg, (segmentChangeCounts.get(seg) || 0) + 1);
      }
    }
    totalComparisons++;
  }

  if (totalComparisons === 0) return [];

  const volatileSegments: string[] = [];
  for (const [seg, changeCount] of segmentChangeCounts) {
    const seenCount = segmentSeenCounts.get(seg) || 1;
    const changeRate = changeCount / seenCount;
    if (changeRate >= 0.9 && seenCount >= 2) {
      volatileSegments.push(seg);
    }
  }

  return volatileSegments;
}

// ─── Per-Pair Result ────────────────────────────────────────────────────────

interface PairResult {
  url: string;
  tsOld: string;
  tsNew: string;
  votingResult: VotingResult;
  // Layers applied after voting
  confirmed: boolean;               // Layer 2 simulation
  volatileFiltered: boolean;        // Whether volatile filtering was applied
  volatileFieldsStripped: number;   // How many volatile segments stripped
  votingResultWithVolatile?: VotingResult; // Result WITH volatile filtering
}

// ─── FP Classification ──────────────────────────────────────────────────────

function classifyFP(result: VotingResult): 'likely_real' | 'possible_fp' | 'uncertain' {
  const votes = result.strategyVotes;
  const readVoted = votes.find(v => v.strategy === 'readability')?.votedYes;
  const textVoted = votes.find(v => v.strategy === 'text_only')?.votedYes;

  if (readVoted && textVoted) return 'likely_real';
  if (!readVoted && !textVoted) return 'possible_fp';
  return 'uncertain';
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { dbPaths, urlFilter, verbose } = parseArgs();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Full Pipeline Test — Voting + Confirmation + Learning       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  if (dbPaths.length === 0) {
    console.error('❌ No databases found. Run fetch-new-wayback.ts or fetch-extended-wayback.ts first.');
    process.exit(1);
  }

  console.log(`📦 Databases: ${dbPaths.length}`);
  for (const p of dbPaths) console.log(`   ${p}`);
  if (urlFilter) console.log(`🔍 Filter: ${urlFilter}`);
  console.log('');

  const startTime = Date.now();
  const allResults: PairResult[] = [];

  // Process each DB
  for (const dbPath of dbPaths) {
    console.log(`\n${'━'.repeat(65)}`);
    console.log(`📦 Processing: ${path.basename(dbPath)}`);
    console.log('━'.repeat(65));

    let db: Database.Database;
    try {
      db = new Database(dbPath, { readonly: true });
    } catch (err: any) {
      console.error(`  ❌ Cannot open: ${err.message}`);
      continue;
    }

    // Detect schema
    const cols = db.prepare('PRAGMA table_info(snapshots)').all() as any[];
    const colNames = cols.map((c: any) => c.name);
    const htmlCol = colNames.includes('html') ? 'html' : colNames.includes('raw_html') ? 'raw_html' : null;
    if (!htmlCol) {
      console.error(`  ❌ No html column found`);
      db.close();
      continue;
    }

    // Get URLs
    let urls: { url: string }[];
    if (urlFilter) {
      urls = db.prepare("SELECT DISTINCT url FROM snapshots WHERE url LIKE ? ORDER BY url")
        .all(`%${urlFilter}%`) as any[];
    } else {
      urls = db.prepare("SELECT DISTINCT url FROM snapshots ORDER BY url").all() as any[];
    }

    console.log(`  📊 ${urls.length} URLs`);

    const MAX_RAW_HTML = 200_000;

    for (const { url } of urls) {
      // Load all snapshots for this URL
      const snapMeta = db.prepare(
        `SELECT id, timestamp FROM snapshots WHERE url = ? ORDER BY timestamp ASC`
      ).all(url) as { id: number; timestamp: string }[];

      if (snapMeta.length < 2) continue;

      const shortUrl = url.length > 50 ? url.substring(0, 50) + '…' : url;
      if (verbose) console.log(`\n  📄 ${shortUrl} (${snapMeta.length} snapshots)`);

      // Collect all snapshot data for volatile analysis
      const allSnapData: Array<{ readabilityText: string }> = [];

      // First pass: collect readability text for volatile analysis
      for (const meta of snapMeta) {
        const row = db.prepare(
          `SELECT readability_text FROM snapshots WHERE id = ?`
        ).get(meta.id) as any;
        allSnapData.push({ readabilityText: row?.readability_text || '' });
      }

      // Run volatile analysis on accumulated snapshots (simulating gradual learning)
      const urlPairResults: VotingResult[] = [];
      const urlPairResultsWithVolatile: VotingResult[] = [];

      for (let i = 0; i < snapMeta.length - 1; i++) {
        const oldId = snapMeta[i].id;
        const newId = snapMeta[i + 1].id;
        const tsOld = snapMeta[i].timestamp;
        const tsNew = snapMeta[i + 1].timestamp;

        // Check HTML sizes
        const oldSizeRow = db.prepare(
          `SELECT length(${htmlCol}) as html_len FROM snapshots WHERE id = ?`
        ).get(oldId) as any;
        const newSizeRow = db.prepare(
          `SELECT length(${htmlCol}) as html_len FROM snapshots WHERE id = ?`
        ).get(newId) as any;
        const isLarge = (oldSizeRow?.html_len || 0) > MAX_RAW_HTML || (newSizeRow?.html_len || 0) > MAX_RAW_HTML;

        let beforeData: SnapshotData;
        let afterData: SnapshotData;

        if (isLarge) {
          const oldSnap = db.prepare(
            `SELECT readability_text, text_only FROM snapshots WHERE id = ?`
          ).get(oldId) as any;
          const newSnap = db.prepare(
            `SELECT readability_text, text_only FROM snapshots WHERE id = ?`
          ).get(newId) as any;
          beforeData = {
            rawHtml: '',
            readabilityText: oldSnap?.readability_text || '',
            structuralDom: '',
            textOnly: oldSnap?.text_only || '',
          };
          afterData = {
            rawHtml: '',
            readabilityText: newSnap?.readability_text || '',
            structuralDom: '',
            textOnly: newSnap?.text_only || '',
          };
        } else {
          const hasStructural = colNames.includes('structural_dom');
          const structCol = hasStructural ? ', structural_dom' : '';
          const oldSnap = db.prepare(
            `SELECT ${htmlCol} as html, readability_text, text_only${structCol} FROM snapshots WHERE id = ?`
          ).get(oldId) as any;
          const newSnap = db.prepare(
            `SELECT ${htmlCol} as html, readability_text, text_only${structCol} FROM snapshots WHERE id = ?`
          ).get(newId) as any;

          const oldHtml = oldSnap?.html || '';
          const newHtml = newSnap?.html || '';

          beforeData = {
            rawHtml: oldHtml,
            readabilityText: oldSnap?.readability_text || extractReadability(oldHtml, url),
            structuralDom: hasStructural ? (oldSnap?.structural_dom || '') : extractStructuralDom(oldHtml),
            textOnly: oldSnap?.text_only || extractTextOnly(oldHtml),
          };
          afterData = {
            rawHtml: newHtml,
            readabilityText: newSnap?.readability_text || extractReadability(newHtml, url),
            structuralDom: hasStructural ? (newSnap?.structural_dom || '') : extractStructuralDom(newHtml),
            textOnly: newSnap?.text_only || extractTextOnly(newHtml),
          };
        }

        // Run voting pipeline WITHOUT volatile filtering (baseline)
        const baseResult = runVotingPipeline(beforeData, afterData);
        urlPairResults.push(baseResult);

        // Run voting pipeline WITH volatile filtering (if enough snapshots)
        // Use snapshots 0..i+1 (all snapshots up to and including the "after" snapshot)
        const snapshotsForLearning = allSnapData.slice(0, i + 2);
        let volatilePatterns: string[] = [];
        let volatileResult = baseResult;

        if (snapshotsForLearning.length >= 3) {
          volatilePatterns = analyzeVolatilityFromSnapshots(snapshotsForLearning, 3);
          if (volatilePatterns.length > 0) {
            volatileResult = runVotingPipeline(beforeData, afterData, {
              url,
              enableVolatileFiltering: true,
              volatilePatterns,
            });
          }
        }
        urlPairResultsWithVolatile.push(volatileResult);

        if (verbose) {
          const volInfo = volatilePatterns.length > 0 ? ` [vol:${volatilePatterns.length}]` : '';
          console.log(`    ${tsOld}→${tsNew}: ${formatVotingResult(baseResult, true)}${volInfo}`);
        }
      }

      // Simulate confirmation for this URL's pairs
      const baseConfirmed = simulateConfirmation(urlPairResults);
      const volatileConfirmed = simulateConfirmation(urlPairResultsWithVolatile);

      // Store results
      for (let i = 0; i < urlPairResults.length; i++) {
        const snapshotsForLearning = allSnapData.slice(0, i + 2);
        const volatilePatterns = snapshotsForLearning.length >= 3
          ? analyzeVolatilityFromSnapshots(snapshotsForLearning, 3)
          : [];

        allResults.push({
          url,
          tsOld: snapMeta[i].timestamp,
          tsNew: snapMeta[i + 1].timestamp,
          votingResult: urlPairResults[i],
          confirmed: baseConfirmed[i],
          volatileFiltered: volatilePatterns.length > 0,
          volatileFieldsStripped: volatilePatterns.length,
          votingResultWithVolatile: urlPairResultsWithVolatile[i],
        });
      }
    }

    db.close();
  }

  const elapsed = Date.now() - startTime;

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  console.log('\n' + '═'.repeat(65));
  console.log('  VOTE DISTRIBUTION (Baseline — No Extra Layers)');
  console.log('═'.repeat(65));

  const voteDist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of allResults) {
    voteDist[Math.min(r.votingResult.votes, 4)]++;
  }
  const labels: Record<number, string> = { 0: 'no change', 1: 'suspicious', 2: 'likely real', 3: 'definite', 4: 'absolute' };
  for (let v = 0; v <= 4; v++) {
    const count = voteDist[v];
    const pct = allResults.length > 0 ? ((count / allResults.length) * 100).toFixed(1) : '0.0';
    const bar = '█'.repeat(Math.round(count / Math.max(1, allResults.length) * 40));
    console.log(`  ${v} votes (${labels[v].padEnd(12)}): ${String(count).padStart(4)} pairs (${pct.padStart(5)}%) ${bar}`);
  }

  // ── Layer-by-layer comparison ──
  console.log('\n' + '═'.repeat(65));
  console.log('  FULL PIPELINE RESULTS');
  console.log('═'.repeat(65));

  const totalPairs = allResults.length;

  // Voting only (baseline)
  const votingDetected = allResults.filter(r => r.votingResult.votes >= 2);
  const votingFPCount = votingDetected.filter(r => classifyFP(r.votingResult) === 'possible_fp').length;

  // Voting + confirmation
  const confirmedDetected = allResults.filter(r => r.votingResult.votes >= 2 && r.confirmed);
  const filteredByConfirmation = votingDetected.length - confirmedDetected.length;
  const confirmedFPCount = confirmedDetected.filter(r => classifyFP(r.votingResult) === 'possible_fp').length;

  // Voting + confirmation + volatile learning
  const volatileDetected = allResults.filter(r => {
    const vr = r.votingResultWithVolatile || r.votingResult;
    return vr.votes >= 2;
  });
  const volatileConfirmedDetected = allResults.filter(r => {
    const vr = r.votingResultWithVolatile || r.votingResult;
    return vr.votes >= 2 && r.confirmed;
  });
  const filteredByVolatile = votingDetected.length - volatileDetected.length;
  const volatileConfirmedFPCount = volatileConfirmedDetected.filter(r => {
    const vr = r.votingResultWithVolatile || r.votingResult;
    return classifyFP(vr) === 'possible_fp';
  }).length;

  console.log(`  Total pairs tested:                 ${totalPairs}`);
  console.log(`  Changes detected (voting 2+):       ${votingDetected.length}`);
  console.log(`  Confirmed changes:                  ${confirmedDetected.length}`);
  console.log(`  Filtered by confirmation:           ${filteredByConfirmation}`);
  console.log(`  Filtered by volatile learning:      ${filteredByVolatile}`);

  const finalDetected = volatileConfirmedDetected.length;
  const finalFP = volatileConfirmedFPCount;
  const finalFPRate = finalDetected > 0 ? ((finalFP / finalDetected) * 100).toFixed(1) : '0.0';
  console.log(`  Final actionable changes:           ${finalDetected}`);
  console.log(`  Final false positive rate:           ${finalFPRate}%`);

  // ── Comparison table ──
  console.log('\n' + '═'.repeat(65));
  console.log('  COMPARISON');
  console.log('═'.repeat(65));

  const votingFPRate = votingDetected.length > 0
    ? ((votingFPCount / votingDetected.length) * 100).toFixed(1) : '0.0';
  const confirmFPRate = confirmedDetected.length > 0
    ? ((confirmedFPCount / confirmedDetected.length) * 100).toFixed(1) : '0.0';
  const fullFPRate = volatileConfirmedDetected.length > 0
    ? ((volatileConfirmedFPCount / volatileConfirmedDetected.length) * 100).toFixed(1) : '0.0';

  console.log(`  Voting only:                          FP ${votingFPRate}%  (${votingDetected.length} detected, ${votingFPCount} possible FP)`);
  console.log(`  Voting + confirmation:                FP ${confirmFPRate}%  (${confirmedDetected.length} detected, ${confirmedFPCount} possible FP)`);
  console.log(`  Voting + confirmation + learning:     FP ${fullFPRate}%  (${volatileConfirmedDetected.length} detected, ${volatileConfirmedFPCount} possible FP)`);

  // ── Confirmation impact breakdown ──
  console.log('\n' + '─'.repeat(65));
  console.log('  CONFIRMATION IMPACT');
  console.log('─'.repeat(65));

  const unconfirmedChanges = allResults.filter(r => r.votingResult.votes >= 2 && !r.confirmed);
  if (unconfirmedChanges.length > 0) {
    console.log(`  ${unconfirmedChanges.length} changes filtered as "unconfirmed" (likely transient):`);
    const unconfByUrl = new Map<string, number>();
    for (const r of unconfirmedChanges) {
      unconfByUrl.set(r.url, (unconfByUrl.get(r.url) || 0) + 1);
    }
    for (const [url, count] of [...unconfByUrl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      const shortUrl = url.length > 45 ? url.substring(0, 45) + '…' : url;
      console.log(`    ${shortUrl}: ${count}`);
    }
  } else {
    console.log(`  No changes filtered by confirmation (all changes persisted)`);
  }

  // ── Volatile learning impact ──
  console.log('\n' + '─'.repeat(65));
  console.log('  VOLATILE LEARNING IMPACT');
  console.log('─'.repeat(65));

  const urlsWithVolatile = new Set<string>();
  const volatileChanges = allResults.filter(r => {
    if (!r.volatileFiltered) return false;
    const baseVotes = r.votingResult.votes;
    const volVotes = r.votingResultWithVolatile?.votes ?? baseVotes;
    if (baseVotes >= 2 && volVotes < 2) {
      urlsWithVolatile.add(r.url);
      return true;
    }
    return false;
  });

  if (volatileChanges.length > 0) {
    console.log(`  ${volatileChanges.length} changes downgraded by volatile filtering across ${urlsWithVolatile.size} URLs:`);
    for (const url of urlsWithVolatile) {
      const shortUrl = url.length > 45 ? url.substring(0, 45) + '…' : url;
      const count = volatileChanges.filter(r => r.url === url).length;
      console.log(`    ${shortUrl}: ${count}`);
    }
  } else {
    console.log(`  No changes downgraded by volatile learning`);
    console.log(`  (This is expected if all changes were genuine content changes, not volatile noise)`);
  }

  // ── Per-URL summary ──
  console.log('\n' + '═'.repeat(65));
  console.log('  PER-URL SUMMARY');
  console.log('═'.repeat(65));

  const urlGroups = new Map<string, PairResult[]>();
  for (const r of allResults) {
    if (!urlGroups.has(r.url)) urlGroups.set(r.url, []);
    urlGroups.get(r.url)!.push(r);
  }

  for (const [url, prs] of urlGroups) {
    const shortUrl = url.length > 48 ? url.substring(0, 48) + '…' : url;
    const detected = prs.filter(p => p.votingResult.votes >= 2).length;
    const confirmed = prs.filter(p => p.votingResult.votes >= 2 && p.confirmed).length;
    const volFiltered = prs.filter(p => {
      const bv = p.votingResult.votes;
      const vv = p.votingResultWithVolatile?.votes ?? bv;
      return bv >= 2 && vv < 2;
    }).length;

    console.log(`  ${shortUrl}`);
    console.log(`    Pairs: ${prs.length} | Detected: ${detected} | Confirmed: ${confirmed} | Vol.filtered: ${volFiltered}`);
  }

  // ── Timing ──
  console.log('\n' + '═'.repeat(65));
  console.log(`  ⏱️  Processed ${allResults.length} pairs in ${(elapsed / 1000).toFixed(1)}s`);
  console.log('═'.repeat(65));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
