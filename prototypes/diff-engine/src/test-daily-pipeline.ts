#!/usr/bin/env node
/**
 * Test the full voting pipeline + volatile learning on daily-gap Wayback snapshots.
 *
 * Processes snapshots IN ORDER (simulating live monitoring):
 *   Snapshot 1: baseline
 *   Snapshot 2: compare to 1, run voting
 *   Snapshot 3: compare to 2, run voting + start building volatile field list
 *   Snapshot 4+: compare to previous, run voting + volatile learning active
 *
 * Reports FP rate before/after volatile learning kicks in.
 *
 * Usage:
 *   npx tsx src/test-daily-pipeline.ts
 *   npx tsx src/test-daily-pipeline.ts --db wayback-daily.db
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeText } from './normalizer.js';
import { diffReadability, diffTextOnly, diffStructural, diffRawHtml, type DiffResult } from './differ.js';
import { SEED_VOLATILE_PATTERNS } from './learning.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Types ──────────────────────────────────────────────────────────────────

interface SnapshotRow {
  id: number;
  url: string;
  timestamp: string;
  html: string;
  readability_text: string;
  text_only: string;
  structural_dom: string;
}

interface VolatilePattern {
  description: string;
  segment: string;         // the actual text/pattern
  changeCount: number;     // how many times it changed
  totalChecks: number;     // how many comparisons it was seen in
  changeRate: number;      // changeCount / totalChecks
}

interface UrlResult {
  url: string;
  snapshotCount: number;
  volatilePatterns: VolatilePattern[];
  comparisons: ComparisonResult[];
  fpBeforeLearning: number;   // FP count before volatile learning (snap 1-3)
  fpAfterLearning: number;    // FP count after volatile learning (snap 4+)
  totalBeforeLearning: number;
  totalAfterLearning: number;
  realChanges: number;
  learningActivatedAt: number; // snapshot index where learning activated
}

interface ComparisonResult {
  snapshotIndex: number;
  timestamp: string;
  prevTimestamp: string;
  votes: number;
  verdict: string;
  volatileLearningActive: boolean;
  volatileSegmentsStripped: number;
  strategyDetails: { strategy: string; votedYes: boolean; diffSize: number; noise: number }[];
  isFalsePositive: boolean;  // Our classification
  changeDescription: string;
}

// ─── Volatile Learning Engine ───────────────────────────────────────────────

const VOLATILITY_THRESHOLD = 0.85;  // if changes >= 85% of the time, it's volatile
const MIN_SNAPSHOTS_FOR_LEARNING = 3;

/**
 * Splits text into segments for volatility tracking.
 */
