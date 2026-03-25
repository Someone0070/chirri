import { Queue } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = { url: redisUrl };

export const classificationQueue = new Queue('classification', { connection });
export const notificationQueue = new Queue('notifications', { connection });
export const webhookDeliveryQueue = new Queue('webhook-delivery', { connection });
export const checkQueue = new Queue('url-checks', { connection });
export { checkUrlQueue } from './check-url.js';
export { discoverSourcesQueue } from './discover-sources.js';
