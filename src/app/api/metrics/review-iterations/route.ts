import { NextRequest, NextResponse } from "next/server";
import { getReviewIterationsTrend } from "@/lib/metrics/review-iterations";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const reviewIterationsTrend = await getReviewIterationsTrend(startDate, endDate);

  return NextResponse.json({ reviewIterationsTrend });
}
