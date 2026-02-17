import { NextRequest, NextResponse } from "next/server";
import { getTeamThroughput, getPrsMergedPerPerson } from "@/lib/metrics/throughput";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const [teamThroughput, prsMergedPerPerson] = await Promise.all([
    getTeamThroughput(startDate, endDate),
    getPrsMergedPerPerson(startDate, endDate),
  ]);

  return NextResponse.json({ teamThroughput, prsMergedPerPerson });
}
