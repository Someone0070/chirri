#!/usr/bin/env node
/**
 * Fetch DAILY-GAP Wayback Machine snapshots for testing volatile field learning.
 *
 * Targets 10 popular pages that get frequent crawls.
 * Finds periods with DENSE snapshots (gaps < 3 days) and picks 15-20 consecutive ones.
 * Stores in wayback-daily.db.
 *
 * Usage:
 *   npx tsx src/fetch-daily-wayback.ts                    # Fetch all 10 sources
 *   npx tsx src/fetch-daily-wayback.ts --limit 5          # Only first 5
 *   npx tsx src/fetch-daily-wayback.ts --skip-fetch       # Skip fetching, just report
 *   npx tsx src/fetch-daily-wayback.ts --db <path>        # Custom DB path
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────────────────

const DAILY_SOURCES = [
  'docs.stripe.com/api/charges',
  'docs.stripe.com/api/customers',
  'docs.stripe.com/changelog',
  'docs.sendgrid.com/api-reference/mail-send/mail-send',
  'developers.cloudflare.com/api',
  'developer.mozilla.org/en-US/docs/Web/API',
  'docs.github.com/en/rest/repos',
  'stripe.com/docs/api',
  'supabase.com/docs',
  'vercel.com/docs',
];

const TARGET_SNAPSHOTS = 20;      // aim for 15-20 daily snapshots
const MIN_SNAPSHOTS = 15;         // minimum acceptable
const MAX_GAP_DAYS = 3;           // snapshots must be < 3 days apart for "dense"
const MIN_DENSE_RUN = 10;         // minimum length of a dense run to consider
const CDX_API = 'https://web.archive.org/cdx/search/cdx';
const WAYBACK_URL = 'https://web.archive.org/web';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';
const FETCH_DELAY_MS = 1200;      // Rate limit: ~1 second between fetches

// ─── CLI Args ───────────────────────────────────────────────────────────────

interface FetchArgs {
  dbPath: string;
  limit: number;
  skipFetch: boolean;
}

function parseArgs(): FetchArgs {
  const args = process.argv.slice(2);
  let dbPath = path.resolve(__dirname, '..', 'wayback-daily.db');
  let limit = DAILY_SOURCES.length;
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

    CREATE TABLE IF NOT EXISTS volatile_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      pattern TEXT NOT NULL,
      match_count INTEGER NOT NULL DEFAULT 0,
      total_checks INTEGER NOT NULL DEFAULT 0,
      is_volatile INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(url, pattern)
    );
    CREATE INDEX IF NOT EXISTS idx_volatile_url ON volatile_fields(url);
  `);
  return db;
}

// ─── Wayback CDX API ────────────────────────────────────────────────────────

interface CDXEntry {
  timestamp: string;
  statusCode: string;
}

async function queryCDX(url: string): Promise<CDXEntry[]> {
  const params = new URLSearchParams({
    url,
    output: 'json',
    fl: 'timestamp,statuscode',
    filter: 'statuscode:200',
    limit: '5000',
  });

  const cdxUrl = `${CDX_API}?${params}`;
  console.log(`  📡 CDX query: ${url}`);

  const resp = await fetch(cdxUrl, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!resp.ok) {
    throw new Error(`CDX API returned ${resp.status}: ${resp.statusText}`);
  }

  const data = await resp.json() as string[][];
  if (data.length <= 1) return [];

  return data.slice(1).map(row => ({
    timestamp: row[0],
    statusCode: row[1],
  }));
}

function parseTimestamp(ts: string): Date {
  const y = parseInt(ts.substring(0, 4));
  const m = parseInt(ts.substring(4, 6)) - 1;
  const d = parseInt(ts.substring(6, 8));
  const h = parseInt(ts.substring(8, 10)) || 0;
  const min = parseInt(ts.substring(10, 12)) || 0;
  const s = parseInt(ts.substring(12, 14)) || 0;
  return new Date(Date.UTC(y, m, d, h, min, s));
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Find the densest period of snapshots (gaps < MAX_GAP_DAYS).
 * Returns the longest consecutive run of dense snapshots.
 * Then picks up to TARGET_SNAPSHOTS from that run, deduplicating by date (one per day).
 */
