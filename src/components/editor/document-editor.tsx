"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { ArrowLeft, ChevronRight, Eye, Share2, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { UserMenu } from "@/components/auth/user-menu";
import { RoleBadge } from "@/components/documents/role-badge";
import { ShareDialog } from "@/components/sharing/share-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { editorExtensions, MAX_DOCUMENT_CHARACTERS } from "@/lib/editor/extensions";
import { timeAgo } from "@/lib/format";
import type { DocumentDetail } from "@/server/documents";
import { EditorToolbar } from "./editor-toolbar";
import { SaveIndicator } from "./save-indicator";
import { useAutosave } from "./use-autosave";

type Props = { initialDocument: DocumentDetail; currentUser: { name: string; email: string } };

export function DocumentEditor({ initialDocument, currentUser }: Props) {
  const router = useRouter();
  const isOwner = initialDocument.role === "OWNER";
  const canEdit = initialDocument.role !== "VIEWER";
  const [title, setTitle] = useState(initialDocument.title);
  const [lastEdited, setLastEdited] = useState({ by: initialDocument.updatedByName, at: initialDocument.updatedAt });
  const [conflict, setConflict] = useState<DocumentDetail | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  const { status, retryInSeconds, controller } = useAutosave(initialDocument.version, {
    documentId: initialDocument.id,
    enabled: canEdit,
    getPayload: () => ({ title: title.trim() || "Untitled document", content: editorRef.current!.getJSON() }),
    onSaved: (saved) => setLastEdited({ by: saved.updatedByName, at: saved.updatedAt }),
    onConflict: (current) => {
      setConflict(current);
      setLastEdited({ by: current.updatedByName, at: current.updatedAt });
    },
    onAccessLost: (error) => {
      // Fixed id: several in-flight saves can fail the same way, but the user needs to read it once.
      toast.error(error.message, { id: "access-lost" });
      // Re-render the server page: it shows the document read-only, or "not found" if access was revoked.
      router.refresh();
    },
  });

  const editor = useEditor({
    extensions: [...editorExtensions, Placeholder.configure({ placeholder: "Start writing…" }), CharacterCount],
    content: initialDocument.content,
    editable: canEdit,
    immediatelyRender: false,
    editorProps: { attributes: { class: "tiptap-document", "aria-label": "Document content" } },
    onUpdate: () => controller.markDirty(),
  });
  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Same late-creation caveat as the toolbar: fall back to reading the editor until the first transaction.
  // `isDestroyed`/optional storage: Next can keep this page mounted but hidden, after Tiptap has torn the editor down.
  const readCounts = (current: Editor) =>
    current.isDestroyed ? null : { words: current.storage.characterCount?.words() ?? 0, characters: current.storage.characterCount?.characters() ?? 0 };
  const selectedCounts = useEditorState({ editor, selector: ({ editor: current }) => (current ? readCounts(current) : null) });
  const counts = selectedCounts ?? (editor ? readCounts(editor) : null) ?? { words: 0, characters: 0 };
  const words = counts.words;
  const charactersLeft = MAX_DOCUMENT_CHARACTERS - counts.characters;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void controller.save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller]);

  function resolveConflict(choice: "theirs" | "mine") {
    if (!conflict) return;
    if (choice === "theirs" && editor) {
      editor.commands.setContent(conflict.content, { emitUpdate: false });
      setTitle(conflict.title);
      toast.success(conflict.updatedByName ? `Loaded ${conflict.updatedByName}'s version` : "Loaded the latest version");
    }
    controller.resolveConflict(choice);
    setConflict(null);
  }

  const who = lastEdited.by === currentUser.name ? "you" : lastEdited.by;
  const peopleWithAccess = initialDocument.sharedWithCount + 1;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
        <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-2 sm:px-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" asChild aria-label="Back to documents">
                <Link href="/">
                  <ArrowLeft aria-hidden />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>All documents</TooltipContent>
          </Tooltip>

          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1">
            <Link
              href={isOwner ? "/?view=mine" : "/?view=shared"}
              className="hidden shrink-0 rounded px-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 lg:inline"
            >
              {isOwner ? "My documents" : "Shared with me"}
            </Link>
            <ChevronRight className="hidden size-3.5 shrink-0 text-subtle-foreground lg:block" aria-hidden />
            <input
              value={title}
              readOnly={!canEdit}
              maxLength={120}
              aria-label="Document title"
              aria-current="page"
              placeholder="Untitled document"
              onChange={(event) => {
                setTitle(event.target.value);
                controller.markDirty();
              }}
              onBlur={() => {
                if (!title.trim()) {
                  setTitle("Untitled document");
                  controller.markDirty();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  editor?.commands.focus("start");
                }
              }}
              className="h-8 max-w-md min-w-0 truncate rounded-md border border-transparent bg-transparent px-2 text-[15px] font-medium transition-colors outline-none field-sizing-content placeholder:text-subtle-foreground hover:border-border focus:border-ring focus:bg-card focus:ring-3 focus:ring-ring/25 read-only:hover:border-transparent read-only:focus:border-transparent read-only:focus:bg-transparent read-only:focus:ring-0"
            />
            <RoleBadge role={initialDocument.role} className="hidden sm:inline-flex" />
          </nav>

          <SaveIndicator status={status} retryInSeconds={retryInSeconds} readOnly={!canEdit} />

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                aria-label={`${peopleWithAccess} ${peopleWithAccess === 1 ? "person has" : "people have"} access`}
                className="hidden items-center rounded-full p-0.5 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40 md:flex"
              >
                <UserAvatar name={initialDocument.ownerName} size="sm" className="ring-2 ring-background" />
                {initialDocument.sharedWithCount > 0 && (
                  <span className="-ml-1.5 flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
                    +{initialDocument.sharedWithCount}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isOwner ? "You own this" : `Owned by ${initialDocument.ownerName}`}
              {initialDocument.sharedWithCount > 0 &&
                ` · shared with ${initialDocument.sharedWithCount} ${initialDocument.sharedWithCount === 1 ? "person" : "people"}`}
            </TooltipContent>
          </Tooltip>

          {isOwner ? (
            <Button onClick={() => setShareOpen(true)} className="shadow-sm" aria-label="Share">
              <Share2 aria-hidden /> <span className="hidden sm:inline">Share</span>
            </Button>
          ) : (
            <Button variant="outline" className="bg-card" onClick={() => setShareOpen(true)} aria-label="People with access">
              <Users aria-hidden /> <span className="hidden sm:inline">People</span>
            </Button>
          )}
          <UserMenu user={currentUser} variant="compact" />
        </div>
      </header>

      {canEdit && (
        <div className="sticky top-14 z-20 border-b bg-background/90 backdrop-blur-md">
          <div className="scrollbar-none overflow-x-auto max-sm:[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]">
            <EditorToolbar editor={editor} />
          </div>
        </div>
      )}

      <main className="flex-1 pb-24 sm:px-6">
        <div className="mx-auto w-full max-w-[816px]">
          {(conflict || !canEdit) && (
            <div className="space-y-3 px-4 pt-4 sm:px-0 sm:pt-6">
              {conflict && (
                <div
                  role="alert"
                  className="flex animate-enter flex-col gap-3 rounded-lg border border-warning/25 bg-warning-soft p-3 pl-4 text-sm sm:flex-row sm:items-center"
                >
                  <TriangleAlert className="hidden size-4 shrink-0 text-warning sm:block" aria-hidden />
                  <p className="flex-1 text-pretty">
                    <strong className="font-semibold">{conflict.updatedByName ?? "Someone"}</strong> saved a newer version while you
                    were editing. Your latest changes aren&apos;t saved yet.
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" className="bg-card" onClick={() => resolveConflict("mine")}>
                      Keep mine
                    </Button>
                    <Button onClick={() => resolveConflict("theirs")}>Load their version</Button>
                  </div>
                </div>
              )}
              {!canEdit && (
                <div className="flex items-center gap-2.5 rounded-lg border bg-card/70 px-4 py-2.5 text-sm text-muted-foreground">
                  <Eye className="size-4 shrink-0" aria-hidden />
                  <p>
                    You have view-only access. Ask <span className="font-medium text-foreground">{initialDocument.ownerName}</span> if you
                    need to edit.
                  </p>
                </div>
              )}
            </div>
          )}

          <article
            className="min-h-[calc(100vh-10rem)] animate-enter bg-card px-6 py-10 sm:mt-6 sm:rounded-sm sm:border sm:px-16 sm:py-16 sm:shadow-paper lg:px-24 lg:py-20"
            onMouseDown={(event) => {
              // Clicking the page margin focuses the editor, like a real sheet of paper.
              if (canEdit && event.target === event.currentTarget) {
                event.preventDefault();
                editor?.commands.focus("end");
              }
            }}
          >
            <EditorContent editor={editor} />
          </article>

          <footer className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 px-6 text-xs text-subtle-foreground sm:px-1">
            <span>{isOwner ? "You own this document" : `Owned by ${initialDocument.ownerName}`}</span>
            {who && (
              <>
                <span aria-hidden>·</span>
                <span suppressHydrationWarning>
                  Last edited by {who} {timeAgo(lastEdited.at)}
                </span>
              </>
            )}
            <span className="ml-auto tabular-nums">
              {canEdit && charactersLeft < 10_000 && (
                <span className={charactersLeft < 0 ? "font-medium text-destructive" : "text-warning"}>
                  {charactersLeft < 0
                    ? `${(-charactersLeft).toLocaleString("en-US")} characters over the limit · `
                    : `${charactersLeft.toLocaleString("en-US")} characters left · `}
                </span>
              )}
              {words.toLocaleString("en-US")} {words === 1 ? "word" : "words"}
            </span>
          </footer>
        </div>
      </main>

      <ShareDialog
        documentId={initialDocument.id}
        documentTitle={title}
        open={shareOpen}
        onOpenChange={setShareOpen}
        onChanged={() => router.refresh()}
      />
    </div>
  );
}
