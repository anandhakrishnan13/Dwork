"use client";

import { useEffect, useState } from "react";
import {
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteEmployeeDialog } from "@/components/employees/delete-employee-dialog";
import { EmployeeForm } from "@/components/employees/employee-form";
import { EmployeeSearch } from "@/components/employees/employee-search";
import { EmployeeTable } from "@/components/employees/employee-table";
import { PaginationControls } from "@/components/employees/pagination-controls";
import { useEmployeeMutations } from "@/hooks/use-employee-mutations";
import { useEmployees } from "@/hooks/use-employees";
import { employeeCount } from "@/lib/format";
import type { Employee, EmployeeInput } from "@/types/employee";

export function EmployeeDirectory() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const { data, isLoading, isRefreshing, error, reload } = useEmployees({
    page,
    search,
  });
  const { pending, create, update, remove } = useEmployeeMutations();

  // If a deletion empties the last page, step back to a page that exists.
  useEffect(() => {
    if (data && page > data.totalPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp to the last page after the API reports fewer pages
      setPage(data.totalPages);
    }
  }, [data, page]);

  function handleSearchChange(nextSearch: string) {
    setSearch(nextSearch);
    setPage(1);
  }

  async function handleCreate(values: EmployeeInput) {
    const result = await create(values);
    if (result.success) {
      setCreating(false);
      if (page !== 1) setPage(1);
      else await reload({ silent: true });
    }
    return result;
  }

  async function handleUpdate(employee: Employee, values: EmployeeInput) {
    const result = await update(employee.id, values);
    if (result.success) {
      setEditing(null);
      await reload({ silent: true });
    }
    return result;
  }

  async function handleDelete(employee: Employee) {
    const result = await remove(employee.id);
    if (result.success) {
      setDeleting(null);
      await reload({ silent: true });
    }
  }

  async function handleRefresh() {
    const refreshed = await reload();
    if (refreshed) {
      toast.success("Directory refreshed", {
        description: "The employee list is up to date.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Employee directory
          </h1>
          <p className="text-sm text-muted-foreground">
            Add teammates, keep details current, and find anyone in seconds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="w-fit gap-1.5 py-1">
            <UsersIcon className="size-3.5" />
            {data ? employeeCount(data.totalRecords) : "Loading…"}
          </Badge>
          <Button onClick={() => setCreating(true)}>
            <PlusIcon />
            Add employee
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <EmployeeSearch value={search} onChange={handleSearchChange} />
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh directory"
            className="shrink-0"
          >
            {isRefreshing ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <RefreshCwIcon />
            )}
            <span className="hidden sm:inline">
              {isRefreshing ? "Refreshing…" : "Refresh"}
            </span>
          </Button>
        </div>

        <Card className="gap-0 overflow-hidden py-0">
          <EmployeeTable
            employees={data?.data ?? []}
            isLoading={isLoading}
            error={error}
            search={search}
            pendingDeleteId={
              pending === "delete" && deleting ? deleting.id : null
            }
            onEdit={setEditing}
            onDelete={setDeleting}
            onRetry={() => void reload()}
            onClearSearch={() => handleSearchChange("")}
          />
          <PaginationControls
            currentPage={data?.currentPage ?? page}
            totalPages={data?.totalPages ?? 1}
            totalRecords={data?.totalRecords ?? 0}
            pageSize={data?.pageSize ?? 10}
            onPageChange={setPage}
          />
        </Card>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>
              Create a directory profile. New teammates appear at the top of the list.
            </DialogDescription>
          </DialogHeader>
          <EmployeeForm
            submitLabel="Add employee"
            isSubmitting={pending === "create"}
            onSubmit={handleCreate}
            onCancel={() => setCreating(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit employee</DialogTitle>
            <DialogDescription>
              Update {editing?.name}&apos;s details.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <EmployeeForm
              key={editing.id}
              initialValues={{
                name: editing.name,
                email: editing.email,
                role: editing.role,
              }}
              submitLabel="Save changes"
              isSubmitting={pending === "update"}
              onSubmit={(values) => handleUpdate(editing, values)}
              onCancel={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <DeleteEmployeeDialog
        employee={deleting}
        isDeleting={pending === "delete"}
        onCancel={() => setDeleting(null)}
        onConfirm={(employee) => void handleDelete(employee)}
      />
    </div>
  );
}
