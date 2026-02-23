import { NextRequest, NextResponse } from "next/server";
import {
  getTeamAiUsageTrend,
  getAiVsHumanOutput,
  getToolAcceptanceTrend,
  getPerPersonAiStats,
  getAdoptionHeatmap,
  getAiSummaryCards,
} from "@/lib/metrics/ai-usage";
import { requireAuth, handleAuthError, AuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
    const endDate = Number(searchParams.get("endDate")) || now;

    const [trend, aiVsHuman, toolAcceptance, perPerson, heatmap, summary] =
      await Promise.all([
        getTeamAiUsageTrend(auth.workspace.id, startDate, endDate),
        getAiVsHumanOutput(auth.workspace.id, startDate, endDate),
        getToolAcceptanceTrend(auth.workspace.id, startDate, endDate),
        getPerPersonAiStats(auth.workspace.id, startDate, endDate),
        getAdoptionHeatmap(auth.workspace.id, startDate, endDate),
        getAiSummaryCards(auth.workspace.id, startDate, endDate),
      ]);

    return NextResponse.json({
      trend,
      aiVsHuman,
      toolAcceptance,
      perPerson,
      heatmap,
      summary,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
