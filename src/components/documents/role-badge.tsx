import { Eye, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentListItem } from "@/server/documents";

/** Access level for documents shared with you. Owners don't get a badge: ownership is the default state. */
export function RoleBadge({ role, className }: { role: DocumentListItem["role"]; className?: string }) {
  if (role === "OWNER") return null;
  const editor = role === "EDITOR";
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[11px] font-medium",
        editor ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {editor ? <PenLine className="size-3" aria-hidden /> : <Eye className="size-3" aria-hidden />}
      {editor ? "Can edit" : "Can view"}
    </span>
  );
}
