import bcrypt from "bcryptjs";
import type { Pool } from "pg";

const BCRYPT_ROUNDS = 12;

export interface SuperAdminCredentials {
  email: string;
  password: string;
}

/**
 * Creates or refreshes the environment-configured super admin account.
 * Runs on every server start, so the credentials in the environment always win.
 */
export async function seedSuperAdmin(
  pool: Pool,
  { email, password }: SuperAdminCredentials,
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await pool.query(
    `INSERT INTO users (email, password_hash, role, is_super_admin)
     VALUES ($1, $2, 'admin', TRUE)
     ON CONFLICT (LOWER(email)) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = 'admin',
       is_super_admin = TRUE,
       employee_id = NULL`,
    [email.trim().toLowerCase(), passwordHash],
  );
}
