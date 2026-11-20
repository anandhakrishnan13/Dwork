export const ACCESS_ROLES = ["employee", "manager", "admin"] as const;

export type AccessRole = (typeof ACCESS_ROLES)[number];

export interface AuthUser {
  id: number;
  email: string;
  role: AccessRole;
  isSuperAdmin: boolean;
  employeeId: number | null;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}
