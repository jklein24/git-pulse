import { NextRequest, NextResponse } from "next/server";
import { getLinesPerPerson, getLinesPerPR } from "@/lib/metrics/lines";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
    const endDate = Number(searchParams.get("endDate")) || now;

    const [linesPerPerson, linesPerPR] = await Promise.all([
      getLinesPerPerson(auth.workspace.id, startDate, endDate),
      getLinesPerPR(auth.workspace.id, startDate, endDate),
    ]);

    return NextResponse.json({ linesPerPerson, linesPerPR });
  } catch (error) {
    return handleAuthError(error);
  }
}
