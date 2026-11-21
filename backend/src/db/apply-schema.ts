import { readFile } from "node:fs/promises";
import type { Pool } from "pg";

import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Resolve relative to this module first, then the working directory, because
// bundled serverless builds may move the compiled file.
const candidates = [
  new URL("../../db/schema.sql", import.meta.url).pathname,
  resolve(process.cwd(), "db/schema.sql"),
  resolve(process.cwd(), "backend/db/schema.sql"),
];
const schemaFile = {
  pathname: candidates.find((path) => existsSync(path)) ?? candidates[0]!,
};

/**
 * Applies the idempotent database schema.
 *
 * Every statement uses IF NOT EXISTS, so this is safe to run on every startup.
 * That keeps a fresh Supabase project (or any empty PostgreSQL database) from
 * failing later with "relation does not exist" during account seeding.
 */
export async function applySchema(pool: Pool): Promise<void> {
  let schema: string;

  try {
    schema = await readFile(schemaFile.pathname, "utf8");
  } catch {
    throw new Error(
      `Could not read the database schema at ${schemaFile.pathname}. ` +
        "Run the API from the backend directory so db/schema.sql is available.",
    );
  }

  await pool.query(schema);
}
