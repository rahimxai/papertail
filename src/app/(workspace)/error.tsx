"use client";

import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Brand } from "@/components/brand";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center border-b px-4 sm:px-6">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-4">
        <EmptyState
          as="h1"
          icon={TriangleAlert}
          tone="danger"
          title="Something went wrong"
          description={
            <>
              We couldn&apos;t load this page. It&apos;s usually a temporary problem with the server or database, and
              your saved work is safe.
              {error.digest && <span className="mt-2 block font-mono text-xs text-subtle-foreground">Reference {error.digest}</span>}
            </>
          }
        >
          <Button onClick={reset}>
            <RotateCw aria-hidden /> Try again
          </Button>
          <Button variant="outline" className="bg-card" asChild>
            <Link href="/">Back to documents</Link>
          </Button>
        </EmptyState>
      </main>
    </div>
  );
}
