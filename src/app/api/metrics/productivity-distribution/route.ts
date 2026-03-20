import { NextRequest, NextResponse } from "next/server";
import { getProductivityDistribution } from "@/lib/metrics/productivity-distribution";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const data = await getProductivityDistribution(startDate, endDate);
  return NextResponse.json(data);
}
