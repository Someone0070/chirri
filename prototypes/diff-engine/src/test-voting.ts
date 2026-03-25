#!/usr/bin/env node
/**
 * Test the voting pipeline against Wayback Machine historical data.
 *
 * Loads snapshot pairs from the wayback.db and runs each through the
 * voting pipeline. Compares old approach (readability-only) vs new (voting).
 *
 * Usage:
 *   npx tsx src/test-voting.ts                  # Run against all pairs
 *   npx tsx src/test-voting.ts --url <partial>  # Filter by URL substring
 *   npx tsx src/test-voting.ts --verbose        # Show per-pair details
 *   npx tsx src/test-voting.ts --db <path>      # Use alternate DB path
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { runVotingPipeline, formatVotingResult, type VotingResult, type VoteVerdict } from './pipeline.js';
import { normalizeHtml, normalizeText } from './normalizer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI Args ───────────────────────────────────────────────────────────────

interface TestArgs {
  dbPath: string;
  urlFilter?: string;
  verbose: boolean;
}

function parseArgs(): TestArgs {
  const args = process.argv.slice(2);
  let dbPath = path.resolve(__dirname, '../../wayback-tester/wayback.db');
  let urlFilter: string | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) {
      dbPath = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      urlFilter = args[i + 1];
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    }
  }

  return { dbPath, urlFilter, verbose };
}

// ─── Wayback DB Access ──────────────────────────────────────────────────────

interface WaybackSnapshot {
  id: number;
  url: string;
  timestamp: string;
  html: string;
  readability_text: string;
  text_only: string;
  // camelCase aliases (may be present from some DBs)
  readabilityText?: string;
  textOnly?: string;
}

/**
 * Extract structural DOM from HTML (same as fetcher.ts).
 * Skip for pages > 1MB to avoid OOM with JSDOM.
 */
function extractStructuralDom(html: string): string {
  // Skip structural extraction for very large pages (OOM risk)
  if (html.length > 1_000_000) return '';
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    function walkNode(node: Node, depth: number): string {
      if (depth > 50) return ''; // Prevent stack overflow on deeply nested docs
      if (node.nodeType === 3) return '';
      if (node.nodeType !== 1) return '';

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

      if (children) {
        return `${indent}<${tag}${attrStr}>\n${children}\n${indent}</${tag}>`;
      }
      return `${indent}<${tag}${attrStr}/>`;
    }

    const result = walkNode(doc.documentElement, 0);
    // Free JSDOM memory explicitly
    dom.window.close();
    return result;
  } catch {
    return '';
  }
}

/**
 * Extract readability text from HTML
 */
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

/**
 * Extract text-only from HTML
 */
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

// Pairs are now processed inline URL-by-URL to manage memory

// ─── Comparison Logic ───────────────────────────────────────────────────────

interface OldApproachResult {
  detected: boolean;
  readabilityChanged: boolean;
  readabilityDiffSize: number;
}