function findDensePeriod(entries: CDXEntry[]): string[] {
  if (entries.length < 2) return entries.map(e => e.timestamp);

  // Deduplicate by day (keep first snapshot per day)
  const byDay = new Map<string, CDXEntry>();
  for (const entry of entries) {
    const date = entry.timestamp.substring(0, 8); // YYYYMMDD
    if (!byDay.has(date)) {
      byDay.set(date, entry);
    }
  }

  const dailyEntries = Array.from(byDay.values()).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );

  if (dailyEntries.length < 2) return dailyEntries.map(e => e.timestamp);

  // Find runs of consecutive entries with gaps < MAX_GAP_DAYS
  interface Run {
    start: number;
    end: number;
    length: number;
  }

  const runs: Run[] = [];
  let runStart = 0;

  for (let i = 1; i < dailyEntries.length; i++) {
    const prev = parseTimestamp(dailyEntries[i - 1].timestamp);
    const curr = parseTimestamp(dailyEntries[i].timestamp);
    const gap = daysBetween(prev, curr);

    if (gap > MAX_GAP_DAYS) {
      // End current run
      const runLength = i - runStart;
      if (runLength >= MIN_DENSE_RUN) {
        runs.push({ start: runStart, end: i - 1, length: runLength });
      }
      runStart = i;
    }
  }
  // Final run
  const finalLength = dailyEntries.length - runStart;
  if (finalLength >= MIN_DENSE_RUN) {
    runs.push({ start: runStart, end: dailyEntries.length - 1, length: finalLength });
  }

  if (runs.length === 0) {
    // No dense runs found — try with relaxed threshold, take longest consecutive block
    console.log(`    ⚠️  No dense runs found with <${MAX_GAP_DAYS} day gaps, trying relaxed (< 7 days)`);
    let bestStart = 0, bestLen = 1;
    runStart = 0;
    for (let i = 1; i < dailyEntries.length; i++) {
      const prev = parseTimestamp(dailyEntries[i - 1].timestamp);
      const curr = parseTimestamp(dailyEntries[i].timestamp);
      const gap = daysBetween(prev, curr);
      if (gap > 7) {
        const len = i - runStart;
        if (len > bestLen) { bestStart = runStart; bestLen = len; }
        runStart = i;
      }
    }
    const len = dailyEntries.length - runStart;
    if (len > bestLen) { bestStart = runStart; bestLen = len; }

    if (bestLen >= 5) {
      const selected = dailyEntries.slice(bestStart, bestStart + Math.min(bestLen, TARGET_SNAPSHOTS));
      return selected.map(e => e.timestamp);
    }

    // Give up, return what we have
    return dailyEntries.slice(0, Math.min(dailyEntries.length, TARGET_SNAPSHOTS)).map(e => e.timestamp);
  }

  // Pick the longest dense run
  runs.sort((a, b) => b.length - a.length);
  const best = runs[0];
  console.log(`    📊 Best dense run: ${best.length} snapshots (index ${best.start}-${best.end})`);

  // Take up to TARGET_SNAPSHOTS from the densest run
  const runEntries = dailyEntries.slice(best.start, best.end + 1);
  const selected = runEntries.slice(0, TARGET_SNAPSHOTS);

  const first = parseTimestamp(selected[0].timestamp);
  const last = parseTimestamp(selected[selected.length - 1].timestamp);
  console.log(`    📅 Selected period: ${first.toISOString().split('T')[0]} → ${last.toISOString().split('T')[0]} (${selected.length} snapshots)`);

  return selected.map(e => e.timestamp);
}

// ─── Wayback Fetch ──────────────────────────────────────────────────────────

