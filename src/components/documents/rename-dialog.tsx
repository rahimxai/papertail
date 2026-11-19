"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiError, errorMessage } from "@/lib/api-client";

type Props = {
  document: { id: string; title: string; version: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: () => void;
};

export function RenameDialog({ document, open, onOpenChange, onRenamed }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Dialog content unmounts when closed, so the form's state starts fresh on every open. */}
        <RenameForm document={document} onOpenChange={onOpenChange} onRenamed={onRenamed} />
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({ document, onOpenChange, onRenamed }: Omit<Props, "open">) {
  const [title, setTitle] = useState(document.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("Title can't be empty.");
    setSaving(true);
    try {
      await apiFetch(`/api/documents/${document.id}`, { method: "PATCH", json: { baseVersion: document.version, title } });
      toast.success("Document renamed");
      onOpenChange(false);
      onRenamed();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        toast.error("Someone edited this document since the list loaded. The list has been refreshed; try again.");
        onOpenChange(false);
        onRenamed();
      } else {
        setError(errorMessage(caught));
        setSaving(false);
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-base font-semibold">Rename document</DialogTitle>
        <DialogDescription>Everyone with access sees the new title. Up to 120 characters.</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="rename-title">Title</Label>
        <Input
          id="rename-title"
          value={title}
          maxLength={120}
          autoFocus
          onFocus={(event) => event.currentTarget.select()}
          aria-invalid={!!error}
          onChange={(event) => {
            setTitle(event.target.value);
            setError(null);
          }}
          className="h-9 bg-card"
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
