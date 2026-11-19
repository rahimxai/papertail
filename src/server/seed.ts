import type { JSONContent } from "@tiptap/core";
import type { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/auth/password";

// Demo data shared by `prisma db seed` and the test suite. Imports are relative (not "@/") so tsx can run it.
export const DEMO_PASSWORD = "papertrail-demo";
export const DEMO_USERS = [
  { email: "alex@papertrail.dev", name: "Alex Morgan" },
  { email: "jordan@papertrail.dev", name: "Jordan Lee" },
  { email: "sam@papertrail.dev", name: "Sam Rivera" },
] as const;

const text = (value: string, marks?: string[]): JSONContent => ({
  type: "text",
  text: value,
  ...(marks && { marks: marks.map((type) => ({ type })) }),
});
const heading = (level: 1 | 2 | 3, value: string): JSONContent => ({ type: "heading", attrs: { level }, content: [text(value)] });
const paragraph = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const list = (type: "bulletList" | "orderedList", items: string[]): JSONContent => ({
  type,
  content: items.map((item) => ({ type: "listItem", content: [paragraph(text(item))] })),
});

const SEED_DOCUMENTS = [
  {
    id: "welcome",
    owner: "alex@papertrail.dev",
    title: "Welcome to Papertrail",
    excerpt: "A calmer place for shared work. This is your shared workspace: create a document, import a Word, Markdown, or text file…",
    content: {
      type: "doc",
      content: [
        heading(1, "A calmer place for shared work"),
        paragraph(
          text("This is your shared workspace: create a document, import a Word, Markdown, or text file, or "),
          text("share a draft", ["bold"]),
          text(" with a teammate."),
        ),
        heading(2, "A quick tour"),
        list("bulletList", [
          "Use the toolbar (or Ctrl/Cmd+B, I, U) to format your writing.",
          "Click Share to give a teammate view or edit access.",
          "Changes save automatically as you type.",
        ]),
        paragraph(text("Start writing whenever you're ready.", ["italic"])),
      ],
    },
    shares: [
      { email: "jordan@papertrail.dev", role: "EDITOR" },
      { email: "sam@papertrail.dev", role: "VIEWER" },
    ],
  },
  {
    id: "design-review",
    owner: "jordan@papertrail.dev",
    title: "Design review notes",
    excerpt: "Design review notes. Jordan owns this document and shared it with Alex as view only…",
    content: {
      type: "doc",
      content: [
        heading(1, "Design review notes"),
        paragraph(
          text("Jordan owns this document and shared it with Alex as "),
          text("view only", ["bold"]),
          text(". Alex can read it but not change it."),
        ),
        heading(2, "Open questions"),
        list("orderedList", ["Should the dashboard group documents by owner?", "Do viewers need comments?"]),
      ],
    },
    shares: [{ email: "alex@papertrail.dev", role: "VIEWER" }],
  },
  {
    id: "research-notes",
    owner: "sam@papertrail.dev",
    title: "Private research notes",
    excerpt: "Sam's private notes. Nobody else has access, so opening this URL as Alex or Jordan returns not found.",
    content: {
      type: "doc",
      content: [
        heading(1, "Private research notes"),
        paragraph(text("Nobody else has access, so opening this URL as Alex or Jordan returns "), text("not found", ["underline"]), text(".")),
      ],
    },
    shares: [],
  },
] as const;

/** Idempotent: safe to run repeatedly; it never overwrites documents or passwords that already exist. */
export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const userIds = new Map<string, string>();
  for (const user of DEMO_USERS) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      create: { ...user, passwordHash },
      update: { name: user.name },
      select: { id: true },
    });
    userIds.set(user.email, record.id);
  }

  const now = Date.now();
  for (const [index, document] of SEED_DOCUMENTS.entries()) {
    const ownerId = userIds.get(document.owner)!;
    const timestamp = new Date(now - index * 60_000);
    await prisma.document.upsert({
      where: { id: document.id },
      create: {
        id: document.id,
        title: document.title,
        excerpt: document.excerpt,
        content: document.content,
        ownerId,
        updatedById: ownerId,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      update: {},
    });
    for (const share of document.shares) {
      const userId = userIds.get(share.email)!;
      await prisma.documentShare.upsert({
        where: { documentId_userId: { documentId: document.id, userId } },
        create: { documentId: document.id, userId, role: share.role },
        update: {},
      });
    }
  }
}
