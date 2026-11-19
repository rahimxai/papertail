import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small stack of paper with an icon badge. Used for every empty, not-found, and error state, so they read as
 * part of the product rather than as generic placeholders.
 */
function PaperIllustration({ icon: Icon, tone = "default", className }: { icon: LucideIcon; tone?: "default" | "danger"; className?: string }) {
  return (
    <div aria-hidden className={cn("relative h-20 w-24", className)}>
      <div className="absolute top-2 left-3 h-16 w-13 -rotate-6 rounded-md border bg-card shadow-xs" />
      <div className="absolute top-1 left-7 flex h-17 w-14 rotate-3 flex-col gap-1.5 rounded-md border bg-card p-2.5 pt-3 shadow-sm">
        <span className="h-1 w-7 rounded-full bg-foreground/15" />
        <span className="h-1 w-8 rounded-full bg-foreground/10" />
        <span className="h-1 w-6 rounded-full bg-foreground/10" />
        <span className="h-1 w-8 rounded-full bg-foreground/10" />
      </div>
      <span
        className={cn(
          "absolute -right-1 bottom-0 flex size-8 items-center justify-center rounded-full border-2 border-background shadow-sm",
          tone === "danger" ? "bg-destructive-soft text-destructive" : "bg-primary-soft text-primary",
        )}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  children,
  tone,
  as: Heading = "h3",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
  tone?: "default" | "danger";
  /** Heading level for the title, so the state fits the page outline it appears in. */
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center animate-enter", className)}>
      <PaperIllustration icon={icon} tone={tone} />
      <Heading className={cn("mt-5 font-semibold", Heading === "h1" ? "font-serif text-2xl font-medium tracking-[-0.01em]" : "text-[15px]")}>
        {title}
      </Heading>
      <p className="mt-1 max-w-sm text-sm text-pretty text-muted-foreground">{description}</p>
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}
