import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import EmbeddedPostgres from "embedded-postgres";
import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ensureEmployeeAccounts, seedSuperAdmin } from "../src/auth/seed.js";
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db/pool.js";

const PORT = 55432;
const CONNECTION_STRING = `postgresql://postgres:postgres@localhost:${PORT}/employees_test`;
const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PASSWORD = "test-admin-password";
const DEFAULT_EMPLOYEE_PASSWORD = "Majdoor-hu-mai";

let postgres: EmbeddedPostgres;
let pool: Pool;
let app: ReturnType<typeof createApp>;
let prefixedApp: ReturnType<typeof createApp>;
let databaseDir: string;
let adminToken = "";

function authHeader() {
  return { Authorization: `Bearer ${adminToken}` };
}

const get = (path: string) => request(app).get(path).set(authHeader());
const post = (path: string) => request(app).post(path).set(authHeader());
const put = (path: string) => request(app).put(path).set(authHeader());
const del = (path: string) => request(app).delete(path).set(authHeader());

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
  app = createApp(pool, {
    corsOrigins: ["http://localhost:3000"],
    jwtSecret: "test-jwt-secret-that-is-long-enough",
    defaultEmployeePassword: DEFAULT_EMPLOYEE_PASSWORD,
  });

  prefixedApp = createApp(pool, {
    corsOrigins: ["http://localhost:3000"],
    jwtSecret: "test-jwt-secret-that-is-long-enough",
    defaultEmployeePassword: DEFAULT_EMPLOYEE_PASSWORD,
    basePath: "/api",
  });

  await seedSuperAdmin(pool, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const login = await request(app)
    .post("/auth/login")
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

  if (login.status !== 200) {
    throw new Error(`Test admin login failed: ${JSON.stringify(login.body)}`);
  }

  adminToken = login.body.data.token;
}, 120_000);

beforeEach(async () => {
  await pool.query("DELETE FROM employees");
  await pool.query("ALTER SEQUENCE employees_id_seq RESTART WITH 1");
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

describe("Vercel /api prefix", () => {
  it("serves the API under /api", async () => {
    const health = await request(prefixedApp).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: "ok" });

    const login = await request(prefixedApp)
      .post("/api/auth/login")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    expect(login.status).toBe(200);

    const employees = await request(prefixedApp)
      .get("/api/employees")
      .set("Authorization", `Bearer ${login.body.data.token}`);
    expect(employees.status).toBe(200);
    expect(employees.body.totalRecords).toBe(13);
  });

  it("does not expose unprefixed routes", async () => {
    const response = await request(prefixedApp).get("/health");
    expect(response.status).toBe(404);
  });
});

describe("GET /employees", () => {
  it("returns the first page with server-controlled pagination metadata", async () => {
    const response = await get("/employees");

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
    const response = await get("/employees?page=2");

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
    const response = await get("/employees?limit=1&pageSize=1&perPage=1");
    expect(response.body.data).toHaveLength(10);
    expect(response.body.pageSize).toBe(10);
  });

  it("falls back to page 1 for invalid pages", async () => {
    const response = await get("/employees?page=abc");
    expect(response.body.currentPage).toBe(1);
    expect(response.body.data).toHaveLength(10);
  });

  it("returns an empty page past the end without breaking metadata", async () => {
    const response = await get("/employees?page=99");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.totalPages).toBe(2);
    expect(response.body.totalRecords).toBe(13);
  });

  it("searches name, email and role case-insensitively", async () => {
    const byName = await get("/employees?search=employee%2012");
    expect(byName.body.totalRecords).toBe(1);
    expect(byName.body.data[0].email).toBe("employee12@example.com");

    const byRole = await get("/employees?search=designer");
    expect(byRole.body.totalRecords).toBe(6);

    const byEmail = await get("/employees?search=EMPLOYEE1@");
    expect(byEmail.body.totalRecords).toBe(1);
  });
});

