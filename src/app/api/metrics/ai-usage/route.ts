import { NextRequest, NextResponse } from "next/server";
import {
  getTeamAiUsageTrend,
  getAiVsHumanOutput,
  getToolAcceptanceTrend,
  getPerPersonAiStats,
  getAdoptionHeatmap,
  getAiSummaryCards,
} from "@/lib/metrics/ai-usage";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const [trend, aiVsHuman, toolAcceptance, perPerson, heatmap, summary] =
    await Promise.all([
      getTeamAiUsageTrend(startDate, endDate),
      getAiVsHumanOutput(startDate, endDate),
      getToolAcceptanceTrend(startDate, endDate),
      getPerPersonAiStats(startDate, endDate),
      getAdoptionHeatmap(startDate, endDate),
      getAiSummaryCards(startDate, endDate),
    ]);

  return NextResponse.json({
    trend,
    aiVsHuman,
    toolAcceptance,
    perPerson,
    heatmap,
    summary,
  });
}
