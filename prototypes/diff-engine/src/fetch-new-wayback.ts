#!/usr/bin/env node
/**
 * Fetch NEW Wayback Machine snapshots for testing the voting pipeline
 * against data the engine hasn't been tuned on.
 *
 * For each source URL:
 *   1. Query Wayback CDX API for available timestamps
 *   2. Pick 10 snapshots ~2-4 weeks apart
 *   3. Fetch each snapshot HTML from web.archive.org
 *   4. Strip Wayback toolbar/artifacts
 *   5. Extract readability, text_only, structural DOM
 *   6. Store in a fresh SQLite DB (wayback-new.db)
 *   7. Run voting pipeline on consecutive pairs
 *   8. Report results
 *
 * Usage:
 *   npx tsx src/fetch-new-wayback.ts                    # Fetch all 8 sources
 *   npx tsx src/fetch-new-wayback.ts --limit 3          # Only first 3 sources
 *   npx tsx src/fetch-new-wayback.ts --skip-fetch       # Skip fetching, just run pipeline
 *   npx tsx src/fetch-new-wayback.ts --db <path>        # Custom DB path
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { normalizeHtml } from './normalizer.js';
import { runVotingPipeline, formatVotingResult, type VotingResult } from './pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────────────────

const NEW_SOURCES = [
  'docs.plaid.com/api/transactions',
  'docs.sentry.io/api',
  'docs.posthog.com/api',
  'docs.hookdeck.com',
  'docs.cal.com/api-reference',
  'developer.spotify.com/documentation/web-api',
  'docs.digitalocean.com/reference/api',
  'docs.planetscale.com/reference',
];

const TARGET_SNAPSHOTS = 10;
const MIN_WEEKS_APART = 2;
const MAX_WEEKS_APART = 4;
const MIN_DAYS_APART = MIN_WEEKS_APART * 7;  // 14 days
const CDX_API = 'https://web.archive.org/cdx/search/cdx';
const WAYBACK_URL = 'https://web.archive.org/web';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

// ─── CLI Args ───────────────────────────────────────────────────────────────

interface FetchArgs {
  dbPath: string;
  limit: number;
  skipFetch: boolean;
}

function parseArgs(): FetchArgs {
  const args = process.argv.slice(2);
  let dbPath = path.resolve(__dirname, '..', 'wayback-new.db');
  let limit = NEW_SOURCES.length;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db' && args[i + 1]) {
      dbPath = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { dbPath, limit, skipFetch };
}

// ─── DB Setup ───────────────────────────────────────────────────────────────

function initDb(dbPath: string): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      html TEXT NOT NULL DEFAULT '',
      readability_text TEXT NOT NULL DEFAULT '',
      text_only TEXT NOT NULL DEFAULT '',
      structural_dom TEXT NOT NULL DEFAULT '',
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      error TEXT,
      UNIQUE(url, timestamp)
    );
    CREATE INDEX IF NOT EXISTS idx_snap_url ON snapshots(url);
    CREATE INDEX IF NOT EXISTS idx_snap_ts ON snapshots(url, timestamp);

    CREATE TABLE IF NOT EXISTS voting_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      ts_old TEXT NOT NULL,
      ts_new TEXT NOT NULL,
      votes INTEGER NOT NULL,
      confidence REAL NOT NULL,
      verdict TEXT NOT NULL,
      change_type TEXT NOT NULL,
      readability_voted INTEGER NOT NULL DEFAULT 0,
      text_only_voted INTEGER NOT NULL DEFAULT 0,
      structural_voted INTEGER NOT NULL DEFAULT 0,
      raw_html_voted INTEGER NOT NULL DEFAULT 0,
      readability_diff_size INTEGER NOT NULL DEFAULT 0,
      text_only_diff_size INTEGER NOT NULL DEFAULT 0,
      structural_diff_size INTEGER NOT NULL DEFAULT 0,
      raw_html_diff_size INTEGER NOT NULL DEFAULT 0,
      ready_for_llm INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(url, ts_old, ts_new)
    );
    CREATE INDEX IF NOT EXISTS idx_vr_url ON voting_results(url);
  `);
  return db;
}

// ─── Wayback CDX API ────────────────────────────────────────────────────────

interface CDXEntry {
  timestamp: string;
  statusCode: string;
  digest: string;
}

async function queryCDX(url: string): Promise<CDXEntry[]> {
  const params = new URLSearchParams({
    url,
    output: 'json',
    fl: 'timestamp,statuscode,digest',
    filter: 'statuscode:200',
    collapse: 'digest',  // Deduplicate identical snapshots
    limit: '500',
  });

  const cdxUrl = `${CDX_API}?${params}`;
  console.log(`  📡 CDX query: ${cdxUrl.substring(0, 80)}...`);

  const resp = await fetch(cdxUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!resp.ok) {
    throw new Error(`CDX API returned ${resp.status}: ${resp.statusText}`);
  }

  const data = await resp.json() as string[][];

  // First row is headers
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    timestamp: row[0],
    statusCode: row[1],
    digest: row[2],
  }));
}

/**
 * Parse a Wayback timestamp (YYYYMMDDHHmmss) into a Date.
 */
