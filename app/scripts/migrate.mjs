#!/usr/bin/env node
/**
 * Migration runner for Railway deployments.
 *
 * Runs:
 *   1. Drizzle migrations from migrations/drizzle/
 *   2. Raw SQL migrations from migrations/sql/ (in filename order)
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

const client = new Client({ connectionString: DATABASE_URL });

async function runDrizzleMigrations() {
  const migrationsDir = path.resolve('migrations/drizzle');
  if (!fs.existsSync(migrationsDir)) {
    console.log('⏭️  No drizzle migrations directory found, skipping');
    return;
  }

  // Drizzle migration journal tracks applied migrations
  const journalPath = path.join(migrationsDir, 'meta', '_journal.json');
  if (!fs.existsSync(journalPath)) {
    console.log('⏭️  No drizzle journal found, skipping drizzle migrations');
    return;
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));

  // Create tracking table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
    )
  `);

  const applied = await client.query('SELECT hash FROM __drizzle_migrations ORDER BY id');
  const appliedHashes = new Set(applied.rows.map((r) => r.hash));

  for (const entry of journal.entries) {
    const tag = entry.tag;
    if (appliedHashes.has(tag)) {
      console.log(`  ✅ ${tag} (already applied)`);
      continue;
    }

    const sqlFile = path.join(migrationsDir, `${tag}.sql`);
    if (!fs.existsSync(sqlFile)) {
      console.error(`  ❌ Migration file not found: ${sqlFile}`);
      process.exit(1);
    }

    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log(`  🔄 Applying ${tag}...`);

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO __drizzle_migrations (hash) VALUES ($1)',
        [tag]
      );
      await client.query('COMMIT');
      console.log(`  ✅ ${tag}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ❌ Failed to apply ${tag}:`, err.message);
      process.exit(1);
    }
  }
}

async function runSqlMigrations() {
  const sqlDir = path.resolve('migrations/sql');
  if (!fs.existsSync(sqlDir)) {
    console.log('⏭️  No sql migrations directory found, skipping');
    return;
  }

  // Create tracking table for raw SQL migrations
  await client.query(`
    CREATE TABLE IF NOT EXISTS __sql_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const applied = await client.query('SELECT filename FROM __sql_migrations ORDER BY id');
  const appliedFiles = new Set(applied.rows.map((r) => r.filename));

  const files = fs.readdirSync(sqlDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedFiles.has(file)) {
      console.log(`  ✅ ${file} (already applied)`);
      continue;
    }

    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
    console.log(`  🔄 Applying ${file}...`);

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query(
        'INSERT INTO __sql_migrations (filename) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`  ✅ ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  ❌ Failed to apply ${file}:`, err.message);
      process.exit(1);
    }
  }
}

async function main() {
  console.log('🚀 Chirri Migration Runner\n');

  await client.connect();
  console.log('📦 Connected to database\n');

  console.log('── Drizzle Migrations ──');
  await runDrizzleMigrations();

  console.log('\n── SQL Migrations ──');
  await runSqlMigrations();

  await client.end();
  console.log('\n✨ All migrations complete!');
}

main().catch((err) => {
  console.error('💥 Migration failed:', err);
  process.exit(1);
});
