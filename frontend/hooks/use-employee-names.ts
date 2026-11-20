"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ApiEnvelope, EmployeeName } from "@/types/employee";
import { useDebouncedValue } from "./use-debounced-value";

export function useEmployeeNames(search: string) {
  const debouncedSearch = useDebouncedValue(search, 200);
  const [names, setNames] = useState<EmployeeName[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- surface the loading state while the request runs
    setIsLoading(true);

    api
      .get<ApiEnvelope<EmployeeName[]>>("/employees/names", {
        params: { search: debouncedSearch.trim() || undefined },
      })
      .then(({ data }) => {
        if (requestId === requestRef.current) setNames(data.data);
      })
      .catch(() => {
        // Table-level error handling owns user-facing feedback.
      })
      .finally(() => {
        if (requestId === requestRef.current) setIsLoading(false);
      });
  }, [debouncedSearch]);

  return { names, isLoading };
}
