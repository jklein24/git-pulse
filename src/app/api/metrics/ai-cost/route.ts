import { NextRequest, NextResponse } from "next/server";
import { getCostTrend, getCostByModel } from "@/lib/metrics/ai-cost";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const [costTrend, costByModel] = await Promise.all([
    getCostTrend(startDate, endDate),
    getCostByModel(startDate, endDate),
  ]);

  return NextResponse.json({ costTrend, costByModel });
}
