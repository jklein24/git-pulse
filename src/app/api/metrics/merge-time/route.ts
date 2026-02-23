import { NextRequest, NextResponse } from "next/server";
import { getMergeTimePerPerson, getMergeTimeTrend, getMergeTimeBySize } from "@/lib/metrics/merge-time";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
    const endDate = Number(searchParams.get("endDate")) || now;

    const [mergeTimePerPerson, mergeTimeTrend, mergeTimeBySize] = await Promise.all([
      getMergeTimePerPerson(auth.workspace.id, startDate, endDate),
      getMergeTimeTrend(auth.workspace.id, startDate, endDate),
      getMergeTimeBySize(auth.workspace.id, startDate, endDate),
    ]);

    return NextResponse.json({ mergeTimePerPerson, mergeTimeTrend, mergeTimeBySize });
  } catch (error) {
    return handleAuthError(error);
  }
}
