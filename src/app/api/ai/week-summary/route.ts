import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getWorkspaceSetting, setWorkspaceSetting } from "@/lib/db/workspace-scope";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const { weekStart, force } = await request.json();
    if (!weekStart) {
      return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
    }

    const workspaceId = auth.workspace.id;
    const cacheKey = `week_summary_${weekStart}`;

    if (!force) {
      const cached = await getWorkspaceSetting(workspaceId, cacheKey);
      if (cached) {
        return NextResponse.json({ summary: cached, cached: true });
      }
    }

    const weekDetailUrl = new URL(`/api/metrics/week-detail?weekStart=${weekStart}`, request.url);
    const weekData = await fetch(weekDetailUrl, {
      headers: { cookie: request.headers.get("cookie") || "" },
    }).then(r => r.json());

    const weekLabel = new Date(weekStart * 1000).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const prSummaries = (weekData.prs || []).map((pr: Record<string, unknown>) =>
      `- "${pr.title}" by ${pr.authorLogin} in ${pr.repoFullName} (+${pr.filteredAdditions ?? 0}/-${pr.filteredDeletions ?? 0})`
    ).join("\n");

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

    await setWorkspaceSetting(workspaceId, cacheKey, resultText);

    return NextResponse.json({ summary: resultText, cached: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
