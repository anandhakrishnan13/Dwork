"use client";

import {
  PencilIcon,
  RefreshCwIcon,
  SearchXIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { accessRoleLabel, formatDate, initials } from "@/lib/format";
import type { Employee } from "@/types/employee";

interface EmployeeTableProps {
  employees: Employee[];
  isLoading: boolean;
  error: string | null;
  search: string;
  pendingDeleteId: number | null;
  canEdit: (employee: Employee) => boolean;
  canDelete: boolean;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onRetry: () => void;
  onClearSearch: () => void;
}

function TableSkeleton() {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">Employee</TableHead>
          <TableHead className="hidden sm:table-cell">Role</TableHead>
          <TableHead className="hidden md:table-cell">Manager</TableHead>
          <TableHead className="hidden lg:table-cell">Access</TableHead>
          <TableHead className="hidden xl:table-cell">Added</TableHead>
          <TableHead className="pr-4">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, index) => (
          <TableRow key={index}>
            <TableCell className="pl-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 rounded-full" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              <Skeleton className="h-5 w-24 rounded-full" />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <Skeleton className="h-3.5 w-28" />
            </TableCell>
            <TableCell className="hidden lg:table-cell">
              <Skeleton className="h-5 w-16 rounded-full" />
            </TableCell>
            <TableCell className="hidden xl:table-cell">
              <Skeleton className="h-3.5 w-20" />
            </TableCell>
            <TableCell className="pr-4">
              <Skeleton className="ml-auto h-7 w-16" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function EmployeeTable({
  employees,
  isLoading,
  error,
  search,
  pendingDeleteId,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onRetry,
  onClearSearch,
}: EmployeeTableProps) {
  if (isLoading) return <TableSkeleton />;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlertIcon className="size-5" />
        </span>
        <div>
          <p className="font-medium">Could not load employees</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCwIcon />
          Try again
        </Button>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchXIcon className="size-5" />
        </span>
        <div>
          <p className="font-medium">
            {search ? "No matching employees" : "No employees yet"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {search
              ? `Nothing matches “${search}”. Try a different name, email or role.`
              : "Add your first teammate using the form."}
          </p>
        </div>
        {search ? (
          <Button variant="outline" size="sm" onClick={onClearSearch}>
            Clear search
          </Button>
        ) : null}
      </div>
    );
  }

  const hasActions = canDelete || employees.some((employee) => canEdit(employee));

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">Employee</TableHead>
          <TableHead className="hidden sm:table-cell">Role</TableHead>
          <TableHead className="hidden md:table-cell">Manager</TableHead>
          <TableHead className="hidden lg:table-cell">Access</TableHead>
          <TableHead className="hidden xl:table-cell">Added</TableHead>
          {hasActions ? (
            <TableHead className="pr-4 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => {
          const editable = canEdit(employee);

          return (
            <TableRow key={employee.id}>
              <TableCell className="pl-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {initials(employee.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{employee.name}</p>
                    <p className="max-w-64 truncate text-xs text-muted-foreground">
                      {employee.email}
                    </p>
                    <Badge
                      variant="secondary"
                      className="mt-1 max-w-40 truncate sm:hidden"
                    >
                      {employee.role}
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="secondary" className="max-w-40 truncate">
                  {employee.role}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {employee.manager_name ?? "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <Badge variant="outline">
                  {accessRoleLabel(employee.access_role)}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground xl:table-cell">
                {formatDate(employee.created_at)}
              </TableCell>
              {hasActions ? (
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    {editable ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onEdit(employee)}
                        aria-label={`Edit ${employee.name}`}
                      >
                        <PencilIcon />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(employee)}
                        aria-label={`Delete ${employee.name}`}
                        disabled={pendingDeleteId === employee.id}
                      >
                        <Trash2Icon />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
