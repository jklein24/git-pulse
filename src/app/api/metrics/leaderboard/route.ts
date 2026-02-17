import { NextRequest, NextResponse } from "next/server";
import { getPrsMergedPerPerson } from "@/lib/metrics/throughput";
import { getLinesPerPerson } from "@/lib/metrics/lines";
import { getReviewLoad } from "@/lib/metrics/review-load";
import { getMergeTimePerPerson } from "@/lib/metrics/merge-time";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const [prsMerged, lines, reviews, mergeTimes] = await Promise.all([
    getPrsMergedPerPerson(startDate, endDate),
    getLinesPerPerson(startDate, endDate),
    getReviewLoad(startDate, endDate),
    getMergeTimePerPerson(startDate, endDate),
  ]);

  const people: Record<string, {
    login: string;
    avatarUrl: string | null;
    prsMerged: number;
    linesAdded: number;
    linesDeleted: number;
    reviewCount: number;
    medianMergeTimeHours: number | null;
  }> = {};

  const ensure = (login: string, avatarUrl: string | null) => {
    if (!people[login]) {
      people[login] = {
        login,
        avatarUrl,
        prsMerged: 0,
        linesAdded: 0,
        linesDeleted: 0,
        reviewCount: 0,
        medianMergeTimeHours: null,
      };
    }
  };

  for (const row of prsMerged) {
    ensure(row.login, row.avatarUrl);
    people[row.login].prsMerged += row.count;
  }

  for (const row of lines) {
    ensure(row.login, row.avatarUrl);
    people[row.login].linesAdded = row.additions ?? 0;
    people[row.login].linesDeleted = row.deletions ?? 0;
  }

  for (const row of reviews) {
    ensure(row.login, row.avatarUrl);
    people[row.login].reviewCount = row.reviewCount;
  }

  for (const row of mergeTimes) {
    ensure(row.login, row.avatarUrl);
    people[row.login].medianMergeTimeHours = row.medianHours;
  }

  const leaderboard = Object.values(people).sort((a, b) => b.prsMerged - a.prsMerged);

  return NextResponse.json({ leaderboard });
}
