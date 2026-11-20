import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import EmbeddedPostgres from "embedded-postgres";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { seedSuperAdmin } from "../src/auth/seed.js";
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db/pool.js";

const PORT = 55432;
const CONNECTION_STRING = `postgresql://postgres:postgres@localhost:${PORT}/employees_test`;

let postgres: EmbeddedPostgres;
let pool: Pool;
let app: ReturnType<typeof createApp>;
let databaseDir: string;

async function seed() {
  await pool.query(`
    INSERT INTO employees (name, email, role, created_at)
    SELECT
      'Employee ' || lpad(i::text, 2, '0'),
      'employee' || i || '@example.com',
      CASE WHEN i % 2 = 0 THEN 'Designer' ELSE 'Engineer' END,
      NOW() + (i || ' seconds')::interval
    FROM generate_series(1, 13) AS i
  `);
}

beforeAll(async () => {
  databaseDir = await mkdtemp(join(tmpdir(), "employee-directory-pg-"));
  postgres = new EmbeddedPostgres({
    databaseDir,
    user: "postgres",
    password: "postgres",
    port: PORT,
    persistent: false,
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase("employees_test");

  pool = createPool(CONNECTION_STRING, false);
  const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
  app = createApp(pool, { corsOrigins: ["http://localhost:3000"] });
}, 120_000);

beforeEach(async () => {
  await pool.query("TRUNCATE employees RESTART IDENTITY CASCADE");
  await seed();
});

afterAll(async () => {
  await pool?.end();
  await postgres?.stop();
  await rm(databaseDir, { recursive: true, force: true });
});

describe("GET /health", () => {
  it("reports the API and database are reachable", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});

describe("GET /employees", () => {
  it("returns the first page with server-controlled pagination metadata", async () => {
    const response = await request(app).get("/employees");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      currentPage: 1,
      pageSize: 10,
      totalPages: 2,
      totalRecords: 13,
    });
    expect(response.body.data).toHaveLength(10);
    expect(response.body.data[0].name).toBe("Employee 13");
  });

  it("returns the remainder on the last page", async () => {
    const response = await request(app).get("/employees?page=2");

    expect(response.status).toBe(200);
    expect(response.body.currentPage).toBe(2);
    expect(response.body.data).toHaveLength(3);
    expect(response.body.data.map((employee: { name: string }) => employee.name)).toEqual([
      "Employee 03",
      "Employee 02",
      "Employee 01",
    ]);
  });

  it("ignores client-supplied page sizes", async () => {
    const response = await request(app).get("/employees?limit=1&pageSize=1&perPage=1");
    expect(response.body.data).toHaveLength(10);
    expect(response.body.pageSize).toBe(10);
  });

  it("falls back to page 1 for invalid pages", async () => {
    const response = await request(app).get("/employees?page=abc");
    expect(response.body.currentPage).toBe(1);
    expect(response.body.data).toHaveLength(10);
  });

  it("returns an empty page past the end without breaking metadata", async () => {
    const response = await request(app).get("/employees?page=99");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.totalPages).toBe(2);
    expect(response.body.totalRecords).toBe(13);
  });

  it("searches name, email and role case-insensitively", async () => {
    const byName = await request(app).get("/employees?search=employee%2012");
    expect(byName.body.totalRecords).toBe(1);
    expect(byName.body.data[0].email).toBe("employee12@example.com");

    const byRole = await request(app).get("/employees?search=designer");
    expect(byRole.body.totalRecords).toBe(6);

    const byEmail = await request(app).get("/employees?search=EMPLOYEE1@");
    expect(byEmail.body.totalRecords).toBe(1);
  });
});

describe("GET /employees/names", () => {
  it("returns alphabetically sorted names for the combobox", async () => {
    const response = await request(app).get("/employees/names");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(13);
    expect(response.body.data[0].name).toBe("Employee 01");
  });

  it("filters names by search term", async () => {
    const response = await request(app).get("/employees/names?search=Employee%201");
    expect(response.body.data.map((employee: { name: string }) => employee.name)).toEqual([
      "Employee 10",
      "Employee 11",
      "Employee 12",
      "Employee 13",
    ]);
  });
});

