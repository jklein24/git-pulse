"use client";

import { useEffect, useState } from "react";
import { useDateRange } from "@/components/layout/DateContext";
import { useSettings } from "@/components/layout/SettingsContext";
import MetricCard from "@/components/layout/MetricCard";
import AiUsageTrendChart from "@/components/charts/AiUsageTrendChart";
import AiVsHumanOutputChart from "@/components/charts/AiVsHumanOutputChart";
import AiCorrelationScatter from "@/components/charts/AiCorrelationScatter";
import AiVelocityImpactChart from "@/components/charts/AiVelocityImpactChart";
import ToolAcceptanceChart from "@/components/charts/ToolAcceptanceChart";
import AiCostTrendChart from "@/components/charts/AiCostTrendChart";
import AiAdoptionHeatmap from "@/components/charts/AiAdoptionHeatmap";
import AiCostByModelChart from "@/components/charts/AiCostByModelChart";

interface SummaryCards {
  adoptionRate: number;
  aiAssistedPrs: number;
  costPerMergedPr: number;
  toolAcceptRate: number;
}

interface PersonStats {
  login: string;
  avatarUrl: string | null;
  sessions: number;
  linesAdded: number;
  linesRemoved: number;
  commits: number;
  prs: number;
  accepted: number;
  rejected: number;
  costCents: number;
}

interface BeforeAfter {
  splitDate: string;
  before: { prsPerWeek: number; avgMergeTimeHours: number; avgLoc: number };
  after: { prsPerWeek: number; avgMergeTimeHours: number; avgLoc: number };
  delta: { prsPerWeek: number; avgMergeTimeHours: number; avgLoc: number };
}

