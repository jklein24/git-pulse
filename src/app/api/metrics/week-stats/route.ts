import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pullRequests } from "@/lib/db/schema";
import { computeAllScores, aggregateWeekly } from "@/lib/metrics/true-throughput";
import { formatDate } from "@/lib/metrics/utils";

const WEEK = 604800;
const TT_LOOKBACK_WEEKS = 25;

interface Stat {
  value: number;
  delta: number | null;
}

async function prAndLocForWeek(weekStart: number): Promise<{ prsMerged: number; loc: number }> {
  const db = getDb();
  const row = await db
    .select({
      prsMerged: sql<number>`count(*)`.as("prs_merged"),
      loc: sql<number>`coalesce(sum(${pullRequests.filteredAdditions} + ${pullRequests.filteredDeletions}), 0)`.as("loc"),
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        gte(pullRequests.mergedAt, weekStart),
        lt(pullRequests.mergedAt, weekStart + WEEK),
      ),
    )
    .get();

  return { prsMerged: row?.prsMerged ?? 0, loc: row?.loc ?? 0 };
}

// delta is null when the prior week has no baseline PRs, so we don't render a
// misleading jump for the earliest synced week.
function makeStat(value: number, priorValue: number, priorHasBaseline: boolean): Stat {
  return { value, delta: priorHasBaseline ? value - priorValue : null };
}

export async function GET(request: NextRequest) {
  const weekStart = Number(new URL(request.url).searchParams.get("weekStart"));
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }

  const priorWeekStart = weekStart - WEEK;

  const [current, prior] = await Promise.all([
    prAndLocForWeek(weekStart),
    prAndLocForWeek(priorWeekStart),
  ]);

  // A wide, week-anchored lookback keeps the TrueThroughput normalization divisor
  // stable so the number is comparable to the Trends page and deterministic per week.
  const scored = await computeAllScores(weekStart - TT_LOOKBACK_WEEKS * WEEK, weekStart + WEEK);
  const weekly = aggregateWeekly(scored);
  const ttByWeek = new Map(weekly.map((w) => [w.week, w.trueThroughput]));
  const currentTT = Math.round(ttByWeek.get(formatDate(weekStart)) ?? 0);
  const priorTT = Math.round(ttByWeek.get(formatDate(priorWeekStart)) ?? 0);

  const priorHasBaseline = prior.prsMerged > 0;

  return NextResponse.json({
    prsMerged: makeStat(current.prsMerged, prior.prsMerged, priorHasBaseline),
    loc: makeStat(current.loc, prior.loc, priorHasBaseline),
    trueThroughput: makeStat(currentTT, priorTT, priorHasBaseline),
  });
}
