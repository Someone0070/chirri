#!/usr/bin/env node
/**
 * Fetch EXTENDED Wayback Machine snapshots for testing the full pipeline
 * (voting + confirmation + volatile learning) against a broader dataset.
 *
 * 20 additional URLs focused on changelog/API doc pages.
 * Stores in wayback-extended.db.
 *
 * Usage:
 *   npx tsx src/fetch-extended-wayback.ts                    # Fetch all 20 sources
 *   npx tsx src/fetch-extended-wayback.ts --limit 5          # Only first 5
 *   npx tsx src/fetch-extended-wayback.ts --skip-fetch       # Skip fetching, just report
 *   npx tsx src/fetch-extended-wayback.ts --db <path>        # Custom DB path
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Config ─────────────────────────────────────────────────────────────────

const EXTENDED_SOURCES = [
  'docs.stripe.com/changelog',
  'developer.github.com/changes',
  'www.twilio.com/docs/changelog',
  'docs.sendgrid.com/api-reference/mail-send/mail-send',
  'docs.aws.amazon.com/AmazonS3/latest/userguide',
  'developers.cloudflare.com/changelog',
  'vercel.com/changelog',
  'docs.render.com/changelog',
  'www.postman.com/api-changelog',
  'docs.stripe.com/api/charges',
  'docs.stripe.com/api/customers',
  'docs.github.com/en/rest/pulls',
  'www.twilio.com/docs/sms/api/message-resource',
  'docs.digitalocean.com/changelog',
  'linear.app/changelog',
  'supabase.com/changelog',
  'docs.neon.tech/changelog',
  'docs.railway.com/reference/changelog',
  'clerk.com/changelog',
  'resend.com/changelog',
];

const TARGET_SNAPSHOTS = 10;
const MIN_DAYS_APART = 14;  // 2 weeks
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
  let dbPath = path.resolve(__dirname, '..', 'wayback-extended.db');
  let limit = EXTENDED_SOURCES.length;
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
    collapse: 'digest',
    limit: '500',
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
    digest: row[2],
  }));
}

function parseTimestamp(ts: string): Date {
  const y = parseInt(ts.substring(0, 4));
  const m = parseInt(ts.substring(4, 6)) - 1;
  const d = parseInt(ts.substring(6, 8));
  const h = parseInt(ts.substring(8, 10)) || 0;
  const min = parseInt(ts.substring(10, 12)) || 0;
  const s = parseInt(ts.substring(12, 14)) || 0;
  return new Date(y, m, d, h, min, s);
}

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
    if (existing.cnt >= TARGET_SNAPSHOTS) {
      console.log(`  ✅ Already have ${existing.cnt} snapshots, skipping fetch`);
      continue;
    }

    // Query CDX
    let entries: CDXEntry[];
    try {
      entries = await queryCDX(`https://${url}`);
      console.log(`  📊 CDX returned ${entries.length} unique snapshots`);
    } catch (err: any) {
      console.log(`  ❌ CDX error: ${err.message}`);
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

    const timestamps = pickTimestamps(entries, TARGET_SNAPSHOTS);
    console.log(`  🎯 Selected ${timestamps.length} timestamps (2-4 weeks apart)`);

    if (timestamps.length < 2) {
      console.log(`  ⚠️  Need at least 2 timestamps, only got ${timestamps.length}`);
      continue;
    }

    const first = parseTimestamp(timestamps[0]);
    const last = parseTimestamp(timestamps[timestamps.length - 1]);
    console.log(`  📅 Range: ${first.toISOString().split('T')[0]} → ${last.toISOString().split('T')[0]}`);

    for (let ti = 0; ti < timestamps.length; ti++) {
      const ts = timestamps[ti];

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

      // Rate limit: be nice to Wayback
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const { dbPath, limit, skipFetch } = parseArgs();
  const sources = EXTENDED_SOURCES.slice(0, limit);

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  Extended Wayback Fetcher — 20 Additional URLs               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`📦 Database: ${dbPath}`);
  console.log(`🌐 Sources: ${sources.length}`);
  console.log(`📸 Target: ${TARGET_SNAPSHOTS} snapshots per source, 2-4 weeks apart\n`);

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
    const pairs = Math.max(0, cnt.cnt - 1);
    totalSnaps += cnt.cnt;
    totalPairs += pairs;
    console.log(`  ${url}: ${cnt.cnt} snapshots, ${pairs} pairs`);
  }

  console.log(`\n  Total: ${totalSnaps} snapshots, ${totalPairs} pairs across ${urls.length} URLs`);

  db.close();
  console.log('\n✅ Done');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
