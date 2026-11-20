import { z } from "zod";
import type { AccessRole } from "../auth/types.js";
import { ValidationError } from "../errors.js";

export const accessRoleSchema = z.enum(["employee", "manager", "admin"]);

export const employeeInputSchema = z
  .object({
    name: z
      .string({ error: "Name is required" })
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(120, "Name must be at most 120 characters"),
    email: z
      .string({ error: "Email is required" })
      .trim()
      .max(255, "Email must be at most 255 characters")
      .email("Enter a valid email address")
      .transform((value) => value.toLowerCase()),
    role: z
      .string({ error: "Role is required" })
      .trim()
      .min(2, "Role must be at least 2 characters")
      .max(100, "Role must be at most 100 characters"),
    managerId: z
      .number({ error: "Manager must be a number" })
      .int("Manager must be a whole number")
      .positive("Manager must be positive")
      .nullable()
      .default(null),
    accessRole: accessRoleSchema.optional(),
  })
  .strict();

export type EmployeeInput = z.infer<typeof employeeInputSchema> & {
  accessRole?: AccessRole;
};

export const idParamSchema = z.coerce
  .number({ error: "Employee id must be a number" })
  .int("Employee id must be a whole number")
  .positive("Employee id must be positive");

export function parseEmployeeInput(body: unknown): EmployeeInput {
  const result = employeeInputSchema.safeParse(body);

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

export function parseId(value: string): number {
  const result = idParamSchema.safeParse(value);

  if (!result.success) {
    throw new ValidationError({
      id: result.error.issues.map((issue) => issue.message),
    });
  }

  return result.data;
}
