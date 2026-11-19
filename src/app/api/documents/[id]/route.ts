import { NextResponse } from "next/server";
import { authedRoute, readJson } from "@/lib/http";
import { updateDocumentSchema } from "@/lib/validation";
import { deleteDocument, getDocument, updateDocument } from "@/server/documents";

type Context = { params: Promise<{ id: string }> };

export const GET = authedRoute<Context>(async (_request, { params }, user) => {
  const { id } = await params;
  return NextResponse.json({ document: await getDocument(id, user) });
});

export const PATCH = authedRoute<Context>(async (request, { params }, user) => {
  const { id } = await params;
  const input = await readJson(request, updateDocumentSchema);
  return NextResponse.json({ document: await updateDocument(id, user, input) });
});

export const DELETE = authedRoute<Context>(async (_request, { params }, user) => {
  const { id } = await params;
  await deleteDocument(id, user);
  return new NextResponse(null, { status: 204 });
});
