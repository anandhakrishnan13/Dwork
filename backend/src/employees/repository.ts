import type { Pool } from "pg";
import { ConflictError, isUniqueViolation } from "../errors.js";
import type { EmployeeInput } from "./schema.js";

/** Page size is fixed server-side; clients cannot override it. */
export const PAGE_SIZE = 10;
const NAMES_LIMIT = 50;

export interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
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
  created_at: Date | string;
}

const COLUMNS = "id, name, email, role, created_at";

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: new Date(row.created_at).toISOString(),
  };
}

/** Escapes LIKE wildcards so a search for "100%" stays literal. */
function toPattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export class EmployeeRepository {
  constructor(private readonly pool: Pool) {}

  async list(options: { page: number; search?: string }): Promise<{
    employees: Employee[];
    totalRecords: number;
  }> {
    const { page, search } = options;
    const offset = (page - 1) * PAGE_SIZE;
    const pattern = search ? toPattern(search) : null;
    const where = pattern
      ? "WHERE name ILIKE $1 OR email ILIKE $1 OR role ILIKE $1"
      : "";

    const countSql = `SELECT COUNT(*)::int AS total FROM employees ${where}`;
    const listSql = `
      SELECT ${COLUMNS}
      FROM employees
      ${where}
      ORDER BY created_at DESC, id DESC
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

  async create(input: EmployeeInput): Promise<Employee> {
    const sql = `
      INSERT INTO employees (name, email, role)
      VALUES ($1, $2, $3)
      RETURNING ${COLUMNS}
    `;
    try {
      const result = await this.pool.query<EmployeeRow>(sql, [
        input.name,
        input.email,
        input.role,
      ]);
      return toEmployee(result.rows[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("An employee with this email already exists");
      }
      throw error;
    }
  }

  async update(id: number, input: EmployeeInput): Promise<Employee | null> {
    const sql = `
      UPDATE employees
      SET name = $1, email = $2, role = $3
      WHERE id = $4
      RETURNING ${COLUMNS}
    `;
    try {
      const result = await this.pool.query<EmployeeRow>(sql, [
        input.name,
        input.email,
        input.role,
        id,
      ]);
      return result.rows[0] ? toEmployee(result.rows[0]) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("An employee with this email already exists");
      }
      throw error;
    }
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM employees WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}