interface PairResult {
  url: string;
  tsOld: string;
  tsNew: string;
  oldApproach: OldApproachResult;
  votingResult: VotingResult;
  agreement: boolean; // Did old approach and new approach agree?
  upgraded: boolean;  // New approach detected something old didn't
  downgraded: boolean; // Old approach detected something new didn't
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { dbPath, urlFilter, verbose } = parseArgs();

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Voting Pipeline — Wayback Historical Data Test              ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`📦 Database: ${dbPath}`);

  let db: Database.Database;
  try {
    db = new Database(dbPath, { readonly: true });
  } catch (err: any) {
    console.error(`❌ Cannot open database: ${err.message}`);
    process.exit(1);
  }

  // Check if DB has the expected columns
  const cols = db.prepare('PRAGMA table_info(snapshots)').all() as any[];
  const colNames = cols.map((c: any) => c.name);
  const hasHtml = colNames.includes('html');
  const hasRawHtml = colNames.includes('raw_html');
  if (!hasHtml && !hasRawHtml) {
    console.error('❌ Snapshots table missing html/raw_html column');
    process.exit(1);
  }
  // The wayback DB uses 'html', the diff-engine DB uses 'raw_html'
  const htmlCol = hasHtml ? 'html' : 'raw_html';

  // Count total pairs first (lightweight query)
  let urls: { url: string }[];
  if (urlFilter) {
    urls = db.prepare("SELECT DISTINCT url FROM snapshots WHERE url LIKE ? ORDER BY url")
      .all(`%${urlFilter}%`) as any[];
  } else {
    urls = db.prepare("SELECT DISTINCT url FROM snapshots ORDER BY url").all() as any[];
  }

  // Count pairs
  let totalPairs = 0;
  for (const { url } of urls) {
    const cnt = db.prepare("SELECT COUNT(*) as cnt FROM snapshots WHERE url = ?").get(url) as any;
    totalPairs += Math.max(0, cnt.cnt - 1);
  }

  console.log(`📊 ${totalPairs} consecutive pairs across ${urls.length} URLs`);
  if (urlFilter) console.log(`🔍 Filter: ${urlFilter}`);
  console.log('');

  // ── Process URL by URL to control memory ──
  const results: PairResult[] = [];
  const startTime = Date.now();
  const { createPatch } = await import('diff');
  let pairIdx = 0;

  for (const { url } of urls) {
    // Load just timestamps + metadata, fetch HTML one pair at a time
    const snapMeta = db.prepare(
      "SELECT id, timestamp FROM snapshots WHERE url = ? ORDER BY timestamp ASC"
    ).all(url) as { id: number; timestamp: string }[];

    if (snapMeta.length < 2) continue;

    // First check HTML sizes to decide whether to load raw HTML
    const getHtmlSize = db.prepare(
      "SELECT id, length(html) as html_len FROM snapshots WHERE id = ?"
    );
    const getSnapFull = db.prepare(
      "SELECT id, url, timestamp, html, readability_text, text_only FROM snapshots WHERE id = ?"
    );
    const getSnapLight = db.prepare(
      "SELECT id, url, timestamp, readability_text, text_only FROM snapshots WHERE id = ?"
    );

    const MAX_RAW_HTML = 200_000; // Skip raw HTML/structural for pages > 200KB

    for (let i = 0; i < snapMeta.length - 1; i++) {
      pairIdx++;
      const tsOld = snapMeta[i].timestamp;
      const tsNew = snapMeta[i + 1].timestamp;
      const shortUrl = url.length > 45 ? url.substring(0, 45) + '…' : url;

      if (verbose) {
        console.log(`[${pairIdx}/${totalPairs}] ${shortUrl} (${tsOld} → ${tsNew})`);
      }

      // Check HTML sizes first
      const oldSize = getHtmlSize.get(snapMeta[i].id) as any;
      const newSize = getHtmlSize.get(snapMeta[i + 1].id) as any;
      const isLarge = oldSize.html_len > MAX_RAW_HTML || newSize.html_len > MAX_RAW_HTML;

      let oldReadability: string, newReadability: string;
      let oldTextOnly: string, newTextOnly: string;
      let oldStructural = '', newStructural = '';
      let cappedOldHtml = '', cappedNewHtml = '';

      if (isLarge) {
        // Large page: only load lightweight text fields, skip raw HTML & structural
        const oldSnap = getSnapLight.get(snapMeta[i].id) as any;
        const newSnap = getSnapLight.get(snapMeta[i + 1].id) as any;
        oldReadability = oldSnap.readability_text || '';
        newReadability = newSnap.readability_text || '';
        oldTextOnly = oldSnap.text_only || '';
        newTextOnly = newSnap.text_only || '';
      } else {
        // Small page: load everything
        const oldSnap = getSnapFull.get(snapMeta[i].id) as WaybackSnapshot;
        const newSnap = getSnapFull.get(snapMeta[i + 1].id) as WaybackSnapshot;
        cappedOldHtml = oldSnap.html;
        cappedNewHtml = newSnap.html;
        oldReadability = oldSnap.readabilityText || oldSnap.readability_text || extractReadability(cappedOldHtml, url);
        newReadability = newSnap.readabilityText || newSnap.readability_text || extractReadability(cappedNewHtml, url);
        oldTextOnly = oldSnap.textOnly || oldSnap.text_only || extractTextOnly(cappedOldHtml);
        newTextOnly = newSnap.textOnly || newSnap.text_only || extractTextOnly(cappedNewHtml);
        oldStructural = extractStructuralDom(cappedOldHtml);
        newStructural = extractStructuralDom(cappedNewHtml);
      }

      const beforeData = {
        rawHtml: cappedOldHtml,
        readabilityText: oldReadability,
        structuralDom: oldStructural,
        textOnly: oldTextOnly,
      };
      const afterData = {
        rawHtml: cappedNewHtml,
        readabilityText: newReadability,
        structuralDom: newStructural,
        textOnly: newTextOnly,
      };

      // ── Old approach: readability-only with diffSize > 2 ──
      const normOldRead = normalizeText(oldReadability);
      const normNewRead = normalizeText(newReadability);
      const readPatch = createPatch('r.txt', normOldRead, normNewRead, '', '', { context: 3 });
      const readLines = readPatch.split('\n');
      const readAdded = readLines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
      const readRemoved = readLines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;
      const readDiffSize = readAdded + readRemoved;

      const oldApproach: OldApproachResult = {
        detected: readDiffSize > 2,
        readabilityChanged: readDiffSize > 0,
        readabilityDiffSize: readDiffSize,
      };

      // ── New approach: voting pipeline ──
      const votingResult = runVotingPipeline(beforeData, afterData);

      // ── Compare approaches ──
      const newDetected = votingResult.votes >= 2;
      const agreement = oldApproach.detected === newDetected;
      const upgraded = newDetected && !oldApproach.detected;
      const downgraded = !newDetected && oldApproach.detected;

      // Store result without the huge diff patches (save memory)
      results.push({
        url,
        tsOld,
        tsNew,
        oldApproach,
        votingResult: {
          ...votingResult,
          readabilityDiff: '', // Don't store full patch in memory
          diffs: [],           // Don't store full diffs in memory
        },
        agreement,
        upgraded,
        downgraded,
      });

      if (verbose) {
        console.log(`  Old: ${oldApproach.detected ? '📢 DETECTED' : '✅ no change'} (readability diffSize=${readDiffSize})`);
        console.log(`  ${formatVotingResult(votingResult, true)}`);
        if (!agreement) {
          console.log(`  ⚠️  DISAGREEMENT: ${upgraded ? 'UPGRADED (new found more)' : 'DOWNGRADED (new found less)'}`);
        }
        console.log('');
      }
    }
  }

  const elapsed = Date.now() - startTime;

  // ─── REPORTS ──────────────────────────────────────────────────────────────

  console.log('\n' + '═'.repeat(65));
  console.log('  VOTE DISTRIBUTION');
  console.log('═'.repeat(65));

  const voteDist: Record<number, PairResult[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  for (const r of results) {
    const v = Math.min(r.votingResult.votes, 4);
    voteDist[v].push(r);
  }

  const labels: Record<number, string> = {
    0: 'no change',
    1: 'suspicious',
    2: 'likely real',
    3: 'definite',
    4: 'absolute',
  };

  for (let v = 0; v <= 4; v++) {
    const count = voteDist[v].length;
    const pct = results.length > 0 ? ((count / results.length) * 100).toFixed(1) : '0.0';
    const bar = '█'.repeat(Math.round(count / Math.max(1, results.length) * 40));
    console.log(`  ${v} votes (${labels[v].padEnd(12)}): ${String(count).padStart(4)} pairs (${pct.padStart(5)}%) ${bar}`);
  }
  console.log('');

  // ── Approach comparison ──
  console.log('═'.repeat(65));
  console.log('  OLD (readability-only) vs NEW (voting)');
  console.log('═'.repeat(65));

  const agreed = results.filter(r => r.agreement).length;
  const upgrades = results.filter(r => r.upgraded);
  const downgrades = results.filter(r => r.downgraded);
  const oldDetected = results.filter(r => r.oldApproach.detected).length;
  const newDetected = results.filter(r => r.votingResult.votes >= 2).length;

  console.log(`  Total pairs:        ${results.length}`);
  console.log(`  Old detected:       ${oldDetected} (${((oldDetected / results.length) * 100).toFixed(1)}%)`);
  console.log(`  New detected (2+):  ${newDetected} (${((newDetected / results.length) * 100).toFixed(1)}%)`);
  console.log(`  Agreement:          ${agreed} (${((agreed / results.length) * 100).toFixed(1)}%)`);
  console.log(`  Upgrades (new > old): ${upgrades.length}`);
  console.log(`  Downgrades (old > new): ${downgrades.length}`);
  console.log('');

  // ── Show upgrades ──
  if (upgrades.length > 0) {
    console.log('─'.repeat(65));
    console.log('  UPGRADES: New approach detected changes old approach missed');
    console.log('─'.repeat(65));
    for (const u of upgrades.slice(0, 15)) {
      const votes = u.votingResult.strategyVotes
        .filter(v => v.votedYes)
        .map(v => v.strategy)
        .join(', ');
      console.log(`  ${u.url.substring(0, 40)} | ${u.tsOld}→${u.tsNew} | ${u.votingResult.votes}/4 via ${votes}`);
    }
    if (upgrades.length > 15) console.log(`  ... and ${upgrades.length - 15} more`);
    console.log('');
  }

  // ── Show downgrades ──
  if (downgrades.length > 0) {
    console.log('─'.repeat(65));
    console.log('  DOWNGRADES: Old approach detected but new approach suppressed');
    console.log('─'.repeat(65));
    for (const d of downgrades.slice(0, 15)) {
      const noVotes = d.votingResult.strategyVotes
        .filter(v => !v.votedYes)
        .map(v => `${v.strategy}(${v.reason.substring(0, 30)})`)
        .join(', ');
      console.log(`  ${d.url.substring(0, 40)} | ${d.tsOld}→${d.tsNew} | old_readDiff=${d.oldApproach.readabilityDiffSize} | ${d.votingResult.votes}/4`);
    }
    if (downgrades.length > 15) console.log(`  ... and ${downgrades.length - 15} more`);
    console.log('');
  }

  // ── 1-vote suspicious analysis ──
  const suspicious = voteDist[1];
  if (suspicious.length > 0) {
    console.log('─'.repeat(65));
    console.log('  SUSPICIOUS (1/4 votes) — Likely noise');
    console.log('─'.repeat(65));
    const byStrategy: Record<string, number> = {};
    for (const s of suspicious) {
      const voter = s.votingResult.strategyVotes.find(v => v.votedYes);
      if (voter) {
        byStrategy[voter.strategy] = (byStrategy[voter.strategy] || 0) + 1;
      }
    }
    console.log('  Lone voter breakdown:');
    for (const [strat, count] of Object.entries(byStrategy).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${strat}: ${count} times`);
    }
    console.log('');
  }

  // ── Change type distribution ──
  const changeTypes: Record<string, number> = {};
  for (const r of results) {
    if (r.votingResult.votes >= 2) {
      changeTypes[r.votingResult.changeType] = (changeTypes[r.votingResult.changeType] || 0) + 1;
    }
  }
  if (Object.keys(changeTypes).length > 0) {
    console.log('─'.repeat(65));
    console.log('  CHANGE TYPE DISTRIBUTION (2+ votes only)');
    console.log('─'.repeat(65));
    for (const [type, count] of Object.entries(changeTypes).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${type}: ${count}`);
    }
    console.log('');
  }

  // ── Per-URL summary ──
  console.log('═'.repeat(65));
  console.log('  PER-URL SUMMARY');
  console.log('═'.repeat(65));

  const urlGroups = new Map<string, PairResult[]>();
  for (const r of results) {
    if (!urlGroups.has(r.url)) urlGroups.set(r.url, []);
    urlGroups.get(r.url)!.push(r);
  }

  for (const [url, prs] of urlGroups) {
    const shortUrl = url.length > 48 ? url.substring(0, 48) + '…' : url;
    const v0 = prs.filter(p => p.votingResult.votes === 0).length;
    const v1 = prs.filter(p => p.votingResult.votes === 1).length;
    const v2 = prs.filter(p => p.votingResult.votes === 2).length;
    const v3 = prs.filter(p => p.votingResult.votes === 3).length;
    const v4 = prs.filter(p => p.votingResult.votes === 4).length;
    const oldDet = prs.filter(p => p.oldApproach.detected).length;
    const newDet = prs.filter(p => p.votingResult.votes >= 2).length;

    console.log(`  ${shortUrl}`);
    console.log(`    Pairs: ${prs.length} | Votes: 0:${v0} 1:${v1} 2:${v2} 3:${v3} 4:${v4} | Old:${oldDet} New:${newDet}`);
  }
  console.log('');

  // ── False positive analysis ──
  console.log('═'.repeat(65));
  console.log('  FALSE POSITIVE ANALYSIS');
  console.log('═'.repeat(65));

  // For 2+ vote changes, check if they're likely real based on heuristics:
  // - High noise estimate = likely FP
  // - raw_html-only vote that squeaked past noise filter = likely FP
  // - Readability + text_only agreement = likely real
  const actionable = results.filter(r => r.votingResult.votes >= 2);
  let likelyReal = 0;
  let possibleFP = 0;
  let uncertain = 0;

  for (const r of actionable) {
    const votes = r.votingResult.strategyVotes;
    const readVoted = votes.find(v => v.strategy === 'readability')?.votedYes;
    const textVoted = votes.find(v => v.strategy === 'text_only')?.votedYes;
    const rawVoted = votes.find(v => v.strategy === 'raw_html')?.votedYes;
    const structVoted = votes.find(v => v.strategy === 'structural')?.votedYes;

    // Strong signal: readability AND text_only agree
    if (readVoted && textVoted) {
      likelyReal++;
    }
    // Weak signal: only diagnostic strategies (raw + structural) and no content strategies
    else if (!readVoted && !textVoted && (rawVoted || structVoted)) {
      possibleFP++;
    }
    // Mixed signal
    else {
      uncertain++;
    }
  }

  console.log(`  Actionable (2+ votes): ${actionable.length}`);
  console.log(`    Likely real (read+text agree):    ${likelyReal}`);
  console.log(`    Possible FP (only diag voted):    ${possibleFP}`);
  console.log(`    Uncertain (mixed signals):        ${uncertain}`);
  const fpRate = actionable.length > 0 ? ((possibleFP / actionable.length) * 100).toFixed(1) : '0.0';
  console.log(`    Estimated FP rate: ${fpRate}%`);
  console.log('');

  console.log(`⏱️  Processed ${results.length} pairs in ${(elapsed / 1000).toFixed(1)}s`);

  db.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
