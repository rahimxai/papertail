import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

// Muted, paper-friendly tints. A person keeps the same color everywhere, which makes collaborator lists scannable.
const TONES = [
  "bg-[oklch(0.92_0.04_163)] text-[oklch(0.36_0.07_163)]",
  "bg-[oklch(0.92_0.04_45)] text-[oklch(0.42_0.09_45)]",
  "bg-[oklch(0.93_0.045_85)] text-[oklch(0.42_0.08_75)]",
  "bg-[oklch(0.92_0.03_250)] text-[oklch(0.4_0.07_250)]",
  "bg-[oklch(0.92_0.035_330)] text-[oklch(0.42_0.08_330)]",
];

function toneFor(seed: string) {
  // FNV-1a: spreads short names across the palette better than a simple multiply-add hash.
  let hash = 0x811c9dc5;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return TONES[hash % TONES.length];
}

const SIZES = { xs: "size-5 text-[9px]", sm: "size-6 text-[10px]", md: "size-8 text-xs", lg: "size-9 text-[13px]" } as const;

export function UserAvatar({ name, size = "md", className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <Avatar className={cn(SIZES[size], "after:border-black/5", className)}>
      <AvatarFallback className={cn("font-semibold tracking-wide", SIZES[size], toneFor(name))}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}
