import bcrypt from "bcryptjs";
import type { Pool, PoolClient } from "pg";
import type { AccessRole } from "../auth/types.js";
import { ConflictError, ValidationError, isUniqueViolation } from "../errors.js";
import type { EmployeeInput } from "./schema.js";

/** Page size is fixed server-side; clients cannot override it. */
export const PAGE_SIZE = 10;
const NAMES_LIMIT = 50;
const BCRYPT_ROUNDS = 12;

export interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  manager_id: number | null;
  manager_name: string | null;
  access_role: AccessRole | null;
  created_at: string;
}

export interface EmployeeName {
  id: number;
  name: string;
  email: string;
}

interface EmployeeRow {
  id: number;
  name: string;
  email: string;
  role: string;
  manager_id: number | null;
  manager_name: string | null;
  access_role: AccessRole | null;
  created_at: Date | string;
}

const SELECT_COLUMNS = `
  e.id,
  e.name,
  e.email,
  e.role,
  e.manager_id,
  e.created_at,
  m.name AS manager_name,
  u.role AS access_role
`;

const FROM_JOINS = `
  FROM employees e
  LEFT JOIN employees m ON m.id = e.manager_id
  LEFT JOIN users u ON u.employee_id = e.id
`;

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    manager_id: row.manager_id,
    manager_name: row.manager_name,
    access_role: row.access_role,
    created_at: new Date(row.created_at).toISOString(),
  };
}

/** Escapes LIKE wildcards so a search for "100%" stays literal. */
function toPattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export class EmployeeRepository {
  constructor(
    private readonly pool: Pool,
    private readonly defaultPassword: string,
  ) {}

  async list(options: { page: number; search?: string }): Promise<{
    employees: Employee[];
    totalRecords: number;
  }> {
    const { page, search } = options;
    const offset = (page - 1) * PAGE_SIZE;
    const pattern = search ? toPattern(search) : null;
    const where = pattern
      ? "WHERE (e.name ILIKE $1 OR e.email ILIKE $1 OR e.role ILIKE $1)"
      : "";

    const countSql = `SELECT COUNT(*)::int AS total FROM employees e ${where}`;
    const listSql = `
      SELECT ${SELECT_COLUMNS}
      ${FROM_JOINS}
      ${where}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT $${pattern ? 2 : 1} OFFSET $${pattern ? 3 : 2}
    `;

    const countParams = pattern ? [pattern] : [];
    const listParams = pattern ? [pattern, PAGE_SIZE, offset] : [PAGE_SIZE, offset];

    const [countResult, listResult] = await Promise.all([
      this.pool.query<{ total: number }>(countSql, countParams),
      this.pool.query<EmployeeRow>(listSql, listParams),
    ]);

    return {
      employees: listResult.rows.map(toEmployee),
      totalRecords: countResult.rows[0]?.total ?? 0,
    };
  }

  async names(search?: string): Promise<EmployeeName[]> {
    const pattern = search ? toPattern(search) : null;
    const sql = `
      SELECT id, name, email
      FROM employees
      ${pattern ? "WHERE name ILIKE $1 OR email ILIKE $1" : ""}
      ORDER BY name ASC
      LIMIT ${NAMES_LIMIT}
    `;
    const result = await this.pool.query<EmployeeName>(sql, pattern ? [pattern] : []);
    return result.rows;
  }

  async findById(id: number): Promise<Employee | null> {
    const result = await this.pool.query<EmployeeRow>(
      `SELECT ${SELECT_COLUMNS} ${FROM_JOINS} WHERE e.id = $1`,
      [id],
    );
    return result.rows[0] ? toEmployee(result.rows[0]) : null;
  }

  async create(input: EmployeeInput, accessRole: AccessRole): Promise<Employee> {
    const passwordHash = await bcrypt.hash(this.defaultPassword, BCRYPT_ROUNDS);
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await this.assertManager(client, input.managerId, null);

      const inserted = await client.query<{ id: number }>(
        `INSERT INTO employees (name, email, role, manager_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [input.name, input.email, input.role, input.managerId],
      );
      const id = inserted.rows[0]!.id;

      await client.query(
        `INSERT INTO users (email, password_hash, role, employee_id)
         VALUES ($1, $2, $3, $4)`,
        [input.email, passwordHash, accessRole, id],
      );

      await client.query("COMMIT");

      const employee = await this.findById(id);

      if (!employee) {
        throw new Error("Employee disappeared after creation");
      }

      return employee;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);

      if (isUniqueViolation(error)) {
        throw new ConflictError("An employee with this email already exists");
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async update(
    id: number,
    input: EmployeeInput,
    accessRole?: AccessRole,
  ): Promise<Employee | null> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      const existing = await client.query<{ id: number }>(
        "SELECT id FROM employees WHERE id = $1 FOR UPDATE",
        [id],
      );

      if ((existing.rowCount ?? 0) === 0) {
        await client.query("ROLLBACK");
        return null;
      }

      await this.assertManager(client, input.managerId, id);

      await client.query(
        `UPDATE employees
         SET name = $1, email = $2, role = $3, manager_id = $4
         WHERE id = $5`,
        [input.name, input.email, input.role, input.managerId, id],
      );

      if (accessRole) {
        await client.query(
          `UPDATE users SET email = $1, role = $2 WHERE employee_id = $3`,
          [input.email, accessRole, id],
        );
      } else {
        await client.query(`UPDATE users SET email = $1 WHERE employee_id = $2`, [
          input.email,
          id,
        ]);
      }

      await client.query("COMMIT");

      return this.findById(id);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);

      if (isUniqueViolation(error)) {
        throw new ConflictError("An employee with this email already exists");
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM employees WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private async assertManager(
    client: PoolClient,
    managerId: number | null,
    employeeId: number | null,
  ): Promise<void> {
    if (managerId === null) return;

    const manager = await client.query("SELECT id FROM employees WHERE id = $1", [
      managerId,
    ]);

    if ((manager.rowCount ?? 0) === 0) {
      throw new ValidationError({ managerId: ["Select an existing manager"] });
    }

    if (employeeId === null) return;

    if (managerId === employeeId) {
      throw new ValidationError({ managerId: ["An employee cannot report to themselves"] });
    }

    // Walk up from the proposed manager; reaching this employee would create a loop.
    const cycle = await client.query<{ id: number }>(
      `WITH RECURSIVE chain AS (
         SELECT id, manager_id FROM employees WHERE id = $1
         UNION ALL
         SELECT e.id, e.manager_id
         FROM employees e
         JOIN chain c ON e.id = c.manager_id
       )
       SELECT id FROM chain WHERE id = $2`,
      [managerId, employeeId],
    );

    if ((cycle.rowCount ?? 0) > 0) {
      throw new ValidationError({
        managerId: ["That manager is already in this employee's reporting line"],
      });
    }
  }
}