function parseTimestamp(ts: string): Date {
  const y = parseInt(ts.substring(0, 4));
  const m = parseInt(ts.substring(4, 6)) - 1;
  const d = parseInt(ts.substring(6, 8));
  const h = parseInt(ts.substring(8, 10)) || 0;
  const min = parseInt(ts.substring(10, 12)) || 0;
  const s = parseInt(ts.substring(12, 14)) || 0;
  return new Date(y, m, d, h, min, s);
}

/**
 * Pick ~10 timestamps that are 2-4 weeks apart.
 */
function pickTimestamps(entries: CDXEntry[], count: number): string[] {
  if (entries.length === 0) return [];
  if (entries.length <= count) return entries.map(e => e.timestamp);

  const picked: string[] = [entries[0].timestamp];
  let lastDate = parseTimestamp(entries[0].timestamp);

  for (let i = 1; i < entries.length && picked.length < count; i++) {
    const currentDate = parseTimestamp(entries[i].timestamp);
    const daysDiff = (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff >= MIN_DAYS_APART) {
      picked.push(entries[i].timestamp);
      lastDate = currentDate;
    }
  }

  return picked;
}

// ─── Wayback Fetch ──────────────────────────────────────────────────────────

/**
 * Strip Wayback Machine toolbar, banner, and injected scripts from HTML.
 */
