import { NextRequest, NextResponse } from "next/server";
import {
  getAiUsageVsThroughput,
  getAiVelocityImpact,
  getBeforeAfterComparison,
} from "@/lib/metrics/ai-impact";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
    const endDate = Number(searchParams.get("endDate")) || now;

    const [scatter, velocity, beforeAfter] = await Promise.all([
      getAiUsageVsThroughput(auth.workspace.id, startDate, endDate),
      getAiVelocityImpact(auth.workspace.id, startDate, endDate),
      getBeforeAfterComparison(auth.workspace.id, startDate, endDate),
    ]);

    return NextResponse.json({ scatter, velocity, beforeAfter });
  } catch (error) {
    return handleAuthError(error);
  }
}
