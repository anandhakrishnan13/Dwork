import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import type { Pool } from "pg";
import { EmployeeRepository } from "./employees/repository.js";
import { employeesRouter } from "./employees/routes.js";
import { HttpError } from "./errors.js";

export interface AppOptions {
  corsOrigins: string[];
}

export function createApp(pool: Pool, options: AppOptions) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: options.corsOrigins,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  });

  app.use("/employees", employeesRouter(new EmployeeRepository(pool)));

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
