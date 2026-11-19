import "server-only";
import { db } from "@/lib/db";
import { documentNotFound, forbidden } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";

export type DocumentRole = "OWNER" | "EDITOR" | "VIEWER";

const RANK: Record<DocumentRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export async function getDocumentRole(documentId: string, userId: string): Promise<DocumentRole | null> {
  if (documentId.length > 64) return null;
  const document = await db().document.findUnique({
    where: { id: documentId },
    select: { ownerId: true, shares: { where: { userId }, select: { role: true } } },
  });
  if (!document) return null;
  if (document.ownerId === userId) return "OWNER";
  return document.shares[0]?.role ?? null;
}

/**
 * The single authorization gate for document operations: resolves the caller's role and enforces the minimum
 * the operation needs (VIEWER to read, EDITOR to save, OWNER to share or delete).
 */
export async function requireDocumentRole(
  documentId: string,
  user: SessionUser,
  minimum: DocumentRole,
): Promise<DocumentRole> {
  const role = await getDocumentRole(documentId, user.id);
  if (!role) throw documentNotFound();
  if (RANK[role] < RANK[minimum]) {
    throw forbidden(
      minimum === "OWNER" ? "Only the document owner can do that." : "You have view-only access to this document.",
    );
  }
  return role;
}
