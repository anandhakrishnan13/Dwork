import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  DB_SSL: z.enum(["true", "false"]).optional(),
});

export interface AppConfig {
  databaseUrl: string;
  port: number;
  corsOrigins: string[];
  dbSsl: boolean;
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
  };
}
