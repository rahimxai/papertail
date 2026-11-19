"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Link2, Loader2, Mail, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Collaborators, Person, ShareRole } from "@/server/sharing";

type Props = {
  documentId: string;
  documentTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after access changes, so the caller can refresh share counts. */
  onChanged?: () => void;
};

const ROLE_OPTIONS: { value: ShareRole; label: string; hint: string }[] = [
  { value: "EDITOR", label: "Can edit", hint: "Edit text and formatting" },
  { value: "VIEWER", label: "Can view", hint: "Read only" },
];

async function fetchSharing(documentId: string) {
  const [people, directory] = await Promise.all([
    apiFetch<Collaborators>(`/api/documents/${documentId}/shares`),
    apiFetch<{ users: Person[] }>("/api/users"),
  ]);
  return { people, users: directory.users };
}

export function ShareDialog({ documentId, documentTitle, open, onOpenChange, onChanged }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* On phones the dialog docks to the bottom edge like a sheet, where it's easier to reach. */}
      <DialogContent className="gap-0 p-0 max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-lg">
        {/* Dialog content unmounts when closed, so the panel reloads fresh data on every open. */}
        <SharePanel documentId={documentId} documentTitle={documentTitle} onChanged={onChanged} />
      </DialogContent>
    </Dialog>
  );
}

