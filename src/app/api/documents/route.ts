import { NextResponse } from "next/server";
import { authedRoute, readJson } from "@/lib/http";
import { createDocumentSchema } from "@/lib/validation";
import { createDocument, listDocuments } from "@/server/documents";

export const GET = authedRoute(async (_request, _context, user) => {
  return NextResponse.json({ documents: await listDocuments(user) });
});

export const POST = authedRoute(async (request, _context, user) => {
  const { title } = await readJson(request, createDocumentSchema);
  return NextResponse.json({ document: await createDocument(user, { title }) }, { status: 201 });
});