function stripWaybackArtifacts(html: string): string {
  // Remove the Wayback toolbar div (multiple patterns)
  html = html.replace(/<div\s+id=["']?wm-ipp-base["']?[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '');
  html = html.replace(/<div\s+id=["']?wm-ipp["']?[\s\S]*?<\/div>/gi, '');

  // Remove Wayback-injected comment blocks
  html = html.replace(/<!--\s*(?:BEGIN|END)\s+WAYBACK\s+TOOLBAR[\s\S]*?-->/gi, '');
  html = html.replace(/<!--\s*(?:FILE ARCHIVED ON|saved from url)[^>]*-->/gi, '');

  // Remove archive.org scripts and links
  html = html.replace(/<script[^>]*(?:web\.archive\.org|archive\.org\/includes|playback|wombat)[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*>[\s\S]*?(?:_wm\.wombat|WB_wombat|__wm\.)[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<link[^>]*(?:web\.archive\.org|archive\.org)[^>]*\/?>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?(?:wm-ipp|wayback)[\s\S]*?<\/style>/gi, '');

  // Remove GTM noscript iframes
  html = html.replace(/<noscript[^>]*>[\s\S]*?googletagmanager[\s\S]*?<\/noscript>/gi, '');
  html = html.replace(/<iframe[^>]*googletagmanager\.com[^>]*>[\s\S]*?<\/iframe>/gi, '');

  // Fix Wayback-rewritten URLs: /web/20240101/https://... → https://...
  html = html.replace(/(?:https?:\/\/)?web\.archive\.org\/web\/\d{14}(?:im_|if_|js_|cs_|fw_|mp_)?\/(?:https?:\/\/)/gi, 'https://');

  return html;
}

/**
 * Fetch a single Wayback snapshot.
 */
async function fetchWaybackSnapshot(url: string, timestamp: string): Promise<string> {
  const waybackUrl = `${WAYBACK_URL}/${timestamp}id_/${url}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const resp = await fetch(waybackUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} for ${waybackUrl}`);
    }

    let html = await resp.text();
    html = stripWaybackArtifacts(html);
    return html;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Content Extraction ─────────────────────────────────────────────────────

function extractReadability(html: string, url: string): string {
  try {
    const dom = new JSDOM(html, { url: `https://${url}` });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    return article?.textContent?.trim() || '';
  } catch {
    return '';
  }
}

function extractTextOnly(html: string): string {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    doc.querySelectorAll('script, style, noscript, svg').forEach((el: Element) => el.remove());
    return doc.body?.textContent?.trim() || '';
  } catch {
    return '';
  }
}

function extractStructuralDom(html: string): string {
  try {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    function walkNode(node: Node, depth: number): string {
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

    return walkNode(doc.documentElement, 0);
  } catch {
    return '';
  }
}

// ─── Main Pipeline ──────────────────────────────────────────────────────────

async function fetchAllSources(db: Database.Database, sources: string[]): Promise<void> {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO snapshots (url, timestamp, html, readability_text, text_only, structural_dom, error)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (let si = 0; si < sources.length; si++) {
    const url = sources[si];
    console.log(`\n${'━'.repeat(65)}`);
    console.log(`📦 [${si + 1}/${sources.length}] ${url}`);
    console.log('━'.repeat(65));

    // Check if we already have snapshots for this URL
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM snapshots WHERE url = ?").get(url) as any;
    if (existing.cnt >= TARGET_SNAPSHOTS) {
      console.log(`  ✅ Already have ${existing.cnt} snapshots, skipping fetch`);
      continue;
    }

    // Step 1: Query CDX
    let entries: CDXEntry[];
    try {
      entries = await queryCDX(`https://${url}`);
      console.log(`  📊 CDX returned ${entries.length} unique snapshots`);
    } catch (err: any) {
      console.log(`  ❌ CDX error: ${err.message}`);
      // Try without https
      try {
        entries = await queryCDX(url);
        console.log(`  📊 CDX (no proto) returned ${entries.length} unique snapshots`);
      } catch (err2: any) {
        console.log(`  ❌ CDX error (retry): ${err2.message}`);
        continue;
      }
    }

    if (entries.length === 0) {
      console.log(`  ⚠️  No Wayback snapshots found`);
      continue;
    }

    // Step 2: Pick timestamps
    const timestamps = pickTimestamps(entries, TARGET_SNAPSHOTS);
    console.log(`  🎯 Selected ${timestamps.length} timestamps (${MIN_WEEKS_APART}-${MAX_WEEKS_APART} weeks apart)`);

    if (timestamps.length < 2) {
      console.log(`  ⚠️  Need at least 2 timestamps for comparison, only got ${timestamps.length}`);
      continue;
    }

    // Show date range
    const first = parseTimestamp(timestamps[0]);
    const last = parseTimestamp(timestamps[timestamps.length - 1]);
    console.log(`  📅 Range: ${first.toISOString().split('T')[0]} → ${last.toISOString().split('T')[0]}`);

    // Step 3: Fetch each snapshot
    for (let ti = 0; ti < timestamps.length; ti++) {
      const ts = timestamps[ti];

      // Check if already stored
      const stored = db.prepare("SELECT id FROM snapshots WHERE url = ? AND timestamp = ?").get(url, ts) as any;
      if (stored) {
        console.log(`  [${ti + 1}/${timestamps.length}] ${ts} — already stored`);
        continue;
      }

      console.log(`  [${ti + 1}/${timestamps.length}] Fetching ${ts}...`);

      let html = '';
      let error: string | null = null;

      try {
        html = await fetchWaybackSnapshot(`https://${url}`, ts);
        console.log(`    ✅ ${(html.length / 1024).toFixed(0)}KB`);
      } catch (err: any) {
        error = err.message;
        console.log(`    ❌ ${error}`);
      }

      // Extract content
      let readability = '';
      let textOnly = '';
      let structural = '';

      if (html.length > 0) {
        readability = extractReadability(html, url);
        textOnly = extractTextOnly(html);
        structural = extractStructuralDom(html);
        console.log(`    📝 readability=${readability.length} text=${textOnly.length} structural=${structural.length}`);
      }

      // Store
      insertStmt.run(url, ts, html, readability, textOnly, structural, error);

      // Rate limit: be nice to Wayback
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

async function runVotingOnPairs(db: Database.Database): Promise<void> {
  console.log('\n' + '═'.repeat(65));
  console.log('  VOTING PIPELINE — FRESH DATA RESULTS');
  console.log('═'.repeat(65) + '\n');

  const urls = db.prepare("SELECT DISTINCT url FROM snapshots ORDER BY url").all() as { url: string }[];

  const insertVR = db.prepare(`
    INSERT OR REPLACE INTO voting_results
    (url, ts_old, ts_new, votes, confidence, verdict, change_type,
     readability_voted, text_only_voted, structural_voted, raw_html_voted,
     readability_diff_size, text_only_diff_size, structural_diff_size, raw_html_diff_size,
     ready_for_llm)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Global stats
  const allResults: { url: string; tsOld: string; tsNew: string; result: VotingResult }[] = [];

  for (const { url } of urls) {
    const snapshots = db.prepare(
      "SELECT id, url, timestamp, html, readability_text, text_only, structural_dom FROM snapshots WHERE url = ? AND error IS NULL AND length(html) > 100 ORDER BY timestamp ASC"
    ).all(url) as any[];

    if (snapshots.length < 2) {
      console.log(`⚠️  ${url}: only ${snapshots.length} valid snapshot(s), skipping`);
      continue;
    }

    console.log(`\n📄 ${url} (${snapshots.length} snapshots, ${snapshots.length - 1} pairs)`);

    for (let i = 0; i < snapshots.length - 1; i++) {
      const old = snapshots[i];
      const cur = snapshots[i + 1];

      const before = {
        rawHtml: old.html,
        readabilityText: old.readability_text || '',
        structuralDom: old.structural_dom || '',
        textOnly: old.text_only || '',
      };
      const after = {
        rawHtml: cur.html,
        readabilityText: cur.readability_text || '',
        structuralDom: cur.structural_dom || '',
        textOnly: cur.text_only || '',
      };

      const result = runVotingPipeline(before, after);

      // Store result
      const readVote = result.strategyVotes.find(v => v.strategy === 'readability');
      const textVote = result.strategyVotes.find(v => v.strategy === 'text_only');
      const structVote = result.strategyVotes.find(v => v.strategy === 'structural');
      const rawVote = result.strategyVotes.find(v => v.strategy === 'raw_html');

      insertVR.run(
        url, old.timestamp, cur.timestamp,
        result.votes, result.confidence, result.verdict, result.changeType,
        readVote?.votedYes ? 1 : 0, textVote?.votedYes ? 1 : 0,
        structVote?.votedYes ? 1 : 0, rawVote?.votedYes ? 1 : 0,
        readVote?.diffSize || 0, textVote?.diffSize || 0,
        structVote?.diffSize || 0, rawVote?.diffSize || 0,
        result.readyForLlm ? 1 : 0,
      );

      allResults.push({ url, tsOld: old.timestamp, tsNew: cur.timestamp, result });

      // Compact output per pair
      console.log(`  ${old.timestamp} → ${cur.timestamp}: ${formatVotingResult(result, true)}`);
    }
  }

  // ── Global report ──
  console.log('\n' + '═'.repeat(65));
  console.log('  AGGREGATE VOTE DISTRIBUTION (NEW SOURCES)');
  console.log('═'.repeat(65));

  const voteDist: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const { result } of allResults) {
    const v = Math.min(result.votes, 4);
    voteDist[v]++;
  }

  const labels: Record<number, string> = {
    0: 'no change',
    1: 'suspicious',
    2: 'likely real',
    3: 'definite',
    4: 'absolute',
  };

  for (let v = 0; v <= 4; v++) {
    const count = voteDist[v];
    const pct = allResults.length > 0 ? ((count / allResults.length) * 100).toFixed(1) : '0.0';
    const bar = '█'.repeat(Math.round(count / Math.max(1, allResults.length) * 40));
    console.log(`  ${v} votes (${labels[v].padEnd(12)}): ${String(count).padStart(4)} pairs (${pct.padStart(5)}%) ${bar}`);
  }

  // ── Change type distribution ──
  console.log('\n' + '─'.repeat(65));
  console.log('  CHANGE TYPE DISTRIBUTION (2+ votes)');
  console.log('─'.repeat(65));

  const changeTypes: Record<string, number> = {};
  for (const { result } of allResults) {
    if (result.votes >= 2) {
      changeTypes[result.changeType] = (changeTypes[result.changeType] || 0) + 1;
    }
  }
  for (const [type, count] of Object.entries(changeTypes).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type}: ${count}`);
  }

  // ── Suspicious analysis ──
  const suspicious = allResults.filter(r => r.result.votes === 1);
  if (suspicious.length > 0) {
    console.log('\n' + '─'.repeat(65));
    console.log('  SUSPICIOUS (1/4 votes) — Lone voter breakdown');
    console.log('─'.repeat(65));

    const byStrategy: Record<string, number> = {};
    for (const s of suspicious) {
      const voter = s.result.strategyVotes.find(v => v.votedYes);
      if (voter) {
        byStrategy[voter.strategy] = (byStrategy[voter.strategy] || 0) + 1;
      }
    }
    for (const [strat, count] of Object.entries(byStrategy).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${strat}: ${count} times`);
    }
  }

  // ── FP analysis ──
  console.log('\n' + '═'.repeat(65));
  console.log('  FALSE POSITIVE ANALYSIS (2+ votes)');
  console.log('═'.repeat(65));

  const actionable = allResults.filter(r => r.result.votes >= 2);
  let likelyReal = 0;
  let possibleFP = 0;
  let uncertain = 0;

  for (const { result } of actionable) {
    const votes = result.strategyVotes;
    const readVoted = votes.find(v => v.strategy === 'readability')?.votedYes;
    const textVoted = votes.find(v => v.strategy === 'text_only')?.votedYes;

    if (readVoted && textVoted) {
      likelyReal++;
    } else if (!readVoted && !textVoted) {
      possibleFP++;
    } else {
      uncertain++;
    }
  }

  console.log(`  Actionable (2+ votes): ${actionable.length} / ${allResults.length} total pairs`);
  console.log(`    Likely real (read+text agree):  ${likelyReal}`);
  console.log(`    Possible FP (only diag voted):  ${possibleFP}`);
  console.log(`    Uncertain (mixed signals):      ${uncertain}`);
  const fpRate = actionable.length > 0 ? ((possibleFP / actionable.length) * 100).toFixed(1) : '0.0';
  console.log(`    Estimated FP rate: ${fpRate}%`);

  // ── Per-URL summary ──
  console.log('\n' + '═'.repeat(65));
  console.log('  PER-URL SUMMARY');
  console.log('═'.repeat(65));

  const urlGroups = new Map<string, typeof allResults>();
  for (const r of allResults) {
    if (!urlGroups.has(r.url)) urlGroups.set(r.url, []);
    urlGroups.get(r.url)!.push(r);
  }

  for (const [url, prs] of urlGroups) {
    const shortUrl = url.length > 48 ? url.substring(0, 48) + '…' : url;
    const v0 = prs.filter(p => p.result.votes === 0).length;
    const v1 = prs.filter(p => p.result.votes === 1).length;
    const v2 = prs.filter(p => p.result.votes === 2).length;
    const v3 = prs.filter(p => p.result.votes === 3).length;
    const v4 = prs.filter(p => p.result.votes === 4).length;
    console.log(`  ${shortUrl}`);
    console.log(`    Pairs: ${prs.length} | Votes: 0:${v0} 1:${v1} 2:${v2} 3:${v3} 4:${v4}`);
  }

  console.log('\n' + '═'.repeat(65));
  console.log(`  TOTAL: ${allResults.length} pairs across ${urlGroups.size} URLs`);
  console.log('═'.repeat(65));
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { dbPath, limit, skipFetch } = parseArgs();
  const sources = NEW_SOURCES.slice(0, limit);

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Wayback Fetcher + Voting Pipeline — Fresh Data Test         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`📦 Database: ${dbPath}`);
  console.log(`🌐 Sources: ${sources.length}`);
  console.log(`📸 Target: ${TARGET_SNAPSHOTS} snapshots per source, ${MIN_WEEKS_APART}-${MAX_WEEKS_APART} weeks apart\n`);

  const db = initDb(dbPath);

  if (!skipFetch) {
    await fetchAllSources(db, sources);
  } else {
    console.log('⏭️  Skipping fetch (--skip-fetch)');
  }

  await runVotingOnPairs(db);

  db.close();
  console.log('\n✅ Done');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
