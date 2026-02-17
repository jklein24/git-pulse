import { NextRequest, NextResponse } from "next/server";
import { getLinesPerPerson, getLinesPerPR } from "@/lib/metrics/lines";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const [linesPerPerson, linesPerPR] = await Promise.all([
    getLinesPerPerson(startDate, endDate),
    getLinesPerPR(startDate, endDate),
  ]);

  return NextResponse.json({ linesPerPerson, linesPerPR });
}
