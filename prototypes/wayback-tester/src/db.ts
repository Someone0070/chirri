/**
 * SQLite database for wayback-tester
 */
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '..', 'wayback.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      html TEXT,
      readability_text TEXT,
      text_only TEXT,
      fetched_at TEXT DEFAULT (datetime('now')),
      error TEXT,
      UNIQUE(url, timestamp)
    );
    CREATE INDEX IF NOT EXISTS idx_snap_url ON snapshots(url);
    CREATE INDEX IF NOT EXISTS idx_snap_ts ON snapshots(url, timestamp);

    CREATE TABLE IF NOT EXISTS diff_pairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      ts_old TEXT NOT NULL,
      ts_new TEXT NOT NULL,
      strategy TEXT NOT NULL,
      has_change INTEGER NOT NULL DEFAULT 0,
      noise_estimate REAL NOT NULL DEFAULT 0,
      diff_size INTEGER NOT NULL DEFAULT 0,
      added_lines INTEGER NOT NULL DEFAULT 0,
      removed_lines INTEGER NOT NULL DEFAULT 0,
      diff_text TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(url, ts_old, ts_new, strategy)
    );
    CREATE INDEX IF NOT EXISTS idx_diff_url ON diff_pairs(url);

    CREATE TABLE IF NOT EXISTS llm_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair_id INTEGER NOT NULL,
      model TEXT NOT NULL,
      severity TEXT,
      is_breaking INTEGER,
      what_changed TEXT,
      confidence REAL,
      action_required TEXT,
      raw_response TEXT,
      cost REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (pair_id) REFERENCES diff_pairs(id)
    );
    CREATE INDEX IF NOT EXISTS idx_llm_pair ON llm_results(pair_id);

    CREATE TABLE IF NOT EXISTS cdx_index (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      status_code TEXT,
      fetched_at TEXT DEFAULT (datetime('now')),
      UNIQUE(url, timestamp)
    );
    CREATE INDEX IF NOT EXISTS idx_cdx_url ON cdx_index(url);
  `);
  return _db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
