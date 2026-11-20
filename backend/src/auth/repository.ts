import type { Pool } from "pg";
import type { AccessRole, AuthUser } from "./types.js";

interface UserRow {
  id: number;
  email: string;
  role: AccessRole;
  is_super_admin: boolean;
  employee_id: number | null;
  name: string;
  password_hash?: string;
}

export interface UserWithPassword extends AuthUser {
  passwordHash: string;
}

const USER_COLUMNS = `
  u.id,
  u.email,
  u.role,
  u.is_super_admin,
  u.employee_id,
  COALESCE(e.name, 'Super Admin') AS name
`;

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isSuperAdmin: row.is_super_admin,
    employeeId: row.employee_id,
    name: row.name,
  };
}

export async function findUserByEmail(
  pool: Pool,
  email: string,
): Promise<UserWithPassword | null> {
  const result = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS}, u.password_hash
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE LOWER(u.email) = LOWER($1)`,
    [email],
  );
  const row = result.rows[0];

  if (!row) return null;

  return { ...toAuthUser(row), passwordHash: row.password_hash ?? "" };
}

export async function findUserById(pool: Pool, id: number): Promise<AuthUser | null> {
  const result = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS}
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE u.id = $1`,
    [id],
  );
  const row = result.rows[0];

  return row ? toAuthUser(row) : null;
}
