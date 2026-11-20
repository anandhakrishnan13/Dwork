import bcrypt from "bcryptjs";
import { Router } from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { HttpError, ValidationError } from "../errors.js";
import { authenticate } from "./middleware.js";
import { findUserByEmail } from "./repository.js";
import { signToken } from "./tokens.js";

const loginSchema = z
  .object({
    email: z
      .string({ error: "Email is required" })
      .trim()
      .email("Enter a valid email address")
      .transform((value) => value.toLowerCase()),
    password: z.string({ error: "Password is required" }).min(1, "Password is required"),
  })
  .strict();

function parseLoginInput(body: unknown): z.infer<typeof loginSchema> {
  const result = loginSchema.safeParse(body);

  if (!result.success) {
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      (details[key] ??= []).push(issue.message);
    }
    throw new ValidationError(details);
  }

  return result.data;
}

export function authRouter(pool: Pool, options: { jwtSecret: string }): Router {
  const router = Router();

  router.post("/login", async (req, res) => {
    const input = parseLoginInput(req.body);
    const user = await findUserByEmail(pool, input.email);

    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw new HttpError(401, "Invalid email or password");
    }

    const { passwordHash: _passwordHash, ...authUser } = user;

    res.json({
      data: {
        token: signToken(authUser, options.jwtSecret),
        user: authUser,
      },
    });
  });

  router.get("/me", authenticate(pool, options.jwtSecret), (req, res) => {
    res.json({ data: req.auth });
  });

  return router;
}
