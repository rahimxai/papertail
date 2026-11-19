import { NextResponse } from "next/server";
import { authedRoute, readJson } from "@/lib/http";
import { updateShareSchema } from "@/lib/validation";
import { revokeShare, updateShareRole } from "@/server/sharing";

type Context = { params: Promise<{ id: string; userId: string }> };

export const PATCH = authedRoute<Context>(async (request, { params }, user) => {
  const { id, userId } = await params;
  const { role } = await readJson(request, updateShareSchema);
  await updateShareRole(id, user, userId, role);
  return NextResponse.json({ ok: true });
});

export const DELETE = authedRoute<Context>(async (_request, { params }, user) => {
  const { id, userId } = await params;
  await revokeShare(id, user, userId);
  return new NextResponse(null, { status: 204 });
});
