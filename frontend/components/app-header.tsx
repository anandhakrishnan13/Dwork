"use client";

import { LogOutIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import { initials } from "@/lib/format";
import { accessRoleLabel } from "@/lib/format";

export function AppHeader() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    toast.success("Signed out");
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <UsersIcon className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Directory</p>
            <p className="text-xs text-muted-foreground">Employee management</p>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="max-w-40 truncate text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                {user.isSuperAdmin ? "Super admin" : accessRoleLabel(user.role)}
              </p>
            </div>
            <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {initials(user.name)}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleLogout}
              aria-label="Sign out"
            >
              <LogOutIcon />
            </Button>
          </div>
        ) : (
          <Badge variant="outline" className="text-xs">
            Not signed in
          </Badge>
        )}
      </div>
    </header>
  );
}
