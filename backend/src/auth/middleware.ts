import type { RequestHandler } from "express";
import type { Pool } from "pg";
import { findUserById } from "./repository.js";
import { verifyToken } from "./tokens.js";
import type { AccessRole } from "./types.js";

function unauthorized(res: Parameters<RequestHandler>[1]): void {
  res.status(401).json({ message: "Authentication required" });
}

/** Verifies the bearer token and reloads the user so role changes apply immediately. */
export function authenticate(pool: Pool, jwtSecret: string): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization;

    if (!header?.startsWith("Bearer ")) {
      unauthorized(res);
      return;
    }

    let userId: number;

    try {
      userId = verifyToken(header.slice("Bearer ".length).trim(), jwtSecret).userId;
    } catch {
      unauthorized(res);
      return;
    }

    const user = await findUserById(pool, userId);

    if (!user) {
      unauthorized(res);
      return;
    }

    req.auth = user;
    next();
  };
}

export function requireRole(...roles: AccessRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) {
      unauthorized(res);
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ message: "You do not have permission to do that" });
      return;
    }

    next();
  };
}
