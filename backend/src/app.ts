import cors from "cors";
import express, { type ErrorRequestHandler, type RequestHandler } from "express";
import helmet from "helmet";
import type { Pool } from "pg";
import { authenticate } from "./auth/middleware.js";
import { authRouter } from "./auth/routes.js";
import { EmployeeRepository } from "./employees/repository.js";
import { employeesRouter } from "./employees/routes.js";
import { HttpError } from "./errors.js";

export interface AppOptions {
  corsOrigins: string[];
  jwtSecret: string;
  defaultEmployeePassword: string;
  /** Optional public prefix, for example "/api" when deployed behind Vercel. */
  basePath?: string;
}

function normalizeBasePath(basePath?: string): string {
  if (!basePath || basePath === "/") return "";

  const withLeadingSlash = basePath.startsWith("/") ? basePath : `/${basePath}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

export function createApp(
  pool: Pool,
  options: AppOptions,
  preMiddleware: RequestHandler[] = [],
) {
  const app = express();
  const basePath = normalizeBasePath(options.basePath);

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: options.corsOrigins,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  for (const middleware of preMiddleware) app.use(middleware);

  app.get(`${basePath}/health`, async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  });

  app.use(
    `${basePath}/auth`,
    authRouter(pool, { jwtSecret: options.jwtSecret }),
  );
  app.use(
    `${basePath}/employees`,
    authenticate(pool, options.jwtSecret),
    employeesRouter(
      new EmployeeRepository(pool, options.defaultEmployeePassword),
    ),
  );

  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({
        message: error.message,
        ...(error.details ? { errors: error.details } : {}),
      });
      return;
    }

    // Malformed JSON produced by express.json()
    if (error instanceof SyntaxError && "status" in error && error.status === 400) {
      res.status(400).json({ message: "Invalid JSON body" });
      return;
    }

    console.error("Unexpected API error:", error);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  };

  app.use(errorHandler);

  return app;
}
