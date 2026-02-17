import { NextResponse } from "next/server";
import { getOpenPRs } from "@/lib/metrics/open-prs";

export async function GET() {
  const openPRs = await getOpenPRs();

  return NextResponse.json({ openPRs });
}
