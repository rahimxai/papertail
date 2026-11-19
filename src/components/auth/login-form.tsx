"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type DemoUser = { email: string; name: string };
type FieldErrors = { email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "That doesn't look like an email address.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

export function LoginForm({ demoUsers, demoPassword }: { demoUsers: DemoUser[]; demoPassword: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function signIn(credentials: { email: string; password: string }, source: string) {
    setPending(source);
    setError(null);
    try {
      await apiFetch("/api/auth/login", { method: "POST", json: credentials });
      // Full navigation: an auth change must drop every cached RSC payload from the previous session.
      window.location.replace("/");
    } catch (caught) {
      setError(errorMessage(caught));
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const errors = validate(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    void signIn({ email, password }, "form");
  }

  return (
    <div className="w-full max-w-sm animate-enter">
      <h1 className="font-serif text-[2.25rem] leading-[1.1] font-medium tracking-[-0.015em]">Welcome back</h1>
      <p className="mt-2 text-[15px] text-muted-foreground">Sign in to your shared workspace.</p>

      <section aria-labelledby="demo-accounts" className="mt-8">
        <h2 id="demo-accounts" className="text-xs font-medium text-subtle-foreground">
          Continue as a demo teammate
        </h2>
        <ul className="mt-2 overflow-hidden rounded-lg border bg-card shadow-xs">
          {demoUsers.map((user) => (
            <li key={user.email} className="border-b last:border-b-0">
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => signIn({ email: user.email, password: demoPassword }, user.email)}
                className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors outline-none hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset disabled:cursor-wait disabled:opacity-60"
              >
                <UserAvatar name={user.name} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
                {pending === user.email ? (
                  <Loader2 className="size-4 animate-spin text-primary" aria-label="Signing in" />
                ) : (
                  <ArrowRight
                    className="size-4 text-subtle-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="my-7 flex items-center gap-3 text-xs text-subtle-foreground">
        <span className="h-px flex-1 bg-border" />
        or use email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="email" label="Email" error={fieldErrors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@papertrail.dev"
            value={email}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? "email-error" : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            className="h-10 bg-card"
          />
        </Field>
        <Field
          id="password"
          label="Password"
          error={fieldErrors.password}
          hint={
            <>
              Demo password <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">{demoPassword}</code>
            </>
          }
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? "password-error" : "password-hint"}
            onChange={(event) => {
              setPassword(event.target.value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            className="h-10 bg-card"
          />
        </Field>

        {error && (
          <div role="alert" className="flex animate-enter items-start gap-2.5 rounded-lg bg-destructive-soft px-3 py-2.5 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </div>
        )}

        <Button type="submit" className="h-10 w-full shadow-sm" disabled={pending !== null}>
          {pending === "form" && <Loader2 className="animate-spin" aria-hidden />}
          {pending === "form" ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="animate-status text-xs text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className={cn("text-xs text-subtle-foreground")}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}
