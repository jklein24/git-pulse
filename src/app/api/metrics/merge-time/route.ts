import { NextRequest, NextResponse } from "next/server";
import { getMergeTimePerPerson, getMergeTimeTrend, getMergeTimeBySize } from "@/lib/metrics/merge-time";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const [mergeTimePerPerson, mergeTimeTrend, mergeTimeBySize] = await Promise.all([
    getMergeTimePerPerson(startDate, endDate),
    getMergeTimeTrend(startDate, endDate),
    getMergeTimeBySize(startDate, endDate),
  ]);

  return NextResponse.json({ mergeTimePerPerson, mergeTimeTrend, mergeTimeBySize });
}
