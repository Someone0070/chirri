import 'dotenv/config';
import { Worker } from 'bullmq';
import { createNotificationWorker } from './queues/notifications.js';

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
console.log('  Listening on queues: classification, notifications, webhook-delivery');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await classificationWorker.close();
  await notificationWorker.close();
  await webhookWorker.close();
  process.exit(0);
});
