import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check, PenLine } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";
import { UserAvatar } from "@/components/user-avatar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { DEMO_PASSWORD, DEMO_USERS } from "@/server/seed";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>

      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Brand />
        <main className="flex flex-1 items-center justify-center py-12">
          <LoginForm demoUsers={DEMO_USERS.map((user) => ({ ...user }))} demoPassword={DEMO_PASSWORD} />
        </main>
        <p className="text-xs text-subtle-foreground">
          Demo workspace for the Ajaia assessment. Accounts are seeded; sessions are server-side in HttpOnly cookies.
        </p>
      </div>

      <ProductPreview />
    </div>
  );
}

async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/");
  return null;
}

/** A quiet, static rendering of the product itself: a page being written and shared. Decorative only. */
function ProductPreview() {
  return (
    <aside aria-hidden className="relative hidden overflow-hidden border-l bg-canvas lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20">
      <div className="relative mx-auto w-full max-w-lg">
        <div className="rounded-sm border bg-card px-12 pt-12 pb-16 shadow-paper">
          <p className="font-serif text-[1.65rem] leading-tight font-semibold tracking-[-0.01em]">Q4 launch brief</p>
          <p className="mt-4 font-serif text-[15px] leading-relaxed text-foreground/80">
            We&apos;re shipping the new onboarding in <strong className="font-semibold text-foreground">three phases</strong>, each
            behind a flag, so we can learn before we scale.
          </p>
          <p className="mt-5 font-serif text-[1.05rem] font-semibold">Open questions</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-serif text-[15px] text-foreground/80 marker:text-subtle-foreground">
            <li>Which regions launch first?</li>
            <li>
              Do we need a <u className="underline-offset-2">migration guide</u>?
            </li>
          </ul>
          <div className="mt-6 space-y-2">
            <span className="block h-2 w-full rounded-full bg-foreground/[0.06]" />
            <span className="block h-2 w-11/12 rounded-full bg-foreground/[0.06]" />
            <span className="block h-2 w-3/5 rounded-full bg-foreground/[0.06]" />
          </div>
        </div>

        <div className="absolute -top-5 right-6 inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          <Check className="size-3.5 text-success" /> Saved
        </div>

        <div className="absolute -bottom-8 -left-6 w-64 rounded-lg border bg-popover p-3 shadow-lg">
          <p className="text-xs font-medium text-subtle-foreground">People with access</p>
          <div className="mt-2 space-y-2">
            <PreviewPerson name="Alex Morgan" role="Owner" />
            <PreviewPerson name="Jordan Lee" role="Can edit" highlight />
            <PreviewPerson name="Sam Rivera" role="Can view" />
          </div>
        </div>
      </div>

      <p className="relative mx-auto mt-20 max-w-lg font-serif text-lg leading-snug text-foreground/80">
        Write together, share with intent.
        <span className="block text-muted-foreground">Every document has an owner, and every collaborator a clear role.</span>
      </p>
    </aside>
  );
}

function PreviewPerson({ name, role, highlight }: { name: string; role: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <UserAvatar name={name} size="sm" />
      <span className="flex-1 text-[13px] font-medium">{name}</span>
      <span
        className={
          highlight
            ? "inline-flex items-center gap-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[11px] font-medium text-primary"
            : "text-[11px] text-muted-foreground"
        }
      >
        {highlight && <PenLine className="size-3" />}
        {role}
      </span>
    </div>
  );
}
