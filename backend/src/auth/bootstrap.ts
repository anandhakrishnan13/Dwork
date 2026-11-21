import type { Pool } from "pg";
import { applySchema } from "../db/apply-schema.js";
import { ensureEmployeeAccounts, seedSuperAdmin } from "./seed.js";

export interface BootstrapOptions {
  superAdminEmail: string;
  superAdminPassword: string;
  defaultEmployeePassword: string;
}

/** Applies the schema and makes sure the super admin and employee logins exist. */
export async function prepareDatabase(
  pool: Pool,
  options: BootstrapOptions,
): Promise<{ employeeAccountsCreated: number }> {
  await applySchema(pool);
  await seedSuperAdmin(pool, {
    email: options.superAdminEmail,
    password: options.superAdminPassword,
  });
  const employeeAccountsCreated = await ensureEmployeeAccounts(
    pool,
    options.defaultEmployeePassword,
  );
  return { employeeAccountsCreated };
}
