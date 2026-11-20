import pg from "pg";
import type { Pool } from "pg";

/**
 * Creates a connection pool for any PostgreSQL instance, including Supabase.
 * Supabase requires TLS; `rejectUnauthorized: false` lets hosted certificates
 * work without shipping a custom CA bundle.
 */
export function createPool(connectionString: string, ssl: boolean): Pool {
  return new pg.Pool({
    connectionString,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}
