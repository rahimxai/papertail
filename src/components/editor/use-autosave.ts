"use client";

import { useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/core";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { DocumentDetail } from "@/server/documents";

export type SaveStatus = "saved" | "unsaved" | "saving" | "offline" | "conflict" | "error";

type Options = {
  documentId: string;
  enabled: boolean;
  getPayload: () => { title: string; content: JSONContent };
  onSaved: (document: DocumentDetail) => void;
  onConflict: (current: DocumentDetail) => void;
  /** 403/404 while saving: the user's access was downgraded or revoked since the page loaded. */
  onAccessLost: (error: ApiError) => void;
};

const DEBOUNCE_MS = 800;
const MAX_RETRY_MS = 30_000;

/**
 * Debounced, version-checked autosave. Plain class (not hooks) so its state machine is easy to follow:
 * - one request at a time, each carrying the version returned by the previous one, so a user's own
 *   overlapping saves can never conflict or arrive out of order;
 * - only real changes are saved (opening a document never creates a version);
 * - a 409 pauses saving until the user chooses; network/5xx failures retry with exponential backoff.
 */
class AutosaveController {
  private dirty = false;
  private inFlight = false;
  private stopped = false;
  private conflict: DocumentDetail | null = null;
  private chain: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryDelay = 0;

  constructor(
    private version: number,
    private readonly optionsRef: { readonly current: Options },
    private readonly report: (status: SaveStatus, retryInSeconds?: number) => void,
  ) {}

  private options(): Options {
    return this.optionsRef.current;
  }

  /** True while edits exist that the server hasn't confirmed, including a save that is still in flight. */
  get hasUnsavedChanges() {
    return this.dirty || this.inFlight;
  }

  markDirty() {
    this.dirty = true;
    clearTimeout(this.timer);
    if (this.stopped) return this.report("error");
    if (this.conflict) return this.report("conflict");
    this.report("unsaved");
    this.timer = setTimeout(() => void this.save(), DEBOUNCE_MS);
  }

  save(): Promise<void> {
    const run = this.chain.then(() => this.perform());
    this.chain = run.catch(() => undefined);
    return run;
  }

  /** "theirs": adopt the server version (the caller replaces the editor content). "mine": overwrite it knowingly. */
  resolveConflict(choice: "theirs" | "mine") {
    if (!this.conflict) return;
    this.version = this.conflict.version;
    this.conflict = null;
    if (choice === "mine") {
      this.dirty = true;
      void this.save();
    } else {
      this.dirty = false;
      this.report("saved");
    }
  }

  dispose() {
    clearTimeout(this.timer);
    // Leaving the page with pending edits: send them now rather than dropping them.
    if (this.dirty && !this.conflict) void this.save();
  }

  private async perform() {
    clearTimeout(this.timer);
    const { enabled, documentId, getPayload } = this.options();
    if (!enabled || this.stopped || this.conflict || !this.dirty) return;
    // Edits made while this request is in flight set `dirty` again and are picked up by the next save.
    this.dirty = false;
    this.inFlight = true;
    this.report("saving");
    try {
      const { document } = await apiFetch<{ document: DocumentDetail }>(`/api/documents/${documentId}`, {
        method: "PATCH",
        json: { baseVersion: this.version, ...getPayload() },
      });
      this.version = document.version;
      this.retryDelay = 0;
      toast.dismiss(SESSION_TOAST);
      toast.dismiss(SAVE_ERROR_TOAST);
      this.options().onSaved(document);
      this.report(this.dirty ? "unsaved" : "saved");
    } catch (error) {
      this.dirty = true;
      if (!(error instanceof ApiError)) throw error;
      if (error.status === 409) {
        this.conflict = (error.details as { document: DocumentDetail }).document;
        this.report("conflict");
        this.options().onConflict(this.conflict);
      } else if (error.isNetworkError || error.status >= 500) {
        const firstFailure = this.retryDelay === 0;
        this.retryDelay = Math.min((this.retryDelay || 1000) * 2, MAX_RETRY_MS);
        this.report("offline", Math.round(this.retryDelay / 1000));
        if (firstFailure) toast.error(`${error.message} Your changes are kept and will be retried.`);
        this.timer = setTimeout(() => void this.save(), this.retryDelay);
      } else if (error.status === 401) {
        // Session expired or signed out elsewhere: keep the edits, offer a way back in, retry on return.
        this.report("error");
        toast.error("Your session has ended. Sign in again to keep saving. Your changes are kept on this page.", {
          id: SESSION_TOAST,
          duration: Infinity,
          action: { label: "Sign in", onClick: () => window.open("/login", "_blank", "noopener") },
        });
        window.addEventListener("focus", () => void this.save(), { once: true });
      } else if (error.status === 403 || error.status === 404) {
        // Access was revoked or downgraded: further saves can only fail the same way.
        this.stopped = true;
        this.report("error");
        this.options().onAccessLost(error);
      } else {
        this.report("error");
        toast.error(error.message, { id: SAVE_ERROR_TOAST });
      }
    } finally {
      this.inFlight = false;
    }
  }
}

const SESSION_TOAST = "autosave-session";
const SAVE_ERROR_TOAST = "autosave-error";

export function useAutosave(initialVersion: number, options: Options) {
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [retryInSeconds, setRetryInSeconds] = useState(0);
  const [controller] = useState(
    () =>
      new AutosaveController(initialVersion, optionsRef, (next, retry) => {
        setStatus(next);
        if (retry !== undefined) setRetryInSeconds(retry);
      }),
  );

  // Warn before closing the tab with unsaved edits; flush them when navigating away in-app.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (controller.hasUnsavedChanges && optionsRef.current.enabled) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      controller.dispose();
    };
  }, [controller]);

  return { status, retryInSeconds, controller };
}
