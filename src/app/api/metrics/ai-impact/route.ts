import { NextRequest, NextResponse } from "next/server";
import {
  getAiUsageVsThroughput,
  getAiVelocityImpact,
  getBeforeAfterComparison,
} from "@/lib/metrics/ai-impact";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const [scatter, velocity, beforeAfter] = await Promise.all([
    getAiUsageVsThroughput(startDate, endDate),
    getAiVelocityImpact(startDate, endDate),
    getBeforeAfterComparison(startDate, endDate),
  ]);

  return NextResponse.json({ scatter, velocity, beforeAfter });
}
