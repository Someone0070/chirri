import { cors } from 'hono/cors';

export const corsMiddleware = cors({
  origin: process.env.DASHBOARD_ORIGIN || 'http://localhost:5173',
  credentials: true,
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours
});
