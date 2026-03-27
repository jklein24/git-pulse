import { NextRequest, NextResponse } from "next/server";
import {
  getTicketThroughput,
  getTicketsResolvedPerPerson,
  getTicketCycleTime,
  getTicketsByProject,
  getTicketDataQuality,
} from "@/lib/metrics/tickets";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = Math.floor(Date.now() / 1000);
  const startDate = Number(searchParams.get("startDate")) || now - 30 * 86400;
  const endDate = Number(searchParams.get("endDate")) || now;

  const [throughput, perPerson, cycleTime, byProject, dataQuality] = await Promise.all([
    getTicketThroughput(startDate, endDate),
    getTicketsResolvedPerPerson(startDate, endDate),
    getTicketCycleTime(startDate, endDate),
    getTicketsByProject(startDate, endDate),
    getTicketDataQuality(startDate, endDate),
  ]);

  return NextResponse.json({
    ticketThroughput: throughput,
    ticketsResolvedPerPerson: perPerson,
    ticketCycleTime: cycleTime,
    ticketsByProject: byProject,
    dataQuality,
  });
}
