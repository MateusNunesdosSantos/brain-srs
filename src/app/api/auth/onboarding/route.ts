import { NextRequest, NextResponse } from "next/server";
import {
  completeOnboarding,
  getUserBySession,
  sessionCookieName,
} from "@/lib/server/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  const user = getUserBySession(request.cookies.get(sessionCookieName)?.value);
  if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  return NextResponse.json({ user: completeOnboarding(user.id) });
}
