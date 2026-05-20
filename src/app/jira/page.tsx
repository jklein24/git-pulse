"use client";

import { useEffect, useMemo, useState } from "react";
import { useDateRange } from "@/components/layout/DateContext";
import MetricCard from "@/components/layout/MetricCard";
import TicketThroughputByProjectChart from "@/components/charts/TicketThroughputByProjectChart";
import TicketStatusSnapshotChart from "@/components/charts/TicketStatusSnapshotChart";
import EpicMilestoneTable, { type EpicProgress } from "@/components/charts/EpicMilestoneTable";

interface ProjectThroughputRow {
  week: string;
  projectKey: string;
  resolved: number;
}

interface StatusSnapshotRow {
  projectKey: string;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
}

interface CycleTimeRow {
  week: string;
  avgCycleDays: number;
  ticketCount: number;
}

interface OverviewResponse {
  totalThroughput: Array<{ week: string; resolved: number }>;
  projectThroughput: ProjectThroughputRow[];
  statusSnapshot: StatusSnapshotRow[];
  epics: EpicProgress[];
  excludedEpicKeys: string[];
  starredEpicKeys?: string[];
  cycleTime: CycleTimeRow[];
  dataQuality: { totalResolved: number; unassignedResolved: number; unassignedPct: number };
}

export default function JiraPage() {
  const { startDate, endDate } = useDateRange();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidingKey, setHidingKey] = useState<string | null>(null);

  const fetchOverview = (start: number, end: number) =>
    fetch(`/api/metrics/jira-overview?startDate=${start}&endDate=${end}`)
      .then((r) => r.json())
      .then((d: OverviewResponse) => setData(d));

  useEffect(() => {
    setLoading(true);
    fetchOverview(startDate, endDate)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  async function hideEpic(key: string) {
    if (!data) return;
    setHidingKey(key);
    setData({ ...data, epics: data.epics.filter((e) => e.key !== key) });
    const nextExcluded = Array.from(new Set([...data.excludedEpicKeys, key]));
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "jira_excluded_epics", value: nextExcluded.join(", ") }),
      });
      await fetchOverview(startDate, endDate);
    } finally {
      setHidingKey(null);
    }
  }

  async function toggleStar(key: string, nextStarred: boolean) {
    if (!data) return;
    const currentStarred = data.starredEpicKeys ?? [];
    const nextStarredKeys = nextStarred
      ? Array.from(new Set([...currentStarred, key]))
      : currentStarred.filter((k) => k !== key);
    setData({
      ...data,
      epics: data.epics.map((e) => (e.key === key ? { ...e, isStarred: nextStarred } : e)),
      starredEpicKeys: nextStarredKeys,
    });
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "jira_starred_epics", value: nextStarredKeys.join(", ") }),
    });
    await fetchOverview(startDate, endDate);
  }

  const summary = useMemo(() => {
    if (!data) return null;
    const resolvedInPeriod = data.totalThroughput.reduce((sum, w) => sum + w.resolved, 0);
    const openTickets = data.statusSnapshot.reduce((sum, p) => sum + p.todo + p.inProgress + p.inReview, 0);
    const onTrack = data.epics.filter((e) => e.trackingStatus === "on_track" || e.trackingStatus === "complete").length;
    const atRisk = data.epics.filter((e) => e.trackingStatus === "at_risk").length;
    const cycleSamples = data.cycleTime.filter((w) => w.ticketCount > 0);
    const avgCycle = cycleSamples.length === 0
      ? 0
      : cycleSamples.reduce((sum, w) => sum + w.avgCycleDays * w.ticketCount, 0) /
        cycleSamples.reduce((sum, w) => sum + w.ticketCount, 0);
    return {
      resolvedInPeriod,
      openTickets,
      onTrack,
      atRisk,
      avgCycle: Math.round(avgCycle * 10) / 10,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold tracking-tight">Jira</h1>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
          Loading...
        </div>
      ) : !data || (data.totalThroughput.length === 0 && data.statusSnapshot.length === 0) ? (
        <div className="text-text-muted text-sm">
          No Jira data yet. Configure Jira in <a href="/settings" className="text-accent underline">Settings</a> and run a sync.
        </div>
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                title="Resolved (period)"
                value={summary.resolvedInPeriod}
                sparklineData={data.totalThroughput.map((w) => ({ value: w.resolved }))}
                sparklineKey="value"
                accentColor="#10B981"
              />
              <MetricCard title="Open tickets" value={summary.openTickets} accentColor="#22D3EE" />
              <MetricCard
                title="Epics on track"
                value={`${summary.onTrack}${summary.atRisk > 0 ? ` / ${summary.atRisk} at risk` : ""}`}
                accentColor={summary.atRisk > 0 ? "#F87171" : "#10B981"}
              />
              <MetricCard
                title="Avg cycle (days)"
                value={summary.avgCycle || "—"}
                accentColor="#A78BFA"
              />
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-display font-semibold text-text-secondary uppercase tracking-widest">
              Weekly throughput by project
            </h2>
            <TicketThroughputByProjectChart data={data.projectThroughput} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-display font-semibold text-text-secondary uppercase tracking-widest">
              Current status snapshot
            </h2>
            <TicketStatusSnapshotChart data={data.statusSnapshot} />
          </section>

          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-3">
                <h2 className="text-sm font-display font-semibold text-text-secondary uppercase tracking-widest">
                  Epic milestones
                </h2>
                <span className="text-[11px] font-mono text-text-muted">
                  {(() => {
                    const visible = hidingKey ? data.epics.filter((e) => e.key !== hidingKey) : data.epics;
                    const starredCount = visible.filter((e) => e.isStarred).length;
                    const activeCount = visible.filter((e) => !e.isStarred && !e.isStale).length;
                    const staleCount = visible.filter((e) => !e.isStarred && e.isStale).length;
                    const parts = [];
                    if (starredCount > 0) parts.push(`${starredCount} starred`);
                    parts.push(`${activeCount} active`);
                    if (staleCount > 0) parts.push(`${staleCount} stale`);
                    return parts.join(" · ");
                  })()}
                </span>
              </div>
              {data.excludedEpicKeys.length > 0 && (
                <span className="text-[11px] font-mono text-text-muted">
                  {data.excludedEpicKeys.length} hidden ·{" "}
                  <a href="/settings" className="underline hover:text-text-secondary">
                    manage
                  </a>
                </span>
              )}
            </div>
            <EpicMilestoneTable
              epics={hidingKey ? data.epics.filter((e) => e.key !== hidingKey) : data.epics}
              onHide={hideEpic}
              onToggleStar={toggleStar}
            />
          </section>
        </>
      )}
    </div>
  );
}
