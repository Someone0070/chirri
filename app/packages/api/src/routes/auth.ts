import { Hono } from 'hono';
import { auth } from '../auth.js';

export const authRoute = new Hono();

// Mount better-auth handler — it handles all /api/auth/* routes:
// POST /api/auth/sign-up/email
// POST /api/auth/sign-in/email
// POST /api/auth/sign-out
// POST /api/auth/forgot-password
// POST /api/auth/reset-password
// GET  /api/auth/verify-email
// GET  /api/auth/session
authRoute.all('/api/auth/*', async (c) => {
  const response = await auth.handler(c.req.raw);
  return response;
});
