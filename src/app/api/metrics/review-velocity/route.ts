import { NextRequest, NextResponse } from "next/server";
import { getReviewVelocityTrend } from "@/lib/metrics/review-velocity";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
    const endDate = Number(searchParams.get("endDate")) || now;

    const reviewVelocityTrend = await getReviewVelocityTrend(auth.workspace.id, startDate, endDate);

    return NextResponse.json({ reviewVelocityTrend });
  } catch (error) {
    return handleAuthError(error);
  }
}
