"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2, MoreHorizontal, Pencil, Share2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenameDialog } from "@/components/documents/rename-dialog";
import { DeleteDialog } from "@/components/documents/delete-dialog";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { cn } from "@/lib/utils";
import type { DocumentListItem } from "@/server/documents";

async function copyDocumentLink(documentId: string) {
  const url = new URL(`/documents/${documentId}`, window.location.origin).toString();
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied", { description: "Only people with access can open it." });
    return true;
  } catch {
    toast.error("Couldn't copy the link", { description: url });
    return false;
  }
}

export function DocumentActions({ document, className }: { document: DocumentListItem; className?: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"rename" | "share" | "delete" | null>(null);
  const isOwner = document.role === "OWNER";
  const canEdit = document.role !== "VIEWER";
  const refresh = () => router.refresh();
  const href = `/documents/${document.id}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("relative z-10 text-muted-foreground hover:text-foreground", className)}
            aria-label={`Actions for ${document.title}`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => router.push(href)}>
            <ExternalLink aria-hidden /> Open
          </DropdownMenuItem>
          {canEdit && (
            <DropdownMenuItem onSelect={() => setDialog("rename")}>
              <Pencil aria-hidden /> Rename
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => setDialog("share")}>
            {isOwner ? <Share2 aria-hidden /> : <Users aria-hidden />} {isOwner ? "Share" : "People with access"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copyDocumentLink(document.id)}>
            <Link2 aria-hidden /> Copy link
          </DropdownMenuItem>
          {isOwner && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                <Trash2 aria-hidden /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog document={document} open={dialog === "rename"} onOpenChange={(open) => setDialog(open ? "rename" : null)} onRenamed={refresh} />
      <DeleteDialog document={document} open={dialog === "delete"} onOpenChange={(open) => setDialog(open ? "delete" : null)} onDeleted={refresh} />
      <ShareDialog
        documentId={document.id}
        documentTitle={document.title}
        open={dialog === "share"}
        onOpenChange={(open) => setDialog(open ? "share" : null)}
        onChanged={refresh}
      />
    </>
  );
}