function stripWaybackArtifacts(html: string): string {
  html = html.replace(/<div\s+id=["']?wm-ipp-base["']?[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '');
  html = html.replace(/<div\s+id=["']?wm-ipp["']?[\s\S]*?<\/div>/gi, '');
  html = html.replace(/<!--\s*(?:BEGIN|END)\s+WAYBACK\s+TOOLBAR[\s\S]*?-->/gi, '');
  html = html.replace(/<!--\s*(?:FILE ARCHIVED ON|saved from url)[^>]*-->/gi, '');
  html = html.replace(/<script[^>]*(?:web\.archive\.org|archive\.org\/includes|playback|wombat)[^>]*>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<script[^>]*>[\s\S]*?(?:_wm\.wombat|WB_wombat|__wm\.)[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<link[^>]*(?:web\.archive\.org|archive\.org)[^>]*\/?>/gi, '');
  html = html.replace(/<style[^>]*>[\s\S]*?(?:wm-ipp|wayback)[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<noscript[^>]*>[\s\S]*?googletagmanager[\s\S]*?<\/noscript>/gi, '');
  html = html.replace(/<iframe[^>]*googletagmanager\.com[^>]*>[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/(?:https?:\/\/)?web\.archive\.org\/web\/\d{14}(?:im_|if_|js_|cs_|fw_|mp_)?\/(?:https?:\/\/)/gi, 'https://');
  return html;
}

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
    dom.window.close();
    return result;
  } catch {
    return '';
  }
}

// ─── Main Fetch Pipeline ────────────────────────────────────────────────────

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

    // Check if we already have enough snapshots
    const existing = db.prepare("SELECT COUNT(*) as cnt FROM snapshots WHERE url = ? AND error IS NULL").get(url) as any;
    if (existing.cnt >= MIN_SNAPSHOTS) {
      console.log(`  ✅ Already have ${existing.cnt} snapshots, skipping fetch`);
      continue;
    }

    // Query CDX — try with and without protocol
    let entries: CDXEntry[] = [];
    for (const prefix of [`https://${url}`, `http://${url}`, url]) {
      try {
        entries = await queryCDX(prefix);
        if (entries.length > 0) {
          console.log(`  📊 CDX returned ${entries.length} total snapshots`);
          break;
        }
      } catch (err: any) {
        console.log(`  ⚠️  CDX error for ${prefix}: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (entries.length === 0) {
      console.log(`  ❌ No Wayback snapshots found for any variant`);
      continue;
    }

    // Find the densest period
    const timestamps = findDensePeriod(entries);

    if (timestamps.length < 5) {
      console.log(`  ⚠️  Only ${timestamps.length} dense snapshots found (need at least 5), skipping`);
      continue;
    }

    console.log(`  🎯 Will fetch ${timestamps.length} daily snapshots`);

    let fetched = 0;
    let errors = 0;

    for (let ti = 0; ti < timestamps.length; ti++) {
      const ts = timestamps[ti];

      const stored = db.prepare("SELECT id FROM snapshots WHERE url = ? AND timestamp = ?").get(url, ts) as any;
      if (stored) {
        console.log(`  [${ti + 1}/${timestamps.length}] ${ts} — already stored`);
        fetched++;
        continue;
      }

      console.log(`  [${ti + 1}/${timestamps.length}] Fetching ${ts}...`);

      let html = '';
      let error: string | null = null;

      try {
        html = await fetchWaybackSnapshot(`https://${url}`, ts);
        console.log(`    ✅ ${(html.length / 1024).toFixed(0)}KB`);
        fetched++;
      } catch (err: any) {
        error = err.message;
        console.log(`    ❌ ${error}`);
        errors++;
      }

      let readability = '';
      let textOnly = '';
      let structural = '';

      if (html.length > 0) {
        readability = extractReadability(html, url);
        textOnly = extractTextOnly(html);
        structural = html.length <= 500_000 ? extractStructuralDom(html) : '';
        console.log(`    📝 readability=${readability.length} text=${textOnly.length} structural=${structural.length}`);
      }

      insertStmt.run(url, ts, html, readability, textOnly, structural, error);

      // Rate limit: 1 second between fetches
      await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
    }

    console.log(`  📊 Result: ${fetched} fetched, ${errors} errors`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { dbPath, limit, skipFetch } = parseArgs();
  const sources = DAILY_SOURCES.slice(0, limit);

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Daily-Gap Wayback Fetcher — Dense Snapshot Periods          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`📦 Database: ${dbPath}`);
  console.log(`🌐 Sources: ${sources.length}`);
  console.log(`📸 Target: ${TARGET_SNAPSHOTS} daily snapshots per source (gaps < ${MAX_GAP_DAYS} days)\n`);

  const db = initDb(dbPath);

  if (!skipFetch) {
    await fetchAllSources(db, sources);
  } else {
    console.log('⏭️  Skipping fetch (--skip-fetch)');
  }

  // Report what we have
  const urls = db.prepare("SELECT DISTINCT url FROM snapshots ORDER BY url").all() as { url: string }[];
  let totalSnaps = 0;
  let totalPairs = 0;

  console.log('\n' + '═'.repeat(65));
  console.log('  DATABASE SUMMARY');
  console.log('═'.repeat(65));

  for (const { url } of urls) {
    const cnt = db.prepare("SELECT COUNT(*) as cnt FROM snapshots WHERE url = ? AND error IS NULL").get(url) as any;
    const first = db.prepare("SELECT timestamp FROM snapshots WHERE url = ? AND error IS NULL ORDER BY timestamp ASC LIMIT 1").get(url) as any;
    const last = db.prepare("SELECT timestamp FROM snapshots WHERE url = ? AND error IS NULL ORDER BY timestamp DESC LIMIT 1").get(url) as any;
    const pairs = Math.max(0, cnt.cnt - 1);
    totalSnaps += cnt.cnt;
    totalPairs += pairs;

    const firstDate = first ? parseTimestamp(first.timestamp).toISOString().split('T')[0] : '?';
    const lastDate = last ? parseTimestamp(last.timestamp).toISOString().split('T')[0] : '?';
    console.log(`  ${url}: ${cnt.cnt} snapshots, ${pairs} pairs (${firstDate} → ${lastDate})`);
  }

  console.log(`\n  Total: ${totalSnaps} snapshots, ${totalPairs} pairs across ${urls.length} URLs`);

  db.close();
  console.log('\n✅ Done');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
