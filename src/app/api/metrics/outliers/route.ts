import { NextRequest, NextResponse } from "next/server";
import { getOutliers, getTrendOutliers } from "@/lib/metrics/outliers";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
    const endDate = Number(searchParams.get("endDate")) || now;

    const [outliers, trendOutliers] = await Promise.all([
      getOutliers(auth.workspace.id, startDate, endDate),
      getTrendOutliers(auth.workspace.id, endDate),
    ]);

    return NextResponse.json({ outliers, trendOutliers });
  } catch (error) {
    return handleAuthError(error);
  }
}
