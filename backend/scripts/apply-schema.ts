/**
 * Applies db/schema.sql to the database in DATABASE_URL.
 *
 *   npm run db:schema
 *
 * The schema is idempotent, so running this repeatedly is safe. The API also
 * applies it on startup; this script is useful for pre-provisioning a database.
 */
import { loadConfig } from "../src/config.js";
import { applySchema } from "../src/db/apply-schema.js";
import { createPool } from "../src/db/pool.js";

const config = loadConfig();
const pool = createPool(config.databaseUrl, config.dbSsl);

try {
  await applySchema(pool);
  console.log("Database schema applied.");
} catch (error) {
  console.error("Could not apply the database schema:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
