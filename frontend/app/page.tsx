import { UsersIcon } from "lucide-react";
import { EmployeeDirectory } from "@/components/employees/employee-directory";

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2.5 px-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <UsersIcon className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Directory</p>
            <p className="text-xs text-muted-foreground">Employee management</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
        <EmployeeDirectory />
      </main>

      <footer className="border-t bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Employee Directory — Next.js, Express and PostgreSQL.</p>
          <p>Pagination is enforced by the API.</p>
        </div>
      </footer>
    </div>
  );
}
