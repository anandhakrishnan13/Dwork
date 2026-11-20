/**
 * Optional local development database.
 *
 * Downloads a PostgreSQL binary on first run and keeps it in ./backend/.pgdata.
 * Use this when you do not have a Supabase connection string yet.
 *
 *   npm run db:local
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/employees
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { createPool } from "../src/db/pool.js";

const port = Number(process.env.LOCAL_DB_PORT ?? 5432);
const databaseDir = join(process.cwd(), ".pgdata");
const connectionString = `postgresql://postgres:postgres@localhost:${port}/employees`;

const postgres = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
});

try {
  await postgres.initialise();
} catch {
  // Already initialised from a previous run.
}

await postgres.start();

try {
  await postgres.createDatabase("employees");
} catch {
  // Database already exists.
}

const pool = createPool(connectionString, false);
const schema = await readFile(join(process.cwd(), "db/schema.sql"), "utf8");
const seed = await readFile(join(process.cwd(), "db/seed.sql"), "utf8");
await pool.query(schema);

const { rows } = await pool.query<{ total: number }>("SELECT COUNT(*)::int AS total FROM employees");
if ((rows[0]?.total ?? 0) === 0) {
  await pool.query(seed);
  console.log("Seeded 13 sample employees.");
}

console.log(`Local PostgreSQL ready: ${connectionString}`);
console.log("Press Ctrl+C to stop.");

const shutdown = async () => {
  await pool.end();
  await postgres.stop();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

await new Promise(() => {});
