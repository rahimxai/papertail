"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleCheck, FileText, FileUp, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ACCEPT = ".docx,.md,.markdown,.txt";
const SUPPORTED = [".docx", ".md", ".markdown", ".txt"];
const MAX_BYTES = 4 * 1024 * 1024;
const FORMATS = [
  { ext: "DOCX", name: "Word" },
  { ext: "MD", name: "Markdown" },
  { ext: "TXT", name: "Plain text" },
];

type ImportResult = { document: { id: string; title: string }; imagesSkipped: number };
type FileInfo = { name: string; size: number };
type Status =
  | { phase: "idle" }
  | { phase: "uploading"; file: FileInfo; percent: number }
  | { phase: "converting"; file: FileInfo }
  | { phase: "done"; file: FileInfo; title: string; href: string }
  | { phase: "error"; file?: FileInfo; message: string };

function validate(file: File): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc")) return "Legacy .doc files aren't supported. Save the file as .docx and try again.";
  if (!SUPPORTED.some((extension) => name.endsWith(extension))) return "Unsupported file type. Choose a .docx, .md, or .txt file.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_BYTES) return "Files are limited to 4 MB.";
  return null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// XHR instead of fetch because fetch can't report upload progress.
function upload(file: File, onProgress: (percent: number) => void): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/imports");
    request.responseType = "json";
    request.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
    request.onload = () => {
      const body = request.response as (ImportResult & { error?: { message?: string } }) | null;
      if (request.status === 201 && body) resolve(body);
      else reject(new Error(body?.error?.message ?? `Import failed (${request.status}).`));
    };
    request.onerror = () => reject(new Error("Can't reach the server. Check your connection and try again."));
    const form = new FormData();
    form.append("file", file);
    request.send(form);
  });
}

const OPEN_FALLBACK_MS = 2500;

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  // Only the upload itself locks the dialog; once the document exists the user can always open it or close.
  const busy = status.phase === "uploading" || status.phase === "converting";
  const openHref = status.phase === "done" ? status.href : null;

  // The client-side navigation normally unmounts this dialog within a few hundred ms. If it was aborted (flaky
  // network, cancelled RSC request), fall back to a full page load instead of leaving "Opening…" on screen.
  useEffect(() => {
    if (!openHref) return;
    const timer = setTimeout(() => window.location.assign(openHref), OPEN_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [openHref]);

  async function importFile(file: File | undefined) {
    if (!file || busy || status.phase === "done") return;
    const info = { name: file.name, size: file.size };
    const problem = validate(file);
    if (problem) return setStatus({ phase: "error", file: info, message: problem });
    setStatus({ phase: "uploading", file: info, percent: 0 });
    try {
      const result = await upload(file, (percent) =>
        setStatus(percent >= 100 ? { phase: "converting", file: info } : { phase: "uploading", file: info, percent }),
      );
      const skipped = result.imagesSkipped;
      const href = `/documents/${result.document.id}`;
      setStatus({ phase: "done", file: info, title: result.document.title, href });
      toast.success(`Imported “${result.document.title}”`, {
        description: skipped ? `${skipped} image${skipped === 1 ? " was" : "s were"} skipped (images aren't supported).` : undefined,
      });
      router.push(href);
    } catch (error) {
      setStatus({ phase: "error", file: info, message: (error as Error).message });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void importFile(event.dataTransfer.files[0]);
  }

  const choose = () => inputRef.current?.click();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) setStatus({ phase: "idle" });
        onOpenChange(next);
      }}
    >
      <DialogContent className="gap-5 p-5 sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Import a file</DialogTitle>
          <DialogDescription>It becomes a new document you own. Headings, lists, and bold, italic, and underline carry over.</DialogDescription>
        </DialogHeader>

        <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(event) => void importFile(event.target.files?.[0])} />

        {status.phase === "idle" || status.phase === "error" ? (
          <button
            type="button"
            onClick={choose}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "group flex flex-col items-center rounded-lg border-2 border-dashed px-6 py-9 text-center transition-colors duration-150 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
              dragging ? "border-primary bg-primary-soft/60" : "border-input bg-canvas/50 hover:border-foreground/25 hover:bg-canvas",
            )}
          >
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-full border bg-card shadow-xs transition-transform duration-200",
                dragging ? "scale-110 text-primary" : "text-muted-foreground group-hover:-translate-y-0.5",
              )}
            >
              <FileUp className="size-5" aria-hidden />
            </span>
            <span className="mt-4 text-sm font-medium">{dragging ? "Drop to import" : "Drag a file here, or click to browse"}</span>
            <span className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label="Supported formats">
              {FORMATS.map((format) => (
                <span key={format.ext} className="rounded border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground/80">{format.ext}</span> {format.name}
                </span>
              ))}
            </span>
            <span className="mt-2 text-xs text-subtle-foreground">Up to 4 MB · text files must be UTF-8</span>
          </button>
        ) : (
          <FileProgress status={status} />
        )}

        {status.phase === "done" && (
          <div className="-mt-1 flex animate-enter items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Opening your new document…</span>
            <Button asChild size="sm">
              <a href={status.href}>
                Open document <ArrowRight aria-hidden />
              </a>
            </Button>
          </div>
        )}

        {status.phase === "error" && (
          <div role="alert" className="flex animate-enter gap-3 rounded-lg bg-destructive-soft p-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-destructive">
                {status.file ? <>Couldn&apos;t import {status.file.name}</> : "Couldn't import that file"}
              </p>
              <p className="mt-0.5 text-foreground/80">{status.message}</p>
            </div>
          </div>
        )}

        <p className="text-xs text-pretty text-subtle-foreground">
          Images are skipped and tables become plain text. The original file isn&apos;t stored.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function FileProgress({ status }: { status: Extract<Status, { phase: "uploading" | "converting" | "done" }> }) {
  const percent = status.phase === "uploading" ? status.percent : 100;
  const label =
    status.phase === "uploading" ? `Uploading… ${status.percent}%` : status.phase === "converting" ? "Converting to an editable document…" : "Imported";
  return (
    <div className="animate-enter rounded-lg border bg-card p-4" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{status.file.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatSize(status.file.size)} · {label}
          </p>
        </div>
        {status.phase === "done" ? (
          <CircleCheck className="size-5 shrink-0 animate-status text-success" aria-hidden />
        ) : (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Import progress"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            status.phase === "done" ? "bg-success" : "bg-primary",
            status.phase === "converting" && "animate-pulse",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
