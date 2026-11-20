import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applySchema } from "../src/db/apply-schema.js";
import { createPool } from "../src/db/pool.js";

const PORT = 55433;
const CONNECTION_STRING = `postgresql://postgres:postgres@localhost:${PORT}/employees_schema_test`;

let postgres: EmbeddedPostgres;
let pool: Pool;
let databaseDir: string;

async function tableNames(): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

beforeAll(async () => {
  databaseDir = await mkdtemp(join(tmpdir(), "employee-directory-schema-pg-"));
  postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: false,
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("employees_schema_test");
  pool = createPool(CONNECTION_STRING, false);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await postgres?.stop();
  await rm(databaseDir, { recursive: true, force: true });
});

describe("applySchema", () => {
  it("creates the tables an empty database needs and can run again safely", async () => {
    expect(await tableNames()).toEqual([]);

    await applySchema(pool);

    expect(await tableNames()).toEqual(["employees", "users"]);

    await expect(applySchema(pool)).resolves.toBeUndefined();
    expect(await tableNames()).toEqual(["employees", "users"]);
  });
});
