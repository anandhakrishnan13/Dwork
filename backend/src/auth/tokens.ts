import jwt, { type SignOptions } from "jsonwebtoken";
import type { AuthUser } from "./types.js";

const EXPIRES_IN: SignOptions["expiresIn"] = "8h";

export function signToken(user: AuthUser, secret: string): string {
  return jwt.sign({ role: user.role }, secret, {
    subject: String(user.id),
    expiresIn: EXPIRES_IN,
  });
}

export function verifyToken(token: string, secret: string): { userId: number } {
  const payload = jwt.verify(token, secret);

  if (typeof payload === "string" || !payload.sub) {
    throw new Error("Token is missing a subject");
  }

  const userId = Number(payload.sub);

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Token subject is invalid");
  }

  return { userId };
}
