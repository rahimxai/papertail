"use client";

import { useState } from "react";
import { ChevronsUpDown, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { apiFetch, errorMessage } from "@/lib/api-client";

type User = { name: string; email: string };

/** `row` sits at the bottom of the sidebar; `compact` is the avatar-only trigger in the editor's top bar. */
export function UserMenu({ user, variant = "row" }: { user: User; variant?: "row" | "compact" }) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      // Full navigation so no RSC payload from the signed-in session survives in the router cache.
      window.location.replace("/login");
    } catch (error) {
      toast.error(errorMessage(error));
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "row" ? (
          <button
            type="button"
            aria-label={`Account menu for ${user.name}`}
            className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40 aria-expanded:bg-accent"
          >
            <UserAvatar name={user.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
            </span>
            <ChevronsUpDown className="size-4 text-subtle-foreground" aria-hidden />
          </button>
        ) : (
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={`Account menu for ${user.name}`}>
            <UserAvatar name={user.name} size="sm" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "row" ? "start" : "end"} side={variant === "row" ? "top" : "bottom"} className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
          <UserAvatar name={user.name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={signingOut} onSelect={signOut}>
          <Users aria-hidden /> Switch demo account
        </DropdownMenuItem>
        <DropdownMenuItem disabled={signingOut} onSelect={signOut} variant="destructive">
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
