export interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface EmployeeInput {
  name: string;
  email: string;
  role: string;
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
