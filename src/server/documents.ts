import "server-only";
import type { JSONContent } from "@tiptap/core";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { AppError, documentNotFound } from "@/lib/errors";
import { EMPTY_DOCUMENT } from "@/lib/editor/extensions";
import { validateDocumentContent } from "@/lib/editor/content";
import type { SessionUser } from "@/lib/auth/session";
import { requireDocumentRole, type DocumentRole } from "./access";

export type DocumentListItem = {
  id: string;
  title: string;
  excerpt: string;
  version: number;
  role: DocumentRole;
  ownerName: string;
  updatedAt: string;
  updatedByName: string | null;
  sharedWithCount: number;
};

export type DocumentDetail = DocumentListItem & { content: JSONContent; createdAt: string };

const detailSelect = {
  id: true,
  title: true,
  excerpt: true,
  version: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  ownerId: true,
  owner: { select: { name: true } },
  updatedBy: { select: { name: true } },
  _count: { select: { shares: true } },
} satisfies Prisma.DocumentSelect;

type DetailRow = Prisma.DocumentGetPayload<{ select: typeof detailSelect }>;

function toDetail(row: DetailRow, role: DocumentRole): DocumentDetail {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    version: row.version,
    role,
    ownerName: row.owner.name,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedBy?.name ?? null,
    sharedWithCount: row._count.shares,
    content: row.content as JSONContent,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Every document the user owns or has been granted, most recently edited first. */
export async function listDocuments(user: SessionUser): Promise<DocumentListItem[]> {
  const rows = await db().document.findMany({
    where: { OR: [{ ownerId: user.id }, { shares: { some: { userId: user.id } } }] },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      excerpt: true,
      version: true,
      updatedAt: true,
      ownerId: true,
      owner: { select: { name: true } },
      updatedBy: { select: { name: true } },
      shares: { where: { userId: user.id }, select: { role: true } },
      _count: { select: { shares: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    version: row.version,
    role: row.ownerId === user.id ? "OWNER" : (row.shares[0]?.role ?? "VIEWER"),
    ownerName: row.owner.name,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedBy?.name ?? null,
    sharedWithCount: row._count.shares,
  }));
}

export async function getDocument(documentId: string, user: SessionUser): Promise<DocumentDetail> {
  const role = await requireDocumentRole(documentId, user, "VIEWER");
  const row = await db().document.findUnique({ where: { id: documentId }, select: detailSelect });
  if (!row) throw documentNotFound();
  return toDetail(row, role);
}

export async function createDocument(
  user: SessionUser,
  input: { title?: string; content?: JSONContent } = {},
): Promise<DocumentDetail> {
  const { json, excerpt } = validateDocumentContent(input.content ?? EMPTY_DOCUMENT);
  const row = await db().document.create({
    data: {
      title: input.title ?? "Untitled document",
      content: json as Prisma.InputJsonValue,
      excerpt,
      ownerId: user.id,
      updatedById: user.id,
    },
    select: detailSelect,
  });
  return toDetail(row, "OWNER");
}

/**
 * Saves a title and/or content change. `baseVersion` is the version the client last loaded: the write only
 * applies if nobody else saved in between; otherwise it throws 409 with the current document, so the client
 * can let the user choose instead of silently overwriting someone else's work.
 */
export async function updateDocument(
  documentId: string,
  user: SessionUser,
  input: { baseVersion: number; title?: string; content?: unknown },
): Promise<DocumentDetail> {
  const role = await requireDocumentRole(documentId, user, "EDITOR");
  const content = input.content === undefined ? undefined : validateDocumentContent(input.content);
  const { count } = await db().document.updateMany({
    where: { id: documentId, version: input.baseVersion },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(content && { content: content.json as Prisma.InputJsonValue, excerpt: content.excerpt }),
      version: { increment: 1 },
      updatedAt: new Date(),
      updatedById: user.id,
    },
  });
  const row = await db().document.findUnique({ where: { id: documentId }, select: detailSelect });
  if (!row) throw documentNotFound();
  const current = toDetail(row, role);
  if (count === 0) {
    const who = current.updatedByName ?? "Someone";
    throw new AppError(409, "CONFLICT", `${who} saved a newer version of this document while you were editing.`, {
      document: current,
    });
  }
  return current;
}

export async function deleteDocument(documentId: string, user: SessionUser): Promise<void> {
  await requireDocumentRole(documentId, user, "OWNER");
  // Shares and import records are removed by ON DELETE CASCADE.
  await db().document.delete({ where: { id: documentId } });
}
