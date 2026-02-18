"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useDateRange } from "@/components/layout/DateContext";
import MetricCard from "@/components/layout/MetricCard";
import ThroughputChart from "@/components/charts/ThroughputChart";

interface ThroughputData {
  week: string;
  prCount: number;
  loc: number;
  prsPerContributor: number;
  additions: number;
  deletions: number;
}

interface OutlierAlert {
  login: string;
  metric: string;
  value: number;
  teamMean: number;
  type: string;
  severity: string;
}

function getCurrentWeekStart(): number {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff));
  return Math.floor(monday.getTime() / 1000);
}

export default function DashboardPage() {
  const router = useRouter();
  const { startDate, endDate } = useDateRange();
  const [throughput, setThroughput] = useState<ThroughputData[]>([]);
  const [outliers, setOutliers] = useState<OutlierAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [hasCachedSummary, setHasCachedSummary] = useState(false);

  const currentWeekStart = getCurrentWeekStart();

  function fetchSummary(force: boolean) {
    setSummaryLoading(true);
    setSummaryError(null);
    fetch("/api/ai/week-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: currentWeekStart, force }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setSummaryError(data.error);
        } else {
          setSummary(data.summary);
          setHasCachedSummary(true);
        }
      })
      .catch((err) => setSummaryError(err.message))
      .finally(() => setSummaryLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/metrics/throughput?startDate=${startDate}&endDate=${endDate}`).then((r) => r.json()),
      fetch(`/api/metrics/outliers?startDate=${startDate}&endDate=${endDate}`).then((r) => r.json()),
    ]).then(([throughputData, outlierData]) => {
      setThroughput(throughputData.teamThroughput || []);
      setOutliers([...(outlierData.outliers || []), ...(outlierData.trendOutliers || [])]);
      setLoading(false);
    });
    fetchSummary(false);
  }, [startDate, endDate]);

  const totalPRs = throughput.reduce((sum, w) => sum + w.prCount, 0);
  const totalLOC = throughput.reduce((sum, w) => sum + w.loc, 0);
  const totalAdditions = throughput.reduce((sum, w) => sum + w.additions, 0);

  const midpoint = Math.floor(throughput.length / 2);
  const firstHalf = throughput.slice(0, midpoint);
  const secondHalf = throughput.slice(midpoint);
  const firstPRs = firstHalf.reduce((s, w) => s + w.prCount, 0);
  const secondPRs = secondHalf.reduce((s, w) => s + w.prCount, 0);
  const prChange = firstPRs > 0 ? Math.round(((secondPRs - firstPRs) / firstPRs) * 100) : 0;

  const warningOutliers = outliers.filter((o) => o.severity === "warning");
  const topOutliers = outliers.filter((o) => o.type === "top");

  const handleWeekClick = useCallback((week: string) => {
    const ts = Math.floor(new Date(week + "T00:00:00Z").getTime() / 1000);
    router.push(`/week/${ts}`);
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="PRs Merged"
          value={totalPRs}
          change={prChange}
          sparklineData={throughput.map((w) => ({ value: w.prCount }))}
          accentColor="#22D3EE"
        />
        <MetricCard
          title="Total LOC"
          value={totalLOC.toLocaleString()}
          sparklineData={throughput.map((w) => ({ value: w.loc }))}
          accentColor="#A78BFA"
        />
        <MetricCard
          title="Additions"
          value={totalAdditions.toLocaleString()}
          sparklineData={throughput.map((w) => ({ value: w.additions }))}
          accentColor="#34D399"
        />
        <MetricCard
          title="Outlier Alerts"
          value={warningOutliers.length}
          accentColor="#FBBF24"
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <h2 className="text-sm font-display font-semibold text-text-secondary">This Week&apos;s Summary</h2>
          </div>
          {hasCachedSummary && !summaryLoading && (
            <button
              onClick={() => fetchSummary(true)}
              className="text-xs text-text-muted hover:text-accent transition-colors"
            >
              Regenerate
            </button>
          )}
        </div>
        {summaryLoading ? (
          <div className="bg-bg-secondary rounded-xl border border-border p-5">
            <div className="flex items-center gap-3 text-text-muted text-sm">
              <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
              Generating summary...
            </div>
          </div>
        ) : summaryError ? (
          <div className="bg-bg-secondary rounded-xl border border-border p-5">
            <p className="text-sm text-danger/80 mb-3">{summaryError}</p>
            <button
              onClick={() => fetchSummary(false)}
              className="text-xs text-accent hover:text-accent-hover transition-colors"
            >
              Try again
            </button>
          </div>
        ) : summary ? (
          <div className="bg-bg-secondary rounded-xl border border-border p-5">
            <div className="text-sm text-text-secondary leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: (props) => <p className="my-1.5" {...props} />,
                  ul: (props) => <ul className="list-disc pl-4 my-1.5 space-y-1" {...props} />,
                  ol: (props) => <ol className="list-decimal pl-4 my-1.5 space-y-1" {...props} />,
                  strong: (props) => <strong className="font-semibold text-text-primary" {...props} />,
                }}
              >
                {summary}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="bg-bg-secondary rounded-xl border border-border p-5">
            <p className="text-sm text-text-muted mb-3">Generate an AI-powered summary of this week&apos;s activity.</p>
            <button
              onClick={() => fetchSummary(false)}
              className="px-3 py-1.5 text-xs font-medium bg-accent/10 text-accent border border-accent/20 rounded-lg hover:bg-accent/20 transition-colors"
            >
              Generate Summary
            </button>
          </div>
        )}
      </section>

      {topOutliers.length > 0 && (
        <div className="bg-bg-secondary border border-success/15 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
            <h2 className="text-sm font-display font-semibold text-success">Top Performers</h2>
          </div>
          {topOutliers.slice(0, 5).map((o, i) => (
            <div key={i} className="text-sm flex items-baseline gap-2">
              <span className="font-medium text-text-primary">{o.login}</span>
              <span className="text-text-muted">{o.metric}</span>
              <span className="font-mono text-success">{o.value}</span>
              <span className="text-text-muted text-xs">avg {o.teamMean}</span>
            </div>
          ))}
        </div>
      )}

      {warningOutliers.length > 0 && (
        <div className="bg-warning-dim border border-warning/15 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-warning shadow-[0_0_6px_rgba(251,191,36,0.5)]" />
            <h2 className="text-sm font-display font-semibold text-warning">Needs Attention</h2>
          </div>
          {warningOutliers.slice(0, 5).map((o, i) => (
            <div key={i} className="text-sm flex items-baseline gap-2">
              <span className="font-medium text-text-primary">{o.login}</span>
              <span className="text-text-muted">{o.metric}</span>
              <span className="font-mono text-warning">{o.value}</span>
              <span className="text-text-muted text-xs">avg {o.teamMean}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-lg font-display font-semibold mb-4 text-text-secondary">Team Throughput</h2>
        <ThroughputChart data={throughput} onWeekClick={handleWeekClick} />
      </div>
    </div>
  );
}
