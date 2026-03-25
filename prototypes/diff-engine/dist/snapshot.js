/**
 * Snapshot storage using SQLite
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'snapshots.db');
let _db = null;
function getDb() {
    if (_db)
        return _db;
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
  `);
    return _db;
}
/**
 * Store a new snapshot
 */
export function storeSnapshot(data) {
    const db = getDb();
    const stmt = db.prepare(`
    INSERT INTO snapshots (url, raw_html, readability_text, structural_dom, text_only, fetch_method, fetch_time_ms, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(data.url, data.rawHtml, data.readabilityText, data.structuralDom, data.textOnly, data.fetchMethod, data.fetchTimeMs, data.error || null);
    return result.lastInsertRowid;
}
/**
 * Get the latest snapshot for a URL
 */
export function getLatestSnapshot(url) {
    const db = getDb();
    const row = db.prepare(`
    SELECT id, url, timestamp, raw_html, readability_text, structural_dom, text_only, fetch_method, fetch_time_ms, error
    FROM snapshots
    WHERE url = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(url);
    if (!row)
        return null;
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
export function getPreviousSnapshot(url) {
    const db = getDb();
    const row = db.prepare(`
    SELECT id, url, timestamp, raw_html, readability_text, structural_dom, text_only, fetch_method, fetch_time_ms, error
    FROM snapshots
    WHERE url = ?
    ORDER BY timestamp DESC
    LIMIT 1 OFFSET 1
  `).get(url);
    if (!row)
        return null;
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
export function getSnapshotCount(url) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM snapshots WHERE url = ?').get(url);
    return row?.cnt || 0;
}
/**
 * Close the database connection
 */
export function closeDb() {
    if (_db) {
        _db.close();
        _db = null;
    }
}
