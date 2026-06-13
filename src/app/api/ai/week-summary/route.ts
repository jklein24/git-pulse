import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";

const MISSING_API_KEY_MESSAGE =
  "Weekly summaries require a standard Anthropic API key (sk-ant-api...). Set ANTHROPIC_API_KEY in .env.local and restart the dev server, then try generating the weekly summary again. Note: the Admin API key in Settings is only for Claude Code usage syncing and cannot generate summaries.";

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

  // The Messages API requires a standard key (sk-ant-api...). The Admin key stored
  // in settings only works for the usage-report endpoint, so we use the env var here.
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: MISSING_API_KEY_MESSAGE }, { status: 400 });
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

  type TicketRow = { key: string; summary: string; projectKey: string; parentKey: string | null; assigneeName: string | null };
  type ProjectCount = { projectKey: string; count: number };
  type EpicRow = {
    key: string;
    summary: string;
    projectKey: string;
    status: string;
    dueDate: string | null;
    daysUntilDue: number | null;
    doneChildren: number;
    totalChildren: number;
    percentDone: number;
    resolvedLast7Days: number;
    resolvedLast4Weeks: number;
    trackingStatus: string;
    isStarred: boolean;
  };

  const tickets: TicketRow[] = weekData.ticketsResolved || [];
  const ticketsByProject: ProjectCount[] = weekData.ticketsByProject || [];
  const epics: EpicRow[] = weekData.epicsInMotion || [];

  const projectBreakdown = ticketsByProject.length === 0
    ? "(none)"
    : ticketsByProject.map((p) => `${p.projectKey}: ${p.count}`).join(", ");

  const ticketLines = tickets.length === 0
    ? "(none)"
    : tickets.slice(0, 30).map((t) =>
        `- ${t.key}: "${t.summary}"${t.parentKey ? ` (epic ${t.parentKey})` : ""}${t.assigneeName ? ` — ${t.assigneeName}` : ""}`,
      ).join("\n");

  const epicLines = epics.length === 0
    ? "(none)"
    : epics.map((e) => {
        const star = e.isStarred ? "⭐ " : "";
        const due = e.dueDate ? ` due ${e.dueDate}` : "";
        const days = e.daysUntilDue !== null ? ` (${e.daysUntilDue}d)` : "";
        return `- ${star}${e.key} "${e.summary}" — ${e.percentDone}% (${e.doneChildren}/${e.totalChildren}), ${e.resolvedLast7Days}/${e.resolvedLast4Weeks} resolved 7d/28d, ${e.trackingStatus}${due}${days}`;
      }).join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: "You are a concise engineering manager writing a weekly team summary. Be specific and brief. Use markdown bullet points. Bold key names, epic IDs, and metrics. Never invent data — only reference what's in the input.",
      messages: [{
        role: "user",
        content: `Write a brief weekly engineering summary for the week of ${weekLabel}.

## PRs merged (${weekData.prs?.length ?? 0})
${prSummaries || "(none)"}

## Tickets resolved (${tickets.length})
By project: ${projectBreakdown}
${ticketLines}

## Active epics (starred or moving in last 4 weeks)
${epicLines}

Format your response as:
- A one-sentence overall summary that ties shipping (PRs) to initiatives (epics).
- **Shipped**: 2-4 bullets on what got built — themes from PRs, bold repo/author names.
- **Epics in motion**: 2-4 bullets on which initiatives advanced this week, with **EPIC-KEY** bolded, % done, tracking status, and (if relevant) due date. Lead with starred epics.
- **Standouts**: 1-2 bullets calling out the largest or most notable PRs with **author** bolded.
- **Risks**: 0-2 bullets only if there are at-risk epics, overdue milestones, or epics with low resolved-7d. Omit the heading entirely if nothing to flag.
- **Activity**: one bullet with total PR count, ticket count, and top 2-3 contributors.

Keep every bullet to one line. No paragraphs. Be factual and specific. Do not list every PR or ticket — synthesize.`,
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
