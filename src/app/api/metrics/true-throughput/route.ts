import { NextRequest, NextResponse } from "next/server";
import { computeAllScores, aggregateWeekly, aggregatePerPerson, aggregateDistribution } from "@/lib/metrics/true-throughput";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
    const endDate = Number(searchParams.get("endDate")) || now;

    const scored = await computeAllScores(auth.workspace.id, startDate, endDate);

    return NextResponse.json({
      weeklyTrend: aggregateWeekly(scored),
      perPerson: aggregatePerPerson(scored),
      distribution: aggregateDistribution(scored),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
