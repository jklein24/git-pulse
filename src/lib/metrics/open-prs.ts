import { sql, eq } from "drizzle-orm";
import { getDb } from "../db";
import { pullRequests, users, repos } from "../db/schema";

export interface OpenPR {
  number: number;
  title: string;
  url: string | null;
  repo: string;
  author: string;
  avatarUrl: string | null;
  isDraft: boolean;
  publishedAt: number | null;
  createdAt: number;
  ageSeconds: number;
  additions: number;
  deletions: number;
  ageBand: "green" | "yellow" | "orange" | "red";
}

export async function getOpenPRs(): Promise<OpenPR[]> {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const rows = await db
    .select({
      number: pullRequests.number,
      title: pullRequests.title,
      url: pullRequests.url,
      repo: repos.fullName,
      author: users.githubLogin,
      avatarUrl: users.avatarUrl,
      isDraft: pullRequests.isDraft,
      publishedAt: pullRequests.publishedAt,
      createdAt: pullRequests.createdAt,
      additions: pullRequests.filteredAdditions,
      deletions: pullRequests.filteredDeletions,
    })
    .from(pullRequests)
    .innerJoin(repos, eq(pullRequests.repoId, repos.id))
    .leftJoin(users, eq(pullRequests.authorId, users.id))
    .where(eq(pullRequests.state, "OPEN"))
    .orderBy(pullRequests.createdAt);

  return rows.map((r) => {
    const ageFrom = r.publishedAt || r.createdAt;
    const ageSeconds = now - ageFrom;
    const ageDays = ageSeconds / 86400;

    let ageBand: OpenPR["ageBand"] = "green";
    if (ageDays > 7) ageBand = "red";
    else if (ageDays > 3) ageBand = "orange";
    else if (ageDays > 1) ageBand = "yellow";

    return {
      number: r.number,
      title: r.title,
      url: r.url,
      repo: r.repo,
      author: r.author ?? "unknown",
      avatarUrl: r.avatarUrl,
      isDraft: r.isDraft,
      publishedAt: r.publishedAt,
      createdAt: r.createdAt,
      ageSeconds,
      additions: r.additions ?? 0,
      deletions: r.deletions ?? 0,
      ageBand,
    };
  });
}
