"use client";

import { useState } from "react";
import {
  ChevronsUpDownIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployeeNames } from "@/hooks/use-employee-names";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface EmployeeSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function EmployeeSearch({ value, onChange }: EmployeeSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { names, isLoading } = useEmployeeNames(query);

  function commit(next: string) {
    onChange(next.trim());
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="flex w-full items-center gap-2">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Search employees"
            className="min-w-0 flex-1 justify-between font-normal"
          >
            <span className="flex min-w-0 items-center gap-2">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <span
                className={cn(
                  "truncate",
                  !value && "text-muted-foreground",
                )}
              >
                {value || "Search by name, email or role…"}
              </span>
            </span>
            <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Type to find a teammate…"
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {isLoading && names.length === 0 ? (
                <div className="flex flex-col gap-2 p-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : null}
              <CommandEmpty>
                {isLoading ? "Searching…" : "No employees found."}
              </CommandEmpty>
              {query.trim() ? (
                <CommandGroup heading="Search">
                  <CommandItem
                    value={`search-${query}`}
                    onSelect={() => commit(query)}
                  >
                    <SearchIcon />
                    <span className="truncate">Search for “{query}”</span>
                  </CommandItem>
                </CommandGroup>
              ) : null}
              <CommandGroup heading="Employees">
                {names.map((employee) => (
                  <CommandItem
                    key={employee.id}
                    value={`${employee.name} ${employee.email}`}
                    onSelect={() => commit(employee.name)}
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                      {initials(employee.name)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{employee.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {employee.email}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value ? (
        <Button
          variant="outline"
          size="icon"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  );
}
