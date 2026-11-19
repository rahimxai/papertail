"use client";

import { FilePlus2, FileText, FileUp, Home, Loader2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Brand } from "@/components/brand";
import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type DashboardView = "home" | "mine" | "shared";

export const VIEWS: Record<DashboardView, { label: string; icon: LucideIcon }> = {
  home: { label: "Home", icon: Home },
  mine: { label: "My documents", icon: FileText },
  shared: { label: "Shared with me", icon: Users },
};

type Props = {
  user: { name: string; email: string };
  view: DashboardView;
  counts: Record<DashboardView, number>;
  creating: boolean;
  onSelectView: (view: DashboardView) => void;
  onCreate: () => void;
  onImport: () => void;
};

export function SidebarContent({ user, view, counts, creating, onSelectView, onCreate, onImport }: Props) {
  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <div className="px-2 pt-2">
        <Brand />
      </div>

      <div className="flex gap-2">
        <Button className="h-9 flex-1 shadow-sm" onClick={onCreate} disabled={creating}>
          {creating ? <Loader2 className="animate-spin" aria-hidden /> : <FilePlus2 aria-hidden />}
          New document
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-lg" className="bg-card" onClick={onImport} aria-label="Import a file">
              <FileUp aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import .docx, .md, or .txt</TooltipContent>
        </Tooltip>
      </div>

      <nav aria-label="Documents" className="space-y-0.5">
        {(Object.keys(VIEWS) as DashboardView[]).map((key) => {
          const { label, icon: Icon } = VIEWS[key];
          const active = key === view;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onSelectView(key)}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                active ? "bg-card font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", active && "text-primary")} aria-hidden />
              <span className="flex-1 text-left">{label}</span>
              {key !== "home" && <span className="text-xs text-subtle-foreground tabular-nums">{counts[key]}</span>}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3">
        <p className="px-2.5 text-xs leading-relaxed text-subtle-foreground">
          Demo workspace · changes save automatically and are visible to everyone you share with.
        </p>
        <div className="border-t pt-2">
          <UserMenu user={user} />
        </div>
      </div>
    </div>
  );
}