export default function AiImpactPage() {
  const { startDate, endDate } = useDateRange();
  const { hideIndividualMetrics } = useSettings();
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  const [summary, setSummary] = useState<SummaryCards>({ adoptionRate: 0, aiAssistedPrs: 0, costPerMergedPr: 0, toolAcceptRate: 0 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [trend, setTrend] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiVsHuman, setAiVsHuman] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [toolAcceptance, setToolAcceptance] = useState<any[]>([]);
  const [perPerson, setPerPerson] = useState<PersonStats[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [heatmap, setHeatmap] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [scatter, setScatter] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [velocity, setVelocity] = useState<any[]>([]);
  const [beforeAfter, setBeforeAfter] = useState<BeforeAfter | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [costTrend, setCostTrend] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [costByModel, setCostByModel] = useState<any[]>([]);

  const [sortCol, setSortCol] = useState<string>("sessions");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setLoading(true);
    const qs = `startDate=${startDate}&endDate=${endDate}`;

    Promise.all([
      fetch(`/api/metrics/ai-usage?${qs}`).then((r) => r.json()),
      fetch(`/api/metrics/ai-impact?${qs}`).then((r) => r.json()),
      fetch(`/api/metrics/ai-cost?${qs}`).then((r) => r.json()),
    ]).then(([usageData, impactData, costData]) => {
      setSummary(usageData.summary || { adoptionRate: 0, aiAssistedPrs: 0, costPerMergedPr: 0, toolAcceptRate: 0 });
      setTrend(usageData.trend || []);
      setAiVsHuman(usageData.aiVsHuman || []);
      setToolAcceptance(usageData.toolAcceptance || []);
      setPerPerson(usageData.perPerson || []);
      setHeatmap(usageData.heatmap || []);
      setScatter(impactData.scatter || []);
      setVelocity(impactData.velocity || []);
      setBeforeAfter(impactData.beforeAfter || null);
      setCostTrend(costData.costTrend || []);
      setCostByModel(costData.costByModel || []);

      const hasSomeData = (usageData.trend?.length ?? 0) > 0 || (usageData.perPerson?.length ?? 0) > 0;
      setHasData(hasSomeData);
      setLoading(false);
    });
  }, [startDate, endDate]);

  const sortedPeople = [...perPerson].sort((a, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aVal = ((a as any)[sortCol] as number) ?? 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bVal = ((b as any)[sortCol] as number) ?? 0;
    return sortDir === "desc" ? bVal - aVal : aVal - bVal;
  });

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
        Loading AI Impact data...
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold tracking-tight">AI Impact</h1>
        <div className="bg-bg-secondary rounded-xl border border-border p-8 text-center">
          <div className="text-4xl mb-4 opacity-30">🤖</div>
          <h2 className="text-lg font-display font-semibold text-text-secondary mb-2">No Claude Code data yet</h2>
          <p className="text-sm text-text-muted mb-4">
            Configure your Claude Admin API key in Settings and sync Claude Code usage data to see AI impact analytics.
          </p>
          <a href="/settings" className="inline-flex px-4 py-2 text-sm font-display font-semibold rounded-lg bg-accent/10 text-accent border border-accent/20 hover:bg-accent/15 hover:border-accent/40 transition-all">
            Go to Settings
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold tracking-tight">AI Impact</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="AI Adoption Rate"
          value={`${summary.adoptionRate}%`}
          accentColor="#A78BFA"
        />
        <MetricCard
          title="AI-Assisted PRs"
          value={summary.aiAssistedPrs}
          accentColor="#22D3EE"
          sparklineData={trend.map((t: { prs: number }) => ({ value: t.prs ?? 0 }))}
        />
        <MetricCard
          title="Cost / Merged PR"
          value={`$${summary.costPerMergedPr.toFixed(2)}`}
          accentColor="#FB923C"
        />
        <MetricCard
          title="Tool Accept Rate"
          value={`${summary.toolAcceptRate}%`}
          accentColor="#34D399"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AiUsageTrendChart data={trend.map((t: { week: number; sessions: number; linesAdded: number; activeUsers: number }) => ({
          week: new Date(t.week * 1000).toISOString().split("T")[0],
          sessions: t.sessions ?? 0,
          linesAdded: t.linesAdded ?? 0,
          activeUsers: t.activeUsers ?? 0,
        }))} />
        <AiVsHumanOutputChart data={aiVsHuman} />
      </div>

      {!hideIndividualMetrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AiCorrelationScatter data={scatter} />
          <AiVelocityImpactChart data={velocity} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ToolAcceptanceChart data={toolAcceptance} />
        <AiCostTrendChart data={costTrend} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!hideIndividualMetrics && <AiAdoptionHeatmap data={heatmap} />}
        <AiCostByModelChart data={costByModel} />
      </div>

      {beforeAfter && (
        <div className="bg-bg-secondary rounded-xl border border-border p-5 space-y-4">
          <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted">Before / After AI Adoption</h3>
          <p className="text-xs text-text-muted">Split at {beforeAfter.splitDate} (first Claude Code usage detected)</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                <th className="pb-3">Metric</th>
                <th className="pb-3 text-right">Before</th>
                <th className="pb-3 text-right">After</th>
                <th className="pb-3 text-right">Change</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "PRs / Week", before: beforeAfter.before.prsPerWeek, after: beforeAfter.after.prsPerWeek, delta: beforeAfter.delta.prsPerWeek, invert: false },
                { label: "Avg Merge Time (hrs)", before: beforeAfter.before.avgMergeTimeHours, after: beforeAfter.after.avgMergeTimeHours, delta: beforeAfter.delta.avgMergeTimeHours, invert: true },
                { label: "Avg LOC / PR", before: beforeAfter.before.avgLoc, after: beforeAfter.after.avgLoc, delta: beforeAfter.delta.avgLoc, invert: false },
              ].map((row) => {
                const isGood = row.invert ? row.delta < 0 : row.delta > 0;
                return (
                  <tr key={row.label} className="border-b border-border/40">
                    <td className="py-3 text-text-secondary">{row.label}</td>
                    <td className="py-3 text-right font-mono text-text-primary">{row.before}</td>
                    <td className="py-3 text-right font-mono text-text-primary">{row.after}</td>
                    <td className={`py-3 text-right font-mono font-medium ${isGood ? "text-success" : "text-danger"}`}>
                      {row.delta > 0 ? "+" : ""}{row.delta}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!hideIndividualMetrics && perPerson.length > 0 && (
        <div className="bg-bg-secondary rounded-xl border border-border p-5 space-y-4">
          <h3 className="text-xs font-display font-semibold uppercase tracking-widest text-text-muted">Per-Person AI Stats</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-display font-semibold text-text-muted uppercase tracking-widest border-b border-border">
                  {[
                    { key: "login", label: "Person" },
                    { key: "sessions", label: "Sessions" },
                    { key: "prs", label: "AI PRs" },
                    { key: "commits", label: "AI Commits" },
                    { key: "linesAdded", label: "AI Lines" },
                    { key: "acceptRate", label: "Accept %" },
                    { key: "costCents", label: "Cost" },
                  ].map((col) => (
                    <th
                      key={col.key}
                      className={`pb-3 cursor-pointer hover:text-accent transition-colors ${col.key !== "login" ? "text-right" : ""}`}
                      onClick={() => toggleSort(col.key)}
                    >
                      {col.label}
                      {sortCol === col.key && (
                        <span className="ml-1 text-accent">{sortDir === "desc" ? "↓" : "↑"}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPeople.map((p) => {
                  const acceptRate = (p.accepted ?? 0) + (p.rejected ?? 0) > 0
                    ? Math.round(((p.accepted ?? 0) / ((p.accepted ?? 0) + (p.rejected ?? 0))) * 100)
                    : 0;
                  return (
                    <tr key={p.login} className="border-b border-border/40">
                      <td className="py-3 font-mono font-medium text-text-primary">
                        <a href={`/person/${p.login}`} className="hover:text-accent transition-colors">
                          {p.login}
                        </a>
                      </td>
                      <td className="py-3 text-right font-mono text-text-primary">{p.sessions ?? 0}</td>
                      <td className="py-3 text-right font-mono text-text-primary">{p.prs ?? 0}</td>
                      <td className="py-3 text-right font-mono text-text-primary">{p.commits ?? 0}</td>
                      <td className="py-3 text-right font-mono text-text-primary">{((p.linesAdded ?? 0) + (p.linesRemoved ?? 0)).toLocaleString()}</td>
                      <td className="py-3 text-right font-mono text-text-primary">{acceptRate}%</td>
                      <td className="py-3 text-right font-mono text-text-primary">${((p.costCents ?? 0) / 100).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
