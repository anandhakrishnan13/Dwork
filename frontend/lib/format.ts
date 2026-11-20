const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
});

const ACCESS_ROLE_LABELS = {
  employee: "Employee",
  manager: "Manager",
  admin: "Admin",
} as const;

export function accessRoleLabel(role: keyof typeof ACCESS_ROLE_LABELS | null): string {
  return role ? ACCESS_ROLE_LABELS[role] : "No login";
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function employeeCount(count: number): string {
  return `${count} ${count === 1 ? "employee" : "employees"}`;
}
