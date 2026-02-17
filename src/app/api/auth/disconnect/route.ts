import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";

export async function POST() {
  const db = getDb();

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (clientId && clientSecret) {
    const stored = await db.select().from(settings).where(eq(settings.key, "github_pat"));
    const token = stored[0]?.value;

    if (token) {
      try {
        await fetch(`https://api.github.com/applications/${clientId}/grant`, {
          method: "DELETE",
          headers: {
            Authorization: "Basic " + btoa(`${clientId}:${clientSecret}`),
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: token }),
        });
      } catch {
        // best-effort revocation
      }
    }
  }

  await db.delete(settings).where(inArray(settings.key, ["github_pat", "github_login"]));

  return NextResponse.json({ disconnected: true });
}