function SharePanel({ documentId, documentTitle, onChanged }: Pick<Props, "documentId" | "documentTitle" | "onChanged">) {
  const [data, setData] = useState<Collaborators | null>(null);
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareRole>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchSharing(documentId);
      setData(result.people);
      setCandidates(result.users);
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, [documentId]);

  useEffect(() => {
    let cancelled = false;
    fetchSharing(documentId).then(
      (result) => {
        if (cancelled) return;
        setData(result.people);
        setCandidates(result.users);
      },
      (error: unknown) => {
        if (!cancelled) setLoadError(errorMessage(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const suggestions = useMemo(() => {
    const taken = new Set([data?.owner.id, ...(data?.shares.map((share) => share.id) ?? [])]);
    const needle = email.trim().toLowerCase();
    return candidates
      .filter((person) => !taken.has(person.id))
      .filter((person) => !needle || `${person.name} ${person.email}`.toLowerCase().includes(needle))
      .filter((person) => person.email !== needle);
  }, [candidates, data, email]);

  async function share(target: { email: string; role: ShareRole }) {
    return apiFetch<{ created: boolean; person: Person }>(`/api/documents/${documentId}/shares`, { method: "POST", json: target });
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!address) return setFormError("Enter the email of the person you want to share with.");
    setInviting(true);
    setFormError(null);
    try {
      const result = await share({ email: address, role });
      toast.success(
        result.created ? `Shared with ${result.person.name}` : `Updated ${result.person.name}'s access`,
        { description: role === "EDITOR" ? "They can view and edit." : "They can view but not edit." },
      );
      setEmail("");
      await load();
      onChanged?.();
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(person: Person, nextRole: ShareRole) {
    setBusyUserId(person.id);
    try {
      await apiFetch(`/api/documents/${documentId}/shares/${person.id}`, { method: "PATCH", json: { role: nextRole } });
      toast.success(`${person.name} ${nextRole === "EDITOR" ? "can now edit" : "can now only view"}`);
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyUserId(null);
    }
  }

  // Removal is immediate but reversible: the toast offers Undo instead of a blocking confirmation.
  async function remove(person: Person & { role: ShareRole }) {
    setBusyUserId(person.id);
    try {
      await apiFetch(`/api/documents/${documentId}/shares/${person.id}`, { method: "DELETE" });
      toast(`Removed ${person.name}`, {
        description: "They lose access immediately.",
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await share({ email: person.email, role: person.role });
              toast.success(`Restored ${person.name}'s access`);
              await load();
              onChanged?.();
            } catch (error) {
              toast.error(errorMessage(error));
            }
          },
        },
      });
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyUserId(null);
    }
  }

  async function copyLink() {
    const url = new URL(`/documents/${documentId}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast.error("Couldn't copy the link", { description: url });
    }
  }

  const canManage = data?.canManage ?? false;

  return (
    <>
      <DialogHeader className="border-b p-5 pr-12">
        <DialogTitle className="truncate text-base font-semibold">Share “{documentTitle}”</DialogTitle>
        <DialogDescription>
          {data && !canManage
            ? `Only ${data.owner.name} can change who has access.`
            : "People you add can find this document under Shared with me."}
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-6 overflow-y-auto p-5">
        {loadError && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">
            {loadError}
            <Button size="sm" variant="outline" className="bg-card" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}

        {canManage && (
          <form onSubmit={invite} className="space-y-2.5" noValidate>
            <Label htmlFor="share-email">Add people</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
                <Input
                  id="share-email"
                  type="email"
                  autoComplete="off"
                  placeholder="Email address"
                  value={email}
                  aria-invalid={!!formError}
                  aria-describedby={formError ? "share-error" : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFormError(null);
                  }}
                  className="h-9 bg-card pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={role} onValueChange={(value) => setRole(value as ShareRole)}>
                  <SelectTrigger className="h-9! flex-1 bg-card sm:w-28" aria-label="Access level">
                    {/* Explicit children: the closed trigger shows only the label, not the option's help text. */}
                    <SelectValue>{ROLE_OPTIONS.find((option) => option.value === role)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end">
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex flex-col">
                          <span>{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.hint}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" className="h-9 px-4" disabled={inviting}>
                  {inviting && <Loader2 className="animate-spin" aria-hidden />}
                  Share
                </Button>
              </div>
            </div>
            {formError && (
              <p id="share-error" role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="mr-1 text-xs text-subtle-foreground">Suggested</span>
                {suggestions.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      setEmail(person.email);
                      setFormError(null);
                    }}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-card py-0.5 pr-2.5 pl-0.5 text-xs transition-colors outline-none hover:border-foreground/20 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    <UserAvatar name={person.name} size="sm" />
                    {person.name}
                  </button>
                ))}
              </div>
            )}
          </form>
        )}

        <section aria-labelledby="people-with-access">
          <h3 id="people-with-access" className="mb-1 text-xs font-medium text-subtle-foreground">
            People with access
          </h3>
          {!data && !loadError && (
            <div className="space-y-3 py-2">
              {[0, 1].map((index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {data && (
            <ul>
              <PersonRow person={data.owner}>
                <span className="text-xs font-medium text-muted-foreground">Owner</span>
              </PersonRow>
              {data.shares.map((share) => (
                <PersonRow key={share.id} person={share} busy={busyUserId === share.id}>
                  {canManage ? (
                    <div className="flex items-center gap-1">
                      <Select value={share.role} disabled={busyUserId === share.id} onValueChange={(value) => void changeRole(share, value as ShareRole)}>
                        <SelectTrigger
                          size="sm"
                          className="w-26 border-transparent bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground aria-expanded:bg-accent"
                          aria-label={`Access for ${share.name}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-subtle-foreground hover:bg-destructive-soft hover:text-destructive"
                            aria-label={`Remove ${share.name}`}
                            disabled={busyUserId === share.id}
                            onClick={() => void remove(share)}
                          >
                            <UserMinus aria-hidden />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove access</TooltipContent>
                      </Tooltip>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{share.role === "EDITOR" ? "Can edit" : "Can view"}</span>
                  )}
                </PersonRow>
              ))}
            </ul>
          )}
          {data && data.shares.length === 0 && (
            <p className="mt-1 rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
              Only {canManage ? "you have" : `${data.owner.name} has`} access right now.
            </p>
          )}
        </section>
      </div>

      <DialogFooter className="mx-0 mb-0 flex-row items-center justify-between rounded-b-xl bg-muted/40 px-5 py-3 max-sm:rounded-none max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="ghost" onClick={() => void copyLink()} className={cn(copied && "text-success")}>
          {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
          <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
        </Button>
        <DialogClose asChild>
          <Button variant="outline" className="bg-card px-4">
            Done
          </Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

function PersonRow({ person, busy, children }: { person: Person; busy?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-3 py-2 transition-opacity", busy && "opacity-60")}>
      <UserAvatar name={person.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{person.name}</p>
        <p className="truncate text-xs text-muted-foreground">{person.email}</p>
      </div>
      {children}
    </li>
  );
}
