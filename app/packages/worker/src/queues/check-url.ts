/**
 * check-url queue — fetches a page, compares to previous snapshot,
 * runs the voting pipeline, and triggers notifications on real changes.
 */

import { Queue, Worker } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { db, schema } from '@chirri/shared';
import {
  storeSnapshot,
  getLatestSnapshot,
  storeChange,
  getRecentSnapshots,
} from '@chirri/shared/src/services/snapshot-store.js';
import { fetchUrl } from '../checkers/fetcher.js';
import { runVotingPipeline, type SnapshotData } from '../checkers/pipeline.js';
import { extractSections } from '../checkers/section-extractor.js';
import { analyzeVolatility } from '../checkers/learning.js';
import { notificationQueue } from './notifications.js';
import { checkMcpServer } from '../checkers/mcp/pipeline.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CheckUrlJobData {
  urlId: string;
  url: string;
  userId: string;
  resource?: string;
  sharedUrlId: string;
}

// ─── Queue ──────────────────────────────────────────────────────────────────

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = { url: redisUrl };

export const checkUrlQueue = new Queue<CheckUrlJobData>('check-url', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 10_000 },
    removeOnComplete: { count: 2000 },
    removeOnFail: { count: 5000 },
  },
});

// ─── Processor ──────────────────────────────────────────────────────────────

