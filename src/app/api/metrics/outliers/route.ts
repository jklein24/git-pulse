import { NextRequest, NextResponse } from "next/server";
import { getOutliers, getTrendOutliers } from "@/lib/metrics/outliers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const [outliers, trendOutliers] = await Promise.all([
    getOutliers(startDate, endDate),
    getTrendOutliers(endDate),
  ]);

  return NextResponse.json({ outliers, trendOutliers });
}
