import { NextRequest, NextResponse } from "next/server";
import { computeAllScores, aggregateWeekly, aggregatePerPerson, aggregateDistribution } from "@/lib/metrics/true-throughput";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const scored = await computeAllScores(startDate, endDate);

  return NextResponse.json({
    weeklyTrend: aggregateWeekly(scored),
    perPerson: aggregatePerPerson(scored),
    distribution: aggregateDistribution(scored),
  });
}
