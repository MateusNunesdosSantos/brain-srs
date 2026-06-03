import { NextRequest, NextResponse } from "next/server";
import { loginUser, sessionCookieName } from "@/lib/server/database";
import { loginSchema, validationMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: validationMessage(parsed.error) }, { status: 400 });
    }
    const result = loginUser(parsed.data.email, parsed.data.password);
    const response = NextResponse.json({ user: result.user, state: result.state });
    response.cookies.set(sessionCookieName, result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: result.session.expiresAt,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao entrar.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
