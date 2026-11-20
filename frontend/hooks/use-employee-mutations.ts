"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api, toApiError, type ApiError } from "@/lib/api";
import type { EmployeeInput } from "@/types/employee";

export type MutationResult =
  | { success: true }
  | { success: false; error: ApiError };

type MutationKind = "create" | "update" | "delete";

export function useEmployeeMutations() {
  const [pending, setPending] = useState<MutationKind | null>(null);

  const create = useCallback(
    async (input: EmployeeInput): Promise<MutationResult> => {
      setPending("create");
      try {
        await api.post("/employees", input);
        toast.success("Employee added", {
          description: `${input.name} is now in the directory.`,
        });
        return { success: true };
      } catch (error) {
        const apiError = toApiError(error);
        toast.error("Could not add employee", { description: apiError.message });
        return { success: false, error: apiError };
      } finally {
        setPending(null);
      }
    },
    [],
  );

  const update = useCallback(
    async (id: number, input: EmployeeInput): Promise<MutationResult> => {
      setPending("update");
      try {
        await api.put(`/employees/${id}`, input);
        toast.success("Employee updated", {
          description: `${input.name}'s details were saved.`,
        });
        return { success: true };
      } catch (error) {
        const apiError = toApiError(error);
        toast.error("Could not update employee", {
          description: apiError.message,
        });
        return { success: false, error: apiError };
      } finally {
        setPending(null);
      }
    },
    [],
  );

  const remove = useCallback(async (id: number): Promise<MutationResult> => {
    setPending("delete");
    try {
      await api.delete(`/employees/${id}`);
      toast.success("Employee deleted", {
        description: "The record was removed from the directory.",
      });
      return { success: true };
    } catch (error) {
      const apiError = toApiError(error);
      toast.error("Could not delete employee", {
        description: apiError.message,
      });
      return { success: false, error: apiError };
    } finally {
      setPending(null);
    }
  }, []);

  return { pending, create, update, remove };
}
