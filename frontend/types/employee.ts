import type { AccessRole } from "./auth";

export type { AccessRole };

export interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  manager_id: number | null;
  manager_name: string | null;
  access_role: AccessRole | null;
  created_at: string;
}

export interface EmployeeInput {
  name: string;
  email: string;
  role: string;
  managerId: number | null;
  accessRole?: AccessRole;
}

export interface EmployeeName {
  id: number;
  name: string;
  email: string;
}

export interface PaginatedEmployees {
  data: Employee[];
  currentPage: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
}

export interface ApiEnvelope<T> {
  data: T;
}
