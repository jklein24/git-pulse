"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDateRange } from "@/components/layout/DateContext";
import ThroughputChart from "@/components/charts/ThroughputChart";
import MergeTimeChart from "@/components/charts/MergeTimeChart";
import ReviewVelocityChart from "@/components/charts/ReviewVelocityChart";
import ReviewLoadChart from "@/components/charts/ReviewLoadChart";
import LinesChart from "@/components/charts/LinesChart";
import ChurnChart from "@/components/charts/ChurnChart";
import AvgPrSizeChart from "@/components/charts/AvgPrSizeChart";

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group ml-1.5 inline-flex">
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-border text-[10px] font-mono text-text-muted cursor-help leading-none">?</span>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 px-3 py-2 rounded-lg bg-bg-primary border border-border text-xs text-text-secondary leading-relaxed shadow-lg z-10">
        {text}
      </span>
    </span>
  );
}

export default function TrendsPage() {
  const router = useRouter();
  const { startDate, endDate } = useDateRange();
  const [throughput, setThroughput] = useState<Array<{ week: string; prCount: number; loc: number; prsPerContributor: number }>>([]);
  const [mergeTime, setMergeTime] = useState<Array<{ week: string; p50: number; p75: number; p90: number }>>([]);
  const [reviewVelocity, setReviewVelocity] = useState<Array<{ week: string; medianHours: number }>>([]);
  const [reviewLoad, setReviewLoad] = useState<Array<{ login: string; reviewCount: number }>>([]);
  const [lines, setLines] = useState<Array<{ login: string; additions: number; deletions: number }>>([]);
  const [churn, setChurn] = useState<Array<{ week: string; rate: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = `startDate=${startDate}&endDate=${endDate}`;

    Promise.all([
      fetch(`/api/metrics/throughput?${qs}`).then((r) => r.json()),
      fetch(`/api/metrics/merge-time?${qs}`).then((r) => r.json()),
      fetch(`/api/metrics/review-velocity?${qs}`).then((r) => r.json()),
      fetch(`/api/metrics/review-load?${qs}`).then((r) => r.json()),
      fetch(`/api/metrics/lines?${qs}`).then((r) => r.json()),
      fetch(`/api/metrics/churn?${qs}`).then((r) => r.json()),
    ]).then(([tp, mt, rv, rl, ln, ch]) => {
      setThroughput(tp.teamThroughput || []);
      setMergeTime(mt.mergeTimeTrend || []);
      setReviewVelocity(rv.reviewVelocityTrend || []);
      setReviewLoad(rl.reviewLoad || []);
      setLines(ln.linesPerPerson || []);
      setChurn(ch.churnRate || []);
      setLoading(false);
    });
  }, [startDate, endDate]);

  const handleWeekClick = useCallback((week: string) => {
    const ts = Math.floor(new Date(week + "T00:00:00Z").getTime() / 1000);
    router.push(`/week/${ts}`);
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-text-muted text-sm">
        <span className="w-4 h-4 border-2 border-text-muted border-t-accent rounded-full animate-spin" />
        Loading trends...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-display font-bold tracking-tight">Trends</h1>

      <section>
        <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">Team Throughput</h2>
        <ThroughputChart data={throughput} onWeekClick={handleWeekClick} />
      </section>

      <section>
        <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">
          Average PR Size
          <span className="ml-2 text-xs font-mono text-text-muted">lines changed</span>
        </h2>
        <AvgPrSizeChart
          data={throughput
            .filter((w) => w.prCount > 0)
            .map((w) => ({ week: w.week, avgSize: Math.round(w.loc / w.prCount) }))}
        />
      </section>

      <section>
        <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">
          Time to Merge
          <InfoTooltip text="Hours from when a PR is marked ready for review to when it's merged. Shown as 50th, 75th, and 90th percentiles per week." />
          <span className="ml-2 text-xs font-mono text-text-muted">p50 / p75 / p90</span>
        </h2>
        <MergeTimeChart data={mergeTime} />
      </section>

      <section>
        <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">
          Review Velocity
          <InfoTooltip text="Median hours from when a PR is published to when it receives its first human review. Bot reviewers are excluded." />
          <span className="ml-2 text-xs font-mono text-text-muted">median hours · human reviewers only</span>
        </h2>
        <ReviewVelocityChart data={reviewVelocity} />
      </section>

      <section>
        <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">Review Load Distribution</h2>
        <ReviewLoadChart data={reviewLoad} />
      </section>

      <section>
        <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">Lines Written Per Person</h2>
        <LinesChart data={lines} />
      </section>

      <section>
        <h2 className="text-base font-display font-semibold mb-4 text-text-secondary">
          Code Churn Rate
          <InfoTooltip text="Percentage of newly added lines that are modified or deleted by a subsequent PR within a rolling window (default 14 days). High churn may indicate rework or instability." />
        </h2>
        <ChurnChart data={churn} />
      </section>
    </div>
  );
}
