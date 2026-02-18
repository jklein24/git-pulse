import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  const { weekStart, force } = await request.json();
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }

  const db = getDb();
  const cacheKey = `week_summary_${weekStart}`;

  if (!force) {
    const cached = await db.select().from(settings).where(eq(settings.key, cacheKey));
    if (cached.length > 0 && cached[0].value) {
      return NextResponse.json({ summary: cached[0].value, cached: true });
    }
  }

  const weekDetailUrl = new URL(`/api/metrics/week-detail?weekStart=${weekStart}`, request.url);
  const weekData = await fetch(weekDetailUrl).then(r => r.json());

  const weekLabel = new Date(weekStart * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const prSummaries = (weekData.prs || []).map((pr: Record<string, unknown>) =>
    `- "${pr.title}" by ${pr.authorLogin} in ${pr.repoFullName} (+${pr.filteredAdditions ?? 0}/-${pr.filteredDeletions ?? 0})`
  ).join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: "You are a concise engineering manager writing a weekly PR summary for your team. Be specific and brief. Use markdown bullet points. Bold key names, repos, and metrics.",
      messages: [{
        role: "user",
        content: `Write a brief weekly engineering summary for the week of ${weekLabel}.

Here are the ${weekData.prs?.length ?? 0} PRs merged this week:
${prSummaries}

Format your response as:
- A one-sentence overall summary (e.g. "Active week with X PRs across Y repos, focused on ...")
- **Key themes**: 3-5 bullet points, each one line max, highlighting what areas saw work
- **Standout PRs**: 2-3 bullet points calling out the largest or most notable changes with author names bolded
- **Activity**: one bullet noting total PR count and top contributors by volume

Keep every bullet to one line. No paragraphs. Be factual and specific.`,
      }],
    });

    const resultText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("");

    await db.insert(settings)
      .values({ key: cacheKey, value: resultText })
      .onConflictDoUpdate({ target: settings.key, set: { value: resultText } });

    return NextResponse.json({ summary: resultText, cached: false });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
