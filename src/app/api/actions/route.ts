import { NextRequest, NextResponse } from "next/server";
import { executeAction, getUserBySession, sessionCookieName } from "@/lib/server/database";
import { appActionSchema, validationMessage } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = getUserBySession(request.cookies.get(sessionCookieName)?.value);
    if (!user) return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
    const parsed = appActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: validationMessage(parsed.error) }, { status: 400 });
    }
    return NextResponse.json(executeAction(user.id, parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar dados.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
