import { AppHeader } from "@/components/app-header";
import { RequireAuth } from "@/components/auth/require-auth";
import { EmployeeDirectory } from "@/components/employees/employee-directory";

export default function Home() {
  return (
    <RequireAuth>
      <div className="flex min-h-full flex-1 flex-col bg-muted/30">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">
          <EmployeeDirectory />
        </main>
      </div>
    </RequireAuth>
  );
}
