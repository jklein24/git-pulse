import { eq, and, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../db";
import { sessions, appUsers } from "../db/schema";

const SESSION_COOKIE = "session";
const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60; // 30 days

function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(userId: number): Promise<string> {
  const db = getDb();
  const id = generateSessionId();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(sessions).values({
    id,
    userId,
    expiresAt: now + SESSION_DURATION_SECONDS,
    createdAt: now,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
  });

  return id;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .select({
      sessionId: sessions.id,
      userId: appUsers.id,
      githubId: appUsers.githubId,
      githubLogin: appUsers.githubLogin,
      displayName: appUsers.displayName,
      avatarUrl: appUsers.avatarUrl,
      email: appUsers.email,
    })
    .from(sessions)
    .innerJoin(appUsers, eq(sessions.userId, appUsers.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)));

  return result[0] ?? null;
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return;

  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));

  cookieStore.delete(SESSION_COOKIE);
}
