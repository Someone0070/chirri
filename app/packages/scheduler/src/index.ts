import 'dotenv/config';
import { Queue } from 'bullmq';
import { db, schema } from '@chirri/shared';
import { eq, lte, and, isNull, sql } from 'drizzle-orm';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = { url: redisUrl };

// BullMQ queues
const checkUrlQueue = new Queue('check-url', { connection });
const discoverSourcesQueue = new Queue('discover-sources', { connection });

console.log('🐦 Chirri Scheduler started');

// ─── URL Check Scheduling ───────────────────────────────────────────────────

async function scheduleDueChecks(): Promise<void> {
  const now = new Date();

  try {
    // Query URLs where next_check_at <= now and status is active
    const dueUrls = await db
      .select({
        id: schema.urls.id,
        url: schema.urls.url,
        userId: schema.urls.userId,
        sharedUrlId: schema.urls.sharedUrlId,
        checkInterval: schema.urls.checkInterval,
        parsedDomain: schema.urls.parsedDomain,
      })
      .from(schema.urls)
      .where(
        and(
          lte(schema.urls.nextCheckAt, now),
          eq(schema.urls.status, 'active'),
        ),
      )
      .limit(100); // Process up to 100 per tick

    if (dueUrls.length === 0) return;

    console.log(`[scheduler] Found ${dueUrls.length} URLs due for checking`);

    for (const urlRecord of dueUrls) {
      if (!urlRecord.sharedUrlId) continue;

      // Add check-url job
      await checkUrlQueue.add(
        'check',
        {
          urlId: urlRecord.id,
          url: urlRecord.url,
          userId: urlRecord.userId,
          sharedUrlId: urlRecord.sharedUrlId,
        },
        {
          jobId: `check-${urlRecord.id}-${now.getTime()}`,
          // Prevent duplicate jobs for the same URL
          deduplication: {
            id: `check-${urlRecord.id}`,
          },
        },
      );

      // Update next_check_at to prevent re-scheduling before the job completes
      const nextCheckAt = calculateNextCheck(now, urlRecord.checkInterval);
      await db
        .update(schema.urls)
        .set({ nextCheckAt })
        .where(eq(schema.urls.id, urlRecord.id));
    }
  } catch (err) {
    console.error('[scheduler] Error scheduling URL checks:', err);
  }
}

// ─── New URL Discovery ──────────────────────────────────────────────────────

async function scheduleNewUrlDiscovery(): Promise<void> {
  try {
    // Find URLs that were recently created (last 5 minutes) and haven't had discovery run
    // We use the absence of any shared_sources for that domain as a proxy
    const recentUrls = await db
      .select({
        id: schema.urls.id,
        parsedDomain: schema.urls.parsedDomain,
        url: schema.urls.url,
      })
      .from(schema.urls)
      .where(
        and(
          eq(schema.urls.status, 'learning'),
          isNull(schema.urls.learningStartedAt),
        ),
      )
      .limit(10);

    if (recentUrls.length === 0) return;

    console.log(`[scheduler] Found ${recentUrls.length} new URLs needing discovery`);

    for (const urlRecord of recentUrls) {
      if (!urlRecord.parsedDomain) continue;

      await discoverSourcesQueue.add(
        'discover',
        {
          urlId: urlRecord.id,
          domain: urlRecord.parsedDomain,
          endpoint: urlRecord.url,
        },
        {
          jobId: `discover-${urlRecord.id}`,
          deduplication: {
            id: `discover-${urlRecord.parsedDomain}`,
          },
        },
      );

      // Mark as learning started so we don't re-queue
      await db
        .update(schema.urls)
        .set({ learningStartedAt: new Date() })
        .where(eq(schema.urls.id, urlRecord.id));
    }
  } catch (err) {
    console.error('[scheduler] Error scheduling discovery:', err);
  }
}

// ─── Interval Calculation ───────────────────────────────────────────────────

function calculateNextCheck(from: Date, interval: string): Date {
  const match = interval.match(/^(\d+)(m|h|d)$/);
  if (!match) return new Date(from.getTime() + 24 * 60 * 60 * 1000);

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

// ─── Main Loop ──────────────────────────────────────────────────────────────

// Run every 60 seconds
const TICK_INTERVAL = 60_000;

async function tick(): Promise<void> {
  await scheduleDueChecks();
  await scheduleNewUrlDiscovery();
}

// Initial tick
tick().catch((err) => console.error('[scheduler] Initial tick failed:', err));

// Schedule recurring ticks
const intervalId = setInterval(() => {
  tick().catch((err) => console.error('[scheduler] Tick failed:', err));
}, TICK_INTERVAL);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Scheduler shutting down...');
  clearInterval(intervalId);
  await checkUrlQueue.close();
  await discoverSourcesQueue.close();
  process.exit(0);
});
