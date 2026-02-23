import { NextRequest, NextResponse } from "next/server";
import {
  getTicketThroughput,
  getTicketsResolvedPerPerson,
  getTicketCycleTime,
  getTicketsByProject,
  getTicketDataQuality,
} from "@/lib/metrics/tickets";
import { requireAuth, handleAuthError } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const now = Math.floor(Date.now() / 1000);
    const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
    const endDate = Number(searchParams.get("endDate")) || now;

    const [throughput, perPerson, cycleTime, byProject, dataQuality] = await Promise.all([
      getTicketThroughput(auth.workspace.id, startDate, endDate),
      getTicketsResolvedPerPerson(auth.workspace.id, startDate, endDate),
      getTicketCycleTime(auth.workspace.id, startDate, endDate),
      getTicketsByProject(auth.workspace.id, startDate, endDate),
      getTicketDataQuality(auth.workspace.id, startDate, endDate),
    ]);

    return NextResponse.json({
      ticketThroughput: throughput,
      ticketsResolvedPerPerson: perPerson,
      ticketCycleTime: cycleTime,
      ticketsByProject: byProject,
      dataQuality,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
