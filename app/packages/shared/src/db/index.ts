import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://chirri:chirri@localhost:5432/chirri',
});

export const db = drizzle(pool, { schema });
export { pool };
export type Database = typeof db;
