import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { RoleBadge } from "@/components/documents/role-badge";
import { timeAgo } from "@/lib/format";
import type { DocumentListItem } from "@/server/documents";

/** The only card pattern in the app: a miniature page, so recent work is recognizable at a glance. */
export function RecentDocuments({ documents }: { documents: DocumentListItem[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {documents.map((document, index) => (
        <li
          key={document.id}
          className="group relative animate-enter overflow-hidden rounded-lg border bg-card shadow-xs transition-[box-shadow,border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-md has-focus-visible:ring-3 has-focus-visible:ring-ring/40"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <div aria-hidden className="h-28 overflow-hidden border-b bg-canvas px-5 pt-4">
            <div className="h-full rounded-t-sm border border-b-0 bg-card px-3.5 pt-3 shadow-xs transition-transform duration-300 group-hover:-translate-y-1">
              <p className="line-clamp-1 font-serif text-[13px] leading-tight font-semibold">{document.title}</p>
              <p className="mt-1.5 line-clamp-4 font-serif text-[10px] leading-[1.45] text-muted-foreground">
                {document.excerpt || "Empty document"}
              </p>
            </div>
          </div>
          <div className="space-y-1.5 p-3">
            <h3 className="truncate text-sm font-medium">
              <Link href={`/documents/${document.id}`} className="outline-none after:absolute after:inset-0">
                {document.title}
              </Link>
            </h3>
            <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <UserAvatar name={document.ownerName} size="xs" />
              <span className="truncate" suppressHydrationWarning>
                {timeAgo(document.updatedAt)}
              </span>
              <RoleBadge role={document.role} className="ml-auto hidden sm:inline-flex" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
