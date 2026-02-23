import { eq, and } from "drizzle-orm";
import { getDb } from "./index";
import { repos, workspaceSettings } from "./schema";

export async function getWorkspaceRepoIds(workspaceId: number): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({ id: repos.id })
    .from(repos)
    .where(eq(repos.workspaceId, workspaceId));
  return rows.map((r) => r.id);
}

export async function getWorkspaceSetting(workspaceId: number, key: string): Promise<string | null> {
  const db = getDb();
  const rows = await db
    .select({ value: workspaceSettings.value })
    .from(workspaceSettings)
    .where(
      and(
        eq(workspaceSettings.workspaceId, workspaceId),
        eq(workspaceSettings.key, key),
      ),
    );
  return rows[0]?.value ?? null;
}

export async function setWorkspaceSetting(workspaceId: number, key: string, value: string | null): Promise<void> {
  const db = getDb();
  const existing = await db
    .select({ workspaceId: workspaceSettings.workspaceId })
    .from(workspaceSettings)
    .where(
      and(
        eq(workspaceSettings.workspaceId, workspaceId),
        eq(workspaceSettings.key, key),
      ),
    );

  if (existing.length > 0) {
    await db
      .update(workspaceSettings)
      .set({ value })
      .where(
        and(
          eq(workspaceSettings.workspaceId, workspaceId),
          eq(workspaceSettings.key, key),
        ),
      );
  } else {
    await db.insert(workspaceSettings).values({ workspaceId, key, value });
  }
}
