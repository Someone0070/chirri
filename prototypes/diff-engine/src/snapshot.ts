/**
 * Snapshot storage using SQLite
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'snapshots.db');

export interface Snapshot {
  id: number;
  url: string;
  timestamp: string;
  rawHtml: string;
  readabilityText: string;
  structuralDom: string;
  textOnly: string;
  fetchMethod: string;
  fetchTimeMs: number;
  error: string | null;
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      raw_html TEXT NOT NULL DEFAULT '',
      readability_text TEXT NOT NULL DEFAULT '',
      structural_dom TEXT NOT NULL DEFAULT '',
      text_only TEXT NOT NULL DEFAULT '',
      fetch_method TEXT NOT NULL DEFAULT 'http',
      fetch_time_ms INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_url ON snapshots(url);
    CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp);

    -- Layer 1: Volatile field filtering
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

    -- Layer 2: Confirmation recheck
    CREATE TABLE IF NOT EXISTS pending_confirmations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      first_detected_at TEXT NOT NULL DEFAULT (datetime('now')),
      stage INTEGER NOT NULL DEFAULT 1,
      confirmed_at TEXT,
      diff_hash TEXT NOT NULL,
      discarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_confirmations_url ON pending_confirmations(url);

    -- Layer 3: Content stability scoring
    CREATE TABLE IF NOT EXISTS stability_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL UNIQUE,
      window_size INTEGER NOT NULL DEFAULT 10,
      changes_in_window INTEGER NOT NULL DEFAULT 0,
      score REAL NOT NULL DEFAULT 1.0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_stability_url ON stability_scores(url);

    -- Layer 5: Cross-source correlation
    CREATE TABLE IF NOT EXISTS change_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'primary',
      detected_at TEXT NOT NULL DEFAULT (datetime('now')),
      diff_hash TEXT NOT NULL,
      confirmed INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_signals_url ON change_signals(url);

    -- Layer 6: Feedback loop
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      change_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      is_false_positive INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_feedback_change ON feedback(change_id);

    -- Section extraction snapshots
    CREATE TABLE IF NOT EXISTS section_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      resource_key TEXT NOT NULL,
      section_hash TEXT NOT NULL,
      section_text TEXT NOT NULL,
      section_html TEXT,
      confidence TEXT NOT NULL,
      platform TEXT,
      fetched_at INTEGER NOT NULL,
      UNIQUE(url, resource_key, fetched_at)
    );
    CREATE INDEX IF NOT EXISTS idx_section_latest ON section_snapshots(url, resource_key, fetched_at DESC);
  `);

  // Migration: add fetch_tier column if it doesn't exist
  try {
    _db.exec(`ALTER TABLE snapshots ADD COLUMN fetch_tier INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists — ignore
  }

  return _db;
}

/**
 * Get all snapshots for a URL ordered by timestamp desc
 */
export function getSnapshotsForUrl(url: string, limit = 10): Snapshot[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, url, timestamp, raw_html, readability_text, structural_dom, text_only, fetch_method, fetch_time_ms, error
    FROM snapshots
    WHERE url = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(url, limit) as any[];

  return rows.map(row => ({
    id: row.id,
    url: row.url,
    timestamp: row.timestamp,
    rawHtml: row.raw_html,
    readabilityText: row.readability_text,
    structuralDom: row.structural_dom,
    textOnly: row.text_only,
    fetchMethod: row.fetch_method,
    fetchTimeMs: row.fetch_time_ms,
    error: row.error,
  }));
}

/**
 * Get all distinct URLs in the DB
 */
export function getAllUrls(): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT DISTINCT url FROM snapshots ORDER BY url').all() as any[];
  return rows.map(r => r.url);
}

/**
 * Store a new snapshot
 */
export function storeSnapshot(data: {
  url: string;
  rawHtml: string;
  readabilityText: string;
  structuralDom: string;
  textOnly: string;
  fetchMethod: string;
  fetchTier?: number;
  fetchTimeMs: number;
  error?: string | null;
}): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO snapshots (url, raw_html, readability_text, structural_dom, text_only, fetch_method, fetch_tier, fetch_time_ms, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.url,
    data.rawHtml,
    data.readabilityText,
    data.structuralDom,
    data.textOnly,
    data.fetchMethod,
    data.fetchTier || 0,
    data.fetchTimeMs,
    data.error || null
  );
  return result.lastInsertRowid as number;
}

/**
 * Get the latest snapshot for a URL
 */
export function getLatestSnapshot(url: string): Snapshot | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, url, timestamp, raw_html, readability_text, structural_dom, text_only, fetch_method, fetch_time_ms, error
    FROM snapshots
    WHERE url = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(url) as any;

  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    timestamp: row.timestamp,
    rawHtml: row.raw_html,
    readabilityText: row.readability_text,
    structuralDom: row.structural_dom,
    textOnly: row.text_only,
    fetchMethod: row.fetch_method,
    fetchTimeMs: row.fetch_time_ms,
    error: row.error,
  };
}

/**
 * Get the previous snapshot for a URL (second most recent)
 */
export function getPreviousSnapshot(url: string): Snapshot | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, url, timestamp, raw_html, readability_text, structural_dom, text_only, fetch_method, fetch_time_ms, error
    FROM snapshots
    WHERE url = ?
    ORDER BY timestamp DESC
    LIMIT 1 OFFSET 1
  `).get(url) as any;

  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    timestamp: row.timestamp,
    rawHtml: row.raw_html,
    readabilityText: row.readability_text,
    structuralDom: row.structural_dom,
    textOnly: row.text_only,
    fetchMethod: row.fetch_method,
    fetchTimeMs: row.fetch_time_ms,
    error: row.error,
  };
}

/**
 * Get snapshot count for a URL
 */
export function getSnapshotCount(url: string): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM snapshots WHERE url = ?').get(url) as any;
  return row?.cnt || 0;
}

// ─── Section Snapshot Helpers ────────────────────────────────────────────────

export interface SectionSnapshot {
  id: number;
  url: string;
  resourceKey: string;
  sectionHash: string;
  sectionText: string;
  sectionHtml: string | null;
  confidence: string;
  platform: string | null;
  fetchedAt: number;
}

/**
 * Store a section snapshot
 */
export function storeSectionSnapshot(data: {
  url: string;
  resourceKey: string;
  sectionHash: string;
  sectionText: string;
  sectionHtml?: string;
  confidence: string;
  platform?: string;
}): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO section_snapshots (url, resource_key, section_hash, section_text, section_html, confidence, platform, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.url,
    data.resourceKey,
    data.sectionHash,
    data.sectionText,
    data.sectionHtml || null,
    data.confidence,
    data.platform || null,
    Date.now()
  );
  return result.lastInsertRowid as number;
}

/**
 * Get the latest section snapshot for a URL + resource key
 */
export function getLatestSectionSnapshot(url: string, resourceKey: string): SectionSnapshot | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, url, resource_key, section_hash, section_text, section_html, confidence, platform, fetched_at
    FROM section_snapshots
    WHERE url = ? AND resource_key = ?
    ORDER BY fetched_at DESC
    LIMIT 1
  `).get(url, resourceKey) as any;

  if (!row) return null;
  return {
    id: row.id,
    url: row.url,
    resourceKey: row.resource_key,
    sectionHash: row.section_hash,
    sectionText: row.section_text,
    sectionHtml: row.section_html,
    confidence: row.confidence,
    platform: row.platform,
    fetchedAt: row.fetched_at,
  };
}

/**
 * Close the database connection
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
