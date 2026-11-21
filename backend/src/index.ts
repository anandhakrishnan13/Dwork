import { attachDatabasePool } from "@vercel/functions";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";

// Vercel's Express framework detects this file as the service entrypoint.
// Public traffic arrives as /api/*, so the API mounts its routes under /api.
const config = loadConfig();
const pool = createPool(config.databaseUrl, config.dbSsl);

attachDatabasePool(pool);

const app = createApp(pool, {
  corsOrigins: config.corsOrigins,
  jwtSecret: config.jwtSecret,
  defaultEmployeePassword: config.defaultEmployeePassword,
  basePath: "/api",
});

export default app;