describe("POST /employees", () => {
  it("creates an employee and normalizes the email", async () => {
    const response = await request(app).post("/employees").send({
      name: "  Ada Lovelace  ",
      email: "  ADA@Example.COM ",
      role: " Mathematician ",
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: "Ada Lovelace",
      email: "ada@example.com",
      role: "Mathematician",
    });
    expect(Date.parse(response.body.data.created_at)).not.toBeNaN();
  });

  it("rejects invalid payloads with field-level errors", async () => {
    const response = await request(app).post("/employees").send({
      name: "A",
      email: "not-an-email",
      role: "",
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation failed");
    expect(response.body.errors.name).toBeDefined();
    expect(response.body.errors.email).toBeDefined();
    expect(response.body.errors.role).toBeDefined();
  });

  it("rejects unknown fields", async () => {
    const response = await request(app).post("/employees").send({
      name: "Grace Hopper",
      email: "grace@example.com",
      role: "Admiral",
      isAdmin: true,
    });

    expect(response.status).toBe(400);
  });

  it("rejects duplicate emails regardless of casing", async () => {
    await request(app).post("/employees").send({
      name: "First Person",
      email: "duplicate@example.com",
      role: "Engineer",
    });

    const response = await request(app).post("/employees").send({
      name: "Second Person",
      email: "DUPLICATE@example.com",
      role: "Designer",
    });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists/i);
  });
});

describe("PUT /employees/:id", () => {
  it("updates an existing employee", async () => {
    const response = await request(app).put("/employees/1").send({
      name: "Updated Name",
      email: "updated@example.com",
      role: "Staff Engineer",
    });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      id: 1,
      name: "Updated Name",
      email: "updated@example.com",
      role: "Staff Engineer",
    });
  });

  it("returns 404 for a missing employee", async () => {
    const response = await request(app).put("/employees/9999").send({
      name: "Nobody Here",
      email: "nobody@example.com",
      role: "Ghost",
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const response = await request(app).put("/employees/abc").send({
      name: "Nobody Here",
      email: "nobody@example.com",
      role: "Ghost",
    });

    expect(response.status).toBe(400);
  });

  it("rejects an email that belongs to another employee", async () => {
    const response = await request(app).put("/employees/1").send({
      name: "Employee One",
      email: "employee2@example.com",
      role: "Engineer",
    });

    expect(response.status).toBe(409);
  });
});

describe("DELETE /employees/:id", () => {
  it("deletes an employee and removes it from later reads", async () => {
    const response = await request(app).delete("/employees/1");
    expect(response.status).toBe(204);

    const list = await request(app).get("/employees");
    expect(list.body.totalRecords).toBe(12);

    const secondDelete = await request(app).delete("/employees/1");
    expect(secondDelete.status).toBe(404);
  });
});

describe("CORS", () => {
  it("allows the configured frontend origin", async () => {
    const response = await request(app)
      .get("/employees")
      .set("Origin", "http://localhost:3000");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});

describe("super admin seeding", () => {
  beforeEach(async () => {
    await pool.query("TRUNCATE users RESTART IDENTITY CASCADE");
  });

  it("creates the super admin with a bcrypt password hash", async () => {
    await seedSuperAdmin(pool, {
      email: "default@example.com",
      password: "kaam-chor-majdoor",
    });

    const { rows } = await pool.query(
      "SELECT email, password_hash, role, is_super_admin FROM users WHERE LOWER(email) = $1",
      ["default@example.com"],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      email: "default@example.com",
      role: "admin",
      is_super_admin: true,
    });
    expect(rows[0].password_hash).not.toBe("kaam-chor-majdoor");
    await expect(
      bcrypt.compare("kaam-chor-majdoor", rows[0].password_hash),
    ).resolves.toBe(true);
  });

  it("updates the existing super admin instead of creating a duplicate", async () => {
    await seedSuperAdmin(pool, {
      email: "default@example.com",
      password: "first-password",
    });
    await seedSuperAdmin(pool, {
      email: "DEFAULT@example.com",
      password: "second-password",
    });

    const { rows } = await pool.query(
      "SELECT password_hash FROM users WHERE LOWER(email) = $1",
      ["default@example.com"],
    );

    expect(rows).toHaveLength(1);
    await expect(
      bcrypt.compare("second-password", rows[0].password_hash),
    ).resolves.toBe(true);
  });
});

describe("config", () => {
  it("defaults the super admin credentials", () => {
    const config = loadConfig({ DATABASE_URL: "postgresql://localhost/test" });

    expect(config.superAdminEmail).toBe("default@example.com");
    expect(config.superAdminPassword).toBe("kaam-chor-majdoor");
  });
});
