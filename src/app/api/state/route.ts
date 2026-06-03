import { NextRequest, NextResponse } from "next/server";
import { getAppState, getUserBySession, sessionCookieName } from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const user = getUserBySession(request.cookies.get(sessionCookieName)?.value);
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  return NextResponse.json({ state: getAppState(user.id), user });
}
