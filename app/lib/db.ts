/**
 * Direct Postgres connection (used by NextAuth to read/write the users table).
 * Uses a single shared pool across hot reloads in dev.
 */
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _btPool: Pool | undefined;
}

export const pool =
  global._btPool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // Most managed Postgres (Render, Supabase, RDS, Neon) need SSL.
    // If your DB is local and complains about SSL, set PGSSL=off in env.
    ssl:
      process.env.PGSSL === 'off'
        ? undefined
        : { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== 'production') global._btPool = pool;

export async function query<T = any>(
  text: string,
  params?: any[],
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
