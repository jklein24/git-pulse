import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import {
  getTicketThroughput,
  getProjectThroughputTrend,
  getStatusSnapshot,
  getEpicProgress,
  getTicketCycleTime,
  getTicketDataQuality,
} from "@/lib/metrics/tickets";

function parseEpicKeys(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const db = getDb();
  const [excludedRow, starredRow] = await Promise.all([
    db.select().from(settings).where(eq(settings.key, "jira_excluded_epics")).get(),
    db.select().from(settings).where(eq(settings.key, "jira_starred_epics")).get(),
  ]);
  const excludedEpicKeys = parseEpicKeys(excludedRow?.value);
  const starredEpicKeys = parseEpicKeys(starredRow?.value);

  const [totalThroughput, projectThroughput, statusSnapshot, epics, cycleTime, dataQuality] = await Promise.all([
    getTicketThroughput(startDate, endDate),
    getProjectThroughputTrend(startDate, endDate),
    getStatusSnapshot(),
    getEpicProgress(excludedEpicKeys, starredEpicKeys),
    getTicketCycleTime(startDate, endDate),
    getTicketDataQuality(startDate, endDate),
  ]);

  return NextResponse.json({
    totalThroughput,
    projectThroughput,
    statusSnapshot,
    epics,
    excludedEpicKeys,
    starredEpicKeys,
    cycleTime,
    dataQuality,
  });
}