export function createCheckUrlWorker(): Worker<CheckUrlJobData> {
  return new Worker<CheckUrlJobData>(
    'check-url',
    async (job) => {
      const { urlId, url, userId, resource, sharedUrlId } = job.data;

      console.log(`[check-url] Processing job=${job.id} url=${url}`);

      // ── Branch: check source_type for MCP servers ──
      const urlRows = await db
        .select({
          sourceType: schema.urls.sourceType,
          mcpConfig: schema.urls.mcpConfig,
        })
        .from(schema.urls)
        .where(eq(schema.urls.id, urlId))
        .limit(1);

      const urlRecord = urlRows[0];
      if (urlRecord?.sourceType === 'mcp_server') {
        const mcpConfig = (urlRecord.mcpConfig || {}) as {
          transport?: 'sse' | 'http';
          endpoint: string;
          authHeader?: string;
          serverInfo?: { name: string; version: string; vendor?: string };
        };

        await checkMcpServer({
          urlId,
          userId,
          sharedUrlId,
          mcpConfig: {
            ...mcpConfig,
            endpoint: mcpConfig.endpoint || url,
          },
        });

        // Update timestamps after MCP check
        await updateCheckTimestamps(urlId, sharedUrlId);
        return;
      }

      // ── HTTP monitoring path (existing) ──

      // Step 1: Fetch page
      const fetchResult = await fetchUrl(url);
      if (fetchResult.error && !fetchResult.rawHtml) {
        console.warn(`[check-url] Fetch failed for ${url}: ${fetchResult.error}`);
        throw new Error(`Fetch failed: ${fetchResult.error}`);
      }

      // Step 2: Get previous snapshot
      const previousSnapshot = await getLatestSnapshot(sharedUrlId);

      // Step 3: Store current snapshot
      const currentSnapshotId = await storeSnapshot(
        sharedUrlId,
        fetchResult.rawHtml,
        fetchResult.readabilityText,
        fetchResult.textOnly,
        fetchResult.structuralDom,
        fetchResult.fetchTier,
      );

      // Step 4: If no previous snapshot, this is baseline — we're done
      if (!previousSnapshot) {
        console.log(`[check-url] No previous snapshot for ${url} — stored baseline`);
        await updateCheckTimestamps(urlId, sharedUrlId);
        return;
      }

      // Step 5: Build snapshot data for pipeline
      const before: SnapshotData = {
        rawHtml: previousSnapshot.rawHtml,
        readabilityText: previousSnapshot.readabilityText,
        structuralDom: previousSnapshot.structuralDom,
        textOnly: previousSnapshot.textOnly,
      };

      const after: SnapshotData = {
        rawHtml: fetchResult.rawHtml,
        readabilityText: fetchResult.readabilityText,
        structuralDom: fetchResult.structuralDom,
        textOnly: fetchResult.textOnly,
      };

      // Step 5b: Get volatile patterns from learning
      let volatilePatterns: string[] = [];
      try {
        const recentSnapshots = await getRecentSnapshots(sharedUrlId, 20);
        if (recentSnapshots.length >= 3) {
          const texts = recentSnapshots.map((s) => s.readabilityText).reverse();
          const { volatileSegments } = analyzeVolatility(texts, 3);
          volatilePatterns = volatileSegments;
        }
      } catch (err) {
        console.warn(`[check-url] Volatile learning failed for ${url}:`, err);
      }

      // Step 6: Run voting pipeline
      const result = runVotingPipeline(before, after, { volatilePatterns });

      console.log(
        `[check-url] ${url}: ${result.votes}/4 votes, verdict=${result.verdict}, confidence=${result.confidence}`,
      );

      // Step 7: If 2+ votes (likely real), extract section and store change
      if (result.votes >= 2) {
        let summary = `Change detected: ${result.changeType} (${result.votes}/4 votes, confidence ${result.confidence})`;

        // Extract section if resource specified
        if (resource && fetchResult.rawHtml) {
          try {
            const extraction = extractSections({
              html: fetchResult.rawHtml,
              resourceNames: [resource],
            });
            if (extraction.sections.length > 0) {
              summary += ` — section: ${extraction.sections[0].heading || resource}`;
            }
          } catch (err) {
            console.warn(`[check-url] Section extraction failed for ${url}:`, err);
          }
        }

        // Determine severity based on votes
        const severity =
          result.votes >= 4 ? 'critical' :
          result.votes >= 3 ? 'high' :
          'medium';

        // Store the change
        const changeId = await storeChange(sharedUrlId, userId, urlId, {
          changeType: result.changeType,
          severity,
          confidence: Math.round(result.confidence * 100),
          summary,
          diff: {
            votes: result.votes,
            verdict: result.verdict,
            strategyVotes: result.strategyVotes,
            readabilityDiff: result.readabilityDiff.substring(0, 10000),
          },
          previousSnapshotId: previousSnapshot.id,
          currentSnapshotId,
        });

        console.log(`[check-url] Change stored: ${changeId} for ${url}`);

        // Step 8: Queue notification
        await notificationQueue.add('notify', {
          userId,
          changeId,
        });

        console.log(`[check-url] Notification queued for change=${changeId}`);
      }

      // Step 9: Update timestamps
      await updateCheckTimestamps(urlId, sharedUrlId);
    },
    {
      connection,
      concurrency: 5,
    },
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function updateCheckTimestamps(urlId: string, sharedUrlId: string): Promise<void> {
  const now = new Date();

  // Get the URL's check interval
  const urlRows = await db
    .select({ checkInterval: schema.urls.checkInterval })
    .from(schema.urls)
    .where(eq(schema.urls.id, urlId))
    .limit(1);

  const checkInterval = urlRows[0]?.checkInterval || '24h';
  const nextCheckAt = calculateNextCheck(now, checkInterval);

  // Update URL
  await db
    .update(schema.urls)
    .set({ lastCheckAt: now, nextCheckAt, updatedAt: now })
    .where(eq(schema.urls.id, urlId));

  // Update shared URL
  await db
    .update(schema.sharedUrls)
    .set({ lastCheckAt: now, nextCheckAt, updatedAt: now })
    .where(eq(schema.sharedUrls.id, sharedUrlId));
}

function calculateNextCheck(from: Date, interval: string): Date {
  const match = interval.match(/^(\d+)(m|h|d)$/);
  if (!match) return new Date(from.getTime() + 24 * 60 * 60 * 1000); // default 24h

  const value = parseInt(match[1]);
  const unit = match[2];

  let ms: number;
  switch (unit) {
    case 'm': ms = value * 60 * 1000; break;
    case 'h': ms = value * 60 * 60 * 1000; break;
    case 'd': ms = value * 24 * 60 * 60 * 1000; break;
    default: ms = 24 * 60 * 60 * 1000;
  }

  return new Date(from.getTime() + ms);
}
