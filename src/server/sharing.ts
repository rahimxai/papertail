import "server-only";
import { db } from "@/lib/db";
import { AppError, badRequest } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import { requireDocumentRole } from "./access";

export type ShareRole = "VIEWER" | "EDITOR";
export type Person = { id: string; name: string; email: string };
export type Collaborators = {
  owner: Person;
  shares: (Person & { role: ShareRole })[];
  canManage: boolean;
};

const shareNotFound = () => new AppError(404, "NOT_FOUND", "That person doesn't have access to this document.");

/** Everyone with access can see who else has it; only the owner can change it. */
export async function listCollaborators(documentId: string, user: SessionUser): Promise<Collaborators> {
  const role = await requireDocumentRole(documentId, user, "VIEWER");
  const document = await db().document.findUniqueOrThrow({
    where: { id: documentId },
    select: {
      owner: { select: { id: true, name: true, email: true } },
      shares: {
        orderBy: { createdAt: "asc" },
        select: { role: true, user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  return {
    owner: document.owner,
    shares: document.shares.map((share) => ({ ...share.user, role: share.role })),
    canManage: role === "OWNER",
  };
}

/** Grants access by email. Sharing with someone who already has access changes their role instead. */
export async function shareDocument(
  documentId: string,
  user: SessionUser,
  input: { email: string; role: ShareRole },
): Promise<{ created: boolean; person: Person }> {
  await requireDocumentRole(documentId, user, "OWNER");
  const recipient = await db().user.findUnique({
    where: { email: input.email },
    select: { id: true, name: true, email: true },
  });
  if (!recipient) {
    throw new AppError(404, "USER_NOT_FOUND", `No Papertrail account uses ${input.email}.`);
  }
  if (recipient.id === user.id) throw badRequest("You already own this document.");

  const existing = await db().documentShare.findUnique({
    where: { documentId_userId: { documentId, userId: recipient.id } },
    select: { role: true },
  });
  await db().documentShare.upsert({
    where: { documentId_userId: { documentId, userId: recipient.id } },
    create: { documentId, userId: recipient.id, role: input.role },
    update: { role: input.role },
  });
  return { created: !existing, person: recipient };
}

export async function updateShareRole(documentId: string, user: SessionUser, userId: string, role: ShareRole) {
  await requireDocumentRole(documentId, user, "OWNER");
  const { count } = await db().documentShare.updateMany({ where: { documentId, userId }, data: { role } });
  if (count === 0) throw shareNotFound();
}

export async function revokeShare(documentId: string, user: SessionUser, userId: string) {
  await requireDocumentRole(documentId, user, "OWNER");
  const { count } = await db().documentShare.deleteMany({ where: { documentId, userId } });
  if (count === 0) throw shareNotFound();
}

/** People the user can share with (every other account; this is a small demo workspace). */
export async function listShareCandidates(user: SessionUser): Promise<Person[]> {
  return db().user.findMany({
    where: { id: { not: user.id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
}
