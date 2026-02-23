import { NextRequest, NextResponse } from "next/server";
import { getOpenPRs } from "@/lib/metrics/open-prs";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const openPRs = await getOpenPRs(auth.workspace.id);

    return NextResponse.json({ openPRs });
  } catch (error) {
    return handleAuthError(error);
  }
}
