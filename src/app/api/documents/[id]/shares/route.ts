import { NextResponse } from "next/server";
import { authedRoute, readJson } from "@/lib/http";
import { shareSchema } from "@/lib/validation";
import { listCollaborators, shareDocument } from "@/server/sharing";

type Context = { params: Promise<{ id: string }> };

export const GET = authedRoute<Context>(async (_request, { params }, user) => {
  const { id } = await params;
  return NextResponse.json(await listCollaborators(id, user));
});

export const POST = authedRoute<Context>(async (request, { params }, user) => {
  const { id } = await params;
  const input = await readJson(request, shareSchema);
  const result = await shareDocument(id, user, input);
  return NextResponse.json(result, { status: result.created ? 201 : 200 });
});
