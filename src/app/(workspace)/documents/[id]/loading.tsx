import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the editor: top bar, toolbar, and a page on the desk.
export default function DocumentLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas" aria-busy="true" aria-label="Loading document">
      <div className="flex h-14 items-center gap-3 border-b bg-background px-3 sm:px-4">
        <Skeleton className="size-8 rounded-md" />
        <Skeleton className="h-5 w-56" />
        <Skeleton className="ml-auto h-8 w-20" />
      </div>
      <div className="flex h-12 items-center justify-center border-b bg-background">
        <Skeleton className="h-8 w-96 max-w-[80%]" />
      </div>
      <div className="mx-auto mt-0 w-full max-w-[816px] flex-1 sm:mt-10">
        <div className="min-h-[70vh] space-y-4 bg-card px-6 py-10 sm:rounded-sm sm:border sm:px-20 sm:py-16 sm:shadow-paper">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}
