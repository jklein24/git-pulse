import { NextResponse } from "next/server";
import { getActiveEpics } from "@/lib/metrics/tickets";

export async function GET() {
  const epics = await getActiveEpics(100);
  return NextResponse.json({ epics });
}
