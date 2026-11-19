import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/components/editor/document-editor";
import { requireUser } from "@/lib/auth/current-user";
import { AppError } from "@/lib/errors";
import { getDocument } from "@/server/documents";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  let document;
  try {
    // The same authorization gate as the API: no access renders "not found", so URLs can't reveal documents.
    document = await getDocument(id, user);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
  // Keyed by role: if access changes (e.g. downgraded to viewer), a refresh remounts the editor read-only.
  return (
    <DocumentEditor
      key={`${document.id}:${document.role}`}
      initialDocument={document}
      currentUser={{ name: user.name, email: user.email }}
    />
  );
}
