import { createApp } from "./app.js";
import { ensureEmployeeAccounts, seedSuperAdmin } from "./auth/seed.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";

const config = loadConfig();
const pool = createPool(config.databaseUrl, config.dbSsl);

try {
  await seedSuperAdmin(pool, {
    email: config.superAdminEmail,
    password: config.superAdminPassword,
  });
  console.log(`Super admin ready: ${config.superAdminEmail}`);

  const created = await ensureEmployeeAccounts(pool, config.defaultEmployeePassword);

  if (created > 0) {
    console.log(`Created ${created} employee login account(s)`);
  }
} catch (error) {
  console.error("Could not prepare login accounts:", error);
  await pool.end();
  process.exit(1);
}

const app = createApp(pool, {
  corsOrigins: config.corsOrigins,
  jwtSecret: config.jwtSecret,
  defaultEmployeePassword: config.defaultEmployeePassword,
});

const server = app.listen(config.port, () => {
  console.log(`Employee Directory API listening on http://localhost:${config.port}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
