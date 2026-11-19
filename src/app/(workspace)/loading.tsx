import { Brand } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the dashboard's layout so the page doesn't jump when the data streams in.
export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen" aria-busy="true" aria-label="Loading documents">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-3 md:flex">
        <div className="px-2 pt-2">
          <Brand />
        </div>
        <Skeleton className="h-9 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 sm:px-8 md:pt-12">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="mt-3 h-4 w-56" />
        <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-lg" />
          ))}
        </div>
        <div className="mt-12 space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
