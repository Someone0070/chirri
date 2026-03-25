import type { Context } from 'hono';

export function errorHandler(err: Error, c: Context) {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: {
        code: 'internal_error',
        message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      },
    },
    500,
  );
}
