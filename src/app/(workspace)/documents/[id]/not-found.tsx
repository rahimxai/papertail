import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { Brand } from "@/components/brand";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

// Shown both for missing documents and for documents the user can't access, so URLs never reveal what exists.
export default function DocumentNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="flex h-14 items-center border-b bg-background px-4 sm:px-6">
        <Brand />
      </header>
      <main className="flex flex-1 items-center justify-center px-4">
        <EmptyState
          as="h1"
          icon={Lock}
          title="You can't open this document"
          description="It doesn't exist, it was deleted, or it hasn't been shared with you. If you were expecting access, ask the owner to share it with your email."
        >
          <Button asChild>
            <Link href="/">
              <ArrowLeft aria-hidden /> Back to documents
            </Link>
          </Button>
        </EmptyState>
      </main>
    </div>
  );
}
