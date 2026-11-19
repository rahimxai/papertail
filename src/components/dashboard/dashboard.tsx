"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilePlus2, FileUp, Menu, Search, SearchX, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Brand } from "@/components/brand";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { DocumentListItem } from "@/server/documents";
import { DocumentList } from "./document-list";
import { ImportDialog } from "./import-dialog";
import { RecentDocuments } from "./recent-documents";
import { SidebarContent, VIEWS, type DashboardView } from "./sidebar";

const parseView = (value: string | null): DashboardView => (value === "mine" || value === "shared" ? value : "home");

type Props = { user: { name: string; email: string }; documents: DocumentListItem[] };

export function Dashboard({ user, documents }: Props) {
  const router = useRouter();
  // The view lives in the URL (?view=mine) so it survives reloads and works with back/forward.
  const view = parseView(useSearchParams().get("view"));
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const owned = useMemo(() => documents.filter((item) => item.role === "OWNER"), [documents]);
  const shared = useMemo(() => documents.filter((item) => item.role !== "OWNER"), [documents]);
  const counts = { home: documents.length, mine: owned.length, shared: shared.length };

  // Search is client-side: the list is already loaded, so filtering is instant and needs no round trip.
  const needle = query.trim().toLowerCase();
  const scope = view === "mine" ? owned : view === "shared" ? shared : documents;
  const results = needle ? scope.filter((item) => `${item.title} ${item.excerpt} ${item.ownerName}`.toLowerCase().includes(needle)) : scope;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !target.closest("input, textarea, [contenteditable=true]")) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function selectView(next: DashboardView) {
    window.history.pushState(null, "", next === "home" ? "/" : `/?view=${next}`);
    setNavOpen(false);
  }

  async function createDocument() {
    setCreating(true);
    try {
      const { document } = await apiFetch<{ document: { id: string } }>("/api/documents", { method: "POST", json: {} });
      router.push(`/documents/${document.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setCreating(false);
    }
  }

  const openImport = () => {
    setNavOpen(false);
    setImportOpen(true);
  };

  const sidebar = (
    <SidebarContent
      user={user}
      view={view}
      counts={counts}
      creating={creating}
      onSelectView={selectView}
      onCreate={createDocument}
      onImport={openImport}
    />
  );

  const createActions = (
    <>
      <Button onClick={createDocument} disabled={creating}>
        <FilePlus2 aria-hidden /> New document
      </Button>
      <Button variant="outline" className="bg-card" onClick={openImport}>
        <FileUp aria-hidden /> Import a file
      </Button>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar md:block">{sidebar}</aside>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setNavOpen(true)} aria-label="Open navigation">
            <Menu aria-hidden />
          </Button>
          <Brand className="flex-1" />
          <Button size="icon" onClick={createDocument} disabled={creating} aria-label="New document">
            <FilePlus2 aria-hidden />
          </Button>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-16 sm:px-8 md:pt-12">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="font-serif text-[1.75rem] leading-tight font-medium tracking-[-0.01em] sm:text-[2rem]">
                {view === "home" ? `Welcome back, ${user.name.split(" ")[0]}` : VIEWS[view].label}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {view === "home" && summary(owned.length, shared.length)}
                {view === "mine" && "Documents you created or imported. Only you can share or delete them."}
                {view === "shared" && "Documents teammates have given you access to."}
              </p>
            </div>
            {documents.length > 0 && (
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
                <Input
                  ref={searchRef}
                  type="search"
                  placeholder="Search documents"
                  aria-label="Search documents"
                  aria-keyshortcuts="/"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setQuery("");
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-9 bg-card pr-9 pl-9 shadow-xs [&::-webkit-search-cancel-button]:hidden"
                />
                {query ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="absolute top-1/2 right-2 -translate-y-1/2"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X aria-hidden />
                  </Button>
                ) : (
                  <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 sm:inline-flex">/</kbd>
                )}
              </div>
            )}
          </div>

          <div className="mt-10 space-y-12">
            {documents.length === 0 ? (
              <EmptyState
                as="h2"
                icon={FilePlus2}
                title="Your workspace is empty"
                description="Start with a blank page, or bring in a Word, Markdown, or text file. It becomes an editable document you own."
                className="rounded-xl border border-dashed bg-card/50 py-16"
              >
                {createActions}
              </EmptyState>
            ) : needle && results.length === 0 ? (
              <EmptyState
                as="h2"
                icon={SearchX}
                title={`No results for “${query.trim()}”`}
                description={
                  view === "home"
                    ? "Search looks at titles, document text, and owners. Try a shorter or different word."
                    : `Only “${VIEWS[view].label}” is being searched. Try a different word, or search everything from Home.`
                }
              >
                <Button variant="outline" className="bg-card" onClick={() => setQuery("")}>
                  Clear search
                </Button>
                {view !== "home" && (
                  <Button variant="ghost" onClick={() => selectView("home")}>
                    Search all documents
                  </Button>
                )}
              </EmptyState>
            ) : needle ? (
              <Section title={`${results.length} ${results.length === 1 ? "result" : "results"} for “${query.trim()}”`}>
                <DocumentList documents={results} label="Search results" />
              </Section>
            ) : (
              <>
                {view === "home" && (
                  <Section title="Recent">
                    <RecentDocuments documents={documents.slice(0, 4)} />
                  </Section>
                )}
                {view !== "shared" && (
                  <Section title="My documents" count={view === "home" ? owned.length : undefined}>
                    {owned.length > 0 ? (
                      <DocumentList documents={owned} label="My documents" />
                    ) : (
                      <EmptyState
                        icon={FilePlus2}
                        title="No documents of your own yet"
                        description="Documents you create or import appear here, ready to edit and share."
                      >
                        {createActions}
                      </EmptyState>
                    )}
                  </Section>
                )}
                {view !== "mine" && (
                  <Section title="Shared with me" count={view === "home" ? shared.length : undefined}>
                    {shared.length > 0 ? (
                      <DocumentList documents={shared} label="Shared with me" />
                    ) : (
                      <EmptyState
                        icon={Users}
                        title="Nothing shared with you yet"
                        description="When a teammate gives you view or edit access to a document, it shows up here."
                      />
                    )}
                  </Section>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function summary(owned: number, shared: number) {
  if (owned + shared === 0) return "Create your first document or import one to get started.";
  const own = `${owned} ${owned === 1 ? "document" : "documents"} of your own`;
  return shared > 0 ? `${own} · ${shared} shared with you` : own;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  const id = `section-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-foreground/80">
        {title}
        {count !== undefined && <span className="font-normal text-subtle-foreground tabular-nums">{count}</span>}
      </h2>
      {children}
    </section>
  );
}
