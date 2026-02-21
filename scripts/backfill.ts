import { getDb } from "../src/lib/db";
import { repos } from "../src/lib/db/schema";
import { syncRepo } from "../src/lib/github/sync";
import { eq } from "drizzle-orm";

const SKIP = new Set(["lightsparkdev/webdev"]);

async function main() {
  const db = getDb();
  const allRepos = await db.select().from(repos);
  const toBackfill = allRepos.filter((r) => !SKIP.has(r.fullName));

  console.log(`Backfilling ${toBackfill.length} repo(s): ${toBackfill.map((r) => r.fullName).join(", ")}`);

  for (const repo of toBackfill) {
    const originalLastSyncedAt = repo.lastSyncedAt;
    console.log(`\n--- ${repo.fullName} ---`);

    await db.update(repos).set({ lastSyncedAt: null }).where(eq(repos.id, repo.id));
    try {
      await syncRepo(repo.id, { backfill: true });
    } finally {
      const now = Math.floor(Date.now() / 1000);
      await db.update(repos).set({ lastSyncedAt: originalLastSyncedAt ?? now }).where(eq(repos.id, repo.id));
    }

    console.log(`--- ${repo.fullName} backfill complete ---`);
  }

  console.log("\nBackfill finished.");
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
