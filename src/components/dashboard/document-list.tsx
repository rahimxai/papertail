"use client";

import Link from "next/link";
import { FileText, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DocumentActions } from "@/components/documents/document-actions";
import { RoleBadge } from "@/components/documents/role-badge";
import { UserAvatar } from "@/components/user-avatar";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DocumentListItem } from "@/server/documents";

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-x-4 md:grid-cols-[minmax(0,1fr)_11rem_9rem_2rem]";

export function DocumentList({ documents, label }: { documents: DocumentListItem[]; label: string }) {
  return (
    <div role="table" aria-label={label} className="animate-enter">
      <div role="row" className={cn(COLUMNS, "hidden h-8 border-b px-3 text-xs font-medium text-subtle-foreground md:grid")}>
        <span role="columnheader">Name</span>
        <span role="columnheader">Owner</span>
        <span role="columnheader">Last edited</span>
        <span role="columnheader" className="sr-only">
          Actions
        </span>
      </div>
      <div role="rowgroup" className="divide-y divide-border/60">
        {documents.map((document) => (
          <DocumentRow key={document.id} document={document} />
        ))}
      </div>
    </div>
  );
}

function DocumentRow({ document }: { document: DocumentListItem }) {
  const isOwner = document.role === "OWNER";
  const owner = isOwner ? "You" : document.ownerName;
  const edited = timeAgo(document.updatedAt);
  const editedBy = document.updatedByName && document.updatedByName !== document.ownerName ? document.updatedByName : null;

  return (
    <div
      role="row"
      className={cn(
        COLUMNS,
        "group relative -mx-px rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-accent/60 has-focus-visible:bg-accent/60",
      )}
    >
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md border",
            isOwner ? "border-primary/15 bg-primary-soft text-primary" : "bg-card text-muted-foreground",
          )}
        >
          <FileText className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={`/documents/${document.id}`}
              className="truncate text-sm font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-3 focus-visible:after:ring-ring/40"
            >
              {document.title}
            </Link>
            <RoleBadge role={document.role} />
            {isOwner && document.sharedWithCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="relative z-10 inline-flex shrink-0 items-center gap-1 text-xs text-subtle-foreground">
                    <Users className="size-3.5" aria-hidden />
                    <span className="sr-only">Shared with</span>
                    {document.sharedWithCount}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Shared with {document.sharedWithCount} {document.sharedWithCount === 1 ? "person" : "people"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className="hidden truncate text-[13px] text-muted-foreground md:block">{document.excerpt || "Empty document"}</p>
          <p className="truncate text-xs text-muted-foreground md:hidden" suppressHydrationWarning>
            {owner} · {edited}
          </p>
        </div>
      </div>
      <div role="cell" className="hidden min-w-0 items-center gap-2 text-[13px] md:flex">
        <UserAvatar name={document.ownerName} size="xs" />
        <span className={cn("truncate", isOwner && "text-muted-foreground")}>{owner}</span>
      </div>
      <div role="cell" className="hidden min-w-0 text-[13px] text-muted-foreground md:block" suppressHydrationWarning>
        <span className="block truncate">{edited}</span>
        {editedBy && <span className="block truncate text-xs text-subtle-foreground">by {editedBy}</span>}
      </div>
      <div role="cell" className="flex justify-end">
        <DocumentActions document={document} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-has-focus-visible:opacity-100 md:aria-expanded:opacity-100" />
      </div>
    </div>
  );
}
