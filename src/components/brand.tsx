import Link from "next/link";
import { cn } from "@/lib/utils";

/** A folded sheet with a pine "trail" running across it: the product name, drawn. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M10 7.5h8.5l5 5V24a1.5 1.5 0 0 1-1.5 1.5H10A1.5 1.5 0 0 1 8.5 24V9A1.5 1.5 0 0 1 10 7.5Z" fill="white" fillOpacity="0.96" />
      <path d="M18.5 7.5V11a1.5 1.5 0 0 0 1.5 1.5h3.5" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-primary/40" />
      <path d="M11.5 20.5c2-2.2 3.6-2.2 5 0s3 2.2 4.5 0" fill="none" strokeWidth="1.6" strokeLinecap="round" className="stroke-primary" />
      <path d="M11.5 15.5h6" strokeWidth="1.6" strokeLinecap="round" className="stroke-primary/45" />
    </svg>
  );
}

export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        className,
      )}
    >
      <BrandMark />
      <span className="font-serif text-[1.3rem] leading-none font-semibold tracking-[-0.01em]">Papertrail</span>
    </Link>
  );
}
