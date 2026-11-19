"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api-client";

type Props = {
  document: { id: string; title: string; sharedWithCount: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteDialog({ document, open, onOpenChange, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);

  async function onConfirm() {
    setDeleting(true);
    try {
      await apiFetch(`/api/documents/${document.id}`, { method: "DELETE" });
      toast.success(`Deleted “${document.title}”`);
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-semibold [overflow-wrap:anywhere]">Delete “{document.title}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the document
            {document.sharedWithCount > 0 &&
              ` and removes access for ${document.sharedWithCount} ${document.sharedWithCount === 1 ? "person" : "people"}`}
            . This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting}>
            {deleting && <Loader2 className="animate-spin" aria-hidden />}
            Delete document
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
