"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, getErrorMessage } from "@/lib/api";
import type { PaginatedEmployees } from "@/types/employee";
import { useDebouncedValue } from "./use-debounced-value";

interface UseEmployeesOptions {
  page: number;
  search: string;
}

interface EmployeesState {
  data: PaginatedEmployees | null;
  isLoading: boolean;
  error: string | null;
}

interface LoadOptions {
  /** Keep the current table visible while refetching. */
  silent?: boolean;
}

export function useEmployees({ page, search }: UseEmployeesOptions) {
  const debouncedSearch = useDebouncedValue(search, 300);
  const [state, setState] = useState<EmployeesState>({
    data: null,
    isLoading: true,
    error: null,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestRef = useRef(0);

  const load = useCallback(
    async ({ silent = false }: LoadOptions = {}): Promise<boolean> => {
      const requestId = ++requestRef.current;

      if (silent) {
        setIsRefreshing(true);
      } else {
        setState((previous) => ({ ...previous, isLoading: true, error: null }));
      }

      try {
        const { data } = await api.get<PaginatedEmployees>("/employees", {
          params: {
            page,
            search: debouncedSearch.trim() || undefined,
          },
        });

        if (requestId !== requestRef.current) return true;

        setState({ data, isLoading: false, error: null });
        return true;
      } catch (error) {
        if (requestId !== requestRef.current) return false;

        const message = getErrorMessage(error);
        setState((previous) => ({
          ...previous,
          isLoading: false,
          error: message,
        }));
        toast.error("Could not load employees", { description: message });
        return false;
      } finally {
        if (requestId === requestRef.current) {
          setIsRefreshing(false);
        }
      }
    },
    [page, debouncedSearch],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load() owns request state, including the initial loading flag
    void load();
  }, [load]);

  return { ...state, isRefreshing, reload: load };
}
