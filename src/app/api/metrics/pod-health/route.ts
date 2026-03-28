import { NextRequest, NextResponse } from "next/server";
import { getPodHealth, getPodThroughputTrend } from "@/lib/metrics/pods";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const [health, trend] = await Promise.all([
    getPodHealth(startDate, endDate),
    getPodThroughputTrend(startDate, endDate),
  ]);

  return NextResponse.json({ podHealth: health, podThroughputTrend: trend });
}
