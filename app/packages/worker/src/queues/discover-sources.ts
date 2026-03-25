/**
 * discover-sources queue — runs the 9-method discovery orchestrator
 * for a domain and stores results in the shared_sources table.
 */

import { Queue, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db, schema } from '@chirri/shared';
import { sharedSourceId, discoveryResultId } from '@chirri/shared/src/utils/id.js';
import { discoverDomain } from '../discovery/orchestrator.js';
import { filterByRelevance } from '../discovery/relevance.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DiscoverSourcesJobData {
  urlId: string;
  domain: string;
  endpoint?: string;
}

// ─── Queue ──────────────────────────────────────────────────────────────────

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = { url: redisUrl };

export const discoverSourcesQueue = new Queue<DiscoverSourcesJobData>('discover-sources', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 2000 },
  },
});

// ─── Processor ──────────────────────────────────────────────────────────────

export function createDiscoverSourcesWorker(): Worker<DiscoverSourcesJobData> {
  return new Worker<DiscoverSourcesJobData>(
    'discover-sources',
    async (job) => {
      const { urlId, domain, endpoint } = job.data;

      console.log(`[discover-sources] Processing job=${job.id} domain=${domain}`);

      // Step 1: Run discovery orchestrator
      const domainResult = await discoverDomain(domain);

      console.log(
        `[discover-sources] Found ${domainResult.total_discovered} sources for ${domain} ` +
          `(${domainResult.methods_succeeded}/9 methods succeeded)`,
      );

      // Step 2: Run relevance filtering (if endpoint provided)
      let relevantUrls: Array<{ url: string; type: string; confidence: number }> = [];

      if (endpoint) {
        const relevance = await filterByRelevance(endpoint, domainResult);
        relevantUrls = [
          ...relevance.changelog.map((r) => ({ url: r.url, type: r.type, confidence: r.score })),
          ...relevance.status.map((r) => ({ url: r.url, type: r.type, confidence: r.score })),
          ...relevance.openapi.map((r) => ({ url: r.url, type: r.type, confidence: r.score })),
          ...relevance.relevantDocs.map((r) => ({ url: r.url, type: r.type, confidence: r.score })),
        ];
      } else {
        // Without endpoint, use all discovered sources
        const all = [
          ...domainResult.discovered.docs,
          ...domainResult.discovered.changelog,
          ...domainResult.discovered.status,
          ...domainResult.discovered.openapi,
        ];
        relevantUrls = all.map((r) => ({
          url: r.url,
          type: r.type,
          confidence: Math.round(r.confidence * 100),
        }));
      }

      // Step 3: Store discovered sources in shared_sources table
      let storedCount = 0;
      for (const source of relevantUrls) {
        try {
          // Check if this source already exists for this domain
          const existing = await db
            .select({ id: schema.sharedSources.id })
            .from(schema.sharedSources)
            .where(eq(schema.sharedSources.url, source.url))
            .limit(1);

          if (existing.length === 0) {
            await db.insert(schema.sharedSources).values({
              id: sharedSourceId(),
              domain,
              sourceType: source.type,
              url: source.url,
              discoveryMethod: 'auto',
              status: 'active',
              subscriberCount: 1,
            });
            storedCount++;
          }
        } catch (err) {
          console.warn(`[discover-sources] Failed to store source ${source.url}:`, err);
        }
      }

      // Step 4: Store discovery results for audit
      for (const source of relevantUrls.slice(0, 50)) {
        try {
          await db.insert(schema.discoveryResults).values({
            id: discoveryResultId(),
            domain,
            probeUrl: source.url,
            contentType: source.type,
            isUseful: true,
            suggestedSourceType: source.type,
          });
        } catch {
          // Ignore duplicate/error
        }
      }

      console.log(
        `[discover-sources] Stored ${storedCount} new sources for ${domain} (${relevantUrls.length} total relevant)`,
      );

      // Step 5: Log errors if any
      if (domainResult.errors.length > 0) {
        console.warn(
          `[discover-sources] Errors during discovery of ${domain}:`,
          domainResult.errors.join(', '),
        );
      }
    },
    {
      connection,
      concurrency: 2,
    },
  );
}