describe("GET /employees/names", () => {
  it("returns alphabetically sorted names for the combobox", async () => {
    const response = await get("/employees/names");

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(13);
    expect(response.body.data[0].name).toBe("Employee 01");
  });

  it("filters names by search term", async () => {
    const response = await get("/employees/names?search=Employee%201");
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
    const response = await post("/employees").send({
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
    const response = await post("/employees").send({
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
    const response = await post("/employees").send({
      name: "Grace Hopper",
      email: "grace@example.com",
      role: "Admiral",
      isAdmin: true,
    });

    expect(response.status).toBe(400);
  });

  it("rejects duplicate emails regardless of casing", async () => {
    await post("/employees").send({
      name: "First Person",
      email: "duplicate@example.com",
      role: "Engineer",
    });

    const response = await post("/employees").send({
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
    const response = await put("/employees/1").send({
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
    const response = await put("/employees/9999").send({
      name: "Nobody Here",
      email: "nobody@example.com",
      role: "Ghost",
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 for a malformed id", async () => {
    const response = await put("/employees/abc").send({
      name: "Nobody Here",
      email: "nobody@example.com",
      role: "Ghost",
    });

    expect(response.status).toBe(400);
  });

  it("rejects an email that belongs to another employee", async () => {
    const response = await put("/employees/1").send({
      name: "Employee One",
      email: "employee2@example.com",
      role: "Engineer",
    });

    expect(response.status).toBe(409);
  });
});

describe("DELETE /employees/:id", () => {
  it("deletes an employee and removes it from later reads", async () => {
    const response = await del("/employees/1");
    expect(response.status).toBe(204);

    const list = await get("/employees");
    expect(list.body.totalRecords).toBe(12);

    const secondDelete = await del("/employees/1");
    expect(secondDelete.status).toBe(404);
  });
});

describe("CORS", () => {
  it("allows the configured frontend origin", async () => {
    const response = await get("/employees")
      .set("Origin", "http://localhost:3000");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});

describe("POST /auth/login", () => {
  it("signs in the super admin and returns a token", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      email: ADMIN_EMAIL,
      role: "admin",
      isSuperAdmin: true,
      employeeId: null,
    });
  });

  it("rejects a wrong password without revealing which field was wrong", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: ADMIN_EMAIL, password: "not-the-password" });

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password");
  });

  it("validates the login payload", async () => {
    const response = await request(app)
      .post("/auth/login")
      .send({ email: "not-an-email", password: "" });

    expect(response.status).toBe(400);
    expect(response.body.errors.email).toBeDefined();
    expect(response.body.errors.password).toBeDefined();
  });
});

describe("authentication", () => {
  it("rejects employee requests without a token", async () => {
    const response = await request(app).get("/employees");
    expect(response.status).toBe(401);
  });

  it("rejects a malformed token", async () => {
    const response = await request(app)
      .get("/employees")
      .set("Authorization", "Bearer not-a-real-token");
    expect(response.status).toBe(401);
  });

  it("returns the current user from /auth/me", async () => {
    const response = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      email: ADMIN_EMAIL,
      role: "admin",
      isSuperAdmin: true,
    });
  });
});

async function createAccount(
  accessRole: "employee" | "manager" | "admin",
  name: string,
  email: string,
) {
  const response = await post("/employees").send({
    name,
    email,
    role: "Engineer",
    accessRole,
  });

  expect(response.status).toBe(201);
  return response.body.data as { id: number; email: string; access_role: string };
}

async function loginAs(email: string): Promise<string> {
  const response = await request(app)
    .post("/auth/login")
    .send({ email, password: DEFAULT_EMPLOYEE_PASSWORD });

  expect(response.status).toBe(200);
  return response.body.data.token;
}

describe("role-based access", () => {
  it("lets an employee read the directory but not create or delete", async () => {
    await createAccount("employee", "Erin Employee", "erin@example.com");
    const token = await loginAs("erin@example.com");
    const asEmployee = { Authorization: `Bearer ${token}` };

    const list = await request(app).get("/employees").set(asEmployee);
    expect(list.status).toBe(200);

    const create = await request(app).post("/employees").set(asEmployee).send({
      name: "Not Allowed",
      email: "not-allowed@example.com",
      role: "Engineer",
    });
    expect(create.status).toBe(403);

    const remove = await request(app).delete("/employees/1").set(asEmployee);
    expect(remove.status).toBe(403);
  });

  it("lets a manager create an employee as their direct report", async () => {
    const manager = await createAccount("manager", "Mona Manager", "mona@example.com");
    const token = await loginAs("mona@example.com");

    const response = await request(app)
      .post("/employees")
      .set({ Authorization: `Bearer ${token}` })
      .send({
        name: "Ravi Report",
        email: "ravi@example.com",
        role: "Engineer",
        accessRole: "admin",
        managerId: null,
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: "Ravi Report",
      manager_id: manager.id,
      manager_name: "Mona Manager",
      access_role: "employee",
    });
  });

  it("lets a manager edit a direct report but not someone else", async () => {
    const manager = await createAccount("manager", "Mona Manager", "mona@example.com");
    const report = await createAccount("employee", "Ravi Report", "ravi@example.com");
    await put(`/employees/${report.id}`).send({
      name: "Ravi Report",
      email: "ravi@example.com",
      role: "Engineer",
      managerId: manager.id,
    });

    const token = await loginAs("mona@example.com");
    const asManager = { Authorization: `Bearer ${token}` };

    const ownReport = await request(app)
      .put(`/employees/${report.id}`)
      .set(asManager)
      .send({ name: "Ravi Updated", email: "ravi@example.com", role: "Senior Engineer" });
    expect(ownReport.status).toBe(200);
    expect(ownReport.body.data.name).toBe("Ravi Updated");

    const outsider = await request(app)
      .put("/employees/1")
      .set(asManager)
      .send({ name: "Employee One", email: "employee1@example.com", role: "Engineer" });
    expect(outsider.status).toBe(403);
  });

  it("does not let a manager delete employees", async () => {
    await createAccount("manager", "Mona Manager", "mona@example.com");
    const token = await loginAs("mona@example.com");

    const response = await request(app)
      .delete("/employees/1")
      .set({ Authorization: `Bearer ${token}` });

    expect(response.status).toBe(403);
  });
});

describe("employee hierarchy", () => {
  it("stores the manager and returns their name in the directory", async () => {
    const manager = await createAccount("manager", "Mona Manager", "mona@example.com");
    const response = await post("/employees").send({
      name: "Ravi Report",
      email: "ravi@example.com",
      role: "Engineer",
      managerId: manager.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      manager_id: manager.id,
      manager_name: "Mona Manager",
    });

    const list = await get("/employees?search=ravi@example.com");
    expect(list.body.data[0].manager_name).toBe("Mona Manager");
  });

  it("rejects self-management and reporting loops", async () => {
    const manager = await createAccount("manager", "Mona Manager", "mona@example.com");
    const report = await post("/employees").send({
      name: "Ravi Report",
      email: "ravi@example.com",
      role: "Engineer",
      managerId: manager.id,
    });

    const self = await put(`/employees/${manager.id}`).send({
      name: "Mona Manager",
      email: "mona@example.com",
      role: "Manager",
      managerId: manager.id,
    });
    expect(self.status).toBe(400);
    expect(self.body.errors.managerId).toBeDefined();

    const loop = await put(`/employees/${manager.id}`).send({
      name: "Mona Manager",
      email: "mona@example.com",
      role: "Manager",
      managerId: report.body.data.id,
    });
    expect(loop.status).toBe(400);
    expect(loop.body.errors.managerId).toBeDefined();
  });
});

describe("employee login accounts", () => {
  it("creates default-password accounts for employees that lack one", async () => {
    const created = await ensureEmployeeAccounts(pool, DEFAULT_EMPLOYEE_PASSWORD);
    expect(created).toBe(13);

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "employee1@example.com", password: DEFAULT_EMPLOYEE_PASSWORD });

    expect(login.status).toBe(200);
    expect(login.body.data.user).toMatchObject({
      email: "employee1@example.com",
      role: "employee",
      employeeId: 1,
    });
  });

  it("keeps the login email in sync when an employee is updated", async () => {
    const employee = await createAccount("employee", "Erin Employee", "erin@example.com");
    await put(`/employees/${employee.id}`).send({
      name: "Erin Employee",
      email: "erin.updated@example.com",
      role: "Engineer",
    });

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "erin.updated@example.com", password: DEFAULT_EMPLOYEE_PASSWORD });

    expect(login.status).toBe(200);
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
