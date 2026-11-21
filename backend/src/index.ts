import { attachDatabasePool } from "@vercel/functions";
import type { RequestHandler } from "express";
import { createApp } from "./app.js";
import { prepareDatabase } from "./auth/bootstrap.js";
import { loadConfig } from "./config.js";
import { createPool } from "./db/pool.js";

// Vercel's Express framework detects this file as the service entrypoint.
// Public traffic arrives as /api/*, so the API mounts its routes under /api.
const config = loadConfig();
const pool = createPool(config.databaseUrl, config.dbSsl);

attachDatabasePool(pool);

// Serverless instances never run server.ts, so the schema and the default
// accounts must be prepared here. Runs once per cold start; a failure is
// cleared so the next request retries instead of caching a broken state.
let ready: Promise<unknown> | undefined;

const ensureReady: RequestHandler = (_req, _res, next) => {
  ready ??= prepareDatabase(pool, config).catch((error) => {
    ready = undefined;
    throw error;
  });
  ready.then(() => next(), next);
};

const app = createApp(
  pool,
  {
    corsOrigins: config.corsOrigins,
    jwtSecret: config.jwtSecret,
    defaultEmployeePassword: config.defaultEmployeePassword,
    basePath: "/api",
  },
  [ensureReady],
);

export default app;
