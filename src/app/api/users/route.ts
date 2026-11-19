import { NextResponse } from "next/server";
import { authedRoute } from "@/lib/http";
import { listShareCandidates } from "@/server/sharing";

export const GET = authedRoute(async (_request, _context, user) => {
  return NextResponse.json({ users: await listShareCandidates(user) });
});