function textToSegments(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Incrementally track volatile segments.
 * This simulates the learning module — we track which segments change between
 * consecutive snapshots and build up change counts over time.
 */
class VolatileLearner {
  // segment -> { changeCount, seenCount }
  private segmentStats = new Map<string, { changeCount: number; seenCount: number }>();
  private comparisonCount = 0;
  private _volatilePatterns: string[] = [];

  addComparison(beforeText: string, afterText: string): void {
    const segsBefore = new Set(textToSegments(normalizeText(beforeText)));
    const segsAfter = new Set(textToSegments(normalizeText(afterText)));
    const allSegs = new Set([...segsBefore, ...segsAfter]);

    for (const seg of allSegs) {
      if (!this.segmentStats.has(seg)) {
        this.segmentStats.set(seg, { changeCount: 0, seenCount: 0 });
      }
      const stats = this.segmentStats.get(seg)!;
      stats.seenCount++;

      const inBefore = segsBefore.has(seg);
      const inAfter = segsAfter.has(seg);
      if (inBefore !== inAfter) {
        stats.changeCount++;
      }
    }

    this.comparisonCount++;
    this._recalculateVolatile();
  }

  private _recalculateVolatile(): void {
    this._volatilePatterns = [];
    for (const [seg, stats] of this.segmentStats) {
      if (stats.seenCount >= 2 && stats.changeCount / stats.seenCount >= VOLATILITY_THRESHOLD) {
        this._volatilePatterns.push(seg);
      }
    }
  }

  get volatilePatterns(): string[] {
    return this._volatilePatterns;
  }

  get isActive(): boolean {
    return this.comparisonCount >= MIN_SNAPSHOTS_FOR_LEARNING;
  }

  getDetailedPatterns(): VolatilePattern[] {
    const patterns: VolatilePattern[] = [];
    for (const [seg, stats] of this.segmentStats) {
      const rate = stats.changeCount / stats.seenCount;
      if (stats.seenCount >= 2 && rate >= VOLATILITY_THRESHOLD) {
        patterns.push({
          description: classifyVolatilePattern(seg),
          segment: seg.length > 100 ? seg.substring(0, 100) + '...' : seg,
          changeCount: stats.changeCount,
          totalChecks: stats.seenCount,
          changeRate: rate,
        });
      }
    }
    return patterns.sort((a, b) => b.changeRate - a.changeRate);
  }
}

/**
 * Attempt to classify what KIND of volatile pattern a segment is.
 */
function classifyVolatilePattern(segment: string): string {
  // CSS class hashes
  if (/\b(?:css|class|sn|sc)-[a-z0-9]{5,}/i.test(segment) ||
      /\b[a-z]{1,3}-[a-f0-9]{6,}/i.test(segment)) {
    return 'CSS class hash';
  }
  // Build/bundle IDs
  if (/(?:build|bundle|chunk|asset)\b/i.test(segment) ||
      /\.[a-f0-9]{8,}\.(?:js|css)/i.test(segment)) {
    return 'Build/bundle ID';
  }
  // Timestamps
  if (/\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(segment) ||
      /\d{10,13}/.test(segment) ||
      /(?:updated|modified|generated|rendered|built)\s+(?:at|on)/i.test(segment)) {
    return 'Timestamp/date';
  }
  // Script tag with hash
  if (/<script|src=["']/i.test(segment) && /[a-f0-9]{8,}/i.test(segment)) {
    return 'Script tag with hash';
  }
  // Search index / algolia / docsearch
  if (/(?:search|algolia|docsearch|index)/i.test(segment)) {
    return 'Search index hash';
  }
  // Nonce/token
  if (/(?:nonce|token|csrf|session)/i.test(segment)) {
    return 'Security token/nonce';
  }
  // Version string
  if (/(?:version|v\d|ver)\s*[:=]/i.test(segment)) {
    return 'Version string';
  }
  // Navigation/breadcrumb (long concatenated strings)
  if (segment.length > 200 && !/\s{2,}/.test(segment)) {
    return 'Navigation/sidebar concatenation';
  }
  // Footer content
  if (/(?:©|copyright|all rights reserved|privacy|terms)/i.test(segment)) {
    return 'Footer content';
  }
  // Analytics/tracking
  if (/(?:gtag|analytics|gtm|tracking|pixel)/i.test(segment)) {
    return 'Analytics/tracking';
  }
  // UUID-like
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(segment)) {
    return 'UUID/request ID';
  }

  return 'Unknown volatile pattern';
}

/**
 * Strip volatile segments from text.
 */
function stripVolatileSegments(text: string, volatilePatterns: string[]): string {
  if (volatilePatterns.length === 0) return text;
  const volatileSet = new Set(volatilePatterns);
  const lines = text.split('\n');
  return lines.filter(line => !volatileSet.has(line.trim())).join('\n');
}

// ─── Voting Pipeline (inline, works with any DB) ───────────────────────────

interface StrategyVote {
  strategy: string;
  votedYes: boolean;
  diffSize: number;
  noiseEstimate: number;
}

function castVote(diff: DiffResult): StrategyVote {
  let votedYes = false;

  switch (diff.strategy) {
    case 'raw_html':
      votedYes = diff.diffSize > 2 && diff.noiseEstimate < 0.5;
      break;
    case 'structural':
      votedYes = diff.diffSize > 2;
      break;
    case 'readability':
    case 'text_only':
    default:
      votedYes = diff.diffSize > 2;
      break;
  }

  return {
    strategy: diff.strategy,
    votedYes,
    diffSize: diff.diffSize,
    noiseEstimate: diff.noiseEstimate,
  };
}

type VoteVerdict = 'no_change' | 'suspicious' | 'likely_real' | 'definitely_real' | 'absolutely_real';

function getVerdict(votes: number): { verdict: VoteVerdict; confidence: number } {
  switch (votes) {
    case 0: return { verdict: 'no_change', confidence: 0 };
    case 1: return { verdict: 'suspicious', confidence: 0.3 };
    case 2: return { verdict: 'likely_real', confidence: 0.6 };
    case 3: return { verdict: 'definitely_real', confidence: 0.85 };
    case 4: return { verdict: 'absolutely_real', confidence: 1.0 };
    default: return { verdict: votes > 4 ? 'absolutely_real' : 'no_change', confidence: votes > 4 ? 1.0 : 0 };
  }
}

/**
 * Run voting pipeline on two snapshot data sets.
 * Optionally strips volatile segments before diffing.
 */
function runVoting(
  beforeReadability: string,
  afterReadability: string,
  beforeTextOnly: string,
  afterTextOnly: string,
  beforeStructural: string,
  afterStructural: string,
  beforeHtml: string,
  afterHtml: string,
  volatilePatterns: string[] = [],
): { votes: number; verdict: VoteVerdict; strategyVotes: StrategyVote[]; volatileStripped: number } {
  // Strip volatile segments if learning is active
  let effBeforeRead = beforeReadability;
  let effAfterRead = afterReadability;
  let effBeforeText = beforeTextOnly;
  let effAfterText = afterTextOnly;
  let effBeforeStruct = beforeStructural;
  let effAfterStruct = afterStructural;
  let volatileStripped = 0;

  if (volatilePatterns.length > 0) {
    const brLen = effBeforeRead.split('\n').length;
    effBeforeRead = stripVolatileSegments(effBeforeRead, volatilePatterns);
    effAfterRead = stripVolatileSegments(effAfterRead, volatilePatterns);
    effBeforeText = stripVolatileSegments(effBeforeText, volatilePatterns);
    effAfterText = stripVolatileSegments(effAfterText, volatilePatterns);
    effBeforeStruct = stripVolatileSegments(effBeforeStruct, volatilePatterns);
    effAfterStruct = stripVolatileSegments(effAfterStruct, volatilePatterns);
    volatileStripped = brLen - effBeforeRead.split('\n').length;
  }

  const diffs: DiffResult[] = [
    diffReadability(effBeforeRead, effAfterRead),
    diffTextOnly(effBeforeText, effAfterText),
    diffStructural(effBeforeStruct, effAfterStruct),
    diffRawHtml(beforeHtml, afterHtml), // Raw HTML not filtered by volatile learning
  ];

  const strategyVotes = diffs.map(d => castVote(d));
  const yesVotes = strategyVotes.filter(v => v.votedYes).length;
  const { verdict } = getVerdict(yesVotes);

  return { votes: yesVotes, verdict, strategyVotes, volatileStripped: Math.max(0, volatileStripped) };
}

// ─── FP Classification Heuristic ────────────────────────────────────────────

/**
 * Classify whether a detected change is likely a false positive.
 *
 * For daily snapshots, if readability and text_only show changes but structural doesn't,
 * AND the change is small, it's likely a dynamic element (timestamps, hashes, nav counters).
 *
 * Heuristic:
 * - If ONLY raw_html voted yes → FP (noise)
 * - If votes <= 1 → not a real detection, skip
 * - If readability diffSize <= 5 AND text_only diffSize <= 10 → likely FP (volatile noise)
 * - If ALL 4 strategies agree AND readability diffSize > 10 → real change
 */
function classifyAsFP(strategyVotes: StrategyVote[], totalVotes: number): { isFP: boolean; description: string } {
  if (totalVotes === 0) {
    return { isFP: false, description: 'No change detected' };
  }

  const readability = strategyVotes.find(v => v.strategy === 'readability');
  const textOnly = strategyVotes.find(v => v.strategy === 'text_only');
  const structural = strategyVotes.find(v => v.strategy === 'structural');
  const rawHtml = strategyVotes.find(v => v.strategy === 'raw_html');

  // Only raw_html voted → definitely noise
  if (totalVotes === 1 && rawHtml?.votedYes && !readability?.votedYes && !textOnly?.votedYes) {
    return { isFP: true, description: 'Only raw_html detected change (noise)' };
  }

  // Suspicious (1 vote) — usually noise
  if (totalVotes === 1) {
    return { isFP: true, description: 'Only 1 strategy voted (suspicious, likely noise)' };
  }

  // Small readability + text_only changes without structural → volatile content
  if (readability && textOnly && structural) {
    if (readability.diffSize <= 5 && textOnly.diffSize <= 15 && !structural.votedYes) {
      return { isFP: true, description: `Small text change (read=${readability.diffSize}, text=${textOnly.diffSize}) without structural change` };
    }
  }

  // If readability shows change and it's substantial
  if (readability?.votedYes && readability.diffSize > 10) {
    return { isFP: false, description: `Substantial readability change (${readability.diffSize} lines)` };
  }

  // 2+ votes with moderate diff sizes — could be either, classify conservatively
  if (totalVotes >= 2) {
    const maxDiffSize = Math.max(...strategyVotes.map(v => v.diffSize));
    if (maxDiffSize <= 10) {
      return { isFP: true, description: `${totalVotes} votes but small diff (max ${maxDiffSize} lines)` };
    }
    return { isFP: false, description: `${totalVotes} votes with diff size ${maxDiffSize}` };
  }

  return { isFP: false, description: 'Unclassified' };
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

function processUrl(db: Database.Database, url: string): UrlResult {
  // Get snapshots ordered chronologically
  const snapshots = db.prepare(`
    SELECT id, url, timestamp, html, readability_text, text_only, structural_dom
    FROM snapshots
    WHERE url = ? AND error IS NULL AND html != ''
    ORDER BY timestamp ASC
  `).all(url) as SnapshotRow[];

  const result: UrlResult = {
    url,
    snapshotCount: snapshots.length,
    volatilePatterns: [],
    comparisons: [],
    fpBeforeLearning: 0,
    fpAfterLearning: 0,
    totalBeforeLearning: 0,
    totalAfterLearning: 0,
    realChanges: 0,
    learningActivatedAt: MIN_SNAPSHOTS_FOR_LEARNING + 1,
  };

  if (snapshots.length < 2) {
    return result;
  }

  const learner = new VolatileLearner();

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const curr = snapshots[i];

    // Feed the learner (always, even before it's "active")
    learner.addComparison(prev.readability_text, curr.readability_text);

    const learningActive = learner.isActive;
    const volatilePatterns = learningActive ? learner.volatilePatterns : [];

    // Run voting pipeline
    const { votes, verdict, strategyVotes, volatileStripped } = runVoting(
      prev.readability_text,
      curr.readability_text,
      prev.text_only,
      curr.text_only,
      prev.structural_dom,
      curr.structural_dom,
      prev.html,
      curr.html,
      volatilePatterns,
    );

    // Classify as FP
    const { isFP, description } = classifyAsFP(strategyVotes, votes);

    const comparison: ComparisonResult = {
      snapshotIndex: i,
      timestamp: curr.timestamp,
      prevTimestamp: prev.timestamp,
      votes,
      verdict,
      volatileLearningActive: learningActive,
      volatileSegmentsStripped: volatileStripped,
      strategyDetails: strategyVotes.map(v => ({
        strategy: v.strategy,
        votedYes: v.votedYes,
        diffSize: v.diffSize,
        noise: v.noiseEstimate,
      })),
      isFalsePositive: isFP && votes >= 1,
      changeDescription: description,
    };

    result.comparisons.push(comparison);

    // Track FP rates before/after learning
    if (i <= MIN_SNAPSHOTS_FOR_LEARNING) {
      // Before learning
      result.totalBeforeLearning++;
      if (comparison.isFalsePositive) {
        result.fpBeforeLearning++;
      }
      if (votes >= 2 && !isFP) {
        result.realChanges++;
      }
    } else {
      // After learning
      result.totalAfterLearning++;
      if (comparison.isFalsePositive) {
        result.fpAfterLearning++;
      }
      if (votes >= 2 && !isFP) {
        result.realChanges++;
      }
    }
  }

  result.volatilePatterns = learner.getDetailedPatterns();
  return result;
}

// ─── Report ─────────────────────────────────────────────────────────────────

function generateReport(results: UrlResult[]): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('╔═══════════════════════════════════════════════════════════════════════╗');
  lines.push('║  DAILY-GAP VOLATILE LEARNING RESULTS                                 ║');
  lines.push('╚═══════════════════════════════════════════════════════════════════════╝');
  lines.push('');

  let totalSnapshots = 0;
  let totalVolatilePatterns = 0;
  let totalFPBefore = 0;
  let totalCompBefore = 0;
  let totalFPAfter = 0;
  let totalCompAfter = 0;
  let totalRealChanges = 0;
  let urlsWithVolatile = 0;

  for (const result of results) {
    totalSnapshots += result.snapshotCount;
    totalVolatilePatterns += result.volatilePatterns.length;
    totalFPBefore += result.fpBeforeLearning;
    totalCompBefore += result.totalBeforeLearning;
    totalFPAfter += result.fpAfterLearning;
    totalCompAfter += result.totalAfterLearning;
    totalRealChanges += result.realChanges;
    if (result.volatilePatterns.length > 0) urlsWithVolatile++;

    lines.push('─'.repeat(72));
    lines.push(`📦 ${result.url} (${result.snapshotCount} daily snapshots)`);
    lines.push('─'.repeat(72));

    if (result.snapshotCount < 2) {
      lines.push('  ⚠️  Not enough snapshots for comparison');
      lines.push('');
      continue;
    }

    // Volatile patterns
    lines.push(`  Volatile patterns found: ${result.volatilePatterns.length}`);
    if (result.volatilePatterns.length > 0) {
      for (const pat of result.volatilePatterns.slice(0, 10)) {
        lines.push(`    - ${pat.description}: "${pat.segment}" (changed ${pat.changeCount}/${pat.totalChecks} = ${(pat.changeRate * 100).toFixed(0)}%)`);
      }
      if (result.volatilePatterns.length > 10) {
        lines.push(`    ... and ${result.volatilePatterns.length - 10} more`);
      }
    }

    // FP rates
    const fpRateBefore = result.totalBeforeLearning > 0
      ? ((result.fpBeforeLearning / result.totalBeforeLearning) * 100).toFixed(1)
      : 'N/A';
    const fpRateAfter = result.totalAfterLearning > 0
      ? ((result.fpAfterLearning / result.totalAfterLearning) * 100).toFixed(1)
      : 'N/A';

    lines.push(`  FP rate (before learning, snap 1-${MIN_SNAPSHOTS_FOR_LEARNING}): ${fpRateBefore}% (${result.fpBeforeLearning}/${result.totalBeforeLearning})`);
    lines.push(`  FP rate (after learning, snap ${MIN_SNAPSHOTS_FOR_LEARNING + 1}+):  ${fpRateAfter}% (${result.fpAfterLearning}/${result.totalAfterLearning})`);
    lines.push(`  Real changes detected: ${result.realChanges}`);
    lines.push('');

    // Per-comparison details (compact)
    lines.push('  Comparisons:');
    for (const comp of result.comparisons) {
      const tsStr = comp.timestamp.substring(0, 8);
      const prevStr = comp.prevTimestamp.substring(0, 8);
      const volStr = comp.volatileLearningActive ? `vol:${comp.volatileSegmentsStripped}` : 'no-vol';
      const fpStr = comp.isFalsePositive ? '🔴FP' : (comp.votes >= 2 ? '🟢REAL' : '⚪skip');
      const voteDetail = comp.strategyDetails
        .map(s => `${s.strategy[0].toUpperCase()}:${s.votedYes ? '✓' : '✗'}(${s.diffSize})`)
        .join(' ');
      lines.push(`    [${comp.snapshotIndex}] ${prevStr}→${tsStr} | ${comp.votes}/4 ${comp.verdict} | ${volStr} | ${fpStr} | ${voteDetail}`);
    }
    lines.push('');
  }

  // Summary
  lines.push('═'.repeat(72));
  lines.push('  SUMMARY');
  lines.push('═'.repeat(72));

  const overallFPBefore = totalCompBefore > 0 ? ((totalFPBefore / totalCompBefore) * 100).toFixed(1) : 'N/A';
  const overallFPAfter = totalCompAfter > 0 ? ((totalFPAfter / totalCompAfter) * 100).toFixed(1) : 'N/A';
  const reduction = (totalCompBefore > 0 && totalCompAfter > 0)
    ? (((totalFPBefore / totalCompBefore) - (totalFPAfter / totalCompAfter)) / (totalFPBefore / totalCompBefore || 1) * 100).toFixed(1)
    : 'N/A';

  lines.push(`  Total snapshots processed: ${totalSnapshots}`);
  lines.push(`  Total comparisons: ${totalCompBefore + totalCompAfter}`);
  lines.push(`  Volatile patterns found: ${totalVolatilePatterns} across ${urlsWithVolatile} URLs`);
  lines.push(`  Real changes detected: ${totalRealChanges}`);
  lines.push('');
  lines.push(`  FP rate before learning: ${overallFPBefore}% (${totalFPBefore}/${totalCompBefore})`);
  lines.push(`  FP rate after learning:  ${overallFPAfter}% (${totalFPAfter}/${totalCompAfter})`);
  lines.push(`  FP reduction: ${reduction}%`);
  lines.push('');

  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let dbPath = path.resolve(__dirname, '..', 'wayback-daily.db');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) {
      dbPath = path.resolve(args[i + 1]);
      i++;
    }
  }

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Daily-Gap Pipeline Test — Volatile Learning                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`📦 Database: ${dbPath}`);

  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch (err: any) {
    console.error(`❌ Cannot open database: ${err.message}`);
    console.error(`   Run fetch-daily-wayback.ts first to populate the database.`);
    process.exit(1);
  }

  // Get all URLs
  const urls = db.prepare("SELECT DISTINCT url FROM snapshots ORDER BY url").all() as { url: string }[];
  console.log(`🌐 Found ${urls.length} URLs in database\n`);

  if (urls.length === 0) {
    console.log('❌ No data in database. Run fetch-daily-wayback.ts first.');
    db.close();
    process.exit(1);
  }

  const results: UrlResult[] = [];

  for (const { url } of urls) {
    console.log(`Processing: ${url}...`);
    const result = processUrl(db, url);
    results.push(result);
    console.log(`  → ${result.snapshotCount} snapshots, ${result.volatilePatterns.length} volatile patterns, ${result.realChanges} real changes`);
  }

  db.close();

  // Generate and print report
  const report = generateReport(results);
  console.log(report);

  // Also write to file
  const reportPath = path.resolve(__dirname, '..', 'daily-volatile-report.txt');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n📝 Report written to: ${reportPath}`);
}

main();
