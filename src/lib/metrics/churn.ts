import { sql, and, gte, lte, eq, ne, isNotNull } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, prFiles, settings } from "../db/schema";
import { formatDate } from "./utils";

async function getChurnWindowDays(): Promise<number> {
  const db = getDb();
  const row = await db.select().from(settings).where(eq(settings.key, "churn_window_days")).get();
  return row?.value ? parseInt(row.value) : 14;
}

export async function getChurnRate(startDate: number, endDate: number) {
  const db = getDb();
  const windowDays = await getChurnWindowDays();
  const windowSec = windowDays * 86400;

  const mergedPRs = await db
    .select({
      prId: pullRequests.id,
      mergedAt: pullRequests.mergedAt,
    })
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.state, "MERGED"),
        isNotNull(pullRequests.mergedAt),
        gte(pullRequests.mergedAt, startDate),
        lte(pullRequests.mergedAt, endDate),
      ),
    )
    .orderBy(pullRequests.mergedAt);

  const prIds = mergedPRs.map((p) => p.prId);
  if (prIds.length === 0) return [];

  const files = await db
    .select({
      prId: prFiles.prId,
      filename: prFiles.filename,
      additions: prFiles.additions,
      deletions: prFiles.deletions,
      isExcluded: prFiles.isExcluded,
    })
    .from(prFiles)
    .where(eq(prFiles.isExcluded, false));

  const filesByPr: Record<number, Array<{ filename: string; additions: number; deletions: number }>> = {};
  for (const f of files) {
    if (!filesByPr[f.prId]) filesByPr[f.prId] = [];
    filesByPr[f.prId].push({
      filename: f.filename,
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
    });
  }

  const prLookup = new Map(mergedPRs.map((p) => [p.prId, p.mergedAt!]));

  const byWeek: Record<number, { churned: number; total: number }> = {};

  for (let i = 0; i < mergedPRs.length; i++) {
    const pr = mergedPRs[i];
    const prFileList = filesByPr[pr.prId] || [];
    const week = pr.mergedAt! - (pr.mergedAt! % 604800);

    if (!byWeek[week]) byWeek[week] = { churned: 0, total: 0 };

    for (const file of prFileList) {
      byWeek[week].total += file.additions;

      for (let j = i + 1; j < mergedPRs.length; j++) {
        const laterPr = mergedPRs[j];
        if (laterPr.mergedAt! - pr.mergedAt! > windowSec) break;

        const laterFiles = filesByPr[laterPr.prId] || [];
        const overlap = laterFiles.find((f) => f.filename === file.filename);
        if (overlap) {
          byWeek[week].churned += Math.min(file.additions, overlap.additions + overlap.deletions);
          break;
        }
      }
    }
  }

  return Object.entries(byWeek)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([week, data]) => ({
      week: formatDate(Number(week)),
      rate: data.total > 0 ? Math.round((data.churned / data.total) * 1000) / 10 : 0,
      churnedLines: data.churned,
      totalLines: data.total,
    }));
}
