import { Queue, Worker } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { db, schema, routeNotification } from '@chirri/shared';

// ============================================================================
// Types
// ============================================================================

export interface NotificationJobData {
  userId: string;
  changeId: string;
  channels?: string[]; // optional filter: ['email', 'slack', 'discord', 'webhook']
}

// ============================================================================
// Queue
// ============================================================================

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = { url: redisUrl };

export const notificationQueue = new Queue<NotificationJobData>('notifications', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5_000, // 5s initial, then 10s, 20s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

// ============================================================================
// Processor
// ============================================================================

export function createNotificationWorker(): Worker<NotificationJobData> {
  return new Worker<NotificationJobData>(
    'notifications',
    async (job) => {
      const { userId, changeId } = job.data;

      console.log(`[notifications] Processing job=${job.id} user=${userId} change=${changeId}`);

      // Fetch change details for the notification
      const changeRows = await db
        .select({
          id: schema.changes.id,
          summary: schema.changes.summary,
          severity: schema.changes.severity,
          changeType: schema.changes.changeType,
          detectedAt: schema.changes.detectedAt,
          sharedUrlId: schema.changes.sharedUrlId,
        })
        .from(schema.changes)
        .where(eq(schema.changes.id, changeId))
        .limit(1);

      if (changeRows.length === 0) {
        console.warn(`[notifications] Change ${changeId} not found, skipping`);
        return;
      }

      const change = changeRows[0];

      // Resolve the URL for this change + user
      const urlRows = await db
        .select({ url: schema.urls.url })
        .from(schema.urls)
        .where(
          and(
            eq(schema.urls.userId, userId),
            eq(schema.urls.sharedUrlId, change.sharedUrlId),
          ),
        )
        .limit(1);

      const url = urlRows[0]?.url || 'unknown';

      const results = await routeNotification(userId, {
        id: change.id,
        summary: change.summary,
        severity: change.severity,
        changeType: change.changeType,
        url,
        detectedAt: change.detectedAt.toISOString(),
      });

      const failures = results.filter((r) => !r.success);
      if (failures.length > 0) {
        console.warn(
          `[notifications] Some channels failed for change=${changeId}:`,
          failures.map((f) => `${f.channel}: ${f.error}`).join(', '),
        );
      }

      console.log(
        `[notifications] Completed job=${job.id} channels=${results.length} failures=${failures.length}`,
      );
    },
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 50,
        duration: 60_000, // 50 jobs per minute
      },
    },
  );
}
