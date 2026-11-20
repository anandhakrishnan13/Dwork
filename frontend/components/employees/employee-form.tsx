"use client";

import { useId, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MutationResult } from "@/hooks/use-employee-mutations";
import type {
  AccessRole,
  EmployeeInput,
  EmployeeName,
} from "@/types/employee";

const EMPTY_VALUES: EmployeeInput = {
  name: "",
  email: "",
  role: "",
  managerId: null,
  accessRole: "employee",
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NO_MANAGER = "none";

const ACCESS_ROLE_OPTIONS: { value: AccessRole; label: string }[] = [
  { value: "employee", label: "Employee — view the directory" },
  { value: "manager", label: "Manager — manage direct reports" },
  { value: "admin", label: "Admin — manage everyone" },
];

interface EmployeeFormProps {
  initialValues?: EmployeeInput;
  submitLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: EmployeeInput) => Promise<MutationResult>;
  onCancel?: () => void;
  managerOptions?: EmployeeName[];
  canChooseAccessRole?: boolean;
  lockManager?: boolean;
  excludeEmployeeId?: number;
  showPasswordHint?: boolean;
}

export function EmployeeForm({
  initialValues = EMPTY_VALUES,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  managerOptions = [],
  canChooseAccessRole = false,
  lockManager = false,
  excludeEmployeeId,
  showPasswordHint = false,
}: EmployeeFormProps) {
  const formId = useId();
  const [values, setValues] = useState<EmployeeInput>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function setField<K extends keyof EmployeeInput>(
    field: K,
    value: EmployeeInput[K],
  ) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const name = values.name.trim();
    const email = values.email.trim();
    const role = values.role.trim();

    if (name.length < 2) next.name = "Name must be at least 2 characters.";
    else if (name.length > 120) next.name = "Name must be at most 120 characters.";

    if (!EMAIL_PATTERN.test(email)) next.email = "Enter a valid email address.";

    if (role.length < 2) next.role = "Role must be at least 2 characters.";
    else if (role.length > 100) next.role = "Role must be at most 100 characters.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!validate()) return;

    const result = await onSubmit({
      name: values.name.trim(),
      email: values.email.trim(),
      role: values.role.trim(),
      managerId: values.managerId,
      accessRole: values.accessRole ?? "employee",
    });

    if (!result.success) {
      const fieldErrors = result.error.fieldErrors;
      if (fieldErrors) {
        setErrors(
          Object.fromEntries(
            Object.entries(fieldErrors).map(([field, messages]) => [
              field,
              messages[0] ?? "Invalid value",
            ]),
          ),
        );
      } else {
        setFormError(result.error.message);
      }
    }
  }

  const visibleManagers = managerOptions.filter(
    (manager) => manager.id !== excludeEmployeeId,
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${formId}-name`}>Full name</Label>
        <Input
          id={`${formId}-name`}
          value={values.name}
          onChange={(event) => setField("name", event.target.value)}
          placeholder="Ada Lovelace"
          autoComplete="name"
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${formId}-name-error` : undefined}
        />
        {errors.name ? (
          <p id={`${formId}-name-error`} className="text-xs text-destructive">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${formId}-email`}>Email</Label>
        <Input
          id={`${formId}-email`}
          type="email"
          value={values.email}
          onChange={(event) => setField("email", event.target.value)}
          placeholder="ada@example.com"
          autoComplete="email"
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${formId}-email-error` : undefined}
        />
        {errors.email ? (
          <p id={`${formId}-email-error`} className="text-xs text-destructive">
            {errors.email}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${formId}-role`}>Job role</Label>
        <Input
          id={`${formId}-role`}
          value={values.role}
          onChange={(event) => setField("role", event.target.value)}
          placeholder="Frontend Engineer"
          autoComplete="organization-title"
          disabled={isSubmitting}
          aria-invalid={Boolean(errors.role)}
          aria-describedby={errors.role ? `${formId}-role-error` : undefined}
        />
        {errors.role ? (
          <p id={`${formId}-role-error`} className="text-xs text-destructive">
            {errors.role}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${formId}-manager`}>Reports to</Label>
        <Select
          value={
            values.managerId === null ? NO_MANAGER : String(values.managerId)
          }
          onValueChange={(value) =>
            setField(
              "managerId",
              value === NO_MANAGER ? null : Number(value),
            )
          }
          disabled={isSubmitting || lockManager}
        >
          <SelectTrigger
            id={`${formId}-manager`}
            className="w-full"
            aria-invalid={Boolean(errors.managerId)}
          >
            <SelectValue placeholder="No manager" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_MANAGER}>No manager</SelectItem>
            {visibleManagers.map((manager) => (
              <SelectItem key={manager.id} value={String(manager.id)}>
                {manager.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {lockManager ? (
          <p className="text-xs text-muted-foreground">
            {showPasswordHint
              ? "New employees report to you."
              : "You cannot change who this employee reports to."}
          </p>
        ) : null}
        {errors.managerId ? (
          <p className="text-xs text-destructive">{errors.managerId}</p>
        ) : null}
      </div>

      {canChooseAccessRole ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${formId}-access-role`}>Access level</Label>
          <Select
            value={values.accessRole ?? "employee"}
            onValueChange={(value) =>
              setField("accessRole", value as AccessRole)
            }
            disabled={isSubmitting}
          >
            <SelectTrigger
              id={`${formId}-access-role`}
              className="w-full"
              aria-invalid={Boolean(errors.accessRole)}
            >
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              {ACCESS_ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.accessRole ? (
            <p className="text-xs text-destructive">{errors.accessRole}</p>
          ) : null}
        </div>
      ) : null}

      {showPasswordHint ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          The employee signs in with this email and the default password{" "}
          <span className="font-medium text-foreground">Majdoor-hu-mai</span>.
        </p>
      ) : null}

      {formError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {formError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        {onCancel ? (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting} className="min-w-28">
          {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
