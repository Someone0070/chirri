import 'dotenv/config';
import { Worker } from 'bullmq';
import { createNotificationWorker } from './queues/notifications.js';
import { createCheckUrlWorker } from './queues/check-url.js';
import { createDiscoverSourcesWorker } from './queues/discover-sources.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Classification queue worker
const classificationWorker = new Worker(
  'classification',
  async (job) => {
    console.log(`Processing classification job: ${job.id}`, job.data);
    // TODO: Implement classification logic
  },
  { connection: { url: redisUrl } },
);

// Notification queue worker — uses notification router
const notificationWorker = createNotificationWorker();

// Check URL queue worker — diff engine pipeline
const checkUrlWorker = createCheckUrlWorker();

// Discover sources queue worker — 9-method discovery
const discoverSourcesWorker = createDiscoverSourcesWorker();

// Webhook delivery queue worker
const webhookWorker = new Worker(
  'webhook-delivery',
  async (job) => {
    console.log(`Processing webhook delivery: ${job.id}`, job.data);
    // TODO: Implement standalone webhook delivery (for retry scenarios)
  },
  { connection: { url: redisUrl } },
);

console.log('🐦 Chirri Worker started');
console.log(
  '  Listening on queues: classification, notifications, check-url, discover-sources, webhook-delivery',
);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await classificationWorker.close();
  await notificationWorker.close();
  await checkUrlWorker.close();
  await discoverSourcesWorker.close();
  await webhookWorker.close();
  process.exit(0);
});
