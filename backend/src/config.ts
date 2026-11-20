import { config as loadEnv } from "dotenv";
import { z } from "zod";

// Both apps read the single .env at the repository root. Explicit shell
// variables still win because dotenv does not override existing values.
loadEnv({ path: new URL("../../.env", import.meta.url), quiet: true });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DB_SSL: z.enum(["true", "false"]).optional(),
  SUPER_ADMIN_EMAIL: z.string().trim().email().default("default@example.com"),
  SUPER_ADMIN_PASSWORD: z.string().min(8).default("kaam-chor-majdoor"),
  JWT_SECRET: z.string().min(16).default("dev-only-change-me-in-production"),
  DEFAULT_EMPLOYEE_PASSWORD: z.string().min(8).default("Majdoor-hu-mai"),
});

export interface AppConfig {
  databaseUrl: string;
  port: number;
  corsOrigins: string[];
  dbSsl: boolean;
  superAdminEmail: string;
  superAdminPassword: string;
  jwtSecret: string;
  defaultEmployeePassword: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  const { DATABASE_URL, PORT, CORS_ORIGIN, DB_SSL } = parsed.data;

  return {
    databaseUrl: DATABASE_URL,
    port: PORT,
    corsOrigins: CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
    dbSsl: DB_SSL === "true",
    superAdminEmail: parsed.data.SUPER_ADMIN_EMAIL,
    superAdminPassword: parsed.data.SUPER_ADMIN_PASSWORD,
    jwtSecret: parsed.data.JWT_SECRET,
    defaultEmployeePassword: parsed.data.DEFAULT_EMPLOYEE_PASSWORD,
  };
}
