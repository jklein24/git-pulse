import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { repos, pullRequests, prFiles, prReviews, syncJobs } from "@/lib/db/schema";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const db = getDb();
    const allRepos = await db
      .select()
      .from(repos)
      .where(eq(repos.workspaceId, auth.workspace.id));
    return NextResponse.json(allRepos);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const db = getDb();
    const body = await request.json();
    const { owner, name } = body;

    if (!owner || !name) {
      return NextResponse.json({ error: "owner and name are required" }, { status: 400 });
    }

    const fullName = `${owner}/${name}`;
    const existing = (await db
      .select()
      .from(repos)
      .where(and(eq(repos.workspaceId, auth.workspace.id), eq(repos.fullName, fullName)))
    )[0];
    if (existing) {
      return NextResponse.json({ error: "Repo already added" }, { status: 409 });
    }

    const result = await db.insert(repos).values({
      workspaceId: auth.workspace.id,
      owner,
      name,
      fullName,
      addedAt: Math.floor(Date.now() / 1000),
    }).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const repoId = parseInt(id);

    const repo = (await db
      .select()
      .from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.workspaceId, auth.workspace.id)))
    )[0];
    if (!repo) {
      return NextResponse.json({ error: "Repo not found in workspace" }, { status: 404 });
    }

    const prIds = (await db.select({ id: pullRequests.id }).from(pullRequests).where(eq(pullRequests.repoId, repoId))).map((r) => r.id);

    if (prIds.length > 0) {
      await db.delete(prFiles).where(inArray(prFiles.prId, prIds));
      await db.delete(prReviews).where(inArray(prReviews.prId, prIds));
      await db.delete(pullRequests).where(eq(pullRequests.repoId, repoId));
    }
    await db.delete(syncJobs).where(eq(syncJobs.repoId, repoId));
    await db.delete(repos).where(eq(repos.id, repoId));

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
