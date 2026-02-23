import { NextRequest, NextResponse } from "next/server";
import { getChurnRate } from "@/lib/metrics/churn";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
    const endDate = Number(searchParams.get("endDate")) || now;

    const churnRate = await getChurnRate(auth.workspace.id, startDate, endDate);

    return NextResponse.json({ churnRate });
  } catch (error) {
    return handleAuthError(error);
  }
}
