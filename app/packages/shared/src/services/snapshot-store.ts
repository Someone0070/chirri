/**
 * Snapshot Storage — stores and retrieves page snapshots and changes using Postgres.
 *
 * Uses the check_results partitioned table (via raw SQL) for snapshots,
 * and the `changes` + `userChanges` tables for detected changes.
 */

import { db, pool } from '../db/index.js';
import * as schema from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { checkResultId, changeId as genChangeId, userChangeId } from '../utils/id.js';

export interface SnapshotRecord {
  id: string;
  sharedUrlId: string;
  rawHtml: string;
  readabilityText: string;
  textOnly: string;
  structuralDom: string;
  fetchTier: number;
  checkedAt: Date;
}

export interface ChangeRecord {
  id: string;
  sharedUrlId: string;
  changeType: string;
  severity: string;
  confidence: number;
  summary: string;
  diff: Record<string, unknown>;
  previousBodyR2Key: string;
  currentBodyR2Key: string;
}

/**
 * Store a page snapshot in check_results.
 * Uses raw SQL since check_results is a partitioned table.
 */
export async function storeSnapshot(
  sharedUrlId: string,
  rawHtml: string,
  readabilityText: string,
  textOnly: string,
  structuralDom: string,
  fetchTier: number,
): Promise<string> {
  const id = checkResultId();
  const now = new Date();

  await pool.query(
    `INSERT INTO check_results (
      id, shared_url_id, checked_at, status_code, response_time_ms,
      body_hash, body_r2_key, body_size_bytes,
      stable_hash, schema_hash, header_hash,
      response_headers, content_type,
      raw_html, readability_text, text_only, structural_dom, fetch_tier
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
    [
      id,
      sharedUrlId,
      now,
      200, // status_code
      0, // response_time_ms
      '', // body_hash
      `snapshots/${sharedUrlId}/${id}`, // body_r2_key (logical key)
      rawHtml.length, // body_size_bytes
      '', // stable_hash
      '', // schema_hash
      '', // header_hash
      '{}', // response_headers
      'text/html', // content_type
      rawHtml,
      readabilityText,
      textOnly,
      structuralDom,
      fetchTier,
    ],
  );

  return id;
}

/**
 * Get the latest snapshot for a shared URL.
 */
export async function getLatestSnapshot(
  sharedUrlId: string,
): Promise<SnapshotRecord | null> {
  const result = await pool.query(
    `SELECT id, shared_url_id, raw_html, readability_text, text_only, structural_dom, fetch_tier, checked_at
     FROM check_results
     WHERE shared_url_id = $1
     ORDER BY checked_at DESC
     LIMIT 1`,
    [sharedUrlId],
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    sharedUrlId: row.shared_url_id,
    rawHtml: row.raw_html || '',
    readabilityText: row.readability_text || '',
    textOnly: row.text_only || '',
    structuralDom: row.structural_dom || '',
    fetchTier: row.fetch_tier || 1,
    checkedAt: row.checked_at,
  };
}

/**
 * Store a detected change in the changes table and create a user_changes entry.
 */
export async function storeChange(
  sharedUrlId: string,
  userId: string,
  urlId: string,
  changeData: {
    changeType: string;
    severity: string;
    confidence: number;
    summary: string;
    diff: Record<string, unknown>;
    previousSnapshotId: string;
    currentSnapshotId: string;
  },
): Promise<string> {
  const id = genChangeId();

  await db.insert(schema.changes).values({
    id,
    sharedUrlId,
    changeType: changeData.changeType,
    severity: changeData.severity,
    confidence: changeData.confidence,
    summary: changeData.summary,
    diff: changeData.diff,
    previousBodyR2Key: `snapshots/${sharedUrlId}/${changeData.previousSnapshotId}`,
    currentBodyR2Key: `snapshots/${sharedUrlId}/${changeData.currentSnapshotId}`,
    confirmationStatus: 'confirmed',
    confirmedAt: new Date(),
  });

  // Create user_changes entry
  await db.insert(schema.userChanges).values({
    id: userChangeId(),
    userId,
    changeId: id,
    urlId,
    workflowState: 'new',
    alerted: true,
  });

  return id;
}

/**
 * Get recent snapshots for volatile field learning.
 */
export async function getRecentSnapshots(
  sharedUrlId: string,
  limit = 20,
): Promise<Array<{ readabilityText: string; checkedAt: Date }>> {
  const result = await pool.query(
    `SELECT readability_text, checked_at
     FROM check_results
     WHERE shared_url_id = $1
     ORDER BY checked_at DESC
     LIMIT $2`,
    [sharedUrlId, limit],
  );

  return result.rows.map((row) => ({
    readabilityText: row.readability_text || '',
    checkedAt: row.checked_at,
  }));
}
