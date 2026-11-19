"use client";

import { Check, CloudOff, Eye, Loader2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveStatus } from "./use-autosave";

type View = { key: string; icon: React.ReactNode; text: string; detail: string; tone: string; alwaysShowText?: boolean };

function describe(status: SaveStatus, retryInSeconds: number, readOnly: boolean): View {
  if (readOnly) return { key: "readonly", icon: <Eye />, text: "View only", detail: "You can read but not edit this document", tone: "text-muted-foreground" };
  switch (status) {
    case "saved":
      return { key: "saved", icon: <Check className="text-success" />, text: "Saved", detail: "All changes saved", tone: "text-muted-foreground" };
    // "Unsaved" only lasts for the debounce window; showing it would flicker on every pause, so it reads as saving.
    case "unsaved":
    case "saving":
      return { key: "saving", icon: <Loader2 className="animate-spin" />, text: "Saving…", detail: "Saving your changes", tone: "text-muted-foreground" };
    case "offline":
      return {
        key: "offline",
        icon: <CloudOff />,
        text: `Offline · retrying in ${retryInSeconds}s`,
        detail: "Your changes are kept here and will save when the connection returns",
        tone: "bg-warning-soft text-warning",
        alwaysShowText: true,
      };
    case "conflict":
      return { key: "conflict", icon: <TriangleAlert />, text: "Not saved", detail: "Someone else saved a newer version", tone: "bg-destructive-soft text-destructive", alwaysShowText: true };
    case "error":
      return { key: "error", icon: <TriangleAlert />, text: "Couldn't save", detail: "Your last change couldn't be saved", tone: "bg-destructive-soft text-destructive", alwaysShowText: true };
  }
}

export function SaveIndicator({ status, retryInSeconds, readOnly }: { status: SaveStatus; retryInSeconds: number; readOnly: boolean }) {
  const view = describe(status, retryInSeconds, readOnly);
  return (
    <span
      role="status"
      aria-live="polite"
      title={view.detail}
      className={cn("inline-flex h-7 shrink-0 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap transition-colors duration-200", view.tone)}
    >
      {/* Keyed so each state change fades in instead of snapping. */}
      <span key={view.key} className="inline-flex animate-status items-center gap-1.5 [&_svg]:size-3.5">
        {view.icon}
        <span className={cn(!view.alwaysShowText && "sr-only sm:not-sr-only")}>{view.text}</span>
      </span>
    </span>
  );
}
