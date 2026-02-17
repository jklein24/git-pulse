import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { repos, pullRequests, prFiles, prReviews, syncJobs } from "@/lib/db/schema";

export async function GET() {
  const db = getDb();
  const allRepos = await db.select().from(repos);
  return NextResponse.json(allRepos);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { owner, name } = body;

  if (!owner || !name) {
    return NextResponse.json({ error: "owner and name are required" }, { status: 400 });
  }

  const fullName = `${owner}/${name}`;
  const existing = await db.select().from(repos).where(eq(repos.fullName, fullName)).get();
  if (existing) {
    return NextResponse.json({ error: "Repo already added" }, { status: 409 });
  }

  const result = await db.insert(repos).values({
    owner,
    name,
    fullName,
    addedAt: Math.floor(Date.now() / 1000),
  }).returning();

  return NextResponse.json(result[0], { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const repoId = parseInt(id);
  const prIds = (await db.select({ id: pullRequests.id }).from(pullRequests).where(eq(pullRequests.repoId, repoId))).map((r) => r.id);

  if (prIds.length > 0) {
    await db.delete(prFiles).where(inArray(prFiles.prId, prIds));
    await db.delete(prReviews).where(inArray(prReviews.prId, prIds));
    await db.delete(pullRequests).where(eq(pullRequests.repoId, repoId));
  }
  await db.delete(syncJobs).where(eq(syncJobs.repoId, repoId));
  await db.delete(repos).where(eq(repos.id, repoId));

  return NextResponse.json({ deleted: true });
}
