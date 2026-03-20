import { sql, and, gte, lte, eq } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, users } from "../db/schema";

interface AuthorMonth {
  login: string;
  prCount: number;
  lines: number;
}

async function getPerAuthorMonthly(startDate: number, endDate: number) {
  const db = getDb();
  return db
    .select({
      month: sql<string>`strftime('%Y-%m', datetime(${pullRequests.mergedAt}, 'unixepoch'))`.as("month"),
      login: users.githubLogin,
      prCount: sql<number>`count(*)`.as("pr_count"),
      lines: sql<number>`sum(coalesce(${pullRequests.filteredAdditions}, 0) + coalesce(${pullRequests.filteredDeletions}, 0))`.as("lines"),
    })
    .from(pullRequests)
    .innerJoin(users, eq(pullRequests.authorId, users.id))
    .where(and(
      eq(pullRequests.state, "MERGED"),
      gte(pullRequests.mergedAt, startDate),
      lte(pullRequests.mergedAt, endDate),
    ))
    .groupBy(sql`month`, users.githubLogin)
    .orderBy(sql`month`);
}

function groupByMonth(rows: { month: string; login: string; prCount: number; lines: number }[]) {
  const map = new Map<string, AuthorMonth[]>();
  for (const r of rows) {
    if (!map.has(r.month)) map.set(r.month, []);
    map.get(r.month)!.push({ login: r.login, prCount: r.prCount, lines: r.lines });
  }
  return map;
}

export async function getProductivityDistribution(startDate: number, endDate: number) {
  const rows = await getPerAuthorMonthly(startDate, endDate);
  const byMonth = groupByMonth(rows);
  const months = [...byMonth.keys()].sort();

  const concentration = months.map(month => {
    const people = byMonth.get(month)!;
    const n = people.length;
    const totalPrs = people.reduce((s, p) => s + p.prCount, 0);
    const totalLines = people.reduce((s, p) => s + p.lines, 0);
    if (n === 0 || totalPrs === 0) return null;

    const byPrs = [...people].sort((a, b) => b.prCount - a.prCount);
    const byLines = [...people].sort((a, b) => b.lines - a.lines);

    function topShare(sorted: AuthorMonth[], pct: number, getter: (p: AuthorMonth) => number, total: number) {
      const count = Math.max(1, Math.ceil(n * pct));
      return total > 0 ? Math.round((sorted.slice(0, count).reduce((s, p) => s + getter(p), 0) / total) * 100) : 0;
    }

    return {
      month,
      contributors: n,
      top20PctPrShare: topShare(byPrs, 0.2, p => p.prCount, totalPrs),
      top30PctPrShare: topShare(byPrs, 0.3, p => p.prCount, totalPrs),
      top50PctPrShare: topShare(byPrs, 0.5, p => p.prCount, totalPrs),
      top20PctLineShare: topShare(byLines, 0.2, p => p.lines, totalLines),
      top30PctLineShare: topShare(byLines, 0.3, p => p.lines, totalLines),
      top50PctLineShare: topShare(byLines, 0.5, p => p.lines, totalLines),
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  const monthPrMap = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!monthPrMap.has(r.month)) monthPrMap.set(r.month, new Map());
    monthPrMap.get(r.month)!.set(r.login, r.prCount);
  }

  const movement = [];
  for (let i = 1; i < months.length; i++) {
    const prev = monthPrMap.get(months[i - 1])!;
    const curr = monthPrMap.get(months[i])!;

    let growing = 0, stable = 0, declining = 0, added = 0, inactive = 0;

    for (const [login, count] of curr) {
      const p = prev.get(login);
      if (p === undefined || p === 0) { added++; continue; }
      const diff = count - p;
      const pct = diff / p;
      if (diff >= 2 && pct >= 0.25) growing++;
      else if (diff <= -2 && pct <= -0.25) declining++;
      else stable++;
    }
    for (const [login, count] of prev) {
      if (!curr.has(login) && count > 0) inactive++;
    }

    movement.push({ month: months[i], growing, stable, declining, new: added, inactive });
  }

  return { concentration, movement };
}
