import { readFile } from "node:fs/promises";
import type { Pool } from "pg";

const schemaFile = new URL("../../db/schema.sql", import.meta.url);

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
    schema = await readFile(schemaFile, "utf8");
  } catch {
    throw new Error(
      `Could not read the database schema at ${schemaFile.pathname}. ` +
        "Run the API from the backend directory so db/schema.sql is available.",
    );
  }

  await pool.query(schema);
}
